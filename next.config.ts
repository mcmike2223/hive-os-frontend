import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const skipBuildTypecheck =
  process.env.NEXT_SKIP_BUILD_TYPECHECK === "1" ||
  process.env.NEXT_SKIP_BUILD_TYPECHECK === "true";

const trimTrailingSlashes = (value: string): string => value.replace(/\/+$/, "");

const getApiRoot = (): string => {
  const configured =
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:8081/api/v1";

  const normalized = trimTrailingSlashes(configured);

  return /\/api\/v1$/i.test(normalized)
    ? normalized
    : `${normalized}/api/v1`;
};

const getApiOrigin = (): string => {
  const apiRoot = getApiRoot();

  try {
    return new URL(apiRoot).origin;
  } catch {
    return apiRoot.replace(/\/api\/v1$/i, "");
  }
};

const allowedDevOrigins = Array.from(
  new Set(
    [
      "localhost",
      "127.0.0.1",
      "test.test",
      ...(process.env.NEXT_ALLOWED_DEV_ORIGINS?.split(",") ?? []),
    ]
      .map((origin) => origin.trim())
      .filter(Boolean),
  ),
);

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  typescript: {
    ignoreBuildErrors: skipBuildTypecheck,
  },
  allowedDevOrigins,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'",
          },
        ],
      },
    ];
  },

  async rewrites() {
    const apiRoot = getApiRoot();
    const apiOrigin = getApiOrigin();

    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiRoot}/:path*`,
      },
      {
        source: "/sanctum/:path*",
        destination: `${apiOrigin}/sanctum/:path*`,
      },
    ];
  },

  webpack(config) {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    return config;
  },
  turbopack: {},
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
