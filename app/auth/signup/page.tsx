"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle, ArrowLeft, ArrowRight, BadgeCheck, Building2,
  Check, CheckCircle2, ChevronRight, CreditCard, Globe, HardDrive,
  Layers, Loader2, Lock, Mail, Phone, Rocket, ShieldCheck, Sparkles,
  Star, User, Zap, Crown, Eye, EyeOff, ExternalLink,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getAppOrigin, getBackendApiRoot } from "@/lib/runtime-context";
import {
  fetchPublicSubscriptionCatalog,
  startPublicSubscriptionCheckout,
  fetchPublicSubscriptionOrder,
} from "@/modules/subscription/api";
import { FALLBACK_TENANT_BUSINESS_TYPES, resolveBusinessTypeCatalog } from "@/modules/tenancy/landing-template";
import { useQuery, useMutation } from "@tanstack/react-query";

// ─── Plan metadata ──────────────────────────────────────────────────────────
type PlanMeta = {
  label: string; tagline: string; color: string; bg: string;
  ring: string; price: string; priceNote: string; storageMb: number;
  storageLabel: string; icon: React.ElementType; highlight?: boolean;
  features: string[];
};

type SignupPlan = PlanMeta & {
  key: string;
  monthlyPriceEtb: number;
};

type CatalogPlan = {
  name?: string;
  description?: string;
  monthly_price_etb?: number | string;
  mail_storage_quota_mb?: number | string;
  is_disabled?: boolean;
};

type CatalogModule = {
  slug: string;
  name: string;
};

type DirectTransferBankAccount = {
  id: string;
  label?: string;
  bank_name?: string;
  account_name?: string;
  account_number?: string;
  branch?: string | null;
  notes?: string | null;
};

type CheckoutErrorResponse = {
  response?: {
    data?: {
      errors?: Record<string, string[] | string>;
      message?: string;
    };
  };
  message?: string;
};

function getCheckoutErrorMessage(error: unknown) {
  const candidate = error as CheckoutErrorResponse;
  const validationErrors = candidate.response?.data?.errors;
  const validationSummary = validationErrors
    ? Object.values(validationErrors)
        .flatMap((value) => (Array.isArray(value) ? value : [value]))
        .filter(Boolean)
        .slice(0, 3)
        .join(" ")
    : null;

  return validationSummary
    || candidate.response?.data?.message
    || candidate.message
    || "Checkout failed. Please try again.";
}

const PLAN_META: Record<string, PlanMeta> = {
  larva: {
    label: "Larva", tagline: "Free forever — start small",
    color: "text-slate-500", bg: "from-slate-500/10 to-slate-400/5", ring: "ring-slate-500/30",
    price: "Free", priceNote: "forever", storageMb: 512, storageLabel: "512 MB",
    icon: Zap,
    features: ["Internal Mailbox", "512 MB mailbox quota", "Up to 5 users", "Shared DB instance", "Dashboard overview"],
  },
  startup: {
    label: "Startup", tagline: "Launch your operations",
    color: "text-sky-500", bg: "from-sky-500/10 to-cyan-400/5", ring: "ring-sky-500/30",
    price: "Free", priceNote: "/month", storageMb: 2048, storageLabel: "2 GB",
    icon: Rocket,
    features: ["Mailbox + File Manager", "Image Editor", "Document Converter", "2 GB storage quota", "Isolated DB schema"],
  },
  business: {
    label: "Business", tagline: "Full productivity suite",
    color: "text-indigo-500", bg: "from-indigo-500/10 to-violet-400/5", ring: "ring-indigo-500/30",
    price: "ETB 3,499", priceNote: "/month", storageMb: 10240, storageLabel: "10 GB",
    icon: Layers, highlight: true,
    features: ["All Startup modules", "Media Library + Video Player", "Advanced Analytics", "Audit Logs + Alerts", "Invoice & Billing + Inventory", "Security Management", "10 GB storage quota"],
  },
  enterprise: {
    label: "Enterprise", tagline: "Large-scale operations",
    color: "text-violet-500", bg: "from-violet-500/10 to-purple-400/5", ring: "ring-violet-500/30",
    price: "ETB 7,999", priceNote: "/month", storageMb: 51200, storageLabel: "50 GB",
    icon: Star,
    features: ["All Business modules", "Workflow Automation", "API Access + API Docs", "Fleet Management", "Developer tools", "50 GB storage quota", "Priority support"],
  },
  overlord: {
    label: "Overlord", tagline: "All-inclusive power",
    color: "text-amber-500", bg: "from-amber-500/10 to-orange-400/5", ring: "ring-amber-500/30",
    price: "ETB 12,999", priceNote: "/month", storageMb: 204800, storageLabel: "200 GB",
    icon: Crown,
    features: ["Every module unlocked", "200 GB storage quota", "Custom integrations", "Dedicated SLA", "Techive engineering support"],
  },
};

const PLAN_ORDER = ["larva", "startup", "business", "enterprise", "overlord"];

const PAYMENT_METHODS = [
  { code: "ARIFPAY", label: "ArifPay", icon: "💠", desc: "Choose your bank or wallet inside the ArifPay portal" },
  { code: "TELEBIRR_USSD", label: "Telebirr", icon: "📱", desc: "Pay via USSD or Telebirr app" },
  { code: "CBE", label: "Commercial Bank of Ethiopia", icon: "🏦", desc: "CBE Internet Banking" },
  { code: "AWASH_BIRR", label: "Awash Birr", icon: "🏦", desc: "Awash Birr checkout" },
  { code: "AMOLE", label: "Amole", icon: "📱", desc: "Amole wallet checkout" },
  { code: "ZAMZAM", label: "ZamZam Bank", icon: "🏦", desc: "ZamZam Bank checkout" },
  { code: "CARD", label: "Credit / Debit Card", icon: "💳", desc: "Visa or Mastercard" },
];

const CHECKOUT_RETURN_STORAGE_KEY = "hive.signup.checkout.return";
const ARIFPAY_RETURN_GRACE_MS = 3 * 60 * 1000;

type CheckoutReturnContext = {
  token: string;
  graceEndsAt: number;
};

type Step = "plan" | "workspace" | "checkout" | "confirm";
const STEPS: { key: Step; label: string; icon: React.ElementType }[] = [
  { key: "plan", label: "Choose Plan", icon: Sparkles },
  { key: "workspace", label: "Your Workspace", icon: Building2 },
  { key: "checkout", label: "Payment", icon: CreditCard },
  { key: "confirm", label: "Confirmed", icon: BadgeCheck },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
}

function buildTenantDomain(tenantId: string) {
  const slug = tenantId.trim().toLowerCase();
  if (!slug) return "";
  if (typeof window === "undefined") {
    return `${slug}.localhost`;
  }

  const hostname = window.location.hostname || "localhost";
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return `${slug}.localhost`;
  }

  const parts = hostname.split(".");
  const rootDomain = parts.length > 2 ? parts.slice(-2).join(".") : hostname;
  return `${slug}.${rootDomain}`;
}

function buildWorkspaceSignInUrl(host: string) {
  if (typeof window === "undefined" || !host) {
    return "/sign-in";
  }

  const port = host.endsWith(".localhost") && window.location.port ? `:${window.location.port}` : "";
  return `${window.location.protocol}//${host}${port}/sign-in`;
}

function formatPlanPrice(amount: number) {
  return amount <= 0 ? "Free" : `ETB ${amount.toLocaleString()}`;
}

function formatStorage(mb: number) {
  if (mb < 1024) return `${mb} MB`;
  if (mb < 1024 * 1024) return `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GB`;
  return `${(mb / 1024 / 1024).toFixed(1)} TB`;
}

function fallbackAmount(meta: PlanMeta) {
  if (meta.price.toLowerCase() === "free") return 0;
  return Number(meta.price.replace(/[^\d.]/g, "")) || 0;
}

function normalizeEthiopianMobileLocalPart(value: string) {
  let digits = value.replace(/\D+/g, "");

  if (digits.startsWith("251")) {
    digits = digits.slice(3);
  }

  if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  return digits.slice(0, 9);
}

function isValidEthiopianMobileLocalPart(value: string) {
  return /^9\d{8}$/.test(value);
}

function buildEthiopianMobileNumber(value: string) {
  return isValidEthiopianMobileLocalPart(value) ? `251${value}` : "";
}

function buildPlanFeatures(planKey: string, fallback: PlanMeta, planDefaults: Record<string, string[]>, catalog: CatalogModule[], storageLabel: string) {
  const moduleNames = new Map(catalog.map((module) => [module.slug, module.name]));
  const includedModules = (planDefaults[planKey] ?? [])
    .map((slug) => moduleNames.get(slug))
    .filter((name): name is string => Boolean(name));

  const features = Array.from(new Set([...includedModules.slice(0, 4), `${storageLabel} storage`]));
  return features.length ? features : fallback.features;
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function TenantSignupPage() {
  const router = useRouter();

  // State
  const [step, setStep] = useState<Step>("plan");
  const [selectedPlan, setSelectedPlan] = useState<string>("business");
  const [businessType, setBusinessType] = useState<string>("general");
  const [orgName, setOrgName] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [billingPhone, setBillingPhone] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [checkoutChannel, setCheckoutChannel] = useState<"gateway" | "direct_transfer">("gateway");
  const [paymentMethod, setPaymentMethod] = useState("TELEBIRR_USSD");
  const [manualBankAccountId, setManualBankAccountId] = useState("");
  const [manualTransactionReference, setManualTransactionReference] = useState("");
  const [error, setError] = useState("");
  const [orderToken, setOrderToken] = useState<string | null>(null);
  const [tenantIdError, setTenantIdError] = useState("");
  const [checkoutReturnContext, setCheckoutReturnContext] = useState<CheckoutReturnContext | null>(null);
  const [graceExpired, setGraceExpired] = useState(false);
  const checkRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydratedCheckoutReturnRef = useRef(false);
  const appliedBusinessTypeFromQueryRef = useRef(false);

  // Derive tenantId from orgName
  useEffect(() => {
    setTenantId(slugify(orgName));
  }, [orgName]);

  // Real-time tenant ID availability check
  useEffect(() => {
    if (!tenantId || tenantId.length < 3) { setTenantIdError(""); return; }
    if (checkRef.current) clearTimeout(checkRef.current);
    checkRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${getBackendApiRoot()}/check-tenant/${tenantId}`);
        if (res.ok) setTenantIdError("This workspace ID is already taken. Choose another name.");
        else setTenantIdError("");
      } catch {
        setTenantIdError("");
      }
    }, 500);
  }, [tenantId]);

  // Public catalog (for plan pricing confirmation)
  const { data: catalogData } = useQuery({
    queryKey: ["public-catalog"],
    queryFn: fetchPublicSubscriptionCatalog,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const catalogPayload = catalogData?.data ?? {};
  const catalogModules = (catalogPayload.catalog ?? []) as CatalogModule[];
  const planPricing = (catalogPayload.plan_pricing ?? {}) as Record<string, CatalogPlan>;
  const planDefaults = (catalogPayload.plan_defaults ?? {}) as Record<string, string[]>;
  const businessTypes = useMemo(
    () => resolveBusinessTypeCatalog(catalogPayload.business_types ?? FALLBACK_TENANT_BUSINESS_TYPES),
    [catalogPayload.business_types]
  );
  const businessTypeMap = useMemo(
    () => Object.fromEntries(businessTypes.map((option) => [option.key, option])),
    [businessTypes]
  );
  const activeBusinessType = businessTypeMap[businessType] ?? businessTypes[0] ?? FALLBACK_TENANT_BUSINESS_TYPES[0];
  const planOptions = useMemo<SignupPlan[]>(() => {
    const hasLivePlans = Object.keys(planPricing).length > 0;

    return PLAN_ORDER.flatMap((planKey) => {
      const fallback = PLAN_META[planKey];
      const pricing = planPricing[planKey];

      if (!fallback || (hasLivePlans && !pricing) || pricing?.is_disabled) {
        return [];
      }

      const rawPrice = Number(pricing?.monthly_price_etb ?? fallbackAmount(fallback));
      const rawStorage = Number(pricing?.mail_storage_quota_mb ?? fallback.storageMb);
      const monthlyPriceEtb = Number.isFinite(rawPrice) ? rawPrice : fallbackAmount(fallback);
      const storageMb = Number.isFinite(rawStorage) ? rawStorage : fallback.storageMb;
      const storageLabel = formatStorage(storageMb);

      return [{
        ...fallback,
        key: planKey,
        label: pricing?.name ?? fallback.label,
        tagline: pricing?.description ?? fallback.tagline,
        monthlyPriceEtb,
        price: formatPlanPrice(monthlyPriceEtb),
        priceNote: monthlyPriceEtb <= 0 ? (planKey === "larva" ? "forever" : "/month") : "/month",
        storageMb,
        storageLabel,
        features: buildPlanFeatures(planKey, fallback, planDefaults, catalogModules, storageLabel),
      }];
    });
  }, [catalogModules, planDefaults, planPricing]);

  const planMap = useMemo(
    () => Object.fromEntries(planOptions.map((plan) => [plan.key, plan])),
    [planOptions]
  );
  const availablePlanKeys = useMemo(() => planOptions.map((plan) => plan.key), [planOptions]);

  useEffect(() => {
    if (availablePlanKeys.length > 0 && !availablePlanKeys.includes(selectedPlan)) {
      setSelectedPlan(availablePlanKeys[0]);
    }
  }, [availablePlanKeys, selectedPlan]);

  useEffect(() => {
    if (!businessTypeMap[businessType]) {
      setBusinessType((businessTypes[0] ?? FALLBACK_TENANT_BUSINESS_TYPES[0]).key);
    }
  }, [businessType, businessTypeMap, businessTypes]);

  useEffect(() => {
    if (appliedBusinessTypeFromQueryRef.current || typeof window === "undefined" || businessTypes.length === 0) {
      return;
    }

    const requestedBusinessType = new URLSearchParams(window.location.search)
      .get("business_type")
      ?.trim()
      .toLowerCase();

    if (!requestedBusinessType) {
      appliedBusinessTypeFromQueryRef.current = true;
      return;
    }

    if (businessTypeMap[requestedBusinessType]) {
      setBusinessType(requestedBusinessType);
      appliedBusinessTypeFromQueryRef.current = true;
    }
  }, [businessTypeMap, businessTypes.length]);

  const planMeta = planMap[selectedPlan] ?? planOptions[0] ?? { ...PLAN_META.business, key: "business", monthlyPriceEtb: fallbackAmount(PLAN_META.business) };
  const isFree = planMeta.monthlyPriceEtb <= 0;

  const paymentProvider = catalogData?.data?.payment_provider;
  const directTransfer = catalogData?.data?.direct_transfer;
  const providerCode = paymentProvider?.code ?? "";
  const providerLabel = paymentProvider?.label ?? "Payment Provider";
  const providerConfigured = paymentProvider?.configured ?? true;
  const providerMethods = useMemo(() => (
    paymentProvider?.payment_methods?.length
      ? paymentProvider.payment_methods
      : catalogData?.data?.payment_methods?.length
        ? catalogData.data.payment_methods
        : PAYMENT_METHODS.map(({ code, label }) => ({ code, label }))
  ), [catalogData?.data?.payment_methods, paymentProvider?.payment_methods]);
  const defaultPaymentMethodCode = providerMethods[0]?.code ?? "";
  const requiresBillingPhone = paymentProvider?.requires_billing_phone ?? true;
  const supportsPaymentMethods = paymentProvider?.supports_payment_methods ?? providerMethods.length > 0;
  const usesHostedArifPayPortal = providerCode === "arifpay";
  const showPaymentMethodSelector = !usesHostedArifPayPortal && supportsPaymentMethods && providerMethods.length > 0;
  const directTransferEnabled = Boolean(
    directTransfer?.enabled && directTransfer?.configured && directTransfer?.bank_accounts?.length
  );
  const workspaceHost = buildTenantDomain(tenantId);

  useEffect(() => {
    if (!supportsPaymentMethods) {
      setPaymentMethod("");
      return;
    }

    if (!providerMethods.some((method: { code: string }) => method.code === paymentMethod)) {
      setPaymentMethod(defaultPaymentMethodCode);
    }
  }, [defaultPaymentMethodCode, paymentMethod, providerMethods, supportsPaymentMethods]);

  useEffect(() => {
    if (!directTransferEnabled && checkoutChannel === "direct_transfer") {
      setCheckoutChannel("gateway");
    }
  }, [checkoutChannel, directTransferEnabled]);

  useEffect(() => {
    if (!isFree && !providerConfigured && directTransferEnabled && checkoutChannel === "gateway") {
      setCheckoutChannel("direct_transfer");
    }
  }, [checkoutChannel, directTransferEnabled, isFree, providerConfigured]);

  const clearReturnParams = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    const cleanUrl = `${window.location.pathname}${window.location.hash}`;
    window.history.replaceState({}, "", cleanUrl);
  }, []);

  const storeCheckoutReturnContext = useCallback((token: string) => {
    if (typeof window === "undefined") {
      return;
    }

    const nextContext: CheckoutReturnContext = {
      token,
      graceEndsAt: Date.now() + ARIFPAY_RETURN_GRACE_MS,
    };

    window.sessionStorage.setItem(CHECKOUT_RETURN_STORAGE_KEY, JSON.stringify(nextContext));
    setCheckoutReturnContext(nextContext);
    setGraceExpired(false);
  }, []);

  const clearStoredCheckoutReturnContext = useCallback(() => {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(CHECKOUT_RETURN_STORAGE_KEY);
    }

    setCheckoutReturnContext(null);
    setGraceExpired(false);
  }, []);

  // Checkout mutation
  const checkoutMutation = useMutation({
    mutationFn: (payload: unknown) => startPublicSubscriptionCheckout(payload),
    onSuccess: (res) => {
      const order = res?.data?.order;
      const checkoutUrlRes = order?.provider_checkout_url || res?.data?.checkout_url;
      if (order?.public_token) setOrderToken(order.public_token);
      if (checkoutUrlRes) {
        window.location.assign(checkoutUrlRes);
      } else {
        setStep("confirm");
      }
    },
    onError: (err: unknown) => {
      setError(getCheckoutErrorMessage(err));
    },
  });

  const resetCheckoutForm = useCallback((message = "") => {
    clearStoredCheckoutReturnContext();
    setOrderToken(null);
    setBillingPhone("");
    setCheckoutChannel("gateway");
    setPaymentMethod(defaultPaymentMethodCode);
    setManualBankAccountId("");
    setManualTransactionReference("");
    setError(message);
    setStep("checkout");
    checkoutMutation.reset();
  }, [checkoutMutation, clearStoredCheckoutReturnContext, defaultPaymentMethodCode]);

  // Order status polling (when returning from checkout)
  const { data: orderData } = useQuery({
    queryKey: ["public-order", orderToken],
    queryFn: () => fetchPublicSubscriptionOrder(orderToken!),
    enabled: Boolean(orderToken) && step === "confirm",
    refetchInterval: (query) => {
      const status = query.state.data?.data?.order?.status;

      if (!orderToken || step !== "confirm" || status === "provisioned" || status === "manual_payment_rejected") {
        return false;
      }

      const awaitingArifPaySettlement = (
        usesHostedArifPayPortal
        && checkoutReturnContext?.token === orderToken
        && !graceExpired
        && (status === "failed" || status === "cancelled")
      );

      if ((status === "failed" || status === "cancelled") && !awaitingArifPaySettlement) {
        return false;
      }

      if (status === "pending_manual_review") {
        return 10000;
      }

      return 3000;
    },
    refetchIntervalInBackground: false,
  });

  // Handle provider return
  useEffect(() => {
    if (hydratedCheckoutReturnRef.current) {
      return;
    }

    hydratedCheckoutReturnRef.current = true;

    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const token = params.get("token") || params.get("checkout");
    const cancelled = params.get("cancelled");

    if (token) {
      setError("");
      setOrderToken(token);
      setStep("confirm");
      storeCheckoutReturnContext(token);
      clearReturnParams();
      return;
    }

    if (cancelled) {
      clearStoredCheckoutReturnContext();
      setOrderToken(null);
      setBillingPhone("");
      setCheckoutChannel("gateway");
      setPaymentMethod(defaultPaymentMethodCode);
      setManualBankAccountId("");
      setManualTransactionReference("");
      setError("Payment was cancelled. You can try again.");
      setStep("checkout");
      checkoutMutation.reset();
      clearReturnParams();
      return;
    }

    const savedContext = window.sessionStorage.getItem(CHECKOUT_RETURN_STORAGE_KEY);

    if (!savedContext) {
      return;
    }

    try {
      const parsed = JSON.parse(savedContext) as Partial<CheckoutReturnContext>;
      const savedToken = typeof parsed?.token === "string" ? parsed.token : "";
      const savedGraceEndsAt = typeof parsed?.graceEndsAt === "number" ? parsed.graceEndsAt : 0;

      if (!savedToken) {
        clearStoredCheckoutReturnContext();
        return;
      }

      setOrderToken(savedToken);
      setStep("confirm");
      setCheckoutReturnContext({
        token: savedToken,
        graceEndsAt: savedGraceEndsAt,
      });
      setGraceExpired(savedGraceEndsAt > 0 && savedGraceEndsAt <= Date.now());
    } catch {
      clearStoredCheckoutReturnContext();
    }
  }, [
    checkoutMutation,
    clearReturnParams,
    clearStoredCheckoutReturnContext,
    defaultPaymentMethodCode,
    storeCheckoutReturnContext,
  ]);

  useEffect(() => {
    if (!checkoutReturnContext?.graceEndsAt) {
      setGraceExpired(false);
      return;
    }

    if (checkoutReturnContext.graceEndsAt <= Date.now()) {
      setGraceExpired(true);
      return;
    }

    setGraceExpired(false);
    const timer = window.setTimeout(() => setGraceExpired(true), checkoutReturnContext.graceEndsAt - Date.now());

    return () => window.clearTimeout(timer);
  }, [checkoutReturnContext?.graceEndsAt]);

  const order = orderData?.data?.order;
  const shouldHoldArifPayFailureState = Boolean(
    usesHostedArifPayPortal
    && orderToken
    && checkoutReturnContext?.token === orderToken
    && !graceExpired
    && (order?.status === "failed" || order?.status === "cancelled")
  );

  useEffect(() => {
    if (!order) {
      return;
    }

    if (order.status === "provisioned" || order.status === "pending_manual_review" || order.status === "manual_payment_rejected") {
      clearStoredCheckoutReturnContext();
      return;
    }

    if ((order.status === "failed" || order.status === "cancelled") && !shouldHoldArifPayFailureState) {
      clearStoredCheckoutReturnContext();
    }
  }, [order, clearStoredCheckoutReturnContext, shouldHoldArifPayFailureState]);

  const stepIndex = STEPS.findIndex(s => s.key === step);
  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  // ── Validation ──────────────────────────────────────────────────────────
  const canGoToWorkspace = availablePlanKeys.includes(selectedPlan);
  const canGoToCheckout = orgName.trim().length >= 2 && tenantId.length >= 3 && !tenantIdError
    && adminName.trim().length >= 2 && adminEmail.includes("@") && adminPassword.length >= 8;
  const directTransferSelected = !isFree && checkoutChannel === "direct_transfer";
  const gatewaySelected = !isFree && checkoutChannel !== "direct_transfer";
  const canSubmitCheckout = canGoToCheckout
    && (isFree || directTransferSelected || providerConfigured)
    && (!gatewaySelected || !requiresBillingPhone || isValidEthiopianMobileLocalPart(billingPhone))
    && (!gatewaySelected || !showPaymentMethodSelector || Boolean(paymentMethod))
    && (!directTransferSelected || Boolean(manualBankAccountId))
    && (!directTransferSelected || manualTransactionReference.trim().length >= 4);

  const handleCheckout = () => {
    setError("");
    clearStoredCheckoutReturnContext();
    setOrderToken(null);
    const normalizedBillingPhone = buildEthiopianMobileNumber(billingPhone);

    checkoutMutation.mutate({
      id: tenantId,
      name: orgName.trim(),
      plan: selectedPlan,
      business_type: businessType,
      domain: workspaceHost,
      admin_name: adminName.trim(),
      admin_email: adminEmail.trim(),
      admin_password: adminPassword,
      billing_phone: gatewaySelected ? normalizedBillingPhone || undefined : undefined,
      checkout_channel: directTransferSelected ? "direct_transfer" : "gateway",
      payment_method: isFree || !gatewaySelected || !showPaymentMethodSelector ? undefined : paymentMethod || undefined,
      manual_bank_account_id: directTransferSelected ? manualBankAccountId : undefined,
      manual_transaction_reference: directTransferSelected ? manualTransactionReference.trim() : undefined,
      selected_modules: [],
      success_url_base: getAppOrigin(),
      cancel_url_base: getAppOrigin(),
    });
  };

  // ── Render helpers ───────────────────────────────────────────────────────
  const PlanIcon = planMeta.icon;

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20 overflow-x-hidden">

      {/* Background decoration */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-[100px]" />
        <div className="tech-grid absolute inset-0 opacity-20" />
      </div>

      {/* Top nav */}
      <nav className="fixed top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 font-space text-xl font-black tracking-tight group">
          <Globe className="h-5 w-5 text-primary group-hover:rotate-180 transition-transform duration-700" />
          <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">HIVE.OS</span>
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-xs text-muted-foreground hidden sm:block">Already have a workspace?</span>
          <Link href="/request-demo">
            <Button variant="ghost" size="sm" className="rounded-full font-bold text-xs gap-1.5">
              Request Demo <ChevronRight className="h-3 w-3" />
            </Button>
          </Link>
          <Link href="/sign-in">
            <Button variant="outline" size="sm" className="rounded-full font-bold text-xs gap-1.5">
              Sign In <ChevronRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </nav>

      <div className="relative z-10 pt-24 pb-20 px-4">
        <div className="max-w-5xl mx-auto">

          {/* Header */}
          {step !== "confirm" && (
            <div className="text-center mb-10">
              <Badge className="mb-3 bg-primary/10 text-primary border-none font-mono text-[11px] tracking-widest uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse mr-2" />
                New Workspace Registration
              </Badge>
              <h1 className="text-4xl sm:text-5xl font-black font-space tracking-tight mb-3">
                Deploy Your <span className="text-primary">Hive Node</span>
              </h1>
              <p className="text-muted-foreground max-w-xl mx-auto text-sm sm:text-base">
                Choose a plan, configure your workspace, and get your isolated tenant environment
                provisioned in minutes through {providerLabel}.
              </p>
            </div>
          )}

          {/* Step indicator */}
          {step !== "confirm" && (
            <div className="mb-10">
              <div className="flex items-center justify-center gap-0 mb-4">
                {STEPS.map((s, i) => {
                  const Icon = s.icon;
                  const done = i < stepIndex;
                  const active = i === stepIndex;
                  return (
                    <React.Fragment key={s.key}>
                      <div className={cn(
                        "flex flex-col items-center gap-1.5 px-4",
                      )}>
                        <div className={cn(
                          "h-9 w-9 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all",
                          done ? "bg-emerald-500 border-emerald-500 text-white" :
                            active ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/30" :
                              "bg-background border-border text-muted-foreground"
                        )}>
                          {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                        </div>
                        <span className={cn("text-[11px] font-bold uppercase tracking-widest hidden sm:block",
                          active ? "text-foreground" : "text-muted-foreground"
                        )}>{s.label}</span>
                      </div>
                      {i < STEPS.length - 1 && (
                        <div className={cn("flex-1 max-w-16 h-0.5 transition-all", i < stepIndex ? "bg-emerald-500" : "bg-border")} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
              <Progress value={progress} className="h-1 max-w-md mx-auto [&>div]:bg-primary" />
            </div>
          )}

          {/* ─── STEP 1: PLAN SELECTION ─────────────────────────────────── */}
          {step === "plan" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-8">
                {planOptions.map(meta => {
                  const planKey = meta.key;
                  const Icon = meta.icon;
                  const isSelected = selectedPlan === planKey;

                  return (
                    <button
                      key={planKey}
                      onClick={() => setSelectedPlan(planKey)}
                      className={cn(
                        "relative flex flex-col text-left rounded-[1.75rem] border p-5 transition-all duration-300 hover:shadow-lg focus:outline-none",
                        isSelected
                          ? `ring-2 ${meta.ring} border-transparent bg-gradient-to-br ${meta.bg} shadow-md`
                          : "border-border/50 bg-card/40 backdrop-blur-md hover:bg-card/60 hover:border-primary/30"
                      )}
                    >
                      {meta.highlight && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-[11px] font-black uppercase tracking-widest px-3 py-0.5 rounded-full shadow-md shadow-indigo-500/30">
                          Most Popular
                        </div>
                      )}
                      {isSelected && (
                        <div className="absolute top-4 right-4 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="h-3 w-3 text-primary-foreground" />
                        </div>
                      )}
                      <div className={cn("h-10 w-10 rounded-2xl flex items-center justify-center mb-3 bg-gradient-to-br", meta.bg)}>
                        <Icon className={cn("h-5 w-5", meta.color)} />
                      </div>

                      <p className={cn("text-[11px] font-black uppercase tracking-widest mb-0.5", meta.color)}>{meta.label}</p>
                      <p className="text-[11px] text-muted-foreground mb-3">{meta.tagline}</p>

                      <div className="mb-3">
                        <span className="text-2xl font-black text-foreground">{meta.price}</span>
                        <span className="text-[11px] text-muted-foreground ml-1">{meta.priceNote}</span>
                      </div>

                      <div className={cn("rounded-lg px-2 py-1 mb-3 text-[11px] font-bold flex items-center gap-1.5", meta.color, `bg-gradient-to-br ${meta.bg}`)}>
                        <HardDrive className="h-3 w-3 shrink-0" />
                        {meta.storageLabel} storage
                      </div>

                      <ul className="space-y-1.5">
                        {meta.features.slice(0, 4).map((f, i) => (
                          <li key={i} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <Check className={cn("h-3 w-3 shrink-0", meta.color)} />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>
              {planOptions.length === 0 && (
                <Alert variant="destructive" className="mb-8 bg-destructive/5 border-destructive/20">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs font-mono">
                    No active subscription plans are available right now.
                  </AlertDescription>
                </Alert>
              )}

              {/* Selected plan summary */}
              {canGoToWorkspace && (
                <div className={cn(
                  "rounded-[2rem] border p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5 mb-6",
                  `ring-1 ${planMeta.ring} border-transparent bg-gradient-to-br ${planMeta.bg}`
                )}>
                  <div className={cn("h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 bg-white/10 backdrop-blur-sm border border-white/10")}>
                    <PlanIcon className={cn("h-7 w-7", planMeta.color)} />
                  </div>
                  <div className="flex-1">
                    <p className={cn("text-[11px] font-black uppercase tracking-widest mb-0.5", planMeta.color)}>Selected: {planMeta.label}</p>
                    <p className="text-sm text-muted-foreground">{planMeta.tagline}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {planMeta.features.map((f, i) => (
                        <span key={i} className="text-[11px] bg-background/50 border border-border/50 px-2 py-0.5 rounded-full text-muted-foreground">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-black text-foreground">{planMeta.price}</p>
                    <p className="text-xs text-muted-foreground">{planMeta.priceNote}</p>
                    {isFree && <Badge className="mt-1 bg-emerald-500/10 text-emerald-500 border-none text-[11px]">No card required</Badge>}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  onClick={() => setStep("workspace")}
                  disabled={!canGoToWorkspace}
                  className="rounded-full px-8 font-bold gap-2 shadow-lg shadow-primary/20"
                  size="lg"
                >
                  Continue to Workspace Setup <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ─── STEP 2: WORKSPACE CONFIG ──────────────────────────────── */}
          {step === "workspace" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto">
              <div className="rounded-[2rem] border border-border/50 bg-card/40 backdrop-blur-md p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-8">
                  <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black tracking-tight">Workspace Configuration</h2>
                    <p className="text-xs text-muted-foreground">Set up your organization and administrator account</p>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Org name */}
                  <div className="space-y-2">
                    <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Organization Name *</Label>
                    <div className="relative group">
                      <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <Input
                        id="org-name"
                        value={orgName}
                        onChange={e => setOrgName(e.target.value)}
                        placeholder="Techive Technology Solutions"
                        className="pl-10 h-12 bg-muted/30 border-border focus:ring-1 focus:ring-primary/50"
                      />
                    </div>
                  </div>

                  {/* Tenant ID (read-only derived) */}
                  <div className="space-y-2">
                    <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Workspace ID (auto-generated)</Label>
                    <div className="relative group">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="tenant-id"
                        value={tenantId}
                        onChange={e => setTenantId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                        placeholder="techive-technology-solutions"
                        className={cn(
                          "pl-10 h-12 bg-muted/30 border-border focus:ring-1 focus:ring-primary/50 font-mono",
                          tenantIdError && "border-destructive/50 ring-1 ring-destructive/30"
                        )}
                      />
                      {tenantId && !tenantIdError && tenantId.length >= 3 && (
                        <Check className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
                      )}
                    </div>
                    {tenantIdError ? (
                      <p className="text-xs text-destructive flex items-center gap-1.5">
                        <AlertCircle className="h-3 w-3 shrink-0" /> {tenantIdError}
                      </p>
                    ) : tenantId && (
                      <p className="text-[11px] text-muted-foreground font-mono">
                        Your portal will be at: <span className="text-primary">{workspaceHost}</span>
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Business Type *</Label>
                    <Select value={businessType} onValueChange={setBusinessType}>
                      <SelectTrigger className="h-12 bg-muted/30 border-border focus:ring-1 focus:ring-primary/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-border/50 shadow-xl">
                        {businessTypes.map((option) => (
                          <SelectItem key={option.key} value={option.key}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="rounded-[1.5rem] border border-border/50 bg-background/60 px-4 py-3">
                      <p className="text-xs font-bold text-foreground">{activeBusinessType.label}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {activeBusinessType.description}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-border/50 pt-6">
                    <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-4">Administrator Account</p>
                    <div className="grid sm:grid-cols-2 gap-4">
                      {/* Admin name */}
                      <div className="space-y-2">
                        <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Full Name *</Label>
                        <div className="relative group">
                          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                          <Input
                            id="admin-name"
                            value={adminName}
                            onChange={e => setAdminName(e.target.value)}
                            placeholder="Abebe Kebede"
                            className="pl-10 h-12 bg-muted/30 border-border focus:ring-1 focus:ring-primary/50"
                          />
                        </div>
                      </div>
                      {/* Admin email */}
                      <div className="space-y-2">
                        <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Work Email *</Label>
                        <div className="relative group">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                          <Input
                            id="admin-email"
                            type="email"
                            value={adminEmail}
                            onChange={e => setAdminEmail(e.target.value)}
                            placeholder="admin@techive.et"
                            className="pl-10 h-12 bg-muted/30 border-border focus:ring-1 focus:ring-primary/50"
                          />
                        </div>
                      </div>
                    </div>
                    {/* Password */}
                    <div className="space-y-2 mt-4">
                      <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Password (min 8 characters) *</Label>
                      <div className="relative group">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                          id="admin-password"
                          type={showPass ? "text" : "password"}
                          value={adminPassword}
                          onChange={e => setAdminPassword(e.target.value)}
                          placeholder="••••••••••"
                          className="pl-10 pr-10 h-12 bg-muted/30 border-border focus:ring-1 focus:ring-primary/50 font-mono tracking-widest"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPass(v => !v)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {adminPassword && (
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex gap-1">
                            {[1, 2, 3, 4].map(i => (
                              <div key={i} className={cn("h-1 w-8 rounded-full transition-all", adminPassword.length >= i * 2 ? (i <= 2 ? "bg-amber-500" : "bg-emerald-500") : "bg-border")} />
                            ))}
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            {adminPassword.length < 6 ? "Too short" : adminPassword.length < 8 ? "Weak" : adminPassword.length < 12 ? "Good" : "Strong"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-6">
                <Button variant="ghost" onClick={() => setStep("plan")} className="rounded-full gap-2 text-muted-foreground">
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <Button
                  onClick={() => setStep("checkout")}
                  disabled={!canGoToCheckout}
                  className="rounded-full px-8 font-bold gap-2 shadow-lg shadow-primary/20"
                  size="lg"
                >
                  Continue to Payment <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ─── STEP 3: CHECKOUT ──────────────────────────────────────── */}
          {step === "checkout" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto">
              {error && (
                <Alert variant="destructive" className="mb-6 bg-destructive/5 border-destructive/20">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs font-mono">{error}</AlertDescription>
                </Alert>
              )}

              {/* Order summary */}
              <div className={cn(
                "rounded-[2rem] border p-6 mb-5 bg-gradient-to-br",
                planMeta.bg, `ring-1 ${planMeta.ring} border-transparent`
              )}>
                <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-4">Order Summary</p>
                <div className="space-y-3">
                  {[
                    { label: "Plan", value: `${planMeta.label} — ${planMeta.price} ${planMeta.priceNote}` },
                    { label: "Business Type", value: activeBusinessType.label },
                    { label: "Workspace ID", value: tenantId, mono: true },
                    { label: "Organization", value: orgName },
                    { label: "Admin", value: `${adminName} <${adminEmail}>`, mono: true },
                    { label: "Storage Quota", value: planMeta.storageLabel },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between items-center text-sm gap-4">
                      <span className="text-muted-foreground text-xs">{row.label}</span>
                      <span className={cn("font-bold text-foreground truncate", row.mono && "font-mono text-xs")}>{row.value}</span>
                    </div>
                  ))}
                  <div className="border-t border-border/30 pt-3 flex justify-between items-center">
                    <span className="font-black text-foreground">Total Today</span>
                    <span className={cn("text-2xl font-black", planMeta.color)}>
                      {isFree ? "Free" : planMeta.price}
                    </span>
                  </div>
                </div>
              </div>

              {!isFree && !providerConfigured && !directTransferEnabled && (
                <Alert variant="destructive" className="mb-5 bg-destructive/5 border-destructive/20">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs font-mono">
                    {providerLabel} checkout is missing setup and no direct bank transfer fallback is ready yet. Ask the central admin to complete Payment Provider Settings before accepting paid signups.
                  </AlertDescription>
                </Alert>
              )}

              {!isFree && !providerConfigured && directTransferEnabled && (
                <Alert className="mb-5 border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs font-mono">
                    {providerLabel} checkout is missing setup right now, but direct bank transfer is available below.
                  </AlertDescription>
                </Alert>
              )}

              {!isFree && (
                <div className="rounded-[2rem] border border-border/50 bg-card/40 backdrop-blur-md p-6 mb-5">
                  <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-4">
                    Checkout Details
                  </p>

                  <div className="space-y-4">
                    {directTransferEnabled && (
                      <div className="space-y-3">
                        <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                          Payment Path
                        </Label>
                        <div className="grid gap-3 md:grid-cols-2">
                          <button
                            type="button"
                            onClick={() => setCheckoutChannel("gateway")}
                            className={cn(
                              "rounded-2xl border p-4 text-left transition-all",
                              checkoutChannel === "gateway"
                                ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                                : "border-border/50 bg-background/50 hover:bg-muted/30"
                            )}
                          >
                            <div className="flex items-start gap-4">
                              <div className="rounded-2xl bg-primary/10 p-3">
                                <CreditCard className="h-5 w-5 text-primary" />
                              </div>
                              <div className="flex-1">
                                <p className="font-bold text-sm text-foreground">{providerLabel}</p>
                                <p className="text-xs text-muted-foreground">
                                  Use the automated checkout portal for instant confirmation.
                                </p>
                              </div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setCheckoutChannel("direct_transfer")}
                            className={cn(
                              "rounded-2xl border p-4 text-left transition-all",
                              checkoutChannel === "direct_transfer"
                                ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                                : "border-border/50 bg-background/50 hover:bg-muted/30"
                            )}
                          >
                            <div className="flex items-start gap-4">
                              <div className="rounded-2xl bg-primary/10 p-3">
                                <Building2 className="h-5 w-5 text-primary" />
                              </div>
                              <div className="flex-1">
                                <p className="font-bold text-sm text-foreground">Direct Bank Transfer</p>
                                <p className="text-xs text-muted-foreground">
                                  Transfer manually, then submit the bank transaction reference for admin review.
                                </p>
                              </div>
                            </div>
                          </button>
                        </div>
                      </div>
                    )}

                    {checkoutChannel === "gateway" ? (
                      <>
                        <div className="space-y-2">
                          <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                            {requiresBillingPhone ? "Billing Phone *" : "Contact Phone"}
                          </Label>
                          <div className="overflow-hidden rounded-xl border border-border bg-muted/30 transition-colors focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50">
                            <div className="flex h-12 items-center">
                              <div className="flex h-full items-center gap-2 border-r border-border bg-background/60 px-3 text-sm font-semibold text-foreground">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                <span>+251</span>
                              </div>
                              <Input
                                value={billingPhone}
                                onChange={e => setBillingPhone(normalizeEthiopianMobileLocalPart(e.target.value))}
                                placeholder={requiresBillingPhone ? "953912525" : "Optional"}
                                inputMode="numeric"
                                maxLength={9}
                                className="h-12 border-0 bg-transparent shadow-none focus-visible:ring-0"
                              />
                            </div>
                          </div>
                          {requiresBillingPhone && (
                            <p className="text-[11px] text-muted-foreground">
                              Enter the 9-digit mobile number only, for example <span className="font-mono">953912525</span>.
                            </p>
                          )}
                        </div>

                        {usesHostedArifPayPortal ? (
                          <div className="space-y-3">
                            <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                              Payment Provider
                            </Label>
                            <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4 ring-1 ring-primary/20">
                              <div className="flex items-center gap-4">
                                <span className="text-2xl">{PAYMENT_METHODS[0].icon}</span>
                                <div className="flex-1">
                                  <p className="font-bold text-sm text-foreground">ArifPay</p>
                                  <p className="text-xs text-muted-foreground">
                                    Choose your bank, wallet, or card after we send you to the ArifPay portal.
                                  </p>
                                </div>
                                <Badge className="border-none bg-primary/10 text-primary">Portal</Badge>
                              </div>
                            </div>
                          </div>
                        ) : showPaymentMethodSelector ? (
                          <div className="space-y-3">
                            <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                              Payment Method
                            </Label>
                            {providerMethods.map((m: { code: string; label: string }) => {
                              const methodMeta = PAYMENT_METHODS.find(item => item.code === m.code);

                              return (
                                <button
                                  key={m.code}
                                  onClick={() => setPaymentMethod(m.code)}
                                  className={cn(
                                    "w-full flex items-center gap-4 p-4 rounded-2xl border text-left transition-all",
                                    paymentMethod === m.code
                                      ? "border-primary/50 bg-primary/5 ring-1 ring-primary/30"
                                      : "border-border/50 bg-background/50 hover:bg-muted/30"
                                  )}
                                >
                                  <span className="text-2xl">{methodMeta?.icon ?? "?"}</span>
                                  <div className="flex-1">
                                    <p className="font-bold text-sm text-foreground">{m.label}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {methodMeta?.desc ?? `Pay with ${m.label}`}
                                    </p>
                                  </div>
                                  <div className={cn(
                                    "h-4 w-4 rounded-full border-2 transition-all",
                                    paymentMethod === m.code ? "border-primary bg-primary" : "border-muted-foreground/30"
                                  )}>
                                    {paymentMethod === m.code && <div className="w-full h-full flex items-center justify-center"><span className="w-1.5 h-1.5 rounded-full bg-white block" /></div>}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-border/50 bg-background/50 px-4 py-3">
                            <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                              Active Provider
                            </p>
                            <p className="mt-1 text-sm font-bold text-foreground">{providerLabel}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              You will be redirected to {providerLabel} to finish payment.
                            </p>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="space-y-3">
                        <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                          Direct Transfer Details
                        </Label>
                        {directTransfer?.instructions && (
                          <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs text-muted-foreground">
                            {directTransfer.instructions}
                          </div>
                        )}

                        <div className="space-y-3">
                          {((directTransfer?.bank_accounts ?? []) as DirectTransferBankAccount[]).map((account) => (
                            <button
                              key={account.id}
                              type="button"
                              onClick={() => setManualBankAccountId(account.id)}
                              className={cn(
                                "w-full rounded-2xl border p-4 text-left transition-all",
                                manualBankAccountId === account.id
                                  ? "border-primary/50 bg-primary/5 ring-1 ring-primary/30"
                                  : "border-border/50 bg-background/50 hover:bg-muted/30"
                              )}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <p className="font-bold text-sm text-foreground">{account.label}</p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {account.bank_name} - {account.account_name}
                                  </p>
                                  <p className="mt-1 text-sm font-mono text-foreground">{account.account_number}</p>
                                  {account.branch ? (
                                    <p className="mt-1 text-[11px] text-muted-foreground">Branch: {account.branch}</p>
                                  ) : null}
                                  {account.notes ? (
                                    <p className="mt-2 text-[11px] text-muted-foreground">{account.notes}</p>
                                  ) : null}
                                </div>
                                <div className={cn(
                                  "h-4 w-4 rounded-full border-2 transition-all mt-1",
                                  manualBankAccountId === account.id ? "border-primary bg-primary" : "border-muted-foreground/30"
                                )}>
                                  {manualBankAccountId === account.id && <div className="w-full h-full flex items-center justify-center"><span className="w-1.5 h-1.5 rounded-full bg-white block" /></div>}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>

                        <div className="space-y-2">
                          <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                            Transaction Reference *
                          </Label>
                          <Input
                            value={manualTransactionReference}
                            onChange={e => setManualTransactionReference(e.target.value)}
                            placeholder="Paste the bank transaction ID exactly as it appears on your receipt"
                            className="h-12 bg-background"
                          />
                          <p className="text-[11px] text-muted-foreground">
                            We will send this reference to the central admin for verification before activating your workspace.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-xl px-3 py-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                    {checkoutChannel === "gateway"
                      ? `Encrypted checkout powered by ${providerLabel}. You will be redirected to complete payment.`
                      : "Your submitted bank reference will be reviewed by the central admin before the workspace is activated."}
                  </div>
                </div>
              )}

              {isFree && (
                <div className="rounded-[2rem] border border-emerald-500/30 bg-emerald-500/5 p-5 mb-5 flex items-center gap-3">
                  <BadgeCheck className="h-6 w-6 text-emerald-500 shrink-0" />
                  <div>
                    <p className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">No payment required</p>
                    <p className="text-xs text-muted-foreground">Your workspace will be provisioned instantly after clicking the button below.</p>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={() => setStep("workspace")} className="rounded-full gap-2 text-muted-foreground">
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <Button
                  onClick={handleCheckout}
                  disabled={!canSubmitCheckout || checkoutMutation.isPending}
                  className="rounded-full px-8 font-bold gap-2 shadow-lg shadow-primary/20"
                  size="lg"
                >
                  {checkoutMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
                  ) : isFree ? (
                    <>Deploy Workspace <Rocket className="h-4 w-4" /></>
                  ) : directTransferSelected ? (
                    <>Submit Transfer Reference <ExternalLink className="h-4 w-4" /></>
                  ) : (
                    <>Proceed to {providerLabel} <ExternalLink className="h-4 w-4" /></>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* ─── STEP 4: CONFIRM ────────────────────────────────────────── */}
          {step === "confirm" && (
            <div className="animate-in fade-in zoom-in-95 duration-700 max-w-2xl mx-auto text-center">
              {/* Polling / loading state */}
              {orderToken && !order && (
                <div className="flex flex-col items-center gap-6 py-16">
                  <div className="relative">
                    <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                      <Loader2 className="h-10 w-10 text-primary animate-spin" />
                    </div>
                    <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black tracking-tight mb-2">Verifying Payment</h2>
                    <p className="text-muted-foreground text-sm">Waiting for {providerLabel} confirmation. This may take a few seconds…</p>
                  </div>
                </div>
              )}

              {/* Free plan instant provision */}
              {!orderToken && (
                <ConfirmSuccess
                  tenantId={tenantId}
                  workspaceHost={workspaceHost}
                  orgName={orgName}
                  planLabel={planMeta.label}
                  planColor={planMeta.color}
                  router={router}
                />
              )}

              {/* Paid plan — provisioned */}
              {order?.status === "provisioned" && (
                <ConfirmSuccess
                  tenantId={tenantId || order?.tenant_id}
                  workspaceHost={order?.tenant_domain || workspaceHost}
                  orgName={orgName}
                  planLabel={planMeta.label}
                  planColor={planMeta.color}
                  router={router}
                />
              )}

              {order?.status === "pending_manual_review" && (
                <div className="flex flex-col items-center gap-6 py-12">
                  <div className="h-20 w-20 rounded-full bg-amber-500/10 flex items-center justify-center">
                    <Building2 className="h-10 w-10 text-amber-500" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black tracking-tight mb-2">Awaiting Transfer Verification</h2>
                    <p className="text-muted-foreground text-sm max-w-md mx-auto">
                      Your bank transfer reference has been submitted. A central admin will compare it against the selected bank account and activate your workspace as soon as it matches.
                    </p>
                    <Badge className="mt-3 bg-amber-500/10 text-amber-600 border-none capitalize">
                      Status: awaiting admin verification
                    </Badge>
                    {order.manual_payment_reference ? (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Submitted reference: <span className="font-mono text-foreground">{order.manual_payment_reference}</span>
                      </p>
                    ) : null}
                    <p className="mt-3 text-xs text-muted-foreground">
                      We will also email {adminEmail || order.admin_email || "you"} once the transfer is approved or if the reference does not match.
                    </p>
                  </div>
                </div>
              )}

              {order?.status === "manual_payment_rejected" && (
                <div className="flex flex-col items-center gap-6 py-12">
                  <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center">
                    <AlertCircle className="h-10 w-10 text-destructive" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black tracking-tight mb-2">Reference Did Not Match</h2>
                    <p className="text-muted-foreground text-sm max-w-md mx-auto">
                      The central admin could not match the submitted transaction reference to the bank transfer. Please check the receipt, enter the correct reference, and send it again.
                    </p>
                    {order.manual_review_notes ? (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Review note: <span className="text-foreground">{order.manual_review_notes}</span>
                      </p>
                    ) : null}
                    <Button onClick={() => resetCheckoutForm("The submitted transaction reference did not match. Please review it and submit again.")} className="mt-6 rounded-full gap-2">
                      <ArrowLeft className="h-4 w-4" /> Submit Again
                    </Button>
                  </div>
                </div>
              )}

              {/* Paid — still pending */}
              {order && order.status !== "provisioned" && (
                order.status !== "pending_manual_review"
                && order.status !== "manual_payment_rejected"
                && (shouldHoldArifPayFailureState || (order.status !== "failed" && order.status !== "cancelled"))
              ) && (
                <div className="flex flex-col items-center gap-6 py-12">
                  <div className="h-20 w-20 rounded-full bg-amber-500/10 flex items-center justify-center">
                    <Loader2 className="h-10 w-10 text-amber-500 animate-spin" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black tracking-tight mb-2">
                      {shouldHoldArifPayFailureState ? "Finalizing Payment" : "Payment Processing"}
                    </h2>
                    <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                      {shouldHoldArifPayFailureState
                        ? "ArifPay sent you back before the session status fully settled. We are checking again now, and your workspace will unlock automatically once the gateway confirms it."
                        : "Your payment was received and is being verified. Your workspace will unlock automatically."}
                    </p>
                    <Badge className="mt-3 bg-amber-500/10 text-amber-600 border-none capitalize">
                      Status: {shouldHoldArifPayFailureState ? "awaiting final confirmation" : String(order.status).replaceAll("_", " ")}
                    </Badge>
                  </div>
                </div>
              )}

              {/* Paid — failed */}
              {!shouldHoldArifPayFailureState && (order?.status === "failed" || order?.status === "cancelled") && (
                <div className="flex flex-col items-center gap-6 py-12">
                  <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center">
                    <AlertCircle className="h-10 w-10 text-destructive" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black tracking-tight mb-2">Payment {order.status === "cancelled" ? "Cancelled" : "Failed"}</h2>
                    <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                      The payment could not be processed. You can try again below.
                    </p>
                    <Button onClick={() => resetCheckoutForm()} className="mt-6 rounded-full gap-2">
                      <ArrowLeft className="h-4 w-4" /> Try Again
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Success Screen ──────────────────────────────────────────────────────────
function ConfirmSuccess({ tenantId, workspaceHost, orgName, planLabel, planColor, router }: {
  tenantId: string; workspaceHost: string; orgName: string; planLabel: string; planColor: string;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <div className="py-10">
      <div className="relative inline-flex mb-8">
        <div className="h-24 w-24 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-500" />
        </div>
        <div className="absolute inset-0 rounded-full border-2 border-emerald-500/30 animate-ping" />
        <div className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-primary flex items-center justify-center border-2 border-background">
          <ShieldCheck className="h-4 w-4 text-primary-foreground" />
        </div>
      </div>

      <h1 className="text-4xl font-black font-space tracking-tight mb-3">
        Your Node is <span className="text-emerald-500">Live!</span>
      </h1>
      <p className="text-muted-foreground max-w-md mx-auto mb-8">
        <strong className="text-foreground">{orgName || "Your workspace"}</strong> has been provisioned on
        the <span className={planColor}>{planLabel}</span> plan. Sign in to your new dashboard to get started.
      </p>

      <div className="rounded-[2rem] border border-emerald-500/20 bg-emerald-500/5 p-6 max-w-sm mx-auto mb-8 text-left">
        <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-3">Access Details</p>
        <div className="space-y-2">
          {[
            { label: "Workspace URL", value: workspaceHost || buildTenantDomain(tenantId), mono: true },
            { label: "Plan", value: planLabel },
            { label: "Status", value: "Active", green: true },
          ].map(r => (
            <div key={r.label} className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground text-xs">{r.label}</span>
              <span className={cn("font-bold", r.mono && "font-mono text-xs text-primary", r.green && "text-emerald-500")}>
                {r.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Button
          onClick={() => window.location.href = buildWorkspaceSignInUrl(workspaceHost || buildTenantDomain(tenantId))}
          size="lg"
          className="rounded-full px-8 font-bold gap-2 shadow-lg shadow-primary/20"
        >
          Sign In to Dashboard <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={() => router.push("/")}
          className="rounded-full px-8 font-bold gap-2"
        >
          Back to Homepage
        </Button>
      </div>
    </div>
  );
}
