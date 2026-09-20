import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import test from "node:test";
import { feedbackHarness, executablePath } from "./feedback-browser-harness.ts";
test(
  "checkout clock closes payment controls without database polling",
  { skip: !executablePath, timeout: 90000 },
  async () => {
    const harness = await feedbackHarness();
    mkdirSync("output/playwright/bk007", { recursive: true });
    try {
      const page = await harness.browser.newPage({ viewport: { width: 390, height: 844 } });
      const dbRequests: string[] = [];
      page.on("request", (r) => {
        if (r.url().includes("supabase")) dbRequests.push(r.url());
      });
      await page.goto(`${harness.url}?checkout-clock`);
      await page.getByRole("status").filter({ hasText: "Checkout expired" }).waitFor();
      assert.ok(await page.getByRole("button", { name: "Pay with Paystack" }).isDisabled());
      assert.ok(await page.getByRole("button", { name: "Submit transfer" }).isDisabled());
      assert.equal(
        await page.getByRole("link", { name: "Start a new booking" }).getAttribute("href"),
        "/book",
      );
      assert.deepEqual(dbRequests, []);
      await page.screenshot({ path: "output/playwright/bk007/expired-checkout-mobile.png" });
    } finally {
      await harness.close();
    }
  },
);
