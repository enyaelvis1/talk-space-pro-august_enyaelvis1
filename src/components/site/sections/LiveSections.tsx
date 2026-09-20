import { Suspense } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { GraduationCap, MapPin } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ContactEnquiryForm } from "@/components/site/ContactEnquiryForm";
import { OptimizedImage } from "@/components/site/OptimizedImage";
import { Button } from "@/components/ui/button";
import {
  getPublicFormTemplates,
  getPublicTherapists,
  listPublicFaqs,
} from "@/lib/content.functions";
import { DEFAULT_FORM_TEMPLATES, getLatestTemplateByBaseKey } from "@/lib/form-templates";
import { cn } from "@/lib/utils";

import t1 from "@/assets/therapist-1.jpg";
import t2 from "@/assets/therapist-2.jpg";
import t3 from "@/assets/therapist-3.jpg";

/**
 * Live sections render real, database-backed features inside an editable page.
 * Admins edit the surrounding heading text; the data itself keeps coming from
 * the FAQ manager and the contact form pipeline.
 */

function anchorFor(title: string) {
  return title.toLowerCase().replace(/[^a-z]+/g, "-");
}

const FALLBACK_THERAPIST_IMAGES = [t1, t2, t3];

export function LiveContactForm() {
  const { data: templates } = useQuery({
    queryKey: ["public-form-templates"],
    queryFn: () => getPublicFormTemplates(),
    staleTime: 5 * 60 * 1000,
  });

  const template =
    getLatestTemplateByBaseKey(templates ?? [], "contact_enquiry") ??
    DEFAULT_FORM_TEMPLATES.find((candidate) => candidate.key === "contact_enquiry_v1")!;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <ContactEnquiryForm template={template} />
    </div>
  );
}

export function LiveFaqList() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading questions…</p>}>
      <FaqGroups />
    </Suspense>
  );
}

export function LiveTherapistList({ columns = 3 }: { columns?: number }) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading therapists...</p>}>
      <TherapistCards columns={columns} />
    </Suspense>
  );
}

function FaqGroups() {
  const { data } = useSuspenseQuery({
    queryKey: ["public-faqs"],
    queryFn: () => listPublicFaqs(),
    staleTime: 5 * 60 * 1000,
  });

  const groups = new Map<string, { question: string; answer: string }[]>();
  for (const row of data ?? []) {
    const items = groups.get(row.category) ?? [];
    items.push({ question: row.question, answer: row.answer });
    groups.set(row.category, items);
  }

  if (groups.size === 0) {
    return <p className="text-muted-foreground">No FAQs published yet.</p>;
  }

  return (
    <div className="space-y-12">
      {Array.from(groups.entries()).map(([title, items]) => (
        <section key={title} id={anchorFor(title)} className="scroll-mt-24">
          <h2 className="text-brand-deep">{title}</h2>
          <Accordion type="single" collapsible className="mt-4 w-full">
            {items.map((item, index) => (
              <AccordionItem key={`${title}-${index}`} value={`${title}-${index}`}>
                <AccordionTrigger className="text-left text-brand-deep hover:no-underline">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  <div dangerouslySetInnerHTML={{ __html: item.answer }} />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      ))}
    </div>
  );
}

function TherapistCards({ columns = 3 }: { columns?: number }) {
  const { data } = useSuspenseQuery({
    queryKey: ["public-therapists"],
    queryFn: () => getPublicTherapists(),
    staleTime: 5 * 60 * 1000,
  });

  const therapists = data ?? [];
  const gridClasses =
    columns === 1
      ? "grid-cols-1"
      : columns === 2
        ? "grid-cols-1 md:grid-cols-2"
        : columns === 4
          ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-4"
          : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3";

  if (therapists.length === 0) {
    return (
      <p className="py-10 text-center text-muted-foreground">
        Our therapist profiles are being updated. Please contact us for a personal match.
      </p>
    );
  }

  return (
    <div className={cn("grid gap-6", gridClasses)}>
      {therapists.map((therapist, index) => (
        <article
          key={therapist.slug}
          className="flex min-w-0 flex-col overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft-warm"
        >
          <OptimizedImage
            src={
              therapist.imageUrl ||
              FALLBACK_THERAPIST_IMAGES[index % FALLBACK_THERAPIST_IMAGES.length]
            }
            alt={`Portrait of ${therapist.fullName}, Talk Space therapist`}
            width={1024}
            height={1024}
            loading="lazy"
            className="aspect-[4/5] w-full object-cover"
          />
          <div className="flex flex-1 flex-col p-6">
            <h3 className="font-display text-xl text-brand-deep">{therapist.fullName}</h3>
            <p className="mt-1 text-sm text-accent-terracotta">{therapist.roleTitle}</p>
            <p className="mt-4 text-sm text-muted-foreground">
              {therapist.bio || "Thoughtful, culturally attuned support for your next chapter."}
            </p>
            <dl className="mt-5 space-y-2 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <dt className="sr-only">Credentials</dt>
                <dd className="flex items-start gap-2">
                  <GraduationCap
                    className="mt-0.5 h-3.5 w-3.5 text-accent-terracotta"
                    aria-hidden
                  />
                  <span>{therapist.credentials || "Talk Space licensed therapist"}</span>
                </dd>
              </div>
              <div className="flex items-start gap-2">
                <dt className="sr-only">Location</dt>
                <dd className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 text-accent-terracotta" aria-hidden />
                  <span>{therapist.location || "Online and in-person"}</span>
                </dd>
              </div>
            </dl>
            <Button asChild variant="terracotta" size="pill" className="mt-6 shadow-soft-warm">
              <Link to="/book">Request a session</Link>
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}
