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
    variant_id: number;
    required_modifier_option_id: number;
    optional_modifier_option_id: number;
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

  await page.goto(`${frontendBaseUrl(fixture)}/sign-in`);
  await page.locator("#email").fill(user.email);
  await page.locator("#password").fill(user.password);
  await page.getByRole("button", { name: /initiate handshake/i }).click();
  await page.waitForURL(/\/dashboard(?:$|\?)/);
}

export const frontendBaseUrl = (fixture: WaiterFixtureManifest): string =>
  (process.env.HIVE_E2E_FRONTEND_URL ?? fixture.frontend_url).replace(/\/$/, "");

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
