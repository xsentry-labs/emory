import Link from "next/link";
import { draftWeekOfPosts, removeContentItem, setContentStatus, suggestBlogTopics, writeBlogPost } from "@/app/actions";
import { CopyButton } from "@/components/content/copy-button";
import { PageHead } from "@/components/page-head";
import { SubmitButton } from "@/components/start/form-bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X_LIMIT, listItems } from "@/lib/content";
import { isLlmConfigured } from "@/lib/llm";
import { getDb } from "@/lib/request-db";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TABS = [
  { id: "blog", label: "Blog" },
  { id: "x", label: "X posts" },
] as const;

export default function ContentPage({ searchParams }: { searchParams: { tab?: string; error?: string } }) {
  const tab = searchParams.tab === "x" ? "x" : "blog";
  const db = getDb();
  const ready = isLlmConfigured();

  return (
    <>
      <PageHead
        title="Content"
        standfirst="Drafts that bring buyers to you: blog posts and X posts written from your business, for you to edit and publish."
      />
      <div className="mb-6 flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/content?tab=${t.id}`}
            className={cn("-mb-px border-b-2 px-3 py-2 text-sm", tab === t.id ? "border-ink font-medium text-ink" : "border-transparent text-mute hover:text-ink")}
          >
            {t.label}
          </Link>
        ))}
      </div>
      {searchParams.error ? (
        <p role="alert" className="mb-4 rounded-md border border-danger/30 px-4 py-3 text-sm text-danger">
          {searchParams.error}
        </p>
      ) : null}
      {!ready ? <p className="mb-4 text-sm text-mute">Set OPENROUTER_API_KEY on the server to generate content.</p> : null}

      {tab === "blog" ? <BlogTab ready={ready} /> : <XTab ready={ready} />}
    </>
  );

  function BlogTab({ ready }: { ready: boolean }) {
    const ideas = listItems(db, "blog_idea");
    const posts = listItems(db, "blog");
    return (
      <div className="space-y-10">
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-display text-h3">Topic ideas</h2>
            <form action={suggestBlogTopics}>
              <SubmitButton pendingLabel="Thinking...">Suggest topics</SubmitButton>
            </form>
          </div>
          {ideas.length === 0 ? (
            <p className="text-sm text-mute">No ideas yet. We&apos;ll suggest topics your ideal customers search for.</p>
          ) : (
            <ul className="space-y-3">
              {ideas.map((i) => (
                <li key={i.id} className="card flex flex-wrap items-start justify-between gap-3 p-4">
                  <div className="min-w-60 flex-1">
                    <p className="font-medium">{i.title}</p>
                    <p className="text-sm text-mute">{i.body}</p>
                    {i.meta.keyword ? <p className="mt-1 text-caption text-mute">Targets: {i.meta.keyword}</p> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <form action={writeBlogPost}>
                      <input type="hidden" name="id" value={i.id} />
                      <SubmitButton pendingLabel="Writing (up to a minute)...">Write draft</SubmitButton>
                    </form>
                    <form action={removeContentItem}>
                      <input type="hidden" name="id" value={i.id} />
                      <input type="hidden" name="back" value="blog" />
                      <Button type="submit" variant="ghost" size="sm" aria-label="Dismiss idea">
                        Dismiss
                      </Button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 font-display text-h3">Drafts</h2>
          {posts.length === 0 ? (
            <p className="text-sm text-mute">Write a draft from a topic above.</p>
          ) : (
            <ul className="card divide-y divide-line">
              {posts.map((p) => (
                <li key={p.id}>
                  <Link href={`/content/${p.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-wash">
                    <span className="font-medium">{p.title}</span>
                    <span className="flex items-center gap-2">
                      <span className="tnum text-caption text-mute">{p.body.split(/\s+/).filter(Boolean).length} words</span>
                      <Badge variant={p.status === "done" ? "done" : "default"}>{p.status === "done" ? "Published" : "Draft"}</Badge>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    );
  }

  function XTab({ ready }: { ready: boolean }) {
    const posts = listItems(db, "x_post");
    return (
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-h3">Posts</h2>
          <form action={draftWeekOfPosts}>
            <SubmitButton pendingLabel="Writing...">Draft a week of posts</SubmitButton>
          </form>
        </div>
        <p className="mb-4 text-sm text-mute">
          Copy a post and publish it from your own account. {ready ? "" : "(Generation is off until OPENROUTER_API_KEY is set.)"}
        </p>
        {posts.length === 0 ? (
          <p className="text-sm text-mute">No posts yet.</p>
        ) : (
          <ul className="space-y-3">
            {posts.map((p) => (
              <li key={p.id} className="card space-y-3 p-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{p.title}</Badge>
                  <span className="tnum text-caption text-mute">
                    {p.body.length}/{X_LIMIT}
                  </span>
                  {p.status === "done" ? <Badge variant="done">Posted</Badge> : null}
                </div>
                <p className="whitespace-pre-wrap">{p.body}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <CopyButton text={p.body} />
                  <form action={setContentStatus}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="status" value={p.status === "done" ? "draft" : "done"} />
                    <Button type="submit" variant="ghost" size="sm">
                      {p.status === "done" ? "Mark as not posted" : "Mark as posted"}
                    </Button>
                  </form>
                  <form action={removeContentItem}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="back" value="x" />
                    <Button type="submit" variant="ghost" size="sm">
                      Delete
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }
}
