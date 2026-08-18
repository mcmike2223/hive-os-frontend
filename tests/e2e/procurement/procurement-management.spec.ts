import { expect, test, type APIResponse, type Page } from "@playwright/test";

const frontendUrl = (
  process.env.HIVE_E2E_PROCUREMENT_FRONTEND_URL ?? "http://apple.localhost:3001"
).replace(/\/$/, "");
const email = process.env.HIVE_E2E_PROCUREMENT_EMAIL ?? "admin@apple.com";
const password = process.env.HIVE_E2E_PROCUREMENT_PASSWORD ?? "password";
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

type ApiEnvelope<T> = { data: T };
type ProcurementLine = {
  line_key: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  tax_rate: number;
  inventory_item_id?: number;
};
type AuthContext = {
  apiRoot: string;
  headers: Record<string, string>;
};

async function signIn(page: Page) {
  await page.addInitScript(() =>
    window.localStorage.setItem("hive_welcome_tour_completed", "true"),
  );
  await page.goto(`${frontendUrl}/sign-in`);
  await page.locator("#email").waitFor({ state: "visible", timeout: 90_000 });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /initiate handshake/i }).click();
  await page.waitForURL(/\/dashboard(?:$|\?)/, { timeout: 60_000 });
}

async function authenticatedContext(page: Page): Promise<AuthContext> {
  return page.evaluate(() => {
    const token = window.localStorage.getItem("hive_token");
    const tenant = window.localStorage.getItem("hive_context") ?? "apple";
    const signature = window.localStorage.getItem("hive_context_signature");
    if (!token) throw new Error("The authenticated Hive token is missing.");
    return {
      apiRoot: "http://127.0.0.1:8081/api/v1",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-Tenant": tenant,
        ...(signature ? { "X-Tenant-Signature": signature } : {}),
      },
    };
  });
}

async function assertOk(response: APIResponse, operation: string) {
  const body = await response.text();
  expect(
    response.ok(),
    `${operation} returned ${response.status()}: ${body}`,
  ).toBeTruthy();
  return JSON.parse(body) as unknown;
}

test("procurement works from qualified supplier through Finance posting", async ({
  page,
}) => {
  test.setTimeout(300_000);
  page.setDefaultNavigationTimeout(90_000);
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => {
    if (request.url().includes("/procurement")) {
      failedRequests.push(
        `${request.method()} ${request.url()}: ${request.failure()?.errorText ?? "unknown failure"}`,
      );
    }
  });

  await signIn(page);
  const auth = await authenticatedContext(page);
  const request = async (
    method: "GET" | "POST" | "PATCH",
    path: string,
    data?: Record<string, unknown>,
  ) => {
    const response = await page.request.fetch(`${auth.apiRoot}${path}`, {
      method,
      headers: auth.headers,
      data,
    });
    return assertOk(response, `${method} ${path}`);
  };

  const references = (await request(
    "GET",
    "/procurement/references",
  )) as ApiEnvelope<{
    inventory_items: Array<{ id: number }>;
  }>;
  const inventoryItemId = references.data.inventory_items[0]?.id;
  const stamp = Date.now().toString().slice(-10);
  const today = new Date().toISOString().slice(0, 10);
  const future = new Date(Date.now() + 30 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const supplierResponse = (await request("POST", "/procurement/suppliers", {
    name: `Harrewe Irrigation Supplier ${stamp}`,
    code: `HAR-${stamp}`,
    email: `harrewe-${stamp}@example.test`,
    legal_name: `Harrewe Irrigation Supplier ${stamp} PLC`,
    tax_identification_number: `TIN-${stamp}`,
    business_license_number: `BL-${stamp}`,
    country_code: "ETH",
    domestic_supplier: true,
    eligibility_status: "eligible",
    responsiveness_score: 90,
  })) as ApiEnvelope<{
    id: number;
    supplier_id: number;
  }>;
  const supplierProfileId = supplierResponse.data.id;
  const supplierId = supplierResponse.data.supplier_id;
  const reviewedSupplier = (await request(
    "PATCH",
    `/procurement/suppliers/${supplierProfileId}`,
    {
      eligibility_status: "eligible",
      quality_score: 92,
      delivery_score: 88,
      responsiveness_score: 90,
      invoice_accuracy_score: 94,
    },
  )) as ApiEnvelope<{ overall_score: string }>;
  expect(Number(reviewedSupplier.data.overall_score)).toBeGreaterThan(89);

  const requisitionResponse = (await request(
    "POST",
    "/procurement/requisitions",
    {
      title: `Harrewe drip irrigation materials ${stamp}`,
      business_justification:
        "Budget-backed irrigation materials for the integrated farm.",
      procurement_method: "open_tender",
      priority: "high",
      required_on: future,
      currency: "ETB",
      items: [
        {
          description: "Pressure-compensating drip line",
          quantity: 10,
          unit: "roll",
          unit_price: 1250,
          tax_rate: 15,
          ...(inventoryItemId ? { inventory_item_id: inventoryItemId } : {}),
        },
      ],
    },
  )) as ApiEnvelope<{ id: number }>;
  const requisitionId = requisitionResponse.data.id;
  await request(
    "POST",
    `/procurement/requisitions/${requisitionId}/actions/budget-check`,
    {
      budget_status: "available",
      budget_notes: "Verified against the approved Harrewe farm budget.",
    },
  );
  await request(
    "POST",
    `/procurement/requisitions/${requisitionId}/actions/submit`,
  );
  const approvedRequisition = (await request(
    "POST",
    `/procurement/requisitions/${requisitionId}/actions/approve`,
  )) as ApiEnvelope<{ status: string }>;
  expect(approvedRequisition.data.status).toBe("approved");

  const sourcingResponse = (await request(
    "POST",
    "/procurement/sourcing-events",
    {
      requisition_id: requisitionId,
      title: `Harrewe irrigation tender ${stamp}`,
      method: "open_tender",
      scope: "Supply and deliver drip irrigation materials to Harrewe farm.",
      estimated_value: 14375,
      currency: "ETB",
      egp_reference: `EGP-HAR-${stamp}`,
      standard_bidding_document: "Federal goods SBD",
      domestic_preference_percent: 10,
      tax_inclusive_evaluation: true,
      evaluation_criteria: [
        { key: "technical", weight: 40 },
        { key: "financial", weight: 50 },
        { key: "preference", weight: 10 },
      ],
    },
  )) as ApiEnvelope<{ id: number }>;
  const sourcingId = sourcingResponse.data.id;
  await request(
    "POST",
    `/procurement/sourcing-events/${sourcingId}/actions/publish`,
  );
  const bidResponse = (await request(
    "POST",
    `/procurement/sourcing-events/${sourcingId}/bids`,
    {
      supplier_id: supplierId,
      reference: `OFFER-${stamp}`,
      currency: "ETB",
      delivery_days: 14,
      payment_terms: "30 days after accepted delivery",
      valid_until: future,
      items: [
        {
          description: "Pressure-compensating drip line",
          quantity: 10,
          unit: "roll",
          unit_price: 1250,
          tax_rate: 15,
        },
      ],
    },
  )) as ApiEnvelope<{ id: number }>;
  const bidId = bidResponse.data.id;
  const evaluatedBid = (await request(
    "POST",
    `/procurement/supplier-bids/${bidId}/evaluate`,
    {
      technical_score: 91,
      financial_score: 95,
      preference_score: 100,
      evaluated_total: 14375,
      compliance_checks: [
        { check: "supplier_eligibility", passed: true },
        { check: "tax_clearance", passed: true },
      ],
      evaluation_notes:
        "Responsive bid; Ethiopian domestic preference recorded separately.",
      recommended: true,
    },
  )) as ApiEnvelope<{ status: string; total_score: string }>;
  expect(evaluatedBid.data.status).toBe("evaluated");
  expect(Number(evaluatedBid.data.total_score)).toBeGreaterThan(90);
  const awarded = (await request(
    "POST",
    `/procurement/sourcing-events/${sourcingId}/actions/award`,
    { supplier_bid_id: bidId },
  )) as ApiEnvelope<{
    id: number;
    items: ProcurementLine[];
    status: string;
  }>;
  const purchaseOrderId = awarded.data.id;
  let orderItems = awarded.data.items;
  expect(awarded.data.status).toBe("draft");

  if (inventoryItemId) {
    const updatedOrder = (await request(
      "PATCH",
      `/procurement/purchase-orders/${purchaseOrderId}`,
      {
        items: orderItems.map((line) => ({
          ...line,
          inventory_item_id: inventoryItemId,
        })),
      },
    )) as ApiEnvelope<{ items: ProcurementLine[] }>;
    orderItems = updatedOrder.data.items;
  }
  await request(
    "POST",
    `/procurement/purchase-orders/${purchaseOrderId}/actions/submit`,
  );
  await request(
    "POST",
    `/procurement/purchase-orders/${purchaseOrderId}/actions/approve`,
  );
  const issuedOrder = (await request(
    "POST",
    `/procurement/purchase-orders/${purchaseOrderId}/actions/issue`,
  )) as ApiEnvelope<{ status: string; finance_document_id?: number }>;
  expect(issuedOrder.data.status).toBe("issued");
  expect(issuedOrder.data.finance_document_id).toBeTruthy();
  await request(
    "POST",
    `/procurement/purchase-orders/${purchaseOrderId}/actions/confirm`,
    { reference: `SUPPLIER-CONFIRM-${stamp}` },
  );

  const invalidReceipt = await page.request.post(
    `${auth.apiRoot}/procurement/goods-receipts`,
    {
      headers: auth.headers,
      data: {
        purchase_order_id: purchaseOrderId,
        supplier_delivery_note: `INVALID-${stamp}`,
        received_on: today,
        items: orderItems.map((line) => ({
          ...line,
          received_quantity: 1,
          accepted_quantity: 2,
        })),
      },
    },
  );
  expect(invalidReceipt.status()).toBe(422);
  expect(await invalidReceipt.text()).toContain(
    "Accepted quantity cannot exceed the received quantity",
  );

  const receiptResponse = (await request(
    "POST",
    "/procurement/goods-receipts",
    {
      purchase_order_id: purchaseOrderId,
      supplier_delivery_note: `DN-${stamp}`,
      received_on: today,
      items: orderItems.map((line) => ({
        ...line,
        received_quantity: Number(line.quantity),
        accepted_quantity: Number(line.quantity),
        lot_number: `LOT-${stamp}`,
      })),
    },
  )) as ApiEnvelope<{ id: number }>;
  const receiptId = receiptResponse.data.id;
  await request("POST", `/procurement/goods-receipts/${receiptId}/inspect`, {
    inspection_method: "full",
    inspection_status: "passed",
    quality_notes: "Quantity, packaging, and specification accepted.",
    inspection_results: [{ check: "specification", result: "passed" }],
  });
  const postedReceipt = (await request(
    "POST",
    `/procurement/goods-receipts/${receiptId}/post`,
  )) as ApiEnvelope<{ status: string; stock_posted_at: string }>;
  expect(postedReceipt.data.status).toBe("posted");
  expect(postedReceipt.data.stock_posted_at).toBeTruthy();

  const invoiceResponse = (await request(
    "POST",
    "/procurement/supplier-invoices",
    {
      supplier_invoice_number: `VENDOR-${stamp}`,
      purchase_order_id: purchaseOrderId,
      invoice_date: today,
      due_date: future,
      currency: "ETB",
      price_tolerance_percent: 0,
      quantity_tolerance_percent: 0,
      items: orderItems,
    },
  )) as ApiEnvelope<{ id: number }>;
  const invoiceId = invoiceResponse.data.id;
  const matchedInvoice = (await request(
    "POST",
    `/procurement/supplier-invoices/${invoiceId}/actions/match`,
  )) as ApiEnvelope<{ status: string; match_status: string }>;
  expect(matchedInvoice.data.match_status).toBe("matched");
  await request(
    "POST",
    `/procurement/supplier-invoices/${invoiceId}/actions/submit`,
  );
  await request(
    "POST",
    `/procurement/supplier-invoices/${invoiceId}/actions/approve`,
  );
  const postedInvoice = (await request(
    "POST",
    `/procurement/supplier-invoices/${invoiceId}/actions/post`,
  )) as ApiEnvelope<{
    status: string;
    finance_document_id: number;
  }>;
  expect(postedInvoice.data.status).toBe("posted");
  expect(postedInvoice.data.finance_document_id).toBeTruthy();

  const agreement = (await request("POST", "/procurement/agreements", {
    supplier_id: supplierId,
    type: "framework",
    title: `Harrewe irrigation framework ${stamp}`,
    starts_on: today,
    ends_on: future,
    currency: "ETB",
    ceiling_amount: 500000,
    auto_replenishment: true,
    service_levels: [{ metric: "on_time_delivery", target: 95 }],
  })) as ApiEnvelope<{ id: number }>;
  const activeAgreement = (await request(
    "POST",
    `/procurement/agreements/${agreement.data.id}/actions/activate`,
  )) as ApiEnvelope<{ status: string }>;
  expect(activeAgreement.data.status).toBe("active");

  const audit = (await request(
    "GET",
    "/procurement/audit-events?per_page=100",
  )) as { data: Array<{ event: string }> };
  const events = audit.data.map((entry) => entry.event);
  expect(events).toContain("three_way_matched");
  expect(events).toContain("finance_bill_posted");
  expect(events).toContain("stock_posted");

  consoleErrors.length = 0;
  await page.goto(`${frontendUrl}/dashboard/procurement`);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /^procurement control tower$/i,
    }),
  ).toBeVisible({ timeout: 90_000 });
  await expect(
    page.getByRole("img", {
      name: /ordered and invoiced procurement spend by month/i,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: /procurement value by sourcing method/i,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Harrewe Irrigation Supplier", { exact: false }).first(),
  ).toBeVisible();

  const sectionNav = page.getByRole("navigation", {
    name: /procurement management sections/i,
  });
  const requisitionsLink = sectionNav.getByRole("link", {
    name: /^requisitions$/i,
  });
  await requisitionsLink.focus();
  await expect(requisitionsLink).toBeFocused();
  await requisitionsLink.press("Enter");
  await page.waitForURL(/\/dashboard\/procurement\/requisitions$/, { timeout: 90_000 });
  await expect(
    page.getByRole("heading", { level: 1, name: /^purchase requisitions$/i }),
  ).toBeVisible();
  const capture = page.getByText("Create or capture a record", { exact: true });
  await capture.focus();
  await expect(capture).toBeFocused();
  await capture.press("Enter");
  await expect(page.getByLabel("Request title")).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileOverflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(mobileOverflow.scrollWidth).toBeLessThanOrEqual(
    mobileOverflow.clientWidth + 1,
  );
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  await expect(
    page.getByRole("heading", { level: 1, name: /^purchase requisitions$/i }),
  ).toBeVisible();
  await page.evaluate(() => {
    document.documentElement.style.zoom = "1";
  });

  expect(failedRequests).toEqual([]);
  const actionableConsoleErrors = consoleErrors.filter(
    (message) =>
      !message.includes("WebSocket connection to 'ws://localhost:9095/"),
  );
  expect(actionableConsoleErrors).toEqual([]);
});
