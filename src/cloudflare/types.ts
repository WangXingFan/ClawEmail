export type D1Value = string | number | boolean | null | ArrayBuffer | Uint8Array;

export type D1Result<T = unknown> = {
  results?: T[];
  success: boolean;
  meta?: {
    changes?: number;
    duration?: number;
    last_row_id?: number;
    rows_read?: number;
    rows_written?: number;
  };
  error?: string;
};

export type D1PreparedStatement = {
  bind(...values: D1Value[]): D1PreparedStatement;
  first<T = unknown>(column?: string): Promise<T | null>;
  all<T = unknown>(): Promise<D1Result<T>>;
  run<T = unknown>(): Promise<D1Result<T>>;
};

export type D1Database = {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
};

export type Fetcher = {
  fetch(request: Request): Promise<Response>;
};

export type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
  ADMIN_PASSWORD?: string;
  CLAW_API_KEY?: string;
  CLAW_DASHBOARD_COOKIE?: string;
  CLAW_WORKSPACE_ID?: string;
  CLAW_PARENT_MAILBOX_ID?: string;
  CLAW_ROOT_PREFIX?: string;
  CLAW_DOMAIN?: string;
};

export type MailboxRow = {
  id: string;
  email: string;
  prefix: string;
  display_name: string | null;
  account_id: string | null;
  status: string;
  openclaw_status: string | null;
  install_command: string | null;
  auth_url: string | null;
  comm_level: number | null;
  ext_receive_type: number | null;
  ext_send_type: number | null;
  created_at: string;
  updated_at: string;
};

export type MailRow = {
  id: number;
  provider_mail_id: string;
  mailbox_email: string;
  source: string | null;
  address: string | null;
  subject: string | null;
  text: string | null;
  html: string | null;
  raw_json: string;
  header_raw: string | null;
  has_attachments: number;
  received_at: string | null;
  created_at: string;
};

export type AttachmentRow = {
  id: number;
  mail_id: number;
  provider_part_id: string;
  filename: string | null;
  content_type: string | null;
  size: number | null;
  created_at: string;
};

