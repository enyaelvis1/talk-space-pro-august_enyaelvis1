import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const testFiles = readdirSync("test")
  .filter((file) => file.endsWith(".test.ts"))
  .filter(
    (file) => process.env.SKIP_EGRESS_BROWSER !== "1" || file !== "egress-public-shell.e2e.test.ts",
  )
  .sort()
  .sort((left, right) => {
    const egressFirst = (file) => (file === "egress-public-shell.e2e.test.ts" ? -1 : 0);
    return egressFirst(left) - egressFirst(right);
  })
  .map((file) => `test/${file}`);

for (const testFile of testFiles) {
  const result = spawnSync(process.execPath, ["--experimental-strip-types", "--test", testFile], {
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
