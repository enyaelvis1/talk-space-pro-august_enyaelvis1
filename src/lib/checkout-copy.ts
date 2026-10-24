import type { PageSection } from "./page-sections";

/** Public copy must describe the enabled NGN checkout, not indicative USD prices. */
export const DIASPORA_CHECKOUT_COPY =
  "Checkout payments are processed in Nigerian naira (NGN). Any USD equivalents are indicative only. Contact Talk Space for diaspora pricing enquiries.";

/** Correct the known legacy CMS promise without overwriting unrelated editorial copy. */
export function normalizeCheckoutCurrencyCopy(text: string): string {
  return text.replace(
    /Yes\.\s*USD\s+equivalents\s+are\s+shown\s+for\s+each\s+plan\s+and\s+you\s+can\s+pay\s+in\s+either\s+currency\s+via\s+Paystack\./gi,
    DIASPORA_CHECKOUT_COPY,
  );
}

/** Read-time correction only: published/draft CMS records are not written back. */
export function normalizeCheckoutCurrencySections(sections: PageSection[]): PageSection[] {
  return sections.map((section) => {
    if (section.type === "faq") {
      return {
        ...section,
        items: section.items.map((item) => ({
          ...item,
          answer: normalizeCheckoutCurrencyCopy(item.answer),
        })),
      };
    }
    if (section.type === "richText") {
      return { ...section, html: normalizeCheckoutCurrencyCopy(section.html) };
    }
    return section;
  });
}
