import Link from "next/link";
import { notFound } from "next/navigation";
import { removeContentItem, saveContentItem, setContentStatus } from "@/app/actions";
import { CopyButton } from "@/components/content/copy-button";
import { PageHead } from "@/components/page-head";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getItem } from "@/lib/content";
import { getDb } from "@/lib/request-db";

export const dynamic = "force-dynamic";

export default function BlogPostPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) notFound();
  const post = getItem(getDb(), id);
  if (!post || post.kind !== "blog") notFound();
  const words = post.body.split(/\s+/).filter(Boolean).length;

  return (
    <>
      <PageHead
        title="Edit draft"
        standfirst="Edit the article, then copy it into your site's editor. Markdown works in most blogging tools."
        actions={
          <Link href="/content?tab=blog" className="text-sm text-mute underline">
            Back to content
          </Link>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-mute">
        <Badge variant={post.status === "done" ? "done" : "default"}>{post.status === "done" ? "Published" : "Draft"}</Badge>
        <span className="tnum">{words} words</span>
        {post.meta.keyword ? <span>Targets: {post.meta.keyword}</span> : null}
      </div>

      <form action={saveContentItem} className="card max-w-3xl space-y-4 p-5">
        <input type="hidden" name="id" value={post.id} />
        <div className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" defaultValue={post.title} maxLength={300} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="body">Article (Markdown)</Label>
          <Textarea id="body" name="body" defaultValue={post.body} rows={26} maxLength={40000} className="font-mono text-sm" />
        </div>
        <Button type="submit">Save changes</Button>
      </form>

      <div className="mt-6 max-w-3xl space-y-3">
        <div className="card space-y-2 p-4">
          <p className="label">For your SEO fields</p>
          <dl className="space-y-1 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <dt className="text-mute">Meta description:</dt>
              <dd className="flex-1">{post.meta.metaDescription || "-"}</dd>
              {post.meta.metaDescription ? <CopyButton text={post.meta.metaDescription} /> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <dt className="text-mute">URL slug:</dt>
              <dd className="flex-1 font-mono">{post.meta.slug || "-"}</dd>
              {post.meta.slug ? <CopyButton text={post.meta.slug} /> : null}
            </div>
          </dl>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CopyButton text={`# ${post.title}\n\n${post.body}`} label="Copy article" />
          <form action={setContentStatus}>
            <input type="hidden" name="id" value={post.id} />
            <input type="hidden" name="status" value={post.status === "done" ? "draft" : "done"} />
            <Button type="submit" variant="outline" size="sm">
              {post.status === "done" ? "Mark as draft" : "Mark as published"}
            </Button>
          </form>
          <form action={removeContentItem}>
            <input type="hidden" name="id" value={post.id} />
            <input type="hidden" name="back" value="blog" />
            <Button type="submit" variant="danger" size="sm">
              Delete
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
