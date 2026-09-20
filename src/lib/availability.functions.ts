import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import { createRequestSupabase } from "@/lib/supabase-server";
import { availabilitySlotInputSchema } from "@/lib/availability-validation";

export type AdminAvailabilityMode = "online" | "in_person";

export type AdminTherapistOption = {
  id: string;
  fullName: string;
};

export type AdminAvailabilitySlot = {
  id: string;
  therapistId: string;
  therapistName: string;
  mode: AdminAvailabilityMode;
  startsAt: string;
  endsAt: string;
  reason: string | null;
};

export type AdminAvailabilityData = {
  therapists: AdminTherapistOption[];
  slots: AdminAvailabilitySlot[];
};

async function getAdminClient() {
  const requestSupabase = createRequestSupabase(getRequest());
  if (!requestSupabase) return null;

  const {
    data: { user },
  } = await requestSupabase.client.auth.getUser();
  if (!user) {
    requestSupabase.commitCookies();
    return null;
  }

  const { data: isAdmin, error } = await requestSupabase.client.rpc("has_role", {
    _user_id: user.id,
    _role: "admin",
  });
  requestSupabase.commitCookies();
  if (error || isAdmin !== true) return null;

  return requestSupabase.client;
}

function toAdminSlot(
  slot: {
    id: string;
    therapist_id: string;
    mode: AdminAvailabilityMode | null;
    starts_at: string;
    ends_at: string;
    reason: string | null;
  },
  therapistNames: Map<string, string>,
): AdminAvailabilitySlot | null {
  if (!slot.mode) return null;

  return {
    id: slot.id,
    therapistId: slot.therapist_id,
    therapistName: therapistNames.get(slot.therapist_id) ?? "Unknown therapist",
    mode: slot.mode,
    startsAt: slot.starts_at,
    endsAt: slot.ends_at,
    reason: slot.reason,
  };
}

export const getAdminAvailability = createServerFn({ method: "GET" }).handler(async () => {
  const client = await getAdminClient();
  if (!client) return null;

  setResponseHeader("Cache-Control", "private, no-store");

  const [{ data: therapists, error: therapistsError }, { data: slots, error: slotsError }] =
    await Promise.all([
      client.from("therapists").select("id, full_name").eq("is_active", true).order("full_name"),
      client
        .from("availability_exceptions")
        .select("id, therapist_id, mode, starts_at, ends_at, reason")
        .eq("kind", "added")
        .in("mode", ["online", "in_person"])
        .gte("ends_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(100),
    ]);

  if (therapistsError) throw therapistsError;
  if (slotsError) throw slotsError;

  const therapistNames = new Map(
    (therapists ?? []).map((therapist) => [therapist.id, therapist.full_name]),
  );

  return {
    therapists: (therapists ?? []).map((therapist): AdminTherapistOption => ({
      id: therapist.id,
      fullName: therapist.full_name,
    })),
    slots: (slots ?? [])
      .map((slot) => toAdminSlot(slot, therapistNames))
      .filter((slot): slot is AdminAvailabilitySlot => slot !== null),
  } satisfies AdminAvailabilityData;
});

function slotDateTime(date: string, time: string) {
  return new Date(`${date}T${time}:00+01:00`);
}

export const createAvailabilitySlot = createServerFn({ method: "POST" })
  .validator((data: z.infer<typeof availabilitySlotInputSchema>) =>
    availabilitySlotInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const client = await getAdminClient();
    if (!client) throw new Error("You do not have permission to manage availability.");

    const startsAt = slotDateTime(data.date, data.startsAt);
    const endsAt = slotDateTime(data.date, data.endsAt);
    if (
      Number.isNaN(startsAt.getTime()) ||
      Number.isNaN(endsAt.getTime()) ||
      startsAt <= new Date()
    ) {
      throw new Error("Availability slots must start in the future.");
    }

    const { data: existing, error: existingError } = await client
      .from("availability_exceptions")
      .select("id")
      .eq("therapist_id", data.therapistId)
      .eq("kind", "added")
      .lt("starts_at", endsAt.toISOString())
      .gt("ends_at", startsAt.toISOString())
      .limit(1);

    if (existingError) throw existingError;
    if (existing?.length) {
      throw new Error("This therapist already has an overlapping availability slot.");
    }

    const { data: slot, error } = await client
      .from("availability_exceptions")
      .insert({
        therapist_id: data.therapistId,
        kind: "added",
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        mode: data.mode,
        reason: data.reason || null,
      })
      .select("id, therapist_id, mode, starts_at, ends_at, reason")
      .single();

    if (error) throw error;

    const { data: therapist, error: therapistError } = await client
      .from("therapists")
      .select("full_name")
      .eq("id", data.therapistId)
      .single();
    if (therapistError) throw therapistError;

    const createdSlot = toAdminSlot(slot, new Map([[data.therapistId, therapist.full_name]]));
    if (!createdSlot) throw new Error("The availability slot could not be created.");

    return createdSlot;
  });

const deleteSlotInput = z.object({
  id: z.string().uuid(),
});

export const deleteAvailabilitySlot = createServerFn({ method: "POST" })
  .validator((data: z.infer<typeof deleteSlotInput>) => deleteSlotInput.parse(data))
  .handler(async ({ data }) => {
    const client = await getAdminClient();
    if (!client) throw new Error("You do not have permission to manage availability.");

    const { error } = await client
      .from("availability_exceptions")
      .delete()
      .eq("id", data.id)
      .eq("kind", "added");
    if (error) throw error;

    return { id: data.id };
  });
