import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, DatabaseBackup, Download, Loader2, ShieldAlert, Wrench } from "lucide-react";
import { toast } from "sonner";

import { AdminWorkspaceShell } from "@/components/progress/AdminSidebar";
import { SensitiveActionDialog } from "@/components/admin/SensitiveActionDialog";
import { Button } from "@/components/ui/button";
import { useSensitiveActionGate } from "@/hooks/useSensitiveActionGate";
import {
  createAdminSiteBackup,
  getAdminBackupDownloadUrl,
  listAdminBackups,
  restoreAdminSiteBackup,
  validateAdminBackup,
} from "@/lib/site-backup.functions";
import { canonicalUrl } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/admin/backups")({
  loader: () => listAdminBackups(),
  head: () => ({
    meta: [
      { title: "Backups & restore | Talk Space Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: canonicalUrl("/admin/backups") }],
  }),
  component: BackupsRoute,
});

type Backup = Awaited<ReturnType<typeof listAdminBackups>>[number];

const dateTime = new Intl.DateTimeFormat("en-NG", {
  timeZone: "Africa/Lagos",
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDate(value: string | null) {
  if (!value) return "—";
  try {
    return dateTime.format(new Date(value));
  } catch {
    return value;
  }
}

function BackupsRoute() {
  const initial = Route.useLoaderData();
  const [backups, setBackups] = useState<Backup[]>(initial);
  const [label, setLabel] = useState(`Admin backup ${new Date().toISOString().slice(0, 10)}`);
  const [busy, setBusy] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null);
  const stepUp = useSensitiveActionGate();

  const refresh = async () => setBackups(await listAdminBackups());

  const createBackup = async () => {
    const allowed = await stepUp.requestStepUp("create an encrypted site backup");
    if (!allowed) return;
    setBusy("create");
    try {
      await createAdminSiteBackup({ data: { label } });
      toast.success("Encrypted backup created.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Backup creation failed.");
    } finally {
      setBusy(null);
    }
  };

  const download = async (backup: Backup) => {
    setBusy(backup.id);
    try {
      const result = await getAdminBackupDownloadUrl({ data: { backupId: backup.id } });
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Download failed.");
    } finally {
      setBusy(null);
    }
  };

  const validate = async (backup: Backup) => {
    setBusy(backup.id);
    try {
      const result = await validateAdminBackup({ data: { backupId: backup.id } });
      toast.success(`Backup validated (${result.tableCount} data groups).`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Validation failed.");
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    if (!restoreTarget) return;
    const target = restoreTarget;
    setRestoreTarget(null);
    const allowed = await stepUp.requestStepUp("restore site content and configuration");
    if (!allowed) return;
    setBusy(target);
    try {
      await restoreAdminSiteBackup({
        data: { backupId: target, confirmation: "RESTORE SITE BACKUP" },
      });
      toast.success("Site content and configuration restored.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Restore failed.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <AdminWorkspaceShell>
      <main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        <header>
          <p className="eyebrow">Admin · Recovery</p>
          <h1 className="display-1 mt-3 text-brand-deep">Backups & restore</h1>
          <p className="mt-3 max-w-3xl text-muted-foreground">
            Create encrypted logical backups of the application, including recoverable operational
            records. Restore currently supports the public-site content/configuration profile. All
            times are shown in West African Time.
          </p>
        </header>

        <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <DatabaseBackup className="h-5 w-5 text-brand-mint" aria-hidden />
              <h2 className="text-lg font-semibold text-brand-deep">Create an encrypted backup</h2>
            </div>
            <label className="mt-5 block text-sm font-medium text-brand-deep">
              Backup label
              <input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                maxLength={120}
                className="mt-1.5 h-11 w-full rounded-lg border border-input bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-brand-mint"
              />
            </label>
            <Button
              className="mt-5"
              onClick={() => void createBackup()}
              disabled={busy !== null || !label.trim()}
            >
              {busy === "create" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <DatabaseBackup className="mr-2 h-4 w-4" />
              )}
              Create backup
            </Button>
          </div>

          <div className="rounded-2xl border border-amber-300/70 bg-amber-50/70 p-6 text-sm text-amber-950">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldAlert className="h-4 w-4" aria-hidden /> Recovery scope
            </div>
            <p className="mt-2">
              Archives are private and encrypted. They exclude auth identities, secrets, provider
              tokens, payment secrets, and `.env` values.
            </p>
            <p className="mt-2">
              The archive includes clients, appointments, payments, availability, audit/events, and
              other recoverable application records. Restore currently replaces public
              content/configuration records only; it does not restore Auth users or Supabase
              physical database state.
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-border/70 bg-card shadow-sm">
          <header className="border-b border-border/60 p-5">
            <h2 className="text-lg font-semibold text-brand-deep">Backup catalog</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The catalog stores metadata only; archive bytes remain in private storage.
            </p>
          </header>
          {backups.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3">Backup</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Created</th>
                    <th className="px-5 py-3">Scope</th>
                    <th className="px-5 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {backups.map((backup) => {
                    const tableCounts = (backup.manifest?.tableCounts ?? {}) as Record<
                      string,
                      number
                    >;
                    const totalRows = Object.values(tableCounts).reduce(
                      (sum, count) => sum + Number(count || 0),
                      0,
                    );
                    return (
                      <tr key={backup.id} className="align-top">
                        <td className="px-5 py-4">
                          <div className="font-medium text-brand-deep">{backup.label}</div>
                          <div className="mt-1 font-mono text-xs text-muted-foreground">
                            {backup.id}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-1 rounded-full bg-brand-mint-soft px-2.5 py-1 text-xs font-semibold capitalize">
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                            {backup.status.replaceAll("_", " ")}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-muted-foreground">
                          {formatDate(backup.created_at)}
                        </td>
                        <td className="px-5 py-4 text-muted-foreground">
                          {totalRows} records · logical site backup
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy !== null || backup.status !== "completed"}
                              onClick={() => void download(backup)}
                            >
                              <Download className="mr-1.5 h-3.5 w-3.5" />
                              Download
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy !== null || backup.status !== "completed"}
                              onClick={() => void validate(backup)}
                            >
                              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                              Validate
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy !== null || backup.status !== "completed"}
                              onClick={() => setRestoreTarget(backup.id)}
                            >
                              <Wrench className="mr-1.5 h-3.5 w-3.5" />
                              Restore content
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-5 py-14 text-center text-sm text-muted-foreground">
              No backups have been created yet.
            </p>
          )}
        </section>

        {restoreTarget ? (
          <div
            className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="restore-title"
          >
            <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
              <h2 id="restore-title" className="text-lg font-semibold text-brand-deep">
                Restore site content?
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                This replaces site settings, pages, media metadata, FAQs, testimonials, and
                redirects. It does not restore operational records.
              </p>
              <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
                You will be asked for password step-up verification next.
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setRestoreTarget(null)}>
                  Cancel
                </Button>
                <Button onClick={() => void restore()}>Continue</Button>
              </div>
            </div>
          </div>
        ) : null}
        <SensitiveActionDialog
          state={stepUp.dialogState}
          onConfirm={stepUp.confirmStepUp}
          onOpenChange={(open) => {
            if (!open) stepUp.cancelStepUp();
          }}
        />
      </main>
    </AdminWorkspaceShell>
  );
}
