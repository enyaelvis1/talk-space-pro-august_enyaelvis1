import { useState } from "react";
import { useCheckoutClock } from "@/hooks/use-checkout-clock";
import { createRoot } from "react-dom/client";
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { BookingSlotSelect } from "@/components/booking/BookingSlotSelect";
import { BookingDaySections } from "@/components/booking/BookingDaySections";
import { getDaySummary } from "@/lib/booking-calendar";
import type { UpcomingAppointmentRow } from "@/lib/booking.functions";
import { PaymentReceiptDetails } from "@/components/booking/PaymentReceiptDetails";
import { AdminOverview } from "@/components/progress/AdminOverview";
import { buildProgressSnapshot } from "@/lib/checklist-progress";
import { slotKey, uniqueBookingSlots, type BookingSlot } from "@/lib/booking-slots";
import "@/styles.css";

const slots: BookingSlot[] = uniqueBookingSlots(
  ["Therapist A", "Therapist B"].map((name, i) => ({
    therapistId: `therapist-${i}`,
    therapistName: name,
    startsAt: "2030-10-01T09:00:00Z",
    endsAt: "2030-10-01T10:00:00Z",
    mode: "online" as const,
  })),
);
export function SlotHarness() {
  const [value, setValue] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <main className="mx-auto max-w-lg space-y-4 p-6">
      <label htmlFor="preferredTime">Preferred time</label>
      <BookingSlotSelect
        slots={slots}
        value={value}
        onValueChange={setValue}
        placeholder="Choose an available time"
      />
      <button
        disabled={!value || selected.includes(value)}
        onClick={() => setSelected([...selected, value])}
      >
        Add session
      </button>
      <ul>
        {selected.map((key) => (
          <li key={key}>
            {slots.find((slot) => slotKey(slot) === key)?.therapistName}
            <button
              aria-label={`Remove ${key}`}
              onClick={() => setSelected(selected.filter((item) => item !== key))}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <output data-testid="selected-keys">{JSON.stringify(selected)}</output>
    </main>
  );
}
export function Harness() {
  if (location.search.includes("bk008-day")) return <DaySummaryHarness />;
  if (location.search.includes("checkout-clock")) return <CheckoutClockHarness />;
  if (location.search.includes("receipt"))
    return (
      <main className="mx-auto max-w-lg p-6">
        <h1 className="mb-6 text-xl font-semibold">Payment confirmed</h1>
        <PaymentReceiptDetails
          receipt={{
            amountKobo: 5593909,
            bookingAmountKobo: 5500000,
            customerFeeKobo: 93909,
            feesKobo: 93909,
            currency: "NGN",
          }}
          showProviderFee={location.search.includes("provider")}
        />
      </main>
    );
  if (!location.search.includes("admin")) return <SlotHarness />;
  return (
    <AdminOverview
      snapshot={buildProgressSnapshot({ projectName: "Test", sources: [], milestones: [] })}
      summary={{
        pages: 4,
        posts: 3,
        media: 6,
        activeTherapists: 2,
        clients: 8,
        upcomingBookings: 4,
        pendingMessages: 0,
        pendingTransfers: 1,
        pendingForms: 0,
        failedGoogleSyncs: 0,
      }}
      failureQueues={{ notificationCount: 0, meetCount: 0, notifications: [], meetSyncs: [] }}
      todayAppointments={[]}
      upcomingAppointments={[]}
      canViewProgress={false}
    />
  );
}
function DaySummaryHarness() {
  const [now, setNow] = useState("2035-01-01T10:15:00Z");
  const appointments = ["A", "B"].map((id) => ({
    id,
    bookingReference: `TEST-${id}`,
    therapistName: `Therapist ${id}`,
    startsAt: "2035-01-01T10:00:00Z",
    endsAt: "2035-01-01T11:00:00Z",
    status: "confirmed",
    clientName: `Test client ${id}`,
  })) as UpcomingAppointmentRow[];
  return (
    <main className="mx-auto max-w-lg p-6 space-y-4">
      <h1 className="text-xl font-semibold">Selected day</h1>
      <button onClick={() => setNow("2035-01-01T12:00:00Z")}>Later</button>
      <BookingDaySections
        summary={getDaySummary(appointments, "2035-01-01", now)}
        renderAppointment={(a) => (
          <article className="rounded-lg border bg-white p-3 space-y-1">
            <h2 className="text-base font-medium">{a.therapistName}</h2>
            <p>{a.bookingReference} · 11:00 WAT</p>
            <p>{a.clientName}</p>
          </article>
        )}
      />
    </main>
  );
}
function CheckoutClockHarness() {
  const [expiresAt] = useState(() => new Date(Date.now() + 2000).toISOString());
  const { expired } = useCheckoutClock(expiresAt);
  return (
    <main className="mx-auto max-w-lg p-6 space-y-4">
      <h1>Checkout</h1>
      <p role="status">{expired ? "Checkout expired" : "Checkout open"}</p>
      <button disabled={expired}>Pay with Paystack</button>
      <button disabled={expired}>Submit transfer</button>
      {expired ? <a href="/book">Start a new booking</a> : null}
    </main>
  );
}
const root = createRootRoute({ component: Outlet });
const fixture = createRoute({
  getParentRoute: () => root,
  path: "/test/fixtures/feedback-harness.html",
  component: Harness,
});
const destination = createRoute({
  getParentRoute: () => root,
  path: "/admin/$section",
  component: () => <h1>Destination: {destination.useParams().section}</h1>,
});
const router = createRouter({ routeTree: root.addChildren([fixture, destination]) });
createRoot(document.getElementById("root")!).render(<RouterProvider router={router} />);
