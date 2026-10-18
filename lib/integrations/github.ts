import { createSign } from "node:crypto";

/**
 * GitHub App client. Emory acts as an installed GitHub App on the customer's
 * repository: it can create a branch, commit file edits and open a pull
 * request. It never merges. Env: GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY (PEM,
 * \n-escaped is fine), GITHUB_APP_SLUG.
 */

export type Fetch = typeof fetch;

export interface GithubAppConfig {
  appId: string;
  privateKey: string;
  slug: string;
}

export function githubAppConfig(env: Record<string, string | undefined> = process.env): GithubAppConfig | null {
  const appId = env.GITHUB_APP_ID?.trim();
  const privateKey = env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  const slug = env.GITHUB_APP_SLUG?.trim();
  return appId && privateKey && slug ? { appId, privateKey, slug } : null;
}

export const installUrl = (cfg: GithubAppConfig, state: string) =>
  `https://github.com/apps/${encodeURIComponent(cfg.slug)}/installations/new?state=${encodeURIComponent(state)}`;

const b64url = (s: string | Buffer) => Buffer.from(s).toString("base64url");

/** A short-lived JWT that authenticates as the App itself. */
export function appJwt(cfg: GithubAppConfig, now = Date.now()): string {
  const iat = Math.floor(now / 1000) - 60;
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64url(JSON.stringify({ iat, exp: iat + 540, iss: cfg.appId }));
  const sig = createSign("RSA-SHA256").update(`${head}.${body}`).sign(cfg.privateKey);
  return `${head}.${body}.${b64url(sig)}`;
}

export class GithubError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function call<T>(f: Fetch, token: string, method: string, path: string, body?: unknown): Promise<T> {
  const res = await f(`https://api.github.com${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "emory",
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let msg = text.slice(0, 200);
    try {
      msg = (JSON.parse(text) as { message?: string }).message ?? msg;
    } catch {
      /* not json */
    }
    throw new GithubError(`GitHub ${method} ${path.split("?")[0]}: ${res.status} ${msg}`, res.status);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

/** An installation access token (valid ~1h), scoped to the repos the customer granted. */
export async function installationToken(cfg: GithubAppConfig, installationId: number, f: Fetch = fetch): Promise<string> {
  const r = await call<{ token: string }>(f, appJwt(cfg), "POST", `/app/installations/${installationId}/access_tokens`);
  return r.token;
}

export interface Repo {
  fullName: string;
  defaultBranch: string;
  private: boolean;
}

export async function listInstallationRepos(token: string, f: Fetch = fetch): Promise<Repo[]> {
  const r = await call<{ repositories: { full_name: string; default_branch: string; private: boolean }[] }>(
    f,
    token,
    "GET",
    "/installation/repositories?per_page=100",
  );
  return r.repositories.map((x) => ({ fullName: x.full_name, defaultBranch: x.default_branch, private: x.private }));
}

const SKIP_DIRS = /(^|\/)(node_modules|\.git|\.next|dist|build|vendor|coverage|\.cache)(\/|$)/;
const TEXT_FILE = /\.(tsx?|jsx?|mjs|cjs|html?|vue|svelte|astro|php|liquid|erb|md|mdx|txt|json|ya?ml|toml|xml|njk|hbs)$|(^|\/)robots\.txt$/i;

/** Files worth showing a model when it looks for where to make a fix. */
export async function listFiles(token: string, repo: string, branch: string, f: Fetch = fetch): Promise<string[]> {
  const r = await call<{ tree: { path: string; type: string; size?: number }[]; truncated: boolean }>(
    f,
    token,
    "GET",
    `/repos/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
  );
  return r.tree
    .filter((t) => t.type === "blob" && !SKIP_DIRS.test(t.path) && TEXT_FILE.test(t.path) && (t.size ?? 0) < 150_000)
    .map((t) => t.path)
    .slice(0, 2000);
}

export async function readFile(token: string, repo: string, path: string, ref: string, f: Fetch = fetch): Promise<{ text: string; sha: string } | null> {
  try {
    const r = await call<{ content: string; sha: string; encoding: string }>(
      f,
      token,
      "GET",
      `/repos/${repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(ref)}`,
    );
    return { text: Buffer.from(r.content, "base64").toString("utf8"), sha: r.sha };
  } catch (err) {
    if (err instanceof GithubError && err.status === 404) return null;
    throw err;
  }
}

export interface FileEdit {
  path: string;
  content: string;
}

/**
 * Open a pull request with the given file edits on a new branch off the
 * default branch. One commit per file. Never merges.
 */
export async function openPullRequest(
  token: string,
  input: { repo: string; base: string; branch: string; title: string; body: string; edits: FileEdit[] },
  f: Fetch = fetch,
): Promise<{ number: number; url: string }> {
  const { repo, base, branch } = input;
  const head = await call<{ object: { sha: string } }>(f, token, "GET", `/repos/${repo}/git/ref/heads/${encodeURIComponent(base)}`);
  await call(f, token, "POST", `/repos/${repo}/git/refs`, { ref: `refs/heads/${branch}`, sha: head.object.sha });
  for (const e of input.edits) {
    const existing = await readFile(token, repo, e.path, branch, f);
    await call(f, token, "PUT", `/repos/${repo}/contents/${e.path.split("/").map(encodeURIComponent).join("/")}`, {
      message: `emory: ${e.path}`,
      content: Buffer.from(e.content, "utf8").toString("base64"),
      branch,
      ...(existing ? { sha: existing.sha } : {}),
    });
  }
  const pr = await call<{ number: number; html_url: string }>(f, token, "POST", `/repos/${repo}/pulls`, {
    title: input.title,
    body: input.body,
    head: branch,
    base,
    maintainer_can_modify: true,
  });
  return { number: pr.number, url: pr.html_url };
}

export interface PrState {
  state: "open" | "merged" | "closed";
  mergedAt: number | null;
  /** e.g. "3 checks passed", "1 check failed", "" when the repo has none. */
  checks: string;
}

export async function pullRequestState(token: string, repo: string, number: number, f: Fetch = fetch): Promise<PrState> {
  const pr = await call<{ state: "open" | "closed"; merged_at: string | null; head: { sha: string } }>(
    f,
    token,
    "GET",
    `/repos/${repo}/pulls/${number}`,
  );
  let checks = "";
  try {
    const runs = await call<{ check_runs: { status: string; conclusion: string | null }[] }>(
      f,
      token,
      "GET",
      `/repos/${repo}/commits/${pr.head.sha}/check-runs?per_page=100`,
    );
    const done = runs.check_runs.filter((c) => c.status === "completed");
    const failed = done.filter((c) => !["success", "neutral", "skipped"].includes(c.conclusion ?? "")).length;
    const pending = runs.check_runs.length - done.length;
    checks = failed
      ? `${failed} check${failed === 1 ? "" : "s"} failed`
      : pending
        ? `${pending} check${pending === 1 ? "" : "s"} running`
        : runs.check_runs.length
          ? `${done.length} check${done.length === 1 ? "" : "s"} passed`
          : "";
  } catch {
    /* checks are informative only */
  }
  const merged = Boolean(pr.merged_at);
  return { state: merged ? "merged" : pr.state, mergedAt: pr.merged_at ? Date.parse(pr.merged_at) : null, checks };
}

/**
 * Prove the person finishing the install can see this installation: the App
 * asks for user authorization during install (a `code` on the callback), and
 * we check the installation is among the user's. Stops someone attaching an
 * installation id they don't own. Env: GITHUB_APP_CLIENT_ID, GITHUB_APP_CLIENT_SECRET.
 */
export async function userCanAccessInstallation(code: string, installationId: number, f: Fetch = fetch, env: Record<string, string | undefined> = process.env): Promise<boolean> {
  const clientId = env.GITHUB_APP_CLIENT_ID?.trim();
  const clientSecret = env.GITHUB_APP_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new Error("Set GITHUB_APP_CLIENT_ID and GITHUB_APP_CLIENT_SECRET.");
  const res = await f("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string };
  if (!body.access_token) return false;
  const list = await call<{ installations: { id: number }[] }>(f, body.access_token, "GET", "/user/installations?per_page=100");
  return list.installations.some((i) => i.id === installationId);
}
