import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { hasBrowserRole } from "@/lib/auth";
import { canonicalUrl } from "@/lib/seo";
import { getSupabaseBrowserClient } from "@/lib/supabase";

const ROLE_CHECK_TIMEOUT_MS = 1800;

function withTimeout<T>(promise: Promise<T>, fallback: T, ms = ROLE_CHECK_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(fallback), ms);
    promise
      .then((value) => resolve(value))
      .catch(() => resolve(fallback))
      .finally(() => window.clearTimeout(timer));
  });
}

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "Your account | Talk Space" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: canonicalUrl("/account") }],
  }),
  component: AccountPage,
});

function AccountPage() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [notice, setNotice] = useState("");
  const [checkingDestination, setCheckingDestination] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function routeRoleSpecificAccounts() {
      try {
        if (await withTimeout(hasBrowserRole("therapist"), false)) {
          window.location.replace("/therapist");
          return;
        }
      } finally {
        if (active) setCheckingDestination(false);
      }
    }

    void routeRoleSpecificAccounts().catch(() => {
      if (active) setCheckingDestination(false);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (checkingDestination) return;
    let active = true;

    async function loadProfile() {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        if (active) setProfileLoading(false);
        return;
      }

      try {
        const { data } = await supabase.auth.getUser();
        if (!active || !data.user) return;

        setEmail(data.user.email ?? "");
        setFullName(data.user.user_metadata?.full_name ?? "");

        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", data.user.id)
          .maybeSingle();
        if (active && profile?.full_name) setFullName(profile.full_name);
      } finally {
        if (active) setProfileLoading(false);
      }
    }

    void loadProfile().catch(() => undefined);
    return () => {
      active = false;
    };
  }, [checkingDestination]);

  async function signOut() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    await supabase.auth.signOut();
    window.location.assign("/");
  }

  if (checkingDestination) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main id="main" className="flex-1 bg-surface-page py-16 sm:py-24">
          <section className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8">
            <p className="eyebrow">Private space</p>
            <Skeleton className="mt-3 h-14 w-3/4 max-w-lg" />
            <Skeleton className="mt-5 h-5 w-full max-w-xl" />
            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              <Skeleton className="h-64 rounded-2xl" />
              <Skeleton className="h-64 rounded-2xl" />
            </div>
          </section>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main id="main" className="flex-1 bg-surface-page py-16 sm:py-24">
        <section className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8">
          <p className="eyebrow">Private client space</p>
          <h1 className="display-1 mt-3 text-brand-deep">Your account.</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Your secure Talk Space account will hold your profile, bookings and care documents as
            those features are added.
          </p>

          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
              <p className="eyebrow">Profile</p>
              {profileLoading ? (
                <div className="mt-3 space-y-3" role="status" aria-label="Loading profile">
                  <Skeleton className="h-7 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="mt-5 h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                </div>
              ) : (
                <>
                  <h2 className="mt-2 text-xl font-semibold text-brand-deep">
                    {fullName || "Talk Space client"}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">{email}</p>
                  <p className="mt-5 text-sm text-muted-foreground">
                    Profile creation is connected to the Supabase signup trigger.
                  </p>
                </>
              )}
            </div>
            <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
              <p className="eyebrow">Next step</p>
              <h2 className="mt-2 text-xl font-semibold text-brand-deep">Book a session</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Tell us what support would be most useful and our care team will respond within one
                working day.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button asChild className="bg-brand-deep text-white hover:bg-brand-deep/90">
                  <Link to="/book">Book a session</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/account/appointments">Manage appointments</Link>
                </Button>
              </div>
            </div>
          </div>

          {typeof window !== "undefined" &&
          new URLSearchParams(window.location.search).get("error") === "forbidden" ? (
            <p className="mt-6 rounded-lg bg-brand-blue-soft p-4 text-sm text-brand-deep">
              That area is restricted to Talk Space administrators.
            </p>
          ) : null}
          {notice ? <p className="mt-6 text-sm text-brand-deep">{notice}</p> : null}
          <Button type="button" variant="outline" onClick={signOut} className="mt-8">
            Sign out
          </Button>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
