import { useCallback, useEffect, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Loader2,
  Plug,
  RefreshCw,
  RotateCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { AdminWorkspaceShell } from "@/components/progress/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { canonicalUrl } from "@/lib/seo";
import { startVisiblePolling } from "@/lib/visible-polling";
import {
  clearGoogleClientSecret,
  disconnectTherapistGoogle,
  getGoogleAdminSettings,
  listGoogleSyncActivity,
  listTherapistConnections,
  retryAppointmentSync,
  setGoogleClientSecretFn,
  startGoogleConnect,
  syncTherapistBusy,
  updateGoogleAdminSettings,
  type GoogleAdminSettings,
  type GoogleSyncActivityRow,
  type TherapistConnectionRow,
} from "@/lib/google.functions";

export const Route = createFileRoute("/_authenticated/admin/google")({
  loader: async () => {
    try {
      const [settings, connections] = await Promise.all([
        getGoogleAdminSettings(),
        listTherapistConnections(),
      ]);
      return { settings, connections };
    } catch {
      throw redirect({ href: "/account?error=forbidden" });
    }
  },
  head: () => ({
    meta: [
      { title: "Google Calendar | Talk Space Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: canonicalUrl("/admin/google") }],
  }),
  component: GoogleAdminPage,
});

function GoogleAdminPage() {
  const initial = Route.useLoaderData();
  const [settings, setSettings] = useState<GoogleAdminSettings>(initial.settings);
  const [connections, setConnections] = useState<TherapistConnectionRow[]>(initial.connections);
  const [savingSettings, setSavingSettings] = useState(false);
  const [secretValue, setSecretValue] = useState("");
  const [busyTherapist, setBusyTherapist] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [activity, setActivity] = useState<Record<string, GoogleSyncActivityRow[]>>({});
  const [loadingActivity, setLoadingActivity] = useState<string | null>(null);
  const [retryingAppt, setRetryingAppt] = useState<string | null>(null);

  const reload = async () => {
    const [s, c] = await Promise.all([getGoogleAdminSettings(), listTherapistConnections()]);
    setSettings(s);
    setConnections(c);
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      await updateGoogleAdminSettings({
        data: {
          isEnabled: settings.isEnabled,
          clientId: settings.clientId,
          scopes: settings.scopes,
        },
      });
      toast.success("Settings saved");
      await reload();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingSettings(false);
    }
  };

  const saveSecret = async () => {
    if (!secretValue.trim()) return;
    try {
      await setGoogleClientSecretFn({ data: { value: secretValue.trim() } });
      setSecretValue("");
      toast.success("Client secret saved");
      await reload();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const clearSecret = async () => {
    if (!confirm("Remove the saved Google client secret?")) return;
    try {
      await clearGoogleClientSecret();
      toast.success("Client secret cleared");
      await reload();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const connect = async (therapistId: string) => {
    setBusyTherapist(therapistId);
    try {
      const { authorizationUrl } = await startGoogleConnect({ data: { therapistId } });
      window.open(authorizationUrl, "google-connect", "width=560,height=720");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyTherapist(null);
    }
  };

  const disconnect = async (therapistId: string) => {
    if (!confirm("Disconnect this therapist's Google account?")) return;
    setBusyTherapist(therapistId);
    try {
      await disconnectTherapistGoogle({ data: { therapistId } });
      toast.success("Disconnected");
      await reload();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyTherapist(null);
    }
  };

  const sync = async (therapistId: string) => {
    setBusyTherapist(therapistId);
    try {
      const res = await syncTherapistBusy({ data: { therapistId } });
      toast.success(`Synced ${res.count} busy blocks`);
      await reload();
      if (expanded === therapistId) await loadActivity(therapistId);
    } catch (err) {
      toast.error((err as Error).message);
      try {
        await reload();
      } catch {
        // Keep the original sync error visible if the status refresh also fails.
      }
    } finally {
      setBusyTherapist(null);
    }
  };

  const loadActivity = useCallback(async (therapistId: string) => {
    setLoadingActivity(therapistId);
    try {
      const rows = await listGoogleSyncActivity({ data: { therapistId, limit: 15 } });
      setActivity((prev) => ({ ...prev, [therapistId]: rows }));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoadingActivity(null);
    }
  }, []);

  const toggleExpanded = async (therapistId: string) => {
    if (expanded === therapistId) {
      setExpanded(null);
      return;
    }
    setExpanded(therapistId);
    if (!activity[therapistId]) await loadActivity(therapistId);
  };

  const retryOne = async (therapistId: string, appointmentId: string) => {
    setRetryingAppt(appointmentId);
    try {
      const res = await retryAppointmentSync({ data: { appointmentId } });
      if (res.ok) toast.success("Sync succeeded");
      else toast.error(`Sync still failing: ${res.error ?? "unknown error"}`);
      await loadActivity(therapistId);
      await reload();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setRetryingAppt(null);
    }
  };

  // Only refresh visible activity, waiting for each request to finish.
  useEffect(() => {
    if (!expanded) return;
    return startVisiblePolling(() => loadActivity(expanded), 30_000);
  }, [expanded, loadActivity]);

  const copyRedirect = async () => {
    await navigator.clipboard.writeText(settings.redirectUri);
    toast.success("Redirect URI copied");
  };

  return (
    <AdminWorkspaceShell>
      <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 lg:px-10">
        <header className="flex items-center gap-3">
          <CalendarCheck className="h-6 w-6 text-brand-deep" />
          <div>
            <h1 className="text-2xl font-semibold text-brand-deep">Google Calendar & Meet</h1>
            <p className="text-sm text-muted-foreground">
              Configure the Google OAuth client and connect each therapist's calendar.
            </p>
          </div>
        </header>

        <section className="rounded-2xl border border-border/70 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-brand-deep">OAuth client</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a Google Cloud OAuth Web client and add this redirect URI:
          </p>
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-dashed border-border/70 bg-brand-mint/10 p-3 text-sm">
            <code className="flex-1 break-all font-mono text-xs text-brand-deep">
              {settings.redirectUri}
            </code>
            <Button type="button" size="sm" variant="outline" onClick={copyRedirect}>
              <Copy className="mr-1 h-3.5 w-3.5" /> Copy
            </Button>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="client_id">Client ID</Label>
              <Input
                id="client_id"
                value={settings.clientId ?? ""}
                onChange={(e) => setSettings((s) => ({ ...s, clientId: e.target.value }))}
                placeholder="xxxxx.apps.googleusercontent.com"
              />
            </div>
            <div>
              <Label htmlFor="scopes">Scopes</Label>
              <Input
                id="scopes"
                value={settings.scopes}
                onChange={(e) => setSettings((s) => ({ ...s, scopes: e.target.value }))}
              />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <Switch
              id="enabled"
              checked={settings.isEnabled}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, isEnabled: v }))}
            />
            <Label htmlFor="enabled">Enable Google integration</Label>
            <Button
              type="button"
              className="ml-auto"
              onClick={saveSettings}
              disabled={savingSettings}
            >
              {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save settings"}
            </Button>
          </div>

          <div className="mt-6 border-t border-border/60 pt-4">
            <Label>Client secret</Label>
            <p className="text-xs text-muted-foreground">
              {settings.hasClientSecret ? "A secret is saved (encrypted)." : "No secret saved yet."}
            </p>
            <div className="mt-2 flex gap-2">
              <Input
                type="password"
                value={secretValue}
                onChange={(e) => setSecretValue(e.target.value)}
                placeholder="Paste new client secret"
              />
              <Button type="button" onClick={saveSecret} disabled={!secretValue.trim()}>
                Save
              </Button>
              {settings.hasClientSecret ? (
                <Button type="button" variant="outline" onClick={clearSecret}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border/70 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-brand-deep">Therapist connections</h2>
            <Button type="button" variant="outline" size="sm" onClick={reload}>
              <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh
            </Button>
          </div>
          <div className="mt-4 divide-y divide-border/60">
            {connections.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">No therapists found.</p>
            ) : (
              connections.map((c) => {
                const isOpen = expanded === c.therapistId;
                const rows = activity[c.therapistId];
                const hasFailures = c.failingAppointmentCount > 0 || Boolean(c.lastSyncError);
                const needsReconnect = !c.connected && Boolean(c.googleEmail || c.lastSyncError);
                return (
                  <div key={c.therapistId} className="py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-brand-deep">{c.therapistName || "—"}</p>
                          {c.connected ? (
                            hasFailures ? (
                              <Badge variant="destructive" className="gap-1">
                                <AlertTriangle className="h-3 w-3" /> Attention
                              </Badge>
                            ) : (
                              <Badge className="gap-1 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                                <CheckCircle2 className="h-3 w-3" /> Healthy
                              </Badge>
                            )
                          ) : needsReconnect ? (
                            <Badge variant="destructive" className="gap-1">
                              <AlertTriangle className="h-3 w-3" /> Reconnect required
                            </Badge>
                          ) : (
                            <Badge variant="outline">Not connected</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {c.connected
                            ? `Connected as ${c.googleEmail ?? "unknown"}${
                                c.lastSyncAt
                                  ? ` · last busy sync ${new Date(c.lastSyncAt).toLocaleString()}`
                                  : ""
                              }${
                                c.watchExpiresAt
                                  ? ` · push channel until ${new Date(c.watchExpiresAt).toLocaleString()}`
                                  : ""
                              }`
                            : needsReconnect
                              ? `Previously connected${c.googleEmail ? ` as ${c.googleEmail}` : ""}`
                              : "Awaiting first connection"}
                        </p>
                        {c.lastSyncError ? (
                          <p className="text-xs text-red-600">
                            Last busy sync error: {c.lastSyncError}
                          </p>
                        ) : null}
                        {c.failingAppointmentCount > 0 ? (
                          <p className="text-xs text-red-600">
                            {c.failingAppointmentCount} appointment
                            {c.failingAppointmentCount === 1 ? "" : "s"} failing to sync
                          </p>
                        ) : null}
                      </div>
                      {c.connected ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => toggleExpanded(c.therapistId)}
                          >
                            {isOpen ? (
                              <ChevronUp className="mr-1 h-3.5 w-3.5" />
                            ) : (
                              <ChevronDown className="mr-1 h-3.5 w-3.5" />
                            )}
                            Activity
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => sync(c.therapistId)}
                            disabled={busyTherapist === c.therapistId}
                          >
                            {busyTherapist === c.therapistId ? (
                              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="mr-1 h-3.5 w-3.5" />
                            )}
                            Sync busy
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => disconnect(c.therapistId)}
                            disabled={busyTherapist === c.therapistId}
                          >
                            Disconnect
                          </Button>
                        </>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => connect(c.therapistId)}
                          disabled={
                            busyTherapist === c.therapistId ||
                            !settings.isEnabled ||
                            !settings.hasClientSecret ||
                            !settings.clientId
                          }
                        >
                          {busyTherapist === c.therapistId ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Plug className="mr-1 h-3.5 w-3.5" />
                          )}
                          {needsReconnect ? "Reconnect Google" : "Connect Google"}
                        </Button>
                      )}
                    </div>
                    {isOpen ? (
                      <div className="mt-3 rounded-lg border border-border/60 bg-muted/30 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Recent appointment syncs
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => loadActivity(c.therapistId)}
                            disabled={loadingActivity === c.therapistId}
                          >
                            {loadingActivity === c.therapistId ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                        {loadingActivity === c.therapistId && !rows ? (
                          <p className="py-3 text-xs text-muted-foreground">Loading…</p>
                        ) : !rows || rows.length === 0 ? (
                          <p className="py-3 text-xs text-muted-foreground">
                            No calendar events have synced yet.
                          </p>
                        ) : (
                          <ul className="divide-y divide-border/60">
                            {rows.map((row) => {
                              const failed = Boolean(row.googleSyncError);
                              return (
                                <li
                                  key={row.appointmentId}
                                  className="flex flex-wrap items-start gap-3 py-2 text-xs"
                                >
                                  <span className="mt-0.5">
                                    {failed ? (
                                      <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                                    ) : (
                                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                    )}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium text-brand-deep">
                                      {row.bookingReference} · {row.clientName || "—"}
                                    </p>
                                    <p className="text-muted-foreground">
                                      {new Date(row.startsAt).toLocaleString()} · status{" "}
                                      {row.status}
                                      {row.googleSyncedAt
                                        ? ` · ${failed ? "failed" : "synced"} ${new Date(
                                            row.googleSyncedAt,
                                          ).toLocaleString()}`
                                        : ""}
                                    </p>
                                    {failed ? (
                                      <p className="mt-0.5 break-words text-red-600">
                                        {row.googleSyncError}
                                      </p>
                                    ) : row.googleMeetUrl ? (
                                      <a
                                        href={row.googleMeetUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-brand-deep underline"
                                      >
                                        Meet link
                                      </a>
                                    ) : null}
                                  </div>
                                  {failed ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => retryOne(c.therapistId, row.appointmentId)}
                                      disabled={retryingAppt === row.appointmentId}
                                    >
                                      {retryingAppt === row.appointmentId ? (
                                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <RotateCw className="mr-1 h-3.5 w-3.5" />
                                      )}
                                      Retry
                                    </Button>
                                  ) : null}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </AdminWorkspaceShell>
  );
}
