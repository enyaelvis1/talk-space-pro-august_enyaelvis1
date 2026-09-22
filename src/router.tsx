import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import * as Sentry from "@sentry/tanstackstart-react";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Avoid sending a second Vercel request for the same route when a user
    // briefly hovers a navigation link before clicking it. Public loaders are
    // still revalidated after this short window, while protected mutations
    // remain explicit and are not affected by this preload cache.
    defaultPreloadStaleTime: 30_000,
  });

  if (!router.isServer) {
    Sentry.addIntegration(Sentry.tanstackRouterBrowserTracingIntegration(router));
  }

  return router;
};
