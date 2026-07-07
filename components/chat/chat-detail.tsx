"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import EmojiPicker from 'emoji-picker-react';
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Download,
  FileText,
  Info,
  Loader2,
  Lock,
  MessageSquare,
  Paperclip,
  Phone,
  Plus,
  Reply,
  Send,
  Smile,
  Video,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FileManagerClient } from '@/components/dashboard/file-manager-client';
import { useChatAccess } from '@/hooks/use-chat-access';
import { authenticatedDownload } from '@/lib/authenticated-download';
import {
  bootstrapConversationEncryption,
  decryptChatMessage,
  encryptChatMessageBody,
} from '@/lib/chat-e2ee';
import {
  createReplyMetadata,
  getChatAttachmentLabel,
  getChatMessageFallback,
  getChatMessagePreview,
  getChatReplyPreview,
  getStoredChatUser,
} from '@/lib/chat-utils';
import { cn } from '@/lib/utils';
import { getConversationPresenceChannelName, initEcho } from '@/lib/echo';
import { getAccessToken, getAuthHeaders } from '@/lib/runtime-context';
import { getErrorMessage } from '@/lib/errors';
import {
  ChatAttachmentMetadata,
  ChatConversation,
  ChatMessage,
  ChatMessageMetadata,
  useChatStore,
} from '@/store/chat-store';

interface ChatDetailProps {
  onBack?: () => void;
}

type LocalUser = {
  id: number;
  name: string;
};

type TypingWhisperPayload = {
  conversation_id?: number | string;
  user?: { id: number | string; name?: string };
  is_typing?: boolean;
};

type PresenceChannel = {
  whisper: (event: string, payload: TypingWhisperPayload) => void;
  listenForWhisper: (event: string, callback: (payload: TypingWhisperPayload) => void) => void;
};

type ChatFileSelection = {
  id?: number | string;
  url?: string;
  media_details?: {
    uuid?: string;
    name?: string;
    title?: string;
    download_name?: string;
    mime_type?: string;
    size?: number;
    human_size?: string;
    url?: string;
    thumbnail?: string;
  };
};

const getFileMessageType = (mimeType?: string | null): 'image' | 'file' | 'audio' => {
  if (mimeType?.startsWith('image/')) {
    return 'image';
  }

  if (mimeType?.startsWith('audio/')) {
    return 'audio';
  }

  return 'file';
};

const isProtectedFileUrl = (url?: string | null) => Boolean(
  url && (
    (url.includes('/api/v1/files/') && url.includes('/serve'))
    || url.includes('/api/v1/chat/conversations/')
  )
);

const getDownloadUrl = (url: string) => (url.includes('?') ? `${url}&download=1` : `${url}?download=1`);

const SecureAttachmentImage = ({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!src) {
      setBlobUrl(null);
      setFailed(false);
      return;
    }

    if (!isProtectedFileUrl(src)) {
      setBlobUrl(src);
      setFailed(false);
      return;
    }

    let revoked = false;
    let objectUrl: string | null = null;
    setFailed(false);

    (async () => {
      try {
        const response = await fetch(src, { headers: getAuthHeaders() });
        if (!response.ok) {
          throw new Error('Failed to load image');
        }

        const blob = await response.blob();
        if (revoked) {
          return;
        }

        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      } catch {
        if (!revoked) {
          setBlobUrl(null);
          setFailed(true);
        }
      }
    })();

    return () => {
      revoked = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [src]);

  if (failed) {
    return (
      <div className={cn("flex min-h-[180px] items-center justify-center bg-black/10 px-4 text-center text-xs text-muted-foreground", className)}>
        Preview unavailable
      </div>
    );
  }

  if (!blobUrl) {
    return (
      <div className={cn("flex min-h-[180px] items-center justify-center bg-black/10 text-xs text-muted-foreground", className)}>
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return <img src={blobUrl} alt={alt} className={className} />;
};

const AttachmentCard = ({
  attachment,
  isOwn,
  actionLabel,
  onAction,
}: {
  attachment: ChatAttachmentMetadata;
  isOwn: boolean;
  actionLabel: string;
  onAction: (attachment: ChatAttachmentMetadata) => void;
}) => {
  const label = getChatAttachmentLabel(attachment) || 'Attachment';
  const isImage = attachment.mime_type?.startsWith('image/');
  const previewUrl = attachment.thumbnail || attachment.url || '';

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border text-left",
        isOwn
          ? "border-white/20 bg-white/10 text-white"
          : "border-border/50 bg-background/70 text-foreground"
      )}
    >
      {isImage && previewUrl ? (
        <SecureAttachmentImage
          src={previewUrl}
          alt={label}
          className="max-h-64 w-full object-cover"
        />
      ) : null}

      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {!isImage && (
            <div className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
              isOwn ? "bg-white/15 text-white" : "bg-orange-500/10 text-orange-500"
            )}>
              <FileText className="h-5 w-5" />
            </div>
          )}

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{label}</p>
            <p className={cn("truncate text-[11px]", isOwn ? "text-white/70" : "text-muted-foreground")}>
              {attachment.human_size || attachment.mime_type || 'Attachment'}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 rounded-xl px-2.5 text-xs font-semibold",
            isOwn ? "text-white hover:bg-white/10 hover:text-white" : "hover:bg-orange-500/10 hover:text-orange-500"
          )}
          onClick={() => onAction(attachment)}
        >
          <Download className="mr-1.5 h-3.5 w-3.5" />
          {actionLabel}
        </Button>
      </div>
    </div>
  );
};

const PendingAttachmentComposerCard = ({
  attachment,
  onRemove,
}: {
  attachment: ChatAttachmentMetadata;
  onRemove: () => void;
}) => {
  const label = getChatAttachmentLabel(attachment) || 'Attachment';
  const isImage = attachment.mime_type?.startsWith('image/');
  const previewUrl = attachment.thumbnail || attachment.url || '';

  return (
    <div className="mb-2 rounded-2xl border border-orange-500/20 bg-orange-500/5 px-3 py-3">
      <div className="flex items-start gap-3">
        {isImage && previewUrl ? (
          <SecureAttachmentImage
            src={previewUrl}
            alt={label}
            className="h-20 w-20 rounded-2xl object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-500">
            <FileText className="h-5 w-5" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-orange-500">
            Attachment ready
          </p>
          <p className="truncate text-sm font-semibold text-foreground">{label}</p>
          <p className="truncate text-xs text-muted-foreground">
            {attachment.human_size || attachment.mime_type || 'Attachment'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add an optional message, then send both together.
          </p>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="h-8 w-8 rounded-full text-muted-foreground hover:bg-orange-500/10 hover:text-orange-500"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default function ChatDetail({ onBack }: ChatDetailProps) {
  const {
    conversations,
    activeConversationId,
    setActiveConversation,
    updateConversation,
    setMessages,
    appendMessage,
    messages,
    onlineUsers,
    adjustCounts,
    typingUsers,
    clearTyping,
    encryptionConfig,
  } = useChatStore();
  const { canManageChat, canBrowseAttachments, canSaveAttachments } = useChatAccess();

  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [currentUser, setCurrentUser] = useState<LocalUser | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isFileManagerOpen, setIsFileManagerOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<ChatAttachmentMetadata | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const conversationChannelRef = useRef<PresenceChannel | null>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const isTypingRef = useRef(false);

  const conversation = conversations.find((item) => String(item.id) === String(activeConversationId));

  const conversationMessages = useMemo(() => {
    return messages.filter((message) => String(message.conversation_id) === String(activeConversationId));
  }, [messages, activeConversationId]);

  useEffect(() => {
    setCurrentUser(getStoredChatUser<LocalUser>());

    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setReplyingTo(null);
    setPendingAttachment(null);
  }, [activeConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationMessages]);

  useEffect(() => {
    const token = getAccessToken() || localStorage.getItem('token');

    if (!activeConversationId || !currentUser || !token) {
      return;
    }

    const echo = initEcho(token);
    const channelName = getConversationPresenceChannelName(activeConversationId);
    const channel = echo.join(channelName);
    conversationChannelRef.current = channel;

    channel.listenForWhisper('typing', (payload: TypingWhisperPayload) => {
      if (
        !payload?.conversation_id ||
        !payload?.user ||
        String(payload.user.id) === String(currentUser.id) ||
        String(payload.conversation_id) !== String(activeConversationId)
      ) {
        return;
      }

      useChatStore.getState().setTyping(Number(payload.conversation_id), { id: Number(payload.user.id), name: payload.user.name ?? "User" }, Boolean(payload.is_typing));
    });

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      if (isTypingRef.current) {
        channel.whisper('typing', {
          conversation_id: activeConversationId ?? undefined,
          user: { id: currentUser.id, name: currentUser.name },
          is_typing: false,
        });
      }

      isTypingRef.current = false;
      echo.leave(channelName);
      conversationChannelRef.current = null;
    };
  }, [activeConversationId, clearTyping, currentUser]);

  useEffect(() => {
    if (!activeConversationId || !currentUser) {
      return;
    }

    const unreadMessages = conversationMessages.filter(
      (message) => !message.is_read && String(message.sender_id) !== String(currentUser.id)
    );

    if (unreadMessages.length === 0) {
      return;
    }

    setMessages(
      messages.map((message) => {
        if (
          String(message.conversation_id) !== String(activeConversationId) ||
          String(message.sender_id) === String(currentUser.id)
        ) {
          return message;
        }

        return { ...message, is_read: true };
      })
    );

    if (conversation?.unread_count) {
      adjustCounts({ unread: -conversation.unread_count });
      updateConversation(activeConversationId, { unread_count: 0 });
    }

    void api.put(`/chat/conversations/${activeConversationId}/read`).catch(() => {});
  }, [
    activeConversationId,
    adjustCounts,
    conversation?.unread_count,
    conversationMessages,
    currentUser,
    messages,
    setMessages,
    updateConversation,
  ]);

  useEffect(() => {
    if (!activeConversationId || !currentUser || !conversationChannelRef.current) {
      return;
    }

    if (!canManageChat) {
      if (isTypingRef.current) {
        conversationChannelRef.current.whisper('typing', {
          conversation_id: activeConversationId ?? undefined,
          user: { id: currentUser.id, name: currentUser.name },
          is_typing: false,
        });
        isTypingRef.current = false;
      }

      return;
    }

    if (!messageInput.trim()) {
      if (isTypingRef.current) {
        conversationChannelRef.current.whisper('typing', {
          conversation_id: activeConversationId ?? undefined,
          user: { id: currentUser.id, name: currentUser.name },
          is_typing: false,
        });
        isTypingRef.current = false;
      }

      return;
    }

    if (!isTypingRef.current) {
      conversationChannelRef.current.whisper('typing', {
        conversation_id: activeConversationId ?? undefined,
        user: { id: currentUser.id, name: currentUser.name },
        is_typing: true,
      });
      isTypingRef.current = true;
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (!conversationChannelRef.current) {
        return;
      }

      conversationChannelRef.current.whisper('typing', {
        conversation_id: activeConversationId ?? undefined,
        user: { id: currentUser.id, name: currentUser.name },
        is_typing: false,
      });
      isTypingRef.current = false;
    }, 2500);
  }, [activeConversationId, canManageChat, currentUser, messageInput]);

  const stopTypingIndicator = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (conversationChannelRef.current && isTypingRef.current && currentUser) {
      conversationChannelRef.current.whisper('typing', {
        conversation_id: activeConversationId ?? undefined,
        user: { id: currentUser.id, name: currentUser.name },
        is_typing: false,
      });
    }

    isTypingRef.current = false;
    if (activeConversationId) {
      clearTyping(activeConversationId);
    }
  };

  const handleSendMessage = async () => {
    if (!activeConversationId || sending || !canManageChat) {
      return;
    }

    const resolvedBody = messageInput.trim();
    const attachment = pendingAttachment;
    const resolvedType = attachment?.type || (resolvedBody ? 'text' : 'file');

    if (!resolvedBody && !attachment) {
      return;
    }

    const composedMetadata: ChatMessageMetadata = {
      ...(attachment ? { attachment } : {}),
      ...(replyingTo ? { reply_to: createReplyMetadata(replyingTo) } : {}),
    };

    setSending(true);

    try {
      let activeConversation = conversation || null;
      let outgoingBody = resolvedBody || null;

      if (resolvedBody && activeConversation && encryptionConfig.enabled) {
        activeConversation = await bootstrapConversationEncryption(activeConversation);
        outgoingBody = await encryptChatMessageBody(activeConversation, resolvedBody);
      }

      const payload = {
        type: resolvedType,
        body: outgoingBody,
        metadata: Object.keys(composedMetadata).length > 0 ? composedMetadata : undefined,
      };

      const { data } = await api.post(`/chat/conversations/${activeConversationId}/messages`, payload);

      const rawMessage = data.message || data;
      const newMessage = activeConversation
        ? await decryptChatMessage(rawMessage, activeConversation)
        : rawMessage;
      appendMessage(newMessage);
      updateConversation(activeConversationId, {
        last_message: {
          id: newMessage.id,
          body: getChatMessagePreview(newMessage),
          type: newMessage.type || resolvedType,
          metadata: newMessage.metadata,
          sender_id: newMessage.sender_id,
          created_at: newMessage.created_at,
        },
        updated_at: newMessage.created_at,
      } satisfies Partial<ChatConversation>);

      setMessageInput('');
      setPendingAttachment(null);
      setReplyingTo(null);
      stopTypingIndicator();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to send message'));
    } finally {
      setSending(false);
    }
  };

  const handleAttachmentAction = async (message: ChatMessage, attachment: ChatAttachmentMetadata) => {
    if (!activeConversationId) {
      return;
    }

    if (canSaveAttachments) {
      try {
        const { data } = await api.post(
          `/chat/conversations/${activeConversationId}/messages/${message.id}/save-attachment`
        );
        toast.success(data?.message || 'Attachment saved to File Manager.');
        return;
      } catch (error: unknown) {
        toast.error(getErrorMessage(error, 'Failed to save attachment to File Manager.'));
        return;
      }
    }

    if (!attachment.url) {
      toast.error('Attachment is unavailable.');
      return;
    }

    try {
      await authenticatedDownload(getDownloadUrl(attachment.url), {
        filename: attachment.download_name || attachment.name || attachment.title || 'attachment',
        headers: getAuthHeaders(),
      });
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to download attachment.'));
    }
  };

  const handleFileSelect = (file: ChatFileSelection) => {
    if (!canBrowseAttachments || !canManageChat) {
      return;
    }

    const attachment: ChatAttachmentMetadata = {
      file_entry_id: file?.id ? Number(file.id) : null,
      uuid: file?.media_details?.uuid || null,
      name: file?.media_details?.name || null,
      title: file?.media_details?.title || file?.media_details?.name || null,
      download_name: file?.media_details?.download_name || file?.media_details?.name || null,
      mime_type: file?.media_details?.mime_type || null,
      size: typeof file?.media_details?.size === 'number' ? file.media_details.size : null,
      human_size: file?.media_details?.human_size || null,
      url: file?.media_details?.url || file?.url || null,
      thumbnail: file?.media_details?.thumbnail || null,
      type: getFileMessageType(file?.media_details?.mime_type),
    };

    if (!attachment.url) {
      toast.error('Failed to attach the selected file.');
      return;
    }

    setPendingAttachment(attachment);
    setIsFileManagerOpen(false);
    toast.success('Attachment added. You can include a message before sending.');
  };

  const otherParticipant = conversation?.type === 'private'
    ? conversation.participants.find((participant) => String(participant.id) !== String(currentUser?.id))
    : null;

  const isOnline = otherParticipant
    ? onlineUsers.some((onlineUser) => String(onlineUser.id) === String(otherParticipant.id))
    : false;

  const onlineCount = conversation?.type === 'group'
    ? conversation.participants.filter((participant) =>
        onlineUsers.some((onlineUser) => String(onlineUser.id) === String(participant.id))
      ).length
    : 0;

  const displayTitle = conversation?.type === 'group'
    ? (conversation.title || 'Group')
    : (otherParticipant?.name || 'Chat');

  const displayAvatar = conversation?.type === 'group'
    ? conversation.avatar_path
    : otherParticipant?.avatar_url;

  const typingIndicatorUsers = typingUsers[String(activeConversationId)] || [];
  const canSendMessage = canManageChat && (!!messageInput.trim() || !!pendingAttachment) && !sending;
  const isConversationEncrypted = Boolean(conversation?.encryption?.enabled && conversation?.encryption?.wrapped_key);
  const isConversationSecureMode = Boolean(encryptionConfig.enabled);

  const formatMessageTime = (dateStr: string) => {
    const date = new Date(dateStr);

    if (isToday(date)) {
      return format(date, 'HH:mm');
    }

    if (isYesterday(date)) {
      return `Yesterday ${format(date, 'HH:mm')}`;
    }

    return format(date, 'MMM d, HH:mm');
  };

  const scrollToMessage = (messageId: number) => {
    const target = messageRefs.current[String(messageId)];
    if (!target) {
      return;
    }

    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedMessageId(messageId);

    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }

    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedMessageId(null);
    }, 2200);
  };

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full bg-gradient-to-b from-orange-50/50 to-transparent dark:from-orange-950/20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center text-center p-8"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/40 dark:to-amber-900/40 flex items-center justify-center mb-4">
            <MessageSquare className="w-8 h-8 text-orange-500" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Your Messages</h2>
          <p className="text-sm text-muted-foreground mb-4">Select a conversation to start messaging</p>
          <Button
            variant="outline"
            className="rounded-xl gap-2 border-orange-200 dark:border-orange-800 hover:bg-orange-50 dark:hover:bg-orange-900/30"
            onClick={() => useChatStore.getState().setComposeOpen(true)}
          >
            <Plus className="h-4 w-4" />
            New Conversation
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <>
        <div className="flex flex-col h-full bg-card/20 dark:bg-card/10">
          <header className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-card/50 dark:bg-card/30">
            <div className="flex items-center gap-3">
              {isMobile && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setActiveConversation(null);
                    onBack?.();
                  }}
                  className="h-9 w-9 rounded-full"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}

              <div className="relative">
                <Avatar className="h-10 w-10 rounded-full ring-2 ring-orange-200 dark:ring-orange-700">
                  <AvatarImage src={displayAvatar || undefined} />
                  <AvatarFallback className="bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-400 font-bold">
                    {displayTitle?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                {conversation.type !== 'group' && isOnline && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-background" />
                )}
              </div>

              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-foreground text-sm">{displayTitle}</h2>
                  {isConversationEncrypted && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      <Lock className="h-3 w-3" />
                      E2E Encrypted
                    </span>
                  )}
                  {!isConversationEncrypted && isConversationSecureMode && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      <Lock className="h-3 w-3" />
                      E2E Ready
                    </span>
                  )}
                </div>
                <span className={cn(
                  "text-[11px] font-medium",
                  conversation.type === 'group'
                    ? "text-muted-foreground"
                    : (isOnline ? "text-emerald-500" : "text-muted-foreground")
                )}>
                  {conversation.type === 'group'
                    ? `${conversation.participants.length} members${onlineCount > 0 ? `, ${onlineCount} online` : ''}`
                    : (isOnline ? 'Online' : 'Offline')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-muted-foreground hover:bg-orange-100 dark:hover:bg-orange-900/30">
                    <Phone className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Voice Call</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-muted-foreground hover:bg-orange-100 dark:hover:bg-orange-900/30">
                    <Video className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Video Call</TooltipContent>
              </Tooltip>

              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-muted-foreground hover:bg-orange-100 dark:hover:bg-orange-900/30">
                <Info className="h-4 w-4" />
              </Button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <AnimatePresence>
              {conversationMessages.map((message) => {
                const isOwn = String(message.sender_id) === String(currentUser?.id);
                const attachment = message.metadata?.attachment || null;
                const replyTo = message.metadata?.reply_to || null;
                const trimmedBody = message.body?.trim() || '';
                const fallbackText = !trimmedBody && !attachment ? getChatMessageFallback(message.type) : '';

                return (
                  <motion.div
                    key={message.id}
                    ref={(node) => {
                      messageRefs.current[String(message.id)] = node;
                    }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "group flex gap-2 max-w-[88%]",
                      isOwn ? "ml-auto flex-row-reverse" : "mr-auto",
                      highlightedMessageId === message.id && "rounded-3xl ring-2 ring-orange-400/40"
                    )}
                  >
                    {!isOwn && (
                      <Avatar className="h-8 w-8 rounded-full shrink-0">
                        <AvatarImage src={message.sender?.avatar_url} />
                        <AvatarFallback className="text-[10px] bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-400 font-bold">
                          {message.sender?.name?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                    )}

                    <div className={cn("flex items-end gap-2", isOwn ? "flex-row-reverse" : "flex-row")}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setReplyingTo(message)}
                        disabled={!canManageChat}
                        className="h-7 w-7 shrink-0 rounded-full opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:bg-orange-100 hover:text-orange-500 dark:hover:bg-orange-900/30"
                      >
                        <Reply className="h-3.5 w-3.5" />
                      </Button>

                      <div className={cn("flex flex-col gap-0.5", isOwn ? "items-end" : "items-start")}>
                        <div className={cn(
                          "space-y-2 px-3 py-2 rounded-2xl text-sm",
                          isOwn
                            ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-br-sm"
                            : "bg-card dark:bg-card/60 text-foreground border border-border/30 rounded-bl-sm"
                        )}>
                          {replyTo && (
                            <button
                              type="button"
                              onClick={() => scrollToMessage(replyTo.id)}
                              className={cn(
                                "block w-full rounded-2xl border px-3 py-2 text-left",
                                isOwn ? "border-white/20 bg-white/10" : "border-orange-500/10 bg-orange-500/5"
                              )}
                            >
                              <span className={cn("block text-[11px] font-semibold", isOwn ? "text-white/80" : "text-orange-500")}>
                                Replying to {replyTo.sender?.name || 'Message'}
                              </span>
                              <span className={cn("mt-0.5 block truncate text-xs", isOwn ? "text-white/70" : "text-muted-foreground")}>
                                {getChatReplyPreview(replyTo)}
                              </span>
                            </button>
                          )}

                          {attachment && (
                            <AttachmentCard
                              attachment={attachment}
                              isOwn={isOwn}
                              actionLabel={canSaveAttachments ? 'Save to File Manager' : 'Download'}
                              onAction={() => {
                                void handleAttachmentAction(message, attachment);
                              }}
                            />
                          )}

                          {(trimmedBody || fallbackText) && (
                            <p className="whitespace-pre-wrap break-words">{trimmedBody || fallbackText}</p>
                          )}
                        </div>
                        <div className={cn(
                          "flex items-center gap-1.5 text-[10px] text-muted-foreground px-1",
                          isOwn ? "justify-end" : "justify-start"
                        )}>
                          <span>{formatMessageTime(message.created_at)}</span>
                          {isOwn && (
                            message.is_read
                              ? <CheckCheck className="h-3 w-3 text-emerald-500" />
                              : <Check className="h-3 w-3" />
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>

          <div className="px-4 h-6">
            {typingIndicatorUsers.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 text-[11px] text-orange-500 font-medium"
              >
                <div className="flex gap-1">
                  <span className="w-1 h-1 bg-orange-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1 h-1 bg-orange-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1 h-1 bg-orange-400 rounded-full animate-bounce" />
                </div>
                <span>
                  {typingIndicatorUsers.map((user) => user.name.split(' ')[0]).join(', ')} {typingIndicatorUsers.length > 1 ? 'are' : 'is'} typing...
                </span>
              </motion.div>
            )}
          </div>

          <div className="p-3 border-t border-border/30 bg-card/50 dark:bg-card/30">
            {replyingTo && (
              <div className="mb-2 flex items-start justify-between gap-3 rounded-2xl border border-orange-500/20 bg-orange-500/5 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-orange-500">
                    Replying to {replyingTo.sender?.name || 'Message'}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {getChatMessagePreview(replyingTo)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setReplyingTo(null)}
                  className="h-8 w-8 rounded-full text-muted-foreground hover:bg-orange-500/10 hover:text-orange-500"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {pendingAttachment && (
              <PendingAttachmentComposerCard
                attachment={pendingAttachment}
                onRemove={() => setPendingAttachment(null)}
              />
            )}

            <div className="flex items-center gap-2 p-2 bg-background/50 dark:bg-background/30 rounded-2xl border border-border/30">
              <Button
                type="button"
                onClick={() => setIsFileManagerOpen(true)}
                variant="ghost"
                size="icon"
                disabled={!canBrowseAttachments || !canManageChat}
                className="h-9 w-9 rounded-full shrink-0 text-muted-foreground hover:bg-orange-100 dark:hover:bg-orange-900/30"
              >
                <Paperclip className="h-4 w-4" />
              </Button>

              <input
                type="text"
                value={messageInput}
                onChange={(event) => setMessageInput(event.target.value)}
                disabled={!canManageChat}
                onKeyDown={(event) => {
                  if (canManageChat && event.key === 'Enter' && !event.shiftKey && (messageInput.trim() || pendingAttachment)) {
                    event.preventDefault();
                    void handleSendMessage();
                  }
                }}
                placeholder={
                  canManageChat
                    ? pendingAttachment
                      ? 'Add a caption or message...'
                      : (replyingTo ? 'Type your reply...' : 'Type a message...')
                    : 'Chat is read-only for your role'
                }
                className="flex-1 min-h-[36px] max-h-[100px] py-2 bg-transparent border-none focus:ring-0 text-sm"
              />

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={!canManageChat}
                    className="h-9 w-9 rounded-full shrink-0 text-muted-foreground hover:bg-orange-100 dark:hover:bg-orange-900/30"
                  >
                    <Smile className="h-4 w-4 text-amber-500" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[350px] p-0" align="end" sideOffset={8} onOpenAutoFocus={(event) => event.preventDefault()}>
                  <div className="h-[400px] overflow-hidden rounded-md border shadow-md">
                    <EmojiPicker
                      onEmojiClick={(data) => setMessageInput((current) => `${current}${data.emoji}`)}
                      width="100%"
                      height="100%"
                      lazyLoadEmojis={true}
                    />
                  </div>
                </PopoverContent>
              </Popover>

              <Button
                type="button"
                onClick={() => void handleSendMessage()}
                disabled={!canSendMessage}
                size="icon"
                className={cn(
                  "h-9 w-9 rounded-full transition-all",
                  canManageChat && (messageInput.trim() || pendingAttachment)
                    ? "bg-orange-500 text-white hover:bg-orange-600"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        <Dialog open={canBrowseAttachments && isFileManagerOpen} onOpenChange={setIsFileManagerOpen}>
          <DialogContent className="flex h-[85vh] w-[95vw] max-w-6xl flex-col gap-0 overflow-hidden rounded-[2.5rem] border-border/50 bg-background p-0 shadow-2xl z-[100]">
            <DialogTitle className="sr-only">Select Attachment</DialogTitle>
            <div className="z-10 flex shrink-0 items-center gap-4 border-b border-border/50 bg-card/60 px-8 py-5 backdrop-blur-xl">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-500/10 shadow-inner">
                <Paperclip className="h-6 w-6 text-orange-500" />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight text-foreground">Select Chat Attachment</h2>
                <p className="mt-0.5 text-xs font-medium text-muted-foreground">Choose a file from storage, add an optional message, and send both together.</p>
              </div>
            </div>
            <div className="file-picker-wrapper relative flex-1 overflow-hidden bg-muted/10 p-4 sm:p-6">
              <style
                dangerouslySetInnerHTML={{
                  __html: `
                    .file-picker-wrapper > div > div:nth-child(1), .file-picker-wrapper > div > div:nth-child(2) > div:nth-child(2) { display: none !important; }
                    .file-picker-wrapper > div { height: 100% !important; min-height: 100% !important; margin: 0 !important; }
                  `,
                }}
              />
              <FileManagerClient
                isPickerMode={true}
                onFileSelect={(file) => {
                  handleFileSelect(file);
                }}
                access={{ canRead: canBrowseAttachments, canManage: canSaveAttachments }}
              />
            </div>
          </DialogContent>
        </Dialog>
      </>
    </TooltipProvider>
  );
}
