import { useMemo, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Archive, ExternalLink, Loader2, Pencil, Plus, Search } from "lucide-react";

import { toast } from "sonner";

import { AdminBulkActionBar } from "@/components/admin/BulkActionBar";
import { InlineEditable } from "@/components/admin/InlineEditable";
import { LifecycleMenu, LifecyclePill } from "@/components/admin/ContentLifecycleControls";
import { PaginationBar, usePagination } from "@/components/admin/Pagination";

import { AdminWorkspaceShell } from "@/components/progress/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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

export const Route = createFileRoute("/_authenticated/admin/pages")({
  loader: async () => {
    try {
      return await listAdminContent({ data: { kind: "page" } });
    } catch {
      throw redirect({ href: "/account?error=forbidden" });
    }
  },
  head: () => ({
    meta: [{ title: "Pages | Talk Space Admin" }, { name: "robots", content: "noindex, nofollow" }],
    links: [{ rel: "canonical", href: canonicalUrl("/admin/pages") }],
  }),
  errorComponent: ({ error }) => (
    <AdminWorkspaceShell>
      <main className="p-8 text-sm text-destructive">
        {error instanceof Error ? error.message : "Failed to load pages."}
      </main>
    </AdminWorkspaceShell>
  ),
  component: PagesAdminRoute,
});

const dtf = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" });
const fmt = (iso: string | null) => {
  if (!iso) return "—";
  try {
    return dtf.format(new Date(iso));
  } catch {
    return iso;
  }
};

function PagesAdminRoute() {
  const initial = Route.useLoaderData();
  const [rows, setRows] = useState<AdminContentRow[]>(initial);
  const [query, setQuery] = useState("");
  const [inventoryFilter, setInventoryFilter] = useState<"all" | "active" | "archived">("all");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState<"publish" | "unpublish" | "delete" | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesQuery =
        !q || r.title.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q);
      const archived = Boolean(r.archivedAt);
      const matchesFilter =
        inventoryFilter === "all" || (inventoryFilter === "archived" ? archived : !archived);
      return matchesQuery && matchesFilter;
    });
  }, [rows, query, inventoryFilter]);

  const inventoryCounts = useMemo(
    () => ({
      all: rows.length,
      active: rows.filter((row) => !row.archivedAt).length,
      archived: rows.filter((row) => Boolean(row.archivedAt)).length,
    }),
    [rows],
  );

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

  const createPage = async () => {
    try {
      const result = await createContentEntry({ data: { kind: "page", title: "New page" } });
      window.location.href = `/admin/content/${result.id}/edit`;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create page.");
    }
  };

  const toggle = async (row: AdminContentRow) => {
    setSavingId(row.id);
    const nextStatus = row.status === "publish" ? "draft" : "publish";
    try {
      await setContentStatus({ data: { id: row.id, status: nextStatus } });
      setRows((all) => all.map((r) => (r.id === row.id ? { ...r, status: nextStatus } : r)));
      toast.success(`Page ${nextStatus === "publish" ? "published" : "moved to draft"}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setSavingId(null);
    }
  };

  const saveField = async (
    id: string,
    patch: { title?: string; slug?: string; excerptHtml?: string | null },
    label: string,
  ) => {
    try {
      const res = await updateContentFields({ data: { id, ...patch } });
      if (res.row) setRows((all) => all.map((r) => (r.id === id ? res.row! : r)));
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
      setRows((all) => all.map((r) => (selected.has(r.id) ? { ...r, status } : r)));
      toast.success(
        `${res.count} ${res.count === 1 ? "page" : "pages"} ${
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
        `Delete ${ids.length} ${ids.length === 1 ? "page" : "pages"}? This cannot be undone.`,
      )
    )
      return;
    setBulkPending("delete");
    try {
      const res = await bulkDeleteContent({ data: { ids } });
      setRows((all) => all.filter((r) => !selected.has(r.id)));
      toast.success(`${res.count} ${res.count === 1 ? "page" : "pages"} deleted.`);
      clearSelection();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk delete failed.");
    } finally {
      setBulkPending(null);
    }
  };

  return (
    <AdminWorkspaceShell>
      <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        <header>
          <p className="eyebrow">Admin · Content</p>
          <h1 className="display-1 mt-3 text-brand-deep">Pages</h1>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
            <p className="max-w-2xl text-muted-foreground">
              Long-form pages imported from the previous WordPress site. Toggle publish state; the
              public renderer serves them at their canonical path.
            </p>
            <Button onClick={() => void createPage()}>
              <Plus className="mr-2 h-4 w-4" /> New page
            </Button>
          </div>
        </header>

        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages…"
            className="pl-9"
          />
        </div>

        <section className="grid gap-3 sm:grid-cols-3" aria-label="Page inventory summary">
          {(["all", "active", "archived"] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setInventoryFilter(filter)}
              className={`flex items-center justify-between rounded-2xl border p-4 text-left transition-colors ${inventoryFilter === filter ? "border-brand-deep bg-brand-mint-soft/40" : "border-border/70 bg-card hover:border-brand-deep/40"}`}
            >
              <span className="flex items-center gap-2 text-sm font-medium text-brand-deep">
                {filter === "archived" ? <Archive className="h-4 w-4" /> : null}
                {filter === "all"
                  ? "All imported pages"
                  : filter === "active"
                    ? "Active pages"
                    : "Archived pages"}
              </span>
              <span className="text-xl font-semibold text-brand-deep">
                {inventoryCounts[filter]}
              </span>
            </button>
          ))}
        </section>

        <section className="overflow-hidden rounded-2xl border border-border/70 bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="w-10 px-4 py-3">
                  <Checkbox
                    aria-label="Select all pages in view"
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={(v) => toggleAll(v === true)}
                  />
                </th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Path</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    No pages match your search.
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
                      <td className="px-4 py-3 min-w-[260px]">
                        <InlineEditable
                          value={row.title}
                          ariaLabel="title"
                          displayClassName="font-medium text-brand-deep"
                          onSave={(v) => saveField(row.id, { title: v }, "Title")}
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
                      <td className="px-4 py-3 text-xs text-muted-foreground min-w-[220px]">
                        <InlineEditable
                          value={row.slug}
                          ariaLabel="slug"
                          prefix="/content/pages/"
                          displayClassName="text-xs text-muted-foreground break-all"
                          onSave={(v) => saveField(row.id, { slug: v }, "Slug")}
                        />
                      </td>

                      <td className="px-4 py-3">
                        <LifecyclePill row={row} />
                      </td>

                      <td className="px-4 py-3 text-muted-foreground">{fmt(row.updatedAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {row.status === "publish" && row.canonicalPath ? (
                            <a
                              href={row.canonicalPath}
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
            label="pages"
          />
        </section>

        <AdminBulkActionBar
          count={selected.size}
          onPublish={() => runBulkStatus("publish")}
          onUnpublish={() => runBulkStatus("draft")}
          onDelete={runBulkDelete}
          onClear={clearSelection}
          pending={bulkPending}
          labels={{ singular: "page", plural: "pages" }}
        />
      </main>
    </AdminWorkspaceShell>
  );
}
