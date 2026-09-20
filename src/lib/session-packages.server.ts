import { createHash, randomBytes } from "node:crypto";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { canonicalUrl } from "@/lib/seo";

export type ActivatedPackage = {
  packageId: string;
  packageReference: string;
  clientEmail: string;
  purchasedSessions: number;
  usedSessions: number;
  remainingSessions: number;
  accessToken: string | null;
  bookingUrl: string | null;
};

export function hashPackageToken(token: string) {
  return createHash("sha256").update(token.trim()).digest("hex");
}

export function buildPackageBookingUrl(token: string | null | undefined) {
  return token ? canonicalUrl(`/book?package=${encodeURIComponent(token)}`) : null;
}

export async function ensureSessionPackageForPayment(
  paymentId: string,
): Promise<ActivatedPackage | null> {
  const rpcClient = supabaseAdmin as unknown as {
    rpc: (
      fn: "activate_session_package_for_payment",
      args: { p_payment_id: string },
    ) => Promise<{
      data: Record<string, unknown>[] | Record<string, unknown> | null;
      error: unknown;
    }>;
  };
  const { data, error } = await rpcClient.rpc("activate_session_package_for_payment", {
    p_payment_id: paymentId,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  const packageClient = supabaseAdmin as unknown as {
    from: (table: "client_session_packages") => {
      select: (columns: string) => {
        eq: (
          column: string,
          value: string,
        ) => {
          maybeSingle: () => Promise<{
            data: { reference?: string | null } | null;
            error: unknown;
          }>;
        };
      };
    };
  };
  const { data: packageRow, error: packageError } = await packageClient
    .from("client_session_packages")
    .select("reference")
    .eq("id", row.package_id as string)
    .maybeSingle();
  if (packageError) throw packageError;
  const accessToken = (row.access_token as string | null) ?? null;
  return {
    packageId: row.package_id as string,
    packageReference:
      (packageRow?.reference as string | null) ??
      `PKG-${String(row.package_id).slice(0, 8).toUpperCase()}`,
    clientEmail: row.client_email as string,
    purchasedSessions: Number(row.purchased_sessions ?? 0),
    usedSessions: Number(row.used_sessions ?? 0),
    remainingSessions: Number(row.remaining_sessions ?? 0),
    accessToken,
    bookingUrl: buildPackageBookingUrl(accessToken),
  };
}

export async function createManualSessionPackage(input: {
  clientName: string;
  clientEmail: string;
  clientPhone?: string | null;
  serviceId: string;
  sessionMode: "online" | "in_person";
  purchasedSessions: number;
  expiresAt?: string | null;
  notes?: string | null;
  createdBy: string;
}) {
  const token = randomBytes(32).toString("hex");
  const insertClient = supabaseAdmin as unknown as {
    from: (table: "client_session_packages") => {
      insert: (values: Record<string, unknown>) => {
        select: (columns: string) => {
          single: () => Promise<{ data: Record<string, unknown> | null; error: unknown }>;
        };
      };
    };
  };
  const { data, error } = await insertClient
    .from("client_session_packages")
    .insert({
      client_name: input.clientName.trim(),
      client_email: input.clientEmail.trim().toLowerCase(),
      client_phone: input.clientPhone?.trim() || null,
      service_id: input.serviceId,
      session_mode: input.sessionMode,
      purchased_sessions: input.purchasedSessions,
      used_sessions: 0,
      status: "active",
      access_token_hash: hashPackageToken(token),
      access_token: token,
      expires_at: input.expiresAt || null,
      notes: input.notes?.trim() || null,
      created_by: input.createdBy,
    })
    .select("id, reference, client_email, purchased_sessions, used_sessions")
    .single();
  if (error) throw error;
  if (!data) throw new Error("Package could not be created.");
  return {
    packageId: data.id as string,
    packageReference: data.reference as string,
    clientEmail: data.client_email as string,
    purchasedSessions: Number(data.purchased_sessions ?? input.purchasedSessions),
    usedSessions: Number(data.used_sessions ?? 0),
    remainingSessions: Number(data.purchased_sessions ?? input.purchasedSessions),
    accessToken: token,
    bookingUrl: buildPackageBookingUrl(token),
  } satisfies ActivatedPackage;
}
