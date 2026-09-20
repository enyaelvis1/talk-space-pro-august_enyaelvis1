import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ExternalLink, LayoutTemplate, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { canonicalUrl } from "@/lib/seo";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { RevisionHistoryButton } from "@/components/admin/RevisionHistoryButton";
import { MediaUploadInput } from "@/components/admin/MediaUploadInput";
import { MediaPicker } from "@/components/admin/MediaPicker";

import {
  getAdminContentEntry,
  listAdminCategories,
  setContentStatus,
  updateContentBody,
  updateContentFields,
  type AdminContentDetail,
  type AdminCategoryOption,
} from "@/lib/admin.functions";
import type { ContentSectionBlock } from "@/lib/content.functions";

type ContentTemplate = "default" | "landing" | "article";
type PageAppearance = { backgroundColor: string; textColor: string; accentColor: string };

function templateStarter(template: ContentTemplate, title: string) {
  if (template === "landing") {
    return `<h2>${title}</h2><p class="lead">A thoughtful, welcoming space for meaningful support and practical next steps.</p><h3>How we can support you</h3><ul><li>Personalised care shaped around your goals</li><li>Clear guidance from trained professionals</li><li>Flexible support for the season you are in</li></ul><blockquote>Small, supported steps can create lasting change.</blockquote><h3>Ready to begin?</h3><p>Book a confidential conversation with the Talk Space team to explore the right next step for you.</p>`;
  }
  if (template === "article") {
    return `<p class="lead">Start with a clear summary of what readers will learn from this article.</p><h2>In this article</h2><ul><li>The context and key idea</li><li>Practical steps to consider</li><li>When to seek additional support</li></ul><h2>Understanding the topic</h2><p>Replace this starter copy with the article’s full content. Use headings, short paragraphs, lists, and links to keep the reading experience clear.</p><blockquote>Helpful information should feel clear, compassionate, and actionable.</blockquote><h2>A practical next step</h2><p>Close with a useful takeaway or invitation for the reader.</p>`;
  }
  return `<h2>${title}</h2><p>Introduce this page with a concise explanation of what visitors will find here.</p><h3>What you should know</h3><p>Add the main page content, supporting details, and relevant links in this section.</p>`;
}

function starterBlocks(template: ContentTemplate, title: string): ContentSectionBlock[] {
  if (template === "landing")
    return [
      {
        type: "intro",
        heading: title,
        body: "A clear, welcoming introduction to this service and how it can support your next step.",
        items: [],
      },
      {
        type: "features",
        heading: "How we can support you",
        body: "Practical, culturally attuned care shaped around your goals.",
        items: [
          "Personalised care plans",
          "Confidential professional support",
          "Flexible online and in-person options",
        ],
      },
      {
        type: "cta",
        heading: "Ready to begin?",
        body: "Book a confidential conversation with the Talk Space team.",
        items: [],
        ctaLabel: "Book a consultation",
        ctaHref: "/book",
      },
    ];
  if (template === "article")
    return [
      {
        type: "intro",
        heading: "Key takeaway",
        body: "Summarise the most useful idea readers should carry forward.",
        items: [],
      },
    ];
  return [
    { type: "intro", heading: title, body: "Add a concise introduction for this page.", items: [] },
  ];
}

function readBlocks(value: unknown): ContentSectionBlock[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (!["intro", "features", "callout", "cta"].includes(String(row.type))) return [];
    return [
      {
        type: row.type as ContentSectionBlock["type"],
        heading: typeof row.heading === "string" ? row.heading : "",
        body: typeof row.body === "string" ? row.body : "",
        items: Array.isArray(row.items)
          ? row.items.filter((item): item is string => typeof item === "string")
          : [],
        ctaLabel: typeof row.ctaLabel === "string" ? row.ctaLabel : "",
        ctaHref: typeof row.ctaHref === "string" ? row.ctaHref : "/book",
      },
    ];
  });
}

function readPageAppearance(value: unknown): PageAppearance | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const valid = (key: string, fallback: string) =>
    typeof row[key] === "string" && /^#[0-9a-f]{6}$/i.test(row[key] as string)
      ? (row[key] as string)
      : fallback;
  return {
    backgroundColor: valid("backgroundColor", "#fbfaf7"),
    textColor: valid("textColor", "#253044"),
    accentColor: valid("accentColor", "#c27b67"),
  };
}

function pageContrast(background: string, text: string) {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5]
      .map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
      .map((channel) =>
        channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
      );
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const first = luminance(background);
  const second = luminance(text);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

export const Route = createFileRoute("/_authenticated/admin/content/$id/edit")({
  head: () => ({
    meta: [
      { title: "Edit content — Admin" },
      { name: "robots", content: "noindex" },
      { rel: "canonical", href: canonicalUrl("/admin") },
    ],
  }),
  component: EditContentPage,
});

function EditContentPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [entry, setEntry] = useState<AdminContentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [author, setAuthor] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [featured, setFeatured] = useState("");
  const [body, setBody] = useState("");
  const [template, setTemplate] = useState<ContentTemplate>("default");
  const [categories, setCategories] = useState<AdminCategoryOption[]>([]);
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [tags, setTags] = useState("");
  const [blocks, setBlocks] = useState<ContentSectionBlock[]>([]);
  const [pageAppearance, setPageAppearance] = useState<PageAppearance | null>(null);

  const changeTemplate = (next: ContentTemplate) => {
    if (next === template) return;
    const hasBody = body.replace(/<[^>]*>/g, " ").trim().length > 0;
    if (
      hasBody &&
      !window.confirm(
        "Replace the current body with the selected professional template starter? Your unsaved body will be replaced.",
      )
    )
      return;
    setTemplate(next);
    setBody(templateStarter(next, title || "Your page title"));
    setBlocks(starterBlocks(next, title || "Your page title"));
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getAdminContentEntry({ data: { id } }) as Promise<AdminContentDetail | null>,
      listAdminCategories(),
    ])
      .then(([e, categoryOptions]) => {
        if (cancelled) return;
        setEntry(e);
        setCategories(categoryOptions);
        if (e) {
          setTitle(e.title);
          setSlug(e.slug);
          setAuthor(e.author ?? "");
          setExcerpt(e.excerptHtml ?? "");
          setFeatured(e.featuredMediaPath ?? "");
          setBody(e.bodyHtml ?? "");
          setTemplate(
            (e.metadata.template as typeof template) ?? (e.kind === "post" ? "article" : "default"),
          );
          setCategoryIds(
            Array.isArray(e.metadata.category_ids)
              ? e.metadata.category_ids.filter(
                  (value): value is number => typeof value === "number",
                )
              : [],
          );
          setTags(
            Array.isArray(e.metadata.tags)
              ? e.metadata.tags
                  .filter((value): value is string => typeof value === "string")
                  .join(", ")
              : "",
          );
          setBlocks(readBlocks(e.metadata.sectionBlocks));
          setPageAppearance(readPageAppearance(e.metadata.appearance));
        }
      })
      .catch((err: unknown) =>
        toast.error(err instanceof Error ? err.message : "Failed to load entry."),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const dirty = useMemo(() => {
    if (!entry) return false;
    return (
      title !== entry.title ||
      slug !== entry.slug ||
      author !== (entry.author ?? "") ||
      excerpt !== (entry.excerptHtml ?? "") ||
      featured !== (entry.featuredMediaPath ?? "") ||
      body !== (entry.bodyHtml ?? "") ||
      template !==
        ((entry.metadata.template as typeof template) ??
          (entry.kind === "post" ? "article" : "default")) ||
      JSON.stringify(categoryIds) !==
        JSON.stringify(
          Array.isArray(entry.metadata.category_ids) ? entry.metadata.category_ids : [],
        ) ||
      tags !== (Array.isArray(entry.metadata.tags) ? entry.metadata.tags.join(", ") : "") ||
      JSON.stringify(blocks) !== JSON.stringify(readBlocks(entry.metadata.sectionBlocks)) ||
      JSON.stringify(pageAppearance) !==
        JSON.stringify(readPageAppearance(entry.metadata.appearance))
    );
  }, [
    entry,
    title,
    slug,
    author,
    excerpt,
    featured,
    body,
    template,
    categoryIds,
    tags,
    blocks,
    pageAppearance,
  ]);

  const backHref = entry?.kind === "page" ? "/admin/pages" : "/admin/journal";

  async function save(publish = false) {
    if (!entry) return;
    if (
      pageAppearance &&
      pageContrast(pageAppearance.backgroundColor, pageAppearance.textColor) < 4.5
    ) {
      toast.error("This page override needs at least 4.5:1 text contrast before saving.");
      return;
    }
    setSaving(true);
    try {
      const fieldPatch: Record<string, unknown> = {};
      if (title !== entry.title) fieldPatch.title = title.trim();
      if (slug !== entry.slug) fieldPatch.slug = slug.trim();
      if (author !== (entry.author ?? "")) fieldPatch.authorName = author.trim() || null;
      if (excerpt !== (entry.excerptHtml ?? "")) fieldPatch.excerptHtml = excerpt.trim() || null;
      const metadata = {
        ...entry.metadata,
        template,
        category_ids: categoryIds,
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
          .slice(0, 20),
        sectionBlocks: blocks,
        appearance: pageAppearance,
      };
      if (JSON.stringify(metadata) !== JSON.stringify(entry.metadata)) {
        fieldPatch.metadata = {
          ...metadata,
        };
      }
      if (Object.keys(fieldPatch).length > 0) {
        await updateContentFields({ data: { id: entry.id, ...fieldPatch } });
      }
      const bodyChanged = body !== (entry.bodyHtml ?? "");
      const featChanged = featured !== (entry.featuredMediaPath ?? "");
      if (bodyChanged || featChanged) {
        await updateContentBody({
          data: {
            id: entry.id,
            bodyHtml: body,
            featuredMediaPath: featChanged ? featured.trim() || null : undefined,
          },
        });
      }
      if (publish) {
        await setContentStatus({ data: { id: entry.id, status: "publish" } });
        toast.success("Blog published successfully.");
        navigate({ to: backHref });
        return;
      }
      const fresh = (await getAdminContentEntry({ data: { id } })) as AdminContentDetail | null;
      setEntry(fresh);
      toast.success("Saved.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : publish ? "Publish failed." : "Save failed.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <p className="text-sm text-muted-foreground">Content entry not found.</p>
        <Button variant="outline" onClick={() => navigate({ to: "/admin/journal" })}>
          Back to Journal
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to={backHref}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Back
            </Link>
          </Button>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs uppercase tracking-wide text-muted-foreground">
            {entry.kind}
          </span>
          <span className="text-xs text-muted-foreground">Status: {entry.status}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link
              to="/admin/preview/$kind/$slug"
              params={{ kind: entry.kind === "post" ? "post" : "page", slug: entry.slug }}
              target="_blank"
            >
              <ExternalLink className="mr-1 h-3.5 w-3.5" /> Preview
            </Link>
          </Button>
          <RevisionHistoryButton
            entityType="content_entry"
            entityId={entry.id}
            label={entry.title}
            onRestored={() => {
              (getAdminContentEntry({ data: { id } }) as Promise<AdminContentDetail | null>).then(
                (fresh) => {
                  setEntry(fresh);
                  if (fresh) {
                    setTitle(fresh.title);
                    setSlug(fresh.slug);
                    setAuthor(fresh.author ?? "");
                    setExcerpt(fresh.excerptHtml ?? "");
                    setFeatured(fresh.featuredMediaPath ?? "");
                    setBody(fresh.bodyHtml ?? "");
                    setTemplate(
                      (fresh.metadata.template as typeof template) ??
                        (fresh.kind === "post" ? "article" : "default"),
                    );
                    setCategoryIds(
                      Array.isArray(fresh.metadata.category_ids)
                        ? fresh.metadata.category_ids.filter(
                            (value): value is number => typeof value === "number",
                          )
                        : [],
                    );
                    setTags(
                      Array.isArray(fresh.metadata.tags)
                        ? fresh.metadata.tags
                            .filter((value): value is string => typeof value === "string")
                            .join(", ")
                        : "",
                    );
                    setBlocks(readBlocks(fresh.metadata.sectionBlocks));
                    setPageAppearance(readPageAppearance(fresh.metadata.appearance));
                  }
                },
              );
            }}
          />
          <Button
            aria-label="Save changes"
            onClick={() => void save(false)}
            disabled={saving || (!dirty && entry.status === "publish")}
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save changes
          </Button>
          <Button aria-label="Publish changes" onClick={() => void save(true)} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Publish
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          {entry.kind === "post" ? (
            <div className="space-y-4 rounded-xl border border-border/70 bg-muted/20 p-4">
              <div className="space-y-2">
                <Label>Categories</Label>
                <div className="flex flex-wrap gap-2">
                  {categories.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No published categories available.
                    </p>
                  ) : (
                    categories.map((category) => {
                      const selected = categoryIds.includes(category.sourceId);
                      return (
                        <button
                          key={category.sourceId}
                          type="button"
                          onClick={() =>
                            setCategoryIds((current) =>
                              selected
                                ? current.filter((id) => id !== category.sourceId)
                                : [...current, category.sourceId],
                            )
                          }
                          className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${selected ? "border-brand-deep bg-brand-deep text-white" : "border-border bg-background text-muted-foreground hover:border-brand-deep/50"}`}
                        >
                          {category.title}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tags">Tags</Label>
                <Input
                  id="tags"
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                  placeholder="anxiety, relationships, wellbeing"
                />
                <p className="text-xs text-muted-foreground">Separate tags with commas.</p>
              </div>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label>Body</Label>
            <RichTextEditor value={body} onChange={setBody} placeholder="Write the article body…" />
          </div>
          <SectionBlocksEditor blocks={blocks} onChange={setBlocks} />
          <PageAppearanceEditor value={pageAppearance} onChange={setPageAppearance} />
        </div>

        <aside className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="template">Page template</Label>
            <div className="relative">
              <LayoutTemplate
                className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"
                aria-hidden
              />
              <select
                id="template"
                value={template}
                onChange={(event) => changeTemplate(event.target.value as ContentTemplate)}
                className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm text-foreground"
              >
                <option value="default">Default content</option>
                <option value="landing">Landing page</option>
                <option value="article">Article / journal</option>
              </select>
            </div>
            <p className="text-xs text-muted-foreground">
              Choose the presentation foundation for this entry. Section blocks will be added next.
            </p>
            <div
              className={`template-preview template-preview-${template}`}
              aria-label={`${template} template preview`}
            >
              <div className="template-preview-bar" />
              <div className="template-preview-line template-preview-line-wide" />
              <div className="template-preview-line" />
              <div className="template-preview-body" />
              <span>
                {template === "landing"
                  ? "Hero-led landing page"
                  : template === "article"
                    ? "Focused reading layout"
                    : "Standard content page"}
              </span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="slug">Slug</Label>
            <Input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              Path:{" "}
              <code>
                /content/{entry.kind}s/{slug || "…"}
              </code>
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="author">Author</Label>
            <Input id="author" value={author} onChange={(e) => setAuthor(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="excerpt">Excerpt</Label>
            <Textarea
              id="excerpt"
              rows={4}
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <MediaUploadInput
              label="Featured image"
              value={featured}
              onChange={setFeatured}
              folder="featured"
              returnAs="path"
              placeholder="content-media/… or upload"
              helpText="Stored as a storage path. Paste an existing path or upload a new image."
            />
            <MediaPicker value={featured} onChange={setFeatured} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function SectionBlocksEditor({
  blocks,
  onChange,
}: {
  blocks: ContentSectionBlock[];
  onChange: (blocks: ContentSectionBlock[]) => void;
}) {
  const [dragging, setDragging] = useState<number | null>(null);
  const update = (index: number, patch: Partial<ContentSectionBlock>) =>
    onChange(blocks.map((block, i) => (i === index ? { ...block, ...patch } : block)));

  const moveBlock = (targetIndex: number) => {
    if (dragging === null || dragging === targetIndex) return;
    const next = [...blocks];
    const [moved] = next.splice(dragging, 1);
    next.splice(targetIndex, 0, moved);
    onChange(next);
    setDragging(null);
  };

  return (
    <section className="space-y-4 rounded-2xl border border-border/70 bg-muted/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-brand-deep">Reusable section blocks</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Add structured sections that render below the rich-text body on the public page.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            onChange([
              ...blocks,
              {
                type: "features",
                heading: "New section",
                body: "Add supporting content here.",
                items: ["First point", "Second point"],
              },
            ])
          }
        >
          <Plus className="mr-2 h-4 w-4" /> Add block
        </Button>
      </div>
      {blocks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
          No blocks yet. Add one to create a professional structured section.
        </p>
      ) : null}
      {blocks.map((block, index) => (
        <article
          key={index}
          draggable
          onDragStart={() => setDragging(index)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => moveBlock(index)}
          onDragEnd={() => setDragging(null)}
          className={`space-y-3 rounded-xl border border-border/70 bg-background p-4 transition-opacity ${dragging === index ? "opacity-50" : ""}`}
        >
          <div className="flex items-center justify-between gap-3">
            <span
              className="cursor-grab text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
              title="Drag to reorder"
            >
              ⠿ Block {index + 1}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(blocks.filter((_, i) => i !== index))}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Remove
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
            <select
              value={block.type}
              onChange={(event) =>
                update(index, { type: event.target.value as ContentSectionBlock["type"] })
              }
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="intro">Intro</option>
              <option value="features">Feature grid</option>
              <option value="callout">Callout</option>
              <option value="cta">Call to action</option>
            </select>
            <Input
              value={block.heading}
              onChange={(event) => update(index, { heading: event.target.value })}
              placeholder="Section heading"
            />
          </div>
          <Textarea
            value={block.body}
            onChange={(event) => update(index, { body: event.target.value })}
            rows={3}
            placeholder="Section description"
          />
          {block.type === "features" ? (
            <Input
              value={block.items.join(" | ")}
              onChange={(event) =>
                update(index, {
                  items: event.target.value
                    .split("|")
                    .map((item) => item.trim())
                    .filter(Boolean),
                })
              }
              placeholder="Feature one | Feature two | Feature three"
            />
          ) : null}
          {block.type === "cta" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                value={block.ctaLabel ?? ""}
                onChange={(event) => update(index, { ctaLabel: event.target.value })}
                placeholder="Button label"
              />
              <Input
                value={block.ctaHref ?? "/book"}
                onChange={(event) => update(index, { ctaHref: event.target.value })}
                placeholder="Internal path, e.g. /book"
              />
            </div>
          ) : null}
        </article>
      ))}
    </section>
  );
}

function PageAppearanceEditor({
  value,
  onChange,
}: {
  value: PageAppearance | null;
  onChange: (value: PageAppearance | null) => void;
}) {
  const defaults: PageAppearance = {
    backgroundColor: "#fbfaf7",
    textColor: "#253044",
    accentColor: "#c27b67",
  };
  const colors = value ?? defaults;
  return (
    <section className="space-y-4 rounded-2xl border border-border/70 bg-muted/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-brand-deep">Page appearance override</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Optionally apply colors to this page only. Leave disabled to use global site settings.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange(value ? null : defaults)}
          className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${value ? "bg-brand-deep" : "bg-muted-foreground/30"}`}
          aria-pressed={Boolean(value)}
          aria-label="Toggle page appearance override"
        >
          <span
            className={`mt-1 h-4 w-4 rounded-full bg-white transition-transform ${value ? "translate-x-6" : "translate-x-1"}`}
          />
        </button>
      </div>
      {value ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {(["backgroundColor", "textColor", "accentColor"] as const).map((key) => (
            <label
              key={key}
              className="flex items-center gap-2 text-xs font-medium text-brand-deep"
            >
              <input
                type="color"
                value={colors[key]}
                onChange={(event) => onChange({ ...colors, [key]: event.target.value })}
                className="h-9 w-12 rounded border border-border p-1"
              />
              {key === "backgroundColor" ? "Background" : key === "textColor" ? "Text" : "Accent"}
            </label>
          ))}
        </div>
      ) : null}
    </section>
  );
}
