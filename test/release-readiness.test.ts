import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isNavigationPending, routeErrorDetails } from "../src/lib/router-feedback.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("loading feedback covers loaders and pending route commits, then settles", () => {
  assert.equal(isNavigationPending({ isLoading: true, status: "pending" }), true);
  assert.equal(isNavigationPending({ isLoading: true, status: "idle" }), true);
  assert.equal(isNavigationPending({ isLoading: false, status: "pending" }), true);
  assert.equal(isNavigationPending({ isLoading: false, status: "idle" }), false);
});

test("boundary details preserve Error message/stack and Response status without casts", () => {
  const error = new Error("synthetic loader failure");
  assert.deepEqual(routeErrorDetails(error), { message: error.message, stack: error.stack });
  assert.deepEqual(routeErrorDetails(new Response(null, { status: 503 })), {
    message: "Response 503",
  });
  const response = new Response(null, { status: 404 });
  Object.defineProperty(response, "url", { value: "https://example.test/missing" });
  assert.deepEqual(routeErrorDetails(response), {
    message: "Response 404 at https://example.test/missing",
  });
});

test("unknown boundary throws remain renderable without property access", () => {
  for (const value of [null, undefined, "unavailable", 42, { reason: "unknown" }]) {
    assert.deepEqual(routeErrorDetails(value), { message: String(value) });
  }
});

test("both loading surfaces use supported router state and retain bounded recovery", () => {
  const root = read("src/routes/__root.tsx");
  const sidebar = read("src/components/progress/AdminSidebar.tsx");
  for (const source of [root, sidebar]) {
    assert.match(source, /useRouterState\(\{ select: isNavigationPending \}\)/);
    assert.doesNotMatch(source, /state\.isTransitioning/);
    assert.match(source, /aria-live="polite"/);
  }
  assert.match(root, /function ErrorComponent\(\{ error, reset \}: ErrorComponentProps\)/);
  assert.match(root, /routeErrorDetails\(error\)/);
  assert.match(root, /claimAutomaticRouteRetry\(recoveryKey\)/);
});

test("CI runs standalone TypeScript before starting the app or tests", () => {
  const workflow = read(".github/workflows/ci.yml");
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.scripts.typecheck, "tsc --noEmit");
  assert.match(workflow, /- name: TypeScript\s+run: npm run typecheck/);
  assert.ok(workflow.indexOf("run: npm run typecheck") < workflow.indexOf("- name: Test"));
  assert.ok(workflow.indexOf("run: npm run typecheck") < workflow.indexOf("- name: Start app"));
  assert.doesNotMatch(workflow, /continue-on-error/);
});

test("production Zod lock entries are at least the patched 4.6.6 floor", () => {
  const pkg = JSON.parse(read("package.json"));
  const lock = JSON.parse(read("package-lock.json"));
  assert.equal(pkg.dependencies.zod, "^4.6.6");
  assert.equal(lock.packages[""].dependencies.zod, pkg.dependencies.zod);
  const entries = Object.entries(lock.packages).filter(
    ([path, entry]) => /(^|\/)node_modules\/zod$/.test(path) && !(entry as { dev?: boolean }).dev,
  );
  assert.ok(entries.length > 0);
  for (const [path, entry] of entries) {
    const version = (entry as { version: string }).version;
    const [major, minor, patch] = version.split(".").map(Number);
    assert.ok(
      major > 4 || (major === 4 && (minor > 6 || (minor === 6 && patch >= 6))),
      `${path}: ${version}`,
    );
  }
});
