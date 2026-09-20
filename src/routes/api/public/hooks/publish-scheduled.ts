import { createFileRoute } from "@tanstack/react-router";

import { verifyCronRequest } from "@/lib/cron-auth";

async function runPublishScheduled() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("publish_scheduled_content");
  if (error) throw error;
  return { count: Number(data ?? 0) };
}

async function handlePublishScheduled(request: Request) {
  const unauthorized = verifyCronRequest(request);
  if (unauthorized) return unauthorized;
  try {
    const result = await runPublishScheduled();
    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

export const Route = createFileRoute("/api/public/hooks/publish-scheduled")({
  server: {
    handlers: {
      POST: ({ request }) => handlePublishScheduled(request),
      GET: ({ request }) => handlePublishScheduled(request),
    },
  },
});
