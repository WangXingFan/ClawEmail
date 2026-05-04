import { useState } from "react";
import { deleteMail, replyMail, type MailDetail, type MailSummary } from "../api";
import { useResizableWidth } from "../hooks";
import { plural, usePrefs } from "../i18n";
import { parseMailTime, parseServerTime } from "../time";

type Props = {
  selectedMailbox: string;
  mails: MailSummary[];
  selectedMail: MailDetail | null;
  onSelectMail: (id: number) => void;
  onRefresh: () => void;
  onDeleted: (id: number, msg: string) => void;
  onReplied: (msg: string) => void;
  onError: (msg: string) => void;
  adminPassword: string;
};

function fmtTime(value: string | null, source: "mail" | "db" = "db"): string {
  if (!value) return "—";
  const date = source === "mail" ? parseMailTime(value) : parseServerTime(value);
  if (Number.isNaN(date.getTime())) return value;
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "2-digit" });
}

function fmtFull(value: string | null, source: "mail" | "db" = "db"): string {
  if (!value) return "—";
  const date = source === "mail" ? parseMailTime(value) : parseServerTime(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function mailTime(mail: MailSummary | MailDetail): { value: string | null; source: "mail" | "db" } {
  return mail.received_at
    ? { value: mail.received_at, source: "mail" }
    : { value: mail.created_at, source: "db" };
}

export function InboxView({
  selectedMailbox,
  mails,
  selectedMail,
  onSelectMail,
  onRefresh,
  onDeleted,
  onReplied,
  onError,
  adminPassword
}: Props) {
  const { t } = usePrefs();
  const list = useResizableWidth({
    storageKey: "inbox.listWidth",
    initial: 360,
    min: 260,
    max: 560
  });
  const [replyBody, setReplyBody] = useState("");
  const [replyAll, setReplyAll] = useState(false);
  const [replyHtml, setReplyHtml] = useState(false);
  const [replyBusy, setReplyBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function handleReply() {
    if (!selectedMail || !replyBody) return;
    setReplyBusy(true);
    try {
      await replyMail({
        mailId: selectedMail.id,
        body: replyBody,
        html: replyHtml,
        toAll: replyAll
      });
      setReplyBody("");
      setReplyAll(false);
      setReplyHtml(false);
      onReplied(t("flash.reply.sent"));
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setReplyBusy(false);
    }
  }

  async function handleDeleteMail() {
    if (!selectedMail || !confirm(t("inbox.confirm.delete"))) return;
    setDeleteBusy(true);
    try {
      await deleteMail(selectedMail.id);
      onDeleted(selectedMail.id, t("flash.mail.deleted"));
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div
      className="inbox"
      style={{ ["--list-width" as string]: `${list.width}px` }}
    >
      <section className="list-pane">
        <div className="pane-head">
          <span className="label">{selectedMailbox || t("inbox.list.noMailbox")}</span>
          <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span className="tag muted">{plural(t, "inbox.list.count", mails.length)}</span>
            <button onClick={onRefresh}>{t("toolbar.refresh")}</button>
          </span>
        </div>
        <div className="scroll">
          {mails.length === 0 && (
            <div className="empty-state" style={{ margin: 16, border: "1px dashed var(--line)" }}>
              <span className="big">{t("inbox.list.empty.head")}</span>
              {t("inbox.list.empty.body")}
            </div>
          )}
          {mails.map((mail) => {
            const time = mailTime(mail);
            return (
              <button
                key={mail.id}
                className={`mail-row ${selectedMail?.id === mail.id ? "selected" : ""}`}
                onClick={() => onSelectMail(mail.id)}
              >
                <span className="subj">{mail.subject || t("inbox.subject.empty")}</span>
                <span className="time">{fmtTime(time.value, time.source)}</span>
                <span className="meta">
                  <span className="from">{mail.source || t("inbox.unknownSender")}</span>
                  {mail.has_attachments ? <span className="att">◇</span> : null}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div
        className={`list-resizer ${list.dragging ? "dragging" : ""}`}
        onPointerDown={list.onPointerDown}
        role="separator"
        aria-orientation="vertical"
        aria-label="resize mail list"
      />

      <section className="detail-pane">
        {!selectedMail && (
          <div className="detail-empty">
            {t("inbox.empty.head")}
            <small>{t("inbox.empty.hint")}</small>
          </div>
        )}
        {selectedMail && (() => {
          const time = mailTime(selectedMail);
          return (
          <>
            <div className="detail-head">
              <div className="crumbs">
                <span>{t("inbox.detail.thread")}</span>
                <span style={{ color: "var(--text-4)" }}>/</span>
                <span className="mono">#{selectedMail.id}</span>
                {selectedMail.has_attachments ? (
                  <span className="tag ok">{t("inbox.detail.attachments")}</span>
                ) : null}
                <button
                  className="danger detail-delete"
                  onClick={handleDeleteMail}
                  disabled={deleteBusy}
                >
                  {deleteBusy ? t("inbox.detail.deleting") : t("inbox.detail.delete")}
                </button>
              </div>
              <h2>{selectedMail.subject || t("inbox.subject.empty")}</h2>
              <dl>
                <dt>{t("inbox.detail.from")}</dt>
                <dd className="mono">{selectedMail.source || "—"}</dd>
                <dt>{t("inbox.detail.to")}</dt>
                <dd className="mono">{selectedMail.address || selectedMail.mailbox_email}</dd>
                <dt>{t("inbox.detail.at")}</dt>
                <dd className="mono">{fmtFull(time.value, time.source)}</dd>
              </dl>
            </div>

            <div className="detail-body">
              {selectedMail.html ? (
                <div className="frame">
                  <iframe title="mail-html" srcDoc={selectedMail.html} />
                </div>
              ) : (
                <pre>{selectedMail.text || t("inbox.body.empty")}</pre>
              )}
            </div>

            {selectedMail.attachments.length > 0 && (
              <div className="attachments">
                <span className="label">
                  {plural(t, "inbox.attCount", selectedMail.attachments.length)}
                </span>
                {selectedMail.attachments.map((item) => (
                  <a
                    key={item.id}
                    href={`/api/mails/${selectedMail.id}/attachments/${encodeURIComponent(item.provider_part_id)}?token=${encodeURIComponent(adminPassword)}`}
                  >
                    {item.filename || item.provider_part_id}
                    {item.size ? (
                      <span style={{ color: "var(--text-4)" }}>
                        {" · "}{Math.ceil(item.size / 1024)} {t("size.kb")}
                      </span>
                    ) : null}
                  </a>
                ))}
              </div>
            )}

            <div className="reply-box">
              <div className="head">
                <span className="label">{t("inbox.reply.label")}</span>
                <span className="opts">
                  <label>
                    <input type="checkbox" checked={replyAll} onChange={(event) => setReplyAll(event.target.checked)} />
                    {t("inbox.reply.all")}
                  </label>
                  <label>
                    <input type="checkbox" checked={replyHtml} onChange={(event) => setReplyHtml(event.target.checked)} />
                    {t("inbox.reply.html")}
                  </label>
                </span>
              </div>
              <textarea
                value={replyBody}
                onChange={(event) => setReplyBody(event.target.value)}
                placeholder={t("time.dash")}
              />
              <div className="row">
                <span />
                <button
                  className="primary"
                  onClick={handleReply}
                  disabled={!replyBody || replyBusy}
                >
                  {replyBusy ? t("inbox.reply.sending") : t("inbox.reply.dispatch")}
                </button>
              </div>
            </div>
          </>
          );
        })()}
      </section>
    </div>
  );
}
