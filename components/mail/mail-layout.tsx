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
        "relative flex size-full flex-col overflow-hidden bg-background/40",
        isFullscreen
          ? "fixed inset-0 z-50 h-[100dvh] w-screen bg-background"
          : "h-full"
      )}
    >
      <div className="flex h-full w-full overflow-hidden">
        <div
          className={cn(
            "absolute inset-y-0 left-0 z-30 w-full shrink-0 border-r border-border/60 bg-card/80 backdrop-blur-xl transition-transform duration-300 md:relative md:w-64",
            !selectedMailId && checkedMailIds.length === 0 ? "translate-x-0" : "-translate-x-full md:translate-x-0",
            isFullscreen && "hidden w-0 scale-0 border-none md:hidden"
          )}
        >
          <MailSidebar />
        </div>

        <div
          className={cn(
            "absolute inset-y-0 left-0 z-20 w-full shrink-0 border-r border-border/60 bg-card/70 backdrop-blur-xl transition-transform duration-300 md:relative md:w-[320px] lg:w-[340px] xl:w-[360px]",
            selectedMailId || checkedMailIds.length > 0 ? "-translate-x-full md:translate-x-0" : "translate-x-0",
            isFullscreen && "hidden w-0 scale-0 border-none md:hidden"
          )}
        >
          <MailList />
        </div>

        <div
          className={cn(
            "absolute inset-0 z-40 flex size-full flex-1 flex-col overflow-hidden transition-transform duration-300 print:block print:w-full md:relative md:z-10",
            selectedMailId || checkedMailIds.length > 0
              ? "translate-x-0 bg-background/90 backdrop-blur-sm"
              : "translate-x-full bg-muted/20 md:translate-x-0",
            isFullscreen && "z-50 translate-x-0 bg-background"
          )}
        >
          <MailDetail />
        </div>
      </div>
      <ComposeModal />
    </div>
  );
}
