import type { ContentSectionBlock } from "@/lib/content.functions";

export function ContentBlocks({ blocks }: { blocks: ContentSectionBlock[] }) {
  if (blocks.length === 0) return null;

  return (
    <div className="content-blocks mx-auto mt-12 max-w-5xl space-y-6">
      {blocks.map((block, index) => (
        <section
          key={`${block.type}-${index}`}
          className={
            block.type === "callout"
              ? "rounded-3xl bg-brand-deep p-7 text-white shadow-sm sm:p-10"
              : "rounded-3xl border border-border/70 bg-white p-7 shadow-sm sm:p-10"
          }
        >
          <p
            className={`eyebrow ${block.type === "callout" ? "text-brand-mint" : "text-brand-mint"}`}
          >
            {block.type === "features"
              ? "What to expect"
              : block.type === "cta"
                ? "Next step"
                : "Talk Space"}
          </p>
          {block.heading ? (
            <h2
              className={`mt-3 text-2xl font-semibold ${block.type === "callout" ? "text-white" : "text-brand-deep"}`}
            >
              {block.heading}
            </h2>
          ) : null}
          {block.body ? (
            <p
              className={`mt-3 max-w-3xl leading-7 ${block.type === "callout" ? "text-white/80" : "text-muted-foreground"}`}
            >
              {block.body}
            </p>
          ) : null}
          {block.items.length > 0 ? (
            <ul
              className={`mt-5 grid gap-3 sm:grid-cols-2 ${block.type === "callout" ? "text-white/90" : "text-brand-deep"}`}
            >
              {block.items.map((item) => (
                <li key={item} className="rounded-xl bg-brand-mint-soft/50 px-4 py-3 text-sm">
                  {item}
                </li>
              ))}
            </ul>
          ) : null}
          {block.type === "cta" && block.ctaLabel && block.ctaHref ? (
            <a
              href={block.ctaHref}
              className="mt-6 inline-flex rounded-full bg-brand-mint px-5 py-2.5 text-sm font-semibold text-brand-deep transition-transform hover:-translate-y-0.5"
            >
              {block.ctaLabel}
            </a>
          ) : null}
        </section>
      ))}
    </div>
  );
}
