"use client";

import React, { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import MailLayout from '@/components/mail/mail-layout';
import { CommunicationWorkspaceHeader } from '@/components/communications/communication-workspace-header';
import { useMailStore } from '@/store/mail-store';

export default function MailPage() {
  const searchParams = useSearchParams();
  const selectMail = useMailStore((state) => state.selectMail);
  const setActiveFolder = useMailStore((state) => state.setActiveFolder);
  const unreadCount = useMailStore((state) => state.counts.inbox_unread);
  const onlineCount = useMailStore((state) => state.onlineUsers.length);

  useEffect(() => {
    const mailId = searchParams.get('id');
    const parsedMailId = Number(mailId);

    if (!mailId || Number.isNaN(parsedMailId)) {
      return;
    }

    setActiveFolder('inbox');
    selectMail(parsedMailId);
  }, [searchParams, selectMail, setActiveFolder]);

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <CommunicationWorkspaceHeader kind="mail" onlineCount={onlineCount} unreadCount={unreadCount} />
      <div className="h-[calc(100dvh-13rem)] min-h-[34rem] w-full overflow-hidden rounded-2xl border border-border/60 bg-card/50 shadow-sm">
        <MailLayout />
      </div>
    </div>
  );
}
