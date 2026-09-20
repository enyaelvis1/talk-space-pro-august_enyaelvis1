import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { z } from "zod";

import { SiteBreadcrumbs } from "@/components/site/SiteBreadcrumbs";
import { SiteFooter } from "@/components/site/SiteFooter";
import { FirstTimeAssessmentLinks } from "@/components/site/FirstTimeAssessmentLinks";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { canonicalUrl } from "@/lib/seo";
import {
  cancelAppointment,
  getAppointmentByManageToken,
  listAvailableSlots,
  rescheduleAppointment,
  type AvailableSlot,
  type ManagedAppointment,
} from "@/lib/booking.functions";

const searchSchema = z.object({
  token: z.string().trim().min(1).optional(),
});

export const Route = createFileRoute("/manage/$reference")({
  validateSearch: (input) => searchSchema.parse(input),
  head: ({ params }) => ({
    meta: [
      { title: `Manage booking ${params.reference} | Talk Space` },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
      {
        name: "description",
        content:
          "Reschedule or cancel your Talk Space booking with the manage link we emailed you.",
      },
    ],
    links: [{ rel: "canonical", href: canonicalUrl(`/manage/${params.reference}`) }],
  }),
  component: ManagePage,
});

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(new Date(value));
}

function ManagePage() {
  const { reference } = Route.useParams();
  const { token: tokenFromUrl } = useSearch({ from: Route.id });
  const navigate = useNavigate();
  const [token, setToken] = useState(tokenFromUrl ?? "");
  const [appointment, setAppointment] = useState<ManagedAppointment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const lookupSequence = useRef(0);
  const invalidateLookup = useCallback(() => {
    lookupSequence.current++;
  }, []);
  const lookup = useCallback(
    async (t: string) => {
      const sequence = ++lookupSequence.current;
      setLoading(true);
      setError(null);
      setAppointment(null);
      try {
        const found = await getAppointmentByManageToken({ data: { manageToken: t } });
        if (sequence !== lookupSequence.current) return;
        if (!found) {
          setError(
            "This link is invalid, expired, or revoked. If you already paid, contact hello@talkspace.ng with your payment reference; do not pay again.",
          );
          setAppointment(null);
          return;
        }
        if (found.bookingReference !== reference) {
          setError("That manage link doesn't match this booking reference.");
          setAppointment(null);
          return;
        }
        setAppointment(found);
      } catch (err) {
        if (sequence !== lookupSequence.current) return;
        setError(err instanceof Error ? err.message : "Lookup failed.");
      } finally {
        if (sequence === lookupSequence.current) setLoading(false);
      }
    },
    [reference],
  );

  useEffect(() => {
    setToken(tokenFromUrl ?? "");
    setAppointment(null);
    setError(null);
    setLoading(false);
    if (tokenFromUrl) void lookup(tokenFromUrl);
    return invalidateLookup;
  }, [tokenFromUrl, lookup, invalidateLookup]);

  async function onLookupSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    if (token.trim() === tokenFromUrl) {
      await lookup(token.trim());
      return;
    }
    await navigate({
      to: "/manage/$reference",
      params: { reference },
      search: { token: token.trim() },
      replace: true,
    });
  }

  async function onCancel(reason: string) {
    if (!appointment) return;
    if (!confirm("Cancel this booking? This can't be undone.")) return;
    setBusy(true);
    try {
      await cancelAppointment({
        data: { appointmentId: appointment.id, reason, manageToken: token },
      });
      toast.success("Booking cancelled.");
      await lookup(token);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't cancel booking.");
    } finally {
      setBusy(false);
    }
  }

  async function onReschedule(newStartsAt: string) {
    if (!appointment) return;
    setBusy(true);
    try {
      await rescheduleAppointment({
        data: { appointmentId: appointment.id, newStartsAt, manageToken: token },
      });
      toast.success("Booking rescheduled.");
      await lookup(token);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't reschedule booking.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <SiteBreadcrumbs />
      <main id="main" className="flex-1 bg-background py-12 sm:py-16">
        <section className="mx-auto w-full max-w-2xl px-4 sm:px-6 lg:px-8">
          <p className="eyebrow">Manage booking</p>
          <h1 className="display-2 mt-2 text-brand-deep">Booking {reference}</h1>
          <p className="mt-3 text-muted-foreground">
            Enter the manage token from your confirmation email to view, reschedule, or cancel this
            booking. Changes must be made at least 48 hours before the session.
          </p>

          {!appointment ? (
            <form
              onSubmit={onLookupSubmit}
              className="mt-8 space-y-3 rounded-2xl border border-border/70 bg-card p-6"
            >
              <Label htmlFor="token">Manage token</Label>
              <Input
                id="token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste your manage token"
                required
              />
              {error ? <p className="text-sm text-danger">{error}</p> : null}
              <Button type="submit" disabled={loading} className="bg-brand-deep text-white">
                {loading ? "Looking up…" : "Find booking"}
              </Button>
            </form>
          ) : (
            <AppointmentPanel
              appointment={appointment}
              busy={busy}
              onCancel={onCancel}
              onReschedule={onReschedule}
            />
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function AppointmentPanel({
  appointment,
  busy,
  onCancel,
  onReschedule,
}: {
  appointment: ManagedAppointment;
  busy: boolean;
  onCancel: (reason: string) => void;
  onReschedule: (newStartsAt: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [rescheduling, setRescheduling] = useState(false);
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const minDate = useMemo(() => new Date().toISOString().split("T")[0], []);

  const closed = ["cancelled", "completed", "no_show"].includes(appointment.status);

  useEffect(() => {
    if (!rescheduling || !date) {
      setSlots([]);
      return;
    }
    let active = true;
    setSlotsLoading(true);
    setSelectedSlot("");
    void listAvailableSlots({
      data: { serviceId: appointment.serviceId, from: date, to: date, mode: appointment.mode },
    })
      .then((s) => {
        if (active)
          setSlots(s.filter((slot: AvailableSlot) => slot.therapistId === appointment.therapistId));
      })
      .catch(() => {
        if (active) {
          setSlots([]);
          toast.error("Couldn't load availability. Please try again.");
        }
      })
      .finally(() => {
        if (active) setSlotsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [rescheduling, date, appointment.serviceId, appointment.mode, appointment.therapistId]);

  return (
    <div className="mt-8 space-y-6">
      <div className="rounded-2xl border border-border/70 bg-card p-6">
        <dl className="grid gap-3 text-sm">
          <Row label="Name" value={appointment.clientName} />
          <Row label="Email" value={appointment.clientEmail} />
          <Row
            label="Session mode"
            value={appointment.mode === "online" ? "Online" : "In-person"}
          />
          <Row label="Starts at" value={formatDateTime(appointment.startsAt)} />
          <Row label="Status" value={appointment.status.replace(/_/g, " ")} />
          {appointment.cancelledAt ? (
            <Row label="Cancelled at" value={formatDateTime(appointment.cancelledAt)} />
          ) : null}
        </dl>
      </div>

      <FirstTimeAssessmentLinks />

      {appointment.package ? (
        <div className="rounded-2xl border border-brand-mint/40 bg-brand-mint-soft p-6 text-brand-deep">
          <p className="font-medium">Package balance</p>
          <p className="mt-2 text-sm text-brand-deep/75">
            {appointment.package.remainingSessions} of {appointment.package.purchasedSessions}{" "}
            session(s) remaining.
          </p>
          {appointment.package.remainingSessions > 0 && appointment.package.bookingUrl ? (
            <Button asChild className="mt-4 bg-brand-deep text-white hover:bg-brand-deep/90">
              <a href={appointment.package.bookingUrl}>Book another package session</a>
            </Button>
          ) : (
            <p className="mt-3 text-sm text-brand-deep/75">
              This package has been fully used. Contact hello@talkspace.ng if you need help.
            </p>
          )}
        </div>
      ) : null}

      {closed ? (
        <p className="rounded-lg bg-brand-blue-soft p-4 text-sm text-brand-deep">
          This booking is closed and can't be changed. Contact hello@talkspace.ng if you need help.
        </p>
      ) : (
        <>
          {!rescheduling ? (
            <div className="rounded-2xl border border-border/70 bg-card p-6">
              <p className="font-medium text-brand-deep">Change this booking</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={() => setRescheduling(true)}
                  className="bg-brand-deep text-white"
                >
                  Reschedule
                </Button>
              </div>
              <div className="mt-6 space-y-2">
                <Label htmlFor="reason">Cancellation reason (optional)</Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => onCancel(reason)}
                >
                  Cancel booking
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-border/70 bg-card p-6 space-y-4">
              <p className="font-medium text-brand-deep">Pick a new time</p>
              <div>
                <Label htmlFor="date">Date</Label>
                <DateInput
                  id="date"
                  min={minDate}
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setSelectedSlot("");
                  }}
                />
              </div>
              {date ? (
                <div>
                  <Label>Available slots</Label>
                  {slotsLoading ? (
                    <p className="text-sm text-muted-foreground">Loading…</p>
                  ) : slots.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No slots for that date.</p>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {slots.map((s) => {
                        const time = new Intl.DateTimeFormat("en-NG", {
                          hour: "numeric",
                          minute: "2-digit",
                          timeZone: "Africa/Lagos",
                        }).format(new Date(s.startsAt));
                        const isSelected = selectedSlot === s.startsAt;
                        return (
                          <button
                            type="button"
                            key={s.startsAt + s.therapistId}
                            onClick={() => setSelectedSlot(s.startsAt)}
                            className={`rounded-md border px-3 py-1.5 text-sm ${isSelected ? "border-brand-blue bg-brand-blue-soft text-brand-deep" : "border-input hover:bg-muted"}`}
                          >
                            {time}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : null}
              <div className="flex gap-3">
                <Button
                  type="button"
                  disabled={busy || !selectedSlot}
                  onClick={() => onReschedule(selectedSlot)}
                  className="bg-brand-deep text-white"
                >
                  Confirm new time
                </Button>
                <Button type="button" variant="outline" onClick={() => setRescheduling(false)}>
                  Back
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/40 pb-2 last:border-b-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground text-right">{value}</dd>
    </div>
  );
}
