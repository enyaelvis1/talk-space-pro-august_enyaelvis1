import assert from "node:assert/strict";
import test from "node:test";

import { createUsageReport } from "../src/lib/usage-budget.ts";

const limits = {
  cachedEgressLimitBytes: 100,
  uncachedEgressLimitBytes: 100,
};

test("usage report classifies current and projected egress independently", () => {
  const report = createUsageReport(
    {
      capturedAt: "2026-09-19T12:00:00.000Z",
      periodStart: "2026-09-01T00:00:00.000Z",
      periodEnd: "2026-10-01T00:00:00.000Z",
      cachedEgressBytes: 50,
      uncachedEgressBytes: 20,
      ...limits,
      apiRequests: 911,
    },
    Date.parse("2026-09-16T00:00:00.000Z"),
  );

  assert.equal(report.cachedEgress.level, "observe");
  assert.equal(report.uncachedEgress.level, "normal");
  assert.equal(report.cachedEgress.projectedLevel, "critical");
  assert.equal(report.highestLevel, "observe");
  assert.equal(report.apiRequests, 911);
});

test("usage report reaches critical at 95 percent and never combines quotas", () => {
  const report = createUsageReport(
    {
      capturedAt: "2026-09-30T00:00:00.000Z",
      periodStart: "2026-09-01T00:00:00.000Z",
      periodEnd: "2026-10-01T00:00:00.000Z",
      cachedEgressBytes: 95,
      uncachedEgressBytes: 0,
      ...limits,
    },
    Date.parse("2026-09-30T00:00:00.000Z"),
  );

  assert.equal(report.cachedEgress.level, "critical");
  assert.equal(report.uncachedEgress.level, "normal");
  assert.equal(report.highestLevel, "critical");
});

test("invalid or zero usage limits fail closed", () => {
  assert.throws(
    () =>
      createUsageReport({
        capturedAt: "2026-09-19T12:00:00.000Z",
        periodStart: "2026-09-01T00:00:00.000Z",
        periodEnd: "2026-10-01T00:00:00.000Z",
        cachedEgressBytes: 1,
        uncachedEgressBytes: 1,
        cachedEgressLimitBytes: 0,
        uncachedEgressLimitBytes: 100,
      }),
    /limits must be greater than zero/,
  );
});
