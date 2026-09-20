import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { sentryTanstackStart } from "@sentry/tanstackstart-react/vite";
import { config as loadDotenv } from "dotenv";

loadDotenv({ quiet: true });

const sentryBuildPlugins =
  process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
    ? sentryTanstackStart({
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
      })
    : [];

export default defineConfig({
  plugins: [...sentryBuildPlugins],
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    css: { transformer: "postcss" },
    optimizeDeps: {
      include: [
        "@radix-ui/react-alert-dialog",
        "@radix-ui/react-checkbox",
        "@radix-ui/react-dropdown-menu",
        "@radix-ui/react-progress",
        "@radix-ui/react-radio-group",
        "@radix-ui/react-select",
        "@radix-ui/react-switch",
      ],
    },
    build: {
      cssMinify: false,
      rollupOptions: {
        external: ["playwright-core"],
        output: {
          // TanStack Start's server core otherwise splits across two chunks that
          // import each other, so `createCsrfMiddleware()` runs at module scope
          // before `createMiddleware` is initialised — every SSR request then
          // dies with "createMiddleware is not a function". Keeping the start
          // core in one chunk removes the cycle.
          advancedChunks: {
            groups: [
              {
                name: "tanstack-start-core",
                test: /@tanstack[\\/]start-(client|server)-core|createMiddleware/,
              },
            ],
          },
        },
      },
    },
  },
});
