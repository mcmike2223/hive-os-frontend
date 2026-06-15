"use client";

import { onlineManager, type QueryClient } from "@tanstack/react-query";

import { getAuthHeaders, getBackendApiRoot } from "@/lib/runtime-context";
import { getOfflineStorageKey } from "@/lib/offline/storage";
import type { OfflineQueueResult } from "@/lib/offline/mutation-queue";

/**
 * Offline queue for FILE uploads. Unlike the JSON mutation/request queues
 * (localStorage), binary file bodies are stored in IndexedDB so they survive a
 * reload and can be replayed once connectivity returns. Replays use the same
 * chunked multipart contract as the live uploader (/files/upload).
 */

const DB_NAME = "hive-offline";
const DB_VERSION = 1;
const STORE = "uploads";
const CHUNK_SIZE = 5 * 1024 * 1024; // mirrors the live file-manager uploader
const UPLOAD_CHANGE_EVENT = "hive_offline_upload_change";
const QUEUE_RESULT_EVENT = "hive_offline_queue_result";

export type PendingUploadInput = {
  /** Absolute endpoint; defaults to <api>/files/upload. */
  url?: string;
  file: File | Blob;
  fileName: string;
  fileType?: string;
  /** Extra string form fields, e.g. { folder_id, base_name }. */
  fields?: Record<string, string>;
  thumbnail?: File | Blob | null;
  label: string;
};

type PendingUploadRecord = {
  id: string;
  scope: string;
  url: string;
  fileName: string;
  fileType: string;
  file: Blob;
  fields: Record<string, string>;
  thumbName?: string;
  thumb?: Blob;
  label: string;
  createdAt: string;
};

const isBrowser = (): boolean => typeof window !== "undefined" && typeof indexedDB !== "undefined";

const scope = (): string => getOfflineStorageKey("uploads");

let cachedCount = 0;
const subscribers = new Set<() => void>();

const notify = (): void => {
  subscribers.forEach((fn) => fn());
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(UPLOAD_CHANGE_EVENT));
  }
};

const emitResult = (result: OfflineQueueResult): void => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<OfflineQueueResult>(QUEUE_RESULT_EVENT, { detail: result }));
};

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("scope", "scope", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const tx = async <T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const store = transaction.objectStore(STORE);
    const request = run(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
};

const generateId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const getAllForScope = async (): Promise<PendingUploadRecord[]> => {
  if (!isBrowser()) return [];
  const all = (await tx<PendingUploadRecord[]>("readonly", (store) => store.getAll())) ?? [];
  const current = scope();
  return all
    .filter((r) => r.scope === current)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
};

export const refreshUploadQueueCount = async (): Promise<number> => {
  if (!isBrowser()) return 0;
  try {
    const items = await getAllForScope();
    cachedCount = items.length;
  } catch {
    cachedCount = 0;
  }
  notify();
  return cachedCount;
};

export const getUploadQueueCount = (): number => cachedCount;

export const subscribeUploadQueue = (listener: () => void): (() => void) => {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
};

export const enqueueFileUpload = async (input: PendingUploadInput): Promise<string> => {
  const id = generateId();
  const record: PendingUploadRecord = {
    id,
    scope: scope(),
    url: input.url || `${getBackendApiRoot()}/files/upload`,
    fileName: input.fileName,
    fileType: input.fileType || (input.file as File).type || "application/octet-stream",
    file: input.file,
    fields: input.fields ?? {},
    label: input.label,
    createdAt: new Date().toISOString(),
  };
  if (input.thumbnail) {
    record.thumb = input.thumbnail;
    record.thumbName = (input.thumbnail as File).name || "thumbnail";
  }

  await tx("readwrite", (store) => store.put(record));
  cachedCount += 1;
  notify();
  emitResult({ type: "queued", id, label: input.label, url: record.url });
  return id;
};

export const removeFileUpload = async (id: string): Promise<void> => {
  await tx("readwrite", (store) => store.delete(id));
  await refreshUploadQueueCount();
};

export const clearFileUploadQueue = async (): Promise<void> => {
  const items = await getAllForScope();
  await Promise.all(items.map((item) => tx("readwrite", (store) => store.delete(item.id))));
  await refreshUploadQueueCount();
};

const isNetworkFailure = (error: unknown): boolean => {
  if (error instanceof TypeError) return true;
  return Boolean(error && typeof error === "object" && (error as { name?: string }).name === "TypeError");
};

/** Replays one stored upload using the chunked multipart contract. */
const replayUpload = async (record: PendingUploadRecord): Promise<void> => {
  const file = record.file;
  const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
  const uploadId = `${Date.now()}-${record.fileName.replace(/[^a-zA-Z0-9]/g, "_")}`;

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * CHUNK_SIZE;
    const chunk = file.slice(start, Math.min(start + CHUNK_SIZE, file.size));

    const form = new FormData();
    form.append("file", chunk);
    form.append("chunk_index", String(chunkIndex));
    form.append("total_chunks", String(totalChunks));
    form.append("upload_id", uploadId);
    form.append("original_name", record.fileName);
    for (const [key, value] of Object.entries(record.fields)) {
      form.append(key, value);
    }
    if (chunkIndex === totalChunks - 1 && record.thumb) {
      form.append("custom_thumbnail", record.thumb, record.thumbName || "thumbnail");
    }

    const res = await fetch(record.url, {
      method: "POST",
      headers: getAuthHeaders(),
      // Skip the fetch offline-interceptor: we ARE the replay path.
      body: form,
    });

    if (!res.ok) {
      const err = new Error(`Upload failed (${res.status})`) as Error & { status?: number };
      err.status = res.status;
      throw err;
    }
  }
};

let isProcessing = false;

export const processFileUploadQueue = async (queryClient?: QueryClient): Promise<void> => {
  if (!isBrowser() || !onlineManager.isOnline() || isProcessing) return;
  isProcessing = true;
  let syncedAny = false;

  try {
    let items = await getAllForScope();

    for (const record of items) {
      if (!onlineManager.isOnline()) break;
      try {
        await replayUpload(record);
        await tx("readwrite", (store) => store.delete(record.id));
        cachedCount = Math.max(0, cachedCount - 1);
        syncedAny = true;
        emitResult({ type: "processed", id: record.id, label: record.label, url: record.url });
      } catch (error) {
        const status = (error as { status?: number }).status;
        if (isNetworkFailure(error) || status === undefined || status >= 500 || status === 408 || status === 429) {
          // Transient — stop and retry on the next sync pass.
          break;
        }
        // Permanent failure (4xx) — drop so it cannot poison the queue.
        await tx("readwrite", (store) => store.delete(record.id));
        cachedCount = Math.max(0, cachedCount - 1);
        emitResult({
          type: "dropped",
          id: record.id,
          label: record.label,
          reason: (error as Error).message || "Upload rejected",
          url: record.url,
        });
      }
    }
  } finally {
    isProcessing = false;
    notify();
    if (syncedAny && queryClient) {
      void queryClient.invalidateQueries({ queryKey: ["files"] });
      void queryClient.invalidateQueries({ queryKey: ["folders"] });
    }
  }
};
