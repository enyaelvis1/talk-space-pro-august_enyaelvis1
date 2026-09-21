import { createFileRoute } from "@tanstack/react-router";

import { AdminOverview, AdminOverviewSkeleton } from "@/components/progress/AdminOverview";
import { getAdminAppointmentWorkspace, type UpcomingAppointmentRow } from "@/lib/booking.functions";
import { getAdminProgressWorkspace } from "@/lib/progress.functions";
import {
  getAdminOperationsWorkspace,
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
    const [progress, operations, appointments] = await Promise.all([
      getAdminProgressWorkspace(),
      getAdminOperationsWorkspace().catch(() => ({
        summary: {
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
        } satisfies AdminDashboardSummary,
        failureQueues: {
          notificationCount: 0,
          meetCount: 0,
          notifications: [],
          meetSyncs: [],
        } satisfies AdminFailureQueues,
      })),
      getAdminAppointmentWorkspace().catch(() => ({
        todayAppointments: [] as UpcomingAppointmentRow[],
        upcomingAppointments: [] as UpcomingAppointmentRow[],
      })),
    ]);
    // The dashboard is an admin landing page. A missing progress read must not
    // make the whole admin workspace disappear for other admins.
    return {
      snapshot:
        progress?.snapshot ??
        buildProgressSnapshot({
          projectName: PROGRESS_PROJECT_NAME,
          sources: PROGRESS_SOURCES,
          milestones: PROGRESS_MILESTONES,
          taskLinks: PROGRESS_TASK_LINKS,
        }),
      summary: operations.summary,
      failureQueues: operations.failureQueues,
      todayAppointments: appointments.todayAppointments,
      upcomingAppointments: appointments.upcomingAppointments,
      canViewProgress: progress?.canViewProgress ?? false,
    };
  },
  pendingComponent: AdminOverviewSkeleton,
  component: AdminPage,
});

function AdminPage() {
  const {
    snapshot,
    summary,
    failureQueues,
    todayAppointments,
    upcomingAppointments,
    canViewProgress,
  } = Route.useLoaderData();

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
