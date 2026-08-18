import { expect, test } from "@playwright/test";

const frontendUrl = (process.env.HIVE_E2E_PERFORMANCE_FRONTEND_URL ?? "http://apple.localhost:3001").replace(/\/$/, "");
const email = process.env.HIVE_E2E_PERFORMANCE_EMAIL ?? "admin@apple.com";
const password = process.env.HIVE_E2E_PERFORMANCE_PASSWORD ?? "password";
const chromiumExecutablePath = process.env.HIVE_E2E_CHROMIUM_EXECUTABLE_PATH?.trim() || undefined;

test.use({ launchOptions: { ...(chromiumExecutablePath ? { executablePath: chromiumExecutablePath } : {}), args: ["--host-resolver-rules=MAP apple.localhost host.docker.internal, MAP localhost host.docker.internal"] } });

test("performance management is discoverable and operational for employees and managers", async ({ page }) => {
  test.setTimeout(240_000); page.setDefaultNavigationTimeout(90_000);
  const consoleErrors: string[] = []; const failedRequests: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("requestfailed", (request) => { if (request.url().includes("/performance")) failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText ?? "unknown failure"}`); });
  await page.addInitScript(() => window.localStorage.setItem("hive_welcome_tour_completed", "true"));
  await page.goto(`${frontendUrl}/sign-in`); await page.locator("#email").waitFor({ state: "visible", timeout: 90_000 }); await page.locator("#email").fill(email); await page.locator("#password").fill(password); await page.getByRole("button", { name: /initiate handshake/i }).click(); await page.waitForURL(/\/dashboard(?:$|\?)/, { timeout: 60_000 }); consoleErrors.length = 0;

  const navigation = page.getByRole("navigation", { name: /dashboard navigation/i }); await navigation.getByRole("button", { name: /^modules$/i }).click(); const performanceButton = navigation.getByRole("button", { name: /^performance management$/i }); await expect(performanceButton).toBeVisible(); await performanceButton.click(); await expect(performanceButton).toHaveAttribute("aria-expanded", "true"); await expect(navigation.getByRole("link", { name: /^performance overview$/i })).toHaveCount(1); await expect(navigation.getByRole("link", { name: /^goals & okrs$/i })).toHaveCount(1); await expect(navigation.getByRole("link", { name: /^performance reviews$/i })).toHaveCount(1);

  await page.goto(`${frontendUrl}/dashboard/performance`); await expect(page.getByRole("heading", { level: 1, name: /^performance command center$/i })).toBeVisible({ timeout: 90_000 }); await expect(page.getByText(/attendance is displayed as supporting evidence only/i)).toBeVisible({ timeout: 60_000 }); await expect(page.getByRole("img", { name: /reviews grouped by workflow status/i })).toBeVisible(); await expect(page.getByRole("img", { name: /completed review scores by rating band/i })).toBeVisible(); await expect(page.getByRole("img", { name: /planned and completed performance check-ins/i })).toBeVisible(); await expect(page.getByRole("img", { name: /average performance scores for visible employees/i })).toBeVisible();

  const cyclesLink = page.getByRole("link", { name: /^cycles$/i }); await cyclesLink.focus(); await expect(cyclesLink).toBeFocused(); await cyclesLink.click(); await expect(page).toHaveURL(/\/dashboard\/performance\/cycles$/, { timeout: 90_000 }); await expect(page.getByRole("heading", { level: 1, name: /^review cycles$/i })).toBeVisible({ timeout: 60_000 }); const cycleButton = page.locator('[aria-controls="new-performance-cycle"]'); await expect(cycleButton).toHaveAccessibleName(/^new review cycle$/i); await cycleButton.click(); await expect(cycleButton).toHaveAttribute("aria-expanded", "true"); await expect(cycleButton).toHaveAccessibleName(/^close cycle form$/i); await expect(page.getByLabel("Cycle code (required)")).toBeVisible(); await expect(page.getByLabel("Goal weight percent (required)")).toHaveValue("60");

  await page.getByRole("link", { name: /^goals$/i }).click(); await expect(page).toHaveURL(/\/dashboard\/performance\/goals$/, { timeout: 90_000 }); await expect(page.getByRole("heading", { level: 1, name: /^goals and okrs$/i })).toBeVisible({ timeout: 60_000 }); await page.getByRole("button", { name: /^new goal$/i }).click(); await expect(page.getByLabel("Employee (required)")).toBeVisible(); await expect(page.getByLabel("Measurement (required)")).toHaveValue("percentage");

  await page.getByRole("link", { name: /^reviews$/i }).click(); await expect(page).toHaveURL(/\/dashboard\/performance\/reviews$/, { timeout: 90_000 }); await expect(page.getByRole("heading", { level: 1, name: /^employee and manager reviews$/i })).toBeVisible({ timeout: 60_000 }); await expect(page.getByText(/never calculate or change an employee rating/i)).toBeVisible();

  await page.getByRole("link", { name: /^development$/i }).click(); await expect(page).toHaveURL(/\/dashboard\/performance\/development$/, { timeout: 90_000 }); await expect(page.getByRole("heading", { level: 1, name: /^feedback and development$/i })).toBeVisible({ timeout: 60_000 }); const checkinButton = page.getByRole("button", { name: /^check-in$/i }); await checkinButton.click(); await expect(checkinButton).toHaveAttribute("aria-pressed", "true"); await expect(page.getByLabel("Check-in date (required)")).toBeVisible(); await page.getByRole("button", { name: /^improvement plan$/i }).click(); await expect(page.getByLabel("Reason and context (required)")).toBeVisible();

  await page.getByRole("link", { name: /^settings$/i }).click(); await expect(page).toHaveURL(/\/dashboard\/performance\/settings$/, { timeout: 90_000 }); await expect(page.getByRole("heading", { level: 1, name: /^competency library and settings$/i })).toBeVisible({ timeout: 60_000 }); await expect(page.getByRole("table", { name: /performance competency library/i })).toBeVisible(); await expect(page.getByText("Ownership and accountability")).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 }); await expect(page.getByRole("heading", { level: 1, name: /^competency library and settings$/i })).toBeVisible(); const mobileOverflow = await page.evaluate(() => ({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth })); expect(mobileOverflow.scrollWidth).toBeLessThanOrEqual(mobileOverflow.clientWidth + 1);
  await page.evaluate(() => { document.documentElement.style.zoom = "2"; }); await expect(page.getByRole("heading", { level: 1, name: /^competency library and settings$/i })).toBeVisible(); await page.evaluate(() => { document.documentElement.style.zoom = "1"; });

  expect(failedRequests).toEqual([]); const actionableConsoleErrors = consoleErrors.filter((message) => !message.includes("WebSocket connection to 'ws://localhost:9095/")); expect(actionableConsoleErrors).toEqual([]);
});

