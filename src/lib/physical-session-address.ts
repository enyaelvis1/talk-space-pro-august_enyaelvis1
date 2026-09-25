export const DEFAULT_PHYSICAL_SESSION_ADDRESS =
  "Talk Space Counselling - Lagos, Abiodun Oshowole Cl, off Oluwaleimu Street, Allen, Ikeja 101233, Lagos";

type PhysicalSessionOffice = {
  name: string;
  addressLines: string[];
};

function readOffices(value: unknown): PhysicalSessionOffice[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const offices = (value as { offices?: unknown }).offices;
  if (!Array.isArray(offices)) return [];

  return offices.flatMap((office) => {
    if (!office || typeof office !== "object" || Array.isArray(office)) return [];
    const item = office as { name?: unknown; addressLines?: unknown };
    const name = typeof item.name === "string" ? item.name.trim() : "";
    const addressLines = Array.isArray(item.addressLines)
      ? item.addressLines
          .filter((line): line is string => typeof line === "string")
          .map((line) => line.trim())
          .filter(Boolean)
      : [];
    return name && addressLines.length ? [{ name, addressLines }] : [];
  });
}

export function readPhysicalSessionAddress(value: unknown, location?: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_PHYSICAL_SESSION_ADDRESS;
  }

  const normalizedLocation = typeof location === "string" ? location.trim().toLowerCase() : "";
  if (normalizedLocation) {
    const locationTokens = normalizedLocation
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 3 && !["online", "person"].includes(token));
    const matchingOffice = readOffices(value).find((office) => {
      const officeText = `${office.name} ${office.addressLines.join(" ")}`.toLowerCase();
      return locationTokens.some((token) => officeText.includes(token));
    });
    if (matchingOffice) return `${matchingOffice.addressLines.join(", ")}, ${matchingOffice.name}`;
  }

  const configured = (value as { physicalSessionAddress?: unknown }).physicalSessionAddress;
  return typeof configured === "string" && configured.trim()
    ? configured.trim()
    : DEFAULT_PHYSICAL_SESSION_ADDRESS;
}
