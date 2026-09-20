import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { chromium } from "playwright-core";
import { createServer } from "vite";
import {
  createRequestBudgetReport,
  findRequestBudgetViolations,
  type RequestSample,
} from "../src/lib/request-budget.ts";

const executablePath = [
  process.env.CHROME_PATH,
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].find((path) => path && existsSync(path));

test(
  "public shell shares root details and warm reads against a local Supabase fixture",
  {
    skip: !executablePath,
    timeout: 180_000,
  },
  async () => {
    const counts = new Map<string, number>();
    const fixtureSamples: RequestSample[] = [];
    const requestSamples: RequestSample[] = [];
    const api = createHttpServer((req, res) => {
      const url = new URL(req.url!, "http://localhost");
      const key = url.searchParams.get("key") ?? "";
      const label = `${url.pathname}:${key}`;
      const record = (status: number) => {
        fixtureSamples.push({ url: `http://fixture.local${url.pathname}${url.search}`, status });
      };
      counts.set(label, (counts.get(label) ?? 0) + 1);
      res.setHeader("access-control-allow-origin", "*");
      res.setHeader("access-control-allow-headers", "*");
      res.setHeader("content-type", "application/json");
      if (req.method === "OPTIONS") {
        record(204);
        res.end();
        return;
      }
      if (url.pathname.startsWith("/auth/")) {
        res.statusCode = 401;
        record(401);
        res.end(JSON.stringify({ message: "No test session" }));
        return;
      }
      if (key === "eq.site_details") {
        record(200);
        res.end(
          JSON.stringify([
            { value: { brandName: "Resource Test Practice", logoPath: "/favicon-32x32.png" } },
          ]),
        );
        return;
      }
      if (key === "eq.footer_settings") {
        record(200);
        res.end(JSON.stringify([{ value: { contactAddress: "Synthetic test address" } }]));
        return;
      }
      record(200);
      res.end("[]");
    });
    await new Promise<void>((resolve) => api.listen(0, "127.0.0.1", resolve));
    const address = api.address();
    assert.ok(address && typeof address === "object");
    const apiUrl = `http://127.0.0.1:${address.port}`;
    const env = {
      VITE_SUPABASE_URL: apiUrl,
      SUPABASE_URL: apiUrl,
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_local_fixture",
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_local_fixture",
      SUPABASE_SERVICE_ROLE_KEY: "local_fixture_service_key",
      VITE_SENTRY_DSN: "",
      SENTRY_DSN: "",
      SENTRY_AUTH_TOKEN: "",
    };
    const previous = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
    Object.assign(process.env, env);
    const cacheDir = mkdtempSync(join(tmpdir(), "talkspace-egress-browser-"));
    let server: Awaited<ReturnType<typeof createServer>> | undefined;
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
    try {
      server = await createServer({
        cacheDir,
        server: { host: "127.0.0.1", port: 0 },
        logLevel: "silent",
      });
      await server.listen();
      const appAddress = server.httpServer!.address();
      assert.ok(appAddress && typeof appAddress === "object");
      const origin = `http://127.0.0.1:${appAddress.port}`;
      browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      page.setDefaultTimeout(60_000);
      page.setDefaultNavigationTimeout(60_000);
      const errors: string[] = [];
      const rpcUrls = new Set<string>();
      page.on("request", (request) => {
        if (new URL(request.url()).pathname.startsWith("/_serverFn/")) rpcUrls.add(request.url());
      });
      page.on("response", (response) => {
        const url = new URL(response.url());
        if (![origin, apiUrl].includes(url.origin)) return;
        const bytes = Number(response.headers()["content-length"] ?? 0);
        requestSamples.push({ url: response.url(), status: response.status(), bytes });
      });
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("**/*", (route) => {
        const url = new URL(route.request().url());
        return [origin, apiUrl].includes(url.origin) ? route.continue() : route.abort();
      });
      await page.goto(origin, { waitUntil: "networkidle" });
      await page
        .locator("header")
        .getByRole("link", { name: "Resource Test Practice, home", exact: true })
        .waitFor();
      await page
        .getByText("Synthetic test address", { exact: true })
        .waitFor()
        .catch((error) => {
          throw new Error(
            `${error.message}\n${JSON.stringify({ errors, counts: Object.fromEntries(counts) })}`,
          );
        });
      assert.equal(counts.get("/rest/v1/site_settings:eq.site_details"), 1);
      assert.equal(counts.get("/rest/v1/site_settings:eq.footer_settings"), 1);
      assert.equal(
        [...counts.keys()].some((key) => key.startsWith("/auth/")),
        false,
      );
      const before = Object.fromEntries(counts);
      for (const response of await Promise.all(Array.from({ length: 10 }, () => fetch(origin))))
        assert.equal(response.status, 200);
      assert.deepEqual(Object.fromEntries(counts), before);
      assert.deepEqual(errors, []);
      assert.ok(rpcUrls.size, "Browser must exercise real server functions");
      const requestBudget = createRequestBudgetReport(requestSamples);
      const shellSamples = fixtureSamples.filter((sample) => {
        const url = new URL(sample.url);
        return (
          url.pathname === "/rest/v1/site_settings" &&
          ["eq.site_details", "eq.footer_settings"].includes(url.searchParams.get("key") ?? "")
        );
      });
      const shellBudget = createRequestBudgetReport(shellSamples);
      const requestBudgetViolations = findRequestBudgetViolations(shellBudget, {
        auth: { maxRequests: 0 },
        database: { maxRequests: 2 },
        storage: { maxRequests: 0 },
        realtime: { maxRequests: 0 },
      });
      assert.deepEqual(requestBudgetViolations, []);
      const rpcUrl = [...rpcUrls][0];
      const csrfResults: Record<string, number> = {};
      for (const [name, headers, expected] of [
        ["same-origin metadata", { "sec-fetch-site": "same-origin" }, 200],
        ["same-origin header", { origin }, 200],
        ["same-origin referer", { referer: `${origin}/` }, 200],
        ["cross-site metadata", { "sec-fetch-site": "cross-site", origin }, 403],
        ["same-site subdomain", { "sec-fetch-site": "same-site" }, 403],
        ["foreign origin", { origin: "https://foreign.example" }, 403],
        ["foreign referer", { referer: `${origin}.foreign.example/` }, 403],
        ["missing origin metadata", {}, 403],
      ] as const) {
        const response = await fetch(rpcUrl, { headers: { ...headers, "x-tsr-serverFn": "true" } });
        csrfResults[name] = response.status;
        assert.equal(response.status, expected, name);
      }
      const forbiddenPost = await fetch(rpcUrl, {
        method: "POST",
        headers: { origin: "https://foreign.example", "content-type": "application/json" },
        body: "{}",
      });
      assert.equal(forbiddenPost.status, 403);
      const webhook = await fetch(`${origin}/api/public/paystack-webhook`, { method: "POST" });
      assert.equal(webhook.status, 401);
      assert.equal(await webhook.text(), "missing_signature");
      const callback = await fetch(`${origin}/api/public/google/callback`);
      assert.equal(callback.status, 400);
      assert.match(await callback.text(), /Missing code or state/);
      assert.deepEqual(Object.fromEntries(counts), before, "CSRF rejection must not reach the DB");
      mkdirSync("output/playwright/egress", { recursive: true });
      await page.screenshot({ path: "output/playwright/egress/public-desktop.png" });
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
      );
      await page.getByRole("button", { name: "Open menu" }).click();
      await page
        .getByRole("dialog", { name: "Site navigation" })
        .getByRole("link", { name: "Pricing", exact: true })
        .waitFor();
      await page.waitForFunction(() => {
        const dialog = document.querySelector('[role="dialog"][aria-label="Site navigation"]');
        return dialog && Math.abs(dialog.getBoundingClientRect().right - innerWidth) < 1;
      });
      await page.screenshot({ path: "output/playwright/egress/public-mobile.png" });
      writeFileSync(
        "output/playwright/egress/request-counts.json",
        JSON.stringify(
          {
            fixtureOnly: true,
            warmSsrVisits: 10,
            before,
            after: Object.fromEntries(counts),
            pageErrors: errors,
            csrfResults,
            rejectedCrossOriginPost: forbiddenPost.status,
            unsignedWebhook: webhook.status,
            invalidOAuthCallback: callback.status,
            fixtureRequestBudget: createRequestBudgetReport(fixtureSamples),
            requestBudget,
            shellBudget,
            requestBudgetViolations,
          },
          null,
          2,
        ) + "\n",
      );
    } finally {
      await browser?.close();
      await server?.close();
      await new Promise<void>((resolve) => api.close(() => resolve()));
      rmSync(cacheDir, { recursive: true, force: true });
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  },
);
