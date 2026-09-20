import { normalizeSections, sectionLabel, type PageSection } from "@/lib/page-sections";

/**
 * Section-level diffing for the public-page edit history.
 *
 * Revision snapshots store the whole `content_entries` row, so the layout for
 * any point in time lives at `metadata.sections` (published) and
 * `metadata.sectionsDraft` (unpublished). Comparing two snapshots by section id
 * gives a readable "what changed" list instead of a wall of JSON.
 */

export type SectionFieldChange = {
  path: string;
  before: string;
  after: string;
};

export type SectionChange =
  | { kind: "added"; id: string; label: string; index: number }
  | { kind: "removed"; id: string; label: string; index: number }
  | {
      kind: "edited";
      id: string;
      label: string;
      index: number;
      fields: SectionFieldChange[];
      movedFrom: number | null;
    }
  | { kind: "moved"; id: string; label: string; index: number; movedFrom: number };

export type SectionDiff = {
  changes: SectionChange[];
  /** Short human summary, e.g. "1 added, 2 edited". */
  summary: string;
};

const IGNORED_KEYS = new Set(["id"]);

function metadataOf(snapshot: unknown): Record<string, unknown> {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return {};
  const metadata = (snapshot as Record<string, unknown>)["metadata"];
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  return metadata as Record<string, unknown>;
}

export function sectionsFromSnapshot(snapshot: unknown, variant: "published" | "draft") {
  const metadata = metadataOf(snapshot);
  return normalizeSections(metadata[variant === "draft" ? "sectionsDraft" : "sections"]);
}

function display(value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return text.length > 200 ? `${text.slice(0, 200)}…` : text;
}

/** Flatten a section into `path -> scalar` pairs so edits read field by field. */
function flatten(value: unknown, prefix = "", out: Record<string, unknown> = {}) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => flatten(item, `${prefix}[${index + 1}]`, out));
    return out;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (!prefix && IGNORED_KEYS.has(key)) continue;
      flatten(child, prefix ? `${prefix}.${key}` : key, out);
    }
    return out;
  }
  out[prefix] = value;
  return out;
}

function fieldChanges(before: PageSection, after: PageSection): SectionFieldChange[] {
  const a = flatten(before);
  const b = flatten(after);
  const paths = Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).sort();
  const changes: SectionFieldChange[] = [];
  for (const path of paths) {
    if (JSON.stringify(a[path] ?? null) === JSON.stringify(b[path] ?? null)) continue;
    changes.push({ path, before: display(a[path]), after: display(b[path]) });
  }
  return changes;
}

function summarize(changes: SectionChange[]): string {
  if (changes.length === 0) return "No layout changes";
  const counts = { added: 0, removed: 0, edited: 0, moved: 0 };
  for (const change of changes) counts[change.kind] += 1;
  const parts: string[] = [];
  if (counts.added) parts.push(`${counts.added} added`);
  if (counts.removed) parts.push(`${counts.removed} removed`);
  if (counts.edited) parts.push(`${counts.edited} edited`);
  if (counts.moved) parts.push(`${counts.moved} moved`);
  return parts.join(", ");
}

/** Compare two layouts and describe every section-level change. */
export function diffSections(previous: PageSection[], current: PageSection[]): SectionDiff {
  const previousById = new Map(previous.map((section, index) => [section.id, { section, index }]));
  const currentById = new Map(current.map((section, index) => [section.id, { section, index }]));
  const changes: SectionChange[] = [];

  current.forEach((section, index) => {
    const before = previousById.get(section.id);
    const label = sectionLabel(section.type);
    if (!before) {
      changes.push({ kind: "added", id: section.id, label, index });
      return;
    }
    const fields = fieldChanges(before.section, section);
    const movedFrom = before.index !== index ? before.index : null;
    if (fields.length > 0) {
      changes.push({ kind: "edited", id: section.id, label, index, fields, movedFrom });
    } else if (movedFrom !== null) {
      changes.push({ kind: "moved", id: section.id, label, index, movedFrom });
    }
  });

  previous.forEach((section, index) => {
    if (currentById.has(section.id)) return;
    changes.push({
      kind: "removed",
      id: section.id,
      label: sectionLabel(section.type),
      index,
    });
  });

  return { changes, summary: summarize(changes) };
}

/** Diff the layout stored in two revision snapshots. */
export function diffSnapshotSections(
  previousSnapshot: unknown,
  currentSnapshot: unknown,
): { published: SectionDiff; draft: SectionDiff } {
  return {
    published: diffSections(
      sectionsFromSnapshot(previousSnapshot, "published"),
      sectionsFromSnapshot(currentSnapshot, "published"),
    ),
    draft: diffSections(
      sectionsFromSnapshot(previousSnapshot, "draft"),
      sectionsFromSnapshot(currentSnapshot, "draft"),
    ),
  };
}
