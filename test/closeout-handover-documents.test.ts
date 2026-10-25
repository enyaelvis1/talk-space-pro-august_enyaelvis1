import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "csv-parse/sync";
import { parseChecklist } from "../src/lib/checklist-progress.ts";

const read = (name: string) =>
  readFileSync(new URL(`../docs/handover/${name}-2026-10-24.csv`, import.meta.url), "utf8");
const rows = (name: string) => parse(read(name), { columns: true }) as Record<string, string>[];

test("handover exports retain exactly 12 proposals, 25 bounded cases and 18 pending decisions", () => {
  const proposals = rows("tracker-marker-proposals");
  assert.equal(proposals.length, 12);
  assert.equal(new Set(proposals.map((r) => r.task_id)).size, 12);
  assert.ok(proposals.every((r) => r.applied.startsWith("NO")));
  assert.ok(proposals.every((r) => r.proposed_marker === "[x]"));
  assert.equal(rows("bounded-verification").length, 25);
  const decisions = rows("client-decisions");
  assert.equal(decisions.length, 18);
  assert.ok(
    decisions.every(
      (r) => r.decision === "PENDING" && r.exact_question && r.options && r.owner && r.impact,
    ),
  );
});
test("100-row approval sheet is an inventory snapshot, not invented production approval", () => {
  const inventory = JSON.parse(
    readFileSync(
      new URL("../docs/migration/wordpress-inventory-2026-08-02.json", import.meta.url),
      "utf8",
    ),
  );
  const approvals = rows("legacy-content-approval-summary");
  assert.equal(approvals.length, 100);
  assert.deepEqual(
    approvals.map((r) => r.inventory_wordpress_id),
    inventory.content.map((r: { id: number }) => String(r.id)),
  );
  assert.ok(
    approvals.every((r) => r.decision.startsWith("PENDING") && r.inventory_date === "2026-08-02"),
  );
  assert.ok(approvals.every((r) => r.last_observed_live_queue.includes("not re-exported")));
});

test("preserved reconciliation index still maps all 200 titles, source lines and markers", () => {
  const content = readFileSync(
    new URL("../docs/IMPLEMENTATION_CHECKLIST.md", import.meta.url),
    "utf8",
  );
  const actual = parseChecklist({
    id: "implementation",
    label: "Implementation Checklist",
    path: "docs/IMPLEMENTATION_CHECKLIST.md",
    content,
  });
  const register = readFileSync(
    new URL("../docs/ACTUAL_REMAINING_ISSUES_CHECKLIST.md", import.meta.url),
    "utf8",
  );
  const indexed = [
    ...register.matchAll(/^\|\s+(T\d{3})\s+\/ L(\d+)\s+\|\s+([^|]+)\|\s+(\[[xp ]\])\s+\|/gm),
  ];
  assert.equal(indexed.length, 200);
  for (const [index, row] of indexed.entries()) {
    assert.equal(row[1], `T${String(index + 1).padStart(3, "0")}`);
    assert.equal(Number(row[2]), actual.tasks[index].line);
    assert.equal(row[3].trim(), actual.tasks[index].text.replace(/\*\*/g, ""));
    assert.equal(
      row[4],
      actual.tasks[index].status === "completed"
        ? "[x]"
        : actual.tasks[index].status === "partial"
          ? "[p]"
          : "[ ]",
    );
  }
});
