import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Image, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { AdminWorkspaceShell } from "@/components/progress/AdminSidebar";
import { MediaUploadInput } from "@/components/admin/MediaUploadInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_HERO_SETTINGS } from "@/lib/content.functions";
import {
  getAdminHeroSettings,
  updateAdminHeroSettings,
  type AdminHeroSettings,
} from "@/lib/admin.functions";
import { canonicalUrl } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/admin/hero")({
  loader: async () => {
    try {
      return await getAdminHeroSettings();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/site_settings|schema cache|relation .* does not exist/i.test(message)) {
        throw new Error(
          "Hero settings are not available yet. Run `supabase db push`, then refresh this page.",
        );
      }
      throw error;
    }
  },
  head: () => ({
    meta: [
      { title: "Hero section | Talk Space Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: canonicalUrl("/admin/hero") }],
  }),
  errorComponent: ({ error }) => (
    <AdminWorkspaceShell>
      <main className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
        <p className="eyebrow">Admin · Content</p>
        <h1 className="display-1 mt-3 text-brand-deep">Hero section unavailable</h1>
        <p className="mt-4 text-muted-foreground">
          {error instanceof Error ? error.message : "Failed to load hero settings."}
        </p>
      </main>
    </AdminWorkspaceShell>
  ),
  component: HeroAdminRoute,
});

function HeroAdminRoute() {
  const saved = Route.useLoaderData();
  const [form, setForm] = useState<AdminHeroSettings>(saved ?? DEFAULT_HERO_SETTINGS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(saved ?? DEFAULT_HERO_SETTINGS);
  }, [saved]);

  const set = <K extends keyof AdminHeroSettings>(key: K, value: AdminHeroSettings[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function save() {
    setSaving(true);
    try {
      await updateAdminHeroSettings({ data: form });
      toast.success("Hero section updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update hero section.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminWorkspaceShell>
      <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Admin · Content</p>
            <h1 className="display-1 mt-3 text-brand-deep">Hero section</h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Update the homepage hero copy and carousel images. Changes are public after saving.
            </p>
          </div>
          <Button onClick={save} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save hero
          </Button>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="space-y-5 rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 border-b border-border/60 pb-4">
              <Image className="h-4 w-4 text-brand-mint" />
              <h2 className="font-semibold text-brand-deep">Hero copy</h2>
            </div>
            <Field label="Eyebrow" value={form.eyebrow} onChange={(v) => set("eyebrow", v)} />
            <Field
              label="Heading before emphasis"
              value={form.headingBefore}
              onChange={(v) => set("headingBefore", v)}
            />
            <Field
              label="Emphasised heading"
              value={form.headingEmphasis}
              onChange={(v) => set("headingEmphasis", v)}
            />
            <div className="space-y-1.5">
              <Label htmlFor="hero-description">Description</Label>
              <Textarea
                id="hero-description"
                rows={5}
                value={form.description}
                onChange={(event) => set("description", event.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Primary button"
                value={form.primaryCtaLabel}
                onChange={(v) => set("primaryCtaLabel", v)}
              />
              <Field
                label="Secondary button"
                value={form.secondaryCtaLabel}
                onChange={(v) => set("secondaryCtaLabel", v)}
              />
            </div>
          </section>

          <section className="space-y-5 rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 border-b border-border/60 pb-4">
              <Image className="h-4 w-4 text-brand-mint" />
              <h2 className="font-semibold text-brand-deep">Hero images</h2>
            </div>
            <MediaUploadInput
              label="Slide one"
              value={form.imageOnePath ?? ""}
              onChange={(v) => set("imageOnePath", v || null)}
              folder="hero"
              returnAs="path"
              placeholder="Image URL or upload"
              helpText="Upload a new image or paste an existing public URL."
            />
            <Field
              label="Slide one alt text"
              value={form.imageOneAlt}
              onChange={(v) => set("imageOneAlt", v)}
            />
            <MediaUploadInput
              label="Slide two"
              value={form.imageTwoPath ?? ""}
              onChange={(v) => set("imageTwoPath", v || null)}
              folder="hero"
              returnAs="path"
              placeholder="Image URL or upload"
              helpText="Leave empty to keep the default second slide."
            />
            <Field
              label="Slide two alt text"
              value={form.imageTwoAlt}
              onChange={(v) => set("imageTwoAlt", v)}
            />
          </section>
        </div>
      </main>
    </AdminWorkspaceShell>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = `hero-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
