import { expect, test } from "@playwright/test";
import {
  attachDiagnostics,
  captureDiagnostics,
  frontendBaseUrl,
  loadFixture,
  loginAs,
  sameOriginStatus,
} from "./support";

test.describe("waiter POS unauthorized browser acceptance", () => {
  test("cannot bypass waiter, KDS, or private-channel authorization", async ({ browser }, testInfo) => {
    const fixture = await loadFixture();
    const context = await browser.newContext();
    const page = await context.newPage();
    const diagnostics = captureDiagnostics(page);

    try {
      await loginAs(page, fixture, "unauthorized");
      await page.goto(`${frontendBaseUrl(fixture)}/dashboard/hospitality/waiter-pos`);

      await expect.poll(() => sameOriginStatus(page, "/api/v1/hospitality/waiter/bootstrap")).toBe(403);
      await expect.poll(() => sameOriginStatus(page, "/api/v1/hospitality/kds/orders")).toBe(403);
      await expect.poll(() => sameOriginStatus(page, "/api/v1/hospitality/kds/items/999999/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preparation_status: "accepted" }),
      })).toBe(403);
      await expect.poll(() => sameOriginStatus(page, "/api/v1/broadcasting/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          socket_id: "1.1",
          channel_name: `private-tenant.${fixture.tenant_id}.outlet.${fixture.outlet_id}.waiters`,
        }),
      })).toBe(403);

      await expect.poll(() => sameOriginStatus(page, "/api/v1/hospitality/waiter/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": "89d61070-4d04-4f41-9967-06049c531c31",
        },
        body: JSON.stringify({
          outlet_id: fixture.outlet_id,
          location_id: fixture.tables.unassigned,
          reservation_id: fixture.reservations.active_unassigned,
          order_type_code: "dine_in",
          guest_count: 2,
          items: [{
            menu_item_id: fixture.menu.item_id,
            quantity: 1,
            variant_id: fixture.menu.variant_id,
            modifier_option_ids: [fixture.menu.required_modifier_option_id],
            seat_number: 1,
            course_number: 1,
          }],
        }),
      })).toBe(403);
    } finally {
      await attachDiagnostics(testInfo, diagnostics);
      await context.close();
    }
  });
});
