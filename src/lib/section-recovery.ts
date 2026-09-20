import type { PageSection } from "@/lib/page-sections";

const PREFIX = "talkspace:section-recovery:";

export type RecoverySnapshot = {
  entryId: string;
  sections: PageSection[];
  savedAt: string;
  /** True when the change had not reached the server yet. */
  unsynced: boolean;
};

function key(entryId: string) {
  return `${PREFIX}${entryId}`;
}

/**
 * Stores the in-progress layout in the browser so a refresh, crash, or dropped
 * connection before publishing never loses the admin's work.
 */
export function writeRecoverySnapshot(entryId: string, sections: PageSection[], unsynced: boolean) {
  if (typeof window === "undefined") return;
  try {
    const snapshot: RecoverySnapshot = {
      entryId,
      sections,
      savedAt: new Date().toISOString(),
      unsynced,
    };
    window.localStorage.setItem(key(entryId), JSON.stringify(snapshot));
  } catch {
    // Storage full or blocked — autosave to the server still applies.
  }
}

export function readRecoverySnapshot(entryId: string): RecoverySnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key(entryId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RecoverySnapshot;
    if (!parsed || !Array.isArray(parsed.sections)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearRecoverySnapshot(entryId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key(entryId));
  } catch {
    // ignore
  }
}

/** Cheap structural comparison used to decide whether recovery is worth offering. */
export function sameSections(a: PageSection[], b: PageSection[]) {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

export function formatRecoveryTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "recently";
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
