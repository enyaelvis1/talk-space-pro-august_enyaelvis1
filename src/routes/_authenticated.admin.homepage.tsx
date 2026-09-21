import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  RotateCcw,
  Save,
} from "lucide-react";
import { toast } from "sonner";

import { AdminWorkspaceShell } from "@/components/progress/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getAdminHomepageWorkspace,
  updateAdminHomepageSectionCopy,
  updateAdminHomepageSections,
  updateAdminHomePricingSettings,
  type AdminHomepageSection,
  type AdminHomepageWorkspace,
} from "@/lib/admin.functions";
import {
  EDITABLE_HOMEPAGE_COPY_SECTIONS,
  type HomepageSectionCopyMap,
} from "@/lib/homepage-section-copy";
import type { HomepageSectionId } from "@/lib/content.functions";
import type { HomePricingBilling, HomePricingSettings } from "@/lib/content.functions";
import { canonicalUrl } from "@/lib/seo";

type LoaderData = AdminHomepageWorkspace;

/** Sections whose detailed content lives in a dedicated admin tool. */
const SECTION_EDITORS: Partial<Record<HomepageSectionId, { to: string; label: string }>> = {
  hero: { to: "/admin/hero", label: "Hero editor" },
  carousel: { to: "/admin/carousel", label: "Carousel editor" },
  trust: { to: "/admin/google-reviews", label: "Reviews settings" },
  specialties: { to: "/admin/services", label: "Services" },
  therapists: { to: "/admin/therapists", label: "Therapists" },
  pricing: { to: "/admin/services", label: "Pricing & services" },
  reviews: { to: "/admin/testimonials", label: "Testimonials" },
  journal: { to: "/admin/journal", label: "Journal posts" },
  faq: { to: "/admin/faqs", label: "FAQs" },
};

export const Route = createFileRoute("/_authenticated/admin/homepage")({
  loader: async (): Promise<LoaderData> => {
    return getAdminHomepageWorkspace();
  },
  head: () => ({
    meta: [
      { title: "Homepage sections | Talk Space Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: canonicalUrl("/admin/homepage") }],
  }),
  component: HomepageSectionsRoute,
});

function HomepageSectionsRoute() {
  const saved = Route.useLoaderData() as LoaderData;
  const [sections, setSections] = useState<AdminHomepageSection[]>(saved.sections);
  const [copy, setCopy] = useState<HomepageSectionCopyMap>(saved.copy);
  const [homePricing, setHomePricing] = useState<HomePricingSettings>(saved.homePricing);
  const [openId, setOpenId] = useState<HomepageSectionId | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    setSections(saved.sections);
    setCopy(saved.copy);
    setHomePricing(saved.homePricing);
  }, [saved]);

  const move = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= sections.length) return;
    setSections((current) => {
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const updateCopy = (id: HomepageSectionId, field: "eyebrow" | "title" | "body", value: string) =>
    setCopy((current) => ({ ...current, [id]: { ...current[id], [field]: value } }));

  const updateHomePricing = <Key extends keyof HomePricingSettings>(
    field: Key,
    value: HomePricingSettings[Key],
  ) => setHomePricing((current) => ({ ...current, [field]: value }));

  const updateHomePricingPlan = (
    planIndex: number,
    updater: (plan: HomePricingSettings["plans"][number]) => HomePricingSettings["plans"][number],
  ) =>
    setHomePricing((current) => ({
      ...current,
      plans: current.plans.map((plan, index) => (index === planIndex ? updater(plan) : plan)),
    }));

  const updateHomePricingFeature = (planIndex: number, featureIndex: number, value: string) =>
    updateHomePricingPlan(planIndex, (plan) => ({
      ...plan,
      features: plan.features.map((feature, index) => (index === featureIndex ? value : feature)),
    }));

  const reset = () => {
    setSections(saved.sections.map((section) => ({ ...section, visible: true })));
    setCopy(saved.copy);
    setHomePricing(saved.homePricing);
  };

  const save = async () => {
    setSaving(true);
    try {
      await Promise.all([
        updateAdminHomepageSections({
          data: { sections: sections.map(({ id, visible }) => ({ id, visible })) },
        }),
        updateAdminHomepageSectionCopy({ data: { copy } }),
        updateAdminHomePricingSettings({ data: homePricing }),
      ]);
      toast.success("Homepage layout and section content updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update homepage sections.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminWorkspaceShell>
      <main className="mx-auto w-full max-w-4xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Admin · Content</p>
            <h1 className="display-1 mt-3 text-brand-deep">Homepage sections</h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Choose which homepage sections are visible, arrange their order, and edit the heading
              copy shown to visitors. Save to publish.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPreviewing((current) => !current)}
            >
              <Eye className="mr-2 h-4 w-4" /> {previewing ? "Close preview" : "Preview draft"}
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save changes
            </Button>
          </div>
        </header>

        {previewing ? (
          <section className="overflow-hidden rounded-3xl border border-brand-deep/15 bg-surface-cream shadow-sm">
            <div className="border-b border-brand-deep/10 bg-white/70 px-5 py-4 sm:px-7">
              <p className="eyebrow">Draft preview</p>
              <p className="mt-2 text-sm text-muted-foreground">
                This preview uses your current unsaved layout and copy. Hidden sections are omitted
                just as they will be on the public homepage after saving.
              </p>
            </div>
            <div className="space-y-4 p-5 sm:p-7">
              {sections
                .filter((section) => section.visible)
                .map((section, index) => (
                  <div
                    key={section.id}
                    className={`rounded-2xl border px-5 py-5 ${
                      index === 0
                        ? "border-brand-mint/50 bg-brand-deep text-white"
                        : "border-border/70 bg-white"
                    }`}
                  >
                    <p
                      className={`text-xs font-semibold uppercase tracking-[0.16em] ${index === 0 ? "text-brand-mint" : "text-muted-foreground"}`}
                    >
                      {copy[section.id]?.eyebrow || `Section ${index + 1}`}
                    </p>
                    <p
                      className={`mt-2 text-lg font-semibold ${index === 0 ? "text-white" : "text-brand-deep"}`}
                    >
                      {copy[section.id]?.title || section.label}
                    </p>
                    {copy[section.id]?.body ? (
                      <p
                        className={`mt-2 text-sm ${index === 0 ? "text-white/80" : "text-muted-foreground"}`}
                      >
                        {copy[section.id].body}
                      </p>
                    ) : null}
                  </div>
                ))}
              {sections.every((section) => !section.visible) ? (
                <p className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
                  No homepage sections are visible in this draft.
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className="space-y-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-6">
          {sections.map((section, index) => {
            const editable = EDITABLE_HOMEPAGE_COPY_SECTIONS.includes(section.id);
            const editor = SECTION_EDITORS[section.id];
            const isOpen = openId === section.id;
            return (
              <article
                key={section.id}
                className={`rounded-xl border p-4 transition ${
                  section.visible
                    ? "border-border/70 bg-background"
                    : "border-dashed border-border bg-muted/30 opacity-70"
                }`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="w-7 text-center text-sm font-semibold text-muted-foreground">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-brand-deep">{section.label}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {copy[section.id]?.title ||
                        (section.visible ? "Visible on the homepage" : "Hidden from the homepage")}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label={`Move ${section.label} up`}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => move(index, 1)}
                    disabled={index === sections.length - 1}
                    aria-label={`Move ${section.label} down`}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  {editable ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setOpenId(isOpen ? null : section.id)}
                      aria-expanded={isOpen}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      {isOpen ? "Close" : "Edit content"}
                    </Button>
                  ) : null}
                  {editor ? (
                    <Button type="button" variant="ghost" size="sm" asChild>
                      <Link to={editor.to}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        {editor.label}
                      </Link>
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setSections((current) =>
                        current.map((item) =>
                          item.id === section.id ? { ...item, visible: !item.visible } : item,
                        ),
                      )
                    }
                  >
                    {section.visible ? (
                      <EyeOff className="mr-2 h-4 w-4" />
                    ) : (
                      <Eye className="mr-2 h-4 w-4" />
                    )}
                    {section.visible ? "Hide" : "Show"}
                  </Button>
                </div>

                {editable && isOpen ? (
                  <div className="mt-4 grid gap-4 rounded-lg border border-border/60 bg-muted/20 p-4">
                    <div className="grid gap-2">
                      <Label htmlFor={`${section.id}-eyebrow`}>Eyebrow</Label>
                      <Input
                        id={`${section.id}-eyebrow`}
                        value={copy[section.id]?.eyebrow ?? ""}
                        onChange={(event) => updateCopy(section.id, "eyebrow", event.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor={`${section.id}-title`}>Heading</Label>
                      <Input
                        id={`${section.id}-title`}
                        value={copy[section.id]?.title ?? ""}
                        onChange={(event) => updateCopy(section.id, "title", event.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor={`${section.id}-body`}>Supporting text</Label>
                      <Textarea
                        id={`${section.id}-body`}
                        rows={3}
                        value={copy[section.id]?.body ?? ""}
                        onChange={(event) => updateCopy(section.id, "body", event.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Leave blank to hide the supporting paragraph where the design allows it.
                      </p>
                    </div>
                    {section.id === "pricing" ? (
                      <HomePricingEditor
                        value={homePricing}
                        onChange={updateHomePricing}
                        onPlanChange={updateHomePricingPlan}
                        onFeatureChange={updateHomePricingFeature}
                      />
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>

        <Button type="button" variant="ghost" onClick={reset}>
          <RotateCcw className="mr-2 h-4 w-4" /> Reset changes
        </Button>
      </main>
    </AdminWorkspaceShell>
  );
}

function HomePricingEditor({
  value,
  onChange,
  onPlanChange,
  onFeatureChange,
}: {
  value: HomePricingSettings;
  onChange: <Key extends keyof HomePricingSettings>(
    field: Key,
    next: HomePricingSettings[Key],
  ) => void;
  onPlanChange: (
    planIndex: number,
    updater: (plan: HomePricingSettings["plans"][number]) => HomePricingSettings["plans"][number],
  ) => void;
  onFeatureChange: (planIndex: number, featureIndex: number, next: string) => void;
}) {
  return (
    <section className="grid gap-5 rounded-xl border border-brand-deep/15 bg-white p-4">
      <div>
        <p className="font-semibold text-brand-deep">Homepage pricing cards</p>
        <p className="mt-1 text-sm text-muted-foreground">
          These controls edit the three pricing cards and billing tabs shown on the homepage.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="home-pricing-full-label">Full pricing link label</Label>
          <Input
            id="home-pricing-full-label"
            value={value.fullPricingLabel}
            onChange={(event) => onChange("fullPricingLabel", event.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="home-pricing-full-href">Full pricing link URL</Label>
          <Input
            id="home-pricing-full-href"
            value={value.fullPricingHref}
            onChange={(event) => onChange("fullPricingHref", event.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="home-pricing-single-tab">Single-session tab label</Label>
          <Input
            id="home-pricing-single-tab"
            value={value.singleTabLabel}
            onChange={(event) => onChange("singleTabLabel", event.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="home-pricing-monthly-tab">Monthly tab label</Label>
          <Input
            id="home-pricing-monthly-tab"
            value={value.monthlyTabLabel}
            onChange={(event) => onChange("monthlyTabLabel", event.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="home-pricing-default-tab">Default selected tab</Label>
          <select
            id="home-pricing-default-tab"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm"
            value={value.defaultBilling}
            onChange={(event) =>
              onChange("defaultBilling", event.target.value as HomePricingBilling)
            }
          >
            <option value="single">Single session</option>
            <option value="monthly">One-month plan</option>
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="home-pricing-note">Footer note</Label>
          <Input
            id="home-pricing-note"
            value={value.note}
            onChange={(event) => onChange("note", event.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4">
        {value.plans.map((plan, planIndex) => (
          <article
            key={`${plan.name}-${planIndex}`}
            className="rounded-xl border border-border p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-semibold text-brand-deep">Card {planIndex + 1}</p>
              <label className="inline-flex items-center gap-2 text-sm text-brand-deep">
                <input
                  type="checkbox"
                  checked={plan.highlight}
                  onChange={(event) =>
                    onPlanChange(planIndex, (current) => ({
                      ...current,
                      highlight: event.target.checked,
                    }))
                  }
                />
                Highlight card
              </label>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor={`home-pricing-plan-${planIndex}-name`}>Card title</Label>
                <Input
                  id={`home-pricing-plan-${planIndex}-name`}
                  value={plan.name}
                  onChange={(event) =>
                    onPlanChange(planIndex, (current) => ({ ...current, name: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`home-pricing-plan-${planIndex}-badge`}>Badge label</Label>
                <Input
                  id={`home-pricing-plan-${planIndex}-badge`}
                  value={plan.badgeLabel}
                  onChange={(event) =>
                    onPlanChange(planIndex, (current) => ({
                      ...current,
                      badgeLabel: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2 md:col-span-2">
                <Label htmlFor={`home-pricing-plan-${planIndex}-description`}>Description</Label>
                <Textarea
                  id={`home-pricing-plan-${planIndex}-description`}
                  rows={2}
                  value={plan.description}
                  onChange={(event) =>
                    onPlanChange(planIndex, (current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              </div>
              <PricingTierFields
                planIndex={planIndex}
                type="single"
                label="Single-session"
                plan={plan}
                onPlanChange={onPlanChange}
              />
              <PricingTierFields
                planIndex={planIndex}
                type="monthly"
                label="Monthly"
                plan={plan}
                onPlanChange={onPlanChange}
              />
              <div className="grid gap-2">
                <Label htmlFor={`home-pricing-plan-${planIndex}-href`}>
                  Single-session CTA URL
                </Label>
                <Input
                  id={`home-pricing-plan-${planIndex}-href`}
                  value={plan.href}
                  onChange={(event) =>
                    onPlanChange(planIndex, (current) => ({ ...current, href: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`home-pricing-plan-${planIndex}-href-monthly`}>
                  Monthly CTA URL
                </Label>
                <Input
                  id={`home-pricing-plan-${planIndex}-href-monthly`}
                  value={plan.hrefMonthly}
                  onChange={(event) =>
                    onPlanChange(planIndex, (current) => ({
                      ...current,
                      hrefMonthly: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2 md:col-span-2">
                <Label htmlFor={`home-pricing-plan-${planIndex}-cta`}>Button label</Label>
                <Input
                  id={`home-pricing-plan-${planIndex}-cta`}
                  value={plan.ctaLabel}
                  onChange={(event) =>
                    onPlanChange(planIndex, (current) => ({
                      ...current,
                      ctaLabel: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              <Label>Feature bullets</Label>
              {plan.features.map((feature, featureIndex) => (
                <Input
                  key={`${plan.name}-feature-${featureIndex}`}
                  value={feature}
                  onChange={(event) => onFeatureChange(planIndex, featureIndex, event.target.value)}
                  aria-label={`Card ${planIndex + 1} feature ${featureIndex + 1}`}
                />
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function PricingTierFields({
  planIndex,
  type,
  label,
  plan,
  onPlanChange,
}: {
  planIndex: number;
  type: HomePricingBilling;
  label: string;
  plan: HomePricingSettings["plans"][number];
  onPlanChange: (
    planIndex: number,
    updater: (plan: HomePricingSettings["plans"][number]) => HomePricingSettings["plans"][number],
  ) => void;
}) {
  const tier = plan[type];
  return (
    <fieldset className="grid gap-3 rounded-lg border border-border/70 p-3">
      <legend className="px-1 text-sm font-medium text-brand-deep">{label}</legend>
      <div className="grid gap-2">
        <Label htmlFor={`home-pricing-plan-${planIndex}-${type}-price`}>Price</Label>
        <Input
          id={`home-pricing-plan-${planIndex}-${type}-price`}
          value={tier.price}
          onChange={(event) =>
            onPlanChange(planIndex, (current) => ({
              ...current,
              [type]: { ...current[type], price: event.target.value },
            }))
          }
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`home-pricing-plan-${planIndex}-${type}-cadence`}>Cadence</Label>
        <Input
          id={`home-pricing-plan-${planIndex}-${type}-cadence`}
          value={tier.cadence}
          onChange={(event) =>
            onPlanChange(planIndex, (current) => ({
              ...current,
              [type]: { ...current[type], cadence: event.target.value },
            }))
          }
        />
      </div>
    </fieldset>
  );
}
