"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { authenticatedDownload } from "@/lib/authenticated-download";
import {
  getAccessToken,
  getAuthHeaders,
  getBackendApiRoot,
  getSignedMediaStreamUrl,
  getWorkspaceScopeKey,
} from "@/lib/runtime-context";

export type Track = {
  id: string | number;
  src: string;
  title: string;
  artist?: string;
  coverArt?: string | null;
  isFavorite?: boolean;
  downloadUrl?: string;
};

export type Playlist = {
  id: number;
  name: string;
  description?: string;
  trackIds: number[];
};

export type RepeatMode = "none" | "track" | "playlist";

type AudioContextType = {
  currentTrack: Track | null;
  playlist: Track[];
  queue: Track[];
  history: Track[];
  playlists: Playlist[];
  isFloatingPlayerOpen: boolean;
  isPlaying: boolean;
  isShuffle: boolean;
  repeatMode: RepeatMode;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  currentTime: number;
  duration: number;
  progress: number;
  isBuffering: boolean;
  hasError: boolean;
  playTrack: (track: Track, newPlaylist?: Track[]) => void;
  playNext: () => void;
  playPrevious: () => void;
  togglePlay: () => void;
  showFloatingPlayer: () => void;
  hideFloatingPlayer: () => void;
  closePlayer: () => void;
  toggleShuffle: () => void;
  setRepeatMode: (mode: RepeatMode) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setPlaybackRate: (rate: number) => void;
  seekToPercent: (percent: number) => void;
  seekBy: (seconds: number) => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (trackId: string | number) => void;
  clearQueue: () => void;
  toggleFavorite: (trackId: string | number, fallbackFavorite?: boolean) => Promise<void>;
  syncFavoriteStatus: (trackId: string | number, isFavorite: boolean) => void;
  refreshPlaylists: () => Promise<void>;
  addToPlaylist: (trackId: string | number, playlistId: number) => Promise<void>;
  removeFromPlaylist: (trackId: string | number, playlistId: number) => Promise<void>;
  createPlaylist: (name: string) => Promise<void>;
  deletePlaylist: (playlistId: number) => Promise<void>;
  downloadCurrentTrack: () => Promise<void>;
  downloadTrack: (track: Track) => Promise<void>;
};

const AudioContext = createContext<AudioContextType | undefined>(undefined);

const SETTINGS_STORAGE_PREFIX = "hive_audio_settings_v4";
const SESSION_STORAGE_PREFIX = "hive_audio_session_v4";
const MAX_HISTORY_ITEMS = 30;
const MAX_QUEUE_ITEMS = 200;

type PersistedSettings = {
  volume: number;
  isMuted: boolean;
  isShuffle: boolean;
  repeatMode: RepeatMode;
  playbackRate: number;
};

type PersistedSession = {
  currentTrack: Track | null;
  playlist: Track[];
  queue: Track[];
  history: Track[];
  currentTime: number;
};

const defaultSettings: PersistedSettings = {
  volume: 0.85,
  isMuted: false,
  isShuffle: false,
  repeatMode: "none",
  playbackRate: 1,
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const readJson = <T,>(key: string, fallback: T): T => {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }

    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export const getAudioStorageKeys = () => {
  const workspaceScope = getWorkspaceScopeKey();

  return {
    settings: `${SETTINGS_STORAGE_PREFIX}:${workspaceScope}`,
    session: `${SESSION_STORAGE_PREFIX}:${workspaceScope}`,
  };
};

const trackEquals = (left: Track | null | undefined, right: Track | null | undefined) =>
  Boolean(left && right && String(left.id) === String(right.id) && left.src === right.src);

const normalizeTrack = (track: Track | null | undefined): Track | null => {
  if (!track?.src || !track?.id) {
    return null;
  }

  return {
    id: track.id,
    src: track.src,
    title: track.title || "Unknown Track",
    artist: track.artist || "HIVE.OS Audio",
    coverArt: track.coverArt || null,
    isFavorite: Boolean(track.isFavorite),
    downloadUrl: track.downloadUrl,
  };
};

const normalizeTrackList = (tracks: Track[] | undefined): Track[] =>
  (tracks || [])
    .map((track) => normalizeTrack(track))
    .filter((track): track is Track => Boolean(track));

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;

const playlistResponseToModel = (playlistValue: unknown): Playlist => {
  const playlist = asRecord(playlistValue) ?? {};
  const fileEntries = Array.isArray(playlist.fileEntries)
    ? playlist.fileEntries
    : Array.isArray(playlist.file_entries)
      ? playlist.file_entries
      : [];
  const name = typeof playlist.name === "string" && playlist.name ? playlist.name : "Untitled Playlist";
  const description = typeof playlist.description === "string" ? playlist.description : "";

  return {
    id: Number(playlist.id),
    name,
    description,
    trackIds: fileEntries
      .map((entry) => Number(asRecord(entry)?.id))
      .filter((id: number) => Number.isFinite(id)),
  };
};

export function GlobalAudioProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const audioRef = useRef<HTMLAudioElement>(null);
  const pendingSeekRef = useRef<number | null>(null);
  const restoredSessionRef = useRef(false);
  const lastSavedSecondRef = useRef<number>(-1);
  const storageKeysRef = useRef<ReturnType<typeof getAudioStorageKeys> | null>(null);
  const streamRefreshAttemptRef = useRef(false);

  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [queue, setQueue] = useState<Track[]>([]);
  const [history, setHistory] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isFloatingPlayerOpen, setIsFloatingPlayerOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isShuffle, setIsShuffle] = useState(defaultSettings.isShuffle);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>(defaultSettings.repeatMode);
  const [volume, setVolumeState] = useState(defaultSettings.volume);
  const [isMuted, setIsMuted] = useState(defaultSettings.isMuted);
  const [playbackRate, setPlaybackRateState] = useState(defaultSettings.playbackRate);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [resolvedTrackSrc, setResolvedTrackSrc] = useState<string | null>(null);

  const currentTrackRef = useRef<Track | null>(currentTrack);
  const playlistRef = useRef<Track[]>(playlist);
  const queueRef = useRef<Track[]>(queue);
  const historyRef = useRef<Track[]>(history);
  const isShuffleRef = useRef(isShuffle);
  const repeatModeRef = useRef(repeatMode);

  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  useEffect(() => {
    playlistRef.current = playlist;
  }, [playlist]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    isShuffleRef.current = isShuffle;
  }, [isShuffle]);

  useEffect(() => {
    repeatModeRef.current = repeatMode;
  }, [repeatMode]);

  useEffect(() => {
    const storageKeys = getAudioStorageKeys();
    storageKeysRef.current = storageKeys;

    const settings = readJson<PersistedSettings>(storageKeys.settings, defaultSettings);
    setVolumeState(clamp(settings.volume ?? defaultSettings.volume, 0, 1));
    setIsMuted(Boolean(settings.isMuted));
    setIsShuffle(Boolean(settings.isShuffle));
    setRepeatMode(settings.repeatMode ?? defaultSettings.repeatMode);
    setPlaybackRateState(clamp(settings.playbackRate ?? defaultSettings.playbackRate, 0.5, 2));

    const session = readJson<PersistedSession | null>(storageKeys.session, null);
    if (session) {
      setCurrentTrack(normalizeTrack(session.currentTrack));
      setPlaylist(normalizeTrackList(session.playlist));
      setQueue(normalizeTrackList(session.queue));
      setHistory(normalizeTrackList(session.history).slice(-MAX_HISTORY_ITEMS));
      pendingSeekRef.current = Number.isFinite(session.currentTime) ? session.currentTime : null;
    }

    restoredSessionRef.current = true;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const payload: PersistedSettings = {
      volume,
      isMuted,
      isShuffle,
      repeatMode,
      playbackRate,
    };

    const storageKeys = storageKeysRef.current;
    if (storageKeys) {
      window.localStorage.setItem(storageKeys.settings, JSON.stringify(payload));
    }
  }, [volume, isMuted, isShuffle, repeatMode, playbackRate]);

  useEffect(() => {
    if (!restoredSessionRef.current || typeof window === "undefined") {
      return;
    }

    if (!currentTrack && playlist.length === 0 && queue.length === 0 && history.length === 0) {
      const storageKeys = storageKeysRef.current;
      if (storageKeys) {
        window.localStorage.removeItem(storageKeys.session);
      }
      return;
    }

    const payload: PersistedSession = {
      currentTrack,
      playlist,
      queue,
      history,
      currentTime,
    };

    const storageKeys = storageKeysRef.current;
    if (storageKeys) {
      window.localStorage.setItem(storageKeys.session, JSON.stringify(payload));
    }
  }, [currentTrack, playlist, queue, history, currentTime]);

  const fetchPlaylists = useCallback(async () => {
    const token = getAccessToken();

    if (!token) {
      if (playlists.length > 0) {
        setPlaylists([]);
      }
      return;
    }

    try {
      const response = await fetch(`${getBackendApiRoot()}/playlists`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        if (response.status === 402 || response.status === 403) {
          setPlaylists([]);
          return;
        }

        throw new Error(`Failed to load playlists. Status: ${response.status}`);
      }

      const payload = await response.json();
      setPlaylists(Array.isArray(payload) ? payload.map(playlistResponseToModel) : []);
    } catch (error) {
      console.error("Failed to load playlists", error);
    }
  }, [playlists.length]);

  useEffect(() => {
    void fetchPlaylists();
  }, [fetchPlaylists]);

  const persistPosition = useCallback((time: number) => {
    if (typeof window === "undefined") {
      return;
    }

    const rounded = Math.floor(time);
    if (rounded === lastSavedSecondRef.current || rounded < 0) {
      return;
    }

    lastSavedSecondRef.current = rounded;

    const payload: PersistedSession = {
      currentTrack: currentTrackRef.current,
      playlist: playlistRef.current,
      queue: queueRef.current,
      history: historyRef.current,
      currentTime: time,
    };

    const storageKeys = storageKeysRef.current;
    if (storageKeys) {
      window.localStorage.setItem(storageKeys.session, JSON.stringify(payload));
    }
  }, []);

  const syncTrackFavorite = useCallback((trackId: string | number, favorite: boolean) => {
    const matcher = String(trackId);

    setCurrentTrack((previous) =>
      previous && String(previous.id) === matcher
        ? { ...previous, isFavorite: favorite }
        : previous,
    );

    setPlaylist((previous) =>
      previous.map((track) =>
        String(track.id) === matcher ? { ...track, isFavorite: favorite } : track,
      ),
    );

    setQueue((previous) =>
      previous.map((track) =>
        String(track.id) === matcher ? { ...track, isFavorite: favorite } : track,
      ),
    );

    setHistory((previous) =>
      previous.map((track) =>
        String(track.id) === matcher ? { ...track, isFavorite: favorite } : track,
      ),
    );
  }, []);

  const startTrack = useCallback(
    (
      inputTrack: Track,
      options?: {
        newPlaylist?: Track[];
        autoPlay?: boolean;
        pushHistory?: boolean;
        startTime?: number | null;
      },
    ) => {
      const nextTrack = normalizeTrack(inputTrack);
      if (!nextTrack) {
        return;
      }

      const autoplay = options?.autoPlay ?? true;
      const previousTrack = currentTrackRef.current;
      const sameTrack = trackEquals(previousTrack, nextTrack);

      if (options?.newPlaylist) {
        setPlaylist(normalizeTrackList(options.newPlaylist));
      }

      if (!sameTrack && options?.pushHistory !== false && previousTrack) {
        setHistory((previous) => [...previous.slice(-(MAX_HISTORY_ITEMS - 1)), previousTrack]);
      }

      if (!sameTrack) {
        pendingSeekRef.current = options?.startTime ?? 0;
        setCurrentTime(0);
        setDuration(0);
        setHasError(false);
      }

      setIsBuffering(autoplay);
      setCurrentTrack((previous) =>
        sameTrack && previous ? { ...previous, ...nextTrack } : nextTrack,
      );
      setIsPlaying(autoplay);

      if (sameTrack) {
        if (options?.startTime !== undefined && audioRef.current) {
          audioRef.current.currentTime = Math.max(0, options.startTime ?? 0);
        }

        if (autoplay) {
          void audioRef.current?.play().catch(() => {
            setIsPlaying(false);
          });
        } else {
          audioRef.current?.pause();
        }
      }
    },
    [],
  );

  const getPlaylistIndex = useCallback((tracks: Track[], track: Track | null) => {
    if (!track) {
      return -1;
    }

    return tracks.findIndex((candidate) => trackEquals(candidate, track));
  }, []);

  const resolveNextTrack = useCallback((): Track | null => {
    if (queueRef.current.length > 0) {
      const [nextTrack, ...rest] = queueRef.current;
      setQueue(rest);
      return nextTrack;
    }

    const tracks = playlistRef.current;
    const current = currentTrackRef.current;
    if (!current || tracks.length === 0) {
      return null;
    }

    if (isShuffleRef.current) {
      const candidates = tracks.filter((candidate) => !trackEquals(candidate, current));
      if (candidates.length === 0) {
        return repeatModeRef.current === "playlist" ? current : null;
      }

      return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
    }

    const currentIndex = getPlaylistIndex(tracks, current);
    if (currentIndex === -1) {
      return tracks[0] ?? null;
    }

    const nextTrack = tracks[currentIndex + 1];
    if (nextTrack) {
      return nextTrack;
    }

    if (repeatModeRef.current === "playlist") {
      return tracks[0] ?? null;
    }

    return null;
  }, [getPlaylistIndex]);

  const resolvePreviousTrack = useCallback((): Track | null => {
    if (historyRef.current.length > 0) {
      const previousTrack = historyRef.current[historyRef.current.length - 1];
      setHistory((previous) => previous.slice(0, -1));
      return previousTrack;
    }

    const tracks = playlistRef.current;
    const current = currentTrackRef.current;
    if (!current || tracks.length === 0) {
      return null;
    }

    const currentIndex = getPlaylistIndex(tracks, current);
    if (currentIndex > 0) {
      return tracks[currentIndex - 1];
    }

    if (repeatModeRef.current === "playlist") {
      return tracks[tracks.length - 1] ?? null;
    }

    return null;
  }, [getPlaylistIndex]);

  const playTrack = useCallback(
    (track: Track, newPlaylist?: Track[]) => {
      startTrack(track, { newPlaylist, autoPlay: true, pushHistory: true });
    },
    [startTrack],
  );

  const playNext = useCallback(() => {
    const nextTrack = resolveNextTrack();
    if (!nextTrack) {
      setIsPlaying(false);
      return;
    }

    startTrack(nextTrack, { autoPlay: true, pushHistory: true });
  }, [resolveNextTrack, startTrack]);

  const playPrevious = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      setCurrentTime(0);
      persistPosition(0);
      return;
    }

    const previousTrack = resolvePreviousTrack();
    if (!previousTrack) {
      if (audio) {
        audio.currentTime = 0;
        setCurrentTime(0);
        persistPosition(0);
      }
      return;
    }

    startTrack(previousTrack, { autoPlay: true, pushHistory: false });
  }, [persistPosition, resolvePreviousTrack, startTrack]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;

    if (!currentTrackRef.current) {
      const firstTrack = playlistRef.current[0];
      if (firstTrack) {
        startTrack(firstTrack, { autoPlay: true, pushHistory: false });
      }
      return;
    }

    if (!audio) {
      setIsPlaying((previous) => !previous);
      return;
    }

    if (audio.paused) {
      setIsPlaying(true);
      void audio.play().catch(() => {
        setIsPlaying(false);
        toast.error("Playback was blocked. Tap the player once and try again.");
      });
      return;
    }

    audio.pause();
    setIsPlaying(false);
  }, [startTrack]);

  const showFloatingPlayer = useCallback(() => {
    setIsFloatingPlayerOpen(true);
  }, []);

  const hideFloatingPlayer = useCallback(() => {
    setIsFloatingPlayerOpen(false);
  }, []);

  const closePlayer = useCallback(() => {
    audioRef.current?.pause();
    pendingSeekRef.current = null;
    setCurrentTrack(null);
    setPlaylist([]);
    setQueue([]);
    setHistory([]);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setHasError(false);
    setIsBuffering(false);
    setIsFloatingPlayerOpen(false);

    if (typeof window !== "undefined") {
      const storageKeys = storageKeysRef.current;
      if (storageKeys) {
        window.localStorage.removeItem(storageKeys.session);
      }
    }
  }, []);

  const toggleShuffle = useCallback(() => {
    setIsShuffle((previous) => !previous);
  }, []);

  const setVolume = useCallback((nextVolume: number) => {
    const normalized = clamp(nextVolume, 0, 1);
    setVolumeState(normalized);
    if (normalized > 0 && isMuted) {
      setIsMuted(false);
    }
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    setIsMuted((previous) => !previous);
  }, []);

  const setPlaybackRate = useCallback((nextRate: number) => {
    setPlaybackRateState(clamp(nextRate, 0.5, 2));
  }, []);

  const seekToPercent = useCallback((percent: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) {
      return;
    }

    const nextTime = clamp((percent / 100) * audio.duration, 0, audio.duration);
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
    persistPosition(nextTime);
  }, [persistPosition]);

  const seekBy = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const nextTime = clamp(
      audio.currentTime + seconds,
      0,
      Number.isFinite(audio.duration) ? audio.duration : audio.currentTime + seconds,
    );
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
    persistPosition(nextTime);
  }, [persistPosition]);

  const addToQueue = useCallback((track: Track) => {
    const normalized = normalizeTrack(track);
    if (!normalized) {
      return;
    }

    setQueue((previous) => {
      if (previous.some((candidate) => trackEquals(candidate, normalized))) {
        return previous;
      }

      return [...previous, normalized].slice(-MAX_QUEUE_ITEMS);
    });

    toast.success(`Queued "${normalized.title}"`);
  }, []);

  const removeFromQueue = useCallback((trackId: string | number) => {
    const matcher = String(trackId);
    setQueue((previous) => previous.filter((track) => String(track.id) !== matcher));
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  const refreshPlaylists = useCallback(async () => {
    await fetchPlaylists();
    await queryClient.invalidateQueries({ queryKey: ["playlists"] });
  }, [fetchPlaylists, queryClient]);

  const toggleFavorite = useCallback(
    async (trackId: string | number, fallbackFavorite?: boolean) => {
      const numericTrackId = Number(trackId);
      if (!Number.isFinite(numericTrackId)) {
        toast.error("This track cannot be favorited.");
        return;
      }

      const currentFavorite =
        currentTrackRef.current && String(currentTrackRef.current.id) === String(trackId)
          ? Boolean(currentTrackRef.current.isFavorite)
          : Boolean(fallbackFavorite);

      const optimistic = !currentFavorite;
      syncTrackFavorite(trackId, optimistic);

      try {
        const response = await fetch(
          `${getBackendApiRoot()}/files/file/${numericTrackId}/favorite`,
          {
            method: "POST",
            headers: getAuthHeaders(),
          },
        );

        if (!response.ok) {
          throw new Error("Failed to update favorite status.");
        }

        const payload = await response.json();
        const nextFavorite = Boolean(payload?.is_favorite ?? optimistic);
        syncTrackFavorite(trackId, nextFavorite);
        await queryClient.invalidateQueries({ queryKey: ["files"] });
        await queryClient.invalidateQueries({ queryKey: ["folders"] });
        toast.success(nextFavorite ? "Added to favorites." : "Removed from favorites.");
      } catch (error) {
        syncTrackFavorite(trackId, currentFavorite);
        toast.error(error instanceof Error ? error.message : "Failed to update favorite status.");
      }
    },
    [queryClient, syncTrackFavorite],
  );

  const addToPlaylist = useCallback(
    async (trackId: string | number, playlistId: number) => {
      const numericTrackId = Number(trackId);
      if (!Number.isFinite(numericTrackId)) {
        toast.error("This track cannot be added to a playlist.");
        return;
      }

      const response = await fetch(`${getBackendApiRoot()}/playlists/${playlistId}/add`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ file_id: numericTrackId }),
      });

      if (!response.ok) {
        throw new Error("Failed to add track to playlist.");
      }

      setPlaylists((previous) =>
        previous.map((playlist) =>
          playlist.id === playlistId
            ? {
                ...playlist,
                trackIds: playlist.trackIds.includes(numericTrackId)
                  ? playlist.trackIds
                  : [...playlist.trackIds, numericTrackId],
              }
            : playlist,
        ),
      );

      await queryClient.invalidateQueries({ queryKey: ["playlists"] });
      await queryClient.invalidateQueries({ queryKey: ["files"] });
      toast.success("Added to playlist.");
    },
    [queryClient],
  );

  const removeFromPlaylist = useCallback(
    async (trackId: string | number, playlistId: number) => {
      const numericTrackId = Number(trackId);
      if (!Number.isFinite(numericTrackId)) {
        toast.error("This track cannot be removed from the playlist.");
        return;
      }

      const response = await fetch(`${getBackendApiRoot()}/playlists/${playlistId}/remove`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ file_id: numericTrackId }),
      });

      if (!response.ok) {
        throw new Error("Failed to remove track from playlist.");
      }

      setPlaylists((previous) =>
        previous.map((playlist) =>
          playlist.id === playlistId
            ? {
                ...playlist,
                trackIds: playlist.trackIds.filter((candidate) => candidate !== numericTrackId),
              }
            : playlist,
        ),
      );

      await queryClient.invalidateQueries({ queryKey: ["playlists"] });
      await queryClient.invalidateQueries({ queryKey: ["files"] });
      toast.success("Removed from playlist.");
    },
    [queryClient],
  );

  const createPlaylist = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) {
        toast.error("Playlist name is required.");
        return;
      }

      const response = await fetch(`${getBackendApiRoot()}/playlists`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ name: trimmed }),
      });

      if (!response.ok) {
        throw new Error("Failed to create playlist.");
      }

      const payload = await response.json();
      setPlaylists((previous) => [
        ...previous,
        {
          id: Number(payload.id),
          name: payload.name || trimmed,
          description: payload.description || "",
          trackIds: [],
        },
      ]);

      await queryClient.invalidateQueries({ queryKey: ["playlists"] });
      toast.success("Playlist created.");
    },
    [queryClient],
  );

  const deletePlaylist = useCallback(
    async (playlistId: number) => {
      const response = await fetch(`${getBackendApiRoot()}/playlists/${playlistId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error("Failed to delete playlist.");
      }

      setPlaylists((previous) => previous.filter((playlist) => playlist.id !== playlistId));
      await queryClient.invalidateQueries({ queryKey: ["playlists"] });
      await queryClient.invalidateQueries({ queryKey: ["files"] });
      toast.success("Playlist deleted.");
    },
    [queryClient],
  );

  const downloadTrack = useCallback(async (track: Track) => {
    const normalized = normalizeTrack(track);
    if (!normalized) {
      toast.error("No track is ready for download.");
      return;
    }

    const targetUrl = normalized.downloadUrl || normalized.src;
    const toastId = `audio-download-${normalized.id}`;

    try {
      toast.loading(`Downloading "${normalized.title}"...`, { id: toastId });
      await authenticatedDownload(targetUrl, {
        filename: `${normalized.title}.mp3`,
        headers: getAuthHeaders(),
        onProgress: (progress) => {
          toast.loading(`Downloading "${normalized.title}": ${progress}%`, {
            id: toastId,
          });
        },
      });
      toast.success(`Downloaded "${normalized.title}".`, { id: toastId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Download failed.", { id: toastId });
    }
  }, []);

  const downloadCurrentTrack = useCallback(async () => {
    if (!currentTrackRef.current) {
      toast.error("No track is playing right now.");
      return;
    }

    await downloadTrack(currentTrackRef.current);
  }, [downloadTrack]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    const audio = audioRef.current;
    let cancelled = false;

    streamRefreshAttemptRef.current = false;
    setResolvedTrackSrc(null);

    if (audio) {
      audio.pause();
      if (audio.getAttribute("src")) {
        audio.removeAttribute("src");
        audio.load();
      }
    }

    if (!currentTrack?.src) {
      return () => {
        cancelled = true;
      };
    }

    setHasError(false);
    setIsBuffering(true);

    void getSignedMediaStreamUrl(currentTrack.src)
      .then((authorizedSrc) => {
        if (!cancelled) {
          setResolvedTrackSrc(authorizedSrc);
        }
      })
      .catch((error) => {
        if (cancelled) return;
        setHasError(true);
        setIsBuffering(false);
        setIsPlaying(false);
        toast.error(error instanceof Error ? error.message : "Audio playback authorization failed.");
      });

    return () => {
      cancelled = true;
    };
  }, [currentTrack?.id, currentTrack?.src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !resolvedTrackSrc) {
      return;
    }

    if (audio.getAttribute("src") !== resolvedTrackSrc) {
      audio.src = resolvedTrackSrc;
      audio.load();
    }
  }, [resolvedTrackSrc]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack || !resolvedTrackSrc) {
      return;
    }

    if (isPlaying) {
      void audio.play().catch(() => {
        setIsPlaying(false);
      });
      return;
    }

    audio.pause();
  }, [currentTrack, isPlaying, resolvedTrackSrc]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) {
      return;
    }

    if (!currentTrack) {
      navigator.mediaSession.metadata = null;
      return;
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist || "HIVE.OS Audio",
      album: "HIVE.OS",
      artwork: currentTrack.coverArt
        ? [{ src: currentTrack.coverArt, sizes: "512x512", type: "image/jpeg" }]
        : [],
    });

    const actionHandlers: Array<[MediaSessionAction, () => void]> = [
      ["play", togglePlay],
      ["pause", togglePlay],
      ["nexttrack", playNext],
      ["previoustrack", playPrevious],
      ["seekbackward", () => seekBy(-10)],
      ["seekforward", () => seekBy(10)],
    ];

    actionHandlers.forEach(([action, handler]) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Ignore unsupported handlers.
      }
    });
  }, [currentTrack, playNext, playPrevious, seekBy, togglePlay]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLButtonElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable
      ) {
        return;
      }

      if (!target?.closest("[data-audio-player]")) {
        return;
      }

      switch (event.code) {
        case "Space":
          event.preventDefault();
          togglePlay();
          break;
        case "ArrowRight":
          if (event.shiftKey) {
            event.preventDefault();
            seekBy(15);
          }
          break;
        case "ArrowLeft":
          if (event.shiftKey) {
            event.preventDefault();
            seekBy(-15);
          }
          break;
        case "KeyM":
          toggleMute();
          break;
        case "KeyL":
          if (currentTrackRef.current) {
            void toggleFavorite(
              currentTrackRef.current.id,
              currentTrackRef.current.isFavorite,
            );
          }
          break;
        case "BracketRight":
          if (event.shiftKey) {
            playNext();
          }
          break;
        case "BracketLeft":
          if (event.shiftKey) {
            playPrevious();
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [playNext, playPrevious, seekBy, toggleFavorite, toggleMute, togglePlay]);

  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const nextDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
    setDuration(nextDuration);

    if (pendingSeekRef.current !== null && Number.isFinite(pendingSeekRef.current)) {
      audio.currentTime = clamp(pendingSeekRef.current, 0, nextDuration || pendingSeekRef.current);
      setCurrentTime(audio.currentTime);
      pendingSeekRef.current = null;
    }

    setIsBuffering(false);
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    setCurrentTime(audio.currentTime);
    if (Number.isFinite(audio.duration)) {
      setDuration(audio.duration);
    }
    persistPosition(audio.currentTime);
  }, [persistPosition]);

  const handleEnded = useCallback(() => {
    const audio = audioRef.current;

    if (repeatModeRef.current === "track" && audio) {
      audio.currentTime = 0;
      setCurrentTime(0);
      void audio.play().catch(() => {
        setIsPlaying(false);
      });
      return;
    }

    const nextTrack = resolveNextTrack();
    if (!nextTrack) {
      setIsPlaying(false);
      setCurrentTime(duration);
      return;
    }

    startTrack(nextTrack, { autoPlay: true, pushHistory: true });
  }, [duration, resolveNextTrack, startTrack]);

  const handleError = useCallback(() => {
    const track = currentTrackRef.current;
    const audio = audioRef.current;

    if (track && !streamRefreshAttemptRef.current) {
      streamRefreshAttemptRef.current = true;
      pendingSeekRef.current = audio?.currentTime ?? currentTime;
      setIsBuffering(true);

      void getSignedMediaStreamUrl(track.src, { forceRefresh: true })
        .then((authorizedSrc) => {
          if (authorizedSrc === resolvedTrackSrc) {
            throw new Error("The refreshed stream URL did not change.");
          }

          setHasError(false);
          setResolvedTrackSrc(authorizedSrc);
        })
        .catch(() => {
          setHasError(true);
          setIsBuffering(false);
          setIsPlaying(false);
          toast.error("Audio playback failed for this track.");
        });
      return;
    }

    setHasError(true);
    setIsBuffering(false);
    setIsPlaying(false);
    toast.error("Audio playback failed for this track.");
  }, [currentTime, resolvedTrackSrc]);

  const progress = useMemo(() => {
    if (!duration || duration <= 0) {
      return 0;
    }

    return clamp((currentTime / duration) * 100, 0, 100);
  }, [currentTime, duration]);

  const value = useMemo<AudioContextType>(
    () => ({
      currentTrack,
      playlist,
      queue,
      history,
      playlists,
      isFloatingPlayerOpen,
      isPlaying,
      isShuffle,
      repeatMode,
      volume,
      isMuted,
      playbackRate,
      currentTime,
      duration,
      progress,
      isBuffering,
      hasError,
      playTrack,
      playNext,
      playPrevious,
      togglePlay,
      showFloatingPlayer,
      hideFloatingPlayer,
      closePlayer,
      toggleShuffle,
      setRepeatMode,
      setVolume,
      toggleMute,
      setPlaybackRate,
      seekToPercent,
      seekBy,
      addToQueue,
      removeFromQueue,
      clearQueue,
      toggleFavorite,
      syncFavoriteStatus: syncTrackFavorite,
      refreshPlaylists,
      addToPlaylist,
      removeFromPlaylist,
      createPlaylist,
      deletePlaylist,
      downloadCurrentTrack,
      downloadTrack,
    }),
    [
      addToPlaylist,
      addToQueue,
      clearQueue,
      closePlayer,
      createPlaylist,
      currentTime,
      currentTrack,
      deletePlaylist,
      downloadCurrentTrack,
      downloadTrack,
      duration,
      hasError,
      history,
      hideFloatingPlayer,
      isBuffering,
      isFloatingPlayerOpen,
      isMuted,
      isPlaying,
      isShuffle,
      playbackRate,
      playNext,
      playPrevious,
      playTrack,
      playlist,
      playlists,
      progress,
      queue,
      refreshPlaylists,
      removeFromPlaylist,
      removeFromQueue,
      repeatMode,
      seekBy,
      seekToPercent,
      setPlaybackRate,
      setRepeatMode,
      setVolume,
      showFloatingPlayer,
      syncTrackFavorite,
      toggleFavorite,
      toggleMute,
      togglePlay,
      toggleShuffle,
      volume,
    ],
  );

  return (
    <AudioContext.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        preload="metadata"
        className="hidden"
        onLoadedMetadata={handleLoadedMetadata}
        onDurationChange={handleTimeUpdate}
        onTimeUpdate={handleTimeUpdate}
        onCanPlay={() => setIsBuffering(false)}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => {
          setIsBuffering(false);
          setIsPlaying(true);
        }}
        onPause={() => {
          const audio = audioRef.current;
          if (!audio?.ended) {
            setIsPlaying(false);
          }
        }}
        onEnded={handleEnded}
        onError={handleError}
      />
    </AudioContext.Provider>
  );
}

export const useGlobalAudio = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error("useGlobalAudio must be used within GlobalAudioProvider");
  }

  return context;
};
