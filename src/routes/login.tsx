import { type FormEvent, useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";

import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Button } from "@/components/ui/button";
import { canonicalUrl } from "@/lib/seo";
import { getSafeRedirect, hasBrowserRoleForSession } from "@/lib/auth";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Sign in | Talk Space" }, { name: "robots", content: "noindex, nofollow" }],
    links: [{ rel: "canonical", href: canonicalUrl("/login") }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);

    const params = new URLSearchParams(window.location.search);
    const errorCode = params.get("error");
    const redirectTarget = params.get("redirect");

    if (errorCode === "session_expired") {
      setError(
        "Your session has expired after 1 hour of inactivity. Please sign in again to continue.",
      );
      if (redirectTarget) {
        setMessage(`You were redirected from ${redirectTarget}.`);
      }
    }
  }, []);

  // Banner only shows when env is truly missing.

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase is not configured. Add the values from .env.example first.");
      setBusy(false);
      return;
    }

    const result =
      mode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName } },
          });

    if (result.error) {
      setError(result.error.message);
      setBusy(false);
      return;
    }

    if (mode === "sign-up" && !result.data.session) {
      setMessage("Check your email to confirm your account, then return here to sign in.");
      setBusy(false);
      return;
    }

    const redirectTo = getSafeRedirect(new URLSearchParams(window.location.search).get("redirect"));

    const deadline = Date.now() + 5000;
    let sessionReady = false;
    let verifiedSession: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"] =
      null;
    while (Date.now() < deadline) {
      const [{ data: sessionData }, { data: userData, error: userError }] = await Promise.all([
        supabase.auth.getSession(),
        supabase.auth.getUser(),
      ]);
      if (sessionData.session?.access_token && userData.user && !userError) {
        sessionReady = true;
        verifiedSession = sessionData.session;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    if (!sessionReady) {
      setError("We couldn't finish preparing your secure session. Please try signing in again.");
      setBusy(false);
      return;
    }

    let destination = redirectTo;
    if (
      mode === "sign-in" &&
      verifiedSession &&
      (await hasBrowserRoleForSession(verifiedSession, "admin"))
    ) {
      destination = "/admin";
    } else if (
      mode === "sign-in" &&
      (redirectTo === "/account" || redirectTo === "/") &&
      verifiedSession &&
      (await hasBrowserRoleForSession(verifiedSession, "therapist"))
    ) {
      destination = "/therapist";
    }

    await navigate({ to: destination as never, replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main id="main" className="flex flex-1 items-center bg-surface-page py-16 sm:py-24">
        <section className="mx-auto w-full max-w-md px-4 sm:px-6">
          <p className="eyebrow">Private client space</p>
          <h1 className="display-1 mt-3 text-brand-deep">
            {mode === "sign-in" ? "Welcome back." : "Create your account."}
          </h1>
          <p className="mt-4 text-muted-foreground">
            {mode === "sign-in"
              ? "Sign in to view your Talk Space account."
              : "Create an account to manage your Talk Space care journey."}
          </p>

          <div className="mt-8 rounded-2xl border border-border/70 bg-card p-6 shadow-sm sm:p-8">
            {!isSupabaseConfigured ? (
              <p className="mb-5 rounded-lg bg-brand-blue-soft p-3 text-sm text-brand-deep">
                Authentication is awaiting Supabase environment variables.
              </p>
            ) : null}

            <div className="mb-6 grid grid-cols-2 rounded-lg bg-surface-page p-1 text-sm">
              {(["sign-in", "sign-up"] as const).map((nextMode) => (
                <button
                  key={nextMode}
                  type="button"
                  onClick={() => {
                    setMode(nextMode);
                    setError("");
                    setMessage("");
                  }}
                  className={`rounded-md px-3 py-2 font-medium transition-colors ${
                    mode === nextMode
                      ? "bg-white text-brand-deep shadow-sm"
                      : "text-muted-foreground hover:text-brand-deep"
                  }`}
                >
                  {nextMode === "sign-in" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "sign-up" ? (
                <label className="block text-sm font-medium text-brand-deep">
                  Full name
                  <input
                    required
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    autoComplete="name"
                    className="mt-1.5 h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-mint"
                  />
                </label>
              ) : null}
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
              <label className="block text-sm font-medium text-brand-deep">
                Password
                <span className="relative mt-1.5 block">
                  <input
                    required
                    minLength={8}
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                    className="h-11 w-full rounded-md border border-input bg-background px-3 pr-11 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-mint"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    title={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-brand-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-mint"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden />
                    )}
                  </button>
                </span>
              </label>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              {message ? <p className="text-sm text-brand-deep">{message}</p> : null}

              <Button
                type="submit"
                disabled={busy || !hydrated}
                className="h-11 w-full bg-brand-deep text-white hover:bg-brand-deep/90"
              >
                {!hydrated
                  ? "Loading…"
                  : busy
                    ? "Please wait…"
                    : mode === "sign-in"
                      ? "Sign in"
                      : "Create account"}
              </Button>
            </form>

            {mode === "sign-in" ? (
              <Link
                to="/reset-password"
                className="mt-5 block text-center text-sm text-brand-blue-deep hover:text-brand-deep"
              >
                Forgot your password?
              </Link>
            ) : null}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
