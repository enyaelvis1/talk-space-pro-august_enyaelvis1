export const IN_PERSON_PRICE_BY_SERVICE_CODE: Record<string, number> = {
  individual: 85000,
  couple: 130000,
  one_month_individual: 323000,
  one_month_couple: 494000,
};

export function fallbackInPersonPriceNgn(serviceCode: string | null | undefined) {
  if (!serviceCode) return null;
  return IN_PERSON_PRICE_BY_SERVICE_CODE[serviceCode] ?? null;
}

export function resolveServicePriceNgn(
  service: {
    code?: string | null;
    price_ngn?: number | string | null;
    in_person_price_ngn?: number | string | null;
  } | null,
  mode: string | null | undefined,
) {
  if (mode === "in_person") {
    if (service?.in_person_price_ngn != null) return Number(service.in_person_price_ngn);
    const fallback = fallbackInPersonPriceNgn(service?.code);
    if (fallback != null) return fallback;
    // An in-person booking must never silently inherit the online price. A
    // missing explicit price is an unavailable configuration that callers
    // should surface before creating a payment or holding a slot.
    return null;
  }
  return service?.price_ngn == null ? null : Number(service.price_ngn);
}

export function isMissingInPersonPriceColumn(error: unknown) {
  const dbError = error as { code?: unknown; message?: unknown } | null;
  return dbError?.code === "42703" && String(dbError.message ?? "").includes("in_person_price_ngn");
}
