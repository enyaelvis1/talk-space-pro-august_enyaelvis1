import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { createPublicReadCache } from "@/lib/public-read-cache";
import { parseSpecialtyCards, type SpecialtyCard } from "@/lib/specialty-cards";
import { cleanLegacyPostBodyHtml, sanitizeContentHtml } from "@/lib/content-html";
import { TS } from "@/lib/talkspace";

import {
  cloneFormTemplates,
  normalizeFormTemplates,
  type FormTemplateDefinition,
} from "@/lib/form-templates";
import {
  DEFAULT_HOMEPAGE_SECTION_COPY,
  normalizeHomepageSectionCopy,
  type HomepageSectionCopyMap,
} from "@/lib/homepage-section-copy";
import {
  readDraftSectionsFromMetadata,
  readSectionsFromMetadata,
  type PageSection,
} from "@/lib/page-sections";

const CONTENT_MEDIA_BUCKET = "content-media";
export const POSTS_PER_PAGE = 12;

export type HeroSettings = {
  eyebrow: string;
  headingBefore: string;
  headingEmphasis: string;
  description: string;
  primaryCtaLabel: string;
  secondaryCtaLabel: string;
  imageOnePath: string | null;
  imageOneAlt: string;
  imageTwoPath: string | null;
  imageTwoAlt: string;
};

export const DEFAULT_HERO_SETTINGS: HeroSettings = {
  eyebrow: "Healing Hearts · Restoring Hope",
  headingBefore: "Where connection becomes",
  headingEmphasis: "clarity",
  description:
    "A culturally attuned, integrative approach to emotional and relational well-being. Licensed Nigerian therapists, online and in-person, from Lagos to London.",
  primaryCtaLabel: "Book a consultation",
  secondaryCtaLabel: "How we can support you",
  imageOnePath: null,
  imageOneAlt: "African women in a warm counselling conversation",
  imageTwoPath: null,
  imageTwoAlt: "African women discussing care plans in a counselling-style session",
};

export type PublicSiteDetails = {
  brandName: string;
  tagline: string;
  email: string;
  phone: string;
  whatsapp: string;
  hours: string;
  facebook: string;
  twitter: string;
  instagram: string;
  linkedin: string;
  youtube: string;
  logoPath?: string;
  faviconPath?: string;
  socialImagePath?: string;
  appearance?: {
    backgroundColor: string;
    textColor: string;
    accentColor: string;
    bodyFont: "sans" | "serif";
    headingFont: "display" | "sans";
    baseFontSize: "sm" | "md" | "lg";
    buttonStyle: "rounded" | "pill" | "square";
    sectionSpacing: "compact" | "comfortable" | "spacious";
  };
};

export const DEFAULT_SITE_DETAILS: PublicSiteDetails = {
  brandName: "Talk Space Counselling Services",
  tagline: "Confidential. Professional. Accessible.",
  email: "hello@talkspace.ng",
  phone: "+234 809 993 1039",
  whatsapp: "+234 704 846 9090",
  hours: "Mon to Fri · 9:00 am to 5:00 pm WAT",
  facebook: "https://facebook.com/talkspaceng",
  twitter: "https://twitter.com/talkspace_ng",
  instagram: "https://instagram.com/talkspace_ng",
  linkedin: "https://www.linkedin.com/company/talkspaceng",
  youtube: "https://www.youtube.com/@talkspaceng",
  // The responsive wordmark is the default. A non-empty value is an admin-uploaded logo.
  logoPath: "",
  faviconPath: "/favicon.ico",
  socialImagePath: "/og-image.jpg",
  appearance: {
    backgroundColor: "#fbfaf7",
    textColor: "#253044",
    accentColor: "#c27b67",
    bodyFont: "sans",
    headingFont: "display",
    baseFontSize: "md",
    buttonStyle: "rounded",
    sectionSpacing: "comfortable",
  },
};

export type FooterLink = {
  label: string;
  to: string;
};

export type FooterSection = {
  title: string;
  links: FooterLink[];
};

export type FooterOffice = {
  name: string;
  addressLines: string[];
};

export type PublicFooterSettings = {
  crisisHeading: string;
  crisisText: string;
  crisisCtaLabel: string;
  crisisCtaHref: string;
  description: string;
  contactAddress: string;
  offices: FooterOffice[];
  sections: FooterSection[];
  bottomLeft: string;
  bottomRight: string;
  showSocialLinks: boolean;
};

export const DEFAULT_FOOTER_SETTINGS: PublicFooterSettings = {
  crisisHeading: "In a crisis?",
  crisisText: "Talk Space is not an emergency service.",
  crisisCtaLabel: "Get emergency support",
  crisisCtaHref: "/emergency-support",
  description:
    "Talk Space supports individuals and couples working through emotional, behavioural and thinking challenges brought on by stress, trauma, life circumstances or relationship difficulties.",
  contactAddress: "",
  offices: TS.addresses.map((address) => ({
    name: address.city,
    addressLines: [...address.lines],
  })),
  sections: [
    {
      title: "Services",
      links: [
        { to: "/services", label: "All services" },
        { to: "/services", label: "Individual therapy" },
        { to: "/services", label: "Couples counselling" },
        { to: "/services", label: "Family therapy" },
        { to: "/services", label: "Group sessions" },
      ],
    },
    {
      title: "Talk Space",
      links: [
        { to: "/about", label: "About us" },
        { to: "/therapists", label: "Our therapists" },
        { to: "/pricing", label: "Pricing" },
        { to: "/blog", label: "Journal" },
        { to: "/contact", label: "Contact" },
      ],
    },
    {
      title: "Support",
      links: [
        { to: "/faqs", label: "FAQs" },
        { to: "/book", label: "Book a session" },
        { to: "/emergency-support", label: "Emergency support" },
        { to: "/privacy-policy", label: "Privacy policy" },
        { to: "/terms", label: "Terms of service" },
        { to: "/cancellation-refund-policy", label: "Cancellation & refunds" },
      ],
    },
  ],
  bottomLeft: "© {year} {brandName}. All rights reserved.",
  bottomRight: "Sessions are confidential. Ethical practice, always.",
  showSocialLinks: true,
};

export type GoogleReviewEntry = {
  name: string;
  date: string;
  quote: string;
  location?: string;
  avatarUrl?: string;
};

export type GoogleReviewSettings = {
  label: string;
  rating: number;
  reviewCount: number;
  reviewUrl: string;
  reviews: GoogleReviewEntry[];
};

export type HomePricingBilling = "single" | "monthly";

export type HomePricingTier = {
  price: string;
  cadence: string;
};

export type HomePricingPlan = {
  name: string;
  single: HomePricingTier;
  monthly: HomePricingTier;
  description: string;
  features: string[];
  href: string;
  hrefMonthly: string;
  highlight: boolean;
  badgeLabel: string;
  ctaLabel: string;
};

export type HomePricingSettings = {
  fullPricingLabel: string;
  fullPricingHref: string;
  singleTabLabel: string;
  monthlyTabLabel: string;
  defaultBilling: HomePricingBilling;
  note: string;
  plans: HomePricingPlan[];
};

export const DEFAULT_HOME_PRICING_SETTINGS: HomePricingSettings = {
  fullPricingLabel: "Full pricing",
  fullPricingHref: "/pricing",
  singleTabLabel: "Single session",
  monthlyTabLabel: "One-month plan",
  defaultBilling: "single",
  note: "Payments processed securely. Diaspora pricing available on request.",
  plans: [
    {
      name: "Individual Therapy",
      single: { price: "₦55,000", cadence: "per 60-minute session (~$40)" },
      monthly: { price: "₦210,000", cadence: "4 sessions monthly (~$155)" },
      description:
        "Online video sessions using CBT, mindfulness-based, solution-focused and psychodynamic approaches.",
      features: [
        "Online video session",
        "Cognitive Behavioral Therapy",
        "Mindfulness-based approach",
        "Solution-focused therapy",
      ],
      href: "/book?service=individual",
      hrefMonthly: "/purchase?service=one_month_individual&mode=online",
      highlight: false,
      badgeLabel: "",
      ctaLabel: "Book now",
    },
    {
      name: "Couple Therapy",
      single: { price: "₦90,000", cadence: "per 90-minute session (~$70)" },
      monthly: { price: "₦342,000", cadence: "4 sessions monthly (~$260)" },
      description:
        "Structured couple therapy with free assessments, personal and couple profiling.",
      features: [
        "Online video session",
        "Free assessments & couple profiling",
        "Infidelity recovery",
        "Emotional intimacy & conflict skills",
      ],
      href: "/book?service=couple",
      hrefMonthly: "/purchase?service=one_month_couple&mode=online",
      highlight: true,
      badgeLabel: "Most chosen",
      ctaLabel: "Book now",
    },
    {
      name: "Teen / Child Therapy",
      single: { price: "₦50,000", cadence: "per 60-minute session (~$37)" },
      monthly: { price: "₦100,000", cadence: "psychotherapy per session (~$75)" },
      description:
        "Play, art and behavioural therapy with licensed child and adolescent specialists.",
      features: [
        "Behavioural management",
        "School-related issues",
        "Play & art therapy",
        "Licensed child/teen therapists",
      ],
      href: "tel:+2347048469090",
      hrefMonthly: "tel:+2347048469090",
      highlight: false,
      badgeLabel: "",
      ctaLabel: "Book now",
    },
  ],
};

function normalizeHomePricingTier(value: unknown, fallback: HomePricingTier): HomePricingTier {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    price: typeof row.price === "string" && row.price.trim() ? row.price.trim() : fallback.price,
    cadence:
      typeof row.cadence === "string" && row.cadence.trim() ? row.cadence.trim() : fallback.cadence,
  };
}

function normalizeHomePricingPlan(value: unknown, fallback: HomePricingPlan): HomePricingPlan {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const features = Array.isArray(row.features)
    ? row.features.flatMap((feature) =>
        typeof feature === "string" && feature.trim() ? [feature.trim()] : [],
      )
    : [];

  return {
    name: typeof row.name === "string" && row.name.trim() ? row.name.trim() : fallback.name,
    single: normalizeHomePricingTier(row.single, fallback.single),
    monthly: normalizeHomePricingTier(row.monthly, fallback.monthly),
    description:
      typeof row.description === "string" && row.description.trim()
        ? row.description.trim()
        : fallback.description,
    features: features.length ? features.slice(0, 6) : fallback.features,
    href: typeof row.href === "string" && row.href.trim() ? row.href.trim() : fallback.href,
    hrefMonthly:
      typeof row.hrefMonthly === "string" && row.hrefMonthly.trim()
        ? row.hrefMonthly.trim()
        : fallback.hrefMonthly,
    highlight: typeof row.highlight === "boolean" ? row.highlight : fallback.highlight,
    badgeLabel: typeof row.badgeLabel === "string" ? row.badgeLabel.trim() : fallback.badgeLabel,
    ctaLabel:
      typeof row.ctaLabel === "string" && row.ctaLabel.trim()
        ? row.ctaLabel.trim()
        : fallback.ctaLabel,
  };
}

export function normalizeHomePricingSettings(value: unknown): HomePricingSettings {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const sourcePlans = Array.isArray(row.plans) ? row.plans : [];
  const plans = DEFAULT_HOME_PRICING_SETTINGS.plans.map((fallback, index) =>
    normalizeHomePricingPlan(sourcePlans[index], fallback),
  );

  return {
    fullPricingLabel:
      typeof row.fullPricingLabel === "string" && row.fullPricingLabel.trim()
        ? row.fullPricingLabel.trim()
        : DEFAULT_HOME_PRICING_SETTINGS.fullPricingLabel,
    fullPricingHref:
      typeof row.fullPricingHref === "string" && row.fullPricingHref.trim()
        ? row.fullPricingHref.trim()
        : DEFAULT_HOME_PRICING_SETTINGS.fullPricingHref,
    singleTabLabel:
      typeof row.singleTabLabel === "string" && row.singleTabLabel.trim()
        ? row.singleTabLabel.trim()
        : DEFAULT_HOME_PRICING_SETTINGS.singleTabLabel,
    monthlyTabLabel:
      typeof row.monthlyTabLabel === "string" && row.monthlyTabLabel.trim()
        ? row.monthlyTabLabel.trim()
        : DEFAULT_HOME_PRICING_SETTINGS.monthlyTabLabel,
    defaultBilling: row.defaultBilling === "monthly" ? "monthly" : "single",
    note:
      typeof row.note === "string" && row.note.trim()
        ? row.note.trim()
        : DEFAULT_HOME_PRICING_SETTINGS.note,
    plans,
  };
}

const normalizeGoogleReviewEntry = (value: unknown): GoogleReviewEntry | null => {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const name = typeof row.name === "string" ? row.name.trim() : "";
  const quote = typeof row.quote === "string" ? row.quote.trim() : "";
  if (!name || !quote) return null;
  return {
    name,
    date: typeof row.date === "string" && row.date.trim() ? row.date.trim() : "Google review",
    quote,
    location:
      typeof row.location === "string" && row.location.trim() ? row.location.trim() : undefined,
    avatarUrl:
      typeof row.avatarUrl === "string" && row.avatarUrl.trim()
        ? row.avatarUrl.trim()
        : typeof row.avatarPath === "string" && row.avatarPath.trim()
          ? row.avatarPath.trim()
          : undefined,
  };
};

export const DEFAULT_GOOGLE_REVIEW_SETTINGS: GoogleReviewSettings = {
  label: "on Google",
  rating: 5,
  reviewCount: 51,
  reviewUrl:
    "https://www.google.com/maps/place/Talk+Space+Counselling/@6.6023494,3.3490401,17z/data=!4m14!1m7!3m6!1s0x103b8de64685748f:0x8dc76851d944dcc5!2sTalk+Space+Counselling!8m2!3d6.6023494!4d3.351615!16s%2Fg%2F11thf1nftr!3m5!1s0x103b8de64685748f:0x8dc76851d944dcc5!8m2!3d6.6023494!4d3.351615!16s%2Fg%2F11thf1nftr?entry=ttu",
  reviews: [
    {
      name: "ibrahim oliyide",
      date: "6 months ago",
      quote:
        "My experience with Tunbi Olabisi's online counseling service was very positive. The individual therapy sessions helped me manage stress and emotional challenges.",
    },
    {
      name: "Inioluwa Opemipo",
      date: "6 months ago",
      quote:
        "From couple therapy to individual sessions, every interaction felt supportive and professional. Tunbi Olabisi truly cares about her clients.",
    },
    {
      name: "Faizah Bukoye",
      date: "10 months ago",
      quote:
        "Honest review here - if you have been looking for a counselor, look no further. My experience with Talkspace was an amazing one from the first call to my last session.",
    },
    {
      name: "Oluwafemi Adeyinka",
      date: "11 months ago",
      quote:
        "At first I was not sure online counselling would help, but Talkspace proved me wrong. The sessions felt safe, real, and gave me practical steps to manage my emotions better.",
    },
  ],
};

function normalizeGoogleReviewSettings(value: unknown): GoogleReviewSettings {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const reviews = Array.isArray(row.reviews)
    ? row.reviews.flatMap((entry) => {
        const normalized = normalizeGoogleReviewEntry(entry);
        return normalized ? [normalized] : [];
      })
    : [];

  return {
    label:
      typeof row.label === "string" && row.label.trim()
        ? row.label
        : DEFAULT_GOOGLE_REVIEW_SETTINGS.label,
    rating:
      typeof row.rating === "number" && row.rating >= 0 && row.rating <= 5
        ? row.rating
        : DEFAULT_GOOGLE_REVIEW_SETTINGS.rating,
    reviewCount:
      typeof row.reviewCount === "number" && row.reviewCount >= 0
        ? Math.round(row.reviewCount)
        : DEFAULT_GOOGLE_REVIEW_SETTINGS.reviewCount,
    reviewUrl:
      typeof row.reviewUrl === "string" && row.reviewUrl.trim()
        ? row.reviewUrl
        : DEFAULT_GOOGLE_REVIEW_SETTINGS.reviewUrl,
    reviews: reviews.length > 0 ? reviews : DEFAULT_GOOGLE_REVIEW_SETTINGS.reviews,
  };
}

export const getPublicFormTemplates = createServerFn({ method: "GET" }).handler(
  async (): Promise<FormTemplateDefinition[]> => {
    const config = await getPublicClient();
    if (!config) return cloneFormTemplates();
    const { data, error } = await config.client
      .from("site_settings")
      .select("value")
      .eq("key", "form_templates")
      .maybeSingle();
    if (error) return cloneFormTemplates();
    return normalizeFormTemplates(data?.value ?? cloneFormTemplates());
  },
);

export type HomepageSectionId =
  | "hero"
  | "carousel"
  | "trust"
  | "specialties"
  | "therapists"
  | "video"
  | "how_it_works"
  | "pricing"
  | "reviews"
  | "journal"
  | "faq"
  | "cta";

export type HomepageSectionConfig = {
  id: HomepageSectionId;
  visible: boolean;
};

export const DEFAULT_HOMEPAGE_SECTIONS: HomepageSectionConfig[] = [
  "hero",
  "carousel",
  "trust",
  "specialties",
  "therapists",
  "video",
  "how_it_works",
  "pricing",
  "reviews",
  "journal",
  "faq",
  "cta",
].map((id) => ({ id: id as HomepageSectionId, visible: true }));

const homepageSectionIds = new Set<HomepageSectionId>(
  DEFAULT_HOMEPAGE_SECTIONS.map((section) => section.id),
);

export const getPublicHomepageSections = createServerFn({ method: "GET" }).handler(
  async (): Promise<HomepageSectionConfig[]> => {
    const config = await getPublicClient();
    if (!config) return DEFAULT_HOMEPAGE_SECTIONS;
    const { data, error } = await config.client
      .from("site_settings")
      .select("value")
      .eq("key", "home_sections")
      .maybeSingle();
    if (error || !Array.isArray(data?.value)) return DEFAULT_HOMEPAGE_SECTIONS;

    const stored = data.value.flatMap((value) => {
      if (!value || typeof value !== "object") return [];
      const row = value as Record<string, unknown>;
      return typeof row.id === "string" && homepageSectionIds.has(row.id as HomepageSectionId)
        ? [{ id: row.id as HomepageSectionId, visible: row.visible !== false }]
        : [];
    });
    const seen = new Set(stored.map((section) => section.id));
    return [...stored, ...DEFAULT_HOMEPAGE_SECTIONS.filter((section) => !seen.has(section.id))];
  },
);

export const getPublicGoogleReviewSettings = createServerFn({ method: "GET" }).handler(
  async (): Promise<GoogleReviewSettings> => {
    const config = await getPublicClient();
    if (!config) return DEFAULT_GOOGLE_REVIEW_SETTINGS;
    const { data, error } = await config.client
      .from("site_settings")
      .select("value")
      .eq("key", "google_reviews")
      .maybeSingle();
    if (error) return DEFAULT_GOOGLE_REVIEW_SETTINGS;
    return normalizeGoogleReviewSettings(data?.value ?? {});
  },
);

type ContentKind = "page" | "post" | "category";

type ContentMetadata = {
  category_ids?: unknown;
  template?: "default" | "landing" | "article";
  tags?: unknown;
  sectionBlocks?: unknown;
  appearance?: unknown;
  seo?: unknown;
};

const postSlugAliases: Record<string, string> = {
  "beyond-silence": "beyondsilence",
  "why-marriage-does-not-work": "whymarriagedoesnotwork",
};

export type ContentSectionBlock = {
  type: "intro" | "features" | "callout" | "cta";
  heading: string;
  body: string;
  items: string[];
  ctaLabel?: string;
  ctaHref?: string;
};

export type ContentAppearanceOverride = {
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
};

export type RenderedContentEntry = {
  id: string;
  kind: ContentKind;
  slug: string;
  title: string;
  excerpt: string;
  bodyHtml: string;
  author: string;
  date: string;
  category: string;
  imageUrl: string | null;
  template: "default" | "landing" | "article";
  tags: string[];
  sectionBlocks: ContentSectionBlock[];
  sections: PageSection[];
  /** Unpublished layout changes, visible to admins in edit/preview only. */
  draftSections: PageSection[];

  appearance?: ContentAppearanceOverride;
  seo: ContentSeoOverride;
};

export type ContentSeoOverride = {
  metaTitle: string | null;
  metaDescription: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImageUrl: string | null;
  noindex: boolean;
};

export type PublishedPostsPage = {
  posts: RenderedContentEntry[];
  page: number;
  pageCount: number;
  total: number;
};

function getConfig() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}

function decodeEntities(value: string) {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    hellip: "…",
    ldquo: "“",
    lsquo: "‘",
    nbsp: " ",
    ndash: "–",
    mdash: "—",
    quot: '"',
    rdquo: "”",
    rsquo: "’",
  };

  return value.replace(/&(#x?[\da-f]+|[a-z]+);/gi, (entity, code: string) => {
    if (code.startsWith("#x")) return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
    if (code.startsWith("#")) return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
    return namedEntities[code.toLowerCase()] ?? entity;
  });
}

function stripHtml(value: string | null) {
  if (!value) return "";
  return decodeEntities(value.replace(/<[^>]*>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

function formatDate(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Lagos",
  }).format(new Date(value));
}

function categoryName(metadata: ContentMetadata | null, categories: Map<number, string>) {
  const ids = Array.isArray(metadata?.category_ids)
    ? metadata.category_ids.filter((id): id is number => typeof id === "number")
    : [];
  return categories.get(ids[0] ?? -1) ?? "Talk Space Journal";
}

function sectionBlocks(metadata: ContentMetadata | null): ContentSectionBlock[] {
  if (!Array.isArray(metadata?.sectionBlocks)) return [];
  return metadata.sectionBlocks.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;
    if (!(["intro", "features", "callout", "cta"] as string[]).includes(String(row.type)))
      return [];
    const heading = typeof row.heading === "string" ? row.heading.trim() : "";
    const body = typeof row.body === "string" ? row.body.trim() : "";
    if (!heading && !body) return [];
    return [
      {
        type: row.type as ContentSectionBlock["type"],
        heading: heading.slice(0, 160),
        body: body.slice(0, 1200),
        items: Array.isArray(row.items)
          ? row.items
              .filter((item): item is string => typeof item === "string")
              .map((item) => item.trim())
              .filter(Boolean)
              .slice(0, 8)
          : [],
        ctaLabel: typeof row.ctaLabel === "string" ? row.ctaLabel.trim().slice(0, 80) : undefined,
        ctaHref:
          typeof row.ctaHref === "string" && /^\/(?!\/)/.test(row.ctaHref)
            ? row.ctaHref.trim().slice(0, 200)
            : undefined,
      },
    ];
  });
}

function contentAppearance(
  metadata: ContentMetadata | null,
): ContentAppearanceOverride | undefined {
  if (!metadata?.appearance || typeof metadata.appearance !== "object") return undefined;
  const value = metadata.appearance as Record<string, unknown>;
  const color = (key: string) =>
    typeof value[key] === "string" && /^#[0-9a-f]{6}$/i.test(value[key] as string)
      ? (value[key] as string)
      : undefined;
  const result = {
    backgroundColor: color("backgroundColor"),
    textColor: color("textColor"),
    accentColor: color("accentColor"),
  };
  return Object.values(result).some(Boolean) ? result : undefined;
}

function mediaUrl(path: string | null, supabaseUrl: string) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path
    .replace(/^\/+/, "")
    .replace(new RegExp(`^${CONTENT_MEDIA_BUCKET}/`, "i"), "");
  const encodedPath = normalizedPath.split("/").map(encodeURIComponent).join("/");
  return `${supabaseUrl}/storage/v1/object/public/${CONTENT_MEDIA_BUCKET}/${encodedPath}`;
}

function safeDecodeUriComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isBrandPostImage(src: string) {
  const value = (() => {
    try {
      return safeDecodeUriComponent(new URL(src).pathname);
    } catch {
      return safeDecodeUriComponent(src);
    }
  })().toLowerCase();

  return (
    /talk[-_\s]?space[-_\s]?1[-_\s]?1/.test(value) || /talk[-_\s]?space[-_\s]?logo/.test(value)
  );
}

function firstPostImageUrl(bodyHtml: string, supabaseUrl: string) {
  const srcs = [...bodyHtml.matchAll(/<img\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1/gi)].map(
    (match) => match[2],
  );

  for (const rawSrc of srcs) {
    const src = decodeEntities(rawSrc.trim());
    if (!src || /^data:/i.test(src) || isBrandPostImage(src)) continue;
    if (/^\/\//.test(src)) return `https:${src}`;
    return mediaUrl(src, supabaseUrl);
  }

  return null;
}

function contentSeo(metadata: ContentMetadata | null, supabaseUrl: string): ContentSeoOverride {
  const raw =
    metadata?.seo && typeof metadata.seo === "object"
      ? (metadata.seo as Record<string, unknown>)
      : {};
  const text = (key: string, max: number) => {
    const value = raw[key];
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, max) : null;
  };
  const image = typeof raw.ogImage === "string" ? raw.ogImage.trim() : "";
  return {
    metaTitle: text("metaTitle", 120),
    metaDescription: text("metaDescription", 320),
    ogTitle: text("ogTitle", 120),
    ogDescription: text("ogDescription", 320),
    ogImageUrl: image ? mediaUrl(image, supabaseUrl) : null,
    noindex: raw.noindex === true,
  };
}

function parseHeroSettings(value: unknown, supabaseUrl: string): HeroSettings {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    eyebrow: typeof raw.eyebrow === "string" ? raw.eyebrow : DEFAULT_HERO_SETTINGS.eyebrow,
    headingBefore:
      typeof raw.headingBefore === "string"
        ? raw.headingBefore
        : DEFAULT_HERO_SETTINGS.headingBefore,
    headingEmphasis:
      typeof raw.headingEmphasis === "string"
        ? raw.headingEmphasis
        : DEFAULT_HERO_SETTINGS.headingEmphasis,
    description:
      typeof raw.description === "string" ? raw.description : DEFAULT_HERO_SETTINGS.description,
    primaryCtaLabel:
      typeof raw.primaryCtaLabel === "string"
        ? raw.primaryCtaLabel
        : DEFAULT_HERO_SETTINGS.primaryCtaLabel,
    secondaryCtaLabel:
      typeof raw.secondaryCtaLabel === "string"
        ? raw.secondaryCtaLabel
        : DEFAULT_HERO_SETTINGS.secondaryCtaLabel,
    imageOnePath: mediaUrl(
      typeof raw.imageOnePath === "string" ? raw.imageOnePath : null,
      supabaseUrl,
    ),
    imageOneAlt:
      typeof raw.imageOneAlt === "string" ? raw.imageOneAlt : DEFAULT_HERO_SETTINGS.imageOneAlt,
    imageTwoPath: mediaUrl(
      typeof raw.imageTwoPath === "string" ? raw.imageTwoPath : null,
      supabaseUrl,
    ),
    imageTwoAlt:
      typeof raw.imageTwoAlt === "string" ? raw.imageTwoAlt : DEFAULT_HERO_SETTINGS.imageTwoAlt,
  };
}

export const getPublicHeroSettings = createServerFn({ method: "GET" }).handler(
  async (): Promise<HeroSettings> => {
    const config = await getPublicClient();
    if (!config) return DEFAULT_HERO_SETTINGS;

    setResponseHeader("Cache-Control", "no-store");
    const { data, error } = await config.client
      .from("site_settings")
      .select("value")
      .eq("key", "home_hero")
      .maybeSingle();
    if (error) throw error;
    return parseHeroSettings(data?.value, config.url);
  },
);

export type SpecialtyCarouselItem = {
  title: string;
  alt: string;
  imageUrl: string | null;
};

export const getPublicSpecialtyCarousel = createServerFn({ method: "GET" }).handler(
  async (): Promise<SpecialtyCarouselItem[] | null> => {
    const config = await getPublicClient();
    if (!config) return null;
    // Homepage content is administrator-managed and should not remain behind
    // the hero's shared five-minute CDN cache after an editor saves changes.
    setResponseHeader("Cache-Control", "no-store");
    const { data, error } = await config.client
      .from("site_settings")
      .select("value")
      .eq("key", "home_specialties")
      .maybeSingle();
    if (error) throw error;
    if (!Array.isArray(data?.value)) return null;
    return data.value.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as Record<string, unknown>;
      if (typeof row.title !== "string" || typeof row.alt !== "string") return [];
      return [
        {
          title: row.title,
          alt: row.alt,
          imageUrl:
            typeof row.imageUrl === "string" && row.imageUrl
              ? mediaUrl(row.imageUrl, config.url)
              : null,
        },
      ];
    });
  },
);

function parseSiteDetails(value: unknown): PublicSiteDetails {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  type StringKey = {
    [K in keyof PublicSiteDetails]: PublicSiteDetails[K] extends string ? K : never;
  }[keyof PublicSiteDetails];
  const read = (key: StringKey) => {
    const rawValue = raw[key as string];
    return typeof rawValue === "string" && rawValue.trim()
      ? rawValue.trim()
      : (DEFAULT_SITE_DETAILS[key as keyof PublicSiteDetails] as string);
  };

  return {
    brandName: read("brandName"),
    tagline: read("tagline"),
    email: read("email"),
    phone: read("phone"),
    whatsapp: read("whatsapp"),
    hours: read("hours"),
    facebook: read("facebook"),
    twitter: read("twitter"),
    instagram: read("instagram"),
    linkedin: read("linkedin"),
    youtube: read("youtube"),
    logoPath: typeof raw.logoPath === "string" ? raw.logoPath : DEFAULT_SITE_DETAILS.logoPath,
    faviconPath:
      typeof raw.faviconPath === "string" ? raw.faviconPath : DEFAULT_SITE_DETAILS.faviconPath,
    socialImagePath:
      typeof raw.socialImagePath === "string"
        ? raw.socialImagePath
        : DEFAULT_SITE_DETAILS.socialImagePath,
    appearance:
      raw.appearance && typeof raw.appearance === "object"
        ? {
            backgroundColor:
              typeof (raw.appearance as Record<string, unknown>).backgroundColor === "string"
                ? (raw.appearance as Record<string, string>).backgroundColor
                : DEFAULT_SITE_DETAILS.appearance!.backgroundColor,
            textColor:
              typeof (raw.appearance as Record<string, unknown>).textColor === "string"
                ? (raw.appearance as Record<string, string>).textColor
                : DEFAULT_SITE_DETAILS.appearance!.textColor,
            accentColor:
              typeof (raw.appearance as Record<string, unknown>).accentColor === "string"
                ? (raw.appearance as Record<string, string>).accentColor
                : DEFAULT_SITE_DETAILS.appearance!.accentColor,
            bodyFont:
              (raw.appearance as Record<string, unknown>).bodyFont === "serif" ? "serif" : "sans",
            headingFont:
              (raw.appearance as Record<string, unknown>).headingFont === "sans"
                ? "sans"
                : "display",
            baseFontSize: ["sm", "md", "lg"].includes(
              String((raw.appearance as Record<string, unknown>).baseFontSize),
            )
              ? ((raw.appearance as Record<string, unknown>).baseFontSize as "sm" | "md" | "lg")
              : "md",
            buttonStyle: ["rounded", "pill", "square"].includes(
              String((raw.appearance as Record<string, unknown>).buttonStyle),
            )
              ? ((raw.appearance as Record<string, unknown>).buttonStyle as
                  "rounded" | "pill" | "square")
              : "rounded",
            sectionSpacing: ["compact", "comfortable", "spacious"].includes(
              String((raw.appearance as Record<string, unknown>).sectionSpacing),
            )
              ? ((raw.appearance as Record<string, unknown>).sectionSpacing as
                  "compact" | "comfortable" | "spacious")
              : "comfortable",
          }
        : DEFAULT_SITE_DETAILS.appearance,
  };
}

export function parseFooterSettings(value: unknown): PublicFooterSettings {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const read = (
    key: keyof Omit<PublicFooterSettings, "offices" | "sections" | "showSocialLinks">,
  ) => {
    const rawValue = raw[key];
    return typeof rawValue === "string" && rawValue.trim()
      ? rawValue.trim()
      : DEFAULT_FOOTER_SETTINGS[key];
  };
  const sections = Array.isArray(raw.sections)
    ? raw.sections.flatMap((section): FooterSection[] => {
        if (!section || typeof section !== "object") return [];
        const item = section as Record<string, unknown>;
        const title = typeof item.title === "string" ? item.title.trim() : "";
        if (!title) return [];
        const links = Array.isArray(item.links)
          ? item.links.flatMap((link): FooterLink[] => {
              if (!link || typeof link !== "object") return [];
              const rawLink = link as Record<string, unknown>;
              const label = typeof rawLink.label === "string" ? rawLink.label.trim() : "";
              const to = typeof rawLink.to === "string" ? rawLink.to.trim() : "";
              if (!label || !to) return [];
              return [{ label, to }];
            })
          : [];
        return links.length ? [{ title, links }] : [];
      })
    : [];
  const offices = Array.isArray(raw.offices)
    ? raw.offices.flatMap((office): FooterOffice[] => {
        if (!office || typeof office !== "object") return [];
        const item = office as Record<string, unknown>;
        const name = typeof item.name === "string" ? item.name.trim() : "";
        const addressLines = Array.isArray(item.addressLines)
          ? item.addressLines
              .filter((line): line is string => typeof line === "string")
              .map((line) => line.trim())
              .filter(Boolean)
          : [];
        return name && addressLines.length ? [{ name, addressLines }] : [];
      })
    : [];

  return {
    crisisHeading: read("crisisHeading"),
    crisisText: read("crisisText"),
    crisisCtaLabel: read("crisisCtaLabel"),
    crisisCtaHref: read("crisisCtaHref"),
    description: read("description"),
    contactAddress: read("contactAddress"),
    offices:
      offices.length || (typeof raw.contactAddress === "string" && raw.contactAddress.trim())
        ? offices
        : DEFAULT_FOOTER_SETTINGS.offices,
    sections: sections.length ? sections : DEFAULT_FOOTER_SETTINGS.sections,
    bottomLeft: read("bottomLeft"),
    bottomRight: read("bottomRight"),
    showSocialLinks:
      typeof raw.showSocialLinks === "boolean"
        ? raw.showSocialLinks
        : DEFAULT_FOOTER_SETTINGS.showSocialLinks,
  };
}

const publicSiteDetailsCache = createPublicReadCache<PublicSiteDetails>(60_000);
const publicFooterSettingsCache = createPublicReadCache<PublicFooterSettings>(60_000);
const publicShellCache = createPublicReadCache<PublicShellData>(60_000);
type PublicPublishedEntryCache = ReturnType<
  typeof createPublicReadCache<RenderedContentEntry | null>
>;
const publicPublishedEntryCaches = new Map<string, PublicPublishedEntryCache>();

function getPublicPublishedEntryCache(key: string) {
  let cache = publicPublishedEntryCaches.get(key);
  if (!cache) {
    cache = createPublicReadCache<RenderedContentEntry | null>(60_000);
    publicPublishedEntryCaches.set(key, cache);
  }
  return cache;
}

export function clearPublicContentEntryCache() {
  for (const cache of publicPublishedEntryCaches.values()) cache.clear();
}

export type PublicShellData = {
  details: PublicSiteDetails;
  footer: PublicFooterSettings;
};

export const DEFAULT_PUBLIC_SHELL_DATA: PublicShellData = {
  details: DEFAULT_SITE_DETAILS,
  footer: DEFAULT_FOOTER_SETTINGS,
};

export function clearPublicSiteSettingsCache() {
  publicSiteDetailsCache.clear();
  publicFooterSettingsCache.clear();
  publicShellCache.clear();
}

export const getPublicShellData = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicShellData> => {
    setResponseHeader("Cache-Control", "no-store");
    try {
      const config = await getPublicClient();
      if (!config) return DEFAULT_PUBLIC_SHELL_DATA;

      return await publicShellCache.get(async () => {
        const { data, error } = await config.client
          .from("site_settings")
          .select("key, value")
          .in("key", ["site_details", "footer_settings"]);
        if (error) throw error;

        const values = new Map((data ?? []).map((row) => [row.key, row.value] as const));
        return {
          details: parseSiteDetails(values.get("site_details")),
          footer: parseFooterSettings(values.get("footer_settings")),
        };
      });
    } catch (error) {
      console.error("Unable to reach public shell settings; using defaults.", error);
      return DEFAULT_PUBLIC_SHELL_DATA;
    }
  },
);

export const getPublicSiteDetails = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicSiteDetails> => {
    setResponseHeader("Cache-Control", "no-store");
    try {
      const config = await getPublicClient();
      if (!config) return DEFAULT_SITE_DETAILS;
      return await publicSiteDetailsCache.get(async () => {
        const { data, error } = await config.client
          .from("site_settings")
          .select("value")
          .eq("key", "site_details")
          .maybeSingle();
        if (error) throw error;
        return parseSiteDetails(data?.value);
      });
    } catch (error) {
      console.error("Unable to reach public site settings; using defaults.", error);
      return DEFAULT_SITE_DETAILS;
    }
  },
);

export const getPublicFooterSettings = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicFooterSettings> => {
    setResponseHeader("Cache-Control", "no-store");
    try {
      const config = await getPublicClient();
      if (!config) return DEFAULT_FOOTER_SETTINGS;

      return await publicFooterSettingsCache.get(async () => {
        const { data, error } = await config.client
          .from("site_settings")
          .select("value")
          .eq("key", "footer_settings")
          .maybeSingle();
        if (error) throw error;
        return parseFooterSettings(data?.value);
      });
    } catch (error) {
      console.error("Unable to reach public footer settings; using defaults.", error);
      return DEFAULT_FOOTER_SETTINGS;
    }
  },
);

export type PublicTherapist = {
  slug: string;
  fullName: string;
  roleTitle: string;
  credentials: string | null;
  location: string | null;
  bio: string | null;
  specialties: string[];
  imageUrl: string | null;
};

export const getPublicTherapists = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicTherapist[]> => {
    const config = await getPublicClient();
    if (!config) return [];

    setResponseHeader("Cache-Control", "no-store");
    const { data, error } = await config.client
      .from("therapists")
      .select("slug, full_name, role_title, credentials, location, bio, specialties, image_url")
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("full_name", { ascending: true });
    if (error) throw error;

    return (data ?? []).map((therapist) => ({
      slug: therapist.slug,
      fullName: therapist.full_name,
      roleTitle: therapist.role_title,
      credentials: therapist.credentials,
      location: therapist.location,
      bio: therapist.bio,
      specialties: therapist.specialties ?? [],
      imageUrl: therapist.image_url,
    }));
  },
);

async function getPublicClient() {
  const config = getConfig();
  if (!config) return null;

  const client = createClient(config.url, config.key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return { ...config, client };
}

async function getCategories(client: SupabaseClient | null) {
  if (!client) return new Map<number, string>();
  const { data, error } = await client
    .from("content_entries")
    .select("source_id, title")
    .eq("kind", "category")
    .eq("source_status", "publish")
    .is("archived_at", null);
  if (error) throw error;
  return new Map(data.map((category) => [category.source_id, decodeEntities(category.title)]));
}

export function renderContentEntry(
  entry: {
    id: string;
    kind: ContentKind;
    slug: string;
    title: string;
    excerpt_html: string | null;
    body_html?: string | null;
    author_name: string | null;
    published_at: string | null;
    featured_media_path: string | null;
    metadata: ContentMetadata | null;
  },
  categories: Map<number, string>,
  supabaseUrl: string,
): RenderedContentEntry {
  const cleanedBodyHtml =
    entry.kind === "post" ? cleanLegacyPostBodyHtml(entry.body_html) : (entry.body_html ?? "");
  const rawBodyHtml = entry.kind === "post" ? sanitizeContentHtml(entry.body_html) : "";
  const bodyHtml = sanitizeContentHtml(cleanedBodyHtml);

  return {
    id: entry.id,
    kind: entry.kind,
    slug: entry.slug,
    title: decodeEntities(entry.title),
    excerpt: stripHtml(entry.excerpt_html),
    bodyHtml,
    author: decodeEntities(entry.author_name || "Talk Space"),
    date: formatDate(entry.published_at),
    category: categoryName(entry.metadata, categories),
    imageUrl:
      mediaUrl(entry.featured_media_path, supabaseUrl) ??
      (entry.kind === "post"
        ? (firstPostImageUrl(bodyHtml, supabaseUrl) ?? firstPostImageUrl(rawBodyHtml, supabaseUrl))
        : null),
    template: entry.metadata?.template ?? (entry.kind === "post" ? "article" : "default"),
    tags: Array.isArray(entry.metadata?.tags)
      ? entry.metadata.tags.filter((tag): tag is string => typeof tag === "string")
      : [],
    sectionBlocks: sectionBlocks(entry.metadata),
    sections: readSectionsFromMetadata(entry.metadata),
    draftSections: readDraftSectionsFromMetadata(entry.metadata),

    appearance: contentAppearance(entry.metadata),
    seo: contentSeo(entry.metadata, supabaseUrl),
  };
}

export const getPublishedPosts = createServerFn({ method: "GET" }).handler(async () => {
  const config = await getPublicClient();
  if (!config) return [];

  setResponseHeader("Cache-Control", "no-store");

  const [{ data, error }, categories] = await Promise.all([
    config.client
      .from("content_entries")
      .select(
        "id, kind, slug, title, excerpt_html, body_html, author_name, published_at, featured_media_path, metadata",
      )
      .eq("kind", "post")
      .eq("source_status", "publish")
      .is("archived_at", null)
      .order("published_at", { ascending: false }),
    getCategories(config.client),
  ]);
  if (error) throw error;

  return data.map((entry) => renderContentEntry(entry, categories, config.url));
});

export const getPublishedPostsPage = createServerFn({ method: "GET" })
  .validator((data: { page: number }) => data)
  .handler(async ({ data }) => {
    const config = await getPublicClient();
    if (!config) return { posts: [], page: 1, pageCount: 1, total: 0 };

    setResponseHeader("Cache-Control", "no-store");

    const page = Math.max(1, Math.floor(data.page) || 1);
    const from = (page - 1) * POSTS_PER_PAGE;
    const to = from + POSTS_PER_PAGE - 1;
    const [{ data: entries, count, error }, categories] = await Promise.all([
      config.client
        .from("content_entries")
        .select(
          "id, kind, slug, title, excerpt_html, body_html, author_name, published_at, featured_media_path, metadata, updated_at",
          { count: "exact" },
        )
        .eq("kind", "post")
        .eq("source_status", "publish")
        .is("archived_at", null)
        .order("updated_at", { ascending: false })
        .order("published_at", { ascending: false })
        .range(from, to),
      getCategories(config.client),
    ]);
    if (error) throw error;

    const total = count ?? 0;
    return {
      posts: entries.map((entry) => renderContentEntry(entry, categories, config.url)),
      page,
      pageCount: Math.max(1, Math.ceil(total / POSTS_PER_PAGE)),
      total,
    } satisfies PublishedPostsPage;
  });

export const getPublishedPages = createServerFn({ method: "GET" }).handler(async () => {
  const config = await getPublicClient();
  if (!config) return [];

  setResponseHeader("Cache-Control", "no-store");

  const { data, error } = await config.client
    .from("content_entries")
    .select(
      "id, kind, slug, title, excerpt_html, author_name, published_at, featured_media_path, metadata",
    )
    .eq("kind", "page")
    .eq("source_status", "publish")
    .is("archived_at", null)
    .order("title");
  if (error) throw error;

  return data.map((entry) => renderContentEntry(entry, new Map<number, string>(), config.url));
});

export const getPublishedPost = createServerFn({ method: "GET" })
  .validator((data: { slug: string }) => data)
  .handler(async ({ data }) => {
    const config = await getPublicClient();
    if (!config) return null;

    setResponseHeader("Cache-Control", "no-store");

    const canonicalSlug = postSlugAliases[data.slug] ?? data.slug;
    const candidateSlugs = canonicalSlug === data.slug ? [data.slug] : [data.slug, canonicalSlug];

    const [{ data: entry, error }, categories] = await Promise.all([
      config.client
        .from("content_entries")
        .select(
          "id, kind, slug, title, excerpt_html, body_html, author_name, published_at, featured_media_path, metadata",
        )
        .eq("kind", "post")
        .eq("source_status", "publish")
        .is("archived_at", null)
        .in("slug", candidateSlugs)
        .order("published_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      getCategories(config.client),
    ]);
    if (error) throw error;
    return entry ? renderContentEntry(entry, categories, config.url) : null;
  });

export const getPublishedEntry = createServerFn({ method: "GET" })
  .validator((data: { kind: ContentKind; slug: string }) => data)
  .handler(async ({ data }) => {
    const config = await getPublicClient();
    if (!config) return null;

    // Page-builder content must never sit behind a stale CDN/browser cache:
    // an editor publishing a layout expects the change live immediately.
    setResponseHeader("Cache-Control", "no-store");

    const cache = getPublicPublishedEntryCache(`${data.kind}:${data.slug}`);
    return cache.get(async () => {
      const { data: entry, error } = await config.client
        .from("content_entries")
        .select(
          "id, kind, slug, title, excerpt_html, body_html, author_name, published_at, featured_media_path, metadata",
        )
        .eq("kind", data.kind)
        .eq("source_status", "publish")
        .is("archived_at", null)
        .eq("slug", data.slug)
        .maybeSingle();
      if (error) throw error;
      // Published pages do not display post categories. Avoid a second
      // content_entries query for every public CMS page; post callers still get
      // category labels when this function is used for a post entry.
      const categories = data.kind === "post" ? await getCategories(config.client) : new Map();
      return entry ? renderContentEntry(entry, categories, config.url) : null;
    });
  });

export type PublicFaq = {
  id: string;
  category: string;
  question: string;
  answer: string;
};

function normalizeFaqKey(row: Pick<PublicFaq, "category" | "question">) {
  return `${row.category.trim().toLowerCase()}\u0000${row.question.trim().toLowerCase()}`;
}

function uniquePublicFaqs(rows: PublicFaq[]) {
  const seen = new Set<string>();
  const unique: PublicFaq[] = [];

  for (const row of rows) {
    const key = normalizeFaqKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }

  return unique;
}

export const listPublicFaqs = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicFaq[]> => {
    const config = await getPublicClient();
    if (!config) return [];
    setResponseHeader("Cache-Control", "no-store");
    const { data, error } = await config.client
      .from("faqs")
      .select("id, category, question, answer")
      .eq("is_published", true)
      .order("category", { ascending: true })
      .order("display_order", { ascending: true });
    if (error) throw error;
    return uniquePublicFaqs((data ?? []) as PublicFaq[]);
  },
);

export type PublicTestimonial = {
  id: string;
  authorName: string;
  authorRole: string | null;
  quote: string;
  rating: number | null;
  avatarUrl: string | null;
};

export const listPublicTestimonials = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicTestimonial[]> => {
    const config = await getPublicClient();
    if (!config) return [];
    setResponseHeader("Cache-Control", "no-store");
    const { data, error } = await config.client
      .from("testimonials")
      .select("id, author_name, author_role, quote, rating, avatar_url, display_order")
      .eq("is_published", true)
      .order("display_order", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id as string,
      authorName: (r.author_name as string) ?? "",
      authorRole: (r.author_role as string) ?? null,
      quote: (r.quote as string) ?? "",
      rating: r.rating == null ? null : Number(r.rating),
      avatarUrl:
        typeof r.avatar_url === "string" && r.avatar_url.trim()
          ? mediaUrl(r.avatar_url, config.url)
          : null,
    }));
  },
);

export type PublicHomepageData = {
  heroSettings: HeroSettings;
  carousel: SpecialtyCarouselItem[] | null;
  specialtyCards: SpecialtyCard[] | null;
  googleReviews: GoogleReviewSettings;
  homePricing: HomePricingSettings;
  therapists: PublicTherapist[];
  latestPosts: RenderedContentEntry[];
  sections: HomepageSectionConfig[];
  testimonials: PublicTestimonial[];
  sectionCopy: HomepageSectionCopyMap;
};

const publicHomepageCache = createPublicReadCache<PublicHomepageData>(60_000);

export function clearPublicHomepageCache() {
  publicHomepageCache.clear();
}

/**
 * Fetch the homepage CMS payload with one settings request and one shared
 * Supabase client. This keeps the initial HTML current while avoiding six
 * independent server-function round trips during the critical render path.
 */
export const getPublicHomepageData = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicHomepageData> => {
    setResponseHeader("Cache-Control", "no-store");
    const config = await getPublicClient();
    if (!config) {
      return {
        heroSettings: DEFAULT_HERO_SETTINGS,
        carousel: null,
        specialtyCards: null,
        googleReviews: DEFAULT_GOOGLE_REVIEW_SETTINGS,
        homePricing: DEFAULT_HOME_PRICING_SETTINGS,
        therapists: [],
        latestPosts: [],
        sections: DEFAULT_HOMEPAGE_SECTIONS,
        testimonials: [],
        sectionCopy: DEFAULT_HOMEPAGE_SECTION_COPY,
      };
    }

    try {
      return await publicHomepageCache.get(async () => {
        const loadHomepage = () =>
          Promise.all([
            config.client
              .from("site_settings")
              .select("key, value")
              .in("key", [
                "home_hero",
                "home_specialties",
                "home_specialty_cards",
                "google_reviews",
                "home_pricing",
                "home_sections",
                "home_section_copy",
              ]),
            config.client
              .from("therapists")
              .select(
                "slug, full_name, role_title, credentials, location, bio, specialties, image_url",
              )
              .eq("is_active", true)
              .order("display_order", { ascending: true })
              .order("full_name", { ascending: true }),
            config.client
              .from("testimonials")
              .select("id, author_name, author_role, quote, rating, avatar_url, display_order")
              .eq("is_published", true)
              .order("display_order", { ascending: true }),
            config.client
              .from("content_entries")
              .select(
                "id, kind, slug, title, excerpt_html, body_html, author_name, published_at, featured_media_path, metadata",
              )
              .eq("kind", "post")
              .eq("source_status", "publish")
              .is("archived_at", null)
              .order("published_at", { ascending: false })
              .limit(3),
            config.client
              .from("content_entries")
              .select("source_id, title")
              .eq("kind", "category")
              .eq("source_status", "publish")
              .is("archived_at", null),
          ]);

        const results = await loadHomepage();

        const [
          settingsResult,
          therapistsResult,
          testimonialsResult,
          postsResult,
          categoriesResult,
        ] = results;
        const loadError =
          settingsResult.error ??
          therapistsResult.error ??
          testimonialsResult.error ??
          postsResult.error ??
          categoriesResult.error;
        if (loadError) throw loadError;

        const settings = new Map((settingsResult.data ?? []).map((row) => [row.key, row.value]));
        const postCategories = new Map(
          (categoriesResult.data ?? []).map((category) => [
            category.source_id,
            decodeEntities(category.title),
          ]),
        );
        const rawSections = settings.get("home_sections");
        const storedSections = Array.isArray(rawSections)
          ? rawSections.flatMap((value) => {
              if (!value || typeof value !== "object") return [];
              const row = value as Record<string, unknown>;
              return typeof row.id === "string" &&
                homepageSectionIds.has(row.id as HomepageSectionId)
                ? [{ id: row.id as HomepageSectionId, visible: row.visible !== false }]
                : [];
            })
          : [];
        const seenSections = new Set(storedSections.map((section) => section.id));

        const rawReviews = settings.get("google_reviews");
        const review = normalizeGoogleReviewSettings(rawReviews ?? {});
        review.reviews = review.reviews.map((entry) => ({
          ...entry,
          avatarUrl: entry.avatarUrl
            ? (mediaUrl(entry.avatarUrl, config.url) ?? undefined)
            : undefined,
        }));
        const rawCarousel = settings.get("home_specialties");
        const carousel = Array.isArray(rawCarousel)
          ? rawCarousel.flatMap((value) => {
              if (!value || typeof value !== "object") return [];
              const row = value as Record<string, unknown>;
              if (typeof row.title !== "string" || typeof row.alt !== "string") return [];
              return [
                {
                  title: row.title,
                  alt: row.alt,
                  imageUrl:
                    typeof row.imageUrl === "string" && row.imageUrl
                      ? mediaUrl(row.imageUrl, config.url)
                      : null,
                },
              ];
            })
          : null;

        const homepageData: PublicHomepageData = {
          heroSettings: parseHeroSettings(settings.get("home_hero"), config.url),
          carousel,
          specialtyCards: parseSpecialtyCards(settings.get("home_specialty_cards"), (path) =>
            mediaUrl(path, config.url),
          ),
          googleReviews: review,
          homePricing: normalizeHomePricingSettings(settings.get("home_pricing")),
          therapists: (therapistsResult.data ?? []).map((therapist) => ({
            slug: therapist.slug,
            fullName: therapist.full_name,
            roleTitle: therapist.role_title,
            credentials: therapist.credentials,
            location: therapist.location,
            bio: therapist.bio,
            specialties: therapist.specialties ?? [],
            imageUrl: therapist.image_url,
          })),
          latestPosts: (postsResult.data ?? []).map((entry) =>
            renderContentEntry(entry, postCategories, config.url),
          ),
          sections: [
            ...storedSections,
            ...DEFAULT_HOMEPAGE_SECTIONS.filter((section) => !seenSections.has(section.id)),
          ],
          testimonials: (testimonialsResult.data ?? []).map((testimonial) => ({
            id: testimonial.id as string,
            authorName: (testimonial.author_name as string) ?? "",
            authorRole: (testimonial.author_role as string) ?? null,
            quote: (testimonial.quote as string) ?? "",
            rating: testimonial.rating == null ? null : Number(testimonial.rating),
            avatarUrl:
              typeof testimonial.avatar_url === "string" && testimonial.avatar_url.trim()
                ? mediaUrl(testimonial.avatar_url, config.url)
                : null,
          })),
          sectionCopy: normalizeHomepageSectionCopy(settings.get("home_section_copy")),
        };
        return homepageData;
      });
    } catch (error) {
      console.error("Unable to refresh homepage content; using resilient fallback.", error);
      return (
        publicHomepageCache.peek() ?? {
          heroSettings: DEFAULT_HERO_SETTINGS,
          carousel: null,
          specialtyCards: null,
          googleReviews: DEFAULT_GOOGLE_REVIEW_SETTINGS,
          homePricing: DEFAULT_HOME_PRICING_SETTINGS,
          therapists: [],
          latestPosts: [],
          sections: DEFAULT_HOMEPAGE_SECTIONS,
          testimonials: [],
          sectionCopy: DEFAULT_HOMEPAGE_SECTION_COPY,
        }
      );
    }
  },
);
