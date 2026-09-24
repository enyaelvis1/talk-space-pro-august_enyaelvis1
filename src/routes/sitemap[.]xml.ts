import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";

import { getPublishedPages, getPublishedPosts } from "@/lib/content.functions";
import { PUBLIC_PAGE_CONFIG } from "@/lib/public-pages";
import { SITE_URL } from "@/lib/seo";
import { buildSitemapXml, type SitemapEntry } from "@/lib/sitemap";

type PublicSitemapEntry = SitemapEntry & { contentSlug?: string };

const PUBLIC_SITEMAP_ENTRIES: readonly PublicSitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/services", contentSlug: "services", changefreq: "monthly", priority: "0.9" },
  { path: "/therapists", contentSlug: "therapists", changefreq: "monthly", priority: "0.9" },
  { path: "/pricing", contentSlug: "pricing", changefreq: "monthly", priority: "0.9" },
  { path: "/book", changefreq: "monthly", priority: "0.9" },
  { path: "/about", contentSlug: "about", changefreq: "monthly", priority: "0.7" },
  { path: "/blog", changefreq: "weekly", priority: "0.7" },
  { path: "/contact", contentSlug: "contact", changefreq: "monthly", priority: "0.7" },
  { path: "/faqs", contentSlug: "faqs", changefreq: "monthly", priority: "0.6" },
  {
    path: "/emergency-support",
    contentSlug: "emergency-support",
    changefreq: "monthly",
    priority: "0.8",
  },
  { path: "/privacy-policy", contentSlug: "privacy-policy", changefreq: "yearly", priority: "0.3" },
  { path: "/terms", contentSlug: "terms", changefreq: "yearly", priority: "0.3" },
  {
    path: "/cancellation-refund-policy",
    contentSlug: "cancellation-refund-policy",
    changefreq: "yearly",
    priority: "0.3",
  },
];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const [posts, pages] = await Promise.all([getPublishedPosts(), getPublishedPages()]);
        const publishedPages = new Map(pages.map((page) => [page.slug, page]));
        const configuredPageSlugs = new Set(PUBLIC_PAGE_CONFIG.map((page) => page.contentSlug));
        const staticEntries = PUBLIC_SITEMAP_ENTRIES.filter(
          (entry) => !entry.contentSlug || !publishedPages.get(entry.contentSlug)?.seo.noindex,
        ).map(({ contentSlug: _contentSlug, ...entry }) => entry);
        const entries: SitemapEntry[] = [
          ...staticEntries,
          ...posts
            .filter((post) => !post.seo.noindex)
            .map((post) => ({
              path: `/blog/${post.slug}`,
              changefreq: "monthly" as const,
              priority: "0.6",
            })),
          ...pages
            .filter((page) => !configuredPageSlugs.has(page.slug) && !page.seo.noindex)
            .map((page) => ({
              path: `/content/pages/${page.slug}`,
              changefreq: "yearly" as const,
              priority: "0.4",
            })),
        ];
        const xml = buildSitemapXml(SITE_URL, entries);
        setResponseHeader(
          "Cache-Control",
          "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
        );

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
          },
        });
      },
    },
  },
});
