import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const migrationsUrl = new URL("../supabase/migrations/", import.meta.url);

test("SQL migrations do not contain shell-escaped quote fragments", async () => {
  const shellEscapedQuote = String.raw`'"'"'`;
  const files = (await readdir(migrationsUrl)).filter((file) => file.endsWith(".sql"));

  for (const file of files) {
    const sql = await readFile(new URL(file, migrationsUrl), "utf8");
    assert.equal(
      sql.includes(shellEscapedQuote),
      false,
      `${file} contains a shell-escaped quote fragment instead of valid SQL quoting`,
    );
  }
});
