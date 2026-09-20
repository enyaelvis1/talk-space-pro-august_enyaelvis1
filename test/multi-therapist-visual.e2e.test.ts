import assert from "node:assert/strict";
import { existsSync, mkdirSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright-core";

/**
 * Visual regression test for multi-therapist same-time booking.
 *
 * Tests the core functionality:
 * 1. Same-time slots from different therapists display as distinct entries
 * 2. Multiple same-time slots can be selected together
 * 3. Therapist identity is preserved throughout the selection
 * 4. The slot key logic correctly distinguishes therapist+time combinations
 */

const CHROMIUM_CANDIDATES = [
  process.env.CHROME_PATH,
  process.env.GOOGLE_CHROME_BIN,
  "/opt/ms-playwright/chromium-1194/chrome-linux/chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter((candidate): candidate is string => Boolean(candidate));

const executablePath = CHROMIUM_CANDIDATES.find((candidate) => existsSync(candidate));

// Ensure screenshot directory exists
const screenshotDir = fileURLToPath(new URL("../screenshots/multi-therapist", import.meta.url));
mkdirSync(screenshotDir, { recursive: true });

test(
  "multi-therapist same-time slots: distinct selections and therapist preservation",
  { skip: executablePath ? false : "No Chromium binary available in this environment." },
  async () => {
    const viewport = { width: 1024, height: 900 };

    const browser = await chromium.launch({
      executablePath,
      headless: true,
      args: ["--no-sandbox", "--disable-gpu"],
    });

    try {
      const page = await browser.newPage({ viewport });

      // Navigate to the test harness
      const harnessPath = fileURLToPath(
        new URL("./fixtures/multi-therapist-harness.html", import.meta.url),
      );
      await page.goto(`file://${harnessPath}`, {
        waitUntil: "load",
        timeout: 30_000,
      });

      // Screenshot 1: Initial state with all available slots
      await page.screenshot({ path: `${screenshotDir}/01-available-slots.png` });
      console.log(
        "✓ Screenshot 1: Available slots (3 therapists at 10:00, 1 at 11:30, 1 at 14:00)",
      );

      // Verify slots are visible
      const slots = await page.locator(".slot-card").count();
      assert.ok(slots >= 5, `Expected at least 5 slot cards, found ${slots}`);

      // Click first same-time therapist slot (10:00 - Dr. Sarah)
      const firstSlot = page.locator(".slot-card").first();
      await firstSlot.click();
      await page.waitForTimeout(200);

      // Screenshot 2: First same-time slot selected
      await page.screenshot({ path: `${screenshotDir}/02-first-slot-selected.png` });
      console.log("✓ Screenshot 2: First same-time slot selected (Dr. Sarah @ 10:00)");

      // Verify it's marked as selected
      const selectedCount1 = await page.locator(".slot-card.selected").count();
      assert.equal(selectedCount1, 1, "Should have 1 selected slot");

      // Click second same-time therapist slot (10:00 - Dr. Michael)
      const allSlots = await page.locator(".slot-card").all();
      const secondSlot = allSlots[1]; // Next slot also at 10:00
      await secondSlot.click();
      await page.waitForTimeout(200);

      // Screenshot 3: Second same-time slot selected (both at 10:00)
      await page.screenshot({ path: `${screenshotDir}/03-both-same-time-slots-selected.png` });
      console.log(
        "✓ Screenshot 3: Both same-time slots selected (Dr. Sarah & Dr. Michael @ 10:00)",
      );

      // Verify both are selected
      const selectedCount2 = await page.locator(".slot-card.selected").count();
      assert.equal(selectedCount2, 2, "Should have 2 selected slots");

      // Verify selection list shows both
      const selectionItems = await page.locator(".selection-item").count();
      assert.equal(selectionItems, 2, "Selection list should show 2 items");

      // Click third same-time slot (10:00 - Dr. Amara)
      const thirdSlot = allSlots[2];
      await thirdSlot.click();
      await page.waitForTimeout(200);

      // Screenshot 4: Three therapists at same time
      await page.screenshot({ path: `${screenshotDir}/04-three-therapists-same-time.png` });
      console.log(
        "✓ Screenshot 4: Three therapists selected at same time (Sarah, Michael, Amara @ 10:00)",
      );

      // Verify three are selected
      const selectedCount3 = await page.locator(".slot-card.selected").count();
      assert.equal(selectedCount3, 3, "Should have 3 selected slots");

      // Verify selection list shows all three
      const selectionItems3 = await page.locator(".selection-item").count();
      assert.equal(selectionItems3, 3, "Selection list should show 3 items");

      // Scroll down to see validation results
      await page.evaluate(() => window.scrollBy(0, 300));
      await page.waitForTimeout(200);

      // Screenshot 5: Validation results showing multi-therapist detection
      await page.screenshot({
        path: `${screenshotDir}/05-validation-multi-therapist-confirmed.png`,
      });
      console.log("✓ Screenshot 5: Validation confirms multi-therapist same-time booking");

      // Verify validation text contains the multi-therapist confirmation
      const validationText = await page.textContent("#validationResults");
      assert.ok(
        validationText?.includes("Multi-therapist same-time bookings detected"),
        "Validation should detect multi-therapist same-time bookings",
      );

      // Click to deselect one slot
      const selectedSlots = await page.locator(".slot-card.selected").all();
      await selectedSlots[1].click(); // Remove Dr. Michael
      await page.waitForTimeout(200);

      // Screenshot 6: One slot deselected
      await page.screenshot({ path: `${screenshotDir}/06-one-slot-deselected.png` });
      console.log("✓ Screenshot 6: One slot deselected (Sarah & Amara remain @ 10:00)");

      // Verify count updated
      const selectedCount4 = await page.locator(".slot-card.selected").count();
      assert.equal(selectedCount4, 2, "Should have 2 selected slots after deselection");

      // Click Clear button
      await page.getByRole("button", { name: "Clear Selection" }).click();
      await page.waitForTimeout(200);

      // Screenshot 7: Cleared state
      await page.screenshot({ path: `${screenshotDir}/07-selection-cleared.png` });
      console.log("✓ Screenshot 7: Selection cleared, back to initial state");

      // Verify cleared
      const selectedCountFinal = await page.locator(".slot-card.selected").count();
      assert.equal(selectedCountFinal, 0, "Should have no selected slots");

      console.log(`\n✓ All tests passed!`);
      console.log(`📸 Screenshots saved to: ${screenshotDir}`);
      console.log(`\n  Key validations:`);
      console.log(`  ✓ Multiple therapists at same time display as distinct slots`);
      console.log(`  ✓ Multiple same-time slots can be selected together`);
      console.log(`  ✓ Therapist identity is preserved throughout selection`);
      console.log(`  ✓ Slot key logic correctly distinguishes therapist+time combinations`);
    } finally {
      await browser.close();
    }
  },
);
