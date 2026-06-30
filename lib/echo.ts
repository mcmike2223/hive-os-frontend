import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { getBackendApiRoot, getTenantHeaders, getTenantId } from "@/lib/runtime-context";

declare global {
  interface Window {
    Pusher: typeof Pusher;
    Echo?: Echo<"reverb">;
    __hiveEchoSessionKey?: string;
  }
}

const getTenantChannelPrefix = () => {
  const tenantId = getTenantId();

  return tenantId ? `tenant.${tenantId}.` : '';
};

export const getChatUserChannelName = (userId: number | string) => {
  return `${getTenantChannelPrefix()}user.${userId}.chat`;
};

export const getUserNotificationChannelName = (userId: number | string) => {
  return `${getTenantChannelPrefix()}App.Models.User.${userId}`;
};

export const getUserNotificationChannelNames = (userId: number | string) => {
  const prefix = getTenantChannelPrefix();

  return [
    `${prefix}App.Models.User.${userId}`,
    `${prefix}Modules.Identity.Models.User.${userId}`,
    `${prefix}user.${userId}`,
  ];
};

export const getChatPresenceChannelName = () => {
  return `${getTenantChannelPrefix()}chat.presence`;
};

export const getConversationPresenceChannelName = (conversationId: number | string) => {
  return `${getTenantChannelPrefix()}chat.conversation.${conversationId}.presence`;
};

export const getProjectManagementChannelName = () => {
  return `${getTenantChannelPrefix()}project-management`;
};

export const getProjectManagementProjectChannelName = (projectId: number | string) => {
  return `${getTenantChannelPrefix()}project-management.project.${projectId}`;
};

export const getWorkflowChannelName = (userId: number | string) => {
  return `${getTenantChannelPrefix()}user.${userId}.workflow`;
};

export const getWorkflowGlobalChannelName = () => {
  return `${getTenantChannelPrefix()}workflow`;
};

export const initEcho = (token: string) => {
  if (typeof window === 'undefined') {
    throw new Error('Echo can only be initialized in the browser.');
  }

  window.Pusher = Pusher;

  const reverbHost =
    process.env.NEXT_PUBLIC_REVERB_HOST === 'localhost' || process.env.NEXT_PUBLIC_REVERB_HOST === 'reverb'
      ? window.location.hostname
      : process.env.NEXT_PUBLIC_REVERB_HOST || window.location.hostname;

  const reverbPort = Number(process.env.NEXT_PUBLIC_REVERB_PORT ?? 9000);

  const reverbScheme = window.location.protocol === 'https:' ? 'https' : (process.env.NEXT_PUBLIC_REVERB_SCHEME || 'http');
  const backendApiRoot = getBackendApiRoot();
  const sessionKey = `${backendApiRoot}::${getTenantId() ?? 'central'}::${token}`;

  if (window.Echo && window.__hiveEchoSessionKey !== sessionKey) {
    window.Echo.disconnect();
    delete window.Echo;
  }

  if (!window.Echo) {
    window.Echo = new Echo({
      broadcaster: 'reverb',
      key: process.env.NEXT_PUBLIC_REVERB_APP_KEY,
      wsHost: reverbHost,
      wsPort: reverbPort,
      wssPort: reverbPort,
      forceTLS: reverbScheme === 'https',
      enabledTransports: [reverbScheme === 'https' ? 'wss' : 'ws'],
      authEndpoint: `${backendApiRoot}/broadcasting/auth`,
      auth: {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          ...getTenantHeaders({ allowUnsigned: true }),
        },
      },
    });

    window.__hiveEchoSessionKey = sessionKey;
  }

  return window.Echo;
};
