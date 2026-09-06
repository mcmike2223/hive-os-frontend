"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ExternalE2EEKeyProvider,
  Room,
  RoomEvent,
  Track,
  setLogLevel,
  type Participant,
  type RemoteParticipant,
} from "livekit-client";
import {
  Captions,
  ChevronLeft,
  ChevronRight,
  Circle,
  Copy,
  Expand,
  Grid2X2,
  Hand,
  Lock,
  Maximize,
  MessageSquare,
  Mic,
  MicOff,
  Minimize,
  MonitorUp,
  Pin,
  PinOff,
  Radio,
  Search,
  Send,
  Settings,
  Smile,
  Square,
  UserMinus,
  UserPlus,
  Users,
  Video,
  VideoOff,
  X,
} from "lucide-react";
import api from "@/lib/api";
import {
  decryptCommunicationValue,
  encryptCommunicationValue,
  wrapCommunicationKeyMaterial,
} from "@/lib/communication-e2ee";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { ChatConversation } from "@/store/chat-store";
import { useTenantModuleAccess } from "@/hooks/use-tenant-module-access";

const CALL_TOPIC = "hive-call-v1";
const GALLERY_PAGE_SIZE = 12;
const REACTIONS = ["👍", "👏", "❤️", "😂", "🎉", "👋"] as const;

type Media = {
  key: string;
  identity: string;
  track: Track;
  name: string;
  local: boolean;
  source: Track.Source;
};

type Person = {
  identity: string;
  name: string;
  camera: boolean;
  mic: boolean;
  local: boolean;
};

type CallTile = Person & {
  key: string;
  media?: Media;
  screen?: boolean;
};

type MeetingUser = {
  id: number;
  name: string;
  email: string;
  avatar_url?: string | null;
  chat_public_key?: string | null;
};

type CallEncryptionMaterial = {
  material: ArrayBuffer;
  conversation?: ChatConversation;
};

type CallChatMessage = {
  id: string;
  sender: string;
  text: string;
  sentAt: number;
  own: boolean;
};

type Overlay = { id: string; sender: string; text: string };
type Panel = "chat" | "people" | "invite" | "settings" | null;
type Layout = "gallery" | "speaker";

type CallPacket =
  | { v: 1; type: "chat"; id: string; text: string; sentAt: number }
  | { v: 1; type: "hand"; raised: boolean }
  | { v: 1; type: "reaction"; id: string; emoji: string }
  | { v: 1; type: "caption"; id: string; text: string }
  | { v: 1; type: "mute-all" }
  | { v: 1; type: "recording"; active: boolean };

type SpeechRecognitionResultEventLike = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionWindow = Window & typeof globalThis & {
  SpeechRecognition?: new () => BrowserSpeechRecognition;
  webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
};

function MediaTrack({ media, screen = false }: { media: Media; screen?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = media.track.attach();
    element.autoplay = true;
    if (element instanceof HTMLVideoElement) {
      element.playsInline = true;
      element.style.height = "100%";
      element.style.objectFit = screen ? "contain" : "cover";
    }
    element.muted = media.local;
    element.style.width = "100%";
    element.setAttribute("aria-label", `${media.name}${media.track.kind === Track.Kind.Video ? " video" : " audio"}`);
    ref.current?.appendChild(element);

    return () => {
      media.track.detach(element);
      element.remove();
    };
  }, [media, screen]);

  return <div ref={ref} className="size-full overflow-hidden" />;
}

function ParticipantTile({
  tile,
  handRaised,
  pinned,
  onPin,
  prominent = false,
}: {
  tile: CallTile;
  handRaised: boolean;
  pinned: boolean;
  onPin: () => void;
  prominent?: boolean;
}) {
  return (
    <article className={cn(
      "group relative min-h-0 overflow-hidden rounded-2xl border bg-card shadow-sm",
      prominent ? "h-full border-[hsl(var(--primary-readable))]" : "aspect-video border-border",
      handRaised && "ring-2 ring-amber-500"
    )} aria-label={`${tile.name}${tile.local ? ", you" : ""}`}>
      {tile.media ? (
        <MediaTrack media={tile.media} screen={tile.screen} />
      ) : (
        <div className="flex size-full min-h-40 flex-col items-center justify-center bg-muted p-4">
          <span className="flex size-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
            {tile.name.charAt(0).toUpperCase() || "?"}
          </span>
          <p className="mt-3 text-base font-semibold text-foreground">Camera off</p>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/75 px-3 py-2 text-white">
        <p className="min-w-0 truncate text-sm font-semibold">
          {tile.screen ? `${tile.name}'s screen` : tile.name}{tile.local ? " (you)" : ""}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          {handRaised && <span title="Hand raised" aria-label="Hand raised">✋</span>}
          {tile.mic ? <Mic aria-label="Microphone on" className="size-4" /> : <MicOff aria-label="Muted" className="size-4" />}
          <Button type="button" size="icon" variant="ghost"
            className="size-11 bg-black/60 text-white opacity-100 hover:bg-black/80 hover:text-white focus-visible:ring-white sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
            aria-label={pinned ? `Unpin ${tile.name}` : `Pin ${tile.name}`} onClick={onPin}>
            {pinned ? <PinOff aria-hidden="true" className="size-4" /> : <Pin aria-hidden="true" className="size-4" />}
          </Button>
        </div>
      </div>
    </article>
  );
}

type VideoCallButtonProps = {
  kind: "chat" | "mail";
  id: string | number;
  title?: string | null;
  disabled?: boolean;
  autoOpen?: boolean;
  isHost?: boolean;
  registeredParticipants?: MeetingUser[];
  resolveEncryptionMaterial: () => Promise<CallEncryptionMaterial | ArrayBuffer>;
  onConversationUpdated?: (conversation: ChatConversation) => void;
  onAutoOpenHandled?: () => void;
};

const connectionErrorMessage = (error: unknown) => {
  const responseMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  if (responseMessage) return responseMessage;
  const message = error instanceof Error ? error.message : "";
  if (message === "Internal error") return "The video service closed the connection before the call was ready. Wait a moment, then try again.";
  if (message.toLowerCase().includes("negotiation timed out") || message.toLowerCase().includes("could not establish pc connection")) {
    return "Your browser could not establish the video connection. Check camera and microphone permissions or try another network, then rejoin.";
  }
  return message || "Could not connect to the call. Please try again.";
};

const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;
  return [hours, minutes, remaining]
    .filter((_, index) => hours > 0 || index > 0)
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
};

const participantIsHost = (participant?: RemoteParticipant) => {
  if (!participant?.metadata) return false;
  try {
    return (JSON.parse(participant.metadata) as { hiveRole?: string }).hiveRole === "host";
  } catch {
    return false;
  }
};

const deriveCallMaterial = async (source: ArrayBuffer, context: string) => {
  const key = await crypto.subtle.importKey("raw", source, "HKDF", false, ["deriveBits"]);
  const salt = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("hive-video-e2ee-v1"));

  return crypto.subtle.deriveBits({
    name: "HKDF",
    hash: "SHA-256",
    salt,
    info: new TextEncoder().encode(context),
  }, key, 256);
};

export function VideoCallButton({
  kind,
  id,
  title,
  disabled = false,
  autoOpen = false,
  isHost = false,
  registeredParticipants = [],
  resolveEncryptionMaterial,
  onConversationUpdated,
  onAutoOpenHandled,
}: VideoCallButtonProps) {
  const router = useRouter();
  const { moduleAccess, hasModule } = useTenantModuleAccess();
  const endpoint = kind === "chat" ? `/chat/conversations/${id}/call` : `/mail/${id}/call`;
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("Ready to join");
  const [error, setError] = useState("");
  const [active, setActive] = useState(false);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [media, setMedia] = useState<Media[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [joinMic, setJoinMic] = useState(false);
  const [joinCamera, setJoinCamera] = useState(false);
  const [mic, setMic] = useState(false);
  const [camera, setCamera] = useState(false);
  const [screen, setScreen] = useState(false);
  const [host, setHost] = useState(isHost);
  const [audioPlaybackBlocked, setAudioPlaybackBlocked] = useState(false);
  const [layout, setLayout] = useState<Layout>("gallery");
  const [activePanel, setActivePanel] = useState<Panel>(null);
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);
  const [pinnedTile, setPinnedTile] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hands, setHands] = useState<Set<string>>(new Set());
  const [localHand, setLocalHand] = useState(false);
  const [messages, setMessages] = useState<CallChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [reaction, setReaction] = useState<Overlay | null>(null);
  const [reactionMenuOpen, setReactionMenuOpen] = useState(false);
  const [caption, setCaption] = useState<Overlay | null>(null);
  const [captionsOn, setCaptionsOn] = useState(false);
  const [recording, setRecording] = useState(false);
  const [remoteRecording, setRemoteRecording] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [browserFullscreen, setBrowserFullscreen] = useState(false);
  const [inviteQuery, setInviteQuery] = useState("");
  const [inviteResults, setInviteResults] = useState<MeetingUser[]>([]);
  const [selectedInvitees, setSelectedInvitees] = useState<Set<number>>(new Set());
  const [invitedIds, setInvitedIds] = useState<Set<number>>(new Set());
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteNotice, setInviteNotice] = useState("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const roomRef = useRef<Room | null>(null);
  const e2eeWorkerRef = useRef<Worker | null>(null);
  const baseEncryptionMaterialRef = useRef<ArrayBuffer | null>(null);
  const dataEncryptionKeyRef = useRef<CryptoKey | null>(null);
  const clientInstanceRef = useRef("");
  const generation = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const conferenceRoot = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const speechRef = useRef<BrowserSpeechRecognition | null>(null);

  const publishPacket = async (packet: CallPacket) => {
    const room = roomRef.current;
    const dataKey = dataEncryptionKeyRef.current;
    if (!room || !dataKey) throw new Error("The encrypted call channel is not ready.");
    const encrypted = await encryptCommunicationValue(
      JSON.stringify(packet),
      dataKey,
      `hive-video:${kind}:${id}:data:v1`,
    );
    const payload = new TextEncoder().encode(encrypted);
    if (payload.byteLength > 14_000) throw new Error("Call message is too large.");
    await room.localParticipant.publishData(payload, { reliable: true, topic: CALL_TOPIC });
  };

  const stopCaptions = () => {
    speechRef.current?.stop();
    speechRef.current = null;
    setCaptionsOn(false);
  };

  const stopRecording = (announce = true) => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recorderRef.current = null;
    recordingStreamRef.current = null;
    setRecording(false);
    if (announce) void publishPacket({ v: 1, type: "recording", active: false });
  };

  const leave = () => {
    generation.current++;
    stopCaptions();
    stopRecording(false);
    const room = roomRef.current;
    roomRef.current = null;
    void room?.disconnect();
    e2eeWorkerRef.current?.terminate();
    e2eeWorkerRef.current = null;
    baseEncryptionMaterialRef.current = null;
    dataEncryptionKeyRef.current = null;
    if (document.fullscreenElement) void document.exitFullscreen();
    setConnected(false);
    setBusy(false);
    setMedia([]);
    setPeople([]);
    setMic(false);
    setCamera(false);
    setScreen(false);
    setActivePanel(null);
    setHands(new Set());
    setMessages([]);
    setRemoteRecording(false);
    setReactionMenuOpen(false);
    setStartedAt(null);
    setElapsed(0);
    setAudioPlaybackBlocked(false);
    setStatus("Call ended");
  };

  useEffect(() => setHost(isHost), [isHost]);

  useEffect(() => {
    if (!autoOpen || disabled) return;
    setError("");
    setStatus("Ready to join");
    setOpen(true);
    onAutoOpenHandled?.();
  }, [autoOpen, disabled, onAutoOpenHandled]);

  useEffect(() => {
    return () => {
      generation.current++;
      speechRef.current?.stop();
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      void roomRef.current?.disconnect();
      roomRef.current = null;
      e2eeWorkerRef.current?.terminate();
      e2eeWorkerRef.current = null;
      baseEncryptionMaterialRef.current = null;
      dataEncryptionKeyRef.current = null;
    };
  }, [endpoint]);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      if (document.hidden || disabled) return;
      try {
        const { data } = await api.get(endpoint);
        if (alive) setActive(Boolean(data.active));
      } catch {
        if (alive) setActive(false);
      }
    };
    void check();
    const interval = window.setInterval(check, 15_000);
    return () => {
      alive = false;
      window.clearInterval(interval);
    };
  }, [endpoint, disabled]);

  useEffect(() => {
    if (!startedAt) return;
    const update = () => setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1_000)));
    update();
    const interval = window.setInterval(update, 1_000);
    return () => window.clearInterval(interval);
  }, [startedAt]);

  useEffect(() => {
    const change = () => setBrowserFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", change);
    return () => document.removeEventListener("fullscreenchange", change);
  }, []);

  useEffect(() => {
    if (!reaction) return;
    const timeout = window.setTimeout(() => setReaction(null), 3_500);
    return () => window.clearTimeout(timeout);
  }, [reaction]);

  useEffect(() => {
    if (!caption) return;
    const timeout = window.setTimeout(() => setCaption(null), 6_000);
    return () => window.clearTimeout(timeout);
  }, [caption]);

  useEffect(() => {
    if (activePanel !== "invite" || kind !== "chat") return;
    const query = inviteQuery.trim();
    if (query.length < 2) {
      setInviteResults([]);
      return;
    }
    let alive = true;
    const timeout = window.setTimeout(async () => {
      try {
        const { data } = await api.get("/chat/video-meetings/users", { params: { q: query } });
        if (alive) setInviteResults(data.data || data || []);
      } catch (cause) {
        if (alive) setInviteNotice(getErrorMessage(cause, "Could not search registered users."));
      }
    }, 300);
    return () => {
      alive = false;
      window.clearTimeout(timeout);
    };
  }, [activePanel, inviteQuery, kind]);

  const join = async () => {
    if (busy || connected) return;
    const current = ++generation.current;
    heading.current?.focus();
    setBusy(true);
    setError("");
    setStatus("Preparing end-to-end encryption…");
    setLogLevel("silent");
    let room: Room | null = null;

    const refresh = () => {
      const activeRoom = room;
      if (!activeRoom) return;
      if (current !== generation.current) return;
      const tracks: Media[] = [];
      const participants: Participant[] = [activeRoom.localParticipant, ...activeRoom.remoteParticipants.values()];
      for (const person of participants) {
        for (const publication of person.trackPublications.values()) {
          if (publication.track && !publication.isMuted) {
            tracks.push({
              key: `${person.identity}-${publication.trackSid}`,
              identity: person.identity,
              track: publication.track,
              name: person.name || "Participant",
              local: person === activeRoom.localParticipant,
              source: publication.source,
            });
          }
        }
      }
      setMedia(tracks);
      setPeople(participants.map((person) => ({
        identity: person.identity,
        name: person.name || "Participant",
        camera: person.isCameraEnabled,
        mic: person.isMicrophoneEnabled,
        local: person === activeRoom.localParticipant,
      })));
      setMic(activeRoom.localParticipant.isMicrophoneEnabled);
      setCamera(activeRoom.localParticipant.isCameraEnabled);
      setScreen(activeRoom.localParticipant.isScreenShareEnabled);
    };

    const onData = async (payload: Uint8Array, participant?: RemoteParticipant, _kind?: unknown, topic?: string) => {
      if (topic !== CALL_TOPIC || !participant || payload.byteLength > 14_000) return;
      try {
        const dataKey = dataEncryptionKeyRef.current;
        if (!dataKey) return;
        const decrypted = await decryptCommunicationValue(
          new TextDecoder().decode(payload),
          dataKey,
          `hive-video:${kind}:${id}:data:v1`,
          "",
        );
        if (!decrypted) return;
        const packet = JSON.parse(decrypted) as Partial<CallPacket>;
        if (packet.v !== 1 || typeof packet.type !== "string") return;
        const sender = participant.name || "Participant";
        if (packet.type === "chat" && typeof packet.text === "string" && typeof packet.id === "string") {
          const text = packet.text.slice(0, 1_000);
          setMessages((currentMessages) => [...currentMessages.slice(-199), {
            id: `${participant.identity}-${packet.id}`,
            sender,
            text,
            sentAt: typeof packet.sentAt === "number" ? packet.sentAt : Date.now(),
            own: false,
          }]);
        } else if (packet.type === "hand" && typeof packet.raised === "boolean") {
          setHands((currentHands) => {
            const next = new Set(currentHands);
            if (packet.raised) next.add(participant.identity); else next.delete(participant.identity);
            return next;
          });
        } else if (packet.type === "reaction" && typeof packet.emoji === "string" && typeof packet.id === "string" && REACTIONS.includes(packet.emoji as typeof REACTIONS[number])) {
          setReaction({ id: `${participant.identity}-${packet.id}`, sender, text: packet.emoji });
        } else if (packet.type === "caption" && typeof packet.text === "string" && typeof packet.id === "string") {
          setCaption({ id: `${participant.identity}-${packet.id}`, sender, text: packet.text.slice(0, 300) });
        } else if (packet.type === "mute-all" && participantIsHost(participant)) {
          void room?.localParticipant.setMicrophoneEnabled(false).then(refresh).catch(() => undefined);
          setStatus(`${sender} muted everyone.`);
        } else if (packet.type === "recording" && typeof packet.active === "boolean" && participantIsHost(participant)) {
          setRemoteRecording(packet.active);
        }
      } catch {
        // Ignore malformed data messages from conference peers.
      }
    };

    try {
      const resolved = await resolveEncryptionMaterial();
      const sourceMaterial = resolved instanceof ArrayBuffer ? resolved : resolved.material;
      if (!(sourceMaterial instanceof ArrayBuffer) || sourceMaterial.byteLength < 16) {
        throw new Error("The end-to-end encryption key is unavailable.");
      }
      if (!(resolved instanceof ArrayBuffer) && resolved.conversation) {
        onConversationUpdated?.(resolved.conversation);
      }
      const mediaMaterial = await deriveCallMaterial(sourceMaterial, `hive-video:${kind}:${id}:media:v1`);
      const dataMaterial = await deriveCallMaterial(sourceMaterial, `hive-video:${kind}:${id}:data-key:v1`);
      const dataKey = await crypto.subtle.importKey(
        "raw",
        dataMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"],
      );
      const keyProvider = new ExternalE2EEKeyProvider();
      await keyProvider.setKey(mediaMaterial);
      const worker = new Worker(new URL("livekit-client/e2ee-worker", import.meta.url), { type: "module" });
      const activeRoom = new Room({ adaptiveStream: false, dynacast: true, e2ee: { keyProvider, worker } });
      room = activeRoom;
      roomRef.current = activeRoom;
      e2eeWorkerRef.current = worker;
      baseEncryptionMaterialRef.current = sourceMaterial;
      dataEncryptionKeyRef.current = dataKey;
      setStatus("Connecting securely…");

      activeRoom.on(RoomEvent.TrackSubscribed, (track) => {
        refresh();
        if (track.kind === Track.Kind.Audio) {
          void activeRoom.startAudio().then(() => setAudioPlaybackBlocked(!activeRoom.canPlaybackAudio)).catch(() => setAudioPlaybackBlocked(true));
        }
      }).on(RoomEvent.TrackUnsubscribed, refresh)
      .on(RoomEvent.LocalTrackPublished, refresh)
      .on(RoomEvent.LocalTrackUnpublished, refresh)
      .on(RoomEvent.TrackMuted, refresh)
      .on(RoomEvent.TrackUnmuted, refresh)
      .on(RoomEvent.ParticipantConnected, refresh)
      .on(RoomEvent.ParticipantDisconnected, refresh)
      .on(RoomEvent.ActiveSpeakersChanged, (speakers) => setActiveSpeaker(speakers[0]?.identity || null))
      .on(RoomEvent.DataReceived, onData)
      .on(RoomEvent.MediaDevicesChanged, () => void navigator.mediaDevices.enumerateDevices().then(setDevices))
      .on(RoomEvent.AudioPlaybackStatusChanged, (canPlay) => setAudioPlaybackBlocked(!canPlay))
      .on(RoomEvent.Reconnecting, () => setStatus("Reconnecting…"))
      .on(RoomEvent.Reconnected, () => setStatus("Connected"))
      .on(RoomEvent.EncryptionError, () => setError("End-to-end media encryption failed. Leave the call and rejoin."))
      .on(RoomEvent.Disconnected, () => {
        if (current !== generation.current) return;
        setConnected(false);
        setMedia([]);
        setPeople([]);
        setStatus("Disconnected. You can rejoin.");
      });

      if (!clientInstanceRef.current) clientInstanceRef.current = crypto.randomUUID();
      const { data } = await api.post(endpoint, { client_instance: clientInstanceRef.current });
      if (current !== generation.current) return;
      await activeRoom.connect(data.url, data.token);
      await activeRoom.setE2EEEnabled(true);
      if (current !== generation.current) {
        await activeRoom.disconnect();
        return;
      }
      setHost(Boolean(data.is_host));
      void activeRoom.startAudio().then(() => setAudioPlaybackBlocked(!activeRoom.canPlaybackAudio)).catch(() => setAudioPlaybackBlocked(true));
      setConnected(true);
      setStartedAt(Date.now());
      setStatus("Connected");
      refresh();
      for (const device of ["mic", "camera"] as const) {
        if (current !== generation.current) {
          await activeRoom.disconnect();
          return;
        }
        try {
          if (device === "mic" && joinMic && (!data.mute_on_entry || data.is_host)) await activeRoom.localParticipant.setMicrophoneEnabled(true, undefined, { name: "microphone" });
          if (device === "camera" && joinCamera) await activeRoom.localParticipant.setCameraEnabled(true, undefined, { name: "camera" });
        } catch {
          if (current === generation.current) setError("You joined, but a device could not start. Check browser permissions and use the call controls to retry.");
        }
      }
      if (current !== generation.current) {
        await activeRoom.disconnect();
        return;
      }
      refresh();
      void navigator.mediaDevices.enumerateDevices().then(setDevices).catch(() => undefined);
    } catch (cause) {
      await room?.disconnect();
      e2eeWorkerRef.current?.terminate();
      e2eeWorkerRef.current = null;
      roomRef.current = null;
      baseEncryptionMaterialRef.current = null;
      dataEncryptionKeyRef.current = null;
      if (current === generation.current) {
        setError(connectionErrorMessage(cause));
        setStatus("Connection failed");
      }
    } finally {
      if (current === generation.current) setBusy(false);
    }
  };

  const toggle = async (device: "mic" | "camera" | "screen") => {
    const room = roomRef.current;
    if (!room || busy) return;
    setBusy(true);
    setError("");
    try {
      if (device === "mic") await room.localParticipant.setMicrophoneEnabled(!room.localParticipant.isMicrophoneEnabled, undefined, { name: "microphone" });
      if (device === "camera") await room.localParticipant.setCameraEnabled(!room.localParticipant.isCameraEnabled, undefined, { name: "camera" });
      if (device === "screen") await room.localParticipant.setScreenShareEnabled(!room.localParticipant.isScreenShareEnabled);
      setMic(room.localParticipant.isMicrophoneEnabled);
      setCamera(room.localParticipant.isCameraEnabled);
      setScreen(room.localParticipant.isScreenShareEnabled);
    } catch {
      setError("Device access was unavailable or declined. You can stay in the call and try again.");
    } finally {
      setBusy(false);
    }
  };

  const sendChat = async () => {
    const text = chatInput.trim().slice(0, 1_000);
    const room = roomRef.current;
    if (!text || !room) return;
    const packet: Extract<CallPacket, { type: "chat" }> = { v: 1, type: "chat", id: crypto.randomUUID(), text, sentAt: Date.now() };
    try {
      await publishPacket(packet);
      setMessages((current) => [...current.slice(-199), { id: packet.id, sender: room.localParticipant.name || "You", text, sentAt: packet.sentAt, own: true }]);
      setChatInput("");
    } catch (cause) {
      setError(connectionErrorMessage(cause));
    }
  };

  const toggleHand = async () => {
    const next = !localHand;
    try {
      await publishPacket({ v: 1, type: "hand", raised: next });
      setLocalHand(next);
      const identity = roomRef.current?.localParticipant.identity;
      if (identity) {
        setHands((current) => {
          const updated = new Set(current);
          if (next) updated.add(identity); else updated.delete(identity);
          return updated;
        });
      }
    } catch (cause) {
      setError(connectionErrorMessage(cause));
    }
  };

  const sendReaction = async (emoji: typeof REACTIONS[number]) => {
    const idValue = crypto.randomUUID();
    try {
      await publishPacket({ v: 1, type: "reaction", id: idValue, emoji });
      setReaction({ id: idValue, sender: "You", text: emoji });
      setReactionMenuOpen(false);
    } catch (cause) {
      setError(connectionErrorMessage(cause));
    }
  };

  const muteAll = async () => {
    if (!host) return;
    try {
      await publishPacket({ v: 1, type: "mute-all" });
      setStatus("Mute request sent to everyone.");
    } catch (cause) {
      setError(connectionErrorMessage(cause));
    }
  };

  const removeParticipant = async (identity: string, name: string) => {
    if (!host || identity === roomRef.current?.localParticipant.identity) return;
    try {
      await api.post(`${endpoint}/remove`, { identity });
      setStatus(`${name} was removed from this call.`);
    } catch (cause) {
      setError(getErrorMessage(cause, `Could not remove ${name}.`));
    }
  };

  const endForEveryone = async () => {
    if (!host || busy) return;
    setBusy(true);
    setError("");
    try {
      await api.post(`${endpoint}/end`);
      leave();
      setOpen(false);
    } catch (cause) {
      setError(getErrorMessage(cause, "Could not end the meeting for everyone."));
      setBusy(false);
    }
  };

  const startRecording = async () => {
    if (!host || recording) return;
    if (!navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder === "undefined") {
      setError("Local call recording is not supported by this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const mimeType = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recordingChunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size > 0) recordingChunksRef.current.push(event.data); };
      recorder.onstop = () => {
        if (recordingChunksRef.current.length > 0) {
          const blob = new Blob(recordingChunksRef.current, { type: recorder.mimeType || "video/webm" });
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = `hive-call-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`;
          anchor.click();
          window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
        }
        recordingChunksRef.current = [];
      };
      stream.getVideoTracks()[0]?.addEventListener("ended", () => stopRecording());
      recordingStreamRef.current = stream;
      recorderRef.current = recorder;
      recorder.start(1_000);
      setRecording(true);
      await publishPacket({ v: 1, type: "recording", active: true });
    } catch (cause) {
      setError(cause instanceof Error && cause.name === "NotAllowedError"
        ? "Recording was cancelled. Choose the Hive call tab or window when your browser asks what to share."
        : connectionErrorMessage(cause));
    }
  };

  const toggleCaptions = () => {
    if (captionsOn) {
      stopCaptions();
      return;
    }
    const speechWindow = window as SpeechRecognitionWindow;
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setError("Live captions are not supported by this browser. Chrome and Edge provide this feature.");
      return;
    }
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = document.documentElement.lang || navigator.language || "en-US";
    recognition.onresult = (event) => {
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const text = event.results[index][0]?.transcript?.trim();
        if (!text) continue;
        if (event.results[index].isFinal) {
          const idValue = crypto.randomUUID();
          setCaption({ id: idValue, sender: "You", text: text.slice(0, 300) });
          void publishPacket({ v: 1, type: "caption", id: idValue, text: text.slice(0, 300) });
        } else interim = `${interim} ${text}`.trim();
      }
      if (interim) setCaption({ id: "interim", sender: "You", text: interim.slice(0, 300) });
    };
    recognition.onerror = () => {
      setError("Live captions stopped because speech recognition was unavailable.");
      setCaptionsOn(false);
    };
    recognition.onend = () => setCaptionsOn(false);
    speechRef.current = recognition;
    recognition.start();
    setCaptionsOn(true);
  };

  const copyInviteLink = async () => {
    const link = kind === "chat" ? `${window.location.origin}/dashboard/chat?conversation=${encodeURIComponent(String(id))}&call=1` : window.location.href;
    try {
      await navigator.clipboard.writeText(link);
      setInviteNotice("Invite link copied.");
    } catch {
      setInviteNotice(link);
    }
  };

  const inviteRegisteredUsers = async () => {
    if (kind !== "chat" || selectedInvitees.size === 0) return;
    setInviteBusy(true);
    setInviteNotice("");
    try {
      const selectedUsers = inviteResults.filter((user) => selectedInvitees.has(user.id));
      const missingSecureIdentity = selectedUsers.find((user) => !user.chat_public_key);
      if (missingSecureIdentity) {
        throw new Error(`${missingSecureIdentity.name} must open secure Chat or Mail once before joining an encrypted call.`);
      }
      const sourceMaterial = baseEncryptionMaterialRef.current;
      if (!sourceMaterial) throw new Error("The encrypted call key is unavailable. Rejoin the call and try again.");
      const participantKeys = await wrapCommunicationKeyMaterial(
        sourceMaterial,
        selectedUsers.map((user) => ({ id: user.id, publicKey: user.chat_public_key as string })),
      );
      const { data } = await api.post(`/chat/video-meetings/${id}/invite`, {
        user_ids: [...selectedInvitees],
        participant_keys: participantKeys,
      });
      const count = Number(data.invited_count || 0);
      setInvitedIds((current) => new Set([...current, ...selectedInvitees]));
      setSelectedInvitees(new Set());
      setInviteNotice(count > 0 ? `${count} registered user${count === 1 ? "" : "s"} invited.` : "Those users are already invited.");
      if (data.conversation) onConversationUpdated?.(data.conversation as ChatConversation);
    } catch (cause) {
      setInviteNotice(getErrorMessage(cause, "Could not send the invitations."));
    } finally {
      setInviteBusy(false);
    }
  };

  const switchDevice = async (kindValue: MediaDeviceKind, deviceId: string) => {
    try {
      await roomRef.current?.switchActiveDevice(kindValue, deviceId, true);
    } catch {
      setError("The selected device could not be activated.");
    }
  };

  const toggleBrowserFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await conferenceRoot.current?.requestFullscreen();
    } catch {
      setError("Your browser did not allow full-screen mode.");
    }
  };

  const tiles = useMemo<CallTile[]>(() => {
    const videos = media.filter((item) => item.track.kind === Track.Kind.Video);
    const cameras = new Map(videos.filter((item) => item.source !== Track.Source.ScreenShare).map((item) => [item.identity, item]));
    const participantTiles = people.map((person) => ({ ...person, key: person.identity, media: cameras.get(person.identity) }));
    const screenTiles = videos.filter((item) => item.source === Track.Source.ScreenShare).map((item) => ({
      key: `${item.identity}-screen`, identity: item.identity, name: item.name, camera: true,
      mic: people.find((person) => person.identity === item.identity)?.mic || false,
      local: item.local, media: item, screen: true,
    }));
    return [...screenTiles, ...participantTiles];
  }, [media, people]);

  const pageCount = Math.max(1, Math.ceil(tiles.length / GALLERY_PAGE_SIZE));
  const visibleTiles = tiles.slice(page * GALLERY_PAGE_SIZE, (page + 1) * GALLERY_PAGE_SIZE);
  const featuredTile = tiles.find((tile) => tile.key === pinnedTile)
    || tiles.find((tile) => tile.screen)
    || tiles.find((tile) => tile.identity === activeSpeaker)
    || tiles[0];

  useEffect(() => {
    if (page >= pageCount) setPage(pageCount - 1);
    if (pinnedTile && !tiles.some((tile) => tile.key === pinnedTile)) setPinnedTile(null);
  }, [page, pageCount, pinnedTile, tiles]);

  const existingIds = new Set([...registeredParticipants.map((participant) => participant.id), ...invitedIds]);
  const selectableInvitees = inviteResults.filter((user) => !existingIds.has(user.id));
  const audioTracks = media.filter((item) => item.track.kind === Track.Kind.Audio);
  const controlClass = "min-h-11 min-w-11 border-border bg-card text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring";
  const moduleLocked = moduleAccess !== null && !hasModule("video_conferencing");

  if (moduleLocked) {
    return (
      <Button
        type="button"
        variant="outline"
        className="min-h-11 border-border"
        onClick={() => router.push("/dashboard/subscriptions?module=video_conferencing")}
      >
        <Video aria-hidden="true" /> Add video calls
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(value) => {
      setOpen(value);
      if (!value) leave(); else { setError(""); setStatus("Ready to join"); }
    }}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" disabled={disabled} className="min-h-11 border-border focus-visible:outline-2 focus-visible:outline-ring">
          <Video aria-hidden="true" />{active ? "Join video call" : "Video call"}
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton={false}
        className={cn("video-conferencing", connected
          ? "!left-0 !top-0 !z-[110] !h-[100dvh] !w-screen !max-w-none !translate-x-0 !translate-y-0 gap-0 overflow-hidden rounded-none border-0 bg-background p-0 text-foreground sm:!max-w-none"
          : "max-h-[90dvh] overflow-y-auto sm:max-w-4xl")}
        onOpenAutoFocus={(event) => { event.preventDefault(); heading.current?.focus(); }}>
        {!connected ? (
          <>
            <DialogTitle ref={heading} tabIndex={-1}>{title || "Video call"}</DialogTitle>
            <DialogDescription className="text-foreground">
              Only members of this {kind === "chat" ? "conversation" : "mail message"} can join. Choose your microphone and camera before joining.
              Audio, video, screen sharing, captions, reactions, and in-call messages are end-to-end encrypted with your Hive communication key.
            </DialogDescription>
            <div className="flex items-center gap-2 rounded-lg border border-emerald-700 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-400 dark:text-emerald-200">
              <Lock aria-hidden="true" className="size-4" /> End-to-end encryption required
            </div>
            <p role="status" className="text-sm">{status}</p>
            {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
            <div className="rounded-lg border border-foreground p-4">
              <p className="mb-3 text-sm">Your devices stay off until you join the call.</p>
              <div className="flex flex-wrap gap-2 [&_button]:min-h-11 [&_button]:border-foreground">
                <Button variant="outline" disabled={busy} onClick={() => setJoinMic((value) => !value)}>{joinMic ? "Join muted" : "Join with microphone"}</Button>
                <Button variant="outline" disabled={busy} onClick={() => setJoinCamera((value) => !value)}>{joinCamera ? "Join without camera" : "Join with camera"}</Button>
              </div>
              <p className="mt-3 text-sm">Microphone {joinMic ? "on" : "off"} / Camera {joinCamera ? "on" : "off"} when you join</p>
            </div>
            <div className="flex flex-wrap gap-2 [&_button]:min-h-11 [&_button]:border-foreground">
              <Button variant="outline" disabled={busy} onClick={() => void join()}>{busy ? "Connecting…" : "Join call"}</Button>
              <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
            </div>
          </>
        ) : (
          <div ref={conferenceRoot} className="flex h-[100dvh] min-h-0 flex-col bg-background text-foreground">
            <header className="flex min-h-16 items-center justify-between gap-3 border-b border-border bg-card px-3 py-2 sm:px-5">
              <div className="min-w-0">
                <DialogTitle ref={heading} tabIndex={-1} className="truncate text-base font-semibold text-foreground sm:text-lg">{title || "Hive video conference"}</DialogTitle>
                <DialogDescription className="sr-only">Full-screen video conference controls and participant area.</DialogDescription>
                <p role="status" className="flex items-center gap-1 truncate text-xs text-muted-foreground"><Lock aria-hidden="true" className="size-3 text-emerald-600" /> E2EE · {status} · {formatDuration(elapsed)} · {people.length} participant{people.length === 1 ? "" : "s"}</p>
              </div>
              <div className="flex items-center gap-2">
                {(recording || remoteRecording) && <span className="flex items-center gap-2 rounded-full bg-red-950 px-3 py-1 text-xs font-semibold text-red-100"><Circle aria-hidden="true" className="size-3 fill-red-500 text-red-500" />REC</span>}
                <Button type="button" size="icon" variant="outline" className={controlClass} onClick={() => void toggleBrowserFullscreen()} aria-label={browserFullscreen ? "Exit browser full screen" : "Enter browser full screen"}>{browserFullscreen ? <Minimize aria-hidden="true" /> : <Maximize aria-hidden="true" />}</Button>
                <Button type="button" size="icon" variant="outline" className={controlClass} onClick={() => { leave(); setOpen(false); }} aria-label="Leave and close call"><X aria-hidden="true" /></Button>
              </div>
            </header>

            {error && <p role="alert" className="border-b border-red-800 bg-red-950 px-4 py-2 text-sm text-red-100">{error}</p>}
            {audioPlaybackBlocked && <div className="flex flex-wrap items-center justify-center gap-2 border-b border-amber-700 bg-amber-950 px-3 py-2 text-sm text-amber-50">
              <span>Remote audio is paused by the browser.</span>
              <Button variant="outline" className="min-h-11 border-amber-200 bg-amber-950 text-amber-50 hover:bg-amber-900 hover:text-white" onClick={() => void roomRef.current?.startAudio().then(() => setAudioPlaybackBlocked(false)).catch(() => setError("Use your browser's sound permission to enable remote audio."))}>Enable remote audio</Button>
            </div>}

            <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
              <main className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-muted/30 p-2 sm:p-4" aria-label="Conference video stage">
                <div className="absolute left-4 top-4 z-20 flex rounded-xl border border-border bg-card/95 p-1 shadow-sm backdrop-blur">
                  <Button type="button" size="sm" variant="ghost" className={cn("min-h-11", layout === "gallery" && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground")} onClick={() => setLayout("gallery")} aria-pressed={layout === "gallery"}><Grid2X2 aria-hidden="true" />Gallery</Button>
                  <Button type="button" size="sm" variant="ghost" className={cn("min-h-11", layout === "speaker" && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground")} onClick={() => setLayout("speaker")} aria-pressed={layout === "speaker"}><Expand aria-hidden="true" />Speaker</Button>
                </div>
                {tiles.length === 0 ? <div className="flex size-full items-center justify-center text-muted-foreground">Waiting for participant media…</div> : layout === "gallery" ? (
                  <div className="flex size-full min-h-0 flex-col pt-14">
                    <div className="grid min-h-0 flex-1 content-center gap-2 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                      {visibleTiles.map((tile) => <ParticipantTile key={tile.key} tile={tile} handRaised={hands.has(tile.identity)} pinned={pinnedTile === tile.key} onPin={() => setPinnedTile((current) => current === tile.key ? null : tile.key)} />)}
                    </div>
                    {pageCount > 1 && <nav aria-label="Gallery pages" className="mt-2 flex items-center justify-center gap-3">
                      <Button type="button" size="icon" variant="outline" className={controlClass} disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))} aria-label="Previous participant page"><ChevronLeft aria-hidden="true" /></Button>
                      <span className="text-sm text-muted-foreground">Page {page + 1} of {pageCount}</span>
                      <Button type="button" size="icon" variant="outline" className={controlClass} disabled={page === pageCount - 1} onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))} aria-label="Next participant page"><ChevronRight aria-hidden="true" /></Button>
                    </nav>}
                  </div>
                ) : featuredTile ? (
                  <div className="flex size-full min-h-0 gap-2 pt-14">
                    <div className="min-h-0 min-w-0 flex-1"><ParticipantTile tile={featuredTile} handRaised={hands.has(featuredTile.identity)} pinned={pinnedTile === featuredTile.key} prominent onPin={() => setPinnedTile((current) => current === featuredTile.key ? null : featuredTile.key)} /></div>
                    <div className="hidden w-48 shrink-0 space-y-2 overflow-y-auto xl:block">{tiles.filter((tile) => tile.key !== featuredTile.key).map((tile) => <ParticipantTile key={tile.key} tile={tile} handRaised={hands.has(tile.identity)} pinned={pinnedTile === tile.key} onPin={() => setPinnedTile(tile.key)} />)}</div>
                  </div>
                ) : null}
                {reaction && <div key={reaction.id} role="status" aria-live="polite" className="pointer-events-none absolute left-1/2 top-20 z-30 -translate-x-1/2 rounded-2xl bg-black/80 px-5 py-3 text-center shadow-xl"><div className="text-4xl" aria-hidden="true">{reaction.text}</div><p className="text-sm text-white">{reaction.sender}</p></div>}
                {caption && <div key={caption.id} aria-live="polite" className="absolute bottom-5 left-1/2 z-30 max-w-[min(90%,44rem)] -translate-x-1/2 rounded-xl bg-black/90 px-5 py-3 text-center text-white shadow-xl"><span className="font-semibold text-white">{caption.sender}: </span>{caption.text}</div>}
              </main>

              {activePanel && <aside className="max-h-[42dvh] w-full shrink-0 overflow-y-auto border-t border-border bg-card p-4 lg:max-h-none lg:w-80 lg:border-l lg:border-t-0" aria-label={`${activePanel} panel`}>
                <div className="mb-4 flex items-center justify-between"><h3 className="text-base font-semibold text-foreground">{activePanel === "people" ? "Participants" : activePanel === "chat" ? "In-call chat" : activePanel === "invite" ? "Invite people" : "Device settings"}</h3><Button type="button" size="icon" variant="ghost" className="min-h-11 min-w-11" onClick={() => setActivePanel(null)} aria-label="Close side panel"><X aria-hidden="true" /></Button></div>
                {activePanel === "people" && <div className="space-y-3">
                  {host && <Button type="button" variant="outline" className={cn("w-full", controlClass)} onClick={() => void muteAll()}><MicOff aria-hidden="true" />Mute everyone</Button>}
                  <ul className="space-y-2">{people.map((person) => <li key={person.identity} className="flex min-h-12 items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2"><span className="min-w-0 truncate text-sm text-foreground">{hands.has(person.identity) ? "✋ " : ""}{person.name}{person.local ? " (you)" : ""}</span><span className="flex shrink-0 items-center gap-1 text-muted-foreground">{person.mic ? <Mic aria-label="Microphone on" className="size-4" /> : <MicOff aria-label="Muted" className="size-4" />}{person.camera ? <Video aria-label="Camera on" className="size-4" /> : <VideoOff aria-label="Camera off" className="size-4" />}{host && !person.local && <Button type="button" size="icon" variant="ghost" className="min-h-11 min-w-11 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => void removeParticipant(person.identity, person.name)} aria-label={`Remove ${person.name} from call`}><UserMinus aria-hidden="true" /></Button>}</span></li>)}</ul>
                </div>}
                {activePanel === "chat" && <div className="flex min-h-64 flex-col">
                  <ol className="flex-1 space-y-3 overflow-y-auto" aria-label="In-call messages">{messages.length === 0 && <li className="text-sm text-muted-foreground">Messages are end-to-end encrypted and visible only during this call.</li>}{messages.map((message) => <li key={message.id} className={cn("rounded-xl border px-3 py-2 text-sm", message.own ? "ml-6 border-primary/30 bg-primary text-primary-foreground" : "mr-6 border-border bg-background text-foreground")}><p className="font-semibold">{message.sender}</p><p className="whitespace-pre-wrap break-words">{message.text}</p></li>)}</ol>
                  <form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); void sendChat(); }}><label className="sr-only" htmlFor={`call-chat-${kind}-${id}`}>Message everyone in the call</label><Input id={`call-chat-${kind}-${id}`} value={chatInput} maxLength={1_000} onChange={(event) => setChatInput(event.target.value)} placeholder="Message everyone" className="min-h-11 border-border bg-background text-foreground" /><Button type="submit" size="icon" className="min-h-11 min-w-11" disabled={!chatInput.trim()} aria-label="Send in-call message"><Send aria-hidden="true" /></Button></form>
                </div>}
                {activePanel === "invite" && <div className="space-y-4">
                  <Button type="button" variant="outline" className={cn("w-full", controlClass)} onClick={() => void copyInviteLink()}><Copy aria-hidden="true" />Copy meeting link</Button>
                  {kind === "chat" ? <><div><label htmlFor={`invite-search-${id}`} className="mb-1 block text-sm font-medium text-foreground">Find a registered user</label><div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" /><Input id={`invite-search-${id}`} aria-describedby={`invite-help-${id}`} value={inviteQuery} onChange={(event) => setInviteQuery(event.target.value)} placeholder="Name or email" className="min-h-11 border-border bg-background pl-9 text-foreground" /></div><p id={`invite-help-${id}`} className="mt-1 text-xs text-muted-foreground">Only users with a secure Hive identity can join this encrypted call.</p></div>
                    {inviteQuery.trim().length > 0 && inviteQuery.trim().length < 2 && <p className="text-sm text-muted-foreground">Enter at least two characters.</p>}
                    <fieldset className="space-y-2"><legend className="sr-only">Select registered users to invite</legend>{selectableInvitees.map((user) => <label key={user.id} className={cn("flex min-h-12 items-center gap-3 rounded-xl border border-border bg-background px-3 py-2 text-sm", user.chat_public_key ? "cursor-pointer text-foreground" : "cursor-not-allowed text-muted-foreground")}><input type="checkbox" disabled={!user.chat_public_key} checked={selectedInvitees.has(user.id)} onChange={() => setSelectedInvitees((current) => { const next = new Set(current); if (next.has(user.id)) next.delete(user.id); else next.add(user.id); return next; })} className="size-5 accent-primary" /><span className="min-w-0"><span className="block truncate font-semibold">{user.name}</span><span className="block truncate text-muted-foreground">{user.email}{user.chat_public_key ? "" : " · secure identity required"}</span></span></label>)}</fieldset>
                    <Button type="button" className="min-h-11 w-full" disabled={inviteBusy || selectedInvitees.size === 0} onClick={() => void inviteRegisteredUsers()}><UserPlus aria-hidden="true" />{inviteBusy ? "Inviting…" : `Invite selected (${selectedInvitees.size})`}</Button></> : <p className="text-sm text-muted-foreground">Mail recipients can join from this encrypted sent message. Share the link with an existing recipient.</p>}
                  {inviteNotice && <p role="status" className="break-words text-sm text-[hsl(var(--primary-readable))]">{inviteNotice}</p>}
                </div>}
                {activePanel === "settings" && <div className="space-y-4">{(["audioinput", "videoinput", "audiooutput"] as MediaDeviceKind[]).map((kindValue) => { const matching = devices.filter((device) => device.kind === kindValue); const label = kindValue === "audioinput" ? "Microphone" : kindValue === "videoinput" ? "Camera" : "Speaker"; return <label key={kindValue} className="block text-sm font-medium text-foreground">{label}<select className="mt-1 min-h-11 w-full rounded-md border border-border bg-background px-3 text-foreground focus-visible:outline-2 focus-visible:outline-ring" defaultValue="" onChange={(event) => void switchDevice(kindValue, event.target.value)}><option value="" disabled>Select {label.toLowerCase()}</option>{matching.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `${label} ${index + 1}`}</option>)}</select></label>; })}<p className="text-sm text-muted-foreground">Device names appear after browser permission is granted.</p></div>}
              </aside>}
            </div>

            {audioTracks.map((item) => <div key={item.key} className="sr-only"><MediaTrack media={item} /></div>)}
            <footer className="border-t border-border bg-card px-2 py-2 sm:px-4">
              <div className="flex items-center justify-center gap-2 overflow-x-auto pb-1">
                <Button type="button" variant="outline" className={controlClass} disabled={busy} onClick={() => void toggle("mic")}><span className="flex flex-col items-center text-xs">{mic ? <Mic aria-hidden="true" /> : <MicOff aria-hidden="true" />}<span>{mic ? "Mute" : "Unmute"}</span></span></Button>
                <Button type="button" variant="outline" className={controlClass} disabled={busy} onClick={() => void toggle("camera")}><span className="flex flex-col items-center text-xs">{camera ? <Video aria-hidden="true" /> : <VideoOff aria-hidden="true" />}<span>{camera ? "Stop video" : "Start video"}</span></span></Button>
                <Button type="button" variant="outline" className={controlClass} disabled={busy} onClick={() => void toggle("screen")}><span className="flex flex-col items-center text-xs"><MonitorUp aria-hidden="true" /><span>{screen ? "Stop share" : "Share"}</span></span></Button>
                <Button type="button" variant="outline" className={cn(controlClass, localHand && "border-amber-300 bg-amber-950")} onClick={() => void toggleHand()} aria-pressed={localHand}><span className="flex flex-col items-center text-xs"><Hand aria-hidden="true" /><span>{localHand ? "Lower hand" : "Raise hand"}</span></span></Button>
                <div className="relative"><Button type="button" variant="outline" className={cn(controlClass, reactionMenuOpen && "border-[hsl(var(--primary-readable))] bg-accent")} onClick={() => setReactionMenuOpen((value) => !value)} aria-expanded={reactionMenuOpen} aria-controls={`call-reactions-${kind}-${id}`}><span className="flex flex-col items-center text-xs"><Smile aria-hidden="true" /><span>React</span></span></Button>{reactionMenuOpen && <div id={`call-reactions-${kind}-${id}`} className="absolute bottom-full left-1/2 z-40 mb-2 flex -translate-x-1/2 gap-1 rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-xl">{REACTIONS.map((emoji) => <Button key={emoji} type="button" size="icon" variant="ghost" className="min-h-11 min-w-11 text-xl" onClick={() => void sendReaction(emoji)} aria-label={`React ${emoji}`}>{emoji}</Button>)}</div>}</div>
                <Button type="button" variant="outline" className={cn(controlClass, activePanel === "people" && "border-[hsl(var(--primary-readable))] bg-accent")} onClick={() => setActivePanel((current) => current === "people" ? null : "people")} aria-pressed={activePanel === "people"}><span className="flex flex-col items-center text-xs"><Users aria-hidden="true" /><span>People ({people.length})</span></span></Button>
                <Button type="button" variant="outline" className={cn(controlClass, activePanel === "chat" && "border-[hsl(var(--primary-readable))] bg-accent")} onClick={() => setActivePanel((current) => current === "chat" ? null : "chat")} aria-pressed={activePanel === "chat"}><span className="flex flex-col items-center text-xs"><MessageSquare aria-hidden="true" /><span>Chat</span></span></Button>
                <Button type="button" variant="outline" className={cn(controlClass, activePanel === "invite" && "border-[hsl(var(--primary-readable))] bg-accent")} onClick={() => setActivePanel((current) => current === "invite" ? null : "invite")} aria-pressed={activePanel === "invite"}><span className="flex flex-col items-center text-xs"><UserPlus aria-hidden="true" /><span>Invite</span></span></Button>
                <Button type="button" variant="outline" className={cn(controlClass, captionsOn && "border-[hsl(var(--primary-readable))] bg-accent")} onClick={toggleCaptions} aria-pressed={captionsOn}><span className="flex flex-col items-center text-xs"><Captions aria-hidden="true" /><span>Captions</span></span></Button>
                {host && <Button type="button" variant="outline" className={cn(controlClass, recording && "border-red-400 bg-red-950")} onClick={() => recording ? stopRecording() : void startRecording()} aria-pressed={recording}><span className="flex flex-col items-center text-xs">{recording ? <Square aria-hidden="true" /> : <Radio aria-hidden="true" />}<span>{recording ? "Stop rec" : "Record"}</span></span></Button>}
                <Button type="button" variant="outline" className={cn(controlClass, activePanel === "settings" && "border-[hsl(var(--primary-readable))] bg-accent")} onClick={() => setActivePanel((current) => current === "settings" ? null : "settings")} aria-pressed={activePanel === "settings"}><span className="flex flex-col items-center text-xs"><Settings aria-hidden="true" /><span>Settings</span></span></Button>
                <Button type="button" variant="outline" className="min-h-11 border-destructive px-5 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => { leave(); setOpen(false); }}>Leave</Button>
                {host && <Button type="button" variant="destructive" className="min-h-11 px-5" disabled={busy} onClick={() => void endForEveryone()}>End for all</Button>}
              </div>
            </footer>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
