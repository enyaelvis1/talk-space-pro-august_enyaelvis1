import { execFileSync } from "node:child_process";

const SECRET_PATTERNS = [
  /sk_live_[A-Za-z0-9_=-]{8,}/g,
  /sk_test_[A-Za-z0-9_=-]{8,}/g,
  /ghp_[A-Za-z0-9]{20,}/g,
  /github_pat_[A-Za-z0-9_]{20,}/g,
  /xox[baprs]-[A-Za-z0-9-]{10,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /AIza[0-9A-Za-z_-]{20,}/g,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
];

const TEXT_EXTENSIONS = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".json",
  ".md",
  ".yml",
  ".yaml",
  ".css",
  ".html",
]);

const NODE_CHECK_EXTENSIONS = new Set([".js", ".mjs", ".cjs"]);
const ESLINT_EXTENSIONS = new Set([".ts", ".tsx"]);

function run(command, args, options = {}) {
  execFileSync(command, args, { stdio: "inherit", ...options });
}

function getStagedFiles() {
  const output = execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMR"], {
    encoding: "utf8",
  });

  return output
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function scanSecrets() {
  const diff = execFileSync("git", ["diff", "--cached", "--unified=0", "--no-ext-diff"], {
    encoding: "utf8",
  });

  const hits = SECRET_PATTERNS.flatMap((pattern) => diff.match(pattern) ?? []);
  if (hits.length > 0) {
    throw new Error(
      `Potential secret material detected in staged diff: ${hits[0]}. Remove it before committing.`,
    );
  }
}

function main() {
  const stagedFiles = getStagedFiles();
  if (stagedFiles.length === 0) {
    return;
  }

  scanSecrets();

  const textFiles = stagedFiles.filter((file) => {
    const dot = file.lastIndexOf(".");
    return dot !== -1 && TEXT_EXTENSIONS.has(file.slice(dot));
  });

  if (textFiles.length > 0) {
    run("npx", ["prettier", "--check", ...textFiles]);
  }

  const nodeCheckFiles = stagedFiles.filter((file) => {
    const dot = file.lastIndexOf(".");
    return dot !== -1 && NODE_CHECK_EXTENSIONS.has(file.slice(dot));
  });

  if (nodeCheckFiles.length > 0) {
    run("node", ["--check", ...nodeCheckFiles]);
  }

  const eslintFiles = stagedFiles.filter((file) => {
    const dot = file.lastIndexOf(".");
    return dot !== -1 && ESLINT_EXTENSIONS.has(file.slice(dot));
  });

  if (eslintFiles.length > 0) {
    run("npx", ["eslint", "--max-warnings", "0", ...eslintFiles]);
  }
}

main();
