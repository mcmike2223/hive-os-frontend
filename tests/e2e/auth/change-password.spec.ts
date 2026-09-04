import { expect, test } from "@playwright/test";

/**
 * The forced change-password form.
 *
 * Needs no login: the page is reachable directly, which matters because it is
 * where a blocked user is sent. The checklist is what is under test here, not
 * the submission — the rules are enforced server side and covered by
 * ForcedPasswordChangeTest.
 */
test.describe("forced change password form", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("hive_token", "playwright-password-change-token");
      localStorage.setItem(
        "hive_user",
        JSON.stringify({ must_change_password: true }),
      );
    });
  });

  test("uses the public branding logo and app title", async ({ page }) => {
    await page.route("**/api/v1/settings/brand/public", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            app_title: "Acceptance Workspace",
            logo_light: "/branding/hive-os-logo-light-large-tight.png",
            logo_dark: "/branding/hive-os-logo-dark-large-tight.png",
          },
        }),
      });
    });

    await page.goto("http://localhost:3001/change-password");

    await expect(
      page.getByRole("img", { name: "Acceptance Workspace logo" }),
    ).toBeVisible();
    await expect(page).toHaveTitle(/Create your new password/i);
  });

  test("ticks each rule as it is satisfied and gates the submit button", async ({ page }) => {
    await page.goto("http://localhost:3001/change-password");

    await expect(page.getByTestId("change-password-form")).toBeVisible();

    const submit = page.getByTestId("change-password-submit");
    const rule = (key: string) => page.getByTestId(`rule-${key}`);

    // Nothing typed: every rule unmet and the button refuses.
    await expect(submit).toBeDisabled();
    for (const key of ["length", "upper", "lower", "number", "symbol", "different", "match"]) {
      await expect(rule(key)).toHaveAttribute("data-met", "false");
    }

    await page.getByTestId("current-password-input").fill("Initial!Pass1");

    // Lowercase only: exactly one rule flips, which is what proves the
    // indicators are independent rather than moving together.
    await page.getByTestId("new-password-input").fill("abcdefgh");
    await expect(rule("length")).toHaveAttribute("data-met", "true");
    await expect(rule("lower")).toHaveAttribute("data-met", "true");
    await expect(rule("upper")).toHaveAttribute("data-met", "false");
    await expect(rule("number")).toHaveAttribute("data-met", "false");
    await expect(rule("symbol")).toHaveAttribute("data-met", "false");
    await expect(submit).toBeDisabled();

    await page.getByTestId("new-password-input").fill("Abcdefgh");
    await expect(rule("upper")).toHaveAttribute("data-met", "true");
    await expect(submit).toBeDisabled();

    await page.getByTestId("new-password-input").fill("Abcdefg1");
    await expect(rule("number")).toHaveAttribute("data-met", "true");
    await expect(submit).toBeDisabled();

    await page.getByTestId("new-password-input").fill("Abcdefg1!");
    await expect(rule("symbol")).toHaveAttribute("data-met", "true");
    await expect(rule("different")).toHaveAttribute("data-met", "true");
    // Confirmation still empty, so the form is still refused.
    await expect(rule("match")).toHaveAttribute("data-met", "false");
    await expect(submit).toBeDisabled();

    await page.getByTestId("confirm-password-input").fill("Mismatch1!");
    await expect(rule("match")).toHaveAttribute("data-met", "false");
    await expect(submit).toBeDisabled();

    await page.getByTestId("confirm-password-input").fill("Abcdefg1!");
    await expect(rule("match")).toHaveAttribute("data-met", "true");

    // Every rule met: only now does the button open.
    await expect(submit).toBeEnabled();
    await page.screenshot({ path: "test-results/change-password-checklist.png" });
  });

  test("refuses a new password identical to the current one", async ({ page }) => {
    await page.goto("http://localhost:3001/change-password");

    await page.getByTestId("current-password-input").fill("Abcdefg1!");
    await page.getByTestId("new-password-input").fill("Abcdefg1!");
    await page.getByTestId("confirm-password-input").fill("Abcdefg1!");

    // Every character rule passes; reuse is the only thing holding it shut.
    await expect(page.getByTestId("rule-symbol")).toHaveAttribute("data-met", "true");
    await expect(page.getByTestId("rule-different")).toHaveAttribute("data-met", "false");
    await expect(page.getByTestId("change-password-submit")).toBeDisabled();
  });
});
