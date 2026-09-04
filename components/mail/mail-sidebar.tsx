"use client";

import React, { useEffect, useState } from 'react';
import { useMailStore, MailFolder, MailOnlineUser } from '@/store/mail-store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PlusCircle, Inbox, Send, Archive, Trash2, Star, Edit, Zap, Users, Tag, HardDrive } from 'lucide-react';
import api from '@/lib/api';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
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
    <div className="relative flex size-full flex-col overflow-hidden bg-transparent pb-4 pt-5">
      <div className="mb-5 shrink-0 px-5">
        <Button
          onClick={() => setComposeOpen(true)}
          className="h-11 w-full rounded-xl font-bold shadow-sm"
        >
          <PlusCircle aria-hidden="true" data-icon="inline-start" />
          Compose Mail
        </Button>
      </div>


      <h2 className="mb-2 px-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Mailboxes</h2>

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
              <Inbox aria-hidden="true" data-icon="inline-start" className={cn(activeFolder === 'all' ? "text-primary opacity-100" : "opacity-70")} />
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
                <item.icon aria-hidden="true" data-icon="inline-start" className="opacity-70" />
                {item.label}
              </div>
              {count > 0 && (
                <Badge variant={isActive ? "default" : "secondary"} aria-label={`${count} messages`}>
                  {count}
                </Badge>
              )}
            </Button>
          )
        })}
      </nav>

      <div className="mt-auto pt-4 px-4 shrink-0 border-t border-muted/50">
        <div className="px-1 mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] font-black text-primary tracking-wider">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex size-full rounded-full bg-primary opacity-60 motion-safe:animate-ping" />
              <span className="relative inline-flex size-2 rounded-full bg-primary" />
            </span>
            ACTIVE PERSONNEL
          </div>
          <Badge variant="secondary" className="text-[11px]">
            {onlineUsers.length} online
          </Badge>
        </div>

        <div className="flex flex-col gap-1 max-h-[160px] overflow-y-auto scrollbar-thin overscroll-none px-1 pb-1">
          {/* Current user — always top */}
          {user && (
            <div className="flex items-center gap-2.5 rounded-xl border border-primary/15 bg-primary/5 p-1.5">
              <div className="relative shrink-0">
                <Avatar className="size-7 ring-2 ring-primary/30">
                  <AvatarImage src={user.avatar_url} />
                  <AvatarFallback className="bg-primary/10 text-[11px] font-bold text-primary">
                    {user.name?.charAt(0) || 'Y'}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 rounded-full border-2 border-background" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-bold text-foreground truncate block">{user.name}</span>
                <span className="text-[11px] font-semibold text-primary">You · Viewing now</span>
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

      <div className="mt-4 pt-4 pb-2 px-4 shrink-0 border-t border-muted/50">
        <div className="flex items-center justify-between text-[11px] font-black tracking-widest text-muted-foreground uppercase mb-3 px-1">
          <span className="flex items-center gap-1.5"><HardDrive className="h-3 w-3 text-primary/70" /> Storage</span>
          <span className="text-primary font-bold">{formatBytes(counts?.storage_used || 0)} <span className="text-muted-foreground/40 font-medium">/</span> {formatBytes(counts?.storage_limit || 0)}</span>
        </div>
        <div className="px-1">
          <Progress
             value={((counts?.storage_used || 0) / (counts?.storage_limit || 1)) * 100}
             className={cn("h-2 bg-muted/50 shadow-inner", ((counts?.storage_used || 0) / (counts?.storage_limit || 1)) * 100 > 85 && "[&>div]:bg-destructive")}
          />
        </div>
      </div>
    </div>
  );
}
