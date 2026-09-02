import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AuditRun } from "../src/types.js";

const configState = { beaconTargetUrls: [] as string[], beaconReauditCron: "0 3 * * *" };
vi.mock("../src/config.js", () => ({ config: configState }));

const cronValidateMock = vi.fn(() => true);
const cronScheduleMock = vi.fn();
vi.mock("node-cron", () => ({
  validate: (expr: string) => cronValidateMock(expr),
  schedule: (expr: string, fn: () => void) => cronScheduleMock(expr, fn),
}));

const runAuditPipelineMock = vi.fn();
vi.mock("../src/pipeline.js", () => ({
  runAuditPipeline: (input: unknown) => runAuditPipelineMock(input),
}));

const listRunsMock = vi.fn();
const loadRunMock = vi.fn();
vi.mock("../src/approval/store.js", () => ({
  listRuns: () => listRunsMock(),
  loadRun: (id: string) => loadRunMock(id),
}));

const { startReauditScheduler } = await import("../src/scheduler/reaudit.js");

function run(overrides: Partial<AuditRun>): AuditRun {
  return {
    id: "run-1",
    url: "https://example.com/",
    constraints: null,
    docs: [],
    status: "awaiting_approval",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    findings: [],
    suggestions: [],
    modelCalls: [],
    costUsd: 0,
    warnings: [],
    ...overrides,
  };
}

beforeEach(() => {
  configState.beaconTargetUrls = [];
  configState.beaconReauditCron = "0 3 * * *";
  cronValidateMock.mockReset().mockReturnValue(true);
  cronScheduleMock.mockReset();
  runAuditPipelineMock.mockReset();
  listRunsMock.mockReset().mockResolvedValue([]);
  loadRunMock.mockReset();
});

describe("startReauditScheduler", () => {
  it("does nothing when BEACON_TARGET_URLS is empty", () => {
    startReauditScheduler();
    expect(cronScheduleMock).not.toHaveBeenCalled();
  });

  it("does not schedule an invalid cron expression", () => {
    configState.beaconTargetUrls = ["https://example.com/"];
    cronValidateMock.mockReturnValue(false);
    startReauditScheduler();
    expect(cronScheduleMock).not.toHaveBeenCalled();
  });

  it("schedules a cron job when target URLs and a valid cron are configured", () => {
    configState.beaconTargetUrls = ["https://example.com/", "https://other.com/"];
    startReauditScheduler();
    expect(cronScheduleMock).toHaveBeenCalledTimes(1);
    expect(cronScheduleMock.mock.calls[0][0]).toBe("0 3 * * *");
  });

  it("re-audits every configured target sequentially when the schedule fires", async () => {
    configState.beaconTargetUrls = ["https://a.com/", "https://b.com/"];
    runAuditPipelineMock.mockImplementation(async (input: { url: string }) => run({ url: input.url }));

    startReauditScheduler();
    const scheduledFn = cronScheduleMock.mock.calls[0][1] as () => Promise<void>;
    await scheduledFn();
    // give the fire-and-forget .catch chain a tick to settle
    await new Promise((r) => setTimeout(r, 0));

    expect(runAuditPipelineMock).toHaveBeenCalledTimes(2);
    expect(runAuditPipelineMock).toHaveBeenCalledWith({ url: "https://a.com/" });
    expect(runAuditPipelineMock).toHaveBeenCalledWith({ url: "https://b.com/" });
  });

  it("does not stop the batch when one target's audit fails", async () => {
    configState.beaconTargetUrls = ["https://fails.com/", "https://ok.com/"];
    runAuditPipelineMock.mockImplementation(async (input: { url: string }) =>
      input.url.includes("fails") ? run({ url: input.url, status: "failed", error: "boom" }) : run({ url: input.url }),
    );

    startReauditScheduler();
    const scheduledFn = cronScheduleMock.mock.calls[0][1] as () => Promise<void>;
    await scheduledFn();
    await new Promise((r) => setTimeout(r, 0));

    expect(runAuditPipelineMock).toHaveBeenCalledTimes(2);
  });
});
