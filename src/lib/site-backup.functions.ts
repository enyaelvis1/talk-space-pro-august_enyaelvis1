import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireRequestRole } from "@/lib/server-auth";
const BACKUP_FORMAT_VERSION = "1";

const backupLabelSchema = z.object({ label: z.string().trim().min(1).max(120) });
const backupIdSchema = z.object({ backupId: z.string().uuid() });

const BACKUP_TABLES = [
  "admin_audit_logs",
  "appointment_events",
  "appointments",
  "site_settings",
  "clients",
  "client_notes",
  "contact_submissions",
  "content_entries",
  "content_revisions",
  "content_media",
  "content_entry_media",
  "email_delivery_logs",
  "email_template_settings",
  "faqs",
  "intake_submissions",
  "migration_content_reviews",
  "payment_events",
  "payment_reviews",
  "payments",
  "profiles",
  "testimonials",
  "redirects",
  "services",
  "therapists",
  "therapist_services",
  "availability_rules",
  "availability_exceptions",
  "reminder_settings",
  "email_settings",
  "payment_settings",
  "google_oauth_settings",
  "therapist_google_connections",
] as const;

type BackupRow = {
  id: string;
  label: string;
  status: string;
  format_version: string;
  storage_path: string | null;
  checksum_sha256: string | null;
  manifest: Record<string, string | number | Record<string, number>>;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
  restored_at: string | null;
};

async function getAdminContext() {
  return requireRequestRole("admin");
}

async function getAdminClient() {
  const context = await getAdminContext();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { context, supabaseAdmin: supabaseAdmin as any };
}

async function getBackupCrypto() {
  // The helper fails closed unless BACKUP_ENCRYPTION_KEY is configured.
  return import("@/lib/site-backup-crypto");
}

async function writeBackupAudit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any,
  context: Awaited<ReturnType<typeof getAdminContext>>,
  action: string,
  backupId: string,
  reason: string,
) {
  await supabaseAdmin.from("admin_audit_logs").insert({
    actor_id: context.user.id,
    actor_email: context.user.email ?? null,
    actor_kind: "admin",
    action,
    target_type: "site_backups",
    target_id: backupId,
    reason,
    changed_fields: [],
  });
}

export const listAdminBackups = createServerFn({ method: "GET" }).handler(
  async (): Promise<BackupRow[]> => {
    const { supabaseAdmin } = await getAdminClient();
    const { data, error } = await supabaseAdmin
      .from("site_backups")
      .select(
        "id,label,status,format_version,storage_path,checksum_sha256,manifest,error_message,created_at,completed_at,restored_at",
      )
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data ?? []) as BackupRow[];
  },
);

export const createAdminSiteBackup = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => backupLabelSchema.parse(data))
  .handler(async ({ data }) => {
    const { context, supabaseAdmin } = await getAdminClient();
    const backupId = crypto.randomUUID();
    const storagePath = `archives/${backupId}.json.enc`;
    const { error: createError } = await supabaseAdmin.from("site_backups").insert({
      id: backupId,
      label: data.label,
      status: "running",
      format_version: BACKUP_FORMAT_VERSION,
      storage_path: storagePath,
      created_by: context.user.id,
    });
    if (createError) throw createError;

    try {
      const tables: Record<string, unknown[]> = {};
      const counts: Record<string, number> = {};
      for (const table of BACKUP_TABLES) {
        const { data: rows, error } = await supabaseAdmin.from(table).select("*");
        if (error) throw new Error(`Unable to export ${table}: ${error.message}`);
        const { redactBackupRow } = await getBackupCrypto();
        const redacted = ((rows ?? []) as unknown[]).map((row) =>
          redactBackupRow(table, row),
        ) as unknown[];
        tables[table] = redacted;
        counts[table] = redacted.length;
      }

      const storageManifest: Record<string, string[]> = {};
      for (const bucket of ["content-media", "payment-receipts"] as const) {
        const { data: objects } = await supabaseAdmin.storage
          .from(bucket)
          .list("", { limit: 1000 });
        storageManifest[bucket] = (objects ?? [])
          .map((object: { name: string }) => object.name)
          .filter(Boolean);
      }

      const snapshot = {
        formatVersion: BACKUP_FORMAT_VERSION,
        createdAt: new Date().toISOString(),
        scope: "application-logical-backup-with-operational-records",
        tables,
        storageManifest,
        restoreProfile: "site-content-configuration",
      };
      const { encryptBackup, sha256 } = await getBackupCrypto();
      const archive = encryptBackup(snapshot);
      const { error: uploadError } = await supabaseAdmin.storage
        .from("site-backups")
        .upload(storagePath, archive, { contentType: "application/octet-stream", upsert: false });
      if (uploadError) throw uploadError;

      const manifest = {
        formatVersion: BACKUP_FORMAT_VERSION,
        scope: snapshot.scope,
        restoreProfile: snapshot.restoreProfile,
        tableCounts: counts,
        storageBuckets: Object.fromEntries(
          Object.entries(storageManifest).map(([bucket, objects]) => [bucket, objects.length]),
        ),
      };
      const { error: completeError } = await supabaseAdmin
        .from("site_backups")
        .update({
          status: "completed",
          checksum_sha256: sha256(archive),
          manifest,
          completed_at: new Date().toISOString(),
        })
        .eq("id", backupId);
      if (completeError) throw completeError;
      await writeBackupAudit(
        supabaseAdmin,
        context,
        "site_backups.create",
        backupId,
        "Encrypted site backup created",
      );
      return { ok: true, backupId };
    } catch (error) {
      await supabaseAdmin
        .from("site_backups")
        .update({
          status: "failed",
          error_message: error instanceof Error ? error.message.slice(0, 500) : "Backup failed",
        })
        .eq("id", backupId);
      await writeBackupAudit(
        supabaseAdmin,
        context,
        "site_backups.create_failed",
        backupId,
        "Site backup failed",
      );
      throw error;
    }
  });

export const getAdminBackupDownloadUrl = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => backupIdSchema.parse(data))
  .handler(async ({ data }) => {
    const { context, supabaseAdmin } = await getAdminClient();
    const { data: backup, error } = await supabaseAdmin
      .from("site_backups")
      .select("id,status,storage_path")
      .eq("id", data.backupId)
      .maybeSingle();
    if (error) throw error;
    if (!backup || backup.status !== "completed" || !backup.storage_path)
      throw new Error("Backup is not available for download.");
    const { data: signed, error: signedError } = await supabaseAdmin.storage
      .from("site-backups")
      .createSignedUrl(backup.storage_path, 300);
    if (signedError) throw signedError;
    await writeBackupAudit(
      supabaseAdmin,
      context,
      "site_backups.download",
      data.backupId,
      "Signed backup download URL issued",
    );
    return { url: signed.signedUrl };
  });

export const validateAdminBackup = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => backupIdSchema.parse(data))
  .handler(async ({ data }) => {
    const { context, supabaseAdmin } = await getAdminClient();
    const { data: backup, error } = await supabaseAdmin
      .from("site_backups")
      .select("id,status,storage_path,checksum_sha256")
      .eq("id", data.backupId)
      .maybeSingle();
    if (error) throw error;
    if (!backup || backup.status !== "completed" || !backup.storage_path)
      throw new Error("Backup is not available for validation.");
    const { data: file, error: downloadError } = await supabaseAdmin.storage
      .from("site-backups")
      .download(backup.storage_path);
    if (downloadError || !file)
      throw downloadError ?? new Error("Backup archive could not be read.");
    const archive = Buffer.from(await file.arrayBuffer());
    const { decryptBackup, sha256 } = await getBackupCrypto();
    const snapshot = decryptBackup(archive) as {
      formatVersion?: string;
      tables?: Record<string, unknown[]>;
    };
    if (snapshot.formatVersion !== BACKUP_FORMAT_VERSION || !snapshot.tables)
      throw new Error("Backup archive failed validation.");
    if (backup.checksum_sha256 && sha256(archive) !== backup.checksum_sha256)
      throw new Error("Backup checksum does not match the catalog.");
    await writeBackupAudit(
      supabaseAdmin,
      context,
      "site_backups.validate",
      data.backupId,
      "Encrypted backup validated",
    );
    return { ok: true, tableCount: Object.keys(snapshot.tables).length };
  });

export const restoreAdminSiteBackup = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    backupIdSchema.extend({ confirmation: z.literal("RESTORE SITE BACKUP") }).parse(data),
  )
  .handler(async ({ data }) => {
    const { context, supabaseAdmin } = await getAdminClient();
    const { data: backup, error } = await supabaseAdmin
      .from("site_backups")
      .select("id,status,storage_path")
      .eq("id", data.backupId)
      .maybeSingle();
    if (error) throw error;
    if (!backup || backup.status !== "completed" || !backup.storage_path)
      throw new Error("Only a completed backup can be restored.");
    const { data: file, error: downloadError } = await supabaseAdmin.storage
      .from("site-backups")
      .download(backup.storage_path);
    if (downloadError || !file)
      throw downloadError ?? new Error("Backup archive could not be read.");
    const { decryptBackup } = await getBackupCrypto();
    const snapshot = decryptBackup(Buffer.from(await file.arrayBuffer())) as {
      formatVersion?: string;
      tables?: unknown;
    };
    if (snapshot.formatVersion !== BACKUP_FORMAT_VERSION || !snapshot.tables)
      throw new Error("Backup archive failed validation.");
    await supabaseAdmin
      .from("site_backups")
      .update({ status: "restoring", restored_by: context.user.id })
      .eq("id", data.backupId);
    const { data: restored, error: restoreError } = await supabaseAdmin.rpc(
      "restore_site_content_backup",
      {
        p_backup_id: data.backupId,
        p_snapshot: snapshot,
      },
    );
    if (restoreError) {
      await supabaseAdmin
        .from("site_backups")
        .update({ status: "restore_failed", error_message: restoreError.message.slice(0, 500) })
        .eq("id", data.backupId);
      throw restoreError;
    }
    await supabaseAdmin
      .from("site_backups")
      .update({ status: "restored", restored_at: new Date().toISOString() })
      .eq("id", data.backupId);
    await writeBackupAudit(
      supabaseAdmin,
      context,
      "site_backups.restore",
      data.backupId,
      "Site content/configuration restored from encrypted backup",
    );
    return { ok: true, restored };
  });
