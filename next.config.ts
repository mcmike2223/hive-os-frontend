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
    "http://localhost:8085/api/v1";

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

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: skipBuildTypecheck,
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
  disableLogger: true,
});
