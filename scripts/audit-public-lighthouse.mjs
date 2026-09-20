import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";

const baseUrl = (process.argv[2] || "http://127.0.0.1:4173").replace(/\/$/, "");
const outputPath = resolve(
  process.cwd(),
  process.argv[3] || "docs/qa/lighthouse/public-mobile-lighthouse.json",
);
const routes = ["/", "/services", "/therapists", "/pricing", "/blog", "/contact", "/faqs"];
const categories = ["performance", "accessibility", "best-practices", "seo"];

for (const route of routes) {
  await fetch(`${baseUrl}${route}`);
}

const chrome = await launch({
  chromePath: process.env.CHROME_PATH || process.env.GOOGLE_CHROME_BIN,
  chromeFlags: ["--headless", "--no-sandbox", "--disable-gpu"],
});

try {
  const results = [];
  for (const route of routes) {
    const url = `${baseUrl}${route}`;
    const result = await lighthouse(url, {
      port: chrome.port,
      logLevel: "error",
      output: "json",
      onlyCategories: categories,
      formFactor: "mobile",
      screenEmulation: {
        mobile: true,
        width: 390,
        height: 844,
        deviceScaleFactor: 2,
        disabled: false,
      },
    });
    if (!result?.lhr) throw new Error(`Lighthouse did not return a result for ${route}.`);

    const scores = Object.fromEntries(
      categories.map((category) => [
        category,
        Math.round((result.lhr.categories[category]?.score ?? 0) * 100),
      ]),
    );
    results.push({ route, url, scores });
    console.log(`${route} ${JSON.stringify(scores)}`);
  }

  const minimumScores = Object.fromEntries(
    categories.map((category) => [
      category,
      Math.min(...results.map((row) => row.scores[category])),
    ]),
  );
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    routes,
    threshold: 90,
    minimumScores,
    results,
  };
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ minimumScores }));

  if (Object.values(minimumScores).some((score) => score < report.threshold)) {
    process.exitCode = 1;
  }
} finally {
  await chrome.kill();
}
