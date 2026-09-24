export type SitemapChangeFrequency =
  "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";

export type SitemapEntry = {
  path: string;
  changefreq?: SitemapChangeFrequency;
  priority?: string;
};

function escapeXml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[character] ?? character,
  );
}

export function buildSitemapXml(siteUrl: string, entries: readonly SitemapEntry[]) {
  const seen = new Set<string>();
  const urls = entries.flatMap((entry) => {
    const location = `${siteUrl.replace(/\/$/, "")}${entry.path}`;
    if (seen.has(location)) return [];
    seen.add(location);

    return [
      [
        "  <url>",
        `    <loc>${escapeXml(location)}</loc>`,
        entry.changefreq ? `    <changefreq>${entry.changefreq}</changefreq>` : null,
        entry.priority ? `    <priority>${entry.priority}</priority>` : null,
        "  </url>",
      ]
        .filter((line): line is string => line !== null)
        .join("\n"),
    ];
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
  ].join("\n");
}
