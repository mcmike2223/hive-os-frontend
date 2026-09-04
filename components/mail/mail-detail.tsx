"use client";

import React from 'react';
import { useMailStore } from '@/store/mail-store';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trash, Reply, Forward, Star, Archive, MailOpen, Mail, Printer, Maximize, Minimize, Lock, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { SafeRichText } from '@/components/security/safe-rich-text';

export default function MailDetail() {
  const { mails, selectedMailId, selectMail, deleteMail, updateMail, setComposeOpen, activeFolder, checkedMailIds, adjustCounts, isFullscreen, setFullscreen, encryptionConfig } = useMailStore();
  
  const mail = mails.find((m) => m.mail_message_id === selectedMailId);
  const isMailEncrypted = Boolean(mail?.message?.encryption?.encrypted);
  const isSecureMailEnabled = Boolean(encryptionConfig.enabled);

  if (!mail) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground h-full bg-background border-l">
        {checkedMailIds.length > 0 ? (
           <div className="flex flex-col items-center">
             <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 ring-8 ring-primary/5">
                <span className="text-xl font-bold text-primary">{checkedMailIds.length}</span>
             </div>
             <p className="font-semibold text-foreground text-lg mb-1">{checkedMailIds.length} conversations selected</p>
             <p className="text-sm">Choose an action from the toolbar to apply to all selected conversations.</p>
           </div>
        ) : (
           <>
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <MailOpen className="w-8 h-8 text-muted-foreground/50 opacity-50" />
            </div>
            <p className="font-medium">Select a message to read</p>
           </>
        )}
      </div>
    );
  }

  const handleDelete = async () => {
    try {
      if (activeFolder === 'trash') {
        await api.delete(`/mail/${selectedMailId}`);
        deleteMail(selectedMailId!);
        adjustCounts({ trash: -1 });
      } else {
        await api.delete(`/mail/${selectedMailId}`);
        updateMail(selectedMailId!, { folder: 'trash' });
        deleteMail(selectedMailId!);
        adjustCounts({ [activeFolder]: -1, trash: 1 });
      }
      selectMail(null);
      toast.success(activeFolder === 'trash' ? 'Message deleted permanently' : 'Message moved to trash');
    } catch (err) {
      toast.error('Failed to delete message');
    }
  };

  const handleArchive = async () => {
    try {
      await api.post('/mail/bulk', { ids: [selectedMailId], action: 'archive' });
      updateMail(selectedMailId!, { folder: 'archive' });
      deleteMail(selectedMailId!);
      adjustCounts({ [activeFolder]: -1, archive: 1 });
      selectMail(null);
      toast.success('Message archived');
    } catch (err) {
      toast.error('Failed to archive message');
    }
  };

  const handleSpamToggle = async () => {
    const nextFolder = activeFolder === 'spam' ? 'inbox' : 'spam';

    try {
      await api.post('/mail/bulk', { ids: [selectedMailId], action: nextFolder });
      updateMail(selectedMailId!, { folder: nextFolder });
      deleteMail(selectedMailId!);
      adjustCounts({ [activeFolder]: -1, [nextFolder]: 1 });
      selectMail(null);
      toast.success(nextFolder === 'spam' ? 'Message moved to spam' : 'Message moved to inbox');
    } catch (err) {
      toast.error(nextFolder === 'spam' ? 'Failed to move message to spam' : 'Failed to move message to inbox');
    }
  };

  const handleToggleStar = async () => {
    const newVal = !mail.is_starred;
    updateMail(selectedMailId!, { is_starred: newVal });
    adjustCounts({ starred: newVal ? 1 : -1 });
    try {
      await api.put(`/mail/${selectedMailId}`, { is_starred: newVal });
    } catch (err) {
      updateMail(selectedMailId!, { is_starred: !newVal });
      adjustCounts({ starred: !newVal ? 1 : -1 });
      toast.error('Failed to update star');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleReply = () => {
    const otherParticipants = (mail.message?.participants || [])
      .map((participant) => participant.user)
      .filter((participant): participant is NonNullable<typeof participant> => Boolean(participant))
      .filter((participant) => String(participant.id) !== String(mail.user_id));
    const replyRecipients = mail.folder === 'sent'
      ? otherParticipants
      : (mail.message?.sender ? [mail.message.sender] : []);

    setComposeOpen(true, {
      to: replyRecipients,
      subject: (mail.message?.subject || '').startsWith('Re:') ? mail.message?.subject : `Re: ${mail.message?.subject || ''}`,
      body: `\n\n\n--- Original Message ---\nFrom: ${mail.message?.sender?.name || 'Unknown'}\nDate: ${mail.message?.created_at ? format(new Date(mail.message.created_at), 'PPPp') : 'Unknown'}\n\n${mail.message?.body || ''}`
    });
  };

  const handleForward = () => {
    setComposeOpen(true, {
      to: [],
      subject: (mail.message?.subject || '').startsWith('Fwd:') ? mail.message?.subject : `Fwd: ${mail.message?.subject || ''}`,
      body: `\n\n\n--- Forwarded Message ---\nFrom: ${mail.message?.sender?.name || 'Unknown'}\nDate: ${mail.message?.created_at ? format(new Date(mail.message.created_at), 'PPPp') : 'Unknown'}\n\n${mail.message?.body || ''}`
    });
  };

  return (
    <TooltipProvider>
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-background/95 print:w-full print:border-none print:absolute print:inset-0 rounded-2xl relative">
        <div className="flex-1 overflow-y-auto p-8 md:p-10 flex flex-col print:p-0 scrollbar-thin overscroll-none">
          
          {/* Header Action Toolbar Area matching reference */}
          <div className="flex items-start justify-between mb-8">
            <div className="flex items-center gap-4">
               <Avatar className="h-[52px] w-[52px] border shadow-sm">
                 <AvatarImage src={mail.message?.sender?.avatar_url} />
                 <AvatarFallback className="bg-slate-200 text-slate-600 font-bold text-xl">
                   {mail.message?.sender?.name?.charAt(0) || 'U'}
                 </AvatarFallback>
               </Avatar>
               <div className="flex flex-col">
                 <span className="font-bold text-lg text-foreground">{mail.message?.sender?.name || 'Unknown User'}</span>
                 <span className="text-sm text-muted-foreground font-medium">
                   {mail.message?.sender?.email || 'unknown@example.com'}
                 </span>
               </div>
            </div>

            <div className="flex items-center gap-2 print:hidden bg-muted/10 rounded-lg p-1 border border-border/50">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => selectMail(null)} className="h-[38px] w-[38px] md:hidden">
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Back</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={handleToggleStar} className="h-[38px] w-[38px] hover:bg-white dark:hover:bg-muted/80 shadow-sm transition-all hover:scale-105">
                      <Star className={cn("w-[18px] h-[18px]", mail.is_starred ? "fill-yellow-400 text-yellow-500" : "text-muted-foreground")} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{mail.is_starred ? 'Unstar' : 'Star'}</TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={handleArchive} className="h-[38px] w-[38px] hover:bg-white dark:hover:bg-muted/80 shadow-sm transition-all hover:scale-105">
                      <Archive className="w-[18px] h-[18px] text-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Archive</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={handleSpamToggle} className="h-[38px] w-[38px] hover:bg-white dark:hover:bg-muted/80 shadow-sm transition-all hover:scale-105">
                      {activeFolder === 'spam' ? <Mail className="w-[18px] h-[18px] text-muted-foreground" /> : <Zap className="w-[18px] h-[18px] text-muted-foreground" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{activeFolder === 'spam' ? 'Move to Inbox' : 'Report Spam'}</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => setFullscreen(!isFullscreen)} className="h-[38px] w-[38px] hover:bg-white dark:hover:bg-muted/80 shadow-sm transition-all hover:scale-105 hidden md:flex">
                      {isFullscreen ? <Minimize className="w-[18px] h-[18px] text-muted-foreground" /> : <Maximize className="w-[18px] h-[18px] text-muted-foreground" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={handlePrint} className="h-[38px] w-[38px] hover:bg-white dark:hover:bg-muted/80 shadow-sm transition-all hover:scale-105 hidden sm:flex">
                      <Printer className="w-[18px] h-[18px] text-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Print</TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={handleDelete} className="h-[38px] w-[38px] hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/50 shadow-sm transition-all hover:scale-105">
                      <Trash className="w-[18px] h-[18px]" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Trash</TooltipContent>
                </Tooltip>
            </div>
          </div>

          <div className="flex items-start justify-between mb-8 pb-6 border-b border-muted">
            <div className="pr-8">
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground animate-in slide-in-from-bottom-2 fade-in">
                {mail.message?.subject || '(No Subject)'}
              </h1>
              {isMailEncrypted && (
                <div className="mt-3 inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  <Lock className="h-3.5 w-3.5" />
                  E2E Encrypted
                </div>
              )}
              {!isMailEncrypted && isSecureMailEnabled && (
                <div className="mt-3 inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  <Lock className="h-3.5 w-3.5" />
                  Secure Mail On
                </div>
              )}
            </div>
            <div className="text-[13px] font-medium text-muted-foreground whitespace-nowrap mt-2">
               {mail.message?.created_at ? format(new Date(mail.message.created_at), 'PPP, p') : ''}
            </div>
          </div>

          <SafeRichText
            className="whitespace-pre-wrap flex-1 text-[15px] leading-relaxed text-foreground/90 pb-8 prose dark:prose-invert max-w-none"
            html={mail.message?.body || ''}
          />
          
          <div className="flex items-center gap-3 mt-auto pt-8 shrink-0 print:hidden">
            <Button className="gap-2 shrink-0 font-semibold bg-[#22d3ee] hover:bg-[#0891b2] text-white shadow-sm" onClick={handleForward}>
              <Forward className="w-[18px] h-[18px]" /> Forward
            </Button>
            <Button className="gap-2 shrink-0 font-semibold bg-[#ef4444] hover:bg-[#dc2626] text-white shadow-sm" onClick={handleReply}>
              <Reply className="w-[18px] h-[18px]" /> Reply
            </Button>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
