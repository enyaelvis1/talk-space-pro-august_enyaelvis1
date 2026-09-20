import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { canonicalUrl } from "@/lib/seo";
import {
  cancelAppointment,
  listAvailableSlots,
  listMyAppointments,
  rescheduleAppointment,
  type AvailableSlot,
  type MyAppointment,
} from "@/lib/booking.functions";

export const Route = createFileRoute("/_authenticated/account_/appointments")({
  head: () => ({
    meta: [
      { title: "Your appointments | Talk Space" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: canonicalUrl("/account/appointments") }],
  }),
  component: AppointmentsPage,
});

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(new Date(value));
}

function AppointmentsPage() {
  const [items, setItems] = useState<MyAppointment[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const minDate = useMemo(() => new Date().toISOString().split("T")[0], []);
  const rescheduleTarget = items?.find((a) => a.id === rescheduleId) ?? null;

  async function refresh() {
    setLoading(true);
    try {
      const rows = await listMyAppointments();
      setItems(rows);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't load appointments.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!rescheduleTarget || !date) {
      setSlots([]);
      return;
    }
    let active = true;
    setSlotsLoading(true);
    void listAvailableSlots({
      data: {
        serviceId: rescheduleTarget.serviceId,
        from: date,
        to: date,
        mode: rescheduleTarget.mode,
      },
    })
      .then((s) => active && setSlots(s))
      .finally(() => active && setSlotsLoading(false));
    return () => {
      active = false;
    };
  }, [rescheduleTarget, date]);

  async function onCancel(a: MyAppointment) {
    if (!confirm(`Cancel booking ${a.bookingReference}?`)) return;
    setBusy(true);
    try {
      await cancelAppointment({ data: { appointmentId: a.id } });
      toast.success("Booking cancelled.");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't cancel.");
    } finally {
      setBusy(false);
    }
  }

  async function onConfirmReschedule() {
    if (!rescheduleTarget || !selectedSlot) return;
    setBusy(true);
    try {
      await rescheduleAppointment({
        data: { appointmentId: rescheduleTarget.id, newStartsAt: selectedSlot },
      });
      toast.success("Booking rescheduled.");
      setRescheduleId(null);
      setDate("");
      setSelectedSlot("");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't reschedule.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main id="main" className="flex-1 bg-surface-page py-12 sm:py-16">
        <section className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8">
          <p className="eyebrow">Your bookings</p>
          <h1 className="display-2 mt-2 text-brand-deep">Appointments</h1>
          <p className="mt-2 text-muted-foreground">
            Manage bookings tied to your Talk Space account. Changes must be at least 24 hours
            before the session.
          </p>

          <div className="mt-8 space-y-4">
            {loading ? (
              <>
                <Skeleton className="h-28 w-full" />
                <Skeleton className="h-28 w-full" />
              </>
            ) : !items || items.length === 0 ? (
              <div className="rounded-2xl border border-border/70 bg-card p-6">
                <p className="text-muted-foreground">You don't have any bookings yet.</p>
                <Button asChild className="mt-4 bg-brand-deep text-white">
                  <Link to="/book">Book a session</Link>
                </Button>
              </div>
            ) : (
              items.map((a) => {
                const closed = ["cancelled", "completed", "no_show"].includes(a.status);
                return (
                  <div key={a.id} className="rounded-2xl border border-border/70 bg-card p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="ref-mono text-sm text-brand-deep">{a.bookingReference}</p>
                        <p className="mt-1 text-lg font-medium text-brand-deep">
                          {a.serviceName ?? "Session"} ·{" "}
                          {a.mode === "online" ? "Online" : "In-person"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatDateTime(a.startsAt)}
                        </p>
                        {a.therapistName ? (
                          <p className="text-sm text-muted-foreground">With {a.therapistName}</p>
                        ) : null}
                      </div>
                      <span className="rounded-full bg-brand-blue-soft px-3 py-1 text-xs font-medium text-brand-deep">
                        {a.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    {!closed ? (
                      <div className="mt-4 flex gap-3">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            setRescheduleId(a.id);
                            setDate("");
                            setSelectedSlot("");
                          }}
                        >
                          Reschedule
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => onCancel(a)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>

          {rescheduleTarget ? (
            <div className="mt-6 rounded-2xl border border-border/70 bg-card p-6 space-y-4">
              <p className="font-medium text-brand-deep">
                Reschedule {rescheduleTarget.bookingReference}
              </p>
              <div>
                <Label htmlFor="rdate">New date</Label>
                <DateInput
                  id="rdate"
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
                  onClick={onConfirmReschedule}
                  className="bg-brand-deep text-white"
                >
                  Confirm new time
                </Button>
                <Button type="button" variant="outline" onClick={() => setRescheduleId(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
