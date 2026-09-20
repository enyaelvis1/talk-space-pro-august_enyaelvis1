import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import test from "node:test";
import { feedbackHarness, executablePath } from "./feedback-browser-harness.ts";

test(
  "selected-day panel displays every simultaneous therapist during and after sessions",
  { skip: !executablePath, timeout: 90000 },
  async () => {
    const harness = await feedbackHarness();
    mkdirSync("output/playwright/bk008", { recursive: true });
    try {
      for (const width of [1280, 390]) {
        const page = await harness.browser.newPage({ viewport: { width, height: 844 } });
        await page.goto(`${harness.url}?bk008-day`);
        await page.getByRole("region", { name: "Now" }).waitFor();
        assert.equal(await page.getByRole("region", { name: "Now" }).locator("article").count(), 2);
        for (const id of ["A", "B"])
          assert.ok(await page.getByRole("heading", { name: `Therapist ${id}` }).isVisible());
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.screenshot({ path: `output/playwright/bk008/current-${width}.png` });
        await page.getByRole("button", { name: "Later" }).click();
        await page.getByRole("region", { name: "Earlier" }).waitFor();
        assert.equal(
          await page.getByRole("region", { name: "Earlier" }).locator("article").count(),
          2,
        );
        assert.equal(await page.getByRole("region", { name: "Now" }).count(), 0);
        await page.close();
      }
    } finally {
      await harness.close();
    }
  },
);
