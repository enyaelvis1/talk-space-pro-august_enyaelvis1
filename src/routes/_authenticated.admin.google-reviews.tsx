import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, ExternalLink, Loader2, Plus, RefreshCw, Save, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AdminWorkspaceShell } from "@/components/progress/AdminSidebar";
import { formatWATDateTime } from "@/lib/time";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getAdminGoogleReviewSettings,
  updateAdminGoogleReviewSettings,
  importGoogleReviewsFromUrl,
  type AdminGoogleReviewSettings,
} from "@/lib/admin.functions";
import { serializeGoogleReviewsCsv } from "@/lib/google-review-csv";
import { canonicalUrl } from "@/lib/seo";
import { resolveImageSrc } from "@/lib/site-assets";

const DEFAULT_GOOGLE_REVIEW_SETTINGS: AdminGoogleReviewSettings = {
  label: "on Google",
  rating: 5,
  reviewCount: 51,
  reviewUrl:
    "https://www.google.com/maps/place/Talk+Space+Counselling/@6.6023494,3.3490401,17z/data=!4m14!1m7!3m6!1s0x103b8de64685748f:0x8dc76851d944dcc5!2sTalk+Space+Counselling!8m2!3d6.6023494!4d3.351615!16s%2Fg%2F11thf1nftr!3m5!1s0x103b8de64685748f:0x8dc76851d944dcc5!8m2!3d6.6023494!4d3.351615!16s%2Fg%2F11thf1nftr?entry=ttu",
  googlePlaceId: "ChIJj3SFRuaNOxARxdxE2VFox40",
  lastSyncedAt: null,
  lastSyncSource: null,
  lastSyncError: null,
  reviews: [],
};

type LoaderData = {
  settings: AdminGoogleReviewSettings;
  loadError: string | null;
};

export const Route = createFileRoute("/_authenticated/admin/google-reviews")({
  loader: async (): Promise<LoaderData> => {
    try {
      return { settings: await getAdminGoogleReviewSettings(), loadError: null };
    } catch (error) {
      console.error("[admin/google-reviews] failed to load settings", error);
      return {
        settings: DEFAULT_GOOGLE_REVIEW_SETTINGS,
        loadError:
          error instanceof Error ? error.message : "Google Reviews settings could not be loaded.",
      };
    }
  },
  head: () => ({
    meta: [{ title: "Google Reviews | Talk Space Admin" }],
    links: [{ rel: "canonical", href: canonicalUrl("/admin/google-reviews") }],
  }),
  component: GoogleReviewsAdminRoute,
});

function GoogleReviewsAdminRoute() {
  const saved = Route.useLoaderData();
  const [form, setForm] = useState<AdminGoogleReviewSettings>(saved.settings);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [draft, setDraft] = useState({ name: "", date: "", quote: "", location: "" });
  useEffect(() => setForm(saved.settings), [saved.settings]);
  const set = <K extends keyof AdminGoogleReviewSettings>(
    key: K,
    value: AdminGoogleReviewSettings[K],
  ) => setForm((current) => ({ ...current, [key]: value }));

  async function importReviews() {
    setImporting(true);
    try {
      const result = await importGoogleReviewsFromUrl();
      if (result.imported > 0) {
        toast.success(`Imported ${result.imported} new reviews from ${result.source ?? "Google"}.`);
        const updated = await getAdminGoogleReviewSettings();
        setForm(updated);
        return;
      }

      const message =
        result.error ??
        "No new reviews were found. Configure Google API credentials, use a direct Google Maps review link, or add reviews manually.";
      toast.error(`Import error: ${message}`);
      const updated = await getAdminGoogleReviewSettings();
      setForm(updated);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to import reviews.");
    } finally {
      setImporting(false);
    }
  }

  function addReview() {
    const name = draft.name.trim();
    const quote = draft.quote.trim();
    if (!name || !quote) {
      toast.error("Name and review text are required.");
      return;
    }
    setForm((current) => ({
      ...current,
      reviews: [
        {
          name,
          date: draft.date.trim() || "Google review",
          quote,
          location: draft.location.trim() || undefined,
        },
        ...current.reviews,
      ],
    }));
    setDraft({ name: "", date: "", quote: "", location: "" });
  }

  function removeReview(index: number) {
    setForm((current) => ({
      ...current,
      reviews: current.reviews.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  async function save() {
    setSaving(true);
    try {
      await updateAdminGoogleReviewSettings({ data: form });
      toast.success("Google Reviews settings updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update Google Reviews.");
    } finally {
      setSaving(false);
    }
  }

  function downloadReviews() {
    const csv = serializeGoogleReviewsCsv(form.reviews);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `google-reviews-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AdminWorkspaceShell>
      <main className="mx-auto w-full max-w-4xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Admin · Content</p>
            <h1 className="display-1 mt-3 text-brand-deep">Google Reviews</h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Update the rating summary shown on the homepage and manage the public review list.
              Import uses Google Business Profile when configured, with Google Places API as a
              fallback.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={() => void importReviews()}
              disabled={importing || saving}
              variant="outline"
            >
              {importing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Import now
            </Button>
            <Button onClick={() => void save()} disabled={saving || importing}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save reviews
            </Button>
            <Button onClick={downloadReviews} disabled={saving || importing} variant="outline">
              <Download className="mr-2 h-4 w-4" aria-hidden />
              Download CSV
            </Button>
          </div>
        </header>

        <section className="space-y-6 rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
          {saved.loadError ? (
            <Alert variant="destructive">
              <AlertTitle>Settings loaded with fallback values</AlertTitle>
              <AlertDescription>
                {saved.loadError} Check your admin session and Supabase access, then save to create
                the Google Reviews settings row if it is missing.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="flex items-center gap-3 border-b border-border/60 pb-4">
            <div className="rounded-xl bg-amber-100 p-3 text-amber-700">
              <Star className="h-5 w-5 fill-current" aria-hidden />
            </div>
            <div>
              <h2 className="font-semibold text-brand-deep">Public rating summary</h2>
              <p className="text-sm text-muted-foreground">These values appear on the homepage.</p>
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Rating</Label>
              <Input
                type="number"
                min="0"
                max="5"
                step="0.1"
                value={form.rating}
                onChange={(event) => set("rating", Number(event.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Review count</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={form.reviewCount}
                onChange={(event) => set("reviewCount", Number(event.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Label</Label>
              <Input
                value={form.label}
                onChange={(event) => set("label", event.target.value)}
                placeholder="on Google"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Google Business reviews URL</Label>
            <Input
              type="url"
              value={form.reviewUrl}
              onChange={(event) => set("reviewUrl", event.target.value)}
              placeholder="https://www.google.com/maps/..."
            />
            <p className="text-xs text-muted-foreground">
              Used as the public link visitors open from the homepage.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Google Place ID</Label>
            <Input
              value={form.googlePlaceId}
              onChange={(event) => set("googlePlaceId", event.target.value)}
              placeholder="places/ChIJ... or ChIJ..."
            />
            <p className="text-xs text-muted-foreground">
              Used with `GOOGLE_PLACES_API_KEY` for official Places API review sync.
            </p>
          </div>
          <div className="rounded-xl border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
            <p>
              Last sync:{" "}
              <span className="font-medium text-brand-deep">
                {form.lastSyncedAt ? formatWATDateTime(form.lastSyncedAt) : "Not synced yet"}
              </span>
              {form.lastSyncSource ? ` via ${form.lastSyncSource}` : ""}
            </p>
            {form.lastSyncError ? (
              <p className="mt-2 text-destructive">{form.lastSyncError}</p>
            ) : null}
          </div>
          <a
            href={form.reviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-sm font-medium text-brand-blue hover:underline"
          >
            Test review link <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </section>

        <section className="space-y-5 rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold text-brand-deep">Imported Google reviews</h2>
              <p className="text-sm text-muted-foreground">
                These reviews appear on the public site review carousel.
              </p>
            </div>
          </div>

          <div className="grid gap-3 rounded-xl border border-dashed border-border/80 bg-muted/30 p-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-1">
              <Label>Name</Label>
              <Input
                value={draft.name}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Client name"
              />
            </div>
            <div className="space-y-2 sm:col-span-1">
              <Label>Date</Label>
              <Input
                value={draft.date}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, date: event.target.value }))
                }
                placeholder="February 1, 2026"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Location</Label>
              <Input
                value={draft.location}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, location: event.target.value }))
                }
                placeholder="Optional city or service area"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Review quote</Label>
              <Textarea
                rows={4}
                value={draft.quote}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, quote: event.target.value }))
                }
                placeholder="Paste the review text"
              />
            </div>
            <div className="sm:col-span-2">
              <Button onClick={addReview} variant="outline" className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" /> Add review
              </Button>
            </div>
          </div>

          {form.reviews.length === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              No imported reviews yet. Add Google reviews to populate the public review carousel.
            </p>
          ) : (
            <div className="space-y-3">
              {form.reviews.map((review, index) => (
                <div
                  key={`${review.name}-${index}`}
                  className="rounded-xl border border-border/70 bg-background p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      {review.avatarPath ? (
                        <img
                          src={resolveImageSrc(review.avatarPath) ?? review.avatarPath}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-full object-cover"
                          loading="lazy"
                        />
                      ) : null}
                      <div className="min-w-0">
                        <p className="font-medium text-brand-deep">{review.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {review.date}
                          {review.location ? ` · ${review.location}` : ""}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeReview(index)}
                      aria-label={`Remove review from ${review.name}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">“{review.quote}”</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </AdminWorkspaceShell>
  );
}
