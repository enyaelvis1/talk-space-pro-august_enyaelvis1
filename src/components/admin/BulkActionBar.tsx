import { Loader2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AdminBulkActionBar({
  count,
  onPublish,
  onUnpublish,
  onDelete,
  onClear,
  pending,
  labels,
}: {
  count: number;
  onPublish: () => void;
  onUnpublish: () => void;
  onDelete: () => void;
  onClear: () => void;
  pending: "publish" | "unpublish" | "delete" | null;
  labels: { singular: string; plural: string };
}) {
  if (count === 0) return null;
  const label = count === 1 ? labels.singular : labels.plural;
  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="sticky bottom-4 z-20 flex flex-wrap items-center gap-3 rounded-2xl border border-border/70 bg-brand-deep px-4 py-3 text-white shadow-lg"
    >
      <span className="text-sm font-medium">
        {count} {label} selected
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" disabled={pending !== null} onClick={onPublish}>
          {pending === "publish" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Publish"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
          disabled={pending !== null}
          onClick={onUnpublish}
        >
          {pending === "unpublish" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Unpublish"}
        </Button>
        <Button size="sm" variant="destructive" disabled={pending !== null} onClick={onDelete}>
          {pending === "delete" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <>
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
            </>
          )}
        </Button>
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear selection"
          className="ml-1 rounded-md p-1 text-white/70 hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
