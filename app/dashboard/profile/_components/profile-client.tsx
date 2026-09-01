"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  UserCircle,
  Fingerprint,
  Bell,
  Sparkles,
  HelpCircle,
} from "lucide-react";
import { useTour } from "@/components/providers/tour-provider";
import type { Step } from "react-joyride";
import { useTranslation } from "@/store/use-translation";
import { logFrontendAction } from "@/lib/api";
import { cn } from "@/lib/utils";

import { GeneralTabClient } from "./general-tab-client";
import { SecurityTabClient } from "./security-tab-client";
import { NotificationsTabClient } from "./notifications-tab-client";

export function ProfileClient() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const { startTour, isActive, currentStep } = useTour();

  const [activeTab, setActiveTab] = useState<string>(() => {
    return searchParams.get("tab") || "account";
  });
  const viewLogged = useRef(false);

  // Sync activeTab from URL searchParams only when tour is not running and param changes
  useEffect(() => {
    const tabFromUrl = searchParams.get("tab");
    if (tabFromUrl && tabFromUrl !== activeTab && !isActive) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams, isActive]);

  const onTabChange = useCallback(
    (value: string) => {
      setActiveTab(value);
      logFrontendAction({
        module: "Profile Tab Navigation",
        action: "viewed",
        description: `Switched to ${value} tab.`,
      }).catch(() => {});

      if (typeof window !== "undefined" && !isActive) {
        const url = new URL(window.location.href);
        url.searchParams.set("tab", value);
        window.history.replaceState(null, "", url.toString());
      }
    },
    [isActive]
  );

  useEffect(() => {
    if (!viewLogged.current) {
      viewLogged.current = true;
      logFrontendAction({
        module: "Profile Initial Page Access",
        action: "viewed",
        description: "Accessed Profile Page.",
      }).catch(() => {});
    }
  }, []);

  // 🚀 AUTOMATIC REACT TAB SWITCHING FOR TOUR:
  useEffect(() => {
    if (!isActive || !currentStep) return;
    const switchTab = (currentStep.data as Record<string, any> | undefined)?.switchTab;
    if (switchTab && switchTab !== activeTab) {
      setActiveTab(switchTab);
    }
  }, [currentStep, isActive, activeTab]);

  const handleStartTour = useCallback(() => {
    const steps: Step[] = [
      // 1. Full Navigation Hub Bar
      {
        target: "#tour-profile-tabs",
        title: t("tour.profile_nav_title", "Profile Hub Navigation"),
        content: t(
          "tour.profile_nav_desc",
          "Switch seamlessly between your account identity, security clearance, and notification channels."
        ),
        placement: "bottom",
        skipBeacon: true,
        data: { switchTab: "account" },
      },
      // 2. Full Operator Avatar Card
      {
        target: "#tour-profile-avatar",
        title: t("tour.profile_avatar_title", "Operator Avatar & Media"),
        content: t(
          "tour.profile_avatar_desc",
          "Upload a custom photo, pick from your media storage repository, or drag-and-drop an image directly."
        ),
        placement: "right",
        skipBeacon: true,
        data: { switchTab: "account" },
      },
      // 3. Full Basic Identity Information Card
      {
        target: "#tour-profile-info",
        title: t("tour.profile_info_title", "Basic Information & Credentials"),
        content: t(
          "tour.profile_info_desc",
          "Manage your registered full name and encrypted email address with cryptographic validation."
        ),
        placement: "left",
        skipBeacon: true,
        data: { switchTab: "account" },
      },
      // 4. Full Security & 2FA Matrix Card
      {
        target: "#tour-profile-2fa",
        title: t("tour.profile_security_title", "Two-Factor Authentication & Cryptographic Clearance"),
        content: t(
          "tour.profile_security_desc",
          "Fortify your operator account with TOTP multi-factor security, scan persistent QR barcodes, copy secret keys, and follow the step-by-step scanner guide."
        ),
        placement: "bottom",
        skipBeacon: true,
        data: { switchTab: "security" },
      },
      // 5. Full Notification Channels & Orchestration Card
      {
        target: "#tour-profile-channels",
        title: t("tour.profile_channels_title", "Multi-Channel Alert Orchestration & Dispatch"),
        content: t(
          "tour.profile_channels_desc",
          "Inspect, configure, and route real-time telemetry across Cellular SMS, Telegram bot, and encrypted Email, designate primary channels, and test live broadcasts."
        ),
        placement: "bottom",
        skipBeacon: true,
        data: { switchTab: "notifications" },
      },
    ];

    startTour(steps);
  }, [startTour, t]);

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-card border border-border/50 p-8 shadow-sm">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row justify-between sm:items-end gap-6">
          <div className="flex flex-col gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary w-fit text-xs font-bold tracking-widest uppercase mb-2">
              <Sparkles className="h-3.5 w-3.5" />{" "}
              {t("profile.identity_matrix", "Identity Matrix")}
            </div>
            <h1 className="text-4xl font-black tracking-tight">
              {t("profile.title", "Profile Settings")}
            </h1>
            <p className="text-muted-foreground text-sm max-w-xl">
              {t(
                "profile.desc",
                "Manage your operator profile, security clearance, and notification channels securely."
              )}
            </p>
          </div>

          <Button
            variant="outline"
            onClick={handleStartTour}
            className="rounded-xl shadow-sm text-muted-foreground hover:text-foreground border-border/50 bg-background/50 backdrop-blur-md cursor-pointer"
          >
            <HelpCircle className="w-4 h-4 mr-2" />{" "}
            {t("tour.button", "System Tour")}
          </Button>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={onTabChange}
        className="space-y-6"
      >
        <div className="flex items-center justify-between bg-muted/30 p-2 rounded-[2rem] border border-border/60 shadow-sm backdrop-blur-xl">
          <div
            id="tour-profile-tabs"
            className={cn(
              "w-full scrollbar-hide py-1 -my-1",
              !isActive && "overflow-x-auto"
            )}
          >
            <TabsList className="bg-transparent flex items-center w-max min-w-full justify-start gap-2 h-auto p-0">
              <TabsTrigger
                id="tour-profile-tab-account"
                value="account"
                className="group shrink-0 whitespace-nowrap rounded-2xl px-6 py-3 text-sm font-bold text-muted-foreground transition-all duration-300 hover:bg-background/50 hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg border border-transparent data-[state=active]:border-primary/20 cursor-pointer"
              >
                <UserCircle className="h-4 w-4 mr-2 transition-transform duration-300 group-hover:scale-110" />
                {t("profile.tab_account", "Account Details")}
              </TabsTrigger>

              <TabsTrigger
                id="tour-profile-tab-security"
                value="security"
                className="group shrink-0 whitespace-nowrap rounded-2xl px-6 py-3 text-sm font-bold text-muted-foreground transition-all duration-300 hover:bg-background/50 hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg border border-transparent data-[state=active]:border-primary/20 cursor-pointer"
              >
                <Fingerprint className="h-4 w-4 mr-2 transition-transform duration-300 group-hover:scale-110" />
                {t("profile.tab_security", "Security & 2FA")}
              </TabsTrigger>

              <TabsTrigger
                id="tour-profile-tab-notifications"
                value="notifications"
                className="group shrink-0 whitespace-nowrap rounded-2xl px-6 py-3 text-sm font-bold text-muted-foreground transition-all duration-300 hover:bg-background/50 hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg border border-transparent data-[state=active]:border-primary/20 cursor-pointer"
              >
                <Bell className="h-4 w-4 mr-2 transition-transform duration-300 group-hover:scale-110" />
                {t("profile.tab_notifications", "Notification Channels")}
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <div className="mt-4">
          <TabsContent
            value="account"
            className="border-none p-0 outline-none m-0 animate-in slide-in-from-bottom-4 duration-500"
          >
            <GeneralTabClient />
          </TabsContent>
          <TabsContent
            value="security"
            className="border-none p-0 outline-none m-0 animate-in slide-in-from-bottom-4 duration-500"
          >
            <SecurityTabClient />
          </TabsContent>
          <TabsContent
            value="notifications"
            className="border-none p-0 outline-none m-0 animate-in slide-in-from-bottom-4 duration-500"
          >
            <NotificationsTabClient />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
