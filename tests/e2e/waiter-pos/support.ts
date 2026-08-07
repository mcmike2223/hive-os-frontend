import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Page, TestInfo } from "@playwright/test";

const frontendRoot = process.cwd();
const runtimePath = path.join(frontendRoot, ".playwright", "fixtures", "waiter-pos-runtime.json");

export type WaiterFixtureManifest = {
  fixture_id: string;
  tenant_id: string;
  frontend_url: string;
  outlet_id: number;
  tables: { assigned: number; unassigned: number };
  reservations: { active_unassigned: number };
  stations: { kitchen: number; bar: number };
  menu: {
    item_id: number;
    item_name: string;
    variant_id: number;
    required_modifier_option_id: number;
    optional_modifier_option_id: number;
    // Routed to the bar rather than the kitchen, and carries no modifier
    // groups. Two distinct items are required to build a two-course order,
    // because the cart merges a repeated item into one line by quantity.
    second_item_id: number;
    second_item_name: string;
  };
  users: Record<string, { email: string; password: string }>;
};

type DiagnosticState = {
  console: Array<{ type: string; text: string }>;
  failedRequests: Array<{ url: string; failure: string | null }>;
  webSockets: Array<{
    url: string;
    received: string[];
    sent: string[];
    errors: string[];
  }>;
};

export async function loadFixture(): Promise<WaiterFixtureManifest> {
  const runtime = JSON.parse(await readFile(runtimePath, "utf8")) as { manifestPath: string };

  return JSON.parse(await readFile(runtime.manifestPath, "utf8")) as WaiterFixtureManifest;
}

export async function loginAs(
  page: Page,
  fixture: WaiterFixtureManifest,
  role: keyof WaiterFixtureManifest["users"],
): Promise<void> {
  const user = fixture.users[role];
  if (!user) {
    throw new Error(`Fixture did not provide the ${role} user.`);
  }

  // The first journey against a freshly restarted stack can bounce straight
  // back to /sign-in: the tenant host is new to the dev server and the backend
  // is still warming, so the submitted credentials land before the app is ready
  // to establish the session. That is a cold-start race, not a rejected login,
  // and it resolves on a second attempt. Still require reaching the dashboard —
  // only the number of attempts is relaxed, never the outcome.
  const attempts = 2;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    await page.goto(`${frontendBaseUrl(fixture)}/sign-in`);
    // The sign-in form is client-rendered, so wait for it to exist rather than
    // letting the default action timeout expire mid-compile.
    await page.locator("#email").waitFor({ state: "visible", timeout: 90_000 });
    await page.locator("#password").waitFor({ state: "visible", timeout: 30_000 });
    await page.locator("#email").fill(user.email);
    await page.locator("#password").fill(user.password);
    await page.getByRole("button", { name: /initiate handshake/i }).click();

    try {
      await page.waitForURL(/\/dashboard(?:$|\?)/, { timeout: 45_000 });

      return;
    } catch (error) {
      if (attempt === attempts) {
        throw error;
      }
    }
  }
}

/**
 * Every journey now gets its own tenant, so the host is per-fixture and cannot
 * be replaced wholesale. HIVE_E2E_FRONTEND_URL still overrides everything for
 * the single-fixture case, but the production-history journey needs the tenant's
 * own host on a *different port* — a production `next start` running beside the
 * dev server — so HIVE_E2E_FRONTEND_PORT overrides only the port and leaves
 * tenant resolution intact.
 */
export const frontendBaseUrl = (fixture: WaiterFixtureManifest): string => {
  const override = process.env.HIVE_E2E_FRONTEND_URL;

  if (override) {
    return override.replace(/\/$/, "");
  }

  const base = fixture.frontend_url.replace(/\/$/, "");
  const port = process.env.HIVE_E2E_FRONTEND_PORT;

  if (!port) {
    return base;
  }

  const url = new URL(base);
  url.port = port;

  return url.toString().replace(/\/$/, "");
};

export function captureDiagnostics(page: Page): DiagnosticState {
  const diagnostic: DiagnosticState = {
    console: [],
    failedRequests: [],
    webSockets: [],
  };

  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      diagnostic.console.push({ type: message.type(), text: message.text() });
    }
  });
  page.on("requestfailed", (request) => {
    diagnostic.failedRequests.push({
      url: request.url(),
      failure: request.failure()?.errorText ?? null,
    });
  });
  page.on("websocket", (socket) => {
    const record = { url: socket.url(), received: [] as string[], sent: [] as string[], errors: [] as string[] };
    diagnostic.webSockets.push(record);
    socket.on("framereceived", (event) => record.received.push(redactSocketFrame(String(event.payload).slice(0, 4_096))));
    socket.on("framesent", (event) => record.sent.push(redactSocketFrame(String(event.payload).slice(0, 512))));
    socket.on("socketerror", (error) => record.errors.push(error));
  });

  return diagnostic;
}

function redactSocketFrame(frame: string): string {
  return frame
    .replace(/("auth"\s*:\s*")[^"]+("?)/gi, '$1[redacted]$2')
    .replace(/("authorization"\s*:\s*")[^"]+("?)/gi, '$1[redacted]$2');
}

export async function attachDiagnostics(testInfo: TestInfo, diagnostic: DiagnosticState): Promise<void> {
  await testInfo.attach("browser-diagnostics.json", {
    body: JSON.stringify(diagnostic, null, 2),
    contentType: "application/json",
  });
}

export async function sameOriginStatus(page: Page, path: string, init: RequestInit = {}): Promise<number> {
  return page.evaluate(
    async ({ path: requestPath, init: requestInit }) => {
      const token = window.localStorage.getItem("hive_token");
      const context = window.localStorage.getItem("hive_context");
      const signature = window.localStorage.getItem("hive_context_signature");
      const response = await fetch(requestPath, {
        ...requestInit,
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(context ? { "X-Tenant": context } : {}),
          ...(signature ? { "X-Tenant-Signature": signature } : {}),
          ...(requestInit.headers ?? {}),
        },
      });

      return response.status;
    },
    { path, init },
  );
}

/**
 * Same as sameOriginStatus but keeps the decoded body, so idempotent replay can
 * be checked by comparing the order the server actually returned rather than by
 * trusting a status code alone.
 */
export async function sameOriginJson(
  page: Page,
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  return page.evaluate(
    async ({ path: requestPath, init: requestInit }) => {
      const token = window.localStorage.getItem("hive_token");
      const context = window.localStorage.getItem("hive_context");
      const signature = window.localStorage.getItem("hive_context_signature");
      const response = await fetch(requestPath, {
        ...requestInit,
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(context ? { "X-Tenant": context } : {}),
          ...(signature ? { "X-Tenant-Signature": signature } : {}),
          ...(requestInit.headers ?? {}),
        },
      });

      let body: Record<string, unknown> = {};
      try {
        body = (await response.json()) as Record<string, unknown>;
      } catch {
        body = {};
      }

      return { status: response.status, body };
    },
    { path, init },
  );
}

export const websocketReceived = (diagnostic: DiagnosticState, eventName: string): boolean =>
  diagnostic.webSockets.some((socket) => socket.received.some((frame) => frame.includes(eventName)));

export const websocketEventPayloads = (diagnostic: DiagnosticState, eventName: string): Record<string, unknown>[] =>
  diagnostic.webSockets.flatMap((socket) => socket.received.flatMap((frame) => {
    try {
      const message = JSON.parse(frame) as { event?: string; data?: string | Record<string, unknown> };
      if (message.event !== eventName) {
        return [];
      }

      const payload = typeof message.data === "string" ? JSON.parse(message.data) : message.data;

      return payload && typeof payload === "object" ? [payload] : [];
    } catch {
      return [];
    }
  }));
