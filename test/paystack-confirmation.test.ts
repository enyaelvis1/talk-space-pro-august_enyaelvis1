import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { z } from "zod";
import * as validation from "../src/lib/payment-validation.ts";
import { summarizePaystackCheckout } from "../src/lib/paystack-checkout.ts";

const reference = "TSP-TEST-1234";
const result = {
  status: "success",
  amountKobo: 5593909,
  requestedAmountKobo: 5500000,
  feesKobo: 93909,
  currency: "NGN",
  providerReference: reference,
};
const validate = (overrides = {}, expectedAmountKobo = 5500000) =>
  validation.validateProviderPayment({
    expectedAmountKobo,
    expectedCurrency: "NGN",
    expectedReference: reference,
    result: { ...result, ...overrides },
  });

test("customer-paid fees preserve the exact charged kobo and an independent booking amount", () => {
  validate();
  const receipt = validation.paymentReceipt(result, 5500000);
  assert.deepEqual(receipt, {
    amountKobo: 5593909,
    bookingAmountKobo: 5500000,
    feesKobo: 93909,
    customerFeeKobo: 93909,
    currency: "NGN",
  });
  assert.deepEqual(validation.readPaymentReceipt({ paystack_receipt: receipt }), receipt);
});

test("merchant-absorbed fees are not added to the amount charged", () => {
  validate({ amountKobo: 5500000, feesKobo: 92500 });
  assert.equal(
    validation.paymentReceipt({ ...result, amountKobo: 5500000 }, 5500000).customerFeeKobo,
    0,
  );
  validate({ amountKobo: 5500051, requestedAmountKobo: 5500051 }, 5500051);
  validate({ amountKobo: 5500000, requestedAmountKobo: null, feesKobo: null });
});

test("underpayments, unexplained surcharges, invalid units, currency and references fail closed", () => {
  for (const overrides of [
    { amountKobo: 55000 },
    { amountKobo: 5499999 },
    { amountKobo: 5593910 },
    { requestedAmountKobo: 5400000 },
    { requestedAmountKobo: null },
    { feesKobo: null },
    { feesKobo: -1 },
    { feesKobo: NaN },
    { amountKobo: 5593909.5 },
    { amountKobo: Infinity },
    { amountKobo: Number.MAX_SAFE_INTEGER + 1 },
    { currency: "USD" },
    { providerReference: "OTHER" },
  ])
    assert.throws(() => validate(overrides), JSON.stringify(overrides));
  assert.throws(() => validate({}, 0));
  assert.equal(
    validation.readPaymentReceipt({
      paystack_receipt: { ...validation.paymentReceipt(result, 5500000), customerFeeKobo: 0 },
    }),
    null,
  );
});

test("API parsing retains provider fields and does not invent absent identity or money", () => {
  assert.deepEqual(
    validation.parsePaystackVerification({
      status: "success",
      amount: result.amountKobo,
      requested_amount: result.requestedAmountKobo,
      fees: result.feesKobo,
      currency: "NGN",
      reference,
    }),
    result,
  );
  const missing = validation.parsePaystackVerification({ status: "success" });
  assert.equal(missing.currency, "");
  assert.equal(missing.providerReference, "");
  assert.ok(Number.isNaN(missing.amountKobo));
});

const rows = [0, 1, 2].map((i) => ({
  reference: i ? `${reference}-${i + 1}` : reference,
  checkout_group_reference: reference,
  amount_kobo: 5500000,
  currency: "NGN",
  provider: "paystack",
  status: "initiated",
}));

test("checkout validation uses all session prices, rejects inconsistent records and handles legacy singles", () => {
  assert.deepEqual(summarizePaystackCheckout(rows, reference), {
    amountKobo: 16500000,
    currency: "NGN",
    alreadySucceeded: false,
  });
  assert.equal(
    summarizePaystackCheckout([{ ...rows[0], checkout_group_reference: null }], reference)
      .amountKobo,
    5500000,
  );
  assert.throws(() => summarizePaystackCheckout([], reference));
  for (const changes of [
    { currency: "USD" },
    { provider: "bank_transfer" },
    { amount_kobo: NaN },
    { checkout_group_reference: "other" },
  ]) {
    assert.throws(() =>
      summarizePaystackCheckout([rows[0], { ...rows[1], ...changes }], reference),
    );
  }
});

test("grouped checkout total remains distinct from each session amount", () => {
  const grouped = summarizePaystackCheckout(rows, reference);
  assert.equal(grouped.amountKobo, 16_500_000);
  assert.equal(rows[0].amount_kobo, 5_500_000);
  assert.notEqual(grouped.amountKobo, rows[0].amount_kobo);
});

// Execute the actual server-function handler with network and DB boundaries mocked.
function loadHandler(name: string, deps: Record<string, unknown>) {
  const path = "src/lib/payments.functions.ts";
  const text = readFileSync(path, "utf8");
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  let handler: ts.Expression | undefined;
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === name &&
        declaration.initializer &&
        ts.isCallExpression(declaration.initializer)
      ) {
        handler = declaration.initializer.arguments[0];
      }
    }
  }
  assert.ok(handler, `Handler ${name} exists`);
  const compiled = ts.transpileModule(`const handler = ${handler.getText(file)};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    transformers: {
      before: [
        (context) => (source) => {
          const visit: ts.Visitor = (node) =>
            ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
              ? ts.factory.createCallExpression(
                  ts.factory.createIdentifier("importModule"),
                  undefined,
                  [...node.arguments],
                )
              : ts.visitEachChild(node, visit, context);
          return ts.visitNode(source, visit) as ts.SourceFile;
        },
      ],
    },
  }).outputText;
  return new Function(...Object.keys(deps), `${compiled}\nreturn handler;`)(...Object.values(deps));
}

function fixture(
  options: { stored?: boolean; admin?: boolean; rpcError?: boolean; underpaid?: boolean } = {},
) {
  const verified = {
    ...result,
    requestedAmountKobo: 16500000,
    amountKobo: 16700000,
    feesKobo: 200000,
  };
  const receipt = validation.paymentReceipt(verified, 16500000);
  const calls = { verify: [] as string[], rpc: [] as Record<string, unknown>[], sync: 0, auth: 0 };
  const checkout = {
    ...summarizePaystackCheckout(rows, reference),
    alreadySucceeded: !!options.stored,
    payment: {
      appointments: { booking_reference: "TS-BOOK" },
      metadata: options.stored ? { paystack_receipt: receipt } : {},
    },
  };
  const db = {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => ({
                  data: {
                    reference: `${reference}-2`,
                    checkout_group_reference: reference,
                    provider: "paystack",
                  },
                  error: null,
                }),
              };
            },
          };
        },
      };
    },
    async rpc(_name: string, params: Record<string, unknown>) {
      calls.rpc.push(params);
      return { error: options.rpcError ? new Error("DB write failed") : null };
    },
  };
  const handler = loadHandler(
    options.admin ? "verifyPaystackPaymentForAdmin" : "verifyPaystackPayment",
    {
      ...validation,
      z,
      noStore() {},
      async requireAdmin() {
        calls.auth++;
      },
      async syncClientRecordsForSuccessfulPayment() {
        calls.sync++;
      },
      async syncGoogleForPaymentReference() {
        calls.sync++;
      },
      async sendPaymentEmailsForReference() {},
      async importModule() {
        return {
          supabaseAdmin: db,
          loadPaystackCheckout: async (ref: string) => {
            assert.equal(ref, reference);
            return checkout;
          },
          loadPaystackSecret: async () => "test-only",
          paystackVerify: async ({ reference: ref }: { reference: string }) => {
            calls.verify.push(ref);
            return options.underpaid ? { ...verified, amountKobo: 5500000 } : verified;
          },
        };
      },
    },
  );
  return { calls, receipt, run: () => handler({ data: { reference, paymentId: "test-id" } }) };
}

test("callback verifies the whole checkout, persists exact totals and propagates database failures", async () => {
  const f = fixture();
  const response = await f.run();
  assert.equal(response.amountKobo, 16700000);
  assert.equal(response.bookingAmountKobo, 16500000);
  assert.deepEqual(f.calls.verify, [reference]);
  assert.equal(f.calls.rpc[0].p_reference, reference);
  assert.deepEqual(f.calls.rpc[0].p_metadata, {
    verified_via: "callback",
    paystack_receipt: f.receipt,
  });
  const broken = fixture({ rpcError: true });
  await assert.rejects(broken.run, /DB write failed/);
  assert.equal(broken.calls.sync, 0);
  const underpaid = fixture({ underpaid: true });
  await assert.rejects(underpaid.run, /amount does not match/);
  assert.equal(underpaid.calls.rpc.length, 0);
});

test("successful callback refresh reuses the stored exact receipt without a Paystack request", async () => {
  const f = fixture({ stored: true });
  assert.equal((await f.run()).amountKobo, 16700000);
  assert.equal(f.calls.verify.length, 0);
  assert.equal(f.calls.rpc.length, 0);
});

test("admin verifies a child row against the parent checkout, including already-paid records", async () => {
  const f = fixture({ admin: true, stored: true });
  assert.equal((await f.run()).amountKobo, 16700000);
  assert.equal(f.calls.auth, 1);
  assert.deepEqual(f.calls.verify, [reference]);
  assert.equal(f.calls.rpc[0].p_reference, reference);
});

test("webhook and scheduled recheck use group totals and persist provider receipts", () => {
  for (const file of [
    "src/routes/api/public/paystack-webhook.ts",
    "src/routes/api/public/hooks/recheck-payments.ts",
  ]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /loadPaystackCheckout\(reference\)/);
    assert.match(source, /expectedAmountKobo: checkout.amountKobo/);
    assert.match(source, /paystack_receipt: paymentReceipt/);
  }
});
