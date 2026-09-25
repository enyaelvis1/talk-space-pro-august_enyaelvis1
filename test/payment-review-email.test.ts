import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

test("payment review receipt does not promise a booked slot or disclose unusable links", async () => {
  const source = (
    await readFile(new URL("../src/lib/email-templates.server.ts", import.meta.url), "utf8")
  )
    .replace(
      "@/lib/first-time-assessments",
      new URL("../src/lib/first-time-assessments.ts", import.meta.url).href,
    )
    .replace("@/lib/talkspace", new URL("../src/lib/talkspace.ts", import.meta.url).href);
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  const { renderEmailTemplate } = await import(
    `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
  );
  const result = renderEmailTemplate("payment_booking_review", {
    paymentReference: "TEST-PAID",
    bookingReference: "TEST-BOOK",
    amountKobo: 19900,
    currency: "NGN",
    startsAt: "2030-10-01T09:00:00Z",
    meetingLink: "https://meet.google.com/should-not-appear",
    packageBookingUrl: "https://example.test/book?package=should-not-appear",
  });
  assert.match(result.html, /TEST-PAID/);
  assert.match(result.html, /199/);
  assert.match(result.html, /Please do not pay again/);
  assert.match(result.html, /refund/);
  assert.doesNotMatch(
    result.html,
    /should-not-appear|Session time|session is confirmed|remaining session/,
  );
});

test("in-person email templates use the admin-managed physical session address", async () => {
  const source = (
    await readFile(new URL("../src/lib/email-templates.server.ts", import.meta.url), "utf8")
  )
    .replace(
      "@/lib/first-time-assessments",
      new URL("../src/lib/first-time-assessments.ts", import.meta.url).href,
    )
    .replace("@/lib/talkspace", new URL("../src/lib/talkspace.ts", import.meta.url).href);
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  const { renderEmailTemplate } = await import(
    `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
  );
  const result = renderEmailTemplate("booking_confirmation", {
    clientName: "Test Client",
    reference: "TEST-BOOK",
    serviceName: "Individual therapy",
    therapistName: "Test Therapist",
    startsAt: "2030-10-01T09:00:00Z",
    mode: "in_person",
    location: "Lagos, NG",
    physicalSessionAddress: "New clinic address, Ikeja, Lagos",
  });
  assert.match(result.html, /New clinic address, Ikeja, Lagos/);
  assert.doesNotMatch(result.html, /Abiodun Oshowole|Estaport/);
});
