export type DiffLine = { kind: "same" | "add" | "del"; text: string; n?: number };

/**
 * Line diff (LCS) trimmed to changed hunks with `context` lines around them.
 * Files here are capped at ~60KB, so the quadratic table stays small.
 */
export function lineDiff(before: string, after: string, context = 3): DiffLine[][] {
  const a = before.split("\n");
  const b = after.split("\n");
  // Strip the common head and tail first; most fixes touch a few lines.
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  const am = a.slice(head, a.length - tail);
  const bm = b.slice(head, b.length - tail);

  const dp: number[][] = Array.from({ length: am.length + 1 }, () => new Array(bm.length + 1).fill(0));
  for (let i = am.length - 1; i >= 0; i--)
    for (let j = bm.length - 1; j >= 0; j--) dp[i][j] = am[i] === bm[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);

  const lines: DiffLine[] = a.slice(0, head).map((text, i) => ({ kind: "same", text, n: i + 1 }));
  let i = 0;
  let j = 0;
  while (i < am.length || j < bm.length) {
    if (i < am.length && j < bm.length && am[i] === bm[j]) {
      lines.push({ kind: "same", text: am[i], n: head + j + 1 });
      i++;
      j++;
    } else if (i < am.length && (j >= bm.length || dp[i + 1][j] >= dp[i][j + 1])) {
      // Removals before additions, as in a unified diff.
      lines.push({ kind: "del", text: am[i] });
      i++;
    } else {
      lines.push({ kind: "add", text: bm[j], n: head + j + 1 });
      j++;
    }
  }
  b.slice(b.length - tail).forEach((text, k) => lines.push({ kind: "same", text, n: b.length - tail + k + 1 }));

  // Keep only changed lines plus context, split into hunks.
  const keep = lines.map(() => false);
  lines.forEach((l, k) => {
    if (l.kind !== "same") for (let x = Math.max(0, k - context); x <= Math.min(lines.length - 1, k + context); x++) keep[x] = true;
  });
  const hunks: DiffLine[][] = [];
  let cur: DiffLine[] | null = null;
  lines.forEach((l, k) => {
    if (keep[k]) {
      cur ??= [];
      cur.push(l);
    } else if (cur) {
      hunks.push(cur);
      cur = null;
    }
  });
  if (cur) hunks.push(cur);
  return hunks;
}
