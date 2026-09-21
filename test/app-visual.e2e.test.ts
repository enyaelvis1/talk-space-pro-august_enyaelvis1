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

const executablePath = CHROMIUM_CANDIDATES.find((c) => existsSync(c));
const screenshotDir = fileURLToPath(new URL("../screenshots/app-evidence", import.meta.url));
mkdirSync(screenshotDir, { recursive: true });

const APP_BASE = process.env.APP_BASE || "http://127.0.0.1:5173";

test(
  "app visual evidence: bank-transfer harness, therapist route, admin payments",
  {
    skip: executablePath ? false : "No Chromium binary available in this environment.",
  },
  async () => {
    const browser = await chromium.launch({
      executablePath,
      headless: true,
      args: ["--no-sandbox", "--disable-gpu"],
    });
    try {
      const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });

      // 1) Bank transfer harness (served from public/)
      await page.goto(`${APP_BASE}/bank-transfer-harness.html`, {
        waitUntil: "load",
        timeout: 30000,
      });
      await page.screenshot({ path: `${screenshotDir}/01-bank-transfer-page.png` });
      console.log("✓ Saved bank transfer page screenshot");
      await page.fill("#bank-note", "Sender: Jane Doe");
      await page.fill("#bank-ref", "TS-REF-LOCAL-001");
      await page.screenshot({ path: `${screenshotDir}/02-bank-transfer-filled.png` });
      await page.click("#submit");
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${screenshotDir}/03-bank-transfer-submitted.png` });
      const resText = await page.textContent("#result");
      assert.ok(resText?.includes("TS-REF-LOCAL-001"));

      // 2) Therapist route (should redirect to login or show unavailable message)
      await page.goto(`${APP_BASE}/therapist`, { waitUntil: "load", timeout: 30000 });
      await page.screenshot({ path: `${screenshotDir}/04-therapist-route.png` });
      console.log("✓ Saved therapist route screenshot");

      // 3) Admin payments (should redirect to login or show admin payments UI)
      try {
        await page.goto(`${APP_BASE}/admin/payments`, { waitUntil: "load", timeout: 30000 });
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("ERR_ABORTED")) throw error;
        console.warn(
          "Admin payments navigation was aborted by the dev server; capturing evidence.",
        );
      }
      await page.screenshot({ path: `${screenshotDir}/05-admin-payments.png` });
      console.log("✓ Saved admin payments screenshot");

      console.log("Screenshots saved to:", screenshotDir);
    } finally {
      await browser.close();
    }
  },
);
