"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useChatAccess } from '@/hooks/use-chat-access';
import {
  decryptChatConversation,
  decryptChatMessage,
  ensureChatEncryptionIdentity,
  getEncryptedChatFallback,
  isEncryptedChatBody,
} from '@/lib/chat-e2ee';
import { getChatMessagePreview, getStoredChatUser } from '@/lib/chat-utils';
import { getChatPresenceChannelName, getChatUserChannelName, initEcho } from '@/lib/echo';
import { getAccessToken } from '@/lib/runtime-context';
import { useChatStore, ChatConversation, ChatMessage } from '@/store/chat-store';

type ChatMessageEvent = {
  message?: ChatMessage;
  conversation?: ChatConversation;
};

type ChatMessagesReadEvent = {
  payload?: {
    conversation_id: number;
    reader_id: number;
  };
  conversation_id?: number;
  reader_id?: number;
};

type ChatConversationEvent = {
  action?: string;
  payload?: {
    conversation_id: number;
    changes?: Partial<ChatConversation>;
  };
};

type ChatPresenceUser = {
  id: number;
  name?: string;
};

export function ChatSyncProvider() {
  const router = useRouter();
  const setActiveConversation = useChatStore((state) => state.setActiveConversation);
  const setEncryptionConfig = useChatStore((state) => state.setEncryptionConfig);
  const { isLoaded, hasChatWorkspace } = useChatAccess();

  useEffect(() => {
    if (!isLoaded || !hasChatWorkspace) {
      return;
    }

    const token = getAccessToken() || localStorage.getItem('token');
    const user = getStoredChatUser<{ id: number; name: string }>();

    if (!token || !user) {
      return;
    }

    const echo = initEcho(token);
    const channelName = getChatUserChannelName(user.id);
    const presenceChannelName = getChatPresenceChannelName();
    const channel = echo.private(channelName);
    const presenceChannel = echo.join(presenceChannelName);

    const syncCounts = async () => {
      try {
        const { data } = await api.get('/chat/counts');
        useChatStore.getState().setCounts(data);
      } catch {
        // Real-time events keep the UI current; this is only a bootstrap sync.
      }
    };

    const syncEncryptionConfig = async () => {
      try {
        const { data } = await api.get('/chat/config');
        const encryptionConfig = data?.encryption || {
          enabled: false,
          algorithm: null,
          public_key: null,
          fingerprint: null,
        };

        setEncryptionConfig(encryptionConfig);
        await ensureChatEncryptionIdentity(encryptionConfig);
      } catch {
        setEncryptionConfig({
          enabled: false,
          algorithm: null,
          public_key: null,
          fingerprint: null,
        });
      }
    };

    void syncCounts();
    void syncEncryptionConfig();

    channel.listen('.chat.message', async (event: ChatMessageEvent) => {
      const store = useChatStore.getState();
      const rawMessage = event?.message;
      const rawConversation = event?.conversation;

      if (!rawMessage) {
        return;
      }

      const conversation = rawConversation
        ? await decryptChatConversation(rawConversation)
        : rawConversation;
      const newMessage = conversation
        ? await decryptChatMessage(rawMessage, conversation)
        : rawMessage;

      const activeConversationId = store.activeConversationId;
      const isCurrentConversation =
        activeConversationId !== null &&
        String(activeConversationId) === String(newMessage.conversation_id);
      const isFromCurrentUser = String(newMessage.sender_id) === String(user.id);

      store.appendMessage(newMessage);

      if (newMessage.sender) {
        store.setTyping(newMessage.conversation_id, newMessage.sender, false);
      }

      const existingConversation = store.conversations.find(
        (item) => String(item.id) === String(newMessage.conversation_id)
      );

      const unreadCount = isFromCurrentUser
        ? existingConversation?.unread_count ?? 0
        : isCurrentConversation
          ? 0
          : Math.max((existingConversation?.unread_count ?? 0) + 1, conversation?.unread_count ?? 1);

      if (existingConversation) {
        store.updateConversation(newMessage.conversation_id, {
          ...conversation,
          last_message: conversation?.last_message ?? {
            id: newMessage.id,
            body: getChatMessagePreview(newMessage),
            type: newMessage.type || 'text',
            metadata: newMessage.metadata,
            sender_id: newMessage.sender_id,
            created_at: newMessage.created_at,
          },
          updated_at: conversation?.updated_at ?? newMessage.created_at,
          unread_count: unreadCount,
        });

        if (!isFromCurrentUser && !isCurrentConversation) {
          store.adjustCounts({ unread: 1 });
        }
      } else if (conversation) {
        store.appendConversation({
          ...conversation,
          unread_count: unreadCount,
        });

        if (!isFromCurrentUser) {
          store.adjustCounts({ total: 1, unread: isCurrentConversation ? 0 : 1 });
        }
      }

      if (!isFromCurrentUser && !isCurrentConversation) {
        const description = isEncryptedChatBody(rawMessage.body)
          ? getEncryptedChatFallback()
          : getChatMessagePreview(newMessage).slice(0, 80) || 'Open chat to read it.';

        toast.success(newMessage.sender?.name || 'New message', {
          description,
          duration: 5000,
          action: {
            label: 'Open',
            onClick: () => {
              setActiveConversation(Number(newMessage.conversation_id));
              router.push('/dashboard/chat');
            },
          },
        });
      }
    });

    channel.listen('.chat.messages.read', (event: ChatMessagesReadEvent) => {
      const payload = event?.payload || event;

      if (!payload?.conversation_id || String(payload.reader_id) === String(user.id)) {
        return;
      }

      const store = useChatStore.getState();
      store.setMessages(
        store.messages.map((message) => {
          if (
            String(message.conversation_id) !== String(payload.conversation_id) ||
            String(message.sender_id) !== String(user.id)
          ) {
            return message;
          }

          return { ...message, is_read: true };
        })
      );
    });

    channel.listen('.chat.conversation', (event: ChatConversationEvent) => {
      const store = useChatStore.getState();
      const action = event?.action;
      const payload = event?.payload;

      if (!action || !payload) {
        return;
      }

      switch (action) {
        case 'updated':
          store.updateConversation(payload.conversation_id, payload.changes ?? {});
          break;
        case 'deleted': {
          const conversation = store.conversations.find(
            (item) => String(item.id) === String(payload.conversation_id)
          );
          store.deleteConversation(payload.conversation_id);
          if (conversation) {
            store.adjustCounts({
              total: -1,
              unread: -(conversation.unread_count || 0),
            });
          }
          break;
        }
        default:
          break;
      }
    });

    presenceChannel
      .here((users: ChatPresenceUser[]) => {
        useChatStore.getState().setOnlineUsers(users);
      })
      .joining((joiningUser: ChatPresenceUser) => {
        const store = useChatStore.getState();
        if (!store.onlineUsers.find((userItem) => String(userItem.id) === String(joiningUser.id))) {
          store.setOnlineUsers([...store.onlineUsers, joiningUser]);
        }
      })
      .leaving((leavingUser: ChatPresenceUser) => {
        const store = useChatStore.getState();
        store.setOnlineUsers(store.onlineUsers.filter((userItem) => String(userItem.id) !== String(leavingUser.id)));

        Object.keys(store.typingUsers).forEach((conversationId) => {
          store.setTyping(Number(conversationId), { id: leavingUser.id, name: leavingUser.name ?? "User" }, false);
        });
      });

    return () => {
      echo.leave(channelName);
      echo.leave(presenceChannelName);
    };
  }, [hasChatWorkspace, isLoaded, router, setActiveConversation, setEncryptionConfig]);

  return null;
}
