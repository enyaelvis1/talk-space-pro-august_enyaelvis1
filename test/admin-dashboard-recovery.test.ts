import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const read = (path: string) => readFileSync(path, "utf8");

function loadModule(path: string, resolve: (id: string) => unknown) {
  const compiled = ts.transpileModule(read(path), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const exports: Record<string, unknown> = {};
  new Function("require", "exports", compiled)(resolve, exports);
  return exports;
}

function loadHandler(deps: Record<string, unknown>) {
  const source = ts.createSourceFile(
    "admin.ts",
    read("src/lib/admin.functions.ts"),
    ts.ScriptTarget.Latest,
    true,
  );
  let handler: ts.Expression | undefined;
  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(source) === "getAdminOperationsWorkspace"
    ) {
      handler = (node.initializer as ts.CallExpression).arguments[0];
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.ok(handler);
  const compiled = ts.transpileModule(`const fn = ${handler.getText(source)};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  return new Function(...Object.keys(deps), `${compiled}; return fn;`)(...Object.values(deps));
}

for (const failed of ["summary", "queues", "both", "neither"]) {
  test(`operations handler preserves unavailable reads (${failed}) without losing successful sections`, async () => {
    let cookies = 0;
    const summary = { clients: 58, pendingTransfers: 0 };
    const queues = { notificationCount: 0, meetCount: 0, notifications: [], meetSyncs: [] };
    const handler = loadHandler({
      requireAdmin: async () => ({ commitCookies: () => cookies++ }),
      loadAdminDashboardSummary: async () => {
        if (failed === "summary" || failed === "both") throw new Error("synthetic read failure");
        return summary;
      },
      loadAdminFailureQueues: async () => {
        if (failed === "queues" || failed === "both") throw new Error("synthetic read failure");
        return queues;
      },
      console: { error: () => undefined },
    });
    const result = await handler();
    assert.deepEqual(result.summary, failed === "summary" || failed === "both" ? null : summary);
    assert.deepEqual(
      result.failureQueues,
      failed === "queues" || failed === "both" ? null : queues,
    );
    assert.equal(cookies, 1);
  });
}

test("operations handler still rejects an unauthorized caller before reading data", async () => {
  const handler = loadHandler({
    requireAdmin: async () => {
      throw new Error("forbidden");
    },
    loadAdminDashboardSummary: () => assert.fail("must not read"),
    loadAdminFailureQueues: () => assert.fail("must not read"),
  });
  await assert.rejects(handler(), /forbidden/);
});

test("route loader preserves transport and appointment failures as unavailable", async () => {
  type RouteConfig = { loader: () => Promise<Record<string, unknown>> };
  let config: RouteConfig | undefined;
  loadModule("src/routes/_authenticated.admin.index.tsx", (id) => {
    if (id === "react/jsx-runtime") return require(id);
    if (id === "@tanstack/react-router")
      return {
        createFileRoute: () => (value: RouteConfig) => {
          config = value;
          return value;
        },
      };
    if (id.includes("admin.functions"))
      return {
        getAdminOperationsWorkspace: async () => {
          throw new Error("offline");
        },
      };
    if (id.includes("booking.functions"))
      return {
        getAdminAppointmentWorkspace: async () => {
          throw new Error("offline");
        },
      };
    if (id.includes("progress.functions"))
      return {
        getAdminProgressWorkspace: async () => ({
          snapshot: { marker: "preserved" },
          canViewProgress: true,
        }),
      };
    return {};
  });
  assert.ok(config);
  const result = await config.loader();
  assert.equal(result.summary, null);
  assert.equal(result.failureQueues, null);
  assert.equal(result.appointmentsUnavailable, true);
  assert.deepEqual(result.snapshot, { marker: "preserved" });
});

const wrapper = ({ children }: { children?: React.ReactNode }) =>
  React.createElement("div", null, children);
const link = ({ children, to }: { children?: React.ReactNode; to: string }) =>
  React.createElement("a", { href: to }, children);
const { AdminOverview } = loadModule("src/components/progress/AdminOverview.tsx", (id) => {
  if (id === "react" || id === "react/jsx-runtime") return require(id);
  if (id === "@tanstack/react-router")
    return { Link: link, useRouter: () => ({ invalidate: async () => undefined }) };
  if (id === "lucide-react") return new Proxy({}, { get: () => () => null });
  if (id.includes("checklist-progress")) return { statusLabel: (value: string) => value };
  return new Proxy({}, { get: () => wrapper });
});

function render(
  summary: unknown,
  queues: unknown,
  appointmentsUnavailable = false,
  canViewProgress = false,
) {
  return renderToStaticMarkup(
    React.createElement(AdminOverview as React.ComponentType<Record<string, unknown>>, {
      snapshot: {
        summary: {
          total: 200,
          completed: 133,
          partial: 7,
          blocked: 0,
          inProgress: 0,
          notStarted: 60,
          completionPercentage: 68,
        },
        generatedAt: "2026-10-24",
        nextTasks: [],
        milestones: [],
      },
      summary,
      failureQueues: queues,
      appointmentsUnavailable,
      canViewProgress,
      todayAppointments: [],
      upcomingAppointments: [],
    }),
  );
}
const emptyQueues = { notificationCount: 0, meetCount: 0, notifications: [], meetSyncs: [] };
const summary = {
  clients: 58,
  activeTherapists: 6,
  upcomingBookings: 0,
  pendingTransfers: 0,
  pendingForms: 0,
  pendingMessages: 0,
  failedGoogleSyncs: 0,
  posts: 4,
};

test("failed reads render unavailable rather than healthy or empty claims", () => {
  for (const canViewProgress of [false, true]) {
    const html = render(null, null, true, canViewProgress);
    assert.match(html, /Some dashboard data is unavailable/);
    assert.match(html, /Retry dashboard/);
    assert.match(html, /Unavailable/);
    assert.doesNotMatch(
      html,
      /No unresolved notification failures|No unresolved Calendar or Meet failures|No sessions are scheduled|No upcoming sessions after today/,
    );
  }
});

test("successful empty reads remain legitimate zero counts and healthy queues", () => {
  const html = render(summary, emptyQueues);
  assert.match(html, />58</);
  assert.match(html, />0</);
  assert.match(html, /No unresolved notification failures/);
  assert.match(html, /No sessions are scheduled for today/);
  assert.doesNotMatch(html, /Some dashboard data is unavailable|Retry dashboard/);
});

test("partial failure leaves successful summary and queues visible", () => {
  const queuesFailed = render(summary, null);
  assert.match(queuesFailed, />58</);
  assert.match(queuesFailed, /Failure queues are unavailable/);
  const summaryFailed = render(null, emptyQueues);
  assert.match(summaryFailed, /Unavailable/);
  assert.match(summaryFailed, /No unresolved notification failures/);
});

test("retry is user initiated and adds no automatic polling", () => {
  const source = read("src/components/progress/AdminOverview.tsx");
  assert.match(source, /await router\.invalidate\(\)/);
  assert.match(source, /disabled=\{retrying\}/);
  assert.match(source, /onClick=\{\(\) => void retryDashboard\(\)\}/);
  assert.doesNotMatch(source, /setInterval|setTimeout|useEffect/);
});
