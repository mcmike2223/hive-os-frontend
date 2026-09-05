"use client";

import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track, type Participant } from "livekit-client";
import { Video } from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type Media = { key: string; track: Track; name: string; local: boolean };
function MediaTrack({ media }: { media: Media }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = media.track.attach();
    element.autoplay = true;
    if (element instanceof HTMLVideoElement) element.playsInline = true;
    element.muted = media.local;
    element.style.width = "100%";
    element.style.maxHeight = "40vh";
    element.setAttribute("aria-label", media.name + (media.track.kind === "video" ? " video" : " audio"));
    ref.current?.appendChild(element);
    return () => { media.track.detach(element); element.remove(); };
  }, [media]);
  return <div className={media.track.kind === "audio" ? "sr-only" : "rounded-lg bg-muted p-2"}>
    <div ref={ref} />
    {media.track.kind === "video" && <p className="mt-1 text-sm">{media.name}{media.local ? " (you)" : ""}</p>}
  </div>;
}

export function VideoCallButton({ kind, id, disabled = false }: { kind: "chat" | "mail"; id: string | number; disabled?: boolean }) {
  const endpoint = kind === "chat" ? `/chat/conversations/${id}/call` : `/mail/${id}/call`;
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("Ready to join");
  const [error, setError] = useState("");
  const [active, setActive] = useState(false);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [media, setMedia] = useState<Media[]>([]);
  const [names, setNames] = useState<string[]>([]);
  const [people, setPeople] = useState<{ identity: string; name: string; camera: boolean; mic: boolean; local: boolean }[]>([]);
  const [joinMic, setJoinMic] = useState(false);
  const [joinCamera, setJoinCamera] = useState(false);
  const [mic, setMic] = useState(false);
  const [camera, setCamera] = useState(false);
  const [screen, setScreen] = useState(false);
  const [audioPlaybackBlocked, setAudioPlaybackBlocked] = useState(false);
  const roomRef = useRef<Room | null>(null);
  const clientInstanceRef = useRef("");
  const generation = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);

  const leave = () => {
    generation.current++;
    const room = roomRef.current;
    roomRef.current = null;
    void room?.disconnect();
    setConnected(false); setBusy(false); setMedia([]); setNames([]); setPeople([]);
    setMic(false); setCamera(false); setScreen(false);
    setAudioPlaybackBlocked(false);
    setStatus("Call ended");
  };
  useEffect(() => {
    return () => { generation.current++; void roomRef.current?.disconnect(); roomRef.current = null; };
  }, [endpoint]);
  useEffect(() => {
    let alive = true;
    const check = async () => {
      if (document.hidden || disabled) return;
      try {
        const { data } = await api.get(endpoint);
        if (alive) setActive(Boolean(data.active));
      } catch { if (alive) setActive(false); }
    };
    void check();
    const interval = window.setInterval(check, 15000);
    return () => { alive = false; window.clearInterval(interval); };
  }, [endpoint, disabled]);

  const join = async () => {
    if (busy || connected) return;
    const current = ++generation.current;
    heading.current?.focus();
    setBusy(true); setError(""); setStatus("Connecting…");
    // Match the working Zoom clone room lifecycle and compatibility profile.
    const room = new Room({ adaptiveStream: false, dynacast: true });
    roomRef.current = room;
    const refresh = () => {
      if (current !== generation.current) return;
      const tracks: Media[] = [];
      const participants: Participant[] = [room.localParticipant, ...room.remoteParticipants.values()];
      for (const person of participants) {
        for (const publication of person.trackPublications.values()) {
          if (publication.track && !publication.isMuted) tracks.push({
            key: person.identity + publication.trackSid,
            track: publication.track,
            name: person.name || "Participant",
            local: person === room.localParticipant,
          });
        }
      }
      setMedia(tracks);
      setNames(participants.map(person => person.name || "Participant"));
      setPeople(participants.map(person => ({ identity: person.identity, name: person.name || "Participant", camera: person.isCameraEnabled, mic: person.isMicrophoneEnabled, local: person === room.localParticipant })));
      setMic(room.localParticipant.isMicrophoneEnabled);
      setCamera(room.localParticipant.isCameraEnabled);
      setScreen(room.localParticipant.isScreenShareEnabled);
    };
    room.on(RoomEvent.TrackSubscribed, track => {
      refresh();
      if (track.kind === Track.Kind.Audio) {
        void room.startAudio().then(() => setAudioPlaybackBlocked(!room.canPlaybackAudio))
          .catch(() => setAudioPlaybackBlocked(true));
      }
    }).on(RoomEvent.TrackUnsubscribed, refresh)
      .on(RoomEvent.LocalTrackPublished, refresh).on(RoomEvent.LocalTrackUnpublished, refresh)
      .on(RoomEvent.TrackMuted, refresh).on(RoomEvent.TrackUnmuted, refresh)
      .on(RoomEvent.ParticipantConnected, refresh).on(RoomEvent.ParticipantDisconnected, refresh)
      .on(RoomEvent.AudioPlaybackStatusChanged, canPlay => setAudioPlaybackBlocked(!canPlay))
      .on(RoomEvent.Reconnecting, () => setStatus("Reconnecting…"))
      .on(RoomEvent.Reconnected, () => setStatus("Connected"))
      .on(RoomEvent.Disconnected, () => {
        if (current !== generation.current) return;
        setConnected(false); setMedia([]); setNames([]); setPeople([]); setStatus("Disconnected. You can rejoin.");
      });
    try {
      if (!clientInstanceRef.current) clientInstanceRef.current = crypto.randomUUID();
      const { data } = await api.post(endpoint, { client_instance: clientInstanceRef.current });
      if (current !== generation.current) return;
      await room.connect(data.url, data.token);
      if (current !== generation.current) { await room.disconnect(); return; }
      void room.startAudio().then(() => setAudioPlaybackBlocked(!room.canPlaybackAudio))
        .catch(() => setAudioPlaybackBlocked(true));
      setConnected(true); setStatus("Connected"); refresh();
      for (const device of ["mic", "camera"] as const) {
        if (current !== generation.current) { await room.disconnect(); return; }
        try {
          if (device === "mic" && joinMic) await room.localParticipant.setMicrophoneEnabled(true, undefined, { name: "microphone" });
          if (device === "camera" && joinCamera) await room.localParticipant.setCameraEnabled(true, undefined, { name: "camera" });
        } catch {
          if (current === generation.current) setError("You joined, but a device could not start. Check browser permissions and use the call controls to retry.");
        }
      }
      if (current !== generation.current) { await room.disconnect(); return; }
      refresh();
    } catch (e) {
      await room.disconnect();
      if (current === generation.current) {
        const message = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
        setError(message || "Could not connect to the call. Please try again.");
        setStatus("Connection failed");
      }
    } finally { if (current === generation.current) setBusy(false); }
  };
  const toggle = async (device: "mic" | "camera" | "screen") => {
    const room = roomRef.current;
    if (!room || busy) return;
    setBusy(true); setError("");
    try {
      if (device === "mic") await room.localParticipant.setMicrophoneEnabled(!room.localParticipant.isMicrophoneEnabled, undefined, { name: "microphone" });
      if (device === "camera") await room.localParticipant.setCameraEnabled(!room.localParticipant.isCameraEnabled, undefined, { name: "camera" });
      if (device === "screen") await room.localParticipant.setScreenShareEnabled(!room.localParticipant.isScreenShareEnabled);
      setMic(room.localParticipant.isMicrophoneEnabled);
      setCamera(room.localParticipant.isCameraEnabled);
      setScreen(room.localParticipant.isScreenShareEnabled);
    } catch { setError("Device access was unavailable or declined. You can stay in the call and try again."); }
    finally { setBusy(false); }
  };
  return <Dialog open={open} onOpenChange={value => { setOpen(value); if (!value) leave(); else { setError(""); setStatus("Ready to join"); } }}>
    <DialogTrigger asChild>
      <Button variant="outline" disabled={disabled} className="min-h-11 border-foreground focus-visible:outline-2 focus-visible:outline-foreground">
        <Video aria-hidden="true" />{active ? "Join video call" : "Video call"}
      </Button>
    </DialogTrigger>
    <DialogContent showCloseButton={false} className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl"
      onOpenAutoFocus={event => { event.preventDefault(); heading.current?.focus(); }}>
      <DialogTitle ref={heading} tabIndex={-1}>Video call</DialogTitle>
      <DialogDescription className="text-foreground">
        Only members of this {kind === "chat" ? "conversation" : "mail message"} can join. Ask them to open the same item and select Video call.
        Choose your microphone and camera before joining. Calls use encrypted transport; message end-to-end encryption does not apply to video.
      </DialogDescription>
      <p role="status" className="text-sm">{status}{connected ? ` · ${names.length} participant(s)` : ""}</p>
      {error && <p role="alert" className="text-sm font-medium">{error}</p>}
      {!connected && <div className="rounded-lg border border-foreground p-4">
        <p className="mb-3 text-sm">Your devices stay off until you join the call.</p>
        <div className="flex flex-wrap gap-2 [&_button]:min-h-11 [&_button]:border-foreground [&_button]:focus-visible:outline-2 [&_button]:focus-visible:outline-foreground">
          <Button variant="outline" disabled={busy} onClick={() => setJoinMic(value => !value)}>{joinMic ? "Join muted" : "Join with microphone"}</Button>
          <Button variant="outline" disabled={busy} onClick={() => setJoinCamera(value => !value)}>{joinCamera ? "Join without camera" : "Join with camera"}</Button>
        </div>
        <p className="mt-3 text-sm">Microphone {joinMic ? "on" : "off"} / Camera {joinCamera ? "on" : "off"} when you join</p>
      </div>}
      {connected && audioPlaybackBlocked && <div className="flex flex-wrap items-center gap-2 rounded-lg border border-foreground p-3">
        <p className="text-sm">Remote audio is paused by the browser.</p>
        <Button variant="outline" onClick={() => void roomRef.current?.startAudio()
          .then(() => setAudioPlaybackBlocked(false))
          .catch(() => setError("Use your browser’s sound permission to enable remote audio."))}>Enable remote audio</Button>
      </div>}
      {connected && <p className="text-sm break-words">{names.join(", ")}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {people.filter(person => !person.camera).map(person => <div key={person.identity} className="flex min-h-40 flex-col items-center justify-center rounded-lg bg-muted p-4 text-foreground">
          <p className="text-lg font-medium">{person.name}{person.local ? " (you)" : ""}</p>
          <p className="text-sm">Camera off / {person.mic ? "Microphone on" : "Muted"}</p>
        </div>)}
        {media.map(item => <MediaTrack key={item.key} media={item} />)}
      </div>
      <div className="flex flex-wrap gap-2 [&_button]:min-h-11 [&_button]:border-foreground [&_button]:focus-visible:outline-2 [&_button]:focus-visible:outline-foreground">
        {!connected && <Button variant="outline" disabled={busy} onClick={() => void join()}>{busy ? "Connecting…" : "Join call"}</Button>}
        {connected && <>
          <Button variant="outline" disabled={busy} onClick={() => void toggle("mic")}>{mic ? "Mute microphone" : "Enable microphone"}</Button>
          <Button variant="outline" disabled={busy} onClick={() => void toggle("camera")}>{camera ? "Turn camera off" : "Enable camera"}</Button>
          <Button variant="outline" disabled={busy} onClick={() => void toggle("screen")}>{screen ? "Stop sharing" : "Share screen"}</Button>
          <Button variant="outline" onClick={() => void roomRef.current?.startAudio().catch(() => setError("Use your browser’s sound controls to allow audio."))}>Enable sound</Button>
        </>}
        <Button variant="outline" onClick={() => { leave(); setOpen(false); }}>{connected ? "Leave call" : "Close"}</Button>
      </div>
    </DialogContent>
  </Dialog>;
}
