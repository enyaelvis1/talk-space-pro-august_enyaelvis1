import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

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

const therapistData = {
  reference: "TS-PRIVACY-001",
  clientName: "Precious Client",
  clientEmail: "precious.client@example.test",
  clientPhone: "+234 700 000 0000",
  therapistName: "Grace Therapist",
  serviceName: "Individual Therapy",
  startsAt: "2030-09-29T10:00:00Z",
  mode: "online",
  meetingLink: "https://meet.google.com/example-room",
};

test("therapist booking notices omit client email and phone", () => {
  const result = renderEmailTemplate("therapist_booking_notice", therapistData);

  assert.match(result.html, /Precious Client/);
  assert.doesNotMatch(result.html, /Client email|Client phone/);
  assert.doesNotMatch(result.html, /precious\.client@example\.test|\+234 700 000 0000/);
});

test("therapist template overrides cannot reintroduce client contact placeholders", () => {
  const result = renderEmailTemplate(
    "therapist_booking_notice",
    therapistData,
    "Client email: {{clientEmail}}\n\nClient phone: {{clientPhone}}",
  );

  assert.doesNotMatch(result.html, /precious\.client@example\.test|\+234 700 000 0000/);
});
