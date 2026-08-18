"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Check,
  ClipboardCheck,
  Database,
  Home,
  Loader2,
  Mail,
  MessageSquare,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  buildNotificationDetailRows,
  fetchNotification,
  markNotificationsRead,
  resolveNotificationDestination,
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

function categoryLabel(category: string) {
  if (category.startsWith("pm_")) {
    return category.replace(/^pm_/, "").replace(/_/g, " ");
  }
  return category.replace(/_/g, " ");
}

export default function NotificationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const notificationId = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";

  const { data: notification, isLoading, isError, error } = useQuery({
    queryKey: ["notification", notificationId],
    queryFn: () => fetchNotification(notificationId),
    enabled: !!notificationId,
  });

  const markReadMut = useMutation({
    mutationFn: (id: string) => markNotificationsRead([id]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notification", notificationId] });
      queryClient.invalidateQueries({ queryKey: ["notifications-list"] });
    },
  });

  useEffect(() => {
    if (!notification?.id || notification.read_at) {
      return;
    }

    let cancelled = false;
    markNotificationsRead([notification.id])
      .then(() => {
        if (cancelled) return;
        queryClient.invalidateQueries({ queryKey: ["dashboard-notifications"] });
        queryClient.invalidateQueries({ queryKey: ["notification", notification.id] });
        queryClient.invalidateQueries({ queryKey: ["notifications-list"] });
      })
      .catch(() => {
        // Keep the page usable even if mark-read fails.
      });

    return () => {
      cancelled = true;
    };
  }, [notification?.id, notification?.read_at, queryClient]);

  const destination = notification ? resolveNotificationDestination(notification) : null;
  const Icon = categoryIcon(notification?.category || "system");
  const details = notification ? buildNotificationDetailRows(notification) : [];

  return (
    <div className="space-y-6 pb-12 max-w-3xl mx-auto">
      <div className="flex w-full justify-between items-center gap-3 mb-2">
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full"
          onClick={() => router.push("/dashboard/notifications")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          All notifications
        </Button>
        <Breadcrumbs
          items={[
            { label: "Hive.OS", href: "/dashboard", icon: <Home className="h-4 w-4" /> },
            { label: "Notifications", href: "/dashboard/notifications" },
            { label: "Detail" },
          ]}
        />
      </div>

      {isLoading ? (
        <div className="flex min-h-[40vh] items-center justify-center rounded-[2rem] border border-border/50 bg-card/40">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : isError || !notification ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 rounded-[2rem] border border-border/50 bg-card/40 p-8 text-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <h2 className="text-xl font-bold">Notification not found</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            {error instanceof Error ? error.message : "This notification may have been removed or you no longer have access."}
          </p>
          <Button asChild className="rounded-xl mt-2">
            <Link href="/dashboard/notifications">Back to notifications</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-6 sm:p-8 border border-border/50 rounded-[2rem] bg-card/40 backdrop-blur-md shadow-sm space-y-6">
            <div className="flex items-start gap-4">
              <div
                className={cn(
                  "h-12 w-12 shrink-0 rounded-2xl border flex items-center justify-center",
                  categoryTone(notification.category)
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="rounded-full capitalize">
                    {categoryLabel(notification.category)}
                  </Badge>
                  {notification.read_at ? (
                    <Badge variant="outline" className="rounded-full gap-1">
                      <Check className="h-3 w-3" /> Read
                    </Badge>
                  ) : (
                    <Badge className="rounded-full">Unread</Badge>
                  )}
                </div>
                <h1 className="text-2xl font-space font-black tracking-tight text-foreground">
                  {notification.title}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {notification.created_at
                    ? formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })
                    : "Just now"}
                </p>
              </div>
            </div>

            {notification.body ? (
              <div className="rounded-2xl border border-border/50 bg-background/60 p-5">
                <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                  {notification.body}
                </p>
              </div>
            ) : null}

            {details.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {details.map((row) => (
                  <div
                    key={`${row.label}-${row.value}`}
                    className="rounded-xl border border-border/40 bg-background/40 px-4 py-3"
                  >
                    <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                      {row.label}
                    </div>
                    <div className="mt-1 text-sm font-semibold break-all">{row.value}</div>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3 pt-2">
              {destination ? (
                <Button
                  className="rounded-xl"
                  onClick={() => {
                    if (!notification.read_at) {
                      markReadMut.mutate(notification.id);
                    }
                    router.push(destination.href);
                  }}
                >
                  {destination.label}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : null}

              {!notification.read_at ? (
                <Button
                  variant="outline"
                  className="rounded-xl"
                  disabled={markReadMut.isPending}
                  onClick={() => {
                    markReadMut.mutate(notification.id, {
                      onSuccess: () => toast.success("Marked as read"),
                      onError: () => toast.error("Could not mark as read"),
                    });
                  }}
                >
                  Mark as read
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
