import { expect, test } from "@playwright/test";
import { frontendBaseUrl, loadFixture, loginAs } from "./support";

/**
 * Browser Back and Forward leave every dashboard route blank on the Next.js dev
 * server: the server-rendered placeholder stays and React never finishes
 * hydrating. Against a production build the same steps render correctly, so the
 * blank page is a development-server defect and not a release blocker.
 *
 * This journey pins that conclusion so a future change cannot turn it into a
 * real one without being noticed. It needs a production server, so it is opt-in:
 *
 *   npm run build && npx next start -p 3010
 *   HIVE_E2E_PRODUCTION_HISTORY=1 \
 *   HIVE_E2E_FRONTEND_URL=http://<fixture-tenant>.localhost:3010 \
 *   npx playwright test tests/e2e/waiter-pos/production-history.spec.ts
 */
test.describe("waiter POS production history navigation", () => {
  test.skip(
    process.env.HIVE_E2E_PRODUCTION_HISTORY !== "1",
    "Needs a production build served separately; see the comment above.",
  );

  test("Back and Forward keep the dashboard rendered", async ({ browser }, testInfo) => {
    const fixture = await loadFixture();
    const context = await browser.newContext();
    const page = await context.newPage();

    const visibleTextLength = async (): Promise<number> =>
      (await page.locator("body").innerText().catch(() => "")).trim().length;

    // Providers renders its offline banner before its children, so the banner
    // being present is what distinguishes a hydrated shell from the blank
    // full-screen placeholder that the dev server gets stuck on.
    const shellRendered = async (): Promise<boolean> =>
      page.evaluate(() => Boolean(document.querySelector("div.pointer-events-none.fixed")));

    try {
      await loginAs(page, fixture, "waiter");

      await page.goto(`${frontendBaseUrl(fixture)}/dashboard`);
      await expect.poll(visibleTextLength).toBeGreaterThan(0);

      await page.goto(`${frontendBaseUrl(fixture)}/dashboard/hospitality/waiter-pos`);
      await expect(page.getByRole("heading", { name: "Restaurant Waiter POS" })).toBeVisible();

      // The dev-server defect is a completely blank page, so "renders anything
      // at all, with the shell mounted" is the invariant worth pinning. Exact
      // text length is not: live counters make it vary between visits.
      await page.goBack();
      await page.waitForURL(/\/dashboard(?:$|\?)/, { timeout: 30_000 });
      await expect.poll(visibleTextLength, { timeout: 30_000 }).toBeGreaterThan(0);
      expect(await shellRendered()).toBe(true);
      await page.screenshot({ path: testInfo.outputPath("production-back.png") });

      await page.goForward();
      await page.waitForURL(/waiter-pos/, { timeout: 30_000 });
      await expect.poll(visibleTextLength, { timeout: 30_000 }).toBeGreaterThan(0);
      expect(await shellRendered()).toBe(true);
      await expect(page.getByRole("heading", { name: "Restaurant Waiter POS" })).toBeVisible();

      await page.reload();
      await expect(page.getByRole("heading", { name: "Restaurant Waiter POS" })).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
