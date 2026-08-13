"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  Bell,
  Check,
  CheckCheck,
  ClipboardCheck,
  Database,
  Home,
  Loader2,
  Mail,
  MessageSquare,
  AlertCircle,
  Circle,
} from "lucide-react";
import { toast } from "sonner";

import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  fetchNotificationCenter,
  markNotificationsRead,
  notificationDetailPath,
  type AppNotification,
} from "@/lib/notifications";

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
      if (category.startsWith("pm_")) {
        return "bg-sky-50 border-sky-100 text-sky-600";
      }
      return "bg-slate-50 border-slate-100 text-slate-600";
  }
}

export default function NotificationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const { data, isLoading } = useQuery({
    queryKey: ["notifications-list"],
    queryFn: () => fetchNotificationCenter(50),
    staleTime: 15_000,
  });

  const unreadCount = data?.data?.unread_count ?? 0;
  const notifications = data?.data?.notifications ?? [];
  const filtered = filter === "unread"
    ? notifications.filter((item) => !item.read_at)
    : notifications;

  const markReadMut = useMutation({
    mutationFn: (ids?: string[]) => markNotificationsRead(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-list"] });
    },
    onError: () => toast.error("Could not update read status."),
  });

  const openNotification = (notification: AppNotification) => {
    if (!notification.read_at) {
      markReadMut.mutate([notification.id]);
    }
    router.push(notificationDetailPath(notification.id));
  };

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      <div className="flex w-full justify-end items-center gap-3 mb-4">
        <Breadcrumbs
          items={[
            { label: "Hive.OS", href: "/dashboard", icon: <Home className="h-4 w-4" /> },
            { label: "Notifications" },
          ]}
        />
      </div>

      <div className="p-6 sm:p-8 border border-border/50 rounded-[2rem] bg-card/40 backdrop-blur-md shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shrink-0">
              <Bell className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-space font-black tracking-tight">Notifications</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Review updates, then open the related page from each detail.
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            disabled={unreadCount === 0 || markReadMut.isPending}
            onClick={() => {
              markReadMut.mutate(undefined, {
                onSuccess: () => toast.success("All notifications marked as read"),
              });
            }}
          >
            <CheckCheck className="h-4 w-4 mr-2" />
            Mark all read
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-6 pt-5 border-t border-border/50">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            className="rounded-full"
            onClick={() => setFilter("all")}
          >
            All
            <Badge variant="secondary" className="ml-2">{notifications.length}</Badge>
          </Button>
          <Button
            variant={filter === "unread" ? "default" : "outline"}
            size="sm"
            className="rounded-full"
            onClick={() => setFilter("unread")}
          >
            Unread
            <Badge variant="secondary" className="ml-2">{unreadCount}</Badge>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center rounded-[2rem] border border-dashed border-border/60 bg-card/20">
          <Bell className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="text-lg font-bold">No notifications</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {filter === "unread" ? "You are all caught up." : "Nothing here yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((notification) => {
            const Icon = categoryIcon(notification.category);
            return (
              <button
                key={notification.id}
                type="button"
                onClick={() => openNotification(notification)}
                className={cn(
                  "w-full text-left p-4 sm:p-5 rounded-[1.25rem] border transition-colors flex items-start gap-4",
                  !notification.read_at
                    ? "border-primary/20 bg-primary/5 hover:bg-primary/10"
                    : "border-border/50 bg-card/40 hover:bg-card/70"
                )}
              >
                <div
                  className={cn(
                    "mt-0.5 h-10 w-10 shrink-0 rounded-xl border flex items-center justify-center",
                    categoryTone(notification.category)
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h3
                      className={cn(
                        "text-sm leading-snug",
                        !notification.read_at ? "font-bold text-foreground" : "font-medium text-muted-foreground"
                      )}
                    >
                      {notification.title}
                    </h3>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {notification.created_at
                        ? formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })
                        : "just now"}
                    </span>
                  </div>
                  {notification.body ? (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{notification.body}</p>
                  ) : null}
                  <div className="mt-2">
                    <Badge variant="outline" className="rounded-full capitalize text-[11px]">
                      {notification.category.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </div>

                <span
                  className="mt-1 shrink-0"
                  title={notification.read_at ? "Read" : "Unread"}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!notification.read_at) {
                      markReadMut.mutate([notification.id], {
                        onSuccess: () => toast.success("Marked as read"),
                      });
                    }
                  }}
                >
                  {notification.read_at ? (
                    <Check className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Circle className="h-4 w-4 fill-primary text-primary" />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Showing your most recent notifications. Open one for details and related navigation.
      </p>
    </div>
  );
}
