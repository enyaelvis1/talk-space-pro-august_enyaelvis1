import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";

import { buildProgressSnapshot } from "@/lib/checklist-progress";
import { hasProgressAccess } from "@/lib/progress-access";
import {
  PROGRESS_MILESTONES,
  PROGRESS_PROJECT_NAME,
  PROGRESS_SOURCES,
  PROGRESS_TASK_LINKS,
} from "@/lib/progress-config";
import { getRequestAuthContext } from "@/lib/server-auth";

async function isServerAdmin(progressOwnerOnly = false) {
  const context = await getRequestAuthContext();
  if (!context?.user || !(await context.hasRole("admin"))) return false;
  return !progressOwnerOnly || hasProgressAccess("admin", context.user.email);
}

export const getProgressSnapshot = createServerFn({ method: "GET" }).handler(async () => {
  if (!(await isServerAdmin())) return null;

  setResponseHeader("Cache-Control", "private, no-store");
  return buildProgressSnapshot({
    projectName: PROGRESS_PROJECT_NAME,
    sources: PROGRESS_SOURCES,
    milestones: PROGRESS_MILESTONES,
    taskLinks: PROGRESS_TASK_LINKS,
  });
});

export type AdminProgressWorkspace = {
  snapshot: ReturnType<typeof buildProgressSnapshot>;
  canViewProgress: boolean;
};

export const getAdminProgressWorkspace = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminProgressWorkspace | null> => {
    const context = await getRequestAuthContext();
    if (!context?.user || !(await context.hasRole("admin"))) return null;

    setResponseHeader("Cache-Control", "private, no-store");
    return {
      snapshot: buildProgressSnapshot({
        projectName: PROGRESS_PROJECT_NAME,
        sources: PROGRESS_SOURCES,
        milestones: PROGRESS_MILESTONES,
        taskLinks: PROGRESS_TASK_LINKS,
      }),
      canViewProgress: hasProgressAccess("admin", context.user.email),
    };
  },
);

export const getRestrictedProgressSnapshot = createServerFn({ method: "GET" }).handler(async () => {
  if (!(await isServerAdmin(true))) return null;

  setResponseHeader("Cache-Control", "private, no-store");
  return buildProgressSnapshot({
    projectName: PROGRESS_PROJECT_NAME,
    sources: PROGRESS_SOURCES,
    milestones: PROGRESS_MILESTONES,
    taskLinks: PROGRESS_TASK_LINKS,
  });
});
