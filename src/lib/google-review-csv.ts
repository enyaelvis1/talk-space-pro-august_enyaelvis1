export type GoogleReviewCsvRow = {
  id?: string;
  name: string;
  date: string;
  quote: string;
  location?: string;
  avatarPath?: string;
};

export function serializeGoogleReviewsCsv(reviews: GoogleReviewCsvRow[]) {
  const escapeCsv = (value: unknown) => {
    const text = String(value ?? "");
    const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    return `"${normalized.replaceAll('"', '""')}"`;
  };

  const header = ["id", "name", "date", "quote", "location", "avatarPath"];
  const rows = reviews.map((review) => [
    review.id ?? "",
    review.name,
    review.date,
    review.quote,
    review.location ?? "",
    review.avatarPath ?? "",
  ]);

  return [header, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\r\n");
}
