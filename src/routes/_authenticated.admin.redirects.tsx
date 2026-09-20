import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

import { AdminWorkspaceShell } from "@/components/progress/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { canonicalUrl } from "@/lib/seo";
import {
  deleteRedirect,
  listRedirects,
  upsertRedirect,
  type RedirectRow,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/redirects")({
  head: () => ({
    meta: [
      { title: "Redirects — Admin" },
      { name: "robots", content: "noindex" },
      { rel: "canonical", href: canonicalUrl("/admin") },
    ],
  }),
  component: RedirectsPage,
});

type FormState = {
  id?: string;
  fromPath: string;
  toPath: string;
  statusCode: 301 | 302 | 307 | 308;
  isActive: boolean;
  notes: string;
};

const EMPTY: FormState = {
  fromPath: "",
  toPath: "",
  statusCode: 301,
  isActive: true,
  notes: "",
};

function RedirectsPage() {
  const [rows, setRows] = useState<RedirectRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [checkingId, setCheckingId] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      setRows(await listRedirects());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load redirects.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function openNew() {
    setForm(EMPTY);
    setOpen(true);
  }

  function openEdit(r: RedirectRow) {
    setForm({
      id: r.id,
      fromPath: r.fromPath,
      toPath: r.toPath,
      statusCode: r.statusCode as FormState["statusCode"],
      isActive: r.isActive,
      notes: r.notes ?? "",
    });
    setOpen(true);
  }

  async function save() {
    if (!form.fromPath.trim() || !form.toPath.trim()) {
      toast.error("Both From and To paths are required.");
      return;
    }
    setSaving(true);
    try {
      await upsertRedirect({
        data: {
          id: form.id,
          fromPath: form.fromPath,
          toPath: form.toPath,
          statusCode: form.statusCode,
          isActive: form.isActive,
          notes: form.notes || null,
        },
      });
      toast.success(form.id ? "Redirect updated." : "Redirect created.");
      setOpen(false);
      void refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(r: RedirectRow) {
    if (!confirm(`Delete redirect for ${r.fromPath}?`)) return;
    try {
      await deleteRedirect({ data: { id: r.id } });
      toast.success("Redirect deleted.");
      void refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  async function verify(r: RedirectRow) {
    setCheckingId(r.id);
    try {
      const response = await fetch(r.fromPath, { redirect: "manual", cache: "no-store" });
      const location = response.headers.get("location");
      const expected = r.toPath.startsWith("http")
        ? r.toPath
        : new URL(r.toPath, window.location.origin).href;
      const actual = location ? new URL(location, window.location.origin).href : null;
      if (response.status === r.statusCode && actual === expected) {
        toast.success(`${r.fromPath} verified: ${response.status} → ${r.toPath}`);
      } else {
        toast.error(
          `${r.fromPath} returned ${response.status} → ${location ?? "no Location header"}. Expected ${r.statusCode} → ${r.toPath}.`,
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Redirect verification failed.");
    } finally {
      setCheckingId(null);
    }
  }

  return (
    <AdminWorkspaceShell>
      <main id="main" className="min-h-screen bg-surface-page">
        <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Redirects</h1>
              <p className="text-sm text-muted-foreground">
                Send legacy or renamed URLs to their new destination. Applied server-side.
              </p>
            </div>
            <Button onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" /> New redirect
            </Button>
          </div>

          <div className="overflow-x-auto rounded-md border bg-background">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : !rows || rows.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No redirects yet. Add one to route an old path to a new location.
              </p>
            ) : (
              <table className="min-w-[44rem] w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">From</th>
                    <th className="px-3 py-2">To</th>
                    <th className="px-3 py-2 w-20">Code</th>
                    <th className="px-3 py-2 w-20">Active</th>
                    <th className="px-3 py-2 w-36" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="px-3 py-2 font-mono text-xs">{r.fromPath}</td>
                      <td className="px-3 py-2 font-mono text-xs">{r.toPath}</td>
                      <td className="px-3 py-2">{r.statusCode}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            r.isActive
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {r.isActive ? "On" : "Off"}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void verify(r)}
                            disabled={checkingId === r.id}
                            title="Verify redirect"
                          >
                            {checkingId === r.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => remove(r)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{form.id ? "Edit redirect" : "New redirect"}</DialogTitle>
                <DialogDescription>
                  From path is matched against the incoming URL (case-insensitive, trailing slashes
                  ignored).
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="from">From path</Label>
                  <Input
                    id="from"
                    placeholder="/old-page"
                    value={form.fromPath}
                    onChange={(e) => setForm((s) => ({ ...s, fromPath: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="to">To path or URL</Label>
                  <Input
                    id="to"
                    placeholder="/new-page  or  https://…"
                    value={form.toPath}
                    onChange={(e) => setForm((s) => ({ ...s, toPath: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Status code</Label>
                    <Select
                      value={String(form.statusCode)}
                      onValueChange={(v) =>
                        setForm((s) => ({
                          ...s,
                          statusCode: Number(v) as FormState["statusCode"],
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="301">301 — Permanent</SelectItem>
                        <SelectItem value="302">302 — Temporary</SelectItem>
                        <SelectItem value="307">307 — Temporary (preserve method)</SelectItem>
                        <SelectItem value="308">308 — Permanent (preserve method)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="active"
                        checked={form.isActive}
                        onCheckedChange={(v) => setForm((s) => ({ ...s, isActive: v }))}
                      />
                      <Label htmlFor="active">Active</Label>
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    rows={2}
                    value={form.notes}
                    onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={save} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </main>
    </AdminWorkspaceShell>
  );
}
