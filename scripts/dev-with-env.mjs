import { spawn } from "node:child_process";
import { config } from "dotenv";

// Vite normally gives .env.local precedence over .env. For local development,
// this command intentionally loads .env into process.env first; Vite preserves
// existing process values and therefore cannot replace them with .env.local.
config({ path: ".env", quiet: true });

const child = spawn("vite", ["dev", "--force", "--port", "8080", ...process.argv.slice(2)], {
  env: process.env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
