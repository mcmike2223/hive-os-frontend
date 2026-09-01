import { expect, test } from "@playwright/test";

const frontendUrl = (
  process.env.HIVE_E2E_ID_FRONTEND_URL ?? "http://apple.localhost:3001"
).replace(/\/$/, "");
const email = process.env.HIVE_E2E_ID_EMAIL ?? "admin@apple.com";
const password = process.env.HIVE_E2E_ID_PASSWORD ?? "password";
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

test("employee ID management is discoverable, accessible, and operational", async ({
  page,
}, testInfo) => {
  testInfo.setTimeout(180_000);
  const consoleErrors: string[] = [];
  const failedIdentityRequests: string[] = [];
  let workspaceResponse:
    | Promise<{ status: number; url: string; body: string }>
    | null = null;

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => {
    if (request.url().includes("/identity-card")) {
      failedIdentityRequests.push(
        `${request.method()} ${request.url()}: ${request.failure()?.errorText ?? "unknown failure"}`,
      );
    }
  });
  page.on("response", (response) => {
    if (response.url().includes("/identity-cards/workspace")) {
      workspaceResponse = response.text().then((body) => ({
        status: response.status(),
        url: response.url(),
        body,
      }));
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

  const dashboardNavigation = page.getByRole("navigation", {
    name: /dashboard navigation/i,
  });
  const modulesButton = dashboardNavigation.getByRole("button", {
    name: /^modules$/i,
  });
  await modulesButton.click();
  const humanResourcesButton = dashboardNavigation.getByRole("button", {
    name: /^human resources$/i,
  });
  await humanResourcesButton.click();
  await expect(
    dashboardNavigation.getByRole("link", {
      name: /^employee id management$/i,
    }),
  ).toHaveCount(0);

  const identityModuleButton = dashboardNavigation.getByRole("button", {
    name: /^employee id management$/i,
  });
  await expect(identityModuleButton).toBeVisible();
  await identityModuleButton.click();

  const identityModuleLinks = dashboardNavigation.getByRole("link").filter({
    hasText: /card register|issue cards|card templates|verify a card/i,
  });
  await expect(identityModuleLinks).toHaveCount(4);
  const identityLink = dashboardNavigation.getByRole("link", {
    name: /^card register$/i,
  });
  await identityLink.click();
  await expect(page).toHaveURL(
    /\/dashboard\/identity-cards$/,
    { timeout: 60_000 },
  );

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /^employee id management$/i,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("table", {
      name: /employee identity cards and available actions/i,
    }),
  ).toBeVisible({ timeout: 60_000 });

  const views = page.getByRole("tablist", {
    name: /employee id management views/i,
  });
  const cardsTab = views.getByRole("tab", { name: /cards & history/i });
  const issueTab = views.getByRole("tab", { name: /issue cards/i });
  await expect(cardsTab).toHaveAttribute("aria-selected", "true");
  await cardsTab.press("ArrowRight");
  await expect(issueTab).toBeFocused();
  await expect(issueTab).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("table", {
      name: /employees eligible for an identity card/i,
    }),
  ).toBeVisible({ timeout: 60_000 });
  await expect(page.getByLabel(/search hr employees/i)).toBeVisible();

  const templatesTab = views.getByRole("tab", { name: /^templates$/i });
  await templatesTab.click();
  const newTemplateButton = page.getByRole("button", {
    name: /new template/i,
  });
  await newTemplateButton.click();
  const templateDialog = page.getByRole("dialog", {
    name: /create credential template/i,
  });
  await expect(templateDialog).toBeVisible();
  await expect(templateDialog.getByLabel(/template name/i)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(templateDialog).toBeHidden();
  await expect(newTemplateButton).toBeFocused();

  await views.getByRole("tab", { name: /verify a card/i }).click();
  await expect(page.getByLabel(/qr link or verification id/i)).toBeVisible();

  await dashboardNavigation.getByRole("link", {
    name: /^card templates$/i,
  }).click();
  await expect(page).toHaveURL(
    /\/dashboard\/identity-cards\/templates$/,
    { timeout: 60_000 },
  );
  await expect(
    page.getByRole("tab", { name: /^templates$/i }),
  ).toHaveAttribute("aria-selected", "true");

  await dashboardNavigation.getByRole("link", {
    name: /^verify a card$/i,
  }).click();
  await expect(page).toHaveURL(
    /\/dashboard\/identity-cards\/verify$/,
    { timeout: 60_000 },
  );
  await expect(
    page.getByRole("tab", { name: /verify a card/i }),
  ).toHaveAttribute("aria-selected", "true");

  expect(workspaceResponse).not.toBeNull();
  const workspaceResult = await workspaceResponse!;
  expect(
    workspaceResult.status,
    `${workspaceResult.url} returned ${workspaceResult.body}`,
  ).toBe(200);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: /open navigation/i }).click();
  const mobileNavigation = page.locator(
    'nav[aria-label="Dashboard navigation"]:visible',
  );
  await expect(
    mobileNavigation.getByRole("button", { name: /^modules$/i }),
  ).toHaveAttribute("aria-expanded", "true");
  await expect(
    mobileNavigation.getByRole("button", {
      name: /^employee id management$/i,
    }),
  ).toHaveAttribute("aria-expanded", "true");
  await expect(
    mobileNavigation.getByRole("link", { name: /^card register$/i }),
  ).toBeVisible();
  await page.getByRole("button", { name: /close navigation/i }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 320, height: 720 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  expect(failedIdentityRequests).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
