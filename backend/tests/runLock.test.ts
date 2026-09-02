import { describe, it, expect } from "vitest";
import { withRunLock } from "../src/approval/runLock.js";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("withRunLock", () => {
  it("serializes concurrent calls for the same run id", async () => {
    const order: number[] = [];
    const a = withRunLock("run-1", async () => {
      order.push(1);
      await delay(20);
      order.push(2);
    });
    const b = withRunLock("run-1", async () => {
      order.push(3);
    });
    await Promise.all([a, b]);
    // b must not start (push 3) until a's whole body (1, then 2) finished.
    expect(order).toEqual([1, 2, 3]);
  });

  it("does not serialize calls for different run ids", async () => {
    const order: string[] = [];
    const a = withRunLock("run-a", async () => {
      await delay(20);
      order.push("a");
    });
    const b = withRunLock("run-b", async () => {
      order.push("b");
    });
    await Promise.all([a, b]);
    // b (no delay) should finish before a (delayed) since they're different locks.
    expect(order).toEqual(["b", "a"]);
  });

  it("returns the wrapped function's value", async () => {
    const result = await withRunLock("run-2", async () => 42);
    expect(result).toBe(42);
  });

  it("propagates a rejection but does not deadlock the next caller", async () => {
    await expect(
      withRunLock("run-3", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    // A failed call must not leave the lock permanently held.
    const result = await withRunLock("run-3", async () => "recovered");
    expect(result).toBe("recovered");
  });
});
