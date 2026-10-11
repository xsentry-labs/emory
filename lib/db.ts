import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { dataDir } from "./env";

export type DB = Database.Database;

// Ordered, append-only. Each entry runs once; index+1 is stored in user_version.
const MIGRATIONS: string[] = [
  `
  CREATE TABLE prospects (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    company TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    website TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'new'
      CHECK (status IN ('new','researching','qualified','contacted','replied','meeting','won','lost')),
    source TEXT NOT NULL DEFAULT '',
    icp_fit INTEGER CHECK (icp_fit BETWEEN 0 AND 3),
    bant_budget INTEGER CHECK (bant_budget BETWEEN 0 AND 3),
    bant_authority INTEGER CHECK (bant_authority BETWEEN 0 AND 3),
    bant_need INTEGER CHECK (bant_need BETWEEN 0 AND 3),
    bant_timing INTEGER CHECK (bant_timing BETWEEN 0 AND 3),
    score INTEGER,
    next_followup_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    offer TEXT NOT NULL DEFAULT '',
    icp TEXT NOT NULL DEFAULT ''
  );
  INSERT INTO profile (id) VALUES (1);
  CREATE TABLE messages (
    id INTEGER PRIMARY KEY,
    prospect_id INTEGER NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN ('outbound','inbound')),
    kind TEXT NOT NULL CHECK (kind IN ('outreach','followup','reply')),
    subject TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL,
    status TEXT NOT NULL
      CHECK (status IN ('draft','approved','rejected','sent','received')),
    created_at INTEGER NOT NULL,
    decided_at INTEGER,
    sent_at INTEGER
  );
  CREATE INDEX messages_prospect ON messages(prospect_id, created_at);
  CREATE INDEX messages_status ON messages(status);
  CREATE INDEX prospects_score ON prospects(score);
  CREATE INDEX prospects_followup ON prospects(next_followup_at);
  `,
  `
  ALTER TABLE prospects ADD COLUMN research_summary TEXT NOT NULL DEFAULT '';
  ALTER TABLE prospects ADD COLUMN score_rationale TEXT NOT NULL DEFAULT '';
  ALTER TABLE prospects ADD COLUMN researched_at INTEGER;
  `,
  `
  ALTER TABLE messages ADD COLUMN message_id TEXT NOT NULL DEFAULT '';
  ALTER TABLE messages ADD COLUMN send_attempts INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE messages ADD COLUMN send_error TEXT NOT NULL DEFAULT '';
  `,
  `
  CREATE TABLE kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `,
  `
  ALTER TABLE profile ADD COLUMN website TEXT NOT NULL DEFAULT '';
  ALTER TABLE profile ADD COLUMN context TEXT NOT NULL DEFAULT '';
  ALTER TABLE profile ADD COLUMN onboarded_at INTEGER;
  `,
  `
  ALTER TABLE prospects ADD COLUMN source_url TEXT NOT NULL DEFAULT '';
  `,
  `
  ALTER TABLE prospects ADD COLUMN linkedin_url TEXT NOT NULL DEFAULT '';
  `,
];

export function migrate(db: DB): void {
  const current = db.pragma("user_version", { simple: true }) as number;
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[v]);
      db.pragma(`user_version = ${v + 1}`);
    })();
  }
}

export function openDb(file: string): DB {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  migrate(db);
  return db;
}

const g = globalThis as unknown as { __emoryWorkspaceDbs?: Map<number, DB> };

/**
 * One SQLite file per workspace (customer): isolation by construction, so no
 * query can ever read another customer's rows. Handles are cached per process.
 */
export function getWorkspaceDb(workspaceId: number): DB {
  if (!Number.isInteger(workspaceId) || workspaceId < 1) throw new Error("Invalid workspace");
  const cache = (g.__emoryWorkspaceDbs ??= new Map());
  let db = cache.get(workspaceId);
  if (!db) {
    db = openDb(path.join(dataDir(), "workspaces", `${workspaceId}.db`));
    cache.set(workspaceId, db);
  }
  return db;
}
