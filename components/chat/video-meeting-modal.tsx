"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Search, Video } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useChatAccess } from "@/hooks/use-chat-access";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChatConversation, useChatStore } from "@/store/chat-store";

type MeetingUser = {
  id: number;
  name: string;
  email: string;
  avatar_url?: string | null;
};

type MeetingErrors = {
  title?: string;
  users?: string;
  general?: string;
};

export default function VideoMeetingModal() {
  const {
    isVideoMeetingOpen,
    setVideoMeetingOpen,
    conversations,
    appendConversation,
    setActiveConversation,
    adjustCounts,
    setPendingVideoCallConversationId,
  } = useChatStore();
  const { hasChatWorkspace } = useChatAccess();
  const [title, setTitle] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MeetingUser[]>([]);
  const [selected, setSelected] = useState<MeetingUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<MeetingErrors>({});
  const headingRef = useRef<HTMLHeadingElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!hasChatWorkspace && isVideoMeetingOpen) {
      setVideoMeetingOpen(false);
    }
  }, [hasChatWorkspace, isVideoMeetingOpen, setVideoMeetingOpen]);

  useEffect(() => {
    const searchTerm = query.trim();
    if (!isVideoMeetingOpen || searchTerm.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    let alive = true;
    const timeout = window.setTimeout(async () => {
      setSearching(true);
      setErrors((current) => ({ ...current, general: undefined }));
      try {
        const { data } = await api.get("/chat/video-meetings/users", { params: { q: searchTerm } });
        if (alive) setResults(data.data || data || []);
      } catch (error) {
        if (alive) {
          setResults([]);
          setErrors((current) => ({ ...current, general: getErrorMessage(error, "Could not search registered users.") }));
        }
      } finally {
        if (alive) setSearching(false);
      }
    }, 300);

    return () => {
      alive = false;
      window.clearTimeout(timeout);
    };
  }, [isVideoMeetingOpen, query]);

  const reset = () => {
    setTitle("");
    setQuery("");
    setResults([]);
    setSelected([]);
    setSearching(false);
    setSubmitting(false);
    setErrors({});
  };

  const close = () => {
    if (submitting) return;
    setVideoMeetingOpen(false);
    reset();
  };

  const toggleUser = (user: MeetingUser) => {
    setSelected((current) => current.some((item) => item.id === user.id)
      ? current.filter((item) => item.id !== user.id)
      : [...current, user]);
    setErrors((current) => ({ ...current, users: undefined }));
  };

  const createMeeting = async () => {
    const nextErrors: MeetingErrors = {};
    if (!title.trim()) nextErrors.title = "Enter a meeting name.";
    if (selected.length === 0) nextErrors.users = "Select at least one registered user to invite.";
    setErrors(nextErrors);

    if (nextErrors.title) {
      titleRef.current?.focus();
      return;
    }
    if (nextErrors.users) {
      searchRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post("/chat/video-meetings", {
        title: title.trim(),
        user_ids: selected.map((user) => user.id),
      });
      const conversation = data.conversation as ChatConversation;
      const exists = conversations.some((item) => String(item.id) === String(conversation.id));

      appendConversation(conversation);
      setActiveConversation(conversation.id);
      if (!exists) adjustCounts({ total: 1 });
      setPendingVideoCallConversationId(conversation.id);
      setVideoMeetingOpen(false);
      reset();
      toast.success(`Video meeting created. ${selected.length} invitation${selected.length === 1 ? "" : "s"} sent.`);
    } catch (error) {
      setErrors((current) => ({ ...current, general: getErrorMessage(error, "Could not create the video meeting.") }));
    } finally {
      setSubmitting(false);
    }
  };

  if (!hasChatWorkspace) return null;

  return (
    <Dialog open={isVideoMeetingOpen} onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          headingRef.current?.focus();
        }}
      >
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Video aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <DialogTitle ref={headingRef} tabIndex={-1}>Create a video meeting</DialogTitle>
            <DialogDescription className="mt-1">
              Invite registered Hive users now. The meeting stays in Chat so members can join again later.
            </DialogDescription>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="video-meeting-title">Meeting name</Label>
          <Input
            ref={titleRef}
            id="video-meeting-title"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              setErrors((current) => ({ ...current, title: undefined }));
            }}
            aria-invalid={Boolean(errors.title)}
            aria-describedby={errors.title ? "video-meeting-title-error" : "video-meeting-title-hint"}
            placeholder="Weekly operations call"
            autoComplete="off"
          />
          <p id="video-meeting-title-hint" className="text-sm text-muted-foreground">Members will see this name in their Chat list.</p>
          {errors.title && <p id="video-meeting-title-error" role="alert" className="text-sm font-medium text-destructive">{errors.title}</p>}
        </div>

        <fieldset className="space-y-3" aria-describedby={errors.users ? "video-meeting-users-error" : "video-meeting-users-hint"}>
          <legend className="text-sm font-medium">Invite registered users</legend>
          <div className="relative">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              id="video-meeting-user-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-h-11 pl-10"
              placeholder="Search by name or email"
              aria-label="Search registered users by name or email"
              aria-invalid={Boolean(errors.users)}
            />
          </div>
          <p id="video-meeting-users-hint" className="text-sm text-muted-foreground">
            Type at least two characters. {selected.length} selected.
          </p>
          {errors.users && <p id="video-meeting-users-error" role="alert" className="text-sm font-medium text-destructive">{errors.users}</p>}

          <p role="status" className="sr-only">{searching ? "Searching registered users" : `${results.length} users found`}</p>
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border p-1" aria-label="Registered user search results">
            {searching && (
              <div className="flex min-h-20 items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 aria-hidden="true" className="size-4 animate-spin" /> Searching…
              </div>
            )}
            {!searching && query.trim().length < 2 && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">Search to find people you can invite.</p>
            )}
            {!searching && query.trim().length >= 2 && results.length === 0 && !errors.general && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">No registered users found.</p>
            )}
            {!searching && results.map((user) => {
              const checked = selected.some((item) => item.id === user.id);
              const checkboxId = `video-meeting-user-${user.id}`;
              return (
                <label key={user.id} htmlFor={checkboxId} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted focus-within:bg-muted">
                  <Checkbox
                    id={checkboxId}
                    checked={checked}
                    onCheckedChange={() => toggleUser(user)}
                    aria-describedby={errors.users ? "video-meeting-users-error" : undefined}
                    aria-invalid={Boolean(errors.users)}
                  />
                  <Avatar className="size-9 rounded-lg">
                    <AvatarImage src={user.avatar_url || undefined} alt="" />
                    <AvatarFallback className="rounded-lg bg-primary/10 font-semibold text-primary">{user.name.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">{user.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {errors.general && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm font-medium text-destructive">{errors.general}</p>}

        <DialogFooter>
          <Button type="button" variant="outline" disabled={submitting} onClick={close}>Cancel</Button>
          <Button type="button" disabled={submitting} onClick={() => void createMeeting()}>
            {submitting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Video aria-hidden="true" className="size-4" />}
            {submitting ? "Creating…" : "Create meeting"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
