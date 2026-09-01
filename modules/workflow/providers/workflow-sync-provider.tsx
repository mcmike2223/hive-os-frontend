"use client";

import { useEffect } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { initEcho, getUserNotificationChannelName } from '@/lib/echo';
import { getAccessToken } from '@/lib/runtime-context';

export function WorkflowSyncProvider() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const token = getAccessToken() || localStorage.getItem('token');
    const userJson = localStorage.getItem('hive_user');
    const user = userJson ? JSON.parse(userJson) : null;

    if (!token || !user) {
      return;
    }

    const echo = initEcho(token);
    if (!echo) return;
    const channelName = getUserNotificationChannelName(user.id);
    const channel = echo.private(channelName);

    // Listen for Laravel Notifications
    channel.notification((notification: any) => {
      if (notification.type === 'workflow_approval_requested') {
        toast.info('New Approval Request', {
          description: notification.message,
          duration: 10000,
          action: {
            label: 'View',
            onClick: () => {
              // Navigate to the appropriate module
              if (notification.action_url) {
                window.location.href = notification.action_url;
              }
            },
          },
        });

        // Invalidate relevant queries
        queryClient.invalidateQueries({ queryKey: ["inventory", "products"] });
      }
    });

    return () => {
      echo.leave(channelName);
    };
  }, [queryClient]);

  return null;
}
