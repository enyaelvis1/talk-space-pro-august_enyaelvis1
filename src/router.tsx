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
    // Do not turn navigation intent/hover into a Vercel request. Route loads
    // remain explicit, while protected mutations are unaffected by this policy.
    defaultPreload: false,
    // Keep a bounded reuse window if a route opts into preloading explicitly.
    defaultPreloadStaleTime: 30_000,
  });

  if (!router.isServer) {
    Sentry.addIntegration(Sentry.tanstackRouterBrowserTracingIntegration(router));
  }

  return router;
};
