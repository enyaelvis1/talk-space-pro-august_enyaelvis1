import { useMemo, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Bot, Search, ShieldCheck, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { AdminWorkspaceShell } from "@/components/progress/AdminSidebar";
import {
  getAdminAuditWorkspace,
  type AdminAuditLogRow,
  type SecurityEventRow,
} from "@/lib/admin.functions";
import { canonicalUrl } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  loader: async () => {
    try {
      const workspace = await getAdminAuditWorkspace();
      return workspace;
    } catch {
      throw redirect({ href: "/account?error=forbidden" });
    }
  },
  head: () => ({
    meta: [
      { title: "Audit log | Talk Space Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: canonicalUrl("/admin/audit") }],
  }),
  component: AuditLogRoute,
});

const dateTime = new Intl.DateTimeFormat("en-NG", {
  timeZone: "Africa/Lagos",
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDate(value: string) {
  try {
    return dateTime.format(new Date(value));
  } catch {
    return value;
  }
}

function actionLabel(action: string) {
  const explicitLabels: Record<string, string> = {
    "appointments.archive": "archive appointment",
    "appointments.restore": "restore appointment",
    "appointments.cancel_release": "cancel and release appointment",
    "payments.verify": "verify payment",
    "payments.resolve": "resolve payment",
    "payments.refund": "refund payment",
  };
  if (explicitLabels[action]) return explicitLabels[action];
  const [target, operation] = action.split(".");
  return `${(operation || "changed").replaceAll("_", " ")} ${target.replaceAll("_", " ")}`;
}

function AuditLogRoute() {
  const { logs: rows, securityEvents } = Route.useLoaderData() as {
    logs: AdminAuditLogRow[];
    securityEvents: SecurityEventRow[];
  };
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState("all");

  const targetOptions = useMemo(
    () => [...new Set(rows.map((row) => row.targetType))].sort(),
    [rows],
  );
  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (target !== "all" && row.targetType !== target) return false;
      if (!normalizedQuery) return true;
      return [row.actorEmail, row.action, row.targetType, row.targetId, row.reason]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery));
    });
  }, [query, rows, target]);

  const adminActions = rows.filter((row) => row.actorKind === "admin").length;
  const systemActions = rows.filter((row) => row.actorKind === "system").length;

  return (
    <AdminWorkspaceShell>
      <main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        <header>
          <p className="eyebrow">Admin · Governance</p>
          <h1 className="display-1 mt-3 text-brand-deep">Audit log</h1>
          <p className="mt-3 max-w-3xl text-muted-foreground">
            Review who changed operational or public-site records, what changed, why the action was
            recorded, and when it happened. Audit entries are immutable and never contain secret or
            client payload values.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-3" aria-label="Audit log summary">
          <AuditStat label="Recent events" value={rows.length} icon={ShieldCheck} />
          <AuditStat label="Admin actions" value={adminActions} icon={UserRound} />
          <AuditStat label="System actions" value={systemActions} icon={Bot} />
        </section>

        <section className="rounded-2xl border border-border/70 bg-card shadow-sm">
          <div className="grid gap-4 border-b border-border/60 p-5 sm:grid-cols-[minmax(0,1fr)_240px]">
            <label className="relative block">
              <span className="sr-only">Search audit events</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search actor, action, target, or reason"
                className="h-11 w-full rounded-lg border border-input bg-background pl-10 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-mint"
              />
            </label>
            <label className="block text-sm">
              <span className="sr-only">Filter by record type</span>
              <select
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                className="h-11 w-full rounded-lg border border-input bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-brand-mint"
              >
                <option value="all">All record types</option>
                {targetOptions.map((option) => (
                  <option key={option} value={option}>
                    {option.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {filteredRows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3">When</th>
                    <th className="px-5 py-3">Actor</th>
                    <th className="px-5 py-3">Action</th>
                    <th className="px-5 py-3">Target</th>
                    <th className="px-5 py-3">Reason</th>
                    <th className="px-5 py-3">Changed fields</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredRows.map((row) => (
                    <AuditRow key={row.id} row={row} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-5 py-16 text-center text-sm text-muted-foreground">
              No audit events match the current filters.
            </div>
          )}
        </section>

        <SecurityEventsSection events={securityEvents} />
      </main>
    </AdminWorkspaceShell>
  );
}

function SecurityEventsSection({ events }: { events: SecurityEventRow[] }) {
  return (
    <section
      className="rounded-2xl border border-border/70 bg-card shadow-sm"
      aria-label="Security events"
    >
      <header className="border-b border-border/60 p-5">
        <h2 className="text-lg font-semibold text-brand-deep">Security events</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Blocked or suspicious public requests, such as rate-limited form and booking attempts.
          Devices are recorded as one-way hashes, never as raw IP addresses.
        </p>
      </header>
      {events.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3">When</th>
                <th className="px-5 py-3">Event</th>
                <th className="px-5 py-3">Severity</th>
                <th className="px-5 py-3">Where</th>
                <th className="px-5 py-3">Device hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {events.map((event) => (
                <tr key={event.id} className="align-top">
                  <td className="whitespace-nowrap px-5 py-4 text-xs text-muted-foreground">
                    <time dateTime={event.createdAt}>{formatDate(event.createdAt)}</time>
                  </td>
                  <td className="px-5 py-4 font-medium capitalize text-brand-deep">
                    {event.eventType.replaceAll("_", " ")}
                  </td>
                  <td className="px-5 py-4 capitalize text-muted-foreground">{event.severity}</td>
                  <td className="px-5 py-4 text-muted-foreground">{event.route ?? "—"}</td>
                  <td className="px-5 py-4 font-mono text-xs text-muted-foreground">
                    {event.identifier ? `${event.identifier.slice(0, 12)}…` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-5 py-12 text-center text-sm text-muted-foreground">
          No security events recorded yet.
        </p>
      )}
    </section>
  );
}

function AuditStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-brand-deep">{value}</p>
      </div>
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-mint-soft text-brand-deep">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
    </div>
  );
}

function AuditRow({ row }: { row: AdminAuditLogRow }) {
  const ActorIcon = row.actorKind === "system" ? Bot : UserRound;
  return (
    <tr className="align-top">
      <td className="whitespace-nowrap px-5 py-4 text-xs text-muted-foreground">
        <time dateTime={row.createdAt}>{formatDate(row.createdAt)}</time>
      </td>
      <td className="px-5 py-4">
        <div className="flex items-start gap-2">
          <ActorIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <div>
            <p className="font-medium text-brand-deep">
              {row.actorEmail ?? (row.actorKind === "system" ? "System process" : "Unknown user")}
            </p>
            <p className="text-xs capitalize text-muted-foreground">{row.actorKind}</p>
          </div>
        </div>
      </td>
      <td className="px-5 py-4 font-medium capitalize text-brand-deep">
        {actionLabel(row.action)}
      </td>
      <td className="px-5 py-4">
        <p>{row.targetType.replaceAll("_", " ")}</p>
        {row.targetId ? (
          <p
            className="mt-1 max-w-48 truncate font-mono text-xs text-muted-foreground"
            title={row.targetId}
          >
            {row.targetId}
          </p>
        ) : null}
      </td>
      <td className="max-w-80 px-5 py-4 text-muted-foreground">{row.reason}</td>
      <td className="px-5 py-4">
        {row.changedFields.length ? (
          <div className="flex max-w-72 flex-wrap gap-1.5">
            {row.changedFields.slice(0, 8).map((field) => (
              <span key={field} className="rounded-full bg-muted px-2 py-1 text-xs text-brand-deep">
                {field.replaceAll("_", " ")}
              </span>
            ))}
            {row.changedFields.length > 8 ? (
              <span className="px-1 py-1 text-xs text-muted-foreground">
                +{row.changedFields.length - 8}
              </span>
            ) : null}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Record removed</span>
        )}
      </td>
    </tr>
  );
}
