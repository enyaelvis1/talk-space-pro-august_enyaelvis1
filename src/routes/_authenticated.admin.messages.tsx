import { useEffect, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Loader2, Mail, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AdminPageSkeleton } from "@/components/admin/AdminSkeletons";
import { AdminWorkspaceShell } from "@/components/progress/AdminSidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { hasBrowserRole } from "@/lib/auth";
import { canonicalUrl } from "@/lib/seo";
import {
  deleteContactSubmission,
  listContactSubmissions,
  type ContactSubmissionRow,
} from "@/lib/email.functions";

export const Route = createFileRoute("/_authenticated/admin/messages")({
  loader: async () => {
    try {
      return { submissions: await listContactSubmissions() };
    } catch {
      throw redirect({ href: "/account?error=forbidden" });
    }
  },
  head: () => ({
    meta: [
      { title: "Messages | Talk Space Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: canonicalUrl("/admin/messages") }],
  }),
  component: AdminMessagesRoute,
});

function AdminMessagesRoute() {
  const loaderData = Route.useLoaderData();
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    void hasBrowserRole("admin").then((ok) => {
      if (active) setAuthorized(ok);
    });
    return () => {
      active = false;
    };
  }, []);

  if (authorized === null) {
    return (
      <AdminWorkspaceShell>
        <AdminPageSkeleton columns={4} rows={8} />
      </AdminWorkspaceShell>
    );
  }

  if (!authorized) {
    return (
      <AdminWorkspaceShell>
        <main className="mx-auto max-w-2xl px-4 py-24 text-center">
          <h1 className="display-1 text-brand-deep">Permission required</h1>
          <p className="mt-4 text-muted-foreground">
            You do not have permission to view contact messages.
          </p>
        </main>
      </AdminWorkspaceShell>
    );
  }

  return <MessagesScreen initialSubmissions={loaderData.submissions} />;
}

function MessagesScreen({ initialSubmissions }: { initialSubmissions: ContactSubmissionRow[] }) {
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = async () => {
    setRefreshing(true);
    try {
      setSubmissions(await listContactSubmissions());
      toast.success("Messages refreshed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not refresh messages.");
    } finally {
      setRefreshing(false);
    }
  };

  const remove = async (submission: ContactSubmissionRow) => {
    if (!confirm(`Delete the message from ${submission.fullName}? This cannot be undone.`)) return;
    setDeletingId(submission.id);
    try {
      await deleteContactSubmission({ data: { id: submission.id } });
      setSubmissions((current) => current.filter((item) => item.id !== submission.id));
      toast.success("Message deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AdminWorkspaceShell>
      <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Admin · Messages</p>
            <h1 className="display-1 mt-3 text-brand-deep">Contact messages</h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Read and manage messages submitted through the public contact form.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={refreshing}>
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden />
            )}
            Refresh
          </Button>
        </header>

        <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center gap-3">
            <span className="rounded-xl bg-brand-blue-soft p-3 text-brand-blue">
              <Mail className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-brand-deep">Inbox</h2>
              <p className="text-sm text-muted-foreground">
                Showing the latest {submissions.length} contact form message
                {submissions.length === 1 ? "" : "s"}.
              </p>
            </div>
          </div>

          {submissions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 p-10 text-center text-sm text-muted-foreground">
              No contact messages yet.
            </div>
          ) : (
            <div className="space-y-3">
              {submissions.map((submission) => (
                <article
                  key={submission.id}
                  className="rounded-xl border border-border/70 bg-surface-page p-4 sm:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-brand-deep">{submission.fullName}</h3>
                      <p className="text-sm text-muted-foreground">
                        <a className="underline" href={`mailto:${submission.email}`}>
                          {submission.email}
                        </a>
                        {submission.phone ? ` · ${submission.phone}` : ""}
                      </p>
                    </div>
                    <time className="text-xs text-muted-foreground">
                      {new Date(submission.createdAt).toLocaleString()}
                    </time>
                  </div>
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-foreground">
                    {submission.message}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="outline">
                        Source: {submission.source.replaceAll("_", " ")}
                      </Badge>
                      <Badge variant="outline">
                        Client acknowledgement: {submission.ackSentAt ? "sent" : "not sent"}
                      </Badge>
                      <Badge variant="outline">
                        Admin notice: {submission.adminNotifiedAt ? "sent" : "not sent"}
                      </Badge>
                      {submission.deliveryError ? (
                        <Badge variant="destructive">Delivery issue</Badge>
                      ) : null}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      disabled={deletingId === submission.id}
                      onClick={() => void remove(submission)}
                    >
                      {deletingId === submission.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <Trash2 className="h-4 w-4" aria-hidden />
                      )}
                      Delete
                    </Button>
                  </div>
                  {submission.deliveryError ? (
                    <p className="mt-3 text-xs text-danger">{submission.deliveryError}</p>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </AdminWorkspaceShell>
  );
}
