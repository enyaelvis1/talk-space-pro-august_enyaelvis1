import implementationChecklist from "../../docs/IMPLEMENTATION_CHECKLIST.md?raw";

import type {
  ChecklistSourceInput,
  ProgressMilestoneConfig,
  ProgressTaskLink,
} from "@/lib/checklist-progress";
import { normalizeTaskKey } from "@/lib/checklist-progress";

export const PROGRESS_PROJECT_NAME = "Talk Space Production";

export const PROGRESS_SOURCES: ChecklistSourceInput[] = [
  {
    id: "implementation",
    label: "Implementation Checklist",
    path: "docs/IMPLEMENTATION_CHECKLIST.md",
    sourceUrl:
      "https://github.com/enyasystem/talk-space-production/blob/develop/docs/IMPLEMENTATION_CHECKLIST.md",
    content: implementationChecklist,
  },
];

export const PROGRESS_MILESTONES: ProgressMilestoneConfig[] = [
  {
    id: "foundation",
    title: "Foundation and public experience",
    sectionIds: ["01", "02", "03", "04", "05"],
  },
  {
    id: "cms-auth",
    title: "CMS and authentication",
    sectionIds: ["06", "07"],
  },
  {
    id: "care-operations",
    title: "Care operations",
    sectionIds: ["08", "09", "10", "11", "12", "13", "14", "15", "16", "17"],
  },
  {
    id: "launch",
    title: "Migration, hardening and launch",
    sectionIds: ["18", "19", "20", "21", "22", "23", "24"],
  },
  {
    id: "design-refresh",
    title: "Calenira-inspired design refresh",
    sectionIds: ["25"],
  },
];

const taskLinks: Array<[string, ProgressTaskLink]> = [
  ["Build Blog", { href: "/blog", label: "Open Journal" }],
  ["Blog/categories", { href: "/blog", label: "Open Journal" }],
  ["Build Services", { href: "/services", label: "Open services" }],
  ["Build Therapists", { href: "/therapists", label: "Open therapists" }],
  ["Build Pricing", { href: "/pricing", label: "Open pricing" }],
  ["Build About", { href: "/about", label: "Open about page" }],
  ["Build Contact/FAQ", { href: "/contact", label: "Open contact" }],
  ["Managed auth", { href: "/login", label: "Open sign-in" }],
  ["Route protection", { href: "/admin", label: "Open admin" }],
  ["Search/filter", { href: "/admin/clients", label: "Open clients" }],
  ["Public shell", { href: "/", label: "Open site" }],
  ["Production data/content", { href: "/blog", label: "Open published content" }],
];

export const PROGRESS_TASK_LINKS: Record<string, ProgressTaskLink> = Object.fromEntries(
  taskLinks.map(([task, link]) => [normalizeTaskKey(task), link]),
);
