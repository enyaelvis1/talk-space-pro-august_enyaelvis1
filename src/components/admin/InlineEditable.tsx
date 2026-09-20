import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Pencil, X } from "lucide-react";

type Props = {
  value: string | null;
  placeholder?: string;
  multiline?: boolean;
  ariaLabel: string;
  onSave: (next: string) => Promise<void>;
  className?: string;
  displayClassName?: string;
  emptyLabel?: string;
  prefix?: string;
};

export function InlineEditable({
  value,
  placeholder,
  multiline = false,
  ariaLabel,
  onSave,
  className,
  displayClassName,
  emptyLabel = "—",
  prefix,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!editing) setDraft(value ?? "");
  }, [value, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if ("select" in inputRef.current) inputRef.current.select();
    }
  }, [editing]);

  const commit = async () => {
    const next = draft.trim();
    if (next === (value ?? "").trim()) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(next);
      setEditing(false);
    } catch {
      // parent surfaces toast; keep editing open
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setDraft(value ?? "");
    setEditing(false);
  };

  if (editing) {
    const shared = {
      value: draft,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setDraft(e.target.value),
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          cancel();
        } else if (e.key === "Enter" && (!multiline || e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          void commit();
        }
      },
      "aria-label": ariaLabel,
      placeholder,
      disabled: saving,
      className:
        "w-full rounded border border-brand-deep/40 bg-background px-2 py-1 text-sm outline-none focus:border-brand-deep focus:ring-1 focus:ring-brand-deep/40",
    };
    return (
      <div className={`flex items-start gap-1 ${className ?? ""}`}>
        {multiline ? (
          <textarea
            ref={(el) => {
              inputRef.current = el;
            }}
            rows={3}
            {...shared}
          />
        ) : (
          <input
            ref={(el) => {
              inputRef.current = el;
            }}
            type="text"
            {...shared}
          />
        )}
        <div className="flex shrink-0 gap-0.5 pt-0.5">
          <button
            type="button"
            onClick={() => void commit()}
            disabled={saving}
            aria-label="Save"
            className="rounded p-1 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={saving}
            aria-label="Cancel"
            className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  const shown = value && value.trim().length > 0 ? value : null;
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      aria-label={`Edit ${ariaLabel}`}
      className={`group flex w-full items-start gap-1 rounded px-1 py-0.5 text-left hover:bg-muted/60 ${
        className ?? ""
      }`}
    >
      <span
        className={`flex-1 ${displayClassName ?? ""} ${
          shown ? "" : "text-muted-foreground/60 italic"
        }`}
      >
        {prefix}
        {shown ?? emptyLabel}
      </span>
      <Pencil className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}
