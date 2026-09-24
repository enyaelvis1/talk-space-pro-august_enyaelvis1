import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { createRequestSupabase, type RequestSupabase } from "@/lib/supabase-server";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  normalizeHomepageSectionCopy,
  type HomepageSectionCopyMap,
} from "@/lib/homepage-section-copy";
import { cleanLegacyPostBodyHtml, sanitizeContentHtml } from "@/lib/content-html";
import {
  clearPublicHomepageCache,
  clearPublicContentEntryCache,
  clearPublicSiteSettingsCache,
  DEFAULT_FOOTER_SETTINGS,
  DEFAULT_HOMEPAGE_SECTIONS,
  DEFAULT_HOME_PRICING_SETTINGS,
  DEFAULT_SITE_DETAILS,
  type HomepageSectionId,
  type HomePricingSettings,
  type PublicFooterSettings,
  type PublicSiteDetails,
  normalizeHomePricingSettings,
} from "@/lib/content.functions";
import { PUBLIC_PAGE_CONFIG, type PublicPageKey } from "@/lib/public-pages";
import { sectionsSchema } from "@/lib/page-sections";

import { renderContentEntry, type RenderedContentEntry } from "@/lib/content.functions";
import {
  cloneFormTemplates,
  DEFAULT_FORM_TEMPLATES,
  normalizeFormTemplates,
  type FormTemplateDefinition,
} from "@/lib/form-templates";
import { fallbackInPersonPriceNgn, isMissingInPersonPriceColumn } from "@/lib/service-pricing";
import { requireRequestRole } from "@/lib/server-auth";

function getConfiguredClient() {
  const bag = createRequestSupabase(getRequest());
  if (!bag) throw new Error("Supabase is not configured.");
  return bag;
}

async function requireAdmin() {
  return (await requireRequestRole("admin")).bag;
}

// ============================================================================
// CMS — content entries (pages, posts, categories)
// ============================================================================

export type AdminHeroSettings = {
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

const heroSettingsSchema = z.object({
  eyebrow: z.string().trim().min(1).max(160),
  headingBefore: z.string().trim().min(1).max(160),
  headingEmphasis: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(600),
  primaryCtaLabel: z.string().trim().min(1).max(80),
  secondaryCtaLabel: z.string().trim().min(1).max(80),
  imageOnePath: z.string().trim().max(1000).nullable(),
  imageOneAlt: z.string().trim().min(1).max(200),
  imageTwoPath: z.string().trim().max(1000).nullable(),
  imageTwoAlt: z.string().trim().min(1).max(200),
});

export const getAdminHeroSettings = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminHeroSettings | null> => {
    const bag = await requireAdmin();
    const { data, error } = await bag.client
      .from("site_settings")
      .select("value")
      .eq("key", "home_hero")
      .maybeSingle();
    bag.commitCookies();
    if (error) throw error;
    return data?.value && typeof data.value === "object"
      ? (data.value as unknown as AdminHeroSettings)
      : null;
  },
);

export const updateAdminHeroSettings = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => heroSettingsSchema.parse(data))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const bag = await requireAdmin();
    const { error } = await bag.client
      .from("site_settings")
      .upsert({ key: "home_hero", value: data }, { onConflict: "key" });
    bag.commitCookies();
    if (error) throw error;
    clearPublicHomepageCache();
    return { ok: true };
  });

export const getAdminHomepageSectionCopy = createServerFn({ method: "GET" }).handler(
  async (): Promise<HomepageSectionCopyMap> => {
    const bag = await requireAdmin();
    const { data, error } = await bag.client
      .from("site_settings")
      .select("value")
      .eq("key", "home_section_copy")
      .maybeSingle();
    bag.commitCookies();
    if (error) throw error;
    return normalizeHomepageSectionCopy(data?.value);
  },
);

export const updateAdminHomepageSectionCopy = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        copy: z.record(
          z.string(),
          z.object({
            eyebrow: z.string().max(120).optional(),
            title: z.string().max(300).optional(),
            body: z.string().max(1200).optional(),
          }),
        ),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const bag = await requireAdmin();
    const normalized = normalizeHomepageSectionCopy(data.copy);
    const { error } = await bag.client
      .from("site_settings")
      .upsert({ key: "home_section_copy", value: normalized }, { onConflict: "key" });
    bag.commitCookies();
    if (error) throw error;
    clearPublicHomepageCache();
    return { ok: true };
  });

const homepageSectionIdSchema = z.enum([
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
]);

export type AdminHomepageSection = {
  id: HomepageSectionId;
  label: string;
  visible: boolean;
};

const homepageSectionLabels: Record<HomepageSectionId, string> = {
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

function normalizeHomepageSections(value: unknown): AdminHomepageSection[] {
  const source = Array.isArray(value) ? value : DEFAULT_HOMEPAGE_SECTIONS;
  const valid = source.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const parsed = homepageSectionIdSchema.safeParse(row.id);
    return parsed.success ? [{ id: parsed.data, visible: row.visible !== false }] : [];
  });
  const seen = new Set(valid.map((section) => section.id));
  return [
    ...valid,
    ...DEFAULT_HOMEPAGE_SECTIONS.filter((section) => !seen.has(section.id)).map((section) => ({
      id: section.id,
      visible: section.visible,
    })),
  ].map((section) => ({ ...section, label: homepageSectionLabels[section.id] }));
}

export const getAdminHomepageSections = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminHomepageSection[]> => {
    const bag = await requireAdmin();
    const { data, error } = await bag.client
      .from("site_settings")
      .select("value")
      .eq("key", "home_sections")
      .maybeSingle();
    bag.commitCookies();
    if (error) throw error;
    return normalizeHomepageSections(data?.value);
  },
);

export const updateAdminHomepageSections = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        sections: z
          .array(z.object({ id: homepageSectionIdSchema, visible: z.boolean() }))
          .min(1)
          .max(20),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const bag = await requireAdmin();
    const normalized = normalizeHomepageSections(data.sections).map(({ id, visible }) => ({
      id,
      visible,
    }));
    const { error } = await bag.client
      .from("site_settings")
      .upsert({ key: "home_sections", value: normalized }, { onConflict: "key" });
    bag.commitCookies();
    if (error) throw error;
    clearPublicHomepageCache();
    return { ok: true };
  });

const homePricingTierSchema = z.object({
  price: z.string().trim().min(1).max(40),
  cadence: z.string().trim().min(1).max(120),
});

const homePricingPlanSchema = z.object({
  name: z.string().trim().min(1).max(80),
  single: homePricingTierSchema,
  monthly: homePricingTierSchema,
  description: z.string().trim().min(1).max(400),
  features: z.array(z.string().trim().min(1).max(120)).min(1).max(6),
  href: z.string().trim().min(1).max(300),
  hrefMonthly: z.string().trim().min(1).max(300),
  highlight: z.boolean(),
  badgeLabel: z.string().trim().max(40),
  ctaLabel: z.string().trim().min(1).max(80),
});

const homePricingSettingsSchema = z.object({
  fullPricingLabel: z.string().trim().min(1).max(80),
  fullPricingHref: z.string().trim().min(1).max(300),
  singleTabLabel: z.string().trim().min(1).max(60),
  monthlyTabLabel: z.string().trim().min(1).max(60),
  defaultBilling: z.enum(["single", "monthly"]),
  note: z.string().trim().min(1).max(220),
  plans: z.array(homePricingPlanSchema).length(DEFAULT_HOME_PRICING_SETTINGS.plans.length),
});

export const getAdminHomePricingSettings = createServerFn({ method: "GET" }).handler(
  async (): Promise<HomePricingSettings> => {
    const bag = await requireAdmin();
    const { data, error } = await bag.client
      .from("site_settings")
      .select("value")
      .eq("key", "home_pricing")
      .maybeSingle();
    bag.commitCookies();
    if (error) throw error;
    return normalizeHomePricingSettings(data?.value);
  },
);

export type AdminHomepageWorkspace = {
  sections: AdminHomepageSection[];
  copy: HomepageSectionCopyMap;
  homePricing: HomePricingSettings;
};

export const getAdminHomepageWorkspace = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminHomepageWorkspace> => {
    const bag = await requireAdmin();
    const { data, error } = await bag.client
      .from("site_settings")
      .select("key, value")
      .in("key", ["home_sections", "home_section_copy", "home_pricing"]);
    bag.commitCookies();
    if (error) throw error;

    const values = new Map((data ?? []).map((row) => [row.key as string, row.value]));
    return {
      sections: normalizeHomepageSections(values.get("home_sections")),
      copy: normalizeHomepageSectionCopy(values.get("home_section_copy")),
      homePricing: normalizeHomePricingSettings(values.get("home_pricing")),
    };
  },
);

export const updateAdminHomePricingSettings = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => homePricingSettingsSchema.parse(data))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const bag = await requireAdmin();
    const { error } = await bag.client
      .from("site_settings")
      .upsert({ key: "home_pricing", value: data }, { onConflict: "key" });
    bag.commitCookies();
    if (error) throw error;
    clearPublicHomepageCache();
    return { ok: true };
  });

const carouselItemSchema = z.object({
  title: z.string().trim().min(1).max(120),
  alt: z.string().trim().min(1).max(200),
  imageUrl: z.string().trim().max(2000).nullable(),
});

export type AdminCarouselItem = z.infer<typeof carouselItemSchema>;

export const getAdminCarousel = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminCarouselItem[] | null> => {
    const bag = await requireAdmin();
    const { data, error } = await bag.client
      .from("site_settings")
      .select("value")
      .eq("key", "home_specialties")
      .maybeSingle();
    bag.commitCookies();
    if (error) throw error;
    if (!Array.isArray(data?.value)) return null;
    return z.array(carouselItemSchema).safeParse(data.value).success
      ? z.array(carouselItemSchema).parse(data.value)
      : null;
  },
);

export const updateAdminCarousel = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ items: z.array(carouselItemSchema).min(1).max(12) }).parse(data),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const bag = await requireAdmin();
    const { error } = await bag.client
      .from("site_settings")
      .upsert({ key: "home_specialties", value: data.items }, { onConflict: "key" });
    if (error) {
      bag.commitCookies();
      throw error;
    }
    const { data: saved, error: verifyError } = await bag.client
      .from("site_settings")
      .select("value")
      .eq("key", "home_specialties")
      .maybeSingle();
    bag.commitCookies();
    if (verifyError) throw verifyError;
    if (!Array.isArray(saved?.value)) {
      throw new Error(
        "Carousel save could not be verified. Check the site_settings admin policy and try again.",
      );
    }
    clearPublicHomepageCache();
    return { ok: true };
  });

const specialtyCardSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500),
  imageUrl: z.string().trim().max(2000).nullable(),
  alt: z.string().trim().min(1).max(200),
  primaryLabel: z.string().trim().min(1).max(60),
  primaryHref: z.string().trim().min(1).max(300),
  secondaryLabel: z.string().trim().min(1).max(60),
  secondaryHref: z.string().trim().min(1).max(300),
});

export type AdminSpecialtyCard = z.infer<typeof specialtyCardSchema>;

export const getAdminSpecialtyCards = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminSpecialtyCard[] | null> => {
    const bag = await requireAdmin();
    const { data, error } = await bag.client
      .from("site_settings")
      .select("value")
      .eq("key", "home_specialty_cards")
      .maybeSingle();
    bag.commitCookies();
    if (error) throw error;
    const parsed = z.array(specialtyCardSchema).safeParse(data?.value);
    return parsed.success && parsed.data.length > 0 ? parsed.data : null;
  },
);

export const updateAdminSpecialtyCards = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ cards: z.array(specialtyCardSchema).min(1).max(24) }).parse(data),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const bag = await requireAdmin();
    const { error } = await bag.client
      .from("site_settings")
      .upsert({ key: "home_specialty_cards", value: data.cards }, { onConflict: "key" });
    bag.commitCookies();
    if (error) throw error;
    clearPublicHomepageCache();
    return { ok: true };
  });

const googleReviewEntrySchema = z.object({
  id: z.string().trim().max(500).optional(),
  name: z.string().trim().min(1).max(160),
  date: z.string().trim().min(1).max(120),
  quote: z.string().trim().min(1).max(2000),
  location: z.string().trim().max(120).optional(),
  avatarPath: z.string().trim().max(1000).optional(),
});

const googleReviewSettingsSchema = z.object({
  label: z.string().trim().min(1).max(80),
  rating: z.number().min(0).max(5),
  reviewCount: z.number().int().min(0).max(1_000_000),
  reviewUrl: z.string().trim().url().max(1000),
  googlePlaceId: z.string().trim().max(240).default(""),
  lastSyncedAt: z.string().trim().max(80).nullable().optional(),
  lastSyncSource: z
    .enum(["google-business-profile", "google-places", "manual", "scrape"])
    .nullable()
    .optional(),
  lastSyncError: z.string().trim().max(500).nullable().optional(),
  reviews: z.array(googleReviewEntrySchema).max(2000).default([]),
});

export type AdminGoogleReviewSettings = z.infer<typeof googleReviewSettingsSchema>;
type GoogleReviewEntry = z.infer<typeof googleReviewEntrySchema>;
type GoogleReviewSyncClient = Pick<SupabaseClient<Database>, "from">;

function parseAdminGoogleReviewSettings(value: unknown): AdminGoogleReviewSettings {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const reviews = Array.isArray(row.reviews)
    ? row.reviews
        .map((entry) => {
          if (!entry || typeof entry !== "object") return null;
          const review = entry as Record<string, unknown>;
          const parsed = googleReviewEntrySchema.safeParse({
            ...review,
            avatarPath:
              typeof review.avatarPath === "string" && review.avatarPath.trim()
                ? review.avatarPath
                : typeof review.avatarUrl === "string" && review.avatarUrl.trim()
                  ? review.avatarUrl
                  : undefined,
          });
          return parsed.success ? parsed.data : null;
        })
        .filter((entry): entry is GoogleReviewEntry => Boolean(entry))
    : [];
  const googlePlaceId =
    typeof row.googlePlaceId === "string"
      ? row.googlePlaceId
      : typeof row.placeId === "string"
        ? row.placeId
        : "ChIJj3SFRuaNOxARxdxE2VFox40";

  return googleReviewSettingsSchema.parse({
    label: row.label ?? "on Google",
    rating: row.rating ?? 5,
    reviewCount: row.reviewCount ?? 51,
    reviewUrl:
      row.reviewUrl ??
      "https://www.google.com/maps/place/Talk+Space+Counselling/@6.6023494,3.3490401,17z/data=!4m14!1m7!3m6!1s0x103b8de64685748f:0x8dc76851d944dcc5!2sTalk+Space+Counselling!8m2!3d6.6023494!4d3.351615!16s%2Fg%2F11thf1nftr!3m5!1s0x103b8de64685748f:0x8dc76851d944dcc5!8m2!3d6.6023494!4d3.351615!16s%2Fg%2F11thf1nftr?entry=ttu",
    googlePlaceId,
    lastSyncedAt: row.lastSyncedAt ?? null,
    lastSyncSource: row.lastSyncSource ?? null,
    lastSyncError: row.lastSyncError ?? null,
    reviews,
  });
}

async function loadGoogleReviewSettings(
  client: GoogleReviewSyncClient,
): Promise<AdminGoogleReviewSettings> {
  const { data, error } = await client
    .from("site_settings")
    .select("value")
    .eq("key", "google_reviews")
    .maybeSingle();
  if (error) throw error;
  return parseAdminGoogleReviewSettings(data?.value);
}

async function saveGoogleReviewSettings(
  client: GoogleReviewSyncClient,
  settings: AdminGoogleReviewSettings,
): Promise<void> {
  const { error } = await client
    .from("site_settings")
    .upsert({ key: "google_reviews", value: settings }, { onConflict: "key" });
  if (error) throw error;
  clearPublicHomepageCache();
}

export const getAdminGoogleReviewSettings = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminGoogleReviewSettings> => {
    const bag = await requireAdmin();
    const settings = await loadGoogleReviewSettings(bag.client);
    bag.commitCookies();
    return settings;
  },
);

export const updateAdminGoogleReviewSettings = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => googleReviewSettingsSchema.parse(data))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const bag = await requireAdmin();
    await saveGoogleReviewSettings(bag.client, {
      ...data,
      lastSyncSource: data.lastSyncSource ?? "manual",
      lastSyncError: null,
    });
    bag.commitCookies();
    return { ok: true };
  });

type GoogleSyncResult = { ok: true; imported: number; error?: string; source?: string };

/**
 * Import/refresh Google reviews. Official API credentials are tried first; the
 * Business Profile gives full access for owned locations; Places API provides
 * the public rating/count and Google's limited review sample as a fallback.
 */
export const importGoogleReviewsFromUrl = createServerFn({ method: "POST" }).handler(
  async (): Promise<GoogleSyncResult> => {
    const bag = await requireAdmin();
    const result = await refreshGoogleReviewsWithClient(bag.client);
    bag.commitCookies();
    return result;
  },
);

export async function refreshGoogleReviewsWithClient(
  client: GoogleReviewSyncClient,
): Promise<GoogleSyncResult> {
  const settings = await loadGoogleReviewSettings(client);
  const apiResult = await fetchGoogleReviewsViaApi(settings);

  if (apiResult.ok) {
    const { imported, ...next } = mergeGoogleReviews(settings, apiResult.reviews);
    await saveGoogleReviewSettings(client, {
      ...next,
      rating: apiResult.rating ?? next.rating,
      reviewCount: apiResult.reviewCount ?? next.reviewCount,
      lastSyncedAt: new Date().toISOString(),
      lastSyncSource: apiResult.source,
      lastSyncError: null,
    });
    return { ok: true, imported, source: apiResult.source };
  }

  const error =
    apiResult.error ??
    "Configure Google Business Profile credentials or a Google Places API key and Place ID before importing reviews.";
  await saveGoogleReviewSettings(client, {
    ...settings,
    lastSyncedAt: new Date().toISOString(),
    lastSyncError: error,
  });
  return { ok: true, imported: 0, error };
}

function mergeGoogleReviews(settings: AdminGoogleReviewSettings, reviews: GoogleReviewEntry[]) {
  const identity = (review: GoogleReviewEntry) =>
    review.id ?? `${review.name}|${review.date}|${review.quote}`;
  const existingIdentities = new Set(settings.reviews.map(identity));
  const merged = new Map<string, GoogleReviewEntry>();
  for (const review of settings.reviews) merged.set(identity(review), review);
  for (const review of reviews) merged.set(identity(review), review);
  const mergedReviews = [...merged.values()];
  return {
    ...settings,
    imported: reviews.filter((review) => !existingIdentities.has(identity(review))).length,
    reviews: mergedReviews.slice(0, 2000),
  };
}

type GoogleApiSync =
  | {
      ok: true;
      source: "google-business-profile" | "google-places";
      reviews: GoogleReviewEntry[];
      rating?: number;
      reviewCount?: number;
    }
  | { ok: false; error?: string };

async function fetchGoogleReviewsViaApi(
  settings: AdminGoogleReviewSettings,
): Promise<GoogleApiSync> {
  const businessProfileResult = await fetchGoogleBusinessProfileReviews();
  if (businessProfileResult.ok) return businessProfileResult;

  const placesResult = await fetchGooglePlacesReviews(settings.googlePlaceId);
  if (placesResult.ok) return placesResult;

  return { ok: false, error: placesResult.error ?? businessProfileResult.error };
}

async function fetchGoogleBusinessProfileReviews(): Promise<GoogleApiSync> {
  const accessToken = process.env["GOOGLE_BUSINESS_PROFILE_ACCESS_TOKEN"]?.trim();
  const accountId = process.env["GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID"]?.trim();
  const locationId = process.env["GOOGLE_BUSINESS_PROFILE_LOCATION_ID"]?.trim();

  if (!accessToken || !accountId || !locationId) {
    return { ok: false, error: "Google Business Profile credentials are not configured." };
  }

  const reviews: GoogleReviewEntry[] = [];
  let nextPageToken: string | undefined;
  let rating: number | undefined;
  let reviewCount: number | undefined;

  do {
    const url = new URL(
      `https://mybusiness.googleapis.com/v4/accounts/${encodeURIComponent(
        accountId,
      )}/locations/${encodeURIComponent(locationId)}/reviews`,
    );
    url.searchParams.set("pageSize", "50");
    url.searchParams.set("orderBy", "updateTime desc");
    if (nextPageToken) url.searchParams.set("pageToken", nextPageToken);

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      console.error("[google-reviews] Google Business Profile request failed", error);
      return { ok: false, error: "Could not reach Google Business Profile from the server." };
    }
    if (!response.ok) {
      return {
        ok: false,
        error: `Google Business Profile reviews request failed (${response.status}).`,
      };
    }

    const payload = (await response.json()) as Record<string, unknown>;
    if (typeof payload.averageRating === "number") rating = payload.averageRating;
    if (typeof payload.totalReviewCount === "number") reviewCount = payload.totalReviewCount;
    if (Array.isArray(payload.reviews))
      reviews.push(
        ...payload.reviews.flatMap((entry) => {
          if (!entry || typeof entry !== "object") return [];
          const row = entry as Record<string, unknown>;
          const reviewer =
            row.reviewer && typeof row.reviewer === "object"
              ? (row.reviewer as Record<string, unknown>)
              : {};
          const comment = typeof row.comment === "string" ? row.comment.trim() : "";
          const name = typeof reviewer.displayName === "string" ? reviewer.displayName.trim() : "";
          if (!comment || !name) return [];
          return [
            {
              id: typeof row.name === "string" ? row.name : undefined,
              name,
              date:
                typeof row.updateTime === "string" && row.updateTime.trim()
                  ? new Date(row.updateTime).toLocaleDateString("en-GB", {
                      dateStyle: "medium",
                    })
                  : "Google review",
              quote: comment,
            },
          ];
        }),
      );
    nextPageToken =
      typeof payload.nextPageToken === "string" && payload.nextPageToken
        ? payload.nextPageToken
        : undefined;
  } while (nextPageToken);

  return {
    ok: true,
    source: "google-business-profile",
    reviews,
    rating,
    reviewCount,
  };
}

async function fetchGooglePlacesReviews(placeId: string): Promise<GoogleApiSync> {
  const apiKey = process.env["GOOGLE_PLACES_API_KEY"]?.trim();
  const normalizedPlaceId = placeId.trim().replace(/^places\//, "");
  if (!apiKey || !normalizedPlaceId) {
    return { ok: false, error: "Google Places API key or Place ID is not configured." };
  }
  if (apiKey === normalizedPlaceId || apiKey.startsWith("ChIJ")) {
    return {
      ok: false,
      error:
        "GOOGLE_PLACES_API_KEY currently looks like a Google Place ID. Keep the Place ID in the admin field and set GOOGLE_PLACES_API_KEY to a server API key from Google Cloud with the Places API enabled.",
    };
  }

  const url = new URL(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(normalizedPlaceId)}`,
  );
  url.searchParams.set("languageCode", "en");
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "rating,userRatingCount,reviews.authorAttribution.displayName,reviews.relativePublishTimeDescription,reviews.publishTime,reviews.text,reviews.rating",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    console.error("[google-reviews] Google Places request failed", error);
    return {
      ok: false,
      error:
        "Could not reach Google Places from the server. Check server network access and verify GOOGLE_PLACES_API_KEY is a real server API key with the Places API enabled.",
    };
  }
  if (!response.ok) {
    return { ok: false, error: `Google Places reviews request failed (${response.status}).` };
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const reviews = Array.isArray(payload.reviews)
    ? payload.reviews.flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const row = entry as Record<string, unknown>;
        const attribution =
          row.authorAttribution && typeof row.authorAttribution === "object"
            ? (row.authorAttribution as Record<string, unknown>)
            : {};
        const text = row.text && typeof row.text === "object" ? row.text : {};
        const quote =
          typeof (text as Record<string, unknown>).text === "string"
            ? ((text as Record<string, unknown>).text as string).trim()
            : "";
        const name =
          typeof attribution.displayName === "string" ? attribution.displayName.trim() : "";
        if (!quote || !name) return [];
        return [
          {
            id: `google:${name}|${quote}`,
            name,
            date:
              typeof row.relativePublishTimeDescription === "string"
                ? row.relativePublishTimeDescription
                : typeof row.publishTime === "string"
                  ? new Date(row.publishTime).toLocaleDateString("en-GB", {
                      dateStyle: "medium",
                    })
                  : "Google review",
            quote,
          },
        ];
      })
    : [];

  return {
    ok: true,
    source: "google-places",
    reviews,
    rating: typeof payload.rating === "number" ? payload.rating : undefined,
    reviewCount: typeof payload.userRatingCount === "number" ? payload.userRatingCount : undefined,
  };
}

const formFieldSchema = z.object({
  fieldKey: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(120),
  placeholder: z.string().trim().max(240),
  helpText: z.string().trim().max(240),
  required: z.boolean(),
  visible: z.boolean(),
  type: z.enum(["text", "email", "tel", "textarea", "date", "time", "select", "radio", "hidden"]),
  options: z.array(z.string().trim().min(1).max(80)).max(12).default([]),
});

const formTemplateSchema = z.object({
  key: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(240),
  audience: z.enum(["public", "internal"]),
  fields: z.array(formFieldSchema).min(1).max(30),
});

export type AdminFormTemplate = FormTemplateDefinition;

async function loadAdminFormTemplates(
  bag: Awaited<ReturnType<typeof requireAdmin>>,
): Promise<AdminFormTemplate[]> {
  const { data, error } = await bag.client
    .from("site_settings")
    .select("value")
    .eq("key", "form_templates")
    .maybeSingle();
  if (error) throw error;
  return normalizeFormTemplates(data?.value ?? cloneFormTemplates(DEFAULT_FORM_TEMPLATES));
}

export const getAdminFormTemplates = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminFormTemplate[]> => {
    const bag = await requireAdmin();
    try {
      return await loadAdminFormTemplates(bag);
    } finally {
      bag.commitCookies();
    }
  },
);

export const updateAdminFormTemplates = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ templates: z.array(formTemplateSchema).min(1).max(20) }).parse(data),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const bag = await requireAdmin();
    const templates = normalizeFormTemplates(data.templates);
    const { error } = await bag.client
      .from("site_settings")
      .upsert({ key: "form_templates", value: templates }, { onConflict: "key" });
    bag.commitCookies();
    if (error) throw error;
    return { ok: true };
  });

export type AdminPendingIntakeSubmission = {
  id: string;
  source: "booking" | "contact" | "assessment";
  templateKey: string;
  templateVersion: number;
  subjectName: string | null;
  subjectEmail: string | null;
  completionState: "draft" | "in_progress";
  createdAt: string;
  updatedAt: string;
  clientId: string | null;
  appointmentId: string | null;
  contactSubmissionId: string | null;
  payload: Record<string, Json>;
  reminderSentAt: string | null;
};

async function loadPendingIntakeSubmissions(
  bag: Awaited<ReturnType<typeof requireAdmin>>,
): Promise<AdminPendingIntakeSubmission[]> {
  const { data, error } = await bag.client
    .from("intake_submissions")
    .select(
      "id, source, template_key, template_version, subject_name, subject_email, completion_state, created_at, updated_at, client_id, appointment_id, contact_submission_id, payload, reminder_sent_at",
    )
    .in("completion_state", ["draft", "in_progress"])
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    source: row.source as "booking" | "contact" | "assessment",
    templateKey: row.template_key as string,
    templateVersion: Number(row.template_version ?? 1),
    subjectName: (row.subject_name as string | null) ?? null,
    subjectEmail: (row.subject_email as string | null) ?? null,
    completionState: row.completion_state === "in_progress" ? "in_progress" : ("draft" as const),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    clientId: (row.client_id as string | null) ?? null,
    appointmentId: (row.appointment_id as string | null) ?? null,
    contactSubmissionId: (row.contact_submission_id as string | null) ?? null,
    payload:
      row.payload && typeof row.payload === "object" ? (row.payload as Record<string, Json>) : {},
    reminderSentAt: (row.reminder_sent_at as string | null) ?? null,
  }));
}

export const listPendingIntakeSubmissions = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminPendingIntakeSubmission[]> => {
    const bag = await requireAdmin();
    try {
      return await loadPendingIntakeSubmissions(bag);
    } finally {
      bag.commitCookies();
    }
  },
);

export type AdminFormsWorkspace = {
  templates: AdminFormTemplate[];
  pendingForms: AdminPendingIntakeSubmission[];
};

export const getAdminFormsWorkspace = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminFormsWorkspace> => {
    const bag = await requireAdmin();
    try {
      const [templates, pendingForms] = await Promise.all([
        loadAdminFormTemplates(bag),
        loadPendingIntakeSubmissions(bag),
      ]);
      return { templates, pendingForms };
    } finally {
      bag.commitCookies();
    }
  },
);

const siteDetailsSchema = z.object({
  brandName: z.string().trim().min(1).max(120),
  tagline: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().min(7).max(40),
  whatsapp: z.string().trim().min(7).max(40),
  hours: z.string().trim().min(1).max(160),
  facebook: z.string().trim().url().max(300),
  twitter: z.string().trim().url().max(300),
  instagram: z.string().trim().url().max(300),
  linkedin: z.string().trim().url().max(300),
  youtube: z.string().trim().url().max(300),
  logoPath: z.string().trim().max(1000).optional(),
  faviconPath: z.string().trim().max(1000).optional(),
  socialImagePath: z.string().trim().max(1000).optional(),
  appearance: z
    .object({
      backgroundColor: z.string().regex(/^#[0-9a-f]{6}$/i),
      textColor: z.string().regex(/^#[0-9a-f]{6}$/i),
      accentColor: z.string().regex(/^#[0-9a-f]{6}$/i),
      bodyFont: z.enum(["sans", "serif"]),
      headingFont: z.enum(["display", "sans"]),
      baseFontSize: z.enum(["sm", "md", "lg"]),
      buttonStyle: z.enum(["rounded", "pill", "square"]),
      sectionSpacing: z.enum(["compact", "comfortable", "spacious"]),
    })
    .optional(),
});

const footerLinkSchema = z.object({
  label: z.string().trim().min(1).max(80),
  to: z.string().trim().min(1).max(300),
});

const footerOfficeSchema = z.object({
  name: z.string().trim().min(1).max(100),
  addressLines: z.array(z.string().trim().min(1).max(180)).min(1).max(4),
});

const footerSettingsSchema = z.object({
  crisisHeading: z.string().trim().min(1).max(80),
  crisisText: z.string().trim().min(1).max(180),
  crisisCtaLabel: z.string().trim().min(1).max(80),
  crisisCtaHref: z.string().trim().min(1).max(300),
  description: z.string().trim().min(1).max(700),
  contactAddress: z.string().trim().max(400).default(""),
  offices: z.array(footerOfficeSchema).min(1).max(6),
  sections: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(80),
        links: z.array(footerLinkSchema).min(1).max(8),
      }),
    )
    .min(1)
    .max(4),
  bottomLeft: z.string().trim().min(1).max(180),
  bottomRight: z.string().trim().min(1).max(180),
  showSocialLinks: z.boolean(),
});

function normalizeAdminSiteDetails(value: unknown): PublicSiteDetails {
  if (!value || typeof value !== "object") return DEFAULT_SITE_DETAILS;
  const details = value as Partial<PublicSiteDetails>;
  return {
    ...DEFAULT_SITE_DETAILS,
    ...details,
    appearance: {
      ...DEFAULT_SITE_DETAILS.appearance!,
      ...(details.appearance ?? {}),
    },
  };
}

function normalizeAdminFooterSettings(value: unknown): PublicFooterSettings {
  if (!value || typeof value !== "object") return DEFAULT_FOOTER_SETTINGS;
  return footerSettingsSchema
    .partial()
    .transform((settings) => ({
      ...DEFAULT_FOOTER_SETTINGS,
      ...settings,
      sections:
        settings.sections && settings.sections.length
          ? settings.sections
          : DEFAULT_FOOTER_SETTINGS.sections,
    }))
    .parse(value);
}

export const getAdminSiteDetails = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicSiteDetails> => {
    const bag = await requireAdmin();
    const { data, error } = await bag.client
      .from("site_settings")
      .select("value")
      .eq("key", "site_details")
      .maybeSingle();
    bag.commitCookies();
    if (error) throw error;
    return normalizeAdminSiteDetails(data?.value);
  },
);

export const updateAdminSiteDetails = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => siteDetailsSchema.parse(data))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const bag = await requireAdmin();
    const { error } = await bag.client
      .from("site_settings")
      .upsert({ key: "site_details", value: data }, { onConflict: "key" });
    bag.commitCookies();
    if (error) throw error;
    clearPublicSiteSettingsCache();
    return { ok: true };
  });

export const getAdminFooterSettings = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicFooterSettings> => {
    const bag = await requireAdmin();
    const { data, error } = await bag.client
      .from("site_settings")
      .select("value")
      .eq("key", "footer_settings")
      .maybeSingle();
    bag.commitCookies();
    if (error) throw error;
    return normalizeAdminFooterSettings(data?.value);
  },
);

export type AdminSiteSettingsWorkspace = {
  siteDetails: PublicSiteDetails;
  footerSettings: PublicFooterSettings;
};

export async function loadAdminSiteSettingsWorkspace(
  bag: RequestSupabase,
): Promise<AdminSiteSettingsWorkspace> {
  const { data, error } = await bag.client
    .from("site_settings")
    .select("key, value")
    .in("key", ["site_details", "footer_settings"]);
  bag.commitCookies();
  if (error) throw error;
  const values = new Map((data ?? []).map((row) => [row.key as string, row.value]));
  return {
    siteDetails: normalizeAdminSiteDetails(values.get("site_details")),
    footerSettings: normalizeAdminFooterSettings(values.get("footer_settings")),
  };
}

export const getAdminSiteSettingsWorkspace = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminSiteSettingsWorkspace> => {
    const bag = await requireAdmin();
    return loadAdminSiteSettingsWorkspace(bag);
  },
);

export const updateAdminFooterSettings = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => footerSettingsSchema.parse(data))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const bag = await requireAdmin();
    const { error } = await bag.client
      .from("site_settings")
      .upsert({ key: "footer_settings", value: data }, { onConflict: "key" });
    bag.commitCookies();
    if (error) throw error;
    clearPublicSiteSettingsCache();
    return { ok: true };
  });

const contentKindSchema = z.enum(["page", "post", "category"]);

export type AdminContentRow = {
  id: string;
  kind: "page" | "post" | "category";
  slug: string;
  title: string;
  status: string;
  publishedAt: string | null;
  updatedAt: string | null;
  author: string | null;
  canonicalPath: string | null;
  featuredMediaPath: string | null;
  excerptHtml: string | null;
  scheduledPublishAt: string | null;
  scheduledUnpublishAt: string | null;
  archivedAt: string | null;
};

export const listAdminContent = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ kind: contentKindSchema }).parse(data))
  .handler(async ({ data }): Promise<AdminContentRow[]> => {
    const bag = await requireAdmin();
    const { data: rows, error } = await bag.client
      .from("content_entries")
      .select(
        "id, kind, slug, title, source_status, published_at, source_modified_at, author_name, canonical_path, featured_media_path, excerpt_html, scheduled_publish_at, scheduled_unpublish_at, archived_at, updated_at",
      )
      .eq("kind", data.kind)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(500);
    bag.commitCookies();
    if (error) throw error;
    return (rows ?? []).map((r) => ({
      id: r.id as string,
      kind: r.kind as AdminContentRow["kind"],
      slug: (r.slug as string) ?? "",
      title: (r.title as string) ?? "(untitled)",
      status: (r.source_status as string) ?? "draft",
      publishedAt: (r.published_at as string) ?? null,
      updatedAt: (r.source_modified_at as string) ?? null,
      author: (r.author_name as string) ?? null,
      canonicalPath: (r.canonical_path as string) ?? null,
      featuredMediaPath: (r.featured_media_path as string) ?? null,
      excerptHtml: (r.excerpt_html as string) ?? null,
      scheduledPublishAt: (r.scheduled_publish_at as string) ?? null,
      scheduledUnpublishAt: (r.scheduled_unpublish_at as string) ?? null,
      archivedAt: (r.archived_at as string) ?? null,
    }));
  });

export type AdminCategoryOption = { sourceId: number; title: string };

async function loadAdminCategories(
  bag: Awaited<ReturnType<typeof requireAdmin>>,
): Promise<AdminCategoryOption[]> {
  const { data, error } = await bag.client
    .from("content_entries")
    .select("source_id, title")
    .eq("kind", "category")
    .eq("source_status", "publish")
    .order("title", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    sourceId: Number(row.source_id),
    title: String(row.title),
  }));
}

export const listAdminCategories = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminCategoryOption[]> => {
    const bag = await requireAdmin();
    try {
      return await loadAdminCategories(bag);
    } finally {
      bag.commitCookies();
    }
  },
);

export type AdminDashboardSummary = {
  pages: number;
  posts: number;
  media: number;
  activeTherapists: number;
  clients: number;
  upcomingBookings: number;
  pendingMessages: number;
  pendingTransfers: number;
  pendingForms: number;
  failedGoogleSyncs: number;
};

async function loadAdminDashboardSummary(
  bag: Awaited<ReturnType<typeof requireAdmin>>,
): Promise<AdminDashboardSummary> {
  const now = new Date().toISOString();
  const [
    pages,
    posts,
    media,
    therapists,
    clients,
    upcomingBookings,
    pendingMessages,
    pendingPayments,
    paidBookingReviewPayments,
    pendingForms,
    failedGoogleSyncs,
  ] = await Promise.all([
    bag.client
      .from("content_entries")
      .select("id", { count: "exact", head: true })
      .eq("kind", "page"),
    bag.client
      .from("content_entries")
      .select("id", { count: "exact", head: true })
      .eq("kind", "post"),
    bag.client
      .from("content_media")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null),
    bag.client
      .from("therapists")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
    bag.client.from("clients").select("id", { count: "exact", head: true }),
    bag.client
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .gte("starts_at", now)
      .eq("status", "confirmed")
      .is("archived_at", null),
    bag.client
      .from("contact_submissions")
      .select("id", { count: "exact", head: true })
      .is("ack_sent_at", null),
    bag.client
      .from("payments")
      .select("id", { count: "exact", head: true })
      .in("status", ["initiated", "awaiting_confirmation"]),
    bag.client.from("payments").select("metadata").eq("status", "succeeded"),
    bag.client
      .from("intake_submissions")
      .select("id", { count: "exact", head: true })
      .in("completion_state", ["draft", "in_progress"]),
    bag.client
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .not("google_sync_error", "is", null),
  ]);
  const firstError = [
    pages,
    posts,
    media,
    therapists,
    clients,
    upcomingBookings,
    pendingMessages,
    pendingPayments,
    paidBookingReviewPayments,
    pendingForms,
    failedGoogleSyncs,
  ].find((result) => result.error)?.error;
  if (firstError) throw firstError;
  const paidBookingReviewCount = (paidBookingReviewPayments.data ?? []).filter((row) => {
    const metadata = row.metadata;
    return (
      metadata !== null &&
      typeof metadata === "object" &&
      !Array.isArray(metadata) &&
      (metadata as Record<string, unknown>).booking_review_required === true
    );
  }).length;
  return {
    pages: pages.count ?? 0,
    posts: posts.count ?? 0,
    media: media.count ?? 0,
    activeTherapists: therapists.count ?? 0,
    clients: clients.count ?? 0,
    upcomingBookings: upcomingBookings.count ?? 0,
    pendingMessages: pendingMessages.count ?? 0,
    pendingTransfers: (pendingPayments.count ?? 0) + paidBookingReviewCount,
    pendingForms: pendingForms.count ?? 0,
    failedGoogleSyncs: failedGoogleSyncs.count ?? 0,
  };
}

export const getAdminDashboardSummary = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminDashboardSummary> => {
    const bag = await requireAdmin();
    const summary = await loadAdminDashboardSummary(bag);
    bag.commitCookies();
    return summary;
  },
);

export type AdminNotificationFailureRow = {
  id: string;
  templateKey: string | null;
  recipient: string;
  error: string;
  createdAt: string;
  retryCount: number;
};

export type AdminMeetFailureRow = {
  appointmentId: string;
  bookingReference: string;
  clientName: string;
  therapistName: string | null;
  startsAt: string;
  error: string;
};

export type AdminFailureQueues = {
  notificationCount: number;
  meetCount: number;
  notifications: AdminNotificationFailureRow[];
  meetSyncs: AdminMeetFailureRow[];
};

async function loadAdminFailureQueues(
  bag: Awaited<ReturnType<typeof requireAdmin>>,
): Promise<AdminFailureQueues> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [deliveryResult, meetResult] = await Promise.all([
    supabaseAdmin
      .from("email_delivery_logs")
      .select(
        "id, template_key, recipient, status, error, reason, created_at, retry_count, retried_from",
      )
      .in("status", ["sent", "failed", "skipped"])
      .order("created_at", { ascending: false })
      .limit(200),
    bag.client
      .from("appointments")
      .select(
        "id, booking_reference, client_name, starts_at, google_sync_error, therapists(full_name)",
        { count: "exact" },
      )
      .not("google_sync_error", "is", null)
      .order("starts_at", { ascending: true })
      .limit(20),
  ]);
  if (deliveryResult.error) throw deliveryResult.error;
  if (meetResult.error) throw meetResult.error;

  // A failed log remains immutable after retry. Treat only failed leaf rows
  // as unresolved so a sent or policy-suppressed retry removes its parent.
  const retriedParents = new Set(
    (deliveryResult.data ?? [])
      .map((row) => row.retried_from as string | null)
      .filter((value): value is string => Boolean(value)),
  );
  const unresolvedNotifications = (deliveryResult.data ?? []).filter(
    (row) => row.status === "failed" && !retriedParents.has(row.id as string),
  );

  return {
    notificationCount: unresolvedNotifications.length,
    meetCount: meetResult.count ?? meetResult.data?.length ?? 0,
    notifications: unresolvedNotifications.slice(0, 8).map((row) => ({
      id: row.id as string,
      templateKey: (row.template_key as string | null) ?? null,
      recipient: row.recipient as string,
      error: String(row.error ?? row.reason ?? "Delivery failed"),
      createdAt: row.created_at as string,
      retryCount: Number(row.retry_count ?? 0),
    })),
    meetSyncs: (meetResult.data ?? []).slice(0, 8).map((row) => ({
      appointmentId: row.id as string,
      bookingReference: String(row.booking_reference ?? ""),
      clientName: String(row.client_name ?? ""),
      therapistName:
        ((row.therapists as { full_name?: string } | null)?.full_name as string | undefined) ??
        null,
      startsAt: row.starts_at as string,
      error: String(row.google_sync_error ?? "Google Calendar or Meet synchronisation failed"),
    })),
  };
}

export const getAdminFailureQueues = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminFailureQueues> => {
    const bag = await requireAdmin();
    const queues = await loadAdminFailureQueues(bag);
    bag.commitCookies();
    return queues;
  },
);

export type AdminOperationsWorkspace = {
  summary: AdminDashboardSummary;
  failureQueues: AdminFailureQueues;
};

export const getAdminOperationsWorkspace = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminOperationsWorkspace> => {
    const bag = await requireAdmin();
    const [summary, failureQueues] = await Promise.all([
      loadAdminDashboardSummary(bag),
      loadAdminFailureQueues(bag),
    ]);
    bag.commitCookies();
    return { summary, failureQueues };
  },
);

export type AdminAuditLogRow = {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  actorKind: "admin" | "staff" | "system";
  action: string;
  targetType: string;
  targetId: string | null;
  reason: string;
  changedFields: string[];
  createdAt: string;
};

type AuditLogQuery = {
  select: (columns: string) => {
    order: (
      column: string,
      options: { ascending: boolean },
    ) => {
      limit: (
        count: number,
      ) => Promise<{ data: Record<string, unknown>[] | null; error: Error | null }>;
    };
  };
};

async function loadAdminAuditLogs(
  bag: Awaited<ReturnType<typeof requireAdmin>>,
): Promise<AdminAuditLogRow[]> {
  const auditLogs = bag.client.from("admin_audit_logs" as never) as unknown as AuditLogQuery;
  const { data, error } = await auditLogs
    .select(
      "id, actor_id, actor_email, actor_kind, action, target_type, target_id, reason, changed_fields, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(250);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: String(row.id),
    actorId: (row.actor_id as string | null) ?? null,
    actorEmail: (row.actor_email as string | null) ?? null,
    actorKind: row.actor_kind as AdminAuditLogRow["actorKind"],
    action: String(row.action),
    targetType: String(row.target_type),
    targetId: (row.target_id as string | null) ?? null,
    reason: String(row.reason),
    changedFields: Array.isArray(row.changed_fields)
      ? row.changed_fields.map((field) => String(field))
      : [],
    createdAt: String(row.created_at),
  }));
}

export const listAdminAuditLogs = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminAuditLogRow[]> => {
    const bag = await requireAdmin();
    try {
      return await loadAdminAuditLogs(bag);
    } finally {
      bag.commitCookies();
    }
  },
);

export type SecurityEventRow = {
  id: string;
  eventType: string;
  identifier: string | null;
  route: string | null;
  severity: string;
  details: Record<string, string>;
  createdAt: string;
};

/**
 * Recent blocked/suspicious public requests (rate-limit trips, rejected cron
 * calls). Identifiers are hashed, so no raw IP addresses are exposed.
 */
async function loadSecurityEvents(
  bag: Awaited<ReturnType<typeof requireAdmin>>,
): Promise<SecurityEventRow[]> {
  const table = bag.client.from("security_events" as never) as unknown as AuditLogQuery;
  const { data, error } = await table
    .select("id, event_type, identifier, route, severity, details, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: String(row.id),
    eventType: String(row.event_type),
    identifier: (row.identifier as string | null) ?? null,
    route: (row.route as string | null) ?? null,
    severity: String(row.severity ?? "warning"),
    details: Object.fromEntries(
      Object.entries((row.details as Record<string, unknown> | null) ?? {}).map(([key, value]) => [
        key,
        typeof value === "string" ? value : JSON.stringify(value ?? null),
      ]),
    ),
    createdAt: String(row.created_at),
  }));
}

export const listSecurityEvents = createServerFn({ method: "GET" }).handler(
  async (): Promise<SecurityEventRow[]> => {
    const bag = await requireAdmin();
    try {
      return await loadSecurityEvents(bag);
    } finally {
      bag.commitCookies();
    }
  },
);

export type AdminAuditWorkspace = {
  logs: AdminAuditLogRow[];
  securityEvents: SecurityEventRow[];
};

export const getAdminAuditWorkspace = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminAuditWorkspace> => {
    const bag = await requireAdmin();
    try {
      const [logs, securityEvents] = await Promise.all([
        loadAdminAuditLogs(bag),
        loadSecurityEvents(bag).catch(() => [] as SecurityEventRow[]),
      ]);
      return { logs, securityEvents };
    } finally {
      bag.commitCookies();
    }
  },
);

export type MigrationContentDecision = "pending" | "approved" | "excluded" | "needs_revision";

export type MigrationContentReviewRow = {
  id: string;
  contentEntryId: string;
  sourceKind: "page" | "post" | "category";
  sourceId: number;
  sourceUrl: string;
  title: string;
  proposedPath: string | null;
  decision: MigrationContentDecision;
  reviewReason: string | null;
  reviewedByEmail: string | null;
  reviewedAt: string | null;
  updatedAt: string;
};

function mapMigrationContentReview(row: Record<string, unknown>): MigrationContentReviewRow {
  return {
    id: String(row.id),
    contentEntryId: String(row.content_entry_id),
    sourceKind: row.source_kind as MigrationContentReviewRow["sourceKind"],
    sourceId: Number(row.source_id),
    sourceUrl: String(row.source_url),
    title: String(row.title),
    proposedPath: (row.proposed_path as string | null) ?? null,
    decision: row.decision as MigrationContentDecision,
    reviewReason: (row.review_reason as string | null) ?? null,
    reviewedByEmail: (row.reviewed_by_email as string | null) ?? null,
    reviewedAt: (row.reviewed_at as string | null) ?? null,
    updatedAt: String(row.updated_at),
  };
}

export const listMigrationContentReviews = createServerFn({ method: "GET" }).handler(
  async (): Promise<MigrationContentReviewRow[]> => {
    const bag = await requireAdmin();
    const { data, error } = await bag.client
      .from("migration_content_reviews")
      .select(
        "id, content_entry_id, source_kind, source_id, source_url, title, proposed_path, decision, review_reason, reviewed_by_email, reviewed_at, updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(500);
    bag.commitCookies();
    if (error) throw error;
    return (data ?? []).map((row) => mapMigrationContentReview(row));
  },
);

export const updateMigrationContentReview = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        decision: z.enum(["pending", "approved", "excluded", "needs_revision"]),
        reason: z.string().trim().max(500).nullable(),
        proposedPath: z
          .string()
          .trim()
          .max(500)
          .regex(/^\//, "Destination must begin with /")
          .nullable(),
      })
      .superRefine((value, context) => {
        if (value.decision !== "pending" && (!value.reason || value.reason.length < 3)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["reason"],
            message: "Add a reason of at least 3 characters.",
          });
        }
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<MigrationContentReviewRow> => {
    const bag = await requireAdmin();
    const {
      data: { user },
    } = await bag.client.auth.getUser();
    if (!user) {
      bag.commitCookies();
      throw new Error("Sign in required.");
    }
    const reviewed = data.decision !== "pending";
    const { data: updated, error } = await bag.client
      .from("migration_content_reviews")
      .update({
        decision: data.decision,
        review_reason: reviewed ? data.reason : null,
        proposed_path: data.proposedPath,
        reviewed_by: reviewed ? user.id : null,
        reviewed_by_email: reviewed ? (user.email ?? null) : null,
        reviewed_at: reviewed ? new Date().toISOString() : null,
      })
      .eq("id", data.id)
      .select(
        "id, content_entry_id, source_kind, source_id, source_url, title, proposed_path, decision, review_reason, reviewed_by_email, reviewed_at, updated_at",
      )
      .single();
    bag.commitCookies();
    if (error) throw error;
    return mapMigrationContentReview(updated);
  });

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase, hyphen-separated");

export type UpdateContentPatch = {
  title?: string;
  slug?: string;
  authorName?: string | null;
  excerptHtml?: string | null;
  metadata?: Record<string, unknown>;
};

export const updateContentFields = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().trim().min(1).max(300).optional(),
        slug: slugSchema.optional(),
        authorName: z.string().trim().max(200).nullable().optional(),
        excerptHtml: z.string().trim().max(4000).nullable().optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const bag = await requireAdmin();
    const patch: Record<string, unknown> = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.authorName !== undefined)
      patch.author_name = data.authorName === "" ? null : data.authorName;
    if (data.excerptHtml !== undefined)
      patch.excerpt_html = data.excerptHtml === "" ? null : data.excerptHtml;
    if (data.metadata !== undefined) patch.metadata = data.metadata;
    if (data.slug !== undefined) {
      patch.slug = data.slug;
      const { data: existing } = await bag.client
        .from("content_entries")
        .select("kind")
        .eq("id", data.id)
        .maybeSingle();
      const kind = (existing?.kind as string) ?? "post";
      patch.canonical_path = `/content/${kind}s/${data.slug}`;
    }
    if (Object.keys(patch).length === 0) {
      bag.commitCookies();
      return { ok: true, row: null as AdminContentRow | null };
    }
    const { data: updated, error } = await bag.client
      .from("content_entries")
      .update(patch)
      .eq("id", data.id)
      .select(
        "id, kind, slug, title, source_status, published_at, source_modified_at, author_name, canonical_path, featured_media_path, excerpt_html, scheduled_publish_at, scheduled_unpublish_at, archived_at",
      )
      .maybeSingle();
    bag.commitCookies();
    if (error) throw error;
    clearPublicContentEntryCache();
    const row: AdminContentRow | null = updated
      ? {
          id: updated.id as string,
          kind: updated.kind as AdminContentRow["kind"],
          slug: (updated.slug as string) ?? "",
          title: (updated.title as string) ?? "(untitled)",
          status: (updated.source_status as string) ?? "draft",
          publishedAt: (updated.published_at as string) ?? null,
          updatedAt: (updated.source_modified_at as string) ?? null,
          author: (updated.author_name as string) ?? null,
          canonicalPath: (updated.canonical_path as string) ?? null,
          featuredMediaPath: (updated.featured_media_path as string) ?? null,
          excerptHtml: (updated.excerpt_html as string) ?? null,
          scheduledPublishAt: (updated.scheduled_publish_at as string) ?? null,
          scheduledUnpublishAt: (updated.scheduled_unpublish_at as string) ?? null,
          archivedAt: (updated.archived_at as string) ?? null,
        }
      : null;

    return { ok: true, row };
  });

export const createContentEntry = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ kind: contentKindSchema, title: z.string().trim().min(1).max(300) }).parse(data),
  )
  .handler(async ({ data }): Promise<{ id: string }> => {
    const bag = await requireAdmin();
    const slugBase =
      data.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 120) || data.kind;
    const slug = `${slugBase}-${Date.now().toString(36)}`;
    const canonicalPath = `/content/${data.kind}s/${slug}`;
    const { data: row, error } = await bag.client
      .from("content_entries")
      .insert({
        kind: data.kind,
        source_id: Date.now(),
        slug,
        canonical_path: canonicalPath,
        title: data.title,
        source_status: "draft",
        imported_at: new Date().toISOString(),
        source_modified_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    bag.commitCookies();
    if (error) throw error;
    return { id: row.id as string };
  });

function mapAdminContentDetail(r: Record<string, unknown> | null): AdminContentDetail | null {
  if (!r) return null;
  const kind = r.kind as AdminContentRow["kind"];
  const rawBodyHtml = (r.body_html as string) ?? null;
  const bodyHtml =
    kind === "post" ? sanitizeContentHtml(cleanLegacyPostBodyHtml(rawBodyHtml)) : rawBodyHtml;

  return {
    id: r.id as string,
    kind,
    slug: (r.slug as string) ?? "",
    title: (r.title as string) ?? "(untitled)",
    status: (r.source_status as string) ?? "draft",
    publishedAt: (r.published_at as string) ?? null,
    updatedAt: (r.source_modified_at as string) ?? null,
    author: (r.author_name as string) ?? null,
    canonicalPath: (r.canonical_path as string) ?? null,
    featuredMediaPath: (r.featured_media_path as string) ?? null,
    excerptHtml: (r.excerpt_html as string) ?? null,
    bodyHtml,
    metadata: (r.metadata as Record<string, Json>) ?? {},
    scheduledPublishAt: (r.scheduled_publish_at as string) ?? null,
    scheduledUnpublishAt: (r.scheduled_unpublish_at as string) ?? null,
    archivedAt: (r.archived_at as string) ?? null,
  };
}

export type AdminContentDetail = AdminContentRow & {
  bodyHtml: string | null;
  metadata: Record<string, Json>;
};

async function loadAdminContentEntry(
  bag: Awaited<ReturnType<typeof requireAdmin>>,
  id: string,
): Promise<AdminContentDetail | null> {
  const { data: r, error } = await bag.client
    .from("content_entries")
    .select(
      "id, kind, slug, title, source_status, published_at, source_modified_at, author_name, canonical_path, featured_media_path, excerpt_html, body_html, metadata, scheduled_publish_at, scheduled_unpublish_at, archived_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return mapAdminContentDetail(r);
}

export const getAdminContentEntry = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<AdminContentDetail | null> => {
    const bag = await requireAdmin();
    try {
      return await loadAdminContentEntry(bag, data.id);
    } finally {
      bag.commitCookies();
    }
  });

export type AdminContentEditWorkspace = {
  entry: AdminContentDetail | null;
  categories: AdminCategoryOption[];
};

export const getAdminContentEditWorkspace = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<AdminContentEditWorkspace> => {
    const bag = await requireAdmin();
    try {
      const [entry, categories] = await Promise.all([
        loadAdminContentEntry(bag, data.id),
        loadAdminCategories(bag),
      ]);
      return { entry, categories };
    } finally {
      bag.commitCookies();
    }
  });

export const getAdminContentEntryBySlug = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ kind: contentKindSchema, slug: z.string().trim().min(1).max(200) }).parse(d),
  )
  .handler(async ({ data }): Promise<AdminContentDetail | null> => {
    const bag = await requireAdmin();
    const { data: r, error } = await bag.client
      .from("content_entries")
      .select(
        "id, kind, slug, title, source_status, published_at, source_modified_at, author_name, canonical_path, featured_media_path, excerpt_html, body_html, metadata, scheduled_publish_at, scheduled_unpublish_at, archived_at",
      )
      .eq("kind", data.kind)
      .eq("slug", data.slug)
      .maybeSingle();
    bag.commitCookies();
    if (error) throw error;
    return mapAdminContentDetail(r);
  });

export const updateContentBody = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        bodyHtml: z.string().max(500_000).nullable(),
        featuredMediaPath: z.string().trim().max(1000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const bag = await requireAdmin();
    const patch: Record<string, unknown> = {
      body_html: data.bodyHtml === "" ? null : data.bodyHtml,
      source_modified_at: new Date().toISOString(),
    };
    if (data.featuredMediaPath !== undefined) {
      patch.featured_media_path =
        data.featuredMediaPath && data.featuredMediaPath.length > 0 ? data.featuredMediaPath : null;
    }
    const { error } = await bag.client.from("content_entries").update(patch).eq("id", data.id);
    bag.commitCookies();
    if (error) throw error;
    clearPublicContentEntryCache();
    return { ok: true };
  });

export const setContentStatus = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["publish", "draft"]) }).parse(data),
  )
  .handler(async ({ data }) => {
    const bag = await requireAdmin();
    const patch: Record<string, unknown> = { source_status: data.status };
    if (data.status === "publish") patch.published_at = new Date().toISOString();
    const { error } = await bag.client.from("content_entries").update(patch).eq("id", data.id);
    bag.commitCookies();
    if (error) throw error;
    clearPublicContentEntryCache();
    return { ok: true };
  });

export const bulkSetContentStatus = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        ids: z.array(z.string().uuid()).min(1).max(500),
        status: z.enum(["publish", "draft"]),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const bag = await requireAdmin();
    const patch: Record<string, unknown> = { source_status: data.status };
    if (data.status === "publish") patch.published_at = new Date().toISOString();
    const { error, count } = await bag.client
      .from("content_entries")
      .update(patch, { count: "exact" })
      .in("id", data.ids);
    bag.commitCookies();
    if (error) throw error;
    clearPublicContentEntryCache();
    return { ok: true, count: count ?? data.ids.length };
  });

export const bulkDeleteContent = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(500) }).parse(data),
  )
  .handler(async ({ data }) => {
    const bag = await requireAdmin();
    const { error, count } = await bag.client
      .from("content_entries")
      .delete({ count: "exact" })
      .in("id", data.ids);
    bag.commitCookies();
    if (error) throw error;
    clearPublicContentEntryCache();
    return { ok: true, count: count ?? data.ids.length };
  });

// ============================================================================
// Media library
// ============================================================================

export type AdminMediaRow = {
  id: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  altText: string | null;
  tags: string[];
  createdAt: string;
  publicUrl: string | null;
};

async function signMediaRows(
  bag: Awaited<ReturnType<typeof requireAdmin>>,
  rows: Array<{
    id: string;
    storage_path: string;
    source_filename: string | null;
    mime_type: string | null;
    byte_size: number | null;
    alt_text: string | null;
    tags: string[] | null;
    created_at: string;
  }>,
): Promise<AdminMediaRow[]> {
  const paths = rows.map((r) => r.storage_path);
  let signed: Record<string, string> = {};
  if (paths.length > 0) {
    const { data: sig } = await bag.client.storage
      .from("content-media")
      .createSignedUrls(paths, 60 * 60);
    if (Array.isArray(sig)) {
      signed = Object.fromEntries(
        sig
          .filter((s) => s?.signedUrl && s.path)
          .map((s) => [s.path as string, s.signedUrl as string]),
      );
    }
  }
  return rows.map((r) => ({
    id: r.id,
    storagePath: r.storage_path,
    fileName: r.source_filename ?? r.storage_path,
    mimeType: r.mime_type ?? "",
    byteSize: Number(r.byte_size ?? 0),
    altText: r.alt_text ?? null,
    tags: r.tags ?? [],
    createdAt: r.created_at,
    publicUrl: signed[r.storage_path] ?? null,
  }));
}

export const listAdminMedia = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminMediaRow[]> => {
    const bag = await requireAdmin();
    const { data: rows, error } = await bag.client
      .from("content_media")
      .select("id, storage_path, source_filename, mime_type, byte_size, alt_text, tags, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      bag.commitCookies();
      throw error;
    }
    const out = await signMediaRows(bag, (rows ?? []) as never);
    bag.commitCookies();
    return out;
  },
);

export type AdminMediaPage = {
  items: AdminMediaRow[];
  page: number;
  pageSize: number;
  hasMore: boolean;
};

const adminMediaPageInput = z.object({
  page: z.number().int().min(1).max(1000).default(1),
  pageSize: z.number().int().min(20).max(100).default(100),
});

export const listAdminMediaPage = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => adminMediaPageInput.parse(data))
  .handler(async ({ data }): Promise<AdminMediaPage> => {
    const bag = await requireAdmin();
    const start = (data.page - 1) * data.pageSize;
    const { data: rows, error } = await bag.client
      .from("content_media")
      .select("id, storage_path, source_filename, mime_type, byte_size, alt_text, tags, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(start, start + data.pageSize - 1);
    if (error) {
      bag.commitCookies();
      throw error;
    }
    const items = await signMediaRows(bag, (rows ?? []) as never);
    bag.commitCookies();
    return {
      items,
      page: data.page,
      pageSize: data.pageSize,
      hasMore: items.length === data.pageSize,
    };
  });

export type AdminTrashedMediaRow = AdminMediaRow & {
  deletedAt: string;
  expiresAt: string;
};

// How long a soft-deleted media file remains restorable.
export const MEDIA_TRASH_RETENTION_MINUTES = 30;

export const listTrashedMedia = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminTrashedMediaRow[]> => {
    const bag = await requireAdmin();
    const { data: rows, error } = await bag.client
      .from("content_media")
      .select(
        "id, storage_path, source_filename, mime_type, byte_size, alt_text, tags, created_at, deleted_at",
      )
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(500);
    if (error) {
      bag.commitCookies();
      throw error;
    }
    const signed = await signMediaRows(bag, (rows ?? []) as never);
    bag.commitCookies();
    return signed.map((r, i) => {
      const deletedAt = (rows![i] as { deleted_at: string }).deleted_at;
      return {
        ...r,
        deletedAt,
        expiresAt: new Date(
          new Date(deletedAt).getTime() + MEDIA_TRASH_RETENTION_MINUTES * 60_000,
        ).toISOString(),
      };
    });
  },
);

export const restoreMedia = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(500) }).parse(data),
  )
  .handler(async ({ data }): Promise<{ ok: true; count: number }> => {
    const bag = await requireAdmin();
    const { error, count } = await bag.client
      .from("content_media")
      .update({ deleted_at: null, deleted_by: null }, { count: "exact" })
      .in("id", data.ids)
      .not("deleted_at", "is", null);
    bag.commitCookies();
    if (error) throw error;
    return { ok: true, count: count ?? 0 };
  });

export const purgeTrashedMedia = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).max(500).optional() }).parse(data ?? {}),
  )
  .handler(async ({ data }): Promise<{ ok: true; count: number; storageErrors: number }> => {
    const bag = await requireAdmin();
    const cutoff = new Date(Date.now() - MEDIA_TRASH_RETENTION_MINUTES * 60_000).toISOString();
    let query = bag.client
      .from("content_media")
      .select("id, storage_path")
      .not("deleted_at", "is", null);
    query =
      data.ids && data.ids.length > 0 ? query.in("id", data.ids) : query.lte("deleted_at", cutoff);
    const { data: rows, error } = await query;
    if (error) {
      bag.commitCookies();
      throw error;
    }
    const ids = (rows ?? []).map((r) => r.id as string);
    const paths = (rows ?? []).map((r) => r.storage_path as string).filter(Boolean);
    let storageErrors = 0;
    if (paths.length > 0) {
      const { error: sErr } = await bag.client.storage.from("content-media").remove(paths);
      if (sErr) storageErrors = paths.length;
    }
    if (ids.length === 0) {
      bag.commitCookies();
      return { ok: true, count: 0, storageErrors };
    }
    const { error: delErr, count } = await bag.client
      .from("content_media")
      .delete({ count: "exact" })
      .in("id", ids);
    bag.commitCookies();
    if (delErr) throw delErr;
    return { ok: true, count: count ?? ids.length, storageErrors };
  });

const tagsSchema = z
  .array(z.string().trim().min(1).max(40))
  .max(30)
  .transform((arr) => Array.from(new Set(arr.map((t) => t.toLowerCase().replace(/\s+/g, "-")))));

export const updateMediaMetadata = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        altText: z.string().max(500).nullable().optional(),
        tags: tagsSchema.optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<AdminMediaRow> => {
    const bag = await requireAdmin();
    const patch: Record<string, unknown> = {};
    if (data.altText !== undefined)
      patch.alt_text = data.altText?.trim() ? data.altText.trim() : null;
    if (data.tags !== undefined) patch.tags = data.tags;
    const { data: row, error } = await bag.client
      .from("content_media")
      .update(patch)
      .eq("id", data.id)
      .select("id, storage_path, source_filename, mime_type, byte_size, alt_text, tags, created_at")
      .single();
    if (error) {
      bag.commitCookies();
      throw error;
    }
    const [out] = await signMediaRows(bag, [row as never]);
    bag.commitCookies();
    return out;
  });

export const refreshMediaAfterReplace = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        mimeType: z.string().min(1).max(200),
        byteSize: z.number().int().nonnegative(),
        sourceFilename: z.string().min(1).max(500).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<AdminMediaRow> => {
    const bag = await requireAdmin();
    const patch: Record<string, unknown> = {
      mime_type: data.mimeType,
      byte_size: data.byteSize,
    };
    if (data.sourceFilename) patch.source_filename = data.sourceFilename;
    const { data: row, error } = await bag.client
      .from("content_media")
      .update(patch)
      .eq("id", data.id)
      .select("id, storage_path, source_filename, mime_type, byte_size, alt_text, tags, created_at")
      .single();
    if (error) {
      bag.commitCookies();
      throw error;
    }
    const [out] = await signMediaRows(bag, [row as never]);
    bag.commitCookies();
    return out;
  });

// Long-lived signed URL for a content-media object.
// Used when we need a URL-shaped value we can drop straight into fields like
// `therapists.image_url` that are rendered on the public site.
export const signContentMediaUrl = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        path: z.string().min(1).max(1000),
        expiresIn: z
          .number()
          .int()
          .positive()
          .max(60 * 60 * 24 * 365 * 20)
          .optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<{ signedUrl: string; path: string }> => {
    const bag = await requireAdmin();
    const { data: sig, error } = await bag.client.storage
      .from("content-media")
      .createSignedUrl(data.path, data.expiresIn ?? 60 * 60 * 24 * 365 * 10);
    bag.commitCookies();
    if (error || !sig?.signedUrl) throw error ?? new Error("Failed to sign URL");
    return { signedUrl: sig.signedUrl, path: data.path };
  });

// ============================================================================
// Therapists
// ============================================================================

export type AdminTherapistRow = {
  id: string;
  slug: string;
  userId: string | null;
  loginEmail: string | null;
  fullName: string;
  roleTitle: string | null;
  credentials: string | null;
  location: string | null;
  bio: string | null;
  specialties: string[];
  modalities: string[];
  imageUrl: string | null;
  isActive: boolean;
  displayOrder: number;
  updatedAt: string | null;
};

const THERAPIST_COLUMNS =
  "id, user_id, slug, full_name, role_title, credentials, location, bio, specialties, modalities, image_url, is_active, display_order, updated_at";

function mapTherapist(r: Record<string, unknown>): AdminTherapistRow {
  return {
    id: r.id as string,
    slug: (r.slug as string) ?? "",
    userId: (r.user_id as string | null) ?? null,
    loginEmail: null,
    fullName: (r.full_name as string) ?? "",
    roleTitle: (r.role_title as string) ?? null,
    credentials: (r.credentials as string) ?? null,
    location: (r.location as string) ?? null,
    bio: (r.bio as string) ?? null,
    specialties: (r.specialties as string[]) ?? [],
    modalities: (r.modalities as string[]) ?? [],
    imageUrl: (r.image_url as string) ?? null,
    isActive: Boolean(r.is_active),
    displayOrder: Number(r.display_order ?? 0),
    updatedAt: (r.updated_at as string) ?? null,
  };
}

async function decorateTherapistAccounts(rows: AdminTherapistRow[]): Promise<AdminTherapistRow[]> {
  const userIds = rows.map((row) => row.userId).filter((id): id is string => Boolean(id));
  if (!userIds.length) return rows;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const emails = new Map<string, string>();
  await Promise.all(
    userIds.map(async (userId) => {
      const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (data.user?.email) emails.set(userId, data.user.email);
    }),
  );
  return rows.map((row) => ({
    ...row,
    loginEmail: row.userId ? (emails.get(row.userId) ?? null) : null,
  }));
}

async function loadAdminTherapists(
  bag: Awaited<ReturnType<typeof requireAdmin>>,
): Promise<AdminTherapistRow[]> {
  const { data, error } = await bag.client
    .from("therapists")
    .select(THERAPIST_COLUMNS)
    .order("display_order", { ascending: true })
    .order("full_name", { ascending: true });
  if (error) throw error;
  return decorateTherapistAccounts(
    (data ?? []).map((r) => mapTherapist(r as Record<string, unknown>)),
  );
}

export const listAdminTherapists = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminTherapistRow[]> => {
    const bag = await requireAdmin();
    try {
      return await loadAdminTherapists(bag);
    } finally {
      bag.commitCookies();
    }
  },
);

export type AdminServicesWorkspace = {
  services: AdminServiceRow[];
  therapists: AdminTherapistRow[];
};

export const getAdminServicesWorkspace = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminServicesWorkspace> => {
    const bag = await requireAdmin();
    try {
      const [services, therapists] = await Promise.all([
        loadAdminServices(bag),
        loadAdminTherapists(bag),
      ]);
      return { services, therapists };
    } finally {
      bag.commitCookies();
    }
  },
);

const therapistAccountInput = z.object({
  therapistId: z.string().uuid(),
  email: z.string().trim().email().max(320),
});

async function findAuthUserByEmail(email: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const target = email.toLowerCase();
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const match = data.users.find((user) => user.email?.toLowerCase() === target);
    if (match) return match.id;
    if (data.users.length < 1000) break;
  }
  return null;
}

async function inviteOrFindTherapistUser(
  email: string,
): Promise<{ userId: string; invitationUrl: string | null }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const existing = await findAuthUserByEmail(email);
  if (existing) return { userId: existing, invitationUrl: null };
  const redirectTo = `${process.env["PUBLIC_SITE_URL"] || process.env["SITE_URL"] || "https://talkspace.ng"}/reset-password?invite=therapist&redirect=%2Ftherapist`;
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "invite",
    email,
    options: { redirectTo },
  });
  if (error) throw error;
  if (!data.user?.id || !data.properties?.action_link) {
    throw new Error("Could not create therapist invitation.");
  }
  return { userId: data.user.id, invitationUrl: data.properties.action_link };
}

export const linkTherapistLogin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => therapistAccountInput.parse(data))
  .handler(async ({ data }): Promise<AdminTherapistRow & { invitationSent: boolean }> => {
    const bag = await requireAdmin();
    const invitation = await inviteOrFindTherapistUser(data.email);
    const userId = invitation.userId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: linked, error } = await supabaseAdmin
      .from("therapists")
      .update({ user_id: userId })
      .eq("id", data.therapistId)
      .select(THERAPIST_COLUMNS)
      .single();
    if (error) {
      bag.commitCookies();
      throw error;
    }
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "therapist" }, { onConflict: "user_id,role" });
    bag.commitCookies();
    if (roleError) throw roleError;
    const [row] = await decorateTherapistAccounts([
      mapTherapist(linked as Record<string, unknown>),
    ]);
    let invitationSent = false;
    if (invitation.invitationUrl) {
      const { sendTemplateEmail } = await import("@/lib/email.server");
      const result = await sendTemplateEmail("therapist_account_invitation", data.email, {
        therapistName: row.fullName,
        invitationUrl: invitation.invitationUrl,
      });
      invitationSent = result.sent;
      if (!result.sent) {
        console.error("[therapists] account invitation email was not sent:", result.reason);
      }
    }
    return { ...row, loginEmail: data.email.trim().toLowerCase(), invitationSent };
  });

export const resendTherapistInvitation = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ therapistId: z.string().uuid() }).parse(data))
  .handler(async ({ data }): Promise<{ sent: boolean; email: string }> => {
    const bag = await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: therapist, error } = await supabaseAdmin
      .from("therapists")
      .select("full_name, user_id")
      .eq("id", data.therapistId)
      .single();
    bag.commitCookies();
    if (error) throw error;
    if (!therapist.user_id) {
      throw new Error("Link a therapist login before resending an invitation.");
    }

    const { data: authUser, error: userError } = await supabaseAdmin.auth.admin.getUserById(
      therapist.user_id,
    );
    if (userError) throw userError;
    const email = authUser.user?.email?.trim().toLowerCase();
    if (!email) throw new Error("The linked therapist account has no email address.");

    const redirectTo = `${process.env["PUBLIC_SITE_URL"] || process.env["SITE_URL"] || "https://talkspace.ng"}/reset-password?invite=therapist&redirect=%2Ftherapist`;
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });
    if (linkError) throw linkError;
    if (!linkData.properties?.action_link) {
      throw new Error("Could not create a new therapist invitation link.");
    }

    const { sendTemplateEmail } = await import("@/lib/email.server");
    const result = await sendTemplateEmail("therapist_account_invitation", email, {
      therapistName: therapist.full_name,
      invitationUrl: linkData.properties.action_link,
    });
    if (!result.sent) {
      throw new Error(result.reason || "The invitation email could not be sent.");
    }
    return { sent: true, email };
  });

export const revokeTherapistLogin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ therapistId: z.string().uuid() }).parse(data))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const bag = await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: therapist, error: lookupError } = await supabaseAdmin
      .from("therapists")
      .select("user_id")
      .eq("id", data.therapistId)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!therapist) throw new Error("Therapist profile not found.");

    const userId = therapist.user_id as string | null;
    const { data: connection } = await supabaseAdmin
      .from("therapist_google_connections")
      .select("sync_channel_id, sync_resource_id")
      .eq("therapist_id", data.therapistId)
      .maybeSingle();
    if (connection?.sync_channel_id && connection?.sync_resource_id) {
      try {
        const { stopWatchCalendar } = await import("@/lib/google.server");
        await stopWatchCalendar(
          data.therapistId,
          connection.sync_channel_id as string,
          connection.sync_resource_id as string,
        );
      } catch (err) {
        console.warn("[therapists] stop Google watch during access revocation failed:", err);
      }
    }
    const { error: connectionError } = await supabaseAdmin
      .from("therapist_google_connections")
      .delete()
      .eq("therapist_id", data.therapistId);
    if (connectionError) throw connectionError;

    const { error: profileError } = await supabaseAdmin
      .from("therapists")
      .update({ user_id: null })
      .eq("id", data.therapistId);
    if (profileError) throw profileError;
    if (userId) {
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "therapist");
      if (roleError) throw roleError;
    }
    bag.commitCookies();
    return { ok: true };
  });

export const deleteTherapist = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }): Promise<{ ok: true; archived: boolean }> => {
    const bag = await requireAdmin();
    const { error } = await bag.client.from("therapists").delete().eq("id", data.id);
    if (error) {
      if (error.message.toLowerCase().includes("foreign key")) {
        const { error: archiveError } = await bag.client
          .from("therapists")
          .update({ is_active: false })
          .eq("id", data.id);
        bag.commitCookies();
        if (archiveError) throw archiveError;
        return { ok: true, archived: true };
      }
      bag.commitCookies();
      throw error;
    }
    bag.commitCookies();
    return { ok: true, archived: false };
  });

export const setTherapistActive = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), isActive: z.boolean() }).parse(data),
  )
  .handler(async ({ data }) => {
    const bag = await requireAdmin();
    const { error } = await bag.client
      .from("therapists")
      .update({ is_active: data.isActive })
      .eq("id", data.id);
    bag.commitCookies();
    if (error) throw error;
    return { ok: true };
  });

export const reorderTherapists = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        order: z
          .array(z.object({ id: z.string().uuid(), displayOrder: z.number().int() }))
          .min(1)
          .max(500),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const bag = await requireAdmin();
    for (const item of data.order) {
      const { error } = await bag.client
        .from("therapists")
        .update({ display_order: item.displayOrder })
        .eq("id", item.id);
      if (error) {
        bag.commitCookies();
        throw error;
      }
    }
    bag.commitCookies();
    return { ok: true };
  });

export type TherapistAvailabilityRule = {
  id: string;
  therapistId: string;
  dayOfWeek: number;
  startsAt: string;
  endsAt: string;
  mode: "online" | "in_person" | "phone";
  timezone: string;
  isActive: boolean;
};

const availabilityRuleInput = z.object({
  therapistId: z.string().uuid(),
  dayOfWeek: z.number().int().min(0).max(6),
  startsAt: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "HH:MM required"),
  endsAt: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "HH:MM required"),
  mode: z.enum(["online", "in_person", "phone"]),
  timezone: z.string().min(1).max(64).default("Africa/Lagos"),
  isActive: z.boolean().default(true),
});

function mapRule(r: Record<string, unknown>): TherapistAvailabilityRule {
  return {
    id: r.id as string,
    therapistId: r.therapist_id as string,
    dayOfWeek: Number(r.day_of_week),
    startsAt: (r.starts_at as string) ?? "",
    endsAt: (r.ends_at as string) ?? "",
    mode: r.mode as TherapistAvailabilityRule["mode"],
    timezone: (r.timezone as string) ?? "Africa/Lagos",
    isActive: Boolean(r.is_active),
  };
}

export const listTherapistAvailability = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ therapistId: z.string().uuid() }).parse(data))
  .handler(async ({ data }): Promise<TherapistAvailabilityRule[]> => {
    const bag = await requireAdmin();
    const { data: rows, error } = await bag.client
      .from("availability_rules")
      .select("id, therapist_id, day_of_week, starts_at, ends_at, mode, timezone, is_active")
      .eq("therapist_id", data.therapistId)
      .order("day_of_week", { ascending: true })
      .order("starts_at", { ascending: true });
    bag.commitCookies();
    if (error) throw error;
    return (rows ?? []).map((r) => mapRule(r as Record<string, unknown>));
  });

export const createAvailabilityRule = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => availabilityRuleInput.parse(data))
  .handler(async ({ data }): Promise<TherapistAvailabilityRule> => {
    const bag = await requireAdmin();
    const { data: row, error } = await bag.client
      .from("availability_rules")
      .insert({
        therapist_id: data.therapistId,
        day_of_week: data.dayOfWeek,
        starts_at: data.startsAt,
        ends_at: data.endsAt,
        mode: data.mode,
        timezone: data.timezone,
        is_active: data.isActive,
      })
      .select("id, therapist_id, day_of_week, starts_at, ends_at, mode, timezone, is_active")
      .single();
    bag.commitCookies();
    if (error) throw error;
    return mapRule(row as Record<string, unknown>);
  });

export const updateAvailabilityRule = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    availabilityRuleInput.partial().extend({ id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }): Promise<TherapistAvailabilityRule> => {
    const bag = await requireAdmin();
    const patch: Record<string, unknown> = {};
    if (data.dayOfWeek !== undefined) patch.day_of_week = data.dayOfWeek;
    if (data.startsAt !== undefined) patch.starts_at = data.startsAt;
    if (data.endsAt !== undefined) patch.ends_at = data.endsAt;
    if (data.mode !== undefined) patch.mode = data.mode;
    if (data.timezone !== undefined) patch.timezone = data.timezone;
    if (data.isActive !== undefined) patch.is_active = data.isActive;
    const { data: row, error } = await bag.client
      .from("availability_rules")
      .update(patch)
      .eq("id", data.id)
      .select("id, therapist_id, day_of_week, starts_at, ends_at, mode, timezone, is_active")
      .single();
    bag.commitCookies();
    if (error) throw error;
    return mapRule(row as Record<string, unknown>);
  });

export const deleteAvailabilityRule = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const bag = await requireAdmin();
    const { error } = await bag.client.from("availability_rules").delete().eq("id", data.id);
    bag.commitCookies();
    if (error) throw error;
    return { ok: true };
  });

// ============================================================================
// Media — bulk operations
// ============================================================================

export const bulkUpdateMediaTags = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        ids: z.array(z.string().uuid()).min(1).max(500),
        mode: z.enum(["add", "remove", "replace"]),
        tags: tagsSchema,
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<{ ok: true; count: number }> => {
    const bag = await requireAdmin();
    const { data: rows, error } = await bag.client
      .from("content_media")
      .select("id, tags")
      .in("id", data.ids);
    if (error) {
      bag.commitCookies();
      throw error;
    }
    const updates = (rows ?? []).map((r) => {
      const current = (r.tags as string[] | null) ?? [];
      let next: string[];
      if (data.mode === "replace") next = data.tags;
      else if (data.mode === "add") next = Array.from(new Set([...current, ...data.tags]));
      else next = current.filter((t) => !data.tags.includes(t));
      return { id: r.id as string, tags: next };
    });
    for (const u of updates) {
      const { error: upErr } = await bag.client
        .from("content_media")
        .update({ tags: u.tags })
        .eq("id", u.id);
      if (upErr) {
        bag.commitCookies();
        throw upErr;
      }
    }
    bag.commitCookies();
    return { ok: true, count: updates.length };
  });

export const bulkDeleteMedia = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(200) }).parse(data),
  )
  .handler(
    async ({
      data,
    }): Promise<{
      ok: true;
      count: number;
      restorableIds: string[];
      retentionMinutes: number;
    }> => {
      const bag = await requireAdmin();
      const {
        data: { user },
      } = await bag.client.auth.getUser();
      const { data: selectedMedia, error: selectedError } = await bag.client
        .from("content_media")
        .select("id, storage_path, source_filename")
        .in("id", data.ids)
        .is("deleted_at", null);
      if (selectedError) throw selectedError;
      const paths = (selectedMedia ?? []).map((row) => row.storage_path as string);
      const [
        { data: contentUses, error: contentUseError },
        { data: settingsUses, error: settingsUseError },
      ] = await Promise.all([
        bag.client
          .from("content_entries")
          .select("title, featured_media_path")
          .in("featured_media_path", paths),
        bag.client.from("site_settings").select("key, value"),
      ]);
      if (contentUseError) throw contentUseError;
      if (settingsUseError) throw settingsUseError;
      const usedPaths = new Set(
        (contentUses ?? []).map((row) => row.featured_media_path as string),
      );
      for (const setting of settingsUses ?? []) {
        const serialized = JSON.stringify(setting.value ?? {});
        for (const path of paths) if (serialized.includes(path)) usedPaths.add(path);
      }
      const blocked = (selectedMedia ?? []).filter((row) =>
        usedPaths.has(row.storage_path as string),
      );
      if (blocked.length > 0) {
        const names = blocked.map((row) => row.source_filename || row.storage_path).join(", ");
        throw new Error(
          `Cannot delete media currently in use: ${names}. Remove it from content or site settings first.`,
        );
      }
      const { data: rows, error } = await bag.client
        .from("content_media")
        .update(
          { deleted_at: new Date().toISOString(), deleted_by: user?.id ?? null },
          { count: "exact" },
        )
        .in("id", data.ids)
        .is("deleted_at", null)
        .select("id");
      bag.commitCookies();
      if (error) throw error;
      const ids = (rows ?? []).map((r) => r.id as string);
      return {
        ok: true,
        count: ids.length,
        restorableIds: ids,
        retentionMinutes: MEDIA_TRASH_RETENTION_MINUTES,
      };
    },
  );

// ============================================================================
// Services catalogue
// ============================================================================

export type AdminServiceRow = {
  id: string;
  code: string;
  slug: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  sessionsPerPackage: number;
  priceNgn: number | null;
  inPersonPriceNgn: number | null;
  currency: string;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  minimumLeadTimeMinutes: number;
  displayOrder: number;
  isActive: boolean;
  therapistIds: string[];
  updatedAt: string | null;
};

const codeSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9_]+$/, "Code must be lowercase letters, digits, or underscores");

const currencySchema = z
  .string()
  .trim()
  .length(3)
  .regex(/^[A-Z]{3}$/i)
  .transform((v) => v.toUpperCase());

async function loadAdminServices(
  bag: Awaited<ReturnType<typeof requireAdmin>>,
): Promise<AdminServiceRow[]> {
  let result = await bag.client
    .from("services")
    .select(
      "id, code, slug, name, description, duration_minutes, sessions_per_package, price_ngn, in_person_price_ngn, currency, buffer_before_minutes, buffer_after_minutes, minimum_lead_time_minutes, display_order, is_active, updated_at",
    )
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });
  if (isMissingInPersonPriceColumn(result.error)) {
    const fallback = await bag.client
      .from("services")
      .select(
        "id, code, slug, name, description, duration_minutes, sessions_per_package, price_ngn, currency, buffer_before_minutes, buffer_after_minutes, minimum_lead_time_minutes, display_order, is_active, updated_at",
      )
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });
    result = fallback.error
      ? fallback
      : {
          ...fallback,
          data: fallback.data.map((row) => ({ ...row, in_person_price_ngn: null })),
        };
  }
  const { data, error } = result;
  if (error) throw error;
  const { data: assignments, error: aErr } = await bag.client
    .from("therapist_services")
    .select("service_id, therapist_id");
  if (aErr) throw aErr;
  const byService = new Map<string, string[]>();
  for (const a of assignments ?? []) {
    const list = byService.get(a.service_id as string) ?? [];
    list.push(a.therapist_id as string);
    byService.set(a.service_id as string, list);
  }
  return (data ?? []).map((r) => ({
    id: r.id as string,
    code: (r.code as string) ?? "",
    slug: (r.slug as string) ?? "",
    name: (r.name as string) ?? "",
    description: (r.description as string) ?? null,
    durationMinutes: Number(r.duration_minutes ?? 0),
    sessionsPerPackage: Number(r.sessions_per_package ?? 1),
    priceNgn: r.price_ngn == null ? null : Number(r.price_ngn),
    inPersonPriceNgn:
      "in_person_price_ngn" in r && r.in_person_price_ngn != null
        ? Number(r.in_person_price_ngn)
        : fallbackInPersonPriceNgn((r.code as string) ?? null),
    currency: (r.currency as string) ?? "NGN",
    bufferBeforeMinutes: Number(r.buffer_before_minutes ?? 0),
    bufferAfterMinutes: Number(r.buffer_after_minutes ?? 0),
    minimumLeadTimeMinutes: Number(r.minimum_lead_time_minutes ?? 0),
    displayOrder: Number(r.display_order ?? 0),
    isActive: Boolean(r.is_active),
    therapistIds: byService.get(r.id as string) ?? [],
    updatedAt: (r.updated_at as string) ?? null,
  }));
}

export const listAdminServices = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminServiceRow[]> => {
    const bag = await requireAdmin();
    try {
      return await loadAdminServices(bag);
    } finally {
      bag.commitCookies();
    }
  },
);

const servicePayloadSchema = z.object({
  code: codeSchema,
  slug: slugSchema,
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  durationMinutes: z.number().int().positive().max(600),
  sessionsPerPackage: z.number().int().positive().max(50).default(1),
  priceNgn: z.number().int().nonnegative().max(100_000_000).nullable().optional(),
  inPersonPriceNgn: z.number().int().nonnegative().max(100_000_000).nullable().optional(),
  currency: currencySchema.default("NGN"),
  bufferBeforeMinutes: z.number().int().nonnegative().max(240).default(0),
  bufferAfterMinutes: z.number().int().nonnegative().max(240).default(0),
  minimumLeadTimeMinutes: z.number().int().nonnegative().max(10_080).default(0),
  displayOrder: z.number().int().nonnegative().max(999).default(0),
  isActive: z.boolean().default(true),
  therapistIds: z.array(z.string().uuid()).max(200).default([]),
});

function servicePatch(
  input: z.infer<typeof servicePayloadSchema>,
  options: { includeInPersonPrice?: boolean } = {},
) {
  const patch: Database["public"]["Tables"]["services"]["Insert"] = {
    code: input.code,
    slug: input.slug,
    name: input.name,
    description: input.description?.trim() ? input.description.trim() : null,
    duration_minutes: input.durationMinutes,
    sessions_per_package: input.sessionsPerPackage,
    price_ngn: input.priceNgn ?? null,
    currency: input.currency,
    buffer_before_minutes: input.bufferBeforeMinutes,
    buffer_after_minutes: input.bufferAfterMinutes,
    minimum_lead_time_minutes: input.minimumLeadTimeMinutes,
    display_order: input.displayOrder,
    is_active: input.isActive,
  };
  if (options.includeInPersonPrice !== false) {
    patch.in_person_price_ngn = input.inPersonPriceNgn ?? null;
  }
  return patch;
}

async function getTrustedServiceWriteClient(bag: Awaited<ReturnType<typeof requireAdmin>>) {
  if (process.env["SUPABASE_URL"] && process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return supabaseAdmin;
  }
  return bag.client;
}

async function syncTherapistAssignments(
  client: Awaited<ReturnType<typeof getTrustedServiceWriteClient>>,
  serviceId: string,
  therapistIds: string[],
) {
  const desired = new Set(therapistIds);
  const { data: existing, error: exErr } = await client
    .from("therapist_services")
    .select("therapist_id")
    .eq("service_id", serviceId);
  if (exErr) throw exErr;
  const current = new Set((existing ?? []).map((r) => r.therapist_id as string));
  const toAdd = [...desired].filter((id) => !current.has(id));
  const toRemove = [...current].filter((id) => !desired.has(id));
  if (toAdd.length > 0) {
    const { error } = await client
      .from("therapist_services")
      .insert(toAdd.map((tid) => ({ service_id: serviceId, therapist_id: tid })));
    if (error) throw error;
  }
  if (toRemove.length > 0) {
    const { error } = await client
      .from("therapist_services")
      .delete()
      .eq("service_id", serviceId)
      .in("therapist_id", toRemove);
    if (error) throw error;
  }
}

export const createService = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => servicePayloadSchema.parse(data))
  .handler(async ({ data }): Promise<{ ok: true; id: string }> => {
    const bag = await requireAdmin();
    const writeClient = await getTrustedServiceWriteClient(bag);
    let insertResult = await writeClient
      .from("services")
      .insert(servicePatch(data))
      .select("id")
      .single();
    if (isMissingInPersonPriceColumn(insertResult.error)) {
      insertResult = await writeClient
        .from("services")
        .insert(servicePatch(data, { includeInPersonPrice: false }))
        .select("id")
        .single();
    }
    const { data: row, error } = insertResult;
    if (error) {
      bag.commitCookies();
      throw error;
    }
    try {
      await syncTherapistAssignments(writeClient, row.id as string, data.therapistIds);
    } finally {
      bag.commitCookies();
    }
    return { ok: true, id: row.id as string };
  });

export const updateService = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    servicePayloadSchema.extend({ id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const bag = await requireAdmin();
    const writeClient = await getTrustedServiceWriteClient(bag);
    const { id, therapistIds, ...rest } = data;
    let updateResult = await writeClient
      .from("services")
      .update(servicePatch({ ...rest, therapistIds }))
      .eq("id", id);
    if (isMissingInPersonPriceColumn(updateResult.error)) {
      updateResult = await writeClient
        .from("services")
        .update(servicePatch({ ...rest, therapistIds }, { includeInPersonPrice: false }))
        .eq("id", id);
    }
    const { error } = updateResult;
    if (error) {
      bag.commitCookies();
      throw error;
    }
    try {
      await syncTherapistAssignments(writeClient, id, therapistIds);
    } finally {
      bag.commitCookies();
    }
    return { ok: true };
  });

export const setServiceActive = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), isActive: z.boolean() }).parse(data),
  )
  .handler(async ({ data }) => {
    const bag = await requireAdmin();
    const writeClient = await getTrustedServiceWriteClient(bag);
    const { error } = await writeClient
      .from("services")
      .update({ is_active: data.isActive })
      .eq("id", data.id);
    bag.commitCookies();
    if (error) throw error;
    return { ok: true };
  });

export const deleteService = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const bag = await requireAdmin();
    const writeClient = await getTrustedServiceWriteClient(bag);
    const { error } = await writeClient.from("services").delete().eq("id", data.id);
    bag.commitCookies();
    if (error) {
      // Foreign-key protection: soft-deactivate instead.
      const msg = error.message.toLowerCase();
      if (msg.includes("foreign key") || msg.includes("violates")) {
        throw new Error(
          "This service has appointments or assignments and cannot be deleted. Deactivate it instead.",
        );
      }
      throw error;
    }
    return { ok: true };
  });

// ============================================================================
// Therapist profile editing
// ============================================================================

const sessionModeSchema = z.enum(["online", "in_person", "phone"]);

export const updateTherapist = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        fullName: z.string().trim().min(1).max(200).optional(),
        slug: z
          .string()
          .trim()
          .min(2)
          .max(80)
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens only.")
          .optional(),
        roleTitle: z.string().trim().min(1).max(200).optional(),
        credentials: z.string().trim().max(200).nullable().optional(),
        location: z.string().trim().max(200).nullable().optional(),
        bio: z.string().trim().max(4000).nullable().optional(),
        imageUrl: z.string().trim().max(1000).nullable().optional(),
        specialties: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
        modalities: z.array(sessionModeSchema).max(10).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<AdminTherapistRow> => {
    const bag = await requireAdmin();
    const patch: Record<string, unknown> = {};
    if (data.fullName !== undefined) patch.full_name = data.fullName;
    if (data.roleTitle !== undefined) patch.role_title = data.roleTitle;
    if (data.credentials !== undefined)
      patch.credentials = data.credentials?.trim() ? data.credentials : null;
    if (data.location !== undefined) patch.location = data.location?.trim() ? data.location : null;
    if (data.bio !== undefined) patch.bio = data.bio?.trim() ? data.bio : null;
    if (data.imageUrl !== undefined) patch.image_url = data.imageUrl?.trim() ? data.imageUrl : null;
    if (data.specialties !== undefined) patch.specialties = Array.from(new Set(data.specialties));
    if (data.modalities !== undefined) patch.modalities = Array.from(new Set(data.modalities));
    if (data.slug !== undefined) {
      const { data: clash } = await bag.client
        .from("therapists")
        .select("id")
        .eq("slug", data.slug)
        .neq("id", data.id)
        .maybeSingle();
      if (clash) {
        bag.commitCookies();
        throw new Error("That public link is already used by another therapist.");
      }
      patch.slug = data.slug;
    }
    const { data: row, error } = await bag.client
      .from("therapists")
      .update(patch)
      .eq("id", data.id)
      .select(THERAPIST_COLUMNS)
      .single();
    bag.commitCookies();
    if (error) throw error;
    return mapTherapist(row as Record<string, unknown>);
  });

export const createTherapist = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        fullName: z.string().trim().min(1).max(200),
        roleTitle: z.string().trim().max(200).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<AdminTherapistRow> => {
    const bag = await requireAdmin();
    const base =
      data.fullName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 60) || "therapist";

    const { data: existing } = await bag.client.from("therapists").select("slug, display_order");
    const slugs = new Set((existing ?? []).map((r) => (r as { slug: string }).slug));
    let slug = base;
    let suffix = 2;
    while (slugs.has(slug)) slug = `${base}-${suffix++}`;
    const nextOrder =
      Math.max(
        0,
        ...(existing ?? []).map((r) => Number((r as { display_order: number }).display_order) || 0),
      ) + 1;

    const { data: row, error } = await bag.client
      .from("therapists")
      .insert({
        full_name: data.fullName,
        slug,
        role_title: data.roleTitle?.trim() || "Therapist",
        is_active: false,
        display_order: nextOrder,
        specialties: [],
        modalities: ["online"],
      })
      .select(THERAPIST_COLUMNS)
      .single();
    bag.commitCookies();
    if (error) throw error;
    return mapTherapist(row as Record<string, unknown>);
  });

// ============================================================================
// Draft / preview / publish / archive workflow
// ============================================================================

export const scheduleContentPublish = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        scheduledPublishAt: z.string().datetime().nullable(),
        scheduledUnpublishAt: z.string().datetime().nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const bag = await requireAdmin();
    // Scheduling means: keep it draft until the cron flips it at the scheduled time.
    const patch: Record<string, unknown> = {
      scheduled_publish_at: data.scheduledPublishAt,
    };
    if (data.scheduledUnpublishAt !== undefined) {
      patch.scheduled_unpublish_at = data.scheduledUnpublishAt;
    }
    if (data.scheduledPublishAt) {
      const when = new Date(data.scheduledPublishAt);
      if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
        bag.commitCookies();
        throw new Error("Scheduled time must be in the future.");
      }
      patch.source_status = "draft";
      patch.archived_at = null;
      patch.archived_by = null;
    }
    if (data.scheduledUnpublishAt) {
      const until = new Date(data.scheduledUnpublishAt);
      if (Number.isNaN(until.getTime()) || until.getTime() <= Date.now()) {
        bag.commitCookies();
        throw new Error("Unpublish time must be in the future.");
      }
      if (data.scheduledPublishAt && until <= new Date(data.scheduledPublishAt)) {
        bag.commitCookies();
        throw new Error("Unpublish time must be after the publish time.");
      }
    }
    const { error } = await bag.client.from("content_entries").update(patch).eq("id", data.id);
    bag.commitCookies();
    if (error) throw error;
    clearPublicContentEntryCache();
    return { ok: true };
  });

export const setContentArchived = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), archived: z.boolean() }).parse(data),
  )
  .handler(async ({ data }) => {
    const bag = await requireAdmin();
    const {
      data: { user },
    } = await bag.client.auth.getUser();
    const patch: Record<string, unknown> = data.archived
      ? {
          archived_at: new Date().toISOString(),
          archived_by: user?.id ?? null,
          scheduled_publish_at: null,
          scheduled_unpublish_at: null,
        }
      : { archived_at: null, archived_by: null };
    const { error } = await bag.client.from("content_entries").update(patch).eq("id", data.id);
    bag.commitCookies();
    if (error) throw error;
    clearPublicContentEntryCache();
    return { ok: true };
  });

export const runScheduledPublish = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ ok: true; count: number }> => {
    const bag = await requireAdmin();
    const { data, error } = await bag.client.rpc("publish_scheduled_content");
    bag.commitCookies();
    if (error) throw error;
    clearPublicContentEntryCache();
    return { ok: true, count: Number(data ?? 0) };
  },
);

// ============================================================================
// CMS — testimonials
// ============================================================================

export type AdminTestimonialRow = {
  id: string;
  authorName: string;
  authorRole: string | null;
  quote: string;
  rating: number | null;
  avatarUrl: string | null;
  isPublished: boolean;
  displayOrder: number;
  updatedAt: string | null;
};

function mapTestimonial(r: Record<string, unknown>): AdminTestimonialRow {
  return {
    id: r.id as string,
    authorName: (r.author_name as string) ?? "",
    authorRole: (r.author_role as string) ?? null,
    quote: (r.quote as string) ?? "",
    rating: r.rating == null ? null : Number(r.rating),
    avatarUrl: (r.avatar_url as string) ?? null,
    isPublished: Boolean(r.is_published),
    displayOrder: Number(r.display_order ?? 0),
    updatedAt: (r.updated_at as string) ?? null,
  };
}

const TESTIMONIAL_COLS =
  "id, author_name, author_role, quote, rating, avatar_url, is_published, display_order, updated_at";

export const listAdminTestimonials = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminTestimonialRow[]> => {
    const bag = await requireAdmin();
    const { data, error } = await bag.client
      .from("testimonials")
      .select(TESTIMONIAL_COLS)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false });
    bag.commitCookies();
    if (error) throw error;
    return (data ?? []).map((r) => mapTestimonial(r as Record<string, unknown>));
  },
);

const testimonialInputSchema = z.object({
  authorName: z.string().min(1).max(160),
  authorRole: z.string().max(200).nullable().optional(),
  quote: z.string().min(1).max(4000),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  avatarUrl: z.string().url().max(1000).nullable().optional().or(z.literal("")),
  isPublished: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
});

export const createTestimonial = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => testimonialInputSchema.parse(d))
  .handler(async ({ data }): Promise<AdminTestimonialRow> => {
    const bag = await requireAdmin();
    const { data: row, error } = await bag.client
      .from("testimonials")
      .insert({
        author_name: data.authorName.trim(),
        author_role: data.authorRole?.trim() || null,
        quote: data.quote.trim(),
        rating: data.rating ?? null,
        avatar_url: data.avatarUrl || null,
        is_published: data.isPublished ?? false,
        display_order: data.displayOrder ?? 0,
      })
      .select(TESTIMONIAL_COLS)
      .single();
    bag.commitCookies();
    if (error) throw error;
    return mapTestimonial(row as Record<string, unknown>);
  });

export const updateTestimonial = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    testimonialInputSchema.partial().extend({ id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }): Promise<AdminTestimonialRow> => {
    const bag = await requireAdmin();
    const patch: Record<string, unknown> = {};
    if (data.authorName !== undefined) patch.author_name = data.authorName.trim();
    if (data.authorRole !== undefined) patch.author_role = data.authorRole?.trim() || null;
    if (data.quote !== undefined) patch.quote = data.quote.trim();
    if (data.rating !== undefined) patch.rating = data.rating;
    if (data.avatarUrl !== undefined) patch.avatar_url = data.avatarUrl || null;
    if (data.isPublished !== undefined) patch.is_published = data.isPublished;
    if (data.displayOrder !== undefined) patch.display_order = data.displayOrder;
    const { data: row, error } = await bag.client
      .from("testimonials")
      .update(patch)
      .eq("id", data.id)
      .select(TESTIMONIAL_COLS)
      .single();
    bag.commitCookies();
    if (error) throw error;
    return mapTestimonial(row as Record<string, unknown>);
  });

export const deleteTestimonial = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const bag = await requireAdmin();
    const { error } = await bag.client.from("testimonials").delete().eq("id", data.id);
    bag.commitCookies();
    if (error) throw error;
    return { ok: true };
  });

export const reorderTestimonials = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        items: z.array(z.object({ id: z.string().uuid(), displayOrder: z.number().int() })),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const bag = await requireAdmin();
    for (const item of data.items) {
      const { error } = await bag.client
        .from("testimonials")
        .update({ display_order: item.displayOrder })
        .eq("id", item.id);
      if (error) {
        bag.commitCookies();
        throw error;
      }
    }
    bag.commitCookies();
    return { ok: true };
  });

// ============================================================================
// CMS — FAQs
// ============================================================================

export type AdminFaqRow = {
  id: string;
  category: string;
  question: string;
  answer: string;
  isPublished: boolean;
  displayOrder: number;
  updatedAt: string | null;
};

function mapFaq(r: Record<string, unknown>): AdminFaqRow {
  return {
    id: r.id as string,
    category: (r.category as string) ?? "General",
    question: (r.question as string) ?? "",
    answer: (r.answer as string) ?? "",
    isPublished: Boolean(r.is_published),
    displayOrder: Number(r.display_order ?? 0),
    updatedAt: (r.updated_at as string) ?? null,
  };
}

const FAQ_COLS = "id, category, question, answer, is_published, display_order, updated_at";

export const listAdminFaqs = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminFaqRow[]> => {
    const bag = await requireAdmin();
    const { data, error } = await bag.client
      .from("faqs")
      .select(FAQ_COLS)
      .order("category", { ascending: true })
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });
    bag.commitCookies();
    if (error) throw error;
    return (data ?? []).map((r) => mapFaq(r as Record<string, unknown>));
  },
);

const faqInputSchema = z.object({
  category: z.string().min(1).max(120),
  question: z.string().min(1).max(500),
  answer: z.string().min(1).max(8000),
  isPublished: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
});

export const createFaq = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => faqInputSchema.parse(d))
  .handler(async ({ data }): Promise<AdminFaqRow> => {
    const bag = await requireAdmin();
    const { data: row, error } = await bag.client
      .from("faqs")
      .insert({
        category: data.category.trim(),
        question: data.question.trim(),
        answer: data.answer.trim(),
        is_published: data.isPublished ?? true,
        display_order: data.displayOrder ?? 0,
      })
      .select(FAQ_COLS)
      .single();
    bag.commitCookies();
    if (error) throw error;
    return mapFaq(row as Record<string, unknown>);
  });

export const updateFaq = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    faqInputSchema.partial().extend({ id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }): Promise<AdminFaqRow> => {
    const bag = await requireAdmin();
    const patch: Record<string, unknown> = {};
    if (data.category !== undefined) patch.category = data.category.trim();
    if (data.question !== undefined) patch.question = data.question.trim();
    if (data.answer !== undefined) patch.answer = data.answer.trim();
    if (data.isPublished !== undefined) patch.is_published = data.isPublished;
    if (data.displayOrder !== undefined) patch.display_order = data.displayOrder;
    const { data: row, error } = await bag.client
      .from("faqs")
      .update(patch)
      .eq("id", data.id)
      .select(FAQ_COLS)
      .single();
    bag.commitCookies();
    if (error) throw error;
    return mapFaq(row as Record<string, unknown>);
  });

export const deleteFaq = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const bag = await requireAdmin();
    const { error } = await bag.client.from("faqs").delete().eq("id", data.id);
    bag.commitCookies();
    if (error) throw error;
    return { ok: true };
  });

export const reorderFaqs = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        items: z.array(z.object({ id: z.string().uuid(), displayOrder: z.number().int() })),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const bag = await requireAdmin();
    for (const item of data.items) {
      const { error } = await bag.client
        .from("faqs")
        .update({ display_order: item.displayOrder })
        .eq("id", item.id);
      if (error) {
        bag.commitCookies();
        throw error;
      }
    }
    bag.commitCookies();
    return { ok: true };
  });

// ============================================================================
// Revisions — shared history for FAQs and testimonials
// ============================================================================

export type ContentRevisionEntity = "faq" | "testimonial" | "content_entry";

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type ContentRevisionRow = {
  id: string;
  entityType: ContentRevisionEntity;
  entityId: string;
  changeType: "create" | "update" | "delete";
  snapshot: { [key: string]: JsonValue };
  changedByEmail: string | null;
  createdAt: string;
};

function mapRevision(r: Record<string, unknown>): ContentRevisionRow {
  return {
    id: r.id as string,
    entityType: r.entity_type as ContentRevisionEntity,
    entityId: r.entity_id as string,
    changeType: r.change_type as ContentRevisionRow["changeType"],
    snapshot: (r.snapshot as { [key: string]: JsonValue }) ?? {},
    changedByEmail: (r.changed_by_email as string) ?? null,
    createdAt: r.created_at as string,
  };
}

export const listContentRevisions = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({
        entityType: z.enum(["faq", "testimonial", "content_entry"]),
        entityId: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<ContentRevisionRow[]> => {
    const bag = await requireAdmin();
    const { data: rows, error } = await bag.client
      .from("content_revisions")
      .select("id, entity_type, entity_id, change_type, snapshot, changed_by_email, created_at")
      .eq("entity_type", data.entityType)
      .eq("entity_id", data.entityId)
      .order("created_at", { ascending: false })
      .limit(100);
    bag.commitCookies();
    if (error) throw error;
    return (rows ?? []).map((r) => mapRevision(r as Record<string, unknown>));
  });

export const restoreContentRevision = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ revisionId: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const bag = await requireAdmin();
    const { error } = await bag.client.rpc("restore_content_revision", {
      p_revision_id: data.revisionId,
    });
    bag.commitCookies();
    if (error) throw error;
    return { ok: true };
  });

// ============================================================================
// Redirects
// ============================================================================

export type RedirectRow = {
  id: string;
  fromPath: string;
  toPath: string;
  statusCode: number;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

function mapRedirect(r: Record<string, unknown>): RedirectRow {
  return {
    id: r.id as string,
    fromPath: r.from_path as string,
    toPath: r.to_path as string,
    statusCode: r.status_code as number,
    isActive: r.is_active as boolean,
    notes: (r.notes as string) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function normalizeFromPath(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "/";
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const stripped = withSlash.replace(/\/+$/, "");
  return (stripped || "/").toLowerCase();
}

export const listRedirects = createServerFn({ method: "GET" }).handler(
  async (): Promise<RedirectRow[]> => {
    const bag = await requireAdmin();
    const { data, error } = await bag.client
      .from("redirects" as never)
      .select("id, from_path, to_path, status_code, is_active, notes, created_at, updated_at")
      .order("from_path", { ascending: true });
    bag.commitCookies();
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map(mapRedirect);
  },
);

export const upsertRedirect = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        fromPath: z.string().min(1),
        toPath: z.string().min(1),
        statusCode: z
          .union([z.literal(301), z.literal(302), z.literal(307), z.literal(308)])
          .default(301),
        isActive: z.boolean().default(true),
        notes: z.string().max(500).nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<RedirectRow> => {
    const bag = await requireAdmin();
    const payload = {
      from_path: normalizeFromPath(data.fromPath),
      to_path: data.toPath.trim(),
      status_code: data.statusCode,
      is_active: data.isActive,
      notes: data.notes?.trim() || null,
    };
    const query = data.id
      ? bag.client
          .from("redirects" as never)
          .update(payload)
          .eq("id", data.id)
          .select("*")
          .single()
      : bag.client
          .from("redirects" as never)
          .insert(payload)
          .select("*")
          .single();
    const { data: row, error } = await query;
    bag.commitCookies();
    if (error) throw error;
    return mapRedirect(row as Record<string, unknown>);
  });

export const deleteRedirect = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const bag = await requireAdmin();
    const { error } = await bag.client
      .from("redirects" as never)
      .delete()
      .eq("id", data.id);
    bag.commitCookies();
    if (error) throw error;
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Public page CMS                                                     */
/* ------------------------------------------------------------------ */

const PUBLIC_PAGE_SELECT =
  "id, kind, slug, title, source_status, published_at, source_modified_at, author_name, canonical_path, featured_media_path, excerpt_html, body_html, metadata, scheduled_publish_at, scheduled_unpublish_at, archived_at";

export type PublicPageSummary = {
  key: PublicPageKey;
  label: string;
  route: string;
  slug: string;
  id: string | null;
  title: string;
  status: string;
  updatedAt: string | null;
  hasBody: boolean;
};

export const listPublicPageEntries = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicPageSummary[]> => {
    const bag = await requireAdmin();
    const slugs = PUBLIC_PAGE_CONFIG.map((page) => page.contentSlug);
    const { data, error } = await bag.client
      .from("content_entries")
      .select("id, slug, title, source_status, source_modified_at, body_html")
      .eq("kind", "page")
      .in("slug", slugs);
    bag.commitCookies();
    if (error) throw error;
    const bySlug = new Map(
      (data ?? []).map((row) => [row.slug as string, row as Record<string, unknown>]),
    );
    return PUBLIC_PAGE_CONFIG.map((page) => {
      const row = bySlug.get(page.contentSlug) ?? null;
      return {
        key: page.key,
        label: page.label,
        route: page.route,
        slug: page.contentSlug,
        id: row ? (row.id as string) : null,
        title: row ? ((row.title as string) ?? page.label) : page.label,
        status: row ? ((row.source_status as string) ?? "draft") : "missing",
        updatedAt: row ? ((row.source_modified_at as string) ?? null) : null,
        hasBody: Boolean(row && String(row.body_html ?? "").trim()),
      } satisfies PublicPageSummary;
    });
  },
);

export const ensurePublicPageEntry = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ key: z.string().trim().min(1).max(120) }).parse(d))
  .handler(async ({ data }): Promise<AdminContentDetail> => {
    const page = PUBLIC_PAGE_CONFIG.find((candidate) => candidate.key === data.key);
    if (!page) throw new Error("Unknown public page.");
    const bag = await requireAdmin();

    const load = async () => {
      const { data: row, error } = await bag.client
        .from("content_entries")
        .select(PUBLIC_PAGE_SELECT)
        .eq("kind", "page")
        .eq("slug", page.contentSlug)
        .maybeSingle();
      if (error) throw error;
      return mapAdminContentDetail(row as Record<string, unknown> | null);
    };

    let detail = await load();
    if (!detail) {
      const { error } = await bag.client.from("content_entries").insert({
        kind: "page",
        source_id: Date.now(),
        slug: page.contentSlug,
        canonical_path: page.route,
        title: page.label,
        source_status: "draft",
        imported_at: new Date().toISOString(),
        source_modified_at: new Date().toISOString(),
      });
      // Ignore unique-violation races; re-read below either way.
      if (error && error.code !== "23505") {
        bag.commitCookies();
        throw error;
      }
      detail = await load();
    }

    if (detail && detail.canonicalPath !== page.route) {
      await bag.client
        .from("content_entries")
        .update({ canonical_path: page.route })
        .eq("id", detail.id);
      detail = { ...detail, canonicalPath: page.route };
    }

    bag.commitCookies();
    if (!detail) throw new Error("Could not prepare this public page.");
    return detail;
  });

/* ------------------------------------------------------------------ */
/* Draft preview                                                       */
/* ------------------------------------------------------------------ */

export type ContentEntryPreview = {
  entry: RenderedContentEntry;
  status: string;
  isDraft: boolean;
  publicRoute: string | null;
  label: string;
  updatedAt: string | null;
};

export const getContentEntryPreview = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({
        kind: z.enum(["page", "post"]).default("page"),
        slug: z.string().trim().min(1).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<ContentEntryPreview | null> => {
    const bag = await requireAdmin();
    const [{ data: row, error }, { data: categoryRows }] = await Promise.all([
      bag.client
        .from("content_entries")
        .select(
          "id, kind, slug, title, excerpt_html, body_html, author_name, published_at, featured_media_path, metadata, source_status, source_modified_at, canonical_path",
        )
        .eq("kind", data.kind)
        .eq("slug", data.slug)
        .is("archived_at", null)
        .maybeSingle(),
      bag.client
        .from("content_entries")
        .select("source_id, title")
        .eq("kind", "category")
        .is("archived_at", null),
    ]);
    bag.commitCookies();
    if (error) throw error;
    if (!row) return null;

    const categories = new Map<number, string>(
      (categoryRows ?? []).map((category) => [
        category.source_id as number,
        category.title as string,
      ]),
    );
    const record = row as Record<string, unknown>;
    const entry = renderContentEntry(
      record as never,
      categories,
      process.env["SUPABASE_URL"] ?? "",
    );

    const pageConfig = PUBLIC_PAGE_CONFIG.find((page) => page.contentSlug === data.slug);
    const publicRoute =
      data.kind === "post"
        ? `/blog/${data.slug}`
        : (pageConfig?.route ?? (record.canonical_path as string | null) ?? null);

    return {
      entry,
      status: (record.source_status as string) ?? "draft",
      isDraft: (record.source_status as string) !== "publish",
      publicRoute,
      label: pageConfig?.label ?? (data.kind === "post" ? "Journal" : "Page"),
      updatedAt: (record.source_modified_at as string) ?? null,
    };
  });

/* ------------------------------------------------------------------ */
/* SEO fields                                                          */
/* ------------------------------------------------------------------ */

export type ContentSeoFields = {
  metaTitle: string;
  metaDescription: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  noindex: boolean;
};

export function readContentSeoFields(metadata: Record<string, Json>): ContentSeoFields {
  const raw =
    metadata.seo && typeof metadata.seo === "object" && !Array.isArray(metadata.seo)
      ? (metadata.seo as Record<string, Json>)
      : {};
  const text = (key: string) => (typeof raw[key] === "string" ? (raw[key] as string) : "");
  return {
    metaTitle: text("metaTitle"),
    metaDescription: text("metaDescription"),
    ogTitle: text("ogTitle"),
    ogDescription: text("ogDescription"),
    ogImage: text("ogImage"),
    noindex: raw.noindex === true,
  };
}

const seoSchema = z.object({
  id: z.string().uuid(),
  metaTitle: z.string().trim().max(120).default(""),
  metaDescription: z.string().trim().max(320).default(""),
  ogTitle: z.string().trim().max(120).default(""),
  ogDescription: z.string().trim().max(320).default(""),
  ogImage: z.string().trim().max(1000).default(""),
  noindex: z.boolean().default(false),
});

export const updateContentSeo = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => seoSchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const bag = await requireAdmin();
    const { data: row, error: readError } = await bag.client
      .from("content_entries")
      .select("metadata")
      .eq("id", data.id)
      .maybeSingle();
    if (readError) {
      bag.commitCookies();
      throw readError;
    }
    const metadata =
      row?.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? { ...(row.metadata as Record<string, Json>) }
        : {};

    const seo: Record<string, Json> = {};
    if (data.metaTitle) seo.metaTitle = data.metaTitle;
    if (data.metaDescription) seo.metaDescription = data.metaDescription;
    if (data.ogTitle) seo.ogTitle = data.ogTitle;
    if (data.ogDescription) seo.ogDescription = data.ogDescription;
    if (data.ogImage) seo.ogImage = data.ogImage;
    if (data.noindex) seo.noindex = true;

    if (Object.keys(seo).length > 0) {
      metadata.seo = seo;
    } else {
      delete metadata.seo;
    }

    const { error } = await bag.client
      .from("content_entries")
      .update({ metadata: metadata as never, source_modified_at: new Date().toISOString() })
      .eq("id", data.id);
    bag.commitCookies();
    if (error) throw error;
    clearPublicContentEntryCache();
    return { ok: true };
  });

// ============================================================================
// CMS — visual page builder sections
// ============================================================================

/** One recorded admin action on a page section (add, reorder, delete, …). */
const sectionAuditOpSchema = z.object({
  op: z.enum([
    "add",
    "reorder",
    "duplicate",
    "paste",
    "hide",
    "show",
    "delete",
    "settings",
    "text",
  ]),
  reason: z.string().trim().min(1).max(300),
  fields: z.array(z.string().trim().max(200)).max(50).default([]),
});

export type SectionAuditOpInput = z.infer<typeof sectionAuditOpSchema>;

/**
 * Save builder sections. `mode: "draft"` stores them as unpublished changes
 * (`metadata.sectionsDraft`) so the live page is untouched; `mode: "publish"`
 * promotes them to the live layout and clears the draft. Every write is
 * captured by the content revision trigger, so any state can be rolled back.
 *
 * `ops` carries the per-section actions performed since the last save; they are
 * written to the admin activity log so the who/what/when of every add, reorder,
 * duplicate, hide, delete, and setting change is auditable.
 */
export const updateContentSections = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        sections: sectionsSchema,
        mode: z.enum(["draft", "publish"]).default("publish"),
        ops: z.array(sectionAuditOpSchema).max(200).default([]),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const bag = await requireAdmin();
    const { data: row, error: readError } = await bag.client
      .from("content_entries")
      .select("metadata")
      .eq("id", data.id)
      .maybeSingle();
    if (readError) {
      bag.commitCookies();
      throw readError;
    }
    const metadata =
      row?.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? { ...(row.metadata as Record<string, Json>) }
        : {};

    if (data.mode === "draft") {
      metadata.sectionsDraft = data.sections as unknown as Json;
    } else {
      delete metadata.sectionsDraft;
      if (data.sections.length > 0) {
        metadata.sections = data.sections as unknown as Json;
      } else {
        delete metadata.sections;
      }
    }

    const { error } = await bag.client
      .from("content_entries")
      .update({ metadata: metadata as never, source_modified_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) {
      bag.commitCookies();
      throw error;
    }

    // Audit trail. Never let a logging failure fail the save itself.
    if (data.ops.length > 0) {
      const suffix = data.mode === "publish" ? " (published)" : " (draft)";
      const rpc = bag.client.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ error: { message: string } | null }>;
      try {
        await rpc("log_section_audit", {
          p_entry_id: data.id,
          p_ops: data.ops.map((op) => ({ ...op, reason: `${op.reason}${suffix}` })),
        });
      } catch {
        // ignore — the layout change already persisted
      }
    }

    clearPublicContentEntryCache();
    bag.commitCookies();
    return { ok: true };
  });

/** Throw away unpublished section changes and keep the live layout. */
export const discardContentSectionsDraft = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const bag = await requireAdmin();
    const { data: row, error: readError } = await bag.client
      .from("content_entries")
      .select("metadata")
      .eq("id", data.id)
      .maybeSingle();
    if (readError) {
      bag.commitCookies();
      throw readError;
    }
    const metadata =
      row?.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? { ...(row.metadata as Record<string, Json>) }
        : {};
    delete metadata.sectionsDraft;

    const { error } = await bag.client
      .from("content_entries")
      .update({ metadata: metadata as never })
      .eq("id", data.id);
    bag.commitCookies();
    if (error) throw error;
    clearPublicContentEntryCache();
    return { ok: true };
  });

// ============================================================================
// CMS permissions
// ============================================================================

export type CmsPermissions = {
  signedIn: boolean;
  isAdmin: boolean;
  canEdit: boolean;
  canPublish: boolean;
};

/**
 * Non-throwing permission probe for CMS surfaces. The write paths themselves
 * (and RLS on content_entries) still enforce admin — this only drives the UI.
 */
export const getCmsPermissions = createServerFn({ method: "GET" }).handler(
  async (): Promise<CmsPermissions> => {
    const denied: CmsPermissions = {
      signedIn: false,
      isAdmin: false,
      canEdit: false,
      canPublish: false,
    };
    try {
      const bag = getConfiguredClient();
      const {
        data: { user },
      } = await bag.client.auth.getUser();
      if (!user) {
        bag.commitCookies();
        return denied;
      }
      const { data: isAdmin, error } = await bag.client.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      bag.commitCookies();
      const admin = !error && isAdmin === true;
      return { signedIn: true, isAdmin: admin, canEdit: admin, canPublish: admin };
    } catch {
      return denied;
    }
  },
);
