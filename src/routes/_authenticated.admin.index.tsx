import { useEffect, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { AdminOverview, AdminOverviewSkeleton } from "@/components/progress/AdminOverview";
import { getVerifiedBrowserSession } from "@/lib/auth";
import {
  listTodayAppointmentsForAdmin,
  listUpcomingAppointmentsForAdmin,
  type UpcomingAppointmentRow,
} from "@/lib/booking.functions";
import { hasProgressAccess } from "@/lib/progress-access";
import { getProgressSnapshot } from "@/lib/progress.functions";
import {
  getAdminDashboardSummary,
  getAdminFailureQueues,
  type AdminDashboardSummary,
  type AdminFailureQueues,
} from "@/lib/admin.functions";
import { buildProgressSnapshot } from "@/lib/checklist-progress";
import {
  PROGRESS_MILESTONES,
  PROGRESS_PROJECT_NAME,
  PROGRESS_SOURCES,
  PROGRESS_TASK_LINKS,
} from "@/lib/progress-config";

export const Route = createFileRoute("/_authenticated/admin/")({
  pendingMs: 0,
  pendingMinMs: 300,
  loader: async () => {
    const [snapshot, summary, failureQueues, todayAppointments, upcomingAppointments] =
      await Promise.all([
        getProgressSnapshot(),
        getAdminDashboardSummary().catch((): AdminDashboardSummary => ({
          pages: 0,
          posts: 0,
          media: 0,
          activeTherapists: 0,
          clients: 0,
          upcomingBookings: 0,
          pendingMessages: 0,
          pendingTransfers: 0,
          pendingForms: 0,
          failedGoogleSyncs: 0,
        })),
        getAdminFailureQueues().catch((): AdminFailureQueues => ({
          notificationCount: 0,
          meetCount: 0,
          notifications: [],
          meetSyncs: [],
        })),
        listTodayAppointmentsForAdmin().catch((): UpcomingAppointmentRow[] => []),
        listUpcomingAppointmentsForAdmin().catch((): UpcomingAppointmentRow[] => []),
      ]);
    // The dashboard is an admin landing page. Progress visibility is gated in
    // the component for the owner account; a missing progress read must not
    // make the whole admin workspace disappear for other admins.
    return {
      snapshot:
        snapshot ??
        buildProgressSnapshot({
          projectName: PROGRESS_PROJECT_NAME,
          sources: PROGRESS_SOURCES,
          milestones: PROGRESS_MILESTONES,
          taskLinks: PROGRESS_TASK_LINKS,
        }),
      summary,
      failureQueues,
      todayAppointments,
      upcomingAppointments,
    };
  },
  pendingComponent: AdminOverviewSkeleton,
  component: AdminPage,
});

function AdminPage() {
  const { snapshot, summary, failureQueues, todayAppointments, upcomingAppointments } =
    Route.useLoaderData();
  const [canViewProgress, setCanViewProgress] = useState(false);

  useEffect(() => {
    let active = true;
    void getVerifiedBrowserSession().then((session) => {
      if (active) setCanViewProgress(hasProgressAccess("admin", session?.user.email));
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <AdminOverview
      snapshot={snapshot}
      summary={summary}
      failureQueues={failureQueues}
      todayAppointments={todayAppointments}
      upcomingAppointments={upcomingAppointments}
      canViewProgress={canViewProgress}
    />
  );
}
