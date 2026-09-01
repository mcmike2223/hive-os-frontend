import type { NextRequest } from "next/server";

const trimTrailingSlashes = (value: string): string => value.replace(/\/+$/, "");

const getBackendOrigin = (): string => {
  const configured =
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:8081/api/v1";

  try {
    return new URL(configured).origin;
  } catch {
    return trimTrailingSlashes(configured).replace(/\/api\/v1$/i, "");
  }
};

const getPublicOrigin = (request: NextRequest): string => {
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    request.nextUrl.host;
  const protocol =
    request.headers.get("x-forwarded-proto") ||
    request.nextUrl.protocol.replace(":", "");

  return `${protocol}://${host}`;
};

const proxyDocs = async (
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) => {
  const { path = [] } = await context.params;
  const backendOrigin = getBackendOrigin();
  const docsPath = path.length ? `/hivedocs/${path.join("/")}` : "/hivedocs/";
  const targetUrl = new URL(`${backendOrigin}${docsPath}`);
  targetUrl.search = request.nextUrl.search;

  const upstream = await fetch(targetUrl, {
    headers: {
      accept: request.headers.get("accept") ?? "*/*",
      cookie: request.headers.get("cookie") ?? "",
      "user-agent": request.headers.get("user-agent") ?? "Hive frontend docs proxy",
    },
    redirect: "manual",
    cache: "no-store",
  });

  const headers = new Headers(upstream.headers);
  headers.delete("content-encoding");
  headers.delete("content-length");
  headers.delete("transfer-encoding");

  const publicDocsBase = `${getPublicOrigin(request)}/hivedocs`;
  const location = headers.get("location");
  if (location) {
    headers.set(
      "location",
      location
        .replace(`${backendOrigin}/hivedocs`, publicDocsBase)
        .replace("http://localhost:8081/hivedocs", publicDocsBase),
    );
  }

  const contentType = headers.get("content-type") ?? "";
  if (contentType.includes("text/html")) {
    const html = (await upstream.text())
      .replaceAll(`${backendOrigin}/hivedocs`, publicDocsBase)
      .replaceAll("http://localhost:8081/hivedocs", publicDocsBase);

    return new Response(html, {
      status: upstream.status,
      headers,
    });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
};

export const dynamic = "force-dynamic";
export const GET = proxyDocs;
export const HEAD = proxyDocs;
