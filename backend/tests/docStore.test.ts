import { describe, it, expect, vi } from "vitest";

const embedMock = vi.fn();
vi.mock("../src/llm/openrouter.js", () => ({
  embed: (texts: string[]) => embedMock(texts),
}));

const { buildDocStore } = await import("../src/rag/docStore.js");

/** A unit vector that mostly points along dimension `i`, for predictable cosine similarity. */
function vec(i: number, dims = 4): number[] {
  const v = new Array(dims).fill(0.01);
  v[i] = 1;
  return v;
}

describe("buildDocStore", () => {
  it("returns null for no docs", async () => {
    embedMock.mockReset();
    expect(await buildDocStore([])).toBeNull();
    expect(embedMock).not.toHaveBeenCalled();
  });

  it("returns null when all docs are empty/whitespace", async () => {
    embedMock.mockReset();
    expect(await buildDocStore([{ name: "a", text: "   " }])).toBeNull();
    expect(embedMock).not.toHaveBeenCalled();
  });

  it("chunks and embeds doc text, and search ranks by cosine similarity", async () => {
    embedMock.mockReset();
    // First call: ingestion embeds every chunk. Second call: the query embedding.
    embedMock
      .mockResolvedValueOnce([vec(0), vec(1)])
      .mockResolvedValueOnce([vec(1)]);

    const store = await buildDocStore([
      { name: "brand.txt", text: "a".repeat(1500) }, // > CHUNK_SIZE, so this alone makes 2 chunks
    ]);

    expect(store).not.toBeNull();
    expect(store!.chunks).toHaveLength(2);
    expect(store!.truncated).toBe(false);

    const results = await store!.search("query", 1);
    expect(results).toHaveLength(1);
    // The chunk embedded as vec(1) should rank first against a vec(1) query.
    expect(results[0].embedding).toEqual(vec(1));
  });

  it("marks the store truncated when a single doc exceeds the per-doc character cap", async () => {
    embedMock.mockReset();
    const hugeText = "word ".repeat(70_000); // ~350k chars, over the 300k cap
    embedMock.mockResolvedValue(Array.from({ length: 1000 }, (_, i) => vec(i % 4)));

    const store = await buildDocStore([{ name: "huge.txt", text: hugeText }]);
    expect(store!.truncated).toBe(true);
  });
});
