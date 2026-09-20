import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { z } from "zod";
import { clientPhoneSchema } from "../src/lib/client-profile.ts";

function declarations(path: string, names: string[]) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const nodes = file.statements.filter((node) =>
    ts.isFunctionDeclaration(node)
      ? !!node.name && names.includes(node.name.text)
      : ts.isVariableStatement(node) &&
        node.declarationList.declarations.some(
          (item) => ts.isIdentifier(item.name) && names.includes(item.name.text),
        ),
  );
  assert.equal(
    nodes.length,
    names.length,
    "Every tested declaration must exist in production code",
  );
  return ts.transpileModule(nodes.map((node) => node.getText(file)).join("\n"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
}

test("actual checkout validator allows different therapists together but rejects duplicate instants", () => {
  const source = declarations("src/lib/booking.functions.ts", ["holdSlotInput", "holdSlotsInput"]);
  const schema = new Function("z", "clientPhoneSchema", `${source}\nreturn holdSlotsInput;`)(
    z,
    clientPhoneSchema,
  ) as z.ZodType;
  const first = {
    therapistId: "11111111-1111-4111-8111-111111111111",
    startsAt: "2030-10-01T09:00:00Z",
  };
  const second = { ...first, therapistId: "22222222-2222-4222-8222-222222222222" };
  const base = {
    serviceId: "33333333-3333-4333-8333-333333333333",
    mode: "online",
    templateKey: "booking",
    fullName: "Test Client",
    email: "client@example.test",
    phone: "+2348000000000",
    notes: "",
    consentAcknowledged: true,
  };
  assert.equal(schema.safeParse({ ...base, slots: [first, second] }).success, true);
  assert.equal(schema.safeParse({ ...base, slots: [first, first] }).success, false);
  assert.equal(
    schema.safeParse({
      ...base,
      slots: [first, { ...first, startsAt: "2030-10-01T10:00:00+01:00" }],
    }).success,
    false,
  );
  assert.equal(schema.safeParse({ ...base, slots: [] }).success, false);
  assert.equal(schema.safeParse({ ...base, slots: Array(11).fill(first) }).success, false);
  assert.equal(
    schema.safeParse({ ...base, slots: [first], consentAcknowledged: false }).success,
    false,
  );
});

test("legacy service writes omit the missing in-person price column without losing online pricing", () => {
  const source = declarations("src/lib/admin.functions.ts", ["servicePatch"]);
  const patch = new Function(`${source}\nreturn servicePatch;`)();
  const input = {
    code: "individual",
    slug: "individual",
    name: "Individual",
    description: "Support",
    durationMinutes: 60,
    sessionsPerPackage: 1,
    priceNgn: 55000,
    inPersonPriceNgn: 85000,
    currency: "NGN",
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 15,
    minimumLeadTimeMinutes: 60,
    displayOrder: 1,
    isActive: true,
  };
  assert.equal(patch(input).in_person_price_ngn, 85000);
  const fallback = patch(input, { includeInPersonPrice: false });
  assert.equal(Object.hasOwn(fallback, "in_person_price_ngn"), false);
  assert.equal(fallback.price_ngn, 55000);
  assert.equal(fallback.code, "individual");
});
