const hits = new Map<string, { count: number; resetAt: number }>();

/** Fixed-window in-memory limiter (single-process deployment). Returns false when over the limit. */
export function allow(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const entry = hits.get(key);
  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    if (hits.size > 5000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    return true;
  }
  entry.count++;
  return entry.count <= limit;
}

export const resetRateLimits = () => hits.clear();
