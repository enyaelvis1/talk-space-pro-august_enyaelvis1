import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import test from "node:test";
import { feedbackHarness, executablePath } from "./feedback-browser-harness.ts";

test(
  "real admin shortcuts have working router destinations on desktop and mobile",
  { skip: !executablePath, timeout: 90000 },
  async () => {
    const harness = await feedbackHarness();
    mkdirSync("output/playwright/feedback", { recursive: true });
    try {
      for (const width of [1280, 390]) {
        const page = await harness.browser.newPage({ viewport: { width, height: 844 } });
        await page.goto(`${harness.url}?admin`);
        await page.getByRole("heading", { name: "Operations shortcuts" }).waitFor();
        const clients = page.getByRole("link", { name: /Clients Manage client records/ });
        assert.equal(await clients.getAttribute("href"), "/admin/clients");
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.screenshot({
          path: `output/playwright/feedback/admin-${width}.png`,
          fullPage: false,
        });
        await clients.click();
        await page.getByRole("heading", { name: "Destination: clients" }).waitFor();
        assert.ok(page.url().endsWith("/admin/clients"));
        await page.close();
      }
    } finally {
      await harness.close();
    }
  },
);
