// components/ui/video-player.tsx
"use client";

import React, { useState, useRef, useEffect, MouseEvent as ReactMouseEvent } from 'react';
import Hls from 'hls.js';
import { toast } from 'sonner';
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, Loader2,
  SkipBack, SkipForward, Subtitles, Settings, Gauge, Check,
  AlertCircle, PictureInPicture, RotateCcw, RotateCw, Repeat, Keyboard, ListVideo
} from 'lucide-react';
import { getErrorMessage } from '@/lib/errors';
import {
  getAuthHeaders,
  getSignedMediaStreamUrl,
  getWorkspaceScopeKey,
} from '@/lib/runtime-context';
import { cn } from '@/lib/utils';

export interface SubtitleTrack {
  src: string;
  srcLang: string;
  label: string;
  default?: boolean;
}

export interface VideoVersion {
  label: string;
  url: string;
}

export interface VideoChapter {
  time: number;
  label: string;
}

export interface VideoPlayerProps {
  src: string;                 // HLS, public media, or a protected /files/{id}/serve URL
  nativeSrc?: string;          // Optional direct MP4/protected URL used when HLS playback is unavailable
  poster?: string;
  className?: string;
  watermark?: string | null;   // Brand app title shown as floating Udemy-style watermark; null hides it
  title?: string;
  onPrevious?: () => void;
  onNext?: () => void;
  subtitles?: SubtitleTrack[];
  videoVersions?: VideoVersion[];
  authToken?: string | null;
  chapters?: VideoChapter[];
  resumeKey?: string;
  rememberProgress?: boolean;
  playbackRates?: number[];
  skipSeconds?: number;
  adaptiveQualityPending?: boolean;
}

type PiPSupportMode = 'standard' | 'webkit' | 'none';
type PlayerQualityLevel = { label?: string; height?: number; url?: string | string[] };
const HLS_PLAYLIST_PATTERN = /\.m3u8(?:$|\?)/i;

const getProgressIdentity = (src: string, resumeKey?: string): string => {
  if (resumeKey) return resumeKey;

  try {
    const parsed = new URL(src, 'http://hive.local');
    return parsed.pathname;
  } catch {
    return src.split(/[?#]/, 1)[0] || 'video';
  }
};

// ============================================================================
// 🎬 FLOATING WATERMARK — Udemy-style moving brand watermark
// Cycles through 9 safe screen zones every 15 s with a CSS fade transition.
// Zones are arranged in a 3×3 grid, offset from edges to avoid the controls.
// ============================================================================
const WATERMARK_ZONES = [
  // [top%, left%, textAlign]
  { top: '12%', left: '8%'   },   // top-left
  { top: '12%', left: '50%'  },   // top-center
  { top: '12%', left: '76%'  },   // top-right  (stays clear of controls bar)
  { top: '45%', left: '8%'   },   // mid-left
  { top: '45%', left: '50%'  },   // mid-center
  { top: '45%', left: '76%'  },   // mid-right
  { top: '72%', left: '8%'   },   // bot-left
  { top: '72%', left: '50%'  },   // bot-center
  { top: '72%', left: '76%'  },   // bot-right
] as const;

const WATERMARK_INTERVAL_MS = 15_000; // 15 seconds between moves

function FloatingWatermark({ text }: { text: string }) {
  const [zoneIdx, setZoneIdx] = React.useState(() => Math.floor(Math.random() * WATERMARK_ZONES.length));
  const [visible, setVisible] = React.useState(true);

  React.useEffect(() => {
    let fadeTimeout: ReturnType<typeof setTimeout> | null = null;
    const timer = setInterval(() => {
      // Fade out → change zone → fade in
      setVisible(false);
      fadeTimeout = setTimeout(() => {
        setZoneIdx(prev => {
          // Pick a different zone each time
          let next = Math.floor(Math.random() * WATERMARK_ZONES.length);
          if (next === prev) next = (next + 1) % WATERMARK_ZONES.length;
          return next;
        });
        setVisible(true);
      }, 600); // matches CSS transition duration
    }, WATERMARK_INTERVAL_MS);

    return () => {
      clearInterval(timer);
      if (fadeTimeout) clearTimeout(fadeTimeout);
    };
  }, []);

  const zone = WATERMARK_ZONES[zoneIdx];

  return (
    <div
      className="absolute z-20 pointer-events-none select-none"
      style={{
        top: zone.top,
        left: zone.left,
        transform: 'translateX(-50%)',
        opacity: visible ? 0.35 : 0,
        transition: 'opacity 0.6s ease-in-out',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        className="text-white font-black tracking-[0.2em] uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
        style={{ fontSize: 'clamp(10px, 1.4vw, 15px)', letterSpacing: '0.18em' }}
      >
        {text}
      </span>
    </div>
  );
}

function buildPlayerRequestHeaders(authToken?: string | null): Record<string, string> {
  const headers = getAuthHeaders();

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  return headers;
}

export function VideoPlayer({
  src, 
  nativeSrc,
  poster, 
  className, 
  watermark, 
  title,
  onPrevious, 
  onNext, 
  subtitles = [], 
  videoVersions = [],
  authToken = null,
  chapters = [],
  resumeKey,
  rememberProgress = true,
  playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
  skipSeconds = 10,
  adaptiveQualityPending = false
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pipPendingRef = useRef(false);
  const streamRefreshAttemptRef = useRef(false);
  const hlsRecoveryAttemptRef = useRef(false);
  const pendingStreamSeekRef = useRef<number | null>(null);
  const lastSavedProgressRef = useRef(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState("0:00");
  const [duration, setDuration] = useState("0:00");
  const [currentSeconds, setCurrentSeconds] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const [isBuffering, setIsBuffering] = useState(true);
  const [hasError, setHasError] = useState(false); 
  const [showControls, setShowControls] = useState(true);
  
  const [activeSubtitle, setActiveSubtitle] = useState<number>(-1);
  const [playbackRate, setPlaybackRate] = useState(1);
  
  // Quality State
  const [qualityLevels, setQualityLevels] = useState<PlayerQualityLevel[]>([]);
  const [activeQuality, setActiveQuality] = useState<number>(-1);
  
  const [showSpeed, setShowSpeed] = useState(false);
  const [showQuality, setShowQuality] = useState(false);
  const [showCC, setShowCC] = useState(false);
  const [showChapters, setShowChapters] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [isPiPMode, setIsPiPMode] = useState(false);
  const [isLooping, setIsLooping] = useState(false);

  const [showPlayAnim, setShowPlayAnim] = useState(false);
  const [showPauseAnim, setShowPauseAnim] = useState(false);
  const [seekAnimDir, setSeekAnimDir] = useState<'forward' | 'backward' | null>(null);
  const [hoverTime, setHoverTime] = useState<string | null>(null);
  const [hoverProgress, setHoverProgress] = useState<number>(0);
  const [canPiP, setCanPiP] = useState(false);
  const [isPiPBusy, setIsPiPBusy] = useState(false);
  const [resumeAt, setResumeAt] = useState<number | null>(null);
  const [showRemainingTime, setShowRemainingTime] = useState(false);
  const [pipSupportMode, setPipSupportMode] = useState<PiPSupportMode>('none');
  const [authorizedSrc, setAuthorizedSrc] = useState('');
  const [authorizedNativeSrc, setAuthorizedNativeSrc] = useState<string | undefined>(undefined);

  const playAnimTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const seekAnimTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [localSubtitles, setLocalSubtitles] = useState<SubtitleTrack[]>([]);
  const subtitlesString = JSON.stringify(subtitles);
  const orderedChapters = [...chapters].sort((a, b) => a.time - b.time);
  const activeChapter = orderedChapters.reduce<VideoChapter | null>((current, chapter) => (
    currentSeconds >= chapter.time ? chapter : current
  ), null);
  const activeChapterIndex = orderedChapters.reduce((currentIndex, chapter, index) => (
    currentSeconds >= chapter.time ? index : currentIndex
  ), -1);
  const progressStorageKey = rememberProgress
    ? `hive-video-progress:${getWorkspaceScopeKey()}:${getProgressIdentity(src, resumeKey)}`
    : null;
  const availablePlaybackRates = Array.from(new Set(playbackRates)).sort((a, b) => a - b);
  const isHlsSource = HLS_PLAYLIST_PATTERN.test(src);
  const hasSelectableDirectQualities = !isHlsSource && qualityLevels.length > 1;
  const canChooseQuality = isHlsSource || hasSelectableDirectQualities || adaptiveQualityPending;

  const clearSavedProgress = () => {
    if (!progressStorageKey || typeof window === 'undefined') return;
    window.localStorage.removeItem(progressStorageKey);
    lastSavedProgressRef.current = -1;
    setResumeAt(null);
  };

  const persistProgress = (seconds: number, total: number) => {
    if (!progressStorageKey || typeof window === 'undefined' || !Number.isFinite(total) || total <= 0) {
      return;
    }

    if (seconds >= total - 10) {
      clearSavedProgress();
      return;
    }

    const roundedSeconds = Math.floor(seconds);
    if (roundedSeconds === lastSavedProgressRef.current) {
      return;
    }

    window.localStorage.setItem(progressStorageKey, String(roundedSeconds));
    lastSavedProgressRef.current = roundedSeconds;
  };

  const seekBy = (seconds: number) => {
    if (!videoRef.current || !Number.isFinite(videoRef.current.duration)) return;
    const nextTime = Math.min(
      Math.max(videoRef.current.currentTime + seconds, 0),
      videoRef.current.duration || 0
    );
    videoRef.current.currentTime = nextTime;
    triggerSeekAnim(seconds >= 0 ? 'forward' : 'backward');
  };

  const applyResumePoint = () => {
    if (!videoRef.current || resumeAt === null) return;
    videoRef.current.currentTime = Math.min(resumeAt, videoRef.current.duration || resumeAt);
    setCurrentSeconds(videoRef.current.currentTime);
    setCurrentTime(formatTime(videoRef.current.currentTime));
    setProgress(videoRef.current.duration ? (videoRef.current.currentTime / videoRef.current.duration) * 100 : 0);
    setResumeAt(null);
  };

  const jumpToChapter = (index: number) => {
    const chapter = orderedChapters[index];
    if (!videoRef.current || !chapter) return;

    videoRef.current.currentTime = chapter.time;
    setCurrentSeconds(chapter.time);
    setCurrentTime(formatTime(chapter.time));
    setShowChapters(false);
  };

  const jumpRelativeChapter = (direction: -1 | 1) => {
    if (!orderedChapters.length) return;

    const fallbackIndex = direction > 0 ? 0 : orderedChapters.length - 1;
    const targetIndex = activeChapterIndex === -1
      ? fallbackIndex
      : Math.min(Math.max(activeChapterIndex + direction, 0), orderedChapters.length - 1);

    jumpToChapter(targetIndex);
  };

  const toggleLoop = () => {
    setIsLooping((previous) => !previous);
  };

  // 1. Fetch Subtitles securely using the provided Auth Token
  useEffect(() => {
    const objectUrls: string[] = [];

    const loadSubtitlesAsBlobs = async () => {
      const processedSubs = await Promise.all(
        subtitles.map(async (sub) => {
          try {
            const res = await fetch(sub.src, { headers: buildPlayerRequestHeaders(authToken) });
            if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
            
            const text = await res.text();
            const blob = new Blob([text], { type: 'text/vtt' });
            const localUrl = URL.createObjectURL(blob);
            objectUrls.push(localUrl);

            return { ...sub, src: localUrl };
          } catch (error) {
            return sub; 
          }
        })
      );
      
      setLocalSubtitles(processedSubs);
      const defaultIdx = processedSubs.findIndex(s => s.default);
      if (defaultIdx !== -1) setActiveSubtitle(defaultIdx);
    };

    if (subtitles.length > 0) loadSubtitlesAsBlobs();
    else { setLocalSubtitles([]); setActiveSubtitle(-1); }

    return () => objectUrls.forEach(url => URL.revokeObjectURL(url));
  }, [subtitlesString, authToken]);

  useEffect(() => {
    if (!progressStorageKey || typeof window === 'undefined') {
      setResumeAt(null);
      lastSavedProgressRef.current = -1;
      return;
    }

    const savedProgress = Number(window.localStorage.getItem(progressStorageKey) || 0);
    if (Number.isFinite(savedProgress) && savedProgress > 5) {
      setResumeAt(savedProgress);
      lastSavedProgressRef.current = savedProgress;
      return;
    }

    setResumeAt(null);
    lastSavedProgressRef.current = -1;
  }, [progressStorageKey]);

  useEffect(() => {
    let cancelled = false;

    streamRefreshAttemptRef.current = false;
    hlsRecoveryAttemptRef.current = false;
    setAuthorizedSrc('');
    setAuthorizedNativeSrc(undefined);
    setHasError(false);
    setIsBuffering(true);

    const authorizeSources = async () => {
      const [nextSrc, nextNativeSrc] = await Promise.all([
        isHlsSource ? Promise.resolve(src) : getSignedMediaStreamUrl(src),
        nativeSrc ? getSignedMediaStreamUrl(nativeSrc) : Promise.resolve(undefined),
      ]);

      if (cancelled) return;
      setAuthorizedSrc(nextSrc);
      setAuthorizedNativeSrc(nextNativeSrc);
    };

    void authorizeSources().catch((error) => {
      if (cancelled) return;
      setIsBuffering(false);
      setHasError(true);
      toast.error(error instanceof Error ? error.message : 'Video playback authorization failed.');
    });

    return () => {
      cancelled = true;
    };
  }, [isHlsSource, nativeSrc, src]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleBeforeUnload = () => {
      if (videoRef.current) {
        persistProgress(videoRef.current.currentTime, videoRef.current.duration || 0);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [progressStorageKey]);

  const videoVersionsString = JSON.stringify(videoVersions);

  // 2. Load Fallback MP4 Qualities if not using HLS
  useEffect(() => {
    if (!isHlsSource && videoVersions.length > 0) {
      // Prevent redundant state updates
      if (JSON.stringify(qualityLevels) !== videoVersionsString) {
        setQualityLevels(videoVersions);
        setActiveQuality(0); 
      }
      return;
    }

    if (!isHlsSource) {
      // Only reset if not already reset
      if (qualityLevels.length > 0) {
        setQualityLevels([]);
        setActiveQuality(-1);
      }
    }
  }, [isHlsSource, videoVersionsString]);

  // 3. Mount Video Source (HLS vs Native)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !authorizedSrc) return;

    setIsBuffering(true);
    setIsPlaying(false);
    setHasError(false);
    setProgress(0);
    setCurrentSeconds(0);
    setDurationSeconds(0);

    const useHls = isHlsSource;
    const handleCanPlay = () => setIsBuffering(false);
    const handleLoadedMetadata = () => {
      if (pendingStreamSeekRef.current !== null) {
        video.currentTime = Math.min(
          pendingStreamSeekRef.current,
          video.duration || pendingStreamSeekRef.current,
        );
        pendingStreamSeekRef.current = null;
      }
      setIsBuffering(false);
    };
    const handleNativeError = () => {
      const refreshTarget = isHlsSource ? nativeSrc : src;
      if (refreshTarget && !streamRefreshAttemptRef.current) {
        streamRefreshAttemptRef.current = true;
        const resumeTime = video.currentTime || 0;
        void getSignedMediaStreamUrl(refreshTarget, { forceRefresh: true })
          .then((refreshedSrc) => {
            const currentAuthorizedSource = isHlsSource
              ? authorizedNativeSrc
              : authorizedSrc;
            if (refreshedSrc === currentAuthorizedSource) {
              setIsBuffering(false);
              setHasError(true);
              return;
            }

            pendingStreamSeekRef.current = resumeTime;
            setHasError(false);
            setIsBuffering(true);
            if (isHlsSource) {
              setAuthorizedNativeSrc(refreshedSrc);
            } else {
              setAuthorizedSrc(refreshedSrc);
            }
          })
          .catch(() => {
            setIsBuffering(false);
            setHasError(true);
          });
        return;
      }

      setIsBuffering(false);
      setHasError(true);
    };

    if (useHls) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          renderTextTracksNatively: true,
          xhrSetup: (xhr) => {
            const headers = buildPlayerRequestHeaders(authToken);

            Object.entries(headers).forEach(([key, value]) => {
              xhr.setRequestHeader(key, value);
            });
          }
        });
        hlsRef.current = hls;
        hls.loadSource(authorizedSrc);
        hls.attachMedia(video);
        
        hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
           setIsBuffering(false);
           hlsRecoveryAttemptRef.current = false;
           setQualityLevels(data.levels);
        });
        hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => setActiveQuality(data.level));
        hls.on(Hls.Events.ERROR, (event, data) => {
           if (data.fatal) {
             switch(data.type) {
               case Hls.ErrorTypes.NETWORK_ERROR:
                 if (!hlsRecoveryAttemptRef.current) {
                   hlsRecoveryAttemptRef.current = true;
                   hls.startLoad();
                 } else if (authorizedNativeSrc) {
                   pendingStreamSeekRef.current = video.currentTime || 0;
                   hls.destroy();
                   hlsRef.current = null;
                   video.addEventListener('canplay', handleCanPlay);
                   video.addEventListener('loadedmetadata', handleLoadedMetadata);
                   video.addEventListener('error', handleNativeError);
                   video.src = authorizedNativeSrc;
                   video.load();
                 } else {
                   setIsBuffering(false);
                   setHasError(true);
                 }
                 break;
               case Hls.ErrorTypes.MEDIA_ERROR:
                 if (!hlsRecoveryAttemptRef.current) {
                   hlsRecoveryAttemptRef.current = true;
                   hls.recoverMediaError();
                 } else if (authorizedNativeSrc) {
                   pendingStreamSeekRef.current = video.currentTime || 0;
                   hls.destroy();
                   hlsRef.current = null;
                   video.addEventListener('canplay', handleCanPlay);
                   video.addEventListener('loadedmetadata', handleLoadedMetadata);
                   video.addEventListener('error', handleNativeError);
                   video.src = authorizedNativeSrc;
                   video.load();
                 } else {
                   setIsBuffering(false);
                   setHasError(true);
                 }
                 break;
               default:
                 hls.destroy();
                 hlsRef.current = null;
                 setIsBuffering(false); 
                 setHasError(true);
                 break;
             }
           }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS
        video.src = authorizedSrc;
        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        video.addEventListener('error', handleNativeError);
      } else if (authorizedNativeSrc) {
        video.src = authorizedNativeSrc;
        video.load();
        video.addEventListener('canplay', handleCanPlay);
        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        video.addEventListener('error', handleNativeError);
      } else {
        setIsBuffering(false);
        setHasError(true);
      }
    } else {
      video.src = authorizedSrc;
      video.load();
      video.addEventListener('canplay', handleCanPlay);
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('error', handleNativeError);
    }

    return () => {
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('error', handleNativeError);

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [authToken, authorizedNativeSrc, authorizedSrc, isHlsSource, nativeSrc, src]);

  // 4. Inject Subtitles
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    while (video.firstChild) video.removeChild(video.firstChild);

    localSubtitles.forEach((sub, index) => {
      const track = document.createElement('track');
      track.kind = 'subtitles';
      track.src = sub.src;
      track.srclang = sub.srcLang;
      track.label = sub.label;
      if (index === activeSubtitle) track.default = true;
      video.appendChild(track);
    });

    const updateTracks = () => {
        const textTracks = video.textTracks;
        for (let i = 0; i < textTracks.length; i++) {
          // Use 'showing' so native PiP window also carries the active subtitle
          textTracks[i].mode = i === activeSubtitle ? 'showing' : 'hidden';
        }
    };
    // Run immediately, then once more after a tick to beat race conditions
    updateTracks();
    const timer = setTimeout(updateTracks, 300);
    return () => clearTimeout(timer);
  }, [activeSubtitle, localSubtitles]);

  useEffect(() => {
    // Feature-detect PiP support on mount using a real (not dummy) video element check
    const video = videoRef.current;
    if (!video) return;

    // Detect PiP support. Run on mount + video load so canPiP is accurate.
    const detectPiP = () => {
      const webkitVideo = video as HTMLVideoElement & {
        webkitSetPresentationMode?: (mode: string) => void;
        webkitSupportsPresentationMode?: (mode: string) => boolean;
      };
      const pip =
        typeof video.requestPictureInPicture === 'function' &&
        !video.disablePictureInPicture;

      const webkitPip =
        typeof webkitVideo.webkitSetPresentationMode === 'function' &&
        (typeof webkitVideo.webkitSupportsPresentationMode !== 'function' ||
          webkitVideo.webkitSupportsPresentationMode('picture-in-picture'));

      if (webkitPip) {
        setPipSupportMode('webkit');
        setCanPiP(true);
        return;
      }

      if (pip) {
        setPipSupportMode('standard');
        setCanPiP(true);
        return;
      }

      setPipSupportMode('none');
      setCanPiP(false);
    };

    detectPiP();
    video.addEventListener('loadedmetadata', detectPiP);
    video.addEventListener('canplay', detectPiP);
    const onEnterPiP = () => {
      setIsPiPMode(true);
      pipPendingRef.current = false;
      setIsPiPBusy(false);
    };
    const onLeavePiP = () => {
      setIsPiPMode(false);
      pipPendingRef.current = false;
      setIsPiPBusy(false);
    };
    const onSafariPiP = (e: any) => {
      const inPiP = e.target.webkitPresentationMode === 'picture-in-picture';
      setIsPiPMode(inPiP);
      pipPendingRef.current = false;
      setIsPiPBusy(false);
    };

    video.addEventListener('enterpictureinpicture', onEnterPiP);
    video.addEventListener('leavepictureinpicture', onLeavePiP);
    video.addEventListener('webkitpresentationmodechanged', onSafariPiP);

    return () => {
      video.removeEventListener('enterpictureinpicture', onEnterPiP);
      video.removeEventListener('leavepictureinpicture', onLeavePiP);
      video.removeEventListener('webkitpresentationmodechanged', onSafariPiP);
      video.removeEventListener('loadedmetadata', detectPiP);
      video.removeEventListener('canplay', detectPiP);
      // Exit PiP if the component unmounts while PiP is active (Vimeo does this too)
      if (typeof document !== 'undefined' && document.pictureInPictureElement === video) {
        document.exitPictureInPicture().catch(() => {});
      }
    };
  }, [nativeSrc, src]);

  const togglePiP = async () => {
    if (!videoRef.current || pipPendingRef.current) return;
    const video = videoRef.current;
    
    const webkitVideo = video as HTMLVideoElement & {
      webkitSetPresentationMode?: (mode: string) => void;
      webkitSupportsPresentationMode?: (mode: string) => boolean;
      webkitPresentationMode?: string;
    };

    // 1. Attempt Standard W3C PiP (Chromium, Firefox, Edge)
    const standardPipAvailable = typeof video.requestPictureInPicture === 'function' && !video.disablePictureInPicture;

    if (standardPipAvailable) {
      if (video.readyState < 2) {
        toast.error('Please wait for the video to load before using Picture-in-Picture.');
        return;
      }

      pipPendingRef.current = true;
      setIsPiPBusy(true);
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          video.focus();
          if (video.paused && !video.ended) {
            await video.play().catch(() => undefined);
          }
          await video.requestPictureInPicture();
        }
      } catch (err: unknown) {
        console.warn('PiP error:', getErrorMessage(err));
        if (err instanceof DOMException && err.name === 'NotAllowedError') {
          toast.error('PiP was blocked. Please interact with the video first.');
        } else {
          // If standard fails, try falling through to webkit if available
          if (typeof webkitVideo.webkitSetPresentationMode !== 'function') {
            toast.error('Could not activate Picture-in-Picture.');
          }
        }
      } finally {
        pipPendingRef.current = false;
        setIsPiPBusy(false);
      }
      
      // If we successfully triggered or failed standard and have no webkit fallback, we're done
      if (typeof webkitVideo.webkitSetPresentationMode !== 'function' || document.pictureInPictureElement) {
        return;
      }
    }

    // 2. Fallback to Safari (webkit) path
    if (
      typeof webkitVideo.webkitSetPresentationMode === 'function' &&
      (typeof webkitVideo.webkitSupportsPresentationMode !== 'function' ||
        webkitVideo.webkitSupportsPresentationMode('picture-in-picture'))
    ) {
      const current = webkitVideo.webkitPresentationMode;
      pipPendingRef.current = true;
      setIsPiPBusy(true);
      try {
        webkitVideo.webkitSetPresentationMode(current === 'picture-in-picture' ? 'inline' : 'picture-in-picture');
      } catch (err) {
        setIsPiPBusy(false);
        pipPendingRef.current = false;
      }
      return;
    }

    toast.error('Picture-in-Picture is not supported in this browser.');
  };

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
      return;
    }

    const mediaSession = navigator.mediaSession;

    if (typeof window !== 'undefined' && typeof (window as any).MediaMetadata === 'function') {
      try {
        mediaSession.metadata = new (window as any).MediaMetadata({
          title: title || 'Lesson video',
          artwork: poster ? [{ src: poster }] : [],
        });
      } catch {
        mediaSession.metadata = null;
      }
    }

    const bindAction = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try {
        mediaSession.setActionHandler(action, handler);
      } catch {
        // Some browsers expose mediaSession without every handler.
      }
    };

    bindAction('play', async () => {
      await videoRef.current?.play().catch(() => undefined);
    });
    bindAction('pause', () => {
      videoRef.current?.pause();
    });
    bindAction('seekbackward', (details: any) => {
      seekBy(-(details?.seekOffset || skipSeconds));
    });
    bindAction('seekforward', (details: any) => {
      seekBy(details?.seekOffset || skipSeconds);
    });
    bindAction('previoustrack', onPrevious ? () => onPrevious() : null);
    bindAction('nexttrack', onNext ? () => onNext() : null);

    return () => {
      bindAction('play', null);
      bindAction('pause', null);
      bindAction('seekbackward', null);
      bindAction('seekforward', null);
      bindAction('previoustrack', null);
      bindAction('nexttrack', null);
      mediaSession.metadata = null;
    };
  }, [title, poster, onNext, onPrevious, skipSeconds, src]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const container = containerRef.current;
      const activeElement = document.activeElement as HTMLElement | null;
      const playerOwnsFocus = Boolean(
        container &&
        (container.contains(activeElement) || document.fullscreenElement === container)
      );
      if (!playerOwnsFocus) return;

      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLButtonElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLAnchorElement ||
        target?.isContentEditable
      ) return;
      if (!videoRef.current) return;

      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
        return;
      }
      
      if (e.key >= '0' && e.key <= '9') {
        const percentage = parseInt(e.key) * 10;
        videoRef.current.currentTime = (percentage / 100) * videoRef.current.duration;
        return;
      }

      switch(e.key.toLowerCase()) {
        case ' ': 
        case 'k': e.preventDefault(); togglePlay(); break;
        case 'j': e.preventDefault(); seekBy(-skipSeconds); break;
        case 'l': e.preventDefault(); seekBy(skipSeconds); break;
        case 'f': e.preventDefault(); toggleFullscreen(); break;
        case 'm': e.preventDefault(); toggleMute(); break;
        case 'arrowright': e.preventDefault(); videoRef.current.currentTime += 5; break;
        case 'arrowleft': e.preventDefault(); videoRef.current.currentTime -= 5; break;
        case 'arrowup': 
          e.preventDefault(); 
          const newVolUp = Math.min(1, volume + 0.05);
          setVolume(newVolUp);
          videoRef.current.volume = newVolUp;
          if (newVolUp > 0) { setIsMuted(false); videoRef.current.muted = false; }
          break;
        case 'arrowdown': 
          e.preventDefault(); 
          const newVolDown = Math.max(0, volume - 0.05);
          setVolume(newVolDown);
          videoRef.current.volume = newVolDown;
          if (newVolDown === 0) { setIsMuted(true); videoRef.current.muted = true; }
          break;
        case 'c': e.preventDefault(); setShowCC(prev => !prev); break;
        case 'i': e.preventDefault(); togglePiP(); break;
        case 'o': e.preventDefault(); togglePiP(); break;
        case 'n': e.preventDefault(); jumpRelativeChapter(1); break;
        case 'p': e.preventDefault(); jumpRelativeChapter(-1); break;
        case 'r': e.preventDefault(); toggleLoop(); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, orderedChapters.length, showCC, skipSeconds, volume]);

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        if (!showSpeed && !showQuality && !showCC && !showChapters && !showShortcuts) setShowControls(false);
      }, 2500);
    }
  };

  const handleMouseLeave = () => {
    if (isPlaying && !showSpeed && !showQuality && !showCC && !showChapters && !showShortcuts) {
      setShowControls(false);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || !isFinite(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const nextCurrentTime = videoRef.current.currentTime || 0;
    const nextDuration = videoRef.current.duration || 0;

    setCurrentSeconds(nextCurrentTime);
    setDurationSeconds(nextDuration);
    setProgress(nextDuration ? (nextCurrentTime / nextDuration) * 100 : 0);
    setCurrentTime(formatTime(nextCurrentTime));

    if (progressStorageKey && Math.floor(nextCurrentTime) % 5 === 0) {
      persistProgress(nextCurrentTime, nextDuration);
    }
  };

  const handleProgressMouseMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !videoRef.current.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const hoverX = e.clientX - rect.left;
    let percent = hoverX / rect.width;
    if (percent < 0) percent = 0;
    if (percent > 1) percent = 1;
    setHoverProgress(percent * 100);
    const time = percent * videoRef.current.duration;
    setHoverTime(formatTime(time));
  };

  const handleProgressMouseLeave = () => {
    setHoverTime(null);
  };

  const togglePlay = () => {
    if (hasError) return;
    if (videoRef.current?.paused) {
      setShowPlayAnim(true);
      if (playAnimTimeoutRef.current) clearTimeout(playAnimTimeoutRef.current);
      playAnimTimeoutRef.current = setTimeout(() => setShowPlayAnim(false), 500);

      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      setShowPauseAnim(true);
      if (playAnimTimeoutRef.current) clearTimeout(playAnimTimeoutRef.current);
      playAnimTimeoutRef.current = setTimeout(() => setShowPauseAnim(false), 500);

      videoRef.current?.pause();
      setIsPlaying(false);
    }
  };

  const triggerSeekAnim = (dir: 'forward' | 'backward') => {
    setSeekAnimDir(dir);
    if (seekAnimTimeoutRef.current) clearTimeout(seekAnimTimeoutRef.current);
    seekAnimTimeoutRef.current = setTimeout(() => setSeekAnimDir(null), 500);
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (videoRef.current) videoRef.current.muted = newMuted;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setProgress(val);
    if (videoRef.current) {
      videoRef.current.currentTime = (val / 100) * videoRef.current.duration;
      setCurrentSeconds(videoRef.current.currentTime);
    }
  };

  const handleVideoClick = (e: ReactMouseEvent<HTMLVideoElement>) => {
    containerRef.current?.focus({ preventScroll: true });
    if (e.detail === 1) {
        clickTimeoutRef.current = setTimeout(() => togglePlay(), 200);
    } else if (e.detail === 2) {
        if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
        if (!videoRef.current) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        if (clickX > rect.width / 2) {
          seekBy(skipSeconds);
        } else {
          seekBy(-skipSeconds);
        }
    }
  };

  const changePlaybackRate = (rate: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
      setPlaybackRate(rate);
      setShowSpeed(false);
    }
  };

  // 5. Change Quality
  const changeQuality = async (levelIndex: number) => {
      if (hlsRef.current) {
          hlsRef.current.currentLevel = levelIndex;
          setActiveQuality(levelIndex);
          setShowQuality(false);
          const qualityLabel = levelIndex === -1 ? 'Auto' : `${qualityLevels[levelIndex]?.height}p`;
          toast.success(`Quality changed to ${qualityLabel}`);
      } 
      else if (adaptiveQualityPending) {
          setShowQuality(false);
          toast.message('Adaptive quality is still being prepared for this video.');
      }
      else if (qualityLevels.length > 0) {
          const video = videoRef.current;
          if (!video) return;
          const selectedSource = qualityLevels[levelIndex]?.url;
          if (typeof selectedSource !== 'string') return;

          let authorizedQualitySource: string;
          try {
            setIsBuffering(true);
            authorizedQualitySource = await getSignedMediaStreamUrl(selectedSource);
          } catch (error) {
            setIsBuffering(false);
            toast.error(error instanceof Error ? error.message : 'Unable to authorize this video quality.');
            return;
          }

          const currentPos = video.currentTime;
          const wasPlaying = !video.paused;

          video.src = authorizedQualitySource;
          video.load();

          const restorePlayback = () => {
              video.removeEventListener('loadedmetadata', restorePlayback);
              video.currentTime = Math.min(currentPos, video.duration || currentPos);
              if (wasPlaying) {
                  video.play().catch(() => setIsPlaying(false));
              }
          };

          video.addEventListener('loadedmetadata', restorePlayback);

          setActiveQuality(levelIndex);
          setShowQuality(false);
          toast.success(`Quality changed to ${qualityLevels[levelIndex].label}`);
      }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const handleMenuToggle = (menu: 'cc' | 'speed' | 'quality' | 'chapters') => {
      setShowCC(menu === 'cc' ? !showCC : false);
      setShowSpeed(menu === 'speed' ? !showSpeed : false);
      setShowQuality(menu === 'quality' ? !showQuality : false);
      setShowChapters(menu === 'chapters' ? !showChapters : false);
      setShowShortcuts(false);
  };

  const cursorStateClass = (showControls || !isPlaying) 
      ? "!cursor-default [&_*]:!cursor-default" 
      : "!cursor-none [&_*]:!cursor-none";

  return (
    <section
      ref={containerRef}
      data-video-player
      aria-label={title ? `Video player: ${title}` : 'Video player'}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "relative group bg-black overflow-hidden flex items-center justify-center w-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white [&_button]:min-h-11 [&_button]:min-w-11 [&_button]:touch-manipulation [&_button]:focus-visible:outline-none [&_button]:focus-visible:ring-2 [&_button]:focus-visible:ring-white [&_button]:focus-visible:ring-offset-2 [&_button]:focus-visible:ring-offset-black",
        isFullscreen ? "rounded-none border-none" : "rounded-[2rem] border border-border/50 shadow-inner",
        cursorStateClass,
        className
      )}
      tabIndex={0}
    >
      {watermark && !hasError && <FloatingWatermark text={watermark} />}

      {/* Udemy-style title: subtle bottom-left label, visible on pause / controls hover */}
      {(title || activeChapter) && !hasError && (
        <div
          className={cn(
            "absolute bottom-[72px] left-4 z-20 pointer-events-none select-none transition-opacity duration-500",
            isPlaying && !showControls ? "opacity-0" : "opacity-100"
          )}
        >
          {activeChapter && (
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/55 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] mb-0.5">
              {activeChapter.label}
            </p>
          )}
          {title && (
            <p className="text-sm font-semibold text-white/80 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)] truncate max-w-[55vw]">
              {title}
            </p>
          )}
        </div>
      )}

      {isBuffering && !hasError && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none">
          <Loader2 className="h-10 w-10 text-primary animate-spin drop-shadow-[0_0_15px_hsl(var(--primary)/0.5)]" />
        </div>
      )}

      {hasError && (
        <div role="alert" className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/90 p-6 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mb-4 opacity-80" />
          <p className="text-white font-bold">Media Playback Error</p>
          <p className="text-zinc-400 text-xs mt-2 max-w-sm">The browser cannot play this video format directly. Try downloading the raw file instead.</p>
        </div>
      )}

      {!isPlaying && !isBuffering && !hasError && (
        <div 
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/30 backdrop-blur-[2px] transition-all hover:bg-black/10"
        >
            <button
                type="button"
                onClick={togglePlay}
                aria-label="Play video"
                className="pointer-events-auto h-20 w-20 bg-primary/90 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-[0_0_40px_hsl(var(--primary)_/_0.4)] border border-primary/50 transition-transform duration-300 hover:scale-110 hover:shadow-[0_0_60px_hsl(var(--primary)_/_0.6)]"
            >
                <Play className="h-10 w-10 text-primary-foreground fill-primary-foreground ml-1" />
            </button>
        </div>
      )}

      {resumeAt !== null && !isPlaying && !isBuffering && !hasError && (
        <div className="absolute left-1/2 top-20 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/70 px-3 py-2 text-white shadow-xl backdrop-blur-md">
          <span className="text-xs font-bold">Resume from {formatTime(resumeAt)}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              applyResumePoint();
              videoRef.current?.play().catch(() => {});
            }}
            className="rounded-full bg-primary px-3 py-1 text-[11px] font-black text-primary-foreground transition-transform hover:scale-105"
          >
            Resume
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              clearSavedProgress();
              if (videoRef.current) {
                videoRef.current.currentTime = 0;
              }
            }}
            className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-black text-white/80 transition-colors hover:border-white/20 hover:text-white"
          >
            Start Over
          </button>
        </div>
      )}

      {showShortcuts && !hasError && (
        <div className="absolute right-4 top-4 z-30 w-[min(24rem,calc(100%-2rem))] rounded-3xl border border-white/10 bg-black/80 p-4 text-white shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/55">Keyboard Shortcuts</p>
              <p className="mt-1 text-sm font-semibold text-white/85">Learning controls at your fingertips</p>
            </div>
            <button
              type="button"
              onClick={() => setShowShortcuts(false)}
              className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-bold text-white/75 transition-colors hover:border-white/20 hover:text-white"
            >
              Close
            </button>
          </div>
          <div className="mt-4 grid gap-2 text-xs">
            <div className="flex items-center justify-between rounded-2xl bg-white/5 px-3 py-2">
              <span>Play or pause</span>
              <span className="font-mono text-white/65">Space / K</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-white/5 px-3 py-2">
              <span>Seek backward or forward</span>
              <span className="font-mono text-white/65">J / L</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-white/5 px-3 py-2">
              <span>Jump between chapters</span>
              <span className="font-mono text-white/65">P / N</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-white/5 px-3 py-2">
              <span>Fullscreen and PiP</span>
              <span className="font-mono text-white/65">F / I / O</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-white/5 px-3 py-2">
              <span>Toggle captions and loop</span>
              <span className="font-mono text-white/65">C / R</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-white/5 px-3 py-2">
              <span>Open this panel</span>
              <span className="font-mono text-white/65">?</span>
            </div>
          </div>
        </div>
      )}

      {/* Center Play/Pause Animations */}
      <div className={cn(
        "absolute inset-0 z-20 pointer-events-none flex items-center justify-center transition-opacity duration-300",
        showPlayAnim || showPauseAnim ? "opacity-100" : "opacity-0"
      )}>
        {showPlayAnim && (
          <div className="bg-black/60 backdrop-blur-sm rounded-full p-6 animate-out fade-out zoom-out-50 duration-500 fill-mode-forwards text-white drop-shadow-xl scale-150">
            <Play className="h-10 w-10 fill-current ml-1" />
          </div>
        )}
        {showPauseAnim && (
          <div className="bg-black/60 backdrop-blur-sm rounded-full p-6 animate-out fade-out zoom-out-50 duration-500 fill-mode-forwards text-white drop-shadow-xl scale-150">
            <Pause className="h-10 w-10 fill-current" />
          </div>
        )}
      </div>

      {/* Floating Hover PiP Button — only shown when PiP is active so user can restore the window */}
      {canPiP && isPiPMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 animate-in fade-in slide-in-from-top-2 duration-300">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); togglePiP(); }}
            className="flex items-center gap-2 bg-primary/90 hover:bg-primary text-primary-foreground text-xs font-bold px-4 py-2 rounded-full shadow-xl transition-all hover:scale-105"
            title="Return from Picture in Picture"
          >
            <PictureInPicture className="h-4 w-4" /> Playing in PiP
          </button>
        </div>
      )}

      {canPiP && !hasError && (
        <div className={cn(
          "absolute right-4 top-4 z-30 transition-all duration-200",
          showControls ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 -translate-y-2"
        )}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              togglePiP();
            }}
            disabled={isPiPBusy}
            className={cn(
              "flex items-center gap-2 rounded-full border border-white/10 bg-black/65 px-4 py-2 text-xs font-black text-white shadow-xl backdrop-blur-md transition-all hover:scale-105 hover:bg-black/80",
              isPiPBusy && "cursor-wait opacity-70",
              isPiPMode && "border-primary/40 text-primary"
            )}
            title={isPiPMode ? 'Exit Picture in Picture (i / o)' : 'Picture in Picture (i / o)'}
          >
            <PictureInPicture className="h-4 w-4" />
            <span>{isPiPMode ? 'Exit PiP' : 'PiP'}</span>
          </button>
        </div>
      )}

      {/* Double Click Seek Animations */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 z-20 pointer-events-none flex items-center justify-between px-10 sm:px-20 overflow-hidden">
        <div className={cn(
          "flex flex-col items-center bg-black/40 backdrop-blur-sm rounded-full p-5 text-white transition-all duration-300",
          seekAnimDir === 'backward' ? "opacity-100 animate-in fade-in slide-in-from-right-8 scale-110" : "opacity-0 translate-x-12"
        )}>
          <SkipBack className="h-8 w-8 mb-1 fill-current" />
          <span className="font-bold text-sm">-{skipSeconds}s</span>
        </div>
        
        <div className={cn(
          "flex flex-col items-center bg-black/40 backdrop-blur-sm rounded-full p-5 text-white transition-all duration-300",
          seekAnimDir === 'forward' ? "opacity-100 animate-in fade-in slide-in-from-left-8 scale-110" : "opacity-0 -translate-x-12"
        )}>
          <SkipForward className="h-8 w-8 mb-1 fill-current" />
          <span className="font-bold text-sm">+{skipSeconds}s</span>
        </div>
      </div>

      <video
        ref={videoRef}
        poster={poster}
        preload="metadata"
        loop={isLooping}
        className={cn("w-full max-h-[100vh] object-contain", hasError && "opacity-0")}
        onClick={handleVideoClick}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => {
          const nextDuration = videoRef.current?.duration || 0;
          setDurationSeconds(nextDuration);
          setDuration(formatTime(nextDuration));

          if (resumeAt !== null && nextDuration > 0 && resumeAt >= nextDuration - 10) {
            clearSavedProgress();
          }
        }}
        onWaiting={() => setIsBuffering(true)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => {
          setIsPlaying(false);
          if (videoRef.current) {
            persistProgress(videoRef.current.currentTime, videoRef.current.duration || 0);
          }
        }}
        onPlaying={() => setIsBuffering(false)}
        onEnded={() => {
          setIsPlaying(false);
          if (isLooping) {
            return;
          }
          clearSavedProgress();
          if (onNext) onNext();
        }}
        playsInline
        disablePictureInPicture={false}
      />

      {!hasError && (
          <div className={cn(
            "absolute bottom-0 left-0 right-0 p-4 sm:px-6 pb-6 bg-gradient-to-t from-black/95 via-black/80 to-transparent transition-opacity duration-300 z-30",
            showControls || !isPlaying ? "opacity-100" : "opacity-0 pointer-events-none"
          )}>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs font-mono text-white/80 w-10 text-center">{currentTime}</span>
              <div 
                className="relative flex-1 flex items-center group/scrubber h-6 cursor-pointer"
              >
                {orderedChapters.length > 0 && durationSeconds > 0 && orderedChapters.map((chapter) => (
                  <div
                    key={`${chapter.time}-${chapter.label}`}
                    className="absolute inset-y-1 z-20 w-px bg-white/45"
                    style={{ left: `${Math.min((chapter.time / durationSeconds) * 100, 100)}%` }}
                    title={chapter.label}
                  />
                ))}
                {hoverTime && (
                  <div 
                    className="absolute bottom-5 flex flex-col items-center transform -translate-x-1/2 pointer-events-none z-50 animate-in fade-in zoom-in-95 duration-100"
                    style={{ left: `${hoverProgress}%` }}
                  >
                    <div className="bg-black/95 text-white text-[10px] font-bold px-2 py-1 rounded shadow-xl text-center border border-white/10 whitespace-nowrap">
                      {hoverTime}
                    </div>
                  </div>
                )}
                
                <input
                  type="range" min="0" max="100" value={progress || 0}
                  onChange={handleSeek}
                  onMouseMove={handleProgressMouseMove}
                  onMouseLeave={handleProgressMouseLeave}
                  aria-label="Video position"
                  aria-valuetext={`${currentTime} of ${duration}`}
                  className="w-full h-1.5 bg-white/20 rounded-full appearance-none accent-primary hover:h-2.5 transition-all duration-300 z-10 relative shadow-[0_0_10px_hsl(var(--primary)_/_0.5)] !cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:cursor-pointer"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowRemainingTime((prev) => !prev)}
                aria-label={showRemainingTime ? 'Show total video duration' : 'Show remaining video time'}
                className="text-xs font-mono text-white/80 w-16 text-center hover:text-white transition-colors"
                title={showRemainingTime ? 'Show total duration' : 'Show remaining time'}
              >
                {showRemainingTime ? `-${formatTime(Math.max(durationSeconds - currentSeconds, 0))}` : duration}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-5">
                
                <button type="button" onClick={onPrevious} disabled={!onPrevious} aria-label="Previous video" className={cn("transition-colors", onPrevious ? "text-white/80 hover:text-white" : "text-white/20 cursor-not-allowed")} title="Previous">
                  <SkipBack className="h-5 w-5 fill-current" />
                </button>

                <button
                  type="button"
                  onClick={() => seekBy(-skipSeconds)}
                  aria-label={`Back ${skipSeconds} seconds`}
                  className="text-white/80 hover:text-white transition-transform hover:scale-110"
                  title={`Back ${skipSeconds} seconds (J)`}
                >
                  <RotateCcw className="h-5 w-5" />
                </button>

                <button type="button" onClick={togglePlay} aria-label={isPlaying ? "Pause video" : "Play video"} className="text-white hover:text-primary transition-all drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)] mx-1 transform hover:scale-110" title={isPlaying ? "Pause (Space)" : "Play (Space)"}>
                  {isPlaying ? <Pause className="h-8 w-8 fill-current" /> : <Play className="h-8 w-8 fill-current" />}
                </button>

                <button
                  type="button"
                  onClick={() => seekBy(skipSeconds)}
                  aria-label={`Forward ${skipSeconds} seconds`}
                  className="text-white/80 hover:text-white transition-transform hover:scale-110"
                  title={`Forward ${skipSeconds} seconds (L)`}
                >
                  <RotateCw className="h-5 w-5" />
                </button>

                <button type="button" onClick={onNext} disabled={!onNext} aria-label="Next video" className={cn("transition-colors", onNext ? "text-white/80 hover:text-white" : "text-white/20 cursor-not-allowed")} title="Next">
                  <SkipForward className="h-5 w-5 fill-current" />
                </button>

                <div className="flex items-center gap-2 group/vol ml-4">
                  <button type="button" onClick={toggleMute} aria-label={isMuted ? "Unmute video" : "Mute video"} className="text-white hover:text-primary transition-colors" title={isMuted ? "Unmute (m)" : "Mute (m)"}>
                    {isMuted || volume === 0 ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
                  </button>
                  <input
                    type="range" min="0" max="1" step="0.05" value={isMuted ? 0 : volume}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setVolume(val);
                      if (videoRef.current) { videoRef.current.volume = val; videoRef.current.muted = val === 0; setIsMuted(val === 0); }
                    }}
                    aria-label="Video volume"
                    aria-valuetext={`${Math.round((isMuted ? 0 : volume) * 100)} percent`}
                    className="w-16 sm:w-20 opacity-100 h-1.5 bg-white/20 rounded-full appearance-none accent-primary transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                  />
                </div>
              </div>

              <div className="flex items-center gap-5 relative">

                {orderedChapters.length > 0 && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => handleMenuToggle('chapters')}
                      aria-label="Video chapters"
                      aria-expanded={showChapters}
                      className={cn("transition-colors", activeChapterIndex !== -1 ? "text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.6)]" : "text-white hover:text-white/80")}
                      title="Chapters"
                    >
                      <ListVideo className="h-6 w-6" />
                    </button>
                    {showChapters && (
                      <div className="absolute bottom-full right-0 mb-4 w-56 bg-background/90 backdrop-blur-2xl border border-border/50 rounded-2xl shadow-2xl p-2 flex flex-col gap-1 z-50 animate-in slide-in-from-bottom-2">
                        <div className="flex items-center justify-between gap-2 border-b border-border/50 px-3 py-2 mb-1">
                          <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Chapters</h4>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => jumpRelativeChapter(-1)}
                              aria-label="Previous chapter"
                              className="rounded-full border border-border/60 p-1 text-foreground/80 transition-colors hover:text-primary hover:border-primary/40"
                              title="Previous chapter (P)"
                            >
                              <SkipBack className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => jumpRelativeChapter(1)}
                              aria-label="Next chapter"
                              className="rounded-full border border-border/60 p-1 text-foreground/80 transition-colors hover:text-primary hover:border-primary/40"
                              title="Next chapter (N)"
                            >
                              <SkipForward className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        {orderedChapters.map((chapter, index) => (
                          <button
                            type="button"
                            key={`${chapter.time}-${chapter.label}`}
                            onClick={() => jumpToChapter(index)}
                            className="flex items-center justify-between gap-3 px-3 py-2 text-xs font-bold text-foreground hover:bg-muted/80 rounded-xl transition-colors"
                          >
                            <span className="truncate text-left">{chapter.label}</span>
                            <span className="font-mono text-[10px] text-muted-foreground">{formatTime(chapter.time)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                 
                {localSubtitles.length > 0 && (
                  <div className="relative">
                    <button type="button" onClick={() => handleMenuToggle('cc')} aria-label="Video subtitles" aria-expanded={showCC} className={cn("transition-colors", activeSubtitle !== -1 ? "text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.6)]" : "text-white hover:text-white/80")} title="Subtitles/CC">
                      <Subtitles className="h-6 w-6" />
                    </button>
                    {showCC && (
                      <div className="absolute bottom-full right-0 mb-4 w-44 bg-background/90 backdrop-blur-2xl border border-border/50 rounded-2xl shadow-2xl p-2 flex flex-col gap-1 z-50 animate-in slide-in-from-bottom-2">
                        <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-3 py-2 mb-1 border-b border-border/50">Subtitles</h4>
                        <button type="button" onClick={() => { setActiveSubtitle(-1); setShowCC(false); }} className="flex items-center justify-between px-3 py-2 text-xs font-bold text-foreground hover:bg-muted/80 rounded-xl transition-colors">
                          Off {activeSubtitle === -1 && <Check className="h-4 w-4 text-primary" />}
                        </button>
                        {localSubtitles.map((sub, idx) => (
                          <button type="button" key={idx} onClick={() => { setActiveSubtitle(idx); setShowCC(false); }} className="flex items-center justify-between px-3 py-2 text-xs font-bold text-foreground hover:bg-muted/80 rounded-xl transition-colors">
                            {sub.label} {activeSubtitle === idx && <Check className="h-4 w-4 text-primary" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {canChooseQuality && (
                  <div className="relative">
                    <button type="button" onClick={() => handleMenuToggle('quality')} aria-label="Video quality" aria-expanded={showQuality} className={cn("transition-colors flex items-center gap-1", activeQuality !== -1 || adaptiveQualityPending ? "text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.6)]" : "text-white hover:text-white/80")} title="Quality">
                      <Settings className="h-6 w-6" />
                      {activeQuality !== -1 && qualityLevels[activeQuality] ? (
                        <span className="text-[10px] font-black bg-primary/20 text-primary px-1.5 rounded-md">
                          {qualityLevels[activeQuality]?.label || `${qualityLevels[activeQuality]?.height}p`}
                        </span>
                      ) : adaptiveQualityPending ? (
                        <span className="text-[10px] font-black bg-primary/20 text-primary px-1.5 rounded-md">Prep</span>
                      ) : !isHlsSource ? (
                        <span className="text-[10px] font-black bg-primary/20 text-primary px-1.5 rounded-md">MP4</span>
                      ) : null}
                    </button>
                    {showQuality && (
                      <div className="absolute bottom-full right-0 mb-4 w-44 bg-background/90 backdrop-blur-2xl border border-border/50 rounded-2xl shadow-2xl p-2 flex flex-col gap-1 z-50 animate-in slide-in-from-bottom-2">
                        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-3 py-2 mb-1 border-b border-border/50">Quality</h4>
                        
                        {isHlsSource ? (
                            <>
                                <button type="button" onClick={() => changeQuality(-1)} className="flex items-center justify-between px-3 py-2 text-xs font-bold text-foreground hover:bg-muted/80 rounded-xl transition-colors">
                                  Auto {activeQuality === -1 && <Check className="h-4 w-4 text-primary" />}
                                </button>
                                {qualityLevels.length > 0 ? qualityLevels.map((level, idx) => (
                                  <button type="button" key={idx} onClick={() => changeQuality(idx)} className="flex items-center justify-between px-3 py-2 text-xs font-bold text-foreground hover:bg-muted/80 rounded-xl transition-colors">
                                    {level.label || `${level.height}p`} {activeQuality === idx && <Check className="h-4 w-4 text-primary" />}
                                  </button>
                                )) : (
                                  <div className="px-3 py-2 text-xs font-bold text-muted-foreground">
                                    Adaptive quality is loading...
                                  </div>
                                )}
                            </>
                        ) : adaptiveQualityPending ? (
                            <>
                              <div className="px-3 py-2 text-xs font-bold text-foreground">
                                Playing the original file for now.
                              </div>
                              <div className="px-3 pb-2 text-[11px] leading-relaxed text-muted-foreground">
                                360p, 480p, 720p, and 1080p options will appear here as soon as adaptive processing finishes.
                              </div>
                            </>
                        ) : (
                            qualityLevels.map((level, idx) => (
                              <button type="button" key={idx} onClick={() => changeQuality(idx)} className="flex items-center justify-between px-3 py-2 text-xs font-bold text-foreground hover:bg-muted/80 rounded-xl transition-colors">
                                {level.label || `${level.height}p`} {activeQuality === idx && <Check className="h-4 w-4 text-primary" />}
                              </button>
                            ))
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="relative">
                  <button type="button" onClick={() => handleMenuToggle('speed')} aria-label="Video playback speed" aria-expanded={showSpeed} className={cn("transition-colors", playbackRate !== 1 ? "text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.6)]" : "text-white hover:text-white/80")} title="Playback Speed">
                    <Gauge className="h-6 w-6" />
                  </button>
                  {showSpeed && (
                    <div className="absolute bottom-full right-0 mb-4 w-40 bg-background/90 backdrop-blur-2xl border border-border/50 rounded-2xl shadow-2xl p-2 flex flex-col gap-1 z-50 animate-in slide-in-from-bottom-2">
                      <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-3 py-2 mb-1 border-b border-border/50">Speed</h4>
                      {availablePlaybackRates.map((rate) => (
                        <button type="button" key={rate} onClick={() => changePlaybackRate(rate)} className="flex items-center justify-between px-3 py-2 text-xs font-bold text-foreground hover:bg-muted/80 rounded-xl transition-colors">
                          {rate === 1 ? 'Normal' : `${rate}x`}
                          {playbackRate === rate && <Check className="h-4 w-4 text-primary" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={toggleLoop}
                  aria-label="Loop video"
                  aria-pressed={isLooping}
                  className={cn(
                    "transition-all duration-200",
                    isLooping
                      ? "text-primary drop-shadow-[0_0_10px_hsl(var(--primary)/0.8)] scale-110"
                      : "text-white/80 hover:text-white hover:scale-110"
                  )}
                  title={isLooping ? 'Disable loop (R)' : 'Loop lesson (R)'}
                >
                  <Repeat className="h-5 w-5" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowShortcuts((prev) => !prev);
                    setShowChapters(false);
                    setShowCC(false);
                    setShowSpeed(false);
                    setShowQuality(false);
                  }}
                  aria-label="Keyboard shortcuts"
                  aria-expanded={showShortcuts}
                  className={cn(
                    "transition-all duration-200",
                    showShortcuts
                      ? "text-primary drop-shadow-[0_0_10px_hsl(var(--primary)/0.8)] scale-110"
                      : "text-white/80 hover:text-white hover:scale-110"
                  )}
                  title="Keyboard shortcuts (?)"
                >
                  <Keyboard className="h-5 w-5" />
                </button>

                {/* PiP Button — always visible in controls bar, greyed out if not supported */}
                {canPiP && (
                  <button
                    type="button"
                    onClick={togglePiP}
                    disabled={isPiPBusy}
                    aria-label={isPiPMode ? 'Exit picture in picture' : 'Enter picture in picture'}
                    className={cn(
                      "transition-all duration-200",
                      isPiPBusy && "opacity-60 cursor-wait",
                      isPiPMode
                        ? "text-primary drop-shadow-[0_0_10px_hsl(var(--primary)/0.8)] scale-110"
                        : "text-white/80 hover:text-white hover:scale-110"
                    )}
                    title={isPiPMode ? 'Exit Picture in Picture (i / o)' : 'Picture in Picture (i / o)'}
                  >
                    <PictureInPicture className="h-5 w-5" />
                  </button>
                )}

                <button type="button" onClick={toggleFullscreen} aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"} className="text-white hover:text-primary transition-transform hover:scale-110 ml-1" title="Fullscreen (f)">
                  {isFullscreen ? <Minimize className="h-6 w-6" /> : <Maximize className="h-6 w-6" />}
                </button>
              </div>
            </div>
          </div>
      )}
    </section>
  );
}
