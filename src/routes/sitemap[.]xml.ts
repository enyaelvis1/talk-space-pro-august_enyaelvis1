import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { getPublishedPages, getPublishedPosts } from "@/lib/content.functions";
import { SITE_URL } from "@/lib/seo";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const [posts, pages] = await Promise.all([getPublishedPosts(), getPublishedPages()]);
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/services", changefreq: "monthly", priority: "0.9" },
          { path: "/therapists", changefreq: "monthly", priority: "0.9" },
          { path: "/pricing", changefreq: "monthly", priority: "0.9" },
          { path: "/book", changefreq: "monthly", priority: "0.9" },
          { path: "/about", changefreq: "monthly", priority: "0.7" },
          { path: "/blog", changefreq: "weekly", priority: "0.7" },
          { path: "/contact", changefreq: "monthly", priority: "0.7" },
          { path: "/faqs", changefreq: "monthly", priority: "0.6" },
          { path: "/emergency-support", changefreq: "monthly", priority: "0.8" },
          { path: "/privacy-policy", changefreq: "yearly", priority: "0.3" },
          { path: "/terms", changefreq: "yearly", priority: "0.3" },
          { path: "/cancellation-refund-policy", changefreq: "yearly", priority: "0.3" },
          ...posts.map((post) => ({
            path: `/blog/${post.slug}`,
            changefreq: "monthly" as const,
            priority: "0.6",
          })),
          ...pages.map((page) => ({
            path: `/content/pages/${page.slug}`,
            changefreq: "yearly" as const,
            priority: "0.4",
          })),
        ];

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${SITE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
