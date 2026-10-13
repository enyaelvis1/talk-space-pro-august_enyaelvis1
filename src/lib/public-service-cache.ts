import { createPublicReadCache } from "@/lib/public-read-cache";

export type PublicBookingService = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  sessionsPerPackage: number;
  priceNgn: number | null;
  inPersonPriceNgn: number | null;
};

// Active service metadata is public and changes only through admin service writes.
// Coalesce concurrent misses and keep the value short-lived so pricing stays fresh.
export const publicBookingServicesCache = createPublicReadCache<PublicBookingService[]>(60_000);

export function clearPublicBookingServicesCache() {
  publicBookingServicesCache.clear();
}
