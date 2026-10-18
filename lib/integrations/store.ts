import type { DB } from "../db";
import { decrypt, encrypt } from "../secrets";

export type Provider = "github" | "google";

export interface StoredConnection<T> {
  provider: Provider;
  config: T;
  status: "connected" | "error";
  error: string;
  updatedAt: number;
}

/** Saves a connection. Fields named in `secret` are encrypted at rest. */
export function saveConnection<T extends Record<string, unknown>>(db: DB, provider: Provider, config: T, secret: (keyof T)[] = []): void {
  const sealed: Record<string, unknown> = { ...config };
  for (const k of secret) if (typeof sealed[k as string] === "string") sealed[k as string] = encrypt(sealed[k as string] as string);
  db.prepare(
    `INSERT INTO connections (provider, config, status, error, updated_at) VALUES (?, ?, 'connected', '', ?)
     ON CONFLICT(provider) DO UPDATE SET config = excluded.config, status = 'connected', error = '', updated_at = excluded.updated_at`,
  ).run(provider, JSON.stringify({ ...sealed, __secret: secret }), Date.now());
}

export function getConnection<T>(db: DB, provider: Provider): StoredConnection<T> | null {
  const r = db.prepare(`SELECT * FROM connections WHERE provider = ?`).get(provider) as
    | { provider: Provider; config: string; status: "connected" | "error"; error: string; updated_at: number }
    | undefined;
  if (!r) return null;
  const raw = JSON.parse(r.config) as Record<string, unknown> & { __secret?: string[] };
  for (const k of raw.__secret ?? []) if (typeof raw[k] === "string") raw[k] = decrypt(raw[k] as string);
  delete raw.__secret;
  return { provider: r.provider, config: raw as T, status: r.status, error: r.error, updatedAt: r.updated_at };
}

/** Merge non-secret fields into an existing connection (e.g. the chosen repo). */
export function updateConnection<T extends Record<string, unknown>>(db: DB, provider: Provider, patch: Partial<T>, secret: (keyof T)[] = []): void {
  const cur = getConnection<T>(db, provider);
  if (!cur) throw new Error("Not connected");
  saveConnection(db, provider, { ...cur.config, ...patch } as T, secret);
}

export function markConnectionError(db: DB, provider: Provider, error: string): void {
  db.prepare(`UPDATE connections SET status = 'error', error = ?, updated_at = ? WHERE provider = ?`).run(error.slice(0, 300), Date.now(), provider);
}

export function removeConnection(db: DB, provider: Provider): void {
  db.prepare(`DELETE FROM connections WHERE provider = ?`).run(provider);
}
