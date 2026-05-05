import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode
} from "react";

export type Lang = "en" | "zh";
export type Theme = "dark" | "light";

type Dict = Record<string, string>;

const EN: Dict = {
  // brand / login
  "brand.tagline": "operations terminal",
  "login.headline.1": "throwaway",
  "login.headline.2": "mail, on",
  "login.headline.3": "command.",
  "login.pitch":
    "Mass-produce, monitor, dispatch and dissolve sub-mailboxes on claw.163.com. Bind via verification code — never paste credentials.",
  "login.stamp.session": "session",
  "login.stamp.online": "online",
  "login.eyebrow": "access · gate",
  "login.title": "Authenticate.",
  "login.field.password": "admin password",
  "login.placeholder.password": "enter ADMIN_PASSWORD",
  "login.btn.verifying": "verifying…",
  "login.btn.enter": "enter →",
  "login.error.unauthorized": "incorrect admin password",

  // views
  "view.mailboxes.eyebrow": "Operations · Mailboxes",
  "view.mailboxes.title": "Throwaways",
  "view.mailboxes.subtitle":
    "Forge, sync and dissolve sub-mailboxes on Claw.",
  "view.inbox.eyebrow": "Operations · Inbox",
  "view.inbox.title": "Live wire",
  "view.inbox.subtitle":
    "Inbox streamed via WebSocket and persisted on the fly. Attachments stream on demand.",
  "view.listeners.eyebrow": "Operations · Listeners",
  "view.listeners.title": "Channels",
  "view.listeners.subtitle":
    "Each managed mailbox holds a long-lived listener. Their pulse shows here.",

  // rail / nav
  "rail.brand.suffix": "terminal",
  "rail.workspace": "workspace",
  "rail.nav.inbox": "Inbox",
  "rail.nav.mailboxes": "Mailboxes",
  "rail.nav.listeners": "Listeners",

  "conn.title": "claw connection",
  "conn.bound": "bound",
  "conn.idle": "idle",
  "conn.field.user": "user",
  "conn.field.workspace": "workspace",
  "conn.field.root": "root",
  "conn.field.apikey": "api key",
  "conn.action.refresh": "refresh",
  "conn.action.disconnect": "disconnect",
  "conn.action.showDetails": "details",
  "conn.action.hideDetails": "hide",
  "conn.action.diagnostics": "diagnostics →",
  "conn.lis.label": "listeners",
  "conn.lis.running": "{n} / {total} live",
  "conn.lis.errors": "{n} errors",
  "conn.lis.empty": "no listeners running",
  "conn.input.email": "claw login email",
  "conn.input.code": "verification code",
  "conn.action.sendCode": "send code",
  "conn.action.resendCode": "resend code",
  "conn.action.bind": "bind →",

  "rail.admin": "admin",
  "rail.logout": "logout",

  // toolbar
  "toolbar.selectMailbox": "— all mailboxes —",
  "toolbar.compose": "compose →",
  "toolbar.sync": "sync",
  "toolbar.syncing": "syncing",
  "toolbar.syncHint": "Sync mailbox list from Claw",
  "toolbar.refresh": "refresh",

  // communication rules
  "rules.title": "Communication rules",
  "rules.mode": "Mode",
  "rules.external": "External scope",
  "rules.receive": "Receive",
  "rules.send": "Send",
  "rules.level.personal": "Personal mailbox only",
  "rules.level.personal.desc": "Only the account mailbox can exchange mail with this agent.",
  "rules.level.internal": "Internal only",
  "rules.level.internal.desc": "Account mailbox plus internal agents under the same account.",
  "rules.level.external": "Open external communication",
  "rules.level.external.desc": "Allow external mailboxes with explicit receive and send scope.",
  "rules.range.everyone": "Everyone",
  "rules.range.trusted": "Trusted contacts only",
  "rules.footer": "saved to Claw",
  "rules.action.cancel": "cancel",
  "rules.action.save": "save",
  "rules.action.saving": "saving…",

  // compose
  "compose.section": "04 · transmission",
  "compose.title": "Compose",
  "compose.field.from": "From",
  "compose.field.to": "To",
  "compose.field.cc": "Cc",
  "compose.field.bcc": "Bcc",
  "compose.field.subject": "Subject",
  "compose.field.body": "Body",
  "compose.placeholder.cc": "optional",
  "compose.placeholder.subject": "(no subject)",
  "compose.opt.html": "send as html",
  "compose.action.cancel": "cancel",
  "compose.action.transmit": "transmit",
  "compose.action.sending": "sending…",

  // inbox
  "inbox.list.empty.head": "silence.",
  "inbox.list.empty.body":
    "No messages yet. New mail arrives via the realtime channel.",
  "inbox.list.noMailbox": "all mailboxes",
  "inbox.list.count.one": "{n} msg",
  "inbox.list.count.other": "{n} msgs",
  "inbox.subject.empty": "(no subject)",
  "inbox.empty.head": "select a thread.",
  "inbox.empty.hint": "↑ ↓ navigate · enter to open",
  "inbox.detail.thread": "thread",
  "inbox.detail.attachments": "attachments",
  "inbox.detail.from": "from",
  "inbox.detail.to": "to",
  "inbox.detail.at": "at",
  "inbox.detail.delete": "delete",
  "inbox.detail.deleting": "deleting...",
  "inbox.attCount.one": "{n} attachment",
  "inbox.attCount.other": "{n} attachments",
  "inbox.body.empty": "(empty body)",
  "inbox.reply.label": "reply",
  "inbox.reply.all": "reply all",
  "inbox.reply.html": "html",
  "inbox.reply.dispatch": "dispatch",
  "inbox.reply.sending": "sending…",
  "inbox.unknownSender": "unknown sender",
  "inbox.confirm.delete": "Delete this mail from Claw and local storage?",

  // mailboxes
  "mb.forge": "Forge",
  "mb.root.pending": "bind Claw first",
  "mb.suffix": "suffix",
  "mb.placeholder.suffix": "example",
  "mb.hint": "a–z, 0–9 · max 32",
  "mb.create": "create →",
  "mb.empty.head": "no mailboxes yet.",
  "mb.empty.body":
    "Bind Claw to sync, or use the form above to forge a sub-mailbox.",
  "mb.head.mailbox": "mailbox",
  "mb.head.status": "status",
  "mb.head.rules": "rules",
  "mb.head.auth": "auth url",
  "mb.head.created": "created",
  "mb.head.ops": "ops",
  "mb.row.primary": "primary · root",
  "mb.row.prefix": "prefix · {p}",
  "mb.row.open": "open",
  "mb.row.rules": "rules",
  "mb.row.delete": "delete",
  "mb.rules.unknown": "unknown",
  "mb.rules.personal": "personal",
  "mb.rules.internal": "internal",
  "mb.rules.external": "external",
  "mb.rules.receiveAll": "receive all",
  "mb.confirm.delete": "Delete {email}?",

  // listeners
  "lis.empty.busy": "scanning…",
  "lis.empty.idle": "no listeners.",
  "lis.empty.body":
    "No WebSocket listeners running. They start automatically once Claw is bound.",
  "lis.field.started": "started",
  "lis.field.lastEvt": "last evt",
  "lis.field.error": "error",
  "lis.drawer.title": "Listeners",
  "lis.drawer.refresh": "refresh",
  "lis.drawer.close": "close",

  // time
  "time.justNow": "just now",
  "time.mAgo": "{n}m ago",
  "time.hAgo": "{n}h ago",
  "time.dAgo": "{n}d ago",
  "time.dash": "—",

  // flash
  "flash.compose.sent": "transmission complete · message dispatched",
  "flash.reply.sent": "reply dispatched",
  "flash.mail.deleted": "mail deleted from Claw and local storage",
  "flash.mb.created": "mailbox forged · {email}",
  "flash.mb.deleted": "mailbox dissolved · {email}",
  "flash.mb.syncing": "syncing mailboxes from Claw…",
  "flash.mb.synced": "mailboxes synced · {n} active",
  "flash.rules.saved": "communication rules saved · {email}",
  "flash.code.sent": "verification dispatched",
  "flash.claw.bound": "claw bound · {n} mailboxes synced",
  "flash.claw.refreshed": "session refreshed · {n} mailboxes synced",
  "flash.claw.severed": "session severed",
  "flash.events.reconnecting": "realtime channel reconnecting…",
  "flash.events.manualSync": "Cloudflare deployment uses manual inbox sync",
  "confirm.disconnect": "Disconnect from Claw?",

  // prefs
  "pref.theme.dark": "dark",
  "pref.theme.light": "light",
  "pref.theme.toggleToLight": "switch to light theme",
  "pref.theme.toggleToDark": "switch to dark theme",
  "pref.lang.toggle": "switch language",

  "size.kb": "kb"
};

const ZH: Dict = {
  "brand.tagline": "操作终端",
  "login.headline.1": "一键召唤",
  "login.headline.2": "随用即弃",
  "login.headline.3": "的子邮箱。",
  "login.pitch":
    "在 claw.163.com 上批量制造、监听、发信和销毁子邮箱。一切操作通过验证码连接，无需暴露凭据。",
  "login.stamp.session": "会话",
  "login.stamp.online": "在线",
  "login.eyebrow": "入口 · 闸门",
  "login.title": "身份核验。",
  "login.field.password": "管理密码",
  "login.placeholder.password": "请输入 ADMIN_PASSWORD",
  "login.btn.verifying": "核验中…",
  "login.btn.enter": "进入 →",
  "login.error.unauthorized": "管理密码错误",

  "view.mailboxes.eyebrow": "操作 · 邮箱",
  "view.mailboxes.title": "子邮箱",
  "view.mailboxes.subtitle": "在 Claw 上创建、同步与销毁子邮箱。",
  "view.inbox.eyebrow": "操作 · 收件箱",
  "view.inbox.title": "实时通道",
  "view.inbox.subtitle":
    "通过 WebSocket 实时落库的收件箱，附件按需流式下载。",
  "view.listeners.eyebrow": "操作 · 监听器",
  "view.listeners.title": "通道",
  "view.listeners.subtitle":
    "每个被管理的邮箱都对应一个长连接监听器，其状态在此实时呈现。",

  "rail.brand.suffix": "终端",
  "rail.workspace": "工作区",
  "rail.nav.inbox": "收件箱",
  "rail.nav.mailboxes": "邮箱",
  "rail.nav.listeners": "监听器",

  "conn.title": "claw 连接",
  "conn.bound": "已绑定",
  "conn.idle": "未连接",
  "conn.field.user": "用户",
  "conn.field.workspace": "工作区",
  "conn.field.root": "根域",
  "conn.field.apikey": "API Key",
  "conn.action.refresh": "刷新",
  "conn.action.disconnect": "断开",
  "conn.action.showDetails": "详情",
  "conn.action.hideDetails": "收起",
  "conn.action.diagnostics": "诊断 →",
  "conn.lis.label": "监听器",
  "conn.lis.running": "监听中 {n} / {total}",
  "conn.lis.errors": "异常 {n}",
  "conn.lis.empty": "暂无监听器",
  "conn.input.email": "claw 登录邮箱",
  "conn.input.code": "验证码",
  "conn.action.sendCode": "发送验证码",
  "conn.action.resendCode": "重新发送",
  "conn.action.bind": "绑定 →",

  "rail.admin": "管理员",
  "rail.logout": "退出",

  "toolbar.selectMailbox": "— 全部邮箱 —",
  "toolbar.compose": "写信 →",
  "toolbar.sync": "同步",
  "toolbar.syncing": "同步中",
  "toolbar.syncHint": "从 Claw 重新同步邮箱列表",
  "toolbar.refresh": "刷新",

  "rules.title": "通讯规则",
  "rules.mode": "模式",
  "rules.external": "外部范围",
  "rules.receive": "收信",
  "rules.send": "发信",
  "rules.level.personal": "仅个人邮箱",
  "rules.level.personal.desc": "只允许账号邮箱与该 Agent 邮箱互相收发。",
  "rules.level.internal": "仅内部通信",
  "rules.level.internal.desc": "账号邮箱，以及同账号下开启内部通信的 Agent 邮箱。",
  "rules.level.external": "开放外部通信",
  "rules.level.external.desc": "允许外部邮箱通信，并分别设置收信与发信范围。",
  "rules.range.everyone": "所有人",
  "rules.range.trusted": "仅信任联系人",
  "rules.footer": "保存到 Claw",
  "rules.action.cancel": "取消",
  "rules.action.save": "保存",
  "rules.action.saving": "保存中…",

  "compose.section": "04 · 发送",
  "compose.title": "撰写邮件",
  "compose.field.from": "发件人",
  "compose.field.to": "收件人",
  "compose.field.cc": "抄送",
  "compose.field.bcc": "密送",
  "compose.field.subject": "主题",
  "compose.field.body": "正文",
  "compose.placeholder.cc": "可选",
  "compose.placeholder.subject": "（无主题）",
  "compose.opt.html": "以 HTML 发送",
  "compose.action.cancel": "取消",
  "compose.action.transmit": "发送",
  "compose.action.sending": "发送中…",

  "inbox.list.empty.head": "悄无声息。",
  "inbox.list.empty.body": "暂无邮件，新邮件会通过实时通道自动到达。",
  "inbox.list.noMailbox": "全部邮箱",
  "inbox.list.count.one": "{n} 封",
  "inbox.list.count.other": "{n} 封",
  "inbox.subject.empty": "（无主题）",
  "inbox.empty.head": "请选择一封邮件。",
  "inbox.empty.hint": "↑ ↓ 切换 · 回车打开",
  "inbox.detail.thread": "会话",
  "inbox.detail.attachments": "含附件",
  "inbox.detail.from": "来自",
  "inbox.detail.to": "送达",
  "inbox.detail.at": "时间",
  "inbox.detail.delete": "删除",
  "inbox.detail.deleting": "删除中...",
  "inbox.attCount.one": "{n} 个附件",
  "inbox.attCount.other": "{n} 个附件",
  "inbox.body.empty": "（正文为空）",
  "inbox.reply.label": "回复",
  "inbox.reply.all": "回复全部",
  "inbox.reply.html": "HTML",
  "inbox.reply.dispatch": "发送",
  "inbox.reply.sending": "发送中…",
  "inbox.unknownSender": "未知发件人",
  "inbox.confirm.delete": "确认从 Claw 远端和本地记录中删除这封邮件？",

  "mb.forge": "创建",
  "mb.root.pending": "请先绑定 Claw",
  "mb.suffix": "后缀",
  "mb.placeholder.suffix": "example",
  "mb.hint": "a–z, 0–9 · 最多 32 位",
  "mb.create": "创建 →",
  "mb.empty.head": "暂无子邮箱。",
  "mb.empty.body": "绑定 Claw 后将自动同步，亦可使用上方表单手动创建。",
  "mb.head.mailbox": "邮箱",
  "mb.head.status": "状态",
  "mb.head.rules": "规则",
  "mb.head.auth": "认证地址",
  "mb.head.created": "创建于",
  "mb.head.ops": "操作",
  "mb.row.primary": "主邮箱 · 根域",
  "mb.row.prefix": "前缀 · {p}",
  "mb.row.open": "打开",
  "mb.row.rules": "通讯规则",
  "mb.row.delete": "删除",
  "mb.rules.unknown": "未知",
  "mb.rules.personal": "个人",
  "mb.rules.internal": "内部",
  "mb.rules.external": "外部",
  "mb.rules.receiveAll": "可收外部",
  "mb.confirm.delete": "确认删除 {email}？",

  "lis.empty.busy": "扫描中…",
  "lis.empty.idle": "暂无监听器。",
  "lis.empty.body":
    "尚无运行中的 WebSocket 监听器。绑定 Claw 后将自动为每个邮箱建立监听。",
  "lis.field.started": "启动",
  "lis.field.lastEvt": "最近事件",
  "lis.field.error": "错误",
  "lis.drawer.title": "监听器",
  "lis.drawer.refresh": "刷新",
  "lis.drawer.close": "关闭",

  "time.justNow": "刚刚",
  "time.mAgo": "{n} 分钟前",
  "time.hAgo": "{n} 小时前",
  "time.dAgo": "{n} 天前",
  "time.dash": "—",

  "flash.compose.sent": "已送达 · 邮件已发送",
  "flash.reply.sent": "回复已发送",
  "flash.mail.deleted": "邮件已从 Claw 和本地删除",
  "flash.mb.created": "已创建子邮箱 · {email}",
  "flash.mb.deleted": "已删除子邮箱 · {email}",
  "flash.mb.syncing": "正在从 Claw 同步邮箱…",
  "flash.mb.synced": "邮箱同步完成 · 当前 {n} 个有效邮箱",
  "flash.rules.saved": "通讯规则已保存 · {email}",
  "flash.code.sent": "验证码已发送",
  "flash.claw.bound": "Claw 已绑定 · 同步 {n} 个邮箱",
  "flash.claw.refreshed": "连接已刷新 · 同步 {n} 个邮箱",
  "flash.claw.severed": "Claw 连接已断开",
  "flash.events.reconnecting": "实时连接断开，稍后会自动重连…",
  "flash.events.manualSync": "Cloudflare 部署使用手动同步收件箱",
  "confirm.disconnect": "确认断开 Claw 连接？",

  "pref.theme.dark": "暗色",
  "pref.theme.light": "亮色",
  "pref.theme.toggleToLight": "切换到亮色",
  "pref.theme.toggleToDark": "切换到暗色",
  "pref.lang.toggle": "切换语言",

  "size.kb": "KB"
};

const DICT: Record<Lang, Dict> = { en: EN, zh: ZH };

type PrefsCtx = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const Ctx = createContext<PrefsCtx | null>(null);

function readLang(): Lang {
  if (typeof localStorage === "undefined") return "en";
  const saved = localStorage.getItem("lang");
  if (saved === "zh" || saved === "en") return saved;
  const browser = (navigator.language || "").toLowerCase();
  return browser.startsWith("zh") ? "zh" : "en";
}

function readTheme(): Theme {
  if (typeof localStorage === "undefined") return "dark";
  const saved = localStorage.getItem("theme");
  if (saved === "light" || saved === "dark") return saved;
  return "dark";
}

function format(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_match, key: string) =>
    vars[key] !== undefined ? String(vars[key]) : `{${key}}`
  );
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readLang);
  const [theme, setThemeState] = useState<Theme>(readTheme);

  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    localStorage.setItem("lang", lang);
  }, [lang]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  function t(key: string, vars?: Record<string, string | number>): string {
    const text = DICT[lang][key] ?? DICT.en[key] ?? key;
    return format(text, vars);
  }

  const value: PrefsCtx = {
    lang,
    setLang: setLangState,
    toggleLang: () => setLangState(lang === "en" ? "zh" : "en"),
    theme,
    setTheme: setThemeState,
    toggleTheme: () => setThemeState(theme === "dark" ? "light" : "dark"),
    t
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs(): PrefsCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePrefs must be used inside PrefsProvider");
  return ctx;
}

export function plural(
  t: (key: string, vars?: Record<string, string | number>) => string,
  base: string,
  n: number
): string {
  const key = n === 1 ? `${base}.one` : `${base}.other`;
  return t(key, { n });
}

type IconName = "sun" | "moon";
function Icon({ name }: { name: IconName }) {
  if (name === "sun") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export function PrefsBar({ variant = "rail" }: { variant?: "rail" | "login" }) {
  const { theme, toggleTheme, lang, toggleLang, t } = usePrefs();
  const themeTitle =
    theme === "dark" ? t("pref.theme.toggleToLight") : t("pref.theme.toggleToDark");
  return (
    <div className={`prefs-bar prefs-bar-${variant}`}>
      <button
        type="button"
        className="pref-btn"
        onClick={toggleTheme}
        title={themeTitle}
        aria-label={themeTitle}
      >
        <Icon name={theme === "dark" ? "moon" : "sun"} />
        <span className="pref-text">{theme === "dark" ? t("pref.theme.dark") : t("pref.theme.light")}</span>
      </button>
      <button
        type="button"
        className={`pref-btn lang-pill lang-${lang}`}
        onClick={toggleLang}
        title={t("pref.lang.toggle")}
        aria-label={t("pref.lang.toggle")}
      >
        <span className={`lang-slot ${lang === "en" ? "on" : ""}`}>EN</span>
        <span className="lang-slot-divider">/</span>
        <span className={`lang-slot ${lang === "zh" ? "on" : ""}`}>中</span>
      </button>
    </div>
  );
}
