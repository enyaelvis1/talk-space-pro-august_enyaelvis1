import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { AdminPageEditLayer } from "@/components/site/AdminPageEditLayer";
import { EditablePublicPage } from "@/components/site/EditablePublicPage";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteBreadcrumbs } from "@/components/site/SiteBreadcrumbs";
import { SiteFooter } from "@/components/site/SiteFooter";
import { canonicalUrl, faqPageJsonLd, pageSeoHead } from "@/lib/seo";
import { getPublishedEntry, listPublicFaqs, type PublicFaq } from "@/lib/content.functions";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type Group = { title: string; items: { q: string; a: string }[] };

function groupFaqs(rows: PublicFaq[]): Group[] {
  const map = new Map<string, { q: string; a: string }[]>();
  for (const r of rows) {
    const arr = map.get(r.category) ?? [];
    arr.push({ q: r.question, a: r.answer });
    map.set(r.category, arr);
  }
  return Array.from(map.entries()).map(([title, items]) => ({ title, items }));
}

export const Route = createFileRoute("/faqs")({
  loader: async () => {
    const [faqs, entry] = await Promise.all([
      listPublicFaqs(),
      getPublishedEntry({ data: { kind: "page", slug: "faqs" } }),
    ]);
    return { faqs, entry };
  },
  head: ({ loaderData }) => {
    const groups = groupFaqs(loaderData?.faqs ?? []);
    return {
      ...pageSeoHead({
        path: "/faqs",
        title: "FAQs | Common questions about Talk Space counselling",
        description:
          "Answers to common questions about therapy at Talk Space: confidentiality, matching, online vs in-person, fees, sliding scale and more.",
        ogTitle: "Talk Space FAQs",
        ogDescription: "Common questions about counselling at Talk Space.",
        entry: loaderData?.entry ?? null,
      }),
      scripts:
        groups.length > 0
          ? [
              {
                type: "application/ld+json",
                children: JSON.stringify(faqPageJsonLd(groups)),
              },
            ]
          : [],
    };
  },
  component: RouteComponent,
});

function anchorFor(title: string) {
  return title.toLowerCase().replace(/[^a-z]+/g, "-");
}

function RouteComponent() {
  const { entry, faqs } = Route.useLoaderData();
  const groups = useMemo(() => groupFaqs(faqs), [faqs]);

  if (entry) {
    return <EditablePublicPage entry={entry} label="FAQs" />;
  }

  return (
    <AdminPageEditLayer slug="faqs" label="FAQs">
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <SiteBreadcrumbs />
        <main id="main" className="flex-1">
          <section className="bg-surface-page">
            <div className="mx-auto w-full max-w-7xl px-4 pt-16 pb-10 sm:px-6 lg:px-8 lg:pt-24">
              <p className="eyebrow">FAQs</p>
              <h1 className="display-1 mt-4 max-w-3xl text-brand-deep">
                Answers to the questions we hear most.
              </h1>
              <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
                If you can't find your question here,{" "}
                <Link to="/contact" className="text-link">
                  send us a message
                </Link>
                . We reply within one working day.
              </p>
            </div>
          </section>

          <section className="bg-surface-page pb-24">
            <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_2fr] lg:gap-16 lg:px-8">
              <nav aria-label="FAQ categories" className="hidden lg:block">
                <p className="eyebrow">Categories</p>
                <ul className="mt-4 space-y-2 text-sm">
                  {groups.map((g) => (
                    <li key={g.title}>
                      <a
                        href={`#${anchorFor(g.title)}`}
                        className="text-brand-deep/80 transition-colors hover:text-brand-blue-deep"
                      >
                        {g.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>

              <div className="space-y-14">
                {groups.length === 0 ? (
                  <p className="text-muted-foreground">No FAQs published yet.</p>
                ) : null}
                {groups.map((g) => (
                  <section key={g.title} id={anchorFor(g.title)} className="scroll-mt-24">
                    <h2 className="text-brand-deep">{g.title}</h2>
                    <Accordion type="single" collapsible className="mt-4 w-full">
                      {g.items.map((item, i) => (
                        <AccordionItem key={`${g.title}-${i}`} value={`${g.title}-${i}`}>
                          <AccordionTrigger className="text-left text-brand-deep hover:no-underline">
                            {item.q}
                          </AccordionTrigger>
                          <AccordionContent className="text-muted-foreground">
                            <div dangerouslySetInnerHTML={{ __html: item.a }} />
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </section>
                ))}
              </div>
            </div>
          </section>
        </main>
        <SiteFooter />
      </div>
    </AdminPageEditLayer>
  );
}
