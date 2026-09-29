// Opaque keyset cursors. The timestamp keeps full microsecond precision as text so
// rows created within the same millisecond are neither skipped nor repeated.
export type CursorKey = { ts: string; id: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;

export function encodeCursor(key: CursorKey): string {
  return Buffer.from(`${key.ts}|${key.id}`).toString("base64url");
}

export function decodeCursor(cursor: string | null): CursorKey | null {
  if (!cursor) return null;
  const [ts, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
  if (!ts || !id || !TIMESTAMP.test(ts) || !UUID.test(id)) return null;
  return { ts, id };
}

export const UTC_MICROS = `'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'`;
