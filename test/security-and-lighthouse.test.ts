import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("server responses enforce CSP and HSTS", () => {
  const headers = read("src/lib/security-headers.ts");
  const server = read("src/server.ts");
  assert.match(headers, /Content-Security-Policy/);
  assert.match(headers, /Strict-Transport-Security/);
  assert.match(headers, /frame-ancestors 'none'/);
  assert.match(headers, /object-src 'none'/);
  assert.match(headers, /https:\/\/\*\.supabase\.co/);
  assert.match(headers, /https:\/\/\*\.googleusercontent\.com/);
  assert.match(server, /const normalized = await normalizeCatastrophicSsrResponse/);
  assert.match(server, /applySecurityHeaders\(applyPublicDocumentCache\(normalized/);
  assert.match(server, /getLoggedOutProtectedRedirect/);
  assert.match(server, /sb-\[\^=\]\*auth-token/);
  assert.match(server, /url\.pathname\.startsWith\("\/admin\/"\)/);
  assert.match(server, /url\.pathname\.startsWith\("\/account\/"\)/);
});

test("public Lighthouse audit covers four categories and principal routes", () => {
  const audit = read("scripts/audit-public-lighthouse.mjs");
  assert.match(audit, /"performance", "accessibility", "best-practices", "seo"/);
  assert.match(audit, /"\/services"/);
  assert.match(audit, /"\/therapists"/);
  assert.match(audit, /"\/contact"/);
  assert.match(audit, /threshold: 90/);
});
