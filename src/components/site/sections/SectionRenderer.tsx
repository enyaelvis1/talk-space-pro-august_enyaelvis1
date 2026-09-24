import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Clock,
  HeartHandshake,
  Leaf,
  LifeBuoy,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import type { ComponentType, ReactNode, SVGProps } from "react";

import { ContentHtml } from "@/components/content/ContentHtml";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { AutoPlayGallery } from "@/components/site/AutoPlayGallery";
import { OptimizedImage } from "@/components/site/OptimizedImage";
import { Reveal } from "@/components/site/Reveal";
import { Section } from "@/components/site/Section";
import { Button } from "@/components/ui/button";
import type { PageSection, SectionCard, SectionLink } from "@/lib/page-sections";
import { pricingCardImage } from "@/lib/pricing-card-images";
import { resolveImageSrc } from "@/lib/site-assets";
import { cn } from "@/lib/utils";

import { LiveContactForm, LiveFaqList, LiveTherapistList } from "./LiveSections";
import { EditableText } from "./EditableText";

export type SectionEditingProps = {
  /** Turn on inline text editing inside the rendered section. */
  editing?: boolean;
  /** Called with a dotted path (`cards.0.title`) whenever inline text changes. */
  onTextChange?: (sectionId: string, path: string, value: string) => void;
  selectedId?: string | null;
  onSelect?: (sectionId: string) => void;
  /** Editing chrome rendered on top of each section (move/delete/settings). */
  renderOverlay?: (section: PageSection, index: number) => ReactNode;
  /** Rendered after each section, e.g. an "add section here" affordance. */
  renderInsert?: (index: number) => ReactNode;
};

type SectionRendererProps = SectionEditingProps & {
  sections: PageSection[];
  className?: string;
};

const spacingMap = { sm: "none", md: "default", lg: "lg" } as const;
const widthMap = { narrow: "narrow", content: "content", wide: "wide", full: "none" } as const;
const surfaceMap = { page: "none", cream: "cream", card: "card", deep: "none" } as const;
const aboutValueIcons = [ShieldCheck, HeartHandshake, Leaf, Sparkles] as const;
const contactGridIds = ["contact-channels", "contact-offices"] as const;
const contactCardIcons: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  "contact-whatsapp": WhatsAppIcon,
  "contact-phone": Phone,
  "contact-email": Mail,
  "contact-abuja": MapPin,
  "contact-lagos": MapPin,
  "contact-hours": Clock,
};

function isContactGrid(sectionId: string) {
  return contactGridIds.includes(sectionId as (typeof contactGridIds)[number]);
}

function isPricingFaq(sectionId: string) {
  return sectionId === "pricing-faq";
}

function isEmergencySection(sectionId: string) {
  return sectionId.startsWith("emergency-");
}

function getAboutIntroParagraphs(section: PageSection): string[] | null {
  if (!("body" in section) || !("eyebrow" in section) || !("heading" in section)) return null;
  const body = section.body.trim();
  if (!body) return null;

  const isAboutIntro =
    section.id === "about-hero" ||
    section.eyebrow.toLowerCase().includes("about talk space") ||
    section.heading.toLowerCase().includes("we didn't name ourselves") ||
    section.heading.toLowerCase().includes("we didn’t name ourselves");

  if (!isAboutIntro) return null;

  const existingParagraphs = body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  if (existingParagraphs.length > 1) return existingParagraphs;

  const sentences = body
    .split(/(?<=[.!?][”"]?)\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  if (sentences.length < 4) return [body];

  return [
    sentences.slice(0, 2).join(" "),
    sentences.slice(2, 4).join(" "),
    sentences.slice(4, 5).join(" "),
    sentences.slice(5, 6).join(" "),
    sentences.slice(6).join(" "),
  ].filter(Boolean);
}

function normalizeContactCard(card: SectionCard): SectionCard {
  switch (card.id) {
    case "contact-whatsapp":
      return {
        ...card,
        body: card.body === "+234 809 993 1039" ? "+234 704 846 9090" : card.body,
        tagline:
          card.tagline === "Fastest response · Mon-Fri, 10am-5pm"
            ? "Fastest response · Mon-Fri, 9am-5pm"
            : card.tagline,
        href:
          card.href === "https://wa.me/2348099931039" ? "https://wa.me/2347048469090" : card.href,
      };
    case "contact-phone":
      return {
        ...card,
        tagline: card.tagline === "Mon-Fri, 10am-5pm WAT" ? "Mon-Fri, 9am-5pm WAT" : card.tagline,
      };
    case "contact-email":
      return {
        ...card,
        body: card.body.trim() ? card.body : "hello@talkspace.ng",
        href: card.href.trim() ? card.href : "mailto:hello@talkspace.ng",
        linkLabel: card.linkLabel.trim() ? card.linkLabel : "Send an email",
      };
    case "contact-abuja":
      return {
        ...card,
        title: card.title === "Abuja" ? "Abuja (FCT)" : card.title,
        body:
          card.body === "T-Pumpy Estate, Abuja, Nigeria."
            ? "Plot 153A, T-Pumpy Estate\nOpp. NIU Estate, Off Saburi 1, FCT, Abuja"
            : card.body,
        bullets:
          card.bullets.length === 1 && card.bullets[0] === "In-person sessions by appointment only"
            ? ["In-person sessions by appointment only."]
            : card.bullets,
      };
    case "contact-lagos":
      return {
        ...card,
        title: "Talk Space Counseling, Lagos",
        body:
          card.body === "Ladipo Kasumu Street, Ikeja, Lagos, Nigeria." ||
          card.body === "20, Estaport Avenue, Gbagada, Lagos, Nigeria."
            ? "Abiodun Oshowole Cl, off Oluwaleimu Street\nAllen, Ikeja 101233, Lagos"
            : card.body,
        bullets:
          card.bullets.length === 1 && card.bullets[0] === "In-person sessions by appointment only"
            ? ["In-person sessions by appointment only."]
            : card.bullets,
      };
    case "contact-hours":
      return {
        ...card,
        body: card.body === "When our care team is available." ? "" : card.body,
        bullets: card.bullets.map((bullet) => {
          if (bullet === "Monday to Friday: 10:00 to 17:00") {
            return "Monday to Friday: 9:00 to 17:00";
          }
          if (bullet === "Saturday: by appointment") return "Saturday: By appointment";
          if (bullet === "Sunday: closed") return "Sunday: Closed";
          return bullet;
        }),
      };
    default:
      return card;
  }
}

function ButtonLink({
  link,
  className,
  size = "lg",
}: {
  link: Omit<SectionLink, "variant"> & { variant: SectionLink["variant"] | "terracotta" };
  className?: string;
  size?: "default" | "sm" | "lg" | "icon" | "pill" | "pillLg";
}) {
  if (!link.label) return null;
  const external = /^https?:\/\//.test(link.href);
  const variant = link.variant === "primary" ? "default" : link.variant;
  const content = <span>{link.label}</span>;
  if (external || !link.href.startsWith("/")) {
    return (
      <Button
        asChild
        size={size}
        variant={variant === "link" ? "link" : variant}
        className={className}
      >
        <a href={link.href || "#"}>{content}</a>
      </Button>
    );
  }
  return (
    <Button
      asChild
      size={size}
      variant={variant === "link" ? "link" : variant}
      className={className}
    >
      <Link to={link.href}>{content}</Link>
    </Button>
  );
}

function SectionImage({
  src,
  alt,
  className,
  width = 1200,
  height = 900,
}: {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
}) {
  const resolved = resolveImageSrc(src);
  if (!resolved) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-3xl border border-dashed border-border bg-muted/40 text-xs text-muted-foreground",
          className,
        )}
      >
        No image selected
      </div>
    );
  }
  return (
    <OptimizedImage
      src={resolved}
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
      className={className}
    />
  );
}

function SectionBody({
  section,
  edit,
}: {
  section: PageSection;
  edit: (path: string) => ((value: string) => void) | undefined;
}) {
  const editing = Boolean(edit("__probe__"));
  const text = (path: string, value: string, className?: string, multiline = false) => (
    <EditableText
      as="span"
      value={value}
      editing={editing}
      onChange={edit(path)}
      multiline={multiline}
      placeholder={path}
      className={className}
    />
  );

  switch (section.type) {
    case "hero": {
      if (section.id === "about-story") {
        const paragraphs = section.body
          .split(/\n{2,}/)
          .map((paragraph) => paragraph.trim())
          .filter(Boolean);

        return (
          <div className="grid items-center gap-12 py-20 lg:grid-cols-[0.92fr_1fr] lg:gap-16 lg:py-24">
            <SectionImage
              src={section.image.src}
              alt={section.image.alt || section.heading}
              className="aspect-[1.22/1] w-full rounded-[1.5rem] object-cover shadow-soft-warm"
              width={1100}
              height={900}
            />
            <div className="max-w-3xl">
              {(section.eyebrow || editing) && (
                <p className="eyebrow">{text("eyebrow", section.eyebrow)}</p>
              )}
              <h2 className="mt-6 font-display text-3xl leading-tight text-brand-deep sm:text-4xl">
                {text("heading", section.heading)}
              </h2>
              {editing ? (
                <p className="mt-8 whitespace-pre-line text-base leading-8 text-muted-foreground">
                  {text("body", section.body, undefined, true)}
                </p>
              ) : (
                <div className="mt-8 space-y-6 text-base leading-8 text-muted-foreground">
                  {paragraphs.map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      }

      if (section.id === "contact-hero") {
        return (
          <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
            {(section.eyebrow || editing) && (
              <p className="eyebrow">{text("eyebrow", section.eyebrow)}</p>
            )}
            <h1 className="display-1 mt-6 text-brand-deep">
              {text("heading", section.heading)}{" "}
              {(section.headingEmphasis || editing) && (
                <em className="italic text-accent-terracotta">
                  {text("headingEmphasis", section.headingEmphasis)}
                </em>
              )}
              {text("headingAfter", section.headingAfter)}
            </h1>
            {(section.body || editing) &&
              (editing ? (
                <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
                  {text("body", section.body, undefined, true)}
                </p>
              ) : (
                <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
                  Our care team responds within one working day. If you are in a crisis right now,
                  please see our{" "}
                  <Link to="/emergency-support" className="text-link">
                    emergency support page
                  </Link>
                  .
                </p>
              ))}
          </div>
        );
      }

      if (section.id === "emergency-hero") {
        return (
          <div className="py-10 pb-6 sm:py-14 sm:pb-6 lg:py-20 lg:pb-6">
            <h1 className="display-1 max-w-3xl text-brand-deep">
              {text("heading", section.heading)}{" "}
              {(section.headingEmphasis || editing) && (
                <span>{text("headingEmphasis", section.headingEmphasis)}</span>
              )}
              {text("headingAfter", section.headingAfter)}
            </h1>
            {(section.body || editing) && (
              <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
                {text("body", section.body, undefined, true)}
                {!editing && (
                  <>
                    {" "}
                    If life is at immediate risk, dial{" "}
                    <strong className="text-foreground">112</strong> and stay on the line.
                  </>
                )}
              </p>
            )}
          </div>
        );
      }

      const centered = section.align === "center";
      const aboutIntroParagraphs = editing ? null : getAboutIntroParagraphs(section);
      return (
        <div
          className={cn(
            "grid items-center gap-10",
            section.image.src ? "lg:grid-cols-2" : "lg:grid-cols-1",
          )}
        >
          <div className={cn(centered && !section.image.src && "mx-auto max-w-3xl text-center")}>
            {(section.eyebrow || editing) && (
              <p className={cn("eyebrow", centered && "text-center")}>
                {text("eyebrow", section.eyebrow)}
              </p>
            )}
            <h1 className="display-1 mt-4 text-brand-deep">
              {text("heading", section.heading)}{" "}
              {(section.headingEmphasis || editing) && (
                <em className="italic text-accent-terracotta">
                  {text("headingEmphasis", section.headingEmphasis)}
                </em>
              )}{" "}
              {text("headingAfter", section.headingAfter)}
            </h1>
            {(section.body || editing) &&
              (aboutIntroParagraphs ? (
                <div
                  className={cn(
                    "mt-6 max-w-2xl space-y-5 text-justify text-lg leading-8 text-muted-foreground",
                    centered && !section.image.src && "mx-auto",
                  )}
                >
                  {aboutIntroParagraphs.map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </div>
              ) : (
                <p
                  className={cn(
                    "mt-6 max-w-2xl text-lg leading-8 text-muted-foreground",
                    centered && !section.image.src && "mx-auto",
                  )}
                >
                  {text("body", section.body, undefined, true)}
                </p>
              ))}
            {section.links.length > 0 && (
              <div
                className={cn(
                  "mt-8 flex flex-wrap gap-3",
                  centered && !section.image.src && "justify-center",
                )}
              >
                {section.links.map((link) => (
                  <ButtonLink key={link.id} link={link} />
                ))}
              </div>
            )}
          </div>
          {section.image.src ? (
            <SectionImage
              src={section.image.src}
              alt={section.image.alt || section.heading}
              className="aspect-4/5 w-full rounded-[2rem] object-cover shadow-soft-warm"
              width={900}
              height={1100}
            />
          ) : null}
        </div>
      );
    }

    case "richText":
      return (
        <div>
          {(section.heading || editing) && (
            <h2 className="display-2 mb-6 text-brand-deep">{text("heading", section.heading)}</h2>
          )}
          <div className="content-body">
            <ContentHtml html={section.html} />
          </div>
        </div>
      );

    case "cardGrid": {
      if (section.id === "emergency-lines") {
        return (
          <div className="pb-6 sm:pb-10">
            <ul className="grid gap-4 sm:gap-5 md:grid-cols-2">
              {section.cards.map((card, index) => {
                const [numberText, ...hourParts] = card.tagline.split("·");
                const hours = hourParts.join("·").trim() || "24 hours, 7 days a week";
                const isFeatured = card.id === "line-112";
                const numbers = numberText
                  .split(/\s+or\s+/i)
                  .map((item) => item.trim())
                  .filter(Boolean);

                return (
                  <li
                    key={card.id}
                    className={cn(
                      "rounded-2xl border p-6 transition-colors sm:p-8",
                      isFeatured
                        ? "border-destructive/30 bg-destructive/5"
                        : "border-border/70 bg-card hover:border-brand-deep/30 hover:bg-brand-blue-soft/30",
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {isFeatured && !editing ? (
                          <span className="inline-flex items-center rounded-full bg-destructive px-2.5 py-0.5 text-xs font-semibold text-destructive-foreground">
                            Emergency
                          </span>
                        ) : null}
                        <h2 className="text-base font-semibold text-brand-deep sm:text-lg">
                          {text(`cards.${index}.title`, card.title)}
                        </h2>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {(numbers.length > 0 ? numbers : [card.linkLabel || card.title]).map(
                          (number, numberIndex) => (
                            <a
                              key={`${card.id}-${numberIndex}`}
                              href={
                                numberIndex === 0
                                  ? card.href
                                  : `tel:+234${number.replace(/\D/g, "").replace(/^0/, "")}`
                              }
                              className="ref-mono inline-flex items-center gap-2 rounded-lg bg-brand-deep px-4 py-3 text-lg font-semibold text-white transition-colors hover:bg-brand-deep/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                              aria-label={`Call ${card.title} on ${number}`}
                            >
                              <Phone className="h-4 w-4" aria-hidden />
                              {number}
                            </a>
                          ),
                        )}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" aria-hidden />
                          {editing ? text(`cards.${index}.tagline`, card.tagline) : hours}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <LifeBuoy className="h-3.5 w-3.5" aria-hidden />
                          {text(`cards.${index}.body`, card.body, undefined, true)}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      }

      if (section.id === "emergency-expect") {
        const icons = [Phone, Users, ShieldCheck, Clock] as const;
        return (
          <div className="py-12 sm:py-16">
            <h2 className="text-brand-deep">
              {section.heading === "Calling a crisis line."
                ? "What to expect when you call"
                : text("heading", section.heading)}
            </h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              It is normal to feel nervous. Crisis responders are trained to help you through the
              first steps calmly and quickly.
            </p>
            <ol className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {section.cards.map((card, index) => {
                const Icon = icons[index] ?? LifeBuoy;
                return (
                  <li
                    key={card.id}
                    className="rounded-2xl border border-border/70 bg-surface-page p-6"
                  >
                    <span
                      aria-hidden
                      className="grid h-10 w-10 place-items-center rounded-xl bg-brand-mint-soft text-brand-deep"
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <p className="mt-4 text-sm font-semibold text-brand-deep">
                      <span className="sr-only">Step {index + 1}: </span>
                      {text(`cards.${index}.title`, card.title)}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {text(`cards.${index}.body`, card.body, undefined, true)}
                    </p>
                  </li>
                );
              })}
            </ol>
          </div>
        );
      }

      if (section.id === "about-values") {
        const eyebrow =
          section.eyebrow === "What guides us" ? "Our values" : section.eyebrow || "Our values";
        const heading =
          section.heading === "Four commitments behind every session."
            ? "Four commitments we hold every session."
            : section.heading || "Four commitments we hold every session.";

        return (
          <div className="py-20 lg:py-24">
            <div>
              {(eyebrow || editing) && (
                <div>
                  <span className="inline-flex rounded-full bg-surface-cream px-4 py-2 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-brand-blue-deep">
                    {text("eyebrow", eyebrow)}
                  </span>
                </div>
              )}
              {(heading || editing) && (
                <h2 className="mt-6 max-w-4xl font-display text-3xl leading-tight text-brand-deep sm:text-4xl">
                  {text("heading", heading)}
                </h2>
              )}
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {section.cards.map((card, index) => {
                const Icon = aboutValueIcons[index] ?? Sparkles;
                return (
                  <Reveal key={card.id} delay={index * 70}>
                    <article className="flex min-h-[190px] flex-col rounded-[1.75rem] border border-border/70 bg-surface-card px-6 py-6 shadow-soft-warm">
                      <div className="grid size-11 place-items-center rounded-full bg-surface-cream text-brand-blue-deep">
                        <Icon className="size-5" strokeWidth={1.8} aria-hidden />
                      </div>
                      <h3 className="mt-7 text-lg font-semibold text-brand-deep">
                        {text(`cards.${index}.title`, card.title)}
                      </h3>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        {text(`cards.${index}.body`, card.body, undefined, true)}
                      </p>
                    </article>
                  </Reveal>
                );
              })}
            </div>
          </div>
        );
      }

      if (isContactGrid(section.id)) {
        const isChannelGrid = section.id === "contact-channels";
        return (
          <div className={cn(isChannelGrid ? "pt-12 sm:pt-14 lg:pt-16" : "pt-10 pb-24 sm:pt-12")}>
            <div className="grid items-stretch gap-x-7 gap-y-10 lg:grid-cols-3 xl:gap-x-8 xl:gap-y-12">
              {section.cards.map((card, index) => {
                const displayCard = normalizeContactCard(card);
                const Icon = contactCardIcons[card.id] ?? Mail;
                const isOfficeCard = card.id === "contact-abuja" || card.id === "contact-lagos";
                const isHoursCard = card.id === "contact-hours";
                const isExternal = /^https?:\/\//.test(displayCard.href);

                return (
                  <Reveal key={card.id} delay={index * 60}>
                    <article
                      className={cn(
                        "flex h-full flex-col rounded-[1.75rem] border border-border/70 bg-surface-card p-8 shadow-soft-warm sm:p-9 lg:p-10",
                        isChannelGrid ? "min-h-[306px]" : "min-h-[306px] lg:min-h-[258px]",
                      )}
                    >
                      <span className="grid size-10 place-items-center rounded-full bg-accent-terracotta-soft text-accent-terracotta">
                        <Icon className="size-5" aria-hidden />
                      </span>
                      <h3 className="mt-7 font-display text-xl text-brand-deep">
                        {text(`cards.${index}.title`, displayCard.title)}
                      </h3>
                      {isHoursCard ? (
                        <dl className="mt-4 space-y-1.5 text-sm text-brand-deep">
                          {displayCard.bullets.map((bullet, bulletIndex) => {
                            const [label, ...valueParts] = bullet.split(":");
                            const value = valueParts.join(":").trim();
                            return editing ? (
                              <div key={bulletIndex}>
                                <dt className="font-bold">
                                  {text(`cards.${index}.bullets.${bulletIndex}`, bullet)}
                                </dt>
                              </div>
                            ) : (
                              <div key={bulletIndex} className="grid grid-cols-[1fr_auto] gap-4">
                                <dt className="font-bold">{label.trim()}</dt>
                                <dd className="ref-mono text-right text-foreground">
                                  {value || " "}
                                </dd>
                              </div>
                            );
                          })}
                        </dl>
                      ) : (
                        <>
                          <p
                            className={cn(
                              "mt-3 whitespace-pre-line",
                              isOfficeCard
                                ? "text-sm font-bold leading-6 text-muted-foreground"
                                : "ref-mono text-base text-foreground",
                            )}
                          >
                            {text(`cards.${index}.body`, displayCard.body, undefined, true)}
                          </p>
                          {(displayCard.tagline || editing) && (
                            <p className="mt-2 text-xs font-bold leading-5 text-muted-foreground">
                              {text(`cards.${index}.tagline`, displayCard.tagline)}
                            </p>
                          )}
                          {isOfficeCard && displayCard.bullets.length > 0 && (
                            <p className="mt-auto pt-6 text-xs font-bold leading-5 text-muted-foreground">
                              {text(`cards.${index}.bullets.0`, displayCard.bullets[0])}
                            </p>
                          )}
                        </>
                      )}
                      {displayCard.href && displayCard.linkLabel ? (
                        <Button
                          asChild
                          variant="terracotta"
                          size="pill"
                          className="mt-auto w-full shadow-soft-warm"
                        >
                          <a
                            href={displayCard.href}
                            target={isExternal ? "_blank" : undefined}
                            rel={isExternal ? "noopener noreferrer" : undefined}
                          >
                            {text(`cards.${index}.linkLabel`, displayCard.linkLabel)}
                          </a>
                        </Button>
                      ) : null}
                    </article>
                  </Reveal>
                );
              })}
            </div>
          </div>
        );
      }

      const cols =
        section.columns === 1
          ? "sm:grid-cols-1"
          : section.columns === 2
            ? "sm:grid-cols-2"
            : section.columns === 4
              ? "sm:grid-cols-2 xl:grid-cols-4"
              : "sm:grid-cols-2 lg:grid-cols-3";
      const isPricingCardGrid = section.id.startsWith("pricing-");
      return (
        <div>
          <SectionHeader section={section} text={text} editing={editing} />
          <div className={cn("mt-12 grid gap-6", cols)}>
            {section.cards.map((card, index) => {
              const image = isPricingCardGrid ? pricingCardImage(card) : card.image;
              return (
                <Reveal key={card.id} delay={index * 60}>
                  <article className="flex h-full flex-col overflow-hidden rounded-[1.75rem] bg-card shadow-soft-warm ring-1 ring-border/60">
                    {(image.src || editing) && (
                      <SectionImage
                        src={image.src}
                        alt={image.alt || card.title}
                        className="aspect-4/3 w-full object-cover"
                        width={800}
                        height={600}
                      />
                    )}
                    <div className="flex flex-1 flex-col p-6">
                      {(card.tagline || editing) && (
                        <p className="eyebrow">{text(`cards.${index}.tagline`, card.tagline)}</p>
                      )}
                      <h3 className="mt-2 font-serif text-xl text-brand-deep">
                        {text(`cards.${index}.title`, card.title)}
                      </h3>
                      <p className="mt-3 flex-1 text-sm leading-7 text-muted-foreground">
                        {text(`cards.${index}.body`, card.body, undefined, true)}
                      </p>
                      {card.bullets.length > 0 && (
                        <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                          {card.bullets.map((bullet, bulletIndex) => (
                            <li key={bulletIndex} className="flex gap-2">
                              <span aria-hidden className="text-brand-sage">
                                •
                              </span>
                              {text(`cards.${index}.bullets.${bulletIndex}`, bullet)}
                            </li>
                          ))}
                        </ul>
                      )}
                      {card.href && card.linkLabel ? (
                        <div className="mt-5">
                          <ButtonLink
                            link={{
                              id: card.id,
                              label: card.linkLabel,
                              href: card.href,
                              variant: isPricingCardGrid ? "terracotta" : "link",
                            }}
                            size={isPricingCardGrid ? "pill" : "lg"}
                            className={
                              isPricingCardGrid ? "w-full shadow-soft-warm sm:w-auto" : undefined
                            }
                          />
                        </div>
                      ) : null}
                    </div>
                  </article>
                </Reveal>
              );
            })}
          </div>
        </div>
      );
    }

    case "featureList":
      return (
        <div>
          <SectionHeader section={section} text={text} editing={editing} />
          <div className="mt-14 space-y-16">
            {section.cards.map((card, index) => {
              const dark = card.tone === "dark";
              return (
                <Reveal key={card.id}>
                  <div
                    className={cn(
                      "grid items-center gap-8 lg:grid-cols-2",
                      index % 2 === 1 && "lg:[&>*:first-child]:order-2",
                      dark &&
                        "rounded-[2.25rem] bg-brand-deep p-6 shadow-soft-warm sm:p-10 lg:gap-12",
                    )}
                  >
                    <SectionImage
                      src={card.image.src}
                      alt={card.image.alt || card.title}
                      className="aspect-16/10 w-full rounded-[2rem] object-cover shadow-soft-warm"
                      width={1200}
                      height={750}
                    />
                    <div>
                      {(card.tagline || editing) && (
                        <p className={cn("eyebrow", dark && "text-primary-foreground/70")}>
                          {text(`cards.${index}.tagline`, card.tagline)}
                        </p>
                      )}
                      <h3
                        className={cn(
                          "display-2 mt-3",
                          dark ? "text-primary-foreground" : "text-brand-deep",
                        )}
                      >
                        {text(`cards.${index}.title`, card.title)}
                      </h3>
                      <p
                        className={cn(
                          "mt-4 text-base leading-8",
                          dark ? "text-primary-foreground/80" : "text-muted-foreground",
                        )}
                      >
                        {text(`cards.${index}.body`, card.body, undefined, true)}
                      </p>
                      {card.bullets.length > 0 && (
                        <ul
                          className={cn(
                            "mt-5 space-y-2 text-sm",
                            dark ? "text-primary-foreground/80" : "text-muted-foreground",
                          )}
                        >
                          {card.bullets.map((bullet, bulletIndex) => (
                            <li key={bulletIndex} className="flex gap-2">
                              <span
                                aria-hidden
                                className={dark ? "text-primary-foreground/60" : "text-brand-sage"}
                              >
                                •
                              </span>
                              {text(`cards.${index}.bullets.${bulletIndex}`, bullet)}
                            </li>
                          ))}
                        </ul>
                      )}
                      {card.href && card.linkLabel ? (
                        <div className="mt-6">
                          <ButtonLink
                            link={{
                              id: card.id,
                              label: card.linkLabel,
                              href: card.href,
                              variant: "outline",
                            }}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      );

    case "gallery":
      return (
        <div>
          {(section.heading || editing) && (
            <h2 className="display-2 container-content text-center text-brand-deep">
              {text("heading", section.heading)}
            </h2>
          )}
          <AutoPlayGallery
            durationSeconds={section.speedSeconds}
            images={section.images
              .map((image) => ({
                src: resolveImageSrc(image.src) ?? "",
                alt: image.alt,
                caption: image.caption || undefined,
              }))
              .filter((image) => image.src)}
          />
        </div>
      );

    case "callout":
      if (section.id === "emergency-banner") {
        return (
          <div className="bg-destructive">
            <div className="mx-auto flex max-w-7xl items-start gap-3 px-4 py-4 sm:items-center sm:px-6 lg:px-8">
              <AlertTriangle
                className="mt-0.5 h-5 w-5 shrink-0 text-destructive-foreground sm:mt-0"
                aria-hidden
              />
              <p className="text-sm font-medium text-destructive-foreground sm:text-base">
                Talk Space is not an emergency service. If you or someone you know is in immediate
                danger, use the numbers on this page.
              </p>
            </div>
          </div>
        );
      }

      return (
        <div className="rounded-[2rem] bg-brand-deep px-8 py-12 text-primary-foreground shadow-soft-warm sm:px-12">
          {(section.eyebrow || editing) && (
            <p className="eyebrow text-primary-foreground/70">{text("eyebrow", section.eyebrow)}</p>
          )}
          <h2 className="display-2 mt-3 text-primary-foreground">
            {text("heading", section.heading)}
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-8 text-primary-foreground/85">
            {text("body", section.body, undefined, true)}
          </p>
          {section.bullets.length > 0 && (
            <ul className="mt-6 grid gap-2 sm:grid-cols-2">
              {section.bullets.map((bullet, index) => (
                <li key={index} className="flex gap-2 text-sm text-primary-foreground/85">
                  <span aria-hidden>•</span>
                  {text(`bullets.${index}`, bullet)}
                </li>
              ))}
            </ul>
          )}
        </div>
      );

    case "cta":
      if (section.id === "emergency-cta") {
        return (
          <div className="mx-auto max-w-3xl py-12 text-center sm:py-16">
            <span
              aria-hidden
              className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-mint-soft text-brand-deep"
            >
              <ShieldCheck className="h-6 w-6" />
            </span>
            <h2 className="mt-5 text-brand-deep">
              {section.heading === "When the crisis has passed, we are here."
                ? "Once the crisis has passed"
                : text("heading", section.heading)}
            </h2>
            <p className="mt-3 text-muted-foreground">
              Therapy is one of the most helpful next steps. Talk Space can match you with a
              licensed therapist within one working day.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {section.links.map((link) => (
                <ButtonLink key={link.id} link={link} />
              ))}
            </div>
          </div>
        );
      }

      return (
        <div className={cn(section.align === "center" && "mx-auto max-w-3xl text-center")}>
          {(section.eyebrow || editing) && (
            <p className="eyebrow">{text("eyebrow", section.eyebrow)}</p>
          )}
          <h2 className="display-2 mt-3 text-brand-deep">{text("heading", section.heading)}</h2>
          <p className="mt-4 text-lg leading-8 text-muted-foreground">
            {text("body", section.body, undefined, true)}
          </p>
          <div
            className={cn(
              "mt-8 flex flex-wrap gap-3",
              section.align === "center" && "justify-center",
            )}
          >
            {section.links.map((link) => (
              <ButtonLink key={link.id} link={link} />
            ))}
          </div>
        </div>
      );

    case "faq":
      if (isPricingFaq(section.id)) {
        return (
          <div className="grid gap-10 py-20 lg:grid-cols-[1fr_1.4fr] lg:py-24">
            <div>
              {(section.eyebrow || editing) && (
                <p className="eyebrow">{text("eyebrow", section.eyebrow)}</p>
              )}
              {(section.heading || editing) && (
                <h2 className="mt-6 max-w-xl font-display text-3xl leading-tight text-brand-deep sm:text-4xl">
                  {text("heading", section.heading)}
                </h2>
              )}
              {(section.body || editing) && (
                <p className="mt-5 max-w-xl text-base leading-8 text-muted-foreground">
                  {text("body", section.body, undefined, true)}
                </p>
              )}
            </div>
            <dl className="divide-y divide-border/70">
              {section.items.map((item, index) => (
                <div key={item.id} className="py-6 first:pt-0">
                  <dt className="text-base font-semibold text-brand-deep">
                    {text(`items.${index}.question`, item.question)}
                  </dt>
                  <dd className="mt-3 text-sm leading-6 text-muted-foreground">
                    {text(`items.${index}.answer`, item.answer, undefined, true)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        );
      }

      return (
        <div>
          <SectionHeader section={section} text={text} editing={editing} />
          <dl className="mt-10 divide-y divide-border/70 border-y border-border/70">
            {section.items.map((item, index) => (
              <div key={item.id} className="py-6">
                <dt className="font-serif text-lg text-brand-deep">
                  {text(`items.${index}.question`, item.question)}
                </dt>
                <dd className="mt-2 text-sm leading-7 text-muted-foreground">
                  {text(`items.${index}.answer`, item.answer, undefined, true)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      );

    case "contactForm":
      return (
        <div>
          <SectionHeader section={section} text={text} editing={editing} />
          <div className="mt-10">
            <LiveContactForm />
          </div>
        </div>
      );

    case "faqList":
      return (
        <div>
          <SectionHeader section={section} text={text} editing={editing} />
          <div className="mt-10">
            <LiveFaqList />
          </div>
        </div>
      );

    case "therapistList":
      return (
        <div>
          <SectionHeader section={section} text={text} editing={editing} />
          <div className="mt-10">
            <LiveTherapistList columns={section.columns} />
          </div>
        </div>
      );

    case "spacer":
    default:
      return (
        <div
          className={cn(
            section.type === "spacer" && section.size === "sm" && "h-6",
            section.type === "spacer" && section.size === "md" && "h-14",
            section.type === "spacer" && section.size === "lg" && "h-24",
            "flex items-center",
          )}
        >
          {section.type === "spacer" && section.divider ? (
            <hr className="w-full border-border/70" />
          ) : null}
        </div>
      );
  }
}

function SectionHeader({
  section,
  text,
  editing,
}: {
  section: Extract<PageSection, { eyebrow: string; heading: string; body: string }>;
  text: (path: string, value: string, className?: string, multiline?: boolean) => ReactNode;
  editing: boolean;
}) {
  const centered = section.align === "center";
  if (!section.eyebrow && !section.heading && !section.body && !editing) return null;
  return (
    <div className={cn(centered && "mx-auto max-w-3xl text-center")}>
      {(section.eyebrow || editing) && (
        <p className="eyebrow">{text("eyebrow", section.eyebrow)}</p>
      )}
      {(section.heading || editing) && (
        <h2 className="display-2 mt-3 text-brand-deep">{text("heading", section.heading)}</h2>
      )}
      {(section.body || editing) && (
        <p className="mt-4 text-base leading-8 text-muted-foreground">
          {text("body", section.body, undefined, true)}
        </p>
      )}
    </div>
  );
}

/**
 * Renders the data-driven sections of a page. The same component powers the
 * public site, the admin builder canvas and the live on-page editor, so what
 * an admin edits is exactly what a visitor sees.
 */
export function SectionRenderer({
  sections,
  editing = false,
  onTextChange,
  selectedId,
  onSelect,
  renderOverlay,
  renderInsert,
  className,
}: SectionRendererProps) {
  const visible = editing ? sections : sections.filter((section) => !section.hidden);
  if (visible.length === 0) {
    return renderInsert ? <div className={className}>{renderInsert(0)}</div> : null;
  }

  return (
    <div className={className}>
      {renderInsert ? renderInsert(0) : null}
      {visible.map((section, index) => {
        const edit = (path: string) => {
          if (!editing || !onTextChange) return undefined;
          if (path === "__probe__") return () => undefined;
          return (value: string) => onTextChange(section.id, path, value);
        };
        const rendered = (
          <Section
            id={`section-${section.id}`}
            data-section-id={section.id}
            container={
              section.id === "emergency-banner"
                ? "none"
                : isEmergencySection(section.id)
                  ? widthMap[section.width]
                  : section.id === "about-values" ||
                      section.id === "about-story" ||
                      isContactGrid(section.id) ||
                      isPricingFaq(section.id)
                    ? "wide"
                    : widthMap[section.width]
            }
            innerClassName={isContactGrid(section.id) ? "max-w-[86rem]" : undefined}
            spacing={
              isEmergencySection(section.id)
                ? "none"
                : section.id === "about-values" ||
                    section.id === "about-story" ||
                    isContactGrid(section.id) ||
                    isPricingFaq(section.id)
                  ? "none"
                  : spacingMap[section.spacing]
            }
            surface={
              isEmergencySection(section.id)
                ? section.id === "emergency-expect"
                  ? "cream"
                  : section.id === "emergency-cta"
                    ? "page"
                    : "none"
                : section.id === "about-values" ||
                    section.id === "about-story" ||
                    isContactGrid(section.id) ||
                    isPricingFaq(section.id)
                  ? "none"
                  : surfaceMap[section.surface]
            }
            onClick={editing ? () => onSelect?.(section.id) : undefined}
            className={cn(
              section.id === "about-values" && "bg-white",
              section.id === "about-story" && "bg-surface-page",
              isContactGrid(section.id) && "bg-surface-page",
              isPricingFaq(section.id) && "bg-surface-page",
              section.surface === "deep" && !isEmergencySection(section.id) && "bg-transparent",
              editing && "relative cursor-default ring-inset transition-shadow",
              editing && selectedId === section.id && "ring-2 ring-ring",
              editing && section.hidden && "opacity-50",
            )}
          >
            <SectionBody section={section} edit={edit} />
          </Section>
        );

        if (!renderOverlay && !renderInsert) {
          return <div key={section.id}>{rendered}</div>;
        }

        return (
          <div key={section.id}>
            <div className="group/section relative">
              {rendered}
              {renderOverlay?.(section, index)}
            </div>
            {renderInsert?.(index + 1)}
          </div>
        );
      })}
      {renderInsert ? renderInsert(visible.length) : null}
    </div>
  );
}
