"use client";

import React, { useEffect, useState } from 'react';
import { useMailStore, MailCounts, MailFolder } from '@/store/mail-store';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import api from '@/lib/api';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Search, Trash2, Star, MailOpen, Mail, Archive, ChevronLeft, ChevronRight, Lock, Zap, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { decryptMailParticipants } from '@/lib/mail-e2ee';

type MailFolderCountKey = Exclude<MailFolder, 'all'>;

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
      adjustCounts({ inbox_unread: -1 });
      try {
        await api.put(`/mail/${mail.mail_message_id}`, { is_read: true });
      } catch {
        updateMail(mail.mail_message_id, { is_read: false });
        adjustCounts({ inbox_unread: 1 });
        toast.error('Message opened, but its read status could not be saved');
      }
    }
  };

  const handleBulkAction = async (action: string) => {
    if (checkedMailIds.length === 0) return;
    const ids = [...checkedMailIds];
    
    try {
      await api.post('/mail/bulk', { ids, action });
      
      const selectedMails = mails.filter((mail) => ids.includes(mail.mail_message_id));
      const countUpdate: Partial<MailCounts> & Partial<Record<MailFolderCountKey, number>> = {};
      const amount = ids.length;
      const unreadAmount = selectedMails.filter((mail) => !mail.is_read).length;
      const unstarredAmount = selectedMails.filter((mail) => !mail.is_starred).length;
      const decrementActiveFolder = () => {
        if (activeFolder !== 'all') countUpdate[activeFolder] = -amount;
      };

      // Optimistic counters logic
      if (action === 'trash') {
         bulkUpdateMails(ids, { folder: 'trash' });
         if (activeFolder !== 'trash') bulkDeleteMails(ids);
         if (activeFolder !== 'trash') decrementActiveFolder();
         countUpdate.trash = amount;
      } else if (action === 'delete') {
         bulkDeleteMails(ids);
         decrementActiveFolder();
      } else if (action === 'star') {
         bulkUpdateMails(ids, { is_starred: true });
         countUpdate.starred = unstarredAmount;
      } else if (action === 'archive') {
         bulkUpdateMails(ids, { folder: 'archive' });
         if (activeFolder !== 'archive') bulkDeleteMails(ids);
         if (activeFolder !== 'archive') decrementActiveFolder();
         countUpdate.archive = amount;
      } else if (action === 'spam') {
         bulkUpdateMails(ids, { folder: 'spam' });
         if (activeFolder !== 'spam') bulkDeleteMails(ids);
         if (activeFolder !== 'spam') decrementActiveFolder();
         countUpdate.spam = amount;
      } else if (action === 'inbox') {
         bulkUpdateMails(ids, { folder: 'inbox' });
         if (activeFolder !== 'inbox') bulkDeleteMails(ids);
         if (activeFolder !== 'inbox') decrementActiveFolder();
         countUpdate.inbox = amount;
      } else if (action === 'important') {
         bulkUpdateMails(ids, { folder: 'important' });
         if (activeFolder !== 'important') bulkDeleteMails(ids);
         if (activeFolder !== 'important') decrementActiveFolder();
         countUpdate.important = amount;
      } else if (action === 'read') {
         bulkUpdateMails(ids, { is_read: true });
         if (activeFolder === 'inbox') countUpdate.inbox_unread = -unreadAmount;
      } else if (action === 'unread') {
         bulkUpdateMails(ids, { is_read: false });
         if (activeFolder === 'inbox') countUpdate.inbox_unread = amount - unreadAmount;
      }
      
      adjustCounts(countUpdate);
      clearChecked();
      toast.success('Action applied to selected messages');
    } catch {
      toast.error('Failed to apply bulk action');
    }
  };

  const handleToggleStar = async (mail: typeof mails[number]) => {
    const nextValue = !mail.is_starred;
    updateMail(mail.mail_message_id, { is_starred: nextValue });
    adjustCounts({ starred: nextValue ? 1 : -1 });

    try {
      await api.put(`/mail/${mail.mail_message_id}`, { is_starred: nextValue });
    } catch {
      updateMail(mail.mail_message_id, { is_starred: !nextValue });
      adjustCounts({ starred: nextValue ? -1 : 1 });
      toast.error('Failed to update star');
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

  if (loading && !mails.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 border-r text-muted-foreground" role="status">
        <Loader2 aria-hidden="true" className="size-6 animate-spin text-primary" />
        <p className="text-sm">Loading {activeFolder} mail</p>
      </div>
    );
  }

  if (!mails.length) {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center border-r bg-muted/5 p-8 text-center text-muted-foreground">
        <div className="mb-4 rounded-full bg-primary/10 p-4">
           <Mail aria-hidden="true" className="size-8 text-primary" />
        </div>
        <p className="font-medium text-foreground">No messages in {activeFolder}</p>
        <p className="text-sm mt-1">When you receive new messages, they will appear here.</p>
      </div>
    );
  }

  return (
    <div className="flex size-full flex-col overflow-hidden bg-transparent">
      
      <div className="flex items-center justify-between px-6 pt-6 pb-2">
        <div className="flex items-center gap-3">
           <Checkbox
             id="select-all-mail"
             aria-label={`Select all messages in ${activeFolder}`}
             checked={allChecked ? true : indeterminate ? "indeterminate" : false} 
             onCheckedChange={() => toggleCheckAll(filteredMails.map(m => m.mail_message_id))}
             className="rounded border-muted-foreground/40"
           />
           <div className="ml-2 flex items-center gap-2">
             <h2 className="text-xl font-bold text-foreground capitalize tracking-tight">
               {activeFolder === 'all' ? 'All Mails' : activeFolder}
             </h2>
             {encryptionConfig.enabled && (
               <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[11px] font-black uppercase tracking-wider text-primary">
                 <Lock aria-hidden="true" className="size-3" />
                 Secure Mail
               </span>
             )}
           </div>
        </div>
      </div>

      {/* Search & Bulk Actions Bar */}
      <div className="px-6 pb-4 shrink-0">
        {checkedMailIds.length > 0 ? (
          <div className="flex min-h-11 items-center gap-1 overflow-x-auto rounded-xl border border-border/60 bg-background/80 p-1.5 shadow-sm" aria-label="Bulk mail actions">
             <span className="text-sm font-semibold mx-3 text-muted-foreground whitespace-nowrap">
               {checkedMailIds.length} selected
             </span>
             <Button variant="ghost" size="icon-sm" aria-label={activeFolder === 'trash' ? "Delete forever" : "Move to trash"} onClick={() => handleBulkAction(activeFolder === 'trash' ? 'delete' : 'trash')}>
               <Trash2 className="w-[18px] h-[18px] text-muted-foreground hover:text-destructive transition-colors" />
             </Button>
             <Button variant="ghost" size="icon-sm" aria-label="Archive selected messages" onClick={() => handleBulkAction('archive')}>
               <Archive className="w-[18px] h-[18px] text-muted-foreground" />
             </Button>
             <Button variant="ghost" size="icon-sm" aria-label={activeFolder === 'spam' ? "Move selected messages to inbox" : "Report selected messages as spam"} onClick={() => handleBulkAction(activeFolder === 'spam' ? 'inbox' : 'spam')}>
               {activeFolder === 'spam' ? <Mail className="w-[18px] h-[18px] text-muted-foreground" /> : <Zap className="w-[18px] h-[18px] text-muted-foreground hover:text-amber-500" />}
             </Button>
             <Button variant="ghost" size="icon-sm" aria-label="Star selected messages" onClick={() => handleBulkAction('star')}>
               <Star className="w-[18px] h-[18px] text-muted-foreground hover:text-yellow-500" />
             </Button>
             <Button variant="ghost" size="icon-sm" aria-label="Mark selected messages as read" onClick={() => handleBulkAction('read')}>
               <MailOpen className="w-[18px] h-[18px] text-muted-foreground" />
             </Button>
             <Button variant="ghost" size="icon-sm" aria-label="Mark selected messages as unread" onClick={() => handleBulkAction('unread')}>
               <Mail className="w-[18px] h-[18px] text-muted-foreground" />
             </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="mail-search" className="text-xs font-medium text-muted-foreground">Search mail</label>
            <div className="relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-muted-foreground/60" />
             <Input 
               id="mail-search"
               placeholder="Search Email" 
               className="pl-10 h-[44px] bg-muted/20 dark:bg-muted/30 backdrop-blur-sm border-muted-foreground/20 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-transparent rounded-xl shadow-sm transition-all text-[15px]"
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
             />
            </div>
          </div>
        )}
      </div>

      <div className="flex w-full flex-1 flex-col gap-1 overflow-y-auto border-r-transparent px-2 scrollbar-thin overscroll-none">
        {filteredMails.length === 0 ? (
           <div className="p-8 text-center text-sm text-muted-foreground">No matches found.</div>
        ) : filteredMails.map((mail) => (
          <article
            key={mail.id || `msg-${mail.mail_message_id}`}
            className={cn(
              "group relative m-1 flex items-start gap-4 rounded-2xl border border-transparent p-4 text-left transition-colors hover:border-border/60 hover:bg-accent/40",
              selectedMailId === mail.mail_message_id 
                ? "bg-white dark:bg-muted shadow-sm border-primary/20 ring-1 ring-primary/10" 
                : "bg-transparent hover:bg-white/80 dark:hover:bg-muted/60",
            )}
          >
            <button
              type="button"
              onClick={() => handleSelect(mail)}
              aria-label={`Open ${mail.message?.subject || 'message'} from ${mail.message?.sender?.name || 'System'}`}
              className="absolute inset-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {/* Absolute Checkbox Overlay */}
            <div className={cn(
               "absolute left-4 top-4 z-20 rounded-sm bg-background/80 backdrop-blur-sm",
            )} onClick={(e) => e.stopPropagation()}>
              <Checkbox 
                aria-label={`Select ${mail.message?.subject || 'message'} from ${mail.message?.sender?.name || 'System'}`}
                checked={checkedMailIds.includes(mail.mail_message_id)}
                onCheckedChange={() => toggleCheckMail(mail.mail_message_id)}
                className="size-5 rounded border-muted-foreground/40 shadow-sm"
              />
            </div>

            <Avatar className="pointer-events-none relative z-10 size-10 shrink-0 border border-border shadow-sm">
              <AvatarImage src={mail.message?.sender?.avatar_url} />
              <AvatarFallback className="bg-primary/5 text-primary text-sm font-semibold">
                {mail.message?.sender?.name?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            
            <div className="pointer-events-none relative z-10 min-w-0 flex-1 overflow-hidden py-0.5">
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
                  <button type="button" className="pointer-events-auto relative z-20 flex size-8 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={mail.is_starred ? `Unstar ${mail.message?.subject || 'message'}` : `Star ${mail.message?.subject || 'message'}`} onClick={() => void handleToggleStar(mail)}>
                     {mail.is_starred ? (
                        <Star aria-hidden="true" className="size-4 fill-primary text-primary" />
                     ) : (
                        <Star aria-hidden="true" className="size-4 text-muted-foreground" />
                     )}
                  </button>
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
          </article>
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
            <ChevronLeft aria-hidden="true" data-icon="inline-start" />
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
            <ChevronRight aria-hidden="true" data-icon="inline-end" />
          </Button>
        </div>
      </div>
    </div>
  );
}
