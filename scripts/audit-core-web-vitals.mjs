import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";

const url = process.argv[2] || "http://127.0.0.1:4173";
const outputPath = resolve(
  process.cwd(),
  process.argv[3] || "docs/qa/performance/home-core-web-vitals.json",
);

// Warm the application and its server-side data loaders before measuring the
// browser experience. This avoids treating local DNS startup as application work.
await fetch(url);
await fetch(url);

const chrome = await launch({
  chromePath: process.env.CHROME_PATH || process.env.GOOGLE_CHROME_BIN,
  chromeFlags: ["--headless", "--no-sandbox", "--disable-gpu"],
});

try {
  const result = await lighthouse(url, {
    port: chrome.port,
    logLevel: "error",
    output: "json",
    onlyCategories: ["performance"],
    formFactor: "mobile",
    screenEmulation: {
      mobile: true,
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      disabled: false,
    },
  });
  if (!result?.lhr) throw new Error("Lighthouse did not return an audit result.");

  const { lhr } = result;
  const metric = (id) => ({
    value: lhr.audits[id]?.numericValue ?? null,
    displayValue: lhr.audits[id]?.displayValue ?? null,
    score: lhr.audits[id]?.score ?? null,
  });
  const report = {
    generatedAt: new Date().toISOString(),
    url,
    userAgent: lhr.userAgent,
    performanceScore: Math.round((lhr.categories.performance?.score ?? 0) * 100),
    metrics: {
      firstContentfulPaint: metric("first-contentful-paint"),
      largestContentfulPaint: metric("largest-contentful-paint"),
      totalBlockingTime: metric("total-blocking-time"),
      cumulativeLayoutShift: metric("cumulative-layout-shift"),
      speedIndex: metric("speed-index"),
    },
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report));

  const passed =
    report.performanceScore >= 90 &&
    report.metrics.largestContentfulPaint.value !== null &&
    report.metrics.largestContentfulPaint.value <= 2_500 &&
    report.metrics.totalBlockingTime.value !== null &&
    report.metrics.totalBlockingTime.value <= 200 &&
    report.metrics.cumulativeLayoutShift.value !== null &&
    report.metrics.cumulativeLayoutShift.value <= 0.1;
  if (!passed) process.exitCode = 1;
} finally {
  await chrome.kill();
}
