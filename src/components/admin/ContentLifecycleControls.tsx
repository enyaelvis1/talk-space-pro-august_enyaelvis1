import { useState } from "react";
import { Archive, ArchiveRestore, CalendarClock, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  scheduleContentPublish,
  setContentArchived,
  type AdminContentRow,
} from "@/lib/admin.functions";

export type ContentLifecycleState = "published" | "draft" | "scheduled" | "archived";

// eslint-disable-next-line react-refresh/only-export-components
export function deriveLifecycleState(row: AdminContentRow): ContentLifecycleState {
  if (row.archivedAt) return "archived";
  if (row.scheduledPublishAt && new Date(row.scheduledPublishAt) > new Date()) return "scheduled";
  if (row.status === "publish") return "published";
  return "draft";
}

const pillClasses: Record<ContentLifecycleState, string> = {
  published: "bg-emerald-100 text-emerald-800",
  draft: "bg-amber-100 text-amber-800",
  scheduled: "bg-sky-100 text-sky-800",
  archived: "bg-slate-200 text-slate-700",
};

const pillLabels: Record<ContentLifecycleState, string> = {
  published: "Published",
  draft: "Draft",
  scheduled: "Scheduled",
  archived: "Archived",
};

export function LifecyclePill({ row }: { row: AdminContentRow }) {
  const state = deriveLifecycleState(row);
  const label = pillLabels[state];
  return (
    <div className="flex flex-col items-start gap-1">
      <span
        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${pillClasses[state]}`}
      >
        {label}
      </span>
      {state === "scheduled" && row.scheduledPublishAt ? (
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
          {new Date(row.scheduledPublishAt).toLocaleString()}
        </span>
      ) : null}
    </div>
  );
}

function toLocalInputValue(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function LifecycleMenu({
  row,
  onChange,
}: {
  row: AdminContentRow;
  onChange: (patch: Partial<AdminContentRow>) => void;
}) {
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [value, setValue] = useState(() => toLocalInputValue(row.scheduledPublishAt));
  const state = deriveLifecycleState(row);

  async function handleSchedule(clear: boolean) {
    setPending(true);
    try {
      const iso = clear ? null : new Date(value).toISOString();
      await scheduleContentPublish({
        data: { id: row.id, scheduledPublishAt: iso },
      });
      onChange({
        scheduledPublishAt: iso,
        status: iso ? "draft" : row.status,
        archivedAt: iso ? null : row.archivedAt,
      });
      toast.success(clear ? "Schedule cleared." : "Publish scheduled.");
      setScheduleOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Schedule failed.");
    } finally {
      setPending(false);
    }
  }

  async function handleArchive(archived: boolean) {
    setPending(true);
    try {
      await setContentArchived({ data: { id: row.id, archived } });
      onChange({
        archivedAt: archived ? new Date().toISOString() : null,
        scheduledPublishAt: archived ? null : row.scheduledPublishAt,
      });
      toast.success(archived ? "Moved to archive." : "Restored from archive.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" disabled={pending}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "···"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setScheduleOpen(true)}>
            <CalendarClock className="mr-2 h-3.5 w-3.5" />
            {row.scheduledPublishAt ? "Reschedule publish" : "Schedule publish"}
          </DropdownMenuItem>
          {row.scheduledPublishAt ? (
            <DropdownMenuItem onSelect={() => handleSchedule(true)}>
              Clear schedule
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          {state === "archived" ? (
            <DropdownMenuItem onSelect={() => handleArchive(false)}>
              <ArchiveRestore className="mr-2 h-3.5 w-3.5" />
              Restore from archive
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => handleArchive(true)}>
              <Archive className="mr-2 h-3.5 w-3.5" />
              Move to archive
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule publish</DialogTitle>
            <DialogDescription>
              The entry stays as a draft until this time. A background job flips it to published on
              the next run.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="schedule-at">Publish at (your local time)</Label>
            <Input
              id="schedule-at"
              type="datetime-local"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              min={toLocalInputValue(new Date().toISOString())}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setScheduleOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={() => handleSchedule(false)} disabled={pending}>
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
