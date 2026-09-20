import { type FormEvent, useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Button } from "@/components/ui/button";
import { canonicalUrl } from "@/lib/seo";
import { getSafeRedirect } from "@/lib/auth";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password | Talk Space" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: canonicalUrl("/reset-password") }],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [recovery, setRecovery] = useState(false);
  const [invite, setInvite] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setInvite(params.get("invite") === "therapist");

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    void supabase.auth.getSession().then(({ data }) => setRecovery(Boolean(data.session)));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setRecovery(true);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase is not configured. Add the values from .env.example first.");
      setBusy(false);
      return;
    }

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (resetError) setError(resetError.message);
    else setMessage("If an account exists for that email, a reset link is on its way.");
    setBusy(false);
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase is not configured. Add the values from .env.example first.");
      setBusy(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setBusy(false);
      return;
    }

    const redirectTo = getSafeRedirect(new URLSearchParams(window.location.search).get("redirect"));
    if (invite) {
      await navigate({ to: redirectTo as never, replace: true });
      return;
    }

    setMessage("Your password has been updated. You can now sign in.");
    setBusy(false);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main id="main" className="flex flex-1 items-center bg-surface-page py-16 sm:py-24">
        <section className="mx-auto w-full max-w-md px-4 sm:px-6">
          <p className="eyebrow">Account access</p>
          <h1 className="display-1 mt-3 text-brand-deep">
            {recovery
              ? invite
                ? "Create your therapist login."
                : "Choose a new password."
              : "Reset your password."}
          </h1>
          <p className="mt-4 text-muted-foreground">
            {recovery
              ? invite
                ? "Set your password once, then you will be taken to your therapist dashboard."
                : "Use at least eight characters, then return to sign in."
              : "Enter your email and we will send a secure reset link if an account exists."}
          </p>

          <div className="mt-8 rounded-2xl border border-border/70 bg-card p-6 shadow-sm sm:p-8">
            {!isSupabaseConfigured ? (
              <p className="mb-5 rounded-lg bg-brand-blue-soft p-3 text-sm text-brand-deep">
                Authentication is awaiting Supabase environment variables.
              </p>
            ) : null}
            <form onSubmit={recovery ? updatePassword : requestReset} className="space-y-4">
              {recovery ? (
                <label className="block text-sm font-medium text-brand-deep">
                  New password
                  <input
                    required
                    minLength={8}
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    className="mt-1.5 h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-mint"
                  />
                </label>
              ) : (
                <label className="block text-sm font-medium text-brand-deep">
                  Email address
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    className="mt-1.5 h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-mint"
                  />
                </label>
              )}
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              {message ? <p className="text-sm text-brand-deep">{message}</p> : null}
              <Button
                type="submit"
                disabled={busy}
                className="h-11 w-full bg-brand-deep text-white hover:bg-brand-deep/90"
              >
                {busy
                  ? "Please wait…"
                  : recovery
                    ? invite
                      ? "Create login"
                      : "Update password"
                    : "Send reset link"}
              </Button>
            </form>
            <Link
              to="/login"
              className="mt-5 block text-center text-sm text-brand-blue-deep hover:text-brand-deep"
            >
              Return to sign in
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
