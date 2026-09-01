"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { initEcho, getUserNotificationChannelNames } from '@/lib/echo';
import { getAccessToken } from '@/lib/runtime-context';
import { useUser } from '@/hooks/use-user';

type ProjectManagementNotificationPayload = {
  category?: string;
  title?: string;
  body?: string;
  url?: string;
  data?: {
    category?: string;
    title?: string;
    body?: string;
    url?: string;
  };
};

export function ProjectManagementSyncProvider() {
  const router = useRouter();
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (!isLoaded || !user) {
      return;
    }

    const token = getAccessToken();
    if (!token) {
      return;
    }

    const echo = initEcho(token);
    if (!echo) return;
    const channelNames = getUserNotificationChannelNames(user.id);
    const channels = channelNames.map((channelName) => echo.private(channelName));

    channels.forEach((channel) => {
      channel.notification((notification: ProjectManagementNotificationPayload) => {
        const payload = notification.data ?? notification;

        if (!payload.category?.startsWith('pm_')) {
          return;
        }

        toast(payload.title || 'Project update', {
          description: payload.body,
          action: payload.url ? {
            label: 'Open',
            onClick: () => router.push(payload.url as string),
          } : undefined,
          duration: 6000,
        });
      });
    });

    return () => {
      channelNames.forEach((channelName) => echo.leave(channelName));
    };
  }, [isLoaded, user, router]);

  return null;
}
