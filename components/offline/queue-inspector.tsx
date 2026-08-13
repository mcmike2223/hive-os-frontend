"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bug,
  Download,
  Play,
  Trash2,
  X,
  RotateCcw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useOfflineStatus } from "@/hooks/use-offline-status";
import {
  clearOfflineQueue,
  processOfflineMutationQueue,
  readOfflineMutationQueue,
  removeOfflineQueueItem,
  type OfflineQueueItem,
  type OfflineQueueResult,
} from "@/lib/offline/mutation-queue";

const QUEUE_RESULT_EVENT_NAME = "hive_offline_queue_result";
const QUEUE_CHANGE_EVENT_NAME = "hive_offline_queue_change";
const PANEL_STORAGE_KEY = "hive_offline_inspector_open";
const POSITION_STORAGE_KEY = "hive_offline_inspector_pos";
const TOGGLE_EVENT_NAME = "hive_offline_inspector_toggle";
const HISTORY_LIMIT = 20;

type HistoryEntry = OfflineQueueResult & { at: number };

const formatAge = (iso: string): string => {
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return "just now";
  const sec = Math.floor(ms / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
};

const describeItem = (item: OfflineQueueItem): string => {
  if (item.kind === "request") {
    return `${item.method} ${item.url}`;
  }
  return item.key;
};

const formatBytes = (n: number): string => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
};

const itemSize = (item: OfflineQueueItem): number => {
  try {
    return new Blob([JSON.stringify(item)]).size;
  } catch {
    return 0;
  }
};

const exportQueue = (queue: OfflineQueueItem[]): void => {
  if (typeof window === "undefined") return;
  const blob = new Blob(
    [JSON.stringify({ exportedAt: new Date().toISOString(), queue }, null, 2)],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `offline-queue-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const readBool = (key: string, fallback: boolean): boolean => {
  if (typeof window === "undefined") return fallback;
  const v = window.localStorage.getItem(key);
  if (v === null) return fallback;
  return v === "1" || v === "true";
};

const writeBool = (key: string, value: boolean): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, value ? "1" : "0");
};

type Position = { x: number; y: number };

const readPosition = (): Position => {
  if (typeof window === "undefined") return { x: 0, y: 0 };
  try {
    const raw = window.localStorage.getItem(POSITION_STORAGE_KEY);
    if (!raw) return { x: 0, y: 0 };
    const parsed = JSON.parse(raw) as Partial<Position>;
    return {
      x: typeof parsed.x === "number" ? parsed.x : 0,
      y: typeof parsed.y === "number" ? parsed.y : 0,
    };
  } catch {
    return { x: 0, y: 0 };
  }
};

const writePosition = (pos: Position): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(pos));
};

export function OfflineQueueInspector() {
  const { isOnline, queuedCount } = useOfflineStatus();
  const queryClient = useQueryClient();

  const [open, setOpen] = React.useState<boolean>(false);
  const [queue, setQueue] = React.useState<OfflineQueueItem[]>([]);
  const [history, setHistory] = React.useState<HistoryEntry[]>([]);
  const [processing, setProcessing] = React.useState<boolean>(false);
  const [position, setPosition] = React.useState<Position>({ x: 0, y: 0 });
  const [dragging, setDragging] = React.useState<boolean>(false);

  const dragOriginRef = React.useRef<{
    pointerX: number;
    pointerY: number;
    posX: number;
    posY: number;
  } | null>(null);
  const buttonRef = React.useRef<HTMLButtonElement | null>(null);
  const panelRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    setOpen(readBool(PANEL_STORAGE_KEY, false));
    setPosition(readPosition());
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<OfflineQueueResult>).detail;
      if (!detail) return;
      setHistory((prev) =>
        [{ ...detail, at: Date.now() }, ...prev].slice(0, HISTORY_LIMIT),
      );
    };
    window.addEventListener(QUEUE_RESULT_EVENT_NAME, handler as EventListener);
    return () =>
      window.removeEventListener(QUEUE_RESULT_EVENT_NAME, handler as EventListener);
  }, []);

  React.useEffect(() => {
    setQueue(readOfflineMutationQueue());
  }, [queuedCount]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => setQueue(readOfflineMutationQueue());
    window.addEventListener(QUEUE_CHANGE_EVENT_NAME, handler);
    return () => window.removeEventListener(QUEUE_CHANGE_EVENT_NAME, handler);
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => {
      setOpen((prev) => {
        const next = !prev;
        writeBool(PANEL_STORAGE_KEY, next);
        return next;
      });
    };
    window.addEventListener(TOGGLE_EVENT_NAME, handler);
    return () => window.removeEventListener(TOGGLE_EVENT_NAME, handler);
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === "o"
      ) {
        event.preventDefault();
        window.dispatchEvent(new Event(TOGGLE_EVENT_NAME));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined" || !open) return;
    const handler = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (panelRef.current && panelRef.current.contains(target)) return;
      if (buttonRef.current && buttonRef.current.contains(target)) return;
      setOpen(false);
      writeBool(PANEL_STORAGE_KEY, false);
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  const handleProcessNow = React.useCallback(async () => {
    if (processing) return;
    setProcessing(true);
    try {
      await processOfflineMutationQueue(queryClient);
      setQueue(readOfflineMutationQueue());
    } finally {
      setProcessing(false);
    }
  }, [processing, queryClient]);

  const handleClear = React.useCallback(() => {
    if (queue.length === 0) return;
    if (typeof window !== "undefined") {
      const ok = window.confirm(
        `Discard all ${queue.length} queued change${queue.length === 1 ? "" : "s"}? This cannot be undone.`,
      );
      if (!ok) return;
    }
    clearOfflineQueue();
    setQueue(readOfflineMutationQueue());
  }, [queue.length]);

  const handleRemove = React.useCallback((id: string) => {
    removeOfflineQueueItem(id);
    setQueue(readOfflineMutationQueue());
  }, []);

  const handleToggle = React.useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      writeBool(PANEL_STORAGE_KEY, next);
      return next;
    });
  }, []);

  const movedDuringDragRef = React.useRef<boolean>(false);

  const handlePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;
      const target = event.currentTarget;
      target.setPointerCapture(event.pointerId);
      dragOriginRef.current = {
        pointerX: event.clientX,
        pointerY: event.clientY,
        posX: position.x,
        posY: position.y,
      };
      movedDuringDragRef.current = false;
      setDragging(true);
    },
    [position.x, position.y],
  );

  const handlePointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (!dragging || !dragOriginRef.current) return;
      const origin = dragOriginRef.current;
      const dx = event.clientX - origin.pointerX;
      const dy = event.clientY - origin.pointerY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        movedDuringDragRef.current = true;
      }
      setPosition({
        x: origin.posX - dx,
        y: origin.posY - dy,
      });
    },
    [dragging],
  );

  const handlePointerUp = React.useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      setDragging(false);
      const origin = dragOriginRef.current;
      dragOriginRef.current = null;
      if (origin) {
        const dx = event.clientX - origin.pointerX;
        const dy = event.clientY - origin.pointerY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          writePosition({
            x: origin.posX - dx,
            y: origin.posY - dy,
          });
        }
      }
      if (!movedDuringDragRef.current) {
        handleToggle();
      }
    },
    [handleToggle],
  );

  const totalBytes = queue.reduce((sum, item) => sum + itemSize(item), 0);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        title={`Offline queue inspector (${queuedCount} pending) — drag to move, Ctrl+Shift+O to toggle`}
        aria-label="Offline queue inspector"
        data-testid="offline-queue-inspector-toggle"
        className={`fixed z-[130] inline-flex h-11 w-11 cursor-grab items-center justify-center rounded-full border border-border bg-background/95 text-foreground shadow-lg backdrop-blur-md transition-colors hover:bg-accent active:cursor-grabbing ${dragging ? "cursor-grabbing" : ""}`}
        style={{
          right: `${16 - position.x}px`,
          bottom: `${16 - position.y}px`,
        }}
      >
        <Bug className="h-4 w-4" />
        {queuedCount > 0 && (
          <span
            className={`absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold text-white ${isOnline ? "bg-emerald-500" : "bg-amber-500"}`}
            aria-hidden
          >
            {queuedCount > 99 ? "99+" : queuedCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Offline queue inspector"
          data-testid="offline-queue-inspector-panel"
          className="fixed z-[131] flex w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-2xl"
          style={{
            right: `${16 - position.x}px`,
            bottom: `${76 - position.y}px`,
            maxHeight: "min(560px, calc(100vh - 8rem))",
          }}
        >
          <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2">
            <div className="flex items-center gap-2">
              <Bug className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">Offline queue</span>
              <span
                className={`inline-flex h-4 items-center rounded-full px-1.5 text-[11px] font-medium ${isOnline ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/15 text-amber-700 dark:text-amber-300"}`}
              >
                {isOnline ? "online" : "offline"}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                onClick={() => exportQueue(queue)}
                disabled={queue.length === 0}
                title="Export queue as JSON"
                aria-label="Export queue"
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                onClick={handleToggle}
                title="Close"
                aria-label="Close inspector"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-b border-border bg-muted/20 px-3 py-1.5 text-[11px] text-muted-foreground">
            <span>
              <span className="font-semibold text-foreground">{queue.length}</span> pending
            </span>
            <span aria-hidden>·</span>
            <span>{formatBytes(totalBytes)}</span>
            <span aria-hidden>·</span>
            <span>
              {history[0]
                ? `last: ${history[0].type === "processed" ? "synced" : history[0].type === "dropped" ? "dropped" : "queued"}`
                : "no activity yet"}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {queue.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-1 px-4 py-8 text-center text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Queue is empty</span>
                <span>Mutations made while offline will appear here.</span>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {queue.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start gap-2 px-3 py-2 hover:bg-muted/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{item.label}</p>
                      <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                        {describeItem(item)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {formatAge(item.createdAt)} · {formatBytes(itemSize(item))}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      onClick={() => handleRemove(item.id)}
                      title="Remove this item"
                      aria-label="Remove queued item"
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {history.length > 0 && (
            <div className="max-h-32 overflow-y-auto border-t border-border bg-muted/20">
              <p className="px-3 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Recent activity
              </p>
              <ul className="px-3 py-1">
                {history.map((entry, i) => (
                  <li
                    key={`${entry.id}-${i}`}
                    className="flex items-center gap-2 py-0.5 text-[11px]"
                  >
                    <span
                      className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                        entry.type === "processed"
                          ? "bg-emerald-500"
                          : entry.type === "dropped"
                            ? "bg-rose-500"
                            : "bg-amber-500"
                      }`}
                      aria-hidden
                    />
                    <span className="truncate text-muted-foreground">
                      {entry.type === "processed" && `Synced ${entry.label}`}
                      {entry.type === "dropped" &&
                        `Dropped ${entry.label}${"reason" in entry && entry.reason ? ` — ${entry.reason}` : ""}`}
                      {entry.type === "queued" && `Queued ${entry.label}`}
                    </span>
                    <span className="ml-auto shrink-0 text-[11px] text-muted-foreground/70">
                      {formatAge(new Date(entry.at).toISOString())}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-1.5 border-t border-border bg-muted/30 px-3 py-2">
            <Button
              type="button"
              size="sm"
              variant="default"
              onClick={handleProcessNow}
              disabled={processing || queue.length === 0}
              className="h-7 flex-1 gap-1.5 text-xs"
            >
              {processing ? (
                <RotateCcw className="h-3 w-3 animate-spin" />
              ) : (
                <Play className="h-3 w-3" />
              )}
              Process now
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleClear}
              disabled={queue.length === 0}
              className="h-7 gap-1.5 text-xs"
            >
              <Trash2 className="h-3 w-3" />
              Clear all
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
