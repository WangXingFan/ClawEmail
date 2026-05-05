import type { D1Database, D1Value, MailboxRow, MailRow, AttachmentRow } from "./types";

function rowChanges(result: { meta?: { changes?: number } }): number {
  return result.meta?.changes ?? 0;
}

async function all<T>(db: D1Database, sql: string, ...params: D1Value[]): Promise<T[]> {
  const result = await db.prepare(sql).bind(...params).all<T>();
  return result.results ?? [];
}

async function first<T>(db: D1Database, sql: string, ...params: D1Value[]): Promise<T | undefined> {
  return (await db.prepare(sql).bind(...params).first<T>()) ?? undefined;
}

export async function upsertMailbox(
  db: D1Database,
  input: {
    id: string;
    email: string;
    prefix: string;
    displayName?: string | null;
    accountId?: string | null;
    status?: string | null;
    openclawStatus?: string | null;
    installCommand?: string | null;
    authUrl?: string | null;
    commLevel?: number | null;
    extReceiveType?: number | null;
    extSendType?: number | null;
  }
): Promise<MailboxRow> {
  const existing =
    await getMailboxById(db, input.id) ??
    await first<MailboxRow>(db, "SELECT * FROM mailboxes WHERE email = ?", input.email);

  const values: D1Value[] = [
    input.id,
    input.email,
    input.prefix,
    input.displayName ?? null,
    input.accountId ?? null,
    input.status ?? "active",
    input.openclawStatus ?? null,
    input.installCommand ?? null,
    input.authUrl ?? null,
    input.commLevel ?? null,
    input.extReceiveType ?? null,
    input.extSendType ?? null
  ];

  if (existing) {
    await db.prepare(`
      UPDATE mailboxes
      SET id = ?, email = ?, prefix = ?, display_name = ?, account_id = ?,
          status = ?, openclaw_status = ?, install_command = ?, auth_url = ?,
          comm_level = ?, ext_receive_type = ?, ext_send_type = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(...values, existing.id).run();
  } else {
    await db.prepare(`
      INSERT INTO mailboxes
        (
          id, email, prefix, display_name, account_id, status, openclaw_status,
          install_command, auth_url, comm_level, ext_receive_type, ext_send_type
        )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(...values).run();
  }

  const row = await getMailboxById(db, input.id);
  if (!row) throw new Error("failed to save mailbox");
  return row;
}

export async function listMailboxes(db: D1Database, includeDeleted = false): Promise<MailboxRow[]> {
  const sql = includeDeleted
    ? "SELECT * FROM mailboxes ORDER BY created_at DESC, email ASC"
    : "SELECT * FROM mailboxes WHERE status != 'deleted' ORDER BY created_at DESC, email ASC";
  return all<MailboxRow>(db, sql);
}

export async function listActiveMailboxes(db: D1Database): Promise<MailboxRow[]> {
  return all<MailboxRow>(db, "SELECT * FROM mailboxes WHERE status = 'active' ORDER BY email ASC");
}

export async function getMailboxById(db: D1Database, id: string): Promise<MailboxRow | undefined> {
  return first<MailboxRow>(db, "SELECT * FROM mailboxes WHERE id = ?", id);
}

export async function getMailboxByEmail(db: D1Database, email: string): Promise<MailboxRow | undefined> {
  return first<MailboxRow>(
    db,
    "SELECT * FROM mailboxes WHERE email = ? AND status != 'deleted'",
    email
  );
}

export async function markMailboxDeleted(db: D1Database, id: string): Promise<void> {
  await db.prepare("UPDATE mailboxes SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(id)
    .run();
}

export async function updateMailboxCommSettings(
  db: D1Database,
  id: string,
  input: {
    commLevel: number;
    extReceiveType?: number | null;
    extSendType?: number | null;
  }
): Promise<MailboxRow | undefined> {
  await db.prepare(`
    UPDATE mailboxes
    SET comm_level = ?, ext_receive_type = ?, ext_send_type = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    input.commLevel,
    input.extReceiveType ?? null,
    input.extSendType ?? null,
    id
  ).run();
  return getMailboxById(db, id);
}

export async function markMailboxesMissingDeleted(
  db: D1Database,
  remoteEmails: string[]
): Promise<MailboxRow[]> {
  const remoteEmailSet = new Set(remoteEmails.map((email) => email.trim().toLowerCase()));
  const missing = (await listActiveMailboxes(db))
    .filter((mailbox) => !remoteEmailSet.has(mailbox.email.toLowerCase()));
  if (missing.length === 0) return [];

  await db.batch(missing.map((mailbox) =>
    db.prepare("UPDATE mailboxes SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(mailbox.id)
  ));
  return missing;
}

export async function saveMail(
  db: D1Database,
  input: {
    providerMailId: string;
    mailboxEmail: string;
    source?: string | null;
    address?: string | null;
    subject?: string | null;
    text?: string | null;
    html?: string | null;
    rawJson: string;
    headerRaw?: string | null;
    hasAttachments?: boolean;
    receivedAt?: string | null;
    attachments?: Array<{
      providerPartId: string;
      filename?: string | null;
      contentType?: string | null;
      size?: number | null;
    }>;
  }
): Promise<MailRow> {
  const existing = await getMailByProviderId(db, input.mailboxEmail, input.providerMailId);
  if (existing) {
    await db.prepare(`
      UPDATE mails
      SET source = ?, address = ?, subject = ?, text = ?, html = ?, raw_json = ?,
          header_raw = ?, has_attachments = ?, received_at = ?
      WHERE id = ?
    `).bind(
      input.source ?? null,
      input.address ?? null,
      input.subject ?? null,
      input.text ?? null,
      input.html ?? null,
      input.rawJson,
      input.headerRaw ?? null,
      input.hasAttachments ? 1 : 0,
      input.receivedAt ?? null,
      existing.id
    ).run();
  } else {
    await db.prepare(`
      INSERT INTO mails
        (
          provider_mail_id, mailbox_email, source, address, subject, text, html,
          raw_json, header_raw, has_attachments, received_at
        )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      input.providerMailId,
      input.mailboxEmail,
      input.source ?? null,
      input.address ?? null,
      input.subject ?? null,
      input.text ?? null,
      input.html ?? null,
      input.rawJson,
      input.headerRaw ?? null,
      input.hasAttachments ? 1 : 0,
      input.receivedAt ?? null
    ).run();
  }

  const row = await getMailByProviderId(db, input.mailboxEmail, input.providerMailId);
  if (!row) throw new Error("failed to save mail");

  const statements = [
    db.prepare("DELETE FROM attachments WHERE mail_id = ?").bind(row.id),
    ...(input.attachments ?? []).map((attachment) =>
      db.prepare(`
        INSERT INTO attachments (mail_id, provider_part_id, filename, content_type, size)
        VALUES (?, ?, ?, ?, ?)
      `).bind(
        row.id,
        attachment.providerPartId,
        attachment.filename ?? null,
        attachment.contentType ?? null,
        attachment.size ?? null
      )
    )
  ];
  await db.batch(statements);

  return row;
}

export async function listMails(
  db: D1Database,
  input: {
    mailboxEmail?: string;
    limit: number;
    offset: number;
  }
): Promise<{ items: MailRow[]; count: number }> {
  const where = input.mailboxEmail ? "WHERE mailbox_email = ?" : "";
  const params: D1Value[] = input.mailboxEmail ? [input.mailboxEmail] : [];
  const items = await all<MailRow>(
    db,
    `
      SELECT * FROM mails ${where}
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?
    `,
    ...params,
    input.limit,
    input.offset
  );
  const countRow = await first<{ count: number }>(
    db,
    `SELECT COUNT(*) AS count FROM mails ${where}`,
    ...params
  );
  return { items, count: countRow?.count ?? 0 };
}

export async function listMailProviderIds(db: D1Database, mailboxEmail: string): Promise<string[]> {
  const rows = await all<{ provider_mail_id: string }>(
    db,
    "SELECT provider_mail_id FROM mails WHERE mailbox_email = ?",
    mailboxEmail
  );
  return rows.map((row) => row.provider_mail_id);
}

export async function getMailById(db: D1Database, id: number): Promise<MailRow | undefined> {
  return first<MailRow>(db, "SELECT * FROM mails WHERE id = ?", id);
}

export async function getMailByProviderId(
  db: D1Database,
  mailboxEmail: string,
  providerMailId: string
): Promise<MailRow | undefined> {
  return first<MailRow>(
    db,
    "SELECT * FROM mails WHERE mailbox_email = ? AND provider_mail_id = ?",
    mailboxEmail,
    providerMailId
  );
}

export async function deleteMailById(db: D1Database, id: number): Promise<boolean> {
  const result = await db.prepare("DELETE FROM mails WHERE id = ?").bind(id).run();
  return rowChanges(result) > 0;
}

export async function deleteMailsByProviderIds(
  db: D1Database,
  mailboxEmail: string,
  providerMailIds: string[]
): Promise<number> {
  if (providerMailIds.length === 0) return 0;
  const results = await db.batch(providerMailIds.map((providerMailId) =>
    db.prepare("DELETE FROM mails WHERE mailbox_email = ? AND provider_mail_id = ?")
      .bind(mailboxEmail, providerMailId)
  ));
  return results.reduce((sum, result) => sum + rowChanges(result), 0);
}

export async function listAttachments(db: D1Database, mailId: number): Promise<AttachmentRow[]> {
  return all<AttachmentRow>(
    db,
    "SELECT * FROM attachments WHERE mail_id = ? ORDER BY id ASC",
    mailId
  );
}

export async function getSetting(db: D1Database, key: string): Promise<string | undefined> {
  const row = await first<{ value: string }>(db, "SELECT value FROM app_settings WHERE key = ?", key);
  return row?.value;
}

export async function setSetting(db: D1Database, key: string, value: string): Promise<void> {
  await db.prepare(`
    INSERT INTO app_settings (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).bind(key, value).run();
}

export async function deleteSettings(db: D1Database, keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await db.batch(keys.map((key) =>
    db.prepare("DELETE FROM app_settings WHERE key = ?").bind(key)
  ));
}

