"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { initEcho } from "@/lib/echo";
import { getAccessToken, getTenantId } from "@/lib/runtime-context";
import {
  decryptMailParticipant,
  ensureMailEncryptionIdentity,
  fetchMailEncryptionConfig,
  getEncryptedMailBodyFallback,
} from "@/lib/mail-e2ee";
import { useMailStore, MailParticipant, MailCounts } from "@/store/mail-store";

type UnreadMailCountResponse = {
  count: number;
};

export function MailSyncProvider() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const setEncryptionConfig = useMailStore((state) => state.setEncryptionConfig);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      const encryptionConfig = await fetchMailEncryptionConfig();

      if (!isMounted) {
        return;
      }

      setEncryptionConfig(encryptionConfig);
      await ensureMailEncryptionIdentity(encryptionConfig);
    })();

    return () => {
      isMounted = false;
    };
  }, [setEncryptionConfig]);

  useEffect(() => {
    const token = getAccessToken() || localStorage.getItem("token");

    if (!token) {
      return;
    }

    const userRaw = localStorage.getItem("hive_user") || localStorage.getItem("user");

    if (!userRaw) {
      return;
    }

    let user: { id?: number } | null = null;

    try {
      user = JSON.parse(userRaw);
    } catch {
      user = null;
    }

    if (!user?.id) {
      return;
    }

    const echo = initEcho(token);
    const prefix = getTenantId() ? `tenant.${getTenantId()}.` : "";
    const channelName = `${prefix}user.${user.id}.mail`;
    const channel = echo.private(channelName);

    const syncTopbarMailQueries = () => {
      queryClient.invalidateQueries({ queryKey: ["unreadMailCount"] });
      queryClient.invalidateQueries({ queryKey: ["recentMails"] });
    };

    channel.listen(".mail.received", (event: { participantData?: MailParticipant }) => {
      void (async () => {
        const rawParticipant = event?.participantData;

        if (!rawParticipant) {
          return;
        }

        const participant = await decryptMailParticipant(rawParticipant);
        const store = useMailStore.getState();

        if (store.activeFolder === "inbox" || store.activeFolder === "all") {
          store.appendMail(participant);
        }

        store.adjustCounts({ inbox: 1, inbox_unread: 1 });

        queryClient.setQueryData<UnreadMailCountResponse | undefined>(
          ["unreadMailCount"],
          (current) => ({
            count: (current?.count || 0) + 1,
          }),
        );
        queryClient.invalidateQueries({ queryKey: ["recentMails"] });

        if (!pathname.startsWith("/dashboard/mail")) {
          toast.success("New mail received", {
            description: participant.message?.encryption?.encrypted
              ? getEncryptedMailBodyFallback()
              : (participant.message?.subject || "Open inbox to read it."),
            duration: 5000,
            action: {
              label: "Open",
              onClick: () => router.push("/dashboard/mail"),
            },
          });
        }
      })();
    });

    channel.listen(".mail.sync", (event: { action?: string; payload?: Record<string, unknown> }) => {
      const { action, payload } = event || {};

      if (!action || !payload) {
        return;
      }

      const store = useMailStore.getState();

      switch (action) {
        case "update": {
          const { message_id, changes } = payload;
          store.updateMail(message_id, changes);

          if (typeof changes?.is_read !== "undefined" && store.activeFolder === "inbox") {
            store.adjustCounts({ inbox_unread: changes.is_read ? -1 : 1 });
          }
          break;
        }

        case "delete": {
          const { message_id, permanent } = payload;

          if (permanent) {
            store.deleteMail(message_id);
            store.adjustCounts({ trash: -1 });
          } else {
            store.updateMail(message_id, { folder: "trash" });

            if (store.activeFolder !== "trash") {
              store.deleteMail(message_id);
              store.adjustCounts({ [store.activeFolder]: -1, trash: 1 } as Partial<MailCounts>);
            }
          }
          break;
        }

        case "bulk": {
          const { ids, action: bulkAction } = payload;
          const amount = ids.length;

          switch (bulkAction) {
            case "trash":
              store.bulkUpdateMails(ids, { folder: "trash" });
              if (store.activeFolder !== "trash") {
                store.bulkDeleteMails(ids);
                store.adjustCounts({ [store.activeFolder]: -amount, trash: amount } as Partial<MailCounts>);
              }
              break;
            case "delete":
              store.bulkDeleteMails(ids);
              store.adjustCounts({ [store.activeFolder]: -amount } as Partial<MailCounts>);
              break;
            case "star":
              store.bulkUpdateMails(ids, { is_starred: true });
              store.adjustCounts({ starred: amount });
              break;
            case "unstar":
              store.bulkUpdateMails(ids, { is_starred: false });
              store.adjustCounts({ starred: -amount });
              break;
            case "read":
              store.bulkUpdateMails(ids, { is_read: true });
              if (store.activeFolder === "inbox") {
                store.adjustCounts({ inbox_unread: -amount });
              }
              break;
            case "unread":
              store.bulkUpdateMails(ids, { is_read: false });
              if (store.activeFolder === "inbox") {
                store.adjustCounts({ inbox_unread: amount });
              }
              break;
            case "archive":
              store.bulkUpdateMails(ids, { folder: "archive" });
              if (store.activeFolder !== "archive") {
                store.bulkDeleteMails(ids);
                store.adjustCounts({ [store.activeFolder]: -amount, archive: amount } as Partial<MailCounts>);
              }
              break;
            case "spam":
              store.bulkUpdateMails(ids, { folder: "spam" });
              if (store.activeFolder !== "spam") {
                store.bulkDeleteMails(ids);
                store.adjustCounts({ [store.activeFolder]: -amount, spam: amount } as Partial<MailCounts>);
              }
              break;
            case "inbox":
              store.bulkUpdateMails(ids, { folder: "inbox" });
              if (store.activeFolder !== "inbox") {
                store.bulkDeleteMails(ids);
                store.adjustCounts({ [store.activeFolder]: -amount, inbox: amount } as Partial<MailCounts>);
              }
              break;
            case "important":
              store.bulkUpdateMails(ids, { folder: "important" });
              if (store.activeFolder !== "important") {
                store.bulkDeleteMails(ids);
                store.adjustCounts({ [store.activeFolder]: -amount, important: amount } as Partial<MailCounts>);
              }
              break;
            default:
              break;
          }

          store.clearChecked();
          break;
        }

        case "draft":
          if (payload.participantData) {
            void decryptMailParticipant(payload.participantData as MailParticipant).then((participant) => {
              const currentStore = useMailStore.getState();
              currentStore.updateMail(payload.message_id, participant);

              if (!currentStore.mails.find((item) => item.mail_message_id === payload.message_id)) {
                if (currentStore.activeFolder === "drafts") {
                  currentStore.appendMail(participant);
                }
              }

              if (payload.is_new) {
                currentStore.adjustCounts({ drafts: 1 });
              }
            });
          }
          break;

        case "sent":
          if (payload.previous_folder === "drafts") {
            store.adjustCounts({ drafts: -1, sent: 1 });
            if (store.activeFolder === "drafts") {
              store.deleteMail(payload.message_id);
            }
          } else {
            store.adjustCounts({ sent: 1 });
          }

          if (store.activeFolder === "sent" && payload.participantData) {
            void decryptMailParticipant(payload.participantData as MailParticipant).then((participant) => {
              useMailStore.getState().appendMail(participant);
            });
          }
          break;
        default:
          break;
      }

      syncTopbarMailQueries();
    });

    return () => {
      channel.stopListening(".mail.received");
      channel.stopListening(".mail.sync");
      echo.leave(channelName);
    };
  }, [pathname, queryClient, router]);

  return null;
}
