import { z } from "zod";

/**
 * Page section model — the data behind every public page.
 *
 * Sections are stored on `content_entries.metadata.sections` and rendered by
 * `SectionRenderer`, which uses the same site components as the hand-built
 * pages. Admins edit them in the page builder or inline on the live page.
 */

export const SECTION_SURFACES = ["page", "cream", "card", "deep"] as const;
export const SECTION_SPACINGS = ["sm", "md", "lg"] as const;
export const SECTION_WIDTHS = ["narrow", "content", "wide", "full"] as const;
export const SECTION_ALIGNMENTS = ["left", "center"] as const;

export type SectionSurface = (typeof SECTION_SURFACES)[number];
export type SectionSpacing = (typeof SECTION_SPACINGS)[number];
export type SectionWidth = (typeof SECTION_WIDTHS)[number];
export type SectionAlignment = (typeof SECTION_ALIGNMENTS)[number];

const idSchema = z.string().trim().min(1).max(60);
const shortText = z.string().trim().max(200).default("");
const longText = z.string().trim().max(4000).default("");

const imageSchema = z
  .object({
    src: z.string().trim().max(1000).default(""),
    alt: z.string().trim().max(300).default(""),
  })
  .default({ src: "", alt: "" });

const linkSchema = z.object({
  id: idSchema,
  label: shortText,
  href: z.string().trim().max(500).default("/book"),
  variant: z.enum(["primary", "outline", "link"]).default("primary"),
});

const cardSchema = z.object({
  id: idSchema,
  title: shortText,
  tagline: shortText,
  body: longText,
  bullets: z.array(z.string().trim().max(300)).max(12).default([]),
  image: imageSchema,
  href: z.string().trim().max(500).default(""),
  linkLabel: shortText,
  /** "dark" renders this row on a deep background with light text. */
  tone: z.enum(["default", "dark"]).optional(),
});

const galleryItemSchema = z.object({
  id: idSchema,
  src: z.string().trim().max(1000).default(""),
  alt: z.string().trim().max(300).default(""),
  caption: shortText,
});

const baseFields = {
  id: idSchema,
  hidden: z.boolean().default(false),
  surface: z.enum(SECTION_SURFACES).default("page"),
  spacing: z.enum(SECTION_SPACINGS).default("md"),
  width: z.enum(SECTION_WIDTHS).default("content"),
  align: z.enum(SECTION_ALIGNMENTS).default("left"),
};

export const sectionSchema = z.discriminatedUnion("type", [
  z.object({
    ...baseFields,
    type: z.literal("hero"),
    eyebrow: shortText,
    heading: shortText,
    headingEmphasis: shortText,
    headingAfter: shortText,
    body: longText,
    image: imageSchema,
    links: z.array(linkSchema).max(4).default([]),
  }),
  z.object({
    ...baseFields,
    type: z.literal("richText"),
    heading: shortText,
    html: z.string().max(200_000).default(""),
  }),
  z.object({
    ...baseFields,
    type: z.literal("cardGrid"),
    eyebrow: shortText,
    heading: shortText,
    body: longText,
    columns: z.number().int().min(1).max(4).default(3),
    cards: z.array(cardSchema).max(24).default([]),
  }),
  z.object({
    ...baseFields,
    type: z.literal("featureList"),
    eyebrow: shortText,
    heading: shortText,
    body: longText,
    cards: z.array(cardSchema).max(24).default([]),
  }),
  z.object({
    ...baseFields,
    type: z.literal("gallery"),
    heading: shortText,
    speedSeconds: z.number().int().min(10).max(180).default(45),
    images: z.array(galleryItemSchema).max(24).default([]),
  }),
  z.object({
    ...baseFields,
    type: z.literal("callout"),
    eyebrow: shortText,
    heading: shortText,
    body: longText,
    bullets: z.array(z.string().trim().max(300)).max(12).default([]),
  }),
  z.object({
    ...baseFields,
    type: z.literal("cta"),
    eyebrow: shortText,
    heading: shortText,
    body: longText,
    links: z.array(linkSchema).max(4).default([]),
  }),
  z.object({
    ...baseFields,
    type: z.literal("faq"),
    eyebrow: shortText,
    heading: shortText,
    body: longText,
    items: z
      .array(z.object({ id: idSchema, question: shortText, answer: longText }))
      .max(40)
      .default([]),
  }),
  z.object({
    ...baseFields,
    type: z.literal("contactForm"),
    eyebrow: shortText,
    heading: shortText,
    body: longText,
  }),
  z.object({
    ...baseFields,
    type: z.literal("faqList"),
    eyebrow: shortText,
    heading: shortText,
    body: longText,
  }),
  z.object({
    ...baseFields,
    type: z.literal("therapistList"),
    eyebrow: shortText,
    heading: shortText,
    body: longText,
    columns: z.number().int().min(1).max(4).default(3),
  }),
  z.object({
    ...baseFields,
    type: z.literal("spacer"),
    size: z.enum(["sm", "md", "lg"]).default("md"),
    divider: z.boolean().default(false),
  }),
]);

export type PageSection = z.infer<typeof sectionSchema>;
export type PageSectionType = PageSection["type"];
export type SectionCard = z.infer<typeof cardSchema>;
export type SectionLink = z.infer<typeof linkSchema>;
export type SectionGalleryImage = z.infer<typeof galleryItemSchema>;

export const sectionsSchema = z.array(sectionSchema).max(60);

/** Parse unknown JSON into sections, dropping anything malformed. */
export function normalizeSections(value: unknown): PageSection[] {
  if (!Array.isArray(value)) return [];
  const out: PageSection[] = [];
  for (const raw of value) {
    const parsed = sectionSchema.safeParse(raw);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

export function readSectionsFromMetadata(metadata: unknown): PageSection[] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [];
  return normalizeSections((metadata as Record<string, unknown>).sections);
}

/**
 * Unpublished layout changes. Draft edits are stored separately from the live
 * `sections` array so visitors keep seeing the published page until an admin
 * publishes.
 */
export function readDraftSectionsFromMetadata(metadata: unknown): PageSection[] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [];
  return normalizeSections((metadata as Record<string, unknown>).sectionsDraft);
}

export function hasSectionDraft(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  return Array.isArray((metadata as Record<string, unknown>).sectionsDraft);
}

export function newSectionId(prefix = "s") {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

export type SectionCatalogEntry = {
  type: PageSectionType;
  label: string;
  description: string;
};

export const SECTION_CATALOG: SectionCatalogEntry[] = [
  { type: "hero", label: "Page hero", description: "Eyebrow, big heading, intro and buttons" },
  { type: "richText", label: "Rich text", description: "Free-form formatted text and images" },
  { type: "cardGrid", label: "Card grid", description: "Grid of cards with image, text and link" },
  {
    type: "featureList",
    label: "Feature rows",
    description: "Alternating image + text rows (the Services layout)",
  },
  { type: "gallery", label: "Image gallery", description: "Auto-playing image ribbon" },
  { type: "callout", label: "Callout", description: "Highlighted panel for a key message" },
  { type: "cta", label: "Call to action", description: "Heading, sentence and buttons" },
  { type: "faq", label: "FAQ list", description: "Questions and answers" },
  {
    type: "contactForm",
    label: "Contact form (live)",
    description: "The real enquiry form, submissions go to the admin inbox",
  },
  {
    type: "faqList",
    label: "Published FAQs (live)",
    description: "Automatically lists the FAQs you manage in the admin",
  },
  {
    type: "therapistList",
    label: "Therapist profiles (live)",
    description: "Automatically lists active therapist profiles from the admin",
  },
  { type: "spacer", label: "Spacer / divider", description: "Vertical space or a divider line" },
];

/** A sensible starting point when an admin adds a new section. */
export function createSection(type: PageSectionType): PageSection {
  const base = {
    id: newSectionId(type),
    hidden: false,
    surface: "page" as const,
    spacing: "md" as const,
    width: "content" as const,
    align: "left" as const,
  };
  const card = (title: string): SectionCard => ({
    id: newSectionId("card"),
    title,
    tagline: "",
    body: "Describe this item in a sentence or two.",
    bullets: [],
    image: { src: "", alt: "" },
    href: "",
    linkLabel: "",
  });

  switch (type) {
    case "hero":
      return {
        ...base,
        type: "hero",
        surface: "cream",
        spacing: "lg",
        align: "center",
        width: "wide",
        eyebrow: "Talk Space",
        heading: "A heading for this page",
        headingEmphasis: "",
        headingAfter: "",
        body: "Introduce the page in one or two supportive sentences.",
        image: { src: "", alt: "" },
        links: [
          { id: newSectionId("link"), label: "Book a session", href: "/book", variant: "primary" },
        ],
      };
    case "richText":
      return { ...base, type: "richText", heading: "", html: "<p>Write your content…</p>" };
    case "cardGrid":
      return {
        ...base,
        type: "cardGrid",
        eyebrow: "",
        heading: "Section heading",
        body: "",
        columns: 3,
        cards: [card("First card"), card("Second card"), card("Third card")],
      };
    case "featureList":
      return {
        ...base,
        type: "featureList",
        width: "wide",
        eyebrow: "",
        heading: "",
        body: "",
        cards: [card("First feature"), card("Second feature")],
      };
    case "gallery":
      return {
        ...base,
        type: "gallery",
        surface: "cream",
        width: "full",
        heading: "",
        speedSeconds: 45,
        images: [],
      };
    case "callout":
      return {
        ...base,
        type: "callout",
        surface: "deep",
        eyebrow: "Good to know",
        heading: "An important message",
        body: "Use this panel for a reassurance, note or reminder.",
        bullets: [],
      };
    case "cta":
      return {
        ...base,
        type: "cta",
        surface: "cream",
        align: "center",
        eyebrow: "",
        heading: "Your healing starts with one conversation.",
        body: "Book a confidential session with a licensed therapist.",
        links: [
          { id: newSectionId("link"), label: "Book a session", href: "/book", variant: "primary" },
          { id: newSectionId("link"), label: "See pricing", href: "/pricing", variant: "outline" },
        ],
      };
    case "contactForm":
      return {
        ...base,
        type: "contactForm",
        width: "narrow",
        eyebrow: "Get in touch",
        heading: "Send us a message",
        body: "Our care team responds within one working day.",
      };
    case "faqList":
      return {
        ...base,
        type: "faqList",
        eyebrow: "FAQs",
        heading: "Questions we hear often",
        body: "",
      };
    case "therapistList":
      return {
        ...base,
        type: "therapistList",
        width: "wide",
        eyebrow: "Meet the team",
        heading: "Licensed therapists, matched to your needs.",
        body: "These profiles stay synced with the therapist records managed in the admin.",
        columns: 3,
      };
    case "faq":
      return {
        ...base,
        type: "faq",
        width: "narrow",
        eyebrow: "",
        heading: "Frequently asked questions",
        body: "",
        items: [
          {
            id: newSectionId("faq"),
            question: "A common question",
            answer: "The answer visitors need.",
          },
        ],
      };
    case "spacer":
    default:
      return { ...base, type: "spacer", size: "md", divider: false };
  }
}

export function sectionLabel(type: PageSectionType) {
  return SECTION_CATALOG.find((entry) => entry.type === type)?.label ?? type;
}
