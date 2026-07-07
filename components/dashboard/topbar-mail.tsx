"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Check, Circle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getAccessToken, getBackendApiRoot, getTenantHeaders, isTenantSession } from "@/lib/runtime-context";
import { toast } from "sonner";
import { useMailStore, type MailParticipant } from "@/store/mail-store";
import { formatDistanceToNow } from "date-fns";
import api from "@/lib/api";
import { decryptMailParticipants, ensureMailEncryptionIdentity, fetchMailEncryptionConfig, getEncryptedMailBodyFallback } from "@/lib/mail-e2ee";

type ActiveMailUser = { id?: number | string | null };

export function TopbarMailIcon({ activeUser }: { activeUser: ActiveMailUser | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { selectMail, setActiveFolder } = useMailStore();
  const [isOpen, setIsOpen] = useState(false);

  const getApiUrl = () => {
    return getBackendApiRoot();
  };

  const getTenantAwareEndpoint = (path: string) => {
    const base = getApiUrl();
    return `${base}${path}`;
  };

  const { data: unreadMailData } = useQuery({
    queryKey: ['unreadMailCount'],
    queryFn: async () => {
        const token = getAccessToken() || localStorage.getItem('token');
        if (!token) throw new Error("No token");
        const res = await fetch(getTenantAwareEndpoint('/mail/unread-count'), {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json', ...getTenantHeaders() } as Record<string, string>
        });
        if (!res.ok) throw new Error("Failed to fetch count");
        return res.json();
    },
    enabled: !!activeUser?.id,
  });

  const { data: recentMailsData, isLoading: isLoadingRecent } = useQuery({
    queryKey: ['recentMails'],
    queryFn: async () => {
        const encryptionConfig = await fetchMailEncryptionConfig();
        await ensureMailEncryptionIdentity(encryptionConfig);

        const { data } = await api.get('/mail?folder=inbox');
        const decryptedMails = await decryptMailParticipants(data.data || []);

        return { data: decryptedMails };
    },
    enabled: !!activeUser?.id && isOpen, // Only fetch when dropdown is open
  });

  const unreadCount = unreadMailData?.count || 0;
  const recentMails = recentMailsData?.data?.slice(0, 5) || [];

  const handleMailClick = (id: number, isRead: boolean) => {
    setActiveFolder('inbox');
    selectMail(id);
    if (!isRead) {
      api.put(`/mail/${id}`, { is_read: true }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['unreadMailCount'] });
        queryClient.invalidateQueries({ queryKey: ['recentMails'] });
      }).catch(() => {});
    }
    setIsOpen(false);
    router.push("/dashboard/mail");
  };

  const toggleReadStatus = async (e: React.MouseEvent, id: number, currentStatus: boolean) => {
    e.stopPropagation(); // prevent opening the mail
    try {
      await api.put(`/mail/${id}`, { is_read: !currentStatus });
      queryClient.invalidateQueries({ queryKey: ['unreadMailCount'] });
      queryClient.invalidateQueries({ queryKey: ['recentMails'] });
      toast.success(!currentStatus ? 'Marked as read' : 'Marked as unread');
    } catch (err) {
      toast.error('Failed to update email status');
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-10 w-10 rounded-xl p-0 shrink-0 text-muted-foreground hover:text-foreground relative"
        >
          <Mail className="h-5 w-5" />
          <span className={`absolute -top-1 -right-1 flex min-w-[18px] h-[18px] items-center justify-center rounded-full px-1 text-[10px] font-black text-white shadow-sm transition-colors ${unreadCount > 0 ? 'bg-destructive' : 'bg-muted-foreground'}`}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-80 sm:w-96 p-0 rounded-2xl shadow-xl z-[100] border-border/60">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <DropdownMenuLabel className="p-0 font-bold text-sm">Inbox</DropdownMenuLabel>
          <button 
            className="text-xs text-primary hover:underline font-semibold"
            onClick={() => {
              setIsOpen(false);
              router.push('/dashboard/mail');
            }}
          >
            View All
          </button>
        </div>
        
        <div className="flex flex-col max-h-[350px] overflow-y-auto">
          {isLoadingRecent ? (
            <div className="flex justify-center items-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : recentMails.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              No recent emails inside inbox.
            </div>
          ) : (
            recentMails.map((mail: MailParticipant) => (
              <div 
                key={mail.id} 
                onClick={() => handleMailClick(mail.mail_message_id, mail.is_read)}
                className={`relative flex items-start flex-col gap-1 px-4 py-3 border-b border-border/40 hover:bg-muted/50 cursor-pointer transition-colors ${!mail.is_read ? 'bg-muted/20' : ''}`}
              >
                <div className="flex items-start justify-between w-full">
                  <span className={`text-sm truncate pr-2 ${!mail.is_read ? 'font-bold text-foreground' : 'font-medium text-muted-foreground'}`}>
                    {mail.message.sender?.name || 'System'}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                    {formatDistanceToNow(new Date(mail.message.created_at), { addSuffix: true })}
                  </span>
                </div>
                <div className={`text-xs truncate w-[85%] ${!mail.is_read ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                  {mail.message.subject || '(No Subject)'}
                </div>
                <div className="text-xs text-muted-foreground truncate w-[85%] opacity-80">
                  {mail.message.encryption?.encrypted ? getEncryptedMailBodyFallback() : mail.message.body}
                </div>
                
                {/* Read/Unread toggler button */}
                <button 
                  onClick={(e) => toggleReadStatus(e, mail.mail_message_id, mail.is_read)}
                  className="absolute right-4 bottom-3 h-6 w-6 rounded-full flex items-center justify-center hover:bg-background shadow-sm border border-transparent hover:border-border transition-all"
                  title={mail.is_read ? 'Mark as unread' : 'Mark as read'}
                >
                  {mail.is_read ? (
                    <Check className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <Circle className="h-3.5 w-3.5 fill-primary text-primary" />
                  )}
                </button>
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
