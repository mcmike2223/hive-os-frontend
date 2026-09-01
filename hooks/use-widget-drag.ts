"use client";

import * as React from "react";

/**
 * How far the pointer must travel before a press counts as a drag rather than
 * a click. Matches the ~5px browsers themselves use for text selection.
 */
const DRAG_THRESHOLD_PX = 6;

export interface WidgetDragOptions {
  /** Persisted under this key so a dragged position survives a reload. */
  storageKey: string;
  /** Drag is meaningless inside the embed iframe — the host places the frame. */
  disabled?: boolean;
}

export interface WidgetDrag {
  ref: React.RefObject<HTMLDivElement | null>;
  position: { x: number; y: number } | null;
  dragging: boolean;
  /** Spread onto whichever element should be grabbable. */
  handleProps: {
    onPointerDown: (event: React.PointerEvent) => void;
    onPointerMove: (event: React.PointerEvent) => void;
    onPointerUp: (event: React.PointerEvent) => void;
    onPointerCancel: (event: React.PointerEvent) => void;
  };
  /** Absolute placement once dragged; empty until then. */
  style: React.CSSProperties;
  /** True if the last gesture actually moved — use to suppress a click. */
  didDrag: () => boolean;
  reset: () => void;
}

/**
 * Makes a floating widget draggable, and keeps it where it was put.
 *
 * Mark any control that must stay clickable with `data-no-drag` — a blanket
 * "ignore all buttons" rule cannot work here, because the collapsed launcher
 * *is itself* a button and still has to be draggable.
 */
export function useWidgetDrag({ storageKey, disabled = false }: WidgetDragOptions): WidgetDrag {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = React.useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = React.useState(false);

  const state = React.useRef<{
    dx: number;
    dy: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);

  // Restore a previously dragged position.
  React.useEffect(() => {
    if (disabled) return;

    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) return;

      const parsed = JSON.parse(saved);
      if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
        setPosition(parsed);
      }
    } catch {
      // A corrupt entry just means the default corner.
    }
  }, [storageKey, disabled]);

  // Keep a dragged widget reachable when the window shrinks.
  React.useEffect(() => {
    if (!position || disabled) return;

    const onResize = () => {
      const el = ref.current;
      const width = el?.offsetWidth ?? 380;
      const height = el?.offsetHeight ?? 80;

      setPosition((current) =>
        current
          ? {
              x: Math.min(current.x, Math.max(0, window.innerWidth - width)),
              y: Math.min(current.y, Math.max(0, window.innerHeight - height)),
            }
          : current,
      );
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [position, disabled]);

  const onPointerDown = (event: React.PointerEvent) => {
    if (disabled) return;
    if (event.button !== 0 && event.pointerType === "mouse") return;

    // Only controls explicitly opted out block a drag.
    if ((event.target as HTMLElement).closest?.("[data-no-drag]")) return;

    const el = ref.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();

    state.current = {
      dx: event.clientX - rect.left,
      dy: event.clientY - rect.top,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };

    // Capture is deliberately NOT taken here — see onPointerMove. Capturing on
    // pointerdown retargets the following `click` to the capturing element, so
    // the button inside never receives it and a plain click stops working.
    // Note: `dragging` is NOT set here. A press is not yet a drag, and
    // flipping the cursor to "grabbing" on every click made an ordinary click
    // feel like it had snagged on something.
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const current = state.current;
    if (!current) return;

    const el = ref.current;
    if (!el) return;

    // Distance from where the gesture *started*, not this event's delta — a
    // slow, careful drag produces a run of sub-pixel deltas that would never
    // individually clear a per-event threshold, so the drag would never start.
    if (!current.moved) {
      const travelled =
        Math.abs(event.clientX - current.startX) + Math.abs(event.clientY - current.startY);

      // Roughly the conventional drag threshold. A real mouse almost always
      // shifts a pixel or three between press and release, and at a tighter
      // threshold that jitter registered as a drag — which suppressed the
      // click and left the widget refusing to open. Synthetic test events
      // never jitter, so this only ever showed up under a real hand.
      if (travelled < DRAG_THRESHOLD_PX) return;

      current.moved = true;
      setDragging(true);

      // Only now, once this is genuinely a drag, is it safe to capture: from
      // here the gesture survives the cursor outrunning the handle, and the
      // suppressed `click` is exactly what we want, since a drag must not also
      // count as a click on whatever sits under the pointer.
      try {
        (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
      } catch {
        // Non-fatal: pointermove keeps arriving while the pointer is over us.
      }
    }

    const maxX = Math.max(0, window.innerWidth - el.offsetWidth);
    const maxY = Math.max(0, window.innerHeight - el.offsetHeight);

    setPosition({
      x: Math.min(Math.max(0, event.clientX - current.dx), maxX),
      y: Math.min(Math.max(0, event.clientY - current.dy), maxY),
    });
  };

  const finish = (event: React.PointerEvent) => {
    const current = state.current;
    setDragging(false);

    try {
      (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
    } catch {
      // Nothing captured, nothing to release.
    }

    if (current?.moved) {
      setPosition((latest) => {
        if (latest) {
          try {
            localStorage.setItem(storageKey, JSON.stringify(latest));
          } catch {
            // Position just won't survive a reload.
          }
        }
        return latest;
      });
    }

    // Cleared on the next tick so the click handler that fires immediately
    // after pointerup can still see that this was a drag.
    window.setTimeout(() => {
      state.current = null;
    }, 0);
  };

  const reset = () => {
    setPosition(null);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Nothing to clean up.
    }
  };

  return {
    ref,
    position,
    dragging,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel: finish,
    },
    style: position ? { left: position.x, top: position.y, right: "auto", bottom: "auto" } : {},
    didDrag: () => state.current?.moved === true,
    reset,
  };
}
