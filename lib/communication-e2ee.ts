import { getTenantId } from '@/lib/runtime-context';

export const COMMUNICATION_ENVELOPE_PREFIX = 'hive-e2ee:v1:';
export const COMMUNICATION_IDENTITY_ALGORITHM = 'RSA-OAEP-2048/SHA-256';
export const COMMUNICATION_SHARED_KEY_ALGORITHM = 'rsa-oaep-aes-gcm-v1';

const COMMUNICATION_IDENTITY_PREFIX = 'hive-communication-e2ee:';
const LEGACY_CHAT_IDENTITY_PREFIX = 'hive-chat-e2ee:';

export type CommunicationEncryptionConfig = {
  enabled: boolean;
  algorithm?: string | null;
  public_key?: string | null;
  fingerprint?: string | null;
};

export type CommunicationStoredIdentity = {
  publicKey: string;
  privateKey: string;
  fingerprint: string;
  algorithm: string;
};

type EncryptedEnvelope = {
  version: '1';
  algorithm: 'AES-GCM-256';
  iv: string;
  ciphertext: string;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const getStoredCommunicationUser = <T = { id: number; name: string }>() => {
  if (typeof window === 'undefined') {
    return null as T | null;
  }

  const userStr = localStorage.getItem('hive_user') || localStorage.getItem('user');

  if (!userStr) {
    return null as T | null;
  }

  try {
    return JSON.parse(userStr) as T;
  } catch {
    return null as T | null;
  }
};

const toBase64 = (bytes: Uint8Array) => {
  let binary = '';

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary);
};

const fromBase64 = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
};

const identityNamespace = () => getTenantId() || 'central';

const identityStorageKey = (prefix: string, userId: number) => {
  return `${prefix}${identityNamespace()}:${userId}`;
};

const readRawStoredIdentity = (key: string): CommunicationStoredIdentity | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = localStorage.getItem(key);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as CommunicationStoredIdentity;
  } catch {
    return null;
  }
};

const readStoredIdentity = (userId: number): CommunicationStoredIdentity | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const modernKey = identityStorageKey(COMMUNICATION_IDENTITY_PREFIX, userId);
  const modernIdentity = readRawStoredIdentity(modernKey);

  if (modernIdentity) {
    return modernIdentity;
  }

  const legacyIdentity = readRawStoredIdentity(identityStorageKey(LEGACY_CHAT_IDENTITY_PREFIX, userId));

  if (legacyIdentity) {
    localStorage.setItem(modernKey, JSON.stringify(legacyIdentity));
  }

  return legacyIdentity;
};

const writeStoredIdentity = (userId: number, identity: CommunicationStoredIdentity) => {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem(identityStorageKey(COMMUNICATION_IDENTITY_PREFIX, userId), JSON.stringify(identity));
};

const exportKeyToBase64 = async (format: 'pkcs8' | 'spki', key: CryptoKey) => {
  const exported = await crypto.subtle.exportKey(format, key);

  return toBase64(new Uint8Array(exported));
};

const computeFingerprint = async (publicKey: string) => {
  const digest = await crypto.subtle.digest('SHA-256', fromBase64(publicKey));

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

const generateIdentity = async (): Promise<CommunicationStoredIdentity> => {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt']
  );

  const publicKey = await exportKeyToBase64('spki', keyPair.publicKey);
  const privateKey = await exportKeyToBase64('pkcs8', keyPair.privateKey);

  return {
    publicKey,
    privateKey,
    fingerprint: await computeFingerprint(publicKey),
    algorithm: COMMUNICATION_IDENTITY_ALGORITHM,
  };
};

const importPublicKey = (publicKey: string) => {
  return crypto.subtle.importKey(
    'spki',
    fromBase64(publicKey),
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    false,
    ['encrypt']
  );
};

const importPrivateKey = (privateKey: string) => {
  return crypto.subtle.importKey(
    'pkcs8',
    fromBase64(privateKey),
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    false,
    ['decrypt']
  );
};

const importSharedKey = (rawKey: ArrayBuffer) => {
  return crypto.subtle.importKey(
    'raw',
    rawKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );
};

export const exportCommunicationKeyMaterial = async (sharedKey: CryptoKey) => {
  return crypto.subtle.exportKey('raw', sharedKey);
};

export const wrapCommunicationKeyMaterial = async (
  rawSharedKey: ArrayBuffer,
  recipients: Array<{ id: number | string; publicKey: string }>,
) => {
  const wrappedKeys: Record<string, string> = {};

  await Promise.all(
    recipients.map(async (recipient) => {
      const publicKey = await importPublicKey(recipient.publicKey);
      const wrappedKey = await crypto.subtle.encrypt(
        { name: 'RSA-OAEP' },
        publicKey,
        rawSharedKey
      );

      wrappedKeys[String(recipient.id)] = toBase64(new Uint8Array(wrappedKey));
    })
  );

  return wrappedKeys;
};

const serializeEncryptedEnvelope = (payload: EncryptedEnvelope) => {
  return `${COMMUNICATION_ENVELOPE_PREFIX}${btoa(JSON.stringify(payload))}`;
};

const parseEncryptedEnvelope = (value?: string | null): EncryptedEnvelope | null => {
  if (!value || !value.startsWith(COMMUNICATION_ENVELOPE_PREFIX)) {
    return null;
  }

  try {
    const decoded = atob(value.slice(COMMUNICATION_ENVELOPE_PREFIX.length));

    return JSON.parse(decoded) as EncryptedEnvelope;
  } catch {
    return null;
  }
};

export const isEncryptedCommunicationValue = (value?: string | null) => Boolean(parseEncryptedEnvelope(value));

export const getEncryptedCommunicationFallback = (label = 'Encrypted message') => label;

export const ensureCommunicationIdentity = async (
  config: CommunicationEncryptionConfig | null | undefined,
  syncIdentity: (identity: CommunicationStoredIdentity) => Promise<void>,
): Promise<CommunicationStoredIdentity | null> => {
  if (typeof window === 'undefined' || !config?.enabled) {
    return null;
  }

  const user = getStoredCommunicationUser<{ id: number }>();

  if (!user?.id) {
    return null;
  }

  let identity = readStoredIdentity(user.id);

  if (!identity) {
    identity = await generateIdentity();
    writeStoredIdentity(user.id, identity);
  }

  if (config.public_key !== identity.publicKey || config.fingerprint !== identity.fingerprint) {
    await syncIdentity(identity);
  }

  return identity;
};

export const createWrappedCommunicationKey = async (
  recipients: Array<{ id: number | string; publicKey: string }>,
) => {
  const sharedKey = await crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );

  const rawSharedKey = await crypto.subtle.exportKey('raw', sharedKey);
  const wrappedKeys = await wrapCommunicationKeyMaterial(rawSharedKey, recipients);

  return {
    sharedKey,
    wrappedKeys,
  };
};

export const resolveWrappedCommunicationKey = async (
  wrappedKey: string,
  identity: CommunicationStoredIdentity,
) => {
  const privateKey = await importPrivateKey(identity.privateKey);
  const rawSharedKey = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    fromBase64(wrappedKey).buffer
  );

  return importSharedKey(rawSharedKey);
};

export const encryptCommunicationValue = async (
  value: string,
  sharedKey: CryptoKey,
  aadContext: string,
) => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: textEncoder.encode(aadContext),
    },
    sharedKey,
    textEncoder.encode(value)
  );

  return serializeEncryptedEnvelope({
    version: '1',
    algorithm: 'AES-GCM-256',
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  });
};

export const decryptCommunicationValue = async (
  payload: string | null | undefined,
  sharedKey: CryptoKey,
  aadContext: string,
  fallback: string,
) => {
  const envelope = parseEncryptedEnvelope(payload);

  if (!envelope) {
    return payload ?? null;
  }

  try {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: fromBase64(envelope.iv),
        additionalData: textEncoder.encode(aadContext),
      },
      sharedKey,
      fromBase64(envelope.ciphertext)
    );

    return textDecoder.decode(plaintext);
  } catch {
    return fallback;
  }
};
