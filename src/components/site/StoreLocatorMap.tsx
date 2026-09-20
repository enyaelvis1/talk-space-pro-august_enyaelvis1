import { MapPin } from "lucide-react";

const LOCATOR_URL = "/store-locator/locator-plus.html";

export function StoreLocatorMap() {
  return (
    <section className="bg-surface-page pb-24">
      <div className="mx-auto w-full max-w-[86rem] px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-stretch">
          <div className="flex flex-col justify-center">
            <span className="grid size-11 place-items-center rounded-full bg-accent-terracotta-soft text-accent-terracotta">
              <MapPin className="size-5" aria-hidden />
            </span>
            <p className="eyebrow mt-6">Find us</p>
            <h2 className="mt-3 font-display text-4xl leading-tight text-brand-deep sm:text-5xl">
              Visit a Talk Space location.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
              Use the locator to get directions to our counselling rooms. In-person sessions are
              available by appointment only.
            </p>
          </div>
          <div className="min-h-[28rem] overflow-hidden rounded-[1.75rem] border border-border/70 bg-surface-card shadow-soft-warm">
            <iframe
              src={LOCATOR_URL}
              title="Talk Space store locator"
              width="100%"
              height="100%"
              className="h-[28rem] w-full border-0 lg:h-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
