import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CalendarCheck,
  CalendarPlus,
  CreditCard,
  Globe,
  Loader2,
  Mail,
  PanelBottom,
  Plus,
  Save,
  ShieldCheck,
  BellRing,
  CheckCircle2,
  CircleAlert,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";

import { AdminWorkspaceShell } from "@/components/progress/AdminSidebar";
import { formatWATTime } from "@/lib/time";
import { MediaUploadInput } from "@/components/admin/MediaUploadInput";
import { SensitiveActionDialog } from "@/components/admin/SensitiveActionDialog";
import { useSensitiveActionGate } from "@/hooks/useSensitiveActionGate";
import { updateAdminFooterSettings, updateAdminSiteDetails } from "@/lib/admin.functions";
import {
  DEFAULT_FOOTER_SETTINGS,
  DEFAULT_SITE_DETAILS,
  type PublicFooterSettings,
  type PublicSiteDetails,
} from "@/lib/content.functions";
import { getAdminSettingsWorkspace } from "@/lib/admin-settings.functions";
import { canonicalUrl } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  loader: async () => {
    return getAdminSettingsWorkspace();
  },
  head: () => ({
    meta: [
      { title: "Settings | Talk Space Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: canonicalUrl("/admin/settings") }],
  }),
  component: SettingsAdminRoute,
});

type SettingsLink = {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

function channel(value: number) {
  const normalized = value / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function contrastRatio(first: string, second: string) {
  const rgb = (hex: string) =>
    [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));
  const luminance = (hex: string) => {
    const [r, g, b] = rgb(hex).map(channel);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const settingsGroups: Array<{ title: string; items: SettingsLink[] }> = [
  {
    title: "Notifications",
    items: [
      {
        to: "/admin/emails",
        label: "Email delivery",
        description:
          "Sender identity, per-template toggles, provider API key, and reminder scheduling windows.",
        icon: Mail,
      },
      {
        to: "/admin/bookings",
        label: "Upcoming bookings & reminders",
        description: "Monitor reminder status and resend confirmation emails.",
        icon: BellRing,
      },
    ],
  },
  {
    title: "Payments",
    items: [
      {
        to: "/admin/payments",
        label: "Paystack & bank transfer",
        description:
          "Test/live mode, secret keys, bank account details, and manual transfer review queue.",
        icon: CreditCard,
      },
    ],
  },
  {
    title: "Scheduling",
    items: [
      {
        to: "/admin/availability",
        label: "Availability windows",
        description: "Add or remove one-off slots that override weekly rules.",
        icon: CalendarPlus,
      },
      {
        to: "/admin/google",
        label: "Google Calendar & Meet",
        description: "Connect each therapist's calendar; Meet links appear on confirmed bookings.",
        icon: CalendarCheck,
      },
    ],
  },
];

function SettingsAdminRoute() {
  const initial = Route.useLoaderData();
  const savedDetails = initial.siteDetails;
  const savedFooter = initial.footerSettings;
  const [details, setDetails] = useState<PublicSiteDetails>(savedDetails);
  const [saving, setSaving] = useState(false);
  const [footer, setFooter] = useState<PublicFooterSettings>(savedFooter);
  const [savingFooter, setSavingFooter] = useState(false);
  const stepUp = useSensitiveActionGate();

  useEffect(() => setDetails(savedDetails), [savedDetails]);
  useEffect(() => setFooter(savedFooter), [savedFooter]);

  const set = <K extends keyof PublicSiteDetails>(key: K, value: PublicSiteDetails[K]) =>
    setDetails((current) => ({ ...current, [key]: value }));
  const setFooterField = <K extends keyof PublicFooterSettings>(
    key: K,
    value: PublicFooterSettings[K],
  ) => setFooter((current) => ({ ...current, [key]: value }));
  const setFooterSectionTitle = (sectionIndex: number, title: string) =>
    setFooter((current) => ({
      ...current,
      sections: current.sections.map((section, index) =>
        index === sectionIndex ? { ...section, title } : section,
      ),
    }));
  const setFooterLink = (
    sectionIndex: number,
    linkIndex: number,
    key: "label" | "to",
    value: string,
  ) =>
    setFooter((current) => ({
      ...current,
      sections: current.sections.map((section, index) =>
        index === sectionIndex
          ? {
              ...section,
              links: section.links.map((link, innerIndex) =>
                innerIndex === linkIndex ? { ...link, [key]: value } : link,
              ),
            }
          : section,
      ),
    }));
  const addFooterSection = () =>
    setFooter((current) => ({
      ...current,
      sections: [
        ...current.sections,
        { title: "New column", links: [{ label: "New link", to: "/" }] },
      ].slice(0, 4),
    }));
  const removeFooterSection = (sectionIndex: number) =>
    setFooter((current) => ({
      ...current,
      sections:
        current.sections.length > 1
          ? current.sections.filter((_, index) => index !== sectionIndex)
          : current.sections,
    }));
  const addFooterLink = (sectionIndex: number) =>
    setFooter((current) => ({
      ...current,
      sections: current.sections.map((section, index) =>
        index === sectionIndex
          ? {
              ...section,
              links: [...section.links, { label: "New link", to: "/" }].slice(0, 8),
            }
          : section,
      ),
    }));
  const removeFooterLink = (sectionIndex: number, linkIndex: number) =>
    setFooter((current) => ({
      ...current,
      sections: current.sections.map((section, index) =>
        index === sectionIndex && section.links.length > 1
          ? { ...section, links: section.links.filter((_, innerIndex) => innerIndex !== linkIndex) }
          : section,
      ),
    }));
  const setFooterOffice = (officeIndex: number, key: "name" | "addressLines", value: string) =>
    setFooter((current) => ({
      ...current,
      offices: current.offices.map((office, index) =>
        index === officeIndex
          ? {
              ...office,
              [key]: key === "addressLines" ? value.split("\n").filter(Boolean) : value,
            }
          : office,
      ),
    }));
  const addFooterOffice = () =>
    setFooter((current) => ({
      ...current,
      offices: [...current.offices, { name: "New office", addressLines: ["Address"] }].slice(0, 6),
    }));
  const removeFooterOffice = (officeIndex: number) =>
    setFooter((current) => ({
      ...current,
      offices:
        current.offices.length > 1
          ? current.offices.filter((_, index) => index !== officeIndex)
          : current.offices,
    }));

  const appearance = details.appearance ?? DEFAULT_SITE_DETAILS.appearance!;
  const contrast = contrastRatio(appearance.backgroundColor, appearance.textColor);
  const integrationHealth = [
    {
      label: "Public site",
      to: "/admin/settings",
      ready: Boolean(details.brandName && details.email && details.phone),
      detail: "Brand, contact details, logo, social links, and appearance",
    },
    {
      label: "Email & Zoho",
      to: "/admin/emails",
      ready: Boolean(initial.email.isEnabled && initial.email.hasApiKey && initial.email.fromEmail),
      detail: initial.email.isEnabled ? "Resend delivery enabled" : "Email delivery disabled",
    },
    {
      label: "Payments",
      to: "/admin/payments",
      ready: Boolean(
        (initial.payments.isPaystackEnabled &&
          initial.payments.hasPaystackSecret &&
          initial.payments.paystackPublicKey) ||
        (initial.payments.isBankTransferEnabled && initial.payments.bankAccountNumber),
      ),
      detail: `${initial.payments.mode === "live" ? "Live" : "Test"} mode · Paystack and bank transfer`,
    },
    {
      label: "Google Calendar",
      to: "/admin/google",
      ready: Boolean(
        initial.google.isEnabled && initial.google.clientId && initial.google.hasClientSecret,
      ),
      detail: initial.google.isEnabled
        ? "Calendar synchronization enabled"
        : "Integration disabled",
    },
  ];

  async function saveSiteDetails() {
    if (contrast < 4.5) {
      toast.error(
        `Text contrast is ${contrast.toFixed(2)}:1. Choose colors with at least 4.5:1 contrast.`,
      );
      return;
    }
    const stepUpAllowed = await stepUp.requestStepUp("save the workspace settings");
    if (!stepUpAllowed) return;
    setSaving(true);
    try {
      await updateAdminSiteDetails({ data: details });
      toast.success("Site settings saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save site settings.");
    } finally {
      setSaving(false);
    }
  }

  async function saveFooterSettings() {
    const stepUpAllowed = await stepUp.requestStepUp("save the footer settings");
    if (!stepUpAllowed) return;
    setSavingFooter(true);
    try {
      await updateAdminFooterSettings({ data: footer });
      toast.success("Footer settings saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save footer settings.");
    } finally {
      setSavingFooter(false);
    }
  }

  return (
    <AdminWorkspaceShell>
      <main className="mx-auto w-full max-w-5xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
        <header>
          <p className="eyebrow">Admin · Settings</p>
          <h1 className="display-1 mt-3 text-brand-deep">Workspace settings</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Central hub for the settings that power notifications, payments, scheduling, and admin
            access. Each area has its own dedicated screen.
          </p>
        </header>

        <section aria-labelledby="integration-health-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Configuration overview</p>
              <h2
                id="integration-health-heading"
                className="mt-2 text-2xl font-semibold text-brand-deep"
              >
                Site and integration health
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                One place to confirm the active website, email, payment, and scheduling setup.
              </p>
            </div>
            <span className="rounded-full border border-border/70 bg-card px-3 py-1 text-xs font-medium text-brand-deep">
              {integrationHealth.filter((item) => item.ready).length}/{integrationHealth.length}{" "}
              ready
            </span>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {integrationHealth.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className="group rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition-colors hover:border-brand-deep/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-brand-deep group-hover:underline">
                      {item.label}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                      item.ready ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {item.ready ? (
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <CircleAlert className="h-3.5 w-3.5" aria-hidden />
                    )}
                    {item.ready ? "Ready" : "Needs setup"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Security</p>
              <h2 className="mt-2 text-lg font-semibold text-brand-deep">
                MFA readiness and step-up protection
              </h2>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                Sensitive admin changes are unlocked for a short window after a password
                reconfirmation. If the current session already has MFA assurance, the workspace
                notes that as well.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-border/70 bg-muted/30 px-3 py-2 text-xs font-medium text-brand-deep">
              <ShieldCheck className="h-4 w-4" aria-hidden />
              {stepUp.dialogState.currentLevel === "aal2"
                ? "MFA verified"
                : stepUp.dialogState.nextLevel === "aal2"
                  ? "MFA available"
                  : "Password step-up"}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <SecurityStat
              label="Current assurance"
              value={
                stepUp.dialogState.currentLevel === "aal2"
                  ? "AAL2"
                  : stepUp.dialogState.currentLevel === "aal1"
                    ? "AAL1"
                    : "Unknown"
              }
              note="The live session strength reported by Supabase."
            />
            <SecurityStat
              label="Step-up window"
              value={
                stepUp.dialogState.stepUpExpiresAt
                  ? formatWATTime(stepUp.dialogState.stepUpExpiresAt)
                  : "Locked"
              }
              note="Changes stay unlocked for 10 minutes after reconfirmation."
            />
            <SecurityStat
              label="MFA readiness"
              value={
                stepUp.dialogState.currentLevel === "aal2"
                  ? "Ready"
                  : stepUp.dialogState.nextLevel === "aal2"
                    ? "Available"
                    : "Password step-up"
              }
              note="When a second factor is enrolled, the same gate will treat it as MFA."
            />
          </div>
        </section>

        <section className="space-y-6 rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/60 pb-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-mint text-brand-deep">
                <Globe className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-brand-deep">Site details</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Update the public contact details and social links used across the website.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void saveSiteDetails()}
              disabled={saving}
              className="inline-flex h-10 items-center justify-center rounded-full bg-brand-deep px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-deep/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save site details
            </button>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Brand name"
              value={details.brandName}
              onChange={(value) => set("brandName", value)}
            />
            <Field
              label="Tagline"
              value={details.tagline}
              onChange={(value) => set("tagline", value)}
            />
            <Field
              label="Contact email"
              type="email"
              value={details.email}
              onChange={(value) => set("email", value)}
            />
            <Field
              label="Phone number"
              value={details.phone}
              onChange={(value) => set("phone", value)}
            />
            <Field
              label="WhatsApp number"
              value={details.whatsapp}
              onChange={(value) => set("whatsapp", value)}
            />
            <Field
              label="Opening hours"
              value={details.hours}
              onChange={(value) => set("hours", value)}
            />
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold text-brand-deep">Social links</h3>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Facebook URL"
                value={details.facebook}
                onChange={(value) => set("facebook", value)}
              />
              <Field
                label="Twitter / X URL"
                value={details.twitter}
                onChange={(value) => set("twitter", value)}
              />
              <Field
                label="Instagram URL"
                value={details.instagram}
                onChange={(value) => set("instagram", value)}
              />
              <Field
                label="LinkedIn URL"
                value={details.linkedin}
                onChange={(value) => set("linkedin", value)}
              />
              <Field
                label="YouTube URL"
                value={details.youtube}
                onChange={(value) => set("youtube", value)}
              />
            </div>
          </div>

          <div className="space-y-5 border-t border-border/60 pt-5">
            <div>
              <h3 className="text-sm font-semibold text-brand-deep">Brand and appearance</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Upload the logo used by the public site and set the core page colors. Keep text and
                background contrast readable when choosing custom colors.
              </p>
            </div>
            <MediaUploadInput
              label="Site logo"
              value={details.logoPath ?? ""}
              onChange={(value) => set("logoPath", value)}
              folder="brand"
              helpText="Upload a transparent PNG or SVG, or paste an existing image URL."
            />
            <MediaUploadInput
              label="Favicon"
              value={details.faviconPath ?? ""}
              onChange={(value) => set("faviconPath", value)}
              folder="brand"
              helpText="Used for the browser tab icon."
            />
            <MediaUploadInput
              label="Social-share image"
              value={details.socialImagePath ?? ""}
              onChange={(value) => set("socialImagePath", value)}
              folder="brand"
              helpText="Used when pages are shared on social networks."
            />
            <div className="grid gap-5 sm:grid-cols-3">
              {(
                [
                  ["backgroundColor", "Page background"],
                  ["textColor", "Text color"],
                  ["accentColor", "Accent color"],
                ] as const
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center gap-3 text-sm font-medium text-brand-deep"
                >
                  <input
                    type="color"
                    value={details.appearance?.[key] ?? "#ffffff"}
                    onChange={(event) =>
                      set("appearance", {
                        ...(details.appearance ?? DEFAULT_SITE_DETAILS.appearance!),
                        [key]: event.target.value,
                      })
                    }
                    className="h-10 w-14 cursor-pointer rounded border border-border bg-transparent p-1"
                  />
                  {label}
                </label>
              ))}
            </div>
            <div className="grid gap-5 border-t border-border/60 pt-5 sm:grid-cols-2 lg:grid-cols-3">
              <SelectField
                label="Body font"
                value={appearance.bodyFont}
                onChange={(value) =>
                  set("appearance", { ...appearance, bodyFont: value as "sans" | "serif" })
                }
                options={[
                  ["sans", "Inter Sans"],
                  ["serif", "Readable Serif"],
                ]}
              />
              <SelectField
                label="Heading font"
                value={appearance.headingFont}
                onChange={(value) =>
                  set("appearance", { ...appearance, headingFont: value as "display" | "sans" })
                }
                options={[
                  ["display", "Fraunces Display"],
                  ["sans", "Sans-serif"],
                ]}
              />
              <SelectField
                label="Base font size"
                value={appearance.baseFontSize}
                onChange={(value) =>
                  set("appearance", { ...appearance, baseFontSize: value as "sm" | "md" | "lg" })
                }
                options={[
                  ["sm", "Small"],
                  ["md", "Medium"],
                  ["lg", "Large"],
                ]}
              />
              <SelectField
                label="Button style"
                value={appearance.buttonStyle}
                onChange={(value) =>
                  set("appearance", {
                    ...appearance,
                    buttonStyle: value as "rounded" | "pill" | "square",
                  })
                }
                options={[
                  ["rounded", "Rounded"],
                  ["pill", "Pill"],
                  ["square", "Square"],
                ]}
              />
              <SelectField
                label="Section spacing"
                value={appearance.sectionSpacing}
                onChange={(value) =>
                  set("appearance", {
                    ...appearance,
                    sectionSpacing: value as "compact" | "comfortable" | "spacious",
                  })
                }
                options={[
                  ["compact", "Compact"],
                  ["comfortable", "Comfortable"],
                  ["spacious", "Spacious"],
                ]}
              />
              <div
                className={`rounded-xl border p-3 text-sm ${contrast >= 4.5 ? "border-brand-mint/50 bg-brand-mint-soft/30 text-brand-deep" : "border-red-300 bg-red-50 text-red-700"}`}
              >
                <p className="font-semibold">Text contrast: {contrast.toFixed(2)}:1</p>
                <p className="mt-1 text-xs">
                  {contrast >= 4.5
                    ? "Passes WCAG AA for normal text."
                    : "Needs at least 4.5:1 before saving."}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-6 rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/60 pb-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-mint text-brand-deep">
                <PanelBottom className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-brand-deep">Footer settings</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Edit the public footer message, legal strip, and navigation columns.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void saveFooterSettings()}
              disabled={savingFooter}
              className="inline-flex h-10 items-center justify-center rounded-full bg-brand-deep px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-deep/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingFooter ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save footer
            </button>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Crisis heading"
              value={footer.crisisHeading}
              onChange={(value) => setFooterField("crisisHeading", value)}
            />
            <Field
              label="Crisis text"
              value={footer.crisisText}
              onChange={(value) => setFooterField("crisisText", value)}
            />
            <Field
              label="Crisis button label"
              value={footer.crisisCtaLabel}
              onChange={(value) => setFooterField("crisisCtaLabel", value)}
            />
            <Field
              label="Crisis button link"
              value={footer.crisisCtaHref}
              onChange={(value) => setFooterField("crisisCtaHref", value)}
            />
          </div>

          <TextareaField
            label="Footer description"
            value={footer.description}
            onChange={(value) => setFooterField("description", value)}
            rows={4}
          />

          <div className="space-y-4 border-t border-border/60 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-brand-deep">Office locations</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Each office appears separately in the public footer.
                </p>
              </div>
              <button
                type="button"
                onClick={addFooterOffice}
                disabled={footer.offices.length >= 6}
                className="inline-flex h-9 items-center rounded-full border border-border px-3 text-sm font-medium text-brand-deep transition-colors hover:bg-muted disabled:opacity-50"
              >
                <Plus className="mr-2 h-4 w-4" aria-hidden />
                Add office
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {footer.offices.map((office, officeIndex) => (
                <div
                  key={`${office.name}-${officeIndex}`}
                  className="space-y-4 rounded-xl border border-border/70 bg-background p-4"
                >
                  <div className="flex items-end gap-3">
                    <div className="min-w-0 flex-1">
                      <Field
                        label="Office name"
                        value={office.name}
                        onChange={(value) => setFooterOffice(officeIndex, "name", value)}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFooterOffice(officeIndex)}
                      disabled={footer.offices.length <= 1}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border text-destructive hover:bg-destructive/10 disabled:opacity-40"
                      aria-label={`Remove ${office.name}`}
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                  <TextareaField
                    label="Address lines"
                    value={office.addressLines.join("\n")}
                    onChange={(value) => setFooterOffice(officeIndex, "addressLines", value)}
                    rows={3}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Bottom-left text"
              value={footer.bottomLeft}
              onChange={(value) => setFooterField("bottomLeft", value)}
            />
            <Field
              label="Bottom-right text"
              value={footer.bottomRight}
              onChange={(value) => setFooterField("bottomRight", value)}
            />
          </div>

          <label className="flex items-center gap-3 rounded-xl border border-border/70 bg-background px-4 py-3 text-sm font-medium text-brand-deep">
            <input
              type="checkbox"
              checked={footer.showSocialLinks}
              onChange={(event) => setFooterField("showSocialLinks", event.target.checked)}
              className="h-4 w-4 rounded border-border text-brand-deep focus:ring-brand-mint"
            />
            Show social media icons in the footer
          </label>

          <div className="space-y-4 border-t border-border/60 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-brand-deep">Footer navigation</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Use internal paths like /services or a full URL for external links.
                </p>
              </div>
              <button
                type="button"
                onClick={addFooterSection}
                disabled={footer.sections.length >= 4}
                className="inline-flex h-9 items-center rounded-full border border-border px-3 text-sm font-medium text-brand-deep transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="mr-2 h-4 w-4" aria-hidden />
                Add column
              </button>
            </div>

            <div className="space-y-5">
              {footer.sections.map((section, sectionIndex) => (
                <div
                  key={`${section.title}-${sectionIndex}`}
                  className="rounded-xl border border-border/70 bg-background p-4"
                >
                  <div className="flex items-end gap-3">
                    <div className="min-w-0 flex-1">
                      <Field
                        label="Column title"
                        value={section.title}
                        onChange={(value) => setFooterSectionTitle(sectionIndex, value)}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFooterSection(sectionIndex)}
                      disabled={footer.sections.length <= 1}
                      className="mb-0.5 inline-flex h-10 w-10 items-center justify-center rounded-md border border-border text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={`Remove ${section.title} footer column`}
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {section.links.map((link, linkIndex) => (
                      <div
                        key={`${link.label}-${linkIndex}`}
                        className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]"
                      >
                        <Field
                          label="Link label"
                          value={link.label}
                          onChange={(value) =>
                            setFooterLink(sectionIndex, linkIndex, "label", value)
                          }
                        />
                        <Field
                          label="Link URL"
                          value={link.to}
                          onChange={(value) => setFooterLink(sectionIndex, linkIndex, "to", value)}
                        />
                        <button
                          type="button"
                          onClick={() => removeFooterLink(sectionIndex, linkIndex)}
                          disabled={section.links.length <= 1}
                          className="mt-6 inline-flex h-10 w-10 items-center justify-center rounded-md border border-border text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label={`Remove ${link.label} footer link`}
                        >
                          <X className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => addFooterLink(sectionIndex)}
                    disabled={section.links.length >= 8}
                    className="mt-4 inline-flex h-9 items-center rounded-full border border-border px-3 text-sm font-medium text-brand-deep transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus className="mr-2 h-4 w-4" aria-hidden />
                    Add link
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {settingsGroups.map((group) => (
          <section key={group.title} className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {group.title}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="group flex items-start gap-4 rounded-2xl border border-border/70 bg-card p-5 transition-colors hover:border-brand-deep/40 hover:bg-brand-mint-soft/30"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-mint text-brand-deep">
                      <Icon className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-brand-deep group-hover:underline">
                        {item.label}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}

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

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-sm font-medium text-brand-deep">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-mint"
      />
    </label>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label className="block text-sm font-medium text-brand-deep">
      {label}
      <textarea
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-mint"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="block text-sm font-medium text-brand-deep">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-mint"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function SecurityStat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-brand-deep">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{note}</p>
    </div>
  );
}
