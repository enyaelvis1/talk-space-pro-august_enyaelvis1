import { useCallback, useEffect, useMemo, useState, type DragEvent as ReactDragEvent } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { BookingDaySections } from "@/components/booking/BookingDaySections";
import { slotKey } from "@/lib/booking-slots";
import {
  ArrowLeft,
  ArrowRight,
  BellRing,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  Archive,
  Clock,
  CreditCard,
  FileText,
  GripVertical,
  History,
  Loader2,
  Mail,
  Maximize2,
  Pencil,
  RefreshCw,
  Send,
  ShieldOff,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { AdminWorkspaceShell } from "@/components/progress/AdminSidebar";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { canonicalUrl } from "@/lib/seo";
import {
  getAdminAppointmentTimeline,
  listAvailableSlots,
  listAppointmentsForAdmin,
  archiveAppointmentForAdmin,
  deleteTemporaryAppointmentsForAdmin,
  revokeAppointmentManageToken,
  rescheduleAppointment,
  resendBookingConfirmation,
  resendReminder,
  type AvailableSlot,
  type AdminAppointmentTimeline,
  type AppointmentTimelineEntry,
  type UpcomingAppointmentRow,
} from "@/lib/booking.functions";
import {
  buildBookingCalendarMonth,
  getAdminBookingCalendarRows,
  getAppointmentsForDate,
  getDaySummary,
  getHiddenAdminTemporaryRows,
  getNowSummary,
  isSameDateKey,
  shiftAppointmentToDate,
} from "@/lib/booking-calendar";
import {
  BOOKING_STATUS_LEGEND,
  getBookingStatusStyle,
  getToneStyle,
} from "@/lib/booking-status-colors";

export const Route = createFileRoute("/_authenticated/admin/bookings")({
  loader: async () => {
    try {
      return await listAppointmentsForAdmin();
    } catch {
      throw redirect({ href: "/account?error=forbidden" });
    }
  },
  head: () => ({
    meta: [
      { title: "Booking operations | Talk Space Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: canonicalUrl("/admin/bookings") }],
  }),
  component: AdminBookingsRoute,
});

const dtf = new Intl.DateTimeFormat("en-NG", {
  timeZone: "Africa/Lagos",
  dateStyle: "medium",
  timeStyle: "short",
});

const clockFormatter = new Intl.DateTimeFormat("en-NG", {
  timeZone: "Africa/Lagos",
  timeStyle: "medium",
});

function formatTime(iso: string) {
  try {
    return clockFormatter.format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatDate(iso: string) {
  try {
    return dtf.format(new Date(iso));
  } catch {
    return iso;
  }
}

function statusBadge(status: UpcomingAppointmentRow["reminder24hStatus"]) {
  const map: Record<typeof status, string> = {
    sent: "bg-emerald-100 text-emerald-800",
    due: "bg-amber-100 text-amber-800",
    scheduled: "bg-sky-100 text-sky-800",
    missed: "bg-rose-100 text-rose-800",
    "n/a": "bg-muted text-muted-foreground",
  };
  const label: Record<typeof status, string> = {
    sent: "Sent",
    due: "Due now",
    scheduled: "Scheduled",
    missed: "Missed",
    "n/a": "N/A",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${map[status]}`}>
      {label[status]}
    </span>
  );
}

function bookingStatusBadge(status: string) {
  const style = getBookingStatusStyle(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${style.badgeClass}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dotClass}`} aria-hidden />
      {style.label}
    </span>
  );
}

const paymentTone: Record<string, string> = {
  succeeded: "bg-emerald-100 text-emerald-800",
  awaiting_confirmation: "bg-amber-100 text-amber-800",
  initiated: "bg-sky-100 text-sky-800",
  failed: "bg-rose-100 text-rose-800",
  cancelled: "bg-rose-100 text-rose-800",
  refunded: "bg-muted text-muted-foreground",
};

function paymentBadge(row: UpcomingAppointmentRow) {
  const status = row.paymentStatus;
  if (!status) {
    return (
      <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        No payment
      </span>
    );
  }
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        paymentTone[status] ?? "bg-muted text-muted-foreground"
      }`}
    >
      {status.replaceAll("_", " ")}
      {row.paidAmountKobo ? ` · ${formatAmount(row.paidAmountKobo)}` : ""}
    </span>
  );
}

const manageTokenTone: Record<UpcomingAppointmentRow["manageTokenStatus"], string> = {
  active: "bg-emerald-100 text-emerald-800",
  expired: "bg-amber-100 text-amber-800",
  revoked: "bg-rose-100 text-rose-800",
  inactive: "bg-muted text-muted-foreground",
  missing: "bg-muted text-muted-foreground",
};

function manageTokenBadge(row: UpcomingAppointmentRow) {
  const label: Record<UpcomingAppointmentRow["manageTokenStatus"], string> = {
    active: "Manage link active",
    expired: "Manage link expired",
    revoked: "Manage link revoked",
    inactive: "Manage link inactive",
    missing: "No manage link",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${manageTokenTone[row.manageTokenStatus]}`}
    >
      {label[row.manageTokenStatus]}
    </span>
  );
}

const modeLabels: Record<string, string> = {
  online: "Online session",
  in_person: "In person",
  phone: "Phone call",
};

const nairaFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

function formatAmount(kobo: number) {
  return nairaFormatter.format(kobo / 100);
}

const timeFormatter = new Intl.DateTimeFormat("en-NG", {
  timeZone: "Africa/Lagos",
  timeStyle: "short",
});

function formatTimeRange(startsAt: string, endsAt: string) {
  try {
    return `${timeFormatter.format(new Date(startsAt))} – ${timeFormatter.format(new Date(endsAt))}`;
  } catch {
    return startsAt;
  }
}

function toLagosDateKey(iso: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Lagos",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(iso));
    const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${lookup.year}-${lookup.month}-${lookup.day}`;
  } catch {
    return iso.slice(0, 10);
  }
}

function canEditBooking(row: UpcomingAppointmentRow) {
  return (
    !["cancelled", "completed", "no_show"].includes(row.status) ||
    (row.status === "cancelled" && row.paymentNeedsReview)
  );
}

function googleStatusBadge(row: UpcomingAppointmentRow) {
  if (row.googleMeetUrl) {
    return (
      <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
        Meet link ready
      </span>
    );
  }
  if (row.googleSyncError) {
    return (
      <span className="inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-800">
        Meet sync failed
      </span>
    );
  }
  if (row.status !== "confirmed") {
    return (
      <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
        Meet after payment
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800">
      Meet pending
    </span>
  );
}

function timelineIcon(category: AppointmentTimelineEntry["category"]) {
  if (category === "payment") return CreditCard;
  if (category === "form") return FileText;
  if (category === "calendar") return CalendarCheck;
  if (category === "notification") return BellRing;
  return History;
}

function AdminBookingsRoute() {
  const initial = Route.useLoaderData();
  const [rows, setRows] = useState<UpcomingAppointmentRow[]>(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [sendingKey, setSendingKey] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeletingTemporary, setBulkDeletingTemporary] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<AdminAppointmentTimeline | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());
  const [dayViewOpen, setDayViewOpen] = useState(false);
  const [nowFilter, setNowFilter] = useState(false);
  const [nowIso, setNowIso] = useState(() => new Date().toISOString());
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [showHiddenTemporary, setShowHiddenTemporary] = useState(false);
  const [editing, setEditing] = useState<UpcomingAppointmentRow | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editSlot, setEditSlot] = useState("");
  const [editSlots, setEditSlots] = useState<AvailableSlot[]>([]);
  const [editSlotsLoading, setEditSlotsLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => setRows(initial), [initial]);

  useEffect(() => {
    const timer = setInterval(() => setNowIso(new Date().toISOString()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!editing || !editDate) {
      setEditSlots([]);
      return;
    }

    setEditSlotsLoading(true);
    setEditSlot("");
    void listAvailableSlots({
      data: {
        serviceId: editing.serviceId,
        from: editDate,
        to: editDate,
        mode: editing.mode,
      },
    })
      .then((slots) => {
        if (cancelled) return;
        setEditSlots(slots);
        const currentSlot = slots.find(
          (slot: AvailableSlot) =>
            slot.startsAt === editing.startsAt &&
            slot.therapistId === editing.therapistId &&
            slot.mode === editing.mode,
        );
        if (currentSlot) setEditSlot(slotKey(currentSlot));
      })
      .catch((error) => {
        if (!cancelled) {
          setEditSlots([]);
          toast.error(error instanceof Error ? error.message : "Failed to load available slots.");
        }
      })
      .finally(() => {
        if (!cancelled) setEditSlotsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [editDate, editing]);

  const calendarRows = useMemo(() => getAdminBookingCalendarRows(rows), [rows]);
  const hiddenTemporaryRows = useMemo(() => getHiddenAdminTemporaryRows(rows), [rows]);
  const hiddenTemporaryCount = hiddenTemporaryRows.length;
  const monthData = useMemo(
    () => buildBookingCalendarMonth(visibleMonth, calendarRows),
    [calendarRows, visibleMonth],
  );
  const selectedDate =
    selectedDateKey ?? monthData.days.find((day) => day.count > 0)?.dateKey ?? null;
  const selectedAppointments = selectedDate
    ? getAppointmentsForDate(calendarRows, selectedDate)
    : [];
  const daySummary = useMemo(
    () => getDaySummary(calendarRows, selectedDate ?? "", nowIso),
    [calendarRows, selectedDate, nowIso],
  );
  const nowSummary = useMemo(() => getNowSummary(calendarRows, nowIso), [calendarRows, nowIso]);
  const nowHighlightDates = useMemo(() => {
    const keys = new Set<string>();
    for (const appointment of [...nowSummary.live, ...nowSummary.nextUp]) {
      keys.add(new Date(appointment.startsAt).toISOString().slice(0, 10));
    }
    return keys;
  }, [nowSummary]);
  const todayDateKey = useMemo(() => toLagosDateKey(nowIso), [nowIso]);

  useEffect(() => {
    if (!selectedDateKey && monthData.days.length) {
      const fallbackDate = monthData.days.find((day) => day.count > 0)?.dateKey;
      if (fallbackDate) setSelectedDateKey(fallbackDate);
    }
  }, [monthData.days, selectedDateKey]);

  const shiftMonth = useCallback((delta: -1 | 1) => {
    setVisibleMonth((current) => {
      const next = new Date(current);
      next.setUTCMonth(next.getUTCMonth() + delta);
      return next;
    });
    setSelectedDateKey(null);
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const next = await listAppointmentsForAdmin();
      setRows(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to refresh.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  const onResend = useCallback(
    async (
      row: UpcomingAppointmentRow,
      reminder: "booking_reminder_24h" | "booking_reminder_1h",
    ) => {
      const key = `${row.id}:${reminder}`;
      setSendingKey(key);
      try {
        await resendReminder({ data: { appointmentId: row.id, reminder } });
        toast.success(`Reminder sent to ${row.clientEmail}`);
        await refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to send reminder.");
      } finally {
        setSendingKey(null);
      }
    },
    [refresh],
  );

  const onResendConfirmation = useCallback(async (row: UpcomingAppointmentRow) => {
    const key = `${row.id}:booking_confirmation`;
    setSendingKey(key);
    try {
      await resendBookingConfirmation({ data: { appointmentId: row.id } });
      toast.success(`Confirmation sent to ${row.clientEmail}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send confirmation.");
    } finally {
      setSendingKey(null);
    }
  }, []);

  const onArchive = useCallback(async (row: UpcomingAppointmentRow) => {
    if (
      !confirm(
        `Archive booking ${row.bookingReference}? It will be removed from the admin calendar, but the booking history and payment records will be kept.`,
      )
    ) {
      return;
    }
    setDeletingId(row.id);
    try {
      await archiveAppointmentForAdmin({
        data: { appointmentId: row.id, reason: "manual_admin_archive" },
      });
      setRows((current) => current.filter((item) => item.id !== row.id));
      toast.success("Booking archived.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to archive booking.");
    } finally {
      setDeletingId(null);
    }
  }, []);

  const onBulkDeleteTemporary = useCallback(async () => {
    if (!hiddenTemporaryRows.length) return;
    const confirmation = prompt(
      `This will permanently delete ${hiddenTemporaryRows.length} temporary/test booking row${
        hiddenTemporaryRows.length === 1 ? "" : "s"
      }. Type DELETE TEST BOOKINGS to continue.`,
    );
    if (confirmation !== "DELETE TEST BOOKINGS") return;
    setBulkDeletingTemporary(true);
    try {
      const result = await deleteTemporaryAppointmentsForAdmin({
        data: {
          appointmentIds: hiddenTemporaryRows.map((row) => row.id),
          confirmation,
        },
      });
      setRows((current) =>
        current.filter((row) => !hiddenTemporaryRows.some((hidden) => hidden.id === row.id)),
      );
      toast.success(`${result.deletedCount} temporary booking row deleted.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to clear temporary bookings.");
    } finally {
      setBulkDeletingTemporary(false);
    }
  }, [hiddenTemporaryRows]);

  const onDeleteTemporary = useCallback(async (row: UpcomingAppointmentRow) => {
    const confirmation = prompt(
      `This will permanently delete temporary/test booking ${row.bookingReference}. Type DELETE TEST BOOKINGS to continue.`,
    );
    if (confirmation !== "DELETE TEST BOOKINGS") return;
    setDeletingId(row.id);
    try {
      const result = await deleteTemporaryAppointmentsForAdmin({
        data: { appointmentIds: [row.id], confirmation },
      });
      if (result.deletedCount === 0) {
        throw new Error("This booking is no longer eligible for permanent deletion.");
      }
      setRows((current) => current.filter((item) => item.id !== row.id));
      toast.success("Temporary booking deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete temporary booking.");
    } finally {
      setDeletingId(null);
    }
  }, []);

  const renderDeleteButton = useCallback(
    (appointment: UpcomingAppointmentRow) => {
      const paymentIsCommitted = ["succeeded", "awaiting_confirmation"].includes(
        appointment.paymentStatus ?? "",
      );
      const eligible =
        appointment.status === "hold" ||
        (appointment.status === "cancelled" && !paymentIsCommitted);
      if (!eligible) return null;
      return (
        <Button
          size="sm"
          variant="outline"
          className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={deletingId === appointment.id}
          onClick={() => void onDeleteTemporary(appointment)}
        >
          {deletingId === appointment.id ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Trash2 className="h-4 w-4" aria-hidden />
          )}
          Delete
        </Button>
      );
    },
    [deletingId, onDeleteTemporary],
  );

  const onRevokeManageToken = useCallback(
    async (row: UpcomingAppointmentRow) => {
      if (row.manageTokenStatus !== "active") return;
      if (!confirm(`Revoke the manage link for booking ${row.bookingReference}?`)) return;
      setRevokingId(row.id);
      try {
        await revokeAppointmentManageToken({
          data: { appointmentId: row.id, reason: "manual_admin_revoke" },
        });
        toast.success("Manage link revoked.");
        await refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to revoke manage link.");
      } finally {
        setRevokingId(null);
      }
    },
    [refresh],
  );

  const refreshNowView = useCallback(async () => {
    setNowIso(new Date().toISOString());
    await refresh();
  }, [refresh]);

  const moveAppointmentToDate = useCallback(
    async (appointmentId: string, dateKey: string) => {
      const appointment = rows.find((row) => row.id === appointmentId);
      if (!appointment) return;
      if (isSameDateKey(appointment.startsAt, dateKey)) return;
      if (
        ["no_show", "completed"].includes(appointment.status) ||
        (appointment.status === "cancelled" && !appointment.paymentNeedsReview)
      ) {
        toast.error("This booking can no longer be rescheduled.");
        return;
      }

      const newStartsAt = shiftAppointmentToDate(appointment.startsAt, dateKey);
      setMovingId(appointmentId);
      try {
        await rescheduleAppointment({ data: { appointmentId, newStartsAt } });
        toast.success(`Moved ${appointment.bookingReference} to ${formatDate(newStartsAt)}`);
        setSelectedDateKey(dateKey);
        await refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to move this booking.");
      } finally {
        setMovingId(null);
      }
    },
    [refresh, rows],
  );

  const dragProps = useCallback(
    (appointment: UpcomingAppointmentRow) => ({
      draggable: true,
      onDragStart: (event: ReactDragEvent) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", appointment.id);
        setDraggingId(appointment.id);
      },
      onDragEnd: () => {
        setDraggingId(null);
        setDropTargetKey(null);
      },
    }),
    [],
  );

  const dayDropProps = useCallback(
    (dateKey: string) => ({
      onDragOver: (event: ReactDragEvent) => {
        if (!draggingId) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setDropTargetKey(dateKey);
      },
      onDragLeave: () => setDropTargetKey((current) => (current === dateKey ? null : current)),
      onDrop: (event: ReactDragEvent) => {
        event.preventDefault();
        const appointmentId = event.dataTransfer.getData("text/plain") || draggingId;
        setDraggingId(null);
        setDropTargetKey(null);
        if (appointmentId) void moveAppointmentToDate(appointmentId, dateKey);
      },
    }),
    [draggingId, moveAppointmentToDate],
  );

  const openTimeline = useCallback(async (row: UpcomingAppointmentRow) => {
    setTimelineOpen(true);
    setTimeline(null);
    setTimelineLoading(true);
    try {
      setTimeline(await getAdminAppointmentTimeline({ data: { appointmentId: row.id } }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load booking timeline.");
      setTimelineOpen(false);
    } finally {
      setTimelineLoading(false);
    }
  }, []);

  const openEditBooking = useCallback((row: UpcomingAppointmentRow) => {
    if (!canEditBooking(row)) {
      toast.error("This booking can no longer be changed.");
      return;
    }
    setEditing(row);
    setEditDate(toLagosDateKey(row.startsAt));
    setEditSlot("");
    setEditSlots([]);
  }, []);

  const saveEditedBooking = useCallback(async () => {
    if (!editing || !editSlot) return;
    const selectedSlot = editSlots.find((slot) => slotKey(slot) === editSlot);
    if (!selectedSlot) {
      toast.error("Choose an available time.");
      return;
    }

    setEditSaving(true);
    try {
      await rescheduleAppointment({
        data: {
          appointmentId: editing.id,
          newStartsAt: selectedSlot.startsAt,
          newTherapistId: selectedSlot.therapistId,
          newMode: selectedSlot.mode,
        },
      });
      toast.success(`Updated ${editing.bookingReference}.`);
      setEditing(null);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update this booking.");
    } finally {
      setEditSaving(false);
    }
  }, [editSlot, editSlots, editing, refresh]);

  const renderEditButton = useCallback(
    (appointment: UpcomingAppointmentRow) => (
      <Button
        size="sm"
        variant="outline"
        disabled={!canEditBooking(appointment) || editSaving}
        onClick={() => openEditBooking(appointment)}
      >
        <Pencil className="h-4 w-4" aria-hidden />
        Edit booking
      </Button>
    ),
    [editSaving, openEditBooking],
  );

  const renderArchiveButton = useCallback(
    (appointment: UpcomingAppointmentRow) => (
      <Button
        size="sm"
        variant="outline"
        className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
        disabled={deletingId === appointment.id}
        onClick={() => void onArchive(appointment)}
      >
        {deletingId === appointment.id ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Archive className="h-4 w-4" aria-hidden />
        )}
        Archive
      </Button>
    ),
    [deletingId, onArchive],
  );

  return (
    <AdminWorkspaceShell>
      <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Admin · Bookings</p>
            <h1 className="display-1 mt-3 text-brand-deep">Booking operations</h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Review recent and upcoming bookings, reminders, payment progress, intake completion,
              and Calendar or Meet activity in one timeline.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link to="/admin/bookings/new">
                <CalendarPlus className="h-4 w-4" aria-hidden />
                Create booking
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refresh()}
              disabled={refreshing}
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>
        </header>

        <section className="rounded-2xl border border-border/70 bg-card p-4 sm:p-6">
          {calendarRows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
              <BellRing className="h-8 w-8" />
              <p>No committed bookings to show.</p>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <CalendarDays className="h-4 w-4" aria-hidden />
                    <span>Calendar view</span>
                    <span className="inline-flex items-center gap-1 text-xs font-normal">
                      <GripVertical className="h-3.5 w-3.5" aria-hidden />
                      Drag a session onto a day to reschedule
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {hiddenTemporaryCount > 0 ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowHiddenTemporary((current) => !current)}
                      >
                        {showHiddenTemporary ? "Hide temporary holds" : "Show temporary holds"}
                      </Button>
                    ) : null}
                    <Button
                      variant={nowFilter ? "default" : "outline"}
                      size="sm"
                      aria-pressed={nowFilter}
                      onClick={() => setNowFilter((current) => !current)}
                    >
                      <Clock className="h-4 w-4" aria-hidden />
                      Now
                      {nowSummary.live.length ? ` (${nowSummary.live.length})` : ""}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => shiftMonth(-1)}>
                      <ArrowLeft className="h-4 w-4" />
                      Prev
                    </Button>
                    <div className="rounded-full border border-border/70 px-3 py-1 text-sm font-medium text-brand-deep">
                      {monthData.monthLabel}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => shiftMonth(1)}>
                      Next
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-2 text-center text-xs uppercase tracking-wide text-muted-foreground">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <div key={day} className="py-2">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {monthData.days.map((day) => {
                    const isSelected = day.dateKey === selectedDate;
                    const isEmpty = day.count === 0;
                    const isNowDay = nowFilter && nowHighlightDates.has(day.dateKey);
                    return (
                      <button
                        key={day.dateKey}
                        type="button"
                        onClick={() => setSelectedDateKey(day.dateKey)}
                        {...dayDropProps(day.dateKey)}
                        className={`flex min-h-20 flex-col rounded-xl border p-2 text-left transition ${
                          dropTargetKey === day.dateKey
                            ? "border-brand-blue bg-brand-blue-soft ring-2 ring-brand-blue"
                            : isNowDay
                              ? "border-brand-blue bg-brand-blue-soft/70 text-brand-deep ring-2 ring-brand-blue/60"
                              : isSelected
                                ? "border-brand-blue bg-brand-blue-soft text-brand-deep"
                                : day.isCurrentMonth
                                  ? "border-border/70 bg-background"
                                  : "border-transparent bg-muted/40 text-muted-foreground"
                        } ${nowFilter && !isNowDay ? "opacity-50" : ""}`}
                      >
                        <span className="text-sm font-medium">{day.date.getUTCDate()}</span>
                        {!isEmpty ? (
                          <>
                            <span className="mt-2 inline-flex w-fit rounded-full bg-brand-deep px-2 py-0.5 text-[10px] font-semibold text-white">
                              {day.count} session{day.count === 1 ? "" : "s"}
                            </span>
                            <span className="mt-1.5 flex flex-wrap gap-1">
                              {day.appointments.slice(0, 6).map((appointment) => (
                                <span
                                  key={appointment.id}
                                  title={`${appointment.status.replaceAll("_", " ")} · ${appointment.clientName}`}
                                  className={`h-1.5 w-1.5 rounded-full ${getBookingStatusStyle(appointment.status).dotClass}`}
                                />
                              ))}
                            </span>
                          </>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="font-medium">Status key</span>
                  {BOOKING_STATUS_LEGEND.map((item) => (
                    <span key={item.tone} className="inline-flex items-center gap-1.5">
                      <span
                        className={`h-2 w-2 rounded-full ${getToneStyle(item.tone).dotClass}`}
                        aria-hidden
                      />
                      {item.label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-muted-foreground">
                      {nowFilter ? "Live view" : "Selected day"}
                    </p>
                    <h2 className="mt-1 truncate text-xl font-semibold text-brand-deep">
                      {nowFilter
                        ? "Happening now & next up"
                        : selectedDate
                          ? formatDate(`${selectedDate}T00:00:00.000Z`)
                          : "No date selected"}
                    </h2>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <div className="rounded-full bg-brand-blue-soft px-3 py-1 text-xs font-semibold text-brand-blue">
                      {nowFilter ? nowSummary.live.length : selectedAppointments.length} session
                      {(nowFilter ? nowSummary.live.length : selectedAppointments.length) === 1
                        ? ""
                        : "s"}
                      {nowFilter ? " live" : ""}
                    </div>
                    {nowFilter ? (
                      <Button size="sm" variant="outline" onClick={() => setNowFilter(false)}>
                        Show selected day
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!selectedDate}
                        onClick={() => setDayViewOpen(true)}
                      >
                        <Maximize2 className="h-4 w-4" aria-hidden />
                        Enlarge
                      </Button>
                    )}
                  </div>
                </div>

                {nowFilter ? (
                  <div className="mt-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        Live view · updated {formatTime(nowIso)}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void refreshNowView()}
                        disabled={refreshing}
                      >
                        {refreshing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                        Refresh now
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue">
                        Happening now
                      </p>
                      {nowSummary.live.length ? (
                        nowSummary.live.map((appointment) => (
                          <div
                            key={appointment.id}
                            {...dragProps(appointment)}
                            className={`cursor-grab rounded-xl border-l-4 border p-3 active:cursor-grabbing ${getBookingStatusStyle(appointment.status).surfaceClass} ${
                              draggingId === appointment.id ? "opacity-60" : ""
                            } ${movingId === appointment.id ? "animate-pulse" : ""}`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-medium text-brand-deep">
                                  {formatDate(appointment.startsAt)}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {appointment.clientName} · {appointment.therapistName ?? "—"} ·{" "}
                                  {appointment.mode.replace("_", " ")}
                                </p>
                              </div>
                              <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
                                {bookingStatusBadge(appointment.status)}
                                {googleStatusBadge(appointment)}
                                {renderEditButton(appointment)}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => void openTimeline(appointment)}
                                >
                                  <History className="h-4 w-4" />
                                  Timeline
                                </Button>
                                {renderDeleteButton(appointment)}
                                {renderArchiveButton(appointment)}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-xl border border-dashed border-border/70 p-5 text-center text-sm text-muted-foreground">
                          No session is in progress right now.
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Next up</p>
                      {nowSummary.nextUp.length ? (
                        nowSummary.nextUp.map((appointment) => (
                          <div
                            key={appointment.id}
                            {...dragProps(appointment)}
                            className={`cursor-grab rounded-xl border border-l-4 bg-card p-3 active:cursor-grabbing ${getBookingStatusStyle(appointment.status).borderClass} ${
                              draggingId === appointment.id ? "opacity-60" : ""
                            } ${movingId === appointment.id ? "animate-pulse" : ""}`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-medium text-brand-deep">
                                  {formatDate(appointment.startsAt)}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {appointment.clientName} · {appointment.therapistName ?? "—"} ·{" "}
                                  {appointment.mode.replace("_", " ")}
                                </p>
                              </div>
                              <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
                                {bookingStatusBadge(appointment.status)}
                                {googleStatusBadge(appointment)}
                                {renderEditButton(appointment)}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => void openTimeline(appointment)}
                                >
                                  <History className="h-4 w-4" />
                                  Timeline
                                </Button>
                                {renderDeleteButton(appointment)}
                                {renderArchiveButton(appointment)}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-xl border border-dashed border-border/70 p-5 text-center text-sm text-muted-foreground">
                          Nothing scheduled next.
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mt-5">
                    <BookingDaySections
                      summary={daySummary}
                      renderAppointment={(appointment) => (
                        <div
                          key={appointment.id}
                          {...dragProps(appointment)}
                          className={`cursor-grab rounded-xl border border-l-4 bg-card p-3 active:cursor-grabbing ${getBookingStatusStyle(appointment.status).borderClass} ${
                            draggingId === appointment.id ? "opacity-60" : ""
                          } ${movingId === appointment.id ? "animate-pulse" : ""}`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-medium text-brand-deep">
                                {formatDate(appointment.startsAt)}
                              </p>
                              <p className="truncate text-sm text-muted-foreground">
                                {appointment.clientName} · {appointment.therapistName ?? "—"}
                              </p>
                              <div className="mt-2">{manageTokenBadge(appointment)}</div>
                            </div>
                            <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
                              {bookingStatusBadge(appointment.status)}
                              {googleStatusBadge(appointment)}
                              {renderEditButton(appointment)}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void openTimeline(appointment)}
                              >
                                <History className="h-4 w-4" />
                                Timeline
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={
                                  appointment.manageTokenStatus !== "active" ||
                                  revokingId === appointment.id
                                }
                                onClick={() => void onRevokeManageToken(appointment)}
                              >
                                {revokingId === appointment.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                                ) : (
                                  <ShieldOff className="h-4 w-4" aria-hidden />
                                )}
                                Revoke link
                              </Button>
                              {renderDeleteButton(appointment)}
                              {renderArchiveButton(appointment)}
                            </div>
                          </div>
                        </div>
                      )}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {showHiddenTemporary && hiddenTemporaryRows.length ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                  Temporary holds
                </p>
                <h2 className="mt-1 text-lg font-semibold text-brand-deep">
                  Hidden from the booking calendar
                </h2>
                <p className="mt-1 max-w-2xl text-sm text-amber-900/80">
                  These rows are unpaid holds, uncommitted checkout attempts, or expired temporary
                  holds. They stay here for diagnostics and cleanup without blocking the main
                  schedule view.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void refresh()}
                disabled={refreshing}
              >
                {refreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <RefreshCw className="h-4 w-4" aria-hidden />
                )}
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => void onBulkDeleteTemporary()}
                disabled={bulkDeletingTemporary}
              >
                {bulkDeletingTemporary ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Trash2 className="h-4 w-4" aria-hidden />
                )}
                Clear temporary test bookings
              </Button>
            </div>

            <div className="mt-5 overflow-x-auto rounded-xl border border-amber-200 bg-card">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Booking</th>
                    <th className="px-4 py-3 font-semibold">Client</th>
                    <th className="px-4 py-3 font-semibold">When</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Payment</th>
                    <th className="px-4 py-3 font-semibold">Hold expiry</th>
                    <th className="px-4 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {hiddenTemporaryRows.map((appointment) => (
                    <tr key={appointment.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-brand-deep">
                          {appointment.bookingReference}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {appointment.serviceName ?? "No service"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-brand-deep">{appointment.clientName}</p>
                        <p className="text-xs text-muted-foreground">{appointment.clientEmail}</p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {formatDate(appointment.startsAt)}
                      </td>
                      <td className="px-4 py-3">{bookingStatusBadge(appointment.status)}</td>
                      <td className="px-4 py-3">{paymentBadge(appointment)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {appointment.holdExpiresAt ? formatDate(appointment.holdExpiresAt) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void openTimeline(appointment)}
                          >
                            <History className="h-4 w-4" aria-hidden />
                            Timeline
                          </Button>
                          {renderDeleteButton(appointment)}
                          {renderArchiveButton(appointment)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <Dialog open={dayViewOpen} onOpenChange={setDayViewOpen}>
          <DialogContent className="flex h-[95dvh] max-h-none w-[98vw] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
            <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
              <DialogTitle>
                {selectedDate ? formatDate(`${selectedDate}T00:00:00.000Z`) : "Selected day"}
              </DialogTitle>
              <DialogDescription>
                {selectedAppointments.length} session
                {selectedAppointments.length === 1 ? "" : "s"} · time, therapist, client, mode and
                payment at a glance.
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {selectedAppointments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/70 p-10 text-center text-sm text-muted-foreground">
                  No sessions for this day.
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                  {selectedAppointments.map((appointment) => {
                    const isNow = daySummary.currentAppointments.some(
                      (current) => current.id === appointment.id,
                    );
                    const statusStyle = getBookingStatusStyle(appointment.status);
                    return (
                      <article
                        key={appointment.id}
                        className={`rounded-2xl border border-l-4 p-4 ${
                          isNow ? statusStyle.surfaceClass : `bg-card ${statusStyle.borderClass}`
                        }`}
                      >
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                          <div className="min-w-0">
                            <p className="text-lg font-semibold text-brand-deep">
                              {formatTimeRange(appointment.startsAt, appointment.endsAt)}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {appointment.bookingReference}
                            </p>
                          </div>
                          {isNow ? (
                            <span className="shrink-0 rounded-full bg-brand-blue px-2 py-0.5 text-xs font-semibold text-white">
                              Now
                            </span>
                          ) : null}
                        </div>

                        <dl className="mt-4 space-y-2 text-sm">
                          <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2">
                            <dt className="text-muted-foreground">Client</dt>
                            <dd className="min-w-0 truncate font-medium text-brand-deep">
                              {appointment.clientName}
                            </dd>
                          </div>
                          <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2">
                            <dt className="text-muted-foreground">Email</dt>
                            <dd className="min-w-0 truncate">{appointment.clientEmail}</dd>
                          </div>
                          <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2">
                            <dt className="text-muted-foreground">Therapist</dt>
                            <dd className="min-w-0 truncate">{appointment.therapistName ?? "—"}</dd>
                          </div>
                          <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2">
                            <dt className="text-muted-foreground">Service</dt>
                            <dd className="min-w-0 truncate">{appointment.serviceName ?? "—"}</dd>
                          </div>
                          <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2">
                            <dt className="text-muted-foreground">Mode</dt>
                            <dd>{modeLabels[appointment.mode] ?? appointment.mode}</dd>
                          </div>
                        </dl>

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          {bookingStatusBadge(appointment.status)}
                          {paymentBadge(appointment)}
                          {manageTokenBadge(appointment)}
                          {googleStatusBadge(appointment)}
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>24h reminder</span>
                          {statusBadge(appointment.reminder24hStatus)}
                          <span>1h reminder</span>
                          {statusBadge(appointment.reminder1hStatus)}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {renderEditButton(appointment)}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void openTimeline(appointment)}
                          >
                            <History className="h-4 w-4" aria-hidden />
                            Timeline
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={sendingKey === `${appointment.id}:booking_reminder_24h`}
                            onClick={() => void onResend(appointment, "booking_reminder_24h")}
                          >
                            {sendingKey === `${appointment.id}:booking_reminder_24h` ? (
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            ) : (
                              <Send className="h-4 w-4" aria-hidden />
                            )}
                            Resend 24h
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={
                              appointment.status !== "confirmed" ||
                              sendingKey === `${appointment.id}:booking_confirmation`
                            }
                            onClick={() => void onResendConfirmation(appointment)}
                          >
                            {sendingKey === `${appointment.id}:booking_confirmation` ? (
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            ) : (
                              <Mail className="h-4 w-4" aria-hidden />
                            )}
                            Resend confirmation
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={
                              appointment.manageTokenStatus !== "active" ||
                              revokingId === appointment.id
                            }
                            onClick={() => void onRevokeManageToken(appointment)}
                          >
                            {revokingId === appointment.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            ) : (
                              <ShieldOff className="h-4 w-4" aria-hidden />
                            )}
                            Revoke link
                          </Button>
                          {renderDeleteButton(appointment)}
                          {renderArchiveButton(appointment)}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={Boolean(editing)}
          onOpenChange={(open) => {
            if (!open && !editSaving) setEditing(null);
          }}
        >
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit booking</DialogTitle>
              <DialogDescription>
                {editing
                  ? `${editing.bookingReference} · ${editing.clientName}`
                  : "Change the date and time for this booking."}
              </DialogDescription>
            </DialogHeader>

            {editing ? (
              <div className="space-y-5">
                <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-muted-foreground">Current time</dt>
                      <dd className="font-medium text-brand-deep">
                        {formatDate(editing.startsAt)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Therapist</dt>
                      <dd className="font-medium text-brand-deep">
                        {editing.therapistName ?? "Unassigned"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Service</dt>
                      <dd className="font-medium text-brand-deep">
                        {editing.serviceName ?? "Not recorded"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Google Meet</dt>
                      <dd>{googleStatusBadge(editing)}</dd>
                    </div>
                  </dl>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-booking-date">New date</Label>
                  <DateInput
                    id="edit-booking-date"
                    value={editDate}
                    min={todayDateKey}
                    disabled={editSaving}
                    onChange={(event) => setEditDate(event.currentTarget.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Choose a date first. Available times are loaded from therapist availability.
                  </p>
                </div>

                <div className="space-y-3">
                  <Label>Available times</Label>
                  {editSlotsLoading ? (
                    <div className="flex items-center gap-2 rounded-xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      Loading available times...
                    </div>
                  ) : editSlots.length ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {editSlots.map((slot) => {
                        const selected = editSlot === slotKey(slot);
                        const alternateTherapist = slot.therapistId !== editing.therapistId;
                        return (
                          <button
                            key={slotKey(slot)}
                            type="button"
                            disabled={editSaving}
                            aria-pressed={selected}
                            onClick={() => setEditSlot(slotKey(slot))}
                            className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                              selected
                                ? "border-brand-blue bg-brand-blue-soft text-brand-deep"
                                : "border-border/70 bg-background hover:border-brand-blue/60"
                            }`}
                          >
                            <span className="font-medium">
                              {formatTimeRange(slot.startsAt, slot.endsAt)}
                            </span>
                            <span className="mt-1 block text-xs text-muted-foreground">
                              {slot.therapistName}
                            </span>
                            {alternateTherapist ? (
                              <span className="mt-1 block text-xs text-muted-foreground">
                                Available with another therapist
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                      No available times for this date.
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
                  <Button variant="outline" onClick={() => setEditing(null)} disabled={editSaving}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => void saveEditedBooking()}
                    disabled={!editSlot || editSaving}
                  >
                    {editSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                    Save booking
                  </Button>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>

        <Dialog open={timelineOpen} onOpenChange={setTimelineOpen}>
          <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Appointment timeline</DialogTitle>
              <DialogDescription>
                {timeline?.bookingReference ?? "Loading booking activity…"}
              </DialogDescription>
            </DialogHeader>
            {timelineLoading ? (
              <div className="space-y-4 py-4" aria-label="Loading appointment timeline">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="flex animate-pulse gap-3">
                    <div className="h-9 w-9 rounded-full bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-2/5 rounded bg-muted" />
                      <div className="h-3 w-3/5 rounded bg-muted" />
                    </div>
                  </div>
                ))}
              </div>
            ) : timeline?.entries.length ? (
              <ol className="relative ml-4 border-l border-border py-2">
                {timeline.entries.map((entry) => {
                  const Icon = timelineIcon(entry.category);
                  return (
                    <li key={entry.id} className="relative ml-7 pb-6 last:pb-2">
                      <span
                        className={`absolute -left-[2.8rem] grid h-9 w-9 place-items-center rounded-full border bg-card ${
                          entry.tone === "danger"
                            ? "border-status-cancelled/50 text-status-cancelled-strong"
                            : entry.tone === "success"
                              ? "border-status-confirmed/50 text-status-confirmed-strong"
                              : entry.tone === "warning"
                                ? "border-status-pending/50 text-status-pending-strong"
                                : "border-status-completed/50 text-status-completed-strong"
                        }`}
                      >
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="font-medium text-brand-deep">{entry.title}</p>
                        <time className="text-xs text-muted-foreground" dateTime={entry.createdAt}>
                          {formatDate(entry.createdAt)}
                        </time>
                      </div>
                      {entry.detail ? (
                        <p className="mt-1 break-words text-sm text-muted-foreground">
                          {entry.detail}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No timeline events have been recorded for this booking.
              </p>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </AdminWorkspaceShell>
  );
}
