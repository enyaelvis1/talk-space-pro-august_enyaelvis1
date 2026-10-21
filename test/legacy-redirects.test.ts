import assert from "node:assert/strict";
import test from "node:test";

import { getLegacyRedirect } from "../src/lib/legacy-redirects.ts";

test("legacy homepage CMS slug redirects to the real homepage", async () => {
  const response = await getLegacyRedirect(
    new Request("https://www.talkspace.ng/content/pages/professional-counseling-services"),
  );

  assert.equal(response?.status, 301);
  assert.equal(response?.url.pathname, "/");
});

test("legacy homepage slug with a trailing slash also redirects", async () => {
  const response = await getLegacyRedirect(
    new Request("https://www.talkspace.ng/professional-counseling-services/"),
  );

  assert.equal(response?.status, 301);
  assert.equal(response?.url.pathname, "/");
});
