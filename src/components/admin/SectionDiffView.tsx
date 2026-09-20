import { ArrowRight, MoveVertical, Pencil, Plus, Trash2 } from "lucide-react";

import type { SectionChange, SectionDiff } from "@/lib/section-diff";

const KIND_META: Record<
  SectionChange["kind"],
  { label: string; className: string; Icon: typeof Plus }
> = {
  added: { label: "Added", className: "text-emerald-700 bg-emerald-50", Icon: Plus },
  removed: { label: "Removed", className: "text-destructive bg-destructive/10", Icon: Trash2 },
  edited: { label: "Edited", className: "text-amber-700 bg-amber-50", Icon: Pencil },
  moved: { label: "Moved", className: "text-sky-700 bg-sky-50", Icon: MoveVertical },
};

function ChangeRow({ change }: { change: SectionChange }) {
  const meta = KIND_META[change.kind];
  const { Icon } = meta;
  return (
    <li className="space-y-1.5 border-b px-3 py-2 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.className}`}
        >
          <Icon className="h-3 w-3" /> {meta.label}
        </span>
        <span className="text-xs font-medium">{change.label}</span>
        <span className="text-[10px] text-muted-foreground">position {change.index + 1}</span>
        {change.kind === "moved" ? (
          <span className="text-[10px] text-muted-foreground">(was {change.movedFrom + 1})</span>
        ) : null}
        {change.kind === "edited" && change.movedFrom !== null ? (
          <span className="text-[10px] text-muted-foreground">
            (moved from {change.movedFrom + 1})
          </span>
        ) : null}
      </div>
      {change.kind === "edited" ? (
        <ul className="space-y-1 pl-1">
          {change.fields.slice(0, 12).map((field) => (
            <li key={field.path} className="text-[11px] leading-snug">
              <span className="font-medium text-muted-foreground">{field.path}</span>
              <div className="flex flex-wrap items-start gap-1.5">
                <span className="break-words text-muted-foreground line-through">
                  {field.before}
                </span>
                <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="break-words">{field.after}</span>
              </div>
            </li>
          ))}
          {change.fields.length > 12 ? (
            <li className="text-[10px] text-muted-foreground">
              +{change.fields.length - 12} more field changes
            </li>
          ) : null}
        </ul>
      ) : null}
    </li>
  );
}

/** Readable list of section-level changes between two revisions. */
export function SectionDiffView({ title, diff }: { title: string; diff: SectionDiff }) {
  if (diff.changes.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-md border">
      <div className="flex items-center justify-between gap-2 bg-muted/50 px-3 py-2">
        <span className="text-xs font-semibold uppercase text-muted-foreground">{title}</span>
        <span className="text-[10px] text-muted-foreground">{diff.summary}</span>
      </div>
      <ul className="max-h-72 overflow-auto">
        {diff.changes.map((change) => (
          <ChangeRow key={`${change.kind}-${change.id}`} change={change} />
        ))}
      </ul>
    </div>
  );
}
