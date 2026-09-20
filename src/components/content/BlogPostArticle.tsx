import { Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, UserRound } from "lucide-react";

import { ContentHtml } from "@/components/content/ContentHtml";
import { OptimizedImage } from "@/components/site/OptimizedImage";
import { SiteBreadcrumbs } from "@/components/site/SiteBreadcrumbs";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Button } from "@/components/ui/button";
import type { RenderedContentEntry } from "@/lib/content.functions";

import heroConversationImg from "@/assets/unsplash-african-women-conversation.jpg";

type BlogPostArticleProps = {
  post: RenderedContentEntry;
  others?: RenderedContentEntry[];
};

export function BlogPostArticle({ post, others = [] }: BlogPostArticleProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <SiteBreadcrumbs items={[{ label: "Journal", to: "/blog" }, { label: post.title }]} />

      <main id="main" className="flex-1">
        <article className="bg-surface-page">
          <div className="mx-auto w-full max-w-3xl px-4 pt-12 pb-6 sm:px-6 lg:px-8 lg:pt-20">
            <Link
              to="/blog"
              className="inline-flex items-center gap-1 text-sm text-brand-blue-deep hover:text-brand-deep"
            >
              <ArrowLeft className="h-4 w-4" /> Back to journal
            </Link>
            <p className="eyebrow mt-6">The Journal</p>
            <h1 className="display-1 mt-3 text-brand-deep">{post.title}</h1>
            <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="rounded-full bg-brand-mint/10 px-3 py-1 font-medium text-brand-deep">
                {post.category}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-brand-mint" />
                {post.date}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="h-3.5 w-3.5 text-brand-mint" />
                {post.author}
              </span>
            </div>
          </div>

          <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
            <OptimizedImage
              src={post.imageUrl || heroConversationImg}
              alt={post.title}
              width={1400}
              height={1082}
              sizes="(max-width: 1024px) calc(100vw - 2rem), 896px"
              className="aspect-[16/9] w-full rounded-3xl object-cover shadow-md"
            />
          </div>

          <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
            <ContentHtml html={post.bodyHtml} />

            <div className="mt-12 rounded-2xl border border-border/70 bg-white p-6 sm:p-8">
              <p className="eyebrow">Ready to talk?</p>
              <h2 className="mt-2 text-lg font-semibold text-brand-deep">
                Your healing starts with one conversation.
              </h2>
              <Button asChild className="mt-4 bg-brand-deep text-white hover:bg-brand-deep/90">
                <Link to="/book">Book a session</Link>
              </Button>
            </div>
          </div>
        </article>

        {others.length > 0 && (
          <section className="bg-white py-16">
            <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8">
              <p className="eyebrow">More posts</p>
              <div className="mt-6 grid gap-6 md:grid-cols-2">
                {others.map((p) => (
                  <Link
                    key={p.slug}
                    to="/blog/$slug"
                    params={{ slug: p.slug }}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card transition-all hover:-translate-y-0.5 hover:shadow-md"
                  >
                    {p.imageUrl ? (
                      <OptimizedImage
                        src={p.imageUrl}
                        alt={p.title}
                        width={1600}
                        height={1067}
                        loading="lazy"
                        sizes="(max-width: 768px) calc(100vw - 2rem), 448px"
                        className="aspect-[16/9] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="aspect-[16/9] w-full bg-brand-mint-soft" aria-hidden />
                    )}
                    <div className="p-6">
                      <p className="text-xs text-muted-foreground">
                        {p.category} · {p.date}
                      </p>
                      <h3 className="mt-2 text-lg font-semibold text-brand-deep">{p.title}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">{p.excerpt}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
