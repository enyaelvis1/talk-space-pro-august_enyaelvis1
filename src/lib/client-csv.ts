import { parse } from "csv-parse/browser/esm/sync";
import { stringify } from "csv-stringify/browser/esm/sync";
import { z } from "zod";
import { clientContactSchema } from "./client-profile.ts";

export const CLIENT_CSV_MAX_BYTES = 2 * 1024 * 1024;
export const CLIENT_CSV_COLUMNS = [
  "id",
  "full_name",
  "email",
  "phone",
  "surname",
  "other_names",
  "address",
  "date_of_birth",
  "wedding_anniversary_date",
  "occupation",
  "record_source",
  "preferred_mode",
  "assigned_therapist_id",
  "created_at",
  "updated_at",
];
const optionalDate = z.union([z.literal(""), z.iso.date()]);
const optionalFields = z.object({
  surname: z.string().trim().max(100).optional(),
  other_names: z.string().trim().max(150).optional(),
  address: z.string().trim().max(500).optional(),
  occupation: z.string().trim().max(150).optional(),
  date_of_birth: optionalDate.optional(),
  wedding_anniversary_date: optionalDate.optional(),
  record_source: z.string().trim().max(100).optional(),
  preferred_mode: z.enum(["", "online", "in_person", "phone"]).optional(),
  assigned_therapist_id: z.union([z.literal(""), z.string().uuid()]).optional(),
});

type ClientCsvProfile = {
  full_name: string;
  email: string;
  phone: string;
} & {
  [K in keyof z.infer<typeof optionalFields>]?: Exclude<
    z.infer<typeof optionalFields>[K],
    ""
  > | null;
};

// eslint-disable-next-line no-control-regex -- Spreadsheet importers can ignore leading control bytes.
const spreadsheetFormula = /^[\s\u0000-\u001f]*[=+@-]/;

// Escape literal apostrophes too, so our export can be imported without data loss.
function spreadsheetText(value: unknown) {
  return typeof value === "string" && (value.startsWith("'") || spreadsheetFormula.test(value))
    ? `'${value}`
    : value;
}

function importText(value: string) {
  return value.startsWith("'") &&
    (value.startsWith("''") || spreadsheetFormula.test(value.slice(1)))
    ? value.slice(1)
    : value;
}

export function parseClientCsv(csv: string) {
  if (new TextEncoder().encode(csv).length > CLIENT_CSV_MAX_BYTES)
    throw new Error("CSV must be 2 MB or smaller.");
  const rows = parse(csv, {
    bom: true,
    skip_empty_lines: true,
    trim: true,
    max_record_size: 16000,
    columns: (headers: string[]) => {
      if (new Set(headers).size !== headers.length) throw new Error("Duplicate CSV columns.");
      for (const column of ["full_name", "email", "phone"]) {
        if (!headers.includes(column)) throw new Error(`Missing required column: ${column}`);
      }
      const unknown = headers.filter((column) => !CLIENT_CSV_COLUMNS.includes(column));
      if (unknown.length) throw new Error(`Unsupported columns: ${unknown.join(", ")}`);
      return headers;
    },
  }) as Record<string, string>[];
  if (!rows.length || rows.length > 2000)
    throw new Error("CSV must contain between 1 and 2,000 profiles.");
  const errors: Array<{ row: number; message: string }> = [];
  const seen = new Set<string>();
  const profiles: Array<{ row: number; values: ClientCsvProfile }> = [];
  rows.forEach((rawRow, index) => {
    const row = Object.fromEntries(
      Object.entries(rawRow).map(([key, value]) => [key, importText(value)]),
    );
    const contact = clientContactSchema.safeParse({
      fullName: row.full_name,
      email: row.email,
      phone: row.phone,
    });
    const extra = optionalFields.safeParse(row);
    if (!contact.success || !extra.success) {
      errors.push({
        row: index + 2,
        message: [
          ...(!contact.success ? contact.error.issues : []),
          ...(!extra.success ? extra.error.issues : []),
        ]
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; "),
      });
      return;
    }
    if (seen.has(contact.data.email)) {
      errors.push({ row: index + 2, message: "Duplicate email in this file." });
      return;
    }
    seen.add(contact.data.email);
    profiles.push({
      row: index + 2,
      values: {
        ...Object.fromEntries(
          Object.entries(extra.data).map(([key, value]) => [key, value || null]),
        ),
        full_name: contact.data.fullName,
        email: contact.data.email,
        phone: contact.data.phone,
      },
    });
  });
  return { profiles, errors, total: rows.length };
}

export function clientProfilesCsv(rows: Record<string, unknown>[]) {
  return stringify(
    rows.map((row) =>
      Object.fromEntries(Object.entries(row).map(([key, value]) => [key, spreadsheetText(value)])),
    ),
    { header: true, columns: CLIENT_CSV_COLUMNS, quoted: true },
  );
}

export function clientProfilesCsvTemplate() {
  return clientProfilesCsv([
    {
      full_name: "Example Client",
      email: "example.client@example.test",
      phone: "+234 800 000 0000",
    },
  ]);
}
