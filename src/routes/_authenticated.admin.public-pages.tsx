import { createFileRoute, Link, useBlocker, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  CheckCircle2,
  CircleDashed,
  ExternalLink,
  Eye,
  EyeOff,
  CalendarClock,
  ScanEye,
  ShieldAlert,
  Loader2,
  Save,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { PageCanvas } from "@/components/admin/PageCanvas";
import { PageBuilder } from "@/components/admin/PageBuilder";
import { readDraftSectionsFromMetadata, readSectionsFromMetadata } from "@/lib/page-sections";
import { ContentHtml } from "@/components/content/ContentHtml";
import { MediaPicker } from "@/components/admin/MediaPicker";
import { MediaUploadInput } from "@/components/admin/MediaUploadInput";
import { RevisionHistoryButton } from "@/components/admin/RevisionHistoryButton";
import { AdminWorkspaceShell } from "@/components/progress/AdminSidebar";
import { canonicalUrl } from "@/lib/seo";
import { PUBLIC_PAGE_CONFIG, resolvePublicPageSlug } from "@/lib/public-pages";
import { getPublishedEntry } from "@/lib/content.functions";
import {
  ensurePublicPageEntry,
  getAdminContentEntry,
  listPublicPageEntries,
  scheduleContentPublish,
  setContentStatus,
  updateContentBody,
  updateContentFields,
  updateContentSeo,
  readContentSeoFields,
  getCmsPermissions,
  signContentMediaUrl,
  type CmsPermissions,
  type AdminContentDetail,
  type ContentSeoFields,
  type PublicPageSummary,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/public-pages")({
  validateSearch: (search: Record<string, unknown>) => ({
    page: typeof search.page === "string" ? search.page : "about",
  }),
  head: () => ({
    meta: [{ title: "Public pages | Talk Space Admin" }, { name: "robots", content: "noindex" }],
    links: [{ rel: "canonical", href: canonicalUrl("/admin/public-pages") }],
  }),
  component: PublicPagesAdminRoute,
});

function stripHtml(html: string) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function StatusBadge({ status }: { status: string }) {
  if (status === "publish") {
    return (
      <Badge variant="secondary" className="gap-1">
        <CheckCircle2 className="h-3 w-3" /> Published
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      <CircleDashed className="h-3 w-3" /> {status === "missing" ? "Not created" : "Draft"}
    </Badge>
  );
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  if (!value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function PublicPagesAdminRoute() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const currentPage = resolvePublicPageSlug(search.page) ?? "about";
  const pageMeta = useMemo(
    () => PUBLIC_PAGE_CONFIG.find((page) => page.key === currentPage) ?? PUBLIC_PAGE_CONFIG[0],
    [currentPage],
  );

  const [summaries, setSummaries] = useState<PublicPageSummary[]>([]);
  const [entry, setEntry] = useState<AdminContentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [autosaving, setAutosaving] = useState(false);
  const [autosaveEnabled, setAutosaveEnabled] = useState(true);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [featured, setFeatured] = useState("");
  const [body, setBody] = useState("");
  const [featuredUrl, setFeaturedUrl] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"layout" | "edit" | "preview">("layout");
  const emptySeo: ContentSeoFields = {
    metaTitle: "",
    metaDescription: "",
    ogTitle: "",
    ogDescription: "",
    ogImage: "",
    noindex: false,
  };
  const [seo, setSeo] = useState<ContentSeoFields>(emptySeo);
  const [scheduleAt, setScheduleAt] = useState("");
  const [unpublishAt, setUnpublishAt] = useState("");
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [permissions, setPermissions] = useState<CmsPermissions | null>(null);
  const canEdit = permissions?.canEdit ?? false;
  const canPublish = permissions?.canPublish ?? false;
  const builderSections = useMemo(
    () => (entry ? readSectionsFromMetadata(entry.metadata) : []),
    [entry],
  );
  const builderDraftSections = useMemo(
    () => (entry ? readDraftSectionsFromMetadata(entry.metadata) : []),
    [entry],
  );

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const perms = (await getCmsPermissions()) as CmsPermissions;
        if (active) setPermissions(perms);
      } catch {
        if (active)
          setPermissions({ signedIn: false, isAdmin: false, canEdit: false, canPublish: false });
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const refreshSummaries = useCallback(async () => {
    try {
      const rows = (await listPublicPageEntries()) as PublicPageSummary[];
      setSummaries(rows);
    } catch {
      /* non-fatal: the sidebar simply shows no status badges */
    }
  }, []);

  const applyEntry = useCallback((detail: AdminContentDetail, fallbackBody?: string) => {
    setEntry(detail);
    setTitle(detail.title);
    const initialBody = detail.bodyHtml?.trim() ? detail.bodyHtml : (fallbackBody ?? "");
    setBody(initialBody);
    setFeatured(detail.featuredMediaPath ?? "");
    setExcerpt(detail.excerptHtml?.trim() || stripHtml(initialBody).slice(0, 240));
    setSeo(readContentSeoFields(detail.metadata ?? {}));
    setScheduleAt(toLocalInput(detail.scheduledPublishAt));
    setUnpublishAt(toLocalInput(detail.scheduledUnpublishAt));
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void (async () => {
      try {
        const detail = (await ensurePublicPageEntry({
          data: { key: currentPage },
        })) as AdminContentDetail;

        let fallbackBody = "";
        if (!detail.bodyHtml?.trim()) {
          const published = await getPublishedEntry({
            data: { kind: "page", slug: pageMeta.contentSlug },
          });
          fallbackBody = published?.bodyHtml ?? "";
        }

        if (!active) return;
        applyEntry(detail, fallbackBody);
      } catch (err) {
        if (active) toast.error(err instanceof Error ? err.message : "Failed to load page.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    void refreshSummaries();
    return () => {
      active = false;
    };
  }, [applyEntry, currentPage, pageMeta.contentSlug, refreshSummaries]);

  useEffect(() => {
    let cancelled = false;
    const path = featured.trim();
    if (!path) {
      setFeaturedUrl(null);
      return;
    }
    if (/^https?:\/\//i.test(path)) {
      setFeaturedUrl(path);
      return;
    }
    void signContentMediaUrl({ data: { path } })
      .then((res) => {
        if (!cancelled) setFeaturedUrl(res?.signedUrl ?? null);
      })
      .catch(() => {
        if (!cancelled) setFeaturedUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [featured]);

  const dirty = useMemo(() => {
    if (!entry) return false;
    return (
      title !== entry.title ||
      excerpt !== (entry.excerptHtml ?? "") ||
      featured !== (entry.featuredMediaPath ?? "") ||
      body !== (entry.bodyHtml ?? "") ||
      JSON.stringify(seo) !== JSON.stringify(readContentSeoFields(entry.metadata ?? {}))
    );
  }, [body, entry, excerpt, featured, seo, title]);

  const reload = useCallback(
    async (id: string) => {
      const refreshed = (await getAdminContentEntry({ data: { id } })) as AdminContentDetail | null;
      if (refreshed) applyEntry(refreshed);
      await refreshSummaries();
    },
    [applyEntry, refreshSummaries],
  );

  async function save(publish?: boolean, options?: { silent?: boolean }) {
    if (!entry) return;
    if (!canEdit) {
      if (!options?.silent) toast.error("Admin permission required to edit pages.");
      return;
    }
    if (publish && !canPublish) {
      toast.error("Admin permission required to publish pages.");
      return;
    }
    setSaving(true);
    try {
      const updates: Record<string, unknown> = {};
      if (title.trim() && title !== entry.title) updates.title = title.trim();
      if (excerpt !== (entry.excerptHtml ?? "")) updates.excerptHtml = excerpt.trim() || null;
      if (Object.keys(updates).length > 0) {
        await updateContentFields({ data: { id: entry.id, ...updates } });
      }
      if (body !== (entry.bodyHtml ?? "") || featured !== (entry.featuredMediaPath ?? "")) {
        await updateContentBody({
          data: { id: entry.id, bodyHtml: body, featuredMediaPath: featured.trim() || null },
        });
      }
      if (JSON.stringify(seo) !== JSON.stringify(readContentSeoFields(entry.metadata ?? {}))) {
        await updateContentSeo({ data: { id: entry.id, ...seo } });
      }
      if (publish) {
        await setContentStatus({ data: { id: entry.id, status: "publish" } });
      }
      await reload(entry.id);
      setLastSavedAt(new Date());
      if (!options?.silent)
        toast.success(publish ? "Page published to the website." : "Draft saved.");
    } catch (err) {
      if (!options?.silent) toast.error(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  const saveRef = useRef(save);
  saveRef.current = save;

  // Autosave drafts a couple of seconds after typing stops.
  useEffect(() => {
    if (!dirty || !canEdit || !entry || saving || !autosaveEnabled) return;
    const timer = window.setTimeout(() => {
      setAutosaving(true);
      void saveRef.current(false, { silent: true }).finally(() => setAutosaving(false));
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [autosaveEnabled, body, canEdit, dirty, entry, excerpt, featured, saving, seo, title]);

  // Warn on tab close / reload with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // Warn on in-app navigation with unsaved changes.
  useBlocker({
    shouldBlockFn: () =>
      !window.confirm("You have unsaved changes on this page. Leave without saving?"),
    enableBeforeUnload: false,
    disabled: !dirty,
  });

  async function saveSchedule(clear?: boolean) {
    if (!entry) return;
    if (!canPublish) {
      toast.error("Admin permission required to schedule pages.");
      return;
    }
    setScheduleSaving(true);
    try {
      await scheduleContentPublish({
        data: {
          id: entry.id,
          scheduledPublishAt: clear ? null : fromLocalInput(scheduleAt),
          scheduledUnpublishAt: clear ? null : fromLocalInput(unpublishAt),
        },
      });
      await reload(entry.id);
      toast.success(clear ? "Schedule cleared." : "Schedule saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the schedule.");
    } finally {
      setScheduleSaving(false);
    }
  }

  async function toggleStatus() {
    if (!entry) return;
    if (!canPublish) {
      toast.error("Admin permission required to publish pages.");
      return;
    }
    const nextStatus = entry.status === "publish" ? "draft" : "publish";
    setStatusUpdating(true);
    try {
      await setContentStatus({ data: { id: entry.id, status: nextStatus } });
      await reload(entry.id);
      toast.success(
        nextStatus === "publish"
          ? "Page is now live on the website."
          : "Page unpublished — the website shows the built-in design again.",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Status change failed.");
    } finally {
      setStatusUpdating(false);
    }
  }

  const published = entry?.status === "publish";

  return (
    <AdminWorkspaceShell>
      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Admin · Public pages</p>
            <h1 className="display-1 mt-2 text-brand-deep">Website content</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Edit each public page with rich text and publish straight to the live website. Saved
              drafts stay hidden until you publish.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Link>
            </Button>
            {entry ? (
              <RevisionHistoryButton
                entityType="content_entry"
                entityId={entry.id}
                label={entry.title}
                onRestored={() => void reload(entry.id)}
              />
            ) : null}
            <Button asChild variant="outline" size="sm" disabled={!entry}>
              <Link
                to="/admin/preview/$kind/$slug"
                params={{ kind: "page", slug: pageMeta.contentSlug }}
                target="_blank"
                rel="noreferrer"
              >
                <ScanEye className="mr-2 h-4 w-4" /> Preview draft
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void toggleStatus()}
              disabled={!entry || statusUpdating || !canPublish}
            >
              {statusUpdating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : published ? (
                <EyeOff className="mr-2 h-4 w-4" />
              ) : (
                <Eye className="mr-2 h-4 w-4" />
              )}
              {published ? "Unpublish" : "Publish"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void save(false)}
              disabled={!dirty || saving || !canEdit}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save draft
            </Button>
            <Button onClick={() => void save(true)} disabled={!entry || saving || !canPublish}>
              Save &amp; publish
            </Button>
          </div>
        </div>

        {permissions && !canEdit ? (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-300/70 bg-amber-50 p-4 text-sm text-amber-900">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              You have read-only access. Only administrators can edit or publish public pages — ask
              an admin to grant you the admin role.
            </p>
          </div>
        ) : null}

        <div className="space-y-4 rounded-2xl border border-border/70 bg-card p-4">
          <div className="grid gap-2 lg:hidden">
            <Label htmlFor="page-select">Page</Label>
            <Select
              value={currentPage}
              onValueChange={(value) =>
                navigate({ to: "/admin/public-pages", search: { page: value } })
              }
            >
              <SelectTrigger id="page-select" className="w-full">
                <SelectValue placeholder="Choose a page" />
              </SelectTrigger>
              <SelectContent>
                {PUBLIC_PAGE_CONFIG.map((page) => {
                  const summary = summaries.find((row) => row.key === page.key);
                  return (
                    <SelectItem key={page.key} value={page.key}>
                      <span className="flex w-full items-center gap-2">
                        <span className="font-medium">{page.label}</span>
                        <span className="text-xs text-muted-foreground">{page.route}</span>
                        {summary ? <StatusBadge status={summary.status} /> : null}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            {loading ? (
              <div className="rounded-2xl border border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">
                Loading page editor…
              </div>
            ) : !entry ? (
              <div className="rounded-2xl border border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">
                This public page entry is not available yet.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm">
                  <StatusBadge status={entry.status} />
                  {autosaving ? (
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Autosaving…
                    </span>
                  ) : dirty ? (
                    <span className="text-amber-600">Unsaved changes</span>
                  ) : (
                    <span className="text-muted-foreground">
                      All changes saved
                      {lastSavedAt ? ` · ${lastSavedAt.toLocaleTimeString()}` : ""}
                    </span>
                  )}
                  {canEdit ? (
                    <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-current"
                        checked={autosaveEnabled}
                        onChange={(e) => setAutosaveEnabled(e.target.checked)}
                      />
                      Autosave
                    </label>
                  ) : null}
                  <a
                    href={pageMeta.route}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto inline-flex items-center gap-1 text-link"
                  >
                    View page <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="title">Page title</Label>
                    <Input
                      id="title"
                      value={title}
                      readOnly={!canEdit}
                      disabled={!canEdit}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slug">URL</Label>
                    <Input id="slug" value={pageMeta.route} readOnly disabled />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="excerpt">Intro / summary</Label>
                  <Textarea
                    id="excerpt"
                    rows={3}
                    value={excerpt}
                    readOnly={!canEdit}
                    disabled={!canEdit}
                    onChange={(e) => setExcerpt(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label>Page content</Label>
                    <div className="inline-flex rounded-full border border-border/70 bg-muted/30 p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setViewMode("layout")}
                        className={`rounded-full px-3 py-1 font-medium transition ${
                          viewMode === "layout"
                            ? "bg-card text-brand-deep shadow-sm"
                            : "text-muted-foreground"
                        }`}
                      >
                        Page builder
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode("edit")}
                        className={`rounded-full px-3 py-1 font-medium transition ${
                          viewMode === "edit"
                            ? "bg-card text-brand-deep shadow-sm"
                            : "text-muted-foreground"
                        }`}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode("preview")}
                        className={`rounded-full px-3 py-1 font-medium transition ${
                          viewMode === "preview"
                            ? "bg-card text-brand-deep shadow-sm"
                            : "text-muted-foreground"
                        }`}
                      >
                        Preview
                      </button>
                    </div>
                  </div>
                  {viewMode === "layout" && entry ? (
                    <PageBuilder
                      key={entry.id}
                      entryId={entry.id}
                      initialSections={builderSections}
                      initialDraftSections={builderDraftSections}
                      canEdit={canEdit}
                      canPublish={canPublish}
                      pageLabel={pageMeta.label}
                      onRestored={() => void reload(entry.id)}
                    />
                  ) : (
                    <PageCanvas
                      label={pageMeta.label}
                      title={title}
                      excerpt={excerpt}
                      imageUrl={featuredUrl}
                    >
                      {viewMode === "preview" ? (
                        <ContentHtml html={body} />
                      ) : (
                        <RichTextEditor
                          value={body}
                          editable={canEdit}
                          onChange={(next) => {
                            if (canEdit) setBody(next);
                          }}
                          placeholder="Write the public page content…"
                          frameClassName="rounded-2xl border border-dashed border-border/70 bg-card/40"
                          contentClassName="content-body min-h-[420px] px-4 py-4 focus:outline-none"
                        />
                      )}
                    </PageCanvas>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Content is styled with the live site theme — headings, links, lists, quotes and
                    images appear exactly as visitors will see them.
                  </p>
                </div>
                <details className="rounded-2xl border border-border/70 bg-muted/10">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-brand-deep">
                    Publish scheduling — optional
                  </summary>
                  <div className="p-2">
                    <fieldset
                      disabled={!canPublish}
                      className="space-y-4 rounded-2xl border border-border/70 bg-muted/20 p-4 disabled:opacity-70"
                    >
                      <div>
                        <h2 className="flex items-center gap-2 text-sm font-semibold text-brand-deep">
                          <CalendarClock className="h-4 w-4" /> Publish scheduling
                        </h2>
                        <p className="text-xs text-muted-foreground">
                          Times are in your local timezone. A background job publishes and
                          unpublishes the page automatically at these times.
                        </p>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="schedule-publish-at">Publish at</Label>
                          <Input
                            id="schedule-publish-at"
                            type="datetime-local"
                            value={scheduleAt}
                            onChange={(e) => setScheduleAt(e.target.value)}
                          />
                          <p className="text-xs text-muted-foreground">
                            The page stays a draft until this time.
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="schedule-unpublish-at">Unpublish at</Label>
                          <Input
                            id="schedule-unpublish-at"
                            type="datetime-local"
                            value={unpublishAt}
                            onChange={(e) => setUnpublishAt(e.target.value)}
                          />
                          <p className="text-xs text-muted-foreground">
                            The page reverts to a draft at this time.
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => void saveSchedule(false)}
                          disabled={scheduleSaving}
                        >
                          {scheduleSaving ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <CalendarClock className="mr-2 h-4 w-4" />
                          )}
                          Save schedule
                        </Button>
                        {entry.scheduledPublishAt || entry.scheduledUnpublishAt ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void saveSchedule(true)}
                            disabled={scheduleSaving}
                          >
                            Clear schedule
                          </Button>
                        ) : null}
                        <span className="text-xs text-muted-foreground">
                          {entry.scheduledPublishAt
                            ? `Publishes ${new Date(entry.scheduledPublishAt).toLocaleString()}`
                            : "No publish time set"}
                          {" · "}
                          {entry.scheduledUnpublishAt
                            ? `Unpublishes ${new Date(entry.scheduledUnpublishAt).toLocaleString()}`
                            : "No unpublish time set"}
                        </span>
                      </div>
                    </fieldset>
                  </div>
                </details>
                <details className="rounded-2xl border border-border/70 bg-muted/10">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-brand-deep">
                    Search &amp; social (SEO) — optional
                  </summary>
                  <div className="p-2">
                    <fieldset
                      disabled={!canEdit}
                      className="space-y-4 rounded-2xl border border-border/70 bg-muted/20 p-4 disabled:opacity-70"
                    >
                      <div>
                        <h2 className="text-sm font-semibold text-brand-deep">
                          Search &amp; social (SEO)
                        </h2>
                        <p className="text-xs text-muted-foreground">
                          Leave a field empty to use the built-in default for this page.
                        </p>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="meta-title">Meta title</Label>
                          <Input
                            id="meta-title"
                            value={seo.metaTitle}
                            maxLength={120}
                            placeholder={`${title} | Talk Space`}
                            onChange={(e) =>
                              setSeo((prev) => ({ ...prev, metaTitle: e.target.value }))
                            }
                          />
                          <p className="text-xs text-muted-foreground">
                            {seo.metaTitle.length}/60 recommended
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="og-title">Open Graph title</Label>
                          <Input
                            id="og-title"
                            value={seo.ogTitle}
                            maxLength={120}
                            placeholder="Defaults to the meta title"
                            onChange={(e) =>
                              setSeo((prev) => ({ ...prev, ogTitle: e.target.value }))
                            }
                          />
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="meta-description">Meta description</Label>
                          <Textarea
                            id="meta-description"
                            rows={3}
                            maxLength={320}
                            value={seo.metaDescription}
                            onChange={(e) =>
                              setSeo((prev) => ({ ...prev, metaDescription: e.target.value }))
                            }
                          />
                          <p className="text-xs text-muted-foreground">
                            {seo.metaDescription.length}/160 recommended
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="og-description">Open Graph description</Label>
                          <Textarea
                            id="og-description"
                            rows={3}
                            maxLength={320}
                            value={seo.ogDescription}
                            placeholder="Defaults to the meta description"
                            onChange={(e) =>
                              setSeo((prev) => ({ ...prev, ogDescription: e.target.value }))
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Social share image (Open Graph)</Label>
                        <MediaUploadInput
                          label="Social share image"
                          value={seo.ogImage}
                          onChange={(value) => setSeo((prev) => ({ ...prev, ogImage: value }))}
                          folder="social"
                          returnAs="path"
                          placeholder="content-media/… or upload"
                          cropAspect="1.91:1"
                          helpText="Used for og:image and twitter:image. Recommended 1200×630 — use Crop to frame it exactly."
                        />
                      </div>
                      <label className="flex items-center gap-2 text-sm text-muted-foreground">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={seo.noindex}
                          onChange={(e) =>
                            setSeo((prev) => ({ ...prev, noindex: e.target.checked }))
                          }
                        />
                        Hide this page from search engines (noindex)
                      </label>
                    </fieldset>
                  </div>
                </details>

                <fieldset
                  disabled={!canEdit}
                  className="space-y-2 rounded-2xl border border-border/70 bg-muted/20 p-4 disabled:opacity-70"
                >
                  <Label>Featured image</Label>
                  <MediaUploadInput
                    label="Featured image"
                    value={featured}
                    onChange={setFeatured}
                    folder="featured"
                    returnAs="path"
                    placeholder="content-media/… or upload"
                    cropAspect="3:2"
                    helpText="Stored as a storage path. Upload or paste a path, then use Crop to frame and resize it."
                  />
                  <MediaPicker value={featured} onChange={setFeatured} />
                </fieldset>
              </>
            )}
          </div>
        </div>
      </main>
    </AdminWorkspaceShell>
  );
}
