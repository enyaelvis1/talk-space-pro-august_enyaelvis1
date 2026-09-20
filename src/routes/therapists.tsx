import { createFileRoute, Link } from "@tanstack/react-router";
import { GraduationCap, MapPin } from "lucide-react";

import { AdminPageEditLayer } from "@/components/site/AdminPageEditLayer";
import { EditablePublicPage } from "@/components/site/EditablePublicPage";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteBreadcrumbs } from "@/components/site/SiteBreadcrumbs";
import { SiteFooter } from "@/components/site/SiteFooter";
import { OptimizedImage } from "@/components/site/OptimizedImage";
import { SectionBadge } from "@/components/site/SectionBadge";
import { Reveal } from "@/components/site/Reveal";
import { Button } from "@/components/ui/button";
import { pageSeoHead } from "@/lib/seo";
import {
  getPublishedEntry,
  getPublicTherapists,
  type PublicTherapist,
} from "@/lib/content.functions";

import t1 from "@/assets/therapist-1.jpg";
import t2 from "@/assets/therapist-2.jpg";
import t3 from "@/assets/therapist-3.jpg";

const FALLBACK_THERAPIST_IMAGES = [t1, t2, t3];

export const Route = createFileRoute("/therapists")({
  loader: async () => {
    const [therapists, entry] = await Promise.all([
      getPublicTherapists(),
      getPublishedEntry({ data: { kind: "page", slug: "therapists" } }),
    ]);
    return { therapists, entry };
  },
  head: ({ loaderData }) => ({
    ...pageSeoHead({
      path: "/therapists",
      title: "Therapists | Licensed Nigerian counsellors at Talk Space",
      description:
        "Meet Talk Space's team of licensed Nigerian therapists and counsellors, with training in individual, couples, family and group therapy.",
      ogTitle: "Talk Space Therapists",
      ogDescription: "Meet Talk Space's team of licensed Nigerian therapists and counsellors.",
      entry: loaderData?.entry ?? null,
    }),
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { therapists, entry } = Route.useLoaderData() as {
    therapists: PublicTherapist[];
    entry: Awaited<ReturnType<typeof getPublishedEntry>>;
  };

  if (entry) {
    return <EditablePublicPage entry={entry} label="Therapists" />;
  }

  return (
    <AdminPageEditLayer slug="therapists" label="Therapists">
      <SiteHeader />
      <SiteBreadcrumbs />
      <main id="main" className="flex-1">
        <section className="bg-surface-cream">
          <div className="mx-auto w-full max-w-7xl px-4 pt-16 pb-14 sm:px-6 lg:px-8 lg:pt-24">
            <Reveal className="flex flex-col items-center text-center">
              <SectionBadge>Meet the team</SectionBadge>
              <h1 className="display-1 mt-6 max-w-3xl text-brand-deep">
                Licensed, warm, and{" "}
                <span className="italic text-accent-terracotta">quietly excellent</span>.
              </h1>
              <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
                Every Talk Space therapist is licensed to practise in Nigeria and holds a graduate
                degree in psychology, counselling or a related clinical field. Our care coordinators
                match you with the therapist whose training and style best fit.
              </p>
            </Reveal>
          </div>
        </section>

        <section className="bg-surface-page pb-24">
          <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 pt-16 sm:px-6 md:grid-cols-2 lg:px-8 xl:grid-cols-3">
            {therapists.map((t, i) => (
              <Reveal
                key={t.slug}
                delay={i * 90}
                as="article"
                className="flex min-w-0 flex-col overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft-warm"
              >
                <OptimizedImage
                  src={
                    t.imageUrl || FALLBACK_THERAPIST_IMAGES[i % FALLBACK_THERAPIST_IMAGES.length]
                  }
                  alt={`Portrait of ${t.fullName}, Talk Space therapist`}
                  width={1024}
                  height={1024}
                  loading="lazy"
                  sizes="(max-width: 768px) calc(100vw - 2rem), (max-width: 1280px) 33vw, 400px"
                  className="aspect-[4/5] w-full object-cover"
                />
                <div className="flex flex-1 flex-col p-6">
                  <h2 className="font-display text-xl text-brand-deep">{t.fullName}</h2>
                  <p className="mt-1 text-sm text-accent-terracotta">{t.roleTitle}</p>
                  <p className="mt-4 text-sm text-muted-foreground">
                    {t.bio || "Thoughtful, culturally attuned support for your next chapter."}
                  </p>
                  <dl className="mt-5 space-y-2 text-xs text-muted-foreground">
                    <div className="flex items-start gap-2">
                      <dt className="sr-only">Credentials</dt>
                      <dd className="flex items-start gap-2">
                        <GraduationCap
                          className="mt-0.5 h-3.5 w-3.5 text-accent-terracotta"
                          aria-hidden
                        />
                        <span>{t.credentials || "Talk Space licensed therapist"}</span>
                      </dd>
                    </div>
                    <div className="flex items-start gap-2">
                      <dt className="sr-only">Location</dt>
                      <dd className="flex items-start gap-2">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 text-accent-terracotta" aria-hidden />
                        <span>{t.location || "Online and in-person"}</span>
                      </dd>
                    </div>
                  </dl>
                  <Button
                    asChild
                    variant="terracotta"
                    size="pill"
                    className="mt-6 shadow-soft-warm"
                  >
                    <Link to="/book">Request a session</Link>
                  </Button>
                </div>
              </Reveal>
            ))}
            {therapists.length === 0 ? (
              <p className="w-full py-10 text-center text-muted-foreground">
                Our therapist profiles are being updated. Please contact us for a personal match.
              </p>
            ) : null}
          </div>

          <Reveal className="mx-auto mt-20 max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <SectionBadge tone="mint">Our network</SectionBadge>
            <h2 className="mt-4 font-display text-brand-deep">
              More clinicians, matched to you on request.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Beyond the team above, Talk Space partners with a vetted network of licensed
              therapists across Nigeria. Tell us what you are looking for and we will introduce you
              within one working day.
            </p>
            <Button asChild variant="terracotta" size="pill" className="mt-6 shadow-soft-warm">
              <Link to="/book">Request a match</Link>
            </Button>
          </Reveal>
        </section>
      </main>
      <SiteFooter />
    </AdminPageEditLayer>
  );
}
