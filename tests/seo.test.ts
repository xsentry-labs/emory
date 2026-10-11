import { describe, expect, it } from "vitest";
import { openDb } from "../lib/db";
import { saveProfile } from "../lib/repo";
import type { RawPage } from "../lib/safeFetch";
import { fetchRaw } from "../lib/safeFetch";
import { latestAudit, runAudit, startAudit } from "../lib/seo/audit";
import { analysePage, runChecks, scoreSite } from "../lib/seo/checks";
import { crawlSite } from "../lib/seo/crawl";

const GOOD = (title: string, body = "word ".repeat(250), extra = "") => `<!doctype html><html lang="en"><head>
<title>${title}</title><meta name="description" content="${"A clear useful description of this page that runs to a sensible length. ".repeat(2)}">
<meta name="viewport" content="width=device-width"><link rel="canonical" href="https://acme.co/">
<meta property="og:title" content="x"><meta property="og:image" content="y">
<script type="application/ld+json">{"@type":"Organization"}</script></head>
<body><h1>${title}</h1><p>${body}</p>${extra}</body></html>`;

const BAD = `<html><head></head><body><p>hi</p><img src="a.png"><img src="b.png" alt=""></body></html>`;

function fakeSite(files: Record<string, { status?: number; body: string; type?: string }>) {
  return async (url: string): Promise<RawPage> => {
    const u = new URL(url);
    const key = u.pathname === "" ? "/" : u.pathname;
    const f = files[key];
    if (!f) return { url, status: 404, contentType: "text/html", body: "<html><body>not found</body></html>", ms: 20, redirected: false };
    return { url, status: f.status ?? 200, contentType: f.type ?? "text/html", body: f.body, ms: 40, redirected: false };
  };
}

describe("analysePage", () => {
  it("extracts SEO fields from a good page", () => {
    const p = analysePage(GOOD("Acme SEO", "word ".repeat(300), '<a href="/about">About</a><a href="https://other.com/x">x</a><img src="a.png" alt="logo">'), "https://acme.co/", {
      status: 200,
      ms: 50,
      redirected: false,
    });
    expect(p).toMatchObject({ title: "Acme SEO", h1: ["Acme SEO"], canonical: "https://acme.co/", lang: "en", viewport: true, ogTitle: true, ogImage: true, jsonLd: true, noindex: false });
    expect(p.words).toBeGreaterThan(290);
    expect(p.links).toEqual(["https://acme.co/about"]);
    expect(p.imagesTotal).toBe(1);
    expect(p.imagesNoAlt).toBe(0);
  });

  it("flags a bare page", () => {
    const p = analysePage(BAD, "https://acme.co/x", { status: 200, ms: 50, redirected: false });
    expect(p).toMatchObject({ title: "", description: "", h1: [], viewport: false, jsonLd: false, imagesTotal: 2, imagesNoAlt: 2 });
  });
});

describe("runChecks and scoreSite", () => {
  const ok = { https: true, robotsTxt: "ok" as const, sitemap: true };

  it("finds nothing wrong on a healthy site and scores it high", () => {
    const pages = [analysePage(GOOD("Acme SEO services"), "https://acme.co/", { status: 200, ms: 100, redirected: false })];
    const issues = runChecks(pages, ok);
    expect(issues.filter((i) => i.severity !== "low")).toEqual([]);
    expect(scoreSite(issues, pages.length)).toBeGreaterThanOrEqual(90);
  });

  it("reports the expected problems on a bad site, with severities", () => {
    const pages = [
      analysePage(BAD, "https://acme.co/", { status: 200, ms: 2000, redirected: false }),
      analysePage(BAD, "https://acme.co/a", { status: 200, ms: 100, redirected: false }),
      analysePage("", "https://acme.co/gone", { status: 404, ms: 100, redirected: false }),
    ];
    const issues = runChecks(pages, { https: false, robotsTxt: "blocks-all", sitemap: false });
    const byId = Object.fromEntries(issues.map((i) => [i.id, i]));
    for (const id of ["not-https", "robots-blocks", "broken", "no-title", "no-description", "no-h1", "no-viewport"]) {
      expect(byId[id]?.severity, id).toBe("high");
    }
    for (const id of ["sitemap-missing", "thin", "img-alt", "no-schema"]) expect(byId[id]?.severity, id).toBe("medium");
    expect(byId["no-title"].count).toBe(2);
    expect(byId.broken.pages[0]).toContain("404");
    expect(byId.slow.pages).toHaveLength(1);
    expect(scoreSite(issues, pages.length)).toBeLessThan(40);
  });

  it("detects duplicate titles and descriptions across pages", () => {
    const a = analysePage(GOOD("Same title"), "https://acme.co/a", { status: 200, ms: 10, redirected: false });
    const b = analysePage(GOOD("Same title"), "https://acme.co/b", { status: 200, ms: 10, redirected: false });
    const ids = runChecks([a, b], { https: true, robotsTxt: "ok", sitemap: true }).map((i) => i.id);
    expect(ids).toContain("dup-title");
    expect(ids).toContain("dup-description");
  });
});

describe("crawlSite", () => {
  const files = {
    "/": { body: GOOD("Home", undefined, '<a href="/about">a</a><a href="/missing">m</a><a href="/file.pdf">p</a>') },
    "/about": { body: GOOD("About us", undefined, '<a href="/team">t</a>') },
    "/team": { body: GOOD("Team") },
    "/robots.txt": { body: "User-agent: *\nDisallow: /private\n", type: "text/plain" },
    "/sitemap.xml": { body: '<urlset><url><loc>https://acme.co/hidden</loc></url></urlset>', type: "application/xml" },
    "/hidden": { body: GOOD("Hidden page") },
  };

  it("follows links and the sitemap, flags broken links, and skips files", async () => {
    const r = await crawlSite("acme.co", fakeSite(files));
    const urls = r.pages.map((p) => new URL(p.url).pathname).sort();
    expect(urls).toEqual(["/", "/about", "/hidden", "/missing", "/team"]);
    expect(r.pages.find((p) => p.url.endsWith("/missing"))!.status).toBe(404);
    expect(r.site).toEqual({ https: true, robotsTxt: "ok", sitemap: true });
  });

  it("respects the page cap and detects robots/sitemap problems", async () => {
    const r = await crawlSite("https://acme.co", fakeSite({ ...files, "/robots.txt": { body: "User-agent: *\nDisallow: /", type: "text/plain" }, "/sitemap.xml": { body: "nope", type: "text/plain" } }), 2);
    expect(r.pages).toHaveLength(2);
    expect(r.site.robotsTxt).toBe("blocks-all");
    expect(r.site.sitemap).toBe(false);
  });

  it("reports missing robots/sitemap and rejects a bad address", async () => {
    const r = await crawlSite("acme.co", fakeSite({ "/": { body: GOOD("Home") } }));
    expect(r.site).toMatchObject({ robotsTxt: "missing", sitemap: false });
    await expect(crawlSite("", fakeSite({}))).rejects.toThrow(/valid website/);
  });
});

describe("fetchRaw", () => {
  it("refuses internal addresses", async () => {
    await expect(fetchRaw("http://127.0.0.1:9/")).rejects.toThrow(/non-public/);
    await expect(fetchRaw("http://169.254.169.254/")).rejects.toThrow(/non-public/);
  });
});

describe("audits", () => {
  const files = {
    "/": { body: BAD },
    "/robots.txt": { body: "User-agent: *\nAllow: /", type: "text/plain" },
  };
  const llm = (async () => ({
    summary: "Fix the basics.",
    fixes: [
      { priority: 2, title: "Add meta descriptions", page: "Whole site", why: "Snippets.", how: "Write them.", copy: "" },
      { priority: 1, title: "Write a homepage title", page: "https://acme.co/", why: "Ranking.", how: "Set title.", copy: "Acme: SEO for SaaS" },
    ],
  })) as never;

  it("stores a report with findings and an ordered plan", async () => {
    const db = openDb(":memory:");
    saveProfile(db, { offer: "SEO", icp: "SaaS" });
    const id = Number(db.prepare(`INSERT INTO seo_audits (site, status, created_at) VALUES ('acme.co','running',1)`).run().lastInsertRowid);
    await runAudit(db, id, "acme.co", { llm, fetchPage: fakeSite(files) });
    const a = db.prepare(`SELECT status FROM seo_audits WHERE id = ?`).get(id) as { status: string };
    expect(a.status).toBe("done");
    const row = db.prepare(`SELECT report_json FROM seo_audits WHERE id = ?`).get(id) as { report_json: string };
    const report = JSON.parse(row.report_json);
    expect(report.pagesCrawled).toBe(1);
    expect(report.issues.length).toBeGreaterThan(3);
    expect(report.plan.fixes.map((f: { priority: number }) => f.priority)).toEqual([1, 2]);
    expect(report.score).toBeLessThan(60);
  });

  it("still reports findings when the AI plan fails or is off", async () => {
    const db = openDb(":memory:");
    const failing = (() => Promise.reject(new Error("model timeout"))) as never;
    const id1 = Number(db.prepare(`INSERT INTO seo_audits (site, status, created_at) VALUES ('acme.co','running',1)`).run().lastInsertRowid);
    await runAudit(db, id1, "acme.co", { llm: failing, fetchPage: fakeSite(files) });
    const r1 = JSON.parse((db.prepare(`SELECT report_json FROM seo_audits WHERE id = ?`).get(id1) as { report_json: string }).report_json);
    expect(r1.plan).toBeNull();
    expect(r1.planError).toBe("model timeout");
    expect(r1.issues.length).toBeGreaterThan(0);

    const id2 = Number(db.prepare(`INSERT INTO seo_audits (site, status, created_at) VALUES ('acme.co','running',1)`).run().lastInsertRowid);
    await runAudit(db, id2, "acme.co", { llm: null, fetchPage: fakeSite(files) });
    const r2 = JSON.parse((db.prepare(`SELECT report_json FROM seo_audits WHERE id = ?`).get(id2) as { report_json: string }).report_json);
    expect(r2.planError).toMatch(/not configured/);
  });

  it("records an error when the site can't be read, and reports interrupted runs", async () => {
    const db = openDb(":memory:");
    const id = Number(db.prepare(`INSERT INTO seo_audits (site, status, created_at) VALUES ('x','running',1)`).run().lastInsertRowid);
    await runAudit(db, id, "x.invalid", {
      llm: null,
      fetchPage: async () => {
        throw new Error("getaddrinfo ENOTFOUND");
      },
    });
    expect(latestAudit(db)).toMatchObject({ status: "error", error: expect.stringContaining("ENOTFOUND") });

    const db2 = openDb(":memory:");
    db2.prepare(`INSERT INTO seo_audits (site, status, created_at) VALUES ('x','running',1)`).run();
    expect(latestAudit(db2)).toMatchObject({ status: "error", error: expect.stringContaining("restart") });
  });

  it("needs a website, and refuses a second concurrent run", async () => {
    const db = openDb(":memory:");
    expect(() => startAudit(db, { llm: null })).toThrow(/website/);
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    const slow = async (url: string): Promise<RawPage> => {
      await gate;
      return fakeSite(files)(url);
    };
    expect(startAudit(db, { llm: null, fetchPage: slow }, "acme.co")).toBe(true);
    expect(startAudit(db, { llm: null, fetchPage: slow }, "acme.co")).toBe(false);
    expect(latestAudit(db)?.status).toBe("running");
    release();
    for (let i = 0; i < 50 && latestAudit(db)?.status === "running"; i++) await new Promise((r) => setTimeout(r, 20));
    expect(latestAudit(db)?.status).toBe("done");
  });
});
