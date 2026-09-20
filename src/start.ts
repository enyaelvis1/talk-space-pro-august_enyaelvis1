import { createStart, createMiddleware, createCsrfMiddleware } from "@tanstack/react-start";
import * as Sentry from "@sentry/tanstackstart-react";

import { describeError, renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    Sentry.captureException(error, {
      tags: { surface: "tanstack_start_request_middleware" },
    });
    console.error(error);
    return new Response(renderErrorPage(describeError(error)), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Webhooks and OAuth callbacks have separate signature/state checks.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  functionMiddleware: [Sentry.sentryGlobalFunctionMiddleware, attachSupabaseAuth],
  requestMiddleware: [csrfMiddleware, Sentry.sentryGlobalRequestMiddleware, errorMiddleware],
}));
