import { createFileRoute } from "@tanstack/react-router";

import { verifyCronRequest } from "@/lib/cron-auth";

async function refreshGoogleReviews(request: Request) {
  const unauthorized = verifyCronRequest(request);
  if (unauthorized) return unauthorized;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { refreshGoogleReviewsWithClient } = await import("@/lib/admin.functions");

  try {
    const result = await refreshGoogleReviewsWithClient(supabaseAdmin);
    return Response.json({
      ok: true,
      imported: result.imported,
      error: result.error || null,
      message: "Google reviews refresh completed",
    });
  } catch (error) {
    console.error("[cron] refresh-google-reviews failed", error);
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export const Route = createFileRoute("/api/public/hooks/refresh-google-reviews")({
  server: {
    handlers: {
      POST: ({ request }) => refreshGoogleReviews(request),
      GET: ({ request }) => refreshGoogleReviews(request),
    },
  },
});
