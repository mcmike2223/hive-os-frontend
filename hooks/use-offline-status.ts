"use client";

import { onlineManager } from "@tanstack/react-query";
import { useEffect, useSyncExternalStore } from "react";

import {
  getEmptyOfflineMutationQueue,
  readOfflineMutationQueue,
  subscribeOfflineMutationQueue,
} from "@/lib/offline/mutation-queue";
import { getUploadQueueCount, subscribeUploadQueue } from "@/lib/offline/file-upload-queue";

const SERVER_SNAPSHOT_QUEUE: typeof getEmptyOfflineMutationQueue = () => [];

const getClientIsOnline = (): boolean => {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return true;
  }
  if (typeof onlineManager?.isOnline === "function") {
    return onlineManager.isOnline();
  }
  return navigator.onLine;
};

const getServerIsOnline = (): boolean => true;

const subscribeToOnlineManager = (listener: () => void): (() => void) => {
  const unsubscribe = onlineManager.subscribe(listener);
  if (typeof window === "undefined") {
    return unsubscribe;
  }
  const handleOnline = () => listener();
  const handleOffline = () => listener();
  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  return () => {
    unsubscribe();
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
};

export const useOfflineStatus = () => {
  const isOnline = useSyncExternalStore(
    subscribeToOnlineManager,
    getClientIsOnline,
    getServerIsOnline,
  );

  const queuedMutations = useSyncExternalStore(
    subscribeOfflineMutationQueue,
    readOfflineMutationQueue,
    SERVER_SNAPSHOT_QUEUE,
  );

  const queuedUploads = useSyncExternalStore(
    subscribeUploadQueue,
    getUploadQueueCount,
    () => 0,
  );

  useEffect(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      return;
    }
    if (typeof navigator.onLine === "boolean" && navigator.onLine !== onlineManager.isOnline()) {
      onlineManager.setOnline(navigator.onLine);
    }
  }, []);

  return {
    isOnline,
    isOffline: !isOnline,
    queuedCount: queuedMutations.length + queuedUploads,
    queuedMutations,
    queuedUploads,
  };
};
