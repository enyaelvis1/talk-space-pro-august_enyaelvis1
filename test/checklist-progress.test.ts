import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildProgressSnapshot,
  calculateMetrics,
  classifyStatus,
  mergeChecklistStatuses,
  normalizeTaskKey,
  parseChecklist,
  progressSnapshotToCsv,
} from "../src/lib/checklist-progress.ts";
import { hasProgressAccess } from "../src/lib/progress-access.ts";
import { availabilitySlotInputSchema } from "../src/lib/availability-validation.ts";

const servicePolicyMigration = await readFile(
  new URL("../supabase/migrations/20260715140000_service_scheduling_policy.sql", import.meta.url),
  "utf8",
);
const bookingMigration = await readFile(
  new URL("../supabase/migrations/20260715200000_booking_foundation.sql", import.meta.url),
  "utf8",
);
const adminAvailabilityMigration = await readFile(
  new URL(
    "../supabase/migrations/20260716090000_admin_availability_slot_management.sql",
    import.meta.url,
  ),
  "utf8",
);
const bookingFunctionFixMigration = await readFile(
  new URL(
    "../supabase/migrations/20260716110000_fix_booking_function_column_references.sql",
    import.meta.url,
  ),
  "utf8",
);
const bookingHoldExpiryFixMigration = await readFile(
  new URL(
    "../supabase/migrations/20260716120000_fix_booking_hold_expiry_reference.sql",
    import.meta.url,
  ),
  "utf8",
);
const availabilityMigration = await readFile(
  new URL("../supabase/migrations/20260715200000_booking_foundation.sql", import.meta.url),
  "utf8",
);
const implementationChecklist = await readFile(
  new URL("../docs/IMPLEMENTATION_CHECKLIST.md", import.meta.url),
  "utf8",
);

const source = {
  id: "main",
  label: "Main checklist",
  path: "docs/main.md",
  content: `# Example Project

## 01. Foundation
- [x] Build shell
- [~] Add dashboard
- [p] Document setup
- [!] Resolve deployment issue
- [ ] Add tests
`,
};

test("classifies every supported checklist marker", () => {
  assert.equal(classifyStatus("x"), "completed");
  assert.equal(classifyStatus("~"), "in_progress");
  assert.equal(classifyStatus("p"), "partial");
  assert.equal(classifyStatus("!"), "blocked");
  assert.equal(classifyStatus(" "), "not_started");
  assert.equal(classifyStatus("?"), null);
});

test("normalizes equivalent task text into a stable key", () => {
  assert.equal(normalizeTaskKey("**Build shell**"), "build-shell");
  assert.equal(normalizeTaskKey("[Build shell](./shell.md)"), "build-shell");
});

test("parses titles, sections, tasks, statuses, and warnings", () => {
  const parsed = parseChecklist(source);
  assert.equal(parsed.title, "Example Project");
  assert.equal(parsed.sections[0]?.id, "01");
  assert.equal(parsed.tasks.length, 5);
  assert.deepEqual(parsed.metrics, {
    total: 5,
    completed: 1,
    inProgress: 1,
    partial: 1,
    blocked: 1,
    notStarted: 1,
    completionPercentage: 40,
  });
  assert.deepEqual(parsed.warnings, []);
});

test("warns on invalid task placement and ignores unknown markers", () => {
  const parsed = parseChecklist({
    ...source,
    content: "# Invalid\n- [?] Unknown\n- [x] Before section\n",
  });
  assert.equal(parsed.tasks.length, 1);
  assert.equal(parsed.warnings.length, 2);
});

test("merges duplicate tasks using the documented priority rule", () => {
  const first = parseChecklist(source);
  const second = parseChecklist({
    ...source,
    id: "secondary",
    label: "Secondary checklist",
    content: "# Other\n## 02. Delivery\n- [!] Build shell\n- [x] Add dashboard\n",
  });
  const merged = mergeChecklistStatuses([first, second]);
  const buildShell = merged.find((task) => task.key === "build-shell");
  const dashboard = merged.find((task) => task.key === "add-dashboard");
  assert.equal(buildShell?.status, "completed");
  assert.equal(dashboard?.status, "completed");
  assert.equal(buildShell?.occurrences.length, 2);
});

test("deduplicates tasks for overall completion and builds milestones", () => {
  const snapshot = buildProgressSnapshot({
    projectName: "Example Project",
    sources: [source],
    milestones: [{ id: "foundation", title: "Foundation", sectionIds: ["01"] }],
  });
  assert.equal(snapshot.summary.total, 5);
  assert.equal(snapshot.milestones[0]?.complete, false);
  assert.equal(snapshot.nextTasks.length, 4);
});

test("handles empty checklists", () => {
  const metrics = calculateMetrics([]);
  assert.equal(metrics.total, 0);
  assert.equal(metrics.completionPercentage, 0);
});

test("keeps the checklist headline in sync with its task markers", () => {
  const markers = [...implementationChecklist.matchAll(/^\s*-\s*\[([x~p! ])\]\s+/gm)].map(
    (match) => match[1],
  );
  const completed = markers.filter((marker) => marker === "x").length;
  const weighted = markers.reduce(
    (total, marker) =>
      total + (marker === "x" || marker === "~" || marker === "p" ? (marker === "x" ? 1 : 0.5) : 0),
    0,
  );
  const headline = implementationChecklist.match(
    /\*\*Progress:\*\* `(?<completed>\d+) \/ (?<total>\d+) complete` — `(?<direct>\d+)% direct completion`; `(?<weighted>\d+)% weighted completion/,
  );
  assert.ok(headline?.groups, "the checklist should declare a progress headline");
  assert.equal(Number(headline.groups.completed), completed);
  assert.equal(Number(headline.groups.total), markers.length);
  assert.equal(Number(headline.groups.direct), Math.round((completed / markers.length) * 100));
  assert.equal(Number(headline.groups.weighted), Math.round((weighted / markers.length) * 100));
});

test("exports CSV with summary and task rows", () => {
  const snapshot = buildProgressSnapshot({
    projectName: "Example Project",
    sources: [source],
    milestones: [],
  });
  const csv = progressSnapshotToCsv(snapshot);
  assert.match(csv, /Completion percentage,40%/);
  assert.match(csv, /Main checklist,Foundation,build-shell/);
});

test("restricts progress access to administrators", () => {
  assert.equal(hasProgressAccess("admin", "enyaelvis@gmail.com"), true);
  assert.equal(hasProgressAccess("admin", "other-admin@example.com"), false);
  assert.equal(hasProgressAccess("staff"), false);
  assert.equal(hasProgressAccess("client"), false);
  assert.equal(hasProgressAccess(null), false);
});

test("stores service scheduling policy for the booking batch", () => {
  assert.match(
    servicePolicyMigration,
    /add column buffer_before_minutes integer not null default 0/,
  );
  assert.match(
    servicePolicyMigration,
    /add column buffer_after_minutes integer not null default 0/,
  );
  assert.match(
    servicePolicyMigration,
    /add column minimum_lead_time_minutes integer not null default 0/,
  );
  assert.match(servicePolicyMigration, /check \(minimum_lead_time_minutes >= 0\)/);
});

test("defines the booking state machine, availability query, and hold guard", () => {
  assert.match(
    bookingMigration,
    /create type public\.appointment_status as enum \([\s\S]*'hold'[\s\S]*'pending_payment'[\s\S]*'confirmed'[\s\S]*'completed'[\s\S]*'cancelled'[\s\S]*'no_show'/,
  );
  assert.match(bookingMigration, /hold_expires_at timestamptz/);
  assert.match(bookingMigration, /appointments_active_slot_exclusion/);
  assert.match(bookingMigration, /create or replace function public\.list_available_slots/);
  assert.match(bookingMigration, /create or replace function public\.hold_appointment/);
  assert.match(bookingMigration, /now\(\) \+ interval '5 minutes'/);
  assert.match(bookingMigration, /auth\.uid\(\) is null or p_client_id <> auth\.uid\(\)/);
});

test("restricts availability slot writes to administrators", () => {
  assert.match(adminAvailabilityMigration, /availability_exceptions_admin_read/);
  assert.match(adminAvailabilityMigration, /availability_exceptions_admin_insert/);
  assert.match(adminAvailabilityMigration, /availability_exceptions_admin_delete/);
  assert.match(adminAvailabilityMigration, /public\.has_role\(auth\.uid\(\), 'admin'\)/);
});

test("validates availability slot input and protects scheduling rules", () => {
  const valid = availabilitySlotInputSchema.parse({
    therapistId: "00000000-0000-4000-8000-000000000001",
    mode: "online",
    date: "2099-07-23",
    startsAt: "09:00",
    endsAt: "10:00",
    reason: "Additional online clinic",
  });
  assert.equal(valid.endsAt, "10:00");

  assert.throws(
    () => availabilitySlotInputSchema.parse({ ...valid, startsAt: "10:10" }),
    /15-minute increments/,
  );
  assert.throws(
    () => availabilitySlotInputSchema.parse({ ...valid, endsAt: "08:00" }),
    /End time must be after the start time/,
  );
  assert.throws(
    () => availabilitySlotInputSchema.parse({ ...valid, date: "23-07-2099" }),
    /Choose a valid date/,
  );

  assert.match(availabilityMigration, /starts_at >= now\(\) \+ make_interval/);
  assert.match(availabilityMigration, /minimum_lead_time_minutes/);
  assert.match(availabilityMigration, /kind = 'blocked'/);
  assert.match(availabilityMigration, /buffer_before_minutes/);
  assert.match(availabilityMigration, /status in \('hold', 'pending_payment', 'confirmed'\)/);
  assert.match(availabilityMigration, /order by candidate\.starts_at, candidate\.therapist_id/);
});

test("qualifies booking function service identifiers", () => {
  assert.match(bookingFunctionFixMigration, /public\.services\.id = p_service_id/);
  assert.match(bookingFunctionFixMigration, /create or replace function public\.hold_appointment/);
  assert.match(
    bookingFunctionFixMigration,
    /create or replace function public\.list_available_slots/,
  );
});

test("qualifies booking hold expiry cleanup columns", () => {
  assert.match(bookingHoldExpiryFixMigration, /public\.appointments\.hold_expires_at <= now\(\)/);
  assert.match(bookingHoldExpiryFixMigration, /public\.appointments\.status = 'hold'/);
});
