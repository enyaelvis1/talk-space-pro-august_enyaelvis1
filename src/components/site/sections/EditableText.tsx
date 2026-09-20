import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

type EditableTextProps = {
  value: string;
  onChange?: (value: string) => void;
  editing?: boolean;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
  as?: "span" | "div" | "p";
};

/**
 * Inline-editable text used inside rendered page sections. When `editing` is
 * false it renders plain text, so the public page stays untouched.
 */
export function EditableText({
  value,
  onChange,
  editing = false,
  placeholder = "",
  multiline = false,
  className,
  as = "span",
}: EditableTextProps) {
  const ref = useRef<HTMLElement | null>(null);
  const Tag = as as "span";

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (document.activeElement === node) return;
    if (node.textContent !== value) node.textContent = value;
  }, [value, editing]);

  if (!editing) {
    if (!value) return null;
    return <Tag className={className}>{value}</Tag>;
  }

  return (
    <Tag
      ref={ref as never}
      className={cn(
        "cursor-text rounded-sm outline-none transition-shadow",
        "hover:shadow-[inset_0_0_0_1px_var(--color-border)]",
        "focus:shadow-[inset_0_0_0_2px_var(--color-ring)]",
        !value && "min-w-24 opacity-60",
        className,
      )}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      tabIndex={0}
      data-placeholder={placeholder}
      onBlur={(event) => {
        const next = (event.currentTarget.textContent ?? "").trim();
        if (next !== value) onChange?.(next);
      }}
      onKeyDown={(event) => {
        if (!multiline && event.key === "Enter") {
          event.preventDefault();
          (event.currentTarget as HTMLElement).blur();
        }
      }}
    />
  );
}
