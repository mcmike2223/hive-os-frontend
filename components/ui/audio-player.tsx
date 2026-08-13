"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Download,
  FolderPlus,
  GripHorizontal,
  Heart,
  ListMusic,
  Loader2,
  Maximize2,
  MoreHorizontal,
  Music,
  Pause,
  Play,
  Plus,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Track, useGlobalAudio } from "@/context/global-audio-context";

export interface AudioPlayerProps {
  id?: string | number;
  src?: string;
  title?: string;
  artist?: string;
  coverArt?: string;
  className?: string;
  autoPlay?: boolean;
  variant?: "default" | "mini";
  onToggleMinimize?: () => void;
  onClose?: () => void;
  dragProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  onNext?: () => void;
  onPrevious?: () => void;
  isFavorite?: boolean;
  trackList?: Track[];
  downloadUrl?: string;
}

const formatTime = (time: number) => {
  if (!Number.isFinite(time) || time < 0) {
    return "0:00";
  }

  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
};

const sameTrack = (left: Track | null | undefined, right: Track | null | undefined) =>
  Boolean(left && right && String(left.id) === String(right.id) && left.src === right.src);

export function AudioPlayer({
  id: propId,
  src: propSrc,
  title: propTitle,
  artist: propArtist,
  coverArt: propCoverArt,
  className,
  autoPlay = false,
  variant = "default",
  onToggleMinimize,
  onClose,
  dragProps,
  onNext: propNext,
  onPrevious: propPrevious,
  isFavorite: propIsFavorite,
  trackList,
  downloadUrl,
}: AudioPlayerProps) {
  const {
    currentTrack,
    hideFloatingPlayer,
    isPlaying,
    playTrack,
    playNext,
    playPrevious,
    togglePlay,
    isShuffle,
    toggleShuffle,
    repeatMode,
    setRepeatMode,
    volume,
    setVolume,
    isMuted,
    toggleMute,
    queue,
    removeFromQueue,
    clearQueue,
    addToQueue,
    playbackRate,
    setPlaybackRate,
    toggleFavorite,
    addToPlaylist,
    removeFromPlaylist,
    playlists,
    createPlaylist,
    deletePlaylist,
    currentTime,
    duration,
    progress,
    seekToPercent,
    seekBy,
    isBuffering,
    hasError,
    downloadCurrentTrack,
    downloadTrack,
  } = useGlobalAudio();

  const externalTrack = useMemo<Track | null>(() => {
    if (!propSrc) {
      return null;
    }

    return {
      id: propId ?? `source:${propSrc}`,
      src: propSrc,
      title: propTitle || "Unknown Track",
      artist: propArtist || "HIVE.OS Audio",
      coverArt: propCoverArt || null,
      isFavorite: Boolean(propIsFavorite),
      downloadUrl,
    };
  }, [downloadUrl, propArtist, propCoverArt, propId, propIsFavorite, propSrc, propTitle]);

  const resolvedTrack = externalTrack || currentTrack;
  const resolvedPlaylist = useMemo(
    () => (trackList?.length ? trackList : externalTrack ? [externalTrack] : undefined),
    [externalTrack, trackList],
  );
  const isExternalMode = Boolean(externalTrack);
  const isCurrentResolvedTrack = sameTrack(currentTrack, externalTrack || currentTrack);
  const isTrackPlaying = isExternalMode ? Boolean(isCurrentResolvedTrack && isPlaying) : isPlaying;
  const effectiveProgress = isCurrentResolvedTrack ? progress : 0;
  const effectiveCurrentTime = isCurrentResolvedTrack ? currentTime : 0;
  const effectiveDuration = isCurrentResolvedTrack ? duration : 0;
  const effectiveBuffering = isCurrentResolvedTrack ? isBuffering : false;
  const effectiveError = isCurrentResolvedTrack ? hasError : false;

  const numericTrackId =
    resolvedTrack && Number.isFinite(Number(resolvedTrack.id))
      ? Number(resolvedTrack.id)
      : null;
  const isInAnyPlaylist = useMemo(
    () =>
      numericTrackId !== null &&
      playlists.some((playlist) => playlist.trackIds.includes(numericTrackId)),
    [numericTrackId, playlists],
  );

  const [showQueue, setShowQueue] = useState(false);
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [localFavorite, setLocalFavorite] = useState(Boolean(resolvedTrack?.isFavorite));
  const previousExternalTrackRef = useRef<Track | null>(externalTrack);
  const isMiniVariant = variant === "mini";

  const ghostButtonClass =
    "text-muted-foreground transition-all hover:bg-muted/70 hover:text-foreground dark:hover:bg-white/5";
  const softPanelClass =
    "border border-slate-500 bg-background/70 dark:border-slate-500 dark:bg-white/5";
  const overlayClass =
    "absolute inset-0 z-30 flex flex-col border border-slate-500 bg-background/95 text-foreground backdrop-blur-2xl animate-in duration-300 dark:border-slate-500 dark:bg-black/90";

  useEffect(() => {
    setLocalFavorite(Boolean(resolvedTrack?.isFavorite ?? propIsFavorite));
  }, [propIsFavorite, resolvedTrack?.id, resolvedTrack?.isFavorite]);

  useEffect(() => {
    if (!externalTrack) {
      previousExternalTrackRef.current = null;
      return;
    }

    const previousExternalTrack = previousExternalTrackRef.current;
    const wasDrivingPlayback = sameTrack(previousExternalTrack, currentTrack) && isPlaying;

    if (autoPlay && !currentTrack) {
      hideFloatingPlayer();
      playTrack(externalTrack, resolvedPlaylist);
    } else if (
      previousExternalTrack &&
      !sameTrack(previousExternalTrack, externalTrack) &&
      wasDrivingPlayback
    ) {
      hideFloatingPlayer();
      playTrack(externalTrack, resolvedPlaylist);
    }

    previousExternalTrackRef.current = externalTrack;
  }, [autoPlay, currentTrack, externalTrack, hideFloatingPlayer, isPlaying, playTrack, resolvedPlaylist]);

  const activeFavorite = resolvedTrack
    ? isCurrentResolvedTrack && currentTrack
      ? Boolean(currentTrack.isFavorite)
      : localFavorite
    : false;

  const cycleRepeatMode = () => {
    const modes: Array<"none" | "playlist" | "track"> = ["none", "playlist", "track"];
    const nextMode = modes[(modes.indexOf(repeatMode) + 1) % modes.length];
    setRepeatMode(nextMode);
  };

  const cyclePlaybackRate = () => {
    const rates = [1, 1.25, 1.5, 1.75, 2];
    const nextRate = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    setPlaybackRate(nextRate);
  };

  const handlePlayPause = () => {
    if (!resolvedTrack) {
      return;
    }

    if (isExternalMode && !isCurrentResolvedTrack) {
      hideFloatingPlayer();
      playTrack(resolvedTrack, resolvedPlaylist);
      return;
    }

    togglePlay();
  };

  const handleQueueToggle = () => {
    setShowQueue((previous) => {
      const nextState = !previous;
      if (nextState) {
        setShowMenu(false);
        setShowPlaylists(false);
      }
      return nextState;
    });
  };

  const handlePlaylistsToggle = () => {
    setShowPlaylists((previous) => {
      const nextState = !previous;
      if (nextState) {
        setShowQueue(false);
        setShowMenu(false);
      }
      return nextState;
    });
  };

  const handleMenuToggle = () => {
    setShowMenu((previous) => {
      const nextState = !previous;
      if (nextState) {
        setShowQueue(false);
        setShowPlaylists(false);
      }
      return nextState;
    });
  };

  const handlePrevious = () => {
    if (propPrevious) {
      propPrevious();
      return;
    }

    playPrevious();
  };

  const handleNext = () => {
    if (propNext) {
      propNext();
      return;
    }

    playNext();
  };

  const handleFavorite = async () => {
    if (!resolvedTrack) {
      return;
    }

    const nextFavorite = !activeFavorite;
    setLocalFavorite(nextFavorite);
    if (numericTrackId === null) {
      return;
    }
    await toggleFavorite(resolvedTrack.id, activeFavorite);
  };

  const handleDownload = async () => {
    if (!resolvedTrack) {
      return;
    }

    if (isCurrentResolvedTrack) {
      await downloadCurrentTrack();
      return;
    }

    await downloadTrack(resolvedTrack);
  };

  const handleAddToQueue = () => {
    if (!resolvedTrack) {
      return;
    }

    addToQueue(resolvedTrack);
    setShowMenu(false);
  };

  const handleQueuePick = (track: Track) => {
    playTrack(track);
    setShowQueue(false);
  };

  const handlePlaylistToggle = async (playlistId: number, included: boolean) => {
    if (numericTrackId === null) {
      return;
    }

    if (included) {
      await removeFromPlaylist(numericTrackId, playlistId);
    } else {
      await addToPlaylist(numericTrackId, playlistId);
    }
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) {
      return;
    }

    await createPlaylist(newPlaylistName);
    setNewPlaylistName("");
  };

  if (!resolvedTrack?.src) {
    return null;
  }

  const queueBadgeLabel =
    queue.length > 0 ? `${queue.length} in queue` : "Queue is ready for your next tracks";
  const canManipulateTimeline = !isExternalMode || isCurrentResolvedTrack;

  return (
    <section
      data-audio-player
      aria-label={`Audio player: ${resolvedTrack.title}`}
      tabIndex={0}
      className={cn(
        "relative overflow-hidden text-foreground ring-1 ring-black/5 shadow-[0_28px_80px_-36px_rgba(15,23,42,0.45)] transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500 dark:ring-white/5 [&_button]:min-h-11 [&_button]:min-w-11 [&_button]:touch-manipulation [&_button]:focus-visible:outline-none [&_button]:focus-visible:ring-2 [&_button]:focus-visible:ring-emerald-600 [&_button]:focus-visible:ring-offset-2 [&_button]:focus-visible:ring-offset-background",
        "border border-slate-500 bg-background/95 backdrop-blur-3xl dark:border-slate-500 dark:bg-card/85",
        isMiniVariant
          ? "flex w-[min(94vw,380px)] items-center gap-2 rounded-[1.75rem] p-3"
          : "w-full max-w-md rounded-[2.4rem] p-6",
        !isMiniVariant
          ? "bg-gradient-to-br from-background via-background/95 to-muted/60 dark:from-card/95 dark:via-card/90 dark:to-card/70"
          : "",
        !isMiniVariant
          ? "supports-[backdrop-filter]:bg-background/85 dark:supports-[backdrop-filter]:bg-card/80"
          : "supports-[backdrop-filter]:bg-background/90 dark:supports-[backdrop-filter]:bg-card/80",
        className,
      )}
    >
      {resolvedTrack.coverArt ? (
        <div
          className="pointer-events-none absolute inset-0 z-0 scale-150 opacity-25 blur-[100px]"
          style={{
            backgroundImage: `url(${resolvedTrack.coverArt})`,
            backgroundPosition: "center",
            backgroundSize: "cover",
          }}
        />
      ) : null}

      {variant === "mini" ? (
        <div className="relative z-10 flex w-full flex-wrap items-center gap-3">
          {dragProps ? (
            <button
              type="button"
              data-audio-drag-handle
              {...dragProps}
              aria-label={dragProps["aria-label"] || "Move audio player"}
              className={cn(
                "flex h-11 w-11 shrink-0 cursor-grab items-center justify-center rounded-full bg-muted/70 text-muted-foreground active:cursor-grabbing dark:bg-white/5",
                dragProps.className,
              )}
            >
              <GripHorizontal className="h-4 w-4" />
            </button>
          ) : null}

          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/60 dark:border-white/10">
            {resolvedTrack.coverArt ? (
              <img
                src={resolvedTrack.coverArt}
                alt={resolvedTrack.title}
                className={cn(
                  "h-full w-full object-cover transition-transform duration-500",
                  isTrackPlaying && "scale-110",
                )}
              />
            ) : (
              <Music className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
            )}
            {effectiveBuffering ? (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm dark:bg-black/45">
                <Loader2 className="h-4 w-4 animate-spin text-foreground" />
              </div>
            ) : null}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-black leading-tight">{resolvedTrack.title}</p>
            <p className="truncate text-[11px] font-bold uppercase tracking-tight text-muted-foreground">
              {resolvedTrack.artist || "HIVE.OS Audio"}
            </p>
          </div>

          <div className="order-last flex w-full items-center justify-center gap-3 border-t border-border/60 pt-2 dark:border-white/10">
            <button
              onClick={handlePrevious}
              aria-label="Previous track"
              className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground dark:hover:bg-white/5"
              title="Previous"
            >
              <SkipBack className="h-3.5 w-3.5 fill-current" />
            </button>
            <button
              onClick={handlePlayPause}
              aria-label={isTrackPlaying ? "Pause audio" : "Play audio"}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-emerald-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400 active:scale-90"
              title={isTrackPlaying ? "Pause" : "Play"}
            >
              {isTrackPlaying ? (
                <Pause className="h-4 w-4 fill-current" />
              ) : (
                <Play className="ml-0.5 h-4 w-4 fill-current" />
              )}
            </button>
            <button
              onClick={handleNext}
              aria-label="Next track"
              className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground dark:hover:bg-white/5"
              title="Next"
            >
              <SkipForward className="h-3.5 w-3.5 fill-current" />
            </button>
            <button
              onClick={() => void handleFavorite()}
              aria-label="Favorite track"
              aria-pressed={activeFavorite}
              className={cn(
                "rounded-full p-1 transition-colors",
                activeFavorite ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground hover:text-emerald-700 dark:hover:text-emerald-400",
              )}
              title={activeFavorite ? "Unfavorite" : "Favorite"}
            >
              <Heart className={cn("h-3.5 w-3.5", activeFavorite && "fill-current")} />
            </button>
          </div>

          <div className="ml-auto flex items-center gap-1">
            {onToggleMinimize ? (
              <button
                onClick={onToggleMinimize}
                aria-label="Expand audio player"
                className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground dark:hover:bg-white/5"
                title="Expand player"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            ) : null}
            {onClose ? (
              <button
                onClick={onClose}
                aria-label="Close audio player"
                className="rounded-full p-1 text-muted-foreground transition-colors hover:text-destructive"
                title="Close player"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="relative z-10 flex flex-col gap-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              {dragProps ? (
                <button
                  type="button"
                  data-audio-drag-handle
                  {...dragProps}
                  aria-label={dragProps["aria-label"] || "Move audio player"}
                  className={cn(
                    "flex h-9 w-9 cursor-grab items-center justify-center rounded-2xl bg-muted/70 text-muted-foreground active:cursor-grabbing dark:bg-white/5",
                    dragProps.className,
                  )}
                  title="Move player"
                >
                  <GripHorizontal className="h-4 w-4" />
                </button>
              ) : null}
              <div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-700 dark:text-emerald-400">
                    Premium Audio
                  </span>
                </div>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  {queueBadgeLabel}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleQueueToggle}
                aria-label="Audio queue"
                aria-expanded={showQueue}
                className={cn(
                  "relative rounded-2xl p-2 transition-all",
                  showQueue
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                    : ghostButtonClass,
                )}
                title="Queue"
              >
                <ListMusic className="h-5 w-5" />
                {queue.length > 0 ? (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1 text-[11px] font-black text-emerald-950">
                    {queue.length}
                  </span>
                ) : null}
              </button>
              {onToggleMinimize ? (
                <button
                  onClick={onToggleMinimize}
                  aria-label="Minimize audio player"
                  className={cn("rounded-2xl p-2", ghostButtonClass)}
                  title="Minimize"
                >
                  <Maximize2 className="h-4 w-4 rotate-180" />
                </button>
              ) : null}
              {onClose ? (
                <button
                  onClick={onClose}
                  aria-label="Close audio player"
                  className="rounded-2xl p-2 text-muted-foreground transition-all hover:bg-destructive hover:text-white"
                  title="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-5">
            <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-[2rem] border border-border/60 shadow-2xl dark:border-white/10">
              {resolvedTrack.coverArt ? (
                <img
                  src={resolvedTrack.coverArt}
                  alt={resolvedTrack.title}
                  className={cn(
                    "h-full w-full object-cover transition-transform duration-700",
                    isTrackPlaying ? "scale-105" : "scale-110 grayscale-[0.15]",
                  )}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-500/20 to-sky-500/20">
                  <Music className="h-10 w-10 text-emerald-700 dark:text-emerald-400" />
                </div>
              )}
              {effectiveBuffering ? (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm dark:bg-black/55">
                  <Loader2 className="h-6 w-6 animate-spin text-emerald-700 dark:text-emerald-400" />
                </div>
              ) : null}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-xl font-black tracking-tight" title={resolvedTrack.title}>
                {resolvedTrack.title}
              </p>
              <p className="truncate text-sm font-medium text-muted-foreground">
                {resolvedTrack.artist || "HIVE.OS Audio"}
              </p>

              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={toggleShuffle}
                  aria-label="Shuffle playback"
                  aria-pressed={isShuffle}
                  className={cn(
                    "rounded-xl p-1.5 transition-all",
                    isShuffle
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : ghostButtonClass,
                  )}
                  title="Shuffle"
                >
                  <Shuffle className="h-4 w-4" />
                </button>
                <button
                  onClick={cycleRepeatMode}
                  aria-label={`Repeat mode: ${repeatMode}`}
                  className={cn(
                    "relative rounded-xl p-1.5 transition-all",
                    repeatMode !== "none"
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : ghostButtonClass,
                  )}
                  title="Repeat"
                >
                  <Repeat className="h-4 w-4" />
                  {repeatMode === "track" ? (
                    <span className="absolute -right-1 -top-1 rounded-full bg-emerald-500 px-1 text-[11px] font-black text-emerald-950">
                      1
                    </span>
                  ) : null}
                </button>
                <button
                  onClick={cyclePlaybackRate}
                  className="rounded-xl bg-muted/70 px-2 py-1 text-[11px] font-black text-muted-foreground transition-all hover:bg-muted hover:text-foreground dark:bg-white/5 dark:hover:bg-white/10"
                  title="Playback speed"
                >
                  {playbackRate}x
                </button>
                <button
                  onClick={() => seekBy(-10)}
                  disabled={!canManipulateTimeline}
                  aria-label="Back 10 seconds"
                  className="rounded-xl p-1.5 text-muted-foreground transition-all hover:bg-muted/70 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/5"
                  title="Back 10 seconds"
                >
                  <SkipBack className="h-4 w-4" />
                </button>
                <button
                  onClick={() => seekBy(10)}
                  disabled={!canManipulateTimeline}
                  aria-label="Forward 10 seconds"
                  className="rounded-xl p-1.5 text-muted-foreground transition-all hover:bg-muted/70 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/5"
                  title="Forward 10 seconds"
                >
                  <SkipForward className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
              <input
                type="range"
                min="0"
                max="100"
                step="0.1"
                value={effectiveProgress}
                disabled={!canManipulateTimeline}
                onChange={(event) => seekToPercent(Number(event.target.value))}
                aria-label="Audio position"
                aria-valuetext={`${formatTime(effectiveCurrentTime)} of ${formatTime(effectiveDuration)}`}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:bg-white/10"
              />
            <div className="flex items-center justify-between px-1 text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
              <span>{formatTime(effectiveCurrentTime)}</span>
              <span>{formatTime(effectiveDuration)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex w-24 items-center gap-2">
              <button
                onClick={toggleMute}
                aria-label={isMuted ? "Unmute audio" : "Mute audio"}
                className="text-muted-foreground transition-colors hover:text-foreground"
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="h-5 w-5" />
                ) : (
                  <Volume2 className="h-5 w-5" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={(event) => setVolume(Number(event.target.value))}
                aria-label="Audio volume"
                aria-valuetext={`${Math.round((isMuted ? 0 : volume) * 100)} percent`}
                className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-muted accent-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:bg-white/10"
              />
            </div>

            <div className="flex items-center gap-8">
              <button
                onClick={handlePrevious}
                aria-label="Previous track"
                className="text-muted-foreground transition-all hover:scale-110 hover:text-emerald-700 dark:hover:text-emerald-400 active:scale-90"
                title="Previous"
              >
                <SkipBack className="h-6 w-6 fill-current" />
              </button>
              <button
                onClick={handlePlayPause}
                aria-label={isTrackPlaying ? "Pause audio" : "Play audio"}
                className="group flex h-16 w-16 items-center justify-center rounded-[2rem] bg-emerald-500 text-emerald-950 shadow-[0_0_40px_rgba(16,185,129,0.3)] transition-all hover:scale-105 hover:bg-emerald-400 active:scale-95"
                title={isTrackPlaying ? "Pause" : "Play"}
              >
                {isTrackPlaying ? (
                  <Pause className="h-7 w-7 fill-current transition-transform group-hover:scale-110" />
                ) : (
                  <Play className="ml-1 h-7 w-7 fill-current transition-transform group-hover:scale-110" />
                )}
              </button>
              <button
                onClick={handleNext}
                aria-label="Next track"
                className="text-muted-foreground transition-all hover:scale-110 hover:text-emerald-700 dark:hover:text-emerald-400 active:scale-90"
                title="Next"
              >
                <SkipForward className="h-6 w-6 fill-current" />
              </button>
            </div>

            <div className="flex w-32 items-center justify-end gap-1">
              <button
                onClick={() => void handleFavorite()}
                aria-label="Favorite track"
                aria-pressed={activeFavorite}
                className={cn(
                  "rounded-xl p-2 transition-all",
                  activeFavorite
                    ? "scale-110 text-rose-700 drop-shadow-[0_0_8px_rgba(190,18,60,0.35)] dark:text-rose-400"
                    : ghostButtonClass,
                )}
                title={activeFavorite ? "Unfavorite" : "Favorite"}
              >
                <Heart className={cn("h-5 w-5", activeFavorite && "fill-current")} />
              </button>
              {numericTrackId !== null ? (
                <button
                  onClick={handlePlaylistsToggle}
                  aria-label="Playlists"
                  aria-expanded={showPlaylists}
                  className={cn(
                    "rounded-xl p-2 transition-all",
                    showPlaylists
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                      : ghostButtonClass,
                  )}
                  title="Playlists"
                >
                  <Plus className="h-5 w-5" />
                </button>
              ) : null}
              <button
                onClick={handleMenuToggle}
                aria-label="Track options"
                aria-expanded={showMenu}
                className={cn(
                  "rounded-xl p-2 transition-all",
                  showMenu
                    ? "bg-muted text-foreground dark:bg-white/10"
                    : ghostButtonClass,
                )}
                title="Track options"
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {effectiveError ? (
        <div role="alert" className="absolute inset-x-4 bottom-4 z-20 rounded-2xl border border-red-700 bg-red-50 px-4 py-3 text-xs font-bold text-red-800 dark:border-red-400 dark:bg-red-950 dark:text-red-200">
          This track could not be played. Try another file or re-upload the audio.
        </div>
      ) : null}

      {showMenu ? (
        <div className={cn(overlayClass, "justify-center p-6 fade-in zoom-in")}>
          <div className="mb-8 flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">
              Track Options
            </h3>
            <button
              onClick={() => setShowMenu(false)}
              aria-label="Close track options"
              className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground dark:hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-3">
            {numericTrackId !== null ? (
              <button
                onClick={() => {
                  setShowMenu(false);
                  setShowPlaylists(true);
                }}
                className={cn(
                  "group flex items-center gap-4 rounded-3xl p-5 transition-all hover:border-emerald-500/20 hover:bg-emerald-500/10",
                  softPanelClass,
                )}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-800 transition-transform group-hover:scale-110 dark:text-emerald-300">
                  <FolderPlus className="h-5 w-5" />
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-sm font-bold text-foreground">
                    {isInAnyPlaylist ? "Manage Playlists" : "Add to Playlist"}
                  </span>
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                    Stable library organization
                  </span>
                </div>
              </button>
            ) : null}

            <button
              onClick={handleAddToQueue}
              className={cn(
                "group flex items-center gap-4 rounded-3xl p-5 transition-all hover:border-sky-500/20 hover:bg-sky-500/10",
                softPanelClass,
              )}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/20 text-sky-800 transition-transform group-hover:scale-110 dark:text-sky-300">
                <ListMusic className="h-5 w-5" />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-sm font-bold text-foreground">Add to Queue</span>
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                  Keep the flow going
                </span>
              </div>
            </button>

            <button
              onClick={() => {
                void handleDownload();
                setShowMenu(false);
              }}
              className={cn(
                "group flex items-center gap-4 rounded-3xl p-5 transition-all hover:border-blue-500/20 hover:bg-blue-500/10",
                softPanelClass,
              )}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-800 transition-transform group-hover:scale-110 dark:text-blue-300">
                <Download className="h-5 w-5" />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-sm font-bold text-foreground">Download Track</span>
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                  Offline listening
                </span>
              </div>
            </button>
          </div>
        </div>
      ) : null}

      {showPlaylists ? (
        <div className={cn(overlayClass, "p-6 fade-in slide-in-from-right-10")}>
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
              Playlists
            </h3>
            <button
              onClick={() => setShowPlaylists(false)}
              aria-label="Close playlists"
              className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground dark:hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto pr-2">
            {playlists.length === 0 ? (
              <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border/70 text-muted-foreground dark:border-white/10">
                <FolderPlus className="h-7 w-7" />
                <p className="text-[11px] font-bold uppercase tracking-[0.16em]">
                  No playlists yet
                </p>
              </div>
            ) : (
              playlists.map((playlistItem) => {
                const included =
                  numericTrackId !== null &&
                  playlistItem.trackIds.includes(numericTrackId);

                return (
                  <div key={playlistItem.id} className="flex items-center gap-2">
                    <button
                      onClick={() => void handlePlaylistToggle(playlistItem.id, included)}
                      className={cn(
                        "flex flex-1 items-center justify-between rounded-2xl border p-4 transition-all",
                        included
                          ? "border-emerald-700 bg-emerald-500/20 text-emerald-800 dark:border-emerald-400 dark:text-emerald-300"
                          : "border-slate-500 bg-background/70 hover:border-emerald-700 hover:bg-emerald-500/10 dark:border-slate-500 dark:bg-white/5 dark:hover:border-emerald-400",
                      )}
                    >
                      <span className="text-sm font-bold text-left text-foreground">
                        {playlistItem.name}
                      </span>
                      {included ? (
                        <Check className="h-4 w-4 shrink-0" />
                      ) : (
                        <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                    </button>
                    <button
                      onClick={() => void deletePlaylist(playlistItem.id)}
                      aria-label={`Delete playlist ${playlistItem.name}`}
                      className="rounded-2xl border border-slate-500 bg-background/70 p-4 text-muted-foreground transition-all hover:border-rose-700 hover:bg-rose-500/10 hover:text-rose-700 dark:border-slate-500 dark:bg-white/5 dark:hover:border-rose-400 dark:hover:text-rose-400"
                      title="Delete playlist"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-6 border-t border-border/60 pt-5 dark:border-white/10">
            <label htmlFor="audio-new-playlist" className="mb-2 block text-xs font-bold text-foreground">
              New playlist name
            </label>
            <div className="flex gap-2">
              <input
                id="audio-new-playlist"
                value={newPlaylistName}
                onChange={(event) => setNewPlaylistName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void handleCreatePlaylist();
                  }
                }}
                placeholder="New playlist name..."
                className="min-w-0 flex-1 rounded-xl border border-slate-500 bg-background/80 px-4 py-2 text-sm text-foreground outline-none transition-all focus:border-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:border-slate-500 dark:bg-white/5"
              />
              <button
                onClick={() => void handleCreatePlaylist()}
                disabled={!newPlaylistName.trim()}
                aria-label="Create playlist"
                className="rounded-xl bg-emerald-500 p-2 text-emerald-950 transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showQueue ? (
        <div
          className={cn(
            overlayClass,
            "custom-scrollbar p-6 fade-in zoom-in",
            isMiniVariant &&
              "fixed inset-auto bottom-20 left-1/2 max-h-[420px] w-[360px] -translate-x-1/2 rounded-[2rem] shadow-2xl",
          )}
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
                Up Next
              </h3>
              <p className="mt-1 text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                {queueBadgeLabel}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {queue.length > 0 ? (
                <button
                  onClick={clearQueue}
                  className="rounded-xl px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground dark:hover:bg-white/10"
                >
                  Clear
                </button>
              ) : null}
              <button
                onClick={() => setShowQueue(false)}
                aria-label="Close audio queue"
                className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground dark:hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto">
            {queue.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
                <Music className="h-8 w-8" />
                <p className="text-xs font-bold uppercase tracking-[0.16em]">
                  Queue is empty
                </p>
              </div>
            ) : (
              queue.map((trackItem, index) => (
                <div
                  key={`${trackItem.id}-${index}`}
                  className="group flex items-center gap-3 rounded-2xl border border-transparent p-2 transition-all hover:border-border/60 hover:bg-muted/70 dark:hover:border-white/10 dark:hover:bg-white/5"
                >
                  <button
                    onClick={() => handleQueuePick(trackItem)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-muted dark:border-white/10">
                      {trackItem.coverArt ? (
                        <img
                          src={trackItem.coverArt}
                          alt={trackItem.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Music className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-foreground">
                        {trackItem.title}
                      </p>
                      <p className="truncate text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                        {trackItem.artist || "HIVE.OS Audio"}
                      </p>
                    </div>
                  </button>
                  <button
                    onClick={() => removeFromQueue(trackItem.id)}
                    aria-label={`Remove ${trackItem.title} from queue`}
                    className="rounded-full p-1 text-muted-foreground opacity-100 transition-all hover:bg-rose-500/10 hover:text-rose-500 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                    title="Remove from queue"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(100, 116, 139, 0.45);
          border-radius: 999px;
        }

        :global(.dark) .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.12);
        }
      `}</style>
    </section>
  );
}
