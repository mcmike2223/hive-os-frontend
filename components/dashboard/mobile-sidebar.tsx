// components/dashboard/mobile-sidebar.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Boxes,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Command,
  FileType,
  KanbanSquare,
  Layers,
  LayoutDashboard,
  LayoutTemplate,
  ListTodo,
  LogOut,
  Mail,
  Menu,
  MessageCircle,
  Plus,
  RefreshCcw,
  Search,
  Utensils,
  Warehouse,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useChatAccess } from "@/hooks/use-chat-access";
import { DASHBOARD_NAV, DASHBOARD_SECONDARY, type NavItem } from "./nav";
import { usePermissions } from "@/hooks/use-permissions";
import { useTranslation } from "@/store/use-translation";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { useBusinessType } from "@/hooks/use-business-type";
import { useTenantModuleAccess } from "@/hooks/use-tenant-module-access";
import { cn } from "@/lib/utils";
import {
  getAuthHeaders,
  getBackendApiRoot,
  getBackendStorageUrl,
  getTenantHeaders,
  getWorkspaceScopeKey,
  isTenantSession,
} from "@/lib/runtime-context";
import { clearHiveSession, handleAuthFailureResponse } from "@/lib/auth-sync";

type SidebarIcon = React.ComponentType<{ className?: string }>;

const MODULE_IDS = new Set([
  "inventory",
  "hospitality",
  "warehouse",
  "workflow",
  "projectmanagement",
  "b2b-marketplace",
]);

const APP_PATH_PREFIXES = [
  "/dashboard/tools/converters",
  "/dashboard/tools/converter",
  "/dashboard/mail",
  "/dashboard/chat",
  "/dashboard/landing-templates",
];

const isAppPath = (href: string) =>
  APP_PATH_PREFIXES.some((prefix) => href === prefix || href.startsWith(`${prefix}/`));

const SecureMobileLogo = ({
  path,
  fallbackTitle,
}: {
  path?: string;
  fallbackTitle?: string;
}) => {
  const { t } = useTranslation();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setBlobUrl(null);
      return;
    }

    let isMounted = true;
    let objectUrl: string | null = null;
    const fullUrl = getBackendStorageUrl(path);

    if (!fullUrl) {
      setBlobUrl(null);
      return;
    }

    const fetchLogo = async () => {
      try {
        const res = await fetch(fullUrl, { headers: getAuthHeaders() });

        if (await handleAuthFailureResponse(res)) {
          return;
        }

        if (!res.ok) {
          throw new Error("Fetch blocked by server");
        }

        const contentType = res.headers.get("content-type");
        if (!contentType?.startsWith("image/")) {
          throw new Error("Not an image");
        }

        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);

        if (isMounted) {
          setBlobUrl(objectUrl);
        }
      } catch {
        if (isMounted) {
          setBlobUrl(fullUrl);
        }
      }
    };

    fetchLogo();

    return () => {
      isMounted = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [path]);

  if (blobUrl) {
    return (
      <div className="relative flex h-10 min-w-0 items-center transition-transform group-hover:scale-105">
        <img
          src={blobUrl}
          alt="Brand Logo"
          className="h-full w-auto max-w-[170px] object-contain"
        />
      </div>
    );
  }

  return (
    <div className="group flex min-w-0 items-center gap-3">
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform group-hover:scale-110">
        <Command className="h-5 w-5" />
      </div>
      <div className="min-w-0 leading-tight">
        <div className="max-w-[170px] truncate font-space text-base font-black tracking-tighter">
          {fallbackTitle || "HIVE.OS"}
        </div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {t("nav.control_hub", "Control Hub")}
        </div>
      </div>
    </div>
  );
};

export function MobileSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const { hasAnyPermission } = usePermissions();
  const { hasModule } = useTenantModuleAccess();
  const { hasChatWorkspace, hasMailboxModule } = useChatAccess();
  const { hasBusinessType } = useBusinessType();
  const { t } = useTranslation();

  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  const [isTenantNode, setIsTenantNode] = useState(false);

  // Desktop-matched defaults: all groups start closed, then route detection opens the active path.
  const [isModulesOpen, setIsModulesOpen] = useState(false);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [isWarehouseOpen, setIsWarehouseOpen] = useState(false);
  const [isHospitalityOpen, setIsHospitalityOpen] = useState(false);
  const [isProjectManagementOpen, setIsProjectManagementOpen] = useState(false);
  const [isWorkflowOpen, setIsWorkflowOpen] = useState(false);
  const [isB2BMarketplaceOpen, setIsB2BMarketplaceOpen] = useState(false);
  const [isAppsOpen, setIsAppsOpen] = useState(false);

  const canAccessConverter =
    hasAnyPermission(["use_document_converter", "manage_storage"]) &&
    (!isTenantNode || hasModule("document_converter"));
  const canAccessMail = !isTenantNode || hasMailboxModule;
  const canAccessLandingTemplates = hasAnyPermission([
    "manage_tenants",
    "provision_tenants",
  ]);

  useEffect(() => {
    setIsMounted(true);
    setIsTenantNode(isTenantSession());
  }, []);

  const workspaceScope = getWorkspaceScopeKey();

  const { data: brandData } = useQuery({
    queryKey: ["publicBrandSettings", "sidebar", workspaceScope],
    queryFn: async () => {
      const res = await fetch(`${getBackendApiRoot()}/settings/brand/public`, {
        headers: {
          Accept: "application/json",
          ...getTenantHeaders(),
        },
      });

      if (!res.ok) {
        return null;
      }

      return res.json();
    },
    enabled: isMounted,
  });

  const brandSettings = brandData?.data;
  const logoPath =
    resolvedTheme === "dark"
      ? brandSettings?.logo_dark
      : brandSettings?.logo_light;

  const handleLogout = () => {
    clearHiveSession();
    setOpen(false);
    router.push("/sign-in");
  };

  const closeSheet = () => setOpen(false);

  const hasAccess = useCallback(
    (item: NavItem) => {
      if (!isTenantNode && item.moduleId === "subscription") {
        return hasAnyPermission(["manage_tenants", "provision_tenants"]);
      }

      if (isTenantNode && item.href === "/dashboard/tenants") {
        return false;
      }

      if (
        item.businessTypes &&
        item.businessTypes.length > 0 &&
        !hasBusinessType(item.businessTypes)
      ) {
        return false;
      }

      if (isTenantNode && item.subscriptionSlug) {
        const requiredModules = Array.isArray(item.subscriptionSlug)
          ? item.subscriptionSlug
          : [item.subscriptionSlug];

        if (!requiredModules.some((slug) => hasModule(slug))) {
          return false;
        }
      }

      if (!item.permissions || item.permissions.length === 0) {
        return true;
      }

      return hasAnyPermission(item.permissions);
    },
    [hasAnyPermission, hasBusinessType, hasModule, isTenantNode],
  );

  const matchesSearch = useCallback(
    (item: NavItem) =>
      t(item.translationKey, item.fallbackLabel)
        .toLowerCase()
        .includes(searchQuery.toLowerCase()),
    [searchQuery, t],
  );

  const filteredNav = useMemo(() => {
    if (!isMounted) return [];

    return DASHBOARD_NAV.filter((item) => hasAccess(item) && matchesSearch(item));
  }, [hasAccess, isMounted, matchesSearch]);

  const filteredSecondary = useMemo(() => {
    if (!isMounted) return [];

    return DASHBOARD_SECONDARY.filter(
      (item) =>
        hasAccess(item) &&
        matchesSearch(item) &&
        item.moduleId !== "projectmanagement" &&
        item.moduleId !== "workflow" &&
        !isAppPath(item.href),
    );
  }, [hasAccess, isMounted, matchesSearch]);

  const projectManagementFromSecondary = useMemo(
    () =>
      isMounted
        ? DASHBOARD_SECONDARY.filter(
          (item) =>
            item.moduleId === "projectmanagement" &&
            hasAccess(item) &&
            matchesSearch(item),
        )
        : [],
    [hasAccess, isMounted, matchesSearch],
  );

  const workflowFromSecondary = useMemo(
    () =>
      isMounted
        ? DASHBOARD_SECONDARY.filter(
          (item) =>
            item.moduleId === "workflow" && hasAccess(item) && matchesSearch(item),
        )
        : [],
    [hasAccess, isMounted, matchesSearch],
  );

  const moduleNavItems = useMemo(
    () => [
      ...filteredNav.filter((item) => MODULE_IDS.has(item.moduleId ?? "")),
      ...projectManagementFromSecondary,
      ...workflowFromSecondary,
    ],
    [filteredNav, projectManagementFromSecondary, workflowFromSecondary],
  );

  const standardNavItems = useMemo(
    () =>
      filteredNav.filter(
        (item) =>
          !MODULE_IDS.has(item.moduleId ?? "") &&
          !isAppPath(item.href),
      ),
    [filteredNav],
  );

  const searchResults = useMemo(() => {
    const results = new Map<string, NavItem>();

    [...filteredNav, ...filteredSecondary].forEach((item) => {
      if (!isAppPath(item.href)) {
        results.set(item.href, item);
      }
    });

    return Array.from(results.values());
  }, [filteredNav, filteredSecondary]);

  const inventoryModuleItems = moduleNavItems.filter(
    (item) => item.moduleId === "inventory",
  );
  const hospitalityModuleItems = moduleNavItems.filter(
    (item) => item.moduleId === "hospitality",
  );
  const warehouseModuleItems = moduleNavItems.filter(
    (item) => item.moduleId === "warehouse",
  );
  const projectManagementModuleItems = moduleNavItems.filter(
    (item) => item.moduleId === "projectmanagement",
  );
  const workflowModuleItems = moduleNavItems.filter(
    (item) => item.moduleId === "workflow",
  );
  const b2bMarketplaceModuleItems = moduleNavItems.filter(
    (item) => item.moduleId === "b2b-marketplace",
  );

  useEffect(() => {
    if (pathname.startsWith("/dashboard/inventory")) {
      setIsModulesOpen(true);
      setIsInventoryOpen(true);
    }

    if (pathname.startsWith("/dashboard/hospitality")) {
      setIsModulesOpen(true);
      setIsHospitalityOpen(true);
    }

    if (pathname.startsWith("/dashboard/warehouse")) {
      setIsModulesOpen(true);
      setIsWarehouseOpen(true);
    }

    if (pathname.startsWith("/dashboard/project-management")) {
      setIsModulesOpen(true);
      setIsProjectManagementOpen(true);
    }

    if (pathname.startsWith("/dashboard/workflow")) {
      setIsModulesOpen(true);
      setIsWorkflowOpen(true);
    }

    if (pathname.startsWith("/dashboard/b2b-marketplace")) {
      setIsModulesOpen(true);
      setIsB2BMarketplaceOpen(true);
    }

    if (isAppPath(pathname)) {
      setIsAppsOpen(true);
    }
  }, [pathname]);

  const isActive = useCallback(
    (href: string) =>
      href === "/dashboard"
        ? pathname === "/dashboard"
        : pathname === href || pathname.startsWith(`${href}/`),
    [pathname],
  );

  const mainItemClass = (active: boolean) =>
    cn(
      "group flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] transition-all duration-200",
      active
        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 font-bold"
        : "border border-transparent text-muted-foreground font-semibold hover:bg-muted/80 hover:text-foreground",
    );

  const nestedItemClass = (active: boolean) =>
    cn(
      "group flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-[13px] transition-all duration-200",
      active
        ? "bg-primary/10 text-primary font-bold"
        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground font-semibold",
    );

  const dropdownTriggerClass = (openState: boolean) =>
    cn(
      "group flex items-center justify-between rounded-xl px-2.5 py-2 text-[13px] font-semibold transition-all duration-200 outline-none",
      openState
        ? "bg-muted/40 text-foreground"
        : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
    );

  const nestedTriggerClass = (openState: boolean) =>
    cn(
      "group flex items-center justify-between rounded-xl px-2.5 py-1.5 text-[13px] font-semibold transition-all duration-200 outline-none",
      openState
        ? "bg-muted/30 text-foreground"
        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
    );

  const renderMainItem = (item: NavItem) => {
    const Icon = item.icon as SidebarIcon;
    const active = isActive(item.href);
    const label = t(item.translationKey, item.fallbackLabel);

    return (
      <SheetClose asChild key={item.href}>
        <Link id={item.tourId} href={item.href} className={mainItemClass(active)}>
          <Icon
            className={cn(
              "h-4 w-4 shrink-0",
              active ? "text-primary-foreground" : "",
            )}
          />
          <span className="truncate">{label}</span>
        </Link>
      </SheetClose>
    );
  };

  const renderNestedItem = (item: NavItem) => {
    const Icon = item.icon as SidebarIcon;
    const active = isActive(item.href);
    const label = t(item.translationKey, item.fallbackLabel);

    return (
      <SheetClose asChild key={item.href}>
        <Link id={item.tourId} href={item.href} className={nestedItemClass(active)}>
          <Icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{label}</span>
        </Link>
      </SheetClose>
    );
  };

  const renderModuleSection = ({
    items,
    label,
    icon: Icon,
    openState,
    onToggle,
  }: {
    items: NavItem[];
    label: string;
    icon: SidebarIcon;
    openState: boolean;
    onToggle: () => void;
  }) => {
    if (items.length === 0) return null;

    return (
      <div className="flex flex-col gap-1">
        <button onClick={onToggle} className={nestedTriggerClass(openState)}>
          <div className="flex items-center gap-3">
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{label}</span>
          </div>
          {openState ? (
            <ChevronDown className="h-4 w-4 opacity-50" />
          ) : (
            <ChevronRight className="h-4 w-4 opacity-50" />
          )}
        </button>

        {openState && (
          <div className="flex flex-col gap-1 pl-4 animate-in slide-in-from-top-1 duration-200">
            {items.map(renderNestedItem)}
          </div>
        )}
      </div>
    );
  };

  const renderProjectManagementSection = () => {
    if (projectManagementModuleItems.length === 0) return null;

    return (
      <div className="flex flex-col gap-1">
        <div
          className={cn(
            "group flex items-center justify-between rounded-xl px-2.5 py-1.5 text-[13px] font-semibold transition-all duration-200",
            isProjectManagementOpen
              ? "bg-muted/30 text-foreground"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
          )}
        >
          <SheetClose asChild>
            <Link
              href="/dashboard/project-management"
              className="flex flex-1 items-center gap-3 overflow-hidden"
            >
              <ListTodo className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate font-bold text-foreground">{t("nav.project_management", "Project Management")}</span>
            </Link>
          </SheetClose>
          <button
            onClick={(event) => {
              event.preventDefault();
              setIsProjectManagementOpen((value) => !value);
            }}
            className="rounded-md p-1 transition-colors hover:bg-muted"
            aria-label="Toggle project management menu"
          >
            {isProjectManagementOpen ? (
              <ChevronDown className="h-4 w-4 opacity-50" />
            ) : (
              <ChevronRight className="h-4 w-4 opacity-50" />
            )}
          </button>
        </div>

        {isProjectManagementOpen && (
          <div className="mb-2 flex flex-col gap-1 pl-4 animate-in slide-in-from-top-1 duration-200">
            <SheetClose asChild>
              <Link
                href="/dashboard/project-management"
                className={nestedItemClass(pathname === "/dashboard/project-management")}
              >
                <LayoutDashboard className="h-4 w-4 shrink-0" />
                <span>{t("nav.pm_overview", "Overview")}</span>
              </Link>
            </SheetClose>

            <SheetClose asChild>
              <Link
                href="/dashboard/project-management/projects"
                className={nestedItemClass(
                  pathname.startsWith("/dashboard/project-management/projects"),
                )}
              >
                <KanbanSquare className="h-4 w-4 shrink-0" />
                <span>{t("nav.pm_projects", "Projects")}</span>
              </Link>
            </SheetClose>

            <SheetClose asChild>
              <Link
                href="/dashboard/project-management/my-tasks"
                className={nestedItemClass(
                  pathname.startsWith("/dashboard/project-management/my-tasks"),
                )}
              >
                <CheckCircle className="h-4 w-4 shrink-0" />
                <span>{t("nav.pm_my_tasks", "My Tasks")}</span>
              </Link>
            </SheetClose>

            <div className="pb-1 pr-2 pt-2">
              <Button
                size="sm"
                className="h-8 w-full gap-1.5 rounded-lg text-[11px] font-bold shadow-sm shadow-primary/20"
                onClick={() => {
                  closeSheet();
                  router.push("/dashboard/project-management/projects?create=true");
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                {t("nav.pm_create_project", "Create Project")}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderAppLink = (
    href: string,
    label: string,
    Icon: SidebarIcon,
    active: boolean,
    id?: string,
  ) => (
    <SheetClose asChild key={href}>
      <Link id={id} href={href} className={nestedItemClass(active)}>
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{label}</span>
      </Link>
    </SheetClose>
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          className="h-10 w-10 rounded-2xl border border-border/50 bg-card/40 p-0 shadow-sm backdrop-blur-xl hover:bg-muted/80 lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>

      <SheetContent
        side="left"
        className="z-[100] h-dvh w-[300px] max-w-[86vw] border-0 bg-transparent p-0 shadow-none outline-none [&>button]:hidden"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{t("nav.dashboard_nav", "Dashboard navigation")}</SheetTitle>
        </SheetHeader>

        <div className="m-3 flex h-[calc(100dvh-1.5rem)] min-h-0 flex-col overflow-hidden rounded-[1.25rem] border border-border/50 bg-card/40 p-2 shadow-2xl backdrop-blur-xl glass-panel">
          <div id="tour-sidebar-brand" className="mb-2 shrink-0">
            <div className="relative flex items-center justify-between gap-3 px-1 py-1">
              <SheetClose asChild>
                <Link
                  href="/dashboard"
                  className="group flex min-w-0 flex-1 items-center gap-3"
                >
                  <SecureMobileLogo
                    path={logoPath}
                    fallbackTitle={brandSettings?.app_title}
                  />
                </Link>
              </SheetClose>

              <SheetClose asChild>
                <Button
                  variant="ghost"
                  className="h-9 w-9 shrink-0 rounded-xl p-0 text-muted-foreground hover:bg-foreground/5"
                  aria-label="Close navigation"
                >
                  <X className="h-5 w-5" />
                </Button>
              </SheetClose>
            </div>
          </div>

          <div id="tour-sidebar-search" className="group relative mt-3 shrink-0 px-1">
            <Search className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <input
              type="text"
              placeholder={t("topbar.search_menu", "Search menu...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-border/40 bg-foreground/5 py-1.5 pl-8 pr-7 text-[13px] font-medium text-foreground transition-all placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Clear menu search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <nav
            id="tour-sidebar-nav"
            className="hive-mobile-sidebar-scroll mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto py-1 pr-2"
          >
            {searchQuery ? (
              searchResults.length > 0 ? (
                searchResults.map(renderMainItem)
              ) : (
                <div className="py-5 text-center text-xs font-semibold text-muted-foreground">
                  {t("nav.no_matches", "No matches found")}
                </div>
              )
            ) : (
              <>
                {standardNavItems.map(renderMainItem)}

                {moduleNavItems.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1">
                    <button
                      id="tour-nav-modules"
                      onClick={() => setIsModulesOpen((value) => !value)}
                      className={dropdownTriggerClass(isModulesOpen)}
                    >
                      <div className="flex items-center gap-3">
                        <Boxes className="h-4 w-4 shrink-0" />
                        <span className="truncate">{t("nav.modules", "Modules")}</span>
                      </div>
                      {isModulesOpen ? (
                        <ChevronDown className="h-4 w-4 opacity-50" />
                      ) : (
                        <ChevronRight className="h-4 w-4 opacity-50" />
                      )}
                    </button>

                    {isModulesOpen && (
                      <div className="mt-1 flex flex-col gap-1 pl-4 animate-in slide-in-from-top-2 duration-200">
                        {renderModuleSection({
                          items: inventoryModuleItems,
                          label: t("nav.inventory", "Inventory"),
                          icon: Boxes,
                          openState: isInventoryOpen,
                          onToggle: () => setIsInventoryOpen((value) => !value),
                        })}

                        {renderModuleSection({
                          items: hospitalityModuleItems,
                          label: t("nav.hospitality", "Hospitality"),
                          icon: Utensils,
                          openState: isHospitalityOpen,
                          onToggle: () => setIsHospitalityOpen((value) => !value),
                        })}

                        {renderModuleSection({
                          items: warehouseModuleItems,
                          label: t("nav.warehouse", "Warehouse Logic"),
                          icon: Warehouse,
                          openState: isWarehouseOpen,
                          onToggle: () => setIsWarehouseOpen((value) => !value),
                        })}

                        {renderProjectManagementSection()}

                        {renderModuleSection({
                          items: workflowModuleItems,
                          label: t("nav.workflow", "Workflow"),
                          icon: CheckCircle,
                          openState: isWorkflowOpen,
                          onToggle: () => setIsWorkflowOpen((value) => !value),
                        })}

                        {renderModuleSection({
                          items: b2bMarketplaceModuleItems,
                          label: t("nav.b2bMarketplace", "B2B Marketplace"),
                          icon: Boxes,
                          openState: isB2BMarketplaceOpen,
                          onToggle: () => setIsB2BMarketplaceOpen((value) => !value),
                        })}
                      </div>
                    )}
                  </div>
                )}

                {isMounted &&
                  (canAccessConverter ||
                    canAccessMail ||
                    hasChatWorkspace ||
                    canAccessLandingTemplates) && (
                    <div className="mt-2 flex flex-col gap-1">
                      <button
                        id="tour-nav-apps"
                        onClick={() => setIsAppsOpen((value) => !value)}
                        className={dropdownTriggerClass(isAppsOpen)}
                      >
                        <div className="flex items-center gap-3">
                          <Layers className="h-4 w-4 shrink-0" />
                          <span className="truncate">
                            {t("nav.apps_tools", "Apps & Tools")}
                          </span>
                        </div>
                        {isAppsOpen ? (
                          <ChevronDown className="h-4 w-4 opacity-50" />
                        ) : (
                          <ChevronRight className="h-4 w-4 opacity-50" />
                        )}
                      </button>

                      {isAppsOpen && (
                        <div className="mt-1 flex flex-col gap-1 pl-4 animate-in slide-in-from-top-2 duration-200">
                          {canAccessConverter &&
                            renderAppLink(
                              "/dashboard/tools/converters",
                              "Converters",
                              RefreshCcw,
                              pathname.startsWith("/dashboard/tools/converters"),
                              "tour-nav-converters-hub",
                            )}

                          {canAccessConverter &&
                            renderAppLink(
                              "/dashboard/tools/converter",
                              t("nav.tools_converter", "HTML to PDF"),
                              FileType,
                              pathname === "/dashboard/tools/converter",
                              "tour-nav-converter",
                            )}

                          {canAccessMail &&
                            renderAppLink(
                              "/dashboard/mail",
                              t("nav.mail", "Internal Mail"),
                              Mail,
                              pathname.includes("/dashboard/mail"),
                              "tour-nav-mail",
                            )}

                          {hasChatWorkspace &&
                            renderAppLink(
                              "/dashboard/chat",
                              t("nav.chat", "Real-time Chat"),
                              MessageCircle,
                              pathname.includes("/dashboard/chat"),
                              "tour-nav-chat",
                            )}

                          {canAccessLandingTemplates &&
                            !isTenantNode &&
                            renderAppLink(
                              "/dashboard/landing-templates",
                              t("nav.landing_templates", "Landing Templates"),
                              LayoutTemplate,
                              pathname.includes("/dashboard/landing-templates"),
                              "tour-nav-landing-templates",
                            )}
                        </div>
                      )}
                    </div>
                  )}

                {isMounted && (
                  <div
                    id="tour-sidebar-secondary"
                    className="mt-3 shrink-0 space-y-2 border-t border-border/40 pt-4"
                  >
                    {filteredSecondary.map((item) => {
                      const Icon = item.icon as SidebarIcon;
                      const active = isActive(item.href);
                      const label = t(item.translationKey, item.fallbackLabel);

                      return (
                        <SheetClose asChild key={item.href}>
                          <Link href={item.href} className={mainItemClass(active)}>
                            <Icon className="h-4 w-4 shrink-0" />
                            <span className="truncate">{label}</span>
                          </Link>
                        </SheetClose>
                      );
                    })}

                    <SheetClose asChild>
                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-bold text-destructive transition-colors hover:bg-destructive/15"
                      >
                        <LogOut className="h-4 w-4 shrink-0" />
                        <span className="truncate">
                          {t("nav.disconnect", "Disconnect Node")}
                        </span>
                      </button>
                    </SheetClose>

                    <div className="mt-2 flex items-center justify-between rounded-xl border border-border/40 bg-background/50 px-2.5 py-1.5">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        {t("nav.theme", "Theme")}
                      </span>
                      <ThemeToggle />
                    </div>
                  </div>
                )}
              </>
            )}
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  );
}
