import { Loader2, ShieldAlert, ShieldCheck, Clock3 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { SensitiveActionGateState } from "@/hooks/useSensitiveActionGate";
import { formatWATTime } from "@/lib/time";

function getAalLabel(level: SensitiveActionGateState["currentLevel"]) {
  if (level === "aal2") return "MFA verified";
  if (level === "aal1") return "Password only";
  return "Unknown";
}

export function SensitiveActionDialog({
  state,
  onConfirm,
  onOpenChange,
}: {
  state: SensitiveActionGateState;
  onConfirm: (password: string) => Promise<void>;
  onOpenChange: (open: boolean) => void;
}) {
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (state.open) setPassword("");
  }, [state.open, state.reason]);

  const mfaLabel = useMemo(() => {
    if (state.currentLevel === "aal2") return "MFA ready";
    if (state.nextLevel === "aal2") return "MFA available";
    return "Password step-up";
  }, [state.currentLevel, state.nextLevel]);

  const unlockLabel = useMemo(() => {
    if (!state.stepUpExpiresAt) return "Until you leave this tab";
    return formatWATTime(state.stepUpExpiresAt);
  }, [state.stepUpExpiresAt]);

  return (
    <Dialog open={state.open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-brand-deep">
            <ShieldAlert className="h-5 w-5 text-brand-mint" aria-hidden />
            Confirm sensitive action
          </DialogTitle>
          <DialogDescription>
            {state.reason
              ? `Enter your password to ${state.reason}.`
              : "Enter your password to continue."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-border/70 bg-brand-mint-soft/30 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-brand-deep">
              <ShieldCheck className="h-4 w-4" aria-hidden />
              MFA readiness
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              This workspace accepts step-up protection for sensitive admin actions. If your account
              has a verified second factor, the session can be treated as MFA-ready.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="outline">{getAalLabel(state.currentLevel)}</Badge>
              <Badge variant="outline">{mfaLabel}</Badge>
              <Badge variant="outline" className="gap-1">
                <Clock3 className="h-3.5 w-3.5" aria-hidden />
                Unlocks {unlockLabel}
              </Badge>
            </div>
          </div>

          <label className="block text-sm font-medium text-brand-deep">
            Password
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1.5"
            />
          </label>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void onConfirm(password)}
            disabled={state.busy || password.trim().length < 1}
          >
            {state.busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Confirm and continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
