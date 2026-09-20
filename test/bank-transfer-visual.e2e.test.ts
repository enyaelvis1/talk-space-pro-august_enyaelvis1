import assert from "node:assert/strict";
import { existsSync, mkdirSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright-core";

const CHROMIUM_CANDIDATES = [
  process.env.CHROME_PATH,
  process.env.GOOGLE_CHROME_BIN,
  "/opt/ms-playwright/chromium-1194/chrome-linux/chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter((candidate): candidate is string => Boolean(candidate));

const executablePath = CHROMIUM_CANDIDATES.find((candidate) => existsSync(candidate));

const screenshotDir = fileURLToPath(new URL("../screenshots/bank-transfer", import.meta.url));
mkdirSync(screenshotDir, { recursive: true });

test(
  "bank transfer UI: transfer reference input and submit flow",
  {
    skip: executablePath ? false : "No Chromium binary available in this environment.",
  },
  async () => {
    const viewport = { width: 1000, height: 900 };
    const browser = await chromium.launch({
      executablePath,
      headless: true,
      args: ["--no-sandbox", "--disable-gpu"],
    });
    try {
      const page = await browser.newPage({ viewport });

      const harnessPath = fileURLToPath(
        new URL("./fixtures/bank-transfer-harness.html", import.meta.url),
      );
      await page.goto(`file://${harnessPath}`, { waitUntil: "load", timeout: 30000 });

      // Screenshot before interaction
      await page.screenshot({ path: `${screenshotDir}/01-bank-transfer-initial.png` });
      console.log("✓ Screenshot 1 saved");

      // Fill note and transfer reference
      await page.fill("#bank-note", "Sender: Jane Doe");
      await page.fill("#bank-ref", "TS-REF-12345");

      // Screenshot after filling inputs
      await page.screenshot({ path: `${screenshotDir}/02-filled-transfer-ref.png` });
      console.log("✓ Screenshot 2 saved");

      // Click submit
      await page.click("#submit");
      await page.waitForTimeout(300);

      // Screenshot result
      await page.screenshot({ path: `${screenshotDir}/03-submitted.png` });
      console.log("✓ Screenshot 3 saved");

      // Verify result contains the transfer ref
      const text = await page.textContent("#result");
      assert.ok(text?.includes("TS-REF-12345"), "Result should include the transfer reference");

      console.log("\nScreenshots saved to: " + screenshotDir);
    } finally {
      await browser.close();
    }
  },
);
