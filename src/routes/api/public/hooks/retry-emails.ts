import { createFileRoute } from "@tanstack/react-router";

import { verifyCronRequest } from "@/lib/cron-auth";

async function retryEmails(request: Request) {
  const unauthorized = verifyCronRequest(request);
  if (unauthorized) return unauthorized;
  const { processDueEmailRetries } = await import("@/lib/email.server");
  return Response.json({ ok: true, ...(await processDueEmailRetries()) });
}

export const Route = createFileRoute("/api/public/hooks/retry-emails")({
  server: {
    handlers: {
      POST: ({ request }) => retryEmails(request),
      GET: ({ request }) => retryEmails(request),
    },
  },
});
