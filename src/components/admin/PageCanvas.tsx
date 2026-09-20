import * as React from "react";

import { OptimizedImage } from "@/components/site/OptimizedImage";

type PageCanvasProps = {
  label: string;
  title: string;
  excerpt?: string;
  imageUrl?: string | null;
  children: React.ReactNode;
};

/**
 * Renders CMS editing surfaces inside the exact public-page frame
 * (cream surface, container width, eyebrow / display heading / hero image),
 * so admins see cards, buttons, images and typography as visitors will.
 */
export function PageCanvas({ label, title, excerpt, imageUrl, children }: PageCanvasProps) {
  return (
    <div className="overflow-hidden rounded-3xl border border-border/70 bg-surface-page shadow-sm">
      <div className="flex items-center justify-between border-b border-border/60 bg-card/70 px-4 py-2 text-xs text-muted-foreground">
        <span className="font-medium text-brand-deep">Live page view</span>
        <span>Styled exactly like the public site</span>
      </div>
      <article className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <p className="eyebrow">{label}</p>
        <h1 className="display-1 mt-4 text-brand-deep">{title || "Untitled page"}</h1>
        {excerpt ? <p className="mt-6 max-w-3xl text-lg text-muted-foreground">{excerpt}</p> : null}
        {imageUrl ? (
          <OptimizedImage
            src={imageUrl}
            alt={title}
            width={1600}
            height={900}
            sizes="(max-width: 1024px) calc(100vw - 2rem), 896px"
            className="mt-10 aspect-[16/9] w-full rounded-3xl object-cover shadow-md"
          />
        ) : null}
        <div className="mt-10">{children}</div>
      </article>
    </div>
  );
}
