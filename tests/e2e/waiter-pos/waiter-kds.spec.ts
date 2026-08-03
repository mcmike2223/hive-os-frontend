import { expect, test } from "@playwright/test";
import {
  attachDiagnostics,
  captureDiagnostics,
  frontendBaseUrl,
  loadFixture,
  loginAs,
  websocketEventPayloads,
  websocketReceived,
} from "./support";

type CreatedOrder = {
  id: number;
  outlet_id: number;
  location_id: number;
  items: Array<{
    id: number;
    menu_item_id: number;
    station_id: number;
    seat_number: number;
    course_number: number;
    notes: string;
    pricing_snapshot: {
      variant: { id: number };
      modifiers: Array<{ id: number }>;
    };
  }>;
};

test.describe("waiter POS and KDS isolated browser acceptance", () => {
  test("submits one server-authoritative order and receives KDS realtime updates", async ({ browser }, testInfo) => {
    const fixture = await loadFixture();
    const waiterContext = await browser.newContext();
    const kitchenContext = await browser.newContext();
    const waiterPage = await waiterContext.newPage();
    const kitchenPage = await kitchenContext.newPage();
    const waiterDiagnostics = captureDiagnostics(waiterPage);
    const kitchenDiagnostics = captureDiagnostics(kitchenPage);

    try {
      await Promise.all([
        loginAs(waiterPage, fixture, "waiter"),
        loginAs(kitchenPage, fixture, "chef"),
      ]);

      await Promise.all([
        waiterPage.goto(`${frontendBaseUrl(fixture)}/dashboard/hospitality/waiter-pos`),
        kitchenPage.goto(`${frontendBaseUrl(fixture)}/dashboard/hospitality/kds`),
      ]);

      await expect(waiterPage.getByRole("heading", { name: "Restaurant Waiter POS" })).toBeVisible();
      await expect(waiterPage.getByText("A-01 Assigned", { exact: true })).toBeVisible();
      await expect(waiterPage.getByText("A-02 Unassigned", { exact: true })).toHaveCount(0);
      await expect(waiterPage.getByText(/Live kitchen updates: connected/i)).toBeVisible();
      await expect(kitchenPage.getByRole("heading", { name: /Kitchen Display System/i })).toBeVisible();
      await expect(kitchenPage.getByText(/Live intake: connected/i)).toBeVisible();

      await waiterPage.getByText("A-01 Assigned", { exact: true }).click();
      await waiterPage.getByLabel("Search menu").fill("Acceptance Grilled Tibs");
      const menuCard = waiterPage.locator("article", { hasText: "Acceptance Grilled Tibs" });
      await menuCard.locator("select").selectOption(String(fixture.menu.variant_id));
      await menuCard.getByLabel("Injera").check();
      await menuCard.getByLabel("Extra Injera").check();
      await menuCard.getByRole("button", { name: /Add to order/i }).click();
      await waiterPage.screenshot({ path: testInfo.outputPath("assigned-table-configured-cart.png") });

      const cart = waiterPage.getByRole("complementary", { name: /Order Draft/i });
      await cart.getByLabel("Guests").fill("2");
      await cart.getByLabel("Seat").fill("1");
      await cart.getByLabel("Course").fill("1");
      await cart.getByLabel("Kitchen note").fill("Playwright acceptance note");

      let waiterOrderRequests = 0;
      waiterPage.on("request", (request) => {
        if (request.method() === "POST" && request.url().includes("/hospitality/waiter/orders")) {
          waiterOrderRequests += 1;
        }
      });
      const orderResponse = waiterPage.waitForResponse(
        (response) => response.request().method() === "POST" && response.url().includes("/hospitality/waiter/orders"),
      );
      await cart.getByRole("button", { name: /Submit order to kitchen/i }).dblclick();
      const submitted = await orderResponse;
      expect(submitted.status()).toBe(201);
      const createdOrder = await submitted.json() as CreatedOrder;
      const createdItem = createdOrder.items[0];
      expect(createdOrder.outlet_id).toBe(fixture.outlet_id);
      expect(createdOrder.location_id).toBe(fixture.tables.assigned);
      expect(createdItem.menu_item_id).toBe(fixture.menu.item_id);
      expect(createdItem.station_id).toBe(fixture.stations.kitchen);
      expect(createdItem.seat_number).toBe(1);
      expect(createdItem.course_number).toBe(1);
      expect(createdItem.notes).toBe("Playwright acceptance note");
      expect(createdItem.pricing_snapshot.variant.id).toBe(fixture.menu.variant_id);
      expect(createdItem.pricing_snapshot.modifiers.map((modifier) => modifier.id)).toEqual(expect.arrayContaining([
        fixture.menu.required_modifier_option_id,
        fixture.menu.optional_modifier_option_id,
      ]));
      await expect(waiterPage.getByText(/Restaurant order sent to the kitchen/i)).toBeVisible();
      await expect(cart.getByText(/Draft order is empty/i)).toBeVisible();
      expect(waiterOrderRequests).toBe(1);
      await waiterPage.screenshot({ path: testInfo.outputPath("waiter-order-success.png") });

      await expect(waiterPage.getByText(/Table A-01 Assigned changed from available to occupied/i)).toBeVisible();
      await expect(kitchenPage.getByText("Acceptance Grilled Tibs", { exact: true })).toBeVisible();
      await kitchenPage.screenshot({ path: testInfo.outputPath("kds-new-item.png") });

      const kdsStatusButton = kitchenPage.getByRole("button", { name: "NEW" });
      await kdsStatusButton.click();
      await expect(kitchenPage.getByRole("button", { name: "ACCEPTED" })).toBeVisible();
      await expect(waiterPage.getByText(/Live kitchen update received for item #\d+/i)).toBeVisible();

      await kitchenPage.getByRole("button", { name: "ACCEPTED" }).click();
      await expect(kitchenPage.getByRole("button", { name: "PREPARING" })).toBeVisible();
      await kitchenPage.screenshot({ path: testInfo.outputPath("kds-preparing.png") });

      await kitchenPage.getByRole("button", { name: "PREPARING" }).click();
      await expect(kitchenPage.getByRole("button", { name: "READY" })).toBeVisible();
      await expect(waiterPage.getByText(/Kitchen marked item #\d+ ready/i)).toBeVisible();
      await waiterPage.screenshot({ path: testInfo.outputPath("waiter-realtime-ready.png") });
      await kitchenPage.screenshot({ path: testInfo.outputPath("kds-ready.png") });

      await expect.poll(() => websocketReceived(waiterDiagnostics, "waiter.order-item.updated")).toBe(true);
      await expect.poll(() => websocketReceived(waiterDiagnostics, "waiter.table-status.updated")).toBe(true);
      await expect.poll(() => websocketReceived(kitchenDiagnostics, "kds.item.updated")).toBe(true);
      await expect.poll(() => websocketEventPayloads(waiterDiagnostics, "waiter.order-item.updated").some((payload) =>
        payload.item_id === createdItem.id
        && payload.service_order_id === createdOrder.id
        && payload.station_id === fixture.stations.kitchen
        && payload.seat_number === 1
        && payload.course_number === 1
        && payload.preparation_status === "ready",
      )).toBe(true);
      await expect.poll(() => websocketEventPayloads(waiterDiagnostics, "waiter.table-status.updated").some((payload) =>
        payload.table_id === fixture.tables.assigned
        && payload.from_status === "available"
        && payload.to_status === "occupied"
        && typeof payload.event_id === "string",
      )).toBe(true);
    } finally {
      await attachDiagnostics(testInfo, waiterDiagnostics);
      await attachDiagnostics(testInfo, kitchenDiagnostics);
      await Promise.all([waiterContext.close(), kitchenContext.close()]);
    }
  });
});
