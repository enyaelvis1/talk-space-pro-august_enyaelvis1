import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const errorParam = url.searchParams.get("error");
        if (errorParam) return html(`Google returned an error: ${escapeHtml(errorParam)}`, 400);
        if (!code || !state) return html("Missing code or state.", 400);

        try {
          const {
            verifyGoogleState,
            loadGoogleOAuthSettings,
            loadGoogleClientSecret,
            exchangeGoogleCode,
            fetchGoogleUserinfo,
            persistTherapistTokens,
            absoluteOrigin,
          } = await import("@/lib/google.server");
          const verified = verifyGoogleState(state);
          if (!verified)
            return html("Invalid or expired connection request. Please try again.", 400);
          const settings = await loadGoogleOAuthSettings();
          const secret = await loadGoogleClientSecret();
          if (!settings.clientId || !secret)
            return html("Google integration is not configured.", 500);
          const redirectUri = `${absoluteOrigin(request)}${settings.redirectPath}`;
          const tokens = await exchangeGoogleCode({
            clientId: settings.clientId,
            clientSecret: secret,
            code,
            redirectUri,
          });
          const info = await fetchGoogleUserinfo(tokens.access_token);
          await persistTherapistTokens({
            therapistId: verified.therapistId,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresIn: tokens.expires_in ?? 3600,
            email: info.email,
          });

          // Kick off an initial busy sync and register a push channel so
          // future calendar edits stream in via /api/public/google/push.
          try {
            const { syncTherapistBusyBlocks, watchCalendar, signPushToken } =
              await import("@/lib/google.server");
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            await syncTherapistBusyBlocks(verified.therapistId);
            const callbackUrl = `${absoluteOrigin(request)}/api/public/google/push`;
            const watch = await watchCalendar(verified.therapistId, {
              callbackUrl,
              token: signPushToken(verified.therapistId),
              ttlSeconds: 7 * 24 * 3600,
            });
            await supabaseAdmin
              .from("therapist_google_connections")
              .update({
                sync_channel_id: watch.channelId,
                sync_resource_id: watch.resourceId,
                sync_expires_at: watch.expiresAt,
              })
              .eq("therapist_id", verified.therapistId);
          } catch (err) {
            console.error("[google/callback] initial sync/watch failed:", err);
          }
          return html(
            `<h1>Google connected</h1><p>${escapeHtml(info.email ?? "")} is now linked. You can close this window and return to Talk Space.</p><script>setTimeout(()=>{try{window.close();}catch(e){}},1500);</script>`,
            200,
          );
        } catch (err) {
          console.error("[google/callback] failed:", err);
          return html(`Google connection failed: ${escapeHtml((err as Error).message)}`, 500);
        }
      },
    },
  },
});

function html(body: string, status: number) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>Google connect</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui,-apple-system,sans-serif;max-width:640px;margin:6vh auto;padding:0 20px;color:#0f172a;line-height:1.5}</style></head><body>${body}</body></html>`,
    {
      status,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    },
  );
}

function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
