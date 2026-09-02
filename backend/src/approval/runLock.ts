const locks = new Map<string, Promise<unknown>>();

/**
 * Serializes read-modify-write sequences (load run -> mutate -> save run)
 * per run id, within this process. The run store is a JSON file per run
 * with no database-level locking, so two concurrent requests against the
 * same run (e.g. approving two suggestions at once) could otherwise both
 * load the same on-disk state and the second save would silently discard
 * the first's change. Railway runs this as a single instance, so a
 * per-process lock is sufficient here; a multi-instance deploy would need a
 * real database with row-level locking instead (see ARCHITECTURE.md).
 */
export function withRunLock<T>(runId: string, fn: () => Promise<T>): Promise<T> {
  const previous = locks.get(runId) ?? Promise.resolve();
  const next = previous.then(fn, fn);
  // Keep the chain alive even if `fn` rejects, so the next caller isn't stuck
  // waiting on a permanently-rejected promise.
  locks.set(
    runId,
    next.catch(() => undefined),
  );
  return next;
}
