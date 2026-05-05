import { deleteSettings, getSetting, setSetting } from "./db";
import type { Env } from "./types";

const AUTH_SETTING_KEYS = [
  "claw.apiKey",
  "claw.dashboardCookie",
  "claw.userEmail",
  "claw.workspaceId",
  "claw.workspaceName",
  "claw.parentMailboxId",
  "claw.rootPrefix",
  "claw.domain"
];

export async function getClawApiKey(env: Env): Promise<string | undefined> {
  return await getSetting(env.DB, "claw.apiKey") ?? env.CLAW_API_KEY;
}

export async function requireClawApiKey(env: Env): Promise<string> {
  const value = await getClawApiKey(env);
  if (!value) {
    throw new Error("CLAW_API_KEY is required for mail operations; connect Claw first");
  }
  return value;
}

export async function getDashboardCookie(env: Env): Promise<string | undefined> {
  return await getSetting(env.DB, "claw.dashboardCookie") ?? env.CLAW_DASHBOARD_COOKIE;
}

export async function requireDashboardCookie(env: Env): Promise<string> {
  const value = await getDashboardCookie(env);
  if (!value) {
    throw new Error("CLAW_DASHBOARD_COOKIE is required for mailbox management; connect Claw first");
  }
  return value;
}

export async function getWorkspaceId(env: Env): Promise<string> {
  const value = await getStoredWorkspaceId(env);
  if (!value) {
    throw new Error("Claw workspace is not configured; connect Claw first");
  }
  return value;
}

export async function getParentMailboxId(env: Env): Promise<string> {
  const value = await getStoredParentMailboxId(env);
  if (!value) {
    throw new Error("Claw parent mailbox is not configured; connect Claw first");
  }
  return value;
}

export async function getRootPrefix(env: Env): Promise<string> {
  const value = await getStoredRootPrefix(env);
  if (!value) {
    throw new Error("Claw root prefix is not configured; connect Claw first");
  }
  return value;
}

export async function getDomain(env: Env): Promise<string> {
  return await getStoredDomain(env);
}

async function getStoredWorkspaceId(env: Env): Promise<string | null> {
  return await getSetting(env.DB, "claw.workspaceId") ?? env.CLAW_WORKSPACE_ID ?? null;
}

async function getStoredParentMailboxId(env: Env): Promise<string | null> {
  return await getSetting(env.DB, "claw.parentMailboxId") ?? env.CLAW_PARENT_MAILBOX_ID ?? null;
}

async function getStoredRootPrefix(env: Env): Promise<string | null> {
  return await getSetting(env.DB, "claw.rootPrefix") ?? env.CLAW_ROOT_PREFIX ?? null;
}

async function getStoredDomain(env: Env): Promise<string> {
  return await getSetting(env.DB, "claw.domain") ?? env.CLAW_DOMAIN ?? "claw.163.com";
}

export async function getClawAuthStatus(env: Env) {
  const apiKey = await getClawApiKey(env);
  const cookie = await getDashboardCookie(env);
  const workspaceId = cookie ? await getStoredWorkspaceId(env) : null;
  const parentMailboxId = cookie ? await getStoredParentMailboxId(env) : null;
  const rootPrefix = cookie ? await getStoredRootPrefix(env) : null;
  const domain = cookie ? await getStoredDomain(env) : null;
  return {
    connected: Boolean(apiKey && cookie && workspaceId && parentMailboxId && rootPrefix && domain),
    hasApiKey: Boolean(apiKey),
    hasDashboardCookie: Boolean(cookie),
    userEmail: await getSetting(env.DB, "claw.userEmail") ?? null,
    workspaceId,
    workspaceName: await getSetting(env.DB, "claw.workspaceName") ?? null,
    parentMailboxId,
    rootPrefix,
    domain,
    apiKeyPrefix: apiKey ? apiKey.slice(0, 10) : null,
    apiKeySuffix: apiKey ? apiKey.slice(-4) : null
  };
}

export async function saveClawAuthSettings(
  env: Env,
  input: {
    apiKey: string;
    dashboardCookie: string;
    userEmail?: string | null;
    workspaceId: string;
    workspaceName?: string | null;
    parentMailboxId: string;
    rootPrefix: string;
    domain: string;
  }
): Promise<void> {
  await Promise.all([
    setSetting(env.DB, "claw.apiKey", input.apiKey),
    setSetting(env.DB, "claw.dashboardCookie", input.dashboardCookie),
    setSetting(env.DB, "claw.workspaceId", input.workspaceId),
    setSetting(env.DB, "claw.parentMailboxId", input.parentMailboxId),
    setSetting(env.DB, "claw.rootPrefix", input.rootPrefix),
    setSetting(env.DB, "claw.domain", input.domain),
    input.userEmail ? setSetting(env.DB, "claw.userEmail", input.userEmail) : Promise.resolve(),
    input.workspaceName ? setSetting(env.DB, "claw.workspaceName", input.workspaceName) : Promise.resolve()
  ]);
}

export async function clearClawAuthSettings(env: Env): Promise<void> {
  await deleteSettings(env.DB, AUTH_SETTING_KEYS);
}

