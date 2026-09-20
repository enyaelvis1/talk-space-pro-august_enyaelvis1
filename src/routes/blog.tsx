import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";

import { BlogPending } from "@/components/content/ContentSkeletons";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteBreadcrumbs } from "@/components/site/SiteBreadcrumbs";
import { SiteFooter } from "@/components/site/SiteFooter";
import { OptimizedImage } from "@/components/site/OptimizedImage";
import { SectionBadge } from "@/components/site/SectionBadge";
import { Reveal } from "@/components/site/Reveal";
import { Button } from "@/components/ui/button";
import { getPublishedPostsPage, type RenderedContentEntry } from "@/lib/content.functions";
import { canonicalUrl } from "@/lib/seo";

import heroConversationImg from "@/assets/unsplash-african-women-conversation.jpg";
import articleManPortraitImg from "@/assets/unsplash-nigerian-man-portrait.jpg";
import couplesTherapyImg from "@/assets/couples-therapy.jpg";
import familyTherapyImg from "@/assets/family-therapy.jpg";

const FALLBACK_ARTICLE_IMAGES = [
  heroConversationImg,
  articleManPortraitImg,
  couplesTherapyImg,
  familyTherapyImg,
];

export const Route = createFileRoute("/blog")({
  validateSearch: (search): { page?: number } => {
    const page = Math.max(1, Math.floor(Number(search.page)) || 1);
    return page === 1 ? {} : { page };
  },
  loaderDeps: ({ search }) => ({ page: search.page ?? 1 }),
  loader: ({ deps }) => getPublishedPostsPage({ data: deps }),
  pendingComponent: BlogPending,
  head: ({ matches }) => {
    if (matches.some((match) => match.routeId.endsWith("/$slug"))) {
      return {};
    }

    return {
      meta: [
        { title: "The Talk Space Journal | Notes on mental health in Nigeria" },
        {
          name: "description",
          content:
            "Essays from Talk Space therapists on anxiety, relationships, family and healing, grounded in the Nigerian and African experience.",
        },
        { property: "og:title", content: "The Talk Space Journal" },
        {
          property: "og:description",
          content: "Notes on mental health in Nigeria, from Talk Space therapists.",
        },
        { property: "og:type", content: "website" },
        { property: "og:url", content: canonicalUrl("/blog") },
      ],
      links: [{ rel: "canonical", href: canonicalUrl("/blog") }],
    };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (pathname !== "/blog") {
    return <Outlet />;
  }

  return <BlogIndex />;
}

function BlogIndex() {
  const { posts, page, pageCount, total } = Route.useLoaderData();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <SiteBreadcrumbs />
      <main id="main" className="flex-1">
        <section className="bg-surface-cream">
          <div className="mx-auto w-full max-w-7xl px-4 pt-16 pb-14 sm:px-6 lg:px-8 lg:pt-24">
            <Reveal className="flex flex-col items-center text-center">
              <SectionBadge>The Journal</SectionBadge>
              <h1 className="display-1 mt-6 max-w-3xl text-brand-deep">
                Reflections on{" "}
                <span className="italic text-accent-terracotta">
                  mental health, marriage & healing
                </span>
                .
              </h1>
              <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
                Short essays from Talk Space therapists, grounded in the Nigerian and African
                experience, and never a replacement for therapy itself.
              </p>
            </Reveal>
          </div>
        </section>

        <section className="bg-surface-page pb-24">
          <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 pt-16 sm:px-6 lg:grid-cols-3 lg:px-8">
            {posts.map((p: RenderedContentEntry, i: number) => (
              <Reveal
                key={p.slug}
                delay={i * 60}
                className="group flex flex-col overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft-warm transition-transform hover:-translate-y-1"
              >
                <Link
                  to="/blog/$slug"
                  params={{ slug: p.slug }}
                  className="flex h-full flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label={`Read ${p.title}`}
                >
                  <div className="aspect-[16/9] overflow-hidden">
                    <OptimizedImage
                      src={
                        p.imageUrl || FALLBACK_ARTICLE_IMAGES[i % FALLBACK_ARTICLE_IMAGES.length]
                      }
                      alt={p.title}
                      width={1600}
                      height={1067}
                      loading="lazy"
                      sizes="(max-width: 768px) calc(100vw - 2rem), (max-width: 1280px) 33vw, 420px"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-6">
                    <p className="text-xs uppercase tracking-[0.14em] text-accent-terracotta">
                      {p.category} · {p.date}
                    </p>
                    <h2 className="mt-3 font-display text-xl text-brand-deep">{p.title}</h2>
                    <p className="mt-2 flex-1 text-sm text-muted-foreground">{p.excerpt}</p>
                    <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-accent-terracotta transition-colors group-hover:text-brand-deep">
                      Read the essay →
                    </span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>

          {posts.length === 0 ? (
            <div className="mx-auto mt-12 max-w-2xl px-4 text-center sm:px-6 lg:px-8">
              <p className="text-muted-foreground">No published essays are available yet.</p>
            </div>
          ) : null}

          {pageCount > 1 ? (
            <nav
              className="mx-auto mt-12 flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"
              aria-label="Journal pagination"
            >
              {page > 1 ? (
                <Link
                  to="/blog"
                  search={{ page: page - 1 }}
                  className="rounded-full border border-brand-deep/20 px-5 py-2 text-sm font-medium text-brand-deep transition-colors hover:bg-accent-terracotta-soft hover:text-accent-terracotta"
                >
                  ← Newer essays
                </Link>
              ) : (
                <span className="rounded-full border border-border px-5 py-2 text-sm text-muted-foreground">
                  ← Newer essays
                </span>
              )}
              <span className="text-sm text-muted-foreground" aria-live="polite">
                Page {page} of {pageCount} · {total} essays
              </span>
              {page < pageCount ? (
                <Link
                  to="/blog"
                  search={{ page: page + 1 }}
                  className="rounded-full border border-brand-deep/20 px-5 py-2 text-sm font-medium text-brand-deep transition-colors hover:bg-accent-terracotta-soft hover:text-accent-terracotta"
                >
                  Older essays →
                </Link>
              ) : (
                <span className="rounded-full border border-border px-5 py-2 text-sm text-muted-foreground">
                  Older essays →
                </span>
              )}
            </nav>
          ) : null}

          <Reveal className="mx-auto mt-20 max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <SectionBadge tone="mint">Care in your inbox</SectionBadge>
            <h2 className="mt-4 font-display text-brand-deep">One essay a month. Never spammy.</h2>
            <p className="mt-3 text-muted-foreground">
              Subscribe to receive a short essay from a Talk Space therapist.
            </p>
            <Button asChild variant="terracotta" size="pill" className="mt-6 shadow-soft-warm">
              <Link to="/contact">Subscribe</Link>
            </Button>
          </Reveal>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
