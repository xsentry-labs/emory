import { embed } from "../llm/openrouter.js";

export interface DocChunk {
  docName: string;
  text: string;
  embedding: number[];
}

export interface DocStore {
  chunks: DocChunk[];
  truncated: boolean;
  search(query: string, k?: number): Promise<DocChunk[]>;
}

const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 150;
// Bounds on ingestion, so one oversized upload can't blow the embedding
// call's request size or run up unbounded cost: ~50k words/doc, and a cap
// on total chunks embedded across all docs combined.
const MAX_CHARS_PER_DOC = 300_000;
const MAX_TOTAL_CHUNKS = 400;

/**
 * In-memory embedding store for uploaded company docs (brand guidelines,
 * product docs, positioning). Fine at MVP doc volumes (a handful of PDFs);
 * swap for LanceDB/Chroma if corpora grow past a few hundred chunks.
 */
export async function buildDocStore(docs: { name: string; text: string }[]): Promise<DocStore | null> {
  if (!docs.length) return null;

  let truncated = false;
  const rawChunks: { docName: string; text: string }[] = [];
  for (const doc of docs) {
    let text = doc.text;
    if (text.length > MAX_CHARS_PER_DOC) {
      text = text.slice(0, MAX_CHARS_PER_DOC);
      truncated = true;
    }
    for (const chunk of chunkText(text)) {
      rawChunks.push({ docName: doc.name, text: chunk });
    }
  }
  if (!rawChunks.length) return null;

  const bounded = rawChunks.length > MAX_TOTAL_CHUNKS ? rawChunks.slice(0, MAX_TOTAL_CHUNKS) : rawChunks;
  if (bounded.length < rawChunks.length) truncated = true;

  const embeddings = await embed(bounded.map((c) => c.text));
  const chunks: DocChunk[] = bounded.map((c, i) => ({ ...c, embedding: embeddings[i] }));

  return {
    chunks,
    truncated,
    async search(query: string, k = 5) {
      const [queryEmbedding] = await embed([query]);
      return chunks
        .map((c) => ({ chunk: c, score: cosineSimilarity(queryEmbedding, c.embedding) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, k)
        .map((r) => r.chunk);
    },
  };
}

function chunkText(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    const end = Math.min(start + CHUNK_SIZE, clean.length);
    chunks.push(clean.slice(start, end));
    if (end === clean.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return chunks;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-9);
}
