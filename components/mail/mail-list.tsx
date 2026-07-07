"use client";

import React, { useEffect, useState } from 'react';
import { useMailStore, MailCounts } from '@/store/mail-store';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import api from '@/lib/api';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Search, Trash2, Star, MailOpen, Mail, Archive, MoreVertical, ChevronLeft, ChevronRight, Lock, Zap } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { decryptMailParticipants } from '@/lib/mail-e2ee';

export default function MailList() {
  const { 
    mails, 
    selectedMailId, 
    selectMail, 
    activeFolder, 
    setMails, 
    updateMail,
    setComposeOpen,
    checkedMailIds,
    toggleCheckMail,
    toggleCheckAll,
    clearChecked,
    bulkUpdateMails,
    bulkDeleteMails,
    searchQuery,
    setSearchQuery,
    adjustCounts,
    encryptionConfig,
  } = useMailStore();

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  // Reset page to 1 when changing folders
  useEffect(() => {
    setPage(1);
  }, [activeFolder]);

  useEffect(() => {
    const fetchMails = async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/mail?folder=${activeFolder}&page=${page}`);
        const decryptedMails = await decryptMailParticipants(data.data || []);
        setMails(decryptedMails);
        setTotalPages(data.last_page || 1);
      } catch (err) {
        console.error("Failed to fetch mails:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMails();
  }, [
    activeFolder,
    page,
    setMails,
    encryptionConfig.enabled,
    encryptionConfig.public_key,
    encryptionConfig.fingerprint,
  ]);

  const handleSelect = async (mail: typeof mails[number]) => {
    if (mail.folder === 'drafts' || mail.message?.status === 'draft') {
      setComposeOpen(true, {
        draftId: mail.mail_message_id,
        to: mail.message?.draft_recipients?.to || [],
        cc: mail.message?.draft_recipients?.cc || [],
        bcc: mail.message?.draft_recipients?.bcc || [],
        subject: mail.message?.subject || '',
        body: mail.message?.body || '',
      });
      return;
    }

    selectMail(mail.mail_message_id);
    if (!mail.is_read) {
      updateMail(mail.mail_message_id, { is_read: true });
      await api.put(`/mail/${mail.mail_message_id}`, { is_read: true }).catch(() => {});
    }
  };

  const handleBulkAction = async (action: string) => {
    if (checkedMailIds.length === 0) return;
    const ids = [...checkedMailIds];
    
    try {
      await api.post('/mail/bulk', { ids, action });
      
      const countUpdate: Partial<MailCounts> = {};
      const amount = ids.length;

      // Optimistic counters logic
      if (action === 'trash') {
         bulkUpdateMails(ids, { folder: 'trash' });
         if (activeFolder !== 'trash') bulkDeleteMails(ids);
         if (activeFolder !== 'trash') countUpdate[activeFolder] = -amount;
         countUpdate.trash = amount;
      } else if (action === 'delete') {
         bulkDeleteMails(ids);
         countUpdate[activeFolder] = -amount;
      } else if (action === 'star') {
         bulkUpdateMails(ids, { is_starred: true });
         countUpdate.starred = amount;
      } else if (action === 'archive') {
         bulkUpdateMails(ids, { folder: 'archive' });
         if (activeFolder !== 'archive') bulkDeleteMails(ids);
         if (activeFolder !== 'archive') countUpdate[activeFolder] = -amount;
         countUpdate.archive = amount;
      } else if (action === 'spam') {
         bulkUpdateMails(ids, { folder: 'spam' });
         if (activeFolder !== 'spam') bulkDeleteMails(ids);
         if (activeFolder !== 'spam') countUpdate[activeFolder] = -amount;
         countUpdate.spam = amount;
      } else if (action === 'inbox') {
         bulkUpdateMails(ids, { folder: 'inbox' });
         if (activeFolder !== 'inbox') bulkDeleteMails(ids);
         if (activeFolder !== 'inbox') countUpdate[activeFolder] = -amount;
         countUpdate.inbox = amount;
      } else if (action === 'important') {
         bulkUpdateMails(ids, { folder: 'important' });
         if (activeFolder !== 'important') bulkDeleteMails(ids);
         if (activeFolder !== 'important') countUpdate[activeFolder] = -amount;
         countUpdate.important = amount;
      } else if (action === 'read') {
         bulkUpdateMails(ids, { is_read: true });
         if (activeFolder === 'inbox') countUpdate.inbox_unread = -amount;
      } else if (action === 'unread') {
         bulkUpdateMails(ids, { is_read: false });
         if (activeFolder === 'inbox') countUpdate.inbox_unread = amount;
      }
      
      adjustCounts(countUpdate);
      clearChecked();
      toast.success('Action applied to selected messages');
    } catch {
      toast.error('Failed to apply bulk action');
    }
  };

  const filteredMails = mails.filter(mail => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return mail.message.subject?.toLowerCase().includes(q) || 
           mail.message.sender?.name.toLowerCase().includes(q) ||
           mail.message.body?.toLowerCase().includes(q);
  });

  const allChecked = filteredMails.length > 0 && checkedMailIds.length === filteredMails.length;
  const indeterminate = checkedMailIds.length > 0 && checkedMailIds.length < filteredMails.length;

  if (!mails.length) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-muted/5 h-full p-8 text-center border-r">
        <div className="rounded-full bg-muted p-4 mb-4">
           <Mail className="w-8 h-8 opacity-50" />
        </div>
        <p className="font-medium text-foreground">No messages in {activeFolder}</p>
        <p className="text-sm mt-1">When you receive new messages, they will appear here.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-transparent">
      
      {/* Title Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-2">
        <div className="flex items-center gap-3">
           <Checkbox 
             checked={allChecked ? true : indeterminate ? "indeterminate" : false} 
             onCheckedChange={() => toggleCheckAll(filteredMails.map(m => m.mail_message_id))}
             className="border-muted-foreground/30 data-[state=checked]:bg-[#8b5cf6] data-[state=checked]:text-white rounded-[4px]"
           />
           <div className="ml-2 flex items-center gap-2">
             <h2 className="text-xl font-bold text-foreground capitalize tracking-tight">
               {activeFolder === 'all' ? 'All Mails' : activeFolder}
             </h2>
             {encryptionConfig.enabled && (
               <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                 <Lock className="h-3 w-3" />
                 Secure Mail
               </span>
             )}
           </div>
        </div>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <MoreVertical className="w-5 h-5" />
        </Button>
      </div>

      {/* Search & Bulk Actions Bar */}
      <div className="px-6 pb-4 shrink-0">
        {checkedMailIds.length > 0 ? (
          <div className="flex items-center gap-1 bg-white/80 dark:bg-muted/80 backdrop-blur-xl p-1.5 rounded-xl border border-border/50 animate-in fade-in zoom-in-95 duration-200 shadow-md h-[44px]">
             <span className="text-sm font-semibold mx-3 text-muted-foreground whitespace-nowrap">
               {checkedMailIds.length} selected
             </span>
             <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white dark:hover:bg-muted" onClick={() => handleBulkAction(activeFolder === 'trash' ? 'delete' : 'trash')} title={activeFolder === 'trash' ? "Delete Forever" : "Move to Trash"}>
               <Trash2 className="w-[18px] h-[18px] text-muted-foreground hover:text-destructive transition-colors" />
             </Button>
             <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white dark:hover:bg-muted" onClick={() => handleBulkAction('archive')} title="Archive">
               <Archive className="w-[18px] h-[18px] text-muted-foreground" />
             </Button>
             <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white dark:hover:bg-muted" onClick={() => handleBulkAction(activeFolder === 'spam' ? 'inbox' : 'spam')} title={activeFolder === 'spam' ? "Move to Inbox" : "Report Spam"}>
               {activeFolder === 'spam' ? <Mail className="w-[18px] h-[18px] text-muted-foreground" /> : <Zap className="w-[18px] h-[18px] text-muted-foreground hover:text-amber-500" />}
             </Button>
             <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white dark:hover:bg-muted" onClick={() => handleBulkAction('star')} title="Star">
               <Star className="w-[18px] h-[18px] text-muted-foreground hover:text-yellow-500" />
             </Button>
             <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white dark:hover:bg-muted" onClick={() => handleBulkAction('read')} title="Mark as Read">
               <MailOpen className="w-[18px] h-[18px] text-muted-foreground" />
             </Button>
             <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white dark:hover:bg-muted" onClick={() => handleBulkAction('unread')} title="Mark as Unread">
               <Mail className="w-[18px] h-[18px] text-muted-foreground" />
             </Button>
          </div>
        ) : (
          <div className="relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-muted-foreground/60" />
             <Input 
               placeholder="Search Email" 
               className="pl-10 h-[44px] bg-muted/20 dark:bg-muted/30 backdrop-blur-sm border-muted-foreground/20 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-transparent rounded-xl shadow-sm transition-all text-[15px]"
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
             />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto w-full border-r-transparent scrollbar-thin px-2 space-y-1 overscroll-none">
        {filteredMails.length === 0 ? (
           <div className="p-8 text-center text-sm text-muted-foreground">No matches found.</div>
        ) : filteredMails.map((mail) => (
          <div
            key={mail.id || `msg-${mail.mail_message_id}`}
            className={cn(
              "group relative flex items-start gap-4 p-4 text-left border border-transparent rounded-2xl transition-all duration-300 cursor-pointer m-1 hover:shadow-md hover:scale-[1.01] hover:border-border/30",
              selectedMailId === mail.mail_message_id 
                ? "bg-white dark:bg-muted shadow-sm border-primary/20 ring-1 ring-primary/10" 
                : "bg-transparent hover:bg-white/80 dark:hover:bg-muted/60",
            )}
            onClick={() => handleSelect(mail)}
          >
            {/* Absolute Checkbox Overlay */}
            <div className={cn(
               "absolute left-4 top-4 z-10 bg-white/80 dark:bg-background/80 rounded-sm backdrop-blur-sm transition-opacity", 
               checkedMailIds.includes(mail.mail_message_id) ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )} onClick={(e) => e.stopPropagation()}>
              <Checkbox 
                checked={checkedMailIds.includes(mail.mail_message_id)}
                onCheckedChange={() => toggleCheckMail(mail.mail_message_id)}
                className="data-[state=checked]:bg-[#8b5cf6] data-[state=checked]:text-white rounded-[4px] shadow-sm border-muted-foreground/30 h-5 w-5"
              />
            </div>

            <Avatar className="h-10 w-10 shrink-0 border border-border shadow-sm">
              <AvatarImage src={mail.message?.sender?.avatar_url} />
              <AvatarFallback className="bg-primary/5 text-primary text-sm font-semibold">
                {mail.message?.sender?.name?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 overflow-hidden min-w-0 py-0.5">
              <div className="flex w-full justify-between items-center gap-2 mb-1">
                <span className={cn(
                  "truncate text-[15px]", 
                  !mail.is_read ? "font-bold text-foreground" : "font-medium text-foreground/80"
                )}>
                  {mail.message?.sender?.name || 'System'}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn(
                    "text-[12px] whitespace-nowrap",
                    !mail.is_read ? "text-foreground font-semibold" : "text-muted-foreground"
                  )}>
                    {formatDistanceToNow(new Date(mail.message?.created_at || mail.created_at || new Date()), { addSuffix: true })}
                  </span>
                  <div className="w-5 h-5 flex items-center justify-center" onClick={e => { e.stopPropagation(); handleBulkAction('star'); toggleCheckMail(mail.mail_message_id); }}>
                     {mail.is_starred ? (
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                     ) : (
                        <Star className="w-4 h-4 text-muted-foreground/40 hidden group-hover:block" />
                     )}
                  </div>
                </div>
              </div>
              <div className={cn(
                "flex items-center gap-1.5 text-[14px] truncate w-full mb-1",
                !mail.is_read ? "font-bold text-foreground" : "font-medium text-foreground/80"
              )}>
                {mail.message?.encryption?.encrypted && (
                  <Lock className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                )}
                {!mail.message?.encryption?.encrypted && encryptionConfig.enabled && (
                  <Lock className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                )}
                <span className="truncate">{mail.message?.subject || '(No Subject)'}</span>
              </div>
              <div className="text-[13px] text-muted-foreground line-clamp-1 w-full leading-relaxed pr-6">
                {(mail.message?.body || '').replace(/<[^>]+>/g, '')}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between px-6 py-3 border-t shrink-0 h-14 bg-muted/5">
        <span className="text-xs font-semibold text-muted-foreground tracking-wide">
          Page {page} of {totalPages}
        </span>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            disabled={page === 1 || loading} 
            onClick={() => setPage(p => Math.max(1, p - 1))}
            className="h-8 shadow-sm transition-all text-xs"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Previous
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            disabled={page === totalPages || loading} 
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            className="h-8 shadow-sm transition-all text-xs"
          >
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
