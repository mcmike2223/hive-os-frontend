import { expect, test } from "@playwright/test";

const frontendUrl = (
  process.env.HIVE_E2E_ATTENDANCE_FRONTEND_URL ?? "http://localhost:3001"
).replace(/\/$/, "");
const frontendHostname = new URL(frontendUrl).hostname;
const email = process.env.HIVE_E2E_ATTENDANCE_EMAIL ?? "super@hive.os";
const password = process.env.HIVE_E2E_ATTENDANCE_PASSWORD ?? "password";
const chromiumExecutablePath =
  process.env.HIVE_E2E_CHROMIUM_EXECUTABLE_PATH?.trim() || undefined;

test.use({
  video: "off",
  launchOptions: {
    ...(chromiumExecutablePath
      ? { executablePath: chromiumExecutablePath }
      : {}),
    args: [
      `--host-resolver-rules=MAP ${frontendHostname} host.docker.internal, MAP localhost host.docker.internal`,
    ],
  },
});

test("attendance management is discoverable and operational", async ({
  page,
}, testInfo) => {
  testInfo.setTimeout(240_000);
  const consoleErrors: string[] = [];
  const failedAttendanceRequests: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("requestfailed", (request) => {
    if (request.url().includes("/attendance")) {
      failedAttendanceRequests.push(
        `${request.method()} ${request.url()}: ${request.failure()?.errorText ?? "unknown failure"}`,
      );
    }
  });

  await page.addInitScript(() => {
    window.localStorage.setItem("hive_welcome_tour_completed", "true");
  });

  await page.goto(`${frontendUrl}/sign-in`);
  await page.locator("#email").waitFor({ state: "visible", timeout: 90_000 });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /initiate handshake/i }).click();
  await expect(page).toHaveURL(/\/dashboard(?:$|\?)/, { timeout: 60_000 });
  consoleErrors.length = 0;

  const dashboardNavigation = page.getByRole("navigation", {
    name: /dashboard navigation/i,
  });
  const modulesButton = dashboardNavigation.getByRole("button", {
    name: /^modules$/i,
  });
  await expect(modulesButton).toBeVisible({ timeout: 60_000 });
  await modulesButton.press("Enter", { timeout: 60_000 });
  await expect(modulesButton).toHaveAttribute("aria-expanded", "true");
  const attendanceButton = dashboardNavigation.getByRole("button", {
    name: /^attendance management$/i,
  });
  await expect(attendanceButton).toBeVisible();
  await attendanceButton.press("Enter", { timeout: 60_000 });
  await expect(attendanceButton).toHaveAttribute("aria-expanded", "true");

  const overviewNav = dashboardNavigation.getByRole("link", {
    name: /^overview & today$/i,
  });
  await expect(overviewNav).toHaveCount(1);
  await expect(
    dashboardNavigation.getByRole("link", {
      name: /^attendance management$/i,
    }),
  ).toHaveCount(0);
  await overviewNav.click();
  await expect(page).toHaveURL(/\/dashboard\/attendance$/, {
    timeout: 60_000,
  });
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /^today’s workforce, at a glance$/i,
    }),
  ).toBeVisible();

  const attendanceViews = page.getByRole("tablist", {
    name: /attendance workspace views/i,
  });
  const todayTab = attendanceViews.getByRole("tab", { name: /^today$/i });
  const issuesTab = attendanceViews.getByRole("tab", {
    name: /^fix issues$/i,
  });
  await expect(todayTab).toHaveAttribute("aria-selected", "true");
  await todayTab.press("ArrowRight");
  await expect(issuesTab).toBeFocused();
  await expect(issuesTab).toHaveAttribute("aria-selected", "true");
  await issuesTab.press("ArrowLeft");
  await expect(todayTab).toBeFocused();
  await expect(todayTab).toHaveAttribute("aria-selected", "true");

  const userLinkingNav = page.getByRole("link", {
    name: /^user linking & enrolment$/i,
  });
  await expect(userLinkingNav).toBeVisible({ timeout: 60_000 });
  await userLinkingNav.click();
  await expect(page).toHaveURL(/\/dashboard\/attendance\/user-linking$/, {
    timeout: 60_000,
  });

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /user account & employee linking/i,
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Search accounts")).toBeVisible();
  await expect(page.getByLabel("Link status")).toBeVisible();
  await expect(
    page.getByRole("table", {
      name: /user accounts, employee records, linking state/i,
    }),
  ).toBeVisible();

  const previewButton = page.getByRole("button", {
    name: /preview linking/i,
  });
  await expect(previewButton).toBeVisible();
  expect(
    (await previewButton.boundingBox())?.height ?? 0,
  ).toBeGreaterThanOrEqual(44);

  await page.getByLabel("Link status").selectOption("unlinked");
  await page.getByLabel("Search accounts").fill("attendance");
  await page.getByLabel("Search accounts").clear();

  const summaryStatus = await page.evaluate(async () => {
    const token = window.localStorage.getItem("hive_token");
    const context = window.localStorage.getItem("hive_context");
    const signature = window.localStorage.getItem("hive_context_signature");
    const hasTenantContext = Boolean(context && context !== "central");
    const response = await fetch("/api/v1/attendance/user-linking/summary", {
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(hasTenantContext && context ? { "X-Tenant": context } : {}),
        ...(hasTenantContext && signature
          ? { "X-Tenant-Signature": signature }
          : {}),
      },
    });

    return response.status;
  });
  expect(summaryStatus).toBe(200);

  await previewButton.click();
  const previewDialog = page.getByRole("dialog", {
    name: /bulk linking dry-run preview/i,
  });
  await expect(previewDialog).toBeVisible({ timeout: 60_000 });
  await expect(
    previewDialog.getByText(/review deterministic matching outcomes/i),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(previewDialog).toBeHidden();
  await expect(previewButton).toBeFocused();

  const previewRequestPattern =
    /\/api\/v1\/(?:attendance|hr\/attendance)\/user-linking\/preview$/;
  await page.route(previewRequestPattern, async (route) => {
    await route.abort("failed");
  });
  await previewButton.click();
  await expect(
    page.getByText(
      /unable to generate the linking preview\. no changes were made/i,
    ),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/syncing queued changes/i)).toHaveCount(0);
  await page.unroute(previewRequestPattern);
  failedAttendanceRequests.length = 0;
  consoleErrors.length = 0;

  await page.setViewportSize({ width: 390, height: 844 });
  const bodyHasNoHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
  expect(bodyHasNoHorizontalOverflow).toBe(true);

  expect(failedAttendanceRequests).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
