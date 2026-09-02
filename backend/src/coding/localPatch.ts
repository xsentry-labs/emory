import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import type { GeneratedFile } from "./agent.js";

/** Writes generated fix files to disk when no GitHub repo is configured. */
export async function writeLocalPatch(runId: string, files: GeneratedFile[]): Promise<string> {
  const dir = path.join(config.dataDir, "patches", runId);
  for (const file of files) {
    const full = path.join(dir, file.path);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, file.content, "utf-8");
  }
  return dir;
}
