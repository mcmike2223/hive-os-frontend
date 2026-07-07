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
import { useMailStore, MailParticipant, MailCounts, MailFolder } from "@/store/mail-store";

type UnreadMailCountResponse = {
  count: number;
};

type MailFolderCountKey = Exclude<MailFolder, "all">;

type MailSyncPayload = {
  message_id?: number;
  changes?: Partial<MailParticipant> & { is_read?: boolean };
  permanent?: boolean;
  ids?: number[];
  action?: string;
  participantData?: MailParticipant;
  is_new?: boolean;
  previous_folder?: string;
};

const asNumber = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

const asNumberArray = (value: unknown): number[] =>
  Array.isArray(value) ? value.filter((item): item is number => typeof item === "number") : [];

const asMailChanges = (value: unknown): Partial<MailParticipant> & { is_read?: boolean } =>
  typeof value === "object" && value !== null ? (value as Partial<MailParticipant> & { is_read?: boolean }) : {};

const folderCountDelta = (folder: MailFolder, delta: number): Partial<MailCounts> =>
  folder === "all" ? {} : ({ [folder]: delta } as Partial<Record<MailFolderCountKey, number>>);

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

    channel.listen(".mail.sync", (event: { action?: string; payload?: MailSyncPayload }) => {
      const { action, payload } = event || {};

      if (!action || !payload) {
        return;
      }

      const store = useMailStore.getState();

      switch (action) {
        case "update": {
          const messageId = asNumber(payload.message_id);
          const changes = asMailChanges(payload.changes);
          if (messageId == null) break;
          store.updateMail(messageId, changes);

          if (typeof changes.is_read !== "undefined" && store.activeFolder === "inbox") {
            store.adjustCounts({ inbox_unread: changes.is_read ? -1 : 1 });
          }
          break;
        }

        case "delete": {
          const messageId = asNumber(payload.message_id);
          if (messageId == null) break;

          if (payload.permanent) {
            store.deleteMail(messageId);
            store.adjustCounts({ trash: -1 });
          } else {
            store.updateMail(messageId, { folder: "trash" });

            if (store.activeFolder !== "trash") {
              store.deleteMail(messageId);
              store.adjustCounts({ ...folderCountDelta(store.activeFolder, -1), trash: 1 });
            }
          }
          break;
        }

        case "bulk": {
          const ids = asNumberArray(payload.ids);
          const bulkAction = payload.action;
          const amount = ids.length;

          switch (bulkAction) {
            case "trash":
              store.bulkUpdateMails(ids, { folder: "trash" });
              if (store.activeFolder !== "trash") {
                store.bulkDeleteMails(ids);
                store.adjustCounts({ ...folderCountDelta(store.activeFolder, -amount), trash: amount });
              }
              break;
            case "delete":
              store.bulkDeleteMails(ids);
              store.adjustCounts(folderCountDelta(store.activeFolder, -amount));
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
                store.adjustCounts({ ...folderCountDelta(store.activeFolder, -amount), archive: amount });
              }
              break;
            case "spam":
              store.bulkUpdateMails(ids, { folder: "spam" });
              if (store.activeFolder !== "spam") {
                store.bulkDeleteMails(ids);
                store.adjustCounts({ ...folderCountDelta(store.activeFolder, -amount), spam: amount });
              }
              break;
            case "inbox":
              store.bulkUpdateMails(ids, { folder: "inbox" });
              if (store.activeFolder !== "inbox") {
                store.bulkDeleteMails(ids);
                store.adjustCounts({ ...folderCountDelta(store.activeFolder, -amount), inbox: amount });
              }
              break;
            case "important":
              store.bulkUpdateMails(ids, { folder: "important" });
              if (store.activeFolder !== "important") {
                store.bulkDeleteMails(ids);
                store.adjustCounts({ ...folderCountDelta(store.activeFolder, -amount), important: amount });
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
            const draftMessageId = asNumber(payload.message_id);
            void decryptMailParticipant(payload.participantData).then((participant) => {
              const currentStore = useMailStore.getState();
              if (draftMessageId != null) {
                currentStore.updateMail(draftMessageId, participant);
              }

              if (draftMessageId != null && !currentStore.mails.find((item) => item.mail_message_id === draftMessageId)) {
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
            const sentMessageId = asNumber(payload.message_id);
            if (store.activeFolder === "drafts" && sentMessageId != null) {
              store.deleteMail(sentMessageId);
            }
          } else {
            store.adjustCounts({ sent: 1 });
          }

          if (store.activeFolder === "sent" && payload.participantData) {
            void decryptMailParticipant(payload.participantData).then((participant) => {
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
