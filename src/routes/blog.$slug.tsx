import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { BlogPostArticle } from "@/components/content/BlogPostArticle";
import { ContentEntryPending } from "@/components/content/ContentSkeletons";
import { AdminPageEditLayer } from "@/components/site/AdminPageEditLayer";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteBreadcrumbs } from "@/components/site/SiteBreadcrumbs";
import { SiteFooter } from "@/components/site/SiteFooter";
import { articleJsonLd, canonicalUrl, OG_IMAGE_URL } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { getPublishedPost, getPublishedPosts } from "@/lib/content.functions";

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    const [post, posts] = await Promise.all([
      getPublishedPost({ data: { slug: params.slug } }),
      getPublishedPosts(),
    ]);
    if (!post) throw notFound();
    return { post, others: posts.filter((item) => item.slug !== post.slug).slice(0, 2) };
  },
  pendingComponent: ContentEntryPending,
  head: ({ loaderData }) => {
    const post = loaderData?.post;
    if (!post) return {};
    return {
      meta: [
        { title: post.title },
        { name: "description", content: post.excerpt },
        { property: "og:title", content: post.title },
        { property: "og:description", content: post.excerpt },
        { property: "og:type", content: "article" },
        { property: "og:image", content: OG_IMAGE_URL },
        { property: "og:image:alt", content: post.title },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: post.title },
        { name: "twitter:description", content: post.excerpt },
        { name: "twitter:image", content: OG_IMAGE_URL },
      ],
      links: [{ rel: "canonical", href: canonicalUrl(`/blog/${post.slug}`) }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(
            articleJsonLd({
              title: post.title,
              seoDescription: post.excerpt,
              author: post.author,
              date: post.date,
              slug: post.slug,
            }),
          ),
        },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <SiteBreadcrumbs items={[{ label: "Journal", to: "/blog" }, { label: "Not found" }]} />

      <main className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="display-1 text-brand-deep">Post not found</h1>
        <p className="mt-4 text-muted-foreground">
          That essay may have moved. Head back to the journal.
        </p>
        <Button asChild className="mt-8 bg-brand-deep text-white hover:bg-brand-deep/90">
          <Link to="/blog">Back to the journal</Link>
        </Button>
      </main>
      <SiteFooter />
    </div>
  ),
  errorComponent: () => (
    <div className="p-8 text-center text-muted-foreground">Something went wrong.</div>
  ),
  component: RouteComponent,
});

function RouteComponent() {
  const { post, others } = Route.useLoaderData();

  return (
    <AdminPageEditLayer
      slug={post.slug}
      label={post.title}
      editorPath={`/admin/content/${post.id}/edit`}
      editButtonLabel="Edit this post"
    >
      <BlogPostArticle post={post} others={others} />
    </AdminPageEditLayer>
  );
}
