import { CalendarDays, Download, ExternalLink, Printer } from "lucide-react";

import { AdminWorkspaceShell } from "@/components/progress/AdminSidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  progressSnapshotToCsv,
  statusLabel,
  type ChecklistStatus,
  type ProgressSnapshot,
  type ProgressTask,
} from "@/lib/checklist-progress";

const statusClasses: Record<ChecklistStatus, string> = {
  completed: "border-green-200 bg-green-50 text-green-700",
  in_progress: "border-blue-200 bg-blue-50 text-blue-700",
  partial: "border-amber-200 bg-amber-50 text-amber-700",
  blocked: "border-red-200 bg-red-50 text-red-700",
  not_started: "border-border bg-muted text-muted-foreground",
};

function formatDueDate(date: string | undefined) {
  if (!date) return "No due date configured";
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeZone: "Africa/Lagos",
  }).format(new Date(`${date}T00:00:00+01:00`));
}

function dueDateState(date: string | undefined) {
  if (!date) return null;
  const today = new Date();
  const due = new Date(`${date}T00:00:00+01:00`);
  const days = Math.ceil((due.getTime() - today.getTime()) / 86_400_000);
  return { days, overdue: days < 0 };
}

function StatusBadge({ status }: { status: ChecklistStatus }) {
  return (
    <Badge variant="outline" className={statusClasses[status]}>
      {statusLabel(status)}
    </Badge>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={`mt-2 text-3xl font-semibold text-brand-deep ${tone ?? ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function TaskRow({
  task,
  sourceLabels,
}: {
  task: ProgressTask;
  sourceLabels: Map<string, string>;
}) {
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border/70 bg-white p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={task.status} />
          <span className="font-medium text-brand-deep">{task.text}</span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {task.occurrences
            .map(
              (occurrence) =>
                `${sourceLabels.get(occurrence.sourceId) ?? occurrence.sourceLabel} · ${occurrence.sectionTitle}`,
            )
            .join("; ")}
        </p>
      </div>
      {task.link ? (
        <a
          href={task.link.href}
          className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-brand-blue-deep hover:text-brand-deep"
        >
          {task.link.label}
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      ) : null}
    </li>
  );
}

function MilestoneCard({
  milestone,
  sourceLabels,
}: {
  milestone: ProgressSnapshot["milestones"][number];
  sourceLabels: Map<string, string>;
}) {
  const due = dueDateState(milestone.dueDate);
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg text-brand-deep">{milestone.title}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {milestone.metrics.completed} of {milestone.metrics.total} tasks complete
            </p>
          </div>
          {milestone.complete ? (
            <Badge className="bg-green-600 text-white">Complete</Badge>
          ) : milestone.metrics.blocked > 0 ? (
            <Badge className="bg-red-600 text-white">Blocked</Badge>
          ) : (
            <Badge variant="outline">In progress</Badge>
          )}
        </div>
        <Progress
          value={milestone.metrics.completionPercentage}
          aria-label={`${milestone.title} progress`}
          className="mt-4"
        />
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="h-4 w-4" aria-hidden />
          <span>{formatDueDate(milestone.dueDate)}</span>
          {due ? (
            <span className={due.overdue ? "font-medium text-red-600" : "text-brand-blue-deep"}>
              {due.overdue ? `${Math.abs(due.days)} days overdue` : `${due.days} days remaining`}
            </span>
          ) : null}
        </div>
        {milestone.metrics.blocked > 0 ? (
          <p className="mt-3 text-sm font-medium text-red-600">
            {milestone.metrics.blocked} blocked item{milestone.metrics.blocked === 1 ? "" : "s"}
          </p>
        ) : null}
        <details className="mt-5 group">
          <summary className="cursor-pointer text-sm font-medium text-brand-blue-deep">
            View milestone tasks
          </summary>
          <ul className="mt-3 space-y-2">
            {milestone.tasks.map((task) => (
              <TaskRow key={task.key} task={task} sourceLabels={sourceLabels} />
            ))}
          </ul>
        </details>
      </CardContent>
    </Card>
  );
}

function downloadCsv(snapshot: ProgressSnapshot) {
  const blob = new Blob([progressSnapshotToCsv(snapshot)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  anchor.href = url;
  anchor.download = `${snapshot.projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-progress-${date}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ProgressDashboard({ snapshot }: { snapshot: ProgressSnapshot }) {
  const sourceLabels = new Map(
    snapshot.checklists.map((checklist) => [checklist.sourceId, checklist.label]),
  );

  return (
    <div className="flex min-h-screen flex-col">
      <AdminWorkspaceShell>
        <main id="main" className="flex-1 bg-surface-page py-12 sm:py-16">
          <div className="mx-auto w-full max-w-7xl space-y-10 px-4 sm:px-6 lg:px-8">
            <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="eyebrow">Admin progress</p>
                <h1 className="display-1 mt-3 text-brand-deep">{snapshot.projectName}</h1>
                <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
                  Implementation progress synchronized from the version-controlled checklist.
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Updated{" "}
                  {new Intl.DateTimeFormat("en-NG", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(snapshot.generatedAt))}
                </p>
              </div>
              <div className="flex flex-wrap gap-3 print:hidden">
                <Button variant="outline" onClick={() => downloadCsv(snapshot)}>
                  <Download className="mr-2 h-4 w-4" aria-hidden />
                  Export CSV
                </Button>
                <Button variant="outline" onClick={() => window.print()}>
                  <Printer className="mr-2 h-4 w-4" aria-hidden />
                  Print / PDF
                </Button>
              </div>
            </header>

            <Card className="border-brand-deep/10 bg-white">
              <CardContent className="p-6 sm:p-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="eyebrow">Overall completion</p>
                    <p className="mt-2 text-5xl font-semibold text-brand-deep">
                      {snapshot.summary.completionPercentage}%
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {snapshot.summary.completed} of {snapshot.summary.total} unique tasks complete
                  </p>
                </div>
                <Progress
                  value={snapshot.summary.completionPercentage}
                  aria-label="Overall project completion"
                  className="mt-6 h-3"
                />
              </CardContent>
            </Card>

            <section aria-labelledby="status-heading">
              <h2 id="status-heading" className="sr-only">
                Task status totals
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <MetricCard
                  label="Completed"
                  value={snapshot.summary.completed}
                  tone="text-green-700"
                />
                <MetricCard
                  label="In progress"
                  value={snapshot.summary.inProgress}
                  tone="text-blue-700"
                />
                <MetricCard
                  label="Partial"
                  value={snapshot.summary.partial}
                  tone="text-amber-700"
                />
                <MetricCard label="Blocked" value={snapshot.summary.blocked} tone="text-red-700" />
                <MetricCard label="Not started" value={snapshot.summary.notStarted} />
              </div>
            </section>

            <section aria-labelledby="milestones-heading">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="eyebrow">Delivery plan</p>
                  <h2
                    id="milestones-heading"
                    className="mt-2 text-2xl font-semibold text-brand-deep"
                  >
                    Milestones
                  </h2>
                </div>
              </div>
              <div className="mt-5 grid gap-6 lg:grid-cols-2">
                {snapshot.milestones.map((milestone) => (
                  <MilestoneCard
                    key={milestone.id}
                    milestone={milestone}
                    sourceLabels={sourceLabels}
                  />
                ))}
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <Card>
                <CardHeader>
                  <CardTitle className="text-brand-deep">Section breakdown</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {snapshot.sections.map((section) => (
                    <div key={section.id}>
                      <div className="flex items-center justify-between gap-4 text-sm">
                        <span className="font-medium text-brand-deep">{section.title}</span>
                        <span className="text-muted-foreground">
                          {section.metrics.completionPercentage}% · {section.metrics.total} tasks
                        </span>
                      </div>
                      <Progress
                        value={section.metrics.completionPercentage}
                        className="mt-2"
                        aria-label={`${section.title} completion`}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-brand-deep">Next up</CardTitle>
                </CardHeader>
                <CardContent>
                  {snapshot.nextTasks.length ? (
                    <ul className="space-y-3">
                      {snapshot.nextTasks.map((task) => (
                        <TaskRow key={task.key} task={task} sourceLabels={sourceLabels} />
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      All synchronized tasks are complete.
                    </p>
                  )}
                </CardContent>
              </Card>
            </section>

            <section aria-labelledby="sources-heading" className="print:hidden">
              <Card>
                <CardHeader>
                  <CardTitle id="sources-heading" className="text-brand-deep">
                    Checklist sources
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {snapshot.checklists.map((checklist) => (
                    <div
                      key={checklist.sourceId}
                      className="flex flex-col gap-2 rounded-lg border border-border/70 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium text-brand-deep">{checklist.label}</p>
                        <p className="text-sm text-muted-foreground">{checklist.path}</p>
                        {checklist.warnings.length ? (
                          <p className="mt-1 text-xs text-amber-700">
                            {checklist.warnings.length} parser warning(s)
                          </p>
                        ) : null}
                      </div>
                      {checklist.sourceUrl ? (
                        <a
                          href={checklist.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-medium text-brand-blue-deep hover:text-brand-deep"
                        >
                          Open source document <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        </a>
                      ) : null}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </section>
          </div>
        </main>
      </AdminWorkspaceShell>
    </div>
  );
}

export function ProgressDashboardSkeleton() {
  return (
    <div className="flex min-h-screen flex-col">
      <AdminWorkspaceShell>
        <main id="main" className="flex-1 bg-surface-page">
          <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-16 sm:px-6 lg:px-8">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="h-6 w-full max-w-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="h-28" />
              ))}
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-64 rounded-xl" />
              ))}
            </div>
          </div>
        </main>
      </AdminWorkspaceShell>
    </div>
  );
}
