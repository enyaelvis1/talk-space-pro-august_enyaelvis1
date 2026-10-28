export function orderFaqCategories(categories: string[], preferredOrder: string[] = []) {
  const available = new Set(categories);
  const ordered = preferredOrder.filter(
    (category, index) => available.has(category) && preferredOrder.indexOf(category) === index,
  );
  const included = new Set(ordered);

  return [
    ...ordered,
    ...categories.filter((category) => !included.has(category)).sort((a, b) => a.localeCompare(b)),
  ];
}

export function parseFaqCategoryOrder(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (category): category is string =>
      typeof category === "string" && category.trim().length > 0 && category.length <= 120,
  );
}
