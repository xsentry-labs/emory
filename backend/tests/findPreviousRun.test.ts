import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AuditRun } from "../src/types.js";

const listRunsMock = vi.fn();
const loadRunMock = vi.fn();
vi.mock("../src/approval/store.js", () => ({
  listRuns: () => listRunsMock(),
  loadRun: (id: string) => loadRunMock(id),
}));

const { findPreviousRun } = await import("../src/approval/findPreviousRun.js");

function run(overrides: Partial<AuditRun>): AuditRun {
  return {
    id: "run-1",
    url: "https://example.com",
    constraints: null,
    docs: [],
    status: "awaiting_approval",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    findings: [],
    suggestions: [],
    modelCalls: [],
    costUsd: 0,
    warnings: [],
    ...overrides,
  };
}

beforeEach(() => {
  listRunsMock.mockReset();
  loadRunMock.mockReset();
});

describe("findPreviousRun", () => {
  it("returns null when there is no prior run for the URL", async () => {
    listRunsMock.mockResolvedValue([]);
    const current = run({ id: "run-current" });
    expect(await findPreviousRun(current)).toBeNull();
  });

  it("ignores runs for a different URL", async () => {
    const current = run({ id: "run-current", url: "https://a.com", createdAt: "2026-01-02T00:00:00.000Z" });
    listRunsMock.mockResolvedValue([run({ id: "run-other-url", url: "https://b.com", createdAt: "2026-01-01T00:00:00.000Z" })]);
    expect(await findPreviousRun(current)).toBeNull();
  });

  it("ignores a failed run", async () => {
    const current = run({ id: "run-current", createdAt: "2026-01-02T00:00:00.000Z" });
    listRunsMock.mockResolvedValue([run({ id: "run-failed", status: "failed", createdAt: "2026-01-01T00:00:00.000Z" })]);
    expect(await findPreviousRun(current)).toBeNull();
  });

  it("ignores a run created after the current one", async () => {
    const current = run({ id: "run-current", createdAt: "2026-01-01T00:00:00.000Z" });
    listRunsMock.mockResolvedValue([run({ id: "run-later", createdAt: "2026-01-02T00:00:00.000Z" })]);
    expect(await findPreviousRun(current)).toBeNull();
  });

  it("returns the most recent qualifying prior run, fully loaded", async () => {
    const current = run({ id: "run-current", createdAt: "2026-01-03T00:00:00.000Z" });
    listRunsMock.mockResolvedValue([
      run({ id: "run-oldest", createdAt: "2026-01-01T00:00:00.000Z" }),
      run({ id: "run-newest-prior", createdAt: "2026-01-02T00:00:00.000Z" }),
    ]);
    loadRunMock.mockImplementation(async (id: string) => run({ id }));

    const result = await findPreviousRun(current);
    expect(result?.id).toBe("run-newest-prior");
    expect(loadRunMock).toHaveBeenCalledWith("run-newest-prior");
  });
});
