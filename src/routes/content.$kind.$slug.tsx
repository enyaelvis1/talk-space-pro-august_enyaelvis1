import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { ContentHtml } from "@/components/content/ContentHtml";
import { ContentBlocks } from "@/components/content/ContentBlocks";
import { ContentEntryPending } from "@/components/content/ContentSkeletons";
import { SiteBreadcrumbs } from "@/components/site/SiteBreadcrumbs";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { OptimizedImage } from "@/components/site/OptimizedImage";
import { getPublishedEntry } from "@/lib/content.functions";
import { canonicalUrl } from "@/lib/seo";

const kindByPath = {
  categories: "category",
  pages: "page",
  posts: "post",
} as const;

export const Route = createFileRoute("/content/$kind/$slug")({
  loader: async ({ params }) => {
    const kind = Object.entries(kindByPath).find(([path]) => path === params.kind)?.[1];
    if (!kind) throw notFound();

    const entry = await getPublishedEntry({ data: { kind, slug: params.slug } });
    if (!entry) throw notFound();
    return entry;
  },
  pendingComponent: ContentEntryPending,
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const kindPath =
      loaderData.kind === "page" ? "pages" : loaderData.kind === "post" ? "posts" : "categories";
    return {
      meta: [
        { title: loaderData.title },
        { name: "description", content: loaderData.excerpt },
        { property: "og:title", content: loaderData.title },
        { property: "og:description", content: loaderData.excerpt },
        { property: "og:type", content: loaderData.kind === "post" ? "article" : "website" },
      ],
      links: [{ rel: "canonical", href: canonicalUrl(`/content/${kindPath}/${loaderData.slug}`) }],
    };
  },
  component: ContentEntryRoute,
});

function ContentEntryRoute() {
  const entry = Route.useLoaderData();
  const label = entry.kind === "post" ? "Journal" : entry.kind === "page" ? "Pages" : "Topics";
  const pageStyle = entry.appearance
    ? { backgroundColor: entry.appearance.backgroundColor, color: entry.appearance.textColor }
    : undefined;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <SiteBreadcrumbs items={[{ label }, { label: entry.title }]} />
      <main id="main" className="flex-1 bg-surface-page">
        <article
          style={pageStyle}
          className={`content-template-${entry.template} mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8 lg:py-20`}
        >
          <div className="content-template-hero mx-auto max-w-4xl">
            <p className="eyebrow">{label}</p>
            <h1 className="display-1 mt-3 text-brand-deep">{entry.title}</h1>
            {entry.excerpt ? (
              <p className="mt-6 text-lg text-muted-foreground">{entry.excerpt}</p>
            ) : null}
            {entry.kind === "post" ? (
              <p className="mt-4 text-sm text-muted-foreground">
                {entry.category} · {entry.date} · {entry.author}
              </p>
            ) : null}
          </div>

          {entry.imageUrl ? (
            <OptimizedImage
              src={entry.imageUrl}
              alt={entry.title}
              width={1600}
              height={900}
              sizes="(max-width: 1024px) calc(100vw - 2rem), 1024px"
              className="content-template-image mx-auto mt-10 aspect-[16/9] w-full max-w-5xl rounded-3xl object-cover shadow-md"
            />
          ) : null}

          <div className="content-template-content">
            <ContentHtml html={entry.bodyHtml} />
          </div>

          <ContentBlocks blocks={entry.sectionBlocks} />

          <div className="mx-auto mt-12 max-w-3xl rounded-2xl border border-border/70 bg-white p-6 sm:p-8">
            <p className="eyebrow">Need support?</p>
            <h2 className="mt-2 text-lg font-semibold text-brand-deep">
              Your healing starts with one conversation.
            </h2>
            <Link
              to="/book"
              className="mt-4 inline-flex rounded-md bg-brand-deep px-4 py-2 text-sm font-medium text-white hover:bg-brand-deep/90"
            >
              Book a session
            </Link>
          </div>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
