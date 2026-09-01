"use client";
import { readableTextColor } from "@/modules/support-bot/utils/widget-colors";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Bot,
  Headphones,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  RotateCcw,
  Send,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormattedChatMessage } from "@/components/support-bot/formatted-chat-message";
import api from "@/modules/shared/api/http";
import { getSupportBotThreadChannelName, initPublicEcho } from "@/lib/echo";
import { useDictation } from "@/hooks/use-dictation";
import { useWidgetDrag } from "@/hooks/use-widget-drag";

/**
 * The public support widget.
 *
 * It talks to the bot's own server endpoint and nothing else. It previously
 * carried a Google API key in the bundle and called Gemini straight from the
 * visitor's browser, and it carried a client-side intent parser that issued ERP
 * writes directly — both are gone. Anonymous visitors cannot spend the tenant's
 * model quota through anything but the rate-limited server endpoint, and no
 * record can be created from here at all.
 *
 * Signed-in staff get the ERP Copilot instead (`ErpCopilotPanel`), which reasons
 * server-side with the caller's own permissions and audits everything it does.
 */

interface SupportWebchatWidgetProps {
  botSlug?: string;
  primaryColor?: string;
  /**
   * Rendered inside the embed iframe on a tenant's own site. The frame is
   * already positioned by the host page, so the widget sits flush in it rather
   * than offsetting itself from a viewport corner it does not own.
   */
  embedded?: boolean;
  /** Lets the embed host resize its iframe as the panel opens and closes. */
  onOpenChange?: (open: boolean) => void;
}

interface WidgetMessage {
  id: number | string;
  sender_type: "visitor" | "bot" | "agent" | "system";
  sender_name?: string;
  content: string;
  payload?: {
    quick_replies?: string[];
    source_kb?: string;
    escalated?: boolean;
  } | null;
}

interface WidgetConfig {
  name: string;
  primary_color?: string;
  greeting_message?: string;
  enable_human_escalation?: boolean;
  widget_config?: {
    title?: string;
    subtitle?: string;
    placeholder?: string;
    launcher_label?: string;
  };
}

function getMessageKey(message: WidgetMessage): string {
  return `${message.sender_type}:${String(message.id)}`;
}

/**
 * Merge server and local messages without allowing the same logical message
 * into React's list twice. JSON responses may represent a database ID as a
 * number while websocket events represent it as a string, so IDs must be
 * compared in the same form React uses for keys.
 */
function mergeUniqueMessages(
  existing: WidgetMessage[],
  incoming: WidgetMessage[],
): WidgetMessage[] {
  const seen = new Set(existing.map(getMessageKey));
  const uniqueIncoming = incoming.filter((message) => {
    const id = getMessageKey(message);
    if (seen.has(id)) return false;

    seen.add(id);
    return true;
  });

  return uniqueIncoming.length > 0 ? [...existing, ...uniqueIncoming] : existing;
}

/**
 * Shown alongside the very first greeting, before the visitor has asked
 * anything. Without these the widget opened to a bare "how can I help" with
 * nothing clickable — quick replies only ever appeared after a first reply,
 * because the synthetic opening message had no payload of its own.
 */
// "Talk to a person" is deliberately not in this list: as a quick-reply chip
// it would be sent as an ordinary chat message to the bot rather than trigger
// the real escalate() action, and the phrase doesn't match the backend's
// escalation keywords ("human"/"agent") — so it would silently do the wrong
// thing right next to the real "Talk to a person" button that does work.
const STARTER_SUGGESTIONS = [
  "What modules does Hive have?",
  "How do I create a product?",
  "Calculate salary tax",
  "How does payroll work?",
  "What is the CRM module?",
  "How do I create an invoice?",
];

const FALLBACK_GREETING =
  "Hello! Ask me anything about Hive and I will do my best to help.";

export function SupportWebchatWidget({
  botSlug = "hive-ai-assistant",
  primaryColor: initialColor,
  embedded = false,
  onOpenChange,
}: SupportWebchatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<WidgetMessage[]>([]);
  const [sessionToken, setSessionToken] = useState("");
  const [credentialsLoaded, setCredentialsLoaded] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [streamToken, setStreamToken] = useState<string | null>(null);
  const [withAgent, setWithAgent] = useState(false);
  const [escalating, setEscalating] = useState(false);

  // Who the visitor is, so an agent picking this up is not talking to a
  // session id. Remembered locally so they are only ever asked once.
  const [visitorName, setVisitorName] = useState("");
  const [visitorEmail, setVisitorEmail] = useState("");
  const [identityGiven, setIdentityGiven] = useState(false);
  const [showIdentityForm, setShowIdentityForm] = useState(false);

  /** Agent messages that arrived while the panel was closed. */
  const [unread, setUnread] = useState(0);
  /** Set while the agent is composing, cleared on a timer. */
  const [agentTyping, setAgentTyping] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<number | null>(null);
  const typingSentAtRef = useRef(0);
  const openingRef = useRef(false);

  // Read inside the Echo callback, which is created once per stream token and
  // would otherwise close over a stale `isOpen`.
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;

  const drag = useWidgetDrag({
    storageKey: `support_bot_position_${botSlug}`,
    disabled: embedded,
  });

  const primaryColor = initialColor || config?.primary_color || "#3b82f6";
  const title = config?.widget_config?.title || config?.name || "Hive Assistant";
  const sessionStorageKey = `support_bot_session_${botSlug}`;
  const primaryForeground = readableTextColor(primaryColor);
  const subtitle = config?.widget_config?.subtitle || "Ask us anything";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // The embed host sizes its iframe from this.
  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  /**
   * Flags a reply that arrived while the widget was closed.
   *
   * A browser notification only if they have already granted it — this never
   * prompts. Being asked for notification permission by a support widget you
   * did not ask anything of is exactly the pattern people block sites over.
   * The unread badge is the always-present signal; this is the bonus.
   */
  const notifyOfReply = (from?: string) => {
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification(from ? `${from} replied` : "New reply from support", {
          body: "Open the chat to read it.",
          tag: `support-bot-${botSlug}`,
        });
      }
    } catch {
      // Notifications are a nicety; the badge already did the important part.
    }
  };

  /**
   * Tells the agent this visitor is composing.
   *
   * Throttled hard: this fires on keystrokes, and the useful signal is "still
   * typing", not "typed another character".
   */
  const pingTyping = () => {
    if (!withAgent || !sessionId || !sessionToken) return;

    const now = Date.now();
    if (now - typingSentAtRef.current < 2000) return;
    typingSentAtRef.current = now;

    void api.post(`/public/support-bot/${botSlug}/typing`, {
      session_id: sessionId,
      session_token: sessionToken,
    }).catch(() => {
      // Never interrupt someone's typing to report a failed typing ping.
    });
  };

  // Remember who they said they were, so the details are asked for once.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`support_bot_visitor_${botSlug}`);
      if (!saved) return;

      const parsed = JSON.parse(saved);
      if (parsed?.name) setVisitorName(parsed.name);
      if (parsed?.email) setVisitorEmail(parsed.email);
      if (parsed?.name || parsed?.email) setIdentityGiven(true);
    } catch {
      // They will simply be asked again.
    }
  }, [botSlug]);

  // Opening the panel is the moment they have seen what arrived.
  useEffect(() => {
    if (isOpen) setUnread(0);
  }, [isOpen, messages.length]);

  // The server issues both values. A session ID by itself is intentionally
  // useless, so leaked IDs cannot be used to read or write another chat.
  useEffect(() => {
    setSessionId("");
    setSessionToken("");
    setCredentialsLoaded(false);

    try {
      const stored = localStorage.getItem(sessionStorageKey);
      if (!stored) return;

      const parsed = JSON.parse(stored);
      if (
        typeof parsed?.session_id === "string" &&
        typeof parsed?.session_token === "string"
      ) {
        setSessionId(parsed.session_id);
        setSessionToken(parsed.session_token);
      }
    } catch {
      try {
        localStorage.removeItem(sessionStorageKey);
      } catch {
        // Storage is optional. The session still works for this page load.
      }
    } finally {
      setCredentialsLoaded(true);
    }
  }, [sessionStorageKey]);

  const openConversation = useCallback(async () => {
    if (openingRef.current) return;
    openingRef.current = true;

    try {
      const configResponse = await api.get(`/public/support-bot/${botSlug}/config`);
      const botConfig: WidgetConfig = configResponse.data?.data ?? configResponse.data;
      setConfig(botConfig);

      const sessionResponse = await api.post(`/public/support-bot/${botSlug}/session`, {
        session_id: sessionId || undefined,
        session_token: sessionToken || undefined,
      });

      const session = sessionResponse.data?.data ?? {};
      if (!session.session_id || !session.session_token) {
        throw new Error("The support server did not issue session credentials.");
      }

      setSessionId(session.session_id);
      setSessionToken(session.session_token);
      try {
        localStorage.setItem(
          sessionStorageKey,
          JSON.stringify({
            session_id: session.session_id,
            session_token: session.session_token,
          }),
        );
      } catch {
        // The active page session remains usable when storage is unavailable.
      }
      setStreamToken(session.stream_token ?? null);
      setWithAgent(Boolean(session.with_agent));
      setUnavailable(false);

      const history: WidgetMessage[] = session.messages ?? [];

      setMessages(
        history.length > 0
          ? mergeUniqueMessages([], history)
          : [
              {
                id: "greeting",
                sender_type: "bot",
                sender_name: botConfig?.name,
                content: botConfig?.greeting_message || FALLBACK_GREETING,
                payload: { quick_replies: STARTER_SUGGESTIONS },
              },
            ],
      );
    } catch {
      // Say so rather than showing a chat box that silently answers nothing.
      setUnavailable(true);
    } finally {
      openingRef.current = false;
    }
  }, [botSlug, sessionId, sessionStorageKey, sessionToken]);

  useEffect(() => {
    if (isOpen && credentialsLoaded && messages.length === 0 && !unavailable) {
      void openConversation();
    }
  }, [credentialsLoaded, isOpen, messages.length, unavailable, openConversation]);

  // Live delivery of an agent's reply. The channel is public because the
  // visitor has no account to authorise a private one — its name is a
  // server-issued secret, and only this browser and the server hold it.
  useEffect(() => {
    if (!streamToken) return;

    const echo = initPublicEcho();
    if (!echo) return;

    const channelName = getSupportBotThreadChannelName(streamToken);
    const channel = echo.channel(channelName);

    channel.listen(".support-bot.message", (event: any) => {
      // Our own turns are already on screen; echoing them would duplicate.
      if (event?.sender_type === "visitor") return;

      setWithAgent(event?.status === "escalated" || event?.status === "assigned");

      // A reply ends whatever typing indicator preceded it.
      setAgentTyping(false);

      setMessages((previous) =>
        mergeUniqueMessages(previous, [
          {
            id: event.id,
            sender_type: event.sender_type,
            sender_name: event.sender_name,
            content: event.content,
            payload: event.payload,
          },
        ]),
      );

      // Announce it if they are not looking. `isOpenRef` rather than `isOpen`
      // because this closure is created once per stream token and would
      // otherwise keep testing whatever the panel state was at subscribe time.
      if (!isOpenRef.current) {
        setUnread((count) => count + 1);
        notifyOfReply(event?.sender_name);
      }
    });

    channel.listen(".support-bot.escalated", () => setWithAgent(true));

    channel.listen(".support-bot.typing", (event: any) => {
      if (event?.who !== "agent") return;

      setAgentTyping(true);

      // Typing events only ever say "still going" — nothing announces a stop,
      // so the indicator has to expire on its own or it would stick forever
      // the moment someone walked away mid-sentence.
      if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
      typingTimerRef.current = window.setTimeout(() => setAgentTyping(false), 4000);
    });

    return () => {
      echo.leaveChannel(`${channelName}`);
    };
  }, [streamToken]);

  const requestHuman = () => {
    if (escalating || !sessionId || !sessionToken) return;

    // Ask who they are first. An agent picking this up otherwise sees an
    // anonymous session id and has no way to address them or follow up.
    if (!identityGiven) {
      setShowIdentityForm(true);
      return;
    }

    void escalateNow(visitorName, visitorEmail);
  };

  /**
   * Hands the conversation to a person.
   *
   * Takes the identity as arguments rather than reading state: it is called
   * straight from the form's own submit, where `setIdentityGiven` and the
   * field values have not been flushed to state yet.
   */
  const escalateNow = async (name: string, email: string) => {
    if (escalating || !sessionId || !sessionToken) return;

    setEscalating(true);

    try {
      const response = await api.post(`/public/support-bot/${botSlug}/escalate`, {
        session_id: sessionId,
        session_token: sessionToken,
        visitor: {
          name: name.trim() || undefined,
          email: email.trim() || undefined,
        },
      });

      const data = response.data?.data ?? {};
      setWithAgent(true);
      if (data.stream_token) setStreamToken(data.stream_token);

      setMessages((previous) => mergeUniqueMessages(previous, data.messages ?? []));
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } })?.response?.status;

      setMessages((previous) => [
        ...previous,
        {
          id: `esc_${Date.now()}`,
          sender_type: "system",
          content:
            status === 422
              ? "Live support is not switched on for this workspace. Leave your question here and the team will follow up."
              : "I could not reach the support queue just now. Please try again in a moment.",
        },
      ]);
    } finally {
      setEscalating(false);
    }
  };

  const resumeAssistant = async () => {
    if (!sessionId || !sessionToken) return;

    try {
      await api.post(`/public/support-bot/${botSlug}/resume`, {
        session_id: sessionId,
        session_token: sessionToken,
      });
      setWithAgent(false);

      setMessages((previous) => [
        ...previous,
        {
          id: `res_${Date.now()}`,
          sender_type: "system",
          content: "You are back with the assistant. Ask for a person again any time.",
        },
      ]);
    } catch {
      setWithAgent(false);
    }
  };

  const send = async (text?: string) => {
    const message = (text ?? inputValue).trim();
    if (!message || loading || !sessionId || !sessionToken) return;

    setMessages((prev) => [
      ...prev,
      { id: `v_${Date.now()}`, sender_type: "visitor", content: message },
    ]);
    setInputValue("");
    setLoading(true);

    try {
      const response = await api.post(`/public/support-bot/${botSlug}/chat`, {
        session_id: sessionId,
        session_token: sessionToken,
        message,
      });

      const replies: WidgetMessage[] = response.data?.data?.messages ?? response.data?.messages ?? [];

      // While a person has the conversation the server returns nothing here on
      // purpose — their reply arrives over the socket, and a "no answer" filler
      // would talk over them.
      if (replies.length === 0 && withAgent) return;

      setMessages((prev) =>
        mergeUniqueMessages(
          prev,
          replies.length > 0
          ? replies
          : [
              {
                id: `b_${Date.now()}`,
                sender_type: "bot" as const,
                content:
                  "I did not find an answer for that one. Try rephrasing it, or ask to speak to a person.",
              },
            ],
        ),
      );
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } })?.response?.status;

      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sender_type: "system",
          content:
            status === 429
              ? "We are getting a lot of questions right now — please try again in a minute."
              : "I could not reach our servers, so I have not answered. Please try again shortly.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const voice = useDictation(
    // Final transcript: send it, so dictation completes the whole task rather
    // than leaving the visitor to reach for the mouse.
    (text) => void send(text),
    // Interim: fill the box so they can see it is hearing them.
    (text) => setInputValue(text),
  );

  // Release the microphone if the widget is closed mid-sentence.
  useEffect(() => {
    if (!isOpen && voice.listening) voice.toggle();
  }, [isOpen, voice]);

  const reset = () => {
    setSessionId("");
    setSessionToken("");
    setStreamToken(null);
    setWithAgent(false);
    setMessages([]);
    setUnavailable(false);
    try {
      localStorage.removeItem(sessionStorageKey);
    } catch {
      // The in-memory credentials are already cleared.
    }
  };

  /**
   * Suggestions to show under the conversation.
   *
   * Falls back to the starter set once the server stops sending its own, and
   * drops anything already asked. Previously, a reply that carried no
   * quick_replies left the visitor staring at an empty box with nothing to
   * click — the suggestions appeared once and then quietly disappeared for the
   * rest of the conversation.
   */
  const suggestions = (() => {
    const asked = new Set(
      messages
        .filter((message) => message.sender_type === "visitor")
        .map((message) => message.content.trim().toLowerCase()),
    );

    const fromServer =
      [...messages].reverse().find((message) => message.payload?.quick_replies?.length)?.payload
        ?.quick_replies ?? [];

    const merged = [...fromServer, ...STARTER_SUGGESTIONS].filter(
      (item, index, all) =>
        all.indexOf(item) === index && !asked.has(item.trim().toLowerCase()),
    );

    return merged;
  })();

  if (!isOpen) {
    return (
      <div
        ref={drag.ref}
        {...drag.handleProps}
        // Offset from the corner: the offline-queue inspector is pinned there
        // at a higher z-index and was covering this button entirely. Inside the
        // embed iframe there is no such neighbour, and the frame is already
        // placed by the host page.
        className={`${
          embedded ? "fixed bottom-4 right-4" : drag.position ? "fixed" : "fixed bottom-6 right-24"
        } z-50 print:hidden ${drag.dragging ? "cursor-grabbing" : ""}`}
        style={{ ...drag.style, touchAction: embedded ? undefined : "none" }}
      >
        <button
          type="button"
          onClick={() => {
            // A drag that ends over the button must not also open the panel.
            if (drag.didDrag()) return;
            setIsOpen(true);
          }}
          aria-label={config?.widget_config?.launcher_label || "Open support chat"}
          className="group relative flex h-14 w-14 items-center justify-center rounded-full shadow-lg shadow-black/20 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          style={{
            backgroundColor: primaryColor,
            color: primaryForeground,
          }}
        >
          {/* A quiet pulse rather than a loud one — enough to say "something is
              here", not enough to nag at a visitor reading the page. */}
          <span
            className="absolute inset-0 -z-10 animate-ping rounded-full opacity-20 group-hover:opacity-0"
            style={{ backgroundColor: primaryColor, animationDuration: "2.5s" }}
          />
          <MessageSquare className="h-6 w-6" aria-hidden="true" />

          {/* The unread count replaces the plain "online" dot when something
              is waiting: two indicators in the same corner would compete, and
              "you have replies" is the more urgent of the two. */}
          {unread > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-red-700 px-1 text-[10px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : (
            <span className="absolute right-0.5 top-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-400" />
          )}
        </button>
      </div>
    );
  }

  // The open card is deliberately not draggable and always sits in the same
  // corner, however far the launcher has been moved: only the collapsed button
  // travels.
  return (
    <aside
      aria-labelledby="support-widget-title"
      role="dialog"
      className={
        embedded
          ? "fixed inset-2 z-50 flex flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl"
          : "fixed bottom-6 right-6 z-50 flex h-[min(600px,calc(100vh-6rem))] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl print:hidden animate-in fade-in slide-in-from-bottom-4 duration-200"
      }
    >
      <header
        className="relative flex items-center justify-between overflow-hidden px-4 py-3.5"
        style={{
          backgroundColor: primaryColor,
          color: primaryForeground,
        }}
      >
        {/* A soft light source in the corner — the one touch that keeps a flat
            brand colour from reading as a plain, dated banner. */}
        <div
          className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full opacity-30 blur-2xl"
          style={{ backgroundColor: "white" }}
        />

        <div className="relative flex items-center gap-2.5">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur-sm">
            <Bot className="h-4.5 w-4.5" />
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-400" />
          </div>
          <div className="leading-tight">
            <h2 id="support-widget-title" className="text-sm font-semibold tracking-tight">{title}</h2>
            <p className="text-[11px] opacity-80">{subtitle}</p>
          </div>
        </div>
        <div className="relative flex items-center gap-0.5">
          <button
            type="button"
            onClick={reset}
            title="Start over"
            aria-label="Start a new conversation"
            className="flex h-11 w-11 items-center justify-center rounded-lg transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            title="Close"
            aria-label="Close support chat"
            className="flex h-11 w-11 items-center justify-center rounded-lg transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* min-h-0 is what makes this scroll: a flex child will not shrink below
          its content height without it, so the list grew past the panel and
          overflow-y-auto had nothing to overflow. */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3" role="log" aria-live="polite" aria-relevant="additions text">
        {unavailable && (
          <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            Our assistant is offline at the moment. Please use the contact form and we will
            get back to you.
          </div>
        )}

        {messages.map((message) =>
          message.sender_type === "visitor" ? (
            <div
              key={getMessageKey(message)}
              className="flex justify-end animate-in fade-in slide-in-from-bottom-1 duration-150"
            >
              <div
                className="max-w-[85%] rounded-2xl rounded-br-sm px-3 py-2 text-xs shadow-sm"
                style={{ backgroundColor: primaryColor, color: primaryForeground }}
              >
                {message.content}
              </div>
            </div>
          ) : (
            <div
              key={getMessageKey(message)}
              className="flex max-w-[92%] items-end gap-1.5 animate-in fade-in slide-in-from-bottom-1 duration-150"
            >
              {message.sender_type !== "system" && (
                <div
                  className="mb-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: primaryColor, color: primaryForeground }}
                >
                  <Bot className="h-3.5 w-3.5" />
                </div>
              )}
              <div>
                <div
                  className={`rounded-2xl rounded-bl-sm px-3 py-2 shadow-sm ${
                    message.sender_type === "system"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-muted text-foreground"
                  }`}
                >
                  <FormattedChatMessage content={message.content} />
                </div>

                {message.payload?.escalated && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Headphones className="h-3 w-3" /> A member of our team has joined.
                  </p>
                )}
              </div>
            </div>
          ),
        )}

        {loading && (
          <div className="flex items-center gap-1.5">
            <div
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: primaryColor, color: primaryForeground }}
            >
              <Bot className="h-3.5 w-3.5" />
            </div>
            {/* Three bouncing dots read as "someone is composing a reply" at a
                glance, where "Typing…" text is easy to skim past — and with a
                self-hosted model sometimes taking tens of seconds, that glance
                is what keeps the wait from feeling broken. */}
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-muted px-3 py-2.5 shadow-sm">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50" />
            </div>
          </div>
        )}

        {/* The agent is composing. Distinct from the bot's own thinking
            indicator above, and labelled, so it is obvious a person is there. */}
        {agentTyping && (
          <div className="flex items-center gap-1.5">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white">
              <Headphones className="h-3.5 w-3.5" />
            </div>
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-emerald-500/10 px-3 py-2.5">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-600/60 [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-600/60 [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-600/60" />
              <span className="ml-1 text-[10px] text-emerald-700 dark:text-emerald-400">
                agent is typing
              </span>
            </div>
          </div>
        )}

        {/* Asked once, immediately before handing over to a person — an agent
            otherwise picks up an anonymous session with no way to reply or
            follow up. Both fields are optional; skipping still escalates. */}
        {showIdentityForm && !withAgent && (
          <div className="space-y-2 rounded-lg border border-dashed p-3">
            <p className="text-[11px] text-muted-foreground">
              Before I connect you — who should the team ask for?
            </p>
            <label htmlFor="support-visitor-name" className="block text-[11px] font-medium">
              Your name <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <Input
              id="support-visitor-name"
              value={visitorName}
              onChange={(event) => setVisitorName(event.target.value)}
              placeholder="Your name"
              className="h-8 text-xs"
            />
            <label htmlFor="support-visitor-email" className="block text-[11px] font-medium">
              Email <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <Input
              id="support-visitor-email"
              value={visitorEmail}
              onChange={(event) => setVisitorEmail(event.target.value)}
              placeholder="Email (so they can follow up)"
              type="email"
              className="h-8 text-xs"
            />
            <div className="flex gap-1.5">
              <Button
                size="sm"
                className="min-h-11 flex-1 text-[11px]"
                onClick={() => {
                  try {
                    localStorage.setItem(
                      `support_bot_visitor_${botSlug}`,
                      JSON.stringify({ name: visitorName, email: visitorEmail }),
                    );
                  } catch {
                    // Not remembering them is survivable.
                  }
                  setIdentityGiven(true);
                  setShowIdentityForm(false);
                  // requestHuman reads `identityGiven` from state, which has
                  // not flushed yet, so escalate directly here instead.
                  void escalateNow(visitorName, visitorEmail);
                }}
              >
                Connect me
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="min-h-11 text-[11px]"
                onClick={() => {
                  setIdentityGiven(true);
                  setShowIdentityForm(false);
                  void escalateNow("", "");
                }}
              >
                Skip
              </Button>
            </div>
          </div>
        )}

        {withAgent ? (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-2 text-[11px] text-emerald-700 dark:text-emerald-400">
              <Headphones className="h-3.5 w-3.5 shrink-0" />
              You are connected to our support team. Replies appear here as they are sent.
            </div>
            {/* Without a way back, asking for a person was a one-way door. */}
            <button
              type="button"
              onClick={resumeAssistant}
              className="w-full text-center text-[11px] text-muted-foreground underline-offset-2 transition hover:underline"
            >
              Back to the assistant
            </button>
          </div>
        ) : (
          config?.enable_human_escalation !== false && (
            <button
              type="button"
              onClick={requestHuman}
              disabled={escalating || unavailable}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed px-2.5 py-2 text-[11px] text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-60"
            >
              {escalating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Headphones className="h-3.5 w-3.5" />
              )}
              Talk to a person
            </button>
          )
        )}

        {suggestions.length > 0 && !loading && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {suggestions.slice(0, 6).map((reply) => (
              <button
                key={reply}
                type="button"
                onClick={() => send(reply)}
                className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-foreground/80 transition hover:border-primary/40 hover:bg-primary/10 hover:text-foreground"
              >
                {reply}
              </button>
            ))}
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Dictation state lives here rather than in a toast: the thing it is
          explaining is two inches below it, and a blocked microphone is the
          single most common reason the mic button appears to "do nothing". */}
      {(voice.notice || voice.listening) && (
        <div
          className={`flex items-center justify-between gap-2 border-t px-3 py-2 text-[11px] ${
            voice.notice ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" : "bg-destructive/5 text-destructive"
          }`}
        >
          <span className="flex items-center gap-1.5">
            {voice.listening && !voice.notice && (
              <span className="flex h-2 w-2 shrink-0 animate-pulse rounded-full bg-destructive" />
            )}
            {voice.notice ?? `Listening in ${voice.lang === "am-ET" ? "Amharic" : "English"} — speak now.`}
          </span>

          {voice.notice && (
            <button
              type="button"
              onClick={voice.dismissNotice}
              className="shrink-0 font-medium underline underline-offset-2"
            >
              Dismiss
            </button>
          )}
        </div>
      )}

      <form
        className="flex items-center gap-1.5 border-t bg-background/80 p-2.5"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <label htmlFor="support-widget-message" className="shrink-0 text-[10px] font-medium text-muted-foreground">
          Message
        </label>
        <Input
          id="support-widget-message"
          value={inputValue}
          onChange={(event) => {
            setInputValue(event.target.value);
            pingTyping();
          }}
          placeholder={config?.widget_config?.placeholder || "Type your message…"}
          className="h-11 min-w-0 flex-1 rounded-full border-muted-foreground/20 bg-muted/40 px-4 text-xs shadow-none focus-visible:ring-1"
          disabled={loading || unavailable}
        />
        {/* Always reachable, not just when a notice happens to be showing —
            otherwise there is no way to choose Amharic *before* dictating,
            which is the only time the choice actually matters. */}
        <button
          type="button"
          onClick={() => {
            voice.setLang(voice.lang === "en-US" ? "am-ET" : "en-US");
          }}
          title={`Dictation language: ${voice.lang === "am-ET" ? "Amharic" : "English"} — tap to switch`}
          aria-label={`Dictation language: ${voice.lang === "am-ET" ? "Amharic" : "English"}. Activate to switch.`}
          className="h-11 min-w-11 shrink-0 rounded-full px-2 text-[10px] font-semibold text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {voice.lang === "am-ET" ? "አማ" : "EN"}
        </button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={`relative h-11 w-11 shrink-0 rounded-full transition ${
            voice.listening ? "bg-destructive/10 text-destructive" : ""
          }`}
          onClick={voice.toggle}
          title={voice.listening ? "Stop dictation" : `Dictate (${voice.lang === "am-ET" ? "Amharic" : "English"})`}
          aria-pressed={voice.listening}
          aria-label={voice.listening ? "Stop dictation" : "Start dictation"}
        >
          {voice.listening && (
            <span className="absolute inset-0 animate-ping rounded-full bg-destructive/20" />
          )}
          {voice.listening ? <MicOff className="relative h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>
        <Button
          type="submit"
          size="icon"
          className="h-11 w-11 shrink-0 rounded-full shadow-sm transition hover:opacity-90"
          style={{ backgroundColor: primaryColor, color: primaryForeground }}
          disabled={loading || unavailable || !inputValue.trim()}
        >
          aria-label="Send message"
          <Send className="h-4 w-4" aria-hidden="true" />
        </Button>
      </form>
    </aside>
  );
}

export default SupportWebchatWidget;
