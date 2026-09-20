import { Skeleton } from "@/components/ui/skeleton";

type PublicRouteSkeletonProps = {
  pathname: string;
};

function HeaderSkeleton() {
  return (
    <div className="flex items-center justify-between gap-4">
      <Skeleton className="h-12 w-40 rounded-full" />
      <Skeleton className="h-10 w-24 rounded-full" />
    </div>
  );
}

function HomeSkeleton() {
  return (
    <>
      <div className="space-y-4 text-center">
        <Skeleton className="mx-auto h-4 w-24 rounded-full" />
        <Skeleton className="mx-auto h-12 w-full max-w-4xl rounded-3xl" />
        <Skeleton className="mx-auto h-6 w-full max-w-2xl rounded-full" />
      </div>
      <Skeleton className="h-[22rem] rounded-[2rem]" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-36 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-3xl" />
        <Skeleton className="h-80 rounded-3xl" />
      </div>
    </>
  );
}

function ServicesSkeleton() {
  return (
    <>
      <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <Skeleton className="h-4 w-28 rounded-full" />
        <Skeleton className="mt-5 h-12 w-full rounded-3xl" />
        <Skeleton className="mt-3 h-12 w-4/5 rounded-3xl" />
        <Skeleton className="mt-6 h-6 w-full rounded-full" />
      </div>
      <Skeleton className="h-96 rounded-[2rem]" />
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="space-y-4 rounded-3xl border border-border/70 bg-white p-5">
            <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-10 w-28 rounded-full" />
              <Skeleton className="h-10 w-28 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function TherapistsSkeleton() {
  return (
    <>
      <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <Skeleton className="h-4 w-28 rounded-full" />
        <Skeleton className="mt-5 h-12 w-full rounded-3xl" />
        <Skeleton className="mt-3 h-12 w-4/5 rounded-3xl" />
        <Skeleton className="mt-6 h-6 w-full rounded-full" />
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="overflow-hidden rounded-3xl border border-border/70 bg-white">
            <Skeleton className="aspect-[4/5] w-full rounded-none" />
            <div className="space-y-3 p-6">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-10 w-36 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function BlogListSkeleton() {
  return (
    <>
      <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <Skeleton className="h-4 w-24 rounded-full" />
        <Skeleton className="mt-5 h-12 w-full rounded-3xl" />
        <Skeleton className="mt-3 h-12 w-4/5 rounded-3xl" />
        <Skeleton className="mt-6 h-6 w-full rounded-full" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="overflow-hidden rounded-2xl border border-border/70 bg-white">
            <Skeleton className="aspect-[16/9] rounded-none" />
            <div className="space-y-3 p-6">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-6 w-4/5" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-28" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function ArticleSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-10">
      <div className="mx-auto max-w-3xl space-y-4 text-center">
        <Skeleton className="mx-auto h-3 w-20 rounded-full" />
        <Skeleton className="mx-auto h-12 w-full rounded-3xl" />
        <Skeleton className="mx-auto h-12 w-4/5 rounded-3xl" />
        <Skeleton className="mx-auto h-6 w-full rounded-full" />
        <Skeleton className="mx-auto h-6 w-2/3 rounded-full" />
      </div>
      <Skeleton className="mx-auto aspect-[16/9] w-full max-w-4xl rounded-3xl" />
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-5/6" />
        <Skeleton className="mt-8 h-5 w-full" />
        <Skeleton className="h-5 w-4/5" />
      </div>
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <Skeleton className="h-[34rem] rounded-3xl" />
      <div className="space-y-4">
        <Skeleton className="h-40 rounded-3xl" />
        <Skeleton className="h-56 rounded-3xl" />
      </div>
    </div>
  );
}

function FaqSkeleton() {
  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_2fr]">
      <div className="space-y-3">
        <Skeleton className="h-4 w-24 rounded-full" />
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-6 w-44 rounded-full" />
        ))}
      </div>
      <div className="space-y-4">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-20 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

function PolicySkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.5fr_0.9fr]">
      <div className="space-y-4">
        <Skeleton className="h-20 rounded-3xl" />
        <Skeleton className="h-64 rounded-3xl" />
        <Skeleton className="h-52 rounded-3xl" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-44 rounded-3xl" />
        <Skeleton className="h-64 rounded-3xl" />
      </div>
    </div>
  );
}

export function PublicRouteSkeleton({ pathname }: PublicRouteSkeletonProps) {
  const isHome = pathname === "/";
  const isArticlePage = pathname.startsWith("/blog/") || pathname.startsWith("/content/");
  const isFormPage =
    pathname.startsWith("/book") ||
    pathname.startsWith("/contact") ||
    pathname.startsWith("/manage");
  const isFaqPage = pathname === "/faqs";
  const isPolicyPage =
    pathname === "/about" ||
    pathname === "/pricing" ||
    pathname === "/terms" ||
    pathname === "/privacy-policy" ||
    pathname === "/cancellation-refund-policy" ||
    pathname === "/emergency-support";
  const isTherapistsPage = pathname === "/therapists";
  const isServicesPage = pathname === "/services";
  const isBlogPage = pathname === "/blog";

  return (
    <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-8">
      <HeaderSkeleton />
      {isHome ? (
        <HomeSkeleton />
      ) : isServicesPage ? (
        <ServicesSkeleton />
      ) : isTherapistsPage ? (
        <TherapistsSkeleton />
      ) : isBlogPage ? (
        <BlogListSkeleton />
      ) : isArticlePage ? (
        <ArticleSkeleton />
      ) : isFormPage ? (
        <FormSkeleton />
      ) : isFaqPage ? (
        <FaqSkeleton />
      ) : isPolicyPage ? (
        <PolicySkeleton />
      ) : (
        <>
          <Skeleton className="h-20 rounded-3xl" />
          <Skeleton className="h-[28rem] rounded-3xl" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-32 rounded-2xl" />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
