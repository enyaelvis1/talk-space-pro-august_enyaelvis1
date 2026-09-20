export const PURCHASE_HANDOFF_KEY = "talk-space.purchase-handoff.v1";
const PURCHASE_HANDOFF_MAX_AGE_MS = 30 * 60 * 1000;

export type PurchaseHandoff = {
  fullName: string;
  email: string;
  phone: string;
  serviceId: string;
  serviceCode: string;
  mode: "online" | "in_person";
  preferredDate: string;
  preferredTime: string;
  sessions: number;
  savedAt: string;
};

export function savePurchaseHandoff(input: Omit<PurchaseHandoff, "savedAt">) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      PURCHASE_HANDOFF_KEY,
      JSON.stringify({ ...input, savedAt: new Date().toISOString() } satisfies PurchaseHandoff),
    );
  } catch {
    // The purchase page remains usable if browser storage is unavailable.
  }
}

export function loadPurchaseHandoff(): PurchaseHandoff | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PURCHASE_HANDOFF_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PurchaseHandoff>;
    if (
      !parsed ||
      typeof parsed.fullName !== "string" ||
      typeof parsed.email !== "string" ||
      typeof parsed.phone !== "string" ||
      typeof parsed.serviceId !== "string" ||
      typeof parsed.serviceCode !== "string" ||
      !["online", "in_person"].includes(parsed.mode ?? "") ||
      typeof parsed.preferredDate !== "string" ||
      typeof parsed.preferredTime !== "string" ||
      typeof parsed.sessions !== "number" ||
      typeof parsed.savedAt !== "string"
    ) {
      return null;
    }
    if (Date.now() - Date.parse(parsed.savedAt) > PURCHASE_HANDOFF_MAX_AGE_MS) {
      window.sessionStorage.removeItem(PURCHASE_HANDOFF_KEY);
      return null;
    }
    return parsed as PurchaseHandoff;
  } catch {
    return null;
  }
}

export function clearPurchaseHandoff() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PURCHASE_HANDOFF_KEY);
  } catch {
    // Ignore storage failures.
  }
}
