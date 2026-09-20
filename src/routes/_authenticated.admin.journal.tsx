import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ExternalLink, Loader2, Pencil, Plus, Search } from "lucide-react";

import { toast } from "sonner";

import { AdminBulkActionBar } from "@/components/admin/BulkActionBar";
import { InlineEditable } from "@/components/admin/InlineEditable";
import { LifecycleMenu, LifecyclePill } from "@/components/admin/ContentLifecycleControls";
import { PaginationBar, usePagination } from "@/components/admin/Pagination";
import { AdminPageSkeleton } from "@/components/admin/AdminSkeletons";

import { AdminWorkspaceShell } from "@/components/progress/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { hasBrowserRole } from "@/lib/auth";
import { canonicalUrl } from "@/lib/seo";
import {
  bulkDeleteContent,
  bulkSetContentStatus,
  createContentEntry,
  listAdminContent,
  setContentStatus,
  updateContentFields,
  type AdminContentRow,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/journal")({
  loader: async () => {
    try {
      return await listAdminContent({ data: { kind: "post" } });
    } catch {
      throw redirect({ href: "/account?error=forbidden" });
    }
  },
  head: () => ({
    meta: [
      { title: "Journal | Talk Space Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: canonicalUrl("/admin/journal") }],
  }),
  errorComponent: ({ error }) => (
    <AdminWorkspaceShell>
      <main className="p-8 text-sm text-destructive">
        {error instanceof Error ? error.message : "Failed to load journal."}
      </main>
    </AdminWorkspaceShell>
  ),
  component: JournalAdminRoute,
});

const dtf = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" });

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return dtf.format(new Date(iso));
  } catch {
    return iso;
  }
}

function JournalAdminRoute() {
  const initial = Route.useLoaderData();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [rows, setRows] = useState<AdminContentRow[]>(initial);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "publish" | "draft">("all");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState<"publish" | "unpublish" | "delete" | null>(null);

  useEffect(() => {
    let active = true;
    void hasBrowserRole("admin").then((ok) => active && setAuthorized(ok));
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.slug.toLowerCase().includes(q) ||
        (r.author?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [rows, query, statusFilter]);

  const counts = useMemo(() => {
    const c = { total: rows.length, publish: 0, draft: 0 };
    rows.forEach((r) => {
      if (r.status === "publish") c.publish += 1;
      else c.draft += 1;
    });
    return c;
  }, [rows]);

  const filteredIds = useMemo(() => filtered.map((r) => r.id), [filtered]);
  const { page, setPage, pageSize, setPageSize, pageItems, total, totalPages } = usePagination(
    filtered,
    20,
  );

  const selectedInView = filteredIds.filter((id) => selected.has(id));
  const allSelected = filteredIds.length > 0 && selectedInView.length === filteredIds.length;
  const someSelected = selectedInView.length > 0 && !allSelected;

  const toggleRow = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of filteredIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const createPost = async () => {
    try {
      const result = await createContentEntry({
        data: { kind: "post", title: "New journal post" },
      });
      window.location.href = `/admin/content/${result.id}/edit`;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create journal post.");
    }
  };

  const toggle = async (row: AdminContentRow) => {
    setSavingId(row.id);
    const nextStatus = row.status === "publish" ? "draft" : "publish";
    try {
      await setContentStatus({ data: { id: row.id, status: nextStatus } });
      setRows((all) =>
        all.map((r) =>
          r.id === row.id
            ? {
                ...r,
                status: nextStatus,
                publishedAt: nextStatus === "publish" ? new Date().toISOString() : r.publishedAt,
              }
            : r,
        ),
      );
      toast.success(nextStatus === "publish" ? "Post published." : "Moved to draft.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setSavingId(null);
    }
  };

  const saveField = async (
    id: string,
    patch: {
      title?: string;
      slug?: string;
      authorName?: string | null;
      excerptHtml?: string | null;
    },
    label: string,
  ) => {
    try {
      const res = await updateContentFields({ data: { id, ...patch } });
      if (res.row) {
        setRows((all) => all.map((r) => (r.id === id ? res.row! : r)));
      }
      toast.success(`${label} updated.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to update ${label.toLowerCase()}.`);
      throw err;
    }
  };

  const runBulkStatus = async (status: "publish" | "draft") => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBulkPending(status === "publish" ? "publish" : "unpublish");
    try {
      const res = await bulkSetContentStatus({ data: { ids, status } });
      const stamp = new Date().toISOString();
      setRows((all) =>
        all.map((r) =>
          selected.has(r.id)
            ? {
                ...r,
                status,
                publishedAt: status === "publish" ? stamp : r.publishedAt,
              }
            : r,
        ),
      );
      toast.success(
        `${res.count} ${res.count === 1 ? "post" : "posts"} ${
          status === "publish" ? "published" : "moved to draft"
        }.`,
      );
      clearSelection();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk update failed.");
    } finally {
      setBulkPending(null);
    }
  };

  const runBulkDelete = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (
      !window.confirm(
        `Delete ${ids.length} ${ids.length === 1 ? "post" : "posts"}? This cannot be undone.`,
      )
    )
      return;
    setBulkPending("delete");
    try {
      const res = await bulkDeleteContent({ data: { ids } });
      setRows((all) => all.filter((r) => !selected.has(r.id)));
      toast.success(`${res.count} ${res.count === 1 ? "post" : "posts"} deleted.`);
      clearSelection();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk delete failed.");
    } finally {
      setBulkPending(null);
    }
  };

  if (authorized === null) {
    return (
      <AdminWorkspaceShell>
        <AdminPageSkeleton columns={6} rows={10} />
      </AdminWorkspaceShell>
    );
  }

  if (!authorized) {
    return (
      <AdminWorkspaceShell>
        <main className="mx-auto max-w-2xl px-4 py-24 text-center">
          <h1 className="display-1 text-brand-deep">Permission required</h1>
          <p className="mt-4 text-muted-foreground">Admin access is required.</p>
        </main>
      </AdminWorkspaceShell>
    );
  }

  return (
    <AdminWorkspaceShell>
      <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        <header>
          <p className="eyebrow">Admin · Content</p>
          <h1 className="display-1 mt-3 text-brand-deep">Journal</h1>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
            <p className="max-w-2xl text-muted-foreground">
              Manage the {counts.total} imported journal posts. Publish or unpublish entries; the
              public Journal automatically reflects changes.
            </p>
            <Button onClick={() => void createPost()}>
              <Plus className="mr-2 h-4 w-4" /> New post
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">
              Published · {counts.publish}
            </span>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">
              Draft · {counts.draft}
            </span>
          </div>
        </header>

        <section className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, slug, author…"
              className="pl-9"
            />
          </div>
          <div className="flex gap-1 rounded-md border border-border/70 p-1 text-xs">
            {(["all", "publish", "draft"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`rounded px-2.5 py-1 capitalize transition-colors ${
                  statusFilter === s
                    ? "bg-brand-deep text-white"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {s === "all" ? "All" : s}
              </button>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-border/70 bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="w-10 px-4 py-3">
                  <Checkbox
                    aria-label="Select all posts in view"
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={(v) => toggleAll(v === true)}
                  />
                </th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Published</th>
                <th className="px-4 py-3">Author</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    No posts match your filters.
                  </td>
                </tr>
              ) : (
                pageItems.map((row) => {
                  const isSelected = selected.has(row.id);
                  return (
                    <tr
                      key={row.id}
                      className={`border-t border-border/60 ${
                        isSelected ? "bg-brand-mint-soft/40" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <Checkbox
                          aria-label={`Select ${row.title}`}
                          checked={isSelected}
                          onCheckedChange={(v) => toggleRow(row.id, v === true)}
                        />
                      </td>
                      <td className="px-4 py-3 min-w-[280px]">
                        <InlineEditable
                          value={row.title}
                          ariaLabel="title"
                          displayClassName="font-medium text-brand-deep"
                          onSave={(v) => saveField(row.id, { title: v }, "Title")}
                        />
                        <InlineEditable
                          value={row.slug}
                          ariaLabel="slug"
                          prefix="/"
                          displayClassName="text-xs text-muted-foreground"
                          onSave={(v) => saveField(row.id, { slug: v }, "Slug")}
                        />
                        <InlineEditable
                          value={row.excerptHtml}
                          ariaLabel="excerpt"
                          multiline
                          emptyLabel="Add excerpt"
                          displayClassName="text-xs text-muted-foreground line-clamp-2"
                          onSave={(v) => saveField(row.id, { excerptHtml: v }, "Excerpt")}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <LifecyclePill row={row} />
                      </td>

                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {fmtDate(row.publishedAt)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground min-w-[160px]">
                        <InlineEditable
                          value={row.author}
                          ariaLabel="author"
                          emptyLabel="Set author"
                          onSave={(v) => saveField(row.id, { authorName: v }, "Author")}
                        />
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {row.status === "publish" ? (
                            <a
                              href={`/blog/${row.slug}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-md border border-border/70 px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                            >
                              View <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : null}
                          <Button
                            size="sm"
                            variant={row.status === "publish" ? "outline" : "default"}
                            disabled={savingId === row.id}
                            onClick={() => toggle(row)}
                          >
                            {savingId === row.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : row.status === "publish" ? (
                              "Unpublish"
                            ) : (
                              "Publish"
                            )}
                          </Button>
                          <Button asChild size="sm" variant="ghost">
                            <Link
                              to="/admin/content/$id/edit"
                              params={{ id: row.id }}
                              title="Open editor"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                          <LifecycleMenu
                            row={row}
                            onChange={(patch) =>
                              setRows((all) =>
                                all.map((r) => (r.id === row.id ? { ...r, ...patch } : r)),
                              )
                            }
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <PaginationBar
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            label="posts"
          />
        </section>

        <AdminBulkActionBar
          count={selected.size}
          onPublish={() => runBulkStatus("publish")}
          onUnpublish={() => runBulkStatus("draft")}
          onDelete={runBulkDelete}
          onClear={clearSelection}
          pending={bulkPending}
          labels={{ singular: "post", plural: "posts" }}
        />
      </main>
    </AdminWorkspaceShell>
  );
}
