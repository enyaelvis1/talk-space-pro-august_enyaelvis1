import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Minus, Plus, ShieldCheck } from "lucide-react";
import { z } from "zod";

import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getBookingPrefill, listBookingServices } from "@/lib/booking.functions";
import { initPackagePurchasePayment } from "@/lib/payments.functions";
import { clearPurchaseHandoff, loadPurchaseHandoff } from "@/lib/purchase-handoff";

const searchSchema = z.object({
  service: z.string().trim().optional(),
  mode: z.enum(["online", "in_person"]).optional(),
});

export const Route = createFileRoute("/purchase")({
  validateSearch: (search) => searchSchema.parse(search),
  loader: async () => {
    const [services, prefill] = await Promise.all([listBookingServices(), getBookingPrefill()]);
    return {
      services: services.filter((service) => service.priceNgn && service.priceNgn > 0),
      prefill,
    };
  },
  head: () => ({
    meta: [
      { title: "Purchase sessions | Talk Space" },
      {
        name: "description",
        content: "Purchase Talk Space session credit now and choose appointment times later.",
      },
    ],
  }),
  component: PurchaseSessionsPage,
});

function PurchaseSessionsPage() {
  const { services, prefill } = Route.useLoaderData();
  const search = Route.useSearch();
  const handoff = useMemo(() => loadPurchaseHandoff(), []);
  const initialService =
    services.find((service) => service.code === search.service) ??
    services.find(
      (service) => service.id === handoff?.serviceId || service.code === handoff?.serviceCode,
    ) ??
    services[0];
  const [serviceId, setServiceId] = useState(initialService?.id ?? "");
  const [sessionMode, setSessionMode] = useState<"online" | "in_person" | undefined>(
    search.mode ?? handoff?.mode,
  );
  const [preferredDate, setPreferredDate] = useState(handoff?.preferredDate ?? "");
  const [preferredTime, setPreferredTime] = useState(handoff?.preferredTime ?? "");
  const [sessions, setSessions] = useState(
    Math.max(1, handoff?.sessions ?? initialService?.sessionsPerPackage ?? 1),
  );
  const [name, setName] = useState(handoff?.fullName || prefill.fullName);
  const [email, setEmail] = useState(handoff?.email || prefill.email);
  const [phone, setPhone] = useState(handoff?.phone || prefill.phone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const service = useMemo(
    () => services.find((candidate) => candidate.id === serviceId),
    [serviceId, services],
  );
  const configuredPrice =
    sessionMode === "in_person"
      ? (service?.inPersonPriceNgn ?? service?.priceNgn ?? 0)
      : (service?.priceNgn ?? 0);
  const unitPrice = configuredPrice / Math.max(1, service?.sessionsPerPackage ?? 1);
  const total = unitPrice * sessions;

  async function beginPayment() {
    setError(null);
    if (!serviceId || !name.trim() || !email.trim() || !phone.trim()) {
      setError("Choose a service and enter your name, email, and phone.");
      return;
    }
    setBusy(true);
    try {
      const result = await initPackagePurchasePayment({
        data: {
          serviceId,
          clientName: name,
          clientEmail: email,
          clientPhone: phone,
          purchasedSessions: sessions,
          sessionMode,
          preferredDate: preferredDate || undefined,
          preferredTime: preferredTime || undefined,
        },
      });
      clearPurchaseHandoff();
      window.location.assign(result.authorizationUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Payment could not be started.");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface-page">
      <SiteHeader />
      <main id="main" className="flex-1">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:px-8 lg:py-20">
          <section>
            <p className="eyebrow">Purchase first, book later</p>
            <h1 className="mt-3 max-w-2xl font-display text-4xl text-brand-deep sm:text-5xl">
              Choose how many sessions you need.
            </h1>
            <p className="mt-4 max-w-2xl text-muted-foreground">
              Your payment creates secure session credit. Appointment dates can be selected now as a
              preference or booked later from the private link in your confirmation email.
            </p>

            <div className="mt-9 space-y-7 border-t border-border/70 pt-7">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Full name" value={name} onChange={setName} autoComplete="name" />
                <Field
                  label="Email"
                  value={email}
                  onChange={setEmail}
                  type="email"
                  autoComplete="email"
                />
                <Field label="Phone" value={phone} onChange={setPhone} autoComplete="tel" />
                <div className="space-y-2">
                  <Label htmlFor="purchase-service">Service</Label>
                  <Select
                    value={serviceId}
                    onValueChange={(value) => {
                      setServiceId(value);
                      const selected = services.find((item) => item.id === value);
                      setSessions(Math.max(1, selected?.sessionsPerPackage ?? 1));
                    }}
                  >
                    <SelectTrigger id="purchase-service">
                      <SelectValue placeholder="Choose service" />
                    </SelectTrigger>
                    <SelectContent>
                      {services.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Number of sessions</Label>
                <div className="mt-2 inline-grid grid-cols-[2.75rem_4rem_2.75rem] items-center rounded-md border border-border bg-card">
                  <button
                    type="button"
                    aria-label="Reduce sessions"
                    className="grid h-11 place-items-center"
                    onClick={() => setSessions((value) => Math.max(1, value - 1))}
                    disabled={sessions <= 1}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <output className="text-center font-semibold text-brand-deep">{sessions}</output>
                  <button
                    type="button"
                    aria-label="Increase sessions"
                    className="grid h-11 place-items-center"
                    onClick={() => setSessions((value) => Math.min(50, value + 1))}
                    disabled={sessions >= 50}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <fieldset>
                <legend className="text-sm font-medium text-brand-deep">
                  Session mode (optional)
                </legend>
                <div className="mt-2 flex flex-wrap gap-3">
                  {(["online", "in_person"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() =>
                        setSessionMode((current) => (current === mode ? undefined : mode))
                      }
                      className={`h-10 rounded-md border px-4 text-sm ${sessionMode === mode ? "border-brand-deep bg-brand-deep text-white" : "border-border bg-card text-brand-deep"}`}
                    >
                      {mode === "online" ? "Online" : "In-person"}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Preferred date"
                  value={preferredDate}
                  onChange={setPreferredDate}
                  type="date"
                />
                <Field
                  label="Preferred time"
                  value={preferredTime}
                  onChange={setPreferredTime}
                  type="time"
                />
              </div>
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
            </div>
          </section>

          <aside className="h-fit rounded-lg border border-border/70 bg-card p-6 shadow-sm lg:sticky lg:top-28">
            <ShieldCheck className="h-6 w-6 text-brand-deep" />
            <h2 className="mt-4 text-lg font-semibold text-brand-deep">Purchase summary</h2>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt>Service</dt>
                <dd className="text-right font-medium">{service?.name ?? "Choose service"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Sessions</dt>
                <dd className="font-medium">{sessions}</dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-border pt-3 text-base">
                <dt>Total</dt>
                <dd className="font-semibold text-brand-deep">
                  {total ? formatNaira(total) : "Unavailable"}
                </dd>
              </div>
            </dl>
            <Button
              className="mt-6 w-full bg-brand-deep text-white"
              onClick={() => void beginPayment()}
              disabled={busy || !total}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Continue to secure payment
            </Button>
            <Button asChild variant="ghost" className="mt-2 w-full">
              <Link to="/book">Book an appointment now</Link>
            </Button>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function formatNaira(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
}) {
  const id = label.toLowerCase().replace(/[^a-z]+/g, "-");
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
