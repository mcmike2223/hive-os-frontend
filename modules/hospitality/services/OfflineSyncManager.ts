/**
 * Offline Sync Manager for Mobile Waiter POS & Offline Terminal Resilience.
 * Caches offline orders in LocalStorage/IndexedDB and automatically syncs
 * with backend idempotency headers when network connectivity resumes.
 */

export interface OfflineOrderPayload {
  idempotencyKey: string;
  outletId: number;
  locationId: number;
  guestCount: number;
  orderTypeCode: string;
  items: Array<{
    itemId: number;
    itemName: string;
    quantity: number;
    unitPrice: number;
    seatNumber?: number;
    courseNumber?: number;
    notes?: string;
  }>;
  createdAt: string;
}

const STORAGE_KEY = "hive_hospitality_offline_order_queue";

const createOfflineIdempotencyKey = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const value = Math.floor(Math.random() * 16);
    return (character === "x" ? value : (value & 0x3) | 0x8).toString(16);
  });
};

export class OfflineSyncManager {
  /**
   * Queue order payload to local storage when network is offline.
   */
  static enqueueOfflineOrder(payload: Omit<OfflineOrderPayload, "idempotencyKey" | "createdAt">): OfflineOrderPayload {
    const queue = this.getQueue();
    const entry: OfflineOrderPayload = {
      ...payload,
      idempotencyKey: createOfflineIdempotencyKey(),
      createdAt: new Date().toISOString(),
    };

    queue.push(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    return entry;
  }

  /**
   * Retrieve current pending offline queue.
   */
  static getQueue(): OfflineOrderPayload[] {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  /**
   * Clear processed order from offline queue.
   */
  static dequeueOrder(idempotencyKey: string): void {
    const queue = this.getQueue().filter((item) => item.idempotencyKey !== idempotencyKey);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  }

  /**
   * Register auto-sync listeners when online event triggers.
   */
  static registerAutoSync(syncCallback: (order: OfflineOrderPayload) => Promise<boolean>): void {
    if (typeof window === "undefined") return;

    const processQueue = async () => {
      if (!navigator.onLine) return;
      const queue = this.getQueue();
      for (const order of queue) {
        try {
          const success = await syncCallback(order);
          if (success) {
            this.dequeueOrder(order.idempotencyKey);
          }
        } catch (err) {
          console.error("Failed to sync offline order:", order.idempotencyKey, err);
        }
      }
    };

    window.addEventListener("online", processQueue);
  }
}
