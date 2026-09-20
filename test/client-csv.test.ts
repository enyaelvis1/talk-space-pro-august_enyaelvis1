import assert from "node:assert/strict";
import test from "node:test";
import { serializeGoogleReviewsCsv } from "../src/lib/google-review-csv.ts";
import {
  clientProfilesCsv,
  clientProfilesCsvTemplate,
  parseClientCsv,
} from "../src/lib/client-csv.ts";
import { getClientContactCompletionState } from "../src/lib/client-profile.ts";

const profile = {
  full_name: 'Jane "Ada", Example',
  email: "jane@example.test",
  phone: "+234 800 123 4567",
  address: "First floor\n10, Test Street",
  preferred_mode: "online",
  assigned_therapist_id: "00000000-0000-4000-8000-000000000001",
};

test("CSV round trip preserves quotes, commas, multiline addresses and assignment", () => {
  const result = parseClientCsv(clientProfilesCsv([profile]));
  assert.deepEqual(result.errors, []);
  for (const [key, value] of Object.entries(profile))
    assert.equal(result.profiles[0].values[key], value);
});

test("CSV template contains an importable example profile", () => {
  const result = parseClientCsv(clientProfilesCsvTemplate());
  assert.deepEqual(result.errors, []);
  assert.equal(result.profiles[0].values.full_name, "Example Client");
  assert.equal(result.profiles[0].values.email, "example.client@example.test");
});

test("CSV accepts a BOM and normalizes email", () => {
  const result = parseClientCsv(
    "\ufefffull_name,email,phone\r\nJane Example,JANE@example.test,+2348001234567",
  );
  assert.deepEqual(result.errors, []);
  assert.equal(result.profiles[0].values.email, "jane@example.test");
});

test("CSV exports spreadsheet formulas as text without corrupting round trips", () => {
  for (const address of ["=1+1", "+1+1", "@SUM(1)", "-1+1", "'literal", "'=1+1"]) {
    const csv = clientProfilesCsv([{ ...profile, address }]);
    assert.ok(csv.includes(`"'${address}"`));
    const result = parseClientCsv(csv);
    assert.deepEqual(result.errors, []);
    assert.equal(result.profiles[0].values.address, address);
    assert.equal(result.profiles[0].values.phone, profile.phone);
  }
});

test("all required contacts are validated before import", () => {
  for (const field of ["full_name", "email", "phone"]) {
    const result = parseClientCsv(clientProfilesCsv([{ ...profile, [field]: "" }]));
    assert.equal(result.profiles.length, 0);
    assert.equal(result.errors[0].row, 2);
  }
  assert.equal(
    getClientContactCompletionState({
      fullName: "Jane Example",
      email: "jane@example.test",
      phone: "not a phone",
    }).isComplete,
    false,
  );
});

test("CSV rejects malformed headers, row shape, duplicate emails and invalid dates", () => {
  for (const csv of [
    "email\na@example.test",
    "full_name,email,phone,email\nJane,a@example.test,1234567,a@example.test",
    "full_name,email,phone\nJane,a@example.test",
    'full_name,email,phone\n"unterminated',
  ])
    assert.throws(() => parseClientCsv(csv));
  assert.equal(parseClientCsv(clientProfilesCsv([profile, profile])).errors[0].row, 3);
  assert.match(
    parseClientCsv(clientProfilesCsv([{ ...profile, date_of_birth: "2025-02-30" }])).errors[0]
      .message,
    /date_of_birth/,
  );
});

test("missing optional CSV columns do not erase stored client fields", () => {
  const result = parseClientCsv("full_name,email,phone\nJane Example,jane@example.test,123456789");
  assert.equal(Object.hasOwn(result.profiles[0].values, "address"), false);
  assert.equal(Object.hasOwn(result.profiles[0].values, "id"), false);
});

test("CSV rejects files and profile batches beyond the import limits", () => {
  assert.throws(() => parseClientCsv("a".repeat(2 * 1024 * 1024 + 1)), /2 MB/);
  assert.throws(
    () =>
      parseClientCsv(
        clientProfilesCsv(
          Array.from({ length: 2001 }, (_, i) => ({
            ...profile,
            email: `client${i}@example.test`,
          })),
        ),
      ),
    /2,000/,
  );
});

test("Google review CSV export preserves the review fields and handles embedded quotes", () => {
  const csv = serializeGoogleReviewsCsv([
    {
      id: "g-101",
      name: 'Jane "Ada"',
      date: "April 2026",
      quote: 'Helpful and kind, "very professional".\nI would return.',
      location: "Lagos, Nigeria",
      avatarPath: "/uploads/google/avatar.png",
    },
  ]);

  assert.match(csv, /^"id","name","date","quote","location","avatarPath"\r?\n/);
  assert.match(csv, /"Jane ""Ada"""/);
  assert.match(csv, /"Helpful and kind, ""very professional""\.\nI would return\."/);
  assert.match(csv, /"Lagos, Nigeria"/);
  assert.match(csv, /"\/uploads\/google\/avatar\.png"/);
});
