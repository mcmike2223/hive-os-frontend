import type { WebSocketRoute } from "@playwright/test";
import { expect, test } from "./fixtures";
import {
  attachDiagnostics,
  captureDiagnostics,
  frontendBaseUrl,
  loginAs,
  sameOriginJson,
  type WaiterFixtureManifest,
} from "./support";

type CreatedOrder = { id: number; items: Array<{ id: number; station_id: number }> };

const orderPayload = (fixture: WaiterFixtureManifest) => ({
  outlet_id: fixture.outlet_id,
  location_id: fixture.tables.unassigned,
  reservation_id: fixture.reservations.active_unassigned,
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
 * The kitchen display after the connection drops.
 *
 * A restaurant loses its wifi routinely, and a KDS that silently stops
 * receiving tickets after a blip is worse than one that never worked: the board
 * still looks correct while orders pile up unseen. The existing realtime
 * journey only proves delivery on a connection that was never interrupted.
 *
 * The drop is done by proxying the Reverb socket and closing it. The obvious
 * alternative, context.setOffline(true), was tried first and does not work:
 * Chromium leaves established WebSockets open, so no close ever fires and the
 * test passes without anything having been interrupted.
 *
 * The status change is driven from a second session on purpose. If the chef's
 * own page made the change, the board could update from local state and the
 * assertion would pass with the socket dead.
 */
test.describe("waiter POS kitchen display reconnect", () => {
  test("keeps receiving kitchen updates after the connection drops", async ({
    browser,
    waiterFixture,
  }, testInfo) => {
    const fixture = waiterFixture;
    const managerContext = await browser.newContext();
    const kitchenContext = await browser.newContext();
    const managerPage = await managerContext.newPage();
    const kitchenPage = await kitchenContext.newPage();
    const managerDiagnostics = captureDiagnostics(managerPage);
    const kitchenDiagnostics = captureDiagnostics(kitchenPage);

    // Proxy the realtime socket so it can be severed on demand, and so the
    // frames can be attributed to the connection that carried them.
    const frames: Array<{ connection: number; data: string }> = [];
    let connections = 0;
    let live: WebSocketRoute | null = null;

    await kitchenPage.routeWebSocket(
      (url) => url.pathname.startsWith("/app/"),
      (ws) => {
        const connection = connections;
        connections += 1;
        live = ws;

        const server = ws.connectToServer();
        server.onMessage((message) => {
          frames.push({ connection, data: typeof message === "string" ? message : message.toString() });
          ws.send(message);
        });
        ws.onMessage((message) => server.send(message));
      },
    );

    try {
      await Promise.all([
        loginAs(managerPage, fixture, "manager"),
        loginAs(kitchenPage, fixture, "chef"),
      ]);

      await Promise.all([
        managerPage.goto(`${frontendBaseUrl(fixture)}/dashboard/hospitality/waiter-pos`),
        kitchenPage.goto(`${frontendBaseUrl(fixture)}/dashboard/hospitality/kds`),
      ]);
      await expect(kitchenPage.getByRole("heading", { name: /Kitchen Display System/i })).toBeVisible();
      await expect.poll(() => connections, { timeout: 60_000 }).toBeGreaterThan(0);

      // Baseline: realtime works before anything is broken, so a later failure
      // is attributable to the reconnect rather than to setup.
      const created = await sameOriginJson(managerPage, "/api/v1/hospitality/waiter/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload(fixture)),
      });
      expect(created.status).toBe(201);

      const order = created.body as unknown as CreatedOrder;
      const itemId = order.items[0]!.id;
      const kdsItem = kitchenPage.getByTestId(`kds-item-${itemId}`);
      await expect(kdsItem).toBeVisible();

      // Sever it. The client is expected to notice and come back on its own,
      // with no reload and no help from the test.
      const connectionsBeforeDrop = connections;
      await live!.close();

      await expect
        .poll(() => connections, { timeout: 120_000 })
        .toBeGreaterThan(connectionsBeforeDrop);

      // Drive a change from the manager's session so the board can only learn
      // about it over the wire.
      const advanced = await sameOriginJson(managerPage, `/api/v1/hospitality/kds/items/${itemId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preparation_status: "accepted" }),
      });
      expect(advanced.status).toBe(200);

      // No reload anywhere in this test. If the subscription did not survive,
      // this is where a silently dead KDS is caught.
      await expect(kdsItem.getByRole("button", { name: "ACCEPTED" })).toBeVisible({ timeout: 60_000 });
      await kitchenPage.screenshot({ path: testInfo.outputPath("kds-after-reconnect.png") });

      // And the event must have arrived on a connection opened after the drop,
      // rather than being left over from the one that was closed.
      await expect
        .poll(
          () =>
            frames.some(
              (frame) => frame.connection >= connectionsBeforeDrop && frame.data.includes("kds.item.updated"),
            ),
          { timeout: 60_000 },
        )
        .toBe(true);
    } finally {
      await attachDiagnostics(testInfo, managerDiagnostics);
      await attachDiagnostics(testInfo, kitchenDiagnostics);
      await managerContext.close();
      await kitchenContext.close();
    }
  });
});
