"use client";

import React, { useEffect, useState } from 'react';
import { useChatAccess } from '@/hooks/use-chat-access';
import { useChatStore } from '@/store/chat-store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  MessageSquare, 
  Users, 
  UserCircle, 
  Settings, 
  Bell, 
  Plus,
  Compass,
  LayoutGrid
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export default function ChatSidebar() {
  const { 
    activeTab, setActiveTab, 
    setComposeOpen, counts 
  } = useChatStore();
  const { canManageChat } = useChatAccess();
  
  const [user, setUser] = useState<{ name?: string; avatar_url?: string } | null>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('hive_user') || localStorage.getItem('user');
    if (userStr) {
      try { setUser(JSON.parse(userStr)); } catch (e) {}
    }
  }, []);

  const navItems = [
    { id: 'recent', label: 'All', icon: MessageSquare, badge: counts.unread },
    { id: 'groups', label: 'Groups', icon: Users },
  ];

  return (
    <div className="flex flex-col h-full w-full bg-card/50 dark:bg-card/30 backdrop-blur-sm border-r border-border/30">
      <div className="flex flex-col items-center gap-2 p-2">
        {/* Logo */}
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/20 mb-2">
          <span className="text-white font-black text-lg">H</span>
        </div>

        {/* Nav Items */}
        {navItems.map((item) => {
          const badge = item.badge ?? 0;

          return (
            <Button
              key={item.id}
              variant="ghost"
              size="icon"
              className={cn(
                "h-10 w-10 rounded-xl transition-all duration-200",
                activeTab === item.id 
                  ? "bg-orange-500 text-white shadow-lg shadow-orange-500/30" 
                  : "text-muted-foreground hover:bg-orange-100 dark:hover:bg-orange-900/30 hover:text-orange-600 dark:hover:text-orange-400"
              )}
              onClick={() => setActiveTab(item.id as 'recent' | 'groups')}
            >
              <item.icon className="h-5 w-5" />
              {badge > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[11px] font-black text-white">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </Button>
          );
        })}
      </div>

      <div className="flex-1" />

      {/* Bottom Actions */}
      <div className="flex flex-col items-center gap-2 p-2">
        <Button
          variant="outline"
          size="icon"
          disabled={!canManageChat}
          className="h-10 w-10 rounded-xl border-dashed border-2 border-orange-200 dark:border-orange-800 hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/30 transition-all"
          onClick={() => setComposeOpen(true)}
        >
          <Plus className="h-5 w-5 text-orange-500" />
        </Button>

        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg text-muted-foreground hover:bg-orange-100 dark:hover:bg-orange-900/30">
          <Bell className="h-4 w-4" />
        </Button>

        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg text-muted-foreground hover:bg-orange-100 dark:hover:bg-orange-900/30">
          <Settings className="h-4 w-4" />
        </Button>

        <div className="mt-2">
          <Avatar className="h-9 w-9 rounded-xl ring-2 ring-orange-200 dark:ring-orange-700">
            <AvatarImage src={user?.avatar_url} />
            <AvatarFallback className="bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-400 font-bold text-sm">
              {user?.name?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </div>
  );
}
