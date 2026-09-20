import { useMemo, useState } from "react";
import { AlertCircle, CalendarPlus, Clock3, MapPin, Trash2, Video } from "lucide-react";

import { AdminWorkspaceShell } from "@/components/progress/AdminSidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  createAvailabilitySlot,
  deleteAvailabilitySlot,
  type AdminAvailabilityData,
  type AdminAvailabilityMode,
  type AdminAvailabilitySlot,
} from "@/lib/availability.functions";

type SlotForm = {
  therapistId: string;
  mode: AdminAvailabilityMode;
  date: string;
  startsAt: string;
  endsAt: string;
  reason: string;
};

const emptyForm: SlotForm = {
  therapistId: "",
  mode: "online",
  date: "",
  startsAt: "09:00",
  endsAt: "10:00",
  reason: "",
};

const modeLabels: Record<AdminAvailabilityMode, string> = {
  online: "Online",
  in_person: "In person",
};

function todayInputValue() {
  const now = new Date();
  const year = now.toLocaleString("en-NG", { timeZone: "Africa/Lagos", year: "numeric" });
  const month = now.toLocaleString("en-NG", { timeZone: "Africa/Lagos", month: "2-digit" });
  const day = now.toLocaleString("en-NG", { timeZone: "Africa/Lagos", day: "2-digit" });
  return `${year}-${month}-${day}`;
}

function formatSlotDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Lagos",
  }).format(new Date(value));
}

function formatSlotTime(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  }).format(new Date(value));
}

function SlotMode({ mode }: { mode: AdminAvailabilityMode }) {
  const Icon = mode === "online" ? Video : MapPin;
  return (
    <Badge
      variant="outline"
      className="gap-1 border-brand-blue/20 bg-brand-blue-soft text-brand-blue"
    >
      <Icon className="h-3 w-3" aria-hidden />
      {modeLabels[mode]}
    </Badge>
  );
}

function SlotRow({ slot, onDelete }: { slot: AdminAvailabilitySlot; onDelete: () => void }) {
  return (
    <li className="flex flex-col gap-4 border-b border-border/70 px-5 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-brand-deep">{slot.therapistName}</p>
          <SlotMode mode={slot.mode} />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span>{formatSlotDate(slot.startsAt)}</span>
          <span className="inline-flex items-center gap-1">
            <Clock3 className="h-3.5 w-3.5" aria-hidden />
            {formatSlotTime(slot.startsAt)} – {formatSlotTime(slot.endsAt)}
          </span>
        </div>
        {slot.reason ? <p className="mt-1 text-xs text-muted-foreground">{slot.reason}</p> : null}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onDelete}
        className="self-start text-muted-foreground hover:text-danger sm:self-auto"
        aria-label={`Remove ${slot.therapistName} availability on ${formatSlotDate(slot.startsAt)}`}
      >
        <Trash2 className="h-4 w-4" aria-hidden />
        Remove
      </Button>
    </li>
  );
}

export function AdminAvailability({ data }: { data: AdminAvailabilityData }) {
  const [form, setForm] = useState<SlotForm>(() => ({
    ...emptyForm,
    therapistId: data.therapists[0]?.id ?? "",
  }));
  const [slots, setSlots] = useState(data.slots);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const minDate = useMemo(todayInputValue, []);

  function update<K extends keyof SlotForm>(key: K, value: SlotForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const slot = await createAvailabilitySlot({ data: form });
      setSlots((current) =>
        [...current, slot].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
      );
      setForm((current) => ({ ...current, date: "", reason: "" }));
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "The availability slot could not be created.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(slot: AdminAvailabilitySlot) {
    if (!window.confirm(`Remove this availability slot for ${slot.therapistName}?`)) return;

    setDeletingId(slot.id);
    setError(null);
    try {
      await deleteAvailabilitySlot({ data: { id: slot.id } });
      setSlots((current) => current.filter((currentSlot) => currentSlot.id !== slot.id));
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "The availability slot could not be removed.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <AdminWorkspaceShell>
      <main id="main" className="min-h-screen bg-surface-page py-8 sm:py-10">
        <div className="mx-auto w-full max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">
          <header>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Admin workspace</span>
              <span aria-hidden>/</span>
              <span className="font-medium text-brand-deep">Availability</span>
            </div>
            <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-brand-deep sm:text-4xl">
                  Create availability slots
                </h1>
                <p className="mt-2 max-w-2xl text-muted-foreground">
                  Add one-off times that clients can book on the public booking page.
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-card px-4 py-3 text-sm shadow-sm">
                <CalendarPlus className="h-4 w-4 text-brand-blue" aria-hidden />
                <span className="font-medium text-brand-deep">{slots.length}</span>
                <span className="text-muted-foreground">upcoming added slots</span>
              </div>
            </div>
          </header>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <Card className="border-border/80 shadow-[0_8px_30px_rgba(22,50,79,0.04)]">
              <CardHeader>
                <CardTitle>Add a slot</CardTitle>
                <CardDescription>
                  Slots use the Africa/Lagos timezone and become available immediately after saving.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-5" onSubmit={handleSubmit}>
                  <div>
                    <label
                      htmlFor="availability-therapist"
                      className="text-sm font-medium text-brand-deep"
                    >
                      Therapist
                    </label>
                    <Select
                      value={form.therapistId}
                      onValueChange={(value) => update("therapistId", value)}
                      disabled={!data.therapists.length || submitting}
                    >
                      <SelectTrigger id="availability-therapist" className="mt-2">
                        <SelectValue placeholder="Choose a therapist" />
                      </SelectTrigger>
                      <SelectContent>
                        {data.therapists.map((therapist) => (
                          <SelectItem key={therapist.id} value={therapist.id}>
                            {therapist.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-brand-deep">Session mode</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {(Object.keys(modeLabels) as AdminAvailabilityMode[]).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          aria-pressed={form.mode === mode}
                          onClick={() => update("mode", mode)}
                          className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                            form.mode === mode
                              ? "border-brand-blue bg-brand-blue-soft text-brand-deep"
                              : "border-border bg-background text-muted-foreground hover:border-brand-blue/40"
                          }`}
                        >
                          {modeLabels[mode]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="availability-date"
                      className="text-sm font-medium text-brand-deep"
                    >
                      Date
                    </label>
                    <DateInput
                      id="availability-date"
                      min={minDate}
                      value={form.date}
                      onChange={(event) => update("date", event.target.value)}
                      className="mt-2"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="availability-start"
                        className="text-sm font-medium text-brand-deep"
                      >
                        Starts
                      </label>
                      <Input
                        id="availability-start"
                        type="time"
                        value={form.startsAt}
                        onChange={(event) => update("startsAt", event.target.value)}
                        className="mt-2"
                        required
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="availability-end"
                        className="text-sm font-medium text-brand-deep"
                      >
                        Ends
                      </label>
                      <Input
                        id="availability-end"
                        type="time"
                        value={form.endsAt}
                        onChange={(event) => update("endsAt", event.target.value)}
                        className="mt-2"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="availability-reason"
                      className="text-sm font-medium text-brand-deep"
                    >
                      Internal note{" "}
                      <span className="font-normal text-muted-foreground">(optional)</span>
                    </label>
                    <Input
                      id="availability-reason"
                      value={form.reason}
                      onChange={(event) => update("reason", event.target.value)}
                      placeholder="e.g. Extra Saturday clinic"
                      className="mt-2"
                      maxLength={120}
                    />
                  </div>

                  {error ? (
                    <div
                      className="flex items-start gap-2 rounded-lg border border-danger/20 bg-danger/10 px-3 py-2.5 text-sm text-danger"
                      role="alert"
                    >
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                      <span>{error}</span>
                    </div>
                  ) : null}

                  <Button
                    type="submit"
                    disabled={submitting || !data.therapists.length}
                    className="w-full"
                  >
                    <CalendarPlus className="h-4 w-4" aria-hidden />
                    {submitting ? "Saving slot…" : "Create availability slot"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-border/80 shadow-[0_8px_30px_rgba(22,50,79,0.04)]">
              <CardHeader>
                <CardTitle>Upcoming added slots</CardTitle>
                <CardDescription>
                  These one-off windows are included when a matching service and mode are selected
                  on `/book`.
                </CardDescription>
              </CardHeader>
              {slots.length ? (
                <CardContent className="p-0">
                  <ul className="border-t border-border/70">
                    {slots.map((slot) => (
                      <SlotRow
                        key={slot.id}
                        slot={slot}
                        onDelete={() => {
                          if (!deletingId) void handleDelete(slot);
                        }}
                      />
                    ))}
                  </ul>
                </CardContent>
              ) : (
                <CardContent>
                  <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center">
                    <CalendarPlus className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
                    <h2 className="mt-4 font-semibold text-brand-deep">No added slots yet</h2>
                    <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                      Create a slot here and it will appear on the public booking form for the
                      selected mode.
                    </p>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>
        </div>
      </main>
    </AdminWorkspaceShell>
  );
}

export function AdminAvailabilitySkeleton() {
  return (
    <AdminWorkspaceShell>
      <main id="main" className="min-h-screen bg-surface-page py-8 sm:py-10">
        <div className="mx-auto w-full max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">
          <div className="space-y-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-10 w-96 max-w-full" />
            <Skeleton className="h-5 w-[32rem] max-w-full" />
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <Skeleton className="h-[31rem] rounded-xl" />
            <Skeleton className="h-[31rem] rounded-xl" />
          </div>
        </div>
      </main>
    </AdminWorkspaceShell>
  );
}
