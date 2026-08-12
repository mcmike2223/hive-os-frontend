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
  items: Array<{
    id: number;
    menu_item_id: number;
    station_id: number;
    course_number: number;
    preparation_status: string;
  }>;
};

const coursePath = (orderId: number, course: number, operation: string) =>
  `/api/v1/hospitality/service-orders/${orderId}/courses/${course}/${operation}`;

/**
 * Course hold and release, end to end.
 *
 * The order is built through the real UI, but the hold and release calls are
 * made against the API from the authenticated browser session. That is not a
 * shortcut: the waiter POS has no hold/release controls at all, so there is no
 * UI path to drive. The backend workflow is complete and permission-guarded and
 * this journey covers it under real auth and tenancy — but a manager cannot
 * perform any of it in the product today. See the phase 4H notes.
 */
test.describe("waiter POS course hold and release", () => {
  test("holds a later course, enforces sequence, and releases it exactly once", async ({
    browser,
    waiterFixture,
  }, testInfo) => {
    const fixture = waiterFixture;
    const waiterContext = await browser.newContext();
    const kitchenContext = await browser.newContext();
    const managerContext = await browser.newContext();
    const waiterPage = await waiterContext.newPage();
    const kitchenPage = await kitchenContext.newPage();
    const managerPage = await managerContext.newPage();
    const waiterDiagnostics = captureDiagnostics(waiterPage);
    const kitchenDiagnostics = captureDiagnostics(kitchenPage);
    const managerDiagnostics = captureDiagnostics(managerPage);

    try {
      // The manager signs in later, on its own. Logging all three in at once
      // raced the backend permission cache and the waiter's own order POST came
      // back 403, which looks like a permission bug but is a cache warm-up.
      await Promise.all([
        loginAs(waiterPage, fixture, "waiter"),
        loginAs(kitchenPage, fixture, "chef"),
      ]);

      await Promise.all([
        waiterPage.goto(`${frontendBaseUrl(fixture)}/dashboard/hospitality/waiter-pos`),
        kitchenPage.goto(`${frontendBaseUrl(fixture)}/dashboard/hospitality/kds`),
      ]);

      await expect(waiterPage.getByRole("heading", { name: "Restaurant Waiter POS" })).toBeVisible();
      await expect(kitchenPage.getByRole("heading", { name: /Kitchen Display System/i })).toBeVisible();

      await waiterPage.getByText("A-01 Assigned", { exact: true }).click();

      // Course 1: the kitchen item. Its required modifier group has to be
      // satisfied before it can be added.
      await waiterPage.getByLabel("Search menu").fill(fixture.menu.item_name);
      const mainCard = waiterPage.locator("article", { hasText: fixture.menu.item_name });
      await mainCard.locator("select").selectOption(String(fixture.menu.variant_id));
      await mainCard.getByLabel("Injera", { exact: true }).check();
      await mainCard.getByRole("button", { name: /Add to order/i }).click();

      // Course 2: the bar item. Different station on purpose, so releasing the
      // course has to reach the bar rather than merely reaching a station.
      await waiterPage.getByLabel("Search menu").fill(fixture.menu.second_item_name);
      const drinkCard = waiterPage.locator("article", { hasText: fixture.menu.second_item_name });
      await drinkCard.getByRole("button", { name: /Add to order/i }).click();

      const cart = waiterPage.getByRole("complementary", { name: /Order Draft/i });
      await cart.getByLabel("Guests").fill("2");
      await cart.getByLabel("Course").nth(0).fill("1");
      await cart.getByLabel("Course").nth(1).fill("2");

      const orderResponse = waiterPage.waitForResponse(
        (response) =>
          response.request().method() === "POST" && response.url().includes("/hospitality/waiter/orders"),
      );
      await cart.getByRole("button", { name: /Submit order to kitchen/i }).click();
      const submitted = await orderResponse;
      expect(submitted.status()).toBe(201);

      const order = (await submitted.json()) as CreatedOrder;
      const mainItem = order.items.find((item) => item.menu_item_id === fixture.menu.item_id);
      const drinkItem = order.items.find((item) => item.menu_item_id === fixture.menu.second_item_id);

      expect(mainItem).toBeDefined();
      expect(drinkItem).toBeDefined();
      expect(mainItem?.course_number).toBe(1);
      expect(drinkItem?.course_number).toBe(2);
      // Routing is per category, so the two courses must land on different
      // stations. If this ever collapses to one station the journey still
      // passes its later assertions while proving much less.
      expect(mainItem?.station_id).toBe(fixture.stations.kitchen);
      expect(drinkItem?.station_id).toBe(fixture.stations.bar);
      // Coursing is automatic, and this is the behaviour worth pinning: the
      // first course goes to its station immediately while everything later is
      // held on creation. ServiceOrderController does this directly, so nothing
      // has to remember to hold course two — but equally, nothing would notice
      // if that stopped happening and every course fired at once.
      expect(mainItem?.preparation_status).toBe("new");
      expect(drinkItem?.preparation_status).toBe("held");

      // Holding an already-held course is refused; only unaccepted items can be
      // held. Course one is the one that is actually holdable.
      const holdHeld = await sameOriginJson(waiterPage, coursePath(order.id, 2, "hold"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "already held" }),
      });
      expect(holdHeld.status).toBe(422);

      // Hold and release course one through the real controls, not the API.
      // The order detail dialog is gated on manage/edit permissions, so the
      // manager is the actor here; the panel is the only place in the product
      // where coursing is reachable at all.
      // The waiter holds release_hospitality_courses, and until now there was
      // nowhere in the product to use it: coursing lived only behind the
      // manager order dialog, which is gated on permissions a waiter lacks.
      await waiterPage.reload();
      const waiterOrders = waiterPage.getByTestId("waiter-open-orders");
      await expect(waiterOrders).toBeVisible();
      await waiterOrders.getByTestId(`waiter-open-order-${order.id}`).click();

      const waiterPanel = waiterOrders.getByTestId("order-coursing-panel");
      await expect(waiterPanel).toBeVisible();
      // The panel gates each section separately, so a waiter must get coursing
      // and none of the manager-only reallocation controls. Asserting their
      // absence is the point: the same component renders for both roles.
      await expect(waiterPanel.getByTestId("seat-controls")).toHaveCount(0);
      await expect(waiterPanel.getByTestId("table-transfer-controls")).toHaveCount(0);
      await expect(waiterPanel.getByTestId("waiter-reassignment-controls")).toHaveCount(0);
      await expect(waiterPanel.getByTestId("override-sequence-control")).toHaveCount(0);

      await waiterPanel.getByTestId("hold-course-1").click();
      await expect(waiterPanel.getByTestId("course-1-held-badge")).toBeVisible();
      await waiterPanel.getByTestId("release-course-1").click();
      await expect(waiterPanel.getByTestId("course-1-held-badge")).toHaveCount(0);
      await waiterPage.screenshot({ path: testInfo.outputPath("waiter-coursing.png") });

      await loginAs(managerPage, fixture, "manager");
      await managerPage.goto(`${frontendBaseUrl(fixture)}/dashboard/hospitality/service-orders`);
      await managerPage.getByPlaceholder(/search/i).first().fill(order.order_number);
      const orderRow = managerPage.locator("tr", { hasText: order.order_number });
      await expect(orderRow).toHaveCount(1);
      await orderRow.getByRole("button", { name: /Manage \/ Details/i }).click();

      const panel = managerPage.getByTestId("order-coursing-panel");
      await expect(panel).toBeVisible();
      // Course two arrived already held, so the panel must say so before
      // anything is clicked.
      await expect(panel.getByTestId("course-2-held-badge")).toBeVisible();

      // The manager sees the full panel, including the controls the waiter is
      // correctly denied. Course one is already covered from the waiter side
      // above, so this side only proves the manager-only surface exists.
      await expect(panel.getByTestId("seat-controls")).toBeVisible();
      await expect(panel.getByTestId("table-transfer-controls")).toBeVisible();
      await expect(panel.getByTestId("override-sequence-control")).toBeVisible();
      await managerPage.screenshot({ path: testInfo.outputPath("coursing-panel.png") });

      // Releasing course 2 while course 1 is still outstanding must be refused:
      // the sequence guard is the whole point of coursing.
      const outOfSequence = await sameOriginJson(waiterPage, coursePath(order.id, 2, "release"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(outOfSequence.status).toBe(422);

      // The held course must not be actionable kitchen work. This is the point
      // of coursing, and the assertion that would fail if held items leaked to
      // a station.
      await expect(kitchenPage.getByText(fixture.menu.second_item_name, { exact: true })).toHaveCount(0);

      // The refusal above tells the manager to "use the authorized sequence
      // override". Prove that instruction is now actionable: arm the override
      // and release course 2 early through the panel, which the plain release
      // just refused.
      await panel.getByTestId("override-sequence-checkbox").click();
      await panel.getByTestId("release-course-2").click();
      await expect(panel.getByTestId("course-2-held-badge")).toHaveCount(0);
      // Released early means it really did reach the bar, ahead of a course
      // that is still outstanding. Reload rather than trusting the broadcast:
      // this assertion is about the release, not about realtime delivery.
      await kitchenPage.reload();
      await expect(
        kitchenPage.getByText(fixture.menu.second_item_name, { exact: true }),
      ).toHaveCount(1);
      // The override is one-shot, so the box must have disarmed itself.
      await expect(panel.getByTestId("override-sequence-checkbox")).not.toBeChecked();
      await managerPage.screenshot({ path: testInfo.outputPath("sequence-override.png") });

      // Put course 2 back on hold so the rest of the journey still exercises
      // the ordinary, non-overridden path. A released course is 'new' again,
      // which is exactly the state hold accepts.
      await panel.getByTestId("hold-course-2").click();
      await expect(panel.getByTestId("course-2-held-badge")).toBeVisible();
      await kitchenPage.reload();
      await expect(
        kitchenPage.getByText(fixture.menu.second_item_name, { exact: true }),
      ).toHaveCount(0);

      // Complete course 1 through the kitchen, which is what legitimately
      // unblocks course 2.
      await expect(kitchenPage.getByText(fixture.menu.item_name, { exact: true })).toBeVisible();
      const mainItemId = mainItem?.id as number;
      // KdsController enforces new -> accepted -> preparing -> ready -> served
      // and none of the steps are skippable. It has to reach `served`, not just
      // `ready`: the sequence guard treats a course as complete only when every
      // item is served or cancelled, so a plated-but-undelivered course still
      // blocks the next one.
      for (const status of ["accepted", "preparing", "ready", "served"]) {
        const advanced = await sameOriginJson(
          kitchenPage,
          `/api/v1/hospitality/kds/items/${mainItemId}/status`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ preparation_status: status }),
          },
        );
        expect(advanced.status).toBe(200);
      }

      // Now the release is legitimate. The same key is replayed afterwards and
      // must not produce a second release.
      const idempotencyKey = "8f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f";
      const released = await sameOriginJson(waiterPage, coursePath(order.id, 2, "release"), {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Idempotency-Key": idempotencyKey },
        body: JSON.stringify({}),
      });
      expect(released.status).toBe(200);

      const replayed = await sameOriginJson(waiterPage, coursePath(order.id, 2, "release"), {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Idempotency-Key": idempotencyKey },
        body: JSON.stringify({}),
      });
      expect(replayed.status).toBe(200);

      // A second release under a *different* key must be refused, because the
      // course is no longer held. This is what proves the replay above was a
      // replay rather than a second successful release.
      const secondRelease = await sameOriginJson(waiterPage, coursePath(order.id, 2, "release"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(secondRelease.status).toBe(422);

      // The released course reaches the bar and is visible to the kitchen
      // display exactly once.
      await kitchenPage.reload();
      await expect(
        kitchenPage.getByText(fixture.menu.second_item_name, { exact: true }),
      ).toHaveCount(1);
      await kitchenPage.screenshot({ path: testInfo.outputPath("kds-after-course-release.png") });

      // The chef holds KDS permissions but not release_hospitality_courses, so
      // the same call from that session must be refused. Asserting denial alone
      // would be vacuous — the waiter's successful calls above are what make
      // this meaningful.
      const unauthorized = await sameOriginJson(kitchenPage, coursePath(order.id, 1, "hold"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "should not be permitted" }),
      });
      expect(unauthorized.status).toBe(403);

      // A course the order does not have must not be inventable.
      const missingCourse = await sameOriginJson(waiterPage, coursePath(order.id, 9, "hold"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "no such course" }),
      });
      expect(missingCourse.status).toBe(422);
    } finally {
      await attachDiagnostics(testInfo, waiterDiagnostics);
      await attachDiagnostics(testInfo, kitchenDiagnostics);
      await attachDiagnostics(testInfo, managerDiagnostics);
      await waiterContext.close();
      await kitchenContext.close();
      await managerContext.close();
    }
  });
});
