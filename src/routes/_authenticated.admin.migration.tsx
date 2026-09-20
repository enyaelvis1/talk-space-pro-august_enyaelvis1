import { useMemo, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { CheckCircle2, ExternalLink, FileWarning, Search, XCircle } from "lucide-react";
import { toast } from "sonner";

import { AdminWorkspaceShell } from "@/components/progress/AdminSidebar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  listMigrationContentReviews,
  updateMigrationContentReview,
  type MigrationContentDecision,
  type MigrationContentReviewRow,
} from "@/lib/admin.functions";
import { canonicalUrl } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/admin/migration")({
  loader: async () => {
    try {
      return await listMigrationContentReviews();
    } catch {
      throw redirect({ href: "/account?error=forbidden" });
    }
  },
  head: () => ({
    meta: [
      { title: "Content migration | Talk Space Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: canonicalUrl("/admin/migration") }],
  }),
  component: ContentMigrationRoute,
});

type ReviewDraft = {
  row: MigrationContentReviewRow;
  decision: MigrationContentDecision;
  reason: string;
  proposedPath: string;
};

const decisionLabels: Record<MigrationContentDecision, string> = {
  pending: "Pending review",
  approved: "Approved",
  excluded: "Excluded",
  needs_revision: "Needs revision",
};

const decisionClasses: Record<MigrationContentDecision, string> = {
  pending: "bg-muted text-muted-foreground",
  approved: "bg-emerald-100 text-emerald-800",
  excluded: "bg-rose-100 text-rose-800",
  needs_revision: "bg-amber-100 text-amber-800",
};

const dateTime = new Intl.DateTimeFormat("en-NG", {
  timeZone: "Africa/Lagos",
  dateStyle: "medium",
  timeStyle: "short",
});

function ContentMigrationRoute() {
  const initialRows = Route.useLoaderData() as MigrationContentReviewRow[];
  const [rows, setRows] = useState(initialRows);
  const [query, setQuery] = useState("");
  const [decision, setDecision] = useState<MigrationContentDecision | "all">("all");
  const [kind, setKind] = useState<MigrationContentReviewRow["sourceKind"] | "all">("all");
  const [draft, setDraft] = useState<ReviewDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const counts = useMemo(() => {
    const result: Record<MigrationContentDecision, number> = {
      pending: 0,
      approved: 0,
      excluded: 0,
      needs_revision: 0,
    };
    for (const row of rows) result[row.decision] += 1;
    return result;
  }, [rows]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (decision !== "all" && row.decision !== decision) return false;
      if (kind !== "all" && row.sourceKind !== kind) return false;
      if (!normalizedQuery) return true;
      return [row.title, row.sourceUrl, row.proposedPath, row.reviewReason]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery));
    });
  }, [decision, kind, query, rows]);

  function openReview(row: MigrationContentReviewRow, nextDecision = row.decision) {
    setDraft({
      row,
      decision: nextDecision,
      reason: row.reviewReason ?? "",
      proposedPath: row.proposedPath ?? "",
    });
  }

  async function saveReview() {
    if (!draft) return;
    if (draft.decision !== "pending" && draft.reason.trim().length < 3) {
      toast.error("Add a short reason for this migration decision.");
      return;
    }
    setSaving(true);
    try {
      const updated = await updateMigrationContentReview({
        data: {
          id: draft.row.id,
          decision: draft.decision,
          reason: draft.decision === "pending" ? null : draft.reason,
          proposedPath: draft.proposedPath.trim() || null,
        },
      });
      setRows((current) => current.map((row) => (row.id === updated.id ? updated : row)));
      setDraft(null);
      toast.success(
        `Migration decision saved as ${decisionLabels[updated.decision].toLowerCase()}.`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Migration review could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminWorkspaceShell>
      <main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        <header>
          <p className="eyebrow">Admin · Migration</p>
          <h1 className="display-1 mt-3 text-brand-deep">Content approval</h1>
          <p className="mt-3 max-w-3xl text-muted-foreground">
            Decide which WordPress pages, posts, and categories may move into the new website.
            Publication does not imply migration approval; every completed decision records the
            administrator, reason, and time in the audit trail.
          </p>
        </header>

        <section
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          aria-label="Migration review summary"
        >
          <SummaryCard label="Pending" value={counts.pending} icon={FileWarning} />
          <SummaryCard label="Approved" value={counts.approved} icon={CheckCircle2} />
          <SummaryCard label="Needs revision" value={counts.needs_revision} icon={FileWarning} />
          <SummaryCard label="Excluded" value={counts.excluded} icon={XCircle} />
        </section>

        <section className="rounded-2xl border border-border/70 bg-card shadow-sm">
          <div className="grid gap-3 border-b border-border/60 p-5 lg:grid-cols-[minmax(0,1fr)_200px_180px]">
            <label className="relative block">
              <span className="sr-only">Search migration content</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search title, source URL, path, or reason"
                className="pl-10"
              />
            </label>
            <label>
              <span className="sr-only">Filter by decision</span>
              <select
                value={decision}
                onChange={(event) => setDecision(event.target.value as typeof decision)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">All decisions</option>
                {Object.entries(decisionLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Filter by content type</span>
              <select
                value={kind}
                onChange={(event) => setKind(event.target.value as typeof kind)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">All content types</option>
                <option value="page">Pages</option>
                <option value="post">Posts</option>
                <option value="category">Categories</option>
              </select>
            </label>
          </div>

          {filteredRows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3">Content</th>
                    <th className="px-5 py-3">Source</th>
                    <th className="px-5 py-3">Proposed destination</th>
                    <th className="px-5 py-3">Decision</th>
                    <th className="px-5 py-3">Reviewed by</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredRows.map((row) => (
                    <tr key={row.id} className="align-top [content-visibility:auto]">
                      <td className="max-w-80 px-5 py-4">
                        <p className="font-medium text-brand-deep">{row.title}</p>
                        <p className="mt-1 text-xs capitalize text-muted-foreground">
                          {row.sourceKind} · WordPress #{row.sourceId}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <a
                          href={row.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex max-w-64 items-center gap-1 break-all text-xs text-brand-deep underline-offset-4 hover:underline"
                        >
                          {new URL(row.sourceUrl).pathname}{" "}
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      </td>
                      <td className="max-w-64 break-all px-5 py-4 font-mono text-xs text-muted-foreground">
                        {row.proposedPath ?? "Not assigned"}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${decisionClasses[row.decision]}`}
                        >
                          {decisionLabels[row.decision]}
                        </span>
                        {row.reviewReason ? (
                          <p className="mt-2 max-w-64 text-xs text-muted-foreground">
                            {row.reviewReason}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 text-xs text-muted-foreground">
                        <p>{row.reviewedByEmail ?? "Not reviewed"}</p>
                        {row.reviewedAt ? (
                          <time dateTime={row.reviewedAt}>
                            {dateTime.format(new Date(row.reviewedAt))}
                          </time>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Button size="sm" variant="outline" onClick={() => openReview(row)}>
                          Review
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-5 py-16 text-center text-sm text-muted-foreground">
              No migration records match the current filters.
            </p>
          )}
        </section>
      </main>

      <Dialog open={Boolean(draft)} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Review migration content</DialogTitle>
            <DialogDescription>{draft?.row.title}</DialogDescription>
          </DialogHeader>
          {draft ? (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="migration-decision">Decision</Label>
                <select
                  id="migration-decision"
                  value={draft.decision}
                  onChange={(event) =>
                    setDraft({ ...draft, decision: event.target.value as MigrationContentDecision })
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {Object.entries(decisionLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="migration-path">Proposed destination path</Label>
                <Input
                  id="migration-path"
                  value={draft.proposedPath}
                  onChange={(event) => setDraft({ ...draft, proposedPath: event.target.value })}
                  placeholder="/blog/example"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="migration-reason">
                  Decision reason {draft.decision === "pending" ? "(optional)" : "*"}
                </Label>
                <Textarea
                  id="migration-reason"
                  value={draft.reason}
                  onChange={(event) => setDraft({ ...draft, reason: event.target.value })}
                  placeholder="Explain why this content should be migrated, revised, or excluded."
                  rows={4}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void saveReview()} disabled={saving}>
              {saving ? "Saving…" : "Save decision"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminWorkspaceShell>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof CheckCircle2;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-brand-deep">{value}</p>
      </div>
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-mint-soft text-brand-deep">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
    </div>
  );
}
