import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { CheckCircle2, Loader2, XCircle, Clock } from "lucide-react";

import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Button } from "@/components/ui/button";
import { PaymentReceiptDetails } from "@/components/booking/PaymentReceiptDetails";
import { canonicalUrl } from "@/lib/seo";
import { verifyPaystackPayment, type VerifyPaystackResult } from "@/lib/payments.functions";

const search = z.object({
  reference: z.string().trim().min(1).optional(),
  trxref: z.string().trim().min(1).optional(),
});

export const Route = createFileRoute("/book/payment-callback")({
  validateSearch: (raw) => search.parse(raw),
  head: () => ({
    meta: [
      { title: "Verifying payment | Talk Space" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: canonicalUrl("/book/payment-callback") }],
  }),
  component: PaymentCallbackPage,
});

function PaymentCallbackPage() {
  const { reference, trxref } = Route.useSearch();
  const ref = reference || trxref || "";
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ok"; result: VerifyPaystackResult }
  >({ status: "loading" });

  useEffect(() => {
    if (!ref) {
      setState({ status: "error", message: "Missing payment reference." });
      return;
    }
    let active = true;
    void verifyPaystackPayment({ data: { reference: ref } })
      .then((res) => {
        if (res.status === "succeeded" && typeof window !== "undefined") {
          window.sessionStorage.removeItem("talk-space.booking-checkout.v1");
        }
        if (active) setState({ status: "ok", result: res });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "Verification failed.",
        });
      });
    return () => {
      active = false;
    };
  }, [ref]);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main id="main" className="flex-1 bg-background">
        <section className="mx-auto w-full max-w-2xl px-4 py-24 sm:px-6">
          <div className="rounded-2xl border border-border/70 bg-card p-8 shadow-sm">
            {state.status === "loading" ? (
              <div className="flex flex-col items-center text-center">
                <Loader2 className="h-8 w-8 animate-spin text-brand-deep" />
                <h1 className="mt-4 text-xl font-semibold text-brand-deep">
                  Verifying your payment…
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Hang tight while we confirm with Paystack.
                </p>
              </div>
            ) : state.status === "error" ? (
              <div className="flex flex-col items-center text-center">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-rose-100 text-rose-600">
                  <XCircle className="h-6 w-6" />
                </span>
                <h1 className="mt-4 text-xl font-semibold text-brand-deep">
                  We couldn't verify this payment
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">{state.message}</p>
                {ref ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Reference: <span className="ref-mono">{ref}</span>
                  </p>
                ) : null}
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <Button asChild variant="outline">
                    <Link to="/book">Back to booking</Link>
                  </Button>
                  <Button asChild className="bg-brand-deep text-white">
                    <a href="mailto:hello@talkspace.ng">Email support</a>
                  </Button>
                </div>
              </div>
            ) : state.result.status === "succeeded" ? (
              <div className="flex flex-col items-center text-center">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle2 className="h-6 w-6" />
                </span>
                <h1 className="mt-4 text-xl font-semibold text-brand-deep">Payment confirmed</h1>
                {state.result.bookingReviewRequired ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Your payment was received, but the booking needs review. Do not pay again.
                    Contact hello@talkspace.ng with payment reference {ref} to arrange rescheduling
                    or a refund review.
                  </p>
                ) : null}
                <div className="mt-4 w-full">
                  <PaymentReceiptDetails receipt={state.result} />
                </div>
                {state.result.bookingReference ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Booking reference:{" "}
                    <span className="ref-mono">{state.result.bookingReference}</span>
                  </p>
                ) : null}
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  {state.result.packageBookingUrl ? (
                    <Button asChild variant="outline">
                      <a href={state.result.packageBookingUrl}>Book from session credit</a>
                    </Button>
                  ) : null}
                  {state.result.bookingReference && !state.result.bookingReviewRequired ? (
                    <Button asChild variant="outline">
                      <Link
                        to="/manage/$reference"
                        params={{ reference: state.result.bookingReference }}
                      >
                        Manage booking
                      </Link>
                    </Button>
                  ) : null}
                  <Button asChild className="bg-brand-deep text-white">
                    <Link to="/">Back to home</Link>
                  </Button>
                </div>
              </div>
            ) : state.result.status === "pending" ? (
              <div className="flex flex-col items-center text-center">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-amber-100 text-amber-700">
                  <Clock className="h-6 w-6" />
                </span>
                <h1 className="mt-4 text-xl font-semibold text-brand-deep">Payment pending</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Paystack hasn't finalised this payment yet. We'll confirm as soon as it clears —
                  usually within a few minutes.
                </p>
                <div className="mt-6">
                  <Button asChild variant="outline">
                    <Link to="/">Back to home</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-rose-100 text-rose-600">
                  <XCircle className="h-6 w-6" />
                </span>
                <h1 className="mt-4 text-xl font-semibold text-brand-deep">
                  Payment not completed
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  The payment was not successful. Your slot may still be held — try again from your
                  booking.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <Button asChild variant="outline">
                    <Link to="/book">Try again</Link>
                  </Button>
                  <Button asChild className="bg-brand-deep text-white">
                    <a href="mailto:hello@talkspace.ng">Email support</a>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
