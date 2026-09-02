import * as Sentry from "@sentry/nextjs";

const sentryEnabled = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);

export async function register() {
  if (!sentryEnabled) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Forwards React Server Component / route handler errors to Sentry.
export const onRequestError = sentryEnabled
  ? Sentry.captureRequestError
  : () => undefined;
