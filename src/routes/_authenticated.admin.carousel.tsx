import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { GripVertical, Image, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { MediaUploadInput } from "@/components/admin/MediaUploadInput";
import { AdminWorkspaceShell } from "@/components/progress/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getAdminCarousel,
  updateAdminCarousel,
  type AdminCarouselItem,
} from "@/lib/admin.functions";
import { canonicalUrl } from "@/lib/seo";

const DEFAULT_ITEMS: AdminCarouselItem[] = [
  ["Individual Therapy", "Individual therapy in a calm counselling setting."],
  ["Couple Therapy", "A couple in a supportive counselling session."],
  ["Teen & Child Therapy", "Family counselling support for children and teens."],
  ["Individual Psychotherapy", "A warm therapy room prepared for individual psychotherapy."],
  ["Trauma & PTSD", "A client receiving trauma and PTSD counselling support."],
  ["Premarital Counselling", "A couple receiving premarital counselling."],
  ["Family Therapy", "Family therapy in a welcoming counselling setting."],
].map(([title, alt]) => ({ title, alt, imageUrl: null }));

export const Route = createFileRoute("/_authenticated/admin/carousel")({
  loader: () => getAdminCarousel(),
  head: () => ({
    meta: [{ title: "Homepage carousel | Talk Space Admin" }],
    links: [{ rel: "canonical", href: canonicalUrl("/admin/carousel") }],
  }),
  component: CarouselAdminRoute,
});

function CarouselAdminRoute() {
  const saved = Route.useLoaderData();
  const [items, setItems] = useState<AdminCarouselItem[]>(saved?.length ? saved : DEFAULT_ITEMS);
  const [saving, setSaving] = useState(false);
  useEffect(() => setItems(saved?.length ? saved : DEFAULT_ITEMS), [saved]);

  const update = (index: number, patch: Partial<AdminCarouselItem>) =>
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  const save = async () => {
    setSaving(true);
    try {
      await updateAdminCarousel({ data: { items } });
      toast.success("Homepage carousel updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update carousel.");
    } finally {
      setSaving(false);
    }
  };

  const saveButton = (
    <Button onClick={() => void save()} disabled={saving}>
      {saving ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Save className="mr-2 h-4 w-4" />
      )}
      Save carousel
    </Button>
  );

  return (
    <AdminWorkspaceShell>
      <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Admin · Content</p>
            <h1 className="display-1 mt-3 text-brand-deep">Homepage carousel</h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Edit the slides shown in the scrolling therapy-specialties carousel on the homepage.
              Empty images keep the built-in brand imagery.
            </p>
          </div>
          {saveButton}
        </header>

        <section className="space-y-5">
          {items.map((item, index) => (
            <article
              key={index}
              className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm"
            >
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-brand-deep">
                  <GripVertical className="h-4 w-4 text-muted-foreground" aria-hidden />
                  Slide {index + 1}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
                  disabled={items.length <= 1}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Remove
                </Button>
              </div>
              <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Slide label</Label>
                    <Input
                      value={item.title}
                      onChange={(event) => update(index, { title: event.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Image alt text</Label>
                    <Input
                      value={item.alt}
                      onChange={(event) => update(index, { alt: event.target.value })}
                    />
                  </div>
                </div>
                <MediaUploadInput
                  label="Slide image"
                  value={item.imageUrl ?? ""}
                  onChange={(value) => update(index, { imageUrl: value || null })}
                  folder="specialties"
                  returnAs="path"
                  helpText="Upload a replacement or paste an image URL."
                />
              </div>
            </article>
          ))}
        </section>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            setItems((current) => [
              ...current,
              { title: "New specialty", alt: "Therapy support from Talk Space.", imageUrl: null },
            ])
          }
        >
          <Plus className="mr-2 h-4 w-4" /> Add slide
        </Button>
        <div className="sticky bottom-4 z-10 flex justify-end rounded-2xl border border-border/70 bg-background/95 p-3 shadow-lg backdrop-blur">
          {saveButton}
        </div>
      </main>
    </AdminWorkspaceShell>
  );
}
