import { useState } from "react";
import {
  ArrowLeft,
  BriefcaseBusiness,
  Cake,
  CalendarClock,
  ClipboardList,
  FileText,
  Heart,
  Home,
  Mail,
  MapPin,
  Phone,
  UserRound,
  Download,
  Pencil,
  Save,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

import { AdminAssessmentCapture } from "@/components/admin/AdminAssessmentCapture";
import { AdminWorkspaceShell } from "@/components/progress/AdminSidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  exportAdminClientData,
  updateAdminClient,
  type AdminClientDetail as AdminClientDetailRecord,
  type ClientSessionMode,
} from "@/lib/clients.functions";
import type { FormTemplateDefinition } from "@/lib/form-templates";

const modeLabels: Record<ClientSessionMode, string> = {
  online: "Online",
  in_person: "In person",
  phone: "Phone",
};

function formatDate(value: string | null) {
  if (!value) return "Not provided";
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Lagos",
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(new Date(value));
}

function ClientModeBadge({ mode }: { mode: ClientSessionMode | null }) {
  return (
    <Badge
      variant="outline"
      className={
        mode
          ? "border-brand-blue/20 bg-brand-blue-soft text-brand-blue"
          : "border-border bg-muted text-muted-foreground"
      }
    >
      {mode ? modeLabels[mode] : "Mode not set"}
    </Badge>
  );
}

function DetailItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Phone;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {label}
      </div>
      <p className="mt-2 text-sm font-medium text-brand-deep">{value}</p>
    </div>
  );
}

export function AdminClientDetail({
  client,
  assessmentTemplates,
}: {
  client: AdminClientDetailRecord;
  assessmentTemplates: FormTemplateDefinition[];
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    surname: client.surname ?? "",
    otherNames: client.otherNames ?? "",
    fullName: client.fullName ?? "",
    email: client.email ?? "",
    phone: client.phone ?? "",
    address: client.address ?? "",
    dateOfBirth: client.dateOfBirth ?? "",
    weddingAnniversaryDate: client.weddingAnniversaryDate ?? "",
    occupation: client.occupation ?? "",
    preferredMode: client.preferredMode ?? "",
  });

  const saveProfile = async () => {
    // client-side validation
    if (!form.fullName || !form.email || !form.phone) {
      toast.error("Full name, email and phone are required.");
      return;
    }

    setSaving(true);
    try {
      await updateAdminClient({
        data: {
          clientId: client.id,
          surname: form.surname || null,
          otherNames: form.otherNames || null,
          fullName: form.fullName,
          email: form.email,
          phone: form.phone,
          address: form.address || null,
          dateOfBirth: form.dateOfBirth || null,
          weddingAnniversaryDate: form.weddingAnniversaryDate || null,
          occupation: form.occupation || null,
          preferredMode: (form.preferredMode || null) as ClientSessionMode | null,
          assignedTherapistId: client.assignedTherapistId,
        },
      });
      toast.success("Client profile updated.");
      setEditing(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't update client.");
    } finally {
      setSaving(false);
    }
  };

  const exportData = async () => {
    try {
      const result = await exportAdminClientData({ data: { clientId: client.id } });
      const url = URL.createObjectURL(new Blob([result.csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't export client data.");
    }
  };

  return (
    <AdminWorkspaceShell>
      <main id="main" className="min-h-screen bg-surface-page py-8 sm:py-10">
        <div className="mx-auto w-full max-w-6xl space-y-8 px-4 sm:px-6 lg:px-8">
          <header>
            <Button
              asChild
              variant="ghost"
              className="-ml-3 text-brand-blue-deep hover:text-brand-deep"
            >
              <Link to="/admin/clients">
                <ArrowLeft aria-hidden />
                Back to clients
              </Link>
            </Button>
            <div className="mt-4 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Admin workspace</span>
                  <span aria-hidden>/</span>
                  <Link to="/admin/clients" className="hover:text-brand-blue-deep">
                    Clients
                  </Link>
                  <span aria-hidden>/</span>
                  <span className="font-medium text-brand-deep">Details</span>
                </div>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-brand-deep sm:text-4xl">
                  {client.fullName || "Unnamed client"}
                </h1>
                <p className="mt-2 text-muted-foreground">
                  Client profile and staff-only care notes.
                </p>
              </div>
              <ClientModeBadge mode={client.preferredMode} />
            </div>
          </header>

          <section className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
            <Card className="border-border/80 shadow-[0_8px_30px_rgba(22,50,79,0.04)]">
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <CardTitle className="flex items-center gap-3 text-xl text-brand-deep">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-mint-soft text-brand-deep">
                    <UserRound className="h-5 w-5" aria-hidden />
                  </span>
                  Profile information
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => void exportData()}>
                    <Download aria-hidden /> Export
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setEditing((value) => !value)}>
                    <Pencil aria-hidden /> {editing ? "Cancel" : "Edit"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {editing ? (
                  <>
                    <label className="space-y-2 text-sm font-medium text-brand-deep">
                      Surname
                      <Input
                        value={form.surname}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, surname: event.target.value }))
                        }
                      />
                    </label>
                    <label className="space-y-2 text-sm font-medium text-brand-deep">
                      Other names
                      <Input
                        value={form.otherNames}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, otherNames: event.target.value }))
                        }
                      />
                    </label>
                    <label className="space-y-2 text-sm font-medium text-brand-deep">
                      Full name *
                      <Input
                        value={form.fullName}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, fullName: event.target.value }))
                        }
                      />
                    </label>
                    <label className="space-y-2 text-sm font-medium text-brand-deep">
                      Email *
                      <Input
                        type="email"
                        value={form.email}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, email: event.target.value }))
                        }
                      />
                    </label>
                    <label className="space-y-2 text-sm font-medium text-brand-deep">
                      Phone *
                      <Input
                        value={form.phone}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, phone: event.target.value }))
                        }
                      />
                    </label>
                    <label className="space-y-2 text-sm font-medium text-brand-deep sm:col-span-2">
                      Address
                      <textarea
                        value={form.address}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, address: event.target.value }))
                        }
                        rows={3}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </label>
                    <label className="space-y-2 text-sm font-medium text-brand-deep">
                      Date of birth
                      <DateInput
                        value={form.dateOfBirth}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, dateOfBirth: event.target.value }))
                        }
                      />
                    </label>
                    <label className="space-y-2 text-sm font-medium text-brand-deep">
                      Wedding anniversary date
                      <DateInput
                        value={form.weddingAnniversaryDate}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            weddingAnniversaryDate: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="space-y-2 text-sm font-medium text-brand-deep">
                      Occupation
                      <Input
                        value={form.occupation}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, occupation: event.target.value }))
                        }
                      />
                    </label>
                    <label className="space-y-2 text-sm font-medium text-brand-deep">
                      Preferred mode
                      <select
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={form.preferredMode}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, preferredMode: event.target.value }))
                        }
                      >
                        <option value="">Not set</option>
                        <option value="online">Online</option>
                        <option value="in_person">In person</option>
                        <option value="phone">Phone</option>
                      </select>
                    </label>
                    <div className="sm:col-span-2">
                      <Button onClick={() => void saveProfile()} disabled={saving}>
                        <Save aria-hidden /> {saving ? "Saving…" : "Save profile"}
                      </Button>
                    </div>
                  </>
                ) : null}
                {!editing ? (
                  <DetailItem icon={Phone} label="Phone" value={client.phone || "Not provided"} />
                ) : null}
                {!editing ? (
                  <DetailItem icon={Mail} label="Email" value={client.email || "Not provided"} />
                ) : null}
                {!editing ? (
                  <DetailItem
                    icon={UserRound}
                    label="Surname"
                    value={client.surname || "Not provided"}
                  />
                ) : null}
                {!editing ? (
                  <DetailItem
                    icon={UserRound}
                    label="Other names"
                    value={client.otherNames || "Not provided"}
                  />
                ) : null}
                {!editing ? (
                  <DetailItem
                    icon={Cake}
                    label="Date of birth"
                    value={formatDate(client.dateOfBirth)}
                  />
                ) : null}
                {!editing ? (
                  <DetailItem
                    icon={Heart}
                    label="Wedding anniversary"
                    value={formatDate(client.weddingAnniversaryDate)}
                  />
                ) : null}
                {!editing ? (
                  <DetailItem
                    icon={BriefcaseBusiness}
                    label="Occupation"
                    value={client.occupation || "Not provided"}
                  />
                ) : null}
                {!editing ? (
                  <DetailItem
                    icon={Home}
                    label="Address"
                    value={client.address || "Not provided"}
                  />
                ) : null}
                <DetailItem
                  icon={MapPin}
                  label="Assigned therapist"
                  value={client.assignedTherapistName || "Unassigned"}
                />
                <DetailItem
                  icon={CalendarClock}
                  label="Client since"
                  value={formatDate(client.createdAt)}
                />
              </CardContent>
            </Card>

            <Card className="border-border/80 shadow-[0_8px_30px_rgba(22,50,79,0.04)]">
              <CardHeader>
                <CardTitle className="text-xl text-brand-deep">Record activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Last profile update</p>
                  <p className="mt-1 font-medium text-brand-deep">
                    {formatDateTime(client.updatedAt)}
                  </p>
                </div>
                <div className="border-t border-border/70 pt-4">
                  <p className="text-muted-foreground">Client record ID</p>
                  <p className="mt-1 break-all font-mono text-xs text-brand-deep">{client.id}</p>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <Card className="border-border/80 shadow-[0_8px_30px_rgba(22,50,79,0.04)]">
              <CardHeader>
                <CardTitle className="text-xl text-brand-deep">Appointment history</CardTitle>
                <p className="text-sm text-muted-foreground">
                  All appointments linked to this client.
                </p>
              </CardHeader>
              <CardContent>
                {client.appointments.length ? (
                  <div className="space-y-3">
                    {client.appointments.map((appointment) => (
                      <div
                        key={appointment.id}
                        className="rounded-xl border border-border/70 bg-muted/20 p-3 text-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-brand-deep">
                              {appointment.serviceName || "Service"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {appointment.bookingReference} ·{" "}
                              {appointment.therapistName || "Unassigned"}
                            </p>
                          </div>
                          <Badge variant="outline">{appointment.status}</Badge>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {formatDateTime(appointment.startsAt)} · {appointment.sessionMode}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No appointment history yet.</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/80 shadow-[0_8px_30px_rgba(22,50,79,0.04)]">
              <CardHeader>
                <CardTitle className="text-xl text-brand-deep">Payment summary</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Payment records linked to this client’s appointments.
                </p>
              </CardHeader>
              <CardContent>
                {client.payments.length ? (
                  <div className="space-y-3">
                    {client.payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="rounded-xl border border-border/70 bg-muted/20 p-3 text-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-brand-deep">
                              {payment.provider} · {payment.currency}{" "}
                              {(payment.amountKobo / 100).toLocaleString("en-NG")}
                            </p>
                            <p className="font-mono text-xs text-muted-foreground">
                              {payment.reference}
                            </p>
                          </div>
                          <Badge variant="outline">{payment.status}</Badge>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {payment.bookingReference || "No booking reference"} ·{" "}
                          {formatDateTime(payment.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No payment records yet.</p>
                )}
              </CardContent>
            </Card>
          </section>

          <Card className="border-border/80 shadow-[0_8px_30px_rgba(22,50,79,0.04)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-xl text-brand-deep">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-mint-soft text-brand-deep">
                  <FileText className="h-5 w-5" aria-hidden />
                </span>
                Form summary
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Contact and intake-style submissions linked to this client record.
              </p>
            </CardHeader>
            <CardContent>
              {client.contactSubmissions.length ? (
                <div className="space-y-3">
                  {client.contactSubmissions.map((submission) => (
                    <article
                      key={submission.id}
                      className="rounded-xl border border-border/70 bg-muted/20 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-brand-deep">
                            {submission.source.replace(/_/g, " ")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {submission.fullName}
                            {submission.phone ? ` · ${submission.phone}` : ""}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">
                            {submission.adminNotifiedAt ? "Inbox notified" : "Awaiting review"}
                          </Badge>
                          <Badge variant="outline">
                            {submission.ackSentAt ? "Client acknowledged" : "Ack pending"}
                          </Badge>
                        </div>
                      </div>
                      <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-brand-deep">
                        {submission.message}
                      </p>
                      <p className="mt-3 text-xs text-muted-foreground">
                        {submission.email} · {formatDateTime(submission.createdAt)}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border p-8 text-center">
                  <FileText className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
                  <h3 className="mt-3 font-semibold text-brand-deep">No contact submissions yet</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Contact submissions will appear here when they match this client.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-[0_8px_30px_rgba(22,50,79,0.04)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-xl text-brand-deep">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-blue-soft text-brand-blue">
                  <FileText className="h-5 w-5" aria-hidden />
                </span>
                Secure intake snapshots
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Booking, contact, and assessment snapshots captured from the public and internal
                forms.
              </p>
            </CardHeader>
            <CardContent>
              {client.intakeSubmissions.length ? (
                <div className="space-y-3">
                  {client.intakeSubmissions.map((submission) => {
                    const consent = submission.payload.consent as
                      | {
                          version?: string;
                          text?: string;
                          route?: string;
                          acknowledgedAt?: string;
                        }
                      | undefined;
                    const consentVersion = consent?.version ? `v${consent.version}` : "";

                    return (
                      <article
                        key={submission.id}
                        className="rounded-xl border border-border/70 bg-muted/20 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-brand-deep">
                              {submission.templateKey.replace(/_/g, " ")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {submission.source} · {submission.subjectName || "Unnamed"}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">v{submission.templateVersion}</Badge>
                            <Badge variant="outline">
                              {submission.completionState === "completed"
                                ? "Completed"
                                : submission.completionState === "in_progress"
                                  ? "In progress"
                                  : "Draft"}
                            </Badge>
                            <Badge variant="outline">
                              {submission.consentAcknowledgedAt
                                ? "Consent recorded"
                                : "Consent missing"}
                            </Badge>
                          </div>
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">
                          {submission.subjectEmail || "No email"} ·{" "}
                          {formatDateTime(submission.createdAt)}
                          {submission.consentAcknowledgedAt
                            ? ` · consent ${formatDateTime(submission.consentAcknowledgedAt)}`
                            : ""}
                        </p>
                        {submission.consentAcknowledgedAt ? (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Consent audit trail {consentVersion} captured with the submission.
                          </p>
                        ) : null}
                        <details className="mt-3 rounded-lg border border-border/60 bg-background p-3">
                          <summary className="cursor-pointer text-xs font-medium text-brand-deep">
                            View snapshot payload
                          </summary>
                          <pre className="mt-3 overflow-x-auto text-xs leading-6 text-muted-foreground">
                            {JSON.stringify(submission.payload, null, 2)}
                          </pre>
                        </details>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border p-8 text-center">
                  <FileText className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
                  <h3 className="mt-3 font-semibold text-brand-deep">No secure intake snapshots</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Booking and contact snapshots will appear here when they match this client.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <AdminAssessmentCapture
            clientId={client.id}
            clientName={client.fullName || "Unnamed client"}
            assessmentTemplates={assessmentTemplates}
          />

          <Card className="border-border/80 shadow-[0_8px_30px_rgba(22,50,79,0.04)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-xl text-brand-deep">
                <ClipboardList className="h-5 w-5 text-brand-blue" aria-hidden />
                Staff notes
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Notes are restricted to authorised staff and are displayed newest first.
              </p>
            </CardHeader>
            <CardContent>
              {client.notes.length ? (
                <div className="space-y-4">
                  {client.notes.map((note) => (
                    <article
                      key={note.id}
                      className="rounded-xl border border-border/70 bg-muted/20 p-4"
                    >
                      <p className="whitespace-pre-wrap text-sm leading-6 text-brand-deep">
                        {note.body}
                      </p>
                      <p className="mt-3 text-xs text-muted-foreground">
                        Added {formatDateTime(note.createdAt)}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border p-8 text-center">
                  <ClipboardList className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
                  <h3 className="mt-3 font-semibold text-brand-deep">No staff notes yet</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Notes will appear here when authorised staff add them.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </AdminWorkspaceShell>
  );
}

export function AdminClientDetailSkeleton() {
  return (
    <AdminWorkspaceShell>
      <main id="main" className="min-h-screen bg-surface-page py-8 sm:py-10">
        <div className="mx-auto w-full max-w-6xl space-y-8 px-4 sm:px-6 lg:px-8">
          <div className="space-y-4">
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-4 w-72 max-w-full" />
            <Skeleton className="h-10 w-80 max-w-full" />
            <Skeleton className="h-5 w-96 max-w-full" />
          </div>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </main>
    </AdminWorkspaceShell>
  );
}
