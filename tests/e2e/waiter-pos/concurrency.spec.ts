import { expect, test } from "./fixtures";
import {
  attachDiagnostics,
  captureDiagnostics,
  frontendBaseUrl,
  loginAs,
  sameOriginJson,
  type WaiterFixtureManifest,
} from "./support";

const ORDERS_PATH = "/api/v1/hospitality/waiter/orders";

const backendBaseUrl = () =>
  (process.env.HIVE_E2E_BACKEND_URL ?? "http://localhost:8081").replace(/\/$/, "");

const payloadFor = (fixture: WaiterFixtureManifest, locationId: number, reservationId?: number) => ({
  outlet_id: fixture.outlet_id,
  location_id: locationId,
  ...(reservationId ? { reservation_id: reservationId } : {}),
  order_type_code: "dine_in",
  guest_count: 2,
  items: [{
    menu_item_id: fixture.menu.item_id,
    item_name: fixture.menu.item_name,
    quantity: 1,
    variant_id: fixture.menu.variant_id,
    modifier_option_ids: [fixture.menu.required_modifier_option_id],
    seat_number: 1,
    course_number: 1,
  }],
});

/**
 * Submission integrity under conditions the happy path never reaches.
 *
 * Two scenarios that retry-history does not cover. That journey replays a
 * request whose response the client already received; these are the cases where
 * the client never learns what the server did:
 *
 *   1. Two identical submissions genuinely in flight at the same time under one
 *      idempotency key. Sequential replay proves nothing about a real race.
 *   2. A submission whose response is destroyed after the server committed it,
 *      then retried. The client cannot know an order exists; the server must.
 *
 * Each runs on its own table because only one order may be open per table, and
 * the fixture tenant is per-journey, so the closing count assertion is exact:
 * two tables, two orders, no duplicates from either scenario.
 */
test.describe("waiter POS submission integrity under concurrency", () => {
  test("creates exactly one order per table under a same-key race and a lost response", async ({
    browser,
    waiterFixture,
  }, testInfo) => {
    const fixture = waiterFixture;
    const managerContext = await browser.newContext();
    const waiterContext = await browser.newContext();
    const managerPage = await managerContext.newPage();
    const waiterPage = await waiterContext.newPage();
    const managerDiagnostics = captureDiagnostics(managerPage);
    const waiterDiagnostics = captureDiagnostics(waiterPage);

    try {
      await Promise.all([
        loginAs(managerPage, fixture, "manager"),
        loginAs(waiterPage, fixture, "waiter"),
      ]);

      const posUrl = `${frontendBaseUrl(fixture)}/dashboard/hospitality/waiter-pos`;
      await Promise.all([managerPage.goto(posUrl), waiterPage.goto(posUrl)]);
      await expect(waiterPage.getByRole("heading", { name: "Restaurant Waiter POS" })).toBeVisible();

      // A per-journey tenant starts with no service orders at all, which is what
      // makes the closing count meaningful rather than a delta.
      const baseline = await sameOriginJson(managerPage, "/api/v1/hospitality/service-orders");
      expect(baseline.status).toBe(200);
      expect(countOrders(baseline.body)).toBe(0);

      // ---- Scenario 1: a genuine same-key race -------------------------------
      const raceKey = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
      const racePayload = payloadFor(
        fixture,
        fixture.tables.unassigned,
        fixture.reservations.active_unassigned,
      );

      const raceResults = await managerPage.evaluate(
        async ({ path, key, payload }) => {
          const token = window.localStorage.getItem("hive_token");
          const context = window.localStorage.getItem("hive_context");
          const signature = window.localStorage.getItem("hive_context_signature");
          const send = async () => {
            const response = await fetch(path, {
              method: "POST",
              headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                "X-Idempotency-Key": key,
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(context ? { "X-Tenant": context } : {}),
                ...(signature ? { "X-Tenant-Signature": signature } : {}),
              },
              body: JSON.stringify(payload),
            });
            const text = await response.text();
            let id: number | null = null;
            try {
              const parsed = JSON.parse(text) as { id?: number; data?: { id?: number } };
              id = parsed.id ?? parsed.data?.id ?? null;
            } catch {
              id = null;
            }
            return { status: response.status, id };
          };

          // Both requests are started before either is awaited, so they are in
          // flight together rather than merely issued back to back.
          return Promise.all([send(), send()]);
        },
        { path: ORDERS_PATH, key: raceKey, payload: racePayload },
      );

      // Whatever the pair of status codes turns out to be, the invariant is that
      // the race resolves to a single order. Two distinct ids here would mean a
      // guest is billed twice and the kitchen cooks twice.
      const raceIds = raceResults.map((result) => result.id).filter((id): id is number => id !== null);
      expect(raceIds.length).toBeGreaterThan(0);
      expect(new Set(raceIds).size).toBe(1);
      for (const result of raceResults) {
        expect([200, 201, 409]).toContain(result.status);
      }

      const afterRace = await sameOriginJson(managerPage, "/api/v1/hospitality/service-orders");
      expect(countOrders(afterRace.body)).toBe(1);

      // ---- Scenario 2: the server commits, the client never finds out --------
      let interceptions = 0;
      const routeLog: string[] = [];
      await waiterPage.route(`**${ORDERS_PATH}`, async (route) => {
        routeLog.push(`saw ${route.request().method()} ${route.request().url()}`);
        if (interceptions === 0) {
          interceptions += 1;
          // Let it reach the server and commit, then destroy the response so the
          // client is left genuinely uncertain rather than merely slow.
          //
          // The replay is aimed at the backend directly rather than the page
          // origin: route.fetch runs in Node, and Node does not resolve the
          // *.localhost tenant subdomains that the browser resolves for free.
          // Every credential this needs is already on the intercepted request.
          const original = new URL(route.request().url());
          try {
            const response = await route.fetch({
              url: `${backendBaseUrl()}${original.pathname}${original.search}`,
            });
            routeLog.push(`committed ${response.status()}`);
          } catch (error) {
            routeLog.push(`fetch failed: ${String(error).slice(0, 200)}`);
          }
          await route.abort("connectionfailed");
          routeLog.push("response destroyed");

          return;
        }
        routeLog.push("passed through");
        await route.continue();
      });

      const lostKey = "3f2504e0-4f89-41d3-9a0c-0305e82c3302";
      const lostPayload = payloadFor(fixture, fixture.tables.assigned);

      const interrupted = await postCatching(waiterPage, lostKey, lostPayload);
      const trace = () => `route log: ${routeLog.join(" | ")} (status ${interrupted.status})`;

      // The client never sees the real response. The offline interceptor turns
      // the transport failure into a synthetic 202 and queues the write for
      // replay, so the waiter is told the order was accepted.
      expect(interceptions, trace()).toBe(1);
      expect(interrupted.status, trace()).toBe(202);
      expect(interrupted.queued, trace()).toBe(true);

      // The server committed the order anyway. This is the state the queue can
      // never distinguish on its own: a network error looks identical whether
      // the server saw the request or not.
      const afterLoss = await sameOriginJson(managerPage, "/api/v1/hospitality/service-orders");
      expect(countOrders(afterLoss.body)).toBe(2);

      // So the queued replay has to carry the original idempotency key. It is
      // the one header that cannot be re-derived at flush time, and without it
      // the replay below opens a second order for a submission the server has
      // already committed.
      const queued = await readQueuedOrder(waiterPage);
      expect(queued, "the interrupted order should have been queued for offline sync").not.toBeNull();
      expect(headerValue(queued!.headers, "x-idempotency-key")).toBe(lostKey);

      // Replayed exactly as the queue processor replays it: the persisted
      // headers, with auth re-applied fresh.
      const replay = await replayQueued(waiterPage, queued!);
      expect([200, 201]).toContain(replay.status);

      // The assertion the whole scenario exists for. Three orders here means a
      // guest billed twice and a kitchen cooking twice, from one submission on
      // a flaky connection.
      const afterReplay = await sameOriginJson(managerPage, "/api/v1/hospitality/service-orders");
      expect(countOrders(afterReplay.body)).toBe(2);
    } finally {
      await attachDiagnostics(testInfo, managerDiagnostics);
      await attachDiagnostics(testInfo, waiterDiagnostics);
      await managerContext.close();
      await waiterContext.close();
    }
  });
});

function countOrders(body: Record<string, unknown>): number {
  const data = body.data;
  if (Array.isArray(data)) {
    return data.length;
  }
  const meta = body.meta as { total?: number } | undefined;
  if (typeof meta?.total === "number") {
    return meta.total;
  }
  if (Array.isArray(body)) {
    return (body as unknown[]).length;
  }
  throw new Error(`Unrecognised service-orders payload: ${JSON.stringify(body).slice(0, 300)}`);
}

type QueuedRequest = { url: string; headers: Record<string, string>; data: unknown };

function headerValue(headers: Record<string, string>, name: string): string | undefined {
  const match = Object.keys(headers).find((key) => key.toLowerCase() === name.toLowerCase());

  return match ? headers[match] : undefined;
}

/**
 * Finds the queued order in whichever tenant-scoped localStorage bucket the
 * offline queue is using, without reproducing its key-derivation logic here.
 */
async function readQueuedOrder(
  page: Parameters<typeof sameOriginJson>[0],
): Promise<QueuedRequest | null> {
  return page.evaluate((ordersPath) => {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const storageKey = window.localStorage.key(index);
      if (!storageKey) continue;
      const raw = window.localStorage.getItem(storageKey);
      if (!raw || !raw.includes(ordersPath)) continue;
      try {
        const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
        if (!Array.isArray(parsed)) continue;
        const item = parsed.find(
          (entry) => typeof entry?.url === "string" && (entry.url as string).includes(ordersPath),
        );
        if (item) {
          return {
            url: item.url as string,
            headers: (item.headers ?? {}) as Record<string, string>,
            data: item.data,
          };
        }
      } catch {
        /* not a queue bucket */
      }
    }

    return null;
  }, ORDERS_PATH);
}

/** Replays a queued item the way the queue processor does: persisted headers, fresh auth. */
async function replayQueued(
  page: Parameters<typeof sameOriginJson>[0],
  item: QueuedRequest,
): Promise<{ status: number }> {
  return page.evaluate(async ({ url, headers, data }) => {
    const token = window.localStorage.getItem("hive_token");
    const context = window.localStorage.getItem("hive_context");
    const signature = window.localStorage.getItem("hive_context_signature");
    // Auth and tenant headers are re-applied fresh at flush time, so the
    // persisted copies are dropped rather than merged. Keeping both would let
    // Headers join two casings of the same name into one comma-joined value.
    const carried = Object.fromEntries(
      Object.entries(headers).filter(([name]) => {
        const lower = name.toLowerCase();

        return !lower.startsWith("x-tenant") && lower !== "authorization";
      }),
    );

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...carried,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(context ? { "X-Tenant": context } : {}),
        ...(signature ? { "X-Tenant-Signature": signature } : {}),
      },
      body: JSON.stringify(data),
    });

    return { status: response.status };
  }, item);
}

async function postCatching(
  page: Parameters<typeof sameOriginJson>[0],
  idempotencyKey: string,
  payload: Record<string, unknown>,
): Promise<{ failed: boolean; status: number | null; queued: boolean }> {
  return page.evaluate(
    async ({ path, key, body }) => {
      const token = window.localStorage.getItem("hive_token");
      const context = window.localStorage.getItem("hive_context");
      const signature = window.localStorage.getItem("hive_context_signature");
      try {
        const response = await fetch(path, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-Idempotency-Key": key,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(context ? { "X-Tenant": context } : {}),
            ...(signature ? { "X-Tenant-Signature": signature } : {}),
          },
          body: JSON.stringify(body),
        });

        let queued = false;
        try {
          const parsed = JSON.parse(await response.text()) as { __offlineQueued?: boolean };
          queued = parsed.__offlineQueued === true;
        } catch {
          queued = false;
        }

        return { failed: false, status: response.status, queued };
      } catch {
        return { failed: true, status: null, queued: false };
      }
    },
    { path: ORDERS_PATH, key: idempotencyKey, body: payload },
  );
}
