export type PublicPageKey =
  | "about"
  | "services"
  | "therapists"
  | "pricing"
  | "contact"
  | "privacy-policy"
  | "terms"
  | "cancellation-refund-policy"
  | "emergency-support"
  | "faqs";

export type PublicPageConfig = {
  key: PublicPageKey;
  label: string;
  route: string;
  contentSlug: string;
};

export const PUBLIC_PAGE_CONFIG: readonly PublicPageConfig[] = [
  { key: "about", label: "About", route: "/about", contentSlug: "about" },
  { key: "services", label: "Services", route: "/services", contentSlug: "services" },
  { key: "therapists", label: "Therapists", route: "/therapists", contentSlug: "therapists" },
  { key: "pricing", label: "Pricing", route: "/pricing", contentSlug: "pricing" },
  { key: "contact", label: "Contact", route: "/contact", contentSlug: "contact" },
  {
    key: "privacy-policy",
    label: "Privacy policy",
    route: "/privacy-policy",
    contentSlug: "privacy-policy",
  },
  { key: "terms", label: "Terms", route: "/terms", contentSlug: "terms" },
  {
    key: "cancellation-refund-policy",
    label: "Cancellation policy",
    route: "/cancellation-refund-policy",
    contentSlug: "cancellation-refund-policy",
  },
  {
    key: "emergency-support",
    label: "Emergency support",
    route: "/emergency-support",
    contentSlug: "emergency-support",
  },
  { key: "faqs", label: "FAQs", route: "/faqs", contentSlug: "faqs" },
] as const;

export function getPublicPageConfig(pathname: string): PublicPageConfig | null {
  const normalized = pathname.trim().replace(/\/+$/, "") || "/";
  if (normalized === "/") return null;

  const candidates = [normalized];
  if (normalized.startsWith("/")) {
    candidates.push(normalized.slice(1));
  } else {
    candidates.push(`/${normalized}`);
  }

  return (
    candidates
      .map((candidate) =>
        PUBLIC_PAGE_CONFIG.find(
          (page) =>
            page.route === candidate || page.contentSlug === candidate || page.key === candidate,
        ),
      )
      .find((page): page is PublicPageConfig => Boolean(page)) ?? null
  );
}

export function resolvePublicPageSlug(pathname: string): PublicPageKey | null {
  return getPublicPageConfig(pathname)?.key ?? null;
}
