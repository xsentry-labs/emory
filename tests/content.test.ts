import { describe, expect, it } from "vitest";
import {
  X_LIMIT,
  addItem,
  deleteItem,
  draftXPosts,
  getItem,
  listItems,
  suggestTopics,
  updateItem,
  writePost,
} from "../lib/content";
import { openDb } from "../lib/db";
import { saveBusiness, saveProfile } from "../lib/repo";

/** Fake LLM that answers by the schema's shape and records what it was asked. */
function fakeLlm(overrides: Record<string, unknown> = {}) {
  const calls: { system: string; user: string }[] = [];
  const llm = ((req: { system: string; user: string; schema: { shape: Record<string, unknown> } }) => {
    calls.push({ system: req.system, user: req.user });
    const keys = Object.keys(req.schema.shape);
    if (keys.includes("ideas"))
      return Promise.resolve(
        overrides.ideas ?? {
          ideas: [
            { title: "How to choose an SEO agency", angle: "A buyer's checklist.", keyword: "choose seo agency" },
            { title: "SEO pricing explained", angle: "What it costs and why.", keyword: "seo pricing" },
            { title: "SEO audit checklist", angle: "Do it yourself.", keyword: "seo audit checklist" },
          ],
        },
      );
    if (keys.includes("body"))
      return Promise.resolve({
        title: "How to choose an SEO agency",
        metaDescription: "A practical checklist for choosing an SEO agency.",
        slug: "How to Choose!! an SEO agency",
        body: "Intro paragraph.\n\n## Step one\nDo this.",
      });
    return Promise.resolve(
      overrides.posts ?? {
        posts: [
          { format: "insight", text: "Most SEO problems are boring: missing titles and thin pages." },
          { format: "question", text: "What is the one page on your site you wish ranked?" },
          { format: "how-to", text: "Check every page has one H1. It takes five minutes." },
        ],
      },
    );
  }) as never;
  return { llm, calls };
}

const setup = () => {
  const db = openDb(":memory:");
  saveProfile(db, { offer: "SEO for SaaS", icp: "Seed-stage SaaS founders" });
  saveBusiness(db, { website: "https://acme.co", context: "We fix titles and speed." });
  return db;
};

describe("content items", () => {
  it("adds, lists newest first, updates and deletes", () => {
    const db = openDb(":memory:");
    const a = addItem(db, { kind: "x_post", title: "insight", body: "one", status: "draft" });
    const b = addItem(db, { kind: "x_post", title: "question", body: "two", status: "draft" });
    addItem(db, { kind: "blog", title: "Other kind", status: "draft" });
    expect(listItems(db, "x_post").map((i) => i.id)).toEqual([b, a]);
    updateItem(db, a, { body: "edited", status: "done" });
    expect(getItem(db, a)).toMatchObject({ body: "edited", title: "insight", status: "done" });
    expect(() => updateItem(db, 999, { body: "x" })).toThrow(/Not found/);
    deleteItem(db, a);
    expect(getItem(db, a)).toBeUndefined();
  });

  it("round-trips meta", () => {
    const db = openDb(":memory:");
    const id = addItem(db, { kind: "blog_idea", title: "t", meta: { keyword: "k" }, status: "idea" });
    expect(getItem(db, id)!.meta).toEqual({ keyword: "k" });
  });
});

describe("suggestTopics", () => {
  it("needs the business described first", async () => {
    await expect(suggestTopics(openDb(":memory:"), fakeLlm().llm)).rejects.toThrow(/Describe your business/);
  });

  it("stores ideas, sends the business context, forbids invented facts, and skips duplicates", async () => {
    const db = setup();
    const { llm, calls } = fakeLlm();
    expect(await suggestTopics(db, llm)).toBe(3);
    expect(calls[0].user).toContain("SEO for SaaS");
    expect(calls[0].user).toContain("We fix titles and speed.");
    expect(calls[0].system).toMatch(/Never invent/);
    expect(listItems(db, "blog_idea").map((i) => i.title)).toContain("SEO pricing explained");
    expect(listItems(db, "blog_idea")[0].meta.keyword).toBeTruthy();
    expect(await suggestTopics(db, llm)).toBe(0);
  });
});

describe("writePost", () => {
  it("turns an idea into a draft post with a clean slug and removes the idea", async () => {
    const db = setup();
    const { llm } = fakeLlm();
    await suggestTopics(db, llm);
    const idea = listItems(db, "blog_idea")[0];
    const postId = await writePost(db, llm, idea.id);
    const post = getItem(db, postId)!;
    expect(post).toMatchObject({ kind: "blog", status: "draft", title: "How to choose an SEO agency" });
    expect(post.meta.slug).toBe("how-to-choose-an-seo-agency");
    expect(post.meta.keyword).toBe(idea.meta.keyword);
    expect(post.body).toContain("## Step one");
    expect(getItem(db, idea.id)).toBeUndefined();
  });

  it("rejects ideas that are gone or not ideas", async () => {
    const db = setup();
    await expect(writePost(db, fakeLlm().llm, 42)).rejects.toThrow(/no longer exists/);
    const blog = addItem(db, { kind: "blog", title: "x", status: "draft" });
    await expect(writePost(db, fakeLlm().llm, blog)).rejects.toThrow(/no longer exists/);
  });
});

describe("draftXPosts", () => {
  it("stores posts within the character limit", async () => {
    const db = setup();
    expect(await draftXPosts(db, fakeLlm().llm)).toBe(3);
    const posts = listItems(db, "x_post");
    expect(posts).toHaveLength(3);
    for (const p of posts) expect(p.body.length).toBeLessThanOrEqual(X_LIMIT);
    expect(posts.map((p) => p.title)).toContain("how-to");
  });

  it("drops any post over the limit and fails if none are usable", async () => {
    const db = setup();
    const long = "x".repeat(X_LIMIT + 1);
    await expect(draftXPosts(db, fakeLlm({ posts: { posts: [{ format: "a", text: long }, { format: "b", text: long }, { format: "c", text: "" }] } }).llm)).rejects.toThrow(/too long/);
    expect(listItems(db, "x_post")).toHaveLength(0);
    const added = await draftXPosts(db, fakeLlm({ posts: { posts: [{ format: "a", text: long }, { format: "b", text: "ok post" }, { format: "c", text: "another" }] } }).llm);
    expect(added).toBe(2);
  });
});
