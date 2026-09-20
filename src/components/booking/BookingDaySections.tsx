import { Fragment, type ReactNode } from "react";
import type { BookingDaySummary } from "@/lib/booking-calendar";

export function BookingDaySections({
  summary,
  renderAppointment,
}: {
  summary: BookingDaySummary;
  renderAppointment: (appointment: BookingDaySummary["currentAppointments"][number]) => ReactNode;
}) {
  const groups = [
    { label: "Now", appointments: summary.currentAppointments },
    { label: "Upcoming", appointments: summary.upcomingAppointments },
    { label: "Earlier", appointments: summary.pastAppointments },
  ];
  if (groups.every((group) => group.appointments.length === 0)) {
    return (
      <p className="p-5 text-center text-sm text-muted-foreground">No sessions for this day.</p>
    );
  }
  return (
    <div className="space-y-3">
      {groups.map((group) =>
        group.appointments.length ? (
          <section key={group.label} aria-label={group.label} className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">{group.label}</h3>
            {group.appointments.map((appointment) => (
              <Fragment key={appointment.id}>{renderAppointment(appointment)}</Fragment>
            ))}
          </section>
        ) : null,
      )}
    </div>
  );
}
