"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Circle, Loader2, MessageSquare, Mail, AlertCircle, ClipboardCheck, Database } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getAccessToken } from "@/lib/runtime-context";
import { getUserNotificationChannelNames, initEcho } from "@/lib/echo";
import {
  fetchNotificationCenter,
  markNotificationsRead,
  notificationDetailPath,
  type AppNotification,
} from "@/lib/notifications";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type TopbarNotification = AppNotification;

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

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function toText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function normalizeIncomingNotification(notification: IncomingNotificationPayload): TopbarNotification | null {
  const root = toRecord(notification);
  const nestedData = toRecord(notification.data);
  const data = Object.keys(nestedData).length > 0 ? nestedData : root;
  const id = toText(notification.id) || toText(data.id);

  // Skip unstable payloads — random IDs inflate the unread badge.
  if (!id) {
    return null;
  }

  return {
    id,
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

function categoryIcon(category: string) {
  switch (category) {
    case "chat":
      return MessageSquare;
    case "mail":
      return Mail;
    case "workflow":
      return ClipboardCheck;
    case "backup":
      return Database;
    case "backup_failed":
      return AlertCircle;
    default:
      return Bell;
  }
}

function categoryTone(category: string) {
  switch (category) {
    case "chat":
      return "bg-blue-50 border-blue-100 text-blue-600";
    case "mail":
      return "bg-amber-50 border-amber-100 text-amber-600";
    case "workflow":
      return "bg-emerald-50 border-emerald-100 text-emerald-600";
    case "demo":
      return "bg-purple-50 border-purple-100 text-purple-600";
    case "backup":
      return "bg-indigo-50 border-indigo-100 text-indigo-600";
    case "backup_failed":
      return "bg-rose-50 border-rose-100 text-rose-600";
    default:
      return "bg-slate-50 border-slate-100 text-slate-600";
  }
}

export function TopbarNotificationsIcon({ activeUser }: { activeUser: ActiveNotificationUser | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  const { data: notificationCenter, isLoading, isFetched } = useQuery<NotificationCenterResponse>({
    queryKey: ["dashboard-notifications"],
    queryFn: () => fetchNotificationCenter(8, true),
    enabled: !!activeUser?.id,
    staleTime: 15_000,
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  const unreadCount = notificationCenter?.data?.unread_count ?? 0;
  const notifications = (notificationCenter?.data?.notifications ?? []).filter((item) => !item.read_at);
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
        if (!incoming || incoming.read_at) {
          queryClient.invalidateQueries({ queryKey: ["dashboard-notifications"] });
          return;
        }
        if (seenNotificationIds.has(incoming.id)) {
          return;
        }
        seenNotificationIds.add(incoming.id);

        // Only patch the cache after the first server fetch so login badge stays accurate.
        queryClient.setQueryData<NotificationCenterResponse | undefined>(
          ["dashboard-notifications"],
          (current) => {
            if (!current?.data) {
              return current;
            }

            const existing = current.data.notifications ?? [];
            const alreadyExists = existing.some((item) => item.id === incoming.id);
            const unreadOnly = [incoming, ...existing.filter((item) => item.id !== incoming.id && !item.read_at)].slice(0, 8);

            return {
              data: {
                unread_count: alreadyExists
                  ? current.data.unread_count
                  : current.data.unread_count + 1,
                notifications: unreadOnly,
              },
            };
          }
        );

        const isWorkflowPage = pathname.startsWith("/dashboard/workflow/approvals");

        if (
          incoming.category === "chat"
          || incoming.category === "mail"
          || (incoming.category === "workflow" && isWorkflowPage)
        ) {
          // List/count only — chat/mail/workflow pages toast themselves.
        } else if (incoming.category === "backup") {
          toast.success(incoming.title || "Backup Completed", {
            description: incoming.body,
            action: {
              label: "View",
              onClick: () => router.push(notificationDetailPath(incoming.id)),
            },
          });
        } else if (incoming.category === "backup_failed") {
          toast.error(incoming.title || "Backup Failed", {
            description: incoming.body,
            action: {
              label: "View",
              onClick: () => router.push(notificationDetailPath(incoming.id)),
            },
          });
        } else {
          toast.info(incoming.title || "New notification", {
            description: incoming.body,
            action: {
              label: "View",
              onClick: () => router.push(notificationDetailPath(incoming.id)),
            },
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

  const applyReadState = (unread_count: number, removedIds: string[]) => {
    queryClient.setQueryData<NotificationCenterResponse | undefined>(
      ["dashboard-notifications"],
      (current) => {
        if (!current) return current;

        return {
          data: {
            unread_count,
            notifications: current.data.notifications.filter((item) => !removedIds.includes(item.id)),
          },
        };
      }
    );
    queryClient.invalidateQueries({ queryKey: ["notifications-list"] });
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const result = await markNotificationsRead([notificationId]);
      applyReadState(result.unread_count, [notificationId]);
    } catch {
      toast.error("We could not mark that notification as read.");
    }
  };

  const markAllAsRead = async () => {
    try {
      const result = await markNotificationsRead();
      applyReadState(result.unread_count, notifications.map((item) => item.id));
      toast.success("All notifications marked as read");
    } catch {
      toast.error("We could not mark notifications as read.");
    }
  };

  const handleNotificationClick = async (notification: TopbarNotification) => {
    setIsOpen(false);
    // Navigate first; detail page also marks read. Still remove from panel immediately.
    void markAsRead(notification.id);
    router.push(notificationDetailPath(notification.id));
  };

  const badgeCount = isFetched ? unreadCount : null;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          id="tour-topbar-notifications"
          variant="ghost"
          className="relative h-10 w-10 rounded-xl p-0 shrink-0 text-muted-foreground hover:text-foreground"
        >
          <Bell className="h-5 w-5" />
          {badgeCount !== null ? (
            <span
              className={`absolute -top-1 -right-1 flex min-w-[18px] h-[18px] items-center justify-center rounded-full px-1 text-[10px] font-black text-white shadow-sm transition-colors ${
                badgeCount > 0 ? "bg-destructive" : "bg-muted-foreground"
              }`}
            >
              {badgeCount > 99 ? "99+" : badgeCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 sm:w-96 p-0 rounded-2xl shadow-xl z-[100] border-border/60">
        <div className="flex items-center justify-between px-4 py-3 border-b gap-2">
          <DropdownMenuLabel className="p-0 font-bold text-sm">Notifications</DropdownMenuLabel>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">
              {unreadCount} unread
            </span>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  void markAllAsRead();
                }}
                className="text-[11px] font-semibold text-primary hover:underline underline-offset-2 inline-flex items-center gap-1"
                title="Mark all as read"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex max-h-[360px] flex-col overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center items-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              You&apos;re all caught up.
            </div>
          ) : (
            notifications.map((notification) => {
              const Icon = categoryIcon(notification.category);
              return (
                <DropdownMenuItem
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className="relative flex cursor-pointer flex-col items-start gap-1 rounded-none border-b border-border/40 px-4 py-3 focus:bg-muted/50 bg-muted/20"
                >
                  <div className="flex w-full items-start gap-3 pr-7">
                    <div
                      className={cn(
                        "mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                        categoryTone(notification.category)
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <div className="flex w-full items-start justify-between gap-3">
                        <span className="text-[13px] leading-tight font-bold text-foreground">
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
                      void markAsRead(notification.id);
                    }}
                    className="absolute bottom-3 right-4 h-6 w-6 rounded-full flex items-center justify-center hover:bg-background shadow-sm border border-transparent hover:border-border transition-all"
                    title="Mark as read"
                  >
                    <Circle className="h-3.5 w-3.5 fill-primary text-primary" />
                  </button>
                </DropdownMenuItem>
              );
            })
          )}
        </div>

        <DropdownMenuSeparator className="m-0" />
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            Only unread items appear here.
          </span>
          <Link
            href="/dashboard/notifications"
            onClick={() => setIsOpen(false)}
            className="text-xs font-semibold text-primary hover:underline underline-offset-2"
          >
            View all
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
