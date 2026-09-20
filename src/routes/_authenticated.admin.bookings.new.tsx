import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CalendarPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AdminWorkspaceShell } from "@/components/progress/AdminSidebar";
import { AdminPageSkeleton } from "@/components/admin/AdminSkeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { canonicalUrl } from "@/lib/seo";
import {
  createAdminBooking,
  getAdminBookingFormData,
  listAvailableSlots,
  type AdminBookingFormData,
  type AvailableSlot,
  type BookingSessionMode,
} from "@/lib/booking.functions";

export const Route = createFileRoute("/_authenticated/admin/bookings/new")({
  loader: () => null,
  head: () => ({
    meta: [
      { title: "Create booking | Talk Space Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: canonicalUrl("/admin/bookings/new") }],
  }),
  component: CreateAdminBookingRoute,
});

const fieldClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring";

function todayInLagos() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatSlot(slot: AvailableSlot) {
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: "Africa/Lagos",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(slot.startsAt));
}

function formatNaira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}

function CreateAdminBookingRoute() {
  const navigate = useNavigate();
  const [data, setData] = useState<AdminBookingFormData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getAdminBookingFormData()
      .then((result) => {
        if (active) setData(result);
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error ? reason.message : "The booking form could not be loaded.",
          );
      });
    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return (
      <AdminWorkspaceShell>
        <main className="mx-auto w-full max-w-3xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <h1 className="text-2xl font-semibold text-brand-deep">Create booking is unavailable</h1>
          <p className="mt-3 text-sm text-muted-foreground">{error}</p>
          <Button asChild className="mt-6">
            <Link to="/admin/bookings">Return to bookings</Link>
          </Button>
        </main>
      </AdminWorkspaceShell>
    );
  }

  if (!data) {
    return (
      <AdminWorkspaceShell>
        <AdminPageSkeleton columns={2} rows={10} />
      </AdminWorkspaceShell>
    );
  }

  return (
    <CreateBookingForm data={data} onCreated={() => void navigate({ to: "/admin/bookings" })} />
  );
}

function CreateBookingForm({
  data,
  onCreated,
}: {
  data: AdminBookingFormData;
  onCreated: () => void;
}) {
  const [clientId, setClientId] = useState("");
  const [newClient, setNewClient] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [serviceId, setServiceId] = useState(data.services[0]?.id ?? "");
  const [mode, setMode] = useState<BookingSessionMode>("online");
  const [date, setDate] = useState(todayInLagos);
  const [slotKey, setSlotKey] = useState("");
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<
    "unpaid" | "bank_transfer" | "paystack" | "package"
  >("unpaid");
  const [paymentStatus, setPaymentStatus] = useState<"pending" | "confirmed">("pending");
  const [packageId, setPackageId] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedClient = data.clients.find((client) => client.id === clientId);
  const selectedService = data.services.find((service) => service.id === serviceId);
  const selectedSlot = slots.find((slot) => `${slot.therapistId}:${slot.startsAt}` === slotKey);
  const availablePackages = useMemo(
    () =>
      data.packages.filter(
        (pkg) =>
          pkg.serviceId === serviceId &&
          (!clientEmail || pkg.clientEmail.toLowerCase() === clientEmail.toLowerCase()),
      ),
    [clientEmail, data.packages, serviceId],
  );
  const amountNgn =
    paymentMethod === "package"
      ? 0
      : mode === "in_person"
        ? (selectedService?.inPersonPriceNgn ?? selectedService?.priceNgn ?? 0)
        : (selectedService?.priceNgn ?? 0);

  useEffect(() => {
    if (!clientId || newClient) return;
    const client = data.clients.find((item) => item.id === clientId);
    if (!client) return;
    setClientName(client.fullName);
    setClientEmail(client.email);
    setClientPhone(client.phone);
  }, [clientId, data.clients, newClient]);

  useEffect(() => {
    if (!serviceId || !date) return;
    let cancelled = false;
    setSlotsLoading(true);
    setSlotKey("");
    void listAvailableSlots({ data: { serviceId, from: date, to: date, mode } })
      .then((next) => {
        if (!cancelled) setSlots(next);
      })
      .catch((error) => {
        if (!cancelled) {
          setSlots([]);
          toast.error(error instanceof Error ? error.message : "Could not load available slots.");
        }
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date, mode, serviceId]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedSlot) {
      toast.error("Choose an available time.");
      return;
    }
    if (!clientName || !clientEmail || !clientPhone) {
      toast.error("Complete the client details.");
      return;
    }
    if (paymentMethod === "package" && !packageId) {
      toast.error("Choose the package credit to use.");
      return;
    }
    setSaving(true);
    try {
      const result = await createAdminBooking({
        data: {
          clientId: newClient ? undefined : clientId || undefined,
          clientName,
          clientEmail,
          clientPhone,
          serviceId,
          therapistId: selectedSlot.therapistId,
          mode,
          startsAt: selectedSlot.startsAt,
          notes,
          paymentMethod,
          paymentStatus: paymentMethod === "package" ? "confirmed" : paymentStatus,
          packageId: paymentMethod === "package" ? packageId : undefined,
          amountKobo: amountNgn * 100,
        },
      });
      toast.success(`Booking ${result.bookingReference} created.`);
      onCreated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Booking creation failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminWorkspaceShell>
      <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Button asChild variant="ghost" size="sm" className="mb-3 -ml-3">
              <Link to="/admin/bookings">
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Back to bookings
              </Link>
            </Button>
            <p className="eyebrow">Admin · Bookings</p>
            <h1 className="display-1 mt-3 text-brand-deep">Create a booking</h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Create a confirmed or payment-pending appointment with the same availability checks as
              public booking.
            </p>
          </div>
          <CalendarPlus className="h-8 w-8 text-brand-blue" aria-hidden />
        </header>

        <form onSubmit={submit} className="space-y-6">
          <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-7">
            <h2 className="text-lg font-semibold text-brand-deep">Client</h2>
            <div className="mt-4 flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="radio"
                  checked={!newClient}
                  onChange={() => setNewClient(false)}
                  name="client-type"
                />
                Existing client
              </label>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="radio"
                  checked={newClient}
                  onChange={() => {
                    setNewClient(true);
                    setClientId("");
                    setClientName("");
                    setClientEmail("");
                    setClientPhone("");
                  }}
                  name="client-type"
                />
                New client
              </label>
            </div>
            {!newClient ? (
              <div className="mt-4">
                <Label htmlFor="client">Client</Label>
                <select
                  id="client"
                  className={fieldClass}
                  value={clientId}
                  onChange={(event) => setClientId(event.target.value)}
                  required
                >
                  <option value="">Choose a client</option>
                  {data.clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.fullName} · {client.email}
                    </option>
                  ))}
                </select>
                {selectedClient ? (
                  <p className="mt-2 text-xs text-muted-foreground">{selectedClient.phone}</p>
                ) : null}
              </div>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="new-name">Full name</Label>
                  <Input
                    id="new-name"
                    value={clientName}
                    onChange={(event) => setClientName(event.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="new-email">Email</Label>
                  <Input
                    id="new-email"
                    type="email"
                    value={clientEmail}
                    onChange={(event) => setClientEmail(event.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="new-phone">Phone</Label>
                  <Input
                    id="new-phone"
                    value={clientPhone}
                    onChange={(event) => setClientPhone(event.target.value)}
                    required
                  />
                </div>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-7">
            <h2 className="text-lg font-semibold text-brand-deep">Session</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="service">Service</Label>
                <select
                  id="service"
                  className={fieldClass}
                  value={serviceId}
                  onChange={(event) => setServiceId(event.target.value)}
                  required
                >
                  {data.services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="mode">Session mode</Label>
                <select
                  id="mode"
                  className={fieldClass}
                  value={mode}
                  onChange={(event) => setMode(event.target.value as BookingSessionMode)}
                >
                  <option value="online">Online</option>
                  <option value="in_person">In person</option>
                </select>
              </div>
              <div>
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  min={todayInLagos()}
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="slot">Available time and therapist</Label>
                <select
                  id="slot"
                  className={fieldClass}
                  value={slotKey}
                  onChange={(event) => setSlotKey(event.target.value)}
                  disabled={slotsLoading || !slots.length}
                  required
                >
                  <option value="">
                    {slotsLoading
                      ? "Loading available times…"
                      : slots.length
                        ? "Choose an available time"
                        : "No available times"}
                  </option>
                  {slots.map((slot) => (
                    <option
                      key={`${slot.therapistId}:${slot.startsAt}`}
                      value={`${slot.therapistId}:${slot.startsAt}`}
                    >
                      {formatSlot(slot)} · {slot.therapistName ?? "Therapist"}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4">
              <Label htmlFor="notes">Internal note</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                maxLength={1000}
                placeholder="Context for the care team (optional)"
              />
            </div>
          </section>

          <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-7">
            <h2 className="text-lg font-semibold text-brand-deep">Payment and confirmation</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="payment-method">Payment method</Label>
                <select
                  id="payment-method"
                  className={fieldClass}
                  value={paymentMethod}
                  onChange={(event) => {
                    const value = event.target.value as typeof paymentMethod;
                    setPaymentMethod(value);
                    if (value === "package") setPaymentStatus("confirmed");
                  }}
                >
                  <option value="unpaid">Unpaid / request payment</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="paystack">Paystack</option>
                  <option value="package">Package credit</option>
                </select>
              </div>
              <div>
                <Label htmlFor="payment-status">Payment state</Label>
                <select
                  id="payment-status"
                  className={fieldClass}
                  value={paymentMethod === "package" ? "confirmed" : paymentStatus}
                  onChange={(event) => setPaymentStatus(event.target.value as typeof paymentStatus)}
                  disabled={paymentMethod === "package"}
                >
                  <option value="pending">Pending payment</option>
                  <option value="confirmed">Payment confirmed</option>
                </select>
              </div>
            </div>
            {paymentMethod === "package" ? (
              <div className="mt-4">
                <Label htmlFor="package">Package credit</Label>
                <select
                  id="package"
                  className={fieldClass}
                  value={packageId}
                  onChange={(event) => setPackageId(event.target.value)}
                  required
                >
                  <option value="">Choose package credit</option>
                  {availablePackages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.reference} · {pkg.clientName} · {pkg.remainingSessions} remaining
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="mt-5 rounded-xl bg-brand-blue-soft p-4 text-sm text-brand-deep">
              <div className="flex flex-wrap justify-between gap-3">
                <span>
                  {selectedService?.name ?? "Selected service"} ·{" "}
                  {mode === "in_person" ? "In person" : "Online"}
                </span>
                <strong>
                  {paymentMethod === "package" ? "Package credit" : formatNaira(amountNgn)}
                </strong>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {paymentStatus === "confirmed" || paymentMethod === "package"
                  ? "This booking will be confirmed and the slot reserved."
                  : "This booking will remain payment-pending until payment is confirmed."}
              </p>
            </div>
          </section>

          <div className="flex justify-end gap-3">
            <Button asChild variant="outline">
              <Link to="/admin/bookings">Cancel</Link>
            </Button>
            <Button type="submit" disabled={saving || slotsLoading}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <CalendarPlus className="h-4 w-4" aria-hidden />
              )}
              Create booking
            </Button>
          </div>
        </form>
      </main>
    </AdminWorkspaceShell>
  );
}
