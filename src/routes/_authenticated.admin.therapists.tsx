import { useEffect, useMemo, useState } from "react";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUp,
  Loader2,
  Mail,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";

import { AdminWorkspaceShell } from "@/components/progress/AdminSidebar";
import { AdminCardGridSkeleton } from "@/components/admin/AdminSkeletons";
import { SensitiveActionDialog } from "@/components/admin/SensitiveActionDialog";
import { MediaUploadInput } from "@/components/admin/MediaUploadInput";
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
import { hasBrowserRole } from "@/lib/auth";
import { canonicalUrl } from "@/lib/seo";
import { useSensitiveActionGate } from "@/hooks/useSensitiveActionGate";
import {
  createAvailabilityRule,
  createTherapist,
  deleteAvailabilityRule,
  deleteTherapist,
  linkTherapistLogin,
  listAdminTherapists,
  listTherapistAvailability,
  reorderTherapists,
  resendTherapistInvitation,
  setTherapistActive,
  updateAvailabilityRule,
  updateTherapist,
  type AdminTherapistRow,
  type TherapistAvailabilityRule,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/therapists")({
  loader: async () => {
    try {
      return await listAdminTherapists();
    } catch {
      throw redirect({ href: "/account?error=forbidden" });
    }
  },
  head: () => ({
    meta: [
      { title: "Therapists | Talk Space Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: canonicalUrl("/admin/therapists") }],
  }),
  errorComponent: ({ error }) => (
    <AdminWorkspaceShell>
      <main className="p-8 text-sm text-destructive">
        {error instanceof Error ? error.message : "Failed to load therapists."}
      </main>
    </AdminWorkspaceShell>
  ),
  component: TherapistsAdminRoute,
});

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MODES = [
  { value: "online", label: "Online" },
  { value: "in_person", label: "In person" },
  { value: "phone", label: "Phone" },
] as const;
type Mode = (typeof MODES)[number]["value"];

function NativeSwitch({
  checked,
  disabled,
  id,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  disabled?: boolean;
  id?: string;
  onChange: () => void;
  ariaLabel?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onChange}
      className={`inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-primary" : "bg-input"
      }`}
    >
      <span
        aria-hidden
        className={`block h-4 w-4 rounded-full bg-background shadow-lg transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function TherapistsAdminRoute() {
  const initial = Route.useLoaderData();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [rows, setRows] = useState<AdminTherapistRow[]>(initial);
  const [query, setQuery] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminTherapistRow | null>(null);
  const [availabilityFor, setAvailabilityFor] = useState<AdminTherapistRow | null>(null);
  const [loginFor, setLoginFor] = useState<AdminTherapistRow | null>(null);
  const [reordering, setReordering] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const stepUp = useSensitiveActionGate();
  const router = useRouter();

  useEffect(() => {
    let active = true;
    void hasBrowserRole("admin").then((ok) => active && setAuthorized(ok));
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.fullName.toLowerCase().includes(q) ||
        (r.roleTitle?.toLowerCase().includes(q) ?? false) ||
        (r.location?.toLowerCase().includes(q) ?? false) ||
        r.specialties.some((s) => s.toLowerCase().includes(q)),
    );
  }, [rows, query]);

  const toggle = async (row: AdminTherapistRow) => {
    setSavingId(row.id);
    try {
      await setTherapistActive({
        data: { id: row.id, isActive: !row.isActive },
      });
      setRows((all) => all.map((r) => (r.id === row.id ? { ...r, isActive: !r.isActive } : r)));
      toast.success(row.isActive ? "Therapist hidden from booking." : "Therapist activated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setSavingId(null);
    }
  };

  const move = async (id: string, dir: -1 | 1) => {
    const sorted = [...rows].sort(
      (a, b) => a.displayOrder - b.displayOrder || a.fullName.localeCompare(b.fullName),
    );
    const idx = sorted.findIndex((r) => r.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= sorted.length) return;
    [sorted[idx], sorted[target]] = [sorted[target], sorted[idx]];
    const next = sorted.map((r, i) => ({ ...r, displayOrder: i + 1 }));
    setRows(next);
    setReordering(true);
    try {
      await reorderTherapists({
        data: {
          order: next.map((r) => ({ id: r.id, displayOrder: r.displayOrder })),
        },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reorder failed.");
      setRows(initial);
    } finally {
      setReordering(false);
    }
  };

  const addTherapist = async () => {
    const name = newName.trim();
    if (!name) {
      toast.error("Enter the therapist's full name.");
      return;
    }
    setCreating(true);
    try {
      const row = await createTherapist({ data: { fullName: name } });
      setRows((all) => [...all, row]);
      setNewName("");
      setAddOpen(false);
      setEditing(row);
      toast.success("Therapist added. Finish the profile, then switch it on.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add therapist.");
    } finally {
      setCreating(false);
    }
  };

  const applyPatch = (id: string, patch: Partial<AdminTherapistRow>) =>
    setRows((all) => all.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  if (authorized === null)
    return (
      <AdminWorkspaceShell>
        <main className="min-h-screen bg-surface-page py-8 sm:py-10">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <AdminCardGridSkeleton count={6} />
          </div>
        </main>
      </AdminWorkspaceShell>
    );
  if (!authorized)
    return (
      <AdminWorkspaceShell>
        <main className="mx-auto max-w-2xl px-4 py-24 text-center">
          <h1 className="display-1 text-brand-deep">Permission required</h1>
        </main>
      </AdminWorkspaceShell>
    );

  const sortedRows = [...filtered].sort(
    (a, b) => a.displayOrder - b.displayOrder || a.fullName.localeCompare(b.fullName),
  );

  const removeTherapist = async (therapist: AdminTherapistRow) => {
    if (!confirm(`Delete ${therapist.fullName}? This cannot be undone.`)) return;
    const stepUpAllowed = await stepUp.requestStepUp(`delete therapist ${therapist.fullName}`);
    if (!stepUpAllowed) return;
    setDeletingId(therapist.id);
    try {
      const result = await deleteTherapist({ data: { id: therapist.id } });
      setRows((current) => current.filter((row) => row.id !== therapist.id));
      toast.success(
        result.archived
          ? "Therapist hidden to preserve appointment history."
          : "Therapist deleted.",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AdminWorkspaceShell>
      <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        <header>
          <p className="eyebrow">Admin · Operations</p>
          <h1 className="display-1 mt-3 text-brand-deep">Therapists</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Edit profiles, availability, and public ordering. Inactive therapists disappear from
            public listings and booking, but appointment history is preserved.
          </p>
        </header>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Add therapist
          </Button>
        </div>

        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, role, specialty…"
            className="pl-9"
          />
        </div>

        {sortedRows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 p-12 text-center text-muted-foreground">
            No therapists match your search.
          </div>
        ) : (
          <section className="space-y-3">
            {sortedRows.map((t, idx) => (
              <article key={t.id} className="rounded-2xl border border-border/70 bg-card p-5">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="flex flex-col items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={idx === 0 || reordering || query.length > 0}
                      onClick={() => move(t.id, -1)}
                      aria-label="Move up"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <span className="text-[10px] tabular-nums text-muted-foreground">
                      {t.displayOrder || idx + 1}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={idx === sortedRows.length - 1 || reordering || query.length > 0}
                      onClick={() => move(t.id, 1)}
                      aria-label="Move down"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-muted">
                    {t.imageUrl ? (
                      <img
                        src={t.imageUrl}
                        alt={t.fullName}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm font-semibold text-muted-foreground">
                        {t.fullName.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-brand-deep">{t.fullName}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.roleTitle ?? "—"}
                          {t.credentials ? ` · ${t.credentials}` : ""}
                        </p>
                        {t.location ? (
                          <p className="text-xs text-muted-foreground">{t.location}</p>
                        ) : null}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t.loginEmail ? `Login: ${t.loginEmail}` : "No therapist login linked"}
                        </p>
                      </div>
                      <span
                        className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                          t.isActive
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {t.isActive ? "Active" : "Hidden"}
                      </span>
                    </div>
                    {t.specialties.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {t.specialties.slice(0, 6).map((s) => (
                          <span
                            key={s}
                            className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3 text-xs">
                  <div className="flex items-center gap-2">
                    <NativeSwitch
                      checked={t.isActive}
                      disabled={savingId === t.id}
                      onChange={() => toggle(t)}
                      id={`t-${t.id}`}
                    />
                    <span className="text-muted-foreground">Show publicly</span>
                    {savingId === t.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setAvailabilityFor(t)}>
                      Availability
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setLoginFor(t)}>
                      {t.userId ? (
                        <UserCheck className="mr-1 h-3.5 w-3.5" />
                      ) : (
                        <Mail className="mr-1 h-3.5 w-3.5" />
                      )}
                      {t.userId ? "Login linked" : "Invite login"}
                    </Button>
                    <Button size="sm" onClick={() => setEditing(t)}>
                      <Pencil className="mr-1 h-3.5 w-3.5" /> Edit profile
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      disabled={deletingId === t.id}
                      onClick={() => void removeTherapist(t)}
                    >
                      {deletingId === t.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      Delete
                    </Button>
                    {t.slug ? (
                      <a
                        href={`/therapists#${t.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-blue-deep hover:underline"
                      >
                        View public
                      </a>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}

        {query.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Reordering is disabled while a search is active. Clear the search to drag order.
          </p>
        ) : null}
      </main>

      <Dialog open={addOpen} onOpenChange={(v) => !v && setAddOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add a therapist</DialogTitle>
            <DialogDescription>
              Start with the name. The profile opens next so you can add role, bio, photo and
              specialties. New therapists stay hidden until you switch them on.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="new-therapist-name">Full name</Label>
            <Input
              id="new-therapist-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Dr. Amaka Obi"
              onKeyDown={(e) => {
                if (e.key === "Enter") void addTherapist();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={() => void addTherapist()} disabled={creating}>
              {creating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Create profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editing ? (
        <EditProfileDialog
          therapist={editing}
          onClose={() => setEditing(null)}
          onSaved={(row) => {
            applyPatch(row.id, row);
            setEditing(null);
            void router.invalidate();
          }}
        />
      ) : null}

      {availabilityFor ? (
        <AvailabilityDialog
          therapist={availabilityFor}
          onClose={() => setAvailabilityFor(null)}
          stepUp={stepUp}
        />
      ) : null}

      {loginFor ? (
        <TherapistLoginDialog
          therapist={loginFor}
          onClose={() => setLoginFor(null)}
          onSaved={(row) => {
            applyPatch(row.id, row);
            setLoginFor(null);
            void router.invalidate();
          }}
        />
      ) : null}

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

function TherapistLoginDialog({
  therapist,
  onClose,
  onSaved,
}: {
  therapist: AdminTherapistRow;
  onClose: () => void;
  onSaved: (row: AdminTherapistRow) => void;
}) {
  const [email, setEmail] = useState(therapist.loginEmail ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const nextEmail = email.trim().toLowerCase();
    if (!nextEmail) {
      toast.error("Enter the therapist's email address.");
      return;
    }
    setSaving(true);
    try {
      const row = await linkTherapistLogin({
        data: { therapistId: therapist.id, email: nextEmail },
      });
      toast.success(
        row.invitationSent
          ? "Therapist login linked and invitation email sent."
          : "Therapist login linked.",
      );
      onSaved(row);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not link therapist login.");
    } finally {
      setSaving(false);
    }
  };

  const resend = async () => {
    setSaving(true);
    try {
      const result = await resendTherapistInvitation({ data: { therapistId: therapist.id } });
      toast.success(`A new invitation was sent to ${result.email}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not resend the invitation.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Therapist login</DialogTitle>
          <DialogDescription>
            Link {therapist.fullName} to a secure account. They will sign in with this email and
            open /therapist to view assigned sessions and connect Google Calendar.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="therapist-login-email">Email address</Label>
          <Input
            id="therapist-login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="therapist@example.com"
            onKeyDown={(e) => {
              if (e.key === "Enter") void save();
            }}
          />
          {therapist.loginEmail ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Currently linked to {therapist.loginEmail}.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => void resend()}
                disabled={saving}
              >
                <Mail className="mr-1 h-4 w-4" />
                Resend invitation
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              If the account does not exist yet, Supabase will send an invitation email.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Link login
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ----------------------------------------------------------------------------
// Profile edit dialog
// ----------------------------------------------------------------------------

function EditProfileDialog({
  therapist,
  onClose,
  onSaved,
}: {
  therapist: AdminTherapistRow;
  onClose: () => void;
  onSaved: (row: AdminTherapistRow) => void;
}) {
  const [fullName, setFullName] = useState(therapist.fullName);
  const [slug, setSlug] = useState(therapist.slug ?? "");
  const [roleTitle, setRoleTitle] = useState(therapist.roleTitle ?? "");
  const [credentials, setCredentials] = useState(therapist.credentials ?? "");
  const [location, setLocation] = useState(therapist.location ?? "");
  const [imageUrl, setImageUrl] = useState(therapist.imageUrl ?? "");
  const [bio, setBio] = useState(therapist.bio ?? "");
  const [specialtyList, setSpecialtyList] = useState<string[]>(therapist.specialties);
  const [specialtyDraft, setSpecialtyDraft] = useState("");
  const [modalities, setModalities] = useState<Mode[]>(therapist.modalities as Mode[]);
  const [saving, setSaving] = useState(false);

  const toggleModality = (m: Mode) =>
    setModalities((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]));

  const addSpecialties = (raw: string) => {
    const parts = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    setSpecialtyList((cur) => Array.from(new Set([...cur, ...parts])));
    setSpecialtyDraft("");
  };

  const save = async () => {
    const nextSlug = slug.trim().toLowerCase();
    if (nextSlug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(nextSlug)) {
      toast.error("Public link can only use lowercase letters, numbers and hyphens.");
      return;
    }
    setSaving(true);
    try {
      const row = await updateTherapist({
        data: {
          id: therapist.id,
          fullName: fullName.trim() || therapist.fullName,
          ...(nextSlug && nextSlug !== therapist.slug ? { slug: nextSlug } : {}),
          roleTitle: roleTitle.trim() || therapist.roleTitle || "Therapist",
          credentials: credentials.trim() || null,
          location: location.trim() || null,
          imageUrl: imageUrl.trim() || null,
          bio: bio.trim() || null,
          specialties: Array.from(
            new Set([
              ...specialtyList,
              ...specialtyDraft
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            ]),
          ),
          modalities,
        },
      });
      toast.success("Profile updated.");
      onSaved(row);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit therapist profile</DialogTitle>
          <DialogDescription>
            Public fields shown on /therapists and the booking flow.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name">
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </Field>
          <Field label="Role title">
            <Input
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              placeholder="Clinical Psychologist"
            />
          </Field>
          <Field label="Credentials">
            <Input
              value={credentials}
              onChange={(e) => setCredentials(e.target.value)}
              placeholder="PhD, MSc"
            />
          </Field>
          <Field label="Location">
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Lagos, NG"
            />
          </Field>
          <Field label="Public link (slug)" full>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="amaka-obi" />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Used on /therapists#{slug || "slug"} — lowercase letters, numbers and hyphens.
            </p>
          </Field>
          <Field label="Portrait" full>
            <MediaUploadInput
              label=""
              value={imageUrl}
              onChange={setImageUrl}
              folder="therapists"
              returnAs="signedUrl"
              placeholder="Paste an image URL or upload a portrait"
              helpText="Uploads are stored securely; a long-lived signed URL is saved to the therapist profile."
            />
          </Field>

          <Field label="Bio" full>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={5}
              placeholder="Short professional bio (max 4000 chars)."
            />
          </Field>
          <Field label="Specialties" full>
            <div className="space-y-2">
              {specialtyList.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {specialtyList.map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      {s}
                      <button
                        type="button"
                        aria-label={`Remove ${s}`}
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setSpecialtyList((cur) => cur.filter((x) => x !== s))}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="flex gap-2">
                <Input
                  value={specialtyDraft}
                  onChange={(e) => setSpecialtyDraft(e.target.value)}
                  placeholder="Anxiety, Depression, Couples"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSpecialties(specialtyDraft);
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => addSpecialties(specialtyDraft)}
                >
                  Add
                </Button>
              </div>
            </div>
          </Field>

          <Field label="Session modes" full>
            <div className="flex flex-wrap gap-3 pt-1">
              {MODES.map((m) => (
                <label key={m.value} className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={modalities.includes(m.value)}
                    onChange={() => toggleModality(m.value)}
                  />
                  {m.label}
                </label>
              ))}
            </div>
          </Field>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Availability dialog
// ----------------------------------------------------------------------------

function AvailabilityDialog({
  therapist,
  onClose,
  stepUp,
}: {
  therapist: AdminTherapistRow;
  onClose: () => void;
  stepUp: ReturnType<typeof useSensitiveActionGate>;
}) {
  const [rules, setRules] = useState<TherapistAvailabilityRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startsAt, setStartsAt] = useState("09:00");
  const [endsAt, setEndsAt] = useState("17:00");
  const [mode, setMode] = useState<Mode>("online");

  useEffect(() => {
    let active = true;
    setLoading(true);
    void listTherapistAvailability({ data: { therapistId: therapist.id } })
      .then((data) => active && setRules(data))
      .catch((err) => toast.error(err instanceof Error ? err.message : "Load failed."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [therapist.id]);

  const add = async () => {
    if (endsAt <= startsAt) {
      toast.error("End must be after start.");
      return;
    }
    setPending(true);
    try {
      const row = await createAvailabilityRule({
        data: {
          therapistId: therapist.id,
          dayOfWeek,
          startsAt,
          endsAt,
          mode,
          timezone: "Africa/Lagos",
          isActive: true,
        },
      });
      setRules((cur) =>
        [...cur, row].sort(
          (a, b) => a.dayOfWeek - b.dayOfWeek || a.startsAt.localeCompare(b.startsAt),
        ),
      );
      toast.success("Rule added.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Add failed.");
    } finally {
      setPending(false);
    }
  };

  const toggle = async (rule: TherapistAvailabilityRule) => {
    try {
      const updated = await updateAvailabilityRule({
        data: { id: rule.id, isActive: !rule.isActive },
      });
      setRules((cur) => cur.map((r) => (r.id === rule.id ? updated : r)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed.");
    }
  };

  const remove = async (rule: TherapistAvailabilityRule) => {
    if (!confirm(`Delete ${DAYS[rule.dayOfWeek]} ${rule.startsAt}–${rule.endsAt}?`)) return;
    const stepUpAllowed = await stepUp.requestStepUp("delete an availability rule");
    if (!stepUpAllowed) return;
    try {
      await deleteAvailabilityRule({ data: { id: rule.id } });
      setRules((cur) => cur.filter((r) => r.id !== rule.id));
      toast.success("Rule removed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Weekly availability · {therapist.fullName}</DialogTitle>
          <DialogDescription>
            Recurring windows in Africa/Lagos. The booking engine slices these into 15-minute slots
            and skips buffers, holds, and confirmed appointments.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border/70 bg-muted/30 p-4">
          <p className="mb-3 text-sm font-medium">Add a rule</p>
          <div className="grid gap-3 sm:grid-cols-5">
            <div>
              <Label className="text-xs">Day</Label>
              <select
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                value={String(dayOfWeek)}
                onChange={(event) => setDayOfWeek(Number(event.target.value))}
              >
                {DAYS.map((d, i) => (
                  <option key={d} value={String(i)}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Start</Label>
              <Input
                type="time"
                className="mt-1"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">End</Label>
              <Input
                type="time"
                className="mt-1"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Mode</Label>
              <select
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                value={mode}
                onChange={(event) => setMode(event.target.value as Mode)}
              >
                {MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button onClick={add} disabled={pending} className="w-full">
                {pending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-1 h-4 w-4" />
                )}
                Add
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading rules…
            </div>
          ) : rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No availability rules yet. This therapist won't show any slots.
            </p>
          ) : (
            rules.map((rule) => (
              <div
                key={rule.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/70 bg-card px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="w-10 font-semibold text-brand-deep">{DAYS[rule.dayOfWeek]}</span>
                  <span className="tabular-nums">
                    {rule.startsAt.slice(0, 5)} – {rule.endsAt.slice(0, 5)}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] capitalize text-muted-foreground">
                    {rule.mode.replace("_", " ")}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <NativeSwitch
                      checked={rule.isActive}
                      onChange={() => toggle(rule)}
                      ariaLabel="Toggle availability rule"
                    />
                    {rule.isActive ? "Active" : "Paused"}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => remove(rule)}
                    aria-label="Delete rule"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
