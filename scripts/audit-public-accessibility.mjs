import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

import { chromium } from "playwright-core";

const require = createRequire(import.meta.url);
const axeSource = await readFile(require.resolve("axe-core/axe.min.js"), "utf8");
const baseUrl = (process.argv[2] || "http://127.0.0.1:4173").replace(/\/$/, "");
const outputPath = resolve(
  process.cwd(),
  process.argv[3] || "docs/qa/accessibility/public-accessibility-audit.json",
);
const routes = ["/", "/services", "/therapists", "/pricing", "/blog", "/contact", "/faqs"];
const executablePath =
  process.env.CHROME_PATH || process.env.GOOGLE_CHROME_BIN || "/usr/bin/google-chrome";

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  bypassCSP: true,
});
const page = await context.newPage();
const routeResults = [];

for (const route of routes) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle", timeout: 45_000 });
  await page.addScriptTag({ content: axeSource });
  const result = await page.evaluate(async () => {
    const audit = await globalThis.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
    });
    return {
      violations: audit.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        description: violation.description,
        help: violation.help,
        nodes: violation.nodes.map((node) => ({
          target: node.target,
          summary: node.failureSummary,
        })),
      })),
    };
  });
  routeResults.push({ route, ...result });
}

await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 45_000 });
await page.keyboard.press("Tab");
const firstFocus = await page.evaluate(() => ({
  text: document.activeElement?.textContent?.trim() ?? "",
  href: document.activeElement?.getAttribute("href") ?? "",
}));
await page.keyboard.press("Enter");
const skipTarget = await page.evaluate(() => ({
  id: document.activeElement?.id ?? "",
  tagName: document.activeElement?.tagName.toLowerCase() ?? "",
}));

const menuButton = page.getByRole("button", { name: "Open menu" });
await menuButton.click();
const dialog = page.getByRole("dialog", { name: "Site navigation" });
await dialog.waitFor({ state: "visible" });
await page.waitForFunction(() => Boolean(document.activeElement?.closest('[role="dialog"]')));
const initialMenuFocus = await page.evaluate(() => ({
  text: document.activeElement?.textContent?.trim() ?? "",
  insideDialog: Boolean(document.activeElement?.closest('[role="dialog"]')),
}));
await page.keyboard.press("Escape");
await menuButton.waitFor({ state: "visible" });
await page.waitForFunction(
  () => document.activeElement?.getAttribute("aria-label") === "Open menu",
);
const escapeFocus = await page.evaluate(
  () => document.activeElement?.getAttribute("aria-label") ?? "",
);

const cdp = await context.newCDPSession(page);
const accessibilityTree = await cdp.send("Accessibility.getFullAXTree");
const landmarkRoles = new Set(
  accessibilityTree.nodes
    .map((node) => node.role?.value)
    .filter((role) => ["banner", "main", "navigation", "contentinfo"].includes(role)),
);

const seriousViolations = routeResults.flatMap((result) =>
  result.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => ({ route: result.route, ...violation })),
);
const keyboardChecks = {
  skipLinkFirst: firstFocus.href === "#main" && /skip to content/i.test(firstFocus.text),
  skipLinkMovesFocus: skipTarget.id === "main" && skipTarget.tagName === "main",
  mobileMenuReceivesFocus: initialMenuFocus.insideDialog,
  escapeRestoresMenuButton: escapeFocus === "Open menu",
};
const landmarkChecks = {
  banner: landmarkRoles.has("banner"),
  main: landmarkRoles.has("main"),
  navigation: landmarkRoles.has("navigation"),
  contentinfo: landmarkRoles.has("contentinfo"),
};
const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  routes,
  summary: {
    seriousOrCriticalViolations: seriousViolations.length,
    keyboardChecksPassed: Object.values(keyboardChecks).every(Boolean),
    landmarkChecksPassed: Object.values(landmarkChecks).every(Boolean),
  },
  keyboardChecks,
  landmarkChecks,
  seriousViolations,
  routes: routeResults,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
await browser.close();

console.log(JSON.stringify(report.summary));
if (
  seriousViolations.length ||
  !Object.values(keyboardChecks).every(Boolean) ||
  !Object.values(landmarkChecks).every(Boolean)
) {
  process.exitCode = 1;
}
