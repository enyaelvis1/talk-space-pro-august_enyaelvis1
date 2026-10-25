import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const require = createRequire(import.meta.url);
const compiled = ts.transpileModule(read("src/components/site/GoogleReviewLink.tsx"), {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX,
  },
}).outputText;
const componentExports: Record<string, React.ComponentType<{ url: string; name: string }>> = {};
new Function("require", "exports", compiled)(require, componentExports);
const { GoogleReviewLink } = componentExports;
const render = (url: string, name = "Example reviewer") =>
  renderToStaticMarkup(React.createElement(GoogleReviewLink, { url, name }));

test("Google review cards render real external links with an accessible name", () => {
  for (const url of [
    "https://www.google.com/maps/place/Talk+Space/reviews",
    "https://maps.app.goo.gl/example",
    "https://g.page/example/review",
  ]) {
    const html = render(url);
    assert.ok(html.includes(`href="${url}"`));
    assert.match(html, /target="_blank"/);
    assert.match(html, /rel="noopener noreferrer"/);
    assert.match(html, /Read Example reviewer&#x27;s review on Google \(opens in a new tab\)/);
    assert.match(html, /Read on Google/);
    assert.match(html, /after:absolute after:inset-0/);
    assert.match(html, /focus-visible:after:ring-2/);
  }
});

test("review links reject malformed, executable and credential-bearing URLs", () => {
  for (const url of [
    "",
    "/reviews",
    "javascript:alert(1)",
    "data:text/html,unsafe",
    "ftp://example.test/review",
    "https://user:password@example.test/reviews",
  ]) {
    assert.equal(render(url), "");
  }
});

test("reviewer names and destination parameters are escaped by React", () => {
  const html = render(
    "https://www.google.com/maps?name=Talk&view=reviews",
    '<img src=x onerror="bad">',
  );
  assert.match(html, /name=Talk&amp;view=reviews/);
  assert.ok(!html.includes("<img src=x"));
  assert.match(html, /&lt;img/);
});

test("homepage wires only Google-sourced cards to the configured review destination", () => {
  const home = read("src/routes/index.tsx");
  assert.match(home, /reviewUrl: googleReviews\.reviewUrl/);
  assert.match(home, /<GoogleReviewLink url=\{slide\.reviewUrl\} name=\{slide\.review\.name\}/);
  assert.equal((home.match(/reviewUrl: undefined/g) ?? []).length, 2);
  assert.match(home, /<figure className="relative/);
  assert.match(home, /onFocus=\{\(\) => setIsPaused\(true\)\}/);
});

test("desktop and mobile navigation omit Login while retaining authenticated navigation", () => {
  const header = read("src/components/site/SiteHeader.tsx");
  assert.doesNotMatch(header, /to="\/login"|>Login</);
  assert.equal((header.match(/to=\{accountHref\}/g) ?? []).length, 2);
  assert.equal((header.match(/onClick=\{handleSignOut\}/g) ?? []).length, 2);
  assert.match(header, /isAdmin \? \(/);
  assert.match(header, /isTherapist \? \(/);
  assert.match(header, /useBrowserAuthState/);
  assert.match(read("src/routes/login.tsx"), /createFileRoute/);
});
