import { Skeleton } from "@/components/ui/skeleton";
import { SiteBreadcrumbs } from "@/components/site/SiteBreadcrumbs";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";

function ContentCardSkeleton() {
  return (
    <article className="overflow-hidden rounded-2xl border border-border/70 bg-card">
      <Skeleton className="aspect-[16/9] rounded-none" />
      <div className="space-y-3 p-6">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-6 w-4/5" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-28" />
      </div>
    </article>
  );
}

export function BlogPending() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <SiteBreadcrumbs />
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-5 h-12 w-full max-w-3xl" />
        <Skeleton className="mt-3 h-12 w-4/5 max-w-2xl" />
        <Skeleton className="mt-6 h-6 w-full max-w-2xl" />
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <ContentCardSkeleton key={index} />
          ))}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}

export function ContentEntryPending() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <SiteBreadcrumbs />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-3xl">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-5 h-12 w-full" />
          <Skeleton className="mt-3 h-12 w-4/5" />
          <Skeleton className="mt-6 h-6 w-full" />
          <Skeleton className="mt-2 h-6 w-2/3" />
        </div>
        <Skeleton className="mx-auto mt-10 aspect-[16/9] w-full max-w-4xl rounded-3xl" />
        <div className="mx-auto mt-12 max-w-3xl space-y-4">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-5/6" />
          <Skeleton className="mt-8 h-5 w-full" />
          <Skeleton className="h-5 w-4/5" />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
