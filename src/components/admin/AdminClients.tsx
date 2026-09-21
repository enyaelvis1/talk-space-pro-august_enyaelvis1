import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import {
  BriefcaseBusiness,
  Cake,
  Download,
  Heart,
  Home,
  Loader2,
  Mail,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  UserRound,
  UsersRound,
} from "lucide-react";
import { Link, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";

import { AdminWorkspaceShell } from "@/components/progress/AdminSidebar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  createAdminLegacyClient,
  deleteAdminClient,
  createAdminExportAllClients,
  getAdminClientsPage,
  importAdminClients,
  type AdminClientRecord,
  type ClientSessionMode,
} from "@/lib/clients.functions";
import { clientProfilesCsvTemplate } from "@/lib/client-csv";

type ClientModeFilter = "all" | ClientSessionMode;

const modeLabels: Record<ClientSessionMode, string> = {
  online: "Online",
  in_person: "In person",
  phone: "Phone",
};

function formatMode(mode: ClientSessionMode | null) {
  return mode ? modeLabels[mode] : "Not set";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Lagos",
  }).format(new Date(value));
}

function clientDetailsHref(clientId: string) {
  return `/admin/clients/${encodeURIComponent(clientId)}`;
}

const adminClientsRoute = { to: "/admin/clients" } as const;

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
      {formatMode(mode)}
    </Badge>
  );
}

function ClientRow({
  client,
  onDelete,
  deleting,
}: {
  client: AdminClientRecord;
  onDelete: (client: AdminClientRecord) => void;
  deleting: boolean;
}) {
  return (
    <tr className="border-b border-border/70 last:border-0">
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-mint-soft text-brand-deep">
            <UserRound className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <Link
              to={clientDetailsHref(client.id)}
              className="truncate font-medium text-brand-deep hover:text-brand-blue-deep"
            >
              {client.fullName || "Unnamed client"}
            </Link>
            <p className="text-xs text-muted-foreground">Joined {formatDate(client.createdAt)}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-4 text-sm text-muted-foreground">
        <div>{client.email || "No email added"}</div>
        <div className="mt-1 text-xs">{client.phone || "No phone added"}</div>
      </td>
      <td className="px-4 py-4">
        <ClientModeBadge mode={client.preferredMode} />
      </td>
      <td className="px-4 py-4 text-sm text-muted-foreground">
        {client.occupation || client.assignedTherapistName || "Unassigned"}
      </td>
      <td className="px-4 py-4 text-right">
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive"
          disabled={deleting}
          onClick={() => onDelete(client)}
        >
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}{" "}
          Delete
        </Button>
      </td>
    </tr>
  );
}

function ClientCard({
  client,
  onDelete,
  deleting,
}: {
  client: AdminClientRecord;
  onDelete: (client: AdminClientRecord) => void;
  deleting: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <Link
        to={clientDetailsHref(client.id)}
        aria-label={`View details for ${client.fullName || "unnamed client"}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-mint-soft text-brand-deep">
              <UserRound className="h-4 w-4" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium text-brand-deep">
                {client.fullName || "Unnamed client"}
              </p>
              <p className="text-xs text-muted-foreground">Joined {formatDate(client.createdAt)}</p>
            </div>
          </div>
          <ClientModeBadge mode={client.preferredMode} />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border/70 pt-4 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Email</dt>
            <dd className="mt-1 truncate text-brand-deep">{client.email || "Not added"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Phone</dt>
            <dd className="mt-1 truncate text-brand-deep">{client.phone || "Not added"}</dd>
          </div>
        </dl>
      </Link>
      <div className="mt-3 border-t border-border/70 pt-3 text-right">
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive"
          disabled={deleting}
          onClick={() => onDelete(client)}
        >
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}{" "}
          Delete
        </Button>
      </div>
    </div>
  );
}

export function AdminClients({ clients }: { clients: AdminClientRecord[] }) {
  const router = useRouter();
  const [loadedClients, setLoadedClients] = useState(clients);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextPage, setNextPage] = useState(2);
  const [hasMore, setHasMore] = useState(clients.length >= 100);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<ClientModeFilter>("all");
  const [therapist, setTherapist] = useState("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [legacyForm, setLegacyForm] = useState({
    surname: "",
    otherNames: "",
    email: "",
    phone: "",
    address: "",
    birthday: "",
    weddingAnniversaryDate: "",
    occupation: "",
  });

  // Export / Import helpers
  const [importing, setImporting] = useState(false);
  const [importCsv, setImportCsv] = useState("");
  const [duplicatePolicy, setDuplicatePolicy] = useState<"skip" | "update">("skip");
  const [importResult, setImportResult] = useState<Awaited<
    ReturnType<typeof importAdminClients>
  > | null>(null);

  async function exportClients() {
    try {
      const result = await createAdminExportAllClients();
      if (!result) throw new Error("No data returned.");
      const blob = new Blob([result.csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Clients exported.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed.");
    }
  }

  function downloadTemplate() {
    const blob = new Blob([clientProfilesCsvTemplate()], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "talk-space-client-import-template.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Client import template downloaded.");
  }

  async function handleImportCsv(csv: string, confirm = false, duplicates = duplicatePolicy) {
    setImporting(true);
    try {
      const res = await importAdminClients({ data: { csv, confirm, duplicates } });
      if (!res) throw new Error("No import result returned.");
      if (!confirm) {
        setImportResult(res);
        return;
      }
      if (res.errors.length) {
        setImportResult(res);
        return;
      }
      toast.success(
        `Import complete — created: ${res.created}, updated: ${res.updated}, skipped: ${res.skipped}`,
      );
      setImportCsv("");
      setImportResult(null);
      await router.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";
    if (file.size > 2 * 1024 * 1024) {
      toast.error("CSV must be 2 MB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setImportCsv(text);
      setImportResult(null);
      void handleImportCsv(text);
    };
    reader.onerror = () => toast.error("Could not read the CSV file.");
    reader.readAsText(file);
  }

  const updateLegacyForm =
    (key: keyof typeof legacyForm) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setLegacyForm((current) => ({ ...current, [key]: event.target.value }));
    };

  async function createLegacyClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    try {
      await createAdminLegacyClient({
        data: {
          surname: legacyForm.surname,
          otherNames: legacyForm.otherNames,
          email: legacyForm.email,
          phone: legacyForm.phone,
          address: legacyForm.address || null,
          birthday: legacyForm.birthday || null,
          weddingAnniversaryDate: legacyForm.weddingAnniversaryDate || null,
          occupation: legacyForm.occupation || null,
        },
      });
      toast.success("Old client added.");
      await router.invalidate();
      // Keep admin on the clients list without a full reload (prevents accidental auth redirect).
      setLegacyForm({
        surname: "",
        otherNames: "",
        email: "",
        phone: "",
        address: "",
        birthday: "",
        weddingAnniversaryDate: "",
        occupation: "",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add client.");
    } finally {
      setCreating(false);
    }
  }

  async function remove(client: AdminClientRecord) {
    if (!confirm(`Delete ${client.fullName || "this client"}? This cannot be undone.`)) return;
    setDeletingId(client.id);
    try {
      await deleteAdminClient({ data: { clientId: client.id } });
      toast.success("Client deleted.");
      await router.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeletingId(null);
    }
  }

  const therapistOptions = useMemo(
    () =>
      Array.from(
        new Map(
          clients
            .filter((client) => client.assignedTherapistId && client.assignedTherapistName)
            .map((client) => [client.assignedTherapistId, client.assignedTherapistName]),
        ),
      ).map(([id, name]) => ({ id: id as string, name: name as string })),
    [clients],
  );

  const filteredClients = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return loadedClients.filter((client) => {
      const matchesQuery = normalizedQuery
        ? [
            client.fullName,
            client.email,
            client.phone,
            client.occupation,
            client.assignedTherapistName,
          ]
            .filter(Boolean)
            .some((value) => value!.toLowerCase().includes(normalizedQuery))
        : true;
      const matchesMode = mode === "all" || client.preferredMode === mode;
      const matchesTherapist = therapist === "all" || client.assignedTherapistId === therapist;
      return matchesQuery && matchesMode && matchesTherapist;
    });
  }, [loadedClients, mode, query, therapist]);

  async function loadMoreClients() {
    setLoadingMore(true);
    try {
      const page = await getAdminClientsPage({ data: { page: nextPage } });
      if (!page) throw new Error("Could not load more clients.");
      setLoadedClients((current) => [...current, ...page.clients]);
      setHasMore(page.hasMore);
      setNextPage((current) => current + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load more clients.");
    } finally {
      setLoadingMore(false);
    }
  }

  const hasFilters = Boolean(query || mode !== "all" || therapist !== "all");

  function resetFilters() {
    setQuery("");
    setMode("all");
    setTherapist("all");
  }

  return (
    <AdminWorkspaceShell>
      <Dialog
        open={Boolean(importCsv)}
        onOpenChange={(open) => {
          if (!open && !importing) setImportCsv("");
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review client import</DialogTitle>
            <DialogDescription>
              {importResult ? `${importResult.total} profiles` : "Validating file..."}
            </DialogDescription>
          </DialogHeader>
          <label className="space-y-2 text-sm">
            Existing email addresses
            <Select
              value={duplicatePolicy}
              disabled={importing}
              onValueChange={(value: "skip" | "update") => {
                setDuplicatePolicy(value);
                void handleImportCsv(importCsv, false, value);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="skip">Keep existing records</SelectItem>
                <SelectItem value="update">Update from file</SelectItem>
              </SelectContent>
            </Select>
          </label>
          {importResult ? (
            <>
              <p className="text-sm">
                New: {importResult.created} · Updates: {importResult.updated} · Skipped:{" "}
                {importResult.skipped}
              </p>
              {importResult.errors.length ? (
                <ul role="alert" className="space-y-1 text-sm text-destructive">
                  {importResult.errors.map((error) => (
                    <li key={error.row}>
                      Row {error.row}: {error.message}
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      <th className="p-2">Name</th>
                      <th className="p-2">Email</th>
                      <th className="p-2">Phone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importResult.sample.map((profile) => (
                      <tr key={profile.email} className="border-t">
                        <td className="p-2">{profile.full_name}</td>
                        <td className="break-all p-2">{profile.email}</td>
                        <td className="p-2">{profile.phone}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
          <DialogFooter>
            <Button variant="outline" disabled={importing} onClick={() => setImportCsv("")}>
              Cancel
            </Button>
            <Button
              disabled={importing || !importResult || importResult.errors.length > 0}
              onClick={() => void handleImportCsv(importCsv, true)}
            >
              {importing ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Plus className="h-4 w-4" aria-hidden />
              )}
              Import profiles
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <main id="main" className="min-h-screen bg-surface-page py-8 sm:py-10">
        <div className="mx-auto w-full max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">
          <header>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link to="/admin" className="transition-colors hover:text-brand-deep">
                Admin workspace
              </Link>
              <span aria-hidden>/</span>
              <Link {...adminClientsRoute} className="font-medium text-brand-deep">
                Clients
              </Link>
            </div>
            <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-brand-deep sm:text-4xl">
                  Client directory
                </h1>
                <p className="mt-2 max-w-2xl text-muted-foreground">
                  Search client records and review care preferences from one secure workspace.
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-card px-4 py-3 text-sm shadow-sm">
                <UsersRound className="h-4 w-4 text-brand-blue" aria-hidden />
                <span className="font-medium text-brand-deep">{clients.length}</span>
                <span className="text-muted-foreground">total clients</span>
                <div className="ml-4 flex items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={downloadTemplate}>
                    <Download className="h-4 w-4" aria-hidden />
                    Template
                  </Button>
                  <Button size="sm" variant="outline" onClick={exportClients}>
                    Export CSV
                  </Button>
                  <label className="relative inline-flex">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileChange}
                      className="absolute left-0 top-0 h-full w-full opacity-0"
                      aria-hidden
                    />
                    <Button size="sm">{importing ? "Importing..." : "Import CSV"}</Button>
                  </label>
                </div>
              </div>
            </div>
          </header>

          <Card className="border-border/80 shadow-[0_8px_30px_rgba(22,50,79,0.04)]">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-blue-soft text-brand-blue">
                  <UsersRound className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-brand-deep">Client record storage</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Client records are stored in the Supabase{" "}
                    <span className="font-medium text-brand-deep">clients</span> table used by the
                    Talk Space admin workspace. Use{" "}
                    <span className="font-medium text-brand-deep">Export CSV</span> to download a
                    backup of the current data and{" "}
                    <span className="font-medium text-brand-deep">Import CSV</span> to bring in
                    existing client records. Required fields in any uploaded record are full name,
                    email, and phone.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-[0_8px_30px_rgba(22,50,79,0.04)]">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-blue-soft text-brand-blue">
                  <Plus className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-brand-deep">Add old client</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Create a CRM profile for existing clients who were served before the platform.
                  </p>
                </div>
              </div>
              <form className="mt-5 grid gap-4 lg:grid-cols-2" onSubmit={createLegacyClient}>
                <label className="space-y-2 text-sm font-medium text-brand-deep">
                  Surname
                  <Input
                    value={legacyForm.surname}
                    onChange={updateLegacyForm("surname")}
                    required
                    autoComplete="family-name"
                  />
                </label>
                <label className="space-y-2 text-sm font-medium text-brand-deep">
                  Other names
                  <Input
                    value={legacyForm.otherNames}
                    onChange={updateLegacyForm("otherNames")}
                    required
                    autoComplete="given-name"
                  />
                </label>
                <label className="space-y-2 text-sm font-medium text-brand-deep">
                  Email
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="email"
                      value={legacyForm.email}
                      onChange={updateLegacyForm("email")}
                      required
                      autoComplete="email"
                      className="pl-9"
                    />
                  </div>
                </label>
                <label className="space-y-2 text-sm font-medium text-brand-deep">
                  Phone
                  <Input
                    value={legacyForm.phone}
                    onChange={updateLegacyForm("phone")}
                    autoComplete="tel"
                  />
                </label>
                <label className="space-y-2 text-sm font-medium text-brand-deep lg:col-span-2">
                  Address
                  <div className="relative">
                    <Home className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <textarea
                      value={legacyForm.address}
                      onChange={updateLegacyForm("address")}
                      rows={3}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 pl-9 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                </label>
                <label className="space-y-2 text-sm font-medium text-brand-deep">
                  Birthday
                  <div className="relative">
                    <Cake className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="date"
                      value={legacyForm.birthday}
                      onChange={updateLegacyForm("birthday")}
                      className="pl-9"
                    />
                  </div>
                </label>
                <label className="space-y-2 text-sm font-medium text-brand-deep">
                  Wedding anniversary date
                  <div className="relative">
                    <Heart className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="date"
                      value={legacyForm.weddingAnniversaryDate}
                      onChange={updateLegacyForm("weddingAnniversaryDate")}
                      className="pl-9"
                    />
                  </div>
                </label>
                <label className="space-y-2 text-sm font-medium text-brand-deep lg:col-span-2">
                  Occupation
                  <div className="relative">
                    <BriefcaseBusiness className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={legacyForm.occupation}
                      onChange={updateLegacyForm("occupation")}
                      className="pl-9"
                    />
                  </div>
                </label>
                <div className="lg:col-span-2">
                  <Button type="submit" disabled={creating}>
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus aria-hidden />}
                    {creating ? "Adding client..." : "Add client"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-[0_8px_30px_rgba(22,50,79,0.04)]">
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <div className="flex-1">
                  <label
                    htmlFor="client-search"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Search clients
                  </label>
                  <div className="relative mt-2">
                    <Search
                      className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                    <Input
                      id="client-search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search by name, email, phone, occupation or therapist"
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="w-full lg:w-48">
                  <label
                    htmlFor="client-mode"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Preferred mode
                  </label>
                  <Select
                    value={mode}
                    onValueChange={(value) => setMode(value as ClientModeFilter)}
                  >
                    <SelectTrigger id="client-mode" className="mt-2">
                      <SelectValue placeholder="All modes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All modes</SelectItem>
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="in_person">In person</SelectItem>
                      <SelectItem value="phone">Phone</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full lg:w-56">
                  <label
                    htmlFor="client-therapist"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Assigned therapist
                  </label>
                  <Select value={therapist} onValueChange={setTherapist}>
                    <SelectTrigger id="client-therapist" className="mt-2">
                      <SelectValue placeholder="All therapists" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All therapists</SelectItem>
                      {therapistOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {hasFilters ? (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium text-brand-blue transition-colors hover:bg-brand-blue-soft hover:text-brand-deep"
                  >
                    <SlidersHorizontal className="h-4 w-4" aria-hidden />
                    Reset
                  </button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <section aria-labelledby="client-results-heading">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 id="client-results-heading" className="text-xl font-semibold text-brand-deep">
                  Client records
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Showing {filteredClients.length} of {loadedClients.length} loaded client
                  {loadedClients.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>

            {filteredClients.length ? (
              <>
                <div className="mt-4 hidden overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm md:block">
                  <table className="w-full text-left text-sm">
                    <caption className="sr-only">Filtered Talk Space client records</caption>
                    <thead className="border-b border-border/70 bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th scope="col" className="px-4 py-3 font-medium">
                          Client
                        </th>
                        <th scope="col" className="px-4 py-3 font-medium">
                          Contact
                        </th>
                        <th scope="col" className="px-4 py-3 font-medium">
                          Preferred mode
                        </th>
                        <th scope="col" className="px-4 py-3 font-medium">
                          Occupation / therapist
                        </th>
                        <th scope="col" className="px-4 py-3 text-right font-medium">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredClients.map((client) => (
                        <ClientRow
                          key={client.id}
                          client={client}
                          onDelete={remove}
                          deleting={deletingId === client.id}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 grid gap-3 md:hidden">
                  {filteredClients.map((client) => (
                    <ClientCard
                      key={client.id}
                      client={client}
                      onDelete={remove}
                      deleting={deletingId === client.id}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-border bg-card p-10 text-center">
                <UsersRound className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
                <h3 className="mt-4 font-semibold text-brand-deep">
                  {hasFilters ? "No matching clients" : "No client records yet"}
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                  {hasFilters
                    ? "Try a different search term or reset the filters to see all client records."
                    : "New client profiles will appear here after they create a Talk Space account."}
                </p>
                {hasFilters ? (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="mt-5 text-sm font-medium text-brand-blue-deep hover:text-brand-deep"
                  >
                    Reset filters
                  </button>
                ) : null}
              </div>
            )}
            {hasMore ? (
              <div className="mt-5 flex justify-center">
                <Button
                  variant="outline"
                  onClick={() => void loadMoreClients()}
                  disabled={loadingMore}
                >
                  {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  {loadingMore ? "Loading clients..." : "Load more clients"}
                </Button>
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </AdminWorkspaceShell>
  );
}

export function AdminClientsSkeleton() {
  return (
    <AdminWorkspaceShell>
      <main id="main" className="min-h-screen bg-surface-page py-8 sm:py-10">
        <div className="mx-auto w-full max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">
          <div className="space-y-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-10 w-72 max-w-full" />
            <Skeleton className="h-5 w-96 max-w-full" />
          </div>
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </main>
    </AdminWorkspaceShell>
  );
}
