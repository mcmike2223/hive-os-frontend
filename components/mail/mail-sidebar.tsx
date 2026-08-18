"use client";

import React, { useEffect, useState } from 'react';
import { useMailStore, MailFolder, MailOnlineUser } from '@/store/mail-store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PlusCircle, Inbox, Send, Archive, Trash2, Star, Edit, Zap, Users, Tag, HardDrive } from 'lucide-react';
import api from '@/lib/api';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';

const navItems = [
  { icon: Inbox, label: 'Inbox', id: 'inbox', countKey: 'inbox_unread' as const },
  { icon: Send, label: 'Sent', id: 'sent', countKey: 'sent' as const },
  { icon: Edit, label: 'Drafts', id: 'drafts', countKey: 'drafts' as const },
  { icon: Zap, label: 'Spam', id: 'spam', countKey: 'spam' as const },
  { icon: Tag, label: 'Important', id: 'important', countKey: 'important' as const },
  { icon: Trash2, label: 'Trash', id: 'trash', countKey: 'trash' as const },
  { icon: Archive, label: 'Archive', id: 'archive', countKey: 'archive' as const },
  { icon: Star, label: 'Starred', id: 'starred', countKey: 'starred' as const },
];

export default function MailSidebar() {
  const { activeFolder, setActiveFolder, setComposeOpen, counts, setCounts, onlineUsers } = useMailStore();
  const [user, setUser] = useState<MailOnlineUser | null>(null);

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0 || !bytes) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const fetchCounts = async () => {
    try {
      const { data } = await api.get('/mail/counts');
      setCounts(data);
    } catch (err) {
      console.error("Failed to fetch counts:", err);
    }
  };

  useEffect(() => {
    fetchCounts();
    const userStr = localStorage.getItem('hive_user') || localStorage.getItem('user');
    if (userStr) {
      try { setUser(JSON.parse(userStr) as MailOnlineUser); } catch { /* ignore invalid stored user */ }
    }
    const interval = setInterval(fetchCounts, 60000);
    return () => clearInterval(interval);
  }, [setCounts]);

  return (
    <div className="w-full h-full flex flex-col pt-6 pb-4 bg-transparent overflow-hidden relative">
      <div className="px-6 mb-6 shrink-0">
        <Button 
          onClick={() => setComposeOpen(true)} 
          className="w-full h-12 gap-2 shadow-md shadow-emerald-500/20 font-bold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-emerald-500/30 text-[15px]"
        >
          <PlusCircle className="w-5 h-5" />
          Compose Mail
        </Button>
      </div>
 

      <div className="px-6 text-xs font-bold text-muted-foreground tracking-wider mb-2">
        MAILS
      </div>

      <nav className="flex flex-col gap-1 w-full px-3 flex-1 overflow-y-auto scrollbar-thin overscroll-none border-b border-transparent">
        <Button
           variant={activeFolder === 'all' ? "secondary" : "ghost"}
           className={cn(
             "justify-between w-full h-11 transition-all duration-200 px-3 mb-2 rounded-xl group",
             activeFolder === 'all' 
               ? "bg-white dark:bg-muted shadow-sm text-foreground font-semibold" 
               : "hover:bg-white/60 dark:hover:bg-muted/50 text-muted-foreground font-medium hover:scale-[1.02]"
           )}
           onClick={() => setActiveFolder('all')}
        >
           <div className="flex items-center gap-4">
              <Inbox className={cn("w-[18px] h-[18px]", activeFolder === 'all' ? "text-primary opacity-100" : "opacity-70")} />
              <span>All Mails</span>
           </div>
        </Button>

        {navItems.map((item) => {
          const count = counts[item.countKey as keyof typeof counts] || 0;
          const isActive = activeFolder === item.id;
          return (
            <Button
              key={item.id}
              variant={isActive ? "secondary" : "ghost"}
              className={cn(
                "justify-between w-full h-11 transition-all duration-200 font-medium px-3 rounded-xl group",
                isActive 
                  ? "bg-white dark:bg-muted shadow-sm text-foreground font-semibold" 
                  : "hover:bg-white/60 dark:hover:bg-muted/50 text-muted-foreground hover:scale-[1.02]"
              )}
              onClick={() => setActiveFolder(item.id as MailFolder)}
            >
              <div className="flex items-center gap-4">
                <item.icon className="w-[18px] h-[18px] opacity-70" />
                {item.label}
              </div>
              {count > 0 && (
                <span className={cn(
                  "flex h-5 items-center justify-center rounded-full px-2 text-xs font-bold",
                  item.id === 'starred' ? "bg-amber-50 text-amber-600" :
                  item.id === 'inbox' ? "bg-purple-50 text-purple-600" :
                  item.id === 'sent' ? "bg-blue-50 text-blue-600" :
                  item.id === 'drafts' ? "bg-slate-100 text-slate-600" :
                  item.id === 'spam' ? "bg-red-50 text-red-600" :
                  item.id === 'important' ? "bg-rose-50 text-rose-600" :
                  item.id === 'trash' ? "bg-zinc-100 text-zinc-600" :
                  item.id === 'archive' ? "bg-teal-50 text-teal-600" :
                  "bg-muted/50 text-foreground/50"
                )}>
                  {count}
                </span>
              )}
            </Button>
          )
        })}
      </nav>

      {/* 🟢 ACTIVE PERSONNEL — always shown while mailbox is open */}
      <div className="mt-auto pt-4 px-4 shrink-0 border-t border-muted/50">
        {/* Header */}
        <div className="px-1 mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] font-black text-emerald-500 tracking-wider">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            ACTIVE PERSONNEL
          </div>
          <span className="text-[11px] font-bold bg-emerald-500/10 text-emerald-600 rounded-full px-2 py-0.5">
            {onlineUsers.length} online
          </span>
        </div>

        <div className="flex flex-col gap-1 max-h-[160px] overflow-y-auto scrollbar-thin overscroll-none px-1 pb-1">
          {/* Current user — always top */}
          {user && (
            <div className="flex items-center gap-2.5 p-1.5 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
              <div className="relative shrink-0">
                <Avatar className="h-7 w-7 ring-2 ring-emerald-500/40">
                  <AvatarImage src={user.avatar_url} />
                  <AvatarFallback className="text-[11px] bg-emerald-100 text-emerald-700 font-bold">
                    {user.name?.charAt(0) || 'Y'}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 rounded-full border-2 border-background" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-bold text-foreground truncate block">{user.name}</span>
                <span className="text-[11px] text-emerald-500 font-semibold">You · Viewing now</span>
              </div>
            </div>
          )}

          {/* Other online users */}
          {onlineUsers.filter(u => u.id !== user?.id).length > 0
            ? onlineUsers.filter(u => u.id !== user?.id).map((u, i) => (
              <div key={`${u.id}-${i}`} className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-white/60 dark:hover:bg-muted/50 transition-all hover:scale-[1.015] cursor-pointer group">
                <div className="relative shrink-0">
                  <Avatar className="h-7 w-7 border-2 border-transparent group-hover:border-emerald-500/30 transition-colors">
                    <AvatarImage src={u.avatar_url} />
                    <AvatarFallback className="text-[11px] bg-emerald-100 text-emerald-700">{u.name?.charAt(0) || 'U'}</AvatarFallback>
                  </Avatar>
                  <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 rounded-full border-2 border-background shadow-sm" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors truncate block">{u.name}</span>
                  <span className="text-[11px] text-emerald-500/70">Viewing mailbox</span>
                </div>
              </div>
            ))
            : (
              <p className="px-1 py-1.5 text-[11px] text-muted-foreground/50 italic flex items-center gap-1.5">
                <Users className="h-3 w-3 shrink-0" />
                Only you are viewing the mailbox right now
              </p>
            )
          }
        </div>
      </div>

      {/* 💾 MAILBOX STORAGE QUOTA Tracker */}
      <div className="mt-4 pt-4 pb-2 px-4 shrink-0 border-t border-muted/50">
        <div className="flex items-center justify-between text-[11px] font-black tracking-widest text-muted-foreground uppercase mb-3 px-1">
          <span className="flex items-center gap-1.5"><HardDrive className="h-3 w-3 text-primary/70" /> Storage</span>
          <span className="text-primary font-bold">{formatBytes(counts?.storage_used || 0)} <span className="text-muted-foreground/40 font-medium">/</span> {formatBytes(counts?.storage_limit || 0)}</span>
        </div>
        <div className="px-1">
          <Progress 
             value={((counts?.storage_used || 0) / (counts?.storage_limit || 1)) * 100} 
             className={cn("h-2 bg-muted/50 shadow-inner", ((counts?.storage_used || 0) / (counts?.storage_limit || 1)) * 100 > 85 && "text-rose-500 bg-rose-500/20 [&>div]:bg-rose-500")} 
          />
        </div>
      </div>
    </div>
  );
}
