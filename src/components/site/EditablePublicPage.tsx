import { Component, lazy, Suspense, useMemo, useState, type ReactNode } from "react";
import { PencilLine, RefreshCw, X } from "lucide-react";

import { SiteBreadcrumbs } from "@/components/site/SiteBreadcrumbs";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { ContentHtml } from "@/components/content/ContentHtml";
import { OptimizedImage } from "@/components/site/OptimizedImage";
import { SectionRenderer } from "@/components/site/sections/SectionRenderer";
import { Button } from "@/components/ui/button";
import { useBrowserAuthState } from "@/hooks/use-browser-auth-state";
import type { RenderedContentEntry } from "@/lib/content.functions";

type EditableSectionsModule = typeof import("@/components/site/EditableSections");
type EditableSectionsComponent = EditableSectionsModule["EditableSections"];
type LazyEditorModule = { default: EditableSectionsComponent };

const EDITOR_RETRY_DELAY_MS = 150;

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function mapEditorModule(module: EditableSectionsModule): LazyEditorModule {
  return {
    default: module.EditableSections,
  };
}

async function importEditorWithCacheBust(): Promise<LazyEditorModule> {
  const module = (await import(
    /* @vite-ignore */ `/src/components/site/EditableSections.tsx?editor=${Date.now()}`
  )) as EditableSectionsModule;
  return mapEditorModule(module);
}

async function importEditor(attempt: number): Promise<LazyEditorModule> {
  if (attempt > 0 && import.meta.env.DEV && typeof window !== "undefined") {
    return importEditorWithCacheBust();
  }

  try {
    const module = await import("@/components/site/EditableSections");
    return mapEditorModule(module);
  } catch (error) {
    if (import.meta.env.DEV && typeof window !== "undefined") {
      await wait(EDITOR_RETRY_DELAY_MS);
      return importEditorWithCacheBust();
    }
    throw error;
  }
}

type EditorLoadBoundaryProps = {
  children: ReactNode;
  fallbackSections: RenderedContentEntry["sections"];
  onCancel: () => void;
  onRetry: () => void;
  resetKey: number;
};

type EditorLoadBoundaryState = {
  failed: boolean;
};

class EditorLoadBoundary extends Component<EditorLoadBoundaryProps, EditorLoadBoundaryState> {
  state: EditorLoadBoundaryState = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[cms] section editor failed to load", error);
  }

  componentDidUpdate(previousProps: EditorLoadBoundaryProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({ failed: false });
    }
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <>
        <SectionRenderer sections={this.props.fallbackSections} />
        <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 print:hidden">
          <div className="flex max-w-full flex-wrap items-center justify-center gap-2 rounded-2xl border border-destructive/30 bg-card/95 px-3 py-2 shadow-lg backdrop-blur">
            <span className="px-1 text-xs text-muted-foreground">Editor failed to load</span>
            <Button size="sm" variant="outline" onClick={this.props.onRetry}>
              <RefreshCw className="mr-1 h-3.5 w-3.5" /> Retry editor
            </Button>
            <Button size="sm" variant="ghost" onClick={this.props.onCancel}>
              <X className="mr-1 h-3.5 w-3.5" /> Exit editing
            </Button>
          </div>
        </div>
      </>
    );
  }
}

type EditablePublicPageProps = {
  entry: RenderedContentEntry;
  label: string;
  afterSections?: ReactNode;
  /** Show unpublished section changes (used by the admin draft preview). */
  preferDraft?: boolean;
};

export function EditablePublicPage({
  entry,
  label,
  afterSections,
  preferDraft = false,
}: EditablePublicPageProps) {
  const sectionsToShow =
    preferDraft && entry.draftSections.length > 0 ? entry.draftSections : entry.sections;
  const hasBuilderSections = sectionsToShow.length > 0;
  const { status: authStatus, isAdmin } = useBrowserAuthState();
  const canEdit = authStatus === "ready" && isAdmin;
  const [editing, setEditing] = useState(preferDraft);
  const [editorAttempt, setEditorAttempt] = useState(0);
  const EditableSectionsEditor = useMemo(
    () => lazy(() => importEditor(editorAttempt)),
    [editorAttempt],
  );

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <SiteBreadcrumbs items={[{ label }, { label: entry.title }]} />
      <main id="main" className="flex-1 bg-surface-page">
        {hasBuilderSections ? (
          editing || preferDraft ? (
            <EditorLoadBoundary
              fallbackSections={sectionsToShow}
              onCancel={() => setEditing(false)}
              onRetry={() => setEditorAttempt((attempt) => attempt + 1)}
              resetKey={editorAttempt}
            >
              <Suspense fallback={<SectionRenderer sections={sectionsToShow} />}>
                <EditableSectionsEditor
                  entryId={entry.id}
                  sections={entry.sections}
                  draftSections={entry.draftSections}
                  preferDraft={preferDraft}
                  pageLabel={entry.title}
                  startInEditMode={editing}
                />
              </Suspense>
            </EditorLoadBoundary>
          ) : (
            <>
              <SectionRenderer sections={sectionsToShow} />
              {afterSections}
              {canEdit ? (
                <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 print:hidden">
                  <div className="flex max-w-full items-center justify-center gap-2 rounded-2xl border border-border/70 bg-card/95 px-3 py-2 shadow-lg backdrop-blur">
                    <span className="px-1 text-xs text-muted-foreground">
                      {entry.draftSections.length > 0 ? "Draft changes pending" : "Admin"}
                    </span>
                    <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                      <PencilLine className="mr-1 h-3.5 w-3.5" /> Edit this page
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )
        ) : (
          <article className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
            <p className="eyebrow">{label}</p>
            <h1 className="display-1 mt-4 text-brand-deep">{entry.title}</h1>
            {entry.excerpt ? (
              <p className="mt-6 max-w-3xl text-lg text-muted-foreground">{entry.excerpt}</p>
            ) : null}
            {entry.imageUrl ? (
              <OptimizedImage
                src={entry.imageUrl}
                alt={entry.title}
                width={1600}
                height={900}
                sizes="(max-width: 1024px) calc(100vw - 2rem), 896px"
                className="mt-10 aspect-[16/9] w-full rounded-3xl object-cover shadow-md"
              />
            ) : null}
            <div className="mt-10 space-y-6 text-base leading-8 text-foreground">
              <ContentHtml html={entry.bodyHtml} />
            </div>
            {afterSections}
          </article>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
