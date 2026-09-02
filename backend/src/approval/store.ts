import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import type { AuditRun } from "../types.js";

function runsDir(): string {
  return path.join(config.dataDir, "runs");
}

function runPath(id: string): string {
  return path.join(runsDir(), `${id}.json`);
}

async function ensureDir() {
  await mkdir(runsDir(), { recursive: true });
}

export async function saveRun(run: AuditRun): Promise<void> {
  await ensureDir();
  run.updatedAt = new Date().toISOString();
  await writeFile(runPath(run.id), JSON.stringify(run, null, 2), "utf-8");
}

export async function loadRun(id: string): Promise<AuditRun | null> {
  try {
    const raw = await readFile(runPath(id), "utf-8");
    return JSON.parse(raw) as AuditRun;
  } catch {
    return null;
  }
}

export async function listRuns(): Promise<AuditRun[]> {
  await ensureDir();
  const files = await readdir(runsDir());
  const runs = await Promise.all(
    files
      .filter((f) => f.endsWith(".json"))
      .map((f) => readFile(path.join(runsDir(), f), "utf-8").then((raw) => JSON.parse(raw) as AuditRun)),
  );
  return runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
