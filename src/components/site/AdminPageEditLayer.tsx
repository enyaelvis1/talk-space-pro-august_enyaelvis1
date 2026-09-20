import { useEffect, useState, type ReactNode } from "react";
import { Loader2, PencilLine, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { EditablePublicPage } from "@/components/site/EditablePublicPage";
import {
  getCmsPermissions,
  getContentEntryPreview,
  type ContentEntryPreview,
} from "@/lib/admin.functions";

type Props = {
  /** CMS page slug for this public route. */
  slug: string;
  /** Human label used in breadcrumbs while editing. */
  label: string;
  /** Public page markup shown to everyone (and to admins when not editing). */
  children: ReactNode;
  /**
   * Route to open instead of in-page editing (used for pages whose layout is
   * not stored as CMS sections, e.g. the homepage).
   */
  editorPath?: string;
  editButtonLabel?: string;
};

/**
 * Renders the normal public page, plus a floating "Edit this page" control for
 * signed-in admins. Clicking it swaps the page for the in-page section editor
 * so content can be changed directly on the live page, WordPress-style.
 */
const EDIT_PARAM = "edit";
const EDIT_STICKY_KEY = "cms:edit-mode-sticky";

function setEditParam(on: boolean) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (on) url.searchParams.set(EDIT_PARAM, "1");
  else url.searchParams.delete(EDIT_PARAM);
  window.history.replaceState(window.history.state, "", url.toString());
}

function setStickyEditMode(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (on) window.sessionStorage.setItem(EDIT_STICKY_KEY, "1");
    else window.sessionStorage.removeItem(EDIT_STICKY_KEY);
  } catch {
    // storage unavailable — edit mode simply won't persist
  }
}

function isStickyEditMode() {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(EDIT_STICKY_KEY) === "1";
  } catch {
    return false;
  }
}

export function AdminPageEditLayer({
  slug,
  label,
  children,
  editorPath,
  editButtonLabel = "Edit this page",
}: Props) {
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ContentEntryPreview | null>(null);
  const [autoOpened, setAutoOpened] = useState(false);

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

  // Navigating to another public page resets this layer so the new slug can
  // re-evaluate whether edit mode should carry over.
  useEffect(() => {
    setPreview(null);
    setAutoOpened(false);
  }, [slug]);

  useEffect(() => {
    if (!canEdit || autoOpened || preview || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const value = params.get(EDIT_PARAM);
    const fromUrl = value === "1" || value === "true";
    const sticky = isStickyEditMode();
    if (!fromUrl && !sticky) {
      if (value !== null) setEditParam(false);
      return;
    }
    setAutoOpened(true);
    if (editorPath) {
      // Pages with a dedicated admin editor only jump there on an explicit
      // ?edit=1 link, so sticky mode doesn't hijack ordinary navigation.
      if (fromUrl) {
        setStickyEditMode(false);
        window.location.replace(editorPath);
      } else {
        setEditParam(false);
      }
      return;
    }
    setStickyEditMode(true);
    void startEditing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit, autoOpened, preview, editorPath, slug]);

  const startEditing = async () => {
    setLoading(true);
    setEditParam(true);
    setStickyEditMode(true);
    try {
      const result = (await getContentEntryPreview({
        data: { kind: "page", slug },
      })) as ContentEntryPreview | null;
      if (!result) {
        setEditParam(false);
        setStickyEditMode(false);
        toast.error("This page has no editable content yet", {
          description: "Create it first in Admin → Public pages.",
        });
        return;
      }
      setPreview(result);
    } catch (error) {
      setEditParam(false);
      setStickyEditMode(false);
      toast.error(error instanceof Error ? error.message : "Could not open the editor.");
    } finally {
      setLoading(false);
    }
  };

  if (preview) {
    return (
      <div className="relative">
        <div className="sticky top-0 z-50 border-b border-amber-300/60 bg-amber-50/95 px-4 py-2 text-sm backdrop-blur sm:px-6">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-3">
            <span className="font-medium text-amber-900">
              Editing “{preview.label}” — changes stay in draft until you publish
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => {
                setPreview(null);
                setEditParam(false);
                setStickyEditMode(false);
              }}
            >
              <X className="mr-2 h-4 w-4" /> Exit editing
            </Button>
          </div>
        </div>
        <EditablePublicPage entry={preview.entry} label={preview.label} preferDraft />
      </div>
    );
  }

  return (
    <>
      {children}
      {canEdit ? (
        <div className="fixed bottom-6 left-6 z-50 print:hidden">
          {editorPath ? (
            <Button asChild size="sm" className="shadow-lg">
              <a href={editorPath}>
                <PencilLine className="mr-2 h-4 w-4" /> {editButtonLabel}
              </a>
            </Button>
          ) : (
            <Button
              size="sm"
              className="shadow-lg"
              disabled={loading}
              onClick={() => void startEditing()}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <PencilLine className="mr-2 h-4 w-4" />
              )}
              Edit this page
            </Button>
          )}
          <span className="sr-only">{label}</span>
        </div>
      ) : null}
    </>
  );
}
