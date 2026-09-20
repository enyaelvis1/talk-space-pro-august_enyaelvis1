import { useEffect, useMemo, useState } from "react";

export function useCheckoutClock(expiresAt: string, serverNow?: string) {
  const [now, setNow] = useState(Date.now);
  const serverOffset = useMemo(() => {
    const parsed = serverNow ? Date.parse(serverNow) : Number.NaN;
    return Number.isFinite(parsed) ? parsed - Date.now() : 0;
  }, [serverNow]);
  useEffect(() => {
    const deadline = Date.parse(expiresAt);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      clearTimeout(timer);
      const current = Date.now() + serverOffset;
      setNow(current);
      if (deadline > current) timer = setTimeout(tick, Math.min(1000, deadline - current));
    };
    tick();
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [expiresAt, serverOffset]);
  return { now, expired: !(Date.parse(expiresAt) > now) };
}
