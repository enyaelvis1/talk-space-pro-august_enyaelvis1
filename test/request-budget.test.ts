import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyRequest,
  createRequestBudgetReport,
  findRequestBudgetViolations,
} from "../src/lib/request-budget.ts";

test("request budget categorizes Supabase traffic and totals bytes", () => {
  const report = createRequestBudgetReport([
    { url: "https://fixture.test/auth/v1/token", status: 401, bytes: 30 },
    { url: "https://fixture.test/rest/v1/site_settings", status: 200, bytes: 120 },
    { url: "https://fixture.test/storage/v1/object/public/media", status: 200, bytes: 500 },
    { url: "https://app.test/_serverFn/content", status: 200, bytes: 80 },
  ]);

  assert.equal(classifyRequest("https://fixture.test/realtime/v1/websocket"), "realtime");
  assert.equal(report.total.requests, 4);
  assert.equal(report.total.bytes, 730);
  assert.equal(report.byCategory.auth.failedResponses, 1);
  assert.equal(report.byCategory.database.responses, 1);
  assert.equal(report.byCategory.serverFunction.requests, 1);
});

test("request budget reports request and byte regressions", () => {
  const report = createRequestBudgetReport([
    { url: "https://fixture.test/rest/v1/site_settings", status: 200, bytes: 120 },
    { url: "https://fixture.test/rest/v1/site_settings", status: 200, bytes: 80 },
  ]);

  assert.deepEqual(
    findRequestBudgetViolations(report, { database: { maxRequests: 1, maxBytes: 150 } }),
    ["database requests 2 > 1", "database bytes 200 > 150"],
  );
});
