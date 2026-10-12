import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import {
  bookingNeedsPaymentReview,
  canRestorePaidBankBooking,
  isActivePaymentReview,
  paymentLifecycleLabel,
  type PaymentBookingState,
} from "../src/lib/payment-booking-review.ts";
import { readPaymentReceipt } from "../src/lib/payment-validation.ts";

function loadFunction(path: string, name: string, deps: Record<string, unknown>) {
  const file = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
  let expression: ts.Expression | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) {
      expression = ts.isCallExpression(node.initializer!)
        ? node.initializer.arguments[0]
        : node.initializer;
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  assert.ok(expression, `${name} exists`);
  const compiled = ts.transpileModule(`const fn = ${expression.getText(file)};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    transformers: {
      before: [
        (context) => (source) => {
          const rewrite: ts.Visitor = (node) =>
            ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
              ? ts.factory.createCallExpression(
                  ts.factory.createIdentifier("importModule"),
                  undefined,
                  [...node.arguments],
                )
              : ts.visitEachChild(node, rewrite, context);
          return ts.visitNode(source, rewrite) as ts.SourceFile;
        },
      ],
    },
  }).outputText;
  return new Function(...Object.keys(deps), `${compiled}; return fn;`)(...Object.values(deps));
}

const paid: PaymentBookingState = {
  status: "succeeded",
  provider: "paystack",
  bookingReviewRequired: true,
  appointmentStatus: "cancelled",
  appointmentArchivedAt: null,
  appointmentStartsAt: "2030-10-08T09:00:00Z",
};

test("archived cancelled payments leave active review but remain honest paid history", () => {
  for (const provider of ["paystack", "bank_transfer"]) {
    const row = { ...paid, provider, appointmentArchivedAt: "2030-10-07T08:00:00Z" };
    assert.equal(isActivePaymentReview(row), false);
    assert.equal(paymentLifecycleLabel(row), "Verified payment · cancelled booking archived");
    assert.equal(canRestorePaidBankBooking(row), false);
    assert.equal(row.status, "succeeded");
    assert.equal(
      isActivePaymentReview({ ...row, appointmentArchivedAt: null }),
      true,
      "unarchiving must bring unresolved paid cancellations back into review",
    );
  }
});

test("unarchived paid cancellations and pending approvals remain actionable", () => {
  assert.equal(isActivePaymentReview(paid), true);
  assert.match(paymentLifecycleLabel(paid), /reschedule required/);
  assert.equal(
    isActivePaymentReview({
      ...paid,
      provider: "bank_transfer",
      status: "awaiting_confirmation",
      bookingReviewRequired: false,
    }),
    true,
  );
  assert.equal(
    isActivePaymentReview({ ...paid, status: "initiated", bookingReviewRequired: false }),
    true,
  );
});

test("fulfilled, refunded and package payments do not inherit stale review flags", () => {
  for (const status of ["confirmed", "completed", "no_show"]) {
    assert.equal(bookingNeedsPaymentReview("succeeded", "appointment", status), false);
  }
  for (const status of ["cancelled", "hold", "pending_payment", null]) {
    assert.equal(bookingNeedsPaymentReview("succeeded", "appointment", status), true);
  }
  for (const status of ["refunded", "failed", "cancelled", "initiated"]) {
    assert.equal(bookingNeedsPaymentReview(status, "appointment", "cancelled"), false);
  }
  assert.equal(bookingNeedsPaymentReview("succeeded", "package_purchase", null), false);
  assert.match(paymentLifecycleLabel({ ...paid, status: "refunded" }), /^Refunded/);
  assert.match(
    paymentLifecycleLabel({
      ...paid,
      appointmentStatus: "completed",
      bookingReviewRequired: false,
    }),
    /session completed/,
  );
});

test("restore is restricted to future unarchived paid cancelled bank bookings", () => {
  const row = { ...paid, provider: "bank_transfer" };
  const now = Date.parse("2030-10-07T10:00:00Z");
  assert.equal(canRestorePaidBankBooking(row, now), true);
  for (const changes of [
    { status: "awaiting_confirmation" },
    { provider: "paystack" },
    { appointmentStatus: "confirmed" },
    { appointmentStatus: "completed" },
    { appointmentArchivedAt: "2030-10-07T08:00:00Z" },
    { appointmentStartsAt: "2030-10-07T09:00:00Z" },
    { appointmentStartsAt: "2030-10-07T10:00:00Z" },
    { appointmentStartsAt: "invalid" },
    { bookingReviewRequired: false },
  ])
    assert.equal(canRestorePaidBankBooking({ ...row, ...changes }, now), false);
});

test("admin status handler rejects settled-payment downgrade before any RPC", async () => {
  for (const [previous, next] of [
    ["succeeded", "failed"],
    ["succeeded", "initiated"],
    ["succeeded", "awaiting_confirmation"],
    ["succeeded", "cancelled"],
    ["refunded", "succeeded"],
  ]) {
    let authCalls = 0;
    let writes = 0;
    const query = {
      select() {
        return this;
      },
      eq() {
        return this;
      },
      async maybeSingle() {
        return { error: null, data: { status: previous, reference: "TEST-SETTLED" } };
      },
    };
    const handler = loadFunction("src/lib/payments.functions.ts", "updatePaymentStatusForAdmin", {
      requireAdmin: async () => {
        authCalls++;
      },
      importModule: async () => ({
        supabaseAdmin: {
          from: () => query,
          rpc: () => {
            writes++;
          },
        },
      }),
    });
    await assert.rejects(
      handler({ data: { paymentId: "TEST-ID", status: next } }),
      /Settled payments cannot be reset/,
    );
    assert.equal(authCalls, 1);
    assert.equal(writes, 0);
  }
});

test("bank approval UI does not announce booking confirmation when commitment failed", async () => {
  for (const bookingConfirmed of [false, true]) {
    const messages: string[] = [];
    const handler = loadFunction("src/routes/_authenticated.admin.payments.tsx", "submitReview", {
      reviewing: { id: "TEST-TRANSFER" },
      reviewNote: "synthetic review",
      stepUp: { requestStepUp: async () => true },
      setReviewBusy: () => {},
      setReviewing: () => {},
      refresh: async () => {},
      verifyBankTransferPayment: async () => ({ bookingConfirmed }),
      toast: {
        success: (msg: string) => messages.push(msg),
        warning: (msg: string) => messages.push(msg),
        error: (msg: string) => messages.push(msg),
      },
    });
    await handler(true);
    assert.equal(messages.length, 1);
    if (bookingConfirmed) assert.match(messages[0], /booking confirmed/);
    else {
      assert.match(messages[0], /still needs rescheduling or refund review/);
      assert.doesNotMatch(messages[0], /booking confirmed/);
    }
  }
});

// Execute the real admin mapper with a mocked read-only Supabase boundary.
test("admin payment mapper loads archive state in one query and ignores stale fulfilled flags", async () => {
  const path = "src/lib/payments.functions.ts";
  const source = ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const declaration = source.statements.find(
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === "loadPaymentsForAdmin",
  );
  assert.ok(declaration);
  let queryCount = 0;
  let projection = "";
  const db = {
    from() {
      queryCount++;
      return {
        select(value: string) {
          projection = value;
          return this;
        },
        order() {
          return this;
        },
        async limit() {
          return {
            error: null,
            data: [
              {
                id: "TEST-ARCHIVED",
                status: "succeeded",
                payment_kind: "appointment",
                amount_kobo: 5500000,
                reference: "TEST-PAID",
                metadata: {},
                appointments: {
                  status: "cancelled",
                  archived_at: "2030-10-07T08:00:00Z",
                  starts_at: paid.appointmentStartsAt,
                  manage_token_revocation_reason: "checkout_expired",
                },
              },
              {
                id: "TEST-FULFILLED",
                status: "succeeded",
                payment_kind: "appointment",
                amount_kobo: 5500000,
                reference: "TEST-RESOLVED",
                metadata: { booking_review_required: true },
                appointments: { status: "confirmed" },
              },
              {
                id: "TEST-REFUNDED",
                status: "refunded",
                payment_kind: "appointment",
                amount_kobo: 5500000,
                reference: "TEST-REFUND",
                metadata: { booking_review_required: true },
                appointments: { status: "cancelled" },
              },
            ],
          };
        },
      };
    },
  };
  const compiled = ts.transpileModule(
    declaration
      .getText(source)
      .replace('await import("@/integrations/supabase/client.server")', "await importModule()"),
    {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    },
  ).outputText;
  const load = new Function(
    "importModule",
    "noStore",
    "bookingNeedsPaymentReview",
    "readPaymentReceipt",
    `${compiled}; return loadPaymentsForAdmin;`,
  )(
    async () => ({ supabaseAdmin: db }),
    () => {},
    bookingNeedsPaymentReview,
    readPaymentReceipt,
  );
  const rows = await load();
  assert.equal(queryCount, 1);
  assert.match(projection, /archived_at/);
  assert.equal(rows[0].appointmentArchivedAt, "2030-10-07T08:00:00Z");
  assert.equal(rows[0].bookingReviewReason, "checkout_expired");
  assert.equal(isActivePaymentReview(rows[0]), false);
  assert.equal(rows[1].bookingReviewRequired, false);
  assert.equal(rows[2].bookingReviewRequired, false);
});
