import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Layers,
  Loader2,
  Monitor,
  MoreHorizontal,
  Pencil,
  Plus,
  Redo2,
  Save,
  Smartphone,
  Tablet,
  Trash2,
  Undo2,
  UploadCloud,
} from "lucide-react";
import {
  copySectionsToClipboard,
  instantiateClipboardSections,
  useSectionClipboard,
} from "@/lib/section-clipboard";

import { ConfirmDeleteSectionDialog } from "@/components/admin/ConfirmDeleteSectionDialog";
import { RevisionHistoryButton } from "@/components/admin/RevisionHistoryButton";
import { SectionSettings } from "@/components/admin/SectionSettings";
import { useUndoableState } from "@/hooks/use-undoable-state";
import { changedSectionFields, useSectionAuditTrail } from "@/hooks/use-section-audit";
import { SectionRenderer } from "@/components/site/sections/SectionRenderer";
import { setSectionValue } from "@/components/site/sections/section-paths";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createSection,
  newSectionId,
  SECTION_CATALOG,
  sectionLabel,
  type PageSection,
  type PageSectionType,
} from "@/lib/page-sections";
import { discardContentSectionsDraft, updateContentSections } from "@/lib/admin.functions";
import { cn } from "@/lib/utils";

type PageBuilderProps = {
  entryId: string;
  /** Published layout. */
  initialSections: PageSection[];
  /** Unpublished layout changes, if any. */
  initialDraftSections?: PageSection[];
  canEdit: boolean;
  canPublish?: boolean;
  /** Page name shown when sections are copied to the clipboard. */
  pageLabel?: string;
  onDirtyChange?: (dirty: boolean) => void;
  /** Called after a past version is restored so the parent can reload the entry. */
  onRestored?: () => void;
};

const DEVICES = {
  desktop: { label: "Desktop", width: "1180px", icon: Monitor },
  tablet: { label: "Tablet", width: "820px", icon: Tablet },
  mobile: { label: "Mobile", width: "420px", icon: Smartphone },
} as const;

type DeviceKey = keyof typeof DEVICES;

/**
 * WordPress-style visual page builder. Sections render with the real site
 * components, text is editable in place, and structure is edited from the
 * outline + settings panel.
 */
export function PageBuilder({
  entryId,
  initialSections,
  initialDraftSections = [],
  canEdit,
  canPublish = canEdit,
  pageLabel = "another page",
  onDirtyChange,
  onRestored,
}: PageBuilderProps) {
  const router = useRouter();
  const hasDraft = initialDraftSections.length > 0;
  const startingSections = hasDraft ? initialDraftSections : initialSections;
  const history = useUndoableState<PageSection[]>(startingSections);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; label: string } | null>(null);
  const sections = history.value;
  const setSections = history.set;
  const resetSections = history.reset;
  const [selectedId, setSelectedId] = useState<string | null>(startingSections[0]?.id ?? null);
  const [device, setDevice] = useState<DeviceKey>("desktop");
  /** Live preview: renders the unsaved layout exactly as a visitor would see it. */
  const [previewing, setPreviewing] = useState(false);
  const editingCanvas = canEdit && !previewing;
  const [saving, setSaving] = useState<null | "draft" | "publish" | "discard">(null);
  const [dirty, setDirty] = useState(false);
  const clipboard = useSectionClipboard();
  const audit = useSectionAuditTrail();
  const dragIndex = useRef<number | null>(null);

  useEffect(() => {
    const next = initialDraftSections.length > 0 ? initialDraftSections : initialSections;
    resetSections(next);
    setSelectedId(next[0]?.id ?? null);
    setDirty(false);
  }, [entryId, initialSections, initialDraftSections, resetSections]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const markDirty = useCallback(() => setDirty(true), []);

  const undo = useCallback(() => {
    if (!history.canUndo) return;
    history.undo();
    markDirty();
  }, [history, markDirty]);

  const redo = useCallback(() => {
    if (!history.canRedo) return;
    history.redo();
    markDirty();
  }, [history, markDirty]);

  useEffect(() => {
    if (!canEdit) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canEdit, undo, redo]);

  const selected = useMemo(
    () => sections.find((section) => section.id === selectedId) ?? null,
    [sections, selectedId],
  );

  const replaceSection = useCallback(
    (next: PageSection) => {
      const previous = sections.find((section) => section.id === next.id) ?? null;
      setSections((current) => current.map((section) => (section.id === next.id ? next : section)));
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
          fields: [
            next.id,
            ...changedSectionFields(
              previous as unknown as Record<string, unknown> | null,
              next as unknown as Record<string, unknown>,
            ),
          ],
          key: `settings:${next.id}`,
        });
      }
      markDirty();
    },
    [audit, markDirty, sections, setSections],
  );

  const handleTextChange = useCallback(
    (sectionId: string, path: string, value: string) => {
      setSections(
        (current) =>
          current.map((section) =>
            section.id === sectionId ? setSectionValue(section, path, value) : section,
          ),
        { mergeKey: `text:${sectionId}:${path}` },
      );
      const type = sections.find((section) => section.id === sectionId)?.type;
      audit.record({
        op: "text",
        reason: `Edited text in ${type ? sectionLabel(type) : "section"}`,
        fields: [sectionId, path],
        key: `text:${sectionId}:${path}`,
      });
      markDirty();
    },
    [audit, markDirty, sections, setSections],
  );

  const move = useCallback(
    (from: number, to: number) => {
      if (to < 0 || to >= sections.length) return;
      const moved = sections[from];
      setSections((current) => {
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
      markDirty();
    },
    [audit, sections, markDirty, setSections],
  );

  const addSection = useCallback(
    (type: PageSectionType) => {
      const section = createSection(type);
      setSections((current) => [...current, section]);
      setSelectedId(section.id);
      audit.record({
        op: "add",
        reason: `Added ${sectionLabel(type)}`,
        fields: [section.id],
      });
      markDirty();
    },
    [audit, markDirty, setSections],
  );

  const duplicate = useCallback(
    (index: number) => {
      const source = sections[index];
      setSections((current) => {
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
      markDirty();
    },
    [audit, markDirty, sections, setSections],
  );

  /** Copy a section (or the whole layout) for reuse on any other page. */
  const copyToClipboard = useCallback(
    (items: PageSection[], what: string) => {
      copySectionsToClipboard(items, pageLabel);
      toast.success(`${what} copied — paste it on any page`);
    },
    [pageLabel],
  );

  const pasteAt = useCallback(
    (index: number) => {
      if (!clipboard) return;
      const pasted = instantiateClipboardSections(clipboard);
      setSections((current) => {
        const next = [...current];
        next.splice(index, 0, ...pasted);
        return next;
      });
      setSelectedId(pasted[0]?.id ?? null);
      audit.record({
        op: "paste",
        reason: `Pasted ${pasted.length} section${pasted.length === 1 ? "" : "s"} from ${clipboard.sourceLabel} at position ${index + 1}`,
        fields: pasted.map((section) => section.id),
      });
      markDirty();
      toast.success(
        pasted.length === 1
          ? `Pasted section from ${clipboard.sourceLabel}`
          : `Pasted ${pasted.length} sections from ${clipboard.sourceLabel}`,
      );
    },
    [audit, clipboard, markDirty, setSections],
  );

  const restoreSection = useCallback(
    (section: PageSection, index: number) => {
      setSections((current) => {
        const next = [...current];
        next.splice(Math.min(index, next.length), 0, section);
        return next;
      });
      audit.record({
        op: "add",
        reason: `Restored ${sectionLabel(section.type)} at position ${index + 1}`,
        fields: [section.id],
      });
      markDirty();
      toast.success(`${sectionLabel(section.type)} restored`);
    },
    [audit, markDirty, setSections],
  );

  const confirmRemove = useCallback(
    (id: string) => {
      const index = sections.findIndex((section) => section.id === id);
      if (index === -1) return;
      const target = sections[index];
      setSections((current) => current.filter((section) => section.id !== id));
      setSelectedId((current) => (current === id ? null : current));
      audit.record({
        op: "delete",
        reason: `Deleted ${sectionLabel(target.type)} from position ${index + 1}`,
        fields: [id],
      });
      markDirty();
      toast.success(`${sectionLabel(target.type)} deleted`, {
        description: "Not saved yet — you can put it back.",
        action: {
          label: "Restore",
          onClick: () => restoreSection(target, index),
        },
      });
    },
    [audit, markDirty, restoreSection, sections, setSections],
  );

  const remove = useCallback(
    (id: string) => {
      const target = sections.find((section) => section.id === id);
      if (!target) return;
      setPendingDelete({ id, label: sectionLabel(target.type) });
    },
    [sections],
  );

  const save = useCallback(
    async (mode: "draft" | "publish") => {
      if (!canEdit) return;
      if (mode === "publish" && !canPublish) return;
      setSaving(mode);
      const ops = audit.take();
      try {
        await updateContentSections({ data: { id: entryId, sections, mode, ops } });
        // Drop stale loader data so the public page and admin list reflect the
        // change immediately after publishing.
        await router.invalidate();
        setDirty(false);
        toast.success(mode === "publish" ? "Layout published" : "Draft saved");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not save the layout");
      } finally {
        setSaving(null);
      }
    },
    [audit, canEdit, canPublish, entryId, router, sections],
  );

  const discardDraft = useCallback(async () => {
    if (!canEdit) return;
    setSaving("discard");
    try {
      await discardContentSectionsDraft({ data: { id: entryId } });
      audit.clear();
      resetSections(initialSections);
      setSelectedId(initialSections[0]?.id ?? null);
      setDirty(false);
      toast.success("Draft changes discarded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not discard the draft");
    } finally {
      setSaving(null);
    }
  }, [audit, canEdit, entryId, initialSections, resetSections]);

  return (
    <div
      className={cn(
        "grid gap-4",
        previewing ? "grid-cols-1" : "xl:grid-cols-[300px_minmax(0,1fr)]",
      )}
    >
      {/* Outline */}
      {previewing ? null : (
        <aside className="space-y-3 rounded-2xl border border-border/70 bg-card/50 p-3 xl:col-start-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-brand-deep">
            <Layers className="h-4 w-4" /> Sections
          </div>
          <ol className="space-y-1.5">
            {sections.map((section, index) => (
              <li
                key={section.id}
                draggable={canEdit}
                onDragStart={() => {
                  dragIndex.current = index;
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (dragIndex.current !== null && dragIndex.current !== index)
                    move(dragIndex.current, index);
                  dragIndex.current = null;
                }}
                className={cn(
                  "rounded-xl border px-2.5 py-2 text-xs",
                  selectedId === section.id
                    ? "border-ring bg-muted/50"
                    : "border-border/60 bg-background",
                )}
              >
                <button
                  type="button"
                  className="block w-full text-left font-medium text-brand-deep"
                  onClick={() => setSelectedId(section.id)}
                >
                  {index + 1}. {sectionLabel(section.type)}
                  {section.hidden ? " (hidden)" : ""}
                </button>
                {canEdit ? (
                  <div className="mt-1 flex items-center gap-0.5">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      disabled={index === 0}
                      onClick={() => move(index, index - 1)}
                      aria-label="Move section up"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      disabled={index === sections.length - 1}
                      onClick={() => move(index, index + 1)}
                      aria-label="Move section down"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => duplicate(index)}
                      aria-label="Duplicate section"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => copyToClipboard([section], sectionLabel(section.type))}
                      aria-label="Copy section for another page"
                    >
                      <ClipboardCopy className="h-3 w-3" />
                    </Button>
                    {clipboard ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => pasteAt(index + 1)}
                        aria-label="Paste copied section below"
                      >
                        <ClipboardPaste className="h-3 w-3" />
                      </Button>
                    ) : null}

                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => replaceSection({ ...section, hidden: !section.hidden })}
                      aria-label="Toggle visibility"
                    >
                      {section.hidden ? (
                        <EyeOff className="h-3 w-3" />
                      ) : (
                        <Eye className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => remove(section.id)}
                      aria-label="Delete section"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
            {sections.length === 0 ? (
              <li className="rounded-xl border border-dashed border-border/70 px-3 py-6 text-center text-xs text-muted-foreground">
                No sections yet — add one below.
              </li>
            ) : null}
          </ol>

          {canEdit ? (
            <div className="space-y-2">
              <Select value="" onValueChange={(value) => addSection(value as PageSectionType)}>
                <SelectTrigger className="text-xs">
                  <span className="inline-flex items-center gap-1">
                    <Plus className="h-3.5 w-3.5" /> Add section
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {SECTION_CATALOG.map((entry) => (
                    <SelectItem key={entry.type} value={entry.type}>
                      <span className="font-medium">{entry.label}</span>
                      <span className="block text-xs text-muted-foreground">
                        {entry.description}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  disabled={sections.length === 0}
                  onClick={() => copyToClipboard(sections, "Page layout")}
                >
                  <ClipboardCopy className="mr-1 h-3.5 w-3.5" /> Copy all sections
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  disabled={!clipboard}
                  onClick={() => pasteAt(sections.length)}
                >
                  <ClipboardPaste className="mr-1 h-3.5 w-3.5" /> Paste
                </Button>
              </div>
              {clipboard ? (
                <p className="text-[11px] text-muted-foreground">
                  Clipboard:{" "}
                  {clipboard.sections.length === 1
                    ? sectionLabel(clipboard.sections[0].type)
                    : `${clipboard.sections.length} sections`}{" "}
                  from {clipboard.sourceLabel}
                </p>
              ) : null}
            </div>
          ) : null}
        </aside>
      )}

      {/* Canvas */}
      <div className="space-y-3 xl:col-start-2 xl:row-span-2 xl:row-start-1">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-border/70 bg-muted/30 p-0.5">
            {(Object.keys(DEVICES) as DeviceKey[]).map((key) => {
              const Icon = DEVICES[key].icon;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDevice(key)}
                  aria-label={DEVICES[key].label}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition",
                    device === key ? "bg-card text-brand-deep shadow-sm" : "text-muted-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{DEVICES[key].label}</span>
                </button>
              );
            })}
          </div>
          <Button
            type="button"
            size="sm"
            variant={previewing ? "default" : "outline"}
            onClick={() => setPreviewing((current) => !current)}
            aria-pressed={previewing}
            title="See how the page looks to visitors right now"
          >
            {previewing ? (
              <>
                <Pencil className="mr-1 h-3.5 w-3.5" /> Back to editing
              </>
            ) : (
              <>
                <Eye className="mr-1 h-3.5 w-3.5" /> Preview
              </>
            )}
          </Button>
          <span className="text-xs text-muted-foreground">
            {previewing
              ? "This is how the page will look once you publish"
              : dirty
                ? "You have edits that aren't saved yet"
                : hasDraft
                  ? "Saved, but not live yet — press Publish"
                  : "Everything is saved and live"}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!canEdit || saving !== null || !dirty}
              onClick={() => save("draft")}
              title="Keep your edits without showing them to visitors"
            >
              {saving === "draft" ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="mr-1 h-3.5 w-3.5" />
              )}
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!canPublish || saving !== null}
              onClick={() => save("publish")}
              title="Make your edits visible to visitors"
            >
              {saving === "publish" ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <UploadCloud className="mr-1 h-3.5 w-3.5" />
              )}
              Publish
            </Button>
            {previewing ? null : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" size="sm" variant="ghost" aria-label="More options">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuItem
                    disabled={!canEdit || saving !== null || !history.canUndo}
                    onSelect={() => undo()}
                  >
                    <Undo2 className="mr-2 h-4 w-4" /> Undo last change
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!canEdit || saving !== null || !history.canRedo}
                    onSelect={() => redo()}
                  >
                    <Redo2 className="mr-2 h-4 w-4" /> Redo
                  </DropdownMenuItem>
                  {hasDraft ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        disabled={!canEdit || saving !== null}
                        onSelect={() => void discardDraft()}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Throw away unpublished edits
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {previewing ? null : (
              <RevisionHistoryButton
                entityType="content_entry"
                entityId={entryId}
                label={`${pageLabel} — earlier versions of this page`}
                onRestored={() => onRestored?.()}
              />
            )}
          </div>
        </div>

        {previewing ? null : (
          <p className="rounded-xl bg-muted/40 px-3 py-2 text-xs leading-5 text-muted-foreground">
            <strong className="font-semibold text-brand-deep">How to edit this page:</strong> click
            any text on the page below and type over it. Use <em>Sections</em> on the left to add,
            move or remove a block, and the panel on the right for that block&apos;s options. Press{" "}
            <strong className="font-semibold text-brand-deep">Save</strong> to keep your work, then{" "}
            <strong className="font-semibold text-brand-deep">Publish</strong> when you want
            visitors to see it.
          </p>
        )}

        <div className="overflow-x-auto rounded-2xl border border-border/70 bg-surface-cream p-3">
          <div
            className="mx-auto bg-background shadow-sm transition-all"
            style={{
              width: DEVICES[device].width,
              maxWidth: device === "desktop" ? undefined : "100%",
            }}
          >
            <SectionRenderer
              sections={sections}
              editing={editingCanvas}
              onTextChange={editingCanvas ? handleTextChange : undefined}
              selectedId={editingCanvas ? selectedId : null}
              onSelect={editingCanvas ? setSelectedId : undefined}
            />
            {sections.length === 0 ? (
              <p className="p-10 text-center text-sm text-muted-foreground">
                This page has no builder sections yet. Add one from the left to start building.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Settings */}
      {previewing ? null : (
        <aside className="space-y-3 rounded-2xl border border-border/70 bg-card/50 p-3 xl:col-start-1">
          <div className="text-sm font-semibold text-brand-deep">
            {selected ? sectionLabel(selected.type) : "Section settings"}
          </div>
          {selected ? (
            <fieldset disabled={!canEdit} className="space-y-4 disabled:opacity-70">
              <SectionSettings section={selected} onChange={replaceSection} />
            </fieldset>
          ) : (
            <p className="text-xs text-muted-foreground">
              Click a block on the page (or pick one from Sections on the left) and its options will
              show up here.
            </p>
          )}
        </aside>
      )}

      <ConfirmDeleteSectionDialog
        sectionLabel={pendingDelete?.label ?? null}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) confirmRemove(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
