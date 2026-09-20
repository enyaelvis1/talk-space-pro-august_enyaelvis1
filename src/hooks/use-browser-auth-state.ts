import { useSyncExternalStore } from "react";

import { getBrowserAuthSnapshot, subscribeToBrowserAuth } from "@/lib/browser-auth-state";

export function useBrowserAuthState() {
  return useSyncExternalStore(
    subscribeToBrowserAuth,
    getBrowserAuthSnapshot,
    getBrowserAuthSnapshot,
  );
}
