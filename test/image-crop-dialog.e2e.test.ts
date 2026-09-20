import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { chromium } from "playwright-core";
import { createServer } from "vite";

/**
 * End-to-end regression for the admin image crop dialog.
 *
 * A tall portrait source (1080x2400) used to make the "Original" preset size the
 * preview frame to 520 / (1080/2400) ≈ 1156px tall, which pushed the dialog
 * footer off screen and left the editor looking frozen. This test drives a real
 * browser to prove the frame stays inside the viewport and that both footer
 * buttons remain clickable after picking "Original".
 */
const CHROMIUM_CANDIDATES = [
  process.env.CHROME_PATH,
  process.env.GOOGLE_CHROME_BIN,
  "/opt/ms-playwright/chromium-1194/chrome-linux/chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter((candidate): candidate is string => Boolean(candidate));

const executablePath = CHROMIUM_CANDIDATES.find((candidate) => existsSync(candidate));

test(
  "crop dialog stays usable on the Original preset with a tall portrait image",
  { skip: executablePath ? false : "No Chromium binary available in this environment." },
  async () => {
    const viewport = { width: 1280, height: 800 };
    const cacheDir = mkdtempSync(join(tmpdir(), "talkspace-crop-vite-"));
    const server = await createServer({
      configFile: false,
      cacheDir,
      root: fileURLToPath(new URL("..", import.meta.url)),
      plugins: [react(), tailwindcss()],
      resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
      server: { port: 0, host: "127.0.0.1" },
      logLevel: "silent",
    });
    await server.listen();
    const port = server.httpServer?.address();
    assert.ok(port && typeof port === "object", "harness server did not report a port");

    const browser = await chromium.launch({
      executablePath,
      headless: true,
      args: ["--no-sandbox", "--disable-gpu"],
    });

    try {
      const page = await browser.newPage({ viewport });
      await page.goto(`http://127.0.0.1:${port.port}/test/fixtures/crop-dialog-harness.html`, {
        waitUntil: "load",
        timeout: 60_000,
      });

      const frame = page.locator("[data-crop-frame]");
      await frame.waitFor({ state: "visible", timeout: 60_000 });

      // Switch to the preset that previously broke the layout.
      await page.getByRole("button", { name: "Original", exact: true }).click();
      // Let the re-render settle so the assertion reads the final frame size.
      await page.waitForTimeout(200);

      const frameBox = await frame.boundingBox();
      assert.ok(frameBox, "crop frame has no layout box");
      // The frame must fit the 520x400 preview box instead of growing to ~1156px.
      assert.ok(
        frameBox.height <= 401,
        `crop frame grew to ${frameBox.height}px on the Original preset`,
      );
      assert.ok(frameBox.width <= 521, `crop frame is ${frameBox.width}px wide`);

      const apply = page.getByRole("button", { name: /Apply & upload/i });
      const cancel = page.getByRole("button", { name: "Cancel", exact: true });

      for (const [name, button] of [
        ["Apply & upload", apply],
        ["Cancel", cancel],
      ] as const) {
        assert.equal(await button.isEnabled(), true, `${name} is disabled`);
        const box = await button.boundingBox();
        assert.ok(box, `${name} has no layout box`);
        assert.ok(
          box.y >= 0 && box.y + box.height <= viewport.height,
          `${name} sits outside the ${viewport.height}px viewport at y=${box.y}`,
        );
        // Playwright refuses to click an element that is covered or off screen,
        // so a successful hover proves the control is genuinely reachable.
        await button.hover({ timeout: 5_000 });
      }

      // Clicking Apply must actually run the export and hand back a file.
      await apply.click({ timeout: 10_000 });
      await page.waitForFunction(
        () => Boolean((window as unknown as { __cropped?: string }).__cropped),
        undefined,
        { timeout: 30_000 },
      );
      const croppedName = await page.evaluate(
        () => (window as unknown as { __cropped?: string }).__cropped,
      );
      assert.match(String(croppedName), /^tall-portrait-\d+x\d+\.png$/);
    } finally {
      await browser.close();
      await server.close();
      rmSync(cacheDir, { recursive: true, force: true });
    }
  },
);
