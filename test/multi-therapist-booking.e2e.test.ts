import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import test from "node:test";
import { feedbackHarness, executablePath } from "./feedback-browser-harness.ts";
import {
  formatSlotLabel,
  formatSlotTime,
  uniqueBookingSlots,
  slotKey,
} from "../src/lib/booking-slots.ts";

test("slot identity deduplicates only the same therapist, mode and instant", () => {
  const a = {
    therapistId: "A",
    startsAt: "2030-10-01T09:00:00Z",
    endsAt: "2030-10-01T10:00:00Z",
    mode: "online" as const,
  };
  const b = { ...a, therapistId: "B" };
  assert.equal(uniqueBookingSlots([a, b, a]).length, 2);
  assert.equal(slotKey(a), slotKey({ ...a, startsAt: "2030-10-01T10:00:00+01:00" }));
  assert.equal(
    uniqueBookingSlots([
      a,
      { ...a, mode: "in_person" },
      { ...a, startsAt: "2030-10-01T10:00:00+01:00" },
    ]).length,
    2,
  );
});

test("10:30 WAT retains one slot per therapist and mode", () => {
  const slots = [
    {
      therapistId: "A",
      startsAt: "2030-10-01T09:30:00Z",
      endsAt: "2030-10-01T10:30:00Z",
      mode: "online" as const,
    },
    {
      therapistId: "A",
      startsAt: "2030-10-01T09:30:00Z",
      endsAt: "2030-10-01T10:30:00Z",
      mode: "online" as const,
    },
    {
      therapistId: "B",
      startsAt: "2030-10-01T09:30:00Z",
      endsAt: "2030-10-01T10:30:00Z",
      mode: "online" as const,
    },
  ];
  assert.match(formatSlotTime(slots[0]), /10:30 WAT/);
  assert.equal(uniqueBookingSlots(slots).length, 2);
});

test("public availability labels do not expose therapist names", () => {
  const label = formatSlotLabel({
    therapistId: "A",
    therapistName: "Private Therapist Name",
    startsAt: "2030-10-01T09:00:00+01:00",
    endsAt: "2030-10-01T10:00:00+01:00",
    mode: "online",
  });
  assert.doesNotMatch(label, /Private Therapist Name/);
  assert.match(label, /9:00/);
});

test("booking time options show the time without repeating the date", () => {
  const time = formatSlotTime({ startsAt: "2030-10-01T09:00:00+01:00" });
  assert.match(time, /^9:00 WAT$/);
  assert.doesNotMatch(time, /2030|Oct|Oct\.|01/);
});

test("booking times are explicitly WAT across the UK daylight-saving transition", () => {
  const startsAt = "2026-10-27T15:00:00Z";
  const bookingTime = formatSlotTime({ startsAt });
  const ukTime = new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Europe/London",
  }).format(new Date(startsAt));

  assert.match(bookingTime, /^16:00 WAT$/);
  assert.equal(ukTime, "15:00");
});

test(
  "real booking picker preserves two therapists at the same time",
  { skip: !executablePath, timeout: 90000 },
  async () => {
    const harness = await feedbackHarness();
    mkdirSync("output/playwright/feedback", { recursive: true });
    try {
      for (const width of [1280, 390]) {
        const page = await harness.browser.newPage({ viewport: { width, height: 844 } });
        await page.goto(harness.url);
        for (const optionIndex of [0, 1]) {
          await page.getByRole("combobox").click();
          const options = page.getByRole("option", { name: /^10:00 WAT$/ });
          assert.equal(await options.count(), 2);
          await options.nth(optionIndex).click();
          await page.getByRole("button", { name: "Add session" }).click();
        }
        assert.equal(await page.locator("li").count(), 2);
        const keys = JSON.parse(await page.getByTestId("selected-keys").innerText());
        assert.equal(new Set(keys).size, 2);
        assert.equal(await page.getByRole("button", { name: "Add session" }).isDisabled(), true);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.screenshot({
          path: `output/playwright/feedback/slots-${width}.png`,
          fullPage: true,
        });
        await page
          .getByRole("button", { name: /^Remove/ })
          .first()
          .click();
        assert.equal(await page.locator("li").count(), 1);
        await page.close();
      }
    } finally {
      await harness.close();
    }
  },
);
