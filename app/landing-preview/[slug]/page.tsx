/**
 * Renders a published master template through the SAME React component the
 * tenant's public homepage uses, so the Landing Library preview shows the real
 * design instead of a generic approximation of the JSON body.
 *
 * Server-rendered on purpose: the headless-Chromium thumbnailer screenshots
 * this route from inside the Docker network, where the browser-facing
 * NEXT_PUBLIC_API_URL (localhost:8081) is unreachable. Fetching on the server
 * via INTERNAL_API_URL means the HTML arrives already populated.
 *
 * Chrome-free by design: no navbar, no dashboard shell — this page is only
 * ever embedded in an iframe or captured by the thumbnailer.
 */

import { notFound } from "next/navigation";

import { LandingPreviewClient, type PreviewPayload } from "./preview-client";

export const dynamic = "force-dynamic";

const apiRoot = () =>
  (process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://backend:8000/api/v1").replace(
    /\/+$/,
    "",
  );

export default async function LandingPreviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let payload: PreviewPayload | null = null;

  try {
    const res = await fetch(`${apiRoot()}/landing-templates/public/${encodeURIComponent(slug)}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (res.ok) {
      payload = ((await res.json()) as { data: PreviewPayload }).data;
    }
  } catch {
    payload = null;
  }

  if (!payload?.body) {
    notFound();
  }

  return <LandingPreviewClient payload={payload} />;
}
