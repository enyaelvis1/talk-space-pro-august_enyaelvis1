import type { PageSection } from "@/lib/page-sections";

/** Read a dotted path (`cards.0.title`) off a section. */
export function getSectionValue(section: PageSection, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc === null || acc === undefined) return undefined;
    if (Array.isArray(acc)) return acc[Number(key)];
    if (typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, section);
}

/** Immutably set a dotted path (`cards.0.title`) on a section. */
export function setSectionValue<T extends PageSection>(
  section: T,
  path: string,
  value: unknown,
): T {
  const keys = path.split(".");

  const walk = (node: unknown, index: number): unknown => {
    const key = keys[index];
    const last = index === keys.length - 1;
    if (Array.isArray(node)) {
      const next = [...node];
      next[Number(key)] = last ? value : walk(node[Number(key)], index + 1);
      return next;
    }
    const source = (node ?? {}) as Record<string, unknown>;
    return { ...source, [key]: last ? value : walk(source[key], index + 1) };
  };

  return walk(section, 0) as T;
}
