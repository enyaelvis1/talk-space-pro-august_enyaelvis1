import type { ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  CalendarClock,
  Clock3,
  Files,
  Image,
  ListChecks,
  MailWarning,
  Sparkles,
  Video,
  UsersRound,
  Briefcase,
  CreditCard,
  Settings2,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

import { AdminWorkspaceShell } from "@/components/progress/AdminSidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { statusLabel, type ChecklistStatus, type ProgressSnapshot } from "@/lib/checklist-progress";
import type { UpcomingAppointmentRow } from "@/lib/booking.functions";
import type { AdminDashboardSummary, AdminFailureQueues } from "@/lib/admin.functions";

const statusStyles: Record<ChecklistStatus, string> = {
  completed: "bg-brand-mint",
  in_progress: "bg-brand-blue",
  partial: "bg-warning",
  blocked: "bg-danger",
  not_started: "bg-slate-300",
};

const statusBadgeStyles: Record<ChecklistStatus, string> = {
  completed: "border-brand-mint/30 bg-brand-mint-soft text-brand-deep",
  in_progress: "border-brand-blue/20 bg-brand-blue-soft text-brand-blue",
  partial: "border-warning/20 bg-warning/10 text-warning",
  blocked: "border-danger/20 bg-danger/10 text-danger",
  not_started: "border-border bg-muted text-muted-foreground",
};

function MetricCard({
  label,
  value,
  detail,
  icon,
  tone = "blue",
}: {
  label: string;
  value: number | string;
  detail: string;
  icon: ReactNode;
  tone?: "blue" | "mint" | "danger" | "neutral";
}) {
  const tones = {
    blue: "bg-brand-blue-soft text-brand-blue",
    mint: "bg-brand-mint-soft text-brand-deep",
    danger: "bg-danger/10 text-danger",
    neutral: "bg-muted text-muted-foreground",
  };

  return (
    <Card className="border-border/80 shadow-[0_8px_30px_rgba(22,50,79,0.04)]">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-brand-deep">{value}</p>
          </div>
          <div className={`rounded-xl p-3 ${tones[tone]}`} aria-hidden>
            {icon}
          </div>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function StatusBar({
  label,
  value,
  total,
  status,
}: {
  label: string;
  value: number;
  total: number;
  status: ChecklistStatus;
}) {
  const percentage = total ? Math.round((value / total) * 100) : 0;

  return (
    <div>
      <div className="flex items-center justify-between gap-4 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className={`h-2 w-2 rounded-full ${statusStyles[status]}`} aria-hidden />
          <span>{label}</span>
        </div>
        <span className="font-medium text-brand-deep">{value}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${statusStyles[status]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function TaskStatusBadge({ status }: { status: ChecklistStatus }) {
  return (
    <Badge className={`rounded-full px-2.5 py-1 text-[0.6875rem] ${statusBadgeStyles[status]}`}>
      {statusLabel(status)}
    </Badge>
  );
}

function formatGeneratedDate(value: string) {
  return value.slice(0, 10);
}

const lagosDateTimeFormatter = new Intl.DateTimeFormat("en-NG", {
  timeZone: "Africa/Lagos",
  dateStyle: "medium",
  timeStyle: "short",
});

function formatLagosDateTime(value: string) {
  return lagosDateTimeFormatter.format(new Date(value));
}

function appointmentStatusBadge(status: string) {
  switch (status) {
    case "confirmed":
      return "border-brand-mint/30 bg-brand-mint-soft text-brand-deep";
    case "pending_payment":
      return "border-warning/20 bg-warning/10 text-warning";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

export function AdminOverview({
  snapshot,
  summary: adminSummary,
  failureQueues,
  todayAppointments,
  upcomingAppointments,
  canViewProgress,
}: {
  snapshot: ProgressSnapshot;
  summary: AdminDashboardSummary;
  failureQueues: AdminFailureQueues;
  todayAppointments: UpcomingAppointmentRow[];
  upcomingAppointments: UpcomingAppointmentRow[];
  canViewProgress: boolean;
}) {
  const { summary } = snapshot;
  const directCompletionPercentage = summary.total
    ? Math.round((summary.completed / summary.total) * 100)
    : 0;
  const nextTasks = snapshot.nextTasks.slice(0, 4);
  const sortedAppointments = [...upcomingAppointments].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );
  const todayAppointmentsSorted = [...todayAppointments].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );
  const todayIds = new Set(todayAppointmentsSorted.map((row) => row.id));
  const upcomingSoon = sortedAppointments.filter((row) => !todayIds.has(row.id));

  return (
    <AdminWorkspaceShell>
      <main id="main" className="flex-1 py-8 sm:py-10">
        <div className="mx-auto w-full max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">
          <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Admin workspace</span>
                <span aria-hidden>/</span>
                <span className="font-medium text-brand-deep">Dashboard</span>
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-brand-deep sm:text-4xl">
                Good to see you, team.
              </h1>
              <p className="mt-2 max-w-2xl text-muted-foreground">
                Keep a pulse on delivery, unblock the next priority, and move Talk Space forward.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="hidden text-xs text-muted-foreground sm:block">
                Synced {formatGeneratedDate(snapshot.generatedAt)}
              </p>
              {canViewProgress ? (
                <Button asChild className="gap-2 bg-brand-deep text-white hover:bg-brand-deep/90">
                  <Link to="/admin/progress">
                    Open tracker <ArrowUpRight className="h-4 w-4" aria-hidden />
                  </Link>
                </Button>
              ) : null}
            </div>
          </header>

          {/* Quick shortcuts: visible cards for easy access */}
          <h2 className="text-xl font-semibold text-brand-deep">Operations shortcuts</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
            <Link
              to="/admin/clients"
              className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue rounded-lg transition-transform hover:-translate-y-0.5 hover:shadow-lg"
            >
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-md bg-brand-mint-soft p-2 text-brand-deep">
                        <UsersRound className="h-5 w-5" aria-hidden />
                      </div>
                      <div>
                        <p className="font-semibold text-brand-deep">Clients</p>
                        <p className="text-sm text-muted-foreground">Manage client records</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-semibold text-brand-deep">
                        {adminSummary.clients}
                      </p>
                      <p className="text-xs text-muted-foreground">total</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link
              to="/admin/services"
              className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue rounded-lg transition-transform hover:-translate-y-0.5 hover:shadow-lg"
            >
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-md bg-brand-blue-soft p-2 text-brand-blue">
                        <Briefcase className="h-5 w-5" aria-hidden />
                      </div>
                      <div>
                        <p className="font-semibold text-brand-deep">Services</p>
                        <p className="text-sm text-muted-foreground">
                          Configure services & pricing
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-semibold text-brand-deep">&nbsp;</p>
                      <p className="text-xs text-muted-foreground">&nbsp;</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link
              to="/admin/therapists"
              className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue rounded-lg transition-transform hover:-translate-y-0.5 hover:shadow-lg"
            >
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-md bg-brand-blue-soft p-2 text-brand-blue">
                        <UsersRound className="h-5 w-5" aria-hidden />
                      </div>
                      <div>
                        <p className="font-semibold text-brand-deep">Therapists</p>
                        <p className="text-sm text-muted-foreground">Profile and availability</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-semibold text-brand-deep">
                        {adminSummary.activeTherapists}
                      </p>
                      <p className="text-xs text-muted-foreground">active</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link
              to="/admin/bookings"
              className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue rounded-lg transition-transform hover:-translate-y-0.5 hover:shadow-lg"
            >
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-md bg-brand-mint-soft p-2 text-brand-deep">
                        <CalendarClock className="h-5 w-5" aria-hidden />
                      </div>
                      <div>
                        <p className="font-semibold text-brand-deep">Bookings</p>
                        <p className="text-sm text-muted-foreground">View upcoming sessions</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-semibold text-brand-deep">
                        {adminSummary.upcomingBookings}
                      </p>
                      <p className="text-xs text-muted-foreground">upcoming</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link
              to="/admin/payments"
              className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue rounded-lg transition-transform hover:-translate-y-0.5 hover:shadow-lg"
            >
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-md bg-warning/10 p-2 text-warning">
                        <CreditCard className="h-5 w-5" aria-hidden />
                      </div>
                      <div>
                        <p className="font-semibold text-brand-deep">Payments</p>
                        <p className="text-sm text-muted-foreground">Review payments & transfers</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-semibold text-brand-deep">
                        {adminSummary.pendingTransfers}
                      </p>
                      <p className="text-xs text-muted-foreground">pending</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link
              to="/admin/google"
              className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue rounded-lg transition-transform hover:-translate-y-0.5 hover:shadow-lg"
            >
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-md bg-brand-blue-soft p-2 text-brand-blue">
                        <Files className="h-5 w-5" aria-hidden />
                      </div>
                      <div>
                        <p className="font-semibold text-brand-deep">Google Calendar</p>
                        <p className="text-sm text-muted-foreground">Sync & calendar issues</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-semibold text-brand-deep">
                        {adminSummary.failedGoogleSyncs}
                      </p>
                      <p className="text-xs text-muted-foreground">sync issues</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link
              to="/admin/pages"
              className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue rounded-lg transition-transform hover:-translate-y-0.5 hover:shadow-lg"
            >
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-md bg-brand-blue-soft p-2 text-brand-blue">
                        <Files className="h-5 w-5" aria-hidden />
                      </div>
                      <div>
                        <p className="font-semibold text-brand-deep">Pages</p>
                        <p className="text-sm text-muted-foreground">Manage public pages</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-semibold text-brand-deep">&nbsp;</p>
                      <p className="text-xs text-muted-foreground">&nbsp;</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link
              to="/admin/settings"
              className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue rounded-lg transition-transform hover:-translate-y-0.5 hover:shadow-lg"
            >
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-md bg-muted p-2 text-muted-foreground">
                        <Settings2 className="h-5 w-5" aria-hidden />
                      </div>
                      <div>
                        <p className="font-semibold text-brand-deep">Settings</p>
                        <p className="text-sm text-muted-foreground">Workspace configuration</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-semibold text-brand-deep">&nbsp;</p>
                      <p className="text-xs text-muted-foreground">&nbsp;</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>

          {canViewProgress ? (
            <>
              <section
                aria-labelledby="workspace-health-heading"
                className="relative overflow-hidden rounded-2xl bg-brand-deep p-6 text-white shadow-[0_16px_45px_rgba(22,50,79,0.16)] sm:p-8"
              >
                <div
                  className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-brand-mint/20 blur-2xl"
                  aria-hidden
                />
                <div
                  className="absolute -bottom-28 right-1/3 h-56 w-56 rounded-full bg-brand-blue/40 blur-3xl"
                  aria-hidden
                />
                <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-brand-mint">
                      <Sparkles className="h-4 w-4" aria-hidden />
                      <span>Workspace health</span>
                    </div>
                    <h2
                      id="workspace-health-heading"
                      className="mt-4 text-2xl font-semibold text-white sm:text-3xl"
                    >
                      {summary.completed} of {summary.total} tasks are complete (
                      {directCompletionPercentage}%).
                    </h2>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-white/70">
                      Use the tracker to review ownership, status, and the next delivery milestone.
                      Weighted progress, including partial tasks, is {summary.completionPercentage}
                      %.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-3">
                      <Button
                        asChild
                        variant="secondary"
                        className="gap-2 bg-white text-brand-deep hover:bg-white/90"
                      >
                        <Link to="/admin/progress">
                          Review project progress <ArrowRight className="h-4 w-4" aria-hidden />
                        </Link>
                      </Button>
                      <Button
                        asChild
                        variant="ghost"
                        className="text-white hover:bg-white/10 hover:text-white"
                      >
                        <Link to="/account">View account</Link>
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-5 rounded-2xl border border-white/10 bg-white/[0.08] p-5 sm:min-w-64">
                    <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-white/10">
                      <div
                        className="absolute inset-1 rounded-full"
                        style={{
                          background: `conic-gradient(var(--brand-mint) ${summary.completionPercentage}%, rgba(255,255,255,0.14) 0)`,
                        }}
                        aria-hidden
                      />
                      <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-brand-deep text-xl font-semibold">
                        {directCompletionPercentage}%
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white/70">Fully completed</p>
                      <p className="mt-2 text-sm text-white/90">
                        {summary.total - summary.completed} tasks remaining
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <section
                aria-label="Implementation metrics"
                className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
              >
                <MetricCard
                  label="Completed"
                  value={summary.completed}
                  detail={`of ${summary.total} total checklist tasks`}
                  icon={<CheckCircle2 className="h-5 w-5" aria-hidden />}
                  tone="mint"
                />
                <MetricCard
                  label="In progress"
                  value={summary.inProgress}
                  detail="Tasks actively being worked on"
                  icon={<Clock3 className="h-5 w-5" aria-hidden />}
                />
                <MetricCard
                  label="Needs attention"
                  value={summary.blocked}
                  detail={`${summary.partial} partial task${summary.partial === 1 ? "" : "s"} also need review`}
                  icon={<CircleAlert className="h-5 w-5" aria-hidden />}
                  tone={summary.blocked ? "danger" : "mint"}
                />
                <MetricCard
                  label="Not started"
                  value={summary.notStarted}
                  detail="Queued for a future implementation batch"
                  icon={<ListChecks className="h-5 w-5" aria-hidden />}
                  tone="neutral"
                />
                <MetricCard
                  label="Pending payments"
                  value={adminSummary.pendingTransfers}
                  detail="Payments awaiting confirmation or follow-up"
                  icon={<Files className="h-5 w-5" aria-hidden />}
                  tone={adminSummary.pendingTransfers ? "danger" : "neutral"}
                />
                <MetricCard
                  label="Pending forms"
                  value={adminSummary.pendingForms}
                  detail="Draft and in-progress intake submissions"
                  icon={<Sparkles className="h-5 w-5" aria-hidden />}
                  tone={adminSummary.pendingForms ? "blue" : "mint"}
                />
                <MetricCard
                  label="Meet sync issues"
                  value={adminSummary.failedGoogleSyncs}
                  detail="Appointments that need Google Calendar attention"
                  icon={<CircleAlert className="h-5 w-5" aria-hidden />}
                  tone={adminSummary.failedGoogleSyncs ? "danger" : "mint"}
                />
              </section>
            </>
          ) : null}

          {!canViewProgress ? (
            <>
              <section aria-labelledby="operations-overview-heading">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="eyebrow">Operations overview</p>
                    <h2
                      id="operations-overview-heading"
                      className="mt-2 text-2xl font-semibold text-brand-deep"
                    >
                      Today at Talk Space
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      A live snapshot of the bookings, transfers, forms, and follow-up queues your
                      team manages.
                    </p>
                  </div>
                  <Button asChild variant="outline" className="hidden sm:inline-flex">
                    <Link to="/admin/bookings">
                      Open bookings <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <MetricCard
                    label="Today"
                    value={todayAppointmentsSorted.length}
                    detail="Appointments happening today"
                    icon={<CalendarClock className="h-5 w-5" aria-hidden />}
                    tone="blue"
                  />
                  <MetricCard
                    label="Upcoming bookings"
                    value={adminSummary.upcomingBookings}
                    detail="Confirmed or awaiting payment"
                    icon={<Clock3 className="h-5 w-5" aria-hidden />}
                  />
                  <MetricCard
                    label="Clients"
                    value={adminSummary.clients}
                    detail="Client records in the workspace"
                    icon={<Files className="h-5 w-5" aria-hidden />}
                    tone="mint"
                  />
                  <MetricCard
                    label="Active therapists"
                    value={adminSummary.activeTherapists}
                    detail="Profiles visible for operations"
                    icon={<CheckCircle2 className="h-5 w-5" aria-hidden />}
                  />
                  <MetricCard
                    label="Unread messages"
                    value={adminSummary.pendingMessages}
                    detail="Contact messages awaiting acknowledgement"
                    icon={<CircleAlert className="h-5 w-5" aria-hidden />}
                    tone={adminSummary.pendingMessages ? "danger" : "mint"}
                  />
                  <MetricCard
                    label="Pending payments"
                    value={adminSummary.pendingTransfers}
                    detail="Payments awaiting confirmation or follow-up"
                    icon={<Files className="h-5 w-5" aria-hidden />}
                    tone={adminSummary.pendingTransfers ? "danger" : "neutral"}
                  />
                </div>
              </section>
              <section className="grid gap-6 lg:grid-cols-2">
                <Card className="border-border/80 shadow-[0_8px_30px_rgba(22,50,79,0.04)]">
                  <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
                    <div>
                      <p className="eyebrow">Today</p>
                      <CardTitle className="mt-2 text-xl text-brand-deep">
                        Sessions happening now
                      </CardTitle>
                      <p className="mt-2 text-sm text-muted-foreground">
                        The appointments scheduled for today in Africa/Lagos time.
                      </p>
                    </div>
                    <CalendarClock className="h-5 w-5 text-brand-blue" aria-hidden />
                  </CardHeader>
                  <CardContent>
                    {todayAppointmentsSorted.length ? (
                      <ul className="space-y-3">
                        {todayAppointmentsSorted.slice(0, 5).map((appointment) => (
                          <li
                            key={appointment.id}
                            className="rounded-xl border border-border/70 bg-surface-page p-4"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-brand-deep">
                                  {appointment.clientName}
                                </p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {appointment.serviceName ?? "Session"} ·{" "}
                                  {appointment.therapistName ?? "Unassigned"}
                                </p>
                              </div>
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${appointmentStatusBadge(appointment.status)}`}
                              >
                                {appointment.status.replace(/_/g, " ")}
                              </span>
                            </div>
                            <p className="mt-3 text-sm text-brand-deep">
                              {formatLagosDateTime(appointment.startsAt)} ·{" "}
                              {appointment.mode === "online" ? "Online" : "In-person"}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {appointment.bookingReference} · {appointment.clientEmail}
                            </p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="rounded-xl bg-brand-mint-soft p-4 text-sm text-brand-deep">
                        No sessions are scheduled for today.
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border/80 shadow-[0_8px_30px_rgba(22,50,79,0.04)]">
                  <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
                    <div>
                      <p className="eyebrow">Upcoming</p>
                      <CardTitle className="mt-2 text-xl text-brand-deep">Next sessions</CardTitle>
                      <p className="mt-2 text-sm text-muted-foreground">
                        A quick look at the next appointments in the 30-day booking window.
                      </p>
                    </div>
                    <Clock3 className="h-5 w-5 text-brand-blue" aria-hidden />
                  </CardHeader>
                  <CardContent>
                    {upcomingSoon.length ? (
                      <ol className="space-y-3">
                        {upcomingSoon.slice(0, 6).map((appointment, index) => (
                          <li
                            key={appointment.id}
                            className="flex gap-3 rounded-xl border border-border/70 bg-surface-page p-4"
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-blue-soft text-xs font-semibold text-brand-blue">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="font-semibold text-brand-deep">
                                    {appointment.clientName}
                                  </p>
                                  <p className="mt-1 text-sm text-muted-foreground">
                                    {appointment.serviceName ?? "Session"} ·{" "}
                                    {appointment.therapistName ?? "Unassigned"}
                                  </p>
                                </div>
                                <span
                                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${appointmentStatusBadge(appointment.status)}`}
                                >
                                  {appointment.status.replace(/_/g, " ")}
                                </span>
                              </div>
                              <p className="mt-3 text-sm text-brand-deep">
                                {formatLagosDateTime(appointment.startsAt)} ·{" "}
                                {appointment.mode === "online" ? "Online" : "In-person"}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {appointment.bookingReference} · {appointment.clientEmail}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <div className="rounded-xl bg-brand-mint-soft p-4 text-sm text-brand-deep">
                        No upcoming sessions after today.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </section>
              <section className="grid gap-4 sm:grid-cols-3">
                <ContentShortcut
                  href="/admin/journal"
                  label="Journal"
                  detail={`${adminSummary.posts} posts · create or edit articles`}
                  icon={<Files className="h-5 w-5" aria-hidden />}
                />
                <ContentShortcut
                  href="/admin/therapists"
                  label="Therapists"
                  detail={`${adminSummary.activeTherapists} active profiles · manage availability`}
                  icon={<CheckCircle2 className="h-5 w-5" aria-hidden />}
                />
                <ContentShortcut
                  href="/admin/settings"
                  label="Site settings"
                  detail="Logo, contact details, colors, and integrations"
                  icon={<Sparkles className="h-5 w-5" aria-hidden />}
                />
              </section>
            </>
          ) : null}

          <section aria-labelledby="failure-queues-heading">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <p className="eyebrow">Needs attention</p>
                <h2
                  id="failure-queues-heading"
                  className="mt-2 text-2xl font-semibold text-brand-deep"
                >
                  Delivery failure queues
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  Unresolved notification and Google Meet failures. Successful retries disappear
                  from these queues automatically.
                </p>
              </div>
              <Badge
                className={`w-fit rounded-full px-3 py-1 ${
                  failureQueues.notificationCount + failureQueues.meetCount
                    ? "border-danger/20 bg-danger/10 text-danger"
                    : "border-brand-mint/30 bg-brand-mint-soft text-brand-deep"
                }`}
              >
                {failureQueues.notificationCount + failureQueues.meetCount} unresolved
              </Badge>
            </div>

            <div className="mt-5 grid gap-6 lg:grid-cols-2">
              <Card className="border-border/80 shadow-[0_8px_30px_rgba(22,50,79,0.04)]">
                <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
                  <div>
                    <CardTitle className="text-lg text-brand-deep">Failed notifications</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Email attempts that still need a successful retry.
                    </p>
                  </div>
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-danger/10 text-danger">
                    <MailWarning className="h-5 w-5" aria-hidden />
                  </span>
                </CardHeader>
                <CardContent>
                  {failureQueues.notifications.length ? (
                    <ul className="space-y-3">
                      {failureQueues.notifications.map((row) => (
                        <li
                          key={row.id}
                          className="rounded-xl border border-border/70 bg-surface-page p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <p className="font-medium text-brand-deep">
                              {row.templateKey?.replace(/_/g, " ") ?? "Direct email"}
                            </p>
                            <span className="text-xs text-muted-foreground">
                              {formatLagosDateTime(row.createdAt)}
                            </span>
                          </div>
                          <p className="mt-1 break-all text-xs text-muted-foreground">
                            {row.recipient} · {row.retryCount} retries
                          </p>
                          <p className="mt-2 line-clamp-2 text-sm text-danger" title={row.error}>
                            {row.error}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="rounded-xl bg-brand-mint-soft p-4 text-sm text-brand-deep">
                      No unresolved notification failures.
                    </div>
                  )}
                  <Button asChild variant="outline" className="mt-4 w-full">
                    <Link to="/admin/emails">
                      Review email delivery <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-border/80 shadow-[0_8px_30px_rgba(22,50,79,0.04)]">
                <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
                  <div>
                    <CardTitle className="text-lg text-brand-deep">Failed Meet syncs</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Appointments missing a successful Calendar or Meet synchronisation.
                    </p>
                  </div>
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-danger/10 text-danger">
                    <Video className="h-5 w-5" aria-hidden />
                  </span>
                </CardHeader>
                <CardContent>
                  {failureQueues.meetSyncs.length ? (
                    <ul className="space-y-3">
                      {failureQueues.meetSyncs.map((row) => (
                        <li
                          key={row.appointmentId}
                          className="rounded-xl border border-border/70 bg-surface-page p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="font-medium text-brand-deep">{row.clientName}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {row.bookingReference} · {row.therapistName ?? "Unassigned"}
                              </p>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {formatLagosDateTime(row.startsAt)}
                            </span>
                          </div>
                          <p className="mt-2 line-clamp-2 text-sm text-danger" title={row.error}>
                            {row.error}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="rounded-xl bg-brand-mint-soft p-4 text-sm text-brand-deep">
                      No unresolved Calendar or Meet failures.
                    </div>
                  )}
                  <Button asChild variant="outline" className="mt-4 w-full">
                    <Link to="/admin/google">
                      Review Google sync <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </section>

          <section aria-labelledby="content-shortcuts-heading">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="eyebrow">Content workspace</p>
                <h2
                  id="content-shortcuts-heading"
                  className="mt-2 text-2xl font-semibold text-brand-deep"
                >
                  Manage public content
                </h2>
              </div>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <ContentShortcut
                href="/admin/hero"
                label="Hero section"
                detail="Edit homepage copy and hero images."
                icon={<Image className="h-5 w-5" aria-hidden />}
              />
              <ContentShortcut
                href="/admin/pages"
                label="Pages"
                detail="Manage published website pages."
                icon={<Files className="h-5 w-5" aria-hidden />}
              />
              <ContentShortcut
                href="/admin/media"
                label="Media library"
                detail="Upload and organize public images."
                icon={<Sparkles className="h-5 w-5" aria-hidden />}
              />
            </div>
          </section>

          {canViewProgress ? (
            <>
              <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                <Card className="border-border/80 shadow-[0_8px_30px_rgba(22,50,79,0.04)]">
                  <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
                    <div>
                      <p className="eyebrow">Status breakdown</p>
                      <CardTitle className="mt-2 text-xl text-brand-deep">
                        Implementation health
                      </CardTitle>
                      <p className="mt-2 text-sm text-muted-foreground">
                        A live view of work across the implementation checklist.
                      </p>
                    </div>
                    <Link
                      to="/admin/progress"
                      aria-label="View full progress details"
                      className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-brand-blue-soft hover:text-brand-blue"
                    >
                      <ArrowUpRight className="h-5 w-5" aria-hidden />
                    </Link>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <StatusBar
                      label="Completed"
                      value={summary.completed}
                      total={summary.total}
                      status="completed"
                    />
                    <StatusBar
                      label="In progress"
                      value={summary.inProgress}
                      total={summary.total}
                      status="in_progress"
                    />
                    <StatusBar
                      label="Partial"
                      value={summary.partial}
                      total={summary.total}
                      status="partial"
                    />
                    <StatusBar
                      label="Blocked"
                      value={summary.blocked}
                      total={summary.total}
                      status="blocked"
                    />
                    <StatusBar
                      label="Not started"
                      value={summary.notStarted}
                      total={summary.total}
                      status="not_started"
                    />
                  </CardContent>
                </Card>

                <Card className="border-border/80 shadow-[0_8px_30px_rgba(22,50,79,0.04)]">
                  <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
                    <div>
                      <p className="eyebrow">Priority queue</p>
                      <CardTitle className="mt-2 text-xl text-brand-deep">Next up</CardTitle>
                      <p className="mt-2 text-sm text-muted-foreground">
                        The next tasks in your delivery queue.
                      </p>
                    </div>
                    <ListChecks className="h-5 w-5 text-brand-blue" aria-hidden />
                  </CardHeader>
                  <CardContent>
                    {nextTasks.length ? (
                      <ol className="space-y-1">
                        {nextTasks.map((task, index) => (
                          <li
                            key={task.key}
                            className="flex gap-3 rounded-xl p-3 transition-colors hover:bg-surface-page"
                          >
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-blue-soft text-xs font-semibold text-brand-blue">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="line-clamp-2 text-sm font-medium leading-5 text-brand-deep">
                                {task.text}
                              </p>
                              <div className="mt-2 flex items-center gap-2">
                                <TaskStatusBadge status={task.status} />
                                {task.link ? (
                                  <a
                                    href={task.link.href}
                                    className="text-xs font-medium text-brand-blue-deep hover:text-brand-deep"
                                  >
                                    {task.link.label}
                                  </a>
                                ) : null}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <div className="rounded-xl bg-brand-mint-soft p-4 text-sm text-brand-deep">
                        All tracked tasks are complete. Nice work.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </section>
            </>
          ) : null}

          {canViewProgress ? (
            <section aria-labelledby="milestone-overview-heading">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="eyebrow">Delivery plan</p>
                  <h2
                    id="milestone-overview-heading"
                    className="mt-2 text-2xl font-semibold text-brand-deep"
                  >
                    Milestones
                  </h2>
                </div>
                <Link
                  to="/admin/progress"
                  className="inline-flex items-center gap-1 text-sm font-medium text-brand-blue-deep hover:text-brand-deep"
                >
                  View details <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {snapshot.milestones.map((milestone) => (
                  <Card
                    key={milestone.id}
                    className="border-border/80 shadow-[0_8px_30px_rgba(22,50,79,0.04)] transition-transform duration-200 hover:-translate-y-0.5"
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium leading-5 text-brand-deep">{milestone.title}</p>
                        {milestone.complete ? (
                          <CheckCircle2
                            className="h-5 w-5 shrink-0 text-brand-mint"
                            aria-label="Complete"
                          />
                        ) : null}
                      </div>
                      <p className="mt-5 text-3xl font-semibold tracking-tight text-brand-deep">
                        {milestone.metrics.completionPercentage}%
                      </p>
                      <Progress
                        value={milestone.metrics.completionPercentage}
                        aria-label={`${milestone.title} completion`}
                        className="mt-3 h-2 bg-brand-blue-soft [&>div]:bg-brand-mint"
                      />
                      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                        <span>
                          {milestone.metrics.completed} of {milestone.metrics.total} complete
                        </span>
                        {milestone.dueDate ? <span>Due {milestone.dueDate}</span> : null}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </main>
    </AdminWorkspaceShell>
  );
}

function ContentShortcut({
  href,
  label,
  detail,
  icon,
}: {
  href:
    | "/admin/hero"
    | "/admin/pages"
    | "/admin/media"
    | "/admin/journal"
    | "/admin/therapists"
    | "/admin/settings";
  label: string;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <Link
      to={href}
      className="group rounded-2xl border border-border/80 bg-card p-5 shadow-[0_8px_30px_rgba(22,50,79,0.04)] transition-colors hover:border-brand-mint hover:bg-brand-mint-soft/30"
    >
      <div className="flex items-start justify-between gap-4">
        <span className="rounded-xl bg-brand-mint-soft p-3 text-brand-deep">{icon}</span>
        <ArrowUpRight className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-brand-deep" />
      </div>
      <p className="mt-5 font-semibold text-brand-deep">{label}</p>
      <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
    </Link>
  );
}

export function AdminOverviewSkeleton() {
  return (
    <div className="flex min-h-screen flex-col">
      <AdminWorkspaceShell>
        <main id="main" className="flex-1 bg-surface-page py-8 sm:py-10">
          <div className="mx-auto w-full max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between gap-4">
              <div className="space-y-3">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-10 w-80 max-w-full" />
                <Skeleton className="h-5 w-96 max-w-full" />
              </div>
              <Skeleton className="hidden h-10 w-32 sm:block" />
            </div>
            <Skeleton className="h-64 rounded-2xl" />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-36 rounded-xl" />
              ))}
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <Skeleton className="h-96 rounded-xl" />
              <Skeleton className="h-96 rounded-xl" />
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <Skeleton className="h-96 rounded-xl" />
              <Skeleton className="h-96 rounded-xl" />
            </div>
            <Skeleton className="h-56 rounded-xl" />
          </div>
        </main>
      </AdminWorkspaceShell>
    </div>
  );
}
