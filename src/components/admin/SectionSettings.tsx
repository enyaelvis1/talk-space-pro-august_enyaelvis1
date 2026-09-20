import { Trash2, Plus, ArrowUp, ArrowDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  newSectionId,
  SECTION_ALIGNMENTS,
  SECTION_SPACINGS,
  SECTION_SURFACES,
  SECTION_WIDTHS,
  type PageSection,
  type SectionCard,
} from "@/lib/page-sections";
import { pricingCardImage } from "@/lib/pricing-card-images";
import { resolveImageSrc, SITE_ASSETS } from "@/lib/site-assets";
import { getSectionValue, setSectionValue } from "@/components/site/sections/section-paths";
import { MediaUploadInput } from "@/components/admin/MediaUploadInput";

type Props = {
  section: PageSection;
  onChange: (next: PageSection) => void;
};

type NativeSelectOption = {
  label: string;
  value: string;
};

function NativeSelect({
  value,
  options,
  ariaLabel,
  onChange,
}: {
  value: string;
  options: NativeSelectOption[];
  ariaLabel: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
      onChange={(event) => onChange(event.currentTarget.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function NativeToggle({
  checked,
  ariaLabel,
  onChange,
}: {
  checked: boolean;
  ariaLabel: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <input
      type="checkbox"
      role="switch"
      aria-label={ariaLabel}
      checked={checked}
      className="h-4 w-4 rounded border-input accent-primary"
      onChange={(event) => onChange(event.currentTarget.checked)}
    />
  );
}

function emptyCard(): SectionCard {
  return {
    id: newSectionId("card"),
    title: "New item",
    tagline: "",
    body: "Describe this item.",
    bullets: [],
    image: { src: "", alt: "" },
    href: "",
    linkLabel: "",
  };
}

function ImageField({
  label,
  src,
  alt,
  onChange,
  cropAspect = "free",
  helpText,
  previewSrc: previewSrcOverride,
  previewAlt,
}: {
  label: string;
  src: string;
  alt: string;
  onChange: (next: { src: string; alt: string }) => void;
  cropAspect?: string;
  helpText?: string;
  previewSrc?: string;
  previewAlt?: string;
}) {
  const isAsset = src.startsWith("asset:");
  const previewSrc = previewSrcOverride ?? resolveImageSrc(src);
  return (
    <div className="space-y-2 rounded-xl border border-border/70 p-3">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {previewSrc ? (
        <img
          src={previewSrc}
          alt={previewAlt ?? alt ?? ""}
          className="aspect-4/3 w-full rounded-lg border border-border/70 object-cover"
        />
      ) : (
        <div className="flex aspect-4/3 w-full items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 px-3 text-center text-xs text-muted-foreground">
          No image selected
        </div>
      )}
      <NativeSelect
        ariaLabel={label}
        value={isAsset ? src : "__custom__"}
        options={[
          { value: "__custom__", label: "Upload / custom URL" },
          ...SITE_ASSETS.map((asset) => ({ value: `asset:${asset.key}`, label: asset.label })),
        ]}
        onChange={(value) => onChange({ src: value === "__custom__" ? "" : value, alt })}
      />
      {!isAsset ? (
        <MediaUploadInput
          label="Upload or paste a URL"
          value={src}
          onChange={(next) => onChange({ src: next, alt })}
          folder="sections"
          returnAs="signedUrl"
          cropAspect={cropAspect}
          placeholder="https://… or upload from your device"
          helpText={helpText ?? "Upload opens the crop editor so you can frame the image exactly."}
        />
      ) : null}
      <Input
        value={alt}
        placeholder="Alt text (describe the image)"
        onChange={(event) => onChange({ src, alt: event.target.value })}
      />
    </div>
  );
}

function ListToolbar({
  index,
  count,
  onMove,
  onRemove,
}: {
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        size="icon"
        variant="ghost"
        disabled={index === 0}
        onClick={() => onMove(index, index - 1)}
        aria-label="Move up"
      >
        <ArrowUp className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        disabled={index === count - 1}
        onClick={() => onMove(index, index + 1)}
        aria-label="Move down"
      >
        <ArrowDown className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={() => onRemove(index)}
        aria-label="Remove"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

/** Settings panel for the currently selected section in the page builder. */
export function SectionSettings({ section, onChange }: Props) {
  const set = (path: string, value: unknown) => onChange(setSectionValue(section, path, value));

  const txt = (path: string) => String(getSectionValue(section, path) ?? "");

  const moveIn = <T,>(list: T[], from: number, to: number) => {
    const next = [...list];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  };

  const cards = "cards" in section ? section.cards : [];

  return (
    <div className="space-y-5 text-sm">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Background</Label>
          <NativeSelect
            ariaLabel="Background"
            value={section.surface}
            options={SECTION_SURFACES.map((value) => ({ value, label: value }))}
            onChange={(value) => set("surface", value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Width</Label>
          <NativeSelect
            ariaLabel="Width"
            value={section.width}
            options={SECTION_WIDTHS.map((value) => ({ value, label: value }))}
            onChange={(value) => set("width", value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Spacing</Label>
          <NativeSelect
            ariaLabel="Spacing"
            value={section.spacing}
            options={SECTION_SPACINGS.map((value) => ({ value, label: value }))}
            onChange={(value) => set("spacing", value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Alignment</Label>
          <NativeSelect
            ariaLabel="Alignment"
            value={section.align}
            options={SECTION_ALIGNMENTS.map((value) => ({ value, label: value }))}
            onChange={(value) => set("align", value)}
          />
        </div>
      </div>

      <label className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2">
        <span className="text-xs font-medium">Hidden on the public page</span>
        <NativeToggle
          ariaLabel="Hidden on the public page"
          checked={section.hidden}
          onChange={(value) => set("hidden", value)}
        />
      </label>

      {"heading" in section || "eyebrow" in section || "body" in section ? (
        <div className="space-y-2 rounded-xl border border-border/70 p-3">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Text</Label>
          {"eyebrow" in section ? (
            <Input
              value={txt("eyebrow")}
              placeholder="Small label above the heading"
              onChange={(event) => set("eyebrow", event.target.value)}
            />
          ) : null}
          {"heading" in section ? (
            <Input
              value={txt("heading")}
              placeholder="Heading"
              onChange={(event) => set("heading", event.target.value)}
            />
          ) : null}
          {"headingEmphasis" in section ? (
            <Input
              value={txt("headingEmphasis")}
              placeholder="Highlighted words in the heading"
              onChange={(event) => set("headingEmphasis", event.target.value)}
            />
          ) : null}
          {"headingAfter" in section ? (
            <Input
              value={txt("headingAfter")}
              placeholder="Rest of the heading (after highlight)"
              onChange={(event) => set("headingAfter", event.target.value)}
            />
          ) : null}
          {"body" in section ? (
            <Textarea
              rows={4}
              value={txt("body")}
              placeholder="Intro paragraph"
              onChange={(event) => set("body", event.target.value)}
            />
          ) : null}
          <p className="text-xs text-muted-foreground">
            You can also click the text directly on the page and type over it.
          </p>
        </div>
      ) : null}

      {section.type === "richText" ? (
        <div className="space-y-1.5">
          <Label className="text-xs">HTML content</Label>
          <Textarea
            rows={10}
            value={section.html}
            onChange={(event) => set("html", event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Tip: use the rich text editor above the canvas for formatting, then paste here if you
            need raw HTML.
          </p>
        </div>
      ) : null}

      {(section.type === "cardGrid" || section.type === "therapistList") && "columns" in section ? (
        <div className="space-y-1.5">
          <Label className="text-xs">Columns</Label>
          <NativeSelect
            ariaLabel="Columns"
            value={String(section.columns)}
            options={[1, 2, 3, 4].map((value) => ({
              value: String(value),
              label: String(value),
            }))}
            onChange={(value) => set("columns", Number(value))}
          />
        </div>
      ) : null}

      {section.type === "gallery" ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Scroll duration (seconds)</Label>
            <Input
              type="number"
              min={10}
              max={180}
              value={section.speedSeconds}
              onChange={(event) => set("speedSeconds", Number(event.target.value) || 45)}
            />
          </div>
          {section.images.map((image, index) => (
            <div key={image.id} className="space-y-2 rounded-xl border border-border/70 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">Image {index + 1}</span>
                <ListToolbar
                  index={index}
                  count={section.images.length}
                  onMove={(from, to) => set("images", moveIn(section.images, from, to))}
                  onRemove={(i) =>
                    set(
                      "images",
                      section.images.filter((_, position) => position !== i),
                    )
                  }
                />
              </div>
              <ImageField
                label="Image"
                cropAspect="1:1"

                src={image.src}
                alt={image.alt}
                onChange={(next) =>
                  onChange(
                    setSectionValue(
                      setSectionValue(section, `images.${index}.src`, next.src),
                      `images.${index}.alt`,
                      next.alt,
                    ),
                  )
                }
              />
              <Input
                value={image.caption}
                placeholder="Caption (optional)"
                onChange={(event) => set(`images.${index}.caption`, event.target.value)}
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              set("images", [
                ...section.images,
                { id: newSectionId("img"), src: "", alt: "", caption: "" },
              ])
            }
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Add image
          </Button>
        </div>
      ) : null}

      {section.type === "hero" ? (
        <ImageField
          label="Hero image"
          cropAspect="16:9"

          src={section.image.src}
          alt={section.image.alt}
          onChange={(next) => onChange(setSectionValue(section, "image", next))}
        />
      ) : null}

      {(section.type === "hero" || section.type === "cta") && (
        <div className="space-y-3">
          <Label className="text-xs">Buttons</Label>
          {section.links.map((link, index) => (
            <div key={link.id} className="space-y-2 rounded-xl border border-border/70 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">Button {index + 1}</span>
                <ListToolbar
                  index={index}
                  count={section.links.length}
                  onMove={(from, to) => set("links", moveIn(section.links, from, to))}
                  onRemove={(i) =>
                    set(
                      "links",
                      section.links.filter((_, position) => position !== i),
                    )
                  }
                />
              </div>
              <Input
                value={link.label}
                placeholder="Label"
                onChange={(event) => set(`links.${index}.label`, event.target.value)}
              />
              <Input
                value={link.href}
                placeholder="/book"
                onChange={(event) => set(`links.${index}.href`, event.target.value)}
              />
              <NativeSelect
                ariaLabel={`Button ${index + 1} style`}
                value={link.variant}
                options={[
                  { value: "primary", label: "Primary" },
                  { value: "outline", label: "Outline" },
                  { value: "link", label: "Text link" },
                ]}
                onChange={(value) => set(`links.${index}.variant`, value)}
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              set("links", [
                ...section.links,
                { id: newSectionId("link"), label: "Button", href: "/book", variant: "primary" },
              ])
            }
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Add button
          </Button>
        </div>
      )}

      {(section.type === "cardGrid" || section.type === "featureList") && (
        <div className="space-y-3">
          <Label className="text-xs">Cards</Label>
          {cards.map((card, index) => {
            const image =
              section.type === "cardGrid" && section.id.startsWith("pricing-")
                ? pricingCardImage(card)
                : card.image;

            return (
              <div key={card.id} className="space-y-2 rounded-xl border border-border/70 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">{card.title || `Card ${index + 1}`}</span>
                  <ListToolbar
                    index={index}
                    count={cards.length}
                    onMove={(from, to) => set("cards", moveIn(cards, from, to))}
                    onRemove={(i) =>
                      set(
                        "cards",
                        cards.filter((_, position) => position !== i),
                      )
                    }
                  />
                </div>
                <Input
                  value={card.title}
                  placeholder="Title"
                  onChange={(event) => set(`cards.${index}.title`, event.target.value)}
                />
                <Input
                  value={card.tagline}
                  placeholder="Small label above the title"
                  onChange={(event) => set(`cards.${index}.tagline`, event.target.value)}
                />
                <Textarea
                  rows={3}
                  value={card.body}
                  placeholder="Description"
                  onChange={(event) => set(`cards.${index}.body`, event.target.value)}
                />
                <Textarea
                  rows={3}
                  value={card.bullets.join("\n")}
                  placeholder="Bullet points, one per line"
                  onChange={(event) =>
                    set(
                      `cards.${index}.bullets`,
                      event.target.value
                        .split("\n")
                        .map((line) => line.trim())
                        .filter(Boolean),
                    )
                  }
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={card.linkLabel}
                    placeholder="Link label"
                    onChange={(event) => set(`cards.${index}.linkLabel`, event.target.value)}
                  />
                  <Input
                    value={card.href}
                    placeholder="/services"
                    onChange={(event) => set(`cards.${index}.href`, event.target.value)}
                  />
                </div>
                <ImageField
                  label="Card image"
                  cropAspect={section.type === "cardGrid" ? "3:4" : "4:3"}
                  src={card.image.src}
                  alt={card.image.alt}
                  previewSrc={resolveImageSrc(image.src) ?? undefined}
                  previewAlt={image.alt}
                  onChange={(next) =>
                    onChange(setSectionValue(section, `cards.${index}.image`, next))
                  }
                />
                {section.type === "featureList" ? (
                  <label className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
                    <span className="text-xs font-medium">Dark background with white text</span>
                    <NativeToggle
                      ariaLabel={`Use dark background for card ${index + 1}`}
                      checked={card.tone === "dark"}
                      onChange={(value) => set(`cards.${index}.tone`, value ? "dark" : "default")}
                    />
                  </label>
                ) : null}
              </div>
            );
          })}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => set("cards", [...cards, emptyCard()])}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Add card
          </Button>
        </div>
      )}

      {section.type === "callout" ? (
        <div className="space-y-1.5">
          <Label className="text-xs">Bullet points</Label>
          <Textarea
            rows={4}
            value={section.bullets.join("\n")}
            placeholder="One per line"
            onChange={(event) =>
              set(
                "bullets",
                event.target.value
                  .split("\n")
                  .map((line) => line.trim())
                  .filter(Boolean),
              )
            }
          />
        </div>
      ) : null}

      {section.type === "faq" ? (
        <div className="space-y-3">
          <Label className="text-xs">Questions</Label>
          {section.items.map((item, index) => (
            <div key={item.id} className="space-y-2 rounded-xl border border-border/70 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">Question {index + 1}</span>
                <ListToolbar
                  index={index}
                  count={section.items.length}
                  onMove={(from, to) => set("items", moveIn(section.items, from, to))}
                  onRemove={(i) =>
                    set(
                      "items",
                      section.items.filter((_, position) => position !== i),
                    )
                  }
                />
              </div>
              <Input
                value={item.question}
                onChange={(event) => set(`items.${index}.question`, event.target.value)}
              />
              <Textarea
                rows={3}
                value={item.answer}
                onChange={(event) => set(`items.${index}.answer`, event.target.value)}
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              set("items", [
                ...section.items,
                { id: newSectionId("faq"), question: "New question", answer: "" },
              ])
            }
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Add question
          </Button>
        </div>
      ) : null}

      {section.type === "spacer" ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Height</Label>
            <NativeSelect
              ariaLabel="Height"
              value={section.size}
              options={[
                { value: "sm", label: "Small" },
                { value: "md", label: "Medium" },
                { value: "lg", label: "Large" },
              ]}
              onChange={(value) => set("size", value)}
            />
          </div>
          <label className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2">
            <span className="text-xs font-medium">Show divider line</span>
            <NativeToggle
              ariaLabel="Show divider line"
              checked={section.divider}
              onChange={(value) => set("divider", value)}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
