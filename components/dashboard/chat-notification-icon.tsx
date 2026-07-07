"use client";

import React, { useEffect, useState } from 'react';
import { useChatAccess } from '@/hooks/use-chat-access';
import { decryptChatConversation, decryptChatConversations, decryptChatMessages } from '@/lib/chat-e2ee';
import { getChatConversationTitle, getChatMessagePreview, getStoredChatUser } from '@/lib/chat-utils';
import { useChatStore, type ChatConversation } from '@/store/chat-store';
import { MessageSquare, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export function ChatNotificationIcon() {
  const router = useRouter();
  const { counts, conversations, setActiveConversation, setMessages, setConversations, setCounts } = useChatStore();
  const { isLoaded, hasChatWorkspace } = useChatAccess();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  useEffect(() => {
    const parsedUser = getStoredChatUser<{ id?: number }>();
    setCurrentUserId(parsedUser?.id ? Number(parsedUser.id) : null);
  }, []);

  // Fetch conversations when dropdown opens
  useEffect(() => {
    if (isOpen && hasChatWorkspace) {
      const fetchConversations = async () => {
        setIsLoading(true);
        try {
          const { data } = await api.get('/chat/conversations');
          const convs = await decryptChatConversations(data.data || data);
          setConversations(convs);
          
          // Calculate unread from fetched conversations
          const unread = convs.reduce((acc: number, c: ChatConversation) => acc + (c.unread_count || 0), 0);
          setCounts({ total: convs.length, unread });
        } catch (err) {
          console.error('Failed to fetch conversations:', err);
        } finally {
          setIsLoading(false);
        }
      };
      fetchConversations();
    }
  }, [hasChatWorkspace, isOpen, setConversations, setCounts]);

  if (!isLoaded || !hasChatWorkspace) {
    return null;
  }

  const recentConversations = conversations
    .filter(c => (c.unread_count || 0) > 0)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 5);

  const handleConversationClick = async (convId: number) => {
    setIsOpen(false);
    setActiveConversation(convId);
    
    try {
      const conversation = conversations.find((item) => String(item.id) === String(convId));
      const { data } = await api.get(`/chat/conversations/${convId}/messages`);
      const decryptedMessages = conversation
        ? await decryptChatMessages(data.data || data, await decryptChatConversation(conversation))
        : (data.data || data);
      setMessages(decryptedMessages);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
    
    router.push('/dashboard/chat');
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-10 w-10 rounded-xl p-0 shrink-0 text-muted-foreground hover:text-foreground"
        >
          <MessageSquare className="h-5 w-5" />
          {counts.unread > 0 && (
            <span className="absolute -top-1 -right-1 flex min-w-[18px] h-[18px] items-center justify-center rounded-full px-1 text-[10px] font-black text-white bg-orange-500 shadow-sm animate-pulse">
              {counts.unread > 99 ? '99+' : counts.unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0 rounded-2xl shadow-xl z-[100] border-border/60">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="font-bold text-sm">Messages</span>
          <span className="text-xs font-semibold text-orange-500">
            {counts.unread} unread
          </span>
        </div>

        <div className="max-h-[300px] overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : recentConversations.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              No unread messages
            </div>
          ) : (
            recentConversations.map((conv) => (
              <DropdownMenuItem
                key={conv.id}
                onClick={() => handleConversationClick(conv.id)}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center shrink-0">
                  <span className="text-orange-600 dark:text-orange-400 font-bold">
                    {conv.title?.charAt(0) || conv.participants?.[0]?.name?.charAt(0) || 'C'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                      <span className="font-medium text-sm truncate">
                        {getChatConversationTitle(conv, currentUserId)}
                      </span>
                    {conv.unread_count && conv.unread_count > 0 && (
                      <span className="h-5 min-w-[18px] px-1.5 flex items-center justify-center rounded-full bg-orange-500 text-[10px] font-black text-white shrink-0">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {getChatMessagePreview(conv.last_message) || 'No messages'}
                  </p>
                </div>
              </DropdownMenuItem>
            ))
          )}
        </div>

        <div 
          className="px-4 py-3 border-t text-xs text-center text-orange-500 font-medium cursor-pointer hover:bg-orange-50 dark:hover:bg-orange-900/20"
          onClick={() => {
            setIsOpen(false);
            router.push('/dashboard/chat');
          }}
        >
          Open Chat
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
