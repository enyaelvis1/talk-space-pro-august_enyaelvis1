import * as Sentry from "@sentry/tanstackstart-react";

function sampleRate(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(1, Math.max(0, parsed));
}

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

if (dsn && typeof window !== "undefined") {
  const replaysSessionSampleRate = sampleRate(
    import.meta.env.VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE,
    0,
  );
  const replaysOnErrorSampleRate = sampleRate(
    import.meta.env.VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE,
    0,
  );

  Sentry.init({
    dsn,
    environment:
      (import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined) ?? import.meta.env.MODE,
    release: import.meta.env.VITE_SENTRY_RELEASE as string | undefined,
    tracesSampleRate: sampleRate(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE, 0.1),
    replaysSessionSampleRate,
    replaysOnErrorSampleRate,
    integrations:
      replaysSessionSampleRate > 0 || replaysOnErrorSampleRate > 0
        ? [Sentry.replayIntegration()]
        : [],
    dataCollection: {
      userInfo: false,
      httpBodies: [],
    },
  });
}
