import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const handoff = await readFile(new URL("../src/lib/purchase-handoff.ts", import.meta.url), "utf8");
const purchaseRoute = await readFile(
  new URL("../src/routes/purchase.tsx", import.meta.url),
  "utf8",
);

test("purchase handoff keeps personal details out of the URL and expires stale drafts", () => {
  assert.match(handoff, /sessionStorage/);
  assert.match(handoff, /30 \* 60 \* 1000/);
  assert.match(handoff, /savedAt/);
  assert.match(purchaseRoute, /loadPurchaseHandoff\(\)/);
  assert.match(purchaseRoute, /clearPurchaseHandoff\(\)/);
  assert.doesNotMatch(purchaseRoute, /search\.name|search\.email|search\.phone/);
});
