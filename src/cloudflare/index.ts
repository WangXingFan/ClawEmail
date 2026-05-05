import { z, ZodError } from "zod";
import {
  createMailbox as createDashboardMailbox,
  deleteMailbox as deleteDashboardMailbox,
  getAuthMe,
  listApiKeys,
  listDashboardMailboxes,
  listWorkspaces,
  sendLoginCode,
  updateMailboxCommunicationSettings,
  verifyLoginCode,
  type ClawMailbox
} from "./claw-dashboard";
import {
  attachmentList,
  deleteRemoteMail,
  getAttachment,
  listRemoteInboxMessageIds,
  readRemoteMail,
  replyMail,
  sendMail
} from "./claw-mail";
import {
  deleteMailById,
  deleteMailsByProviderIds,
  getMailboxByEmail,
  getMailboxById,
  getMailById,
  getMailByProviderId,
  listActiveMailboxes,
  listAttachments,
  listMailboxes,
  listMailProviderIds,
  listMails,
  markMailboxDeleted,
  markMailboxesMissingDeleted,
  saveMail,
  upsertMailbox,
  updateMailboxCommSettings
} from "./db";
import {
  clearClawAuthSettings,
  getClawAuthStatus,
  getParentMailboxId,
  requireDashboardCookie,
  saveClawAuthSettings
} from "./runtime-config";
import type { Env, MailboxRow } from "./types";

type Params = Record<string, string>;
type Handler = (ctx: {
  request: Request;
  env: Env;
  params: Params;
  url: URL;
}) => Promise<Response> | Response;

type Route = {
  method: string;
  pattern: RegExp;
  keys: string[];
  handler: Handler;
};

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8"
};

const createMailboxSchema = z.object({
  suffix: z.string().regex(/^[a-z0-9]{1,32}$/)
});

const DEFAULT_COMM_SETTINGS = {
  commLevel: 2,
  extReceiveType: 1,
  extSendType: 1
} as const;

const commSettingsSchema = z.object({
  commLevel: z.number().int().min(0).max(2),
  extReceiveType: z.number().int().min(0).max(1).optional(),
  extSendType: z.number().int().min(0).max(1).optional()
}).superRefine((value, ctx) => {
  if (value.commLevel !== 2) return;
  if (value.extReceiveType === undefined) {
    ctx.addIssue({
      code: "custom",
      path: ["extReceiveType"],
      message: "extReceiveType is required when commLevel is 2"
    });
  }
  if (value.extSendType === undefined) {
    ctx.addIssue({
      code: "custom",
      path: ["extSendType"],
      message: "extSendType is required when commLevel is 2"
    });
  }
});

const sendSchema = z.object({
  from: z.string().email(),
  to: z.array(z.string().email()).min(1),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  html: z.boolean().optional()
});

const replySchema = z.object({
  mailId: z.coerce.number().int().positive(),
  body: z.string().optional(),
  html: z.boolean().optional(),
  toAll: z.boolean().optional()
});

const sendCodeSchema = z.object({
  email: z.string().email()
});

const verifyCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{4,8}$/)
});

const routes: Route[] = [
  route("GET", "/health", health),
  route("GET", "/api/auth/claw/status", authStatus),
  route("POST", "/api/auth/claw/send-code", authSendCode),
  route("POST", "/api/auth/claw/verify-code", authVerifyCode),
  route("POST", "/api/auth/claw/refresh", authRefresh),
  route("POST", "/api/auth/claw/logout", authLogout),
  route("GET", "/api/mailboxes", mailboxesList),
  route("POST", "/api/mailboxes", mailboxesCreate),
  route("POST", "/api/mailboxes/:id/comm-settings", mailboxesCommSettings),
  route("DELETE", "/api/mailboxes/:id", mailboxesDelete),
  route("GET", "/api/mails", mailsList),
  route("GET", "/api/mails/:id", mailsDetail),
  route("GET", "/api/mails/:id/attachments/:partId", mailsAttachment),
  route("DELETE", "/api/mails/:id", mailsDelete),
  route("POST", "/api/send", sendCreate),
  route("POST", "/api/reply", sendReply),
  route("GET", "/api/events", eventsStream),
  route("GET", "/api/listeners", listenersList)
];

function route(method: string, path: string, handler: Handler): Route {
  const keys: string[] = [];
  const pattern = new RegExp(`^${
    path
      .split("/")
      .map((part) => {
        if (!part.startsWith(":")) return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        keys.push(part.slice(1));
        return "([^/]+)";
      })
      .join("/")
  }$`);
  return { method, pattern, keys, handler };
}

function matchRoute(method: string, pathname: string): { route: Route; params: Params } | null {
  for (const item of routes) {
    if (item.method !== method) continue;
    const match = item.pattern.exec(pathname);
    if (!match) continue;
    const params: Params = {};
    item.keys.forEach((key, index) => {
      params[key] = decodeURIComponent(match[index + 1]);
    });
    return { route: item, params };
  }
  return null;
}

function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      ...jsonHeaders,
      ...Object.fromEntries(new Headers(init.headers))
    }
  });
}

function error(message: string, status = 500): Response {
  return json({ error: message }, { status });
}

async function readBody<T>(request: Request): Promise<T> {
  const text = await request.text();
  return (text ? JSON.parse(text) : {}) as T;
}

function extractAdminPassword(request: Request, url: URL): string | undefined {
  return request.headers.get("x-admin-password") ?? url.searchParams.get("token") ?? undefined;
}

function authorize(request: Request, env: Env, url: URL): Response | null {
  if (!url.pathname.startsWith("/api/")) return null;
  const expected = env.ADMIN_PASSWORD ?? "change-me";
  if (extractAdminPassword(request, url) !== expected) {
    return error("unauthorized", 401);
  }
  return null;
}

function upsertRemoteMailbox(env: Env, item: {
  id: string;
  email: string;
  prefix: string;
  displayName?: string | null;
  status?: string | null;
  openclawStatus?: string | null;
  installCommand?: string | null;
  authUrl?: string | null;
  commLevel?: number | null;
  extReceiveType?: number | null;
  extSendType?: number | null;
}): Promise<MailboxRow> {
  return upsertMailbox(env.DB, {
    id: item.id,
    email: item.email,
    prefix: item.prefix,
    displayName: item.displayName,
    status: item.status ?? "active",
    openclawStatus: item.openclawStatus,
    installCommand: item.installCommand,
    authUrl: item.authUrl,
    commLevel: item.commLevel,
    extReceiveType: item.extReceiveType,
    extSendType: item.extSendType
  });
}

function emailDomain(email: string): string {
  return email.split("@")[1] || "claw.163.com";
}

function mailboxRootPrefix(mailbox: ClawMailbox): string {
  if (mailbox.prefix) {
    return mailbox.prefix.split("@")[0].split(".")[0];
  }
  return mailbox.email.split("@")[0].split(".")[0];
}

async function saveMailboxes(env: Env, mailboxes: ClawMailbox[]): Promise<void> {
  for (const item of mailboxes) {
    await upsertMailbox(env.DB, {
      id: item.id,
      email: item.email,
      prefix: item.prefix,
      displayName: item.displayName,
      status: item.status ?? "active",
      openclawStatus: item.openclawStatus,
      installCommand: item.installCommand,
      authUrl: item.authUrl,
      commLevel: item.commLevel,
      extReceiveType: item.extReceiveType,
      extSendType: item.extSendType
    });
  }
  await markMailboxesMissingDeleted(env.DB, mailboxes.map((item) => item.email));
}

async function connectWithCookie(env: Env, cookie: string) {
  const [user, workspaces, apiKeys] = await Promise.all([
    getAuthMe(env, cookie),
    listWorkspaces(env, cookie),
    listApiKeys(env, cookie)
  ]);

  const workspace = workspaces.find((item) => item.status === "active") ?? workspaces[0];
  if (!workspace) {
    throw new Error("Claw account has no active workspace");
  }

  const apiKey =
    apiKeys.find((item) => item.status === "active" && item.defaultFlag === 1) ??
    apiKeys.find((item) => item.status === "active") ??
    apiKeys[0];
  if (!apiKey?.apiKey) {
    throw new Error("Claw account has no API key to use");
  }

  const mailboxes = await listDashboardMailboxes(env, {
    cookie,
    workspaceId: workspace.id
  });
  const primaryMailbox =
    mailboxes.find((item) => item.mailboxType === "primary") ??
    mailboxes.find((item) => !item.email.split("@")[0].includes(".")) ??
    mailboxes[0];
  if (!primaryMailbox) {
    throw new Error("Claw account has no mailbox");
  }

  const userEmail =
    typeof user?.email === "string" ? user.email :
    typeof user?.emailAddress === "string" ? user.emailAddress :
    null;

  await saveClawAuthSettings(env, {
    apiKey: apiKey.apiKey,
    dashboardCookie: cookie,
    userEmail,
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    parentMailboxId: primaryMailbox.id,
    rootPrefix: mailboxRootPrefix(primaryMailbox),
    domain: emailDomain(primaryMailbox.email)
  });
  await saveMailboxes(env, mailboxes);

  return {
    auth: await getClawAuthStatus(env),
    syncedMailboxes: mailboxes.length
  };
}

async function syncMailboxInbox(env: Env, mailboxEmail: string): Promise<void> {
  const remoteIds = await listRemoteInboxMessageIds(env, mailboxEmail);
  const remoteIdSet = new Set(remoteIds);
  const localIds = await listMailProviderIds(env.DB, mailboxEmail);
  const staleLocalIds = localIds.filter((id) => !remoteIdSet.has(id));
  await deleteMailsByProviderIds(env.DB, mailboxEmail, staleLocalIds);

  for (const providerMailId of remoteIds) {
    if (await getMailByProviderId(env.DB, mailboxEmail, providerMailId)) continue;
    const mail = await readRemoteMail(env, mailboxEmail, providerMailId);
    await saveMail(env.DB, {
      providerMailId,
      mailboxEmail,
      source: mail.from?.[0] ?? null,
      address: mail.to?.[0] ?? mailboxEmail,
      subject: mail.subject ?? null,
      text: mail.text?.content ?? null,
      html: mail.html?.content ?? null,
      rawJson: JSON.stringify(mail),
      headerRaw: mail.headerRaw ?? null,
      hasAttachments: (mail.attachments ?? []).length > 0,
      receivedAt: mail.date ?? null,
      attachments: attachmentList(mail)
    });
  }
}

async function syncAllMailboxInboxes(env: Env): Promise<void> {
  for (const mailbox of await listActiveMailboxes(env.DB)) {
    await syncMailboxInbox(env, mailbox.email);
  }
}

function health() {
  return json({ ok: true, runtime: "cloudflare" });
}

async function authStatus({ env }: { env: Env }) {
  return json(await getClawAuthStatus(env));
}

async function authSendCode({ request }: { request: Request }) {
  const body = sendCodeSchema.parse(await readBody(request));
  await sendLoginCode(body.email);
  return json({ success: true });
}

async function authVerifyCode({ request, env }: { request: Request; env: Env }) {
  const body = verifyCodeSchema.parse(await readBody(request));
  const cookie = await verifyLoginCode(body.email, body.code);
  return json(await connectWithCookie(env, cookie));
}

async function authRefresh({ env }: { env: Env }) {
  return json(await connectWithCookie(env, await requireDashboardCookie(env)));
}

async function authLogout({ env }: { env: Env }) {
  await clearClawAuthSettings(env);
  return json(await getClawAuthStatus(env));
}

async function mailboxesList({ env, url }: { env: Env; url: URL }) {
  if (url.searchParams.get("sync") === "true") {
    const remote = await listDashboardMailboxes(env);
    for (const item of remote) {
      await upsertRemoteMailbox(env, item);
    }
    await markMailboxesMissingDeleted(env.DB, remote.map((item) => item.email));
  }
  return json({ items: await listMailboxes(env.DB, false) });
}

async function mailboxesCreate({ request, env }: { request: Request; env: Env }) {
  const body = createMailboxSchema.parse(await readBody(request));
  const mailbox = await createDashboardMailbox(env, body.suffix);
  await updateMailboxCommunicationSettings(env, mailbox.id, DEFAULT_COMM_SETTINGS);
  const row = await upsertRemoteMailbox(env, {
    ...mailbox,
    commLevel: DEFAULT_COMM_SETTINGS.commLevel,
    extReceiveType: DEFAULT_COMM_SETTINGS.extReceiveType,
    extSendType: DEFAULT_COMM_SETTINGS.extSendType
  });
  return json(row, { status: 201 });
}

async function mailboxesCommSettings({
  request,
  env,
  params
}: {
  request: Request;
  env: Env;
  params: Params;
}) {
  const mailbox = await getMailboxById(env.DB, params.id);
  if (!mailbox) {
    return error("mailbox not found", 404);
  }

  const body = commSettingsSchema.parse(await readBody(request));
  const dashboardPayload = body.commLevel === 2
    ? {
        commLevel: body.commLevel,
        extReceiveType: body.extReceiveType!,
        extSendType: body.extSendType!
      }
    : { commLevel: body.commLevel };

  await updateMailboxCommunicationSettings(env, params.id, dashboardPayload);
  const updated = await updateMailboxCommSettings(env.DB, params.id, {
    commLevel: body.commLevel,
    extReceiveType: body.commLevel === 2 ? body.extReceiveType : null,
    extSendType: body.commLevel === 2 ? body.extSendType : null
  });
  return json(updated ?? await getMailboxById(env.DB, params.id));
}

async function mailboxesDelete({ env, params }: { env: Env; params: Params }) {
  const mailbox = await getMailboxById(env.DB, params.id);
  if (!mailbox) {
    return json({ success: true });
  }
  if (params.id === await getParentMailboxId(env)) {
    return error("primary mailbox cannot be deleted here", 400);
  }
  await deleteDashboardMailbox(env, params.id);
  await markMailboxDeleted(env.DB, params.id);
  return json({ success: true });
}

async function mailsList({ env, url }: { env: Env; url: URL }) {
  const mailbox = url.searchParams.get("mailbox")?.trim().toLowerCase() || undefined;
  const sync = url.searchParams.get("sync");
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50) || 50, 1), 100);
  const offset = Math.max(Number(url.searchParams.get("offset") ?? 0) || 0, 0);
  if (sync === "true" && mailbox) {
    await syncMailboxInbox(env, mailbox);
  } else if (sync === "true") {
    await syncAllMailboxInboxes(env);
  }
  return json(await listMails(env.DB, {
    mailboxEmail: mailbox,
    limit,
    offset
  }));
}

async function mailsDetail({ env, params }: { env: Env; params: Params }) {
  const mail = await getMailById(env.DB, Number(params.id));
  if (!mail) {
    return error("mail not found", 404);
  }
  return json({
    ...mail,
    parsed: JSON.parse(mail.raw_json),
    attachments: await listAttachments(env.DB, mail.id)
  });
}

async function mailsAttachment({ env, params }: { env: Env; params: Params }) {
  const mail = await getMailById(env.DB, Number(params.id));
  if (!mail) {
    return error("mail not found", 404);
  }
  const attachment = await getAttachment(env, mail.mailbox_email, mail.provider_mail_id, params.partId);
  return new Response(attachment.body, {
    headers: {
      "content-type": attachment.contentType,
      "content-disposition": `attachment; filename="${encodeURIComponent(attachment.filename)}"`
    }
  });
}

async function mailsDelete({ env, params }: { env: Env; params: Params }) {
  const mail = await getMailById(env.DB, Number(params.id));
  if (!mail) {
    return json({ success: true });
  }
  await deleteRemoteMail(env, mail.mailbox_email, mail.provider_mail_id);
  await deleteMailById(env.DB, Number(params.id));
  return json({ success: true });
}

async function sendCreate({ request, env }: { request: Request; env: Env }) {
  const body = sendSchema.parse(await readBody(request));
  const mailbox = await getMailboxByEmail(env.DB, body.from.trim().toLowerCase());
  if (!mailbox) {
    return error("from mailbox is not managed by this app", 400);
  }
  return json(await sendMail(env, body));
}

async function sendReply({ request, env }: { request: Request; env: Env }) {
  const body = replySchema.parse(await readBody(request));
  const mail = await getMailById(env.DB, body.mailId);
  if (!mail) {
    return error("mail not found", 404);
  }
  return json(await replyMail(env, {
    mailboxEmail: mail.mailbox_email,
    providerMailId: mail.provider_mail_id,
    body: body.body,
    html: body.html,
    toAll: body.toAll
  }));
}

function eventsStream() {
  const body = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode("event: cloudflare-mode\n"));
      controller.enqueue(encoder.encode("data: {\"mode\":\"manual-sync\"}\n\n"));
      controller.close();
    }
  });
  return new Response(body, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform"
    }
  });
}

async function listenersList({ env }: { env: Env }) {
  const mailboxes = await listActiveMailboxes(env.DB);
  return json({
    items: mailboxes.map((mailbox) => ({
      email: mailbox.email,
      status: "manual-sync",
      startedAt: null,
      lastEventAt: null,
      error: "Cloudflare deployment uses request-triggered inbox sync instead of persistent listeners."
    }))
  });
}

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  const unauthorized = authorize(request, env, url);
  if (unauthorized) return unauthorized;

  const matched = matchRoute(request.method, url.pathname);
  if (!matched) return error("not found", 404);

  try {
    return await matched.route.handler({
      request,
      env,
      params: matched.params,
      url
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return json({ error: "invalid input", details: err.issues }, { status: 400 });
    }
    return error(err instanceof Error ? err.message : "internal server error", 500);
  }
}

async function serveAsset(request: Request, env: Env): Promise<Response> {
  const response = await env.ASSETS.fetch(request);
  if (response.status !== 404) return response;

  const url = new URL(request.url);
  if (request.method === "GET" && !url.pathname.includes(".")) {
    return env.ASSETS.fetch(new Request(new URL("/", url), request));
  }
  return response;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health" || url.pathname.startsWith("/api/")) {
      return handleApi(request, env, url);
    }
    return serveAsset(request, env);
  }
};
