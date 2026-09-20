import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ExternalLink, Eye, RefreshCw } from "lucide-react";

import { BlogPostArticle } from "@/components/content/BlogPostArticle";
import { Button } from "@/components/ui/button";
import { EditablePublicPage } from "@/components/site/EditablePublicPage";
import { getContentEntryPreview, type ContentEntryPreview } from "@/lib/admin.functions";
import { canonicalUrl } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/admin/preview/$kind/$slug")({
  head: () => ({
    meta: [{ title: "Draft preview | Talk Space Admin" }, { name: "robots", content: "noindex" }],
    links: [{ rel: "canonical", href: canonicalUrl("/admin/preview") }],
  }),
  component: DraftPreviewRoute,
});

function DraftPreviewRoute() {
  const { kind, slug } = Route.useParams();
  const fetchPreview = useServerFn(getContentEntryPreview);
  const normalizedKind = kind === "post" ? "post" : "page";

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["content-preview", normalizedKind, slug],
    queryFn: () => fetchPreview({ data: { kind: normalizedKind, slug } }),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const preview = (data ?? null) as ContentEntryPreview | null;

  return (
    <div className="min-h-screen bg-surface-page">
      <div className="sticky top-0 z-50 border-b border-amber-300/60 bg-amber-50/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-3 px-4 py-2.5 text-sm sm:px-6">
          <span className="inline-flex items-center gap-2 font-medium text-amber-900">
            <Eye className="h-4 w-4" />
            {preview?.isDraft ? "Draft preview" : "Preview"} — not visible to the public
          </span>
          {preview?.updatedAt ? (
            <span className="text-amber-800/80">
              Last edited {new Date(preview.updatedAt).toLocaleString()}
            </span>
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => void refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            {preview?.publicRoute && !preview.isDraft ? (
              <a
                href={preview.publicRoute}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-link"
              >
                Live page <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : null}
            {preview?.entry.kind === "post" ? (
              <Button asChild variant="outline" size="sm">
                <Link to="/admin/content/$id/edit" params={{ id: preview.entry.id }}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back to editor
                </Link>
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link
                  to="/admin/public-pages"
                  search={{ page: normalizedKind === "page" ? slug : "about" }}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back to editor
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="mx-auto max-w-3xl px-4 py-20 text-sm text-muted-foreground">
          Loading preview…
        </div>
      ) : error ? (
        <div className="mx-auto max-w-3xl px-4 py-20 text-sm text-destructive">
          {error instanceof Error ? error.message : "Preview failed to load."}
        </div>
      ) : !preview ? (
        <div className="mx-auto max-w-3xl px-4 py-20 text-sm text-muted-foreground">
          No saved content found for this page yet. Save a draft first, then preview it.
        </div>
      ) : preview.entry.kind === "post" ? (
        <BlogPostArticle post={preview.entry} />
      ) : (
        <EditablePublicPage entry={preview.entry} label={preview.label} preferDraft />
      )}
    </div>
  );
}
