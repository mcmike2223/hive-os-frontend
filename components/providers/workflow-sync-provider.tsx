"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { initEcho, getUserNotificationChannelNames, getWorkflowChannelName } from '@/lib/echo';
import { getAccessToken } from '@/lib/runtime-context';
import { useQueryClient } from '@tanstack/react-query';

type WorkflowNotificationPayload = {
  id?: string;
  category?: string;
  title?: string;
  body?: string;
  url?: string;
};

type WorkflowRealtimeEvent = {
  approval?: {
    id?: number;
    approvable_type?: string;
    approvable_id?: number;
    status?: string;
    sequence?: number;
    subject?: string;
    module?: string;
    module_slug?: string;
    submodule_slug?: string;
    functionality?: string;
    target_url?: string;
    requester?: string;
    group?: string;
    actioned_by?: string;
  };
  old_status?: string;
  new_status?: string;
};

const invalidateWorkflowSurfaces = (
  queryClient: ReturnType<typeof useQueryClient>,
  event?: WorkflowRealtimeEvent
) => {
  queryClient.invalidateQueries({ queryKey: ['workflow', 'approvals'] });
  queryClient.invalidateQueries({ queryKey: ['workflow', 'inline-approval'] });
  queryClient.invalidateQueries({ queryKey: ['workflow-dashboard'] });
  queryClient.invalidateQueries({ queryKey: ['dashboard-notifications'] });

  const type = event?.approval?.approvable_type || '';
  if (type.includes('Inventory\\Models\\Product')) queryClient.invalidateQueries({ queryKey: ['inventory', 'products'] });
  if (type.includes('ProductCategory')) queryClient.invalidateQueries({ queryKey: ['inventory', 'product-categories'] });
  if (type.includes('Supplier')) queryClient.invalidateQueries({ queryKey: ['inventory', 'suppliers'] });
  if (type.includes('InventoryDocument')) queryClient.invalidateQueries({ queryKey: ['inventory', 'documents'] });
  if (type.includes('InventoryEntityRecord')) queryClient.invalidateQueries({ queryKey: ['inventory', 'product-batches'] });
  if (type.includes('Warehouse\\Models\\StockMovement')) queryClient.invalidateQueries({ queryKey: ['warehouse', 'movements'] });
  if (type.includes('Identity\\Models\\User')) queryClient.invalidateQueries({ queryKey: ['users'] });
  if (event?.approval?.module_slug) queryClient.invalidateQueries({ queryKey: [event.approval.module_slug] });
  if (event?.approval?.submodule_slug) queryClient.invalidateQueries({ queryKey: [event.approval.submodule_slug] });
};

export function WorkflowSyncProvider() {
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    const token = getAccessToken() || localStorage.getItem('token');
    const storedUser = localStorage.getItem('hive_user');
    const user = storedUser ? JSON.parse(storedUser) : null;
    
    if (!token || !user) {
      return;
    }

    const echo = initEcho(token);
    if (!echo) return;
    
    // Channel 1: Laravel notifications. Listen on every supported user channel
    // because tenant-aware notifications can be delivered with different model names.
    const notificationChannelNames = getUserNotificationChannelNames(user.id);
    const seenNotificationIds = new Set<string>();
    notificationChannelNames.forEach((channelName) => echo.leave(channelName));
    notificationChannelNames.forEach((channelName) => {
      echo.private(channelName).notification((notification: WorkflowNotificationPayload) => {
        if (notification.id && seenNotificationIds.has(notification.id)) {
          return;
        }
        if (notification.id) {
          seenNotificationIds.add(notification.id);
        }

        console.log('New notification received:', notification);
        
        if (notification.category === 'workflow') {
          toast.info(notification.title || 'Workflow Update', {
            description: notification.body,
            duration: 8000,
            action: {
              label: 'View',
              onClick: () => {
                if (notification.url) {
                  router.push(notification.url);
                }
              },
            },
          });
          invalidateWorkflowSurfaces(queryClient);
        }
      });
    });

    // Channel 2: Real-time workflow events
    const workflowChannel = echo.private(getWorkflowChannelName(user.id));
    
    workflowChannel.listen('.workflow.approval.requested', (event: WorkflowRealtimeEvent) => {
      console.log('Workflow approval requested:', event);
      invalidateWorkflowSurfaces(queryClient, event);
    });

    workflowChannel.listen('.workflow.approval.status_changed', (event: WorkflowRealtimeEvent) => {
      console.log('Workflow status changed:', event);
      invalidateWorkflowSurfaces(queryClient, event);
    });

    return () => {
      notificationChannelNames.forEach((channelName) => echo.leave(channelName));
      echo.leave(getWorkflowChannelName(user.id));
    };
  }, [router, queryClient]);

  return null;
}
