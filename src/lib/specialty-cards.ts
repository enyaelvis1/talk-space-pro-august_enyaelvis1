/**
 * Editable "Our specialties" cards on the homepage.
 *
 * Stored in `site_settings` under the `home_specialty_cards` key. When a card's
 * `imageUrl` is empty the homepage falls back to its bundled default image, so
 * admins only need to upload artwork for the cards they want to change.
 */
export type SpecialtyCard = {
  title: string;
  description: string;
  imageUrl: string | null;
  alt: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
};

function card(title: string, description: string): SpecialtyCard {
  return {
    title,
    description,
    imageUrl: null,
    alt: title,
    primaryLabel: "Book now",
    primaryHref: "/book",
    secondaryLabel: "Know more",
    secondaryHref: "/services",
  };
}

export const DEFAULT_SPECIALTY_CARDS: SpecialtyCard[] = [
  card(
    "Individual Therapy",
    "One-to-one therapy for anxiety, depression, burnout and life transitions, with a personalised treatment plan.",
  ),
  card(
    "Couple Therapy",
    "Rebuild communication, trust and emotional intimacy, with or without your partner in the room.",
  ),
  card(
    "Teen & Child Therapy",
    "Behavioural, play and art therapy for children and adolescents, delivered by specialist clinicians.",
  ),
  card(
    "Individual Psychotherapy",
    "In-depth psychotherapy with detailed assessment and structured, evidence-based treatment plans.",
  ),
  card(
    "Trauma & PTSD",
    "Trauma-focused therapy for grief, loss, abuse recovery and post-traumatic stress.",
  ),
  card(
    "Premarital Counselling",
    "Prepare for marriage with structured sessions on communication, expectations, finances and values.",
  ),
  card(
    "Family Therapy",
    "Resolve family conflict, sibling rivalry, strengthen intergenerational relationships and support blended families.",
  ),
  card(
    "Infidelity Recovery Therapy",
    "Compassionate, structured support to process betrayal, rebuild trust and decide the path forward.",
  ),
  card(
    "Organizational Counselling",
    "Workplace mental health support, EAP-style sessions, team wellness and leadership coaching for organisations.",
  ),
];

/** Coerce arbitrary stored JSON into well-formed specialty cards. */
export function parseSpecialtyCards(
  value: unknown,
  resolveImage: (path: string | null) => string | null = (path) => path,
): SpecialtyCard[] | null {
  if (!Array.isArray(value)) return null;
  const cards = value.flatMap((entry): SpecialtyCard[] => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    const title = typeof row.title === "string" ? row.title.trim() : "";
    if (!title) return [];
    const text = (key: string, fallback: string) =>
      typeof row[key] === "string" && (row[key] as string).trim() ? (row[key] as string) : fallback;
    const rawImage = typeof row.imageUrl === "string" && row.imageUrl.trim() ? row.imageUrl : null;
    return [
      {
        title,
        description: text("description", ""),
        imageUrl: resolveImage(rawImage),
        alt: text("alt", title),
        primaryLabel: text("primaryLabel", "Book now"),
        primaryHref: text("primaryHref", "/book"),
        secondaryLabel: text("secondaryLabel", "Know more"),
        secondaryHref: text("secondaryHref", "/services"),
      },
    ];
  });
  return cards.length > 0 ? cards : null;
}
