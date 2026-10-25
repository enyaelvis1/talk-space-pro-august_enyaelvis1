import type { ProgressMilestoneConfig } from "./checklist-progress";

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
    // The legacy Markdown currently places the eight design records under section 27.
    sectionIds: ["25", "27"],
  },
];
