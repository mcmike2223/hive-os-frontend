import { expect, test } from "@playwright/test";

const frontendUrl = (
  process.env.HIVE_E2E_FINANCE_FRONTEND_URL ??
  "http://apple.localhost:3001"
).replace(/\/$/, "");
const email = process.env.HIVE_E2E_FINANCE_EMAIL ?? "admin@apple.com";
const password = process.env.HIVE_E2E_FINANCE_PASSWORD ?? "password";
const chromiumExecutablePath =
  process.env.HIVE_E2E_CHROMIUM_EXECUTABLE_PATH?.trim() || undefined;

test.use({
  launchOptions: {
    ...(chromiumExecutablePath
      ? { executablePath: chromiumExecutablePath }
      : {}),
    args: [
      "--host-resolver-rules=MAP apple.localhost host.docker.internal, MAP localhost host.docker.internal",
    ],
  },
});

test("financial management is discoverable, charted, and operational", async ({
  page,
}) => {
  test.setTimeout(240_000);
  page.setDefaultNavigationTimeout(90_000);
  const consoleErrors: string[] = [];
  const failedFinanceRequests: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => {
    if (request.url().includes("/finance")) {
      failedFinanceRequests.push(
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
  await page.waitForURL(/\/dashboard(?:$|\?)/, { timeout: 60_000 });
  consoleErrors.length = 0;

  const navigation = page.getByRole("navigation", {
    name: /dashboard navigation/i,
  });
  const modulesButton = navigation.getByRole("button", { name: /^modules$/i });
  await modulesButton.click();
  const financeButton = navigation.getByRole("button", {
    name: /^financial management$/i,
  });
  await expect(financeButton).toBeVisible();
  await financeButton.click();
  await expect(financeButton).toHaveAttribute("aria-expanded", "true");
  await expect(
    navigation.getByRole("link", { name: /^finance overview$/i }),
  ).toHaveCount(1);
  await expect(
    navigation.getByRole("link", { name: /^compliance & operations$/i }),
  ).toHaveCount(1);

  await page.goto(`${frontendUrl}/dashboard/finance`);
  await expect(
    page.getByRole("heading", { level: 1, name: /^finance control room$/i }),
  ).toBeVisible({ timeout: 90_000 });
  await expect(
    page.getByRole("alert").filter({ hasText: /books are in balance/i }),
  ).toContainText(/books are in balance/i, {
    timeout: 60_000,
  });
  await expect(page.getByLabel("Reporting range starts")).toBeVisible();
  await expect(page.getByLabel("Reporting range ends")).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: /monthly revenue, expense, and net result chart/i,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: /monthly cash inflow and outflow area chart/i,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: /receivables and payables aging by overdue bucket/i,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: /posted and pending finance source events by connected module/i,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("table", {
      name: /receivables and payables by aging bucket/i,
    }),
  ).toBeVisible();

  const rangeStart = page.getByLabel("Reporting range starts");
  await rangeStart.focus();
  await expect(rangeStart).toBeFocused();

  await page.getByRole("link", { name: /^compliance$/i }).click();
  await page.waitForURL(/\/dashboard\/finance\/operations$/, {
    timeout: 60_000,
  });
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /compliance and finance operations/i,
    }),
  ).toBeVisible({ timeout: 90_000 });
  await expect(
    page.getByRole("alert").filter({ hasText: /ethiopia federal finance controls/i }),
  ).toContainText(
    /ethiopia federal finance controls/i,
    { timeout: 60_000 },
  );
  await expect(
    page.getByRole("region", { name: /tax obligations/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: /fixed assets and depreciation/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: /connected module events/i }),
  ).toBeVisible();

  const addOperation = page.getByRole("button", { name: /add operation/i });
  await addOperation.click();
  await expect(addOperation).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Foreign currency code (required)")).toBeVisible();
  await expect(page.getByLabel("Tax type (required)")).toBeVisible();
  await expect(page.getByLabel("Asset code (required)")).toBeVisible();
  await expect(page.getByLabel("Schedule name (required)")).toBeVisible();
  await expect(page.getByLabel("Bank account (required)")).toBeVisible();
  await expect(page.getByLabel("Sales document ID (required)")).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /compliance and finance operations/i,
    }),
  ).toBeVisible();
  const overflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);

  expect(failedFinanceRequests).toEqual([]);
  const actionableConsoleErrors = consoleErrors.filter(
    (message) =>
      !message.includes(
        "WebSocket connection to 'ws://localhost:9095/",
      ),
  );
  expect(actionableConsoleErrors).toEqual([]);
});
