import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { chromium } from "playwright-core";
import { createServer } from "vite";

export const executablePath = [
  process.env.CHROME_PATH,
  process.env.GOOGLE_CHROME_BIN,
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].find((path) => path && existsSync(path));

export async function feedbackHarness() {
  const cacheDir = mkdtempSync(join(tmpdir(), "talkspace-feedback-vite-"));
  const server = await createServer({
    configFile: false,
    cacheDir,
    root: fileURLToPath(new URL("..", import.meta.url)),
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: [
        {
          find: "@/components/progress/AdminSidebar",
          replacement: fileURLToPath(new URL("./fixtures/admin-shell-stub.tsx", import.meta.url)),
        },
        { find: "@", replacement: fileURLToPath(new URL("../src", import.meta.url)) },
      ],
    },
    server: { port: 0, host: "127.0.0.1" },
    logLevel: "silent",
  });
  await server.listen();
  try {
    const address = server.httpServer?.address();
    assert.ok(address && typeof address === "object");
    const browser = await chromium.launch({
      executablePath,
      headless: true,
      args: ["--no-sandbox"],
    });
    return {
      browser,
      url: `http://127.0.0.1:${address.port}/test/fixtures/feedback-harness.html`,
      async close() {
        await browser.close();
        await server.close();
        rmSync(cacheDir, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await server.close();
    rmSync(cacheDir, { recursive: true, force: true });
    throw error;
  }
}
