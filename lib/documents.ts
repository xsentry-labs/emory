import { extractText as pdfText, getDocumentProxy } from "unpdf";
import { htmlToText } from "./safeFetch";

export const MAX_FILES = 5;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_DESCRIPTION_WORDS = 5000;
/** Cap on the document text we hand to the model, per upload. */
export const MAX_DOC_CHARS = 30_000;

export const countWords = (s: string): number => (s.trim().match(/\S+/g) ?? []).length;

const TEXT_EXT = new Set(["txt", "md", "markdown", "csv"]);

export async function extractDocumentText(name: string, data: Uint8Array): Promise<string> {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (data.byteLength > MAX_FILE_BYTES) throw new Error(`${name} is larger than 5 MB.`);
  let text: string;
  if (TEXT_EXT.has(ext)) {
    text = new TextDecoder("utf-8").decode(data);
  } else if (ext === "html" || ext === "htm") {
    text = htmlToText(new TextDecoder("utf-8").decode(data));
  } else if (ext === "pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(data));
    text = (await pdfText(pdf, { mergePages: true })).text;
  } else {
    throw new Error(`${name}: unsupported file type. Upload PDF, TXT, MD, CSV or HTML.`);
  }
  text = text.replace(/\s+\n/g, "\n").trim();
  if (!text) throw new Error(`${name}: no readable text found.`);
  return text.slice(0, MAX_DOC_CHARS);
}

export interface UploadedDoc {
  name: string;
  text: string;
}

/** Read the files from a form submission; empty file inputs are ignored. */
export async function readUploads(files: File[]): Promise<UploadedDoc[]> {
  const real = files.filter((f) => f.size > 0);
  if (real.length > MAX_FILES) throw new Error(`Upload at most ${MAX_FILES} files.`);
  const docs: UploadedDoc[] = [];
  for (const f of real) {
    docs.push({ name: f.name, text: await extractDocumentText(f.name, new Uint8Array(await f.arrayBuffer())) });
  }
  return docs;
}
