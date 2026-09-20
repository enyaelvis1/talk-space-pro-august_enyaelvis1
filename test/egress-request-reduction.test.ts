import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { createPublicReadCache } from "../src/lib/public-read-cache.ts";
import { startVisiblePolling } from "../src/lib/visible-polling.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

test("20 simultaneous public reads perform one load and expire after 60 seconds", async () => {
  let now = 0;
  let calls = 0;
  const cache = createPublicReadCache<string>(60_000, () => now);
  const load = async () => {
    calls++;
    return "published";
  };
  const values = await Promise.all(Array.from({ length: 20 }, () => cache.get(load)));
  assert.deepEqual(new Set(values), new Set(["published"]));
  assert.equal(calls, 1);
  now = 59_999;
  await cache.get(load);
  assert.equal(calls, 1);
  now = 60_000;
  await cache.get(load);
  assert.equal(calls, 2);
});

test("failed public reads are not cached and the next request can recover", async () => {
  const cache = createPublicReadCache<string>(60_000);
  let calls = 0;
  const fail = async () => {
    calls++;
    throw new Error("quota unavailable");
  };
  const results = await Promise.allSettled([cache.get(fail), cache.get(fail)]);
  assert.equal(calls, 1);
  assert.ok(results.every((result) => result.status === "rejected"));
  assert.equal(cache.peek(), undefined);
  assert.equal(await cache.get(async () => "recovered"), "recovered");
});

test("publishing during a pending read prevents old data repopulating the cache", async () => {
  const cache = createPublicReadCache<string>(60_000);
  let resolveOld!: (value: string) => void;
  const old = cache.get(
    () =>
      new Promise<string>((resolve) => {
        resolveOld = resolve;
      }),
  );
  await settle();
  cache.clear();
  assert.equal(await cache.get(async () => "new image"), "new image");
  resolveOld("old image");
  await old;
  assert.equal(cache.peek(), "new image");
  assert.equal(await cache.get(async () => "unexpected load"), "new image");
});

test("cache invalidation cannot let an old finalizer discard a newer pending request", async () => {
  const cache = createPublicReadCache<string>(60_000);
  let resolveOld!: (value: string) => void;
  let resolveNew!: (value: string) => void;
  const old = cache.get(
    () =>
      new Promise<string>((resolve) => {
        resolveOld = resolve;
      }),
  );
  await settle();
  cache.clear();
  const next = cache.get(
    () =>
      new Promise<string>((resolve) => {
        resolveNew = resolve;
      }),
  );
  await settle();
  resolveOld("old");
  await old;
  assert.equal(
    cache.get(async () => "duplicate"),
    next,
  );
  resolveNew("new");
  await next;
});

test("background polling pauses when hidden, coalesces resume and stops on cleanup", async () => {
  const doc = Object.assign(new EventTarget(), { hidden: false });
  const timers = new Map<number, () => void>();
  let timerId = 0;
  let calls = 0;
  let finish!: () => void;
  const stop = startVisiblePolling(
    () => {
      calls++;
      return new Promise<void>((resolve) => {
        finish = resolve;
      });
    },
    30_000,
    {
      document: doc,
      setTimeout: (callback) => {
        timers.set(++timerId, callback);
        return timerId;
      },
      clearTimeout: (id) => {
        timers.delete(id);
      },
    },
  );
  assert.equal(timers.size, 1);
  doc.hidden = true;
  doc.dispatchEvent(new Event("visibilitychange"));
  assert.equal(timers.size, 0);
  assert.equal(calls, 0);
  doc.hidden = false;
  doc.dispatchEvent(new Event("visibilitychange"));
  doc.dispatchEvent(new Event("visibilitychange"));
  assert.equal(calls, 1);
  assert.equal(timers.size, 0);
  finish();
  await settle();
  assert.equal(timers.size, 1);
  const tick = [...timers.values()][0];
  tick();
  assert.equal(calls, 2);
  stop();
  finish();
  await settle();
  doc.dispatchEvent(new Event("visibilitychange"));
  assert.equal(timers.size, 0);
  assert.equal(calls, 2);
});

test("actual browser auth helper makes no Auth request for anonymous visits", async () => {
  const source = ts
    .transpileModule(read("src/lib/auth.ts"), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    })
    .outputText.replace(/^import .*?;\s*$/gm, "");
  const prelude = `
    const getSupabaseBrowserClient = () => globalThis.__egressAuthClient;
    const isSupabaseConfigured = true;
    const hasProgressAccess = () => false;
    const redirect = (value) => value;
  `;
  const auth = await import(
    `data:text/javascript;base64,${Buffer.from(prelude + source).toString("base64")}`
  );
  const calls = { user: 0, logout: 0 };
  let session: unknown = null;
  const globals = globalThis as typeof globalThis & { __egressAuthClient?: unknown };
  globals.__egressAuthClient = {
    auth: {
      getSession: async () => ({ data: { session } }),
      getUser: async () => {
        calls.user++;
        return { data: { user: { id: "user" } }, error: null };
      },
      signOut: async () => {
        calls.logout++;
      },
    },
  };
  try {
    for (let i = 0; i < 20; i++) assert.equal(await auth.getVerifiedBrowserSession(), null);
    assert.deepEqual(calls, { user: 0, logout: 0 });
    session = {
      expires_at: Date.now() / 1000 + 3600,
      user: { id: "user", last_sign_in_at: new Date().toISOString() },
    };
    assert.equal(await auth.getVerifiedBrowserSession(), session);
    assert.equal(calls.user, 1);
    session = { expires_at: Date.now() / 1000 - 10, user: { id: "user" } };
    assert.equal(await auth.getVerifiedBrowserSession(), null);
    assert.deepEqual(calls, { user: 1, logout: 1 });
  } finally {
    delete globals.__egressAuthClient;
  }
});

test("shell reuses root details and only public reads use the bounded cache", () => {
  for (const path of ["src/components/site/SiteHeader.tsx", "src/components/site/SiteFooter.tsx"]) {
    const source = read(path);
    assert.match(source, /from: "__root__"/);
    assert.doesNotMatch(source, /getPublicSiteDetails/);
  }
  const admin = read("src/lib/admin.functions.ts");
  for (const name of ["updateAdminSiteDetails", "updateAdminFooterSettings"]) {
    const mutation = admin.slice(admin.indexOf(`export const ${name}`)).split("export const ")[1];
    assert.match(mutation, /if \(error\) throw error;\s*clearPublicSiteSettingsCache\(\)/);
  }
  for (const path of [
    "src/lib/auth.ts",
    "src/lib/booking.functions.ts",
    "src/lib/payments.functions.ts",
    "src/lib/therapist.functions.ts",
  ]) {
    assert.doesNotMatch(read(path), /createPublicReadCache/);
  }
});
