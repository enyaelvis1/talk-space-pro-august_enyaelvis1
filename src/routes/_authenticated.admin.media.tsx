import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Search,
  Upload,
  X,
  Loader2,
  Tag as TagIcon,
  Trash2,
  CheckSquare,
  Square,
} from "lucide-react";

import { AdminWorkspaceShell } from "@/components/progress/AdminSidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { canonicalUrl } from "@/lib/seo";
import {
  listAdminMedia,
  updateMediaMetadata,
  refreshMediaAfterReplace,
  bulkUpdateMediaTags,
  bulkDeleteMedia,
  restoreMedia,
  type AdminMediaRow,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/media")({
  loader: async () => {
    try {
      return await listAdminMedia();
    } catch {
      throw redirect({ href: "/account?error=forbidden" });
    }
  },
  head: () => ({
    meta: [
      { title: "Media library | Talk Space Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: canonicalUrl("/admin/media") }],
  }),
  errorComponent: ({ error }) => (
    <AdminWorkspaceShell>
      <main className="p-8 text-sm text-destructive">
        {error instanceof Error ? error.message : "Failed to load media."}
      </main>
    </AdminWorkspaceShell>
  ),
  component: MediaAdminRoute,
});

const formatBytes = (n: number) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

function MediaAdminRoute() {
  const initial = Route.useLoaderData();
  const [items, setItems] = useState<AdminMediaRow[]>(initial);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "image" | "other">("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cacheBuster, setCacheBuster] = useState<Record<string, number>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<null | "tag" | "delete" | "replace">(null);
  const [bulkPending, setBulkPending] = useState(false);

  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of items) for (const t of m.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((m) => {
      if (typeFilter === "image" && !m.mimeType.startsWith("image/")) return false;
      if (typeFilter === "other" && m.mimeType.startsWith("image/")) return false;
      if (tagFilter && !m.tags.includes(tagFilter)) return false;
      if (!q) return true;
      return (
        m.fileName.toLowerCase().includes(q) ||
        m.storagePath.toLowerCase().includes(q) ||
        (m.altText?.toLowerCase().includes(q) ?? false) ||
        m.tags.some((t) => t.includes(q))
      );
    });
  }, [items, query, typeFilter, tagFilter]);

  const totalBytes = items.reduce((acc, m) => acc + m.byteSize, 0);
  const selected = items.find((m) => m.id === selectedId) ?? null;
  const selectionMode = selectedIds.size > 0;
  const filteredAllSelected = filtered.length > 0 && filtered.every((m) => selectedIds.has(m.id));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (filteredAllSelected) filtered.forEach((m) => next.delete(m.id));
      else filtered.forEach((m) => next.add(m.id));
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const patchItem = (row: AdminMediaRow, bust = false) => {
    setItems((prev) => prev.map((m) => (m.id === row.id ? row : m)));
    if (bust) setCacheBuster((prev) => ({ ...prev, [row.id]: Date.now() }));
  };

  const restoreFn = useServerFn(restoreMedia);
  const showUndoDeleteToast = ({
    deletedIds,
    deletedItems,
    retentionMinutes,
  }: {
    deletedIds: string[];
    deletedItems: AdminMediaRow[];
    retentionMinutes: number;
  }) => {
    if (deletedIds.length === 0) return;
    const label = `Moved ${deletedIds.length} file${deletedIds.length === 1 ? "" : "s"} to trash`;
    toast(label, {
      description: `Restorable for ${retentionMinutes} minutes.`,
      duration: 10_000,
      action: {
        label: "Undo",
        onClick: async () => {
          try {
            const res = await restoreFn({ data: { ids: deletedIds } });
            if (res.count > 0) {
              setItems((prev) => {
                const known = new Set(prev.map((m) => m.id));
                const restored = deletedItems.filter((m) => !known.has(m.id));
                return [...restored, ...prev].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
              });
              toast.success(`Restored ${res.count} file${res.count === 1 ? "" : "s"}`);
            } else {
              toast.error("Nothing left to restore.");
            }
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Restore failed");
          }
        },
      },
    });
  };

  const previewSrc = (m: AdminMediaRow) => {
    if (!m.publicUrl) return null;
    const bust = cacheBuster[m.id];
    return bust ? `${m.publicUrl}${m.publicUrl.includes("?") ? "&" : "?"}v=${bust}` : m.publicUrl;
  };

  return (
    <AdminWorkspaceShell>
      <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        <header>
          <p className="eyebrow">Admin · Content</p>
          <h1 className="display-1 mt-3 text-brand-deep">Media library</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            {items.length} files · {formatBytes(totalBytes)} in the private{" "}
            <code>content-media</code> bucket. Click a tile to preview it, or use the checkbox to
            select multiple files for bulk tag, replace, or delete.
          </p>
        </header>

        <section className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search filename, alt text, tags…"
              className="pl-9"
            />
          </div>
          <div className="flex gap-1 rounded-md border border-border/70 p-1 text-xs">
            {(["all", "image", "other"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setTypeFilter(s)}
                className={`rounded px-2.5 py-1 capitalize transition-colors ${
                  typeFilter === s
                    ? "bg-brand-deep text-white"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={selectAllFiltered}
            disabled={filtered.length === 0}
          >
            {filteredAllSelected ? (
              <>
                <CheckSquare className="mr-1.5 h-3.5 w-3.5" /> Deselect visible
              </>
            ) : (
              <>
                <Square className="mr-1.5 h-3.5 w-3.5" /> Select visible ({filtered.length})
              </>
            )}
          </Button>
        </section>

        {allTags.length > 0 ? (
          <section className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              <TagIcon className="mr-1 inline h-3 w-3" />
              Tags:
            </span>
            <button
              type="button"
              onClick={() => setTagFilter(null)}
              className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                tagFilter === null
                  ? "border-brand-deep bg-brand-deep text-white"
                  : "border-border/70 text-muted-foreground hover:bg-muted"
              }`}
            >
              All
            </button>
            {allTags.map(([tag, count]) => (
              <button
                key={tag}
                type="button"
                onClick={() => setTagFilter(tag === tagFilter ? null : tag)}
                className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                  tagFilter === tag
                    ? "border-brand-deep bg-brand-deep text-white"
                    : "border-border/70 text-muted-foreground hover:bg-muted"
                }`}
              >
                {tag} <span className="opacity-60">· {count}</span>
              </button>
            ))}
          </section>
        ) : null}

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 p-12 text-center text-muted-foreground">
            No media matches your filters.
          </div>
        ) : (
          <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map((m) => {
              const src = previewSrc(m);
              const isSelected = selectedIds.has(m.id);
              return (
                <div
                  key={m.id}
                  className={`group relative overflow-hidden rounded-xl border bg-card text-left transition-shadow hover:shadow-md ${
                    isSelected ? "border-brand-blue ring-2 ring-brand-blue" : "border-border/70"
                  }`}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelect(m.id);
                    }}
                    aria-label={isSelected ? "Deselect" : "Select"}
                    className={`absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded border bg-white/95 shadow-sm transition-opacity ${
                      isSelected || selectionMode
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-100 focus:opacity-100"
                    } ${isSelected ? "border-brand-blue text-brand-blue" : "border-border"}`}
                  >
                    {isSelected ? (
                      <CheckSquare className="h-4 w-4" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectionMode) toggleSelect(m.id);
                      else setSelectedId(m.id);
                    }}
                    className="block w-full text-left focus:outline-none focus:ring-2 focus:ring-brand-blue"
                  >
                    <div className="aspect-square bg-muted">
                      {src && m.mimeType.startsWith("image/") ? (
                        <img
                          src={src}
                          alt={m.altText ?? m.fileName}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs uppercase text-muted-foreground">
                          {m.mimeType || "file"}
                        </div>
                      )}
                    </div>
                    <div className="space-y-1 p-3 text-xs">
                      <p className="truncate font-medium text-brand-deep" title={m.fileName}>
                        {m.fileName}
                      </p>
                      <p className="text-muted-foreground">{formatBytes(m.byteSize)}</p>
                      {m.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {m.tags.slice(0, 3).map((t) => (
                            <Badge key={t} variant="secondary" className="text-[10px]">
                              {t}
                            </Badge>
                          ))}
                          {m.tags.length > 3 ? (
                            <span className="text-[10px] text-muted-foreground">
                              +{m.tags.length - 3}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </button>
                </div>
              );
            })}
          </section>
        )}
      </main>

      <MediaDetailDialog
        item={selected}
        previewSrc={selected ? previewSrc(selected) : null}
        onOpenChange={(open) => !open && setSelectedId(null)}
        onSaved={(row) => patchItem(row)}
        onReplaced={(row) => patchItem(row, true)}
      />

      <MediaBulkBar
        count={selectedIds.size}
        pending={bulkPending}
        onClear={clearSelection}
        onTag={() => setBulkAction("tag")}
        onReplace={() => setBulkAction("replace")}
        onDelete={() => setBulkAction("delete")}
      />

      <BulkTagDialog
        open={bulkAction === "tag"}
        onOpenChange={(o) => !o && setBulkAction(null)}
        ids={[...selectedIds]}
        onDone={(updated) => {
          setItems((prev) => prev.map((m) => updated.get(m.id) ?? m));
          setBulkAction(null);
        }}
        setPending={setBulkPending}
      />

      <BulkDeleteDialog
        open={bulkAction === "delete"}
        onOpenChange={(o) => !o && setBulkAction(null)}
        ids={[...selectedIds]}
        items={items.filter((m) => selectedIds.has(m.id))}
        onDone={({ deletedIds, deletedItems, retentionMinutes }) => {
          setItems((prev) => prev.filter((m) => !deletedIds.includes(m.id)));
          setSelectedIds(new Set());
          setBulkAction(null);
          showUndoDeleteToast({ deletedIds, deletedItems, retentionMinutes });
        }}
        setPending={setBulkPending}
      />

      <BulkReplaceDialog
        open={bulkAction === "replace"}
        onOpenChange={(o) => !o && setBulkAction(null)}
        items={items.filter((m) => selectedIds.has(m.id))}
        onReplaced={(row) => patchItem(row, true)}
        onDone={() => setBulkAction(null)}
        setPending={setBulkPending}
      />
    </AdminWorkspaceShell>
  );
}

function MediaBulkBar({
  count,
  pending,
  onClear,
  onTag,
  onReplace,
  onDelete,
}: {
  count: number;
  pending: boolean;
  onClear: () => void;
  onTag: () => void;
  onReplace: () => void;
  onDelete: () => void;
}) {
  if (count === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4">
      <div className="pointer-events-auto flex flex-wrap items-center gap-3 rounded-2xl border border-border/70 bg-brand-deep px-4 py-3 text-white shadow-lg">
        <span className="text-sm font-medium">
          {count} file{count === 1 ? "" : "s"} selected
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" disabled={pending} onClick={onTag}>
            <TagIcon className="mr-1 h-3.5 w-3.5" /> Tag
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
            disabled={pending}
            onClick={onReplace}
          >
            <Upload className="mr-1 h-3.5 w-3.5" /> Replace
          </Button>
          <Button size="sm" variant="destructive" disabled={pending} onClick={onDelete}>
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
          </Button>
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear selection"
            className="ml-1 rounded-md p-1 text-white/70 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function BulkTagDialog({
  open,
  onOpenChange,
  ids,
  onDone,
  setPending,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  ids: string[];
  onDone: (updated: Map<string, AdminMediaRow>) => void;
  setPending: (b: boolean) => void;
}) {
  const bulkFn = useServerFn(bulkUpdateMediaTags);
  const listFn = useServerFn(listAdminMedia);
  const [mode, setMode] = useState<"add" | "remove" | "replace">("add");
  const [tagsText, setTagsText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setMode("add");
      setTagsText("");
    }
  }, [open]);

  const tags = tagsText
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const submit = async () => {
    if (tags.length === 0) {
      toast.error("Add at least one tag");
      return;
    }
    setBusy(true);
    setPending(true);
    try {
      await bulkFn({ data: { ids, mode, tags } });
      // Refresh to get authoritative tags (server normalizes case/dedupes)
      const fresh = await listFn();
      const map = new Map(fresh.map((r) => [r.id, r]));
      onDone(map);
      toast.success(`Updated ${ids.length} file${ids.length === 1 ? "" : "s"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk tag failed");
    } finally {
      setBusy(false);
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Tag {ids.length} file{ids.length === 1 ? "" : "s"}
          </DialogTitle>
          <DialogDescription>
            Add tags to, remove tags from, or replace all tags on the selected files.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-1 rounded-md border border-border/70 p-1 text-xs">
            {(["add", "remove", "replace"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 rounded px-3 py-1.5 capitalize transition-colors ${
                  mode === m ? "bg-brand-deep text-white" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bulk-tags">Tags</Label>
            <Input
              id="bulk-tags"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="hero, inline, avatar"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated. Lowercased and de-duplicated on save.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || tags.length === 0}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkDeleteDialog({
  open,
  onOpenChange,
  ids,
  items,
  onDone,
  setPending,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  ids: string[];
  items: AdminMediaRow[];
  onDone: (result: {
    deletedIds: string[];
    deletedItems: AdminMediaRow[];
    retentionMinutes: number;
  }) => void;
  setPending: (b: boolean) => void;
}) {
  const bulkFn = useServerFn(bulkDeleteMedia);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    if (open) setConfirm("");
  }, [open]);

  const submit = async () => {
    setBusy(true);
    setPending(true);
    try {
      const res = await bulkFn({ data: { ids } });
      const deletedItems = items.filter((m) => res.restorableIds.includes(m.id));
      onDone({
        deletedIds: res.restorableIds,
        deletedItems,
        retentionMinutes: res.retentionMinutes,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk delete failed");
    } finally {
      setBusy(false);
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Move {ids.length} file{ids.length === 1 ? "" : "s"} to trash?
          </DialogTitle>
          <DialogDescription>
            Files are hidden from the library and can be restored from the toast or the trash view.
            They are permanently removed after the retention window expires.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-40 overflow-y-auto rounded border border-border/70 bg-muted/40 p-2 text-xs">
          {items.slice(0, 20).map((m) => (
            <div key={m.id} className="truncate">
              {m.fileName}
            </div>
          ))}
          {items.length > 20 ? (
            <div className="pt-1 text-muted-foreground">…and {items.length - 20} more</div>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm-del">
            Type <code>DELETE</code> to confirm
          </Label>
          <Input
            id="confirm-del"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoFocus
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={submit} disabled={busy || confirm !== "DELETE"}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Move to trash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkReplaceDialog({
  open,
  onOpenChange,
  items,
  onReplaced,
  onDone,
  setPending,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  items: AdminMediaRow[];
  onReplaced: (row: AdminMediaRow) => void;
  onDone: () => void;
  setPending: (b: boolean) => void;
}) {
  const refreshFn = useServerFn(refreshMediaAfterReplace);
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setFiles([]);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [open]);

  // Match by exact filename first; leftovers go positionally.
  const plan = useMemo(() => {
    const used = new Set<number>();
    const assignments: { target: AdminMediaRow; file: File | null; matchedBy: string }[] = [];
    for (const t of items) {
      const idx = files.findIndex((f, i) => !used.has(i) && f.name === t.fileName);
      if (idx >= 0) {
        used.add(idx);
        assignments.push({ target: t, file: files[idx], matchedBy: "name" });
      } else {
        assignments.push({ target: t, file: null, matchedBy: "" });
      }
    }
    // Positional fill for unmatched
    let cursor = 0;
    for (const a of assignments) {
      if (a.file) continue;
      while (cursor < files.length && used.has(cursor)) cursor++;
      if (cursor < files.length) {
        used.add(cursor);
        a.file = files[cursor];
        a.matchedBy = "order";
      }
    }
    return assignments;
  }, [items, files]);

  const assigned = plan.filter((p) => p.file).length;

  const submit = async () => {
    if (assigned === 0) return;
    setBusy(true);
    setPending(true);
    let ok = 0;
    let fail = 0;
    try {
      for (const { target, file } of plan) {
        if (!file) continue;
        try {
          const { error: upErr } = await supabase.storage
            .from("content-media")
            .upload(target.storagePath, file, {
              upsert: true,
              contentType: file.type || target.mimeType,
              cacheControl: "3600",
            });
          if (upErr) throw upErr;
          const row = await refreshFn({
            data: {
              id: target.id,
              mimeType: file.type || target.mimeType,
              byteSize: file.size,
              sourceFilename: file.name,
            },
          });
          onReplaced(row);
          ok++;
        } catch (err) {
          console.error("replace failed", target.fileName, err);
          fail++;
        }
      }
      if (fail === 0) toast.success(`Replaced ${ok} file${ok === 1 ? "" : "s"}`);
      else toast.warning(`Replaced ${ok}, ${fail} failed`);
      onDone();
    } finally {
      setBusy(false);
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Replace {items.length} file{items.length === 1 ? "" : "s"}
          </DialogTitle>
          <DialogDescription>
            Pick replacement files. Each target is matched by exact filename first; any leftovers
            are paired in the order you selected them.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            <Upload className="mr-2 h-4 w-4" />
            {files.length > 0 ? `Chosen: ${files.length} file(s)` : "Choose files"}
          </Button>

          <div className="max-h-64 overflow-y-auto rounded border border-border/70">
            <table className="w-full text-xs">
              <thead className="bg-muted/60 text-left">
                <tr>
                  <th className="px-2 py-1.5">Target</th>
                  <th className="px-2 py-1.5">Replacement</th>
                  <th className="px-2 py-1.5">Match</th>
                </tr>
              </thead>
              <tbody>
                {plan.map(({ target, file, matchedBy }) => (
                  <tr key={target.id} className="border-t border-border/50">
                    <td className="truncate px-2 py-1.5" title={target.fileName}>
                      {target.fileName}
                    </td>
                    <td className="truncate px-2 py-1.5">
                      {file ? (
                        <span className="text-brand-deep">{file.name}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground">
                      {matchedBy || "unassigned"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            {assigned} of {items.length} target{items.length === 1 ? "" : "s"} will be replaced.
            Storage paths are preserved so existing references keep working.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || assigned === 0}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Replace {assigned} file{assigned === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MediaDetailDialog({
  item,
  previewSrc,
  onOpenChange,
  onSaved,
  onReplaced,
}: {
  item: AdminMediaRow | null;
  previewSrc: string | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (row: AdminMediaRow) => void;
  onReplaced: (row: AdminMediaRow) => void;
}) {
  const updateFn = useServerFn(updateMediaMetadata);
  const refreshFn = useServerFn(refreshMediaAfterReplace);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [alt, setAlt] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (item) {
      setAlt(item.altText ?? "");
      setTagsText(item.tags.join(", "));
    }
  }, [item]);

  if (!item) return null;

  const parsedTags = tagsText
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const save = async () => {
    setSaving(true);
    try {
      const row = await updateFn({
        data: { id: item.id, altText: alt, tags: parsedTags },
      });
      onSaved(row);
      toast.success("Media updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const onReplaceFile = async (file: File) => {
    setUploading(true);
    try {
      const { error: upErr } = await supabase.storage
        .from("content-media")
        .upload(item.storagePath, file, {
          upsert: true,
          contentType: file.type || item.mimeType,
          cacheControl: "3600",
        });
      if (upErr) throw upErr;
      const row = await refreshFn({
        data: {
          id: item.id,
          mimeType: file.type || item.mimeType,
          byteSize: file.size,
          sourceFilename: file.name,
        },
      });
      onReplaced(row);
      toast.success("File replaced");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">{item.fileName}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-[1fr_1fr]">
          <div className="space-y-3">
            <div className="overflow-hidden rounded-lg border bg-muted">
              {previewSrc && item.mimeType.startsWith("image/") ? (
                <img
                  src={previewSrc}
                  alt={item.altText ?? item.fileName}
                  className="max-h-[360px] w-full object-contain"
                />
              ) : (
                <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                  {item.mimeType || "file"}
                </div>
              )}
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>
                <strong>Type:</strong> {item.mimeType || "unknown"}
              </p>
              <p>
                <strong>Size:</strong> {formatBytes(item.byteSize)}
              </p>
              <p className="truncate">
                <strong>Path:</strong> {item.storagePath}
              </p>
              {previewSrc ? (
                <a
                  href={previewSrc}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-blue-deep hover:underline"
                >
                  Open original
                </a>
              ) : null}
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="alt-text">Alt text</Label>
              <Textarea
                id="alt-text"
                value={alt}
                onChange={(e) => setAlt(e.target.value)}
                rows={3}
                placeholder="Describe the image for accessibility"
                maxLength={500}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                placeholder="hero, inline, avatar"
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated. Lowercased and de-duplicated on save.
              </p>
              {parsedTags.length > 0 ? (
                <div className="flex flex-wrap gap-1 pt-1">
                  {parsedTags.map((t) => (
                    <Badge key={t} variant="secondary" className="text-xs">
                      {t.toLowerCase().replace(/\s+/g, "-")}
                      <button
                        type="button"
                        className="ml-1 opacity-60 hover:opacity-100"
                        onClick={() => setTagsText(parsedTags.filter((x) => x !== t).join(", "))}
                        aria-label={`Remove ${t}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label>Replace file</Label>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onReplaceFile(f);
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full"
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" /> Choose new file
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                Overwrites <code>{item.storagePath}</code>. All references keep working.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
