"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useChatAccess } from '@/hooks/use-chat-access';
import { useChatStore } from '@/store/chat-store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  MessageSquare,
  Users,
  Settings,
  Bell,
  Plus,
  Video,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CommunicationBrandMark } from '@/components/communications/communication-workspace-header';

export default function ChatSidebar() {
  const { 
    activeTab, setActiveTab, 
    setComposeOpen, setVideoMeetingOpen, counts
  } = useChatStore();
  const { canManageChat, hasChatWorkspace } = useChatAccess();
  
  const [user, setUser] = useState<{ name?: string; avatar_url?: string } | null>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('hive_user') || localStorage.getItem('user');
    if (userStr) {
      try { setUser(JSON.parse(userStr)); } catch (e) {}
    }
  }, []);

  const navItems = [
    { id: 'recent', label: 'All chats', icon: MessageSquare, badge: counts.unread },
    { id: 'groups', label: 'Group chats', icon: Users },
  ];

  return (
    <TooltipProvider>
    <div className="flex size-full flex-col border-r border-border/60 bg-card/70 backdrop-blur-xl">
      <div className="flex flex-col items-center gap-2 p-2">
        <Link href="/dashboard" className="mb-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-border/60 bg-background/70 p-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:justify-start">
          <CommunicationBrandMark compact />
          <span className="hidden truncate text-sm font-bold text-foreground lg:inline">Communications</span>
        </Link>

        {navItems.map((item) => {
          const badge = item.badge ?? 0;

          return (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              aria-label={item.label}
              aria-pressed={activeTab === item.id}
              className={cn(
                "relative min-h-10 w-full justify-center rounded-xl px-2 lg:justify-start",
                activeTab === item.id 
                  ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                  : "text-muted-foreground"
              )}
              onClick={() => setActiveTab(item.id as 'recent' | 'groups')}
            >
              <item.icon aria-hidden="true" data-icon="inline-start" />
              <span className="hidden lg:inline">{item.label}</span>
              {badge > 0 && (
                <Badge className="absolute -right-1 -top-1 min-w-5 px-1 text-[11px] lg:static lg:ml-auto">
                  {badge > 9 ? '9+' : badge}
                </Badge>
              )}
            </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="lg:hidden">{item.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      <div className="flex-1" />

      <div className="flex flex-col items-center gap-2 p-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="default"
              size="sm"
              aria-label="Create a video meeting"
              disabled={!hasChatWorkspace}
              className="min-h-11 w-full justify-center rounded-xl px-2 lg:justify-start"
              onClick={() => setVideoMeetingOpen(true)}
            >
              <Video aria-hidden="true" data-icon="inline-start" />
              <span className="hidden lg:inline">New video meeting</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="lg:hidden">New video meeting</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              aria-label="Start a new conversation"
              disabled={!canManageChat}
              className="min-h-10 w-full justify-center rounded-xl border-dashed px-2 text-primary lg:justify-start"
              onClick={() => setComposeOpen(true)}
            >
              <Plus aria-hidden="true" data-icon="inline-start" />
              <span className="hidden lg:inline">New chat</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="lg:hidden">New chat</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button asChild variant="ghost" size="sm" className="min-h-10 w-full justify-center px-2 text-muted-foreground lg:justify-start">
              <Link href="/dashboard/alerts" aria-label="Open alerts">
                <Bell aria-hidden="true" data-icon="inline-start" />
                <span className="hidden lg:inline">Alerts</span>
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="lg:hidden">Alerts</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button asChild variant="ghost" size="sm" className="min-h-10 w-full justify-center px-2 text-muted-foreground lg:justify-start">
              <Link href="/dashboard/settings/branding" aria-label="Open branding settings">
                <Settings aria-hidden="true" data-icon="inline-start" />
                <span className="hidden lg:inline">Brand settings</span>
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="lg:hidden">Brand settings</TooltipContent>
        </Tooltip>

        <div className="mt-2 flex w-full items-center justify-center gap-2 lg:justify-start">
          <Avatar className="size-9 rounded-xl ring-2 ring-primary/25">
            <AvatarImage src={user?.avatar_url} />
            <AvatarFallback className="bg-primary/10 text-sm font-bold text-primary">
              {user?.name?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>
          <span className="hidden min-w-0 truncate text-xs font-semibold text-foreground lg:inline">{user?.name || 'Signed-in user'}</span>
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
}
