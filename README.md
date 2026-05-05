# Claw Email Web Manager

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/WangXingFan/ClawEmail)

基于 `claw.163.com` 的 **子邮箱批量管理 / 实时收发** 一体化前后端。
通过 Web UI 验证码登录 Claw，自动派生 Dashboard Cookie 与 API Key，为每个子邮箱维持长连接监听，新邮件实时入库并经 SSE 推送给前端，可在线发件、回复、删除（远端 + 本地双删）、下载附件。

仓库结构：

```text
src/
  server/                Fastify 5 后端（SQLite + Claw SDK + Dashboard 内部接口）
    config.ts            环境变量解析（zod）
    db.ts                better-sqlite3 schema 与 DAO
    runtime-config.ts    运行时凭据（优先读 SQLite，再回退 .env）
    claw-dashboard.ts    Claw Dashboard 内部 HTTP 接口封装
    claw-mail.ts         @clawemail/node-sdk 客户端池 + 发件/回信/删信/列表
    listener-manager.ts  每邮箱 WS 长连接 + 指数退避重连
    sse.ts               SSE 广播总线
    routes/              auth / mailboxes / mails / send / events
    index.ts             Fastify 启动 + 静态托管前端
  web/                   Vite 7 + React 19 单页应用
    src/App.tsx          主壳：登录/路由/连接卡/工具栏
    src/api.ts           前端调用层（统一 X-Admin-Password / ?token=）
    src/i18n.tsx         中英双语 + 暗亮主题
    src/components/      InboxView / MailboxesView / ComposeDrawer / ListenersDrawer / ListenersView
    src/hooks.ts         可拖拽栏宽（localStorage 持久化）
```

## 1. 功能矩阵

| 模块 | 能力 | 实现位置 |
|---|---|---|
| Claw 绑定 | 邮箱 + 验证码两步登录；自动取 `auth/me` / `workspaces` / `mailboxes` / `api-keys`；写入 SQLite | `routes/claw-auth.ts`、`runtime-config.ts` |
| 邮箱管理 | 创建（前缀 `^[a-z0-9]{1,32}$`）、列表、`?sync=true` 与远端做差量同步、删除（拒绝删主邮箱） | `routes/mailboxes.ts`、`claw-dashboard.ts` |
| 通讯规则 | 同步并保存 `commLevel` / `extReceiveType` / `extSendType`；邮箱页可配置个人 / 内部 / 外部通信范围 | `routes/mailboxes.ts`、`CommunicationRulesDrawer.tsx` |
| 实时收件 | 每个 `active` 邮箱一条 WS 监听；落库为 `mails` + `attachments`；SSE `event: mail` 推送 | `listener-manager.ts`、`sse.ts` |
| 收件同步 | `GET /api/mails?sync=true`：远端 INBOX `id` 列表 → 删本地多余、补本地缺失 | `routes/mails.ts` |
| 邮件详情 | 返回行 + 解析后的原始 JSON + 附件元数据 | `routes/mails.ts` |
| 删信 | SDK `moveMessages([id], "Trash")` 远端删除 + 本地行删除 | `claw-mail.ts`、`routes/mails.ts` |
| 发件 | 仅允许 `from` 是本地已管理邮箱 | `routes/send.ts` |
| 回信 | 基于本地 `mailId` 反查 `provider_mail_id` 调 SDK | `routes/send.ts` |
| 附件下载 | 不缓存原始字节，按需经 SDK 流式拉取 | `routes/mails.ts` |
| 监听器诊断 | `/api/listeners` 输出 `email/connected/retry`；前端有侧栏摘要 + 抽屉详情 | `routes/events.ts`、`ListenersDrawer.tsx` |
| 前端体验 | 中英双语、暗亮主题、拖拽栏宽（侧边栏 / 邮件列表）、登录态 localStorage 记忆 | `i18n.tsx`、`hooks.ts` |

## 2. Claw 验证码登录链

不收集任何 Claw 密码。`POST /api/auth/claw/verify-code` 内部串联以下接口：

```http
POST https://claw.163.com/mailserv-claw-dashboard/p/v1/auth/email/send-code
POST https://claw.163.com/mailserv-claw-dashboard/p/v1/auth/email/verify-code   → Set-Cookie: CLAW_SESS
GET  https://claw.163.com/mailserv-claw-dashboard/api/v1/auth/me
GET  https://claw.163.com/mailserv-claw-dashboard/api/v1/workspaces
GET  https://claw.163.com/mailserv-claw-dashboard/api/v1/mailboxes?workspaceId=<id>
GET  https://claw.163.com/mailserv-claw-dashboard/api/v1/api-keys
```

落库（SQLite `app_settings` 表）：

```text
claw.apiKey
claw.dashboardCookie
claw.userEmail
claw.workspaceId / claw.workspaceName
claw.parentMailboxId
claw.rootPrefix
claw.domain
```

`workspace` 取 `status=active`，`apiKey` 取 `defaultFlag=1` 优先。
绑定成功后会先 `stopAllMailboxListeners()` + `resetMailClients()` 再用新凭据 `startAllMailboxListeners()`，避免旧连接残留。

## 3. Dashboard 内部接口（仅后端调用）

| 用途 | 方法 / 路径 |
|---|---|
| 列出工作区下的邮箱树 | `GET /api/v1/mailboxes?workspaceId=<id>` |
| 创建子邮箱 | `POST /api/v1/mailboxes`（`{prefix, displayName, mailboxType:"sub", workspaceId, parentMailboxId}`） |
| 配置通讯规则 | `POST /api/v1/mailboxes/comm-settings?id=<mailboxId>`（`{commLevel, extReceiveType?, extSendType?}`） |
| 删除邮箱 | `POST /api/v1/mailboxes/delete?id=<mailboxId>` |

返回壳为 `{code, message, success, result}`，由 `parseDashboardResponse` 统一解包。

## 4. 本项目 HTTP API

### 4.1 鉴权

所有 `/api/*` 必须带：

```http
X-Admin-Password: <ADMIN_PASSWORD>
```

浏览器无法自定义头的场景（SSE、附件 `<a href>`）改用：

```http
?token=<ADMIN_PASSWORD>
```

`X-Admin-Password` 与 `query.token` 命中其一即放行（见 `src/server/index.ts: extractAdminPassword`）。

### 4.2 端点清单

```http
GET    /health
GET    /api/auth/claw/status
POST   /api/auth/claw/send-code
POST   /api/auth/claw/verify-code
POST   /api/auth/claw/refresh
POST   /api/auth/claw/logout

GET    /api/mailboxes                # 仅本地
GET    /api/mailboxes?sync=true      # 与 Claw 做差量同步后再返回
POST   /api/mailboxes                # { suffix }
POST   /api/mailboxes/:id/comm-settings      # { commLevel, extReceiveType?, extSendType? }
DELETE /api/mailboxes/:id

GET    /api/mails?mailbox=&limit=50&offset=0
GET    /api/mails?sync=true&mailbox=...      # 远端 INBOX 全量比对
GET    /api/mails/:id                        # 详情 + 解析后 JSON + 附件元数据
DELETE /api/mails/:id                        # 远端移到 Trash + 本地删除
GET    /api/mails/:id/attachments/:partId    # 流式下载附件

POST   /api/send                              # { from, to[], cc?, bcc?, subject?, body?, html? }
POST   /api/reply                             # { mailId, body?, html?, toAll? }

GET    /api/events                            # SSE: event: mail
GET    /api/listeners
```

请求样例：

```jsonc
// POST /api/mailboxes
{ "suffix": "4" }

// POST /api/send
{
  "from": "vercel.4@claw.163.com",
  "to": ["target@example.com"],
  "cc": ["copy@example.com"],
  "subject": "hello",
  "body": "message body",
  "html": false
}

// POST /api/reply
{ "mailId": 123, "body": "reply body", "toAll": false, "html": false }
```

SSE 事件：

```text
event: mail
data: {"mailboxEmail":"vercel.4@claw.163.com","id":42,"providerMailId":"..."}
```

校验：所有入参经 zod 解析；失败返回 `400 {error:"invalid input", details:[...]}`。

## 5. 数据持久化

SQLite 文件由 `DATABASE_PATH` 指定（默认 `./data/app.db`），开启 `journal_mode=WAL` + `foreign_keys=ON`。

```text
mailboxes      子邮箱：id / email(unique) / prefix / status / install_command / auth_url / comm_level ...
mails          邮件：mailbox_email + provider_mail_id 联合唯一，含 raw_json 全文
attachments    附件元数据：mail_id 外键 → mails.id（ON DELETE CASCADE）
app_settings   key/value，存 Claw 凭据
```

附件二进制**不入库**，下载时调 `client.mail.getAttachment` 流式回传给浏览器。

## 6. 监听器与重连

`src/server/listener-manager.ts`：

- 启动条件：邮箱 `status === "active"` 且 `hasClawMailConfig()` 为真
- 退避序列：`[1, 2, 4, 8, 16, 30]` 秒
- `client.ws.onMessage` 收到 mailId → `client.mail.read({markRead:true})` → `saveMail` → SSE `mail` 广播
- `client.ws.onDisconnect` 触发 `scheduleReconnect`
- 删邮箱、断开 Claw 时会显式 `stopMailboxListener` 关闭 WS

`/api/listeners` 当前返回字段：`{ email, connected, retry }`。前端 `ListenersDrawer` 同时兼容了未来可能扩展的 `status / startedAt / lastEventAt / error` 字段。

## 7. 环境变量

```env
NODE_ENV=production
PORT=3000
ADMIN_PASSWORD=change-me

# 以下变量是"兜底值"，验证码登录成功后会被 SQLite 中的值覆盖
CLAW_API_KEY=
CLAW_DASHBOARD_COOKIE=
CLAW_WORKSPACE_ID=
CLAW_PARENT_MAILBOX_ID=
CLAW_ROOT_PREFIX=
CLAW_DOMAIN=claw.163.com

DATABASE_PATH=./data/app.db
```

读取顺序（`runtime-config.ts`）：`SQLite app_settings` → `process.env`，缺一则 API 报 `... is required; connect Claw first`。

## 8. 本地运行

应用监听端口由 `PORT` 环境变量控制，默认 **3000**（host `0.0.0.0`）。

```powershell
npm install
npm run build
npm start
# 默认 http://localhost:3000
# 改端口： $env:PORT=8080; npm start
```

开发：

```powershell
npm run dev          # tsx 跑后端，监听 :3000（受 PORT 控制）
npm run dev:web      # Vite 跑前端，监听 :5173
npm run typecheck    # tsc --noEmit
```

`npm run build` = `vite build` 产出静态资源到 `dist/web` + `esbuild` 打包后端到 `dist/server/index.js`，`@clawemail/node-sdk`、`fastify`、`better-sqlite3` 等保持 external。

## 9. Docker 部署

容器内进程恒定监听 `3000`，宿主端口由 `ports` 左侧决定（默认 `3000:3000`）。

### docker compose

```powershell
git clone https://github.com/WangXingFan/ClawEmail.git
cd ClawEmail
cp .env.example .env
docker compose up -d
curl http://localhost:3000/health
```

### docker run

```bash
docker run -d --name clawemail \
  -p 3000:3000 \
  -e ADMIN_PASSWORD=change-me \
  -v $PWD/data:/app/data \
  ghcr.io/wangxingfan/clawemail:latest
```

`./data` 挂到 `/app/data` 持久化 SQLite。

## 10. Cloudflare 无服务器部署

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/WangXingFan/ClawEmail)

本仓库同时提供 Cloudflare Workers + Static Assets + D1 的部署入口：

```text
src/cloudflare/          Cloudflare Worker API（无 Fastify / better-sqlite3 / Node SDK）
migrations/0001_initial.sql
wrangler.toml
```

限制边界：

- Cloudflare 版不运行常驻邮箱 WebSocket 监听器；收件箱通过前端刷新或 `GET /api/mails?sync=true` 请求触发同步。
- D1 替代本地 SQLite 文件；不需要自建服务器或挂载磁盘。
- 附件仍然不入库，下载时从 Claw 远端按需转发。

一键部署会跳转到 Cloudflare，由 Cloudflare 克隆仓库、创建 Workers Builds 项目，并按 `wrangler.toml` 自动准备 D1 绑定。部署过程中需要填写 `ADMIN_PASSWORD`。

手动部署：

```powershell
npx wrangler login
npx wrangler d1 create clawemail
```

把上一步输出的 `database_id` 写入 `wrangler.toml`：

```toml
[[d1_databases]]
binding = "DB"
database_name = "clawemail"
database_id = "你的 D1 database_id"
```

设置管理密码并初始化 D1：

```powershell
npx wrangler secret put ADMIN_PASSWORD
npm run cf:migrate
```

部署：

```powershell
npm run cf:deploy
```

Cloudflare 版入口与原 API 保持一致，前端仍调用同源 `/api/*`。如果需要回到原服务器版，继续使用 `npm run build && npm start` 或 Docker 部署即可。



## 致谢

感谢 [Linux.do](https://linux.do) 社区。
