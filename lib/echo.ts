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
  return `${getTenantChannelPrefix()}user.${userId}`;
};

export const getUserNotificationChannelNames = (userId: number | string) => {
  return [getUserNotificationChannelName(userId)];
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

export const getTrashChannelName = () => {
  return `${getTenantChannelPrefix()}trash`;
};

export const getWorkflowChannelName = (userId: number | string) => {
  return `${getTenantChannelPrefix()}user.${userId}.workflow`;
};

export const getWorkflowGlobalChannelName = () => {
  return `${getTenantChannelPrefix()}workflow`;
};

export const getSupportBotThreadChannelName = (streamToken: string) =>
  `support-bot.thread.${streamToken}`;

export const getSupportBotInboxChannelName = () =>
  `${getTenantChannelPrefix()}support-bot.inbox`;

/**
 * A connection for anonymous visitors.
 *
 * The public support widget has no account and no token, so it cannot use the
 * authenticated instance: there is nothing to sign a private-channel auth
 * request with. It subscribes only to public channels, whose names are
 * server-issued secrets. Kept separate from `window.Echo` so it can never be
 * mistaken for an authenticated connection, and so signing in later does not
 * inherit it.
 */
let publicEcho: Echo<"reverb"> | null = null;
let hasWarnedAboutMissingReverbKey = false;

const getReverbAppKey = () => process.env.NEXT_PUBLIC_REVERB_APP_KEY?.trim() || null;

export const initPublicEcho = (): Echo<"reverb"> | null => {
  if (typeof window === 'undefined') return null;

  if (publicEcho) return publicEcho;

  const key = getReverbAppKey();

  // Without a configured Reverb the widget still works; it just polls nothing
  // and relies on the request/response exchange.
  if (!key) return null;

  window.Pusher = Pusher;

  const reverbHost = process.env.NEXT_PUBLIC_REVERB_HOST || window.location.hostname;
  const reverbPort = Number(process.env.NEXT_PUBLIC_REVERB_PORT ?? 9000);
  const reverbScheme =
    window.location.protocol === 'https:'
      ? 'https'
      : process.env.NEXT_PUBLIC_REVERB_SCHEME || 'http';

  publicEcho = new Echo({
    broadcaster: 'reverb',
    key,
    wsHost: reverbHost,
    wsPort: reverbPort,
    wssPort: reverbPort,
    forceTLS: reverbScheme === 'https',
    enabledTransports: [reverbScheme === 'https' ? 'wss' : 'ws'],
  });

  return publicEcho;
};

export const disconnectPublicEcho = () => {
  publicEcho?.disconnect();
  publicEcho = null;
};

export const initEcho = (token: string): Echo<"reverb"> | null => {
  if (typeof window === 'undefined') {
    throw new Error('Echo can only be initialized in the browser.');
  }

  const key = getReverbAppKey();

  // Realtime is an enhancement, not a login requirement. Next.js replaces
  // NEXT_PUBLIC_* values in the browser bundle at compile time, so a stale or
  // misconfigured build can see an empty value even when the container runtime
  // has the variable. Do not let Pusher turn that into an application-wide
  // runtime exception; the normal API flows remain available without Echo.
  if (!key) {
    if (!hasWarnedAboutMissingReverbKey) {
      console.warn('Realtime is disabled because NEXT_PUBLIC_REVERB_APP_KEY is not available in this browser build.');
      hasWarnedAboutMissingReverbKey = true;
    }

    return null;
  }

  window.Pusher = Pusher;

  // Keep an explicitly configured host intact. Tenant hosts such as
  // `aquauno.localhost` are not necessarily where Reverb is published; in the
  // Docker development stack it is deliberately exposed on localhost:9095.
  const reverbHost = process.env.NEXT_PUBLIC_REVERB_HOST || window.location.hostname;

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
      key,
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
