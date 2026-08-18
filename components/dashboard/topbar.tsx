//compnents/dashboard/topbar.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, LogOut, Maximize, Minimize, HelpCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MobileSidebar } from "./mobile-sidebar";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useTour } from "@/components/providers/tour-provider";
import { useTranslation } from "@/store/use-translation";
import { LanguageSwitcher } from "../layout/language-switcher";
import { GlobalSearch } from "./global-search";
import { TopbarMailIcon } from "./topbar-mail";
import { TopbarNotificationsIcon } from "./topbar-notifications";
import { ChatNotificationIcon } from "./chat-notification-icon";
import {
  getAccessToken,
  getBackendApiRoot,
  getTenantHeaders,
  getWorkspaceScopeKey,
} from "@/lib/runtime-context";
import { clearHiveSession, handleAuthFailureResponse } from "@/lib/auth-sync";
import { prepareNavForTour } from "@/lib/tour-events";
import { buildSidebarTourSteps } from "@/lib/tour-steps";
import { usePermissions } from "@/hooks/use-permissions";
import { PROFILE_ROUTE_PERMISSIONS } from "@/lib/route-permissions";
import { useAvatarUrl } from "@/hooks/use-avatar-url";

const getApiUrl = () => {
  return getBackendApiRoot();
};

const getTenantAwareEndpoint = (path: string) => {
  const base = getApiUrl();
  return `${base}${path}`;
};

type TopbarUser = {
  name?: string;
  avatar_path?: string | null;
  avatar_url?: string | null;
  updated_at?: string | null;
  avatar_revision?: number;
};

// 🚀 SECURE TOPBAR AVATAR
const SecureTopbarAvatar = ({
  user,
  fallbackInitials,
  canViewProfile,
}: {
  user: TopbarUser | null;
  fallbackInitials: string;
  canViewProfile: boolean;
}) => {
  const avatarUrl = useAvatarUrl(
    canViewProfile ? user : null,
    user?.avatar_revision ?? user?.updated_at ?? 0,
  );

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={`${user?.name || "Operator"} profile picture`}
        className="h-full w-full object-cover"
      />
    );
  }

  return (
    <AvatarFallback className="bg-primary text-primary-foreground font-black tracking-widest">
      {fallbackInitials}
    </AvatarFallback>
  );
};

export function DashboardTopbar() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [localUser, setLocalUser] = useState<TopbarUser | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { startTour } = useTour();
  const { t } = useTranslation();
  const { hasAnyPermission } = usePermissions();
  const canViewProfile = hasAnyPermission([...PROFILE_ROUTE_PERMISSIONS]);
  const scopeKey = getWorkspaceScopeKey();
  const { data: serverUser } = useQuery({
    queryKey: ["authUserProfile", scopeKey],
    queryFn: async () => {
      const token = getAccessToken();
      if (!token) throw new Error("No token");
      const res = await fetch(getTenantAwareEndpoint("/user"), {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          ...getTenantHeaders(),
        },
      });
      if (await handleAuthFailureResponse(res)) {
        throw new Error("Session invalidated");
      }
      if (!res.ok) throw new Error("Failed to fetch user data");
      return res.json();
    },
    staleTime: 300000,
    enabled: canViewProfile,
  });

  const activeUser = serverUser || localUser;

  useEffect(() => {
    const storedUser = localStorage.getItem("hive_user");
    if (storedUser) setLocalUser(JSON.parse(storedUser));

    const handleFullscreenChange = () =>
      setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const handleLogout = () => {
    clearHiveSession();
    queryClient.clear();
    router.push("/sign-in");
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement
        .requestFullscreen()
        .catch((err) => console.error(err));
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  };

  const triggerMasterTour = async () => {
    // Expand every collapsible sidebar group first. Their children are not
    // rendered while collapsed, so the filter below used to drop those steps and
    // the tour visibly jumped over whole sections.
    await prepareNavForTour();

    const possibleSteps = [
      // Sidebar Navigation
      {
        target: "#tour-sidebar-brand",
        title: t("tour.sidebar_brand_title", "HIVE.OS Control Hub"),
        content: t(
          "tour.sidebar_brand_desc",
          "This is your central command console.",
        ),
        placement: "right" as const,
      },
      {
        target: "#tour-sidebar-search",
        title: t("tour.sidebar_search_title", "Sidebar Search"),
        content: t(
          "tour.sidebar_search_desc",
          "Quickly find and filter navigation menus.",
        ),
        placement: "right" as const,
      },
      // Sidebar navigation is generated from the rendered DOM so every module,
      // sub-module and nested tab is visited in visual order — and so a tenant
      // node tours exactly the modules it subscribes to. See lib/tour-steps.ts.
      ...buildSidebarTourSteps(t),

      // Topbar Actions
      {
        target: "#tour-topbar-search",
        title: t("tour.topbar_search_title", "Global Command Search"),
        content: t(
          "tour.topbar_search_desc",
          "Instantly locate node configurations or specific system logs.",
        ),
        placement: "bottom" as const,
      },
      {
        target: "#tour-topbar-language",
        title: t("tour.topbar_language_title", "Interface Language"),
        content: t(
          "tour.topbar_language_desc",
          "Switch the dashboard matrix to your preferred language.",
        ),
        placement: "bottom" as const,
      },
      {
        target: "#tour-topbar-theme",
        title: t("tour.topbar_theme_title", "Interface Theme"),
        content: t(
          "tour.topbar_theme_desc",
          "Toggle between light mode and dark mode.",
        ),
        placement: "bottom" as const,
      },
      {
        target: "#tour-topbar-fullscreen",
        title: t("tour.topbar_fullscreen_title", "Focus Mode"),
        content: t(
          "tour.topbar_fullscreen_desc",
          "Expand the dashboard to fill your entire screen.",
        ),
        placement: "bottom" as const,
      },
      {
        target: "#tour-topbar-help",
        title: t("tour.topbar_help_title", "Guided Tours"),
        content: t(
          "tour.topbar_help_desc",
          "Replay this walkthrough at any time. Individual pages offer their own focused tour from the same control.",
        ),
        placement: "bottom" as const,
      },
      {
        target: "#tour-topbar-chat",
        title: t("tour.topbar_chat_title", "Team Messaging"),
        content: t(
          "tour.topbar_chat_desc",
          "Direct and group conversations with other operators, with unread counts surfaced on the icon.",
        ),
        placement: "bottom" as const,
      },
      {
        target: "#tour-topbar-notifications",
        title: t("tour.topbar_notifications_title", "System Alerts"),
        content: t(
          "tour.topbar_notifications_desc",
          "View real-time security alerts and task notifications.",
        ),
        placement: "bottom" as const,
      },
      {
        target: "#tour-topbar-mail",
        title: t("tour.topbar_mail_title", "Internal Mailbox"),
        content: t(
          "tour.topbar_mail_desc",
          "Encrypted internal mail between operators on this node.",
        ),
        placement: "bottom" as const,
      },
      {
        target: "#tour-topbar-profile",
        title: t("tour.topbar_profile_title", "Operator Profile"),
        content: t(
          "tour.topbar_profile_desc",
          "Manage your settings and safely disconnect your node.",
        ),
        placement: "bottom-end" as const,
      },

      // Dashboard Body Elements
      {
        target: "#tour-body-stats",
        title: t("tour.body_stats_title", "System Metrics"),
        content: t(
          "tour.body_stats_desc",
          "Instant overview of active nodes, users, roles, and core capabilities.",
        ),
        placement: "bottom" as const,
      },
      {
        target: "#tour-body-telemetry",
        title: t("tour.body_telemetry_title", "Live Telemetry"),
        content: t(
          "tour.body_telemetry_desc",
          "Real-time performance graph tracking system requests and overall network health.",
        ),
        placement: "right" as const,
      },
      {
        target: "#tour-body-modules",
        title: t("tour.body_modules_title", "Module Health"),
        content: t(
          "tour.body_modules_desc",
          "Status, latency, and throughput metrics for active microservices.",
        ),
        placement: "left" as const,
      },
      {
        target: "#tour-body-audit",
        title: t("tour.body_audit_title", "Audit Ledger"),
        content: t(
          "tour.body_audit_desc",
          "Live stream of cryptographically sealed actions performed across the network.",
        ),
        placement: "top" as const,
      },
    ];

    // Sidebar steps arrive as live elements (nested rows carry no id), the
    // curated ones as selectors — resolve whichever form each step uses and drop
    // anything not currently on screen.
    const activeSteps = possibleSteps.filter((step) => {
      const { target } = step;

      if (typeof target === "string") {
        return Boolean(document.querySelector(target));
      }

      return target instanceof HTMLElement && target.isConnected;
    });

    startTour(activeSteps.map((step) => ({ ...step, disableBeacon: true })));
  };

  const userInitials = activeUser?.name
    ? activeUser.name.substring(0, 2).toUpperCase()
    : "OP";

  return (
    <header className="sticky top-0 z-40 mb-4 px-2 sm:px-0">
      <div className="relative rounded-2xl md:rounded-[2rem]">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/70 via-background/35 to-transparent rounded-2xl md:rounded-[2rem]" />

        <div className="glass-panel rounded-2xl md:rounded-[2rem] px-3 py-2 md:px-5 md:py-3 backdrop-blur-2xl border border-border/50 bg-card/40 relative z-10 shadow-lg">
          <div className="flex items-center justify-between gap-2 md:gap-3">
            <div className="flex min-w-0 items-center gap-2 md:gap-3">
              <div className="lg:hidden shrink-0 scale-90 sm:scale-100">
                <MobileSidebar />
              </div>
              <div
                id="tour-topbar-search"
                className="hidden lg:flex lg:items-center"
              >
                <GlobalSearch />
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <Button
                id="tour-topbar-help"
                variant="ghost"
                className="h-10 px-3 rounded-xl shrink-0 text-primary bg-primary/10 hover:bg-primary/20 font-bold hidden md:flex items-center gap-2 transition-all transform active:scale-95"
                onClick={triggerMasterTour}
              >
                <HelpCircle className="h-4 w-4" />{" "}
                {t("topbar.system_tour", "System Tour")}
              </Button>

              <div className="flex items-center gap-0.5 sm:gap-1">
                <LanguageSwitcher id="tour-topbar-language" />

                <div id="tour-topbar-theme" className="px-0.5 hidden sm:block">
                  <ThemeToggle />
                </div>

                <Button
                  id="tour-topbar-fullscreen"
                  variant="ghost"
                  aria-label={
                    isFullscreen
                      ? t("global.exit_fullscreen", "Exit full screen")
                      : t("global.enter_fullscreen", "Enter full screen")
                  }
                  className="h-10 w-10 rounded-xl p-0 shrink-0 text-muted-foreground hover:text-foreground hidden sm:flex items-center justify-center transform active:scale-95 transition-transform"
                  onClick={toggleFullscreen}
                >
                  {isFullscreen ? (
                    <Minimize className="h-5 w-5" />
                  ) : (
                    <Maximize className="h-5 w-5" />
                  )}
                </Button>
              </div>

              {/* Wrappers carry the tour anchors: the icons themselves are shared
                  components, and the tour previously had no target for chat or
                  mail so it jumped straight past them. */}
              <div className="flex items-center gap-0.5 sm:gap-1">
                <span id="tour-topbar-chat" className="flex">
                  <ChatNotificationIcon />
                </span>
                <TopbarNotificationsIcon activeUser={activeUser} />
                <span id="tour-topbar-mail" className="flex">
                  <TopbarMailIcon activeUser={activeUser} />
                </span>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    id="tour-topbar-profile"
                    variant="ghost"
                    className="h-10 rounded-xl px-1 sm:px-2 hover:bg-muted/50 transition-colors transform active:scale-95"
                  >
                    <Avatar className="h-8 w-8 border border-border/50 shrink-0 shadow-sm bg-muted flex items-center justify-center overflow-hidden ring-2 ring-transparent transition-all group-hover:ring-primary/20">
                      <SecureTopbarAvatar
                        user={activeUser}
                        fallbackInitials={userInitials}
                        canViewProfile={canViewProfile}
                      />
                    </Avatar>
                    <div className="ml-2 hidden text-left md:block">
                      <div className="text-xs font-bold leading-4 truncate max-w-[100px] lg:max-w-[150px]">
                        {activeUser?.name || "Operator"}
                      </div>
                      <div className="text-[11px] text-muted-foreground font-mono leading-4 truncate max-w-[100px] lg:max-w-[150px]">
                        {activeUser?.email || "sys@hive.os"}
                      </div>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-56 z-[100] rounded-2xl border-border/60 shadow-xl p-2 mt-2"
                >
                  <DropdownMenuLabel className="font-space font-bold">
                    {t("topbar.my_account", "My Account")}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {canViewProfile && (
                    <>
                      <DropdownMenuItem
                        onClick={() => router.push("/dashboard/profile")}
                        className="cursor-pointer font-medium rounded-xl mb-1"
                      >
                        {t("topbar.profile_settings", "Profile Settings")}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-destructive font-bold cursor-pointer rounded-xl focus:text-destructive focus:bg-destructive/10 mt-1"
                  >
                    <LogOut className="mr-2 h-4 w-4" />{" "}
                    {t("nav.disconnect", "Disconnect Node")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
