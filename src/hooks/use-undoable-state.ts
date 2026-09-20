import { useCallback, useMemo, useRef, useState } from "react";

type Updater<T> = T | ((current: T) => T);

type SetOptions = {
  /**
   * Consecutive updates sharing a merge key within {@link MERGE_WINDOW_MS} are
   * collapsed into a single history entry — so typing a sentence is one undo,
   * not one undo per keystroke.
   */
  mergeKey?: string;
};

export type UndoableState<T> = {
  value: T;
  /** Update the value and push a history entry. */
  set: (updater: Updater<T>, options?: SetOptions) => void;
  /** Replace the value and clear history (e.g. after a save or reload). */
  reset: (value: T) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

const MERGE_WINDOW_MS = 700;
const HISTORY_LIMIT = 100;

function resolve<T>(updater: Updater<T>, current: T): T {
  return typeof updater === "function" ? (updater as (c: T) => T)(current) : updater;
}

/**
 * `useState` with an undo/redo stack, used by the page builders so section
 * edits can be reverted before they are saved.
 */
export function useUndoableState<T>(initial: T): UndoableState<T> {
  const [past, setPast] = useState<T[]>([]);
  const [present, setPresent] = useState<T>(initial);
  const [future, setFuture] = useState<T[]>([]);
  const lastMerge = useRef<{ key: string; at: number } | null>(null);

  const set = useCallback((updater: Updater<T>, options?: SetOptions) => {
    const now = Date.now();
    const mergeKey = options?.mergeKey;
    const canMerge =
      Boolean(mergeKey) &&
      lastMerge.current?.key === mergeKey &&
      now - (lastMerge.current?.at ?? 0) < MERGE_WINDOW_MS;

    setPresent((current) => {
      const next = resolve(updater, current);
      if (Object.is(next, current)) return current;
      if (!canMerge) {
        setPast((stack) => [...stack, current].slice(-HISTORY_LIMIT));
      }
      setFuture([]);
      return next;
    });

    lastMerge.current = mergeKey ? { key: mergeKey, at: now } : null;
  }, []);

  const reset = useCallback((value: T) => {
    lastMerge.current = null;
    setPast([]);
    setFuture([]);
    setPresent(value);
  }, []);

  const undo = useCallback(() => {
    lastMerge.current = null;
    setPast((stack) => {
      if (stack.length === 0) return stack;
      const previous = stack[stack.length - 1];
      setPresent((current) => {
        setFuture((forward) => [current, ...forward]);
        return previous;
      });
      return stack.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    lastMerge.current = null;
    setFuture((stack) => {
      if (stack.length === 0) return stack;
      const [next, ...rest] = stack;
      setPresent((current) => {
        setPast((backward) => [...backward, current].slice(-HISTORY_LIMIT));
        return next;
      });
      return rest;
    });
  }, []);

  return useMemo(
    () => ({
      value: present,
      set,
      reset,
      undo,
      redo,
      canUndo: past.length > 0,
      canRedo: future.length > 0,
    }),
    [present, set, reset, undo, redo, past.length, future.length],
  );
}
