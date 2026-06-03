"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, Circle, Loader2, MessageSquare, Mail, AlertCircle, ClipboardCheck, Database } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getAccessToken, getAuthHeaders, getBackendApiRoot } from "@/lib/runtime-context";
import { getUserNotificationChannelNames, initEcho } from "@/lib/echo";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type TopbarNotification = {
  id: string;
  type: string;
  category: string;
  title: string;
  body?: string | null;
  url?: string | null;
  created_at?: string | null;
  read_at?: string | null;
  data?: Record<string, unknown>;
};

type NotificationCenterResponse = {
  data: {
    unread_count: number;
    notifications: TopbarNotification[];
  };
};

type IncomingNotificationPayload = {
  id?: string;
  type?: string;
  created_at?: string;
  read_at?: string | null;
  data?: Record<string, unknown>;
  [key: string]: unknown;
};

type ActiveNotificationUser = {
  id?: number | string | null;
};

async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const url = `${getBackendApiRoot()}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  const headers: HeadersInit = getAuthHeaders(
    options.body && typeof options.body === "string" ? { "Content-Type": "application/json" } : {}
  );

  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message || "Notification request failed.");
  }

  return response.json();
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function toText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function normalizeIncomingNotification(notification: IncomingNotificationPayload): TopbarNotification {
  const root = toRecord(notification);
  const nestedData = toRecord(notification.data);
  const data = Object.keys(nestedData).length > 0 ? nestedData : root;

  return {
    id: toText(notification.id) || toText(data.id) || crypto.randomUUID(),
    type: toText(notification.type) || toText(data.type) || "system",
    category: toText(data.category) || "system",
    title: toText(data.title) || "New notification",
    body: toText(data.body),
    url: toText(data.url) || toText(data.review_url) || toText(data.action_url),
    created_at: toText(notification.created_at) || toText(data.created_at) || new Date().toISOString(),
    read_at: toText(notification.read_at),
    data,
  };
}

export function TopbarNotificationsIcon({ activeUser }: { activeUser: ActiveNotificationUser | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  const { data: notificationCenter, isLoading } = useQuery<NotificationCenterResponse>({
    queryKey: ["dashboard-notifications"],
    queryFn: () => apiFetch("/notifications?limit=8"),
    enabled: !!activeUser?.id,
    staleTime: 15_000,
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  const unreadCount = notificationCenter?.data?.unread_count ?? 0;
  const notifications = notificationCenter?.data?.notifications ?? [];

  const pathname = usePathname();

  useEffect(() => {
    if (!activeUser?.id) return;

    const token = getAccessToken();
    if (!token) return;

    try {
      const echo = initEcho(token);
      const channelNames = getUserNotificationChannelNames(activeUser.id);
      const seenNotificationIds = new Set<string>();
      channelNames.forEach((channelName) => echo.leave(channelName));

      const handleNotification = (payload: IncomingNotificationPayload) => {
        const incoming = normalizeIncomingNotification(payload);
        if (seenNotificationIds.has(incoming.id)) {
          return;
        }
        seenNotificationIds.add(incoming.id);

        queryClient.setQueryData<NotificationCenterResponse | undefined>(
          ["dashboard-notifications"],
          (current) => {
            const existing = current?.data?.notifications ?? [];
            const deduped = [incoming, ...existing.filter((item) => item.id !== incoming.id)].slice(0, 8);
            const alreadyExists = existing.some((item) => item.id === incoming.id);
            const unread_count = alreadyExists
              ? current?.data?.unread_count ?? 0
              : (current?.data?.unread_count ?? 0) + (incoming.read_at ? 0 : 1);

            return {
              data: {
                unread_count,
                notifications: deduped,
              },
            };
          }
        );

        // Chat and mail providers show their own live toasts; the bell only updates the list.
        const isWorkflowPage = pathname.startsWith('/dashboard/workflow/approvals');

        if (
            incoming.category === 'chat' ||
            incoming.category === 'mail' ||
            (incoming.category === 'workflow' && isWorkflowPage)
        ) {
            // Silently update the count and list (handled above) but no toast
        } else if (incoming.category === 'backup') {
            toast.success(incoming.title || "Backup Completed", {
                description: incoming.body,
                action: incoming.url ? {
                    label: "View",
                    onClick: () => router.push(incoming.url!)
                } : undefined
            });
        } else if (incoming.category === 'backup_failed') {
            toast.error(incoming.title || "Backup Failed", {
                description: incoming.body,
                action: incoming.url ? {
                    label: "View",
                    onClick: () => router.push(incoming.url!)
                } : undefined
            });
        } else {
            toast.info(incoming.title || "New notification", {
                description: incoming.body,
                action: incoming.url ? {
                    label: "View",
                    onClick: () => router.push(incoming.url!)
                } : undefined
            });
        }

        queryClient.invalidateQueries({ queryKey: ["dashboard-notifications"] });
      };

      channelNames.forEach((channelName) => {
        echo.private(channelName).notification(handleNotification);
      });

      return () => {
        channelNames.forEach((channelName) => echo.leave(channelName));
      };
    } catch (error) {
      console.log("Echo notification initialization failed", error);
    }
  }, [activeUser?.id, queryClient, pathname, router]);

  const markAsRead = async (notificationId: string) => {
    try {
      await apiFetch("/notifications/read", {
        method: "POST",
        body: JSON.stringify({ notification_ids: [notificationId] }),
      });

      queryClient.setQueryData<NotificationCenterResponse | undefined>(
        ["dashboard-notifications"],
        (current) => {
          if (!current) return current;

          const notifications = current.data.notifications.map((item) =>
            item.id === notificationId ? { ...item, read_at: new Date().toISOString() } : item
          );
          const unread_count = notifications.filter((item) => !item.read_at).length;

          return {
            data: {
              unread_count,
              notifications,
            },
          };
        }
      );
    } catch {
      toast.error("We could not mark that notification as read.");
    }
  };

  const handleNotificationClick = async (notification: TopbarNotification) => {
    if (!notification.read_at) {
      await markAsRead(notification.id);
    }

    setIsOpen(false);
    router.push(notification.url || "/dashboard/alerts");
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          id="tour-topbar-notifications"
          variant="ghost"
          className="relative h-10 w-10 rounded-xl p-0 shrink-0 text-muted-foreground hover:text-foreground"
        >
          <Bell className="h-5 w-5" />
          <span
            className={`absolute -top-1 -right-1 flex min-w-[18px] h-[18px] items-center justify-center rounded-full px-1 text-[10px] font-black text-white shadow-sm transition-colors ${
              unreadCount > 0 ? "bg-destructive" : "bg-muted-foreground"
            }`}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 sm:w-96 p-0 rounded-2xl shadow-xl z-[100] border-border/60">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <DropdownMenuLabel className="p-0 font-bold text-sm">Notifications</DropdownMenuLabel>
          <span className="text-xs font-semibold text-muted-foreground">
            {unreadCount} unread
          </span>
        </div>

        <div className="flex max-h-[360px] flex-col overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center items-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              No notifications yet.
            </div>
          ) : (
            notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={cn(
                  "relative flex cursor-pointer flex-col items-start gap-1 rounded-none border-b border-border/40 px-4 py-3 focus:bg-muted/50",
                  !notification.read_at && "bg-muted/20"
                )}
              >
                <div className="flex w-full items-start gap-3">
                    <div className={cn(
                      "mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                      notification.category === 'chat' ? "bg-blue-50 border-blue-100 text-blue-600" :
                      notification.category === 'mail' ? "bg-amber-50 border-amber-100 text-amber-600" :
                      notification.category === 'workflow' ? "bg-emerald-50 border-emerald-100 text-emerald-600" :
                      notification.category === 'demo' ? "bg-purple-50 border-purple-100 text-purple-600" :
                      notification.category === 'backup' ? "bg-indigo-50 border-indigo-100 text-indigo-600" :
                      notification.category === 'backup_failed' ? "bg-rose-50 border-rose-100 text-rose-600" :
                      "bg-slate-50 border-slate-100 text-slate-600"
                    )}>
                      {notification.category === 'chat' ? <MessageSquare className="h-4 w-4" /> :
                        notification.category === 'mail' ? <Mail className="h-4 w-4" /> :
                        notification.category === 'workflow' ? <ClipboardCheck className="h-4 w-4" /> :
                        notification.category === 'demo' ? <Bell className="h-4 w-4" /> :
                        notification.category === 'backup' ? <Database className="h-4 w-4" /> :
                        notification.category === 'backup_failed' ? <AlertCircle className="h-4 w-4" /> :
                        <AlertCircle className="h-4 w-4" />}
                    </div>
                  
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <div className="flex w-full items-start justify-between gap-3">
                      <span className={cn(
                        "text-[13px] leading-tight",
                        !notification.read_at ? "font-bold text-foreground" : "font-medium text-muted-foreground"
                      )}>
                        {notification.title}
                      </span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {notification.created_at
                          ? formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })
                          : "just now"}
                      </span>
                    </div>

                    {notification.body ? (
                      <div className="text-[11px] leading-relaxed text-muted-foreground line-clamp-2">
                        {notification.body}
                      </div>
                    ) : null}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    markAsRead(notification.id);
                  }}
                  className="absolute bottom-3 right-4 h-6 w-6 rounded-full flex items-center justify-center hover:bg-background shadow-sm border border-transparent hover:border-border transition-all"
                  title={notification.read_at ? "Read" : "Mark as read"}
                >
                  {notification.read_at ? (
                    <Check className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <Circle className="h-3.5 w-3.5 fill-primary text-primary" />
                  )}
                </button>
              </DropdownMenuItem>
            ))
          )}
        </div>

        <DropdownMenuSeparator className="m-0" />
        <div className="px-4 py-3 text-xs text-muted-foreground">
          New items appear here in real time.
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
