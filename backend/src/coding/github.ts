import { Octokit } from "@octokit/rest";
import { config } from "../config.js";
import type { AuditRun } from "../types.js";
import type { GeneratedFile } from "./agent.js";

export interface OpenPrInput {
  owner?: string;
  repo?: string;
  baseBranch?: string;
}

/**
 * Creates a branch, commits the generated fix files, and opens a PR against
 * the configured GitHub repo. Uses the low-level git data API (not
 * `createOrUpdateFile` per file) so N files land in a single commit instead
 * of N commits.
 */
export async function openFixPr(run: AuditRun, files: GeneratedFile[], input: OpenPrInput = {}): Promise<string> {
  if (!config.githubToken) {
    throw new Error("GITHUB_TOKEN is not set; cannot open a PR. Use the local patch output instead.");
  }
  const owner = input.owner || config.githubDefaultOwner;
  const repo = input.repo || config.githubDefaultRepo;
  if (!owner || !repo) {
    throw new Error("No GitHub owner/repo configured (GITHUB_DEFAULT_OWNER/GITHUB_DEFAULT_REPO or per-request owner/repo).");
  }

  const octokit = new Octokit({ auth: config.githubToken });

  const repoInfo = await octokit.repos.get({ owner, repo });
  const baseBranch = input.baseBranch || repoInfo.data.default_branch;

  const baseRef = await octokit.git.getRef({ owner, repo, ref: `heads/${baseBranch}` });
  const baseCommitSha = baseRef.data.object.sha;
  const baseCommit = await octokit.git.getCommit({ owner, repo, commit_sha: baseCommitSha });

  const blobs = await Promise.all(
    files.map(async (f) => {
      const blob = await octokit.git.createBlob({ owner, repo, content: f.content, encoding: "utf-8" });
      return { path: f.path, sha: blob.data.sha };
    }),
  );

  const tree = await octokit.git.createTree({
    owner,
    repo,
    base_tree: baseCommit.data.tree.sha,
    tree: blobs.map((b) => ({ path: b.path, mode: "100644" as const, type: "blob" as const, sha: b.sha })),
  });

  const commit = await octokit.git.createCommit({
    owner,
    repo,
    message: `Apply ${files.length} approved SEO/GEO fix(es) from Emory Audit run ${run.id}`,
    tree: tree.data.sha,
    parents: [baseCommitSha],
  });

  const branch = `emory-audit/${run.id}`;
  await octokit.git
    .createRef({ owner, repo, ref: `refs/heads/${branch}`, sha: commit.data.sha })
    .catch(async () => {
      // branch already exists (retry) — move it to the new commit
      await octokit.git.updateRef({ owner, repo, ref: `heads/${branch}`, sha: commit.data.sha, force: true });
    });

  const approved = run.suggestions.filter((s) => s.status === "approved");
  const body = [
    `Approved suggestions from [Emory Audit](https://github.com/xsentry-labs/emory) run \`${run.id}\` on ${run.url}.`,
    "",
    ...approved.map((s) => `- **[${s.priority}]** ${s.title}`),
    "",
    "Each fix has its own file under `seo-fixes/` with the evidence, the exact change, and where it belongs. Nothing outside those files was touched.",
  ].join("\n");

  const pr = await octokit.pulls.create({
    owner,
    repo,
    title: `Emory Audit: ${approved.length} approved SEO/GEO fix(es)`,
    head: branch,
    base: baseBranch,
    body,
  });

  return pr.data.html_url;
}
