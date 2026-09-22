import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { clientPhoneSchema } from "./client-profile.ts";

import { getRequestAuthContext } from "@/lib/server-auth";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  cloneFormTemplates,
  DEFAULT_FORM_TEMPLATES,
  getTemplateVersion,
  normalizeFormTemplates,
  type FormTemplateDefinition,
} from "@/lib/form-templates";

export type ClientSessionMode = "online" | "in_person" | "phone";

export type AdminClientRecord = {
  id: string;
  email: string | null;
  surname: string | null;
  otherNames: string | null;
  fullName: string | null;
  phone: string | null;
  address: string | null;
  dateOfBirth: string | null;
  weddingAnniversaryDate: string | null;
  occupation: string | null;
  recordSource: string;
  preferredMode: ClientSessionMode | null;
  assignedTherapistId: string | null;
  assignedTherapistName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminClientNote = {
  id: string;
  body: string;
  authorId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminClientDetail = AdminClientRecord & {
  notes: AdminClientNote[];
  appointments: AdminClientAppointment[];
  payments: AdminClientPayment[];
  contactSubmissions: AdminClientContactSubmission[];
  intakeSubmissions: AdminClientIntakeSubmission[];
};

export type AdminClientContactSubmission = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  message: string;
  source: string;
  createdAt: string;
  ackSentAt: string | null;
  adminNotifiedAt: string | null;
};

export type AdminClientIntakeSubmission = {
  id: string;
  source: string;
  templateKey: string;
  templateVersion: number;
  subjectName: string | null;
  subjectEmail: string | null;
  payload: Record<string, Json>;
  consentAcknowledgedAt: string | null;
  completedAt: string | null;
  completionState: "draft" | "in_progress" | "completed";
  createdAt: string;
  appointmentId: string | null;
  contactSubmissionId: string | null;
};

const assessmentSubmissionInput = z.object({
  clientId: z.string().uuid(),
  templateKey: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .refine((value) => value.startsWith("assessment_"), {
      message: "Choose an approved assessment template.",
    }),
  subjectName: z.string().trim().max(100).nullable().optional(),
  subjectEmail: z.string().trim().email().max(255).nullable().optional(),
  payload: z.record(z.string(), z.string().max(2000)),
});

export type AdminClientAppointment = {
  id: string;
  bookingReference: string;
  serviceName: string | null;
  therapistName: string | null;
  sessionMode: ClientSessionMode;
  startsAt: string;
  endsAt: string;
  status: string;
  notes: string | null;
};

export type AdminClientPayment = {
  id: string;
  appointmentId: string;
  bookingReference: string | null;
  provider: string;
  reference: string;
  amountKobo: number;
  currency: string;
  status: string;
  createdAt: string;
  verifiedAt: string | null;
  failedReason: string | null;
};

const extendedClientSelect =
  "id, email, surname, other_names, full_name, phone, address, date_of_birth, wedding_anniversary_date, occupation, record_source, preferred_mode, assigned_therapist_id, created_at, updated_at";

const legacyClientSelect =
  "id, full_name, phone, date_of_birth, preferred_mode, assigned_therapist_id, created_at, updated_at";

function isMissingExtendedClientColumnError(error: { message?: string } | null) {
  return Boolean(
    error?.message?.includes("clients") &&
    ["email", "surname", "other_names", "address", "wedding_anniversary_date", "occupation"].some(
      (column) => error.message?.includes(column),
    ),
  );
}

type ClientRowWithCrmFields = {
  id: string;
  email?: string | null;
  surname?: string | null;
  other_names?: string | null;
  full_name: string | null;
  phone: string | null;
  address?: string | null;
  date_of_birth: string | null;
  wedding_anniversary_date?: string | null;
  occupation?: string | null;
  record_source?: string | null;
  preferred_mode: ClientSessionMode | null;
  assigned_therapist_id: string | null;
  created_at: string;
  updated_at: string;
};

function mapClientRecord(
  client: ClientRowWithCrmFields,
  therapistNames: Map<string, string>,
): AdminClientRecord {
  return {
    id: client.id,
    email: client.email ?? null,
    surname: client.surname ?? null,
    otherNames: client.other_names ?? null,
    fullName: client.full_name,
    phone: client.phone,
    address: client.address ?? null,
    dateOfBirth: client.date_of_birth,
    weddingAnniversaryDate: client.wedding_anniversary_date ?? null,
    occupation: client.occupation ?? null,
    recordSource: client.record_source ?? "platform",
    preferredMode: client.preferred_mode,
    assignedTherapistId: client.assigned_therapist_id,
    assignedTherapistName: client.assigned_therapist_id
      ? (therapistNames.get(client.assigned_therapist_id) ?? null)
      : null,
    createdAt: client.created_at,
    updatedAt: client.updated_at,
  };
}

export function getClientContactCompletionState({
  fullName,
  email,
  phone,
}: {
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
}) {
  const trimmedName = String(fullName ?? "").trim();
  const trimmedEmail = String(email ?? "")
    .trim()
    .toLowerCase();
  const trimmedPhone = String(phone ?? "").trim();
  const missing: Array<"fullName" | "email" | "phone"> = [];
  if (!trimmedName) missing.push("fullName");
  if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) missing.push("email");
  if (!trimmedPhone) missing.push("phone");
  return {
    fullName: trimmedName,
    email: trimmedEmail,
    phone: trimmedPhone,
    missing,
    isComplete: missing.length === 0,
  };
}

async function getAdminClient() {
  const context = await getRequestAuthContext();
  if (!context?.user || !(await context.hasRole("admin"))) return null;
  return context.bag.client;
}

const ADMIN_CLIENT_PAGE_SIZE = 100;

async function loadAdminClientPage(
  client: NonNullable<Awaited<ReturnType<typeof getAdminClient>>>,
  page: number,
  pageSize: number,
) {
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;
  const [
    { data: clients, error: clientsError, count },
    { data: therapists, error: therapistsError },
  ] = await Promise.all([
    client
      .from("clients")
      .select(extendedClientSelect, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(start, end),
    client.from("therapists").select("id, full_name").eq("is_active", true).order("full_name"),
  ]);

  let clientRows = clients as ClientRowWithCrmFields[] | null;
  if (clientsError) {
    if (!isMissingExtendedClientColumnError(clientsError)) throw clientsError;
    const { data: fallbackClients, error: fallbackError } = await client
      .from("clients")
      .select(legacyClientSelect, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(start, end);
    if (fallbackError) throw fallbackError;
    clientRows = fallbackClients as ClientRowWithCrmFields[] | null;
  }
  if (therapistsError) throw therapistsError;

  const therapistNames = new Map(
    (therapists ?? []).map((therapist) => [therapist.id, therapist.full_name]),
  );
  const rows = (clientRows ?? []).map((client) => mapClientRecord(client, therapistNames));
  return { clients: rows, hasMore: start + rows.length < (count ?? start + rows.length) };
}

export const getAdminClients = createServerFn({ method: "GET" }).handler(async () => {
  const client = await getAdminClient();
  if (!client) return null;

  setResponseHeader("Cache-Control", "private, no-store");
  return (await loadAdminClientPage(client, 1, ADMIN_CLIENT_PAGE_SIZE)).clients;
});

export const getAdminClientsPage = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ page: z.number().int().min(1).max(1000) }).parse(data),
  )
  .handler(async ({ data }) => {
    const client = await getAdminClient();
    if (!client) return null;
    setResponseHeader("Cache-Control", "private, no-store");
    return loadAdminClientPage(client, data.page, ADMIN_CLIENT_PAGE_SIZE);
  });

async function loadAdminClientDetail(
  client: Awaited<ReturnType<typeof getAdminClient>>,
  clientId: string,
) {
  const data = { clientId };
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      data.clientId,
    )
  ) {
    return null;
  }

  if (!client) return null;

  setResponseHeader("Cache-Control", "private, no-store");

  const { data: authUser, error: authUserError } = await client.auth.admin.getUserById(
    data.clientId,
  );
  if (authUserError) throw authUserError;
  const clientEmail = authUser.user?.email?.toLowerCase() ?? null;

  const { data: clientRecord, error: clientError } = await client
    .from("clients")
    .select(extendedClientSelect)
    .eq("id", data.clientId)
    .maybeSingle();

  let clientProfile = clientRecord as ClientRowWithCrmFields | null;
  if (clientError) {
    if (!isMissingExtendedClientColumnError(clientError)) throw clientError;
    const { data: fallbackRecord, error: fallbackError } = await client
      .from("clients")
      .select(legacyClientSelect)
      .eq("id", data.clientId)
      .maybeSingle();
    if (fallbackError) throw fallbackError;
    clientProfile = fallbackRecord as ClientRowWithCrmFields | null;
  }
  if (!clientProfile) return null;

  const therapistQuery = clientProfile.assigned_therapist_id
    ? client
        .from("therapists")
        .select("id, full_name")
        .eq("id", clientProfile.assigned_therapist_id)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null });

  const [
    { data: therapist, error: therapistError },
    { data: notes, error: notesError },
    { data: appointments, error: appointmentsError },
    { data: intakeSubmissions, error: intakeSubmissionsError },
  ] = await Promise.all([
    therapistQuery,
    client
      .from("client_notes")
      .select("id, body, author_id, created_at, updated_at")
      .eq("client_id", data.clientId)
      .order("created_at", { ascending: false }),
    client
      .from("appointments")
      .select(
        "id, booking_reference, session_mode, starts_at, ends_at, status, notes, service_id, therapist_id, client_email",
      )
      .eq("client_id", data.clientId)
      .order("starts_at", { ascending: false }),
    client
      .from("intake_submissions")
      .select(
        "id, source, template_key, template_version, subject_name, subject_email, payload, consent_acknowledged_at, completed_at, completion_state, created_at, appointment_id, contact_submission_id",
      )
      .eq("client_id", data.clientId)
      .order("created_at", { ascending: false }),
  ]);

  if (therapistError) throw therapistError;
  if (notesError) throw notesError;
  if (appointmentsError) throw appointmentsError;
  if (intakeSubmissionsError) throw intakeSubmissionsError;

  const contactSubmissionQueries = [];
  if (clientEmail) {
    contactSubmissionQueries.push(
      client
        .from("contact_submissions")
        .select(
          "id, full_name, email, phone, message, source, created_at, ack_sent_at, admin_notified_at",
        )
        .eq("email", clientEmail)
        .order("created_at", { ascending: false }),
    );
  }
  if (clientProfile.phone) {
    contactSubmissionQueries.push(
      client
        .from("contact_submissions")
        .select(
          "id, full_name, email, phone, message, source, created_at, ack_sent_at, admin_notified_at",
        )
        .eq("phone", clientProfile.phone)
        .order("created_at", { ascending: false }),
    );
  }

  const submissionResults = contactSubmissionQueries.length
    ? await Promise.all(contactSubmissionQueries)
    : [];
  const contactSubmissionsError = submissionResults.find((result) => result.error)?.error ?? null;
  if (contactSubmissionsError) throw contactSubmissionsError;
  const contactSubmissions = [
    ...new Map(
      submissionResults
        .flatMap((result) => result.data ?? [])
        .map((submission) => [submission.id, submission]),
    ).values(),
  ];

  const serviceIds = [
    ...new Set((appointments ?? []).map((appointment) => appointment.service_id)),
  ];
  const therapistIds = [
    ...new Set((appointments ?? []).map((appointment) => appointment.therapist_id)),
  ];
  const [
    { data: services, error: servicesError },
    { data: appointmentTherapists, error: therapistsError },
    { data: payments, error: paymentsError },
  ] = await Promise.all([
    serviceIds.length
      ? client.from("services").select("id, name").in("id", serviceIds)
      : Promise.resolve({ data: [], error: null }),
    therapistIds.length
      ? client.from("therapists").select("id, full_name").in("id", therapistIds)
      : Promise.resolve({ data: [], error: null }),
    appointments?.length
      ? client
          .from("payments")
          .select(
            "id, appointment_id, provider, reference, amount_kobo, currency, status, created_at, verified_at, failed_reason",
          )
          .in(
            "appointment_id",
            appointments.map((appointment) => appointment.id),
          )
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (servicesError) throw servicesError;
  if (therapistsError) throw therapistsError;
  if (paymentsError) throw paymentsError;

  const serviceNames = new Map((services ?? []).map((service) => [service.id, service.name]));
  const appointmentTherapistNames = new Map(
    (appointmentTherapists ?? []).map((appointmentTherapist) => [
      appointmentTherapist.id,
      appointmentTherapist.full_name,
    ]),
  );
  const bookingReferences = new Map(
    (appointments ?? []).map((appointment) => [appointment.id, appointment.booking_reference]),
  );

  return {
    id: clientProfile.id,
    email: clientProfile.email ?? clientEmail,
    surname: clientProfile.surname ?? null,
    otherNames: clientProfile.other_names ?? null,
    fullName: clientProfile.full_name,
    phone: clientProfile.phone,
    address: clientProfile.address ?? null,
    dateOfBirth: clientProfile.date_of_birth,
    weddingAnniversaryDate: clientProfile.wedding_anniversary_date ?? null,
    occupation: clientProfile.occupation ?? null,
    recordSource: clientProfile.record_source ?? "platform",
    preferredMode: clientProfile.preferred_mode,
    assignedTherapistId: clientProfile.assigned_therapist_id,
    assignedTherapistName: therapist?.full_name ?? null,
    createdAt: clientProfile.created_at,
    updatedAt: clientProfile.updated_at,
    notes: (notes ?? []).map((note): AdminClientNote => ({
      id: note.id,
      body: note.body,
      authorId: note.author_id,
      createdAt: note.created_at,
      updatedAt: note.updated_at,
    })),
    appointments: (appointments ?? []).map((appointment) => ({
      id: appointment.id,
      bookingReference: appointment.booking_reference,
      serviceName: serviceNames.get(appointment.service_id) ?? null,
      therapistName: appointmentTherapistNames.get(appointment.therapist_id) ?? null,
      sessionMode: appointment.session_mode,
      startsAt: appointment.starts_at,
      endsAt: appointment.ends_at,
      status: appointment.status,
      notes: appointment.notes,
    })),
    payments: (payments ?? []).map((payment) => ({
      id: payment.id,
      appointmentId: payment.appointment_id,
      bookingReference: bookingReferences.get(payment.appointment_id) ?? null,
      provider: payment.provider,
      reference: payment.reference,
      amountKobo: Number(payment.amount_kobo),
      currency: payment.currency,
      status: payment.status,
      createdAt: payment.created_at,
      verifiedAt: payment.verified_at,
      failedReason: payment.failed_reason,
    })),
    contactSubmissions: contactSubmissions.map((submission) => ({
      id: submission.id,
      fullName: submission.full_name,
      email: submission.email,
      phone: submission.phone,
      message: submission.message,
      source: submission.source,
      createdAt: submission.created_at,
      ackSentAt: submission.ack_sent_at,
      adminNotifiedAt: submission.admin_notified_at,
    })),
    intakeSubmissions: (intakeSubmissions ?? []).map((submission) => ({
      id: submission.id,
      source: submission.source,
      templateKey: submission.template_key,
      templateVersion: submission.template_version,
      subjectName: submission.subject_name,
      subjectEmail: submission.subject_email,
      payload:
        submission.payload && typeof submission.payload === "object"
          ? (submission.payload as Record<string, Json>)
          : {},
      consentAcknowledgedAt: submission.consent_acknowledged_at,
      completedAt: submission.completed_at,
      completionState:
        submission.completion_state === "draft" ||
        submission.completion_state === "in_progress" ||
        submission.completion_state === "completed"
          ? submission.completion_state
          : submission.completed_at
            ? "completed"
            : "draft",
      createdAt: submission.created_at,
      appointmentId: submission.appointment_id,
      contactSubmissionId: submission.contact_submission_id,
    })),
  } satisfies AdminClientDetail;
}

export const getAdminClientDetail = createServerFn({ method: "GET" })
  .validator((data: { clientId: string }) => data)
  .handler(async ({ data }) => loadAdminClientDetail(await getAdminClient(), data.clientId));

export type AdminClientDetailWorkspace = {
  client: AdminClientDetail | null;
  assessmentTemplates: FormTemplateDefinition[];
  therapists: Array<{ id: string; fullName: string }>;
};

export const getAdminClientDetailWorkspace = createServerFn({ method: "GET" })
  .validator((data: { clientId: string }) => data)
  .handler(async ({ data }): Promise<AdminClientDetailWorkspace> => {
    const client = await getAdminClient();
    if (!client) return { client: null, assessmentTemplates: [], therapists: [] };

    const [detail, templateResult, therapistsResult] = await Promise.all([
      loadAdminClientDetail(client, data.clientId),
      client.from("site_settings").select("value").eq("key", "form_templates").maybeSingle(),
      client.from("therapists").select("id, full_name").eq("is_active", true).order("full_name"),
    ]);
    if (templateResult.error) throw templateResult.error;
    if (therapistsResult.error) throw therapistsResult.error;
    return {
      client: detail,
      assessmentTemplates: normalizeFormTemplates(
        templateResult.data?.value ?? cloneFormTemplates(DEFAULT_FORM_TEMPLATES),
      ),
      therapists: (therapistsResult.data ?? []).map((therapist) => ({
        id: therapist.id,
        fullName: therapist.full_name,
      })),
    };
  });

export const createAdminAssessmentSubmission = createServerFn({ method: "POST" })
  .validator((data: z.infer<typeof assessmentSubmissionInput>) =>
    assessmentSubmissionInput.parse(data),
  )
  .handler(async ({ data }) => {
    const client = await getAdminClient();
    if (!client) throw new Error("Admin permission required.");

    const { error } = await client.from("intake_submissions").insert({
      source: "assessment",
      template_key: data.templateKey,
      template_version: getTemplateVersion(data.templateKey),
      client_id: data.clientId,
      subject_name: data.subjectName ?? null,
      subject_email: data.subjectEmail ?? null,
      payload: {
        ...data.payload,
        meta: {
          source: "admin_assessment_capture",
          capturedAt: new Date().toISOString(),
        },
      },
      completion_state: "completed",
      completed_at: new Date().toISOString(),
    });

    if (error) throw error;
    return { ok: true };
  });

const clientUpdateInput = z.object({
  clientId: z.string().uuid(),
  surname: z.string().trim().max(100).nullable().optional(),
  otherNames: z.string().trim().max(150).nullable().optional(),
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  phone: clientPhoneSchema,
  address: z.string().trim().max(500).nullable().optional(),
  dateOfBirth: z.string().trim().max(10).nullable().optional(),
  weddingAnniversaryDate: z.string().trim().max(10).nullable().optional(),
  occupation: z.string().trim().max(150).nullable().optional(),
  preferredMode: z.enum(["online", "in_person", "phone"]).nullable().optional(),
  assignedTherapistId: z.string().uuid().nullable().optional(),
});

export const updateAdminClient = createServerFn({ method: "POST" })
  .validator((data: z.infer<typeof clientUpdateInput>) => clientUpdateInput.parse(data))
  .handler(async ({ data }) => {
    const client = await getAdminClient();
    if (!client) throw new Error("Admin permission required.");
    // Ensure required fields are present
    if (!data.fullName || !data.email || !data.phone)
      throw new Error("Full name, email and phone are required.");

    if (data.assignedTherapistId) {
      const { data: therapist, error: therapistError } = await client
        .from("therapists")
        .select("id, is_active")
        .eq("id", data.assignedTherapistId)
        .maybeSingle();
      if (therapistError) throw therapistError;
      if (!therapist?.is_active) {
        throw new Error("Choose an active therapist or leave the client unassigned.");
      }
    }

    const { error } = await client
      .from("clients")
      .update({
        surname: data.surname || null,
        other_names: data.otherNames || null,
        full_name: data.fullName || null,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
        date_of_birth: data.dateOfBirth || null,
        wedding_anniversary_date: data.weddingAnniversaryDate || null,
        occupation: data.occupation || null,
        preferred_mode: data.preferredMode,
        assigned_therapist_id: data.assignedTherapistId,
      })
      .eq("id", data.clientId);
    if (error) throw error;
    return { ok: true };
  });

const legacyClientInput = z.object({
  surname: z.string().trim().min(1, "Surname is required.").max(100),
  otherNames: z.string().trim().min(1, "Other names are required.").max(150),
  email: z.string().trim().email("Enter a valid email address.").max(255),
  phone: clientPhoneSchema,
  address: z.string().trim().max(500).nullable(),
  birthday: z.string().trim().max(10).nullable(),
  weddingAnniversaryDate: z.string().trim().max(10).nullable(),
  occupation: z.string().trim().max(150).nullable(),
});

export const createAdminLegacyClient = createServerFn({ method: "POST" })
  .validator((data: z.infer<typeof legacyClientInput>) => legacyClientInput.parse(data))
  .handler(async ({ data }) => {
    const client = await getAdminClient();
    if (!client) throw new Error("Admin permission required.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase();
    const fullName = [data.surname, data.otherNames].filter(Boolean).join(" ");

    const { data: existingClient, error: existingError } = await supabaseAdmin
      .from("clients")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existingClient) throw new Error("A client with this email already exists.");

    const { data: createdUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser(
      {
        email,
        email_confirm: true,
        user_metadata: { full_name: fullName, source: "admin_legacy_client" },
      },
    );
    if (createUserError) throw createUserError;
    const userId = createdUser.user?.id;
    if (!userId) throw new Error("Could not create client login record.");

    const { data: createdClient, error: insertError } = await supabaseAdmin
      .from("clients")
      .upsert(
        {
          id: userId,
          email,
          surname: data.surname,
          other_names: data.otherNames,
          full_name: fullName,
          phone: data.phone || null,
          address: data.address || null,
          date_of_birth: data.birthday || null,
          wedding_anniversary_date: data.weddingAnniversaryDate || null,
          occupation: data.occupation || null,
          record_source: "admin_legacy",
        },
        { onConflict: "id" },
      )
      .select("id")
      .single();
    if (insertError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw insertError;
    }

    return { ok: true, clientId: createdClient.id };
  });

export const exportAdminClientData = createServerFn({ method: "POST" })
  .validator((data: { clientId: string }) => z.object({ clientId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const detail = await getAdminClientDetail({ data });
    if (!detail) throw new Error("Client not found.");
    const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = [
      [
        "record_type",
        "full_name",
        "email",
        "phone",
        "surname",
        "other_names",
        "address",
        "birthday",
        "wedding_anniversary_date",
        "occupation",
        "preferred_mode",
        "assigned_therapist",
      ],
      [
        "client",
        detail.fullName,
        detail.email,
        detail.phone,
        detail.surname,
        detail.otherNames,
        detail.address,
        detail.dateOfBirth,
        detail.weddingAnniversaryDate,
        detail.occupation,
        detail.preferredMode,
        detail.assignedTherapistName,
      ],
      [
        "record_type",
        "appointment",
        "booking_reference",
        "service",
        "therapist",
        "starts_at",
        "status",
        "notes",
        "",
      ],
      ...detail.appointments.map((appointment) => [
        "appointment",
        "",
        appointment.bookingReference,
        appointment.serviceName,
        appointment.therapistName,
        appointment.startsAt,
        appointment.status,
        appointment.notes,
        "",
      ]),
      [
        "record_type",
        "payment",
        "booking_reference",
        "provider",
        "reference",
        "amount_kobo",
        "currency",
        "status",
        "created_at",
      ],
      ...detail.payments.map((payment) => [
        "payment",
        "",
        payment.bookingReference,
        payment.provider,
        payment.reference,
        payment.amountKobo,
        payment.currency,
        payment.status,
        payment.createdAt,
      ]),
      [
        "record_type",
        "form",
        "source",
        "name",
        "email",
        "phone",
        "status",
        "created_at",
        "message",
      ],
      ...detail.contactSubmissions.map((submission) => [
        "form",
        "",
        submission.source,
        submission.fullName,
        submission.email,
        submission.phone,
        `${submission.adminNotifiedAt ? "notified" : "pending"} / ${submission.ackSentAt ? "acknowledged" : "ack pending"}`,
        submission.createdAt,
        submission.message,
      ]),
    ];
    setResponseHeader("Cache-Control", "private, no-store");
    return {
      filename: `client-${detail.id}.csv`,
      csv: rows.map((row) => row.map(escape).join(",")).join("\n"),
    };
  });

export const exportAllAdminClients = createServerFn({ method: "GET" }).handler(async () => {
  const client = await getAdminClient();
  if (!client) throw new Error("Admin permission required.");
  setResponseHeader("Cache-Control", "private, no-store");
  const { clientProfilesCsv } = await import("./client-csv.ts");
  const rows: ClientRowWithCrmFields[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client
      .from("clients")
      .select(extendedClientSelect)
      .order("id")
      .range(offset, offset + 499);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 500) break;
  }
  return {
    filename: `clients-${new Date().toISOString().slice(0, 10)}.csv`,
    csv: clientProfilesCsv(rows),
  };
});

const clientImportInput = z.object({
  csv: z.string().max(2 * 1024 * 1024),
  confirm: z.boolean().default(false),
  duplicates: z.enum(["skip", "update"]).default("skip"),
});

export const importAdminClients = createServerFn({ method: "POST" })
  .validator((data: z.input<typeof clientImportInput>) => clientImportInput.parse(data))
  .handler(async ({ data }) => {
    const client = await getAdminClient();
    if (!client) throw new Error("Admin permission required.");
    setResponseHeader("Cache-Control", "private, no-store");
    const { parseClientCsv } = await import("./client-csv.ts");
    const parsed = parseClientCsv(data.csv);
    const result = {
      preview: !data.confirm,
      total: parsed.total,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: parsed.errors,
      sample: parsed.profiles.slice(0, 10).map((profile) => profile.values),
    };
    // Validate the entire file before the first write.
    if (parsed.errors.length) return result;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const existing = new Map<string, string>();
    for (let offset = 0; offset < parsed.profiles.length; offset += 200) {
      const emails = parsed.profiles
        .slice(offset, offset + 200)
        .map((profile) => profile.values.email);
      const { data: found, error } = await supabaseAdmin
        .from("clients")
        .select("id, email")
        .in("email", emails);
      if (error) throw error;
      for (const row of found ?? []) {
        if (row.email) existing.set(row.email.toLowerCase(), row.id);
      }
    }
    if (!data.confirm) {
      result.created = parsed.profiles.filter(
        (profile) => !existing.has(profile.values.email),
      ).length;
      result.updated = data.duplicates === "update" ? existing.size : 0;
      result.skipped = data.duplicates === "skip" ? existing.size : 0;
      return result;
    }
    const existingSnapshots = new Map<string, Database["public"]["Tables"]["clients"]["Update"]>();
    if (data.duplicates === "update" && existing.size) {
      const { data: snapshots, error: snapshotError } = await supabaseAdmin
        .from("clients")
        .select(extendedClientSelect)
        .in("id", [...existing.values()]);
      if (snapshotError) throw snapshotError;
      for (const snapshot of snapshots ?? []) {
        existingSnapshots.set(snapshot.id as string, {
          email: snapshot.email,
          surname: snapshot.surname,
          other_names: snapshot.other_names,
          full_name: snapshot.full_name,
          phone: snapshot.phone,
          address: snapshot.address,
          date_of_birth: snapshot.date_of_birth,
          wedding_anniversary_date: snapshot.wedding_anniversary_date,
          occupation: snapshot.occupation,
          record_source: snapshot.record_source,
          preferred_mode: snapshot.preferred_mode,
          assigned_therapist_id: snapshot.assigned_therapist_id,
        });
      }
    }
    // Reuse registered accounts that do not yet have a client profile.
    const users = new Map<string, string>();
    if (parsed.profiles.some((profile) => !existing.has(profile.values.email))) {
      for (let page = 1; ; page++) {
        const { data: batch, error } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage: 1000,
        });
        if (error) throw error;
        for (const user of batch.users)
          if (user.email) users.set(user.email.toLowerCase(), user.id);
        if (batch.users.length < 1000) break;
      }
    }
    const createdUserIds: string[] = [];
    const createdClientIds: string[] = [];
    const rollback = async () => {
      for (const [id, snapshot] of existingSnapshots) {
        const { error } = await supabaseAdmin.from("clients").update(snapshot).eq("id", id);
        if (error) console.error("[clients] import rollback failed for existing client", error);
      }
      if (createdClientIds.length) {
        const { error } = await supabaseAdmin.from("clients").delete().in("id", createdClientIds);
        if (error) console.error("[clients] import rollback failed for new clients", error);
      }
      for (const userId of createdUserIds) {
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (error) console.error("[clients] import rollback failed for auth user", error);
      }
    };

    try {
      for (const profile of parsed.profiles) {
        const existingId = existing.get(profile.values.email);
        if (existingId && data.duplicates === "skip") {
          result.skipped++;
          continue;
        }
        let id = existingId || users.get(profile.values.email);
        if (!id) {
          const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
            email: profile.values.email,
            email_confirm: true,
            user_metadata: { full_name: profile.values.full_name, source: "admin_import" },
          });
          if (error) throw error;
          id = created.user?.id;
          if (id) createdUserIds.push(id);
        }
        if (!id) throw new Error("Could not create client record.");
        const { record_source, ...values } = profile.values;
        const payload = {
          ...values,
          id,
          ...(record_source
            ? { record_source }
            : existingId
              ? {}
              : { record_source: "admin_import" }),
        };
        // Missing optional columns do not erase existing values.
        const { error } = existingId
          ? await supabaseAdmin.from("clients").update(payload).eq("id", id)
          : await supabaseAdmin.from("clients").upsert(payload, { onConflict: "id" });
        if (error) throw error;
        if (!existingId) createdClientIds.push(id);
        existing.set(profile.values.email, id);
        if (existingId) result.updated++;
        else result.created++;
      }
    } catch (error) {
      await rollback();
      result.created = 0;
      result.updated = 0;
      result.skipped = 0;
      result.errors.push({
        row: 0,
        message: error instanceof Error ? error.message : "Import was rolled back.",
      });
    }
    return result;
  });

// Provide legacy-compatible export name used by admin UI
export { exportAllAdminClients as createAdminExportAllClients };

export const deleteAdminClient = createServerFn({ method: "POST" })
  .validator((data: { clientId: string }) => data)
  .handler(async ({ data }) => {
    if (!/^[0-9a-f-]{36}$/i.test(data.clientId)) throw new Error("Invalid client id.");
    const client = await getAdminClient();
    if (!client) throw new Error("Admin permission required.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("clients").delete().eq("id", data.clientId);
    if (error) throw error;
    return { ok: true };
  });
