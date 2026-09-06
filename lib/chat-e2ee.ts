import api from '@/lib/api';
import {
  COMMUNICATION_SHARED_KEY_ALGORITHM,
  createWrappedCommunicationKey,
  decryptCommunicationValue,
  ensureCommunicationIdentity,
  exportCommunicationKeyMaterial,
  getEncryptedCommunicationFallback,
  isEncryptedCommunicationValue,
  resolveWrappedCommunicationKey,
  encryptCommunicationValue,
} from '@/lib/communication-e2ee';
import {
  ChatConversation,
  ChatEncryptionConfig,
  ChatMessage,
  useChatStore,
} from '@/store/chat-store';

const ENCRYPTED_MESSAGE_FALLBACK = 'Encrypted message';

const conversationKeyCache = new Map<string, CryptoKey>();

const getConversationKeyCacheId = (conversationId: number | string) => String(conversationId);

const additionalAuthenticatedData = (conversationId: number | string) => {
  return `hive-chat:${conversationId}:v1`;
};

export const isEncryptedChatBody = (value?: string | null) => isEncryptedCommunicationValue(value);

export const getEncryptedChatFallback = () => getEncryptedCommunicationFallback(ENCRYPTED_MESSAGE_FALLBACK);

export const ensureChatEncryptionIdentity = async (
  config: ChatEncryptionConfig | null | undefined,
) => {
  return ensureCommunicationIdentity(config, async (identity) => {
    await api.post('/chat/encryption/public-key', {
      public_key: identity.publicKey,
      algorithm: identity.algorithm,
      fingerprint: identity.fingerprint,
    });

    useChatStore.getState().setEncryptionConfig({
      enabled: Boolean(config?.enabled),
      algorithm: config?.algorithm ?? identity.algorithm,
      public_key: identity.publicKey,
      fingerprint: identity.fingerprint,
    });
  });
};

const resolveConversationKey = async (conversation: ChatConversation) => {
  const cacheId = getConversationKeyCacheId(conversation.id);
  const cachedKey = conversationKeyCache.get(cacheId);

  if (cachedKey) {
    return cachedKey;
  }

  if (!conversation.encryption?.wrapped_key) {
    return null;
  }

  const identity = await ensureChatEncryptionIdentity(useChatStore.getState().encryptionConfig);

  if (!identity) {
    return null;
  }

  const conversationKey = await resolveWrappedCommunicationKey(conversation.encryption.wrapped_key, identity);
  conversationKeyCache.set(cacheId, conversationKey);

  return conversationKey;
};

export const bootstrapConversationEncryption = async (conversation: ChatConversation) => {
  if (!conversation.encryption?.enabled) {
    return conversation;
  }

  if (conversation.encryption?.wrapped_key) {
    return conversation;
  }

  const encryptionConfig = useChatStore.getState().encryptionConfig;
  const identity = await ensureChatEncryptionIdentity(encryptionConfig);

  if (!identity) {
    throw new Error('Secure chat identity is unavailable.');
  }

  const missingPublicKeys = conversation.participants.filter((participant) => !participant.chat_public_key);

  if (missingPublicKeys.length > 0) {
    const missingNames = missingPublicKeys.map((participant) => participant.name).join(', ');

    throw new Error(
      `${missingNames} must open secure chat once before end-to-end encryption can be used.`
    );
  }

  const { sharedKey, wrappedKeys } = await createWrappedCommunicationKey(
    conversation.participants.map((participant) => ({
      id: participant.id,
      publicKey: participant.chat_public_key as string,
    }))
  );

  const { data } = await api.post(`/chat/conversations/${conversation.id}/encryption/bootstrap`, {
    participant_keys: wrappedKeys,
  });

  const updatedConversation = (data?.data?.conversation || data?.conversation || conversation) as ChatConversation;

  conversationKeyCache.set(getConversationKeyCacheId(conversation.id), sharedKey);
  useChatStore.getState().updateConversation(conversation.id, updatedConversation);

  return updatedConversation;
};

export const encryptChatMessageBody = async (
  conversation: ChatConversation,
  body: string,
) => {
  const updatedConversation = await bootstrapConversationEncryption(conversation);
  const conversationKey = await resolveConversationKey(updatedConversation);

  if (!conversationKey) {
    throw new Error('Conversation encryption key is unavailable.');
  }

  return encryptCommunicationValue(body, conversationKey, additionalAuthenticatedData(updatedConversation.id));
};

export const decryptChatMessageBody = async (
  conversation: ChatConversation,
  body?: string | null,
) => {
  if (!isEncryptedCommunicationValue(body)) {
    return body ?? null;
  }

  const conversationKey = await resolveConversationKey(conversation);

  if (!conversationKey) {
    return ENCRYPTED_MESSAGE_FALLBACK;
  }

  return decryptCommunicationValue(
    body,
    conversationKey,
    additionalAuthenticatedData(conversation.id),
    ENCRYPTED_MESSAGE_FALLBACK
  );
};

export const decryptChatConversation = async (conversation: ChatConversation) => {
  const nextConversation: ChatConversation = {
    ...conversation,
    participants: conversation.participants.map((participant) => ({ ...participant })),
    encryption: conversation.encryption ? { ...conversation.encryption } : conversation.encryption,
    last_message: conversation.last_message
      ? {
          ...conversation.last_message,
          body: await decryptChatMessageBody(conversation, conversation.last_message.body),
        }
      : conversation.last_message,
  };

  return nextConversation;
};

export const decryptChatConversations = async (conversations: ChatConversation[]) => {
  return Promise.all(conversations.map((conversation) => decryptChatConversation(conversation)));
};

export const decryptChatMessage = async (
  message: ChatMessage,
  conversation: ChatConversation,
) => {
  return {
    ...message,
    metadata: message.metadata ? { ...message.metadata } : message.metadata,
    sender: message.sender ? { ...message.sender } : message.sender,
    body: await decryptChatMessageBody(conversation, message.body),
  } as ChatMessage;
};

export const decryptChatMessages = async (
  messages: ChatMessage[],
  conversation: ChatConversation,
) => {
  return Promise.all(messages.map((message) => decryptChatMessage(message, conversation)));
};

export const getChatCallEncryptionMaterial = async (conversation: ChatConversation) => {
  const updatedConversation = await bootstrapConversationEncryption(conversation);
  const conversationKey = await resolveConversationKey(updatedConversation);

  if (!conversationKey) {
    throw new Error('End-to-end encryption must be enabled before starting a video call.');
  }

  return {
    material: await exportCommunicationKeyMaterial(conversationKey),
    conversation: updatedConversation,
  };
};

export const getEndToEndEncryptionLabel = () => COMMUNICATION_SHARED_KEY_ALGORITHM;
