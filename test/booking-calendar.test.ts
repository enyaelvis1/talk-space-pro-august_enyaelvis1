import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBookingCalendarMonth,
  getAdminBookingCalendarRows,
  getAppointmentsForDate,
  getDaySummary,
  getHiddenAdminTemporaryRows,
  isSameDateKey,
  shiftAppointmentToDate,
} from "../src/lib/booking-calendar.ts";

function makeAppointment(
  id: string,
  startsAt: string,
  overrides: Partial<ReturnType<typeof makeAppointmentBase>> = {},
) {
  return { ...makeAppointmentBase(id, startsAt), ...overrides };
}

function makeAppointmentBase(id: string, startsAt: string) {
  return {
    id,
    bookingReference: `BK-${id}`,
    status: "confirmed",
    startsAt,
    endsAt: startsAt,
    mode: "online" as const,
    clientName: `Client ${id}`,
    clientEmail: `client${id}@example.com`,
    serviceName: "Counselling",
    therapistName: "Sade",
    reminder24hSentAt: null,
    reminder1hSentAt: null,
    reminder24hStatus: "scheduled" as const,
    reminder1hStatus: "scheduled" as const,
    hasManageToken: false,
    manageTokenExpiresAt: null,
    manageTokenRevokedAt: null,
    manageTokenRevocationReason: null,
    manageTokenStatus: "missing" as const,
    createdAt: null,
    googleSyncedAt: null,
    googleSyncError: null,
    googleMeetUrl: null,
    paymentStatus: null,
    paymentProvider: null,
    paidAmountKobo: null,
    archivedAt: null,
    archiveReason: null,
  };
}

test("buildBookingCalendarMonth groups appointments by date", () => {
  const month = buildBookingCalendarMonth(new Date("2026-08-15T12:00:00.000Z"), [
    makeAppointment("1", "2026-08-03T09:00:00.000Z"),
    makeAppointment("2", "2026-08-10T14:00:00.000Z"),
  ]);

  const august3 = month.days.find((day) => day.dateKey === "2026-08-03");
  const august10 = month.days.find((day) => day.dateKey === "2026-08-10");

  assert.ok(august3);
  assert.equal(august3?.count, 1);
  assert.ok(august10);
  assert.equal(august10?.count, 1);
  assert.match(month.monthLabel, /August/);
});

test("getAppointmentsForDate and getDaySummary return the selected day view", () => {
  const appointments = [
    makeAppointment("1", "2026-08-03T09:00:00.000Z"),
    makeAppointment("2", "2026-08-04T11:00:00.000Z"),
  ];

  const selected = getAppointmentsForDate(appointments, "2026-08-03");
  const summary = getDaySummary(appointments, "2026-08-03", "2026-08-03T10:00:00.000Z");

  assert.equal(selected.length, 1);
  assert.equal(selected[0]?.clientName, "Client 1");
  assert.equal(summary.currentAppointments.length, 0);
  assert.equal(summary.pastAppointments[0]?.id, "1");
  assert.equal(summary.upcomingAppointments.length, 0);
});

test("calendar date keys use Africa/Lagos around UTC midnight", () => {
  const appointments = [
    makeAppointment("late", "2026-08-03T23:30:00.000Z"),
    makeAppointment("early", "2026-08-04T00:30:00.000Z"),
  ];

  assert.deepEqual(
    getAppointmentsForDate(appointments, "2026-08-04").map((appointment) => appointment.id),
    ["late", "early"],
  );
  assert.equal(isSameDateKey("2026-08-03T23:30:00.000Z", "2026-08-04"), true);
});

test("same-time therapist appointments remain distinct before, during and after their sessions", () => {
  const appointments = [
    makeAppointment("A", "2035-01-01T10:00:00Z", {
      therapistName: "Therapist A",
      endsAt: "2035-01-01T11:00:00Z",
    }),
    makeAppointment("B", "2035-01-01T10:00:00Z", {
      therapistName: "Therapist B",
      endsAt: "2035-01-01T11:30:00Z",
      serviceName: "Couple therapy",
    }),
  ];
  const before = getDaySummary(appointments, "2035-01-01", "2035-01-01T09:00:00Z");
  const during = getDaySummary(appointments, "2035-01-01", "2035-01-01T10:15:00Z");
  const boundary = getDaySummary(appointments, "2035-01-01", "2035-01-01T11:00:00Z");
  const after = getDaySummary(appointments, "2035-01-01", "2035-01-01T12:00:00Z");
  assert.equal(before.upcomingAppointments.length, 2);
  assert.deepEqual(
    during.currentAppointments.map((a) => a.id),
    ["A", "B"],
  );
  assert.deepEqual(
    boundary.currentAppointments.map((a) => a.id),
    ["B"],
  );
  assert.deepEqual(
    boundary.pastAppointments.map((a) => a.id),
    ["A"],
  );
  assert.equal(after.pastAppointments.length, 2);
  for (const summary of [before, during, boundary, after]) {
    const ids = [
      ...summary.currentAppointments,
      ...summary.upcomingAppointments,
      ...summary.pastAppointments,
    ].map((a) => a.id);
    assert.equal(ids.length, 2);
    assert.equal(new Set(ids).size, 2);
  }
});

test("admin booking calendar hides unpaid temporary bookings", () => {
  const appointments = [
    makeAppointment("confirmed", "2026-08-03T09:00:00.000Z"),
    makeAppointment("paid-pending", "2026-08-03T10:00:00.000Z", {
      status: "pending_payment",
      paymentStatus: "awaiting_confirmation",
    }),
    makeAppointment("paystack-started", "2026-08-03T11:00:00.000Z", {
      status: "pending_payment",
      paymentStatus: "initiated",
    }),
    makeAppointment("hold", "2026-08-03T12:00:00.000Z", {
      status: "hold",
      paymentStatus: null,
      holdExpiresAt: "2026-08-03T12:05:00.000Z",
    }),
    makeAppointment("expired-hold", "2026-08-03T13:00:00.000Z", {
      status: "cancelled",
      paymentStatus: null,
      manageTokenRevocationReason: "hold_expired",
    }),
    makeAppointment("unpaid-cancelled", "2026-08-03T13:30:00.000Z", {
      status: "cancelled",
      paymentStatus: "awaiting_confirmation",
      manageTokenRevocationReason: "status_cancelled",
    }),
    makeAppointment("client-cancelled", "2026-08-03T14:00:00.000Z", {
      status: "cancelled",
      paymentStatus: "succeeded",
      manageTokenRevocationReason: "status_cancelled",
    }),
    makeAppointment("archived", "2026-08-03T15:00:00.000Z", {
      archivedAt: "2026-08-03T15:30:00.000Z",
      archiveReason: "manual_admin_archive",
    }),
  ];

  const visible = getAdminBookingCalendarRows(appointments);
  const hidden = getHiddenAdminTemporaryRows(appointments);
  const month = buildBookingCalendarMonth(new Date("2026-08-15T12:00:00.000Z"), visible);
  const august3 = month.days.find((day) => day.dateKey === "2026-08-03");

  assert.deepEqual(
    visible.map((appointment) => appointment.id),
    ["confirmed", "client-cancelled"],
  );
  assert.deepEqual(
    hidden.map((appointment) => appointment.id),
    ["paid-pending", "paystack-started", "hold", "expired-hold", "unpaid-cancelled", "archived"],
  );
  assert.equal(august3?.count, 2);
});

test("shiftAppointmentToDate keeps the time of day when moving to another date", () => {
  const moved = shiftAppointmentToDate("2026-08-03T09:30:00.000Z", "2026-08-12");
  assert.equal(moved, "2026-08-12T09:30:00.000Z");
  assert.equal(isSameDateKey(moved, "2026-08-12"), true);
  assert.equal(isSameDateKey(moved, "2026-08-03"), false);
});

test("dragging a booking preserves its Lagos wall-clock time", () => {
  const moved = shiftAppointmentToDate("2026-08-03T23:30:00.000Z", "2026-08-12");
  assert.equal(moved, "2026-08-11T23:30:00.000Z");
  assert.equal(isSameDateKey(moved, "2026-08-12"), true);
});
