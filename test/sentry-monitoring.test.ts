import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  clientInstrumentation,
  serverInstrumentation,
  serverEntry,
  startEntry,
  rootRoute,
  routerEntry,
  clientEntry,
  viteConfig,
] = await Promise.all([
  readFile(new URL("../src/instrument.client.ts", import.meta.url), "utf8"),
  readFile(new URL("../instrument.server.mjs", import.meta.url), "utf8"),
  readFile(new URL("../src/server.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/start.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/router.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/client.tsx", import.meta.url), "utf8"),
  readFile(new URL("../vite.config.ts", import.meta.url), "utf8"),
]);

test("Sentry initializes only when DSNs are configured", () => {
  assert.match(clientInstrumentation, /VITE_SENTRY_DSN/);
  assert.match(clientInstrumentation, /typeof window !== "undefined"/);
  assert.match(clientInstrumentation, /Sentry\.init/);
  assert.match(clientInstrumentation, /dataCollection:\s*\{[\s\S]*userInfo:\s*false/);
  assert.match(clientInstrumentation, /httpBodies:\s*\[\]/);
  assert.match(clientInstrumentation, /VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE/);
  assert.match(serverInstrumentation, /process\.env\.SENTRY_DSN/);
  assert.match(serverInstrumentation, /Sentry\.init/);
  assert.match(serverInstrumentation, /SENTRY_TRACES_SAMPLE_RATE/);
  assert.match(serverInstrumentation, /SENTRY_ENABLE_LOGS/);
});

test("Sentry captures server and route boundary errors", () => {
  assert.match(serverEntry, /import "\.\.\/instrument\.server\.mjs"/);
  assert.match(serverEntry, /wrapFetchWithSentry/);
  assert.match(serverEntry, /captureException\(captured/);
  assert.match(serverEntry, /captureException\(error/);
  assert.match(startEntry, /sentryGlobalFunctionMiddleware/);
  assert.match(startEntry, /sentryGlobalRequestMiddleware/);
  assert.match(rootRoute, /captureException\(error/);
  assert.match(rootRoute, /tanstack_router_error_boundary/);
  assert.match(clientEntry, /import "\.\/instrument\.client"/);
  assert.doesNotMatch(routerEntry, /instrument\.client/);
  assert.match(routerEntry, /tanstackRouterBrowserTracingIntegration/);
  assert.match(routerEntry, /!router\.isServer/);
});

test("Sentry source map upload is gated behind build secrets", () => {
  assert.match(viteConfig, /sentryTanstackStart/);
  assert.match(viteConfig, /SENTRY_AUTH_TOKEN/);
  assert.match(viteConfig, /SENTRY_ORG/);
  assert.match(viteConfig, /SENTRY_PROJECT/);
});
