import { useMemo, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AdminWorkspaceShell } from "@/components/progress/AdminSidebar";
import { SensitiveActionDialog } from "@/components/admin/SensitiveActionDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { canonicalUrl } from "@/lib/seo";
import { useSensitiveActionGate } from "@/hooks/useSensitiveActionGate";
import {
  createService,
  deleteService,
  getAdminServicesWorkspace,
  listAdminServices,
  setServiceActive,
  updateService,
  type AdminServiceRow,
  type AdminTherapistRow,
} from "@/lib/admin.functions";

type LoaderData = {
  services: AdminServiceRow[];
  therapists: AdminTherapistRow[];
};

export const Route = createFileRoute("/_authenticated/admin/services")({
  loader: async (): Promise<LoaderData> => {
    try {
      return await getAdminServicesWorkspace();
    } catch {
      throw redirect({ href: "/account?error=forbidden" });
    }
  },
  head: () => ({
    meta: [
      { title: "Services | Talk Space Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: canonicalUrl("/admin/services") }],
  }),
  errorComponent: ({ error }) => (
    <AdminWorkspaceShell>
      <main className="p-8 text-sm text-destructive">
        {error instanceof Error ? error.message : "Failed to load services."}
      </main>
    </AdminWorkspaceShell>
  ),
  component: ServicesAdminRoute,
});

type FormState = {
  id: string | null;
  code: string;
  slug: string;
  name: string;
  description: string;
  durationMinutes: number;
  sessionsPerPackage: number;
  priceNgn: string;
  inPersonPriceNgn: string;
  currency: string;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  minimumLeadTimeMinutes: number;
  displayOrder: number;
  isActive: boolean;
  therapistIds: string[];
};

function emptyForm(): FormState {
  return {
    id: null,
    code: "",
    slug: "",
    name: "",
    description: "",
    durationMinutes: 60,
    sessionsPerPackage: 1,
    priceNgn: "",
    inPersonPriceNgn: "",
    currency: "NGN",
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
    minimumLeadTimeMinutes: 0,
    displayOrder: 0,
    isActive: true,
    therapistIds: [],
  };
}

function toForm(row: AdminServiceRow): FormState {
  return {
    id: row.id,
    code: row.code,
    slug: row.slug,
    name: row.name,
    description: row.description ?? "",
    durationMinutes: row.durationMinutes,
    sessionsPerPackage: row.sessionsPerPackage,
    priceNgn: row.priceNgn == null ? "" : String(row.priceNgn),
    inPersonPriceNgn: row.inPersonPriceNgn == null ? "" : String(row.inPersonPriceNgn),
    currency: row.currency,
    bufferBeforeMinutes: row.bufferBeforeMinutes,
    bufferAfterMinutes: row.bufferAfterMinutes,
    minimumLeadTimeMinutes: row.minimumLeadTimeMinutes,
    displayOrder: row.displayOrder,
    isActive: row.isActive,
    therapistIds: row.therapistIds,
  };
}

function parseNairaInput(value: string, label: string) {
  const cleaned = value.replace(/[₦,\s]/g, "");
  if (!cleaned) return null;
  if (!/^\d+$/.test(cleaned)) {
    throw new Error(`${label} must be a whole naira amount, for example 85000.`);
  }
  const amount = Number(cleaned);
  if (!Number.isSafeInteger(amount)) {
    throw new Error(`${label} is too large.`);
  }
  return amount;
}

function ServicesAdminRoute() {
  const { services: initialServices, therapists } = Route.useLoaderData() as LoaderData;
  const [rows, setRows] = useState<AdminServiceRow[]>(initialServices);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const stepUp = useSensitiveActionGate();

  const therapistMap = useMemo(
    () => new Map<string, AdminTherapistRow>(therapists.map((t) => [t.id, t])),
    [therapists],
  );

  async function refresh() {
    try {
      const next = await listAdminServices();
      setRows(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Refresh failed.");
    }
  }

  function openCreate() {
    setForm(emptyForm());
    setDialogOpen(true);
  }

  function openEdit(row: AdminServiceRow) {
    setForm(toForm(row));
    setDialogOpen(true);
  }

  async function toggle(row: AdminServiceRow) {
    setSavingId(row.id);
    try {
      await setServiceActive({ data: { id: row.id, isActive: !row.isActive } });
      setRows((all) => all.map((r) => (r.id === row.id ? { ...r, isActive: !r.isActive } : r)));
      toast.success(row.isActive ? "Service hidden from booking." : "Service activated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(row: AdminServiceRow) {
    if (
      !window.confirm(
        `Delete "${row.name}"? This cannot be undone. If the service has appointments, deactivate it instead.`,
      )
    )
      return;
    const stepUpAllowed = await stepUp.requestStepUp(`delete service ${row.name}`);
    if (!stepUpAllowed) return;
    setDeletingId(row.id);
    try {
      await deleteService({ data: { id: row.id } });
      setRows((all) => all.filter((r) => r.id !== row.id));
      toast.success("Service deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        code: form.code.trim(),
        slug: form.slug.trim(),
        name: form.name.trim(),
        description: form.description.trim() || null,
        durationMinutes: Number(form.durationMinutes),
        sessionsPerPackage: Number(form.sessionsPerPackage),
        priceNgn: parseNairaInput(form.priceNgn, "Online price"),
        inPersonPriceNgn: parseNairaInput(form.inPersonPriceNgn, "In-person price"),
        currency: form.currency.trim().toUpperCase() || "NGN",
        bufferBeforeMinutes: Number(form.bufferBeforeMinutes),
        bufferAfterMinutes: Number(form.bufferAfterMinutes),
        minimumLeadTimeMinutes: Number(form.minimumLeadTimeMinutes),
        displayOrder: Number(form.displayOrder),
        isActive: form.isActive,
        therapistIds: form.therapistIds,
      };
      if (form.id) {
        await updateService({ data: { ...payload, id: form.id } });
        toast.success("Service updated.");
      } else {
        await createService({ data: payload });
        toast.success("Service created.");
      }
      setDialogOpen(false);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminWorkspaceShell>
      <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Admin · CMS</p>
            <h1 className="display-1 mt-3 text-brand-deep">Services & pricing</h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Manage the service catalogue shown on the public site and inside the booking flow.
              Assign providers, set durations, buffers, and package pricing.
            </p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> New service
          </Button>
        </header>

        <Alert className="border-brand-sage/30 bg-brand-cream/70">
          <AlertTitle>This controls the booking service dropdown.</AlertTitle>
          <AlertDescription>
            The public “Choose a service” list is built from the active services below. Edit a
            service name or duration to change the dropdown label, change display order to rearrange
            it, deactivate a service to hide it from booking, or delete unused services here. The
            online and in-person price fields control the amount used during booking checkout. To
            change the wording of public pricing cards, edit the Pricing page from Admin → Pages.
          </AlertDescription>
        </Alert>

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 p-12 text-center text-muted-foreground">
            No services yet. Create the first one to make it bookable.
          </div>
        ) : (
          <section className="grid gap-4">
            {rows.map((s) => (
              <article key={s.id} className="rounded-2xl border border-border/70 bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold text-brand-deep">{s.name}</h2>
                      <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                        {s.code}
                      </span>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          s.isActive
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {s.isActive ? "Active" : "Hidden"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">/{s.slug}</p>
                    {s.description ? (
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                        {s.description}
                      </p>
                    ) : null}
                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-5">
                      <div>
                        <dt className="uppercase tracking-wide">Duration</dt>
                        <dd className="font-medium text-foreground">{s.durationMinutes} min</dd>
                      </div>
                      <div>
                        <dt className="uppercase tracking-wide">Sessions</dt>
                        <dd className="font-medium text-foreground">{s.sessionsPerPackage}×</dd>
                      </div>
                      <div>
                        <dt className="uppercase tracking-wide">Online price</dt>
                        <dd className="font-medium text-foreground">
                          {s.priceNgn == null
                            ? "—"
                            : `${s.currency} ${s.priceNgn.toLocaleString()}`}
                        </dd>
                      </div>
                      <div>
                        <dt className="uppercase tracking-wide">In-person price</dt>
                        <dd className="font-medium text-foreground">
                          {s.inPersonPriceNgn == null
                            ? "—"
                            : `${s.currency} ${s.inPersonPriceNgn.toLocaleString()}`}
                        </dd>
                      </div>
                      <div>
                        <dt className="uppercase tracking-wide">Lead time</dt>
                        <dd className="font-medium text-foreground">
                          {s.minimumLeadTimeMinutes} min
                        </dd>
                      </div>
                    </dl>
                    {s.therapistIds.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {s.therapistIds.map((tid) => {
                          const t = therapistMap.get(tid);
                          return (
                            <span
                              key={tid}
                              className="rounded-full bg-brand-mint/40 px-2 py-0.5 text-[11px] text-brand-deep"
                            >
                              {t?.fullName ?? tid.slice(0, 8)}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="mt-3 text-[11px] italic text-muted-foreground">
                        No therapists assigned — will not appear in booking.
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    <div className="flex items-center gap-2 text-xs">
                      <Switch
                        checked={s.isActive}
                        disabled={savingId === s.id}
                        onCheckedChange={() => toggle(s)}
                        id={`svc-${s.id}`}
                      />
                      <label htmlFor={`svc-${s.id}`} className="text-muted-foreground">
                        Active
                      </label>
                      {savingId === s.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEdit(s)}>
                        <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(s)}
                        disabled={deletingId === s.id}
                      >
                        {deletingId === s.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit service" : "New service"}</DialogTitle>
            <DialogDescription>
              Changes save immediately across the public site and booking flow.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="svc-name">Name</Label>
                <Input
                  id="svc-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="svc-code">Code</Label>
                <Input
                  id="svc-code"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toLowerCase() }))}
                  placeholder="individual_60"
                  required
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="svc-slug">Slug</Label>
                <Input
                  id="svc-slug"
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase() }))}
                  placeholder="individual-therapy-60"
                  required
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="svc-desc">Description</Label>
                <Textarea
                  id="svc-desc"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="svc-duration">Duration (min)</Label>
                <Input
                  id="svc-duration"
                  type="number"
                  min={5}
                  step={5}
                  value={form.durationMinutes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, durationMinutes: Number(e.target.value) }))
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="svc-sessions">Sessions / package</Label>
                <Input
                  id="svc-sessions"
                  type="number"
                  min={1}
                  value={form.sessionsPerPackage}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      sessionsPerPackage: Number(e.target.value),
                    }))
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="svc-price">Online price</Label>
                <Input
                  id="svc-price"
                  type="text"
                  inputMode="numeric"
                  value={form.priceNgn}
                  onChange={(e) => setForm((f) => ({ ...f, priceNgn: e.target.value }))}
                  placeholder="Leave blank for POA, or enter 85,000"
                />
              </div>
              <div>
                <Label htmlFor="svc-in-person-price">In-person price</Label>
                <Input
                  id="svc-in-person-price"
                  type="text"
                  inputMode="numeric"
                  value={form.inPersonPriceNgn}
                  onChange={(e) => setForm((f) => ({ ...f, inPersonPriceNgn: e.target.value }))}
                  placeholder="Defaults to online price, or enter 130,000"
                />
              </div>
              <div>
                <Label htmlFor="svc-currency">Currency</Label>
                <Input
                  id="svc-currency"
                  value={form.currency}
                  maxLength={3}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="svc-buffer-before">Buffer before (min)</Label>
                <Input
                  id="svc-buffer-before"
                  type="number"
                  min={0}
                  value={form.bufferBeforeMinutes}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      bufferBeforeMinutes: Number(e.target.value),
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="svc-buffer-after">Buffer after (min)</Label>
                <Input
                  id="svc-buffer-after"
                  type="number"
                  min={0}
                  value={form.bufferAfterMinutes}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      bufferAfterMinutes: Number(e.target.value),
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="svc-lead">Lead time (min)</Label>
                <Input
                  id="svc-lead"
                  type="number"
                  min={0}
                  value={form.minimumLeadTimeMinutes}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      minimumLeadTimeMinutes: Number(e.target.value),
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="svc-order">Display order</Label>
                <Input
                  id="svc-order"
                  type="number"
                  min={0}
                  value={form.displayOrder}
                  onChange={(e) => setForm((f) => ({ ...f, displayOrder: Number(e.target.value) }))}
                />
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <Switch
                  id="svc-active"
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
                />
                <Label htmlFor="svc-active">Active (visible in booking)</Label>
              </div>
            </div>

            <div>
              <Label>Assigned therapists</Label>
              <p className="mb-2 text-xs text-muted-foreground">
                Only assigned providers will be offered for this service in booking.
              </p>
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border/70 p-2">
                {therapists.length === 0 ? (
                  <p className="p-2 text-sm text-muted-foreground">No therapists yet.</p>
                ) : (
                  therapists.map((t) => {
                    const checked = form.therapistIds.includes(t.id);
                    return (
                      <label
                        key={t.id}
                        className="flex cursor-pointer items-center gap-2 rounded p-1.5 hover:bg-muted"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              therapistIds: e.target.checked
                                ? [...f.therapistIds, t.id]
                                : f.therapistIds.filter((id) => id !== t.id),
                            }))
                          }
                        />
                        <span className="text-sm">
                          {t.fullName}
                          {t.roleTitle ? (
                            <span className="ml-2 text-xs text-muted-foreground">
                              {t.roleTitle}
                            </span>
                          ) : null}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {form.id ? "Save changes" : "Create service"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <SensitiveActionDialog
        state={stepUp.dialogState}
        onConfirm={stepUp.confirmStepUp}
        onOpenChange={(open) => {
          if (!open) stepUp.cancelStepUp();
        }}
      />
    </AdminWorkspaceShell>
  );
}
