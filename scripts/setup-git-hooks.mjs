import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

function main() {
  if (!existsSync(".git")) {
    return;
  }

  try {
    execFileSync("git", ["config", "core.hooksPath", ".githooks"], {
      stdio: "ignore",
    });
  } catch {
    // Hook setup is best-effort. The repo still works if git config is unavailable.
  }
}

main();
