import { useEffect, useMemo, useState } from "react";
import { CommunicationRulesDrawer } from "./components/CommunicationRulesDrawer";
import { ComposeDrawer } from "./components/ComposeDrawer";
import { InboxView } from "./components/InboxView";
import { ListenersDrawer } from "./components/ListenersDrawer";
import { MailboxesView } from "./components/MailboxesView";
import { useResizableWidth } from "./hooks";
import { PrefsBar, usePrefs } from "./i18n";
import {
  createEventSource,
  createMailbox,
  deleteMailbox,
  disconnectClaw,
  fetchClawAuthStatus,
  fetchListeners,
  fetchMail,
  fetchMailboxes,
  fetchMails,
  getAdminPassword,
  getRuntimeMode,
  refreshClawConnection,
  sendClawLoginCode,
  setAdminPassword,
  setRuntimeMode,
  verifyAdminPassword,
  verifyClawLoginCode,
  type ClawAuthStatus,
  type ListenerSnapshot,
  type MailDetail,
  type MailSummary,
  type Mailbox
} from "./api";

type View = "mailboxes" | "inbox";
const VIEW_STORAGE_KEY = "claw.currentView";

const VIEW_KEYS: Record<View, { eyebrow: string; title: string; subtitle: string }> = {
  mailboxes: {
    eyebrow: "view.mailboxes.eyebrow",
    title: "view.mailboxes.title",
    subtitle: "view.mailboxes.subtitle"
  },
  inbox: {
    eyebrow: "view.inbox.eyebrow",
    title: "view.inbox.title",
    subtitle: "view.inbox.subtitle"
  }
};

const LIVE_LISTENER_STATUSES = new Set(["running", "open"]);

function readInitialView(): View {
  if (typeof localStorage === "undefined") return "mailboxes";
  const saved = localStorage.getItem(VIEW_STORAGE_KEY);
  return saved === "inbox" || saved === "mailboxes" ? saved : "mailboxes";
}

export function App() {
  const { t } = usePrefs();

  const initialAdminPassword = getAdminPassword();
  const [password, setPassword] = useState("");
  const [loginInput, setLoginInput] = useState(initialAdminPassword);
  const [loginError, setLoginError] = useState("");
  const [loginBusy, setLoginBusy] = useState(Boolean(initialAdminPassword));

  const [view, setView] = useState<View>(readInitialView);
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [selectedMailbox, setSelectedMailbox] = useState("");
  const [mails, setMails] = useState<MailSummary[]>([]);
  const [selectedMail, setSelectedMail] = useState<MailDetail | null>(null);

  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [suffix, setSuffix] = useState("");
  const [mailboxSyncBusy, setMailboxSyncBusy] = useState(false);
  const [rulesMailbox, setRulesMailbox] = useState<Mailbox | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);

  const [clawAuth, setClawAuth] = useState<ClawAuthStatus | null>(null);
  const [clawLoginEmail, setClawLoginEmail] = useState("");
  const [clawLoginCode, setClawLoginCode] = useState("");
  const [clawCodeSent, setClawCodeSent] = useState(false);
  const [clawBusy, setClawBusy] = useState(false);
  const [connectionDetailsOpen, setConnectionDetailsOpen] = useState(false);

  const [listenerItems, setListenerItems] = useState<ListenerSnapshot[]>([]);
  const [listenerBusy, setListenerBusy] = useState(false);
  const [listenersDrawerOpen, setListenersDrawerOpen] = useState(false);

  const rail = useResizableWidth({
    storageKey: "rail.width",
    initial: 280,
    min: 220,
    max: 480
  });

  const activeMailboxes = useMemo(
    () => mailboxes.filter((mailbox) => mailbox.status !== "deleted"),
    [mailboxes]
  );

  const listenerSummary = useMemo(() => {
    let running = 0;
    let errors = 0;
    for (const item of listenerItems) {
      if (LIVE_LISTENER_STATUSES.has(item.status)) running++;
      if (item.status === "error" || item.error) errors++;
    }
    return { running, total: listenerItems.length, errors };
  }, [listenerItems]);

  function reportError(err: unknown) {
    setError(err instanceof Error ? err.message : String(err));
  }

  function formatLoginError(err: unknown): string {
    const message = err instanceof Error ? err.message : String(err);
    return message === "unauthorized" ? t("login.error.unauthorized") : message;
  }

  async function handleLogin(nextPassword = loginInput) {
    if (!nextPassword) return;
    setLoginBusy(true);
    setLoginError("");
    try {
      const data = await verifyAdminPassword(nextPassword);
      setAdminPassword(nextPassword);
      setPassword(nextPassword);
      setClawAuth(data);
      setError("");
    } catch (err) {
      const loginMessage = formatLoginError(err);
      setAdminPassword("");
      setPassword("");
      setLoginError(loginMessage);
      if (loginMessage === t("login.error.unauthorized")) {
        setLoginInput("");
      }
    } finally {
      setLoginBusy(false);
    }
  }

  useEffect(() => {
    const savedPassword = getAdminPassword();
    if (!savedPassword) return;
    handleLogin(savedPassword);
  }, []);

  useEffect(() => {
    localStorage.setItem(VIEW_STORAGE_KEY, view);
  }, [view]);

  async function loadMailboxes(sync = false): Promise<Mailbox[]> {
    setError("");
    const items = await fetchMailboxes(sync);
    setMailboxes(items);
    return items;
  }

  async function loadClawAuthStatus() {
    const data = await fetchClawAuthStatus();
    setClawAuth(data);
  }

  async function loadMails(mailbox = selectedMailbox, sync = false) {
    setError("");
    const data = await fetchMails(mailbox || undefined, 50, 0, sync);
    setMails(data.items);
    if (selectedMail && !data.items.some((mail) => mail.id === selectedMail.id)) {
      setSelectedMail(null);
    }
  }

  async function loadMail(id: number) {
    setError("");
    const detail = await fetchMail(id);
    setSelectedMail(detail);
  }

  async function loadListeners() {
    setListenerBusy(true);
    try {
      const data = await fetchListeners();
      setListenerItems(data);
    } catch (err) {
      reportError(err);
    } finally {
      setListenerBusy(false);
    }
  }

  useEffect(() => {
    if (!password) return;
    setAdminPassword(password);
    loadClawAuthStatus().catch(reportError);
    loadMailboxes().catch(reportError);
  }, [password]);

  useEffect(() => {
    if (!status) return;
    const timer = window.setTimeout(() => {
      setStatus("");
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    if (!password) return;
    if (getRuntimeMode() === "cloudflare") return;
    const events = createEventSource();
    events.addEventListener("mail", () => {
      loadMails().catch(reportError);
    });
    events.addEventListener("cloudflare-mode", () => {
      setRuntimeMode("cloudflare");
      events.close();
      setStatus(t("flash.events.manualSync"));
    });
    events.onerror = () => {
      if (getRuntimeMode() === "cloudflare") return;
      setStatus(t("flash.events.reconnecting"));
    };
    return () => events.close();
  }, [password, selectedMailbox]);

  useEffect(() => {
    if (!password) return;
    setSelectedMail(null);
    loadMails(selectedMailbox, true).catch(reportError);
  }, [password, selectedMailbox]);

  // Auto-fetch listener summary once Claw is connected, and again on demand
  // when the connection details panel is opened.
  useEffect(() => {
    if (!password) return;
    if (!clawAuth?.connected) {
      setListenerItems([]);
      return;
    }
    loadListeners();
  }, [password, clawAuth?.connected]);

  useEffect(() => {
    if (!connectionDetailsOpen) return;
    if (!clawAuth?.connected) return;
    loadListeners();
  }, [connectionDetailsOpen]);

  async function handleCreateMailbox() {
    setStatus(""); setError("");
    try {
      const created = await createMailbox(suffix);
      setSuffix("");
      setStatus(t("flash.mb.created", { email: created.email }));
      await loadMailboxes();
    } catch (err) {
      reportError(err);
    }
  }

  async function handleDeleteMailbox(mailbox: Mailbox) {
    if (!confirm(t("mb.confirm.delete", { email: mailbox.email }))) return;
    setStatus(""); setError("");
    try {
      await deleteMailbox(mailbox.id);
      setStatus(t("flash.mb.deleted", { email: mailbox.email }));
      await loadMailboxes();
      if (selectedMailbox === mailbox.email) {
        setSelectedMailbox("");
        setMails([]);
      }
    } catch (err) {
      reportError(err);
    }
  }

  async function handleSendClawCode() {
    setStatus(""); setError(""); setClawBusy(true);
    try {
      await sendClawLoginCode(clawLoginEmail.trim());
      setClawCodeSent(true);
      setStatus(t("flash.code.sent"));
    } catch (err) {
      reportError(err);
    } finally {
      setClawBusy(false);
    }
  }

  async function handleVerifyClawCode() {
    setStatus(""); setError(""); setClawBusy(true);
    try {
      const result = await verifyClawLoginCode(clawLoginEmail.trim(), clawLoginCode.trim());
      setClawAuth(result.auth);
      setClawLoginCode("");
      setClawCodeSent(false);
      setStatus(t("flash.claw.bound", { n: result.syncedMailboxes }));
      await loadMailboxes();
    } catch (err) {
      reportError(err);
    } finally {
      setClawBusy(false);
    }
  }

  async function handleRefreshClaw() {
    setStatus(""); setError(""); setClawBusy(true);
    try {
      const result = await refreshClawConnection();
      setClawAuth(result.auth);
      setStatus(t("flash.claw.refreshed", { n: result.syncedMailboxes }));
      await loadMailboxes();
      loadListeners();
    } catch (err) {
      reportError(err);
    } finally {
      setClawBusy(false);
    }
  }

  async function handleSyncMailboxes() {
    setStatus(t("flash.mb.syncing"));
    setError("");
    setMailboxSyncBusy(true);
    try {
      const items = await loadMailboxes(true);
      setStatus(t("flash.mb.synced", {
        n: items.filter((mailbox) => mailbox.status !== "deleted").length
      }));
      loadListeners();
    } catch (err) {
      reportError(err);
    } finally {
      setMailboxSyncBusy(false);
    }
  }

  async function handleDisconnectClaw() {
    if (!confirm(t("confirm.disconnect"))) return;
    setStatus(""); setError(""); setClawBusy(true);
    try {
      const result = await disconnectClaw();
      setClawAuth(result);
      setConnectionDetailsOpen(false);
      setListenerItems([]);
      setStatus(t("flash.claw.severed"));
    } catch (err) {
      reportError(err);
    } finally {
      setClawBusy(false);
    }
  }

  function handleLogout() {
    setAdminPassword("");
    setPassword("");
    setLoginInput("");
    setLoginError("");
    setClawAuth(null);
    setConnectionDetailsOpen(false);
    setListenerItems([]);
    setListenersDrawerOpen(false);
    setRulesMailbox(null);
    setMailboxes([]);
    setSelectedMailbox("");
    setMails([]);
    setSelectedMail(null);
    setStatus("");
    setError("");
  }

  // ---------- LOGIN ----------

  if (!password) {
    const stamp = new Date()
      .toLocaleString("sv-SE", { timeZone: "Asia/Shanghai", hour12: false })
      .slice(0, 19);
    return (
      <main className="login-shell">
        <PrefsBar variant="login" />
        <section className="stage">
          <div className="brand-row">
            <span className="mark">claw</span>
            <span>· {t("brand.tagline")}</span>
            <span style={{ color: "var(--text-4)" }}>v0.1</span>
          </div>
          <div className="pitch">
            <h1>
              {t("login.headline.1")}<br />
              {t("login.headline.2")}<br />
              <span className="lime">{t("login.headline.3")}</span>
            </h1>
            <p>{t("login.pitch")}</p>
          </div>
          <div className="stamp">
            {t("login.stamp.session")} · {stamp} utc+8
            <span style={{ marginLeft: 14, color: "var(--accent-fg)" }}>● {t("login.stamp.online")}</span>
          </div>
        </section>

        <section className="login-form">
          <div className="head">
            <span className="eyebrow">{t("login.eyebrow")}</span>
            <h2>{t("login.title")}</h2>
          </div>
          <div className="field">
            <label>{t("login.field.password")}</label>
            <input
              type="password"
              autoFocus
              value={loginInput}
              placeholder={t("login.placeholder.password")}
              disabled={loginBusy}
              onChange={(event) => {
                setLoginInput(event.target.value);
                setLoginError("");
              }}
              onKeyDown={(event) => { if (event.key === "Enter") handleLogin(); }}
            />
          </div>
          <div className="actions">
            <button
              className="primary"
              onClick={() => handleLogin()}
              disabled={loginBusy || !loginInput}
            >
              {loginBusy ? t("login.btn.verifying") : t("login.btn.enter")}
            </button>
            <span className="kbd">⏎</span>
          </div>
          {loginError && <div className="err" style={{ marginTop: 18 }}>{loginError}</div>}
        </section>
      </main>
    );
  }

  // ---------- MAIN SHELL ----------

  const meta = VIEW_KEYS[view];
  const summaryHasErrors = listenerSummary.errors > 0;
  const summaryAllLive =
    listenerSummary.total > 0 && listenerSummary.running === listenerSummary.total;

  return (
    <main
      className="app-shell"
      style={{ ["--rail-width" as string]: `${rail.width}px` }}
    >
      <aside className="rail">
        <div
          className={`rail-resizer ${rail.dragging ? "dragging" : ""}`}
          onPointerDown={rail.onPointerDown}
          role="separator"
          aria-orientation="vertical"
          aria-label="resize sidebar"
        />
        <div className="brand">
          <span className="word">claw<span style={{ color: "var(--accent-fg)" }}>.</span></span>
          <span className="ver">{t("rail.brand.suffix")}</span>
        </div>

        <nav>
          <div className="eyebrow nav-eyebrow">{t("rail.workspace")}</div>
          <button className={view === "inbox" ? "active" : ""} onClick={() => setView("inbox")}>
            <span className="glyph">▣</span>
            <span>{t("rail.nav.inbox")}</span>
            <span className="count">{mails.length || ""}</span>
          </button>
          <button className={view === "mailboxes" ? "active" : ""} onClick={() => setView("mailboxes")}>
            <span className="glyph">⬚</span>
            <span>{t("rail.nav.mailboxes")}</span>
            <span className="count">{activeMailboxes.length}</span>
          </button>
        </nav>

        <div className={`conn-card ${clawAuth?.connected ? "connected" : "disconnected"}`}>
          <div className="head">
            <strong>{t("conn.title")}</strong>
            <span className="status">
              <span className={`dot ${clawAuth?.connected ? "live" : "warn"}`} />
              {clawAuth?.connected ? t("conn.bound") : t("conn.idle")}
            </span>
          </div>
          {clawAuth?.connected ? (
            <>
              <div className="actions">
                <button onClick={handleRefreshClaw} disabled={clawBusy}>{t("conn.action.refresh")}</button>
                <button className="danger" onClick={handleDisconnectClaw} disabled={clawBusy}>{t("conn.action.disconnect")}</button>
                <button
                  className="ghost details-toggle"
                  onClick={() => setConnectionDetailsOpen((open) => !open)}
                  aria-expanded={connectionDetailsOpen}
                >
                  {connectionDetailsOpen ? t("conn.action.hideDetails") : t("conn.action.showDetails")}
                </button>
              </div>
              {connectionDetailsOpen && (
                <div className="details">
                  <div className="body">
                    <span className="key">{t("conn.field.user")}</span>
                    <span className="val">{clawAuth.userEmail ?? "—"}</span>
                    <span className="key">{t("conn.field.workspace")}</span>
                    <span className="val">{clawAuth.workspaceName ?? clawAuth.workspaceId}</span>
                    <span className="key">{t("conn.field.root")}</span>
                    <span className="val">
                      {clawAuth.rootPrefix && clawAuth.domain
                        ? `${clawAuth.rootPrefix}@${clawAuth.domain}`
                        : "—"}
                    </span>
                    <span className="key">{t("conn.field.apikey")}</span>
                    <span className="val">{clawAuth.apiKeyPrefix}···{clawAuth.apiKeySuffix}</span>
                  </div>

                  <div className="lis-summary">
                    <div className="lis-summary-row">
                      <span className="lis-label">{t("conn.lis.label")}</span>
                      {listenerSummary.total === 0 && !listenerBusy ? (
                        <span className="lis-empty">{t("conn.lis.empty")}</span>
                      ) : (
                        <span className="lis-stats">
                          <span className={`lis-running ${summaryAllLive ? "ok" : ""}`}>
                            {t("conn.lis.running", {
                              n: listenerSummary.running,
                              total: listenerSummary.total
                            })}
                          </span>
                          <span className="lis-sep">·</span>
                          <span className={`lis-errors ${summaryHasErrors ? "err" : "muted"}`}>
                            {t("conn.lis.errors", { n: listenerSummary.errors })}
                          </span>
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="ghost diag-btn"
                      onClick={() => {
                        setListenersDrawerOpen(true);
                        loadListeners();
                      }}
                    >
                      {t("conn.action.diagnostics")}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="form">
              <input
                type="email"
                value={clawLoginEmail}
                onChange={(event) => setClawLoginEmail(event.target.value)}
                placeholder={t("conn.input.email")}
                disabled={clawBusy}
              />
              {clawCodeSent && (
                <input
                  value={clawLoginCode}
                  onChange={(event) => setClawLoginCode(event.target.value.replace(/\D/g, ""))}
                  placeholder={t("conn.input.code")}
                  disabled={clawBusy}
                />
              )}
              <div className="actions">
                <button onClick={handleSendClawCode} disabled={clawBusy || !clawLoginEmail}>
                  {clawCodeSent ? t("conn.action.resendCode") : t("conn.action.sendCode")}
                </button>
                {clawCodeSent && (
                  <button
                    className="primary"
                    onClick={handleVerifyClawCode}
                    disabled={clawBusy || !clawLoginCode}
                  >
                    {t("conn.action.bind")}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <PrefsBar variant="rail" />

        <div className="footer-row">
          <span>{t("rail.admin")}</span>
          <button className="ghost" onClick={handleLogout}>{t("rail.logout")}</button>
        </div>
      </aside>

      <section className="work">
        <header className="work-head">
          <div className="meta">
            <div className="row">
              <span>{t(meta.eyebrow)}</span>
            </div>
            <h1 className="h-display">
              {t(meta.title)}<span className="pt">.</span>
            </h1>
            <p className="subtitle">{t(meta.subtitle)}</p>
          </div>
          <div className="actions">
            <select
              value={selectedMailbox}
              onChange={(event) => setSelectedMailbox(event.target.value)}
            >
              <option value="">{t("toolbar.selectMailbox")}</option>
              {activeMailboxes.map((mailbox) => (
                <option key={mailbox.id} value={mailbox.email}>{mailbox.email}</option>
              ))}
            </select>
            {view === "inbox" && (
              <button
                className="primary"
                onClick={() => setComposeOpen(true)}
                disabled={!selectedMailbox || !clawAuth?.hasApiKey}
              >
                {t("toolbar.compose")}
              </button>
            )}
            {view === "mailboxes" && (
              <button
                className={`sync-btn ${mailboxSyncBusy ? "syncing" : ""}`}
                onClick={handleSyncMailboxes}
                disabled={!clawAuth?.hasDashboardCookie || mailboxSyncBusy}
                title={t("toolbar.syncHint")}
                aria-busy={mailboxSyncBusy}
              >
                <span className="sync-icon" aria-hidden="true">↻</span>
                <span>{mailboxSyncBusy ? t("toolbar.syncing") : t("toolbar.sync")}</span>
              </button>
            )}
          </div>
        </header>

        <div className="divider-ascii">· · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·</div>

        {(status || error) && (
          <div className="flash-line">
            {status && <div className="notice">{status}</div>}
            {error && <div className="err">{error}</div>}
          </div>
        )}

        {view === "mailboxes" && (
          <MailboxesView
            mailboxes={activeMailboxes}
            clawAuth={clawAuth}
            suffix={suffix}
            setSuffix={setSuffix}
            onCreate={handleCreateMailbox}
            onDelete={handleDeleteMailbox}
            onOpen={(mailbox) => {
              setSelectedMailbox(mailbox.email);
              setView("inbox");
            }}
            onConfigureRules={(mailbox) => setRulesMailbox(mailbox)}
          />
        )}

        {view === "inbox" && (
          <InboxView
            selectedMailbox={selectedMailbox}
            mails={mails}
            selectedMail={selectedMail}
            onSelectMail={(id) => loadMail(id).catch(reportError)}
            onRefresh={() => loadMails(selectedMailbox, true).catch(reportError)}
            onDeleted={(id, msg) => {
              setMails((items) => items.filter((mail) => mail.id !== id));
              setSelectedMail(null);
              setStatus(msg);
            }}
            onReplied={(msg) => setStatus(msg)}
            onError={reportError}
            adminPassword={password}
          />
        )}
      </section>

      <ComposeDrawer
        open={composeOpen}
        fromMailbox={selectedMailbox}
        onClose={() => setComposeOpen(false)}
        onSent={(msg) => setStatus(msg)}
        onError={reportError}
      />

      <CommunicationRulesDrawer
        open={Boolean(rulesMailbox)}
        mailbox={rulesMailbox}
        onClose={() => setRulesMailbox(null)}
        onSaved={(updated, msg) => {
          setMailboxes((items) => items.map((item) => item.id === updated.id ? updated : item));
          setRulesMailbox(null);
          setStatus(msg);
        }}
        onError={reportError}
      />

      <ListenersDrawer
        open={listenersDrawerOpen}
        busy={listenerBusy}
        items={listenerItems}
        onClose={() => setListenersDrawerOpen(false)}
        onRefresh={loadListeners}
      />
    </main>
  );
}
