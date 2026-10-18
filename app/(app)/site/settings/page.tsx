import { chooseRepo, disconnect } from "@/app/site-actions";
import { SubmitButton } from "@/components/start/form-bits";
import { githubAppConfig, installationToken, listInstallationRepos, type Repo } from "@/lib/integrations/github";
import { googleConfig } from "@/lib/integrations/google";
import { getConnection } from "@/lib/integrations/store";
import { getDb } from "@/lib/request-db";
import type { GithubConnection } from "@/lib/site/fixes";
import type { GoogleConnection } from "@/lib/site/results";

export const dynamic = "force-dynamic";

function Row({ name, detail, children }: { name: string; detail: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-1 gap-4 border-t border-dashed border-line py-5 md:grid-cols-[minmax(0,1fr)_auto]">
      <div className="flex flex-col gap-1">
        <h2 className="text-[15px] font-normal">{name}</h2>
        <div className="text-sm">{detail}</div>
      </div>
      <div className="flex flex-wrap items-start gap-2">{children}</div>
    </section>
  );
}

const Dot = ({ ok, children }: { ok: boolean; children: React.ReactNode }) => (
  <span className="inline-flex items-center gap-1.5 font-mono text-xs text-ink">
    {ok ? <span className="size-2 bg-accent" aria-hidden /> : null}
    {children}
  </span>
);

const Disconnect = ({ provider }: { provider: "github" | "google" }) => (
  <form action={disconnect}>
    <input type="hidden" name="provider" value={provider} />
    <button type="submit" className="btn btn-quiet h-9">
      disconnect
    </button>
  </form>
);

export default async function SiteSettingsPage({ searchParams }: { searchParams: { error?: string; connected?: string } }) {
  const db = getDb();
  const gh = getConnection<GithubConnection>(db, "github");
  const google = getConnection<GoogleConnection>(db, "google");
  const ghCfg = githubAppConfig();

  let repos: Repo[] = [];
  let repoError = "";
  if (gh && ghCfg) {
    try {
      repos = await listInstallationRepos(await installationToken(ghCfg, gh.config.installationId));
    } catch (err) {
      repoError = err instanceof Error ? err.message : "Couldn't list repositories.";
    }
  }

  return (
    <div className="flex max-w-[920px] flex-col">
      {searchParams.error ? (
        <p role="alert" className="mb-4 border border-dashed border-danger/60 px-4 py-3 text-sm text-danger">
          {searchParams.error}
        </p>
      ) : null}
      {searchParams.connected ? <p className="mb-4 border border-dashed border-line px-4 py-3 text-sm">saved.</p> : null}

      <Row
        name="github · website source"
        detail={
          !ghCfg ? (
            "the GitHub App isn't configured on this server yet (GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, GITHUB_APP_SLUG, GITHUB_APP_CLIENT_ID, GITHUB_APP_CLIENT_SECRET)."
          ) : !gh ? (
            "install the emory app on the repository your site is built from. code fixes arrive as pull requests; emory never merges."
          ) : (
            <div className="flex flex-col gap-3">
              <Dot ok={gh.status === "connected" && Boolean(gh.config.repo)}>
                {gh.config.repo ? `${gh.config.repo} · ${gh.config.base}` : "installed · pick a repository"}
              </Dot>
              {gh.status === "error" ? <span className="text-danger">{gh.error}</span> : null}
              {repoError ? <span className="text-danger">{repoError}</span> : null}
              {repos.length ? (
                <form action={chooseRepo} className="flex flex-wrap items-center gap-2">
                  <label htmlFor="repo" className="sr-only">
                    Repository
                  </label>
                  <select id="repo" name="repo" defaultValue={gh.config.repo ?? repos[0].fullName} className="h-10 border border-line bg-field px-2 font-mono text-xs text-ink">
                    {repos.map((r) => (
                      <option key={r.fullName} value={r.fullName}>
                        {r.fullName}
                      </option>
                    ))}
                  </select>
                  <SubmitButton pendingLabel="saving…">use this repository</SubmitButton>
                </form>
              ) : null}
            </div>
          )
        }
      >
        {ghCfg ? (
          <a href="/api/connect/github" className={gh ? "btn btn-quiet h-9" : "btn btn-primary"}>
            {gh ? "change access on github" : "connect github"}
          </a>
        ) : null}
        {gh ? <Disconnect provider="github" /> : null}
      </Row>

      <Row
        name="google search console"
        detail={
          !googleConfig() ? (
            "google sign-in isn't configured on this server yet (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APP_URL)."
          ) : !google ? (
            "read-only. lets results show clicks and positions before and after each fix."
          ) : (
            <div className="flex flex-col gap-1">
              <Dot ok={google.status === "connected"}>{google.config.property ?? "connected · finding your property"}</Dot>
              {google.status === "error" ? <span className="text-danger">{google.error}</span> : null}
            </div>
          )
        }
      >
        {googleConfig() ? (
          <a href="/api/connect/google" className={google ? "btn btn-quiet h-9" : "btn btn-primary"}>
            {google ? "reconnect" : "connect search console"}
          </a>
        ) : null}
        {google ? <Disconnect provider="google" /> : null}
      </Row>

      <Row name="cms · wordpress, webflow, shopify" detail="save content fixes as drafts in your cms. coming in the next update; until then each issue has written steps.">
        <span className="font-mono text-xs">coming soon</span>
      </Row>
    </div>
  );
}
