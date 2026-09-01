"use client";

import React, { useEffect } from "react";
import MailSidebar from "./mail-sidebar";
import MailList from "./mail-list";
import MailDetail from "./mail-detail";
import ComposeModal from "./compose-modal";
import { useMailStore, MailOnlineUser } from "@/store/mail-store";
import { cn } from "@/lib/utils";
import { initEcho } from "@/lib/echo";
import { getAccessToken, getTenantId } from "@/lib/runtime-context";

export default function MailLayout() {
  const { selectedMailId, checkedMailIds, isFullscreen, setOnlineUsers } = useMailStore();

  useEffect(() => {
    const token = getAccessToken() || localStorage.getItem("token");

    if (!token) {
      return;
    }

    try {
      const echo = initEcho(token);
      if (!echo) return;
      const tenantId = getTenantId();
      const presenceChannelName = tenantId ? `tenant.${tenantId}.mail.presence` : "mail.presence";

      echo
        .join(presenceChannelName)
        .here((users: MailOnlineUser[]) => setOnlineUsers(users))
        .joining((joiningUser: MailOnlineUser) => {
          const current = useMailStore.getState().onlineUsers;
          setOnlineUsers([...current, joiningUser]);
        })
        .leaving((leavingUser: MailOnlineUser) => {
          const current = useMailStore.getState().onlineUsers;
          setOnlineUsers(current.filter((user) => user.id !== leavingUser.id));
        });

      return () => {
        echo.leave(presenceChannelName);
      };
    } catch (error) {
      console.error("Echo initialization failed", error);
    }
  }, [setOnlineUsers]);

  return (
    <div
      className={cn(
        "relative flex w-full flex-col overflow-hidden transition-all duration-300",
        isFullscreen
          ? "fixed inset-0 z-50 m-0 block h-[100dvh] w-screen rounded-none border-none bg-white/95 p-0 shadow-none ring-0 backdrop-blur-3xl dark:bg-background/95"
          : "h-[calc(100vh-5rem)] rounded-[2rem] border border-border/50 bg-gradient-to-br from-white/90 to-slate-50/90 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-black/5 backdrop-blur-2xl dark:from-background/90 dark:to-muted/20 dark:ring-white/10 lg:h-[calc(100vh-5.5rem)]"
      )}
    >
      <div className="flex h-full w-full overflow-hidden">
        <div
          className={cn(
            "absolute inset-y-0 left-0 z-30 w-full shrink-0 border-r border-[#eaebec]/50 bg-white/40 backdrop-blur-lg transition-transform duration-300 dark:border-border/30 dark:bg-background/40 md:relative md:w-64",
            !selectedMailId && checkedMailIds.length === 0 ? "translate-x-0" : "-translate-x-full md:translate-x-0",
            isFullscreen && "hidden w-0 scale-0 border-none md:hidden"
          )}
        >
          <MailSidebar />
        </div>

        <div
          className={cn(
            "absolute inset-y-0 left-0 z-20 w-full shrink-0 border-r border-[#eaebec]/50 bg-white/60 backdrop-blur-md transition-transform duration-300 dark:border-border/30 dark:bg-background/60 md:relative md:w-[320px] lg:w-[340px] xl:w-[360px]",
            selectedMailId || checkedMailIds.length > 0 ? "-translate-x-full md:translate-x-0" : "translate-x-0",
            isFullscreen && "hidden w-0 scale-0 border-none md:hidden"
          )}
        >
          <MailList />
        </div>

        <div
          className={cn(
            "absolute inset-0 z-40 flex h-full w-full flex-1 flex-col overflow-hidden transition-transform duration-300 print:block print:w-full print:inset-0 md:relative md:z-10",
            selectedMailId || checkedMailIds.length > 0
              ? "translate-x-0 bg-white/80 backdrop-blur-sm dark:bg-background/80"
              : "translate-x-full bg-[#f8f9fa]/50 dark:bg-background/20 md:translate-x-0",
            isFullscreen && "z-50 translate-x-0 bg-white dark:bg-background"
          )}
        >
          <MailDetail />
        </div>
      </div>
      <ComposeModal />
    </div>
  );
}
