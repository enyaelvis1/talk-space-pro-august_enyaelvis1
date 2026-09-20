import { readFile } from "node:fs/promises";

import { createUsageReport, type UsageSnapshot } from "../src/lib/usage-budget.ts";

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: npm run usage:report -- path/to/redacted-usage.json");
  process.exitCode = 1;
} else {
  try {
    const snapshot = JSON.parse(await readFile(inputPath, "utf8")) as UsageSnapshot;
    console.log(JSON.stringify(createUsageReport(snapshot), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Could not read usage snapshot.");
    process.exitCode = 1;
  }
}
