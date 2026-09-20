import { useCallback, useRef, useState } from "react";

/** Kinds of section actions we keep an audit trail for. */
export type SectionAuditKind =
  "add" | "reorder" | "duplicate" | "paste" | "hide" | "show" | "delete" | "settings" | "text";

export type SectionAuditOp = {
  op: SectionAuditKind;
  /** Human-readable description stored on the audit row. */
  reason: string;
  /** Section id + changed setting paths, stored as `changed_fields`. */
  fields: string[];
  /** Internal grouping key so repeated edits to one field collapse. */
  key?: string;
};

/**
 * Collects the section actions an admin performs while editing a page, so the
 * save call can persist them as audit-log rows. Repeated edits to the same
 * field collapse into one entry to keep the log readable.
 */
export function useSectionAuditTrail() {
  const opsRef = useRef<SectionAuditOp[]>([]);
  const [count, setCount] = useState(0);

  const record = useCallback((op: SectionAuditOp) => {
    const list = opsRef.current;
    const last = list[list.length - 1];
    if (op.key && last && last.key === op.key) {
      list[list.length - 1] = { ...op };
    } else {
      list.push(op);
    }
    setCount(opsRef.current.length);
  }, []);

  const take = useCallback(() => {
    const ops = opsRef.current;
    opsRef.current = [];
    setCount(0);
    return ops.map(({ op, reason, fields }) => ({ op, reason, fields }));
  }, []);

  /** Put taken entries back when the save they were taken for failed. */
  const restore = useCallback((ops: Array<Pick<SectionAuditOp, "op" | "reason" | "fields">>) => {
    if (ops.length === 0) return;
    opsRef.current = [...ops, ...opsRef.current];
    setCount(opsRef.current.length);
  }, []);

  const clear = useCallback(() => {
    opsRef.current = [];
    setCount(0);
  }, []);

  return { record, take, restore, clear, count };
}

/** Top-level keys whose values differ between two versions of a section. */
export function changedSectionFields(
  previous: Record<string, unknown> | null,
  next: Record<string, unknown>,
): string[] {
  const keys = new Set([...Object.keys(previous ?? {}), ...Object.keys(next)]);
  const changed: string[] = [];
  keys.forEach((key) => {
    if (key === "id" || key === "type") return;
    const a = JSON.stringify(previous?.[key] ?? null);
    const b = JSON.stringify(next[key] ?? null);
    if (a !== b) changed.push(key);
  });
  return changed;
}
