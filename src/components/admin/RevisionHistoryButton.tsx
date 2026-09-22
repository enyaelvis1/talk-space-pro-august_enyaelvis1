import { useEffect, useMemo, useState } from "react";
import { History, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SectionDiffView } from "@/components/admin/SectionDiffView";
import {
  listContentRevisions,
  restoreContentRevision,
  type ContentRevisionEntity,
  type ContentRevisionRow,
  type JsonValue,
} from "@/lib/admin.functions";
import { diffSnapshotSections } from "@/lib/section-diff";
import { formatWATDateTime } from "@/lib/time";

const FAQ_FIELDS: [string, string][] = [
  ["category", "Category"],
  ["question", "Question"],
  ["answer", "Answer"],
  ["is_published", "Published"],
  ["display_order", "Order"],
];

const TESTIMONIAL_FIELDS: [string, string][] = [
  ["author_name", "Author"],
  ["author_role", "Role"],
  ["quote", "Quote"],
  ["rating", "Rating"],
  ["avatar_url", "Avatar URL"],
  ["is_published", "Published"],
  ["display_order", "Order"],
];

const CONTENT_ENTRY_FIELDS: [string, string][] = [
  ["title", "Title"],
  ["slug", "Slug"],
  ["source_status", "Status"],
  ["published_at", "Published at"],
  ["author_name", "Author"],
  ["excerpt_html", "Intro / summary"],
  ["body_html", "Body"],
  ["featured_media_path", "Featured media"],
  ["metadata", "SEO & settings"],
];

function fmt(v: JsonValue | undefined): string {
  if (v === undefined || v === null || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  const s = typeof v === "object" ? JSON.stringify(v, null, 2) : String(v);
  return s.length > 400 ? `${s.slice(0, 400)}…` : s;
}

function DiffTable({
  entityType,
  current,
  previous,
}: {
  entityType: ContentRevisionEntity;
  current: { [k: string]: JsonValue };
  previous: { [k: string]: JsonValue } | null;
}) {
  const fields =
    entityType === "faq"
      ? FAQ_FIELDS
      : entityType === "testimonial"
        ? TESTIMONIAL_FIELDS
        : CONTENT_ENTRY_FIELDS;
  return (
    <div className="overflow-hidden rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Field</th>
            <th className="px-3 py-2">Previous</th>
            <th className="px-3 py-2">This revision</th>
          </tr>
        </thead>
        <tbody>
          {fields.map(([key, label]) => {
            // Layout arrays get their own readable diff, so keep them out of the JSON blob.
            const clean = (v: JsonValue | undefined): JsonValue | undefined => {
              if (key !== "metadata" || !v || typeof v !== "object" || Array.isArray(v)) return v;
              const { sections: _s, sectionsDraft: _d, ...rest } = v as Record<string, JsonValue>;
              return rest as JsonValue;
            };
            const a = clean(previous ? previous[key] : undefined);
            const b = clean(current[key]);
            const changed = JSON.stringify(a ?? null) !== JSON.stringify(b ?? null);
            return (
              <tr key={key} className={changed ? "bg-amber-50/60" : ""}>
                <td className="w-32 px-3 py-2 align-top text-xs font-medium text-muted-foreground">
                  {label}
                </td>
                <td className="whitespace-pre-wrap break-words px-3 py-2 align-top text-xs text-muted-foreground">
                  {previous ? fmt(a) : <span className="italic">no earlier version</span>}
                </td>
                <td className="whitespace-pre-wrap break-words px-3 py-2 align-top text-xs">
                  {fmt(b)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function RevisionHistoryButton({
  entityType,
  entityId,
  label,
  onRestored,
}: {
  entityType: ContentRevisionEntity;
  entityId: string;
  label: string;
  onRestored?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ContentRevisionRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listContentRevisions({ data: { entityType, entityId } })
      .then((r) => {
        setRows(r);
        setSelectedId(r[0]?.id ?? null);
      })
      .catch((err: unknown) =>
        toast.error(err instanceof Error ? err.message : "Failed to load history."),
      )
      .finally(() => setLoading(false));
  }, [open, entityType, entityId]);

  const selected = useMemo(
    () => rows?.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId],
  );
  const previous = useMemo(() => {
    if (!rows || !selected) return null;
    const idx = rows.findIndex((r) => r.id === selected.id);
    // rows are DESC by created_at, so "previous" = next index (older)
    return idx >= 0 && idx < rows.length - 1 ? rows[idx + 1] : null;
  }, [rows, selected]);

  const isPage = entityType === "content_entry";

  /** Section-level diff for the selected revision (public pages only). */
  const sectionDiff = useMemo(() => {
    if (!isPage || !selected) return null;
    return diffSnapshotSections(previous?.snapshot ?? null, selected.snapshot);
  }, [isPage, selected, previous]);

  /** One-line layout summary per revision, shown in the timeline list. */
  const layoutSummaries = useMemo(() => {
    const map = new Map<string, string>();
    if (!isPage || !rows) return map;
    rows.forEach((row, index) => {
      const older = index < rows.length - 1 ? rows[index + 1] : null;
      const diff = diffSnapshotSections(older?.snapshot ?? null, row.snapshot);
      const parts = [
        diff.published.changes.length > 0 ? `Live: ${diff.published.summary}` : null,
        diff.draft.changes.length > 0 ? `Draft: ${diff.draft.summary}` : null,
      ].filter(Boolean);
      if (parts.length > 0) map.set(row.id, parts.join(" · "));
    });
    return map;
  }, [isPage, rows]);

  async function restore(r: ContentRevisionRow) {
    if (!confirm("Restore this revision? It will replace the current version.")) return;
    setRestoringId(r.id);
    try {
      await restoreContentRevision({ data: { revisionId: r.id } });
      toast.success("Revision restored.");
      setOpen(false);
      onRestored?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Restore failed.");
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <History className="mr-1 h-3.5 w-3.5" /> History
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Revision history</DialogTitle>
            <DialogDescription className="truncate">{label}</DialogDescription>
          </DialogHeader>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : !rows || rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No revisions recorded yet.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-[220px_1fr]">
              <ul className="max-h-96 overflow-auto rounded-md border">
                {rows.map((r) => {
                  const active = r.id === selectedId;
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(r.id)}
                        className={`block w-full border-b px-3 py-2 text-left text-xs last:border-b-0 hover:bg-muted/60 ${
                          active ? "bg-muted" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium capitalize">{r.changeType}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatWATDateTime(r.createdAt)}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                          {r.changedByEmail ?? "system"}
                        </p>
                        {layoutSummaries.get(r.id) ? (
                          <p className="mt-0.5 truncate text-[10px] font-medium text-amber-700">
                            {layoutSummaries.get(r.id)}
                          </p>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="max-h-96 space-y-3 overflow-auto pr-1">
                {selected ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Saved {formatWATDateTime(selected.createdAt)} by{" "}
                      {selected.changedByEmail ?? "system"}
                    </p>
                    {sectionDiff ? (
                      <>
                        <SectionDiffView title="Live layout changes" diff={sectionDiff.published} />
                        <SectionDiffView title="Draft layout changes" diff={sectionDiff.draft} />
                        {sectionDiff.published.changes.length === 0 &&
                        sectionDiff.draft.changes.length === 0 ? (
                          <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                            No section changes in this revision.
                          </p>
                        ) : null}
                      </>
                    ) : null}
                    <DiffTable
                      entityType={entityType}
                      current={selected.snapshot}
                      previous={previous?.snapshot ?? null}
                    />

                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => restore(selected)}
                        disabled={restoringId === selected.id || selected.changeType === "create"}
                        title={
                          selected.changeType === "create"
                            ? "This is the original version"
                            : undefined
                        }
                      >
                        {restoringId === selected.id ? (
                          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="mr-2 h-3.5 w-3.5" />
                        )}
                        Restore this version
                      </Button>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
