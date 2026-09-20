import type { SectionCard } from "@/lib/page-sections";

const PRICING_CARD_IMAGE_BY_ID: Record<string, { src: string; alt: string }> = {
  "price-clarity": {
    src: "asset:african-team",
    alt: "Talk Space care team discussing a counselling intake plan",
  },
  "price-individual": {
    src: "asset:individual-therapy",
    alt: "A therapist and client in a one-to-one counselling session",
  },
  "price-couple": {
    src: "asset:couples-therapy",
    alt: "A couple in a calm counselling conversation",
  },
  "price-teen": {
    src: "asset:family-therapy",
    alt: "Family and child therapy support in a warm counselling setting",
  },
  "price-in-person-individual": {
    src: "asset:office-space",
    alt: "A private counselling room prepared for an in-person session",
  },
  "price-in-person-couple": {
    src: "asset:ts-couple-smiling",
    alt: "A couple smiling together after a counselling conversation",
  },
  "price-in-person-month-individual": {
    src: "asset:ts-individual",
    alt: "A calm individual therapy conversation",
  },
  "price-in-person-month-couple": {
    src: "asset:ts-marriage-couple",
    alt: "A couple in a marriage counselling session",
  },
  "price-month-individual": {
    src: "asset:ts-individual",
    alt: "A focused individual therapy session",
  },
  "price-month-couple": {
    src: "asset:couples-therapy",
    alt: "A structured couple therapy session",
  },
  "price-month-premarital": {
    src: "asset:ts-marriage-couple",
    alt: "Premarital counselling for an engaged couple",
  },
  "price-psychotherapy": {
    src: "asset:ts-ptsd",
    alt: "A calm therapy session for deeper psychological support",
  },
  "price-infidelity": {
    src: "asset:ts-couple-smiling",
    alt: "Relationship repair support for a couple",
  },
  "price-organizational": {
    src: "asset:african-team",
    alt: "A workplace wellbeing conversation with a counselling team",
  },
};

export function pricingCardImage(card: SectionCard): { src: string; alt: string } {
  if (card.image.src.trim()) return card.image;
  return PRICING_CARD_IMAGE_BY_ID[card.id] ?? { src: "asset:african-couch", alt: card.title };
}
