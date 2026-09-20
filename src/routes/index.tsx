import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  Baby,
  Brain,
  Building2,
  CalendarCheck,
  HeartCrack,
  HeartHandshake,
  MessageCircleHeart,
  GraduationCap,
  MapPin,
  PlayCircle,
  Gem,
  ShieldCheck,
  Sparkles,
  Star,
  UserRound,
  Users,
  Video,
} from "lucide-react";

import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { PublicRouteSkeleton } from "@/components/site/PublicRouteSkeleton";
import { claimAutomaticRouteRetry } from "@/lib/route-recovery";
import { OptimizedImage } from "@/components/site/OptimizedImage";
import { SectionBadge } from "@/components/site/SectionBadge";
import { AutoPlayGallery } from "@/components/site/AutoPlayGallery";
import { Reveal } from "@/components/site/Reveal";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { REVIEWS, TS } from "@/lib/talkspace";
import { canonicalUrl, ORGANIZATION_JSON_LD } from "@/lib/seo";
import type { HomepageSectionCopy, HomepageSectionCopyMap } from "@/lib/homepage-section-copy";
import { DEFAULT_SPECIALTY_CARDS, type SpecialtyCard } from "@/lib/specialty-cards";
import {
  getPublicHomepageData,
  type HeroSettings,
  type PublicTherapist,
  type SpecialtyCarouselItem,
  type GoogleReviewSettings,
  type HomePricingBilling,
  type HomePricingSettings,
  type HomepageSectionId,
  type PublicHomepageData,
  type PublicTestimonial,
  type RenderedContentEntry,
} from "@/lib/content.functions";

import traumaImg from "@/assets/ts-ptsd.webp";
import familyImg from "@/assets/family-therapy.jpg";
import individualTherapyImg from "@/assets/individual-therapy.jpg";
import couplesTherapyImg from "@/assets/couples-therapy.jpg";
import groupTherapyImg from "@/assets/group-therapy.jpg";
import officeSpaceImg from "@/assets/office-space.jpg";
import heroConversationImg from "@/assets/unsplash-african-women-conversation.jpg";
import heroTeamSessionImg from "@/assets/unsplash-african-team-session.jpg";
import articleConversationImg from "@/assets/unsplash-african-couch-conversation.jpg";
import articleManPortraitImg from "@/assets/unsplash-nigerian-man-portrait.jpg";
import therapistOneImg from "@/assets/therapist-1.jpg";
import therapistTwoImg from "@/assets/therapist-2.jpg";
import therapistThreeImg from "@/assets/therapist-3.jpg";

const HOMEPAGE_THERAPIST_LIMIT = 3;
const HOMEPAGE_EDIT_PARAM = "edit";
const HOMEPAGE_STICKY_EDIT_KEY = "cms:edit-mode-sticky";

type HomepageMedia = {
  heroSettings: HeroSettings;
  carousel: SpecialtyCarouselItem[] | null;
  specialtyCards: SpecialtyCard[] | null;
};

type HomepageEditLayerModule = typeof import("@/components/site/HomepageEditLayer");
type HomepageEditLayerComponent = HomepageEditLayerModule["HomepageEditLayer"];

export const Route = createFileRoute("/")({
  loader: () => getPublicHomepageData(),
  pendingMs: 0,
  pendingMinMs: 400,
  pendingComponent: HomePagePending,
  errorComponent: HomePageRecovery,
  head: () => ({
    meta: [
      {
        title: "Talk Space Counselling Services, Licensed Nigerian therapists, online & in-person",
      },
      {
        name: "description",
        content:
          "Talk Space Counselling Services offers structured, ethical therapy for anxiety, marriage, trauma, teens and families, for Nigerians at home and in the diaspora.",
      },
      { property: "og:title", content: "Talk Space Counselling Services" },
      {
        property: "og:description",
        content:
          "Licensed therapists. Structured treatment plans. Online and in-person counselling in Nigeria.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: canonicalUrl("/") },
    ],
    links: [{ rel: "canonical", href: canonicalUrl("/") }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(ORGANIZATION_JSON_LD),
      },
    ],
  }),
  component: HomePage,
});

function HomePagePending() {
  return (
    <main className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
      <PublicRouteSkeleton pathname="/" />
    </main>
  );
}

function HomePageRecovery() {
  const router = useRouter();
  const [willAutoRetry] = useState(() => claimAutomaticRouteRetry("homepage"));

  useEffect(() => {
    if (!willAutoRetry) return;
    const retryId = window.setTimeout(() => {
      void router.invalidate();
    }, 1_500);

    return () => window.clearTimeout(retryId);
  }, [router, willAutoRetry]);

  if (willAutoRetry) return <HomePagePending />;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-foreground">This page could not load</h1>
        <p className="mt-2 text-sm text-muted-foreground">Please try again when you are ready.</p>
        <Button className="mt-5" onClick={() => void router.invalidate()}>
          Try again
        </Button>
      </div>
    </main>
  );
}

function HomePage() {
  const {
    heroSettings,
    carousel,
    specialtyCards,
    googleReviews,
    therapists,
    latestPosts,
    sections,
    testimonials,
    sectionCopy,
    homePricing,
  } = Route.useLoaderData() as PublicHomepageData;
  const copy = sectionCopy as HomepageSectionCopyMap;
  const renderSection = (
    id: HomepageSectionId,
    live: HomepageSectionCopyMap,
    liveMedia: HomepageMedia,
  ): ReactNode => {
    const content: Record<HomepageSectionId, ReactNode> = {
      hero: <Hero settings={liveMedia.heroSettings} />,
      carousel: <HeroGallery carousel={liveMedia.carousel} />,
      trust: <TrustStrip googleReviews={googleReviews} />,
      specialties: <Specialties copy={live.specialties} cards={liveMedia.specialtyCards} />,
      therapists: <TherapistShowcase therapists={therapists} copy={live.therapists} />,
      video: <VideoSection copy={live.video} />,
      how_it_works: <HowItWorks copy={live.how_it_works} />,
      pricing: <Pricing copy={live.pricing} settings={homePricing} />,
      reviews: (
        <Reviews testimonials={testimonials} googleReviews={googleReviews} copy={live.reviews} />
      ),
      journal: <Journal posts={latestPosts} copy={live.journal} />,
      faq: <FAQ copy={live.faq} />,
      cta: <FinalCTA copy={live.cta} />,
    };
    return content[id];
  };
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main id="main" className="flex-1">
        <DeferredHomepageEditLayer
          sections={sections}
          copy={copy}
          media={{ heroSettings, carousel, specialtyCards }}
          renderSection={renderSection}
        />
      </main>
      <SiteFooter />
    </div>
  );
}

function renderHomepageSections(
  sections: PublicHomepageData["sections"],
  copy: HomepageSectionCopyMap,
  media: HomepageMedia,
  renderSection: (
    id: HomepageSectionId,
    copy: HomepageSectionCopyMap,
    media: HomepageMedia,
  ) => ReactNode,
) {
  return (
    <>
      {sections.map((section) =>
        section.visible === false ? null : (
          <Fragment key={section.id}>{renderSection(section.id, copy, media)}</Fragment>
        ),
      )}
    </>
  );
}

function wantsHomepageEditor() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  const value = params.get(HOMEPAGE_EDIT_PARAM);
  if (value === "1" || value === "true") return true;
  try {
    return window.sessionStorage.getItem(HOMEPAGE_STICKY_EDIT_KEY) === "1";
  } catch {
    return false;
  }
}

function hasLikelySignedInSession() {
  if (typeof window === "undefined") return false;
  try {
    if (Object.keys(window.localStorage).some((key) => /^sb-.+-auth-token$/.test(key))) {
      return true;
    }
  } catch {
    // localStorage may be unavailable in strict browser/privacy modes.
  }
  return /sb-[^=]*auth-token/.test(document.cookie);
}

function DeferredHomepageEditLayer({
  sections,
  copy,
  media,
  renderSection,
}: {
  sections: PublicHomepageData["sections"];
  copy: HomepageSectionCopyMap;
  media: HomepageMedia;
  renderSection: (
    id: HomepageSectionId,
    copy: HomepageSectionCopyMap,
    media: HomepageMedia,
  ) => ReactNode;
}) {
  const [Editor, setEditor] = useState<HomepageEditLayerComponent | null>(null);

  useEffect(() => {
    let active = true;
    let idleId: number | null = null;
    let timeoutId: number | null = null;

    const loadEditor = () => {
      void import("@/components/site/HomepageEditLayer").then((module) => {
        if (active) setEditor(() => module.HomepageEditLayer);
      });
    };

    if (wantsHomepageEditor()) {
      loadEditor();
      return () => {
        active = false;
      };
    }

    if (!hasLikelySignedInSession()) {
      return () => {
        active = false;
      };
    }

    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(loadEditor, { timeout: 5_000 });
    } else {
      timeoutId = window.setTimeout(loadEditor, 2_500);
    }

    return () => {
      active = false;
      if (idleId !== null && "cancelIdleCallback" in window) window.cancelIdleCallback(idleId);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, []);

  if (Editor) {
    return <Editor sections={sections} copy={copy} media={media} renderSection={renderSection} />;
  }

  return renderHomepageSections(sections, copy, media, renderSection);
}

/* ----------------------------- Hero ----------------------------- */

function Hero({ settings }: { settings: HeroSettings }) {
  const [index, setIndex] = useState(0);
  const fullHeading = `${settings.headingBefore} ${settings.headingEmphasis}`
    .replace(/\s+/g, " ")
    .trim();
  const stableHardConversationHeading =
    fullHeading === "For the hard conversations you can't have anywhere else";

  const slides = [
    {
      src: settings.imageOnePath || heroConversationImg,
      alt: settings.imageOneAlt,
      imageClassName: "object-[58%_center] sm:object-center",
    },
    {
      src: settings.imageTwoPath || heroTeamSessionImg,
      alt: settings.imageTwoAlt,
      imageClassName: "object-[62%_center] sm:object-center",
    },
  ];

  useEffect(() => {
    const id = window.setInterval(() => setIndex((i) => (i + 1) % slides.length), 6000);
    return () => window.clearInterval(id);
  }, [slides.length]);

  return (
    <section className="relative isolate overflow-hidden bg-[radial-gradient(circle_at_8%_18%,rgba(246,242,233,0.9)_0,rgba(246,242,233,0)_22rem),radial-gradient(circle_at_92%_78%,rgba(216,210,198,0.28)_0,rgba(216,210,198,0)_24rem),var(--surface-cream)]">
      <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center px-4 pt-16 pb-20 text-center sm:px-6 sm:pt-24 lg:pt-28 lg:pb-28">
        <SectionBadge>{settings.eyebrow}</SectionBadge>

        <h1
          className={cn(
            "display-1 mt-6 text-brand-deep [text-wrap:normal]",
            stableHardConversationHeading ? "max-w-5xl" : "max-w-3xl",
          )}
        >
          {stableHardConversationHeading ? (
            <>
              <span className="block">For the hard conversations</span>
              <span className="block italic text-accent-terracotta md:whitespace-nowrap">
                you can't have anywhere else
              </span>
            </>
          ) : (
            <>
              {settings.headingBefore}{" "}
              <span className="italic text-accent-terracotta">{settings.headingEmphasis}</span>
            </>
          )}
        </h1>

        <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          {settings.description}
        </p>

        <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
          <Button asChild variant="terracotta" size="pillLg" className="shadow-soft-warm">
            <Link to="/book">
              {settings.primaryCtaLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="pillOutline" size="pillLg">
            <Link to="/services">{settings.secondaryCtaLabel}</Link>
          </Button>
        </div>

        <div
          aria-hidden
          className="relative mt-10 h-44 w-full overflow-hidden rounded-3xl border border-white/70 bg-gradient-to-br from-brand-mint-soft via-white to-accent-terracotta-soft shadow-soft-warm sm:hidden"
        >
          <div className="absolute -left-10 top-7 h-36 w-36 rounded-full border border-brand-mint/20" />
          <div className="absolute left-10 top-16 h-24 w-24 rounded-full bg-white/55" />
          <div className="absolute -right-8 -bottom-12 h-40 w-40 rounded-full bg-accent-terracotta/15" />
          <ShieldCheck className="absolute left-1/2 top-1/2 h-11 w-11 -translate-x-1/2 -translate-y-1/2 text-brand-deep/70" />
        </div>

        {/* Hero image with warm frame */}
        <div className="relative mt-14 hidden w-full max-w-4xl sm:block">
          <div
            aria-hidden
            className="absolute -inset-3 rounded-[2.25rem] bg-white/70 sm:-inset-5"
          />
          <div className="group relative overflow-hidden rounded-3xl shadow-soft-warm">
            {slides.map((slide, i) => (
              <OptimizedImage
                key={slide.src}
                src={slide.src}
                alt={slide.alt}
                width={1920}
                height={1080}
                loading={i === 0 ? "eager" : "lazy"}
                fetchPriority={i === 0 ? "high" : "low"}
                mobileResponsiveWidths={[320, 480]}
                quality={60}
                sizes="(max-width: 640px) calc(100vw - 2rem), (max-width: 1024px) calc(100vw - 3rem), 896px"
                className={cn(
                  "aspect-[16/9] h-full w-full object-cover transition-[transform,opacity] duration-1000 group-hover:scale-[1.02]",
                  slide.imageClassName,
                  i === index ? "opacity-100" : "absolute inset-0 opacity-0",
                )}
              />
            ))}
          </div>
          <div className="mt-5 flex items-center justify-center gap-2">
            {slides.map((slide, i) => (
              <button
                key={slide.src}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show slide ${i + 1}`}
                aria-current={i === index}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === index
                    ? "w-8 bg-accent-terracotta"
                    : "w-3 bg-accent-terracotta/30 hover:bg-accent-terracotta/60",
                )}
              />
            ))}
          </div>
        </div>

        <a
          href={TS.phone.ngHref}
          className="mt-8 inline-flex items-center text-sm font-medium text-brand-deep underline-offset-4 transition-colors hover:text-accent-terracotta hover:underline"
        >
          Or call {TS.phone.ng}
        </a>
      </div>
    </section>
  );
}

/* --------------------------- Trust strip --------------------------- */

function HeroGallery({ carousel }: { carousel: SpecialtyCarouselItem[] | null }) {
  const images = carousel?.length
    ? carousel.map((s) => ({ src: s.imageUrl ?? "", alt: s.alt, caption: s.title }))
    : DEFAULT_SPECIALTY_CARDS.map((card, index) => ({
        src: DEFAULT_SPECIALTY_IMAGES[index % DEFAULT_SPECIALTY_IMAGES.length],
        alt: card.alt,
        caption: card.title,
      }));
  return (
    <section className="bg-surface-cream">
      <Reveal>
        <AutoPlayGallery className="pb-14" images={images} durationSeconds={45} />
      </Reveal>
    </section>
  );
}

function TrustStrip({ googleReviews }: { googleReviews: GoogleReviewSettings }) {
  const items = [
    { icon: ShieldCheck, label: "100% confidential" },
    { icon: BadgeCheck, label: "Licensed therapists" },
    { icon: CalendarCheck, label: "Flexible scheduling" },
    {
      icon: Star,
      label: `${googleReviews.rating.toFixed(1)} ${googleReviews.label} · ${googleReviews.reviewCount}+ reviews`,
      href: googleReviews.reviewUrl,
    },
  ];
  return (
    <section className="border-b border-border/60 bg-white">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-2 gap-x-4 gap-y-3 px-4 py-5 text-sm font-medium text-muted-foreground sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-10 sm:px-6 sm:py-6 lg:px-8">
        {items.map((item) => (
          <a
            key={item.label}
            href={"href" in item ? item.href : undefined}
            target={"href" in item ? "_blank" : undefined}
            rel={"href" in item ? "noopener noreferrer" : undefined}
            className="flex min-w-0 items-center justify-center gap-2 transition-transform duration-300 hover:-translate-y-0.5"
          >
            <item.icon className="h-4 w-4 flex-none text-brand-mint" aria-hidden />
            {item.label}
          </a>
        ))}
      </div>
    </section>
  );
}

/* --------------------------- Specialties --------------------------- */

/** Bundled artwork used when an admin has not uploaded a card image. */
const DEFAULT_SPECIALTY_IMAGES = [
  individualTherapyImg,
  couplesTherapyImg,
  familyImg,
  officeSpaceImg,
  traumaImg,
  couplesTherapyImg,
  groupTherapyImg,
  traumaImg,
  officeSpaceImg,
];

const SPECIALTY_ICONS = [
  UserRound,
  HeartHandshake,
  Baby,
  Brain,
  ShieldCheck,
  Gem,
  Users,
  HeartCrack,
  Building2,
];

function Specialties({
  copy,
  cards,
}: {
  copy: HomepageSectionCopy;
  cards: SpecialtyCard[] | null;
}) {
  const items = cards && cards.length > 0 ? cards : DEFAULT_SPECIALTY_CARDS;
  return (
    <section className="relative isolate overflow-hidden bg-[#fff0e5] py-16 sm:py-24">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 top-24 h-[34rem] w-[34rem] rounded-full border-[3rem] border-white/35 blur-sm"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-48 bottom-0 h-[40rem] w-[40rem] rounded-full border-[4rem] border-white/30 blur-sm"
      />
      <div className="relative mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="eyebrow text-brand-blue-deep">{copy.eyebrow}</p>
          <h2 className="font-display mt-4 text-brand-deep">{copy.title}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">{copy.body}</p>
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl gap-x-12 gap-y-10 md:grid-cols-2 lg:gap-x-24 lg:gap-y-16">
          {items.map((item, index) => (
            <article
              key={`${item.title}-${index}`}
              className={cn(
                "group rounded-[2rem] border-8 border-white bg-white p-2 shadow-[0_18px_45px_rgba(137,92,67,0.12)] transition-transform duration-300 hover:-translate-y-1",
                index % 2 === 1 ? "lg:translate-y-24" : "",
              )}
            >
              <div className="overflow-hidden rounded-[1.45rem]">
                <OptimizedImage
                  src={
                    item.imageUrl ||
                    DEFAULT_SPECIALTY_IMAGES[index % DEFAULT_SPECIALTY_IMAGES.length]
                  }
                  alt={item.alt || item.title}
                  width={1024}
                  height={768}
                  loading="lazy"
                  sizes="(max-width: 768px) calc(100vw - 2rem), (max-width: 1280px) 33vw, 340px"
                  className="aspect-[4/3] h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="px-3 pb-3 pt-5 sm:px-5 sm:pb-5">
                <h3 className="text-lg font-semibold text-brand-deep sm:text-xl">{item.title}</h3>
                {item.description ? (
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
                ) : null}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button asChild variant="terracotta" size="sm" className="w-full">
                    <Link to={item.primaryHref}>{item.primaryLabel}</Link>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link to={item.secondaryHref}>{item.secondaryLabel}</Link>
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------------------------- Therapist showcase --------------------------- */

function TherapistShowcase({
  therapists,
  copy,
}: {
  therapists: PublicTherapist[];
  copy: HomepageSectionCopy;
}) {
  if (therapists.length === 0) return null;
  const featuredTherapists = therapists.slice(0, HOMEPAGE_THERAPIST_LIMIT);

  return (
    <section className="bg-white py-16 sm:py-24">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <SectionBadge>{copy.eyebrow}</SectionBadge>
          <h2 className="font-display mt-5 text-brand-deep">{copy.title}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">{copy.body}</p>
        </div>

        <div className="mx-auto mt-12 grid max-w-7xl grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
          {featuredTherapists.map((therapist, index) => (
            <article
              key={therapist.slug}
              className="group flex min-w-0 flex-col overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft-warm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
            >
              <OptimizedImage
                src={
                  therapist.imageUrl ||
                  [therapistOneImg, therapistTwoImg, therapistThreeImg][index % 3]
                }
                alt={`Portrait of ${therapist.fullName}, Talk Space therapist`}
                width={1024}
                height={1024}
                loading="lazy"
                sizes="(max-width: 768px) calc(100vw - 2rem), (max-width: 1280px) 50vw, 400px"
                className="aspect-[4/5] w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
              />
              <div className="flex flex-1 flex-col p-6">
                <h3 className="font-display text-xl text-brand-deep">{therapist.fullName}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{therapist.roleTitle}</p>
                <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                  <p className="flex items-start gap-2">
                    <GraduationCap className="mt-0.5 h-3.5 w-3.5 flex-none text-accent-terracotta" />
                    <span>{therapist.credentials || "Talk Space licensed therapist"}</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 flex-none text-accent-terracotta" />
                    <span>{therapist.location || "Online and in-person"}</span>
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {therapist.specialties.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-muted px-3 py-1 text-xs text-brand-deep"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <p className="mt-5 line-clamp-3 flex-1 text-sm leading-7 text-muted-foreground">
                  {therapist.bio ||
                    "Providing thoughtful, culturally attuned support for the moments and relationships that matter most."}
                </p>
                <Button asChild variant="terracotta" size="pill" className="mt-6 self-end">
                  <Link to="/therapists">Know more</Link>
                </Button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------------------------- Video --------------------------- */

function VideoSection({ copy }: { copy: HomepageSectionCopy }) {
  return (
    <section className="scroll-mt-24 bg-white py-14 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:items-center lg:gap-16">
          <div>
            <p className="eyebrow">{copy.eyebrow}</p>
            <h2 className="mt-2 text-brand-deep">{copy.title}</h2>
            <p className="mt-4 text-muted-foreground">{copy.body}</p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button asChild className="bg-brand-deep text-white hover:bg-brand-deep/90">
                <Link to="/book">
                  Book couple therapy
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <a
                href={TS.socials.youtube}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-brand-deep"
              >
                <PlayCircle className="h-4 w-4 text-brand-mint" />
                Subscribe on YouTube
              </a>
            </div>
          </div>
          <div className="relative">
            <div aria-hidden className="absolute -inset-4 rounded-[2rem] bg-brand-mint-soft" />
            <div className="relative aspect-video overflow-hidden rounded-2xl border border-border/70 bg-brand-deep shadow-lg">
              <iframe
                className="h-full w-full"
                src="https://www.youtube.com/embed/uWElBn9CYL8"
                title="Making Marriage Work, Talk Space Counselling on YouTube"
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
            <a
              href="https://www.youtube.com/watch?v=uWElBn9CYL8"
              target="_blank"
              rel="noopener noreferrer"
              className="text-link mt-3 inline-flex text-sm"
            >
              Open video on YouTube
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* --------------------------- How it works --------------------------- */

const STEPS = [
  {
    n: "01",
    title: "Pick a therapy",
    desc: "Choose the type of counselling that fits your needs, individual, couple or family therapy.",
  },
  {
    n: "02",
    title: "Book an appointment",
    desc: "Select a convenient date and time slot for your online or in-person session.",
  },
  {
    n: "03",
    title: "Meet a therapist",
    desc: "Speak with a licensed, experienced therapist who provides personalised strategies for your concerns.",
  },
];

function HowItWorks({ copy }: { copy: HomepageSectionCopy }) {
  return (
    <section className="bg-brand-deep py-14 text-white sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="eyebrow text-white/60">{copy.eyebrow}</p>
        <h2 className="mt-2 max-w-2xl text-white">{copy.title}</h2>
        {copy.body ? <p className="mt-3 max-w-2xl text-white/70">{copy.body}</p> : null}

        <div className="mt-8 grid gap-5 md:grid-cols-3 lg:mt-10">
          {STEPS.map((step, i) => (
            <div
              key={step.n}
              className="relative rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:bg-white/10 hover:shadow-lg sm:p-6"
            >
              <span className="ref-mono text-sm text-white">{step.n}</span>
              <h3 className="mt-3 text-xl font-semibold text-white">{step.title}</h3>
              <p className="mt-2 text-sm text-white/70">{step.desc}</p>
              {i < STEPS.length - 1 && (
                <ArrowRight
                  aria-hidden
                  className="absolute -right-3 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-white/40 md:block"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------------------------- Pricing --------------------------- */

function Pricing({ copy, settings }: { copy: HomepageSectionCopy; settings: HomePricingSettings }) {
  const [billing, setBilling] = useState<HomePricingBilling>(settings.defaultBilling);

  useEffect(() => {
    setBilling(settings.defaultBilling);
  }, [settings.defaultBilling]);
  return (
    <section className="bg-surface-page pt-12 pb-14 sm:pt-16 sm:pb-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">{copy.eyebrow}</p>
            <h2 className="mt-2 max-w-2xl text-brand-deep">{copy.title}</h2>
            {copy.body ? <p className="mt-3 max-w-2xl text-muted-foreground">{copy.body}</p> : null}
          </div>
          <a
            href={settings.fullPricingHref}
            target={/^https?:\/\//i.test(settings.fullPricingHref) ? "_blank" : undefined}
            rel={/^https?:\/\//i.test(settings.fullPricingHref) ? "noopener noreferrer" : undefined}
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-blue-deep hover:text-brand-deep"
          >
            {settings.fullPricingLabel} <ArrowRight className="h-4 w-4" />
          </a>
        </div>

        <div
          role="radiogroup"
          aria-label="Billing period"
          className="mt-8 inline-flex items-center rounded-full border border-border/70 bg-card p-1 text-sm"
        >
          {(["single", "monthly"] as const).map((option) => {
            const active = billing === option;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setBilling(option)}
                className={cn(
                  "rounded-full px-4 py-1.5 font-medium transition-colors",
                  active ? "bg-brand-deep text-white" : "text-brand-deep/70 hover:text-brand-deep",
                )}
              >
                {option === "single" ? settings.singleTabLabel : settings.monthlyTabLabel}
              </button>
            );
          })}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {settings.plans.map((plan) => {
            const tier = plan[billing];
            const href = billing === "single" ? plan.href : plan.hrefMonthly;
            return (
              <article
                key={plan.name}
                className={cn(
                  "flex flex-col rounded-2xl border p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg",
                  plan.highlight
                    ? "border-brand-deep bg-brand-deep text-white shadow-lg"
                    : "border-border/70 bg-card text-foreground",
                )}
              >
                <div className="flex items-center justify-between">
                  <h3
                    className={cn(
                      "text-lg font-semibold",
                      plan.highlight ? "text-white" : "text-brand-deep",
                    )}
                  >
                    {plan.name}
                  </h3>
                  {plan.highlight && plan.badgeLabel ? (
                    <span className="rounded-full bg-brand-mint-soft px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-deep">
                      {plan.badgeLabel}
                    </span>
                  ) : null}
                </div>
                <div className="mt-6">
                  <span
                    className={cn(
                      "ref-mono text-4xl font-semibold",
                      plan.highlight ? "text-white" : "text-brand-deep",
                    )}
                  >
                    {tier.price}
                  </span>
                  <p
                    className={cn(
                      "mt-1 text-xs",
                      plan.highlight ? "text-white/70" : "text-muted-foreground",
                    )}
                  >
                    {tier.cadence}
                  </p>
                </div>
                <p
                  className={cn(
                    "mt-4 text-sm",
                    plan.highlight ? "text-white/80" : "text-muted-foreground",
                  )}
                >
                  {plan.description}
                </p>
                <ul className="mt-6 flex-1 space-y-2 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span
                        aria-hidden
                        className={cn(
                          "mt-1.5 h-1.5 w-1.5 flex-none rounded-full",
                          plan.highlight ? "bg-brand-mint" : "bg-brand-deep",
                        )}
                      />
                      <span className={plan.highlight ? "text-white/90" : ""}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  className={cn(
                    "mt-8",
                    plan.highlight
                      ? "bg-white text-brand-deep hover:bg-white/90"
                      : "bg-brand-deep text-white hover:bg-brand-deep/90",
                  )}
                >
                  <a
                    href={href}
                    target={/^https?:\/\//i.test(href) ? "_blank" : undefined}
                    rel={/^https?:\/\//i.test(href) ? "noopener noreferrer" : undefined}
                  >
                    {plan.ctaLabel}
                  </a>
                </Button>
              </article>
            );
          })}
        </div>

        {settings.note ? (
          <p className="mt-6 text-center text-xs text-muted-foreground">{settings.note}</p>
        ) : null}
      </div>
    </section>
  );
}

/* --------------------------- Reviews --------------------------- */

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
  return initials || "TS";
}

function ReviewAvatar({ name, src }: { name: string; src?: string }) {
  const [hasImageError, setHasImageError] = useState(false);
  const shouldShowImage = Boolean(src) && !hasImageError;

  if (shouldShowImage) {
    return (
      <OptimizedImage
        src={src}
        alt=""
        width={200}
        height={200}
        loading="lazy"
        className="h-16 w-16 rounded-full object-cover ring-2 ring-white sm:h-20 sm:w-20"
        data-review-avatar="image"
        referrerPolicy="no-referrer"
        onError={() => setHasImageError(true)}
      />
    );
  }

  return (
    <div
      className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-olive text-lg font-bold uppercase text-white ring-2 ring-white sm:h-20 sm:w-20 sm:text-xl"
      data-review-avatar="initials"
      aria-hidden
    >
      {getInitials(name)}
    </div>
  );
}

function Reviews({
  testimonials,
  googleReviews,
  copy,
}: {
  testimonials: PublicTestimonial[];
  googleReviews: GoogleReviewSettings;
  copy: HomepageSectionCopy;
}) {
  const slides =
    googleReviews.reviews.length > 0
      ? googleReviews.reviews.map((review) => ({
          review: {
            name: review.name,
            quote: review.quote,
            role: review.location ?? "Happy Client",
          },
          avatar: review.avatarUrl,
        }))
      : testimonials.length > 0
        ? testimonials.map((testimonial) => ({
            review: {
              name: testimonial.authorName,
              quote: testimonial.quote,
              role: testimonial.authorRole ?? "Happy Client",
            },
            avatar: testimonial.avatarUrl ?? undefined,
          }))
        : REVIEWS.map((review) => ({
            review: {
              name: review.name,
              quote: review.quote,
              role: "Happy Client",
            },
            avatar: undefined,
          }));
  const [groupSize, setGroupSize] = useState(1);
  const [activeGroup, setActiveGroup] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const groups = chunkSlides(slides, groupSize);

  const scrollToGroup = useCallback((index: number, behavior: ScrollBehavior = "smooth") => {
    const viewport = viewportRef.current;
    const group = viewport?.querySelector<HTMLElement>(`[data-review-group="${index}"]`);
    if (!viewport || !group) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    viewport.scrollTo({
      left: group.offsetLeft,
      behavior: prefersReducedMotion ? "auto" : behavior,
    });
  }, []);

  useEffect(() => {
    const setResponsiveGroupSize = () => {
      const width = window.innerWidth;
      setGroupSize(width >= 1100 ? 3 : width >= 700 ? 2 : 1);
    };
    setResponsiveGroupSize();
    window.addEventListener("resize", setResponsiveGroupSize);
    return () => window.removeEventListener("resize", setResponsiveGroupSize);
  }, []);

  useEffect(() => {
    setActiveGroup((current) => Math.min(current, Math.max(groups.length - 1, 0)));
  }, [groups.length]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || isPaused || groups.length <= 1) return;

    const interval = window.setInterval(() => {
      setActiveGroup((current) => {
        const next = (current + 1) % groups.length;
        scrollToGroup(next);
        return next;
      });
    }, 4500);

    return () => window.clearInterval(interval);
  }, [groups.length, isPaused, scrollToGroup]);

  function syncActiveGroupFromScroll() {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const groupElements = Array.from(viewport.querySelectorAll<HTMLElement>("[data-review-group]"));
    const nearest = groupElements.reduce(
      (best, group, index) => {
        const distance = Math.abs(group.offsetLeft - viewport.scrollLeft);
        return distance < best.distance ? { index, distance } : best;
      },
      { index: 0, distance: Number.POSITIVE_INFINITY },
    );
    setActiveGroup(nearest.index);
  }

  return (
    <section className="bg-[#f8f8f8] py-16 sm:py-24">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <SectionBadge>{copy.eyebrow}</SectionBadge>
          <h2 className="font-display mt-5 text-brand-deep">{copy.title}</h2>
          {copy.body ? (
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">{copy.body}</p>
          ) : null}
        </div>

        <div
          ref={viewportRef}
          className="reviews-carousel relative mt-12 overflow-x-auto overflow-y-visible py-10 sm:mt-16"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onFocus={() => setIsPaused(true)}
          onBlur={() => setIsPaused(false)}
          onPointerDown={(event) => {
            if (event.pointerType !== "mouse") setIsPaused(true);
          }}
          onPointerUp={(event) => {
            if (event.pointerType !== "mouse") setIsPaused(false);
          }}
          onScroll={syncActiveGroupFromScroll}
        >
          <div className="flex items-stretch gap-6" aria-label="Client testimonials carousel">
            {groups.map((group, groupIndex) => (
              <div
                key={`review-group-${groupIndex}`}
                data-review-group={groupIndex}
                className="flex w-full min-w-full shrink-0 gap-6"
              >
                {group.map((slide, slideIndex) => (
                  <div
                    key={`${slide.review.name}-${groupIndex}-${slideIndex}`}
                    data-review-slide="true"
                    className="flex min-w-0 flex-1"
                  >
                    <figure className="relative flex min-h-[22rem] w-full flex-col rounded-[1.75rem] bg-white px-6 pb-7 pt-14 text-center shadow-[0_18px_35px_rgba(31,41,55,0.12)] transition-transform duration-300 hover:-translate-y-1 sm:px-8">
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 rounded-full bg-white p-1.5 shadow-[0_10px_18px_rgba(31,41,55,0.16)]">
                        <ReviewAvatar name={slide.review.name} src={slide.avatar} />
                      </div>
                      <blockquote className="relative flex flex-1 items-center text-sm leading-8 text-muted-foreground sm:text-base">
                        <span
                          className="absolute left-0 top-0 text-3xl leading-none text-accent-terracotta/50"
                          aria-hidden
                        >
                          “
                        </span>
                        <p className="w-full text-justify hyphens-auto">{slide.review.quote}</p>
                        <span
                          className="absolute bottom-0 right-0 text-3xl leading-none text-accent-terracotta/50"
                          aria-hidden
                        >
                          ”
                        </span>
                      </blockquote>
                      <div
                        className="mt-6 flex justify-center gap-0.5 text-[#f5b400]"
                        role="img"
                        aria-label="5 out of 5 stars"
                      >
                        {[0, 1, 2, 3, 4].map((star) => (
                          <Star key={star} className="h-4 w-4 fill-current" aria-hidden />
                        ))}
                      </div>
                      <figcaption className="mt-4">
                        <p className="truncate text-lg font-bold text-accent-terracotta">
                          {slide.review.name}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">{slide.review.role}</p>
                      </figcaption>
                    </figure>
                  </div>
                ))}
                {Array.from({ length: groupSize - group.length }).map((_, fillerIndex) => (
                  <div
                    key={`review-filler-${groupIndex}-${fillerIndex}`}
                    className="hidden min-w-0 flex-1 sm:block"
                    aria-hidden
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        {groups.length > 1 ? (
          <div className="mt-2 flex justify-center gap-2" aria-hidden>
            {groups.map((_, index) => (
              <span
                key={`review-dot-${index}`}
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
                  activeGroup === index ? "w-6 bg-accent-terracotta" : "w-2 bg-border",
                )}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function chunkSlides<T>(items: T[], size: number): T[][] {
  const chunkSize = Math.max(1, size);
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

/* --------------------------- Journal --------------------------- */

const FALLBACK_POSTS = [
  {
    slug: "choose-wisely-we-only-get-time-and-choice",
    title: "Choosing Wisely With Time and Care",
    excerpt:
      "A reflective guide to noticing patterns, making grounded decisions, and entering a new season with more emotional clarity.",
    image: heroConversationImg,
    date: "December 24, 2025",
    category: "Self-reflection",
  },
  {
    slug: "beyond-silence",
    title: "Beyond Silence: Men Must Speak to Heal",
    excerpt:
      "How cultural expectations around masculinity can shape distress, connection, and the courage to seek support.",
    image: articleManPortraitImg,
    date: "June 15, 2025",
    category: "Men's mental health",
  },
  {
    slug: "why-marriage-does-not-work",
    title: "Why Some Marriages Struggle to Work",
    excerpt:
      "A practical look at emotional safety, communication, and the skills couples need for healthier partnership.",
    image: articleConversationImg,
    date: "April 10, 2025",
    category: "Relationships",
  },
] as const;

function Journal({ posts, copy }: { posts: RenderedContentEntry[]; copy: HomepageSectionCopy }) {
  const journalPosts = posts.length > 0 ? posts.slice(0, 3) : FALLBACK_POSTS;

  return (
    <section className="bg-surface-page py-14 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">{copy.eyebrow}</p>
            <h2 className="mt-2 max-w-2xl text-brand-deep">{copy.title}</h2>
          </div>
          <Link
            to="/blog"
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-blue-deep hover:text-brand-deep"
          >
            All posts <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {journalPosts.map((p, index) => {
            const image =
              "imageUrl" in p
                ? p.imageUrl || FALLBACK_POSTS[index % FALLBACK_POSTS.length].image
                : p.image;

            return (
              <article
                key={p.slug}
                className="group flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="aspect-[16/10] overflow-hidden bg-brand-blue-soft">
                  <OptimizedImage
                    src={image}
                    alt={p.title}
                    width={1600}
                    height={1067}
                    loading="lazy"
                    sizes="(max-width: 768px) calc(100vw - 2rem), (max-width: 1280px) 33vw, 420px"
                    className="h-full w-full object-cover saturate-[0.92] transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span className="font-semibold text-brand-deep">{p.category}</span>
                    <span aria-hidden>·</span>
                    <span>{p.date}</span>
                  </div>
                  <h3 className="mt-2 text-lg font-semibold text-brand-deep">{p.title}</h3>
                  <p className="mt-2 flex-1 text-sm text-muted-foreground">{p.excerpt}</p>
                  <Link
                    to="/blog/$slug"
                    params={{ slug: p.slug }}
                    className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-brand-deep"
                  >
                    Read the essay <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* --------------------------- FAQ --------------------------- */

const FAQS = [
  {
    q: "Are sessions really confidential?",
    a: "Yes. Your sessions are 100% confidential in a safe, judgement-free space. We only share information with your explicit consent, or where required by law (e.g. imminent risk to life).",
  },
  {
    q: "How do I know which therapy is right for me?",
    a: "Pick the type of counselling that fits your needs, individual, couple or family therapy, and our care team will match you with a licensed therapist whose training and style suit your concerns.",
  },
  {
    q: "Do you offer online sessions?",
    a: "Yes. Flexible timing, personalised therapy and expert care, all from your own space, delivered by secure video anywhere in Nigeria or the diaspora.",
  },
  {
    q: "How much do sessions cost?",
    a: "Individual therapy is ₦55,000 (60 minutes), couple therapy is ₦90,000 (90 minutes) and teen/child therapy is ₦50,000. One-month plans are available at a discount.",
  },
  {
    q: "What if I'm in a crisis right now?",
    a: "Talk Space is not a crisis or emergency service. If you or someone you know is at immediate risk, please call 112 or see our emergency support page.",
  },
] as const;

function FAQ({ copy }: { copy: HomepageSectionCopy }) {
  return (
    <section id="faq" aria-labelledby="faq-heading" className="bg-white py-14 sm:py-20">
      <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.4fr] lg:px-8">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h2 id="faq-heading" className="mt-2 text-brand-deep">
            {copy.title}
          </h2>
          <p className="mt-4 text-muted-foreground">
            Can't find what you're looking for?{" "}
            <Link to="/contact" className="text-link">
              Send us a message
            </Link>
            .
          </p>
        </div>

        <Accordion type="single" collapsible className="w-full">
          {FAQS.map((item, i) => (
            <AccordionItem key={item.q} value={`faq-${i}`}>
              <AccordionTrigger className="text-left text-brand-deep hover:no-underline">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

/* --------------------------- Final CTA --------------------------- */

function FinalCTA({ copy }: { copy: HomepageSectionCopy }) {
  return (
    <section className="bg-surface-page pb-20 sm:pb-28">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-brand-deep px-6 py-14 text-white shadow-soft-warm sm:px-12 sm:py-20">
          <div
            aria-hidden
            className="motion-glow absolute -right-16 -top-16 h-64 w-64 rounded-full bg-brand-mint/20 blur-3xl"
          />
          <div
            aria-hidden
            className="absolute -bottom-24 -left-10 h-64 w-64 rounded-full bg-brand-blue/30 blur-3xl"
          />

          <div className="relative grid gap-8 lg:grid-cols-[1.5fr_1fr] lg:items-center">
            <div>
              <p className="eyebrow text-white/60">{copy.eyebrow}</p>
              <h2 className="mt-3 max-w-2xl text-white">{copy.title}</h2>
              <p className="mt-4 max-w-xl text-white/80">
                Book a session with a Talk Space therapist today, online or in person at our Abuja
                or Lagos offices. Call{" "}
                <a href={TS.phone.ngHref} className="text-link text-white hover:text-brand-mint">
                  {TS.phone.ng}
                </a>{" "}
                or{" "}
                <a
                  href={`tel:+${TS.phone.whatsappNumber}`}
                  className="text-link text-white hover:text-brand-mint"
                >
                  {TS.phone.whatsapp}
                </a>
                .
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Button asChild size="lg" className="bg-white text-brand-deep hover:bg-white/90">
                <Link to="/book">
                  Book a session
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <Link to="/contact">Talk to our team</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
