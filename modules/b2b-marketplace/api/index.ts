// Public API client for the B2B Marketplace (landing + detail pages).
// Tenant is resolved server-side from the request headers injected by getTenantHeaders().
import { getBackendApiRoot, getTenantHeaders } from "@/lib/runtime-context";
import api from "@/modules/shared/api/http";

export type B2BCategory = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  growth: string | null;
  count: string | null;
  suppliers: number;
};

export type B2BProduct = {
  id: string;
  name: string;
  price: string | null;
  moq: string | null;
  image: string | null;
  supplier: string | null;
  supplier_id: number | null;
  supplier_logo: string | null;
  rating: number;
  reviews: number;
  location: string | null;
  verified: boolean;
  trade_assurance: boolean;
  badges: string[];
  lead_time: string | null;
  category: string | null;
};

export type B2BSupplier = {
  id: number;
  name: string;
  logo: string | null;
  country: string | null;
  flag: string | null;
  rating: number;
  years: number;
  products: number;
  verified: boolean;
  premium: boolean;
  on_time_rate: number | null;
};

export type B2BProductDetail = B2BProduct & {
  description: string | null;
  supplier_detail: B2BSupplier | null;
  related: B2BProduct[];
};

export type B2BSupplierDetail = B2BSupplier & {
  website: string | null;
  industry: string | null;
  product_list: B2BProduct[];
};

export type B2BCategoryDetail = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  growth: string | null;
  product_count: number;
  products: B2BProduct[];
  suppliers: B2BSupplier[];
};

async function get<T>(path: string, query?: Record<string, string | undefined>): Promise<T> {
  const root = getBackendApiRoot();
  const qs = query
    ? "?" +
      Object.entries(query)
        .filter(([, v]) => v != null && v !== "")
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&")
    : "";
  const res = await fetch(`${root}/public/b2b/${path}${qs}`, {
    headers: { Accept: "application/json", ...getTenantHeaders() },
  });
  if (!res.ok) throw new Error(`B2B API ${path} failed (${res.status})`);
  const json = await res.json();
  return json.data as T;
}

export const B2BApi = {
  categories: () => get<B2BCategory[]>("categories"),
  category: (slug: string) => get<B2BCategoryDetail>(`categories/${slug}`),
  suppliers: () => get<B2BSupplier[]>("suppliers"),
  supplier: (id: number | string) => get<B2BSupplierDetail>(`suppliers/${id}`),
  products: (params?: { category?: string; search?: string }) =>
    get<B2BProduct[]>("products", params),
  product: (id: number | string) => get<B2BProductDetail>(`products/${id}`),
  // Meilisearch-backed full-text search
  search: (q: string, category?: string) => get<B2BProduct[]>("search", { q, category }),
  // Public self-service registration (pending admin approval)
  register: async (payload: B2BRegisterPayload) => {
    const res = await fetch(`${getBackendApiRoot()}/public/b2b/register`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", ...getTenantHeaders() },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.message || `Registration failed (${res.status})`);
    return json as { message: string; data: { id: number; status: string } };
  },
};

export type B2BRegisterPayload = {
  name: string;
  email: string;
  password: string;
  company?: string;
  requested_role: "buyer" | "seller";
};

export type B2BRegistration = {
  id: number;
  name: string;
  email: string;
  company: string | null;
  requested_role: "buyer" | "seller";
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

// ── Authenticated dashboard analytics ──
export type B2BOverview = {
  kpis: {
    total_products: number;
    active_products: number;
    total_suppliers: number;
    verified_suppliers: number;
    total_categories: number;
    total_inquiries: number;
    open_inquiries: number;
    total_quotes: number;
    accepted_quotes: number;
    avg_product_rating: number;
    gmv: number;
    pipeline_value: number;
  };
  products_by_category: { name: string; count: number; growth: string | null }[];
  suppliers_by_country: { country: string; count: number }[];
  top_products: { name: string; rating: number; reviews: number; price: number }[];
  price_bands: { label: string; count: number }[];
  inquiries_by_status: { status: string; count: number }[];
  quotes_by_status: { status: string; count: number }[];
  listings_trend: { date: string; count: number }[];
};

export const fetchB2BOverview = async (): Promise<B2BOverview> =>
  (await api.get<B2BOverview>("/b2b-marketplace/dashboard/overview")).data;

// ── Workflow / portal types ──
export type B2BInquiry = {
  id: number;
  title: string;
  description: string;
  budget_range: string | null;
  status: "open" | "closed" | "awarded";
  category: string | null;
  category_id: number | null;
  buyer: string | null;
  quotes_count: number;
  created_at: string;
};

export type B2BQuote = {
  id: number;
  inquiry_id: number;
  inquiry_title: string | null;
  seller: string | null;
  seller_country: string | null;
  seller_flag: string | null;
  seller_rating: number | null;
  amount: number;
  currency: string;
  delivery_time_days: number | null;
  proposal_text: string;
  status: "pending" | "accepted" | "rejected";
  has_review: boolean | null;
  created_at: string;
};

export type B2BMessage = {
  id: number;
  message: string;
  sender: string | null;
  is_me: boolean;
  created_at: string;
};

export type B2BMyProduct = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  category_id: number | null;
  price: number | null;
  currency: string;
  price_unit: string | null;
  moq: string | null;
  lead_time: string | null;
  location: string | null;
  image_url: string | null;
  badges: string[];
  trade_assurance: boolean;
  is_featured: boolean;
  is_active: boolean;
  rating: number;
  reviews_count: number;
};

export type B2BReview = {
  id: number;
  rating: number;
  comment: string | null;
  seller: string | null;
  rfq: string | null;
  created_at: string;
};

const body = <T>(p: Promise<{ data: { data: T } }>) => p.then((r) => r.data.data);

export const B2BDash = {
  // RFQs
  inquiries: (scope?: "mine" | "open") =>
    body<B2BInquiry[]>(api.get("/b2b-marketplace/inquiries", { params: scope ? { scope } : {} })),
  createInquiry: (payload: { title: string; description: string; budget_range?: string; category_id?: number | null }) =>
    body<B2BInquiry>(api.post("/b2b-marketplace/inquiries", payload)),
  deleteInquiry: (id: number) => api.delete(`/b2b-marketplace/inquiries/${id}`),

  // Quotes
  quotes: () => body<B2BQuote[]>(api.get("/b2b-marketplace/quotes")),
  createQuote: (payload: { inquiry_id: number; amount: number; currency?: string; delivery_time_days?: number; proposal_text: string }) =>
    body<B2BQuote>(api.post("/b2b-marketplace/quotes", payload)),
  acceptQuote: (id: number) => body<B2BQuote>(api.post(`/b2b-marketplace/quotes/${id}/accept`)),
  rejectQuote: (id: number) => body<B2BQuote>(api.post(`/b2b-marketplace/quotes/${id}/reject`)),

  // Messages
  messages: (quoteId: number) => body<B2BMessage[]>(api.get(`/b2b-marketplace/quotes/${quoteId}/messages`)),
  sendMessage: (quoteId: number, message: string) =>
    body<B2BMessage>(api.post(`/b2b-marketplace/quotes/${quoteId}/messages`, { message })),

  // Seller products
  myProducts: () => body<B2BMyProduct[]>(api.get("/b2b-marketplace/products")),
  createProduct: (payload: Partial<B2BMyProduct>) => body<B2BMyProduct>(api.post("/b2b-marketplace/products", payload)),
  updateProduct: (id: string, payload: Partial<B2BMyProduct>) => body<B2BMyProduct>(api.put(`/b2b-marketplace/products/${id}`, payload)),
  deleteProduct: (id: string) => api.delete(`/b2b-marketplace/products/${id}`),

  // Reviews
  reviews: () => body<B2BReview[]>(api.get("/b2b-marketplace/reviews")),
  createReview: (payload: { quote_id: number; rating: number; comment?: string }) =>
    body<B2BReview>(api.post("/b2b-marketplace/reviews", payload)),

  // Favorites
  favorites: () => body<any[]>(api.get("/b2b-marketplace/favorites")),
  toggleFavorite: (productId: number | string) =>
    api.post("/b2b-marketplace/favorites/toggle", { product_id: productId }).then((r) => r.data),

  // Orders / checkout
  orders: () => body<B2BOrder[]>(api.get("/b2b-marketplace/orders")),
  order: (id: number | string) => body<B2BOrderDetail>(api.get(`/b2b-marketplace/orders/${id}`)),
  placeOrder: (payload: PlaceOrderPayload) => body<B2BOrder>(api.post("/b2b-marketplace/orders", payload)),

  // Registration approvals (admin)
  registrations: () => body<B2BRegistration[]>(api.get("/b2b-marketplace/registrations")),
  approveRegistration: (id: number) => api.post(`/b2b-marketplace/registrations/${id}/approve`).then((r) => r.data),
  rejectRegistration: (id: number) => api.post(`/b2b-marketplace/registrations/${id}/reject`).then((r) => r.data),

  // Payments & order mediation
  payOrder: (id: number, reference?: string) =>
    body<B2BOrder>(api.post(`/b2b-marketplace/orders/${id}/pay`, { reference })),
  stripeCheckout: (id: number, returnUrl: string) =>
    body<{ checkout_url: string }>(api.post(`/b2b-marketplace/orders/${id}/stripe-checkout`, { return_url: returnUrl })),
  orderInvoice: (id: number) => body<B2BInvoice>(api.get(`/b2b-marketplace/orders/${id}/invoice`)),
  adminOrders: () => body<B2BAdminOrder[]>(api.get("/b2b-marketplace/admin/orders")),
  confirmOrderPayment: (id: number) => api.post(`/b2b-marketplace/orders/${id}/confirm-payment`).then((r) => r.data),
  updateOrderStatus: (id: number, payload: { status?: string; payout_status?: string }) =>
    api.patch(`/b2b-marketplace/orders/${id}/status`, payload).then((r) => r.data),
  sellerOrders: () => body<B2BSellerOrder[]>(api.get("/b2b-marketplace/seller/orders")),
};

export type B2BOrderLine = { name: string; unit_price: number; quantity: number; line_total: number };

export type B2BOrder = {
  id: number;
  order_number: string;
  status: string;
  payment_status: "unpaid" | "pending_confirmation" | "paid" | "refunded";
  payment_method: string | null;
  payment_reference: string | null;
  payout_status: "pending" | "released";
  subtotal: number;
  platform_fee_percent: number;
  platform_fee_amount: number;
  seller_payout_amount: number;
  currency: string;
  items_count: number;
  items?: B2BOrderLine[];
  created_at: string;
};

export type B2BAdminOrder = B2BOrder & { buyer: string | null; shipping_name: string | null };

export type B2BSellerOrder = {
  id: number;
  order_number: string;
  status: string;
  payment_status: string;
  my_items: { name: string; quantity: number; line_total: number }[];
  my_gross: number;
  my_payout: number;
  created_at: string;
};

export type B2BInvoice = B2BOrderDetail & {
  platform_fee_percent: number;
  platform_fee_amount: number;
  seller_payout_amount: number;
  payment_status: string;
  payment_method: string | null;
  payment_reference: string | null;
  paid_at: string | null;
  is_admin_view: boolean;
  platform: { name: string };
};

export type B2BOrderDetail = B2BOrder & {
  shipping: { name: string; company: string | null; email: string; phone: string | null; address: string };
  notes: string | null;
  items: { id: number; name: string; unit_price: number; quantity: number; line_total: number }[];
};

export type PlaceOrderPayload = {
  items: { product_id: number; quantity: number }[];
  shipping_name: string;
  shipping_company?: string;
  shipping_email: string;
  shipping_phone?: string;
  shipping_address: string;
  notes?: string;
};
