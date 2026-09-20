import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import test from "node:test";
import { feedbackHarness, executablePath } from "./feedback-browser-harness.ts";

test(
  "actual receipt preserves kobo precision and fits desktop and mobile",
  { skip: !executablePath, timeout: 90000 },
  async () => {
    const harness = await feedbackHarness();
    mkdirSync("output/playwright/payments", { recursive: true });
    try {
      for (const width of [1280, 390, 320]) {
        const page = await harness.browser.newPage({ viewport: { width, height: 844 } });
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto(`${harness.url}?receipt`);
        await page.getByRole("heading", { name: "Payment confirmed" }).waitFor();
        assert.match(await page.locator("dl").innerText(), /55,939\.09/);
        assert.match(await page.locator("dl").innerText(), /939\.09/);
        assert.equal(await page.getByText("Paystack processing fee").count(), 0);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert.ok(
          await page.locator("dl").evaluate((dl) =>
            [...dl.querySelectorAll("dt")].every((dt) => {
              const term = dt.getBoundingClientRect();
              const value = dt.nextElementSibling!.getBoundingClientRect();
              return term.right <= value.left;
            }),
          ),
        );
        await page.screenshot({ path: `output/playwright/payments/receipt-${width}.png` });
        await page.goto(`${harness.url}?receipt&provider`);
        await page.getByText("Paystack processing fee").waitFor();
        assert.deepEqual(errors, []);
        await page.close();
      }
    } finally {
      await harness.close();
    }
  },
);
