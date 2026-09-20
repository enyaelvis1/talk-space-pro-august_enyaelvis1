import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const bookingRoute = await readFile(new URL("../src/routes/book.tsx", import.meta.url), "utf8");
const bookingFormTemplates = await readFile(
  new URL("../src/lib/form-templates.ts", import.meta.url),
  "utf8",
);

test("preferred date and time remain optional while preserving past-date guards", () => {
  assert.match(bookingRoute, /Date must be today or later/);
  assert.match(bookingRoute, /preferredDate: z\s*\.string\(\)\s*\.trim\(\)\s*\.optional\(\)/);
  assert.match(bookingRoute, /preferredTime: z\.string\(\)\.trim\(\)\.optional\(\)/);
  assert.match(bookingFormTemplates, /fieldKey: "preferredDate"[\s\S]*required: false/);
  assert.match(bookingFormTemplates, /fieldKey: "preferredTime"[\s\S]*required: false/);
  assert.match(bookingRoute, /savePurchaseHandoff\(/);
  assert.match(bookingRoute, /window\.location\.assign\([\s\S]*\/purchase\?service=/);
  assert.match(bookingRoute, /Continue to purchase/);
  assert.match(bookingRoute, /currentSelectedSlots = selectedSlots\.filter/);
  assert.match(bookingRoute, /isSameDateKey\(slot\.startsAt, parsed\.data\.preferredDate\)/);
});

test("stale slot conflicts clear the selection and refresh availability", () => {
  assert.match(
    bookingRoute,
    /const slotConflict = \/slot\.\*\(\?:available\|hold\)\|no longer available\/i/,
  );
  assert.match(bookingRoute, /setSelectedSlots\(\[\]\);/);
  assert.match(bookingRoute, /update\("preferredTime", ""\);/);
  assert.match(bookingRoute, /setAvailabilityRefreshKey\(\(current\) => current \+ 1\)/);
});
