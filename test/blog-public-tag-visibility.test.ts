import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const blogRoute = await readFile(new URL("../src/routes/blog.tsx", import.meta.url), "utf8");
const blogArticle = await readFile(
  new URL("../src/components/content/BlogPostArticle.tsx", import.meta.url),
  "utf8",
);

test("live blog pages hide public tags", () => {
  assert.doesNotMatch(blogRoute, /p\.tags\.length \? ` · \$\{p\.tags\[0\]\}` : ""/);
  assert.doesNotMatch(
    blogArticle,
    /post\.tags\.length \? ` · \$\{post\.tags\.join\(", "\)\}` : ""/,
  );
  assert.doesNotMatch(blogRoute, /p\.tags/);
  assert.doesNotMatch(blogArticle, /post\.tags/);
});
