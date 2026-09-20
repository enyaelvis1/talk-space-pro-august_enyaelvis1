import { useEffect, useMemo, useState } from "react";
import { useCheckoutClock } from "@/hooks/use-checkout-clock";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import {
  CalendarCheck2,
  CheckCircle2,
  Clock,
  Copy,
  Loader2,
  CreditCard,
  Landmark,
  Upload,
  AlertCircle,
  Minus,
  Plus,
} from "lucide-react";

import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteBreadcrumbs } from "@/components/site/SiteBreadcrumbs";
import { SiteFooter } from "@/components/site/SiteFooter";
import { FirstTimeAssessmentLinks } from "@/components/site/FirstTimeAssessmentLinks";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DateInput } from "@/components/ui/date-input";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { canonicalUrl } from "@/lib/seo";
import { clearFormDraft, loadFormDraft, saveFormDraft } from "@/lib/form-drafts";
import { INTAKE_CONSENT_TEXT } from "@/lib/intake-consent";
import { savePurchaseHandoff } from "@/lib/purchase-handoff";
import { isSameDateKey } from "@/lib/booking-calendar";
import {
  getBookingPrefill,
  getPackageBookingAccess,
  holdSlot,
  holdSlots,
  listAvailableSlots,
  listBookingServices,
  type AvailableSlot,
  type BookingPrefill,
  type BookingService,
  type HeldAppointment,
  type HeldAppointmentGroup,
  type PackageBookingAccess,
} from "@/lib/booking.functions";
import {
  DEFAULT_FORM_TEMPLATES,
  getLatestTemplateByBaseKey,
  getTemplateField,
  type FormTemplateDefinition,
} from "@/lib/form-templates";
import { getPublicFormTemplates } from "@/lib/content.functions";
import {
  getPublicPaymentOptions,
  initPaystackPayment,
  submitBankTransfer,
  uploadReceiptWithToken,
  type PublicPaymentOptions,
} from "@/lib/payments.functions";

const BOOKING_DRAFT_KEY = "talk-space.booking-draft.v1";
const BOOKING_CHECKOUT_KEY = "talk-space.booking-checkout.v1";
const MAX_SESSIONS_PER_CHECKOUT = 10;

function getActionErrorMessage(error: unknown, fallback: string) {
  const pending: unknown[] = [error];
  const seen = new Set<unknown>();
  while (pending.length) {
    const current = pending.shift();
    if (!current || seen.has(current)) continue;
    seen.add(current);
    if (current instanceof Error && current.message) return current.message;
    if (typeof current !== "object") continue;
    const value = current as Record<string, unknown>;
    if (typeof value.message === "string" && value.message.trim()) return value.message;
    for (const key of ["data", "cause", "error", "details"]) {
      if (value[key]) pending.push(value[key]);
    }
  }
  return fallback;
}

export const Route = createFileRoute("/book")({
  validateSearch: z.object({
    service: z.string().trim().optional(),
    mode: z.enum(["online", "in_person"]).optional(),
    package: z.string().trim().optional(),
  }),
  loader: async () => {
    const [services, paymentOptions, prefill, formTemplates] = await Promise.all([
      listBookingServices(),
      getPublicPaymentOptions().catch((): PublicPaymentOptions => ({
        mode: "test",
        isPaystackEnabled: false,
        paystackPublicKey: null,
        isBankTransferEnabled: false,
        bankName: null,
        bankAccountName: null,
        bankAccountNumber: null,
        bankInstructions: null,
      })),
      getBookingPrefill().catch((): BookingPrefill => ({
        isAuthenticated: false,
        fullName: "",
        email: "",
        phone: "",
      })),
      getPublicFormTemplates(),
    ]);
    return { services, paymentOptions, prefill, formTemplates };
  },
  head: () => ({
    meta: [
      { title: "Book a session | Talk Space Counselling Services" },
      {
        name: "description",
        content:
          "Request a confidential counselling session with a Talk Space therapist. Online or in-person, individual, couples, family or group.",
      },
      { property: "og:title", content: "Book a session with Talk Space" },
      {
        property: "og:description",
        content:
          "Request a confidential counselling session with a Talk Space therapist, online or in person in Nigeria.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: canonicalUrl("/book") },
    ],
    links: [{ rel: "canonical", href: canonicalUrl("/book") }],
  }),
  component: BookPage,
});

const bookingSchema = z.object({
  // Date and time are optional. A concrete time uses the hold flow; without one,
  // the request continues through purchase-first so no incomplete appointment is created.
  fullName: z
    .string()
    .trim()
    .min(2, "Please enter your full name")
    .max(100, "Name must be under 100 characters"),
  email: z.string().trim().email("Enter a valid email address").max(255),
  phone: z
    .string()
    .trim()
    .min(7, "Enter a valid phone number")
    .max(20, "Phone must be under 20 characters")
    .regex(/^[+\d\s()-]+$/, "Only digits, spaces and + ( ) - are allowed"),
  serviceId: z.string().uuid("Choose a service"),
  mode: z.enum(["online", "in_person"], { message: "Choose a session mode" }),
  preferredDate: z
    .string()
    .trim()
    .optional()
    .refine((d) => {
      if (!d) return true;
      const chosen = new Date(d);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return chosen >= today;
    }, "Date must be today or later"),
  preferredTime: z.string().trim().optional(),
  notes: z.string().trim().max(1000, "Notes must be under 1000 characters").optional(),
  consent: z.literal(true, { message: "Please acknowledge the privacy policy" }),
});

type BookingInput = z.infer<typeof bookingSchema>;
type FormState = Omit<BookingInput, "consent"> & { consent: boolean };
type FieldErrors = Partial<Record<keyof BookingInput, string>>;

type Confirmation = {
  appointment: HeldAppointment;
  appointments: HeldAppointment[];
  submittedAt: string;
  serverNow: string;
  data: BookingInput;
};

function saveCheckoutSession(confirmation: Confirmation) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(BOOKING_CHECKOUT_KEY, JSON.stringify({ confirmation }));
  } catch {
    // Checkout recovery is a convenience; server-side validation remains authoritative.
  }
}

function loadCheckoutSession(): Confirmation | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(BOOKING_CHECKOUT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { confirmation?: Confirmation };
    const confirmation = parsed?.confirmation;
    if (
      !confirmation?.appointment?.id ||
      !confirmation.appointment.manageToken ||
      !confirmation.appointments?.length ||
      !confirmation.data?.serviceId ||
      !confirmation.serverNow
    ) {
      return null;
    }
    return confirmation;
  } catch {
    return null;
  }
}

function clearCheckoutSession() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(BOOKING_CHECKOUT_KEY);
  } catch {
    // Ignore storage failures.
  }
}

const emptyForm: FormState = {
  fullName: "",
  email: "",
  phone: "",
  serviceId: "",
  mode: "online",
  preferredDate: "",
  preferredTime: "",
  notes: "",
  consent: false,
};

import { slotKey } from "@/lib/booking-slots";
import { BookingSlotSelect } from "@/components/booking/BookingSlotSelect";

function BookPage() {
  const { services, paymentOptions, prefill, formTemplates } = Route.useLoaderData() as {
    services: BookingService[];
    paymentOptions: PublicPaymentOptions;
    prefill: BookingPrefill;
    formTemplates: FormTemplateDefinition[];
  };
  const search = Route.useSearch();
  const bookingTemplate =
    getLatestTemplateByBaseKey(formTemplates, "booking_intake") ??
    DEFAULT_FORM_TEMPLATES.find((template) => template.key === "booking_intake_v1")!;
  const initialForm = useMemo<FormState>(
    () => ({
      ...emptyForm,
      fullName: prefill.fullName,
      email: prefill.email,
      phone: prefill.phone,
      serviceId: services.find((service) => service.code === search.service)?.id ?? "",
      mode: search.mode ?? emptyForm.mode,
    }),
    [prefill.email, prefill.fullName, prefill.phone, search.mode, search.service, services],
  );
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [step, setStep] = useState<"form" | "pay" | "done">("form");
  const [paymentDone, setPaymentDone] = useState<
    | { kind: "paystack_redirected" }
    | { kind: "bank_submitted"; reference: string }
    | { kind: "package_credit"; remainingSessions: number | null }
    | { kind: "skipped" }
    | null
  >(null);
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [availabilityRefreshKey, setAvailabilityRefreshKey] = useState(0);
  const [selectedSlots, setSelectedSlots] = useState<AvailableSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [draftUpdatedAt, setDraftUpdatedAt] = useState<string | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [packageAccess, setPackageAccess] = useState<PackageBookingAccess | null>(null);
  const [packageError, setPackageError] = useState<string | null>(null);
  const [packageLoading, setPackageLoading] = useState(Boolean(search.package));

  useEffect(() => {
    if (search.package) return;
    const draft = loadFormDraft<BookingInput>(BOOKING_DRAFT_KEY);
    if (draft) {
      setForm((current) => ({ ...current, ...draft.data }));
      setDraftUpdatedAt(draft.updatedAt);
      toast.info("We restored your saved booking draft.");
    }
    setDraftLoaded(true);
    const checkout = loadCheckoutSession();
    if (checkout) {
      setConfirmation(checkout);
      setStep("pay");
      toast.info("We restored your payment checkout.");
    }
  }, [search.package]);

  useEffect(() => {
    if (!search.package) {
      setPackageAccess(null);
      setPackageError(null);
      return;
    }
    let active = true;
    setPackageLoading(true);
    setPackageError(null);
    void getPackageBookingAccess({ data: { packageToken: search.package } })
      .then((pkg) => {
        if (!active) return;
        if (!pkg) {
          setPackageAccess(null);
          setPackageError("We couldn't find that package booking link.");
          return;
        }
        setPackageAccess(pkg);
        if (pkg.status !== "active" || pkg.remainingSessions <= 0) {
          setPackageError("This package has no remaining active sessions.");
          return;
        }
        setForm((current) => ({
          ...current,
          fullName: pkg.clientName,
          email: pkg.clientEmail,
          phone: pkg.clientPhone,
          serviceId: pkg.serviceId,
          mode: pkg.sessionMode ?? current.mode,
        }));
        clearFormDraft(BOOKING_DRAFT_KEY);
        setDraftUpdatedAt(null);
      })
      .catch((err) => {
        if (active) {
          setPackageAccess(null);
          setPackageError(err instanceof Error ? err.message : "Package link lookup failed.");
        }
      })
      .finally(() => {
        if (active) setPackageLoading(false);
      });
    return () => {
      active = false;
    };
  }, [search.package]);

  useEffect(() => {
    if (step !== "form") window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [step]);

  const minDate = useMemo(() => new Date().toISOString().split("T")[0], []);

  useEffect(() => {
    if (!form.serviceId || !form.preferredDate) {
      setAvailableSlots([]);
      setSlotsError(null);
      return;
    }

    let active = true;
    setSlotsLoading(true);
    setSlotsError(null);
    void listAvailableSlots({
      data: {
        serviceId: form.serviceId,
        from: form.preferredDate,
        to: form.preferredDate,
        mode: form.mode,
      },
    })
      .then((slots) => {
        if (!active) return;
        setAvailableSlots(slots);
        if (slots.length === 0) {
          setSelectedSlots([]);
          setForm((current) =>
            current.preferredTime ? { ...current, preferredTime: "" } : current,
          );
        }
      })
      .catch(() => {
        if (active) {
          setAvailableSlots([]);
          setSlotsError("We couldn't load availability. Please try again.");
        }
      })
      .finally(() => {
        if (active) setSlotsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [availabilityRefreshKey, form.mode, form.preferredDate, form.serviceId]);

  useEffect(() => {
    setSelectedSlots([]);
    setForm((current) => (current.preferredTime ? { ...current, preferredTime: "" } : current));
  }, [form.mode, form.preferredDate, form.serviceId]);

  useEffect(() => {
    if (!draftLoaded || step !== "form") return;
    const timeout = window.setTimeout(() => {
      saveFormDraft(BOOKING_DRAFT_KEY, form);
      setDraftUpdatedAt(new Date().toISOString());
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [draftLoaded, form, step]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const addSelectedSlot = () => {
    const selectedKeys = new Set(selectedSlots.map((slot) => slotKey(slot)));
    const selectedSlot = form.preferredTime
      ? availableSlots.find((slot) => slotKey(slot) === form.preferredTime)
      : availableSlots.find((slot) => !selectedKeys.has(slotKey(slot)));
    if (!selectedSlot) {
      setErrors((current) => ({ ...current, preferredTime: "No more available times" }));
      toast.error("No more available times are available for this date.");
      return;
    }
    if (selectedKeys.has(slotKey(selectedSlot))) {
      toast.info("That session is already in your session list.");
      return;
    }
    if (selectedSlots.length >= MAX_SESSIONS_PER_CHECKOUT) {
      toast.error(`You can book up to ${MAX_SESSIONS_PER_CHECKOUT} sessions in one checkout.`);
      return;
    }
    setSelectedSlots((current) =>
      [...current, selectedSlot].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)),
    );
    update("preferredTime", "");
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = bookingSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof BookingInput | undefined;
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      toast.error("Please fix the highlighted fields.");
      return;
    }

    const selectedSlot = availableSlots.find(
      (slot) =>
        parsed.data.preferredDate &&
        slot.mode === parsed.data.mode &&
        slotKey(slot) === parsed.data.preferredTime &&
        isSameDateKey(slot.startsAt, parsed.data.preferredDate),
    );
    const currentSelectedSlots = selectedSlots.filter(
      (slot) =>
        parsed.data.preferredDate &&
        slot.mode === parsed.data.mode &&
        isSameDateKey(slot.startsAt, parsed.data.preferredDate),
    );
    const slotsToHold = currentSelectedSlots.length
      ? currentSelectedSlots
      : selectedSlot
        ? [selectedSlot]
        : [];
    if (!slotsToHold.length) {
      const service = services.find((item) => item.id === parsed.data.serviceId);
      if (!service) {
        setErrors((current) => ({ ...current, serviceId: "Choose a service" }));
        toast.error("Choose a service before continuing.");
        return;
      }
      savePurchaseHandoff({
        fullName: parsed.data.fullName,
        email: parsed.data.email,
        phone: parsed.data.phone,
        serviceId: parsed.data.serviceId,
        serviceCode: service.code,
        mode: parsed.data.mode,
        preferredDate: parsed.data.preferredDate ?? "",
        preferredTime: parsed.data.preferredTime ?? "",
        sessions: 1,
      });
      clearFormDraft(BOOKING_DRAFT_KEY);
      window.location.assign(
        `/purchase?service=${encodeURIComponent(service.code)}&mode=${encodeURIComponent(parsed.data.mode)}`,
      );
      return;
    }

    setSubmitting(true);
    try {
      const basePayload = {
        serviceId: parsed.data.serviceId,
        mode: parsed.data.mode,
        templateKey: bookingTemplate.key,
        fullName: parsed.data.fullName,
        email: parsed.data.email,
        phone: parsed.data.phone,
        notes: parsed.data.notes ?? "",
        consentAcknowledged: parsed.data.consent,
      };
      const group: HeldAppointmentGroup =
        search.package || slotsToHold.length === 1
          ? await holdSlot({
              data: {
                ...basePayload,
                therapistId: slotsToHold[0].therapistId,
                startsAt: slotsToHold[0].startsAt,
                packageToken: search.package,
              },
            }).then((appointment) => ({
              appointments: [appointment],
              holdExpiresAt: appointment.holdExpiresAt,
              bookingReference: appointment.bookingReference,
              serverNow: appointment.serverNow,
            }))
          : await holdSlots({
              data: {
                ...basePayload,
                slots: slotsToHold.map((slot) => ({
                  therapistId: slot.therapistId,
                  startsAt: slot.startsAt,
                })),
              },
            });
      const appointment = group.appointments[0];
      const savedConfirmation = {
        appointment,
        appointments: group.appointments,
        submittedAt: new Date().toISOString(),
        serverNow: group.serverNow,
        data: parsed.data,
      } satisfies Confirmation;
      setConfirmation(savedConfirmation);
      saveCheckoutSession(savedConfirmation);
      clearFormDraft(BOOKING_DRAFT_KEY);
      setDraftUpdatedAt(null);
      if (appointment.paidWithPackage) {
        setPaymentDone({
          kind: "package_credit",
          remainingSessions: appointment.packageRemainingSessions ?? null,
        });
        setStep("done");
      } else {
        const enabled = paymentOptions.isPaystackEnabled || paymentOptions.isBankTransferEnabled;
        setStep(enabled ? "pay" : "done");
      }
    } catch (error) {
      const message = getActionErrorMessage(error, "We couldn't hold that slot.");
      console.error("[booking] hold request failed:", error);
      const slotConflict = /slot.*(?:available|hold)|no longer available/i.test(message);
      if (slotConflict) {
        setSelectedSlots([]);
        update("preferredTime", "");
        setBookingError(
          "That time was just taken. Choose another available time or continue without one.",
        );
        setAvailabilityRefreshKey((current) => current + 1);
      } else {
        setBookingError(message);
        setAvailableSlots([]);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setForm({
      ...emptyForm,
      serviceId: services[0]?.id ?? "",
      fullName: prefill.fullName,
      email: prefill.email,
      phone: prefill.phone,
      consent: false,
    });
    setErrors({});
    setConfirmation(null);
    setStep("form");
    setPaymentDone(null);
    clearCheckoutSession();
    setAvailableSlots([]);
    setSelectedSlots([]);
    setSlotsError(null);
    clearFormDraft(BOOKING_DRAFT_KEY);
    setDraftUpdatedAt(null);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <SiteBreadcrumbs />
      <main id="main" className="flex-1 bg-background">
        <section className="mx-auto w-full max-w-5xl px-4 pt-16 pb-8 sm:px-6 lg:px-8">
          <p className="eyebrow">Booking</p>
          <h1 className="display-1 mt-3 text-brand-deep">
            {step === "done"
              ? "Request received."
              : step === "pay"
                ? "Complete payment."
                : packageLoading || search.package
                  ? "Book from your package."
                  : "Book a session."}
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            {step === "done"
              ? "We confirm sessions as soon as payment is made and the booking is done. Check your email for next steps."
              : step === "pay"
                ? "Your slot is held for a few minutes. Choose how you'd like to pay to confirm your session."
                : packageLoading
                  ? "Checking your private package link before we prefill your booking details."
                  : packageAccess
                    ? "Choose a time for one of your remaining package sessions. No extra payment is needed."
                    : "Share a few details and we'll match you with a Talk Space therapist. Everything you share is confidential."}
          </p>
        </section>

        <section className="mx-auto w-full max-w-5xl px-4 pb-24 sm:px-6 lg:px-8">
          {step === "done" && confirmation ? (
            <ConfirmationCard
              confirmation={confirmation}
              services={services}
              onReset={resetForm}
              paymentDone={paymentDone}
            />
          ) : step === "pay" && confirmation ? (
            <PaymentStep
              confirmation={confirmation}
              services={services}
              options={paymentOptions}
              onSkip={() => {
                clearCheckoutSession();
                setPaymentDone({ kind: "skipped" });
                setStep("done");
              }}
              onBankSubmitted={(reference) => {
                clearCheckoutSession();
                setPaymentDone({ kind: "bank_submitted", reference });
                setStep("done");
              }}
              onPaystackRedirect={() => {
                setPaymentDone({ kind: "paystack_redirected" });
              }}
            />
          ) : (
            <BookingForm
              form={form}
              errors={errors}
              minDate={minDate}
              submitting={submitting}
              services={services}
              availableSlots={availableSlots}
              selectedSlots={selectedSlots}
              slotsLoading={slotsLoading}
              slotsError={slotsError}
              prefill={prefill}
              template={bookingTemplate}
              draftUpdatedAt={draftUpdatedAt}
              packageAccess={packageAccess}
              packageError={packageError}
              packageLoading={packageLoading}
              onClearDraft={() => {
                clearFormDraft(BOOKING_DRAFT_KEY);
                setDraftUpdatedAt(null);
              }}
              onChange={update}
              onAddSlot={addSelectedSlot}
              onRemoveSlot={(slotId) =>
                setSelectedSlots((current) => current.filter((slot) => slotKey(slot) !== slotId))
              }
              onSubmit={onSubmit}
            />
          )}
        </section>
      </main>
      <Dialog open={Boolean(bookingError)} onOpenChange={(open) => !open && setBookingError(null)}>
        <DialogContent className="max-w-xl border-danger/30 p-8 sm:p-10">
          <DialogHeader className="text-left">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger">
              <AlertCircle className="h-6 w-6" aria-hidden />
            </div>
            <DialogTitle className="text-2xl text-brand-deep">
              Booking could not be submitted
            </DialogTitle>
            <DialogDescription className="pt-2 text-base leading-7">
              {bookingError}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 sm:justify-start">
            <Button type="button" onClick={() => setBookingError(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <SiteFooter />
    </div>
  );
}

function BookingForm({
  form,
  errors,
  minDate,
  submitting,
  services,
  availableSlots,
  selectedSlots,
  slotsLoading,
  slotsError,
  prefill,
  template,
  draftUpdatedAt,
  packageAccess,
  packageError,
  packageLoading,
  onClearDraft,
  onChange,
  onAddSlot,
  onRemoveSlot,
  onSubmit,
}: {
  form: FormState;
  errors: FieldErrors;
  minDate: string;
  submitting: boolean;
  services: BookingService[];
  availableSlots: AvailableSlot[];
  selectedSlots: AvailableSlot[];
  slotsLoading: boolean;
  slotsError: string | null;
  prefill: BookingPrefill;
  template: FormTemplateDefinition;
  draftUpdatedAt: string | null;
  packageAccess: PackageBookingAccess | null;
  packageError: string | null;
  packageLoading: boolean;
  onClearDraft: () => void;
  onChange: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  onAddSlot: () => void;
  onRemoveSlot: (slotKeyValue: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const fullNameField = getTemplateField(template, "fullName");
  const emailField = getTemplateField(template, "email");
  const phoneField = getTemplateField(template, "phone");
  const serviceField = getTemplateField(template, "serviceId");
  const modeField = getTemplateField(template, "mode");
  const preferredDateField = getTemplateField(template, "preferredDate");
  const preferredTimeField = getTemplateField(template, "preferredTime");
  const notesField = getTemplateField(template, "notes");
  const notesLabel = notesField?.label ?? "Anything you'd like us to know? (Optional)";
  const displayedNotesLabel =
    notesField?.required === false && !/\(optional\)\s*$/i.test(notesLabel)
      ? `${notesLabel} (Optional)`
      : notesLabel;
  const requiredFields = [form.fullName, form.email, form.phone, form.serviceId, form.mode];
  const completedFields = requiredFields.filter((value) => value.trim().length > 0).length;
  const completionPercent = Math.round((completedFields / requiredFields.length) * 100);
  const selectedSlotReady =
    selectedSlots.length > 0 || availableSlots.some((slot) => slotKey(slot) === form.preferredTime);
  const isReadyToSubmit = completionPercent === 100 && (packageAccess ? selectedSlotReady : true);
  const checkoutSessionCount = selectedSlots.length || (form.preferredTime ? 1 : 0);
  const canAddCurrentSlot =
    selectedSlots.length < MAX_SESSIONS_PER_CHECKOUT &&
    availableSlots.some(
      (slot) => !selectedSlots.some((selected) => slotKey(selected) === slotKey(slot)),
    );
  const reduceSessionCount = () => {
    const latest = selectedSlots[selectedSlots.length - 1];
    if (latest) {
      onRemoveSlot(slotKey(latest));
      return;
    }
    if (form.preferredTime) onChange("preferredTime", "");
  };

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="grid gap-8 lg:grid-cols-[2fr_1fr]"
      aria-labelledby="booking-heading"
    >
      <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm sm:p-8">
        <h2 id="booking-heading" className="sr-only">
          Booking form
        </h2>

        {packageLoading ? (
          <div className="mb-6 rounded-lg border border-brand-blue/30 bg-brand-blue-soft/60 px-4 py-3 text-sm text-brand-deep">
            Checking your package link…
          </div>
        ) : packageError ? (
          <div className="mb-6 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
            {packageError}
          </div>
        ) : packageAccess ? (
          <div className="mb-6 rounded-lg border border-brand-mint/40 bg-brand-mint-soft px-4 py-3 text-sm text-brand-deep">
            <p className="font-medium">Package session</p>
            <p className="text-xs text-muted-foreground">
              Reference: {packageAccess.packageReference}
            </p>
            <p className="text-xs text-brand-deep/75">
              {packageAccess.remainingSessions} of {packageAccess.purchasedSessions} session(s)
              remaining for {packageAccess.serviceName}
              {packageAccess.sessionMode
                ? ` (${packageAccess.sessionMode === "online" ? "online" : "in-person"})`
                : ""}
              .
            </p>
          </div>
        ) : draftUpdatedAt ? (
          <div className="mb-6 flex flex-col gap-3 rounded-lg border border-brand-blue/30 bg-brand-blue-soft/60 px-4 py-3 text-sm text-brand-deep sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Saved draft restored</p>
              <p className="text-xs text-brand-deep/75">
                Last saved{" "}
                {new Intl.DateTimeFormat("en-NG", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(draftUpdatedAt))}
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={onClearDraft}>
              Clear saved draft
            </Button>
          </div>
        ) : null}

        <div className="mb-6 rounded-lg border border-brand-blue/30 bg-brand-blue-soft/60 px-4 py-3 text-brand-deep">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">{isReadyToSubmit ? "Ready to submit" : "In progress"}</p>
              <p className="text-xs text-brand-deep/75">
                {completedFields} of {requiredFields.length} required details complete
              </p>
            </div>
            <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-brand-deep">
              {completionPercent}%
            </span>
          </div>
          <Progress value={completionPercent} className="mt-3 h-2" />
        </div>

        {prefill.isAuthenticated ? (
          <div className="mb-6 rounded-lg border border-brand-blue/40 bg-brand-blue-soft/60 px-4 py-3 text-sm text-brand-deep">
            Signed in as <span className="font-medium">{prefill.email}</span>. Your session will be
            linked to your account for easy rescheduling.
          </div>
        ) : (
          <div className="mb-6 rounded-lg border border-border/60 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" search={{ redirect: "/book" } as never} className="text-link">
              Sign in
            </Link>{" "}
            so this session is linked to your record.
          </div>
        )}

        <FieldGroup legend="About you">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={fullNameField?.label ?? "Full name"}
              htmlFor="fullName"
              error={errors.fullName}
              required={fullNameField?.required ?? true}
            >
              <Input
                id="fullName"
                autoComplete="name"
                value={form.fullName}
                onChange={(e) => onChange("fullName", e.target.value)}
                aria-invalid={!!errors.fullName}
                maxLength={100}
                placeholder={fullNameField?.placeholder || undefined}
              />
            </Field>
            <Field
              label={emailField?.label ?? "Email"}
              htmlFor="email"
              error={errors.email}
              required={emailField?.required ?? true}
            >
              <Input
                id="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={form.email}
                onChange={(e) => onChange("email", e.target.value)}
                aria-invalid={!!errors.email}
                maxLength={255}
                placeholder={emailField?.placeholder || undefined}
              />
            </Field>
            <Field
              label={phoneField?.label ?? "Phone (WhatsApp preferred)"}
              htmlFor="phone"
              error={errors.phone}
              required={phoneField?.required ?? true}
              className="sm:col-span-2"
              helper={phoneField?.helpText || undefined}
            >
              <Input
                id="phone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                value={form.phone}
                onChange={(e) => onChange("phone", e.target.value)}
                aria-invalid={!!errors.phone}
                maxLength={20}
                placeholder={phoneField?.placeholder || undefined}
              />
            </Field>
          </div>
        </FieldGroup>

        <FieldGroup legend="Session details">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={serviceField?.label ?? "Service"}
              htmlFor="service"
              error={errors.serviceId}
              required={serviceField?.required ?? true}
            >
              <Select
                value={form.serviceId}
                onValueChange={(v) => {
                  onChange("serviceId", v);
                  onChange("preferredTime", "");
                }}
                disabled={Boolean(packageAccess)}
              >
                <SelectTrigger id="service" aria-invalid={!!errors.serviceId}>
                  <SelectValue placeholder={serviceField?.placeholder || "Choose a service"} />
                </SelectTrigger>
                <SelectContent>
                  {services.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name} ({service.durationMinutes} minutes)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              label={modeField?.label ?? "Session mode"}
              error={errors.mode}
              required={modeField?.required ?? true}
            >
              <RadioGroup
                value={form.mode}
                onValueChange={(v) => {
                  if (packageAccess?.sessionMode) return;
                  onChange("mode", v as BookingInput["mode"]);
                }}
                className="grid grid-cols-2 gap-2"
                disabled={Boolean(packageAccess?.sessionMode)}
              >
                <ModeOption
                  id="mode-online"
                  value="online"
                  label="Online"
                  checked={form.mode === "online"}
                  disabled={Boolean(packageAccess?.sessionMode)}
                />
                <ModeOption
                  id="mode-inperson"
                  value="in_person"
                  label="In-person"
                  checked={form.mode === "in_person"}
                  disabled={Boolean(packageAccess?.sessionMode)}
                />
              </RadioGroup>
            </Field>

            <Field
              label={preferredDateField?.label ?? "Preferred date"}
              htmlFor="preferredDate"
              error={errors.preferredDate}
              required={preferredDateField?.required ?? false}
            >
              <DateInput
                id="preferredDate"
                min={minDate}
                value={form.preferredDate}
                onChange={(e) => onChange("preferredDate", e.target.value)}
                aria-invalid={!!errors.preferredDate}
                placeholder={preferredDateField?.placeholder || undefined}
                className="h-12 text-lg"
                iconLabel="Open preferred date calendar"
              />
            </Field>

            <Field
              label={preferredTimeField?.label ?? "Preferred time"}
              htmlFor="preferredTime"
              error={errors.preferredTime}
              required={preferredTimeField?.required ?? false}
            >
              <BookingSlotSelect
                slots={availableSlots}
                value={form.preferredTime}
                onValueChange={(v) => onChange("preferredTime", v)}
                disabled={slotsLoading || !form.serviceId || !form.preferredDate}
                invalid={!!errors.preferredTime}
                placeholder={
                  slotsLoading
                    ? "Loading availability…"
                    : preferredTimeField?.placeholder ||
                      (!form.serviceId || !form.preferredDate
                        ? "Choose service and date first"
                        : "Choose an available time")
                }
              />
              {!packageAccess ? (
                <div className="mt-3 space-y-3">
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-brand-deep">How many sessions?</p>
                        <p className="text-xs text-muted-foreground">
                          Use + to add another available time to this checkout.
                        </p>
                      </div>
                      <div className="flex items-center rounded-full border border-border bg-background p-1 shadow-sm">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-full"
                          onClick={reduceSessionCount}
                          disabled={slotsLoading || checkoutSessionCount <= 0}
                          aria-label="Reduce selected sessions"
                        >
                          <Minus className="h-4 w-4" aria-hidden />
                        </Button>
                        <span
                          className="min-w-10 px-2 text-center text-sm font-semibold text-brand-deep"
                          aria-live="polite"
                        >
                          {Math.max(checkoutSessionCount, 1)}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-full"
                          onClick={onAddSlot}
                          disabled={slotsLoading || !canAddCurrentSlot}
                          aria-label="Add selected session"
                        >
                          <Plus className="h-4 w-4" aria-hidden />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
              {!packageAccess && !selectedSlotReady ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  No time selected? Continue to purchase sessions and book a time later.
                </p>
              ) : null}
              {slotsError ? <p className="text-xs text-danger">{slotsError}</p> : null}
              {!slotsLoading &&
              form.preferredDate &&
              form.serviceId &&
              !slotsError &&
              !availableSlots.length ? (
                <p className="text-xs text-muted-foreground">
                  No slots are available for this date. Try another date.
                </p>
              ) : null}
            </Field>

            <Field
              label={displayedNotesLabel}
              htmlFor="notes"
              error={errors.notes}
              required={notesField?.required ?? false}
              className="sm:col-span-2"
              helper={notesField?.helpText || undefined}
            >
              <Textarea
                id="notes"
                value={form.notes ?? ""}
                onChange={(e) => onChange("notes", e.target.value)}
                rows={4}
                maxLength={1000}
                placeholder={
                  notesField?.placeholder || "Briefly, what would you like support with?"
                }
                aria-invalid={!!errors.notes}
                required={notesField?.required ?? false}
              />
              <p className="mt-1 text-xs text-muted-foreground">{(form.notes ?? "").length}/1000</p>
            </Field>
          </div>
        </FieldGroup>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 rounded-2xl border border-border/70 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
            <Checkbox
              id="booking-consent"
              checked={form.consent}
              onCheckedChange={(checked) => onChange("consent", checked === true)}
              className="mt-0.5"
            />
            <div className="space-y-1">
              <Label htmlFor="booking-consent" className="text-sm font-medium text-brand-deep">
                I acknowledge the privacy policy <span className="text-danger">*</span>
              </Label>
              <p className="leading-6">
                {INTAKE_CONSENT_TEXT}{" "}
                <Link to="/privacy-policy" className="text-link">
                  Read the policy
                </Link>
                .
              </p>
            </div>
          </div>
          <Button
            type="submit"
            disabled={
              submitting ||
              !form.consent ||
              packageLoading ||
              Boolean(packageError) ||
              !isReadyToSubmit
            }
            className="bg-brand-deep text-white hover:bg-brand-deep/90 sm:min-w-48"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending request…
              </>
            ) : (
              <>
                <CalendarCheck2 className="h-4 w-4" />
                {packageAccess
                  ? "Request session"
                  : selectedSlotReady
                    ? checkoutSessionCount > 1
                      ? "Request sessions"
                      : "Request session"
                    : "Continue to purchase"}
              </>
            )}
          </Button>
        </div>
      </div>

      <aside className="rounded-2xl border border-border/70 bg-brand-blue-soft p-6 text-brand-deep">
        <p className="eyebrow text-brand-deep/70">What happens next</p>
        <ol className="mt-4 space-y-4 text-sm">
          <StepItem n={1} title="You submit this form">
            Takes about a minute. Nothing is charged yet.
          </StepItem>
          <StepItem n={2} title="You complete payment">
            {packageAccess
              ? "Your package credit confirms this session automatically."
              : "We confirm sessions as soon as payment is made and the booking is done."}
          </StepItem>
          <StepItem n={3} title="You attend your session">
            Clarity Calls run for 15 minutes. Therapy sessions are confirmed by service type, online
            via secure link or in person at our Lagos or Abuja rooms.
          </StepItem>
        </ol>

        <div className="mt-6 rounded-lg bg-white/70 p-4 text-xs text-brand-deep/80">
          <p className="font-semibold text-brand-deep">Booking & rescheduling policy</p>
          <ul className="mt-2 space-y-1.5 list-disc pl-4">
            <li>
              Bookings are allowed within 24 hours of the session time, subject to therapist
              availability.
            </li>
            <li>Rescheduling or cancellation must be done at least 48 hours before the session.</li>
            <li>Requests within 48 hours may be treated as a no-show and are non-refundable.</li>
          </ul>
        </div>

        <div className="mt-4 rounded-lg bg-white/70 p-4 text-xs text-brand-deep/80">
          <p className="font-semibold text-brand-deep">In a crisis?</p>
          <p className="mt-1">
            Talk Space is not an emergency service.{" "}
            <Link to="/emergency-support" className="text-link">
              Get emergency support
            </Link>
            .
          </p>
        </div>
      </aside>
    </form>
  );
}

function ConfirmationCard({
  confirmation,
  services,
  onReset,
  paymentDone,
}: {
  confirmation: Confirmation;
  services: BookingService[];
  onReset: () => void;
  paymentDone:
    | { kind: "paystack_redirected" }
    | { kind: "bank_submitted"; reference: string }
    | { kind: "package_credit"; remainingSessions: number | null }
    | { kind: "skipped" }
    | null;
}) {
  const { appointment, appointments, data } = confirmation;
  const serviceLabel = services.find((service) => service.id === data.serviceId)?.name ?? "Service";
  const bookingReferences = appointments.map((appt) => appt.bookingReference).join(", ");

  const copyRef = async () => {
    try {
      await navigator.clipboard.writeText(bookingReferences);
      toast.success("Reference copied");
    } catch {
      toast.error("Couldn't copy, please copy it manually.");
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
      <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm sm:p-8">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-mint-soft text-brand-mint">
            <CheckCircle2 className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-xl font-semibold text-brand-deep">
              Your request is with our care team
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              We'll email <span className="font-medium text-foreground">{data.email}</span> within
              one working day to confirm.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-border bg-background p-4">
          <p className="eyebrow">
            {appointments.length > 1 ? "Booking references" : "Booking reference"}
          </p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="ref-mono text-lg">{bookingReferences}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={copyRef}
              className="text-brand-deep hover:bg-brand-blue-soft"
            >
              <Copy className="h-4 w-4" />
              Copy
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Keep {appointments.length > 1 ? "these references" : "this reference"} for any follow-up
            messages with our team.
          </p>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          To reschedule or cancel later, use the manage link in your confirmation email (opens{" "}
          <Link
            to="/manage/$reference"
            params={{ reference: appointment.bookingReference }}
            className="text-link"
          >
            the manage page
          </Link>
          ).
        </p>

        {paymentDone?.kind === "bank_submitted" ? (
          <div className="mt-4 rounded-lg border border-brand-blue/40 bg-brand-blue-soft/60 p-4 text-sm text-brand-deep">
            Bank transfer submitted with reference{" "}
            <span className="ref-mono">{paymentDone.reference}</span>. We'll confirm your session
            once the transfer is verified.
          </div>
        ) : paymentDone?.kind === "package_credit" ? (
          <div className="mt-4 rounded-lg border border-brand-mint/40 bg-brand-mint-soft p-4 text-sm text-brand-deep">
            This session was confirmed from your package.
            {paymentDone.remainingSessions != null
              ? ` You have ${paymentDone.remainingSessions} session(s) remaining.`
              : ""}
          </div>
        ) : paymentDone?.kind === "skipped" ? (
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            You skipped payment. Your slot is held briefly — we'll email you payment instructions.
          </div>
        ) : null}

        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <SummaryRow label="Name" value={data.fullName} />
          <SummaryRow label="Phone" value={data.phone} />
          <SummaryRow label="Service" value={serviceLabel} />
          <SummaryRow label="Mode" value={data.mode === "online" ? "Online" : "In-person"} />
          <SummaryRow label="Preferred date" value={data.preferredDate ?? ""} />
          <SummaryRow
            label={appointments.length > 1 ? "Selected sessions" : "Preferred time"}
            value={appointments
              .map((appt) =>
                new Intl.DateTimeFormat("en-NG", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "Africa/Lagos",
                }).format(new Date(appt.startsAt)),
              )
              .join("; ")}
          />
          {data.notes ? (
            <SummaryRow label="Notes" value={data.notes} className="sm:col-span-2" />
          ) : null}
        </dl>

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button asChild variant="outline" className="border-brand-deep/20 text-brand-deep">
            <Link to="/">Back to home</Link>
          </Button>
          <Button
            type="button"
            onClick={onReset}
            className="bg-brand-deep text-white hover:bg-brand-deep/90"
          >
            Book another session
          </Button>
        </div>
      </div>

      <aside className="rounded-2xl border border-border/70 bg-brand-blue-soft p-6 text-brand-deep">
        <p className="eyebrow text-brand-deep/70">Good to know</p>
        <ul className="mt-4 space-y-3 text-sm">
          <li>
            Clarity Calls run 15 minutes. Therapy sessions typically run 50 to 90 minutes depending
            on service type.
          </li>
          <li>
            No payment is taken at this stage, you'll receive payment details after your session is
            scheduled.
          </li>
          <li>
            Need to reach us sooner? Email{" "}
            <a href="mailto:hello@talkspace.ng" className="text-link">
              hello@talkspace.ng
            </a>
            .
          </li>
        </ul>

        <FirstTimeAssessmentLinks className="mt-6" />

        <div className="mt-6 rounded-lg bg-white/70 p-4 text-xs text-brand-deep/80">
          <p className="font-semibold text-brand-deep">Booking & rescheduling policy</p>
          <ul className="mt-2 space-y-1.5 list-disc pl-4">
            <li>
              Bookings are allowed within 24 hours of the session time, subject to therapist
              availability.
            </li>
            <li>Rescheduling or cancellation must be done at least 48 hours before the session.</li>
            <li>Requests within 48 hours may be treated as a no-show and are non-refundable.</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}

/* ---------- small presentational helpers ---------- */

function FieldGroup({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset className="mt-2 first:mt-0 border-t border-border/60 pt-6 first:border-t-0 first:pt-0">
      <legend className="eyebrow float-left pr-3">{legend}</legend>
      <div className="clear-both mt-4">{children}</div>
    </fieldset>
  );
}

function Field({
  label,
  htmlFor,
  error,
  required,
  className,
  helper,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  required?: boolean;
  className?: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-sm font-medium text-brand-deep">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </Label>
      {children}
      {helper ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ModeOption({
  id,
  value,
  label,
  checked,
  disabled = false,
}: {
  id: string;
  value: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
}) {
  return (
    <Label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2.5 text-sm transition-colors",
        disabled && "cursor-not-allowed opacity-70",
        checked
          ? "border-brand-blue bg-brand-blue-soft text-brand-deep"
          : "border-input bg-background hover:bg-muted",
      )}
    >
      <RadioGroupItem id={id} value={value} disabled={disabled} />
      <span>{label}</span>
    </Label>
  );
}

function StepItem({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="ref-mono grid h-6 w-6 flex-none place-items-center rounded-full bg-white text-xs text-brand-deep">
        {n}
      </span>
      <div>
        <p className="font-medium text-brand-deep">{title}</p>
        <p className="text-brand-deep/70">{children}</p>
      </div>
    </li>
  );
}

function SummaryRow({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="eyebrow text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm text-foreground break-words">{value}</dd>
    </div>
  );
}

function formatNaira(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(value);
}

function getServicePrice(service: BookingService | undefined, mode: BookingInput["mode"]) {
  if (!service) return null;
  if (mode === "in_person" && service.inPersonPriceNgn != null) return service.inPersonPriceNgn;
  return service.priceNgn;
}

function HoldCountdown({ expiresAt, now }: { expiresAt: string; now: number }) {
  const target = useMemo(() => new Date(expiresAt).getTime(), [expiresAt]);
  const remainingMs = Math.max(0, target - now);
  const total = 5 * 60 * 1000;
  const pct = Math.max(0, Math.min(100, (remainingMs / total) * 100));
  const minutes = Math.floor(remainingMs / 60000);
  const seconds = Math.floor((remainingMs % 60000) / 1000);
  const expired = remainingMs <= 0;
  const urgent = !expired && remainingMs <= 2 * 60 * 1000;
  const timerText = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return (
    <div
      className={cn(
        "mt-6 rounded-2xl border p-4 shadow-sm sm:p-5",
        expired && "border-danger/40 bg-danger/5 text-danger",
        urgent && "border-amber-400 bg-amber-50 text-amber-950",
        !expired && !urgent && "border-brand-blue/30 bg-brand-blue-soft/50 text-brand-deep",
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "grid h-10 w-10 shrink-0 place-items-center rounded-full",
              expired && "bg-danger/10",
              urgent && "bg-amber-100",
              !expired && !urgent && "bg-white/75",
            )}
            aria-hidden
          >
            <Clock className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em]">
              {expired ? "Hold expired" : "Time left to complete payment"}
            </p>
            <p className="mt-1 text-sm font-medium">
              {expired
                ? "Please choose a new time to continue."
                : urgent
                  ? "Complete payment now so this slot stays yours."
                  : "Your slot is held while you finish payment."}
            </p>
          </div>
        </div>
        {!expired ? (
          <span
            className={cn(
              "rounded-xl border bg-white px-4 py-2 font-mono text-3xl font-black leading-none tracking-[0.04em] shadow-sm sm:text-4xl",
              urgent ? "border-amber-300 text-amber-950" : "border-brand-blue/20 text-brand-deep",
            )}
            aria-label={`${minutes} minutes and ${seconds} seconds remaining`}
          >
            {timerText}
          </span>
        ) : null}
      </div>
      {!expired ? <Progress value={pct} className="mt-4 h-2.5 rounded-full" /> : null}
    </div>
  );
}

function PaymentStep({
  confirmation,
  services,
  options,
  onSkip,
  onBankSubmitted,
  onPaystackRedirect,
}: {
  confirmation: Confirmation;
  services: BookingService[];
  options: PublicPaymentOptions;
  onSkip: () => void;
  onBankSubmitted: (reference: string) => void;
  onPaystackRedirect: () => void;
}) {
  const service = services.find((s) => s.id === confirmation.data.serviceId);
  const price = getServicePrice(service, confirmation.data.mode);
  const sessionCount = confirmation.appointments.length;
  const totalPrice = price == null ? null : price * sessionCount;
  const bookingReferences = confirmation.appointments
    .map((appointment) => appointment.bookingReference)
    .join(", ");
  const [method, setMethod] = useState<"paystack" | "bank">(
    options.isPaystackEnabled ? "paystack" : "bank",
  );
  const [paystackBusy, setPaystackBusy] = useState(false);
  const [bankNote, setBankNote] = useState("");
  // Optional transfer reference from customer's bank (helps admin match transfers)
  const [transferReference, setTransferReference] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [bankBusy, setBankBusy] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [uploadPhase, setUploadPhase] = useState<"idle" | "uploading" | "submitting">("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const expiresAt = confirmation.appointments.reduce(
    (earliest, appointment) =>
      Date.parse(appointment.holdExpiresAt) < Date.parse(earliest)
        ? appointment.holdExpiresAt
        : earliest,
    confirmation.appointment.holdExpiresAt,
  );
  const { now, expired } = useCheckoutClock(expiresAt, confirmation.serverNow);

  const readFileAsBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onprogress = (evt) => {
        if (evt.lengthComputable) {
          // Cap at 90% — the final 10% is the server upload.
          setUploadProgress(Math.round((evt.loaded / evt.total) * 90));
        }
      };
      reader.onerror = () => reject(new Error("Couldn't read the file. Please try again."));
      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== "string") {
          reject(new Error("Couldn't read the file. Please try again."));
          return;
        }
        const comma = result.indexOf(",");
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.readAsDataURL(file);
    });

  const startPaystack = async () => {
    if (expired) {
      toast.error("Checkout expired. Start a new booking; do not pay again if you already paid.");
      return;
    }
    setPaystackBusy(true);
    try {
      const res = await initPaystackPayment({
        data: {
          appointmentId: sessionCount === 1 ? confirmation.appointment.id : undefined,
          appointmentIds:
            sessionCount > 1
              ? confirmation.appointments.map((appointment) => appointment.id)
              : undefined,
          manageTokens:
            sessionCount > 1
              ? confirmation.appointments.map((appointment) => ({
                  appointmentId: appointment.id,
                  manageToken: appointment.manageToken,
                }))
              : undefined,
          manageToken: confirmation.appointment.manageToken,
        },
      });
      onPaystackRedirect();
      window.location.assign(res.authorizationUrl);
    } catch (err) {
      const message = getActionErrorMessage(err, "Couldn't start payment.");
      console.error("[booking] Paystack initialization failed:", err);
      setPaymentError(message);
      setPaystackBusy(false);
    }
  };

  const submitBank = async () => {
    if (expired) {
      toast.error("Checkout expired. Contact support if you already transferred money.");
      return;
    }
    setBankBusy(true);
    setUploadError(null);
    try {
      let receiptPath: string | undefined;
      if (receiptFile) {
        setUploadPhase("uploading");
        setUploadProgress(0);
        try {
          const fileBase64 = await readFileAsBase64(receiptFile);
          const uploaded = await uploadReceiptWithToken({
            data: {
              appointmentId: confirmation.appointment.id,
              manageToken: confirmation.appointment.manageToken,
              filename: receiptFile.name,
              contentType: receiptFile.type || "application/octet-stream",
              fileBase64,
            },
          });
          receiptPath = uploaded.path;
          setUploadProgress(100);
        } catch (err) {
          const msg =
            err instanceof Error
              ? err.message
              : "Couldn't upload receipt. You can send it later by email.";
          setUploadError(msg);
          setUploadPhase("idle");
          setBankBusy(false);
          return;
        }
      }
      setUploadPhase("submitting");
      const transferReferenceValue = transferReference.trim();
      if (!transferReferenceValue) {
        setUploadError("Enter your bank transfer reference before submitting.");
        toast.error("Enter your bank transfer reference before submitting.");
        return;
      }
      const groupedManageTokens =
        sessionCount > 1
          ? confirmation.appointments.map((appointment) => ({
              appointmentId: appointment.id,
              manageToken: appointment.manageToken,
            }))
          : undefined;
      const singleManageToken = confirmation.appointment.manageToken;
      if (!singleManageToken || groupedManageTokens?.some((item) => !item.manageToken)) {
        setUploadError("This checkout is missing a booking access token. Start again.");
        toast.error("This checkout is missing a booking access token. Start again.");
        return;
      }
      const res = await submitBankTransfer({
        data: {
          appointmentId: sessionCount === 1 ? confirmation.appointment.id : undefined,
          appointmentIds:
            sessionCount > 1
              ? confirmation.appointments.map((appointment) => appointment.id)
              : undefined,
          manageTokens: groupedManageTokens?.map((item) => ({
            appointmentId: item.appointmentId,
            manageToken: item.manageToken!,
          })),
          manageToken: singleManageToken,
          transferNote: bankNote.trim() || undefined,
          transferReference: transferReferenceValue,
          receiptPath,
        },
      });
      onBankSubmitted(res.reference);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Couldn't submit transfer.";
      setUploadError(msg);
      toast.error(msg);
    } finally {
      setBankBusy(false);
      setUploadPhase("idle");
    }
  };

  const noProviders = !options.isPaystackEnabled && !options.isBankTransferEnabled;

  return (
    <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
      <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow">
              {sessionCount > 1 ? "Booking references" : "Booking reference"}
            </p>
            <p className="ref-mono mt-1 text-lg text-brand-deep">{bookingReferences}</p>
          </div>
          <div className="text-right">
            <p className="eyebrow">Amount</p>
            <p className="mt-1 text-lg font-semibold text-brand-deep">
              {totalPrice != null ? formatNaira(totalPrice) : "Contact us"}
            </p>
            {sessionCount > 1 && price != null ? (
              <p className="text-xs text-muted-foreground">
                {sessionCount} sessions at {formatNaira(price)}
              </p>
            ) : null}
          </div>
        </div>

        <HoldCountdown expiresAt={expiresAt} now={now} />
        {expired ? (
          <p className="mt-3 text-sm text-destructive">
            This checkout is closed.{" "}
            <a className="underline" href="/book" onClick={clearCheckoutSession}>
              Start a new booking
            </a>
            . If you already paid, contact hello@talkspace.ng with your payment reference before
            paying again.
          </p>
        ) : null}

        {noProviders ? (
          <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            Online payment isn't set up yet. Our team will email you payment instructions shortly.
            <div className="mt-3">
              <Button onClick={onSkip} className="bg-brand-deep text-white">
                Continue
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <RadioGroup
              value={method}
              onValueChange={(v) => setMethod(v as "paystack" | "bank")}
              className="grid gap-2 sm:grid-cols-2"
            >
              {options.isPaystackEnabled ? (
                <Label
                  htmlFor="pm-paystack"
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors",
                    method === "paystack"
                      ? "border-brand-blue bg-brand-blue-soft text-brand-deep"
                      : "border-input bg-background hover:bg-muted",
                  )}
                >
                  <RadioGroupItem id="pm-paystack" value="paystack" />
                  <CreditCard className="h-4 w-4" />
                  <span className="font-medium">Card / Bank via Paystack</span>
                </Label>
              ) : null}
              {options.isBankTransferEnabled ? (
                <Label
                  htmlFor="pm-bank"
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors",
                    method === "bank"
                      ? "border-brand-blue bg-brand-blue-soft text-brand-deep"
                      : "border-input bg-background hover:bg-muted",
                  )}
                >
                  <RadioGroupItem id="pm-bank" value="bank" />
                  <Landmark className="h-4 w-4" />
                  <span className="font-medium">Bank transfer</span>
                </Label>
              ) : null}
            </RadioGroup>

            {method === "paystack" && options.isPaystackEnabled ? (
              <div className="rounded-lg border border-border bg-background p-4 text-sm">
                <p className="text-muted-foreground">
                  You'll be redirected to Paystack's secure checkout to complete payment. We'll
                  bring you back to confirm once you're done.
                </p>
                <Button
                  type="button"
                  onClick={startPaystack}
                  disabled={expired || paystackBusy || price == null}
                  className="mt-4 bg-brand-deep text-white hover:bg-brand-deep/90"
                >
                  {paystackBusy ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Redirecting…
                    </>
                  ) : (
                    <>
                      <CreditCard className="mr-2 h-4 w-4" />
                      Pay {totalPrice != null ? formatNaira(totalPrice) : ""} with Paystack
                    </>
                  )}
                </Button>
              </div>
            ) : null}

            {method === "bank" && options.isBankTransferEnabled ? (
              <div className="space-y-4 rounded-lg border border-border bg-background p-4 text-sm">
                <div className="grid gap-2 rounded-md bg-muted/60 p-3 text-sm">
                  {options.bankName ? <SummaryRow label="Bank" value={options.bankName} /> : null}
                  {options.bankAccountName ? (
                    <SummaryRow label="Account name" value={options.bankAccountName} />
                  ) : null}
                  {options.bankAccountNumber ? (
                    <SummaryRow label="Account number" value={options.bankAccountNumber} />
                  ) : null}
                  {options.bankInstructions ? (
                    <SummaryRow label="Instructions" value={options.bankInstructions} />
                  ) : null}
                  <SummaryRow label="Use as narration" value={bookingReferences} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank-note">Note (optional)</Label>
                  <Textarea
                    id="bank-note"
                    rows={3}
                    maxLength={500}
                    value={bankNote}
                    onChange={(e) => setBankNote(e.target.value)}
                    placeholder="Sender name or transfer time if different from your account details."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bank-ref">Transfer reference</Label>
                  <Input
                    id="bank-ref"
                    type="text"
                    value={transferReference}
                    onChange={(e) => setTransferReference(e.target.value)}
                    placeholder="Reference/transaction ID from your bank (helps admin match your transfer)"
                    maxLength={200}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Paste the reference or transaction ID provided by your bank. Using the booking
                    reference as the narration helps automatic matching.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="receipt">Receipt (optional)</Label>
                  <Input
                    id="receipt"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/heic,application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      if (!file) {
                        setReceiptFile(null);
                        setUploadError(null);
                        return;
                      }
                      const allowed = [
                        "image/png",
                        "image/jpeg",
                        "image/webp",
                        "image/heic",
                        "application/pdf",
                      ];
                      const MAX = 5 * 1024 * 1024;
                      if (!allowed.includes(file.type)) {
                        toast.error("Receipt must be a PNG, JPG, WEBP, HEIC, or PDF.");
                        e.target.value = "";
                        setReceiptFile(null);
                        return;
                      }
                      if (file.size > MAX) {
                        toast.error("Receipt must be 5 MB or smaller.");
                        e.target.value = "";
                        setReceiptFile(null);
                        return;
                      }
                      setUploadError(null);
                      setReceiptFile(file);
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    PNG, JPG, WEBP, HEIC, or PDF, up to 5 MB.
                  </p>
                </div>
                {uploadPhase !== "idle" && receiptFile ? (
                  <div className="space-y-2 rounded-md border border-border/70 bg-muted/40 p-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-medium text-brand-deep">
                        {uploadPhase === "uploading"
                          ? `Uploading ${receiptFile.name}…`
                          : "Finalizing your transfer…"}
                      </span>
                      <span>{uploadPhase === "uploading" ? `${uploadProgress}%` : ""}</span>
                    </div>
                    <Progress value={uploadPhase === "uploading" ? uploadProgress : 100} />
                  </div>
                ) : null}
                {uploadError ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Receipt upload didn't go through</AlertTitle>
                    <AlertDescription className="space-y-2">
                      <p>{uploadError}</p>
                      <p className="text-xs">
                        You can try again, or click "I've made the transfer" without a receipt and
                        email it to us later — we'll match it to your booking reference.
                      </p>
                    </AlertDescription>
                  </Alert>
                ) : null}
                <Button
                  type="button"
                  onClick={submitBank}
                  disabled={expired || bankBusy}
                  className="bg-brand-deep text-white hover:bg-brand-deep/90"
                >
                  {bankBusy ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {uploadPhase === "uploading"
                        ? `Uploading receipt… ${uploadProgress}%`
                        : "Submitting…"}
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      I've made the transfer
                    </>
                  )}
                </Button>
              </div>
            ) : null}

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  if (expired) {
                    toast.error("This checkout has expired. Start a new booking to continue.");
                    return;
                  }
                  onSkip();
                }}
                disabled={expired || paystackBusy || bankBusy}
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-brand-deep"
              >
                I'll pay later
              </button>
            </div>
          </div>
        )}
      </div>

      <aside className="rounded-2xl border border-border/70 bg-brand-blue-soft p-6 text-brand-deep">
        <p className="eyebrow text-brand-deep/70">Held for you</p>
        <p className="mt-3 text-sm">
          {sessionCount > 1 ? "Your selected slots are" : "Your slot is"} held briefly. Complete
          payment to confirm {sessionCount > 1 ? "these sessions" : "your session"}; otherwise{" "}
          {sessionCount > 1 ? "they" : "the slot"} will be released for another client.
        </p>
        <div className="mt-4 rounded-lg bg-white/70 p-4 text-xs text-brand-deep/80">
          <p className="font-semibold text-brand-deep">Need help?</p>
          <p className="mt-1">
            Email{" "}
            <a className="text-link" href="mailto:hello@talkspace.ng">
              hello@talkspace.ng
            </a>{" "}
            with your booking reference.
          </p>
        </div>
      </aside>

      <Dialog open={Boolean(paymentError)} onOpenChange={(open) => !open && setPaymentError(null)}>
        <DialogContent className="max-w-xl border-danger/30 p-8 sm:p-10">
          <DialogHeader className="text-left">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger">
              <AlertCircle className="h-6 w-6" aria-hidden />
            </div>
            <DialogTitle className="text-2xl text-brand-deep">Payment could not start</DialogTitle>
            <DialogDescription className="pt-2 text-base leading-7">
              {paymentError}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 sm:justify-start">
            <Button type="button" onClick={() => setPaymentError(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
