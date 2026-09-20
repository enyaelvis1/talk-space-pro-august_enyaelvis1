import * as Sentry from "@sentry/tanstackstart-react";

function sampleRate(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(1, Math.max(0, parsed));
}

const dsn = process.env.SENTRY_DSN || process.env.VITE_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "production",
    release:
      process.env.SENTRY_RELEASE ||
      process.env.VERCEL_GIT_COMMIT_SHA ||
      process.env.CF_PAGES_COMMIT_SHA,
    tracesSampleRate: sampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE, 0.1),
    enableLogs: process.env.SENTRY_ENABLE_LOGS === "true",
    dataCollection: {
      userInfo: false,
      httpBodies: [],
    },
  });
}
