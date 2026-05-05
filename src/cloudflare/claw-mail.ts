import { requireClawApiKey } from "./runtime-config";
import type { Env } from "./types";

export type MailDetail = {
  id: string;
  from?: string[];
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  date?: string;
  priority?: number;
  headerRaw?: string;
  text?: { content: string };
  html?: { content: string };
  attachments?: Array<{
    id: string;
    filename?: string;
    contentType: string;
    size?: number;
    inline?: boolean;
    contentId?: string;
  }>;
};

export type SendMailInput = {
  from: string;
  to: string[];
  subject?: string;
  body?: string;
  html?: boolean;
  cc?: string[];
  bcc?: string[];
};

export type ReplyMailInput = {
  mailboxEmail: string;
  providerMailId: string;
  body?: string;
  html?: boolean;
  toAll?: boolean;
};

type RemoteMessageSummary = {
  id: string;
};

type AccessToken = {
  accessToken: string;
  expiresAt: number;
};

type AttachmentFetch = {
  body: ReadableStream | null;
  contentType: string;
  filename: string;
  size?: number;
};

const HOST = "https://claw.163.com";
const TOKEN_URL = "https://claw.163.com/claw-api-gateway/open/v1/mail/auth/token";
const COREMAIL_URL = "https://claw.163.com/claw-api-gateway/api/coremail/proxy";
const TOKEN_REFRESH_MARGIN_MS = 60_000;
const tokenCache = new Map<string, AccessToken>();

function tokenKey(email: string): string {
  return email.trim().toLowerCase();
}

async function fetchAccessToken(env: Env, email: string): Promise<AccessToken> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${await requireClawApiKey(env)}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ uid: email })
  });
  const body = await response.json().catch(() => null) as any;
  const result = body?.result;
  if (!response.ok || !result?.accessToken || !result?.expiresIn) {
    throw new Error("failed to obtain Claw access token");
  }
  const token = {
    accessToken: result.accessToken,
    expiresAt: Date.now() + Number(result.expiresIn) * 1000
  };
  tokenCache.set(tokenKey(email), token);
  return token;
}

async function ensureToken(env: Env, email: string): Promise<string> {
  const cached = tokenCache.get(tokenKey(email));
  if (cached && cached.expiresAt - Date.now() >= TOKEN_REFRESH_MARGIN_MS) {
    return cached.accessToken;
  }
  return (await fetchAccessToken(env, email)).accessToken;
}

async function callCoremail<T>(
  env: Env,
  email: string,
  func: string,
  payload: Record<string, unknown> = {}
): Promise<T> {
  const token = await ensureToken(env, email);
  const url = new URL(COREMAIL_URL);
  url.searchParams.set("uid", email);
  url.searchParams.set("func", func);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const body = await response.json().catch(() => null) as any;
  if (!response.ok || !body || typeof body.code !== "string") {
    throw new Error(`Claw mail request failed: ${response.statusText || response.status}`);
  }
  if (body.code !== "S_OK") {
    if (
      body.code === "ACCESS_TOKEN_REQUIRED" ||
      body.code === "ACCESS_TOKEN_INVALID" ||
      body.code === "ACCESS_TOKEN_EXPIRED"
    ) {
      tokenCache.delete(tokenKey(email));
      return await callCoremail<T>(env, email, func, payload);
    }
    throw new Error(body.message ?? body.code);
  }
  return body.var as T;
}

async function getCoremailStream(
  env: Env,
  email: string,
  func: string,
  params: Record<string, string>
): Promise<Response> {
  const token = await ensureToken(env, email);
  const url = new URL(COREMAIL_URL);
  url.searchParams.set("uid", email);
  url.searchParams.set("func", func);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${token}`
    }
  });
  if (response.status === 202 || response.status >= 500) {
    throw new Error(`Claw attachment request failed: HTTP ${response.status}`);
  }
  if (!response.ok) {
    throw new Error(`Claw attachment request failed: HTTP ${response.status}`);
  }
  return response;
}

function folderId(value: string | number): number {
  const names: Record<string, number> = {
    INBOX: 1,
    Inbox: 1,
    inbox: 1,
    Trash: 4,
    Deleted: 4
  };
  if (typeof value === "string" && names[value] !== undefined) return names[value];
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) throw new Error(`folder "${value}" is not valid`);
  return numeric;
}

function summary(raw: any): RemoteMessageSummary {
  return { id: String(raw.id) };
}

function normalizeMail(id: string, raw: any): MailDetail {
  const detail: MailDetail = {
    id,
    from: raw.from,
    to: raw.to,
    cc: raw.cc,
    bcc: raw.bcc,
    subject: raw.subject,
    date: raw.sentDate,
    priority: raw.priority,
    headerRaw: raw.headerRaw
  };
  if (raw.text) detail.text = { content: raw.text.content };
  if (raw.html) detail.html = { content: raw.html.content };
  if (raw.attachments?.length) {
    detail.attachments = raw.attachments.map((attachment: any) => ({
      id: String(attachment.id),
      contentType: attachment.contentType ?? "application/octet-stream",
      size: attachment.contentLength,
      filename: attachment.filename,
      inline: attachment.inlined,
      contentId: attachment.contentId
    }));
  }
  return detail;
}

function attachmentFilename(response: Response, partId: string): string {
  const disposition = response.headers.get("content-disposition") ?? "";
  const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';\n]+)/i);
  if (!match?.[1]) return `attachment_${partId}`;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export async function sendMail(env: Env, input: SendMailInput): Promise<{ status: "sent" }> {
  if (!input.to.length) {
    throw new Error("to must not be empty");
  }
  const composeId = await callCoremail<string | { id?: string }>(env, input.from, "mbox:compose", {
    action: "continue",
    attrs: {
      to: input.to,
      subject: input.subject ?? "",
      content: input.body ?? "",
      isHtml: input.html ?? false,
      priority: 3,
      saveSentCopy: true,
      cc: input.cc?.length ? input.cc : undefined,
      bcc: input.bcc?.length ? input.bcc : undefined
    }
  });
  const id = typeof composeId === "string" ? composeId : composeId?.id;
  if (!id) throw new Error("compose did not return a compose id");
  await callCoremail(env, input.from, "mbox:compose", {
    id,
    action: "deliver",
    attrs: {
      to: input.to,
      subject: input.subject ?? "",
      content: input.body ?? "",
      isHtml: input.html ?? false,
      priority: 3,
      saveSentCopy: true,
      cc: input.cc?.length ? input.cc : undefined,
      bcc: input.bcc?.length ? input.bcc : undefined
    }
  });
  return { status: "sent" };
}

export async function replyMail(env: Env, input: ReplyMailInput): Promise<{ status: "sent" }> {
  await callCoremail(env, input.mailboxEmail, "mbox:replyMessage", {
    id: input.providerMailId,
    toAll: input.toAll ?? false,
    withAttachments: false,
    action: "deliver",
    attrs: {
      content: input.body ?? "",
      isHtml: input.html ?? false,
      saveSentCopy: true
    }
  });
  return { status: "sent" };
}

export async function deleteRemoteMail(
  env: Env,
  mailboxEmail: string,
  providerMailId: string
): Promise<void> {
  await callCoremail(env, mailboxEmail, "mbox:updateMessageInfos", {
    ids: [providerMailId],
    attrs: { fid: folderId("Trash") }
  });
}

export async function listRemoteInboxMessageIds(
  env: Env,
  mailboxEmail: string,
  maxMessages = 500
): Promise<string[]> {
  const ids: string[] = [];
  const pageSize = 100;
  for (let start = 0; start < maxMessages; start += pageSize) {
    const messages = await callCoremail<any[]>(env, mailboxEmail, "mbox:listMessages", {
      fid: folderId("INBOX"),
      start,
      limit: Math.min(pageSize, maxMessages - start),
      order: "date",
      desc: true
    });
    for (const message of messages ?? []) {
      const item = summary(message);
      if (item.id) ids.push(item.id);
    }
    if (!messages || messages.length < pageSize) break;
  }
  return ids;
}

export async function readRemoteMail(
  env: Env,
  mailboxEmail: string,
  providerMailId: string,
  markRead = false
): Promise<MailDetail> {
  const raw = await callCoremail<any>(env, mailboxEmail, "mbox:readMessage", {
    id: providerMailId,
    mode: "html",
    markRead,
    header: true,
    securityLevel: 1,
    filterLinks: false,
    filterImages: false
  });
  return normalizeMail(providerMailId, raw);
}

export async function getAttachment(
  env: Env,
  mailboxEmail: string,
  providerMailId: string,
  partId: string
): Promise<AttachmentFetch> {
  const response = await getCoremailStream(env, mailboxEmail, "mbox:getMessageData", {
    mid: providerMailId,
    part: partId,
    mode: "download"
  });
  return {
    body: response.body,
    contentType: response.headers.get("content-type") ?? "application/octet-stream",
    filename: attachmentFilename(response, partId),
    size: response.headers.get("content-length")
      ? Number(response.headers.get("content-length"))
      : undefined
  };
}

export function attachmentList(mail: MailDetail) {
  return (mail.attachments ?? []).map((attachment) => ({
    providerPartId: attachment.id,
    filename: attachment.filename ?? null,
    contentType: attachment.contentType ?? null,
    size: attachment.size ?? null
  }));
}
