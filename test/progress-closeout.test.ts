import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildProgressSnapshot, parseChecklist } from "../src/lib/checklist-progress.ts";
import { PROGRESS_MILESTONES } from "../src/lib/progress-milestones.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const source = {
  id: "implementation",
  label: "Implementation Checklist",
  path: "docs/IMPLEMENTATION_CHECKLIST.md",
  content: read("docs/IMPLEMENTATION_CHECKLIST.md"),
};

test("real tracker keeps 200 unique records, markers and a complete nonoverlapping milestone assignment", () => {
  const snapshot = buildProgressSnapshot({
    projectName: "Talk Space",
    sources: [source],
    milestones: PROGRESS_MILESTONES,
  });
  assert.equal(snapshot.tasks.length, 200);
  assert.deepEqual(snapshot.summary, {
    total: 200,
    completed: 133,
    partial: 7,
    notStarted: 60,
    blocked: 0,
    inProgress: 0,
    completionPercentage: 68,
  });
  for (const task of snapshot.tasks) {
    assert.equal(
      snapshot.milestones.filter((m) => m.tasks.some((t) => t.key === task.key)).length,
      1,
      task.key,
    );
  }
  const design = snapshot.milestones.find((m) => m.id === "design-refresh")!;
  assert.equal(design.metrics.total, 8);
  assert.equal(design.metrics.completed, 5);
  assert.equal(design.metrics.partial, 2);
  assert.equal(design.metrics.notStarted, 1);
});
test("stale section counts do not masquerade as current task metrics", () => {
  const parsed = parseChecklist(source);
  assert.equal(parsed.sections.find((s) => s.id === "04")?.title, "Public shell");
  assert.equal(parsed.sections.find((s) => s.id === "06")?.title, "CMS");
  assert.equal(parsed.sections.find((s) => s.id === "27")?.title, "Remaining implementation plan");
  assert.equal(parsed.tasks.length, 200);
});
test("request generation is labelled honestly and source links point at the current repo", () => {
  const dashboard = read("src/components/progress/ProgressDashboard.tsx");
  const overview = read("src/components/progress/AdminOverview.tsx");
  const config = read("src/lib/progress-config.ts");
  assert.match(dashboard, /Snapshot generated/);
  assert.match(dashboard, /not the last task review/);
  assert.match(overview, /Snapshot generated/);
  assert.match(overview, /Blocked checklist tasks/);
  assert.doesNotMatch(overview, /Synced \{formatGeneratedDate/);
  assert.match(config, /github\.com\/enyaelvis1\/talk-space-pro-august_enyaelvis1\/blob\/develop/);
  assert.doesNotMatch(config, /enyasystem\/talk-space-production/);
});
