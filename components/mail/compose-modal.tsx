"use client";

import React, { useState } from 'react';
import { useMailStore } from '@/store/mail-store';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getErrorMessage } from '@/lib/errors';
import { toast } from 'sonner';
import { Loader2, Lock, X } from 'lucide-react';
import { UserMultiSelect, User } from './user-multi-select';
import { Label } from '@/components/ui/label';
import { RichTextEditor, RichTextEditorRef } from '@/components/ui/rich-text-editor';
import { FileManagerClient } from '@/components/dashboard/file-manager-client';
import { getBackendStorageUrl } from '@/lib/runtime-context';
import { useRef } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { encryptMailDraft } from '@/lib/mail-e2ee';
import api from '@/lib/api';

export default function ComposeModal() {
  const { isComposeOpen, setComposeOpen, composeData, encryptionConfig } = useMailStore();
  const [to, setTo] = useState<User[]>([]);
  const [cc, setCc] = useState<User[]>([]);
  const [bcc, setBcc] = useState<User[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [draftId, setDraftId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCcHeader, setShowCcHeader] = useState(false);
  const [showBccHeader, setShowBccHeader] = useState(false);
  
  const [isFileManagerOpen, setIsFileManagerOpen] = useState(false);
  const editorRef = useRef<RichTextEditorRef>(null);

  const resetComposer = () => {
    setDraftId(null);
    setTo([]);
    setCc([]);
    setBcc([]);
    setSubject('');
    setBody('');
    setShowCcHeader(false);
    setShowBccHeader(false);
  };

  React.useEffect(() => {
    if (isComposeOpen && composeData) {
      setDraftId(composeData.draftId || null);
      setTo(composeData.to || []);
      setCc(composeData.cc || []);
      setBcc(composeData.bcc || []);
      setSubject(composeData.subject || '');
      setBody(composeData.body || '');
      setShowCcHeader(!!(composeData.cc?.length));
      setShowBccHeader(!!(composeData.bcc?.length));
      return;
    }

    if (isComposeOpen) {
      resetComposer();
    }
  }, [isComposeOpen, composeData]);

  const secureRecipients = [...to, ...cc, ...bcc];
  const missingSecureRecipients = encryptionConfig.enabled
    ? secureRecipients.filter((user) => !user.chat_public_key)
    : [];

  const handleSend = async () => {
    if (!to.length || !body) {
      toast.error('Recipient and body are required');
      return;
    }

    setLoading(true);
    try {
      const encryptedDraft = await encryptMailDraft({
        subject,
        body,
        recipients: secureRecipients,
      });

      await api.post('/mail', {
        to: to.map(u => u.id),
        cc: cc.map(u => u.id),
        bcc: bcc.map(u => u.id),
        subject: encryptedDraft.subject,
        body: encryptedDraft.body,
        draft_id: draftId,
        participant_keys: encryptedDraft.participant_keys,
      });
      
      toast.success(encryptedDraft.encrypted ? 'Encrypted email sent successfully' : 'Email sent successfully');
      setComposeOpen(false);
      resetComposer();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, 'Failed to send email'));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!subject.trim() && !body.trim() && to.length === 0 && cc.length === 0 && bcc.length === 0) {
      toast.error('Add a recipient, subject, or message before saving a draft');
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/mail', {
        to: to.map((user) => user.id),
        cc: cc.map((user) => user.id),
        bcc: bcc.map((user) => user.id),
        subject,
        body,
        save_as_draft: true,
        draft_id: draftId,
      });

      const savedDraftId = data?.data?.mail_message_id || data?.data?.message?.id || draftId;
      setDraftId(savedDraftId ?? null);
      toast.success(draftId ? 'Draft updated' : 'Draft saved');
      setComposeOpen(false);
      resetComposer();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to save draft'));
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (file: {
    media_details?: { url?: string; mime_type?: string; name?: string };
    url?: string;
    path?: string;
    mime_type?: string;
  }) => {
    const rawUrl = file?.media_details?.url || file?.url || file?.path;
    if (!rawUrl) {
      toast.error("Error: Could not extract media path from selection.");
      return;
    }

    const isVideo = file?.mime_type?.startsWith('video/') || rawUrl.endsWith('.mp4') || rawUrl.endsWith('.webm');
    const isAudio = file?.mime_type?.startsWith('audio/') || rawUrl.endsWith('.mp3') || rawUrl.endsWith('.wav');
    const fullUrl = rawUrl.startsWith("http") ? rawUrl : (getBackendStorageUrl(rawUrl) || rawUrl);
    
    let mediaType: 'image' | 'video' | 'audio' = 'image';
    if (isVideo) mediaType = 'video';
    else if (isAudio) mediaType = 'audio';

    editorRef.current?.insertMedia(fullUrl, mediaType);
    setIsFileManagerOpen(false);
  };

  return (
    <>
      <Dialog open={isComposeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="sm:max-w-[600px] flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {draftId ? 'Edit Draft' : 'New Message'}
            {encryptionConfig.enabled && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                <Lock className="h-3 w-3" />
                Encrypted
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {encryptionConfig.enabled && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">Secure mail is enabled.</span>{' '}
              The subject and message body will be encrypted in the browser before sending.
            </div>
          )}

          {encryptionConfig.enabled && missingSecureRecipients.length > 0 && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              {missingSecureRecipients.map((user) => user.name).join(', ')} must open secure chat or secure mail once before you can send an encrypted email to them.
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">To</Label>
              <div className="flex items-center gap-2 text-xs font-semibold">
                {!showCcHeader && <button onClick={() => setShowCcHeader(true)} className="hover:underline text-muted-foreground">Cc</button>}
                {!showBccHeader && <button onClick={() => setShowBccHeader(true)} className="hover:underline text-muted-foreground">Bcc</button>}
              </div>
            </div>
            <UserMultiSelect 
              placeholder="Search recipients..." 
              selectedUsers={to} 
              onChange={setTo} 
            />
          </div>

          {showCcHeader && (
            <div className="flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between">
                 <Label className="text-xs text-muted-foreground uppercase tracking-wider">Cc</Label>
                 <button onClick={() => { setShowCcHeader(false); setCc([]); }} className="text-muted-foreground hover:text-foreground">
                    <X className="w-3.5 h-3.5" />
                 </button>
              </div>
              <UserMultiSelect 
                placeholder="Search Cc recipients..." 
                selectedUsers={cc} 
                onChange={setCc} 
              />
            </div>
          )}

          {showBccHeader && (
            <div className="flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between">
                 <Label className="text-xs text-muted-foreground uppercase tracking-wider">Bcc</Label>
                 <button onClick={() => { setShowBccHeader(false); setBcc([]); }} className="text-muted-foreground hover:text-foreground">
                    <X className="w-3.5 h-3.5" />
                 </button>
              </div>
              <UserMultiSelect 
                placeholder="Search Bcc recipients..." 
                selectedUsers={bcc} 
                onChange={setBcc} 
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Input 
              placeholder="Subject" 
              value={subject} 
              className="mt-2"
              onChange={(e) => setSubject(e.target.value)} 
            />
          </div>
          <div className="flex flex-col gap-1.5 mt-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Message</Label>
            <RichTextEditor 
              ref={editorRef}
              value={body}
              onChange={setBody}
              onOpenMediaPicker={() => setIsFileManagerOpen(true)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setComposeOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="outline" onClick={handleSaveDraft} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Draft
          </Button>
          <Button onClick={handleSend} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Send
          </Button>
        </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Embedded File Manager Dialog just for rich text uploads - Now safely un-nested */}
      {isFileManagerOpen && (
        <Dialog open={isFileManagerOpen} onOpenChange={setIsFileManagerOpen}>
          <DialogContent className="flex h-[85vh] w-[95vw] max-w-6xl flex-col gap-0 overflow-hidden rounded-[2.5rem] border-border/50 bg-background p-0 shadow-2xl z-[100]">
            <DialogTitle className="sr-only">Select Media for Email</DialogTitle>
            <div className="z-10 flex shrink-0 items-center gap-4 border-b border-border/50 bg-card/60 px-8 py-5 backdrop-blur-xl">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 shadow-inner">
                <ImageIcon className="h-6 w-6 text-emerald-500" />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight text-foreground">Select Email Media</h2>
                <p className="mt-0.5 text-xs font-medium text-muted-foreground">Pick an image or video to dynamically embed into your email.</p>
              </div>
            </div>
            <div className="file-picker-wrapper relative flex-1 overflow-hidden bg-muted/10 p-4 sm:p-6">
              <style
                dangerouslySetInnerHTML={{
                  __html: `
                    .file-picker-wrapper > div > div:nth-child(1), .file-picker-wrapper > div > div:nth-child(2) > div:nth-child(2) { display: none !important; }
                    .file-picker-wrapper > div { height: 100% !important; min-height: 100% !important; margin: 0 !important; }
                  `,
                }}
              />
              <FileManagerClient
                isPickerMode={true}
                onFileSelect={handleFileSelect}
                access={{ canRead: true, canManage: true }}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
