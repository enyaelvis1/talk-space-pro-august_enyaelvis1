import { Fragment, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  PencilLine,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MediaUploadInput } from "@/components/admin/MediaUploadInput";
import {
  getAdminCarousel,
  getAdminHeroSettings,
  getCmsPermissions,
  updateAdminCarousel,
  updateAdminHeroSettings,
  updateAdminHomepageSectionCopy,
  updateAdminHomepageSections,
  getAdminSpecialtyCards,
  updateAdminSpecialtyCards,
  type AdminCarouselItem,
  type AdminSpecialtyCard,
} from "@/lib/admin.functions";
import {
  EDITABLE_HOMEPAGE_COPY_SECTIONS,
  type HomepageSectionCopy,
  type HomepageSectionCopyMap,
} from "@/lib/homepage-section-copy";
import type {
  HeroSettings,
  HomepageSectionId,
  SpecialtyCarouselItem,
} from "@/lib/content.functions";
import { DEFAULT_SPECIALTY_CARDS, type SpecialtyCard } from "@/lib/specialty-cards";

const EDIT_PARAM = "edit";
const STICKY_KEY = "cms:edit-mode-sticky";
const CONTENT_MEDIA_BUCKET = "content-media";

const SECTION_LABELS: Record<HomepageSectionId, string> = {
  hero: "Hero",
  carousel: "Specialty carousel",
  trust: "Trust strip",
  specialties: "Our specialties",
  therapists: "Therapists",
  video: "Video introduction",
  how_it_works: "How it works",
  pricing: "Pricing",
  reviews: "Client reviews",
  journal: "Journal",
  faq: "FAQs",
  cta: "Final call to action",
};

/** Sections that expose image/media editing in place. */
const MEDIA_SECTIONS: HomepageSectionId[] = ["hero", "carousel", "specialties"];

type SectionConfig = { id: HomepageSectionId; visible: boolean };

export type HomepageMedia = {
  heroSettings: HeroSettings;
  carousel: SpecialtyCarouselItem[] | null;
  specialtyCards: SpecialtyCard[] | null;
};

type Props = {
  sections: SectionConfig[];
  copy: HomepageSectionCopyMap;
  media: HomepageMedia;
  /** Renders the real homepage section with (possibly edited) content. */
  renderSection: (
    id: HomepageSectionId,
    copy: HomepageSectionCopyMap,
    media: HomepageMedia,
  ) => ReactNode;
};

/** Turn a stored `content-media/...` path into the public URL used for preview. */
function mediaPreviewUrl(path: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const base = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "";
  if (!base) return null;
  const normalized = path
    .replace(/^\/+/, "")
    .replace(new RegExp(`^${CONTENT_MEDIA_BUCKET}/`, "i"), "");
  const encoded = normalized.split("/").map(encodeURIComponent).join("/");
  return `${base}/storage/v1/object/public/${CONTENT_MEDIA_BUCKET}/${encoded}`;
}

function setEditParam(on: boolean) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (on) url.searchParams.set(EDIT_PARAM, "1");
  else url.searchParams.delete(EDIT_PARAM);
  window.history.replaceState(window.history.state, "", url.toString());
  try {
    if (on) window.sessionStorage.setItem(STICKY_KEY, "1");
    else window.sessionStorage.removeItem(STICKY_KEY);
  } catch {
    // storage unavailable — edit mode simply won't persist
  }
}

/**
 * Renders the homepage for everyone, and for signed-in admins adds in-page
 * editing of each section: reorder, hide/show, edit the heading copy and swap
 * the hero and carousel images right where they appear.
 */
export function HomepageEditLayer({ sections, copy, media, renderSection }: Props) {
  const router = useRouter();
  const [canEdit, setCanEdit] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftSections, setDraftSections] = useState<SectionConfig[]>(sections);
  const [draftCopy, setDraftCopy] = useState<HomepageSectionCopyMap>(copy);
  /** Raw (unresolved) hero + carousel values loaded from the admin API. */
  const [savedMedia, setSavedMedia] = useState<HomepageMedia | null>(null);
  const [draftMedia, setDraftMedia] = useState<HomepageMedia | null>(null);
  const [openId, setOpenId] = useState<HomepageSectionId | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingMedia, setLoadingMedia] = useState(false);

  useEffect(() => {
    setDraftSections(sections);
    setDraftCopy(copy);
  }, [sections, copy]);

  useEffect(() => {
    let active = true;
    getCmsPermissions()
      .then((permissions) => {
        if (active) setCanEdit(permissions.canEdit);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!canEdit || editing || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const value = params.get(EDIT_PARAM);
    let sticky = false;
    try {
      sticky = window.sessionStorage.getItem(STICKY_KEY) === "1";
    } catch {
      sticky = false;
    }
    if (value === "1" || value === "true" || sticky) setEditing(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit]);

  // Editing images needs the raw stored paths, which only the admin API returns.
  useEffect(() => {
    if (!editing || savedMedia || loadingMedia) return;
    setLoadingMedia(true);
    Promise.all([getAdminHeroSettings(), getAdminCarousel(), getAdminSpecialtyCards()])
      .then(([hero, carousel, specialtyCards]) => {
        const next: HomepageMedia = {
          heroSettings: (hero as HeroSettings | null) ?? media.heroSettings,
          carousel: (carousel as AdminCarouselItem[] | null) ?? media.carousel,
          specialtyCards:
            (specialtyCards as AdminSpecialtyCard[] | null) ?? DEFAULT_SPECIALTY_CARDS,
        };
        setSavedMedia(next);
        setDraftMedia(next);
      })
      .catch(() => {
        toast.error("Could not load the hero and carousel images for editing.");
      })
      .finally(() => setLoadingMedia(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, savedMedia, loadingMedia]);

  /** Media used for rendering: drafts (with paths resolved) or the public data. */
  const previewMedia: HomepageMedia = draftMedia
    ? {
        heroSettings: {
          ...draftMedia.heroSettings,
          imageOnePath: mediaPreviewUrl(draftMedia.heroSettings.imageOnePath),
          imageTwoPath: mediaPreviewUrl(draftMedia.heroSettings.imageTwoPath),
        },
        carousel:
          draftMedia.carousel?.map((item) => ({
            ...item,
            imageUrl: mediaPreviewUrl(item.imageUrl),
          })) ?? null,
        specialtyCards:
          draftMedia.specialtyCards?.map((card) => ({
            ...card,
            imageUrl: mediaPreviewUrl(card.imageUrl),
          })) ?? null,
      }
    : media;

  const dirty =
    JSON.stringify(draftSections) !== JSON.stringify(sections) ||
    JSON.stringify(draftCopy) !== JSON.stringify(copy) ||
    (draftMedia !== null && JSON.stringify(draftMedia) !== JSON.stringify(savedMedia));

  const move = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= draftSections.length) return;
    setDraftSections((current) => {
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const updateCopy = (id: HomepageSectionId, field: keyof HomepageSectionCopy, value: string) =>
    setDraftCopy((current) => ({ ...current, [id]: { ...current[id], [field]: value } }));

  const updateHero = (field: keyof HeroSettings, value: string | null) =>
    setDraftMedia((current) =>
      current ? { ...current, heroSettings: { ...current.heroSettings, [field]: value } } : current,
    );

  const updateCarouselItem = (
    index: number,
    field: keyof SpecialtyCarouselItem,
    value: string | null,
  ) =>
    setDraftMedia((current) => {
      if (!current?.carousel) return current;
      const items = current.carousel.map((item, i) =>
        i === index ? { ...item, [field]: value } : item,
      );
      return { ...current, carousel: items };
    });

  const updateSpecialtyCard = (index: number, field: keyof SpecialtyCard, value: string | null) =>
    setDraftMedia((current) => {
      if (!current?.specialtyCards) return current;
      return {
        ...current,
        specialtyCards: current.specialtyCards.map((card, i) =>
          i === index ? { ...card, [field]: value } : card,
        ),
      };
    });

  const discard = () => {
    setDraftSections(sections);
    setDraftCopy(copy);
    setDraftMedia(savedMedia);
  };

  const save = async () => {
    setSaving(true);
    try {
      const tasks: Promise<unknown>[] = [
        updateAdminHomepageSections({
          data: { sections: draftSections.map(({ id, visible }) => ({ id, visible })) },
        }),
        updateAdminHomepageSectionCopy({ data: { copy: draftCopy } }),
      ];
      if (draftMedia && JSON.stringify(draftMedia) !== JSON.stringify(savedMedia)) {
        tasks.push(updateAdminHeroSettings({ data: draftMedia.heroSettings }));
        if (draftMedia.carousel && draftMedia.carousel.length > 0) {
          tasks.push(updateAdminCarousel({ data: { items: draftMedia.carousel } }));
        }
        if (draftMedia.specialtyCards && draftMedia.specialtyCards.length > 0) {
          tasks.push(updateAdminSpecialtyCards({ data: { cards: draftMedia.specialtyCards } }));
        }
      }
      await Promise.all(tasks);
      setSavedMedia(draftMedia);
      await router.invalidate();
      toast.success("Homepage updated and published.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the homepage.");
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <>
        {draftSections.map((section) =>
          section.visible ? (
            <Fragment key={section.id}>{renderSection(section.id, draftCopy, media)}</Fragment>
          ) : null,
        )}
        {canEdit ? (
          <div className="fixed bottom-6 left-6 z-50 print:hidden">
            <Button
              size="sm"
              className="shadow-lg"
              onClick={() => {
                setEditing(true);
                setEditParam(true);
              }}
            >
              <PencilLine className="mr-2 h-4 w-4" /> Edit this page
            </Button>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="relative">
      <div className="sticky top-0 z-50 border-b border-amber-300/60 bg-amber-50/95 px-4 py-2 text-sm backdrop-blur sm:px-6">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-2">
          <span className="font-medium text-amber-900">
            Editing the home page{dirty ? " — unsaved changes" : ""}
          </span>
          {loadingMedia ? (
            <Loader2 className="h-4 w-4 animate-spin text-amber-900" aria-label="Loading media" />
          ) : null}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" disabled={!dirty || saving} onClick={discard}>
              <RotateCcw className="mr-2 h-4 w-4" /> Discard
            </Button>
            <Button size="sm" disabled={!dirty || saving} onClick={() => void save()}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save &amp; publish
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(false);
                setOpenId(null);
                setEditParam(false);
              }}
            >
              <X className="mr-2 h-4 w-4" /> Exit editing
            </Button>
          </div>
        </div>
      </div>

      {draftSections.map((section, index) => {
        const editableCopy = EDITABLE_HOMEPAGE_COPY_SECTIONS.includes(section.id);
        const editableMedia = MEDIA_SECTIONS.includes(section.id);
        const isOpen = openId === section.id;
        return (
          <section
            key={section.id}
            className={`group relative border-b border-dashed border-amber-300/50 ${
              section.visible ? "" : "opacity-50"
            }`}
          >
            <div className="pointer-events-none absolute inset-0 z-10 ring-1 ring-transparent transition group-hover:ring-2 group-hover:ring-amber-400/70" />
            <div className="absolute left-1/2 top-2 z-20 flex -translate-x-1/2 flex-wrap items-center gap-1 rounded-full border border-amber-300 bg-white/95 px-2 py-1 shadow-md">
              <span className="px-2 text-xs font-semibold text-amber-900">
                {SECTION_LABELS[section.id]}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label={`Move ${SECTION_LABELS[section.id]} up`}
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => move(index, 1)}
                disabled={index === draftSections.length - 1}
                aria-label={`Move ${SECTION_LABELS[section.id]} down`}
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() =>
                  setDraftSections((current) =>
                    current.map((item) =>
                      item.id === section.id ? { ...item, visible: !item.visible } : item,
                    ),
                  )
                }
                aria-label={section.visible ? "Hide section" : "Show section"}
              >
                {section.visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              {editableCopy || editableMedia ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-7"
                  onClick={() => setOpenId(isOpen ? null : section.id)}
                  aria-expanded={isOpen}
                >
                  {editableMedia ? (
                    <ImagePlus className="mr-1.5 h-3.5 w-3.5" />
                  ) : (
                    <PencilLine className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {isOpen ? "Close" : editableMedia ? "Edit media" : "Edit text"}
                </Button>
              ) : null}
            </div>

            {isOpen ? (
              <div className="relative z-20 mx-auto grid w-full max-w-3xl gap-4 px-4 pt-14 pb-4 sm:px-6">
                {editableCopy ? (
                  <>
                    <div className="grid gap-1.5">
                      <Label htmlFor={`${section.id}-eyebrow`}>Eyebrow</Label>
                      <Input
                        id={`${section.id}-eyebrow`}
                        value={draftCopy[section.id]?.eyebrow ?? ""}
                        onChange={(event) => updateCopy(section.id, "eyebrow", event.target.value)}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor={`${section.id}-title`}>Heading</Label>
                      <Input
                        id={`${section.id}-title`}
                        value={draftCopy[section.id]?.title ?? ""}
                        onChange={(event) => updateCopy(section.id, "title", event.target.value)}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor={`${section.id}-body`}>Supporting text</Label>
                      <Textarea
                        id={`${section.id}-body`}
                        rows={3}
                        value={draftCopy[section.id]?.body ?? ""}
                        onChange={(event) => updateCopy(section.id, "body", event.target.value)}
                      />
                    </div>
                  </>
                ) : null}

                {section.id === "hero" && draftMedia ? (
                  <div className="grid gap-4 rounded-xl border border-amber-200 bg-white/80 p-4">
                    <p className="text-sm font-semibold text-brand-deep">Hero content</p>
                    <div className="grid gap-1.5">
                      <Label htmlFor="hero-eyebrow">Eyebrow</Label>
                      <Input
                        id="hero-eyebrow"
                        value={draftMedia.heroSettings.eyebrow}
                        onChange={(event) => updateHero("eyebrow", event.target.value)}
                      />
                    </div>
                    <div className="grid gap-1.5 sm:grid-cols-2 sm:gap-3">
                      <div className="grid gap-1.5">
                        <Label htmlFor="hero-heading">Heading</Label>
                        <Input
                          id="hero-heading"
                          value={draftMedia.heroSettings.headingBefore}
                          onChange={(event) => updateHero("headingBefore", event.target.value)}
                        />
                      </div>
                      <div className="grid gap-1.5">
                        <Label htmlFor="hero-emphasis">Highlighted word</Label>
                        <Input
                          id="hero-emphasis"
                          value={draftMedia.heroSettings.headingEmphasis}
                          onChange={(event) => updateHero("headingEmphasis", event.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="hero-description">Description</Label>
                      <Textarea
                        id="hero-description"
                        rows={3}
                        value={draftMedia.heroSettings.description}
                        onChange={(event) => updateHero("description", event.target.value)}
                      />
                    </div>
                    <MediaUploadInput
                      label="Slide one image"
                      value={draftMedia.heroSettings.imageOnePath ?? ""}
                      onChange={(value) => updateHero("imageOnePath", value || null)}
                      folder="hero"
                      returnAs="path"
                      placeholder="Image URL or upload"
                      helpText="Upload a new image or paste an existing public URL."
                    />
                    <div className="grid gap-1.5">
                      <Label htmlFor="hero-alt-one">Slide one alt text</Label>
                      <Input
                        id="hero-alt-one"
                        value={draftMedia.heroSettings.imageOneAlt}
                        onChange={(event) => updateHero("imageOneAlt", event.target.value)}
                      />
                    </div>
                    <MediaUploadInput
                      label="Slide two image"
                      value={draftMedia.heroSettings.imageTwoPath ?? ""}
                      onChange={(value) => updateHero("imageTwoPath", value || null)}
                      folder="hero"
                      returnAs="path"
                      placeholder="Image URL or upload"
                      helpText="Leave empty to keep the default second slide."
                    />
                    <div className="grid gap-1.5">
                      <Label htmlFor="hero-alt-two">Slide two alt text</Label>
                      <Input
                        id="hero-alt-two"
                        value={draftMedia.heroSettings.imageTwoAlt}
                        onChange={(event) => updateHero("imageTwoAlt", event.target.value)}
                      />
                    </div>
                  </div>
                ) : null}

                {section.id === "carousel" && draftMedia ? (
                  <div className="grid gap-4 rounded-xl border border-amber-200 bg-white/80 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-brand-deep">Carousel images</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={(draftMedia.carousel?.length ?? 0) >= 12}
                        onClick={() =>
                          setDraftMedia((current) =>
                            current
                              ? {
                                  ...current,
                                  carousel: [
                                    ...(current.carousel ?? []),
                                    { title: "New slide", alt: "New slide", imageUrl: null },
                                  ],
                                }
                              : current,
                          )
                        }
                      >
                        <Plus className="mr-2 h-4 w-4" /> Add slide
                      </Button>
                    </div>
                    {(draftMedia.carousel ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No carousel slides yet — add one to start.
                      </p>
                    ) : null}
                    {(draftMedia.carousel ?? []).map((item, itemIndex) => (
                      <div
                        key={`carousel-${itemIndex}`}
                        className="grid gap-2 rounded-lg border border-border/60 bg-background p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <Label htmlFor={`carousel-title-${itemIndex}`}>
                            Slide {itemIndex + 1}
                          </Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            aria-label={`Remove slide ${itemIndex + 1}`}
                            disabled={(draftMedia.carousel?.length ?? 0) <= 1}
                            onClick={() =>
                              setDraftMedia((current) =>
                                current
                                  ? {
                                      ...current,
                                      carousel: (current.carousel ?? []).filter(
                                        (_, i) => i !== itemIndex,
                                      ),
                                    }
                                  : current,
                              )
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <Input
                          id={`carousel-title-${itemIndex}`}
                          value={item.title}
                          onChange={(event) =>
                            updateCarouselItem(itemIndex, "title", event.target.value)
                          }
                        />
                        <MediaUploadInput
                          label="Image"
                          value={item.imageUrl ?? ""}
                          onChange={(value) =>
                            updateCarouselItem(itemIndex, "imageUrl", value || null)
                          }
                          folder="carousel"
                          returnAs="path"
                          placeholder="Image URL or upload"
                        />
                        <div className="grid gap-1.5">
                          <Label htmlFor={`carousel-alt-${itemIndex}`}>Alt text</Label>
                          <Input
                            id={`carousel-alt-${itemIndex}`}
                            value={item.alt}
                            onChange={(event) =>
                              updateCarouselItem(itemIndex, "alt", event.target.value)
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {section.id === "specialties" && draftMedia?.specialtyCards ? (
                  <div className="grid gap-4 rounded-xl border border-amber-200 bg-white/80 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-brand-deep">Specialty cards</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={draftMedia.specialtyCards.length >= 24}
                        onClick={() =>
                          setDraftMedia((current) =>
                            current
                              ? {
                                  ...current,
                                  specialtyCards: [
                                    ...(current.specialtyCards ?? []),
                                    {
                                      title: "New specialty",
                                      description: "",
                                      imageUrl: null,
                                      alt: "New specialty",
                                      primaryLabel: "Book now",
                                      primaryHref: "/book",
                                      secondaryLabel: "Know more",
                                      secondaryHref: "/services",
                                    },
                                  ],
                                }
                              : current,
                          )
                        }
                      >
                        <Plus className="mr-2 h-4 w-4" /> Add card
                      </Button>
                    </div>
                    {draftMedia.specialtyCards.map((card, cardIndex) => (
                      <div
                        key={`specialty-${cardIndex}`}
                        className="grid gap-2 rounded-lg border border-border/60 bg-background p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <Label htmlFor={`specialty-title-${cardIndex}`}>
                            Card {cardIndex + 1}
                          </Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            aria-label={`Remove card ${cardIndex + 1}`}
                            disabled={(draftMedia.specialtyCards?.length ?? 0) <= 1}
                            onClick={() =>
                              setDraftMedia((current) =>
                                current
                                  ? {
                                      ...current,
                                      specialtyCards: (current.specialtyCards ?? []).filter(
                                        (_, i) => i !== cardIndex,
                                      ),
                                    }
                                  : current,
                              )
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <Input
                          id={`specialty-title-${cardIndex}`}
                          value={card.title}
                          placeholder="Card title"
                          onChange={(event) =>
                            updateSpecialtyCard(cardIndex, "title", event.target.value)
                          }
                        />
                        <div className="grid gap-1.5">
                          <Label htmlFor={`specialty-desc-${cardIndex}`}>Description</Label>
                          <Textarea
                            id={`specialty-desc-${cardIndex}`}
                            rows={2}
                            value={card.description}
                            onChange={(event) =>
                              updateSpecialtyCard(cardIndex, "description", event.target.value)
                            }
                          />
                        </div>
                        <MediaUploadInput
                          label="Image"
                          value={card.imageUrl ?? ""}
                          onChange={(value) =>
                            updateSpecialtyCard(cardIndex, "imageUrl", value || null)
                          }
                          folder="specialties"
                          returnAs="path"
                          placeholder="Image URL or upload"
                          helpText="Leave empty to keep the built-in image."
                        />
                        <div className="grid gap-1.5">
                          <Label htmlFor={`specialty-alt-${cardIndex}`}>Alt text</Label>
                          <Input
                            id={`specialty-alt-${cardIndex}`}
                            value={card.alt}
                            onChange={(event) =>
                              updateSpecialtyCard(cardIndex, "alt", event.target.value)
                            }
                          />
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="grid gap-1.5">
                            <Label htmlFor={`specialty-cta1-${cardIndex}`}>Primary button</Label>
                            <Input
                              id={`specialty-cta1-${cardIndex}`}
                              value={card.primaryLabel}
                              onChange={(event) =>
                                updateSpecialtyCard(cardIndex, "primaryLabel", event.target.value)
                              }
                            />
                          </div>
                          <div className="grid gap-1.5">
                            <Label htmlFor={`specialty-cta1-href-${cardIndex}`}>Primary link</Label>
                            <Input
                              id={`specialty-cta1-href-${cardIndex}`}
                              value={card.primaryHref}
                              onChange={(event) =>
                                updateSpecialtyCard(cardIndex, "primaryHref", event.target.value)
                              }
                            />
                          </div>
                          <div className="grid gap-1.5">
                            <Label htmlFor={`specialty-cta2-${cardIndex}`}>Secondary button</Label>
                            <Input
                              id={`specialty-cta2-${cardIndex}`}
                              value={card.secondaryLabel}
                              onChange={(event) =>
                                updateSpecialtyCard(cardIndex, "secondaryLabel", event.target.value)
                              }
                            />
                          </div>
                          <div className="grid gap-1.5">
                            <Label htmlFor={`specialty-cta2-href-${cardIndex}`}>
                              Secondary link
                            </Label>
                            <Input
                              id={`specialty-cta2-href-${cardIndex}`}
                              value={card.secondaryHref}
                              onChange={(event) =>
                                updateSpecialtyCard(cardIndex, "secondaryHref", event.target.value)
                              }
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className={isOpen ? "" : "pt-8"}>
              {renderSection(section.id, draftCopy, previewMedia)}
            </div>
          </section>
        );
      })}
    </div>
  );
}
