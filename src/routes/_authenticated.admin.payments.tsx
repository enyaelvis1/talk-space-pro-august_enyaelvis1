import { useCallback, useMemo, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  Loader2,
  RefreshCw,
  Save,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { AdminWorkspaceShell } from "@/components/progress/AdminSidebar";
import { formatWATDateTime } from "@/lib/time";
import { AdminPageSkeleton } from "@/components/admin/AdminSkeletons";
import { PaymentReceiptDetails } from "@/components/booking/PaymentReceiptDetails";
import { SensitiveActionDialog } from "@/components/admin/SensitiveActionDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSensitiveActionGate } from "@/hooks/useSensitiveActionGate";
import { canonicalUrl } from "@/lib/seo";
import {
  clearPaystackSecret,
  clearPaystackWebhookSecret,
  createManualPackageLink,
  getPaymentAdminData,
  getPaymentAdminWorkspace,
  getReceiptSignedUrl,
  listPaymentsForAdmin,
  listPaymentReviews,
  listPaymentEvents,
  deletePaymentForAdmin,
  setPaystackSecret,
  setPaystackWebhookSecret,
  updatePaymentSettings,
  updatePaymentStatusForAdmin,
  verifyBankTransferPayment,
  recoverPaidBankTransferBooking,
  verifyPaystackPaymentForAdmin,
  type PaymentRow,
  type PaymentReviewEntry,
  type PaymentEventEntry,
  type PaymentSettingsDTO,
  type PackageServiceOption,
} from "@/lib/payments.functions";

type PaymentTab = "pending" | "confirmed" | "failed" | "all";
type ManualPaymentStatus =
  "initiated" | "awaiting_confirmation" | "succeeded" | "failed" | "cancelled";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  pendingMs: 0,
  pendingMinMs: 300,
  loader: async () => {
    try {
      const workspace = await getPaymentAdminWorkspace();
      return workspace;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message === "Sign in required." || message === "Admin permission required.") {
        throw redirect({ href: "/account?error=forbidden" });
      }
      throw error;
    }
  },
  head: () => ({
    meta: [
      { title: "Payments | Talk Space Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: canonicalUrl("/admin/payments") }],
  }),
  errorComponent: ({ error }) => (
    <AdminWorkspaceShell>
      <main className="p-8 text-sm text-destructive">
        {error instanceof Error ? error.message : "Failed to load payment settings."}
      </main>
    </AdminWorkspaceShell>
  ),
  pendingComponent: () => (
    <AdminWorkspaceShell>
      <AdminPageSkeleton columns={5} rows={8} />
    </AdminWorkspaceShell>
  ),
  component: PaymentsAdminRoute,
});

function PaymentsAdminRoute() {
  const loaderData = Route.useLoaderData();
  return (
    <AdminWorkspaceShell>
      <PaymentsAdminScreen
        initialSettings={loaderData.settings}
        initialPayments={loaderData.payments}
        packageServices={loaderData.packageServices}
      />
    </AdminWorkspaceShell>
  );
}

function formatNaira(kobo: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
  }).format(kobo / 100);
}

function formatDateTime(iso: string | null) {
  return formatWATDateTime(iso);
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    succeeded: "bg-emerald-100 text-emerald-800 border-emerald-200",
    awaiting_confirmation: "bg-amber-100 text-amber-800 border-amber-200",
    initiated: "bg-sky-100 text-sky-800 border-sky-200",
    failed: "bg-rose-100 text-rose-800 border-rose-200",
    cancelled: "bg-slate-100 text-slate-700 border-slate-200",
    refunded: "bg-purple-100 text-purple-800 border-purple-200",
  };
  const cls = map[status] ?? "bg-slate-100 text-slate-700 border-slate-200";
  return (
    <Badge variant="outline" className={`${cls} border font-medium capitalize`}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

function paymentLifecycleLabel(row: PaymentRow) {
  if (row.bookingReviewRequired) return "Verified payment · booking review required";
  if (row.status === "awaiting_confirmation") return "Pending payment review";
  if (row.status === "succeeded") return "Verified payment · booking confirmed";
  if (row.status === "refunded") return "Refunded payment";
  if (row.status === "cancelled") return "Cancelled payment";
  if (row.status === "failed") return "Failed payment";
  return "Payment not verified";
}

const paymentStatusLabels: Record<ManualPaymentStatus, string> = {
  initiated: "Not verified",
  awaiting_confirmation: "Pending review",
  succeeded: "Verified",
  failed: "Failed",
  cancelled: "Cancelled",
};

function canDeletePayment(row: PaymentRow) {
  return ["initiated", "failed", "cancelled"].includes(row.status);
}

function manualStatusOptionsFor(row: PaymentRow): ManualPaymentStatus[] {
  const unresolved = row.provider === "bank_transfer" ? "awaiting_confirmation" : "initiated";
  return [unresolved, "succeeded", "failed", "cancelled"];
}

function manualStatusValueFor(
  status: string,
  provider: PaymentRow["provider"],
): ManualPaymentStatus {
  if (status === "pending")
    return provider === "bank_transfer" ? "awaiting_confirmation" : "initiated";
  if (
    status === "initiated" ||
    status === "awaiting_confirmation" ||
    status === "succeeded" ||
    status === "failed" ||
    status === "cancelled"
  ) {
    return status;
  }
  return provider === "bank_transfer" ? "awaiting_confirmation" : "initiated";
}

function PaymentsAdminScreen({
  initialSettings,
  initialPayments,
  packageServices,
}: {
  initialSettings: PaymentSettingsDTO;
  initialPayments: PaymentRow[];
  packageServices: PackageServiceOption[];
}) {
  const stepUp = useSensitiveActionGate();
  const [settings, setSettings] = useState<PaymentSettingsDTO>(initialSettings);
  const [payments, setPayments] = useState<PaymentRow[]>(initialPayments);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [secretInput, setSecretInput] = useState("");
  const [savingSecret, setSavingSecret] = useState(false);
  const [webhookInput, setWebhookInput] = useState("");
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [tab, setTab] = useState<PaymentTab>("pending");
  const [reviewing, setReviewing] = useState<PaymentRow | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewBusy, setReviewBusy] = useState<"approve" | "reject" | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);
  const [reviews, setReviews] = useState<PaymentReviewEntry[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [events, setEvents] = useState<PaymentEventEntry[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [verifyingPaystackId, setVerifyingPaystackId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [packageForm, setPackageForm] = useState({
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    serviceId: packageServices[0]?.id ?? "",
    purchasedSessions: 1,
    sessionMode: "online" as "online" | "in_person",
    neverExpires: true,
    expiresOn: "",
    notes: "",
    sendEmail: true,
  });
  const [packageBusy, setPackageBusy] = useState(false);
  const [lastPackageUrl, setLastPackageUrl] = useState<string | null>(null);
  const [lastPackageReference, setLastPackageReference] = useState<string | null>(null);
  const selectedPackageService = useMemo(
    () => packageServices.find((service) => service.id === packageForm.serviceId) ?? null,
    [packageForm.serviceId, packageServices],
  );
  const estimatedPackageTotal =
    selectedPackageService?.priceNgn == null
      ? null
      : (selectedPackageService.priceNgn / Math.max(1, selectedPackageService.sessionsPerPackage)) *
        Number(packageForm.purchasedSessions || 0);

  const reloadSettings = useCallback(async () => {
    const fresh = await getPaymentAdminData();
    setSettings(fresh);
  }, []);

  const pending = useMemo(
    () =>
      payments.filter(
        (p) =>
          p.bookingReviewRequired ||
          (p.provider === "bank_transfer" && p.status === "awaiting_confirmation") ||
          (p.provider === "paystack" && (p.status === "initiated" || p.status === "pending")),
      ),
    [payments],
  );
  const confirmed = useMemo(() => payments.filter((p) => p.status === "succeeded"), [payments]);
  const failed = useMemo(
    () => payments.filter((p) => p.status === "failed" || p.status === "cancelled"),
    [payments],
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const next = await listPaymentsForAdmin();
      setPayments(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to refresh payments.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  const onVerifyPaystack = async (row: PaymentRow) => {
    setVerifyingPaystackId(row.id);
    try {
      const result = await verifyPaystackPaymentForAdmin({ data: { paymentId: row.id } });
      await refresh();
      if (result.status === "succeeded") {
        toast.success(
          result.bookingReviewRequired
            ? "Paystack payment confirmed; booking needs rescheduling or refund review."
            : "Paystack payment confirmed.",
        );
      } else if (result.status === "failed") {
        toast.error("Paystack marked this payment as failed.");
      } else {
        toast.info("Paystack has not confirmed this payment yet.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (
        message.includes("paystack_verify_failed:401") ||
        message.includes("paystack_verify_failed:404")
      ) {
        toast.error(
          "Paystack could not verify this reference. Confirm the stored secret key matches the same test/live Paystack account that created it.",
        );
      } else {
        toast.error(message || "Failed to verify Paystack payment.");
      }
    } finally {
      setVerifyingPaystackId(null);
    }
  };

  const onManualStatusChange = async (row: PaymentRow, nextStatus: ManualPaymentStatus) => {
    if (row.status === nextStatus) return;

    if (nextStatus === "succeeded") {
      const ok = confirm(
        `Mark payment ${row.reference} as verified? This can confirm the booking, sync Google Calendar, and email the client.`,
      );
      if (!ok) return;
    }

    const stepUpAllowed = await stepUp.requestStepUp(`update payment ${row.reference}`);
    if (!stepUpAllowed) return;

    setUpdatingStatusId(row.id);
    try {
      await updatePaymentStatusForAdmin({ data: { paymentId: row.id, status: nextStatus } });
      await refresh();
      toast.success(`Payment marked ${paymentStatusLabels[nextStatus].toLowerCase()}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update payment status.");
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const onRetryBooking = async (row: PaymentRow) => {
    const ok = confirm(
      `Retry confirming the booking for paid transfer ${row.reference}? The transfer will remain verified.`,
    );
    if (!ok) return;

    const stepUpAllowed = await stepUp.requestStepUp(`retry booking ${row.reference}`);
    if (!stepUpAllowed) return;

    setUpdatingStatusId(row.id);
    try {
      const result = await verifyBankTransferPayment({
        data: {
          paymentId: row.id,
          approve: true,
          note: "Retried booking confirmation after payment review",
        },
      });
      await refresh();
      if (result.bookingConfirmed) {
        toast.success("Booking confirmed successfully.");
      } else if (result.appointmentStatus === "cancelled") {
        toast.error("Payment is verified, but this booking must be rescheduled or refunded.");
      } else {
        toast.error("Payment is verified, but the booking still needs review.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to retry booking confirmation.");
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const onRecoverBooking = async (row: PaymentRow) => {
    const ok = confirm(
      `Restore the cancelled booking for paid transfer ${row.reference} and issue a new manage link?`,
    );
    if (!ok) return;
    const stepUpAllowed = await stepUp.requestStepUp(`recover booking ${row.reference}`);
    if (!stepUpAllowed) return;
    setUpdatingStatusId(row.id);
    try {
      const result = await recoverPaidBankTransferBooking({ data: { paymentId: row.id } });
      await refresh();
      toast.success(`Booking restored. Manage link: ${result.manageUrl}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to restore the booking.");
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const onSaveSettings = async () => {
    const stepUpAllowed = await stepUp.requestStepUp("save the payment provider settings");
    if (!stepUpAllowed) return;
    setSaving(true);
    try {
      await updatePaymentSettings({
        data: {
          mode: settings.mode,
          paystackPublicKey: settings.paystackPublicKey ?? null,
          isPaystackEnabled: settings.isPaystackEnabled,
          isBankTransferEnabled: settings.isBankTransferEnabled,
          bankName: settings.bankName ?? null,
          bankAccountName: settings.bankAccountName ?? null,
          bankAccountNumber: settings.bankAccountNumber ?? null,
          bankInstructions: settings.bankInstructions ?? null,
          callbackPath: settings.callbackPath || "/book/payment-callback",
        },
      });
      await reloadSettings();
      toast.success("Payment settings saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const onSaveSecret = async () => {
    if (secretInput.trim().length < 10) {
      toast.error("Paste a valid Paystack secret key.");
      return;
    }
    const stepUpAllowed = await stepUp.requestStepUp("store the Paystack secret key");
    if (!stepUpAllowed) return;
    setSavingSecret(true);
    try {
      await setPaystackSecret({ data: { value: secretInput.trim() } });
      await reloadSettings();
      setSecretInput("");
      toast.success("Paystack secret saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSavingSecret(false);
    }
  };

  const onClearSecret = async () => {
    if (!confirm("Remove the stored Paystack secret key?")) return;
    const stepUpAllowed = await stepUp.requestStepUp("clear the stored Paystack secret key");
    if (!stepUpAllowed) return;
    try {
      await clearPaystackSecret();
      await reloadSettings();
      toast.success("Paystack secret cleared.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to clear.");
    }
  };

  const onSaveWebhook = async () => {
    if (webhookInput.trim().length < 10) {
      toast.error("Paste a valid webhook secret.");
      return;
    }
    const stepUpAllowed = await stepUp.requestStepUp("store the webhook secret");
    if (!stepUpAllowed) return;
    setSavingWebhook(true);
    try {
      await setPaystackWebhookSecret({ data: { value: webhookInput.trim() } });
      await reloadSettings();
      setSettings((s) => ({ ...s, hasPaystackWebhookSecret: true }));
      setWebhookInput("");
      toast.success("Webhook secret saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSavingWebhook(false);
    }
  };

  const onClearWebhook = async () => {
    if (!confirm("Remove the stored webhook secret?")) return;
    const stepUpAllowed = await stepUp.requestStepUp("clear the stored webhook secret");
    if (!stepUpAllowed) return;
    try {
      await clearPaystackWebhookSecret();
      setSettings((s) => ({ ...s, hasPaystackWebhookSecret: false }));
      toast.success("Webhook secret cleared.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to clear.");
    }
  };

  const openReview = async (row: PaymentRow) => {
    setReviewing(row);
    setReviewNote("");
    setReceiptUrl(null);
    setReviews([]);
    setEvents([]);
    setLoadingReviews(true);
    void listPaymentReviews({ data: { paymentId: row.id } })
      .then((entries) => setReviews(entries))
      .catch(() => setReviews([]))
      .finally(() => setLoadingReviews(false));
    setLoadingEvents(true);
    void listPaymentEvents({ data: { paymentId: row.id } })
      .then((entries) => setEvents(entries as PaymentEventEntry[]))
      .catch(() => setEvents([]))
      .finally(() => setLoadingEvents(false));
    if (row.receiptPath) {
      setLoadingReceipt(true);
      try {
        const res = await getReceiptSignedUrl({ data: { path: row.receiptPath } });
        setReceiptUrl(res.url);
      } catch {
        setReceiptUrl(null);
      } finally {
        setLoadingReceipt(false);
      }
    }
  };

  const submitReview = async (approve: boolean) => {
    if (!reviewing) return;
    const stepUpAllowed = await stepUp.requestStepUp(
      approve ? "approve this bank transfer" : "reject this bank transfer",
    );
    if (!stepUpAllowed) return;
    setReviewBusy(approve ? "approve" : "reject");
    try {
      await verifyBankTransferPayment({
        data: { paymentId: reviewing.id, approve, note: reviewNote.trim() || undefined },
      });
      toast.success(approve ? "Payment approved and booking confirmed." : "Transfer rejected.");
      setReviewing(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setReviewBusy(null);
    }
  };

  const rows =
    tab === "pending"
      ? pending
      : tab === "confirmed"
        ? confirmed
        : tab === "failed"
          ? failed
          : payments;

  const onDeletePayment = async (row: PaymentRow) => {
    if (!confirm(`Delete payment ${row.reference}? This cannot be undone.`)) return;
    const stepUpAllowed = await stepUp.requestStepUp(`delete payment ${row.reference}`);
    if (!stepUpAllowed) return;
    setDeletingId(row.id);
    try {
      await deletePaymentForAdmin({ data: { paymentId: row.id } });
      setPayments((current) => current.filter((item) => item.id !== row.id));
      toast.success("Payment deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete payment.");
    } finally {
      setDeletingId(null);
    }
  };

  const onCreatePackageLink = async () => {
    const stepUpAllowed = await stepUp.requestStepUp("issue a package booking link");
    if (!stepUpAllowed) return;
    setPackageBusy(true);
    setLastPackageUrl(null);
    setLastPackageReference(null);
    try {
      const result = await createManualPackageLink({
        data: {
          clientName: packageForm.clientName,
          clientEmail: packageForm.clientEmail,
          clientPhone: packageForm.clientPhone || undefined,
          serviceId: packageForm.serviceId,
          sessionMode: packageForm.sessionMode,
          purchasedSessions: Number(packageForm.purchasedSessions),
          expiresAt:
            packageForm.neverExpires || !packageForm.expiresOn
              ? undefined
              : `${packageForm.expiresOn}T23:59:59+01:00`,
          notes: packageForm.notes || undefined,
          sendEmail: packageForm.sendEmail,
        },
      });
      setLastPackageUrl(result.bookingUrl);
      setLastPackageReference(result.packageReference);
      toast.success(
        packageForm.sendEmail ? "Package link created and emailed." : "Package link created.",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create package link.");
    } finally {
      setPackageBusy(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 p-4 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-deep/60">
            Admin
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-brand-deep">Payments</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Configure Paystack, manage bank transfer details, and review manual payments.
          </p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={refreshing}>
          {refreshing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Refresh
        </Button>
      </header>

      {/* Settings */}
      <section className="rounded-2xl border border-border/70 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-brand-deep">Provider settings</h2>
            <p className="text-sm text-muted-foreground">
              Toggle providers, set mode, and configure your callback path.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Label
              htmlFor="mode"
              className="text-xs uppercase tracking-wider text-muted-foreground"
            >
              Mode
            </Label>
            <select
              id="mode"
              value={settings.mode}
              onChange={(e) =>
                setSettings((s) => ({ ...s, mode: e.target.value as "test" | "live" }))
              }
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="test">Test</option>
              <option value="live">Live</option>
            </select>
          </div>
        </div>

        <div
          className={`mb-6 flex items-start gap-3 rounded-xl border p-4 text-sm ${
            settings.hasPaystackSecret
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-amber-200 bg-amber-50 text-amber-950"
          }`}
        >
          <div
            className={`mt-0.5 rounded-full p-2 ${
              settings.hasPaystackSecret ? "bg-emerald-100" : "bg-amber-100"
            }`}
          >
            {settings.hasPaystackSecret ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
          </div>
          <div className="space-y-1">
            <p className="font-medium">
              {settings.hasPaystackSecret ? "Paystack is configured" : "Paystack secret missing"}
            </p>
            <p className="text-sm leading-6">
              {settings.paystackSecretSource === "supabase"
                ? `The encrypted secret is stored in Supabase and can be used immediately by the booking flow${settings.paystackSecretLast4 ? ` (ending ${settings.paystackSecretLast4})` : ""}.`
                : settings.paystackSecretSource === "environment"
                  ? `The server environment provides the secret and can be used immediately by the booking flow${settings.paystackSecretLast4 ? ` (ending ${settings.paystackSecretLast4})` : ""}.`
                  : "Paste the Paystack secret below to store it encrypted in Supabase and unlock Paystack checkout for bookings."}
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4 rounded-xl border border-border/70 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-brand-deep">Paystack</p>
                <p className="text-xs text-muted-foreground">Card, bank, transfer via Paystack.</p>
              </div>
              <Switch
                checked={settings.isPaystackEnabled}
                onCheckedChange={(v) => setSettings((s) => ({ ...s, isPaystackEnabled: v }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pubkey">Public key</Label>
              <Input
                id="pubkey"
                placeholder="pk_test_…"
                value={settings.paystackPublicKey ?? ""}
                onChange={(e) => setSettings((s) => ({ ...s, paystackPublicKey: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Secret key</Label>
              {settings.hasPaystackSecret ? (
                <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                  <span>
                    {settings.paystackSecretSource === "environment" ? "Environment" : "Stored"} ·
                    ending in{" "}
                    <code className="font-mono">{settings.paystackSecretLast4 ?? "----"}</code>
                  </span>
                  {settings.paystackSecretSource === "supabase" ? (
                    <Button size="sm" variant="ghost" onClick={onClearSecret}>
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      Clear
                    </Button>
                  ) : null}
                </div>
              ) : null}
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="sk_test_…"
                  value={secretInput}
                  onChange={(e) => setSecretInput(e.target.value)}
                />
                <Button onClick={onSaveSecret} disabled={savingSecret}>
                  {savingSecret ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Webhook secret</Label>
              {settings.hasPaystackWebhookSecret ? (
                <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                  <span>Stored</span>
                  <Button size="sm" variant="ghost" onClick={onClearWebhook}>
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Clear
                  </Button>
                </div>
              ) : null}
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="whsec_…"
                  value={webhookInput}
                  onChange={(e) => setWebhookInput(e.target.value)}
                />
                <Button onClick={onSaveWebhook} disabled={savingWebhook}>
                  {savingWebhook ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Used to verify Paystack webhook signatures at{" "}
                <code>/api/public/paystack-webhook</code>.
              </p>
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-border/70 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-brand-deep">Bank transfer</p>
                <p className="text-xs text-muted-foreground">
                  Clients transfer manually and upload a receipt.
                </p>
              </div>
              <Switch
                checked={settings.isBankTransferEnabled}
                onCheckedChange={(v) => setSettings((s) => ({ ...s, isBankTransferEnabled: v }))}
              />
            </div>
            <div className="grid gap-3">
              <div className="space-y-2">
                <Label htmlFor="bank-name">Bank name</Label>
                <Input
                  id="bank-name"
                  value={settings.bankName ?? ""}
                  onChange={(e) => setSettings((s) => ({ ...s, bankName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bank-acct-name">Account name</Label>
                <Input
                  id="bank-acct-name"
                  value={settings.bankAccountName ?? ""}
                  onChange={(e) => setSettings((s) => ({ ...s, bankAccountName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bank-acct-no">Account number</Label>
                <Input
                  id="bank-acct-no"
                  value={settings.bankAccountNumber ?? ""}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, bankAccountNumber: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bank-notes">Instructions</Label>
                <Textarea
                  id="bank-notes"
                  rows={3}
                  value={settings.bankInstructions ?? ""}
                  onChange={(e) => setSettings((s) => ({ ...s, bankInstructions: e.target.value }))}
                  placeholder="Add the booking reference in the transfer narration."
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
          <div className="w-full max-w-md space-y-2">
            <Label htmlFor="callback">Callback path</Label>
            <Input
              id="callback"
              value={settings.callbackPath}
              onChange={(e) => setSettings((s) => ({ ...s, callbackPath: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Path Paystack redirects to after checkout, e.g. <code>/book/payment-callback</code>.
            </p>
          </div>
          <Button onClick={onSaveSettings} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save settings
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-border/70 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-brand-deep">Issue package booking link</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Use this when a client paid by transfer or bought prepaid session credits before
            booking.
          </p>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="pkg-name">Client name</Label>
            <Input
              id="pkg-name"
              value={packageForm.clientName}
              onChange={(e) => setPackageForm((f) => ({ ...f, clientName: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pkg-email">Client email</Label>
            <Input
              id="pkg-email"
              type="email"
              value={packageForm.clientEmail}
              onChange={(e) => setPackageForm((f) => ({ ...f, clientEmail: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pkg-phone">Phone</Label>
            <Input
              id="pkg-phone"
              value={packageForm.clientPhone}
              onChange={(e) => setPackageForm((f) => ({ ...f, clientPhone: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pkg-service">Credit service</Label>
            <select
              id="pkg-service"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={packageForm.serviceId}
              onChange={(e) => {
                const service = packageServices.find((item) => item.id === e.target.value);
                setPackageForm((f) => ({
                  ...f,
                  serviceId: e.target.value,
                  purchasedSessions: f.purchasedSessions,
                }));
              }}
            >
              {packageServices.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} ({service.sessionsPerPackage} default)
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pkg-sessions">Sessions in this package</Label>
            <Input
              id="pkg-sessions"
              type="number"
              min={1}
              max={50}
              value={packageForm.purchasedSessions}
              onChange={(e) =>
                setPackageForm((f) => ({ ...f, purchasedSessions: Number(e.target.value) }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pkg-mode">Session mode</Label>
            <select
              id="pkg-mode"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={packageForm.sessionMode}
              onChange={(e) =>
                setPackageForm((f) => ({
                  ...f,
                  sessionMode: e.target.value as "online" | "in_person",
                }))
              }
            >
              <option value="online">Online only</option>
              <option value="in_person">In-person only</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Credits stay locked to this mode so clients cannot switch an online balance to
              in-person sessions.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pkg-expires-on">Credit expiry</Label>
            <div className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)]">
              <label className="flex h-10 items-center gap-2 rounded-md border border-input px-3 text-sm">
                <input
                  type="checkbox"
                  checked={packageForm.neverExpires}
                  onChange={(event) => {
                    const neverExpires = event.currentTarget.checked;
                    setPackageForm((f) => ({ ...f, neverExpires }));
                  }}
                />
                No expiry
              </label>
              <Input
                id="pkg-expires-on"
                type="date"
                value={packageForm.expiresOn}
                disabled={packageForm.neverExpires}
                onChange={(event) =>
                  setPackageForm((f) => ({ ...f, expiresOn: event.currentTarget.value }))
                }
              />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-7">
            <Switch
              id="pkg-send-email"
              checked={packageForm.sendEmail}
              onCheckedChange={(checked) => setPackageForm((f) => ({ ...f, sendEmail: checked }))}
            />
            <Label htmlFor="pkg-send-email">Email link to client</Label>
          </div>
          <div className="rounded-xl border border-border/70 bg-muted/30 p-4 md:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Credit summary
            </p>
            <dl className="mt-3 grid gap-3 text-sm md:grid-cols-4">
              <div>
                <dt className="text-muted-foreground">Sessions in package</dt>
                <dd className="font-medium text-brand-deep">{packageForm.purchasedSessions}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Mode</dt>
                <dd className="font-medium text-brand-deep">
                  {packageForm.sessionMode === "online" ? "Online only" : "In-person only"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Expiry</dt>
                <dd className="font-medium text-brand-deep">
                  {packageForm.neverExpires ? "No expiry" : packageForm.expiresOn || "Choose date"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Estimated total</dt>
                <dd className="font-medium text-brand-deep">
                  {estimatedPackageTotal == null
                    ? "Manual amount"
                    : new Intl.NumberFormat("en-NG", {
                        style: "currency",
                        currency: "NGN",
                        maximumFractionDigits: 0,
                      }).format(estimatedPackageTotal)}
                </dd>
              </div>
            </dl>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="pkg-notes">Internal note</Label>
            <Textarea
              id="pkg-notes"
              rows={3}
              value={packageForm.notes}
              onChange={(e) => setPackageForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Bank reference, amount, or staff note."
            />
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            className="bg-brand-deep text-white hover:bg-brand-deep/90"
            disabled={
              packageBusy ||
              !packageForm.clientName ||
              !packageForm.clientEmail ||
              !packageForm.serviceId
            }
            onClick={onCreatePackageLink}
          >
            {packageBusy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="mr-2 h-4 w-4" />
            )}
            Create package link
          </Button>
          {lastPackageUrl ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(lastPackageUrl);
                toast.success("Package link copied.");
              }}
            >
              Copy latest link
            </Button>
          ) : null}
          {lastPackageReference ? (
            <span className="text-sm text-muted-foreground">
              Package reference: <strong>{lastPackageReference}</strong>
            </span>
          ) : null}
        </div>
      </section>

      {/* Review queue */}
      <section className="rounded-2xl border border-border/70 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-brand-deep">Payments</h2>
            <p className="text-sm text-muted-foreground">
              Review unresolved payments or filter the full transaction ledger by status.
            </p>
          </div>
          <div className="inline-flex rounded-md border border-border p-0.5">
            <button
              type="button"
              onClick={() => setTab("pending")}
              className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === "pending" ? "bg-brand-deep text-white" : "text-brand-deep/70 hover:bg-muted"
              }`}
            >
              Pending review ({pending.length})
            </button>
            <button
              type="button"
              onClick={() => setTab("confirmed")}
              className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === "confirmed"
                  ? "bg-brand-deep text-white"
                  : "text-brand-deep/70 hover:bg-muted"
              }`}
            >
              Confirmed ({confirmed.length})
            </button>
            <button
              type="button"
              onClick={() => setTab("failed")}
              className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === "failed" ? "bg-brand-deep text-white" : "text-brand-deep/70 hover:bg-muted"
              }`}
            >
              Failed ({failed.length})
            </button>
            <button
              type="button"
              onClick={() => setTab("all")}
              className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === "all" ? "bg-brand-deep text-white" : "text-brand-deep/70 hover:bg-muted"
              }`}
            >
              All ({payments.length})
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-3">Booking</th>
                <th className="py-2 pr-3">Client</th>
                <th className="py-2 pr-3">Provider</th>
                <th className="py-2 pr-3">Amount</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Created</th>
                <th className="py-2 pr-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    No payments to show.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-border/60 last:border-none">
                    <td className="py-3 pr-3">
                      <div className="font-mono text-xs text-brand-deep">
                        {row.bookingReference ?? "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">{row.reference}</div>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="text-brand-deep">{row.clientName ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{row.clientEmail ?? ""}</div>
                    </td>
                    <td className="py-3 pr-3 capitalize">{row.provider.replace("_", " ")}</td>
                    <td className="py-3 pr-3 font-medium">
                      <div>Booking: {formatNaira(row.amountKobo)}</div>
                      {row.checkoutTotalKobo !== row.amountKobo ? (
                        <div className="text-xs font-normal text-muted-foreground">
                          Checkout total: {formatNaira(row.checkoutTotalKobo)}
                        </div>
                      ) : null}
                      {row.checkoutReceipt ? (
                        <div className="mt-2 min-w-64 font-normal">
                          <PaymentReceiptDetails receipt={row.checkoutReceipt} showProviderFee />
                        </div>
                      ) : null}
                    </td>
                    <td className="py-3 pr-3">
                      <StatusBadge status={row.status} />
                      <p
                        className={`mt-1 text-xs ${
                          row.bookingReviewRequired ? "text-destructive" : "text-muted-foreground"
                        }`}
                      >
                        {paymentLifecycleLabel(row)}
                      </p>
                    </td>
                    <td className="py-3 pr-3 text-xs text-muted-foreground">
                      {formatDateTime(row.createdAt)}
                    </td>
                    <td className="py-3 pr-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Select
                          value={manualStatusValueFor(row.status, row.provider)}
                          disabled={updatingStatusId === row.id}
                          onValueChange={(value) =>
                            void onManualStatusChange(row, value as ManualPaymentStatus)
                          }
                        >
                          <SelectTrigger
                            aria-label={`Set payment status for ${row.reference}`}
                            className="h-9 w-40 bg-white text-left"
                          >
                            <SelectValue placeholder="Set status" />
                          </SelectTrigger>
                          <SelectContent align="end">
                            {manualStatusOptionsFor(row).map((status) => (
                              <SelectItem key={status} value={status}>
                                {paymentStatusLabels[status]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {row.provider === "bank_transfer" &&
                        row.status === "awaiting_confirmation" ? (
                          <Button size="sm" onClick={() => openReview(row)}>
                            Review
                          </Button>
                        ) : row.provider === "bank_transfer" &&
                          row.bookingReviewRequired &&
                          row.status !== "succeeded" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={updatingStatusId === row.id}
                            onClick={() => void onRetryBooking(row)}
                          >
                            {updatingStatusId === row.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="mr-2 h-4 w-4" />
                            )}
                            Retry booking
                          </Button>
                        ) : row.provider === "bank_transfer" && row.status === "succeeded" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={updatingStatusId === row.id}
                            onClick={() => void onRecoverBooking(row)}
                          >
                            Restore booking
                          </Button>
                        ) : row.provider === "bank_transfer" && row.receiptPath ? (
                          <Button size="sm" variant="ghost" onClick={() => openReview(row)}>
                            View
                          </Button>
                        ) : row.provider === "paystack" &&
                          (row.status === "initiated" ||
                            row.status === "pending" ||
                            row.status === "succeeded") ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={verifyingPaystackId === row.id}
                            onClick={() => void onVerifyPaystack(row)}
                          >
                            {verifyingPaystackId === row.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="mr-2 h-4 w-4" />
                            )}
                            Check Paystack
                          </Button>
                        ) : null}
                        {canDeletePayment(row) ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            disabled={deletingId === row.id}
                            onClick={() => void onDeletePayment(row)}
                          >
                            {deletingId === row.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                            Delete eligible record
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">History protected</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog open={!!reviewing} onOpenChange={(open) => !open && setReviewing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review bank transfer</DialogTitle>
            <DialogDescription>
              Confirm the transfer landed in your account before approving.
            </DialogDescription>
          </DialogHeader>
          {reviewing ? (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Booking</p>
                  <p className="font-mono text-brand-deep">{reviewing.bookingReference ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Amount</p>
                  <p className="font-medium text-brand-deep">{formatNaira(reviewing.amountKobo)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Client</p>
                  <p>{reviewing.clientName ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{reviewing.clientEmail}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    Reference
                  </p>
                  <p className="font-mono text-xs">{reviewing.reference}</p>
                </div>
              </div>
              {reviewing.transferReference ? (
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    Transfer reference
                  </p>
                  <p className="rounded-md border border-border bg-muted/40 p-2 text-sm font-mono">
                    {reviewing.transferReference}
                  </p>
                </div>
              ) : null}
              {reviewing.transferNote ? (
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    Client note
                  </p>
                  <p className="rounded-md border border-border bg-muted/40 p-2 text-sm">
                    {reviewing.transferNote}
                  </p>
                </div>
              ) : null}
              {reviewing.receiptPath ? (
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Receipt</p>
                  {loadingReceipt ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Loading…
                    </div>
                  ) : receiptUrl ? (
                    <a
                      href={receiptUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-brand-deep underline"
                    >
                      Open receipt <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <p className="text-xs text-muted-foreground">Could not load receipt link.</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No receipt uploaded.</p>
              )}
              {reviewing.status === "awaiting_confirmation" ? (
                <div className="space-y-2">
                  <Label htmlFor="review-note">Internal note (optional)</Label>
                  <Textarea
                    id="review-note"
                    rows={2}
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder="Reason for rejection or verification detail…"
                  />
                </div>
              ) : (
                <div className="rounded-md border border-border bg-muted/40 p-2 text-xs">
                  Status: <StatusBadge status={reviewing.status} />
                  {reviewing.failedReason ? (
                    <p className="mt-1 text-muted-foreground">Reason: {reviewing.failedReason}</p>
                  ) : null}
                </div>
              )}
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Audit trail
                </p>
                {loadingReviews ? (
                  <div className="flex items-center gap-2 py-2 text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Loading history…
                  </div>
                ) : reviews.length === 0 ? (
                  <p className="py-2 text-xs text-muted-foreground">
                    No approvals or rejections recorded yet.
                  </p>
                ) : (
                  <ul className="mt-1 space-y-2">
                    {reviews.map((entry) => {
                      const approved = entry.action === "approve";
                      return (
                        <li
                          key={entry.id}
                          className="rounded-md border border-border bg-muted/30 p-2 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`inline-flex items-center gap-1 font-medium ${
                                approved ? "text-emerald-700" : "text-rose-700"
                              }`}
                            >
                              {approved ? (
                                <CheckCircle2 className="h-3 w-3" />
                              ) : (
                                <XCircle className="h-3 w-3" />
                              )}
                              {approved ? "Approved" : "Rejected"}
                            </span>
                            <span className="text-muted-foreground">
                              {formatDateTime(entry.createdAt)}
                            </span>
                          </div>
                          <div className="mt-1 text-brand-deep">
                            {entry.reviewerName || entry.reviewerEmail || "Unknown reviewer"}
                            {entry.reviewerName && entry.reviewerEmail ? (
                              <span className="ml-1 text-muted-foreground">
                                ({entry.reviewerEmail})
                              </span>
                            ) : null}
                          </div>
                          {entry.note ? (
                            <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                              “{entry.note}”
                            </p>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Payment timeline
                </p>
                {loadingEvents ? (
                  <div className="flex items-center gap-2 py-2 text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Loading timeline…
                  </div>
                ) : events.length === 0 ? (
                  <p className="py-2 text-xs text-muted-foreground">
                    No payment status events recorded yet.
                  </p>
                ) : (
                  <ul className="mt-1 space-y-2">
                    {events.map((event) => (
                      <li
                        key={event.id}
                        className="rounded-md border border-border bg-muted/30 p-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-brand-deep">{event.eventType}</span>
                          <span className="text-muted-foreground">
                            {formatDateTime(event.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1 text-muted-foreground">
                          {event.previousStatus ? `${event.previousStatus} → ` : ""}
                          {event.newStatus}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : null}
          {reviewing?.status === "awaiting_confirmation" ? (
            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                variant="outline"
                onClick={() => submitReview(false)}
                disabled={reviewBusy !== null}
              >
                {reviewBusy === "reject" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="mr-2 h-4 w-4" />
                )}
                Reject
              </Button>
              <Button onClick={() => submitReview(true)} disabled={reviewBusy !== null}>
                {reviewBusy === "approve" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Approve & confirm
              </Button>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>

      <SensitiveActionDialog
        state={stepUp.dialogState}
        onConfirm={stepUp.confirmStepUp}
        onOpenChange={(open) => {
          if (!open) stepUp.cancelStepUp();
        }}
      />
    </main>
  );
}
