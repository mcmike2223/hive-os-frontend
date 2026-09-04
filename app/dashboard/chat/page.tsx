"use client";

import { useRouter } from "next/navigation";
import { Home, Layers, LockKeyhole, MessageSquare } from "lucide-react";
import ChatLayout from "@/components/chat/chat-layout";
import { CommunicationWorkspaceHeader } from "@/components/communications/communication-workspace-header";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { ModulePageSkeleton } from "@/components/ui/loading-states";
import { useChatAccess } from "@/hooks/use-chat-access";
import { usePermissions } from "@/hooks/use-permissions";
import { useChatStore } from "@/store/chat-store";
import { useTranslation } from "@/store/use-translation";

export default function ChatPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { hasAnyPermission } = usePermissions();
  const { isLoaded, canAccessChat, hasMailboxModule, isTenantWorkspace } = useChatAccess();
  const canOpenSubscriptions = hasAnyPermission(["view_module_subscriptions", "manage_module_subscriptions"]);
  const unreadCount = useChatStore((state) => state.counts.unread);
  const onlineCount = useChatStore((state) => state.onlineUsers.length);

  if (!isLoaded) {
    return <ModulePageSkeleton titleWidth="w-44" subtitleWidth="w-80" rows={6} cols={4} />;
  }

  if (!canAccessChat) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-[2rem] border border-border/50 bg-card/40 p-8 text-center">
        <div className="flex size-20 items-center justify-center rounded-[1.75rem] border border-primary/20 bg-primary/10">
          <MessageSquare aria-hidden="true" className="size-9 text-primary" />
        </div>
        <h2 className="mt-6 text-3xl font-black tracking-tight">
          {t("global.access_denied", "Access Denied")}
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          {t("chat.denied", "Your current role does not have permission to access the chat workspace.")}
        </p>
      </div>
    );
  }

  if (isTenantWorkspace && !hasMailboxModule) {
    return (
      <div className="space-y-2">
        <div className="mb-2 flex w-full justify-end">
          <Breadcrumbs
            items={[
              { label: "Hive.OS", href: "/dashboard", icon: <Home className="h-4 w-4" /> },
              { label: t("nav.chat", "Real-time Chat") },
            ]}
          />
        </div>

        <div className="flex min-h-[65vh] flex-col items-center justify-center rounded-[2rem] border border-border/50 bg-card/40 p-8 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-[1.75rem] border border-primary/20 bg-primary/10">
            <LockKeyhole className="h-9 w-9 text-primary" />
          </div>
          <h2 className="mt-6 text-3xl font-black tracking-tight text-foreground">
            {t("chat.subscription_required", "Secure Comms Module Required")}
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {t("chat.subscription_desc", "Tenant chat follows the mailbox module. Activate the secure comms module for this tenant and the real-time chat workspace will unlock automatically.")}
          </p>
          {canOpenSubscriptions ? (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button onClick={() => router.push("/dashboard/subscriptions")} className="rounded-xl px-6 font-semibold">
                <Layers className="mr-2 h-4 w-4" />
                {t("chat.subscription_btn", "Open Subscriptions")}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <CommunicationWorkspaceHeader kind="chat" onlineCount={onlineCount} unreadCount={unreadCount} />
      <div className="h-[calc(100dvh-13rem)] min-h-[34rem] overflow-hidden rounded-2xl border border-border/60 bg-card/50 shadow-sm">
        <ChatLayout />
      </div>
    </div>
  );
}
