/**
 * Parse server-supplied timestamps into a Date that the browser can render in
 * local timezone via Date#toLocaleString.
 *
 * - Claw SDK MailDetail.date can be naive local time ("YYYY-MM-DD HH:MM:SS").
 * - SQLite CURRENT_TIMESTAMP is naive UTC ("YYYY-MM-DD HH:MM:SS"), no offset.
 *
 * Naively appending "Z" to the SDK form produced strings like "...000ZZ" that
 * Date can't parse, so the UI used to fall back to the raw string and skip the
 * UTC→local conversion entirely.
 */
export function parseServerTime(value: string, naiveTimezone: "utc" | "local" = "utc"): Date {
  const hasTimezone = /[zZ]$|[+\-]\d{2}:?\d{2}$/.test(value);
  const iso = hasTimezone
    ? value
    : value.replace(" ", "T") + (naiveTimezone === "utc" ? "Z" : "");
  return new Date(iso);
}

export function parseMailTime(value: string): Date {
  return parseServerTime(value, "local");
}
