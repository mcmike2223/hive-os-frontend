"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Music, Pause, Play, X } from "lucide-react";

import { useGlobalAudio } from "@/context/global-audio-context";
import { getWorkspaceScopeKey } from "@/lib/runtime-context";
import { AudioPlayer } from "./audio-player";

const POSITION_STORAGE_PREFIX = "hive_audio_player_pos_v3";
const MINIMIZED_STORAGE_PREFIX = "hive_audio_player_minimized_v2";
const PADDING = 24;
const MINI_WIDTH = 380;
const MINI_HEIGHT = 112;
const FULL_WIDTH = 420;

const getFloatingPlayerStorageKeys = () => {
  const workspaceScope = getWorkspaceScopeKey();

  return {
    position: `${POSITION_STORAGE_PREFIX}:${workspaceScope}`,
    minimized: `${MINIMIZED_STORAGE_PREFIX}:${workspaceScope}`,
  };
};

type PlayerPosition = {
  x: number;
  y: number;
};

const getViewportBounds = (width: number, height: number) => ({
  minX: PADDING,
  maxX: Math.max(PADDING, window.innerWidth - width - PADDING),
  minY: PADDING,
  maxY: Math.max(PADDING, window.innerHeight - height - PADDING),
});

const clampPosition = (position: PlayerPosition, width: number, height: number): PlayerPosition => {
  const bounds = getViewportBounds(width, height);
  return {
    x: Math.min(bounds.maxX, Math.max(bounds.minX, position.x)),
    y: Math.min(bounds.maxY, Math.max(bounds.minY, position.y)),
  };
};

const getDefaultPosition = (width: number, height: number): PlayerPosition =>
  clampPosition(
    {
      x: window.innerWidth - width - PADDING,
      y: window.innerHeight - height - PADDING,
    },
    width,
    height,
  );

export function FloatingPlayer() {
  const {
    currentTrack,
    closePlayer,
    isFloatingPlayerOpen,
    showFloatingPlayer,
    isPlaying,
    togglePlay,
  } = useGlobalAudio();

  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState<PlayerPosition | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{
    pointerId: number | null;
    offsetX: number;
    offsetY: number;
  }>({
    pointerId: null,
    offsetX: 0,
    offsetY: 0,
  });

  const widthHint = useMemo(() => (isMinimized ? MINI_WIDTH : FULL_WIDTH), [isMinimized]);

  useEffect(() => {
    if (!currentTrack || typeof window === "undefined") {
      return;
    }

    const savedMinimized = window.localStorage.getItem(getFloatingPlayerStorageKeys().minimized);
    if (savedMinimized !== null) {
      setIsMinimized(savedMinimized === "true");
    }
  }, [currentTrack]);

  useEffect(() => {
    if (!currentTrack || typeof window === "undefined") {
      return;
    }

    const savedRaw = window.localStorage.getItem(getFloatingPlayerStorageKeys().position);
    const rect = wrapperRef.current?.getBoundingClientRect();
    const heightHint = rect?.height ?? (isMinimized ? MINI_HEIGHT : 520);

    if (savedRaw) {
      try {
        const saved = JSON.parse(savedRaw) as PlayerPosition;
        setPosition(clampPosition(saved, widthHint, heightHint));
        return;
      } catch {
        // Ignore bad saved position.
      }
    }

    setPosition(getDefaultPosition(widthHint, heightHint));
  }, [currentTrack, isMinimized, widthHint]);

  useEffect(() => {
    if (!currentTrack || typeof window === "undefined") {
      return;
    }

    const handleResize = () => {
      const rect = wrapperRef.current?.getBoundingClientRect();
      const nextHeight = rect?.height ?? (isMinimized ? MINI_HEIGHT : 520);
      setPosition((previous) =>
        previous
          ? clampPosition(previous, widthHint, nextHeight)
          : getDefaultPosition(widthHint, nextHeight),
      );
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [currentTrack, isMinimized, widthHint]);

  useEffect(() => {
    if (!position || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      getFloatingPlayerStorageKeys().position,
      JSON.stringify(position),
    );
  }, [position]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (!target.closest("[data-audio-drag-handle]")) {
      return;
    }

    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    dragStateRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current.pointerId !== event.pointerId) {
      return;
    }

    const rect = wrapperRef.current?.getBoundingClientRect();
    const nextWidth = rect?.width ?? widthHint;
    const nextHeight = rect?.height ?? (isMinimized ? MINI_HEIGHT : 520);

    const nextPosition = clampPosition(
      {
        x: event.clientX - dragStateRef.current.offsetX,
        y: event.clientY - dragStateRef.current.offsetY,
      },
      nextWidth,
      nextHeight,
    );

    setPosition(nextPosition);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current.pointerId !== event.pointerId) {
      return;
    }

    dragStateRef.current.pointerId = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleDragKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const movement = event.shiftKey ? 32 : 12;
    const delta = {
      ArrowLeft: { x: -movement, y: 0 },
      ArrowRight: { x: movement, y: 0 },
      ArrowUp: { x: 0, y: -movement },
      ArrowDown: { x: 0, y: movement },
    }[event.key];

    if (!delta) return;

    event.preventDefault();
    const rect = wrapperRef.current?.getBoundingClientRect();
    const nextWidth = rect?.width ?? widthHint;
    const nextHeight = rect?.height ?? (isMinimized ? MINI_HEIGHT : 520);
    setPosition((previous) => {
      const base = previous ?? getDefaultPosition(nextWidth, nextHeight);
      return clampPosition(
        { x: base.x + delta.x, y: base.y + delta.y },
        nextWidth,
        nextHeight,
      );
    });
  };

  const handleToggleMinimize = () => {
    setIsMinimized((previous) => {
      const nextState = !previous;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          getFloatingPlayerStorageKeys().minimized,
          String(nextState),
        );
      }
      return nextState;
    });
  };

  const handleOpenPlayer = () => {
    if (!position && typeof window !== "undefined") {
      setPosition(getDefaultPosition(widthHint, isMinimized ? MINI_HEIGHT : 520));
    }

    showFloatingPlayer();
  };

  if (!currentTrack) {
    return null;
  }

  if (!isFloatingPlayerOpen) {
    return (
      <aside aria-label={`Background audio: ${currentTrack.title}`} className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-bottom-5 fade-in duration-300">
        <div className="flex items-center gap-2 rounded-full border border-slate-500 bg-background/95 p-2 pr-3 text-foreground shadow-[0_28px_80px_-36px_rgba(15,23,42,0.45)] backdrop-blur-2xl dark:border-slate-500 dark:bg-card/90 [&_button]:min-h-11 [&_button]:min-w-11 [&_button]:focus-visible:outline-none [&_button]:focus-visible:ring-2 [&_button]:focus-visible:ring-emerald-600 [&_button]:focus-visible:ring-offset-2 [&_button]:focus-visible:ring-offset-background">
          <button
            onClick={togglePlay}
            aria-label={isPlaying ? "Pause audio" : "Play audio"}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-emerald-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400 active:scale-95"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4 fill-current" />
            ) : (
              <Play className="ml-0.5 h-4 w-4 fill-current" />
            )}
          </button>

          <button
            onClick={handleOpenPlayer}
            aria-label="Expand audio player"
            className="flex min-w-0 items-center gap-3 rounded-full px-2 py-1 text-left transition-colors hover:bg-muted/70 dark:hover:bg-white/5"
            title="Open player"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/60 bg-muted dark:border-white/10">
              {currentTrack.coverArt ? (
                <img
                  src={currentTrack.coverArt}
                  alt={currentTrack.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Music className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
              )}
            </div>

            <div className="min-w-0">
              <p className="max-w-[180px] truncate text-xs font-black leading-tight">
                {currentTrack.title}
              </p>
              <p className="max-w-[180px] truncate text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                {isPlaying ? "Playing in background" : currentTrack.artist || "HIVE.OS Audio"}
              </p>
            </div>
          </button>

          <button
            onClick={handleOpenPlayer}
            aria-label="Expand audio player"
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground dark:hover:bg-white/5"
            title="Expand player"
          >
            <Maximize2 className="h-4 w-4" />
          </button>

          <button
            onClick={closePlayer}
            aria-label="Stop audio playback"
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-destructive hover:text-white"
            title="Stop playback"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </aside>
    );
  }

  if (!position) {
    return null;
  }

  return (
    <div
      ref={wrapperRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ left: 0, top: 0, transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
      className="fixed z-[100] touch-none will-change-transform animate-in slide-in-from-bottom-10 fade-in duration-500"
    >
      <AudioPlayer
        variant={isMinimized ? "mini" : "default"}
        onToggleMinimize={handleToggleMinimize}
        onClose={closePlayer}
        dragProps={{
          title: "Move audio player with pointer or arrow keys",
          "aria-label": "Move audio player",
          onKeyDown: handleDragKeyDown,
        }}
      />
    </div>
  );
}
