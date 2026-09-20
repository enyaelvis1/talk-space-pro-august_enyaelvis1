import { useMemo, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
  createFaq,
  deleteFaq,
  listAdminFaqs,
  reorderFaqs,
  updateFaq,
  type AdminFaqRow,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/faqs")({
  loader: async () => {
    try {
      return await listAdminFaqs();
    } catch {
      throw redirect({ href: "/account?error=forbidden" });
    }
  },
  head: () => ({
    meta: [{ title: "FAQs | Talk Space Admin" }, { name: "robots", content: "noindex, nofollow" }],
    links: [{ rel: "canonical", href: canonicalUrl("/admin/faqs") }],
  }),
  errorComponent: ({ error }) => (
    <AdminWorkspaceShell>
      <main className="p-8 text-sm text-destructive">
        {error instanceof Error ? error.message : "Failed to load FAQs."}
      </main>
    </AdminWorkspaceShell>
  ),
  component: FaqsAdminRoute,
});

type FormState = {
  id: string | null;
  category: string;
  question: string;
  answer: string;
  isPublished: boolean;
};

const EMPTY: FormState = {
  id: null,
  category: "General",
  question: "",
  answer: "",
  isPublished: true,
};

function FaqsAdminRoute() {
  const initial = Route.useLoaderData();
  const [rows, setRows] = useState<AdminFaqRow[]>(initial);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, AdminFaqRow[]>();
    for (const r of rows) {
      const arr = map.get(r.category) ?? [];
      arr.push(r);
      map.set(r.category, arr);
    }
    for (const [k, arr] of map)
      map.set(
        k,
        [...arr].sort((a, b) => a.displayOrder - b.displayOrder),
      );
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  const categories = useMemo(() => Array.from(new Set(rows.map((r) => r.category))).sort(), [rows]);

  function openNew(category?: string) {
    setForm({ ...EMPTY, category: category ?? categories[0] ?? "General" });
  }
  function openEdit(r: AdminFaqRow) {
    setForm({
      id: r.id,
      category: r.category,
      question: r.question,
      answer: r.answer,
      isPublished: r.isPublished,
    });
  }

  async function save() {
    if (!form) return;
    if (!form.question.trim() || !form.answer.trim() || !form.category.trim()) {
      toast.error("Category, question, and answer are required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        category: form.category,
        question: form.question,
        answer: form.answer,
        isPublished: form.isPublished,
      };
      if (form.id) {
        const updated = await updateFaq({ data: { id: form.id, ...payload } });
        setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      } else {
        const sameCat = rows.filter((r) => r.category === form.category);
        const nextOrder = Math.max(0, ...sameCat.map((r) => r.displayOrder)) + 10;
        const created = await createFaq({ data: { ...payload, displayOrder: nextOrder } });
        setRows((prev) => [...prev, created]);
      }
      toast.success("FAQ saved.");
      setForm(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(r: AdminFaqRow, next: boolean) {
    setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, isPublished: next } : x)));
    try {
      await updateFaq({ data: { id: r.id, isPublished: next } });
    } catch (err) {
      setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, isPublished: !next } : x)));
      toast.error(err instanceof Error ? err.message : "Update failed.");
    }
  }

  async function move(category: string, index: number, dir: -1 | 1) {
    const catRows = grouped.find(([c]) => c === category)?.[1] ?? [];
    const target = index + dir;
    if (target < 0 || target >= catRows.length) return;
    const a = catRows[index];
    const b = catRows[target];
    const prev = rows;
    setRows((current) =>
      current.map((r) => {
        if (r.id === a.id) return { ...r, displayOrder: b.displayOrder };
        if (r.id === b.id) return { ...r, displayOrder: a.displayOrder };
        return r;
      }),
    );
    try {
      await reorderFaqs({
        data: {
          items: [
            { id: a.id, displayOrder: b.displayOrder },
            { id: b.id, displayOrder: a.displayOrder },
          ],
        },
      });
    } catch (err) {
      setRows(prev);
      toast.error(err instanceof Error ? err.message : "Reorder failed.");
    }
  }

  async function remove(r: AdminFaqRow) {
    if (!confirm(`Delete FAQ "${r.question}"?`)) return;
    setDeletingId(r.id);
    try {
      await deleteFaq({ data: { id: r.id } });
      setRows((prev) => prev.filter((x) => x.id !== r.id));
      toast.success("FAQ deleted.");
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
            <h1 className="text-2xl font-semibold text-brand-deep">FAQs</h1>
            <p className="text-sm text-muted-foreground">
              Grouped by category. Reorder within a category with the arrows.
            </p>
          </div>
          <Button onClick={() => openNew()}>
            <Plus className="mr-2 h-4 w-4" /> New FAQ
          </Button>
        </div>

        <div className="mt-6 space-y-6">
          {grouped.length === 0 ? (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No FAQs yet.
            </p>
          ) : null}
          {grouped.map(([category, items]) => (
            <section key={category}>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-deep/70">
                  {category}
                </h2>
                <Button size="sm" variant="ghost" onClick={() => openNew(category)}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add to {category}
                </Button>
              </div>
              <div className="space-y-2">
                {items.map((r, i) => (
                  <div
                    key={r.id}
                    className="flex items-start gap-3 rounded-lg border bg-card p-3 shadow-sm"
                  >
                    <div className="flex flex-col">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => move(category, i, -1)}
                        disabled={i === 0}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => move(category, i, 1)}
                        disabled={i === items.length - 1}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-brand-deep">{r.question}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{r.answer}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`fpub-${r.id}`} className="text-xs">
                          {r.isPublished ? "Published" : "Draft"}
                        </Label>
                        <Switch
                          id={`fpub-${r.id}`}
                          checked={r.isPublished}
                          onCheckedChange={(v) => togglePublish(r, v)}
                        />
                      </div>
                      <div className="flex gap-1">
                        <RevisionHistoryButton
                          entityType="faq"
                          entityId={r.id}
                          label={r.question}
                          onRestored={async () => {
                            const fresh = await listAdminFaqs();
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
            </section>
          ))}
        </div>

        <Dialog open={form !== null} onOpenChange={(o) => (o ? null : setForm(null))}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{form?.id ? "Edit FAQ" : "New FAQ"}</DialogTitle>
              <DialogDescription>Answers accept plain text or basic HTML.</DialogDescription>
            </DialogHeader>
            {form ? (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="fc">Category</Label>
                  <Input
                    id="fc"
                    list="faq-cats"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  />
                  <datalist id="faq-cats">
                    {categories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <Label htmlFor="fq">Question</Label>
                  <Input
                    id="fq"
                    value={form.question}
                    onChange={(e) => setForm({ ...form, question: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="fa">Answer</Label>
                  <Textarea
                    id="fa"
                    rows={5}
                    value={form.answer}
                    onChange={(e) => setForm({ ...form, answer: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="fp"
                    checked={form.isPublished}
                    onCheckedChange={(v) => setForm({ ...form, isPublished: v })}
                  />
                  <Label htmlFor="fp">Published</Label>
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
