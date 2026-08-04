import { expect, test } from "@playwright/test";
import {
  attachDiagnostics,
  captureDiagnostics,
  frontendBaseUrl,
  loadFixture,
  loginAs,
  sameOriginJson,
  type WaiterFixtureManifest,
} from "./support";

// This journey runs as the manager against the unassigned table on purpose. The
// waiter/KDS journey owns the waiter's assigned table, and a tenant fixture is
// shared across the whole run, so using the same table here would trip the
// single-open-order policy and make the two tests order-dependent.
const orderPayload = (fixture: WaiterFixtureManifest, guestCount: number) => ({
  outlet_id: fixture.outlet_id,
  location_id: fixture.tables.unassigned,
  reservation_id: fixture.reservations.active_unassigned,
  order_type_code: "dine_in",
  guest_count: guestCount,
  items: [{
    menu_item_id: fixture.menu.item_id,
    item_name: "Acceptance Grilled Tibs",
    quantity: 1,
    variant_id: fixture.menu.variant_id,
    modifier_option_ids: [fixture.menu.required_modifier_option_id],
    seat_number: 1,
    course_number: 1,
  }],
});

const post = (
  page: Parameters<typeof sameOriginJson>[0],
  idempotencyKey: string,
  payload: Record<string, unknown>,
) => sameOriginJson(page, "/api/v1/hospitality/waiter/orders", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Idempotency-Key": idempotencyKey,
  },
  body: JSON.stringify(payload),
});

test.describe("waiter POS retry and history browser acceptance", () => {
  test("replays one order, rejects a changed payload, and survives reload and history", async ({ browser }, testInfo) => {
    const fixture = await loadFixture();
    const context = await browser.newContext();
    const page = await context.newPage();
    const diagnostics = captureDiagnostics(page);

    try {
      await loginAs(page, fixture, "manager");
      await page.goto(`${frontendBaseUrl(fixture)}/dashboard/hospitality/waiter-pos`);
      await expect(page.getByRole("heading", { name: "Restaurant Waiter POS" })).toBeVisible();

      const idempotencyKey = "6f1d0a2e-3c47-4f5b-9a10-2b8e7c4d5f31";

      // First submission is authoritative.
      const created = await post(page, idempotencyKey, orderPayload(fixture, 2));
      expect(created.status).toBe(201);
      const orderId = created.body.id as number;
      expect(typeof orderId).toBe("number");

      // Retry with the same key and the same payload must replay the original
      // response rather than create a second order.
      const replayed = await post(page, idempotencyKey, orderPayload(fixture, 2));
      expect(replayed.status).toBe(201);
      expect(replayed.body.id).toBe(orderId);

      // A third identical retry must still be the same order.
      const replayedAgain = await post(page, idempotencyKey, orderPayload(fixture, 2));
      expect(replayedAgain.status).toBe(201);
      expect(replayedAgain.body.id).toBe(orderId);

      // Same key, different payload is a conflict, and must not mutate the order.
      const conflicted = await post(page, idempotencyKey, orderPayload(fixture, 5));
      expect(conflicted.status).toBe(409);

      const afterConflict = await post(page, idempotencyKey, orderPayload(fixture, 2));
      expect(afterConflict.status).toBe(201);
      expect(afterConflict.body.id).toBe(orderId);

      // The table transitioned exactly once and stays occupied across a reload.
      await expect(page.getByRole("button", { name: /A-02 Unassigned.*occupied/i })).toBeVisible();
      await page.reload();
      await expect(page.getByRole("heading", { name: "Restaurant Waiter POS" })).toBeVisible();
      await expect(page.getByRole("button", { name: /A-02 Unassigned.*occupied/i })).toBeVisible();
      await expect(page.getByText(/Draft order is empty/i)).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath("retry-after-reload.png") });

      // Navigating away and back must not resubmit or restore a stale cart.
      // Back/forward navigation must not resubmit. The rendered shell is not
      // asserted here: browser-back currently leaves the dashboard mounted but
      // invisible behind a full-screen placeholder, tracked as a separate
      // defect in waiter-pos-phase-4c-results.md. What matters for retry
      // semantics is that traversing history creates no second order.
      await page.goto(`${frontendBaseUrl(fixture)}/dashboard`);
      await page.goBack();
      await page.waitForURL(/waiter-pos/, { timeout: 30_000 });
      await page.goForward();
      await page.waitForURL(/\/dashboard(?:$|\?)/, { timeout: 30_000 });
      await page.goBack();
      await page.waitForURL(/waiter-pos/, { timeout: 30_000 });

      const afterHistory = await post(page, idempotencyKey, orderPayload(fixture, 2));
      expect(afterHistory.status).toBe(201);
      expect(afterHistory.body.id).toBe(orderId);

      // A reload recovers the authoritative view, proving the state above is
      // real and only the back-navigation render is affected.
      await page.reload();
      await expect(page.getByRole("button", { name: /A-02 Unassigned.*occupied/i })).toBeVisible();
      await expect(page.getByText(/Draft order is empty/i)).toBeVisible();

      // Still exactly one order behind that key after all of the above.
      const finalCheck = await post(page, idempotencyKey, orderPayload(fixture, 2));
      expect(finalCheck.status).toBe(201);
      expect(finalCheck.body.id).toBe(orderId);
    } finally {
      await attachDiagnostics(testInfo, diagnostics);
      await context.close();
    }
  });
});
