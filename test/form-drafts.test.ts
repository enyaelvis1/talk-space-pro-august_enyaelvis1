import assert from "node:assert/strict";
import test from "node:test";

import { clearFormDraft, loadFormDraft, saveFormDraft } from "../src/lib/form-drafts.ts";

type StorageState = Record<string, string>;

function installStorage(initial: StorageState = {}) {
  const state = { ...initial };
  const localStorage = {
    getItem: (key: string) => state[key] ?? null,
    setItem: (key: string, value: string) => {
      state[key] = value;
    },
    removeItem: (key: string) => {
      delete state[key];
    },
  };
  Object.assign(globalThis, { window: { localStorage } });
  return state;
}

test("booking drafts preserve selected service, mode, date, and time", () => {
  installStorage();
  const key = "test.booking-draft";
  const draft = {
    serviceId: "service-id",
    mode: "in_person" as const,
    preferredDate: "2030-10-01",
    preferredTime: "therapist-id:2030-10-01T09:00:00.000Z",
  };

  saveFormDraft(key, draft);

  assert.deepEqual(loadFormDraft<typeof draft>(key)?.data, draft);
  assert.match(loadFormDraft<typeof draft>(key)?.updatedAt ?? "", /^\d{4}-\d{2}-\d{2}T/);
});

test("invalid booking drafts are ignored and can be cleared", () => {
  const state = installStorage({
    "test.booking-draft": JSON.stringify({ data: null, updatedAt: "not-a-date" }),
  });

  assert.equal(loadFormDraft("test.booking-draft"), null);

  saveFormDraft("test.booking-draft", { preferredDate: "2030-10-01" });
  clearFormDraft("test.booking-draft");
  assert.equal(state["test.booking-draft"], undefined);
});
