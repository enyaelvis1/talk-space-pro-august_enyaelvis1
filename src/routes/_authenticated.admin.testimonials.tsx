import { useMemo, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus, Star, Trash2 } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { canonicalUrl } from "@/lib/seo";
import { RevisionHistoryButton } from "@/components/admin/RevisionHistoryButton";
import {
  createTestimonial,
  deleteTestimonial,
  listAdminTestimonials,
  reorderTestimonials,
  updateTestimonial,
  type AdminTestimonialRow,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/testimonials")({
  loader: async () => {
    try {
      return await listAdminTestimonials();
    } catch {
      throw redirect({ href: "/account?error=forbidden" });
    }
  },
  head: () => ({
    meta: [
      { title: "Testimonials | Talk Space Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: canonicalUrl("/admin/testimonials") }],
  }),
  errorComponent: ({ error }) => (
    <AdminWorkspaceShell>
      <main className="p-8 text-sm text-destructive">
        {error instanceof Error ? error.message : "Failed to load testimonials."}
      </main>
    </AdminWorkspaceShell>
  ),
  component: TestimonialsAdminRoute,
});

type FormState = {
  id: string | null;
  authorName: string;
  authorRole: string;
  quote: string;
  rating: string;
  avatarUrl: string;
  isPublished: boolean;
};

const EMPTY: FormState = {
  id: null,
  authorName: "",
  authorRole: "",
  quote: "",
  rating: "",
  avatarUrl: "",
  isPublished: true,
};

function TestimonialsAdminRoute() {
  const initial = Route.useLoaderData();
  const [rows, setRows] = useState<AdminTestimonialRow[]>(initial);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const sorted = useMemo(() => [...rows].sort((a, b) => a.displayOrder - b.displayOrder), [rows]);

  function openNew() {
    setForm({ ...EMPTY, isPublished: true });
  }

  function openEdit(r: AdminTestimonialRow) {
    setForm({
      id: r.id,
      authorName: r.authorName,
      authorRole: r.authorRole ?? "",
      quote: r.quote,
      rating: r.rating != null ? String(r.rating) : "",
      avatarUrl: r.avatarUrl ?? "",
      isPublished: r.isPublished,
    });
  }

  async function save() {
    if (!form) return;
    if (!form.authorName.trim() || !form.quote.trim()) {
      toast.error("Author and quote are required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        authorName: form.authorName,
        authorRole: form.authorRole || null,
        quote: form.quote,
        rating: form.rating ? Number(form.rating) : null,
        avatarUrl: form.avatarUrl || null,
        isPublished: form.isPublished,
      };
      if (form.id) {
        const updated = await updateTestimonial({ data: { id: form.id, ...payload } });
        setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      } else {
        const created = await createTestimonial({
          data: {
            ...payload,
            displayOrder: Math.max(0, ...rows.map((r) => r.displayOrder)) + 10,
          },
        });
        setRows((prev) => [...prev, created]);
      }
      toast.success("Testimonial saved.");
      setForm(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(r: AdminTestimonialRow, next: boolean) {
    setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, isPublished: next } : x)));
    try {
      await updateTestimonial({ data: { id: r.id, isPublished: next } });
    } catch (err) {
      setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, isPublished: !next } : x)));
      toast.error(err instanceof Error ? err.message : "Update failed.");
    }
  }

  async function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= sorted.length) return;
    const a = sorted[index];
    const b = sorted[target];
    const swapped = sorted.map((r) => {
      if (r.id === a.id) return { ...r, displayOrder: b.displayOrder };
      if (r.id === b.id) return { ...r, displayOrder: a.displayOrder };
      return r;
    });
    setRows(swapped);
    try {
      await reorderTestimonials({
        data: {
          items: [
            { id: a.id, displayOrder: b.displayOrder },
            { id: b.id, displayOrder: a.displayOrder },
          ],
        },
      });
    } catch (err) {
      setRows(rows);
      toast.error(err instanceof Error ? err.message : "Reorder failed.");
    }
  }

  async function remove(r: AdminTestimonialRow) {
    if (!confirm(`Delete testimonial from ${r.authorName}?`)) return;
    setDeletingId(r.id);
    try {
      await deleteTestimonial({ data: { id: r.id } });
      setRows((prev) => prev.filter((x) => x.id !== r.id));
      toast.success("Testimonial deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <AdminWorkspaceShell>
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-brand-deep">Testimonials</h1>
            <p className="text-sm text-muted-foreground">
              Manage client quotes shown on the marketing site. Drag order using arrows.
            </p>
          </div>
          <Button onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" /> New testimonial
          </Button>
        </div>

        <div className="mt-6 space-y-3">
          {sorted.length === 0 ? (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No testimonials yet. Add your first quote.
            </p>
          ) : null}
          {sorted.map((r, i) => (
            <div
              key={r.id}
              className="flex items-start gap-3 rounded-lg border bg-card p-4 shadow-sm"
            >
              <div className="flex flex-col gap-1">
                <Button size="icon" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <span className="text-center text-xs text-muted-foreground">{i + 1}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => move(i, 1)}
                  disabled={i === sorted.length - 1}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-brand-deep">{r.authorName}</p>
                  {r.authorRole ? (
                    <span className="text-sm text-muted-foreground">— {r.authorRole}</span>
                  ) : null}
                  {r.rating ? (
                    <span className="inline-flex items-center gap-0.5 text-amber-600">
                      {Array.from({ length: r.rating }).map((_, k) => (
                        <Star key={k} className="h-3.5 w-3.5 fill-current" />
                      ))}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{r.quote}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor={`pub-${r.id}`} className="text-xs">
                    {r.isPublished ? "Published" : "Draft"}
                  </Label>
                  <Switch
                    id={`pub-${r.id}`}
                    checked={r.isPublished}
                    onCheckedChange={(v) => togglePublish(r, v)}
                  />
                </div>
                <div className="flex gap-1">
                  <RevisionHistoryButton
                    entityType="testimonial"
                    entityId={r.id}
                    label={r.authorName}
                    onRestored={async () => {
                      const fresh = await listAdminTestimonials();
                      setRows(fresh);
                    }}
                  />
                  <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
                    <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => remove(r)}
                    disabled={deletingId === r.id}
                  >
                    {deletingId === r.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <Dialog open={form !== null} onOpenChange={(o) => (o ? null : setForm(null))}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{form?.id ? "Edit testimonial" : "New testimonial"}</DialogTitle>
              <DialogDescription>
                Testimonials shown as Published appear on the public site.
              </DialogDescription>
            </DialogHeader>
            {form ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="tn">Author name</Label>
                    <Input
                      id="tn"
                      value={form.authorName}
                      onChange={(e) => setForm({ ...form, authorName: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="tr">Role / location</Label>
                    <Input
                      id="tr"
                      value={form.authorRole}
                      onChange={(e) => setForm({ ...form, authorRole: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="tq">Quote</Label>
                  <Textarea
                    id="tq"
                    rows={4}
                    value={form.quote}
                    onChange={(e) => setForm({ ...form, quote: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="tra">Rating (1–5)</Label>
                    <Input
                      id="tra"
                      type="number"
                      min={1}
                      max={5}
                      value={form.rating}
                      onChange={(e) => setForm({ ...form, rating: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="tav">Avatar URL</Label>
                    <Input
                      id="tav"
                      value={form.avatarUrl}
                      onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })}
                      placeholder="https://…"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="tp"
                    checked={form.isPublished}
                    onCheckedChange={(v) => setForm({ ...form, isPublished: v })}
                  />
                  <Label htmlFor="tp">Published</Label>
                </div>
              </div>
            ) : null}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setForm(null)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </AdminWorkspaceShell>
  );
}
