"use client";

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useChatStore } from '@/store/chat-store';
import ChatSidebar from './chat-sidebar';
import ChatList from './chat-list';
import ChatDetail from './chat-detail';
import ComposeChatModal from './compose-chat-modal';

export default function ChatLayout() {
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const isFullscreen = useChatStore((state) => state.isFullscreen);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setMounted(true);

    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!mounted) {
    return null;
  }

  const showSidebar = !isMobile || (isMobile && !activeConversationId);
  const showList = !isMobile || (isMobile && !activeConversationId);
  const showDetail = !isMobile || (isMobile && Boolean(activeConversationId));

  return (
    <div
      className={cn(
        "relative flex size-full overflow-hidden bg-background/40",
        isFullscreen && "fixed inset-0 z-[100] h-[100dvh] w-screen rounded-none bg-background"
      )}
    >
      {showSidebar && (
        <aside aria-label="Chat navigation" className={cn("h-full shrink-0", isMobile ? "w-16" : "w-16 lg:w-48")}>
          <ChatSidebar />
        </aside>
      )}

      {showList && (
        <aside aria-label="Conversations" className={cn("h-full shrink-0 border-r border-border/60", isMobile ? "min-w-0 flex-1" : "w-72 xl:w-80")}>
          <ChatList />
        </aside>
      )}

      {showDetail && (
        <main className="h-full min-w-0 flex-1">
          <ChatDetail />
        </main>
      )}

      <ComposeChatModal />
    </div>
  );
}
