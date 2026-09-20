import type { HomepageSectionId } from "@/lib/content.functions";

export type HomepageSectionCopy = {
  eyebrow: string;
  title: string;
  body: string;
};

export type HomepageSectionCopyMap = Record<HomepageSectionId, HomepageSectionCopy>;

/**
 * Sections whose heading copy can be edited from /admin/homepage. Sections not
 * listed here (hero, carousel, trust) are edited through their own admin tools.
 */
export const EDITABLE_HOMEPAGE_COPY_SECTIONS: HomepageSectionId[] = [
  "specialties",
  "therapists",
  "video",
  "how_it_works",
  "pricing",
  "reviews",
  "journal",
  "faq",
  "cta",
];

export const DEFAULT_HOMEPAGE_SECTION_COPY: HomepageSectionCopyMap = {
  hero: { eyebrow: "", title: "", body: "" },
  carousel: { eyebrow: "", title: "", body: "" },
  trust: { eyebrow: "", title: "", body: "" },
  specialties: {
    eyebrow: "Our specialties",
    title: "Where the work begins",
    body: "Thoughtful, culturally attuned support for the moments and relationships that matter most.",
  },
  therapists: {
    eyebrow: "Our therapists",
    title: "Meet the people behind Talk Space",
    body: "A team grounded in empathy, training, and cultural understanding.",
  },
  video: {
    eyebrow: "Watch",
    title: "Making Marriage Work, from the Talk Space channel.",
    body: "Whether your goal is to deepen your connection, manage conflict or preserve your marriage from infidelity, we use research-based principles for long-lasting, harmonious relationships.",
  },
  how_it_works: {
    eyebrow: "Meet a therapist in 3 easy steps",
    title: "From first message to first session, with dignity, at your pace.",
    body: "",
  },
  pricing: {
    eyebrow: "Affordable therapy plans",
    title: "Professional counselling, effective, confidential and accessible.",
    body: "",
  },
  reviews: {
    eyebrow: "Testimonials",
    title: "Stories of healing, stillness, and finding one's rhythm once more.",
    body: "",
  },
  journal: {
    eyebrow: "Latest from the journal",
    title: "Reflections from Talk Space therapists.",
    body: "",
  },
  faq: {
    eyebrow: "FAQ",
    title: "Answers to the questions we hear most.",
    body: "",
  },
  cta: {
    eyebrow: "Take the first step",
    title: "It's time to move from distress to clarity, connection and stability.",
    body: "",
  },
};

export function normalizeHomepageSectionCopy(value: unknown): HomepageSectionCopyMap {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const entries = Object.entries(DEFAULT_HOMEPAGE_SECTION_COPY).map(([id, fallback]) => {
    const raw = source[id];
    const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const pick = (key: keyof HomepageSectionCopy) =>
      typeof row[key] === "string" && (row[key] as string).trim()
        ? (row[key] as string).trim()
        : fallback[key];
    return [id, { eyebrow: pick("eyebrow"), title: pick("title"), body: pick("body") }];
  });
  return Object.fromEntries(entries) as HomepageSectionCopyMap;
}
