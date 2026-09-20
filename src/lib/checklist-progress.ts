export type ChecklistStatus = "completed" | "in_progress" | "partial" | "blocked" | "not_started";

export type ProgressTaskLink = {
  href: string;
  label: string;
};

export type ChecklistSourceInput = {
  id: string;
  label: string;
  path: string;
  content: string;
  sourceUrl?: string;
};

export type ChecklistTask = {
  key: string;
  text: string;
  status: ChecklistStatus;
  sourceId: string;
  sourceLabel: string;
  sourcePath: string;
  sectionId: string;
  sectionTitle: string;
  line: number;
};

export type ChecklistSection = {
  id: string;
  title: string;
  tasks: ChecklistTask[];
};

export type ProgressMetrics = {
  total: number;
  completed: number;
  inProgress: number;
  partial: number;
  blocked: number;
  notStarted: number;
  completionPercentage: number;
};

export type ParsedChecklist = {
  sourceId: string;
  label: string;
  path: string;
  sourceUrl?: string;
  title: string;
  sections: ChecklistSection[];
  tasks: ChecklistTask[];
  metrics: ProgressMetrics;
  warnings: string[];
};

export type ProgressMilestoneConfig = {
  id: string;
  title: string;
  sectionIds: string[];
  dueDate?: string;
};

export type ProgressMilestone = ProgressMilestoneConfig & {
  tasks: ProgressTask[];
  metrics: ProgressMetrics;
  complete: boolean;
};

export type ProgressTask = {
  key: string;
  text: string;
  status: ChecklistStatus;
  occurrences: ChecklistTask[];
  link?: ProgressTaskLink;
};

export type ProgressSection = {
  id: string;
  title: string;
  tasks: ProgressTask[];
  metrics: ProgressMetrics;
};

export type ProgressSnapshot = {
  projectName: string;
  generatedAt: string;
  checklists: ParsedChecklist[];
  sections: ProgressSection[];
  tasks: ProgressTask[];
  milestones: ProgressMilestone[];
  summary: ProgressMetrics;
  nextTasks: ProgressTask[];
};

const STATUS_PRIORITY: Record<ChecklistStatus, number> = {
  not_started: 0,
  blocked: 1,
  partial: 2,
  in_progress: 3,
  completed: 4,
};

const STATUS_WEIGHT: Record<ChecklistStatus, number> = {
  completed: 1,
  in_progress: 0.5,
  partial: 0.5,
  blocked: 0,
  not_started: 0,
};

export function classifyStatus(marker: string): ChecklistStatus | null {
  switch (marker.trim().toLowerCase()) {
    case "x":
      return "completed";
    case "~":
      return "in_progress";
    case "p":
      return "partial";
    case "!":
      return "blocked";
    case "":
      return "not_started";
    default:
      return null;
  }
}

export function normalizeTaskKey(text: string) {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .replace(/^\s*\d+[.)-]\s*/g, "")
    .replace(/[^a-z\d]+/gi, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function cleanHeading(value: string) {
  return value.replace(/\s+#+\s*$/, "").trim();
}

function sectionDetails(heading: string) {
  const value = cleanHeading(heading);
  const match = value.match(/^(\d+(?:\.\d+)?)\s*[.):-]\s*(.+)$/);
  if (match) return { id: match[1], title: match[2].trim() };
  return { id: normalizeTaskKey(value), title: value };
}

export function calculateMetrics(tasks: Array<Pick<ChecklistTask, "status">>): ProgressMetrics {
  const metrics: ProgressMetrics = {
    total: tasks.length,
    completed: 0,
    inProgress: 0,
    partial: 0,
    blocked: 0,
    notStarted: 0,
    completionPercentage: 0,
  };

  let weightedTotal = 0;
  for (const task of tasks) {
    weightedTotal += STATUS_WEIGHT[task.status];
    if (task.status === "completed") metrics.completed += 1;
    if (task.status === "in_progress") metrics.inProgress += 1;
    if (task.status === "partial") metrics.partial += 1;
    if (task.status === "blocked") metrics.blocked += 1;
    if (task.status === "not_started") metrics.notStarted += 1;
  }

  metrics.completionPercentage = metrics.total
    ? Math.round((weightedTotal / metrics.total) * 100)
    : 0;
  return metrics;
}

export function parseChecklist(source: ChecklistSourceInput): ParsedChecklist {
  const sections: ChecklistSection[] = [];
  const tasks: ChecklistTask[] = [];
  const warnings: string[] = [];
  let title = source.label;
  let currentSection: ChecklistSection | null = null;

  source.content
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .forEach((line, index) => {
      const lineNumber = index + 1;
      const titleMatch = line.match(/^#\s+(.+?)\s*$/);
      const sectionMatch = line.match(/^##\s+(.+?)\s*$/);
      const taskMatch = line.match(/^\s*-\s*\[([^\]])\]\s+(.+?)\s*$/);

      if (titleMatch) {
        title = cleanHeading(titleMatch[1]);
        return;
      }

      if (sectionMatch) {
        const details = sectionDetails(sectionMatch[1]);
        currentSection = { ...details, tasks: [] };
        sections.push(currentSection);
        return;
      }

      if (!taskMatch) return;
      const status = classifyStatus(taskMatch[1]);
      if (!status) {
        warnings.push(`Unknown task status marker on line ${lineNumber}.`);
        return;
      }

      if (!currentSection) {
        currentSection = { id: "general", title: "General", tasks: [] };
        sections.push(currentSection);
        warnings.push(`Task on line ${lineNumber} appears before a section heading.`);
      }

      const task: ChecklistTask = {
        key: normalizeTaskKey(taskMatch[2]),
        text: cleanHeading(taskMatch[2]),
        status,
        sourceId: source.id,
        sourceLabel: source.label,
        sourcePath: source.path,
        sectionId: currentSection.id,
        sectionTitle: currentSection.title,
        line: lineNumber,
      };
      currentSection.tasks.push(task);
      tasks.push(task);
    });

  return {
    sourceId: source.id,
    label: source.label,
    path: source.path,
    sourceUrl: source.sourceUrl,
    title,
    sections,
    tasks,
    metrics: calculateMetrics(tasks),
    warnings,
  };
}

function linkForTask(task: ProgressTask, taskLinks: Record<string, ProgressTaskLink>) {
  return taskLinks[task.key];
}

export function mergeChecklistStatuses(
  checklists: ParsedChecklist[],
  taskLinks: Record<string, ProgressTaskLink> = {},
) {
  const taskMap = new Map<string, ProgressTask>();

  for (const checklist of checklists) {
    for (const occurrence of checklist.tasks) {
      const existing = taskMap.get(occurrence.key);
      if (!existing) {
        taskMap.set(occurrence.key, {
          key: occurrence.key,
          text: occurrence.text,
          status: occurrence.status,
          occurrences: [occurrence],
          link: taskLinks[occurrence.key],
        });
        continue;
      }

      existing.occurrences.push(occurrence);
      if (STATUS_PRIORITY[occurrence.status] > STATUS_PRIORITY[existing.status]) {
        existing.status = occurrence.status;
      }
    }
  }

  return [...taskMap.values()].sort((left, right) => left.text.localeCompare(right.text));
}

export function buildProgressSnapshot(options: {
  projectName: string;
  sources: ChecklistSourceInput[];
  milestones: ProgressMilestoneConfig[];
  taskLinks?: Record<string, ProgressTaskLink>;
  generatedAt?: string;
}): ProgressSnapshot {
  const checklists = options.sources.map(parseChecklist);
  const tasks = mergeChecklistStatuses(checklists, options.taskLinks);
  const sectionMap = new Map<string, { title: string; tasks: ProgressTask[] }>();

  for (const task of tasks) {
    for (const occurrence of task.occurrences) {
      const key = `${occurrence.sourceId}:${occurrence.sectionId}`;
      const section = sectionMap.get(key) ?? { title: occurrence.sectionTitle, tasks: [] };
      if (!section.tasks.some((item) => item.key === task.key)) section.tasks.push(task);
      sectionMap.set(key, section);
    }
  }

  const sections = [...sectionMap.entries()].map(([key, value]) => {
    const separator = key.indexOf(":");
    return {
      id: key.slice(separator + 1),
      title: value.title,
      tasks: value.tasks,
      metrics: calculateMetrics(value.tasks),
    };
  });

  const milestones = options.milestones.map((milestone) => {
    const milestoneTasks = tasks.filter((task) =>
      task.occurrences.some((occurrence) => milestone.sectionIds.includes(occurrence.sectionId)),
    );
    const metrics = calculateMetrics(milestoneTasks);
    return {
      ...milestone,
      tasks: milestoneTasks,
      metrics,
      complete: milestoneTasks.length > 0 && metrics.completed === metrics.total,
    };
  });

  return {
    projectName: options.projectName,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    checklists,
    sections,
    tasks,
    milestones,
    summary: calculateMetrics(tasks),
    nextTasks: tasks
      .filter((task) => task.status !== "completed")
      .sort((left, right) => STATUS_PRIORITY[right.status] - STATUS_PRIORITY[left.status])
      .slice(0, 8),
  };
}

function csvValue(value: string | number) {
  const stringValue = String(value);
  return /[",\n]/.test(stringValue) ? `"${stringValue.replace(/"/g, '""')}"` : stringValue;
}

export function progressSnapshotToCsv(snapshot: ProgressSnapshot) {
  const lines = [
    ["Project", snapshot.projectName],
    ["Generated at", snapshot.generatedAt],
    ["Total tasks", snapshot.summary.total],
    ["Completed", snapshot.summary.completed],
    ["In progress", snapshot.summary.inProgress],
    ["Partial", snapshot.summary.partial],
    ["Blocked", snapshot.summary.blocked],
    ["Not started", snapshot.summary.notStarted],
    ["Completion percentage", `${snapshot.summary.completionPercentage}%`],
    [],
    ["Checklist", "Section", "Task key", "Task", "Status", "Completion percentage", "Source"],
    ...snapshot.tasks.flatMap((task) =>
      task.occurrences.map((occurrence) => [
        occurrence.sourceLabel,
        occurrence.sectionTitle,
        task.key,
        task.text,
        task.status,
        `${snapshot.summary.completionPercentage}%`,
        `${occurrence.sourcePath}:${occurrence.line}`,
      ]),
    ),
  ];

  return lines.map((line) => line.map((value) => csvValue(value ?? "")).join(",")).join("\n");
}

export function statusLabel(status: ChecklistStatus) {
  return status.replace("_", " ").replace(/^./, (value) => value.toUpperCase());
}
