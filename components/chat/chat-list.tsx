"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useChatAccess } from '@/hooks/use-chat-access';
import { decryptChatConversation, decryptChatConversations, decryptChatMessages } from '@/lib/chat-e2ee';
import { getChatMessagePreview, getStoredChatUser } from '@/lib/chat-utils';
import { useChatStore, type ChatConversation } from '@/store/chat-store';
import { cn } from '@/lib/utils';
import { isToday, isYesterday, format } from 'date-fns';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Search, Loader2, Plus, Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface ChatListProps {
  onConversationSelect?: () => void;
}

export default function ChatList({ onConversationSelect }: ChatListProps) {
  const { 
    conversations, activeConversationId, setActiveConversation, 
    setConversations,
    searchQuery, setSearchQuery, setMessages,
    activeTab, onlineUsers, encryptionConfig
  } = useChatStore();
  const { canManageChat } = useChatAccess();

  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: number; name?: string } | null>(null);

  useEffect(() => {
    setCurrentUser(getStoredChatUser());
  }, []);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const url = activeTab === 'groups' ? '/chat/conversations?type=group' : '/chat/conversations';
      const { data } = await api.get(url);
      const decryptedConversations = await decryptChatConversations(data.data || data);
      setConversations(decryptedConversations);
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
    } finally {
      setLoading(false);
    }
  }, [
    activeTab,
    setConversations,
    encryptionConfig.enabled,
    encryptionConfig.public_key,
    encryptionConfig.fingerprint,
  ]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handleSelect = async (id: number) => {
    setActiveConversation(id);
    try {
      const activeConversation = conversations.find((conversation) => String(conversation.id) === String(id));
      const { data } = await api.get(`/chat/conversations/${id}/messages`);
      const resolvedConversation = activeConversation
        ? await decryptChatConversation(activeConversation)
        : activeConversation;
      const decryptedMessages = resolvedConversation
        ? await decryptChatMessages(data.data || data, resolvedConversation)
        : (data.data || data);
      setMessages(decryptedMessages);
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    }
  };

  const displayConversations = conversations.filter(c => {
    const matchesTab = activeTab === 'groups' ? c.type === 'group' : true;
    const otherParticipant = c.type === 'group'
      ? null
      : c.participants.find((participant) => String(participant.id) !== String(currentUser?.id));

    const title = c.type === 'group' ? (c.title || 'Group') : (otherParticipant?.name || 'Chat');
    const messagePreview = getChatMessagePreview(c.last_message);
    const matchesSearch = !searchQuery.trim()
      || title.toLowerCase().includes(searchQuery.trim().toLowerCase())
      || messagePreview.toLowerCase().includes(searchQuery.trim().toLowerCase());

    return matchesTab && matchesSearch;
  });

  const getOtherParticipant = (conv: ChatConversation) => {
    if (conv.type === 'group') return null;
    return conv.participants.find((p) => p.id !== currentUser?.id);
  };

  const formatMessageTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isToday(date)) return format(date, 'HH:mm');
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMM d');
  };

  return (
    <div className="flex h-full flex-col bg-card/30">
      <div className="flex flex-col gap-2 border-b border-border/60 p-3">
        <h2 className="text-lg font-bold text-foreground">Conversations</h2>
        <label htmlFor="chat-conversation-search" className="text-xs font-medium text-muted-foreground">
          Search conversations
        </label>
        <div className="relative">
          <Search aria-hidden="true" className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input 
            id="chat-conversation-search"
            placeholder="Search conversations..."
            className="h-9 rounded-lg border-border/60 bg-background/70 pl-9 text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-8" role="status">
            <Loader2 aria-hidden="true" className="size-6 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Loading conversations</span>
          </div>
        ) : displayConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-primary/10">
              <Search aria-hidden="true" className="size-6 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground">No conversations yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Start a chat with someone in your workspace.</p>
            <Button 
              variant="outline" 
              size="sm" 
              disabled={!canManageChat}
              className="mt-3 rounded-lg"
              onClick={() => useChatStore.getState().setComposeOpen(true)}
            >
              <Plus aria-hidden="true" data-icon="inline-start" />
              Start Chat
            </Button>
          </div>
        ) : (
          <ul className="flex flex-col gap-1 p-2" aria-label="Chat conversations">
            {displayConversations.map((conv) => {
              const other = getOtherParticipant(conv);
               const displayTitle = conv.type === 'group' ? (conv.title || 'Group') : (other?.name || 'Chat');
               const displayAvatar = conv.type === 'group' ? conv.avatar_path : other?.avatar_url;
               const isActive = activeConversationId === conv.id;
               const hasUnread = (conv.unread_count || 0) > 0;
               const isSecureMode = Boolean(encryptionConfig.enabled);
               const isEncrypted = Boolean(conv.encryption?.enabled && conv.encryption?.wrapped_key);
               const isOnline = other
                 ? onlineUsers.some((onlineUser) => String(onlineUser.id) === String(other.id))
                 : false;
              
              return (
                <li key={conv.id}>
                <button
                  type="button"
                  aria-current={isActive ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isActive 
                      ? "bg-primary/10 ring-1 ring-primary/20"
                      : "hover:bg-accent/60"
                  )}
                  onClick={() => handleSelect(conv.id)}
                >
                  <div className="relative shrink-0">
                    <Avatar className={cn(
                      "size-10 rounded-full",
                      conv.type === 'group' && "ring-2 ring-primary/25"
                    )}>
                      <AvatarImage src={displayAvatar || undefined} />
                      <AvatarFallback className="bg-primary/10 text-sm font-bold text-primary">
                        {displayTitle?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    {conv.type !== 'group' && other && isOnline && (
                      <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-background bg-primary">
                        <span className="sr-only">Online</span>
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <span className={cn(
                        "flex items-center gap-1.5 text-sm truncate",
                        hasUnread ? "font-bold text-foreground" : "font-medium text-foreground/80"
                      )}>
                        {isEncrypted && <Lock aria-label="End-to-end encrypted" className="size-3.5 shrink-0 text-primary" />}
                        {!isEncrypted && isSecureMode && <Lock aria-label="Encryption ready" className="size-3.5 shrink-0 text-muted-foreground" />}
                        <span className="truncate">{displayTitle}</span>
                      </span>
                      <span className={cn(
                        "text-[11px] shrink-0 ml-2",
                        hasUnread ? "font-semibold text-primary" : "text-muted-foreground"
                      )}>
                        {formatMessageTime(conv.updated_at || conv.last_message?.created_at)}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className={cn(
                        "text-xs truncate",
                        hasUnread ? "font-semibold text-foreground/70" : "text-muted-foreground"
                      )}>
                        {getChatMessagePreview(conv.last_message)}
                      </p>
                      
                      {hasUnread && (
                        <span className="flex h-5 min-w-[18px] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-black text-primary-foreground" aria-label={`${conv.unread_count} unread messages`}>
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
