"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Check,
  Clock3,
  Copy,
  History,
  Loader2,
  LockKeyhole,
  MessageSquare,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  bootstrapConversationEncryption,
  ensureChatEncryptionIdentity,
} from "@/lib/chat-e2ee";
import { getErrorMessage } from "@/lib/errors";
import api from "@/lib/api";
import type { ChatEncryptionConfig } from "@/store/chat-store";
import { useChatStore } from "@/store/chat-store";

type MeetingStatus = "scheduled" | "live" | "ended" | "cancelled";

interface MeetingUser {
  id: number;
  name: string;
  email: string;
  avatar_url?: string | null;
  chat_encryption_public_key?: string | null;
}

interface VideoMeeting {
  id: number;
  uuid: string;
  conversation_id: number;
  title: string;
  agenda?: string | null;
  starts_at: string;
  duration_minutes: number;
  timezone: string;
  waiting_room: boolean;
  mute_on_entry: boolean;
  allow_join_before_host: boolean;
  status: MeetingStatus;
  is_host: boolean;
  host: MeetingUser;
  participants: MeetingUser[];
  join_href: string;
}

type ComposerMode = "instant" | "scheduled";

const defaultStartTime = () => {
  const value = new Date(Date.now() + 60 * 60 * 1000);
  value.setMinutes(Math.ceil(value.getMinutes() / 15) * 15, 0, 0);
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const formatMeetingTime = (meeting: VideoMeeting) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(meeting.starts_at));

export function VideoConferencingPage() {
  const router = useRouter();
  const appendConversation = useChatStore((state) => state.appendConversation);
  const setEncryptionConfig = useChatStore((state) => state.setEncryptionConfig);
  const conversationSignal = useChatStore((state) =>
    state.conversations.map((conversation) => `${conversation.id}:${conversation.updated_at}`).join("|"),
  );

  const [upcoming, setUpcoming] = useState<VideoMeeting[]>([]);
  const [history, setHistory] = useState<VideoMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [mode, setMode] = useState<ComposerMode>("scheduled");
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [agenda, setAgenda] = useState("");
  const [startsAt, setStartsAt] = useState(defaultStartTime);
  const [duration, setDuration] = useState("60");
  const [waitingRoom, setWaitingRoom] = useState(true);
  const [muteOnEntry, setMuteOnEntry] = useState(true);
  const [allowJoinBeforeHost, setAllowJoinBeforeHost] = useState(false);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<MeetingUser[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<MeetingUser[]>([]);

  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    [],
  );

  const loadMeetings = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const [upcomingResponse, historyResponse] = await Promise.all([
        api.get("/video-meetings", { params: { scope: "upcoming" } }),
        api.get("/video-meetings", { params: { scope: "history" } }),
      ]);
      setUpcoming(upcomingResponse.data?.data ?? []);
      setHistory(historyResponse.data?.data ?? []);
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not load video meetings"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMeetings(true);
  }, [loadMeetings]);

  useEffect(() => {
    if (conversationSignal) void loadMeetings();
  }, [conversationSignal, loadMeetings]);

  useEffect(() => {
    const query = search.trim();
    if (query.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await api.get("/video-meetings/users", { params: { q: query } });
        setSearchResults(response.data?.data ?? []);
      } catch (error) {
        toast.error(getErrorMessage(error, "Could not search registered users"));
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [search]);

  const resetComposer = useCallback(() => {
    setTitle("");
    setAgenda("");
    setStartsAt(defaultStartTime());
    setDuration("60");
    setWaitingRoom(true);
    setMuteOnEntry(true);
    setAllowJoinBeforeHost(false);
    setSearch("");
    setSearchResults([]);
    setSelectedUsers([]);
  }, []);

  const openComposer = (nextMode: ComposerMode) => {
    resetComposer();
    setMode(nextMode);
    setTitle(nextMode === "instant" ? "Instant team meeting" : "");
    setComposerOpen(true);
  };

  const toggleUser = (user: MeetingUser) => {
    if (!user.chat_encryption_public_key) return;
    setSelectedUsers((current) =>
      current.some((item) => item.id === user.id)
        ? current.filter((item) => item.id !== user.id)
        : [...current, user],
    );
  };

  const createMeeting = async () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      toast.error("Enter a meeting title");
      return;
    }

    setSaving(true);
    try {
      const configResponse = await api.get("/chat/config");
      const encryption = configResponse.data?.encryption as ChatEncryptionConfig;
      if (!encryption?.enabled) {
        throw new Error("End-to-end encryption is required for video meetings.");
      }
      setEncryptionConfig(encryption);
      await ensureChatEncryptionIdentity(encryption);

      const response = await api.post("/video-meetings", {
        title: cleanTitle,
        agenda: agenda.trim() || null,
        starts_at:
          mode === "instant"
            ? new Date().toISOString()
            : new Date(startsAt).toISOString(),
        duration_minutes: Number(duration),
        timezone,
        user_ids: selectedUsers.map((user) => user.id),
        waiting_room: waitingRoom,
        mute_on_entry: muteOnEntry,
        allow_join_before_host: allowJoinBeforeHost,
      });

      const meeting = response.data?.data as VideoMeeting;
      const securedConversation = await bootstrapConversationEncryption(
        response.data?.conversation,
      );
      appendConversation(securedConversation);
      setComposerOpen(false);
      resetComposer();
      await loadMeetings();
      toast.success(mode === "instant" ? "Encrypted meeting ready" : "Meeting scheduled");

      if (mode === "instant") router.push(meeting.join_href);
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not create the meeting"));
    } finally {
      setSaving(false);
    }
  };

  const cancelMeeting = async (meeting: VideoMeeting) => {
    try {
      await api.post(`/video-meetings/${meeting.uuid}/cancel`);
      await loadMeetings();
      toast.success("Meeting cancelled");
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not cancel the meeting"));
    }
  };

  const copyInvite = async (meeting: VideoMeeting) => {
    const url = new URL(meeting.join_href, window.location.origin).toString();
    await navigator.clipboard.writeText(url);
    toast.success("Invite link copied");
  };

  const liveCount = upcoming.filter((meeting) => meeting.status === "live").length;
  const invitedCount = upcoming.reduce(
    (total, meeting) => total + Math.max(0, meeting.participants.length - 1),
    0,
  );

  return (
    <main className="video-conferencing mx-auto w-full max-w-[1500px] space-y-6 p-4 sm:p-6 lg:p-8">
      <section
        aria-labelledby="video-conferencing-title"
        className="overflow-hidden rounded-3xl border bg-card shadow-sm"
      >
        <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-end md:p-8">
          <div className="max-w-3xl">
            <Badge variant="secondary" className="mb-4 gap-1.5 rounded-full px-3 py-1">
              <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
              End-to-end encrypted
            </Badge>
            <h1
              id="video-conferencing-title"
              className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
            >
              Video conferencing
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Start secure calls immediately or schedule a conference with registered Hive users.
              Invitations arrive in Chat in real time.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="outline" className="min-h-11 gap-2" asChild>
              <Link href="/dashboard/chat">
                <MessageSquare className="h-4 w-4" aria-hidden="true" />
                Open Chat
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 gap-2"
              onClick={() => openComposer("scheduled")}
            >
              <CalendarClock className="h-4 w-4" aria-hidden="true" />
              Schedule
            </Button>
            <Button
              type="button"
              className="min-h-11 gap-2"
              onClick={() => openComposer("instant")}
            >
              <Video className="h-4 w-4" aria-hidden="true" />
              New meeting
            </Button>
          </div>
        </div>
      </section>

      <section aria-label="Meeting summary" className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Live now", value: liveCount, icon: Video },
          { label: "Upcoming", value: upcoming.length, icon: CalendarClock },
          { label: "People invited", value: invitedCount, icon: Users },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
              </div>
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-[hsl(var(--primary-readable))]">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
            </CardContent>
          </Card>
        ))}
      </section>

      <section aria-labelledby="upcoming-meetings-title">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 id="upcoming-meetings-title" className="text-xl font-semibold">
              Upcoming meetings
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Start, join, copy an invitation, or cancel meetings you host.
            </p>
          </div>
        </div>

        {loading ? (
          <Card>
            <CardContent className="flex min-h-48 items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              Loading meetings
            </CardContent>
          </Card>
        ) : upcoming.length === 0 ? (
          <Card>
            <CardContent className="flex min-h-56 flex-col items-center justify-center p-8 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-muted">
                <CalendarClock className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-semibold">No meetings scheduled</h3>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Create an instant encrypted room or schedule time with your team.
              </p>
              <Button type="button" className="mt-5 min-h-11" onClick={() => openComposer("scheduled")}>
                Schedule a meeting
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {upcoming.map((meeting) => (
              <Card key={meeting.uuid} className="overflow-hidden">
                <CardHeader className="border-b bg-muted/30 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <CardTitle className="truncate text-lg">{meeting.title}</CardTitle>
                      <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock3 className="h-4 w-4 shrink-0" aria-hidden="true" />
                        {formatMeetingTime(meeting)} · {meeting.duration_minutes} min
                      </p>
                    </div>
                    <Badge variant={meeting.status === "live" ? "default" : "secondary"}>
                      {meeting.status === "live" ? "Live" : "Scheduled"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5 p-5">
                  {meeting.agenda ? (
                    <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
                      {meeting.agenda}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline" className="gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      E2EE
                    </Badge>
                    {meeting.waiting_room ? <Badge variant="outline">Waiting room</Badge> : null}
                    {meeting.mute_on_entry ? <Badge variant="outline">Mute on entry</Badge> : null}
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex -space-x-2" aria-label={`${meeting.participants.length} participants`}>
                      {meeting.participants.slice(0, 5).map((participant) => (
                        <Avatar key={participant.id} className="h-9 w-9 border-2 border-card">
                          <AvatarImage src={participant.avatar_url ?? undefined} alt="" />
                          <AvatarFallback>{initials(participant.name)}</AvatarFallback>
                        </Avatar>
                      ))}
                      {meeting.participants.length > 5 ? (
                        <span className="grid h-9 min-w-9 place-items-center rounded-full border-2 border-card bg-muted px-1 text-xs">
                          +{meeting.participants.length - 5}
                        </span>
                      ) : null}
                    </div>
                    <span className="truncate text-xs text-muted-foreground">
                      Host: {meeting.host.name}
                    </span>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="min-h-10 gap-2"
                      onClick={() => void copyInvite(meeting)}
                    >
                      <Copy className="h-4 w-4" aria-hidden="true" />
                      Copy invite
                    </Button>
                    {meeting.is_host ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="min-h-10 text-destructive hover:text-destructive"
                        onClick={() => void cancelMeeting(meeting)}
                      >
                        Cancel
                      </Button>
                    ) : null}
                    <Button size="sm" className="min-h-10 gap-2" asChild>
                      <Link href={meeting.join_href}>
                        <Video className="h-4 w-4" aria-hidden="true" />
                        {meeting.status === "live" ? "Join now" : meeting.is_host ? "Start" : "Open"}
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {history.length > 0 ? (
        <section aria-labelledby="meeting-history-title">
          <div className="mb-4 flex items-center gap-2">
            <History className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <h2 id="meeting-history-title" className="text-xl font-semibold">Recent history</h2>
          </div>
          <Card>
            <CardContent className="divide-y p-0">
              {history.slice(0, 8).map((meeting) => (
                <div key={meeting.uuid} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">{meeting.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{formatMeetingTime(meeting)}</p>
                  </div>
                  <Badge variant="outline">{meeting.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      ) : null}

      <Dialog open={composerOpen} onOpenChange={(open) => !saving && setComposerOpen(open)}>
        <DialogContent className="video-conferencing max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {mode === "instant" ? "Start an encrypted meeting" : "Schedule an encrypted meeting"}
            </DialogTitle>
            <DialogDescription>
              Invite up to 100 registered users. Media, screen sharing, captions, reactions, and call chat use end-to-end encryption.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-2">
            <div className="grid gap-2">
              <Label htmlFor="meeting-title">Meeting title</Label>
              <Input
                id="meeting-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={255}
                required
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="meeting-agenda">Agenda <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Textarea
                id="meeting-agenda"
                value={agenda}
                onChange={(event) => setAgenda(event.target.value)}
                rows={3}
                maxLength={5000}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {mode === "scheduled" ? (
                <div className="grid gap-2">
                  <Label htmlFor="meeting-start">Date and time</Label>
                  <Input
                    id="meeting-start"
                    type="datetime-local"
                    value={startsAt}
                    min={new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16)}
                    onChange={(event) => setStartsAt(event.target.value)}
                    required
                  />
                </div>
              ) : (
                <div className="rounded-xl border bg-muted/30 p-3">
                  <p className="text-sm font-medium">Starts immediately</p>
                  <p className="mt-1 text-xs text-muted-foreground">The room opens after secure keys are prepared.</p>
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="meeting-duration">Duration</Label>
                <select
                  id="meeting-duration"
                  value={duration}
                  onChange={(event) => setDuration(event.target.value)}
                  className="flex min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  {[15, 30, 45, 60, 90, 120, 180, 240].map((minutes) => (
                    <option key={minutes} value={minutes}>{minutes} minutes</option>
                  ))}
                </select>
              </div>
            </div>

            <fieldset className="grid gap-3 rounded-2xl border p-4">
              <legend className="px-1 text-sm font-medium">Host controls</legend>
              {[
                {
                  id: "waiting-room",
                  label: "Waiting room",
                  description: "The host admits people before they enter the call.",
                  checked: waitingRoom,
                  change: setWaitingRoom,
                },
                {
                  id: "mute-on-entry",
                  label: "Mute on entry",
                  description: "Participants join with their microphone off.",
                  checked: muteOnEntry,
                  change: setMuteOnEntry,
                },
                {
                  id: "join-before-host",
                  label: "Allow join before host",
                  description: "Available after the encrypted room keys are prepared.",
                  checked: allowJoinBeforeHost,
                  change: setAllowJoinBeforeHost,
                },
              ].map((option) => (
                <div key={option.id} className="flex items-start gap-3">
                  <Checkbox
                    id={option.id}
                    checked={option.checked}
                    onCheckedChange={(checked) => option.change(checked === true)}
                    className="mt-0.5"
                  />
                  <Label htmlFor={option.id} className="cursor-pointer font-normal">
                    <span className="block font-medium text-foreground">{option.label}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{option.description}</span>
                  </Label>
                </div>
              ))}
            </fieldset>

            <fieldset className="grid gap-3">
              <legend className="text-sm font-medium">Invite registered users</legend>
              {selectedUsers.length > 0 ? (
                <div className="flex flex-wrap gap-2" aria-label="Selected invitees">
                  {selectedUsers.map((user) => (
                    <span key={user.id} className="inline-flex min-h-9 items-center gap-2 rounded-full border bg-muted/40 pl-3 pr-1 text-sm">
                      {user.name}
                      <button
                        type="button"
                        className="grid h-7 w-7 place-items-center rounded-full hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => toggleUser(user)}
                        aria-label={`Remove ${user.name}`}
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by name or email"
                  aria-label="Search registered users"
                  className="pl-9"
                />
                {searching ? <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" /> : null}
              </div>
              {search.trim().length > 0 && search.trim().length < 2 ? (
                <p className="text-xs text-muted-foreground">Enter at least two characters.</p>
              ) : null}
              {searchResults.length > 0 ? (
                <div className="max-h-56 divide-y overflow-y-auto rounded-xl border" aria-live="polite">
                  {searchResults.map((user) => {
                    const selected = selectedUsers.some((item) => item.id === user.id);
                    const secure = Boolean(user.chat_encryption_public_key);
                    return (
                      <button
                        key={user.id}
                        type="button"
                        disabled={!secure}
                        onClick={() => toggleUser(user)}
                        className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-55"
                        aria-pressed={selected}
                      >
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={user.avatar_url ?? undefined} alt="" />
                          <AvatarFallback>{initials(user.name)}</AvatarFallback>
                        </Avatar>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{user.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {secure ? user.email : "Open secure Chat or Mail once to enable invitations"}
                          </span>
                        </span>
                        {selected ? <Check className="h-4 w-4 text-[hsl(var(--primary-readable))]" aria-hidden="true" /> : <UserPlus className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </fieldset>

            <div className="flex items-start gap-3 rounded-2xl border border-[hsl(var(--primary-readable))] bg-primary/5 p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(var(--primary-readable))]" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium">End-to-end encryption is required</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Hive creates the shared key in this browser and wraps it separately for every invited user. The server stores wrapped keys and cannot decrypt the meeting.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={() => setComposerOpen(false)}>
              Close
            </Button>
            <Button type="button" disabled={saving || !title.trim()} onClick={() => void createMeeting()} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : mode === "instant" ? <Video className="h-4 w-4" aria-hidden="true" /> : <CalendarClock className="h-4 w-4" aria-hidden="true" />}
              {mode === "instant" ? "Start meeting" : "Schedule meeting"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
