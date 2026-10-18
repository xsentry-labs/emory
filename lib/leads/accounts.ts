import type { DB } from "../db";
import type { Prospect } from "../types";

export type AccountStatus = "new" | "mapped" | "approaching" | "in_conversation" | "dropped";

export interface Account {
  id: number;
  name: string;
  domain: string;
  website: string;
  industry: string;
  employees: number | null;
  location: string;
  description: string;
  linkedin_url: string;
  apollo_id: string;
  fit: number | null;
  fit_reason: string;
  status: AccountStatus;
  source: string;
  created_at: number;
  updated_at: number;
}

export interface AccountRow extends Account {
  people: number;
  emails: number;
}

export function listAccounts(db: DB, opts: { includeDropped?: boolean } = {}): AccountRow[] {
  return db
    .prepare(
      `SELECT a.*,
         (SELECT COUNT(*) FROM prospects p WHERE p.account_id = a.id) AS people,
         (SELECT COUNT(*) FROM prospects p WHERE p.account_id = a.id AND p.email_status IN ('verified','manual')) AS emails
       FROM accounts a ${opts.includeDropped ? "" : "WHERE a.status <> 'dropped'"}
       ORDER BY a.status = 'dropped', a.fit IS NULL, a.fit DESC, a.id DESC`,
    )
    .all() as AccountRow[];
}

export const getAccount = (db: DB, id: number): Account | undefined => db.prepare(`SELECT * FROM accounts WHERE id = ?`).get(id) as Account | undefined;

export const accountPeople = (db: DB, accountId: number): Prospect[] =>
  db.prepare(`SELECT * FROM prospects WHERE account_id = ? ORDER BY id`).all(accountId) as Prospect[];

export function setAccountStatus(db: DB, id: number, status: AccountStatus): void {
  db.prepare(`UPDATE accounts SET status = ?, updated_at = ? WHERE id = ?`).run(status, Date.now(), id);
}

/** A person who replied moves their account into conversation. */
export function syncConversationStatus(db: DB): void {
  db.prepare(
    `UPDATE accounts SET status = 'in_conversation', updated_at = ?
     WHERE status <> 'in_conversation' AND status <> 'dropped'
       AND EXISTS (SELECT 1 FROM prospects p WHERE p.account_id = accounts.id AND p.status IN ('replied','meeting','won'))`,
  ).run(Date.now());
}
