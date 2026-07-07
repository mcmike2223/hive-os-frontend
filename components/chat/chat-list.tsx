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
import { Search, MoreVertical, Loader2, Plus, Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
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
    <div className="flex flex-col h-full bg-card/30 dark:bg-card/20">
      {/* Header */}
      <div className="p-3 border-b border-border/20">
        <h2 className="text-lg font-bold text-foreground mb-2">Messages</h2>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search conversations..."
            className="pl-9 h-9 bg-background/50 border-border/50 rounded-lg text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
          </div>
        ) : displayConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mb-3">
              <Search className="h-6 w-6 text-orange-500" />
            </div>
            <p className="text-sm text-muted-foreground">No conversations yet</p>
            <Button 
              variant="outline" 
              size="sm" 
              disabled={!canManageChat}
              className="mt-3 rounded-lg"
              onClick={() => useChatStore.getState().setComposeOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Start Chat
            </Button>
          </div>
        ) : (
          <div className="p-2 space-y-1">
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
                <div
                  key={conv.id}
                  className={cn(
                    "flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all duration-200",
                    isActive 
                      ? "bg-orange-100 dark:bg-orange-900/40" 
                      : "hover:bg-orange-50 dark:hover:bg-orange-900/20"
                  )}
                  onClick={() => handleSelect(conv.id)}
                >
                  <div className="relative shrink-0">
                    <Avatar className={cn(
                      "h-10 w-10 rounded-full",
                      conv.type === 'group' && "ring-2 ring-orange-200 dark:ring-orange-700"
                    )}>
                      <AvatarImage src={displayAvatar || undefined} />
                      <AvatarFallback className="bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-400 font-bold text-sm">
                        {displayTitle?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    {conv.type !== 'group' && other && isOnline && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-background" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <span className={cn(
                        "flex items-center gap-1.5 text-sm truncate",
                        hasUnread ? "font-bold text-foreground" : "font-medium text-foreground/80"
                      )}>
                        {isEncrypted && <Lock className="h-3.5 w-3.5 shrink-0 text-emerald-500" />}
                        {!isEncrypted && isSecureMode && <Lock className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
                        <span className="truncate">{displayTitle}</span>
                      </span>
                      <span className={cn(
                        "text-[11px] shrink-0 ml-2",
                        hasUnread ? "text-orange-500 font-semibold" : "text-muted-foreground"
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
                        <span className="h-5 min-w-[18px] px-1.5 flex items-center justify-center rounded-full bg-orange-500 text-[10px] font-black text-white">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
