import { useState } from "react";
import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarX,
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
  Video,
} from "lucide-react";
import { toast } from "sonner";

import { SiteFooter } from "@/components/site/SiteFooter";
import { requireBrowserSession } from "@/lib/auth";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { canonicalUrl } from "@/lib/seo";
import {
  getTherapistDashboard,
  disconnectTherapistGoogle,
  startTherapistGoogleConnect,
  type TherapistDashboardAppointment,
  type TherapistDashboardData,
} from "@/lib/therapist.functions";

export const Route = createFileRoute("/_authenticated/therapist")({
  loader: async () => {
    try {
      // Ensure the browser session exists on client-side navigations so unauthenticated users
      // are redirected to the login flow before attempting to load therapist data.
      try {
        await requireBrowserSession("/therapist");
      } catch (e) {
        // requireBrowserSession will perform a redirect when not authenticated.
        // Swallow here so the outer catch returns the unavailable page with a friendly message
        // if the redirect does not take effect in this environment.
      }

      return { ok: true as const, data: await getTherapistDashboard() };
    } catch (error) {
      return {
        ok: false as const,
        message:
          error instanceof Error ? error.message : "We could not load this therapist dashboard.",
      };
    }
  },
  head: () => ({
    meta: [
      { title: "Therapist dashboard | Talk Space" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: canonicalUrl("/therapist") }],
  }),
  component: TherapistDashboardPage,
});

const dtf = new Intl.DateTimeFormat("en-NG", {
  timeZone: "Africa/Lagos",
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDate(iso: string) {
  try {
    return dtf.format(new Date(iso));
  } catch {
    return iso;
  }
}

function modeLabel(mode: string) {
  return mode.replaceAll("_", " ");
}

function statusTone(status: string) {
  if (status === "confirmed") return "bg-emerald-100 text-emerald-800";
  if (status === "cancelled" || status === "no_show") return "bg-rose-100 text-rose-800";
  if (status === "completed") return "bg-sky-100 text-sky-800";
  return "bg-muted text-muted-foreground";
}

function TherapistDashboardPage() {
  const loaded = Route.useLoaderData();
  if (!loaded.ok) {
    // Redirect non-therapist or unauthenticated users to appropriate entry points
    // Use client-side redirect to ensure a clear UX while server-side guards remain authoritative.
    if (typeof window !== "undefined") {
      const msg = String(loaded.message || "").toLowerCase();
      if (msg.includes("sign in required") || msg.includes("sign in")) {
        window.location.replace(`/login?redirect=%2Ftherapist`);
        return null;
      }
      if (msg.includes("therapist permission required") || msg.includes("no therapist profile")) {
        // Signed-in user but not a therapist — send to account page
        window.location.replace(`/account`);
        return null;
      }
    }
    return <TherapistDashboardUnavailable message={loaded.message} />;
  }

  return <TherapistDashboardContent initial={loaded.data} />;
}

function TherapistDashboardContent({ initial }: { initial: TherapistDashboardData }) {
  const [data, setData] = useState<TherapistDashboardData>(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    try {
      setData(await getTherapistDashboard());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not refresh dashboard.");
    } finally {
      setRefreshing(false);
    }
  };

  const connectGoogle = async () => {
    setConnecting(true);
    try {
      const { authorizationUrl } = await startTherapistGoogleConnect();
      window.open(authorizationUrl, "google-connect", "width=560,height=720");
      toast.success("Google connection opened. Return here and refresh after approving access.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start Google connection.");
    } finally {
      setConnecting(false);
    }
  };

  const calendarLabel = data.calendar.connected ? "Connected" : "Talk Space schedule only";
  const nextSession = data.upcoming.at(0);

  const disconnectGoogle = async () => {
    if (!window.confirm("Disconnect your Google Calendar from Talk Space?")) return;
    setDisconnecting(true);
    try {
      await disconnectTherapistGoogle();
      await refresh();
      toast.success("Google Calendar disconnected.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not disconnect Google Calendar.");
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main id="main" className="flex-1 bg-surface-page py-12 sm:py-16">
        <section className="mx-auto w-full max-w-6xl space-y-8 px-4 sm:px-6 lg:px-8">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Therapist workspace</p>
              <h1 className="display-1 mt-3 text-brand-deep">
                Welcome, {data.therapist.fullName}.
              </h1>
              <p className="mt-3 max-w-2xl text-muted-foreground">
                Manage your own confirmed Talk Space sessions, Google Calendar connection, and
                online meeting links from one private dashboard.
              </p>
            </div>
            <Button variant="outline" onClick={() => void refresh()} disabled={refreshing}>
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="h-4 w-4" aria-hidden />
              )}
              Refresh
            </Button>
          </header>

          <div className="grid gap-4 sm:grid-cols-3">
            <SummaryCard
              icon={<CalendarDays className="h-5 w-5" aria-hidden />}
              label="Today"
              value={`${data.today.length}`}
              detail={`session${data.today.length === 1 ? "" : "s"} scheduled`}
            />
            <SummaryCard
              icon={<CalendarClock className="h-5 w-5" aria-hidden />}
              label="Upcoming"
              value={`${data.upcoming.length}`}
              detail="confirmed in the next 30 days"
            />
            <SummaryCard
              icon={
                data.calendar.connected ? (
                  <CalendarCheck className="h-5 w-5" aria-hidden />
                ) : (
                  <CalendarX className="h-5 w-5" aria-hidden />
                )
              }
              label="Calendar"
              value={calendarLabel}
              detail={
                data.calendar.googleEmail ?? "Real-time Google availability is not connected yet."
              }
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
            <section className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
              <p className="eyebrow">Profile</p>
              <div className="mt-3 flex items-center gap-4">
                {data.therapist.imageUrl ? (
                  <img
                    src={data.therapist.imageUrl}
                    alt=""
                    className="h-16 w-16 rounded-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-blue-soft text-lg font-semibold text-brand-deep">
                    {data.therapist.fullName
                      .split(/\s+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((part) => part.at(0))
                      .join("")}
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="text-2xl font-semibold text-brand-deep">
                    {data.therapist.fullName}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">{data.therapist.roleTitle}</p>
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-border/70 bg-background/70 p-4">
                <p className="text-sm font-medium text-brand-deep">Next confirmed session</p>
                {nextSession ? (
                  <>
                    <p className="mt-2 text-lg font-semibold text-brand-deep">
                      {formatDate(nextSession.startsAt)}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {nextSession.clientName} · {nextSession.serviceName ?? "Talk Space session"}
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    No upcoming confirmed session is currently assigned to you.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">Calendar connection</p>
                  <h2 className="mt-1 text-2xl font-semibold text-brand-deep">Google Calendar</h2>
                </div>
                <Badge variant={data.calendar.connected ? "secondary" : "outline"}>
                  {calendarLabel}
                </Badge>
              </div>
              <div className="mt-5 rounded-xl border border-border/70 bg-background/70 p-4">
                <div className="flex items-start gap-3">
                  {data.calendar.connected ? (
                    <CalendarCheck className="mt-0.5 h-5 w-5 text-emerald-700" aria-hidden />
                  ) : (
                    <CalendarX className="mt-0.5 h-5 w-5 text-amber-700" aria-hidden />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-brand-deep">
                      {data.calendar.connected
                        ? "Google Calendar connected"
                        : "Calendar not connected"}
                    </p>
                    {data.calendar.googleEmail ? (
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {data.calendar.googleEmail}
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Real-time Google availability is unavailable; using Talk Space schedule
                        only.
                      </p>
                    )}
                    {data.calendar.lastSyncError ? (
                      <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">
                        {data.calendar.lastSyncError}
                      </p>
                    ) : null}
                    {data.calendar.lastSyncAt ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Last synced {formatDate(data.calendar.lastSyncAt)}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void connectGoogle()}
                    disabled={connecting}
                  >
                    {connecting ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <ExternalLink className="h-4 w-4" aria-hidden />
                    )}
                    {data.calendar.connected ? "Reconnect Google" : "Connect Google"}
                    {data.calendar.connected ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void disconnectGoogle()}
                        disabled={disconnecting}
                      >
                        {disconnecting ? "Disconnecting..." : "Disconnect"}
                      </Button>
                    ) : null}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => void refresh()}>
                    Refresh status
                  </Button>
                </div>
              </div>
            </section>
          </div>

          <section className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Today</p>
                <h2 className="mt-1 text-2xl font-semibold text-brand-deep">Your sessions</h2>
              </div>
              <Badge variant="secondary">
                {data.today.length} session{data.today.length === 1 ? "" : "s"}
              </Badge>
            </div>
            <AppointmentList empty="No sessions scheduled for today." rows={data.today} />
          </section>

          <section className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Next 30 days</p>
                <h2 className="mt-1 text-2xl font-semibold text-brand-deep">
                  Upcoming confirmed sessions
                </h2>
              </div>
              <Badge variant="secondary">
                {data.upcoming.length} session{data.upcoming.length === 1 ? "" : "s"}
              </Badge>
            </div>
            <AppointmentList empty="No upcoming confirmed sessions." rows={data.upcoming} />
          </section>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function TherapistDashboardUnavailable({ message }: { message: string }) {
  const signOut = async () => {
    const { getSupabaseBrowserClient } = await import("@/lib/supabase");
    const supabase = getSupabaseBrowserClient();
    await supabase?.auth.signOut();
    window.location.assign("/login?redirect=%2Ftherapist");
  };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main id="main" className="flex-1 bg-surface-page py-16 sm:py-24">
        <section className="mx-auto w-full max-w-2xl px-4 sm:px-6 lg:px-8">
          <p className="eyebrow">Therapist workspace</p>
          <h1 className="display-1 mt-3 text-brand-deep">Dashboard access needs attention.</h1>
          <div className="mt-6 rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
            <p className="text-sm text-muted-foreground">
              Your login is active, but the therapist dashboard could not be opened.
            </p>
            <p className="mt-4 rounded-xl bg-brand-blue-soft p-4 text-sm text-brand-deep">
              {message}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild className="bg-brand-deep text-white hover:bg-brand-deep/90">
                <Link to="/therapist">Try again</Link>
              </Button>
              <Button type="button" variant="outline" onClick={() => void signOut()}>
                Sign in again
              </Button>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function SummaryCard({
  detail,
  icon,
  label,
  value,
}: {
  detail: string;
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 text-brand-deep">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-blue-soft">
          {icon}
        </span>
        <p className="eyebrow">{label}</p>
      </div>
      <p className="mt-4 break-words text-2xl font-semibold text-brand-deep">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </section>
  );
}

function AppointmentList({
  empty,
  rows,
}: {
  empty: string;
  rows: TherapistDashboardAppointment[];
}) {
  const copyMeetLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Meet link copied.");
    } catch {
      toast.error("Could not copy the Meet link.");
    }
  };

  if (!rows.length) {
    return (
      <div className="mt-5 rounded-xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
        {empty}
      </div>
    );
  }

  return (
    <div className="mt-5 divide-y divide-border/70 overflow-hidden rounded-xl border border-border/70">
      {rows.map((appointment) => (
        <article
          key={appointment.id}
          className="grid gap-3 bg-background/80 p-4 sm:grid-cols-[minmax(0,1fr)_auto]"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-brand-deep">{formatDate(appointment.startsAt)}</p>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusTone(appointment.status)}`}
              >
                {appointment.status.replaceAll("_", " ")}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {appointment.clientName} · {appointment.serviceName ?? "Talk Space session"} ·{" "}
              {modeLabel(appointment.mode)}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {appointment.clientEmail ? <span>{appointment.clientEmail}</span> : null}
              {appointment.clientPhone ? <span>{appointment.clientPhone}</span> : null}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Reference {appointment.bookingReference}
            </p>
            {appointment.notes ? (
              <p className="mt-2 rounded-lg bg-brand-mint/20 px-3 py-2 text-xs text-brand-deep">
                {appointment.notes}
              </p>
            ) : null}
            {appointment.googleSyncError ? (
              <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">
                Calendar sync issue: {appointment.googleSyncError}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-start justify-end gap-2">
            {appointment.googleMeetUrl ? (
              <>
                <Button asChild size="sm" variant="outline">
                  <a href={appointment.googleMeetUrl} target="_blank" rel="noreferrer">
                    <Video className="h-4 w-4" aria-hidden />
                    Open Meet
                  </a>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void copyMeetLink(appointment.googleMeetUrl!)}
                >
                  <Copy className="h-4 w-4" aria-hidden />
                  Copy link
                </Button>
              </>
            ) : appointment.mode === "online" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
                <Video className="h-4 w-4" aria-hidden />
                Meet link pending
              </span>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
