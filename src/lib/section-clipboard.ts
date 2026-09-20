import { useCallback, useEffect, useState } from "react";

import { newSectionId, normalizeSections, type PageSection } from "@/lib/page-sections";

const STORAGE_KEY = "talkspace.cms.section-clipboard";
const EVENT = "talkspace-section-clipboard";

export type SectionClipboard = {
  /** Sections copied from a page, stored without their original ids. */
  sections: PageSection[];
  /** Where the copy came from, shown in the paste affordance. */
  sourceLabel: string;
  copiedAt: string;
};

function read(): SectionClipboard | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SectionClipboard>;
    const sections = normalizeSections(parsed?.sections);
    if (sections.length === 0) return null;
    return {
      sections,
      sourceLabel: typeof parsed.sourceLabel === "string" ? parsed.sourceLabel : "another page",
      copiedAt: typeof parsed.copiedAt === "string" ? parsed.copiedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Copy sections to the cross-page clipboard. Stored in localStorage so a layout
 * copied on one page can be pasted into any other page in the same browser.
 */
export function copySectionsToClipboard(sections: PageSection[], sourceLabel: string) {
  if (typeof window === "undefined" || sections.length === 0) return;
  const payload: SectionClipboard = {
    sections: JSON.parse(JSON.stringify(sections)) as PageSection[],
    sourceLabel,
    copiedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  window.dispatchEvent(new Event(EVENT));
}

export function clearSectionClipboard() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(EVENT));
}

/** Fresh copies of the clipboard sections with new ids, safe to insert. */
export function instantiateClipboardSections(clipboard: SectionClipboard): PageSection[] {
  return clipboard.sections.map((section) => {
    const copy = JSON.parse(JSON.stringify(section)) as PageSection;
    copy.id = newSectionId(copy.type);
    return copy;
  });
}

/** Reactive clipboard state, kept in sync across tabs and components. */
export function useSectionClipboard() {
  const [clipboard, setClipboard] = useState<SectionClipboard | null>(null);

  const sync = useCallback(() => setClipboard(read()), []);

  useEffect(() => {
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
    };
  }, [sync]);

  return clipboard;
}
