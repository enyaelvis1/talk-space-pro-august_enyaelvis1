import { TS } from "@/lib/talkspace";

export const SITE_URL = "https://talkspace.ng";
export const OG_IMAGE_URL = `${SITE_URL}/og-image.jpg`;

export function canonicalUrl(path: string) {
  return new URL(path, SITE_URL).toString();
}

export const ORGANIZATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: TS.brandName,
  url: SITE_URL,
  logo: OG_IMAGE_URL,
  email: TS.email,
  telephone: TS.phone.ng,
  sameAs: Object.values(TS.socials),
};

export const LOCAL_BUSINESS_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": `${SITE_URL}/#localbusiness`,
  name: TS.brandName,
  url: canonicalUrl("/contact"),
  image: OG_IMAGE_URL,
  email: TS.email,
  telephone: TS.phone.ng,
  priceRange: "₦₦",
  areaServed: {
    "@type": "Country",
    name: "Nigeria",
  },
  location: TS.addresses.map((address) => ({
    "@type": "Place",
    name: `${TS.brandName} — ${address.city}`,
    address: {
      "@type": "PostalAddress",
      streetAddress: address.lines.join(", "),
      addressLocality: address.city,
      addressCountry: "NG",
    },
  })),
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "09:00",
      closes: "17:00",
    },
  ],
};

export function articleJsonLd(post: {
  title: string;
  seoDescription: string;
  author: string;
  date: string;
  slug: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.seoDescription,
    image: [OG_IMAGE_URL],
    datePublished: new Date(post.date).toISOString().slice(0, 10),
    author: {
      "@type": "Organization",
      name: post.author,
      url: SITE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: TS.brandName,
      url: SITE_URL,
      logo: { "@type": "ImageObject", url: OG_IMAGE_URL },
    },
    mainEntityOfPage: canonicalUrl(`/blog/${post.slug}`),
  };
}

export function faqPageJsonLd(groups: readonly { items: readonly { q: string; a: string }[] }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: groups.flatMap((group) =>
      group.items.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.a,
        },
      })),
    ),
  };
}

export type PageSeoInput = {
  path: string;
  title: string;
  description: string;
  ogTitle?: string;
  ogDescription?: string;
  ogType?: string;
  imageUrl?: string | null;
  entry?: {
    title?: string;
    excerpt?: string;
    imageUrl?: string | null;
    seo?: {
      metaTitle: string | null;
      metaDescription: string | null;
      ogTitle: string | null;
      ogDescription: string | null;
      ogImageUrl: string | null;
      noindex: boolean;
    };
  } | null;
};

/**
 * Builds head() meta/links for a public page, letting CMS-managed SEO fields
 * override the built-in defaults.
 */
export function pageSeoHead(input: PageSeoInput) {
  const seo = input.entry?.seo;
  const url = canonicalUrl(input.path);

  const title = seo?.metaTitle ?? input.title;
  const description = seo?.metaDescription ?? input.entry?.excerpt ?? input.description;
  const ogTitle = seo?.ogTitle ?? seo?.metaTitle ?? input.ogTitle ?? title;
  const ogDescription =
    seo?.ogDescription ?? seo?.metaDescription ?? input.ogDescription ?? description;
  const image = seo?.ogImageUrl ?? input.imageUrl ?? input.entry?.imageUrl ?? null;

  const meta: Array<Record<string, string>> = [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: ogTitle },
    { property: "og:description", content: ogDescription },
    { property: "og:type", content: input.ogType ?? "website" },
    { property: "og:url", content: url },
    { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
    { name: "twitter:title", content: ogTitle },
    { name: "twitter:description", content: ogDescription },
  ];
  if (image) {
    meta.push({ property: "og:image", content: image }, { name: "twitter:image", content: image });
  }
  if (seo?.noindex) {
    meta.push({ name: "robots", content: "noindex, nofollow" });
  }

  return { meta, links: [{ rel: "canonical", href: url }] };
}
