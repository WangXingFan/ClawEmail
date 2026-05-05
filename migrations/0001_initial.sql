CREATE TABLE IF NOT EXISTS mailboxes (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  prefix TEXT NOT NULL,
  display_name TEXT,
  account_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  openclaw_status TEXT,
  install_command TEXT,
  auth_url TEXT,
  comm_level INTEGER,
  ext_receive_type INTEGER,
  ext_send_type INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mailboxes_email ON mailboxes(email);
CREATE INDEX IF NOT EXISTS idx_mailboxes_status ON mailboxes(status);

CREATE TABLE IF NOT EXISTS mails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_mail_id TEXT NOT NULL,
  mailbox_email TEXT NOT NULL,
  source TEXT,
  address TEXT,
  subject TEXT,
  text TEXT,
  html TEXT,
  raw_json TEXT NOT NULL,
  header_raw TEXT,
  has_attachments INTEGER NOT NULL DEFAULT 0,
  received_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(mailbox_email, provider_mail_id)
);

CREATE INDEX IF NOT EXISTS idx_mails_mailbox_email ON mails(mailbox_email);
CREATE INDEX IF NOT EXISTS idx_mails_created_at ON mails(created_at);

CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mail_id INTEGER NOT NULL,
  provider_part_id TEXT NOT NULL,
  filename TEXT,
  content_type TEXT,
  size INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(mail_id) REFERENCES mails(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_attachments_mail_id ON attachments(mail_id);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

