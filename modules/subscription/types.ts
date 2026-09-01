import type { TenantBusinessTypeDefinition } from "@/modules/tenancy/landing-template";

export type SubscriptionBillingMode = "standard" | "hybrid";
export type SubscriptionBillingCycle = "monthly" | "yearly";

export type SubscriptionBillingPolicy = {
  monthly_term_days: number;
  yearly_term_days: number;
  yearly_discount_percent: number;
  grace_period_days: number;
  renewal_warning_days: number;
  reminder_interval_hours: number;
  reminder_max_displays: number;
  hybrid_enabled: boolean;
  hybrid_signup_notice: string;
  billing_cycles?: SubscriptionBillingCycle[];
  hybrid_enabled_plans?: string[];
  hybrid_activation_amounts_etb?: Record<string, Record<SubscriptionBillingCycle, number>>;
};

export type SubscriptionReminder = {
  should_show: boolean;
  reason: "activation_required" | "renewal_due" | "expired";
  warning_days: number;
  interval_hours: number;
  max_displays: number;
  display_count: number;
  remaining_displays: number;
  last_displayed_at?: string | null;
  cycle_key: string;
};

export type SubscriptionCoupon = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  discount_type: "percent" | "fixed";
  discount_value: number;
  valid_from?: string | null;
  valid_until?: string | null;
  max_redemptions?: number | null;
  max_redemptions_per_tenant: number;
  applicable_scopes: Array<"public_signup" | "hybrid_activation" | "tenant_upgrade" | "tenant_renewal">;
  applicable_plans: string[];
  applicable_billing_cycles: SubscriptionBillingCycle[];
  is_active: boolean;
  redemptions_count: number;
};

export type TenantCatalogModule = {
  slug: string;
  name: string;
  description: string;
  category: string;
  tone: string;
  recommended_plans: string[];
  monthly_price_etb?: number;
  billing_type?: "module" | "addon";
  is_addon?: boolean;
  route_hints?: string[];
  included_in_plan?: boolean;
  status?: "active" | "inactive" | "pending";
};

export type TenantSubscriptionFeature = {
  module_slug: string;
  submodule_slug: string;
  slug: string;
  name: string;
  feature_type: string;
  route_name?: string | null;
  route_uri?: string | null;
  http_methods?: string[] | null;
  permission?: string | null;
  module_gate?: string | null;
};

export type TenantSubscriptionSubmodule = {
  module_slug: string;
  slug: string;
  name: string;
  subscribed: boolean;
  status: "active" | "inactive" | "pending";
  route_prefixes?: string[];
  permissions?: string[];
  features: TenantSubscriptionFeature[];
  feature_count: number;
};

export type TenantSubscriptionFeatureMatrixModule = TenantCatalogModule & {
  subscribed: boolean;
  submodules: TenantSubscriptionSubmodule[];
  submodule_count: number;
  feature_count: number;
};

export type TenantSubscriptionFeatureMatrix = {
  modules: TenantSubscriptionFeatureMatrixModule[];
  module_count: number;
  subscribed_module_count: number;
  unsubscribed_module_count: number;
  submodule_count: number;
  feature_count: number;
};

export type SubscriptionAdminFeature = {
  id: number;
  subscription_module_id: number;
  subscription_submodule_id?: number | null;
  slug: string;
  name: string;
  feature_type: string;
  route_name?: string | null;
  route_uri?: string | null;
  http_methods?: string[] | null;
  permission?: string | null;
  module_gate?: string | null;
  monthly_price_etb?: number;
};

export type SubscriptionAdminSubmodule = {
  id: number;
  subscription_module_id: number;
  slug: string;
  name: string;
  description?: string | null;
  route_prefixes?: string[] | null;
  permissions?: string[] | null;
  monthly_price_etb?: number;
  features?: SubscriptionAdminFeature[];
};

export type SubscriptionAdminModule = TenantCatalogModule & {
  id: number;
  backend_module?: string | null;
  frontend_module?: string | null;
  submodules?: SubscriptionAdminSubmodule[];
  features?: SubscriptionAdminFeature[];
};

export type TenantCustomModuleInput = {
  slug?: string;
  name: string;
  description?: string | null;
  category?: string | null;
};

export type TenantSelectedModule = {
  slug: string;
  name: string;
  description?: string | null;
  category: string;
  tone: string;
  source: "catalog" | "custom";
};

export type TenantModuleSubscriptionPayload = {
  enabled_modules: string[];
  custom_modules: TenantCustomModuleInput[];
};

export type TenantResolvedModuleSubscriptions = TenantModuleSubscriptionPayload & {
  catalog_version?: number;
  updated_at?: string | null;
  updated_by?: string | null;
  selected_modules: TenantSelectedModule[];
  module_count: number;
  pending_modules?: string[];
  catalog_modules?: TenantCatalogModule[];
};

export type TenantPlanPricing = {
  name: string;
  description: string;
  monthly_price_etb: number;
  mail_storage_quota_mb: number;
  is_disabled?: boolean;
  is_free?: boolean;
};

export type TenantPaymentMethod = {
  code: string;
  label: string;
};

export type TenantDirectTransferBankAccount = {
  id: string;
  label: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  branch?: string | null;
  notes?: string | null;
  is_active?: boolean;
};

export type TenantDirectTransferSettings = {
  enabled: boolean;
  configured?: boolean;
  instructions?: string | null;
  bank_accounts: TenantDirectTransferBankAccount[];
};

export type TenantPaymentProvider = {
  code: string;
  label: string;
  description?: string;
  enabled?: boolean;
  configured?: boolean;
  implemented?: boolean;
  supports_payment_methods?: boolean;
  requires_billing_phone?: boolean;
  payment_methods?: TenantPaymentMethod[];
};

export type TenantSubscriptionCatalogPayload = {
  catalog: TenantCatalogModule[];
  plan_defaults: Record<string, string[]>;
  plan_pricing: Record<string, TenantPlanPricing>;
  business_types: TenantBusinessTypeDefinition[];
  billing_policy?: SubscriptionBillingPolicy;
};

export type TenantWorkspaceSubscription = {
  id: string;
  tenant_id: string;
  plan: string;
  status: "active" | "trial" | "grace_period" | "expired" | "inactive" | "cancelled" | "suspended" | "pending_activation";
  billing_cycle: SubscriptionBillingCycle;
  billing_mode: SubscriptionBillingMode;
  renewal_mode: string;
  started_at?: string | null;
  renewal_window_starts_at?: string | null;
  expires_at?: string | null;
  grace_ends_at?: string | null;
  last_renewed_at?: string | null;
  activation_paid_at?: string | null;
  next_payment_at?: string | null;
  seconds_until_expiration?: number | null;
  reminder?: SubscriptionReminder;
  days_until_expiration?: number | null;
  is_expiring_soon?: boolean;
  needs_renewal?: boolean;
  term_days?: number;
  grace_period_days?: number;
};

export type SubscriptionAdminPlan = {
  id: number;
  slug: string;
  name: string;
  description?: string | null;
  status: "active" | "inactive";
  billing_cycle: string;
  monthly_price_etb: number;
  mail_storage_quota_mb: number;
  trial_days?: number;
  metadata?: Record<string, unknown> | null;
};

export type SubscriptionAdminTenant = {
  id: string;
  name: string;
  plan: string;
  business_type?: string | null;
  admin_email?: string | null;
  is_active: boolean;
  subscription: TenantWorkspaceSubscription & {
    module_subscriptions: TenantResolvedModuleSubscriptions;
  };
};

export type TenantSubscriptionOrder = {
  id: string;
  public_token: string;
  scope: "public_signup" | "hybrid_activation" | "tenant_upgrade" | "tenant_renewal";
  status: string;
  provider?: string | null;
  payment_channel?: string | null;
  tenant_id?: string | null;
  subscription_id?: string | null;
  tenant_name?: string | null;
  tenant_domain?: string | null;
  admin_name?: string | null;
  admin_email?: string | null;
  plan: string;
  billing_mode?: SubscriptionBillingMode;
  billing_cycle?: SubscriptionBillingCycle;
  business_type?: string | null;
  billing_phone?: string | null;
  line_items: Array<{
    type: string;
    slug: string;
    name: string;
    description?: string | null;
    amount_etb: number;
  }>;
  plan_amount_etb?: number;
  addon_amount_etb?: number;
  subtotal_amount_etb?: number;
  discount_amount_etb?: number;
  coupon_code?: string | null;
  total_amount_etb: number;
  provider_session_id?: string | null;
  provider_transaction_id?: string | null;
  provider_checkout_url?: string | null;
  manual_payment_bank_account_id?: string | null;
  manual_payment_bank_account_snapshot?: TenantDirectTransferBankAccount | null;
  manual_payment_reference?: string | null;
  manual_payment_submitted_at?: string | null;
  manual_review_status?: string | null;
  manual_review_notes?: string | null;
  manual_reviewed_by?: string | null;
  manual_reviewed_at?: string | null;
  renewal_term_days?: number | null;
  paid_at?: string | null;
  provisioned_at?: string | null;
  created_at?: string | null;
  module_request?: TenantModuleSubscriptionPayload;
};

export type TenantModuleAccessState = {
  plan: string;
  subscription_status?: string;
  expires_at?: string | null;
  grace_ends_at?: string | null;
  needs_renewal?: boolean;
  active_modules: string[];
  statuses: Record<
    string,
    {
      active: boolean;
      included_in_plan: boolean;
      name: string;
      monthly_price_etb: number;
      billing_type?: "module" | "addon";
      is_addon?: boolean;
    }
  >;
};
