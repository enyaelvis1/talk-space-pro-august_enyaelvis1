import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export const BACKUP_FORMAT_VERSION = "1";

export function getBackupKey(raw = process.env["BACKUP_ENCRYPTION_KEY"]): Buffer {
  if (!raw || raw.trim().length < 32) {
    throw new Error("BACKUP_ENCRYPTION_KEY must be configured with at least 32 characters.");
  }
  return createHash("sha256").update(raw, "utf8").digest();
}

export function encryptBackup(payload: unknown, rawKey?: string): Buffer {
  const key = getBackupKey(rawKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.from(
    JSON.stringify({
      formatVersion: BACKUP_FORMAT_VERSION,
      algorithm: "aes-256-gcm",
      iv: iv.toString("base64url"),
      tag: tag.toString("base64url"),
      ciphertext: ciphertext.toString("base64url"),
    }),
    "utf8",
  );
}

export function decryptBackup(archive: Buffer, rawKey?: string): unknown {
  const key = getBackupKey(rawKey);
  const envelope = JSON.parse(archive.toString("utf8")) as {
    formatVersion?: string;
    algorithm?: string;
    iv?: string;
    tag?: string;
    ciphertext?: string;
  };
  if (
    envelope.formatVersion !== BACKUP_FORMAT_VERSION ||
    envelope.algorithm !== "aes-256-gcm" ||
    !envelope.iv ||
    !envelope.tag ||
    !envelope.ciphertext
  ) {
    throw new Error("Unsupported or malformed backup archive.");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64url"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, "base64url")),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString("utf8"));
}

export function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

const SENSITIVE_KEYS =
  /(?:token|secret|password|ciphertext|private[_-]?key|api[_-]?key|authorization|cookie|manage[_-]?hash)/i;

export function redactBackupValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactBackupValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      SENSITIVE_KEYS.test(key) ? null : redactBackupValue(child),
    ]),
  );
}

export function redactBackupRow(table: string, row: unknown): unknown {
  const redacted = redactBackupValue(row);
  if (
    table === "site_settings" &&
    redacted &&
    typeof redacted === "object" &&
    typeof (redacted as { key?: unknown }).key === "string" &&
    /(?:secret|token|password|private|api[_-]?key|credential)/i.test(
      (redacted as { key: string }).key,
    )
  ) {
    return { ...(redacted as Record<string, unknown>), value: null };
  }
  return redacted;
}
