import { useCallback, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  BookOpenCheck,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  Mail,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  ShieldCheck,
  Siren,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { AdminWorkspaceShell } from "@/components/progress/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { canonicalUrl } from "@/lib/seo";
import {
  clearEmailApiKey,
  deleteEmailDeliveryLog,
  getEmailAdminData,
  getReminderSettings,
  listEmailDeliveryLogs,
  previewEmailTemplate,
  retryEmailDeliveryLog,
  sendTestEmail,
  setEmailApiKey,
  updateReminderSettings,
  updateEmailSettings,
  updateEmailTemplate,
  type EmailLogRow,
  type EmailSettingsDTO,
  type EmailTemplateDTO,
  type PreviewTemplateKey,
  type ReminderSettingsDTO,
} from "@/lib/email.functions";

export const Route = createFileRoute("/_authenticated/admin/emails")({
  loader: async () => {
    try {
      const [admin, logs, reminder] = await Promise.all([
        getEmailAdminData(),
        listEmailDeliveryLogs(),
        getReminderSettings(),
      ]);
      return { ...admin, logs, reminder };
    } catch {
      throw redirect({ href: "/account?error=forbidden" });
    }
  },
  head: () => ({
    meta: [
      { title: "Emails | Talk Space Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: canonicalUrl("/admin/emails") }],
  }),
  component: EmailsAdminRoute,
});

function EmailsAdminRoute() {
  const loaderData = Route.useLoaderData();
  return (
    <AdminWorkspaceShell>
      <EmailAdminScreen
        initialSettings={loaderData.settings}
        initialTemplates={loaderData.templates}
        initialLogs={loaderData.logs}
        initialReminder={loaderData.reminder}
      />
    </AdminWorkspaceShell>
  );
}

function EmailAdminScreen({
  initialSettings,
  initialTemplates,
  initialLogs,
  initialReminder,
}: {
  initialSettings: EmailSettingsDTO;
  initialTemplates: EmailTemplateDTO[];
  initialLogs: EmailLogRow[];
  initialReminder: ReminderSettingsDTO;
}) {
  const [settings, setSettings] = useState<EmailSettingsDTO>(initialSettings);
  const [templates, setTemplates] = useState<EmailTemplateDTO[]>(initialTemplates);
  const [logs, setLogs] = useState<EmailLogRow[]>(initialLogs);
  const [reminder, setReminder] = useState<ReminderSettingsDTO>(initialReminder);
  const [savingReminder, setSavingReminder] = useState(false);
  const [refreshingLogs, setRefreshingLogs] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [apiKeyInput, setApiKeyInputValue] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [testAddress, setTestAddress] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [preview, setPreview] = useState<{
    templateKey: PreviewTemplateKey;
    subject: string;
    defaultSubject: string;
    overrideSubject: string | null;
    html: string;
    displayName: string;
  } | null>(null);
  const [previewLoadingKey, setPreviewLoadingKey] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [templatePage, setTemplatePage] = useState(1);
  const templatesPerPage = 4;
  const templatePageCount = Math.max(1, Math.ceil(templates.length / templatesPerPage));
  const currentTemplatePage = Math.min(templatePage, templatePageCount);
  const visibleTemplates = templates.slice(
    (currentTemplatePage - 1) * templatesPerPage,
    currentTemplatePage * templatesPerPage,
  );
  const senderMatchesInbox =
    (settings.fromEmail ?? "").trim().toLowerCase() !== "" &&
    settings.fromEmail?.trim().toLowerCase() === settings.contactInbox?.trim().toLowerCase();

  const onPreview = async (t: EmailTemplateDTO) => {
    setPreviewLoadingKey(t.templateKey);
    try {
      const res = await previewEmailTemplate({
        data: { templateKey: t.templateKey as PreviewTemplateKey },
      });
      setPreview({ ...res, displayName: t.displayName });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Preview failed.");
    } finally {
      setPreviewLoadingKey(null);
    }
  };

  const refreshLogs = useCallback(async () => {
    setRefreshingLogs(true);
    try {
      const next = await listEmailDeliveryLogs();
      setLogs(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to refresh logs.");
    } finally {
      setRefreshingLogs(false);
    }
  }, []);

  const onSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await updateEmailSettings({
        data: {
          provider: "resend",
          senderDomain: settings.senderDomain,
          fromName: settings.fromName,
          fromEmail: settings.fromEmail,
          replyTo: settings.replyTo,
          contactInbox: settings.contactInbox,
          zohoRoutingEnabled: settings.zohoRoutingEnabled,
          isEnabled: settings.isEnabled,
        },
      });
      toast.success("Email settings saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSavingSettings(false);
    }
  };

  const onSaveKey = async () => {
    if (apiKeyInput.trim().length < 10) {
      toast.error("Paste a valid API key.");
      return;
    }
    setSavingKey(true);
    try {
      const res = await setEmailApiKey({ data: { apiKey: apiKeyInput.trim() } });
      setSettings((s) => ({ ...s, hasApiKey: true, apiKeyLast4: res.last4 }));
      setApiKeyInputValue("");
      toast.success("API key saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSavingKey(false);
    }
  };

  const onClearKey = async () => {
    if (!confirm("Remove the stored API key?")) return;
    try {
      await clearEmailApiKey();
      setSettings((s) => ({ ...s, hasApiKey: false, apiKeyLast4: null }));
      toast.success("API key removed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed.");
    }
  };

  const onTest = async () => {
    if (!testAddress) {
      toast.error("Enter a recipient email.");
      return;
    }
    setSendingTest(true);
    try {
      const res = await sendTestEmail({ data: { to: testAddress } });
      if (res.sent) toast.success("Test email sent.");
      else toast.error(`Not sent: ${res.reason}`);
      void refreshLogs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test failed.");
    } finally {
      setSendingTest(false);
    }
  };

  const onTemplateChange = async (row: EmailTemplateDTO, patch: Partial<EmailTemplateDTO>) => {
    const next = { ...row, ...patch };
    setTemplates((all) => all.map((t) => (t.templateKey === row.templateKey ? next : t)));
    try {
      await updateEmailTemplate({
        data: {
          templateKey: row.templateKey,
          isEnabled: next.isEnabled,
          subjectOverride: next.subjectOverride,
        },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed.");
    }
  };

  const onSaveReminder = async () => {
    if (reminder.reminder24hOpenMaxMinutes <= reminder.reminder24hOpenMinMinutes) {
      toast.error("24h reminder: max must be greater than min.");
      return;
    }
    if (reminder.reminder1hOpenMaxMinutes <= reminder.reminder1hOpenMinMinutes) {
      toast.error("1h reminder: max must be greater than min.");
      return;
    }
    setSavingReminder(true);
    try {
      await updateReminderSettings({ data: reminder });
      toast.success("Reminder windows saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSavingReminder(false);
    }
  };

  const removeLog = async (log: EmailLogRow) => {
    if (!confirm(`Delete this delivery log for ${log.recipient}? This cannot be undone.`)) return;
    setDeletingId(log.id);
    try {
      await deleteEmailDeliveryLog({ data: { id: log.id } });
      setLogs((current) => current.filter((item) => item.id !== log.id));
      toast.success("Delivery log deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeletingId(null);
    }
  };

  const retryLog = async (log: EmailLogRow) => {
    setRetryingId(log.id);
    try {
      await retryEmailDeliveryLog({ data: { id: log.id } });
      toast.success(`Email resent to ${log.recipient}.`);
      await refreshLogs();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Email retry failed.");
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <>
      <main className="mx-auto w-full max-w-5xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
        <header>
          <p className="eyebrow">Admin · Emails</p>
          <h1 className="display-1 mt-3 text-brand-deep">Email settings</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Configure the sending provider, sender identity, and per-template toggles used across
            booking confirmations, reminders, password resets, and the contact form.
          </p>
        </header>

        <section className="rounded-2xl border border-border/70 bg-card p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-brand-deep">Provider & sender</h2>
              <p className="text-sm text-muted-foreground">
                Talk Space sends through Resend. Verify{" "}
                <code>{settings.senderDomain || "your sender domain"}</code> in Resend before
                enabling.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="isEnabled"
                checked={settings.isEnabled}
                onCheckedChange={(v) => setSettings((s) => ({ ...s, isEnabled: v }))}
              />
              <Label htmlFor="isEnabled">Enabled</Label>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <TextField
              label="Sender domain"
              value={settings.senderDomain}
              onChange={(v) => setSettings((s) => ({ ...s, senderDomain: v }))}
              placeholder="talkspace.ng"
            />
            <TextField
              label="From name"
              value={settings.fromName}
              onChange={(v) => setSettings((s) => ({ ...s, fromName: v }))}
              placeholder="Talk Space"
            />
            <TextField
              label="From email"
              value={settings.fromEmail}
              onChange={(v) => setSettings((s) => ({ ...s, fromEmail: v }))}
              placeholder="notifications@talkspace.ng"
              type="email"
            />
            <TextField
              label="Reply-to"
              value={settings.replyTo}
              onChange={(v) => setSettings((s) => ({ ...s, replyTo: v }))}
              placeholder="hello@talkspace.ng"
              type="email"
            />
            <TextField
              label="Zoho recipient inbox"
              value={settings.contactInbox}
              onChange={(v) => setSettings((s) => ({ ...s, contactInbox: v }))}
              placeholder="care@talkspace.ng"
              type="email"
              hint="The confirmed Zoho-owned mailbox that receives new contact and booking notifications."
            />
          </div>

          {senderMatchesInbox ? (
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              The sender email and Zoho recipient inbox are the same. Some inboxes will show these
              admin notices as "Me". Use a verified sender like notifications@talkspace.ng and keep
              this inbox as email@talkspace.ng.
            </p>
          ) : null}

          <div className="mt-5 flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Label htmlFor="zohoRoutingEnabled" className="font-semibold text-brand-deep">
                Route contact submissions to Zoho Mail
              </Label>
              <p className="mt-1 text-sm text-muted-foreground">
                The enquiry remains in the admin while a notification is delivered to the Zoho
                recipient above.
              </p>
            </div>
            <Switch
              id="zohoRoutingEnabled"
              checked={settings.zohoRoutingEnabled}
              onCheckedChange={(value) =>
                setSettings((current) => ({ ...current, zohoRoutingEnabled: value }))
              }
              aria-label="Route contact submissions to Zoho Mail"
            />
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              onClick={onSaveSettings}
              disabled={savingSettings}
              className="bg-brand-deep text-white hover:bg-brand-deep/90"
            >
              {savingSettings ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save settings
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border border-border/70 bg-card p-6 sm:p-8">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-blue-soft text-brand-blue">
              <BookOpenCheck className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-brand-deep">
                Administrator response guidance
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Use this triage standard before replying to or closing a contact enquiry.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-danger/20 bg-danger/5 p-4">
              <div className="flex items-center gap-2 font-semibold text-danger">
                <Siren className="h-4 w-4" aria-hidden /> Urgent safety concern
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Do not attempt counselling. Share emergency support, direct the person to local
                emergency services, and escalate to the clinical lead immediately.
              </p>
            </div>
            <div className="rounded-xl border border-warning/20 bg-warning/5 p-4">
              <div className="font-semibold text-brand-deep">Same business day</div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Prioritise failed payments, missing receipts, appointments within 48 hours, and
                failed Meet links. Verify the reference and assign an owner.
              </p>
            </div>
            <div className="rounded-xl border border-brand-mint/30 bg-brand-mint-soft/50 p-4">
              <div className="font-semibold text-brand-deep">Within one working day</div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Answer routine service, pricing, therapist, availability, and policy questions using
                approved site information.
              </p>
            </div>
          </div>

          <div className="mt-5 flex items-start gap-3 rounded-xl border border-border/70 bg-muted/20 p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-deep" aria-hidden />
            <p className="text-sm leading-6 text-muted-foreground">
              Verify identity before sharing booking or payment details. Keep clinical histories,
              assessment answers, identity documents, payment secrets, and private links out of
              WhatsApp and ordinary email. The admin record remains the source of truth.
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-border/70 bg-card p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-brand-deep">Provider API key</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Stored encrypted server-side. Only the last four characters are ever shown.
          </p>

          <div className="mt-4 flex items-center gap-3 rounded-lg border border-border/70 bg-brand-mint-soft/40 px-4 py-3 text-sm">
            <Mail className="h-4 w-4 text-brand-deep" />
            {settings.hasApiKey ? (
              <>
                <span>
                  Current key: <code>•••• {settings.apiKeyLast4 || "????"}</code>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto text-danger"
                  onClick={onClearKey}
                >
                  <Trash2 className="h-4 w-4" /> Remove
                </Button>
              </>
            ) : (
              <span>No API key configured yet.</span>
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
            <Input
              type="password"
              placeholder="re_live_..."
              value={apiKeyInput}
              onChange={(e) => setApiKeyInputValue(e.target.value)}
              autoComplete="off"
            />
            <Button onClick={onSaveKey} disabled={savingKey}>
              {savingKey ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {settings.hasApiKey ? "Replace key" : "Save key"}
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border border-border/70 bg-card p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-brand-deep">Send a test</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Uses the booking confirmation template with sample data.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
            <Input
              type="email"
              placeholder="you@example.com"
              value={testAddress}
              onChange={(e) => setTestAddress(e.target.value)}
            />
            <Button
              onClick={onTest}
              disabled={sendingTest}
              className="bg-brand-deep text-white hover:bg-brand-deep/90"
            >
              {sendingTest ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send test
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border border-border/70 bg-card p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-brand-deep">Reminder scheduling windows</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Minutes before the appointment start when each reminder is eligible to send. The
            scheduled job runs every 15 minutes and sends a reminder if the time-until-start falls
            inside the window and no reminder has been sent yet. Defaults: 24h = 1380–1470 min
            (23–24.5h); 1h = 30–90 min before start.
          </p>
          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-border/70 p-4">
              <p className="font-semibold text-brand-deep">24h reminder</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <NumberField
                  label="Open at (min before)"
                  value={reminder.reminder24hOpenMinMinutes}
                  onChange={(v) => setReminder((r) => ({ ...r, reminder24hOpenMinMinutes: v }))}
                />
                <NumberField
                  label="Close at (min before)"
                  value={reminder.reminder24hOpenMaxMinutes}
                  onChange={(v) => setReminder((r) => ({ ...r, reminder24hOpenMaxMinutes: v }))}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                ≈ {(reminder.reminder24hOpenMinMinutes / 60).toFixed(1)}h –{" "}
                {(reminder.reminder24hOpenMaxMinutes / 60).toFixed(1)}h before start
              </p>
            </div>
            <div className="rounded-xl border border-border/70 p-4">
              <p className="font-semibold text-brand-deep">1h reminder</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <NumberField
                  label="Open at (min before)"
                  value={reminder.reminder1hOpenMinMinutes}
                  onChange={(v) => setReminder((r) => ({ ...r, reminder1hOpenMinMinutes: v }))}
                />
                <NumberField
                  label="Close at (min before)"
                  value={reminder.reminder1hOpenMaxMinutes}
                  onChange={(v) => setReminder((r) => ({ ...r, reminder1hOpenMaxMinutes: v }))}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {reminder.reminder1hOpenMinMinutes}–{reminder.reminder1hOpenMaxMinutes} min before
                start
              </p>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <Button
              onClick={onSaveReminder}
              disabled={savingReminder}
              className="bg-brand-deep text-white hover:bg-brand-deep/90"
            >
              {savingReminder ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save reminder windows
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border border-border/70 bg-card p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-brand-deep">Templates</h2>
          <p className="mt-1 text-sm text-muted-foreground" data-anchor="templates-desc">
            Edit the subject or body, turn individual emails on or off, and preview the result.
          </p>
          <div className="mt-4 space-y-3">
            {visibleTemplates.map((t) => (
              <div
                key={t.templateKey}
                className="grid gap-3 rounded-xl border border-border/70 p-4 sm:grid-cols-[1fr_auto] sm:items-start"
              >
                <div>
                  <div className="flex items-center gap-3">
                    <Switch
                      id={`t-${t.templateKey}`}
                      checked={t.isEnabled}
                      onCheckedChange={(v) => void onTemplateChange(t, { isEnabled: v })}
                    />
                    <Label htmlFor={`t-${t.templateKey}`} className="font-semibold text-brand-deep">
                      {t.displayName}
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="ml-auto"
                      onClick={() => void onPreview(t)}
                      disabled={previewLoadingKey === t.templateKey}
                    >
                      {previewLoadingKey === t.templateKey ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                      Preview
                    </Button>
                  </div>
                  {t.description ? (
                    <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
                  ) : null}
                  <div className="mt-3">
                    <Label htmlFor={`s-${t.templateKey}`} className="text-xs text-muted-foreground">
                      Subject override (optional)
                    </Label>
                    <Input
                      id={`s-${t.templateKey}`}
                      value={t.subjectOverride ?? ""}
                      onChange={(e) =>
                        setTemplates((all) =>
                          all.map((r) =>
                            r.templateKey === t.templateKey
                              ? { ...r, subjectOverride: e.target.value }
                              : r,
                          ),
                        )
                      }
                      onBlur={(e) =>
                        void onTemplateChange(t, { subjectOverride: e.target.value.trim() || null })
                      }
                      placeholder="Leave blank to use the default subject"
                      className="mt-1"
                    />
                  </div>
                  <div className="mt-3">
                    <Label htmlFor={`b-${t.templateKey}`} className="text-xs text-muted-foreground">
                      Body override (optional)
                    </Label>
                    <Textarea
                      id={`b-${t.templateKey}`}
                      value={t.bodyOverride ?? ""}
                      onChange={(e) =>
                        setTemplates((all) =>
                          all.map((r) =>
                            r.templateKey === t.templateKey
                              ? { ...r, bodyOverride: e.target.value }
                              : r,
                          ),
                        )
                      }
                      onBlur={(e) =>
                        void onTemplateChange(t, { bodyOverride: e.target.value.trim() || null })
                      }
                      placeholder="Leave blank to use the built-in email body. Use {{clientName}} or {{reference}} for values."
                      rows={5}
                      className="mt-1"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Plain text only. Values in double braces are replaced in previews and sent
                      emails.
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {templates.length > 0 ? (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
              <p className="text-xs text-muted-foreground">
                Showing {(currentTemplatePage - 1) * templatesPerPage + 1}–
                {Math.min(currentTemplatePage * templatesPerPage, templates.length)} of{" "}
                {templates.length} templates
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label="Previous template page"
                  onClick={() => setTemplatePage((page) => Math.max(1, page - 1))}
                  disabled={currentTemplatePage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {currentTemplatePage} of {templatePageCount}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label="Next template page"
                  onClick={() => setTemplatePage((page) => Math.min(templatePageCount, page + 1))}
                  disabled={currentTemplatePage === templatePageCount}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-border/70 bg-card p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-brand-deep">Delivery log</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Latest 200 send attempts. Failed provider requests become eligible for automatic
                retry after 5, 15, and 60 minutes, run on the configured scheduler, and can also be
                resent here.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refreshLogs()}
              disabled={refreshingLogs}
            >
              {refreshingLogs ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>
          <div className="mt-4 overflow-x-auto">
            {logs.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
                No send attempts recorded yet.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3">When</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Template</th>
                    <th className="py-2 pr-3">Recipient</th>
                    <th className="py-2 pr-3">Subject</th>
                    <th className="py-2 pr-3">Detail</th>
                    <th className="py-2 pr-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-t border-border/70 align-top">
                      <td className="py-2 pr-3 whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2 pr-3">
                        <StatusBadge status={log.status} />
                      </td>
                      <td className="py-2 pr-3 text-xs">
                        {log.templateKey ?? <span className="text-muted-foreground">raw</span>}
                      </td>
                      <td className="py-2 pr-3 text-xs">{log.recipient}</td>
                      <td className="py-2 pr-3 max-w-xs truncate text-xs" title={log.subject ?? ""}>
                        {log.subject ?? "—"}
                      </td>
                      <td className="py-2 pr-3 text-xs">
                        {log.status === "sent" ? (
                          <span className="text-muted-foreground">
                            {log.providerId ? `id: ${log.providerId}` : "delivered to provider"}
                          </span>
                        ) : log.status === "failed" ? (
                          <span className="text-danger">
                            {log.error ?? log.reason ?? "failed"}
                            {log.nextRetryAt
                              ? ` · retry ${log.retryCount + 1} due ${new Date(log.nextRetryAt).toLocaleString()}`
                              : log.retryCount
                                ? ` · ${log.retryCount} retries attempted`
                                : ""}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">{log.reason ?? "skipped"}</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <div className="flex justify-end gap-1">
                          {log.canRetry ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={retryingId === log.id}
                              onClick={() => void retryLog(log)}
                            >
                              {retryingId === log.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RotateCcw className="h-4 w-4" />
                              )}
                              Resend
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            disabled={deletingId === log.id}
                            onClick={() => void removeLog(log)}
                          >
                            {deletingId === log.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}{" "}
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </main>
      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{preview?.displayName ?? "Preview"}</DialogTitle>
            <DialogDescription className="space-y-1">
              <div>
                <span className="text-muted-foreground">Subject:</span>{" "}
                <span className="font-medium text-foreground">{preview?.subject}</span>
              </div>
              {preview?.overrideSubject ? (
                <div className="text-xs text-muted-foreground">
                  Default: {preview.defaultSubject}
                </div>
              ) : null}
              <div className="text-xs text-muted-foreground">
                Rendered with sample booking data — nothing is sent.
              </div>
            </DialogDescription>
          </DialogHeader>
          {preview ? (
            <iframe
              title={`Preview: ${preview.displayName}`}
              srcDoc={preview.html}
              sandbox=""
              className="h-[70vh] w-full rounded-md border border-border bg-white"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function StatusBadge({ status }: { status: EmailLogRow["status"] }) {
  const cls =
    status === "sent"
      ? "bg-emerald-100 text-emerald-800"
      : status === "failed"
        ? "bg-red-100 text-red-800"
        : "bg-amber-100 text-amber-800";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {status}
    </span>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  hint,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
  type?: string;
  hint?: string;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div>
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        placeholder={placeholder}
        className="mt-1"
      />
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div>
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        min={1}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          onChange(Number.isNaN(n) ? 0 : n);
        }}
        className="mt-1"
      />
    </div>
  );
}
