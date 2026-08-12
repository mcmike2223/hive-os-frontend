import { expect, test } from "./fixtures";
import {
  attachDiagnostics,
  captureDiagnostics,
  frontendBaseUrl,
  loginAs,
  sameOriginJson,
} from "./support";

type CreatedOrder = {
  id: number;
  order_number: string;
  items: Array<{ id: number; menu_item_id: number; seat_number: number | null }>;
};

const uuid = (suffix: string) => `7c9e6679-7425-40de-944b-e07fc1f9${suffix}`;

/**
 * Seat and table transfer, end to end.
 *
 * The order is built through the real UI; the transfers themselves are driven
 * against the API from an authenticated manager session, because the waiter POS
 * exposes no transfer controls. Same gap as coursing: the workflow is complete,
 * permission-guarded and idempotent server-side, but unreachable in the product.
 *
 * Transfer permissions belong to the manager role, not the waiter, so the waiter
 * is a realistic denied actor here rather than a contrived one.
 */
test.describe("waiter POS seat and table transfer", () => {
  test("moves an item between seats and an order between tables, once each", async ({
    browser,
    waiterFixture,
  }, testInfo) => {
    const fixture = waiterFixture;
    const waiterContext = await browser.newContext();
    const managerContext = await browser.newContext();
    const waiterPage = await waiterContext.newPage();
    const managerPage = await managerContext.newPage();
    const waiterDiagnostics = captureDiagnostics(waiterPage);
    const managerDiagnostics = captureDiagnostics(managerPage);

    try {
      await Promise.all([
        loginAs(waiterPage, fixture, "waiter"),
        loginAs(managerPage, fixture, "manager"),
      ]);

      const posUrl = `${frontendBaseUrl(fixture)}/dashboard/hospitality/waiter-pos`;
      await waiterPage.goto(posUrl);
      await expect(waiterPage.getByRole("heading", { name: "Restaurant Waiter POS" })).toBeVisible();

      await waiterPage.getByText("A-01 Assigned", { exact: true }).click();

      await waiterPage.getByLabel("Search menu").fill(fixture.menu.item_name);
      const card = waiterPage.locator("article", { hasText: fixture.menu.item_name });
      await card.locator("select").selectOption(String(fixture.menu.variant_id));
      await card.getByLabel("Injera", { exact: true }).check();
      await card.getByRole("button", { name: /Add to order/i }).click();

      const cart = waiterPage.getByRole("complementary", { name: /Order Draft/i });
      // A party of four, so seats 1..4 are inside the party and 9 is outside it.
      await cart.getByLabel("Guests").fill("4");
      await cart.getByLabel("Seat").first().fill("1");

      const orderResponse = waiterPage.waitForResponse(
        (response) =>
          response.request().method() === "POST" && response.url().includes("/hospitality/waiter/orders"),
      );
      await cart.getByRole("button", { name: /Submit order to kitchen/i }).click();
      const submitted = await orderResponse;
      expect(submitted.status()).toBe(201);

      const order = (await submitted.json()) as CreatedOrder;
      const item = order.items.find((row) => row.menu_item_id === fixture.menu.item_id);
      expect(item).toBeDefined();
      expect(item?.seat_number).toBe(1);
      const itemId = item?.id as number;

      // Drive the panel first, while the dialog's data is fresh. The API
      // assertions further down prove the rules; only this part proves anyone
      // can reach them, which until now nobody could.
      await managerPage.goto(`${frontendBaseUrl(fixture)}/dashboard/hospitality/service-orders`);
      await managerPage.getByPlaceholder(/search/i).first().fill(order.order_number);
      const orderRow = managerPage.locator("tr", { hasText: order.order_number });
      await expect(orderRow).toHaveCount(1);
      await orderRow.getByRole("button", { name: /Manage \/ Details/i }).click();

      const panel = managerPage.getByTestId("order-coursing-panel");
      await expect(panel).toBeVisible();

      await panel.getByTestId(`seat-input-${item?.id}`).fill("2");
      await panel.getByTestId(`move-seat-${item?.id}`).click();
      await expect(panel.getByTestId(`seat-row-${item?.id}`)).toContainText("seat 2");

      await panel.getByTestId("table-transfer-select").click();
      await managerPage.getByTestId(`table-option-${fixture.tables.unassigned}`).click();
      await panel.getByTestId("table-transfer-reason").fill("Party moved to a quieter table");
      await panel.getByTestId("table-transfer-submit").click();
      await expect(managerPage.getByText(/Order moved to the new table/i)).toBeVisible();
      await managerPage.screenshot({ path: testInfo.outputPath("transfer-panel.png") });

      // Waiter reassignment. The candidate list is its own endpoint: the roles
      // that may reassign cannot read the staff endpoint, so before it existed
      // this operation had no way to name a target. Reassign to the manager
      // rather than back to the waiter, so the order actually changes hands.
      await panel.getByTestId("waiter-reassign-select").click();
      await managerPage.getByRole("option", { name: "Acceptance Branch Manager" }).click();
      await panel.getByTestId("waiter-reassign-reason").fill("Waiter went on break");
      await panel.getByTestId("waiter-reassign-submit").click();
      await expect(managerPage.getByText(/Order reassigned to the new waiter/i)).toBeVisible();

      // The waiter who took the order must not be able to reassign it; that is
      // a manager permission.
      const waiterReassignAttempt = await sameOriginJson(
        waiterPage,
        `/api/v1/hospitality/service-orders/${order.id}/waiter-reassignment`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ waiter_id: 1, reason: "waiter should not be able to" }),
        },
      );
      expect(waiterReassignAttempt.status).toBe(403);

      // A waiter id that does not exist must be refused rather than assigned.
      const unknownWaiter = await sameOriginJson(
        managerPage,
        `/api/v1/hospitality/service-orders/${order.id}/waiter-reassignment`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ waiter_id: 99999999, reason: "no such waiter" }),
        },
      );
      expect(unknownWaiter.status).toBe(422);

      const seatPath = `/api/v1/hospitality/service-orders/${order.id}/items/${itemId}/seat-transfer`;
      const tablePath = `/api/v1/hospitality/service-orders/${order.id}/table-transfer`;
      const json = { "Content-Type": "application/json" };

      // The waiter can create the order but must not be able to reallocate it.
      // transfer_hospitality_order_items is a manager permission.
      const waiterSeatAttempt = await sameOriginJson(waiterPage, seatPath, {
        method: "POST",
        headers: json,
        body: JSON.stringify({ to_seat_number: 3, reason: "waiter should not be able to" }),
      });
      expect(waiterSeatAttempt.status).toBe(403);

      // A non-UUID idempotency key is refused before any state changes.
      const badKey = await sameOriginJson(managerPage, seatPath, {
        method: "POST",
        headers: { ...json, "X-Idempotency-Key": "not-a-uuid" },
        body: JSON.stringify({ to_seat_number: 3, reason: "bad key" }),
      });
      expect(badKey.status).toBe(422);

      // Seat 9 is outside a party of four.
      const outsideParty = await sameOriginJson(managerPage, seatPath, {
        method: "POST",
        headers: json,
        body: JSON.stringify({ to_seat_number: 9, reason: "outside the party" }),
      });
      expect(outsideParty.status).toBe(422);

      const seatKey = uuid("aaaa");
      const seatMoved = await sameOriginJson(managerPage, seatPath, {
        method: "POST",
        headers: { ...json, "X-Idempotency-Key": seatKey },
        body: JSON.stringify({ to_seat_number: 3, reason: "Guest changed seats" }),
      });
      expect(seatMoved.status).toBe(200);

      const seatReplay = await sameOriginJson(managerPage, seatPath, {
        method: "POST",
        headers: { ...json, "X-Idempotency-Key": seatKey },
        body: JSON.stringify({ to_seat_number: 3, reason: "Guest changed seats" }),
      });
      expect(seatReplay.status).toBe(200);

      // Re-targeting seat 3 under a fresh key must be refused because the item
      // already sits there. This is what proves the move happened exactly once:
      // had the replay applied a second time, or had the first call not applied,
      // this assertion would not hold.
      const sameSeat = await sameOriginJson(managerPage, seatPath, {
        method: "POST",
        headers: json,
        body: JSON.stringify({ to_seat_number: 3, reason: "already there" }),
      });
      expect(sameSeat.status).toBe(422);

      // Table transfer. Same shape: denied for the waiter, guarded, idempotent.
      const waiterTableAttempt = await sameOriginJson(waiterPage, tablePath, {
        method: "POST",
        headers: json,
        body: JSON.stringify({
          destination_location_id: fixture.tables.unassigned,
          reason: "waiter should not be able to",
        }),
      });
      expect(waiterTableAttempt.status).toBe(403);

      // reason is required on table transfer, unlike seat transfer.
      const missingReason = await sameOriginJson(managerPage, tablePath, {
        method: "POST",
        headers: json,
        body: JSON.stringify({ destination_location_id: fixture.tables.unassigned }),
      });
      expect(missingReason.status).toBe(422);

      const unknownTable = await sameOriginJson(managerPage, tablePath, {
        method: "POST",
        headers: json,
        body: JSON.stringify({ destination_location_id: 99999999, reason: "no such table" }),
      });
      expect(unknownTable.status).toBe(422);

      const tableKey = uuid("bbbb");
      const tableMoved = await sameOriginJson(managerPage, tablePath, {
        method: "POST",
        headers: { ...json, "X-Idempotency-Key": tableKey },
        body: JSON.stringify({
          destination_location_id: fixture.tables.assigned,
          reason: "Party moved back to the original table",
        }),
      });
      expect(tableMoved.status).toBe(200);

      const tableReplay = await sameOriginJson(managerPage, tablePath, {
        method: "POST",
        headers: { ...json, "X-Idempotency-Key": tableKey },
        body: JSON.stringify({
          destination_location_id: fixture.tables.assigned,
          reason: "Party moved back to the original table",
        }),
      });
      expect(tableReplay.status).toBe(200);

      // The order now sits on the destination table, so transferring there again
      // is refused. Same single-application proof as the seat case.
      const sameTable = await sameOriginJson(managerPage, tablePath, {
        method: "POST",
        headers: json,
        body: JSON.stringify({
          destination_location_id: fixture.tables.assigned,
          reason: "already there",
        }),
      });
      expect(sameTable.status).toBe(422);
    } finally {
      await attachDiagnostics(testInfo, waiterDiagnostics);
      await attachDiagnostics(testInfo, managerDiagnostics);
      await waiterContext.close();
      await managerContext.close();
    }
  });
});
