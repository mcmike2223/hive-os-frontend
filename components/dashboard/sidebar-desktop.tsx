"use client";

import React, { useCallback, useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Command,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  Search,
  X,
  Layers,
  ChevronDown,
  ChevronRight,
  FileType,
  Mail,
  Boxes,
  Warehouse,
  MessageCircle,
  LayoutTemplate,
  RefreshCcw,
  ListTodo,
  CheckCircle,
  Plus,
  KanbanSquare,
  LayoutDashboard,
  Utensils,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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

// 🚀 SECURE BRAND LOGO
const SecureSidebarLogo = ({
  path,
  fallbackTitle,
  collapsed,
}: {
  path?: string;
  fallbackTitle?: string;
  collapsed: boolean;
}) => {
  const { t } = useTranslation();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setBlobUrl(null);
      return;
    }
    let isMounted = true;
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
        if (!res.ok) throw new Error("Fetch blocked by server");

        const contentType = res.headers.get("content-type");
        if (!contentType?.startsWith("image/")) throw new Error("Not an image");

        const blob = await res.blob();
        if (isMounted) setBlobUrl(URL.createObjectURL(blob));
      } catch {
        if (isMounted) setBlobUrl(fullUrl);
      }
    };

    fetchLogo();
    return () => {
      isMounted = false;
    };
  }, [path]);

  if (blobUrl)
    return (
      <div
        className={cn(
          "relative flex items-center justify-center transition-transform group-hover:scale-105",
          collapsed ? "h-10 w-10" : "h-10",
        )}
      >
        <img
          src={blobUrl}
          alt="Brand Logo"
          className="h-full w-auto object-contain"
        />
      </div>
    );

  return (
    <div
      className={cn(
        "group flex items-center gap-3",
        collapsed ? "justify-center" : "",
      )}
    >
      <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform group-hover:scale-110">
        <Command className="h-5 w-5" />
      </div>
      {!collapsed && (
        <div className="leading-tight">
          <div className="text-base font-black tracking-tighter font-space truncate max-w-[160px]">
            {fallbackTitle || "HIVE.OS"}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
            {t("nav.control_hub", "Control Hub")}
          </div>
        </div>
      )}
    </div>
  );
};

export function DashboardSidebarDesktop({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const widthClass = collapsed ? "w-[76px]" : "w-[248px]";

  return (
    <aside
      className={cn(
        `mr-4 hidden shrink-0 lg:block transition-all duration-300 ease-out`,
        widthClass,
      )}
    >
      <div className="glass-panel hive-sidebar-panel sticky top-4 h-[calc(100vh-2rem)] rounded-[1.5rem] p-2 overflow-hidden flex flex-col">
        <SidebarInner collapsed={collapsed} onToggle={onToggle} />
      </div>
    </aside>
  );
}

function SidebarInner({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const { hasAnyPermission } = usePermissions();
  const { hasModule } = useTenantModuleAccess();
  const { hasChatWorkspace, hasMailboxModule } = useChatAccess();
  const { hasBusinessType } = useBusinessType();
  const { t } = useTranslation();

  const [searchQuery, setSearchQuery] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  const [isTenantNode, setIsTenantNode] = useState(false);

  const [isModulesOpen, setIsModulesOpen] = useState(false);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [isWarehouseOpen, setIsWarehouseOpen] = useState(false);
  const [isHospitalityOpen, setIsHospitalityOpen] = useState(false);
  const [isProjectManagementOpen, setIsProjectManagementOpen] = useState(false);
  const [isWorkflowOpen, setIsWorkflowOpen] = useState(false);
  const [isB2BMarketplaceOpen, setIsB2BMarketplaceOpen] = useState(false);
  // 🚀 Apps dropdown state
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

  const handleLogout = () => {
    clearHiveSession();
    router.push("/sign-in");
  };

  const hasAccess = useCallback(
    (item: NavItem) => {
      if (!isTenantNode && item.moduleId === "subscription")
        return hasAnyPermission(["manage_tenants", "provision_tenants"]);
      if (isTenantNode && item.href === "/dashboard/tenants") return false;
      if (
        item.businessTypes &&
        item.businessTypes.length > 0 &&
        !hasBusinessType(item.businessTypes)
      )
        return false;
      if (isTenantNode && item.subscriptionSlug) {
        const requiredModules = Array.isArray(item.subscriptionSlug)
          ? item.subscriptionSlug
          : [item.subscriptionSlug];
        if (!requiredModules.some((slug) => hasModule(slug))) return false;
      }
      if (!item.permissions || item.permissions.length === 0) return true;
      return hasAnyPermission(item.permissions);
    },
    [hasAnyPermission, hasBusinessType, hasModule, isTenantNode],
  );

  const filteredNav = useMemo(() => {
    if (!isMounted) return [];
    return DASHBOARD_NAV.filter(
      (item) =>
        hasAccess(item) &&
        t(item.translationKey, item.fallbackLabel)
          .toLowerCase()
          .includes(searchQuery.toLowerCase()),
    );
  }, [hasAccess, searchQuery, t, isMounted]);

  const filteredSecondary = useMemo(() => {
    if (!isMounted) return [];
    return DASHBOARD_SECONDARY.filter(
      (item) =>
        hasAccess(item) &&
        t(item.translationKey, item.fallbackLabel)
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) &&
        item.moduleId !== "projectmanagement" &&
        item.moduleId !== "workflow",
    );
  }, [hasAccess, searchQuery, t, isMounted]);

  const projectManagementFromSecondary = isMounted
    ? DASHBOARD_SECONDARY.filter(
        (item) =>
          item.moduleId === "projectmanagement" &&
          hasAccess(item) &&
          t(item.translationKey, item.fallbackLabel)
            .toLowerCase()
            .includes(searchQuery.toLowerCase()),
      )
    : [];
  const workflowFromSecondary = isMounted
    ? DASHBOARD_SECONDARY.filter(
        (item) =>
          item.moduleId === "workflow" &&
          hasAccess(item) &&
          t(item.translationKey, item.fallbackLabel)
            .toLowerCase()
            .includes(searchQuery.toLowerCase()),
      )
    : [];

  const moduleNavItems = [
    ...filteredNav.filter(
      (item) =>
        item.moduleId === "inventory" ||
        item.moduleId === "hospitality" ||
        item.moduleId === "warehouse" ||
        item.moduleId === "workflow" ||
        item.moduleId === "projectmanagement" ||
        item.moduleId === "b2b-marketplace",
    ),
    ...projectManagementFromSecondary,
    ...workflowFromSecondary,
  ];
  const standardNavItems = filteredNav.filter(
    (item) =>
      item.moduleId !== "inventory" &&
      item.moduleId !== "hospitality" &&
      item.moduleId !== "warehouse" &&
      item.moduleId !== "workflow" &&
      item.moduleId !== "projectmanagement" &&
      item.moduleId !== "b2b-marketplace" &&
      item.href !== "/dashboard/landing-templates",
  );
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
    if (pathname.startsWith("/dashboard/warehouse")) {
      setIsModulesOpen(true);
      setIsWarehouseOpen(true);
    }
    if (pathname.startsWith("/dashboard/hospitality")) {
      setIsModulesOpen(true);
      setIsHospitalityOpen(true);
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
    if (
      pathname.startsWith("/dashboard/tools/converter") ||
      pathname.startsWith("/dashboard/tools/converters") ||
      pathname.startsWith("/dashboard/mail") ||
      pathname.startsWith("/dashboard/chat") ||
      pathname.startsWith("/dashboard/landing-templates")
    ) {
      setIsAppsOpen(true);
    }
  }, [pathname]);

  const brand = useMemo(() => {
    const isDark = resolvedTheme === "dark";
    const logoUrl = isDark
      ? brandSettings?.logo_dark
      : brandSettings?.logo_light;
    const sidebarIconUrl = brandSettings?.sidebar_icon;
    const displayLogo = collapsed ? sidebarIconUrl : logoUrl;

    return (
      <div id="tour-sidebar-brand" className="mb-2 shrink-0">
        <div
          className={cn(
            "relative flex items-center gap-3 px-1 py-1",
            collapsed ? "justify-center" : "justify-between",
          )}
        >
          <Link
            href="/dashboard"
            className={cn(
              "group flex items-center gap-3 min-w-0 flex-1",
              collapsed ? "justify-center" : "",
            )}
          >
            <SecureSidebarLogo
              path={displayLogo}
              fallbackTitle={brandSettings?.app_title}
              collapsed={collapsed}
            />
          </Link>
          {!collapsed && (
            <Button
              variant="ghost"
              onClick={onToggle}
              className="h-9 w-9 rounded-xl p-0 text-muted-foreground shrink-0 border border-border/40 bg-background/40 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all"
            >
              <PanelLeftClose className="h-5 w-5" />
            </Button>
          )}
        </div>
        {collapsed && (
          <div className="mt-4 flex justify-center">
            <Button
              variant="ghost"
              onClick={onToggle}
              className="h-10 w-10 rounded-2xl p-0 border border-border/40 bg-background/60 hover:bg-primary/10 hover:text-primary hover:border-primary/30 text-muted-foreground shadow-sm transition-all"
            >
              <PanelLeftOpen className="h-5 w-5" />
            </Button>
          </div>
        )}
      </div>
    );
  }, [collapsed, onToggle, brandSettings, resolvedTheme]);

  return (
    <div className="flex h-full flex-col">
      {brand}

      {!collapsed && (
        <div
          id="tour-sidebar-search"
          className="px-1 mt-3 relative group shrink-0"
        >
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder={t("topbar.search_menu", "Search menu...")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="hive-sidebar-search w-full rounded-xl py-2 pl-8 pr-7 text-[13px] font-semibold focus:outline-none focus:ring-2 focus:ring-primary/25 transition-all text-foreground placeholder:text-muted-foreground"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      <nav
        id="tour-sidebar-nav"
        className="mt-3 flex-1 space-y-1 overflow-y-auto min-h-0 py-1 pr-1 custom-scrollbar"
      >
        {searchQuery ? (
          filteredNav.map((item) => {
            const active =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname === item.href ||
                  pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            const label = t(item.translationKey, item.fallbackLabel);

            return (
              <Link
                key={item.href}
                id={item.tourId}
                href={item.href}
                title={collapsed ? label : undefined}
                className={cn(
                  "group flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] transition-all duration-200",
                  collapsed ? "justify-center px-0 py-2" : "",
                  active ? "hive-sidebar-nav-active" : "hive-sidebar-nav-idle",
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    active ? "text-primary-foreground" : "",
                  )}
                />
                {!collapsed && <span className="truncate">{label}</span>}
              </Link>
            );
          })
        ) : (
          <>
            {standardNavItems.map((item) => {
              const active =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname === item.href ||
                    pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              const label = t(item.translationKey, item.fallbackLabel);

              return (
                <Link
                  key={item.href}
                  id={item.tourId}
                  href={item.href}
                  title={collapsed ? label : undefined}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] transition-all duration-200",
                    collapsed ? "justify-center px-0 py-2" : "",
                    active
                      ? "hive-sidebar-nav-active"
                      : "hive-sidebar-nav-idle",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      active ? "text-primary-foreground" : "",
                    )}
                  />
                  {!collapsed && <span className="truncate">{label}</span>}
                </Link>
              );
            })}

            {moduleNavItems.length > 0 && !collapsed && (
              <div className="mt-2 flex flex-col gap-1">
                <button
                  id="tour-nav-modules"
                  onClick={() => setIsModulesOpen(!isModulesOpen)}
                  className="group flex items-center justify-between rounded-xl px-2.5 py-2 text-[13px] font-semibold transition-all duration-200 hive-sidebar-section-idle outline-none"
                >
                  <div className="flex items-center gap-3">
                    <Boxes className="h-4 w-4 shrink-0" />
                    <span className="truncate">
                      {t("nav.modules", "Modules")}
                    </span>
                  </div>
                  {isModulesOpen ? (
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  ) : (
                    <ChevronRight className="h-4 w-4 opacity-50" />
                  )}
                </button>

                {isModulesOpen && (
                  <div className="flex flex-col gap-1 pl-4 mt-1 animate-in slide-in-from-top-2 duration-200">
                    {inventoryModuleItems.length > 0 && (
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => setIsInventoryOpen(!isInventoryOpen)}
                          className="group flex items-center justify-between rounded-xl px-2.5 py-1.5 text-[13px] font-semibold transition-all duration-200 hive-sidebar-subsection-idle outline-none"
                        >
                          <div className="flex items-center gap-3">
                            <Boxes className="h-4 w-4 shrink-0" />
                            <span className="truncate">
                              {t("nav.inventory", "Inventory")}
                            </span>
                          </div>
                          {isInventoryOpen ? (
                            <ChevronDown className="h-4 w-4 opacity-50" />
                          ) : (
                            <ChevronRight className="h-4 w-4 opacity-50" />
                          )}
                        </button>
                        {isInventoryOpen && (
                          <div className="flex flex-col gap-1 pl-4">
                            {inventoryModuleItems.map((item) => {
                              const active =
                                item.href === "/dashboard"
                                  ? pathname === "/dashboard"
                                  : pathname === item.href ||
                                    pathname.startsWith(item.href + "/");
                              const Icon = item.icon;
                              const label = t(
                                item.translationKey,
                                item.fallbackLabel,
                              );

                              return (
                                <Link
                                  key={item.href}
                                  id={item.tourId}
                                  href={item.href}
                                  className={cn(
                                    "group flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-[13px] transition-all duration-200",
                                    active
                                      ? "hive-sidebar-nested-active"
                                      : "hive-sidebar-nested-idle",
                                  )}
                                >
                                  <Icon className="h-4 w-4 shrink-0" />
                                  <span className="truncate">{label}</span>
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {hospitalityModuleItems.length > 0 && (
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() =>
                            setIsHospitalityOpen(!isHospitalityOpen)
                          }
                          className="group flex items-center justify-between rounded-xl px-2.5 py-1.5 text-[13px] font-semibold transition-all duration-200 hive-sidebar-subsection-idle outline-none"
                        >
                          <div className="flex items-center gap-3">
                            <Utensils className="h-4 w-4 shrink-0" />
                            <span className="truncate">
                              {t("nav.hospitality", "Hospitality")}
                            </span>
                          </div>
                          {isHospitalityOpen ? (
                            <ChevronDown className="h-4 w-4 opacity-50" />
                          ) : (
                            <ChevronRight className="h-4 w-4 opacity-50" />
                          )}
                        </button>
                        {isHospitalityOpen && (
                          <div className="flex flex-col gap-1 pl-4">
                            {hospitalityModuleItems.map((item) => {
                              const active =
                                item.href === "/dashboard"
                                  ? pathname === "/dashboard"
                                  : pathname === item.href ||
                                    pathname.startsWith(item.href + "/");
                              const Icon = item.icon;
                              const label = t(
                                item.translationKey,
                                item.fallbackLabel,
                              );

                              return (
                                <Link
                                  key={item.href}
                                  id={item.tourId}
                                  href={item.href}
                                  className={cn(
                                    "group flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-[13px] transition-all duration-200",
                                    active
                                      ? "hive-sidebar-nested-active"
                                      : "hive-sidebar-nested-idle",
                                  )}
                                >
                                  <Icon className="h-4 w-4 shrink-0" />
                                  <span className="truncate">{label}</span>
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {warehouseModuleItems.length > 0 && (
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => setIsWarehouseOpen(!isWarehouseOpen)}
                          className="group flex items-center justify-between rounded-xl px-2.5 py-1.5 text-[13px] font-semibold transition-all duration-200 hive-sidebar-subsection-idle outline-none"
                        >
                          <div className="flex items-center gap-3">
                            <Warehouse className="h-4 w-4 shrink-0" />
                            <span className="truncate">
                              {t("nav.warehouse", "Warehouse Logic")}
                            </span>
                          </div>
                          {isWarehouseOpen ? (
                            <ChevronDown className="h-4 w-4 opacity-50" />
                          ) : (
                            <ChevronRight className="h-4 w-4 opacity-50" />
                          )}
                        </button>
                        {isWarehouseOpen && (
                          <div className="flex flex-col gap-1 pl-4">
                            {warehouseModuleItems.map((item) => {
                              const active =
                                item.href === "/dashboard"
                                  ? pathname === "/dashboard"
                                  : pathname === item.href ||
                                    pathname.startsWith(item.href + "/");
                              const Icon = item.icon;
                              const label = t(
                                item.translationKey,
                                item.fallbackLabel,
                              );

                              return (
                                <Link
                                  key={item.href}
                                  id={item.tourId}
                                  href={item.href}
                                  className={cn(
                                    "group flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-[13px] transition-all duration-200",
                                    active
                                      ? "hive-sidebar-nested-active"
                                      : "hive-sidebar-nested-idle",
                                  )}
                                >
                                  <Icon className="h-4 w-4 shrink-0" />
                                  <span className="truncate">{label}</span>
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {projectManagementModuleItems.length > 0 && (
                      <div className="flex flex-col gap-1">
                        <div className="group flex items-center justify-between rounded-xl px-2.5 py-1.5 text-[13px] font-semibold transition-all duration-200 text-muted-foreground hover:bg-muted/50 hover:text-foreground">
                          <Link
                            href="/dashboard/project-management"
                            className="flex items-center gap-3 flex-1 overflow-hidden"
                          >
                            <ListTodo className="h-4 w-4 shrink-0 text-primary" />
                            <span className="truncate font-bold text-foreground">
                              {t("nav.project_management", "Project Management")}
                            </span>
                          </Link>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              setIsProjectManagementOpen(
                                !isProjectManagementOpen,
                              );
                            }}
                            className="p-1 hover:bg-muted rounded-md transition-colors"
                          >
                            {isProjectManagementOpen ? (
                              <ChevronDown className="h-4 w-4 opacity-50" />
                            ) : (
                              <ChevronRight className="h-4 w-4 opacity-50" />
                            )}
                          </button>
                        </div>

                        {isProjectManagementOpen && (
                          <div className="flex flex-col gap-1 pl-4 mb-2">
                            <Link
                              href="/dashboard/project-management"
                              className={cn(
                                "group flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-[13px] transition-all duration-200",
                                pathname === "/dashboard/project-management"
                                  ? "hive-sidebar-nested-active"
                                  : "hive-sidebar-nested-idle",
                              )}
                            >
                              <LayoutDashboard className="h-4 w-4 shrink-0" />
                              <span>{t("nav.pm_overview", "Overview")}</span>
                            </Link>

                            <Link
                              href="/dashboard/project-management/projects"
                              className={cn(
                                "group flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-[13px] transition-all duration-200",
                                pathname.startsWith(
                                  "/dashboard/project-management/projects",
                                )
                                  ? "hive-sidebar-nested-active"
                                  : "hive-sidebar-nested-idle",
                              )}
                            >
                              <KanbanSquare className="h-4 w-4 shrink-0" />
                              <span>{t("nav.pm_projects", "Projects")}</span>
                            </Link>

                            <Link
                              href="/dashboard/project-management/my-tasks"
                              className={cn(
                                "group flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-[13px] transition-all duration-200",
                                pathname.startsWith(
                                  "/dashboard/project-management/my-tasks",
                                )
                                  ? "hive-sidebar-nested-active"
                                  : "hive-sidebar-nested-idle",
                              )}
                            >
                              <CheckCircle className="h-4 w-4 shrink-0" />
                              <span>{t("nav.pm_my_tasks", "My Tasks")}</span>
                            </Link>

                            <div className="pt-2 pb-1 pr-2">
                              <Button
                                size="sm"
                                className="w-full h-8 text-[11px] font-bold rounded-xl gap-1.5 shadow-md shadow-primary/20"
                                onClick={() => {
                                  // This will trigger the global modal if implemented,
                                  // but for now we just navigate to projects and let them click create
                                  router.push(
                                    "/dashboard/project-management/projects?create=true",
                                  );
                                }}
                              >
                                <Plus className="h-3.5 w-3.5" />
                                {t("nav.pm_create_project", "Create Project")}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {workflowModuleItems.length > 0 && (
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => setIsWorkflowOpen(!isWorkflowOpen)}
                          className="group flex items-center justify-between rounded-xl px-2.5 py-1.5 text-[13px] font-semibold transition-all duration-200 hive-sidebar-subsection-idle outline-none"
                        >
                          <div className="flex items-center gap-3">
                            <CheckCircle className="h-4 w-4 shrink-0" />
                            <span className="truncate">
                              {t("nav.workflow", "Workflow")}
                            </span>
                          </div>
                          {isWorkflowOpen ? (
                            <ChevronDown className="h-4 w-4 opacity-50" />
                          ) : (
                            <ChevronRight className="h-4 w-4 opacity-50" />
                          )}
                        </button>
                        {isWorkflowOpen && (
                          <div className="flex flex-col gap-1 pl-4">
                            {workflowModuleItems.map((item) => {
                              const active =
                                item.href === "/dashboard"
                                  ? pathname === "/dashboard"
                                  : pathname === item.href ||
                                    pathname.startsWith(item.href + "/");
                              const Icon = item.icon;
                              const label = t(
                                item.translationKey,
                                item.fallbackLabel,
                              );

                              return (
                                <Link
                                  key={item.href}
                                  id={item.tourId}
                                  href={item.href}
                                  className={cn(
                                    "group flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-[13px] transition-all duration-200",
                                    active
                                      ? "hive-sidebar-nested-active"
                                      : "hive-sidebar-nested-idle",
                                  )}
                                >
                                  <Icon className="h-4 w-4 shrink-0" />
                                  <span className="truncate">{label}</span>
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {b2bMarketplaceModuleItems.length > 0 && (
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => setIsB2BMarketplaceOpen(!isB2BMarketplaceOpen)}
                          className="group flex items-center justify-between rounded-xl px-2.5 py-1.5 text-[13px] font-semibold transition-all duration-200 hive-sidebar-subsection-idle outline-none"
                        >
                          <div className="flex items-center gap-3">
                            <Boxes className="h-4 w-4 shrink-0" />
                            <span className="truncate">
                              {t("nav.b2bMarketplace", "B2B Marketplace")}
                            </span>
                          </div>
                          {isB2BMarketplaceOpen ? (
                            <ChevronDown className="h-4 w-4 opacity-50" />
                          ) : (
                            <ChevronRight className="h-4 w-4 opacity-50" />
                          )}
                        </button>
                        {isB2BMarketplaceOpen && (
                          <div className="flex flex-col gap-1 pl-4">
                            {b2bMarketplaceModuleItems.map((item) => {
                              const active =
                                item.href === "/dashboard"
                                  ? pathname === "/dashboard"
                                  : pathname === item.href ||
                                    pathname.startsWith(item.href + "/");
                              const Icon = item.icon;
                              const label = t(
                                item.translationKey,
                                item.fallbackLabel,
                              );

                              return (
                                <Link
                                  key={item.href}
                                  id={item.tourId}
                                  href={item.href}
                                  className={cn(
                                    "group flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-[13px] transition-all duration-200",
                                    active
                                      ? "hive-sidebar-nested-active"
                                      : "hive-sidebar-nested-idle",
                                  )}
                                >
                                  <Icon className="h-4 w-4 shrink-0" />
                                  <span className="truncate">{label}</span>
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {moduleNavItems.length > 0 && collapsed && (
              <div className="mt-1 flex flex-col gap-1">
                <button
                  id="tour-nav-modules"
                  onClick={() => setIsModulesOpen(!isModulesOpen)}
                  title={t("nav.modules", "Modules")}
                  className="group flex items-center justify-center rounded-xl px-0 py-2.5 text-[13px] transition-all duration-200 text-muted-foreground hover:bg-muted/80 hover:text-foreground border border-transparent"
                >
                  <Boxes className="h-4 w-4 shrink-0" />
                </button>

                {isModulesOpen &&
                  moduleNavItems.map((item) => {
                    const active =
                      item.href === "/dashboard"
                        ? pathname === "/dashboard"
                        : pathname === item.href ||
                          pathname.startsWith(item.href + "/");
                    const Icon = item.icon;
                    const label = t(item.translationKey, item.fallbackLabel);

                    return (
                      <Link
                        key={item.href}
                        id={item.tourId}
                        href={item.href}
                        title={label}
                        className={cn(
                          "group flex items-center justify-center rounded-xl px-0 py-2.5 text-[13px] transition-all duration-200",
                          active
                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 font-bold"
                            : "text-muted-foreground font-semibold hover:bg-muted/80 hover:text-foreground border border-transparent",
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0",
                            active ? "text-primary-foreground" : "",
                          )}
                        />
                      </Link>
                    );
                  })}
              </div>
            )}
          </>
        )}

        {/* 🚀 THE NEW APPS DROPDOWN */}
        {isMounted &&
          (canAccessConverter ||
            canAccessMail ||
            hasChatWorkspace ||
            canAccessLandingTemplates) &&
          !searchQuery && (
            <div className="mt-2 flex flex-col gap-1">
              <button
                id="tour-nav-apps"
                onClick={() => setIsAppsOpen(!isAppsOpen)}
                className={cn(
                  "group flex items-center justify-between rounded-xl px-2.5 py-2 text-[13px] font-semibold transition-all duration-200 hive-sidebar-section-idle outline-none",
                  collapsed ? "justify-center px-0 py-2.5" : "",
                )}
                title={
                  collapsed ? t("nav.apps_tools", "Apps & Tools") : undefined
                }
              >
                <div className="flex items-center gap-3">
                  <Layers className="h-4 w-4 shrink-0" />
                  {!collapsed && (
                    <span className="truncate">
                      {t("nav.apps_tools", "Apps & Tools")}
                    </span>
                  )}
                </div>
                {!collapsed &&
                  (isAppsOpen ? (
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  ) : (
                    <ChevronRight className="h-4 w-4 opacity-50" />
                  ))}
              </button>

              {/* Sub-menu (Open state for Desktop) */}
              {!collapsed && isAppsOpen && (
                <div className="flex flex-col gap-1 pl-4 mt-1 animate-in slide-in-from-top-2 duration-200">
                  {canAccessConverter && (
                    <Link
                      href="/dashboard/tools/converters"
                      id="tour-nav-converters-hub"
                      className={cn(
                        "group flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-[13px] transition-all duration-200",
                        pathname.startsWith("/dashboard/tools/converters")
                          ? "hive-sidebar-nested-active"
                          : "hive-sidebar-nested-idle",
                      )}
                    >
                      <RefreshCcw className="h-4 w-4 shrink-0" />
                      <span className="truncate">{t("nav.tools_converters", "Converters")}</span>
                    </Link>
                  )}
                  {canAccessConverter && (
                    <Link
                      href="/dashboard/tools/converter"
                      id="tour-nav-converter"
                      className={cn(
                        "group flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-[13px] transition-all duration-200",
                        pathname === "/dashboard/tools/converter"
                          ? "hive-sidebar-nested-active"
                          : "hive-sidebar-nested-idle",
                      )}
                    >
                      <FileType className="h-4 w-4 shrink-0" />
                      <span className="truncate">
                        {t("nav.tools_converter", "HTML to PDF")}
                      </span>
                    </Link>
                  )}

                  {canAccessMail && (
                    <Link
                      href="/dashboard/mail"
                      id="tour-nav-mail"
                      className={cn(
                        "group flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-[13px] transition-all duration-200",
                        pathname.includes("/dashboard/mail")
                          ? "hive-sidebar-nested-active"
                          : "hive-sidebar-nested-idle",
                      )}
                    >
                      <Mail className="h-4 w-4 shrink-0" />
                      <span className="truncate">
                        {t("nav.mail", "Internal Mail")}
                      </span>
                    </Link>
                  )}

                  {hasChatWorkspace && (
                    <Link
                      href="/dashboard/chat"
                      id="tour-nav-chat"
                      className={cn(
                        "group flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-[13px] transition-all duration-200",
                        pathname.includes("/dashboard/chat")
                          ? "hive-sidebar-nested-active"
                          : "hive-sidebar-nested-idle",
                      )}
                    >
                      <MessageCircle className="h-4 w-4 shrink-0" />
                      <span className="truncate">
                        {t("nav.chat", "Real-time Chat")}
                      </span>
                    </Link>
                  )}
                  {canAccessLandingTemplates && !isTenantNode && (
                    <Link
                      href="/dashboard/landing-templates"
                      id="tour-nav-landing-templates"
                      className={cn(
                        "group flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-[13px] transition-all duration-200",
                        pathname.includes("/dashboard/landing-templates")
                          ? "hive-sidebar-nested-active"
                          : "hive-sidebar-nested-idle",
                      )}
                    >
                      <LayoutTemplate className="h-4 w-4 shrink-0" />
                      <span className="truncate">
                        {t("nav.landing_templates", "Landing Templates")}
                      </span>
                    </Link>
                  )}
                </div>
              )}

              {/* Sub-menu (Collapsed mode shortcut) */}
              {collapsed && (
                <>
                  {canAccessConverter && (
                    <Link
                      href="/dashboard/tools/converters"
                      title={t("nav.tools_converters_hub", "Converters Hub")}
                      className={cn(
                        "group flex items-center justify-center rounded-xl px-0 py-2.5 text-[13px] transition-all duration-200 mt-1",
                        pathname.startsWith("/dashboard/tools/converters")
                          ? "bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/25"
                          : "text-muted-foreground hover:bg-muted/80 hover:text-foreground font-semibold",
                      )}
                    >
                      <RefreshCcw className="h-4 w-4 shrink-0" />
                    </Link>
                  )}
                  {canAccessConverter && (
                    <Link
                      href="/dashboard/tools/converter"
                      title="HTML to PDF"
                      className={cn(
                        "group flex items-center justify-center rounded-xl px-0 py-2.5 text-[13px] transition-all duration-200 mt-1",
                        pathname === "/dashboard/tools/converter"
                          ? "bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/25"
                          : "text-muted-foreground hover:bg-muted/80 hover:text-foreground font-semibold",
                      )}
                    >
                      <FileType className="h-4 w-4 shrink-0" />
                    </Link>
                  )}
                  {canAccessMail && (
                    <Link
                      href="/dashboard/mail"
                      title="Internal Mail"
                      className={cn(
                        "group flex items-center justify-center rounded-xl px-0 py-2.5 text-[13px] transition-all duration-200 mt-1",
                        pathname.includes("/dashboard/mail")
                          ? "bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/25"
                          : "text-muted-foreground hover:bg-muted/80 hover:text-foreground font-semibold",
                      )}
                    >
                      <Mail className="h-4 w-4 shrink-0" />
                    </Link>
                  )}
                  {hasChatWorkspace && (
                    <Link
                      href="/dashboard/chat"
                      title="Real-time Chat"
                      className={cn(
                        "group flex items-center justify-center rounded-xl px-0 py-2.5 text-[13px] transition-all duration-200 mt-1",
                        pathname.includes("/dashboard/chat")
                          ? "bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/25"
                          : "text-muted-foreground hover:bg-muted/80 hover:text-foreground font-semibold",
                      )}
                    >
                      <MessageCircle className="h-4 w-4 shrink-0" />
                    </Link>
                  )}
                  {canAccessLandingTemplates && !isTenantNode && (
                    <Link
                      href="/dashboard/landing-templates"
                      title="Landing Templates"
                      className={cn(
                        "group flex items-center justify-center rounded-xl px-0 py-2.5 text-[13px] transition-all duration-200 mt-1",
                        pathname.includes("/dashboard/landing-templates")
                          ? "bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/25"
                          : "text-muted-foreground hover:bg-muted/80 hover:text-foreground font-semibold",
                      )}
                    >
                      <LayoutTemplate className="h-4 w-4 shrink-0" />
                    </Link>
                  )}
                </>
              )}
            </div>
          )}

        {isMounted &&
          filteredNav.length === 0 &&
          filteredSecondary.length === 0 &&
          searchQuery && (
            <div className="text-center py-4 text-xs font-semibold text-muted-foreground">
              No matches found
            </div>
          )}
      </nav>

      {(filteredSecondary.length > 0 || !searchQuery) && isMounted && (
        <div
          id="tour-sidebar-secondary"
          className="mt-3 shrink-0 space-y-2 border-t border-border/40 pt-4"
        >
          {filteredSecondary.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            const label = t(item.translationKey, item.fallbackLabel);

            return (
              <Link
                key={item.href}
                id={item.tourId}
                href={item.href}
                title={collapsed ? label : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] transition-all duration-200",
                  collapsed ? "justify-center px-0 py-2" : "",
                  active ? "hive-sidebar-nav-active" : "hive-sidebar-nav-idle",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{label}</span>}
              </Link>
            );
          })}

          <button
            onClick={handleLogout}
            className={cn(
              "w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-bold text-destructive transition-colors hover:bg-destructive/15",
              collapsed ? "justify-center px-0 py-2" : "",
            )}
            title={
              collapsed ? t("nav.disconnect", "Disconnect Node") : undefined
            }
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && (
              <span className="truncate">
                {t("nav.disconnect", "Disconnect Node")}
              </span>
            )}
          </button>

          <div
            className={cn(
              "flex items-center rounded-xl border border-border/40 bg-background/50 px-2.5 py-1.5 mt-2",
              collapsed ? "justify-center flex-col gap-2" : "justify-between",
            )}
          >
            {!collapsed && (
              <div className="text-xs text-muted-foreground font-bold uppercase tracking-wider">
                {t("nav.theme", "Theme")}
              </div>
            )}
            <ThemeToggle />
          </div>
        </div>
      )}
    </div>
  );
}
