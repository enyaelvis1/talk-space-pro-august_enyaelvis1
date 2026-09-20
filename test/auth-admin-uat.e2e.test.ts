import assert from "node:assert/strict";
import { existsSync, mkdirSync } from "node:fs";
import test from "node:test";
import { chromium, type Page } from "playwright-core";

const CHROMIUM_CANDIDATES = [
  process.env.CHROME_PATH,
  process.env.GOOGLE_CHROME_BIN,
  "/opt/ms-playwright/chromium-1194/chrome-linux/chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter((candidate): candidate is string => Boolean(candidate));

const executablePath = CHROMIUM_CANDIDATES.find((candidate) => existsSync(candidate));
const appBase = process.env.APP_BASE || "http://127.0.0.1:5173";
const authUatEnabled = process.env.PLAYWRIGHT_AUTH_UAT === "1";
const adminEmail = process.env.PLAYWRIGHT_ADMIN_EMAIL;
const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD;
const hasAdminCredentials = Boolean(adminEmail && adminPassword);
const therapistEmail = process.env.PLAYWRIGHT_THERAPIST_EMAIL;
const therapistPassword = process.env.PLAYWRIGHT_THERAPIST_PASSWORD;
const hasTherapistCredentials = Boolean(therapistEmail && therapistPassword);

mkdirSync("output/playwright/uat", { recursive: true });

async function gotoProtectedRoute(page: Page, route: string) {
  await page.goto(`${appBase}${route}`, { waitUntil: "commit", timeout: 30000 });
  await page.waitForURL(/\/login(?:\?|$)/, { timeout: 30000 });
  assert.match(page.url(), /redirect=/);
  await page.getByRole("textbox", { name: "Email address" }).waitFor();
}

test(
  "auth boundary redirects anonymous visitors from protected areas",
  { skip: !executablePath, timeout: 90000 },
  async () => {
    const browser = await chromium.launch({
      executablePath,
      headless: true,
      args: ["--no-sandbox", "--disable-gpu"],
    });
    try {
      const page = await browser.newPage();
      for (const route of ["/account", "/admin", "/admin/clients"]) {
        await gotoProtectedRoute(page, route);
      }
    } finally {
      await browser.close();
    }
  },
);

test(
  "admin authentication and workspace UAT",
  {
    skip: !executablePath || !authUatEnabled || !hasAdminCredentials,
    timeout: 120000,
  },
  async () => {
    const browser = await chromium.launch({
      executablePath,
      headless: true,
      args: ["--no-sandbox", "--disable-gpu"],
    });
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on("pageerror", (error) => console.error("Playwright page error:", error));
    try {
      await page.goto(`${appBase}/login?redirect=%2Fadmin`, {
        waitUntil: "networkidle",
        timeout: 30000,
      });
      await page.getByRole("textbox", { name: "Email address" }).fill(adminEmail!);
      await page.getByRole("textbox", { name: "Password" }).fill(adminPassword!);
      const signInButton = page.locator("form").getByRole("button", { name: "Sign in" });
      await page.waitForFunction(() => {
        const button = document.querySelector<HTMLButtonElement>('form button[type="submit"]');
        return Boolean(button && !button.disabled);
      });
      await signInButton.click({ force: true });
      await page.waitForFunction(() => /\/admin(?:\/|$)/.test(window.location.pathname), null, {
        timeout: 90000,
      });
      await page.getByRole("navigation", { name: "Admin navigation" }).waitFor({ timeout: 90000 });
      await page.getByRole("heading", { name: /Operations shortcuts/ }).waitFor({ timeout: 90000 });

      for (const route of [
        "/admin/clients",
        "/admin/bookings",
        "/admin/payments",
        "/admin/journal",
      ]) {
        await page.goto(`${appBase}${route}`, { waitUntil: "commit", timeout: 30000 });
        await page
          .getByRole("navigation", { name: "Admin navigation" })
          .waitFor({ timeout: 90000 });
        assert.doesNotMatch(await page.locator("body").innerText(), /Permission required/);
      }

      await page.screenshot({ path: "output/playwright/uat/admin-workspace.png", fullPage: false });
      await page.getByRole("button", { name: "Log out" }).click();
      await page.waitForFunction(() => /\/login$/.test(window.location.pathname));
      await page.goto(`${appBase}/admin`, { waitUntil: "commit", timeout: 30000 });
      await page.waitForFunction(() => /\/login$/.test(window.location.pathname));
    } finally {
      await context.close();
      await browser.close();
    }
  },
);

test(
  "therapist authentication and dashboard UAT",
  {
    skip: !executablePath || !authUatEnabled || !hasTherapistCredentials,
    timeout: 120000,
  },
  async () => {
    const browser = await chromium.launch({
      executablePath,
      headless: true,
      args: ["--no-sandbox", "--disable-gpu"],
    });
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on("pageerror", (error) => console.error("Playwright page error:", error));
    try {
      await page.goto(`${appBase}/login?redirect=%2Ftherapist`, {
        waitUntil: "networkidle",
        timeout: 30000,
      });
      await page.getByRole("textbox", { name: "Email address" }).fill(therapistEmail!);
      await page.getByRole("textbox", { name: "Password" }).fill(therapistPassword!);
      const signInButton = page.locator("form").getByRole("button", { name: "Sign in" });
      await page.waitForFunction(() => {
        const button = document.querySelector<HTMLButtonElement>('form button[type="submit"]');
        return Boolean(button && !button.disabled);
      });
      await signInButton.click({ force: true });
      await page.waitForFunction(() => window.location.pathname === "/therapist", null, {
        timeout: 90000,
      });
      await page.getByRole("heading", { name: /Welcome,/ }).waitFor({ timeout: 90000 });
      await page.getByText("Calendar connection", { exact: true }).waitFor({ timeout: 90000 });
      assert.doesNotMatch(await page.locator("body").innerText(), /Admin navigation/);

      await page.goto(`${appBase}/admin`, { waitUntil: "commit", timeout: 30000 });
      await page.waitForFunction(
        () => window.location.pathname !== "/admin" || window.location.search.includes("error="),
        null,
        { timeout: 90000 },
      );
      assert.notEqual(new URL(page.url()).pathname, "/admin");
      await page.screenshot({
        path: "output/playwright/uat/therapist-dashboard.png",
        fullPage: false,
      });
    } finally {
      await context.close();
      await browser.close();
    }
  },
);
