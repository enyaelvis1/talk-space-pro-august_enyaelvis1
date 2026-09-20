import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("a failed lazy SSR import is not cached permanently", async () => {
  const source = await readFile(new URL("../src/server.ts", import.meta.url), "utf8");

  assert.match(
    source,
    /catch \(error\) \{[\s\S]*serverEntryPromise = undefined;[\s\S]*throw error;/,
  );
});

test("the root shell and site settings loader have resilient fallbacks", async () => {
  const [rootSource, contentSource] = await Promise.all([
    readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/content.functions.ts", import.meta.url), "utf8"),
  ]);

  assert.match(rootSource, /Route\.useLoaderData\(\) \?\? DEFAULT_SITE_DETAILS/);
  assert.match(
    contentSource,
    /getPublicSiteDetails[\s\S]*try \{[\s\S]*catch \(error\) \{[\s\S]*return DEFAULT_SITE_DETAILS;/,
  );
});
