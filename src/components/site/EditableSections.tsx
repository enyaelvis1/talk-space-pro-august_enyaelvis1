import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  ClipboardCopy,
  ClipboardPaste,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Redo2,
  Save,
  Settings2,
  Trash2,
  Undo2,
  UploadCloud,
  X,
} from "lucide-react";

import {
  clearRecoverySnapshot,
  formatRecoveryTime,
  readRecoverySnapshot,
  sameSections,
  writeRecoverySnapshot,
  type RecoverySnapshot,
} from "@/lib/section-recovery";
import { RevisionHistoryButton } from "@/components/admin/RevisionHistoryButton";
import { useUndoableState } from "@/hooks/use-undoable-state";
import { changedSectionFields, useSectionAuditTrail } from "@/hooks/use-section-audit";
import { SectionSettings } from "@/components/admin/SectionSettings";
import { SectionRenderer } from "@/components/site/sections/SectionRenderer";
import { setSectionValue } from "@/components/site/sections/section-paths";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  discardContentSectionsDraft,
  getCmsPermissions,
  updateContentSections,
} from "@/lib/admin.functions";
import {
  copySectionsToClipboard,
  instantiateClipboardSections,
  useSectionClipboard,
} from "@/lib/section-clipboard";
import {
  createSection,
  newSectionId,
  SECTION_CATALOG,
  sectionLabel,
  type PageSection,
  type PageSectionType,
} from "@/lib/page-sections";

type Props = {
  entryId: string;
  /** Published layout — what visitors see. */
  sections: PageSection[];
  /** Unpublished layout changes, if any. */
  draftSections?: PageSection[];
  /** Render the draft instead of the published layout (draft preview). */
  preferDraft?: boolean;
  /** Page name shown when sections are copied to the clipboard. */
  pageLabel?: string;
  /** Open the editor as soon as admin permissions are confirmed. */
  startInEditMode?: boolean;
};
const SECTION_PARAM = "section";

function setSectionParam(id: string | null) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (id) url.searchParams.set(SECTION_PARAM, id);
  else url.searchParams.delete(SECTION_PARAM);
  window.history.replaceState(window.history.state, "", url.toString());
}

/**
 * Public-site renderer for builder sections with a WordPress-style admin
 * overlay: inline text editing, add/reorder/copy/paste/delete controls, and a
 * draft → publish workflow backed by content revisions.
 */
export function EditableSections({
  entryId,
  sections,
  draftSections = [],
  preferDraft = false,
  pageLabel = "another page",
  startInEditMode = false,
}: Props) {
  const router = useRouter();
  const hasDraft = draftSections.length > 0;
  const baseline = hasDraft ? draftSections : sections;

  const [canEdit, setCanEdit] = useState(false);
  const [editing, setEditing] = useState(false);
  const history = useUndoableState<PageSection[]>(baseline);
  const draft = history.value;
  const setDraft = history.set;
  const resetDraft = history.reset;
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState<null | "draft" | "publish" | "discard">(null);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const clipboard = useSectionClipboard();
  const audit = useSectionAuditTrail();
  const [autosaveState, setAutosaveState] = useState<
    "idle" | "pending" | "saving" | "saved" | "offline"
  >("idle");
  const [lastAutosaveAt, setLastAutosaveAt] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<RecoverySnapshot | null>(null);
  const savingRef = useRef(false);
  const deepLinkHandled = useRef(false);

  const draftRef = useRef<PageSection[]>(baseline);
  draftRef.current = history.value;

  useEffect(() => {
    resetDraft(hasDraft ? draftSections : sections);
    setDirty(false);
  }, [sections, draftSections, hasDraft, resetDraft]);

  const undo = () => {
    if (!history.canUndo) return;
    history.undo();
    setDirty(true);
  };

  const redo = () => {
    if (!history.canRedo) return;
    history.redo();
    setDirty(true);
  };

  useEffect(() => {
    if (!editing) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  useEffect(() => {
    let active = true;
    getCmsPermissions()
      .then((permissions) => {
        if (active) setCanEdit(permissions.canEdit);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (startInEditMode && canEdit) setEditing(true);
  }, [canEdit, startInEditMode]);

  // `?section=<id>` deep link: open the editor with that section selected and
  // scrolled into view, then keep the param in sync with the selection.
  useEffect(() => {
    if (!canEdit || deepLinkHandled.current || typeof window === "undefined") return;
    const target = new URLSearchParams(window.location.search).get(SECTION_PARAM);
    if (!target) return;
    deepLinkHandled.current = true;
    if (!draftRef.current.some((section) => section.id === target)) {
      setSectionParam(null);
      toast.error("That section is no longer on this page");
      return;
    }
    setEditing(true);
    setSettingsId(target);
    const timer = window.setTimeout(() => {
      document
        .getElementById(`section-${target}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [canEdit]);

  useEffect(() => {
    if (!canEdit || !deepLinkHandled.current) return;
    setSectionParam(editing ? settingsId : null);
  }, [canEdit, editing, settingsId]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const handleTextChange = (sectionId: string, path: string, value: string) => {
    setDraft(
      (current) =>
        current.map((section) =>
          section.id === sectionId ? setSectionValue(section, path, value) : section,
        ),
      { mergeKey: `text:${sectionId}:${path}` },
    );
    const type = draft.find((section) => section.id === sectionId)?.type;
    audit.record({
      op: "text",
      reason: `Edited text in ${type ? sectionLabel(type) : "section"}`,
      fields: [sectionId, path],
      key: `text:${sectionId}:${path}`,
    });
    setDirty(true);
  };

  const replaceSection = (next: PageSection) => {
    const previous = draft.find((section) => section.id === next.id);
    setDraft((current) => current.map((section) => (section.id === next.id ? next : section)));
    if (previous && previous.hidden !== next.hidden) {
      audit.record({
        op: next.hidden ? "hide" : "show",
        reason: `${next.hidden ? "Hid" : "Unhid"} ${sectionLabel(next.type)}`,
        fields: [next.id, "hidden"],
      });
    } else {
      audit.record({
        op: "settings",
        reason: `Updated settings for ${sectionLabel(next.type)}`,
        fields: [next.id, ...changedSectionFields(previous ?? null, next)],
        key: `settings:${next.id}`,
      });
    }
    setDirty(true);
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= draft.length) return;
    const moved = draft[from];
    setDraft((current) => {
      const next = [...current];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
    audit.record({
      op: "reorder",
      reason: `Moved ${sectionLabel(moved.type)} from position ${from + 1} to ${to + 1}`,
      fields: [moved.id],
    });
    setDirty(true);
  };

  const duplicate = (index: number) => {
    const source = draft[index];
    setDraft((current) => {
      const copy = JSON.parse(JSON.stringify(current[index])) as PageSection;
      copy.id = newSectionId(copy.type);
      const next = [...current];
      next.splice(index + 1, 0, copy);
      return next;
    });
    audit.record({
      op: "duplicate",
      reason: `Duplicated ${sectionLabel(source.type)} at position ${index + 1}`,
      fields: [source.id],
    });
    setDirty(true);
  };

  const restoreSection = (section: PageSection, index: number) => {
    setDraft((current) => {
      const next = [...current];
      next.splice(Math.min(index, next.length), 0, section);
      return next;
    });
    audit.record({
      op: "add",
      reason: `Restored ${sectionLabel(section.type)} at position ${index + 1}`,
      fields: [section.id],
    });
    setDirty(true);
    toast.success(`${sectionLabel(section.type)} restored`);
  };

  const confirmRemove = (id: string) => {
    const index = draft.findIndex((section) => section.id === id);
    if (index === -1) return;
    const target = draft[index];
    setDraft((current) => current.filter((section) => section.id !== id));
    setSettingsId((current) => (current === id ? null : current));
    audit.record({
      op: "delete",
      reason: `Deleted ${sectionLabel(target.type)} from position ${index + 1}`,
      fields: [id],
    });
    setDirty(true);
    toast.success(`${sectionLabel(target.type)} deleted`, {
      description: "Not saved yet — you can put it back.",
      action: {
        label: "Restore",
        onClick: () => restoreSection(target, index),
      },
    });
  };

  const remove = (id: string) => {
    const target = draft.find((section) => section.id === id);
    if (!target) return;
    const confirmed = window.confirm(`Delete ${sectionLabel(target.type)}?`);
    if (confirmed) confirmRemove(id);
  };

  const insertAt = (index: number, type: PageSectionType) => {
    const section = createSection(type);
    setDraft((current) => {
      const next = [...current];
      next.splice(index, 0, section);
      return next;
    });
    setSettingsId(section.id);
    audit.record({
      op: "add",
      reason: `Added ${sectionLabel(type)} at position ${index + 1}`,
      fields: [section.id],
    });
    setDirty(true);
  };

  /** Copy one section (or the whole page) to the cross-page clipboard. */
  const copyToClipboard = (items: PageSection[], what: string) => {
    copySectionsToClipboard(items, pageLabel);
    toast.success(`${what} copied — paste it on any page`);
  };

  const pasteAt = (index: number) => {
    if (!clipboard) return;
    const pasted = instantiateClipboardSections(clipboard);
    setDraft((current) => {
      const next = [...current];
      next.splice(index, 0, ...pasted);
      return next;
    });
    setSettingsId(pasted[0]?.id ?? null);
    setDirty(true);
    audit.record({
      op: "paste",
      reason: `Pasted ${pasted.length} section${pasted.length === 1 ? "" : "s"} from ${clipboard.sourceLabel} at position ${index + 1}`,
      fields: pasted.map((section) => section.id),
    });
    toast.success(
      pasted.length === 1
        ? `Pasted section from ${clipboard.sourceLabel}`
        : `Pasted ${pasted.length} sections from ${clipboard.sourceLabel}`,
    );
  };

  /** Background autosave of the draft layout, plus a local recovery copy. */
  const autosave = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setAutosaveState("saving");
    const snapshot = draftRef.current;
    const ops = audit.take();
    try {
      await updateContentSections({
        data: { id: entryId, sections: snapshot, mode: "draft", ops },
      });
      setAutosaveState("saved");
      setLastAutosaveAt(new Date().toISOString());
      writeRecoverySnapshot(entryId, snapshot, false);
    } catch {
      // Offline or server error: keep the browser copy so nothing is lost.
      setAutosaveState("offline");
      writeRecoverySnapshot(entryId, snapshot, true);
      audit.restore(ops);
    } finally {
      savingRef.current = false;
    }
  }, [audit, entryId]);

  // Keep a local recovery copy of every keystroke, then autosave after a pause.
  useEffect(() => {
    if (!editing || !canEdit || !dirty) return;
    writeRecoverySnapshot(entryId, draft, true);
    setAutosaveState("pending");
    const timer = window.setTimeout(() => {
      void autosave();
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [autosave, canEdit, dirty, draft, editing, entryId]);

  // Retry as soon as the connection comes back.
  useEffect(() => {
    if (!editing || autosaveState !== "offline") return;
    const onOnline = () => void autosave();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [autosave, autosaveState, editing]);

  // Offer to restore unsaved work left behind by a refresh or lost connection.
  useEffect(() => {
    if (!canEdit || recovery) return;
    const snapshot = readRecoverySnapshot(entryId);
    if (!snapshot) return;
    if (sameSections(snapshot.sections, baseline)) {
      clearRecoverySnapshot(entryId);
      return;
    }
    setRecovery(snapshot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit, entryId]);

  const persist = async (mode: "draft" | "publish") => {
    setSaving(mode);
    savingRef.current = true;
    const ops = audit.take();
    try {
      await updateContentSections({ data: { id: entryId, sections: draft, mode, ops } });

      setDirty(false);
      clearRecoverySnapshot(entryId);
      setAutosaveState("saved");
      setLastAutosaveAt(new Date().toISOString());
      if (mode === "publish") {
        setEditing(false);
        setSettingsId(null);
        // Refetch the route loader so the published layout replaces the
        // previously loaded (cached) copy without a manual reload.
        await router.invalidate();
        toast.success("Page published");
      } else {
        toast.success("Draft saved — not visible to visitors yet");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the page");
    } finally {
      savingRef.current = false;
      setSaving(null);
    }
  };

  const discard = async () => {
    setSaving("discard");
    try {
      await discardContentSectionsDraft({ data: { id: entryId } });
      clearRecoverySnapshot(entryId);
      setAutosaveState("idle");
      audit.clear();
      resetDraft(sections);
      setDirty(false);
      setEditing(false);
      setSettingsId(null);
      toast.success("Draft changes discarded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not discard the draft");
    } finally {
      setSaving(null);
    }
  };

  const settingsSection = draft.find((section) => section.id === settingsId) ?? null;
  const displayed = editing ? draft : preferDraft && hasDraft ? draftSections : sections;
  const busy = saving !== null;

  const addMenu = (index: number) => (
    <div className="flex items-center gap-2">
      <select
        aria-label="Add section"
        defaultValue=""
        className="h-9 rounded-full border border-border bg-card px-3 text-sm font-medium shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
        onChange={(event) => {
          const type = event.currentTarget.value as PageSectionType;
          event.currentTarget.value = "";
          if (type) insertAt(index, type);
        }}
      >
        <option value="">Add section</option>
        {SECTION_CATALOG.map((entry) => (
          <option key={entry.type} value={entry.type}>
            {entry.label}
          </option>
        ))}
      </select>
      {clipboard ? (
        <Button
          size="sm"
          variant="ghost"
          className="rounded-full bg-card/80 shadow-sm"
          onClick={() => pasteAt(index)}
        >
          <ClipboardPaste className="mr-1 h-3.5 w-3.5" /> Paste
        </Button>
      ) : null}
    </div>
  );

  return (
    <>
      <SectionRenderer
        sections={displayed}
        editing={editing}
        onTextChange={handleTextChange}
        selectedId={settingsId}
        onSelect={editing ? (id) => setSettingsId(id) : undefined}
        renderOverlay={
          editing
            ? (section, index) => (
                <div className="pointer-events-none absolute inset-0 z-30 ring-1 ring-inset ring-transparent transition group-hover/section:ring-ring/40">
                  <div className="pointer-events-auto absolute right-3 top-3 flex items-center gap-0.5 rounded-full border border-border/70 bg-card/95 px-1 py-0.5 opacity-0 shadow-md backdrop-blur transition focus-within:opacity-100 group-hover/section:opacity-100">
                    <span className="px-2 text-[11px] font-medium text-muted-foreground">
                      {sectionLabel(section.type)}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      disabled={index === 0}
                      onClick={() => move(index, index - 1)}
                      aria-label="Move section up"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      disabled={index === draft.length - 1}
                      onClick={() => move(index, index + 1)}
                      aria-label="Move section down"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => duplicate(index)}
                      aria-label="Duplicate section"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => copyToClipboard([section], sectionLabel(section.type))}
                      aria-label="Copy section for another page"
                    >
                      <ClipboardCopy className="h-3.5 w-3.5" />
                    </Button>
                    {clipboard ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => pasteAt(index + 1)}
                        aria-label="Paste copied section below"
                      >
                        <ClipboardPaste className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}

                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => replaceSection({ ...section, hidden: !section.hidden })}
                      aria-label={section.hidden ? "Show section" : "Hide section"}
                    >
                      {section.hidden ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => setSettingsId(section.id)}
                      aria-label="Section settings"
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => remove(section.id)}
                      aria-label="Delete section"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )
            : undefined
        }
        renderInsert={
          editing
            ? (index) => (
                <div className="relative z-20 flex justify-center py-2">{addMenu(index)}</div>
              )
            : undefined
        }
      />

      <Sheet
        open={Boolean(settingsSection)}
        onOpenChange={(open) => {
          if (!open) setSettingsId(null);
        }}
      >
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {settingsSection ? sectionLabel(settingsSection.type) : "Section settings"}
            </SheetTitle>
          </SheetHeader>
          {settingsSection ? (
            <div className="mt-4 space-y-4 pb-10">
              <SectionSettings section={settingsSection} onChange={replaceSection} />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {canEdit ? (
        <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 print:hidden">
          <div className="flex max-w-full flex-wrap items-center justify-center gap-2 rounded-2xl border border-border/70 bg-card/95 px-3 py-2 shadow-lg backdrop-blur">
            {editing ? (
              <>
                <span className="px-1 text-xs text-muted-foreground">
                  {autosaveState === "saving"
                    ? "Autosaving…"
                    : autosaveState === "pending"
                      ? "Unsaved changes"
                      : autosaveState === "offline"
                        ? "Offline — saved in this browser"
                        : autosaveState === "saved" && lastAutosaveAt
                          ? `Draft autosaved ${formatRecoveryTime(lastAutosaveAt)}`
                          : dirty
                            ? "Unsaved changes"
                            : hasDraft
                              ? "Unpublished draft"
                              : "Editing this page"}
                </span>
                <div className="flex items-center gap-0.5 rounded-full border border-border/70 px-0.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={undo}
                    disabled={busy || !history.canUndo}
                    aria-label="Undo"
                    title="Undo (Ctrl/⌘+Z)"
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={redo}
                    disabled={busy || !history.canRedo}
                    aria-label="Redo"
                    title="Redo (Ctrl/⌘+Shift+Z)"
                  >
                    <Redo2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyToClipboard(draft, "Page layout")}
                  disabled={busy || draft.length === 0}
                >
                  <ClipboardCopy className="mr-1 h-3.5 w-3.5" /> Copy layout
                </Button>
                {clipboard ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => pasteAt(draft.length)}
                    disabled={busy}
                  >
                    <ClipboardPaste className="mr-1 h-3.5 w-3.5" /> Paste
                  </Button>
                ) : null}

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => persist("draft")}
                  disabled={busy}
                >
                  {saving === "draft" ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="mr-1 h-3.5 w-3.5" />
                  )}
                  Save draft
                </Button>
                <Button size="sm" onClick={() => persist("publish")} disabled={busy}>
                  {saving === "publish" ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <UploadCloud className="mr-1 h-3.5 w-3.5" />
                  )}
                  Publish
                </Button>
                {hasDraft ? (
                  <Button size="sm" variant="ghost" onClick={discard} disabled={busy}>
                    {saving === "discard" ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Undo2 className="mr-1 h-3.5 w-3.5" />
                    )}
                    Discard draft
                  </Button>
                ) : null}
                <RevisionHistoryButton
                  entityType="content_entry"
                  entityId={entryId}
                  label="this page"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    resetDraft(hasDraft ? draftSections : sections);
                    setDirty(false);
                    setEditing(false);
                    setSettingsId(null);
                  }}
                  disabled={busy}
                >
                  <X className="mr-1 h-3.5 w-3.5" /> Close
                </Button>
              </>
            ) : (
              <>
                <span className="px-1 text-xs text-muted-foreground">
                  {hasDraft ? "Draft changes pending" : "Admin"}
                </span>
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Edit this page
                </Button>
                <RevisionHistoryButton
                  entityType="content_entry"
                  entityId={entryId}
                  label="this page"
                />
              </>
            )}
          </div>
        </div>
      ) : null}
      {recovery ? (
        <div className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 print:hidden">
          <div className="max-w-lg rounded-2xl border border-border/70 bg-card p-4 shadow-xl">
            <div className="space-y-1">
              <h2 className="font-serif text-xl text-foreground">Recover unsaved edits?</h2>
              <p className="text-sm text-muted-foreground">
                This browser has edits to this page from {formatRecoveryTime(recovery.savedAt)} that{" "}
                {recovery.unsynced
                  ? "never reached the server"
                  : "may be newer than the saved draft"}
                . Restore them to continue where you left off, or discard them to keep the saved
                version.
              </p>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  clearRecoverySnapshot(entryId);
                  setRecovery(null);
                  toast.success("Recovered copy discarded");
                }}
              >
                Discard them
              </Button>
              <Button
                onClick={() => {
                  resetDraft(recovery.sections);
                  setEditing(true);
                  setDirty(true);
                  setRecovery(null);
                  toast.success("Unsaved edits restored — review, then save or publish");
                }}
              >
                Restore edits
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
