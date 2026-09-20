// Google Calendar push-notification webhook.
// Google POSTs here whenever a watched calendar changes. We look up the
// therapist by channel/resource id, verify the shared token, then re-sync
// their busy blocks into availability_exceptions.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/google/push")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const channelId = request.headers.get("x-goog-channel-id");
        const resourceId = request.headers.get("x-goog-resource-id");
        const resourceState = request.headers.get("x-goog-resource-state");
        const token = request.headers.get("x-goog-channel-token") ?? "";

        if (!channelId || !resourceId) {
          return new Response("Missing channel headers", { status: 400 });
        }

        // "sync" is the initial handshake message — acknowledge, no work.
        if (resourceState === "sync") return new Response(null, { status: 200 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: conn } = await supabaseAdmin
          .from("therapist_google_connections")
          .select("therapist_id, sync_resource_id")
          .eq("sync_channel_id", channelId)
          .maybeSingle();

        if (!conn) return new Response("Unknown channel", { status: 404 });
        if (conn.sync_resource_id && conn.sync_resource_id !== resourceId) {
          return new Response("Resource mismatch", { status: 400 });
        }

        const { verifyPushToken, syncTherapistBusyBlocks } = await import("@/lib/google.server");
        const therapistId = conn.therapist_id as string;
        if (!verifyPushToken(therapistId, token)) {
          return new Response("Invalid token", { status: 401 });
        }

        // Ack Google quickly; kick off sync but don't fail the webhook if it errors.
        try {
          await syncTherapistBusyBlocks(therapistId);
        } catch (err) {
          console.error("[google/push] sync failed:", err);
        }
        return new Response(null, { status: 200 });
      },
    },
  },
});
