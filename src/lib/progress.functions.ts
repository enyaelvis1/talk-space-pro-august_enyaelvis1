import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";

import { buildProgressSnapshot } from "@/lib/checklist-progress";
import { hasProgressAccess } from "@/lib/progress-access";
import {
  PROGRESS_MILESTONES,
  PROGRESS_PROJECT_NAME,
  PROGRESS_SOURCES,
  PROGRESS_TASK_LINKS,
} from "@/lib/progress-config";
import { createRequestSupabase } from "@/lib/supabase-server";

async function isServerAdmin(progressOwnerOnly = false) {
  const requestSupabase = createRequestSupabase(getRequest());
  if (!requestSupabase) return false;

  try {
    const {
      data: { user },
    } = await requestSupabase.client.auth.getUser();
    if (!user) return false;

    const { data: isAdmin } = await requestSupabase.client.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (isAdmin !== true) return false;
    return !progressOwnerOnly || hasProgressAccess("admin", user.email);
  } finally {
    requestSupabase.commitCookies();
  }
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
