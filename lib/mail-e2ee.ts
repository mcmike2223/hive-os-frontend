import api from '@/lib/api';
import {
  COMMUNICATION_SHARED_KEY_ALGORITHM,
  CommunicationEncryptionConfig,
  createWrappedCommunicationKey,
  decryptCommunicationValue,
  ensureCommunicationIdentity,
  exportCommunicationKeyMaterial,
  encryptCommunicationValue,
  getEncryptedCommunicationFallback,
  getStoredCommunicationUser,
  isEncryptedCommunicationValue,
  resolveWrappedCommunicationKey,
} from '@/lib/communication-e2ee';
import { MailParticipant, useMailStore } from '@/store/mail-store';

const ENCRYPTED_MAIL_SUBJECT_FALLBACK = 'Encrypted subject';
const ENCRYPTED_MAIL_BODY_FALLBACK = 'Encrypted message';
const MAIL_SUBJECT_AAD = 'hive-mail:subject:v1';
const MAIL_BODY_AAD = 'hive-mail:body:v1';

const messageKeyCache = new Map<string, CryptoKey>();

export const defaultMailEncryptionConfig: CommunicationEncryptionConfig = {
  enabled: false,
  algorithm: null,
  public_key: null,
  fingerprint: null,
};

const getMailCacheKey = (mailMessageId: number | string) => String(mailMessageId);

export const fetchMailEncryptionConfig = async (): Promise<CommunicationEncryptionConfig> => {
  try {
    const { data } = await api.get('/mail/config');

    return data?.encryption || defaultMailEncryptionConfig;
  } catch {
    return defaultMailEncryptionConfig;
  }
};

export const isEncryptedMailValue = (value?: string | null) => isEncryptedCommunicationValue(value);

export const getEncryptedMailSubjectFallback = () => getEncryptedCommunicationFallback(ENCRYPTED_MAIL_SUBJECT_FALLBACK);

export const getEncryptedMailBodyFallback = () => getEncryptedCommunicationFallback(ENCRYPTED_MAIL_BODY_FALLBACK);

export const ensureMailEncryptionIdentity = async (
  config: CommunicationEncryptionConfig | null | undefined,
) => {
  return ensureCommunicationIdentity(config, async (identity) => {
    await api.post('/mail/encryption/public-key', {
      public_key: identity.publicKey,
      algorithm: identity.algorithm,
      fingerprint: identity.fingerprint,
    });

    useMailStore.getState().setEncryptionConfig({
      enabled: Boolean(config?.enabled),
      algorithm: config?.algorithm ?? identity.algorithm,
      public_key: identity.publicKey,
      fingerprint: identity.fingerprint,
    });
  });
};

const resolveMailMessageKey = async (participant: MailParticipant) => {
  const cacheId = getMailCacheKey(participant.mail_message_id);
  const cachedKey = messageKeyCache.get(cacheId);

  if (cachedKey) {
    return cachedKey;
  }

  if (!participant.message?.encryption?.wrapped_key) {
    return null;
  }

  const identity = await ensureMailEncryptionIdentity(useMailStore.getState().encryptionConfig);

  if (!identity) {
    return null;
  }

  const sharedKey = await resolveWrappedCommunicationKey(participant.message.encryption.wrapped_key, identity);
  messageKeyCache.set(cacheId, sharedKey);

  return sharedKey;
};

export const encryptMailDraft = async ({
  subject,
  body,
  recipients,
}: {
  subject: string;
  body: string;
  recipients: Array<{ id: number | string; name?: string | null; chat_public_key?: string | null }>;
}) => {
  const encryptionConfig = useMailStore.getState().encryptionConfig;

  if (!encryptionConfig.enabled) {
    return {
      encrypted: false,
      subject,
      body,
      participant_keys: undefined,
    };
  }

  const identity = await ensureMailEncryptionIdentity(encryptionConfig);
  const currentUser = getStoredCommunicationUser<{ id: number; name: string }>();

  if (!identity || !currentUser?.id) {
    throw new Error('Secure mail identity is unavailable.');
  }

  const uniqueRecipients = new Map<string, { id: number | string; name?: string | null; chat_public_key?: string | null }>();

  recipients.forEach((recipient) => {
    uniqueRecipients.set(String(recipient.id), recipient);
  });

  const missingRecipients = Array.from(uniqueRecipients.values()).filter((recipient) => !recipient.chat_public_key);

  if (missingRecipients.length > 0) {
    const missingNames = missingRecipients
      .map((recipient) => recipient.name || `User ${recipient.id}`)
      .join(', ');

    throw new Error(`${missingNames} must open secure chat or secure mail once before encrypted email can be sent.`);
  }

  const { sharedKey, wrappedKeys } = await createWrappedCommunicationKey([
    {
      id: currentUser.id,
      publicKey: identity.publicKey,
    },
    ...Array.from(uniqueRecipients.values()).map((recipient) => ({
      id: recipient.id,
      publicKey: recipient.chat_public_key as string,
    })),
  ]);

  return {
    encrypted: true,
    subject: subject ? await encryptCommunicationValue(subject, sharedKey, MAIL_SUBJECT_AAD) : subject,
    body: body ? await encryptCommunicationValue(body, sharedKey, MAIL_BODY_AAD) : body,
    participant_keys: wrappedKeys,
  };
};

export const decryptMailParticipant = async (participant: MailParticipant) => {
  const nextParticipant: MailParticipant = {
    ...participant,
    message: {
      ...participant.message,
      sender: participant.message.sender ? { ...participant.message.sender } : participant.message.sender,
      participants: participant.message.participants.map((recipient) => ({
        ...recipient,
        user: recipient.user ? { ...recipient.user } : recipient.user,
      })),
      encryption: participant.message.encryption
        ? { ...participant.message.encryption }
        : participant.message.encryption,
    },
  };

  const subjectIsEncrypted = isEncryptedMailValue(participant.message?.subject);
  const bodyIsEncrypted = isEncryptedMailValue(participant.message?.body);

  if (!subjectIsEncrypted && !bodyIsEncrypted) {
    return nextParticipant;
  }

  const sharedKey = await resolveMailMessageKey(participant);

  if (!sharedKey) {
    return {
      ...nextParticipant,
      message: {
        ...nextParticipant.message,
        subject: subjectIsEncrypted ? ENCRYPTED_MAIL_SUBJECT_FALLBACK : nextParticipant.message.subject,
        body: bodyIsEncrypted ? ENCRYPTED_MAIL_BODY_FALLBACK : nextParticipant.message.body,
      },
    };
  }

  return {
    ...nextParticipant,
    message: {
      ...nextParticipant.message,
      subject: subjectIsEncrypted
        ? await decryptCommunicationValue(
            participant.message.subject,
            sharedKey,
            MAIL_SUBJECT_AAD,
            ENCRYPTED_MAIL_SUBJECT_FALLBACK
          )
        : nextParticipant.message.subject,
      body: bodyIsEncrypted
        ? await decryptCommunicationValue(
            participant.message.body,
            sharedKey,
            MAIL_BODY_AAD,
            ENCRYPTED_MAIL_BODY_FALLBACK
          )
        : nextParticipant.message.body,
    },
  };
};

export const decryptMailParticipants = async (participants: MailParticipant[]) => {
  return Promise.all(participants.map((participant) => decryptMailParticipant(participant)));
};

export const getMailCallEncryptionMaterial = async (participant: MailParticipant) => {
  const sharedKey = await resolveMailMessageKey(participant);

  if (!sharedKey) {
    throw new Error('This message has no end-to-end encryption key. Start the call from an encrypted sent message.');
  }

  return exportCommunicationKeyMaterial(sharedKey);
};
