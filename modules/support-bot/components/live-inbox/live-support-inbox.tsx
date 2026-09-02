"use client";

import * as React from "react";
import {
  Headphones,
  User,
  Bot,
  Send,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  RefreshCw,
  Sparkles,
  Inbox,
  AlertCircle,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { getSupportBotInboxChannelName, initEcho } from "@/lib/echo";
import { getAccessToken } from "@/lib/runtime-context";
import { supportBotApi } from "../../api/support-bot-api";
import { SupportBot, SupportBotConversation, SupportBotMessage } from "../../types";

interface Props {
  bot: SupportBot;
}

export function LiveSupportInbox({ bot }: Props) {
  const [conversations, setConversations] = React.useState<SupportBotConversation[]>([]);
  const [selectedConvId, setSelectedConvId] = React.useState<number | null>(null);
  const [activeConv, setActiveConv] = React.useState<SupportBotConversation | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState<string>("escalated");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [replyText, setReplyText] = React.useState("");
  const [visitorTyping, setVisitorTyping] = React.useState(false);
  const [unreadByConversation, setUnreadByConversation] = React.useState<Record<number, number>>({});

  const typingTimerRef = React.useRef<number | null>(null);
  const typingSentAtRef = React.useRef(0);

  /**
   * A desktop notification, only if the agent has already granted permission.
   * Never prompts: an inbox that demands notification access the first time a
   * visitor appears is one agents turn off.
   */
  const notifyAgent = (title: string, body?: string) => {
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification(title, { body, tag: "support-bot-inbox" });
      }
    } catch {
      // The toast already carried the message.
    }
  };

  /** Lets the visitor see that a person is composing. Throttled. */
  const pingTyping = (conversationId: number) => {
    const now = Date.now();
    if (now - typingSentAtRef.current < 2000) return;
    typingSentAtRef.current = now;

    void supportBotApi.sendTyping(bot.id, conversationId);
  };
  const [sending, setSending] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const loadConversations = async () => {
    if (!bot?.id) return;
    try {
      setLoading(true);
      const res = await supportBotApi.getConversations(bot.id, {
        status: statusFilter === "all" ? undefined : statusFilter,
      });
      const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      setConversations(list);

      if (list.length > 0 && !selectedConvId) {
        setSelectedConvId(list[0].id);
      }
    } catch (e) {
      console.error("Failed to load conversations", e);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadConversations();
  }, [bot.id, statusFilter]);

  // Load single conversation details
  React.useEffect(() => {
    if (!selectedConvId) return;

    const loadSingle = async () => {
      try {
        const data = await supportBotApi.getConversation(bot.id, selectedConvId);
        setActiveConv(data);
      } catch (e) {
        console.error("Failed to load conversation details", e);
      }
    };

    loadSingle();
    const interval = setInterval(loadSingle, 4000); // Live poll updates
    return () => clearInterval(interval);
  }, [bot.id, selectedConvId]);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConv?.messages]);

  // Live inbox.
  //
  // The 4-second poll above only ever refreshes the conversation already open,
  // so a visitor asking for a person sat unseen until somebody reloaded the
  // page. This subscribes to the tenant's support channel instead: an
  // escalation or a visitor message arrives while the agent is looking at it.
  const selectedConvIdRef = React.useRef<number | null>(null);
  selectedConvIdRef.current = selectedConvId;

  // Opening a conversation is the moment its messages have been seen.
  React.useEffect(() => {
    if (selectedConvId === null) return;

    setVisitorTyping(false);
    setUnreadByConversation((current) => {
      if (!current[selectedConvId]) return current;

      const next = { ...current };
      delete next[selectedConvId];
      return next;
    });
  }, [selectedConvId]);

  React.useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    let echo: ReturnType<typeof initEcho> | null = null;
    const channelName = getSupportBotInboxChannelName();

    try {
      echo = initEcho(token);
    } catch {
      return; // Realtime is an enhancement; polling still works without it.
    }

    if (!echo) return;

    const channel = echo.private(channelName);

    const refreshOpenConversation = async (conversationId: number) => {
      if (selectedConvIdRef.current !== conversationId) return;

      try {
        setActiveConv(await supportBotApi.getConversation(bot.id, conversationId));
      } catch {
        // The poll will catch up.
      }
    };

    channel.listen(
      ".support-bot.escalated",
      (event: {
        conversation_id: number;
        visitor_name?: string | null;
        visitor_email?: string | null;
      }) => {
        loadConversations();

        // Someone is waiting *now*. Naming them turns a generic ping into
        // something an agent can act on without opening anything first.
        const who = event.visitor_name || event.visitor_email || "A visitor";

        toast.info(`${who} would like to talk to a person`, {
          description: event.visitor_email ?? "Waiting in the support queue",
          duration: 10000,
          action: {
            label: "Open",
            onClick: () => setSelectedConvId(event.conversation_id),
          },
        });

        void notifyAgent(`${who} wants to talk to a person`, event.visitor_email ?? undefined);
      },
    );

    channel.listen(".support-bot.message", (event: { conversation_id: number }) => {
      void refreshOpenConversation(event.conversation_id);
      loadConversations();

      // Anything arriving in a conversation the agent is not currently reading
      // is unread until they open it.
      if (selectedConvIdRef.current !== event.conversation_id) {
        setUnreadByConversation((current) => ({
          ...current,
          [event.conversation_id]: (current[event.conversation_id] ?? 0) + 1,
        }));
      }
    });

    channel.listen(
      ".support-bot.typing",
      (event: { conversation_id: number; who: string; name?: string }) => {
        if (event.who !== "visitor") return;
        if (selectedConvIdRef.current !== event.conversation_id) return;

        setVisitorTyping(true);

        // Nothing announces "stopped typing", so the indicator expires itself.
        if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
        typingTimerRef.current = window.setTimeout(() => setVisitorTyping(false), 4000);
      },
    );

    return () => {
      echo?.leave(channelName);
    };
  }, [bot.id]);

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedConvId || sending) return;

    try {
      setSending(true);
      await supportBotApi.sendAgentMessage(bot.id, selectedConvId, replyText);
      setReplyText("");
      // Reload conversation messages
      const updated = await supportBotApi.getConversation(bot.id, selectedConvId);
      setActiveConv(updated);
    } catch (e) {
      console.error("Failed to send agent reply", e);
    } finally {
      setSending(false);
    }
  };

  const handleUpdateStatus = async (status: "active" | "escalated" | "resolved" | "closed") => {
    if (!selectedConvId) return;
    try {
      await supportBotApi.updateConversationStatus(bot.id, selectedConvId, status);
      loadConversations();
      const updated = await supportBotApi.getConversation(bot.id, selectedConvId);
      setActiveConv(updated);
    } catch (e) {
      console.error("Failed to update status", e);
    }
  };

  const filteredList = conversations.filter((c) => {
    const term = searchQuery.toLowerCase();
    return (
      (c.visitor_name && c.visitor_name.toLowerCase().includes(term)) ||
      (c.visitor_email && c.visitor_email.toLowerCase().includes(term)) ||
      c.session_id.toLowerCase().includes(term)
    );
  });

  return (
    <div className="flex h-[calc(100vh-14rem)] rounded-xl border border-border/80 bg-card overflow-hidden shadow-sm">
      {/* Left Conversations Sidebar */}
      <div className="w-80 border-r border-border/60 flex flex-col bg-muted/10">
        {/* Sidebar Header & Filters */}
        <div className="p-3 border-b border-border/60 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Headphones className="h-3.5 w-3.5 text-primary" /> Live Inbox
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={loadConversations}
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>

          <div className="flex gap-1">
            {["escalated", "active", "resolved", "all"].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`flex-1 rounded-md py-1 text-[11px] font-medium capitalize transition-colors ${
                  statusFilter === status
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search visitor..."
              className="h-8 pl-8 text-xs bg-background"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/40">
          {loading && conversations.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">Loading inbox...</div>
          ) : filteredList.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Inbox className="h-7 w-7 mx-auto mb-2 opacity-40" />
              <p className="text-xs">No {statusFilter} chats.</p>
            </div>
          ) : (
            filteredList.map((c) => {
              const isSelected = c.id === selectedConvId;
              const isEscalated = c.status === "escalated";

              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedConvId(c.id)}
                  className={`p-3 text-xs cursor-pointer transition-colors ${
                    isSelected ? "bg-primary/10 border-l-2 border-primary" : "hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-foreground truncate max-w-[110px]">
                      {c.visitor_name || "Visitor"}
                    </span>
                    <div className="flex items-center gap-1">
                      {/* Unread count for a thread the agent is not reading. */}
                      {(unreadByConversation[c.id] ?? 0) > 0 && (
                        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                          {unreadByConversation[c.id] > 9 ? "9+" : unreadByConversation[c.id]}
                        </span>
                      )}
                      <Badge
                        variant={isEscalated ? "destructive" : "outline"}
                        className="text-[10px] px-1.5 py-0 capitalize"
                      >
                        {c.status}
                      </Badge>
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground truncate">
                    {c.visitor_email || c.session_id.substring(0, 14)}
                  </p>

                  <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
                    <span className="capitalize">{c.channel}</span>
                    <span>{new Date(c.last_activity_at || c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Chat Thread & Reply Console */}
      <div className="flex-1 flex flex-col bg-background">
        {activeConv ? (
          <>
            {/* Thread Header */}
            <div className="flex items-center justify-between border-b border-border/60 bg-muted/20 px-4 py-2.5">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                  {activeConv.visitor_name?.charAt(0) || "V"}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{activeConv.visitor_name || "Visitor"}</span>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {activeConv.status}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {activeConv.visitor_email || "No email"} · Channel: {activeConv.channel}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {activeConv.status === "escalated" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleUpdateStatus("active")}
                    className="h-8 text-xs text-blue-600 border-blue-500/40"
                  >
                    Return to Bot
                  </Button>
                )}

                {activeConv.status !== "resolved" && (
                  <Button
                    size="sm"
                    onClick={() => handleUpdateStatus("resolved")}
                    className="h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Resolve Ticket
                  </Button>
                )}
              </div>
            </div>

            {/* Message Thread History */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-muted/5">
              {activeConv.messages?.map((msg: SupportBotMessage) => {
                const isVisitor = msg.sender_type === "visitor";
                const isAgent = msg.sender_type === "agent";
                const isBot = msg.sender_type === "bot";

                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2.5 ${isAgent ? "flex-row-reverse" : "flex-row"}`}
                  >
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs text-white ${
                        isAgent ? "bg-primary" : isBot ? "bg-blue-600" : "bg-emerald-600"
                      }`}
                    >
                      {isAgent ? (
                        <Headphones className="h-3.5 w-3.5" />
                      ) : isBot ? (
                        <Bot className="h-3.5 w-3.5" />
                      ) : (
                        <User className="h-3.5 w-3.5" />
                      )}
                    </div>

                    <div className={`max-w-[75%] space-y-1 ${isAgent ? "items-end text-right" : "items-start"}`}>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground px-1">
                        <span className="font-semibold">{msg.sender_name || msg.sender_type}</span>
                        <span>·</span>
                        <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>

                      <div
                        className={`rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-sm ${
                          isAgent
                            ? "bg-primary text-primary-foreground rounded-tr-none"
                            : isBot
                            ? "bg-muted/90 text-foreground border border-border/60 rounded-tl-none"
                            : "bg-emerald-500/10 text-foreground border border-emerald-500/20 rounded-tl-none"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
              {/* The visitor is composing — shown to the agent so they know
                  to wait rather than send a second prompt. */}
              {visitorTyping && (
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1.5">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50" />
                  </div>
                  {activeConv.visitor_name || "Visitor"} is typing…
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Agent Reply Box */}
            <div className="border-t border-border/60 p-3 bg-muted/10">
              <div className="flex items-center gap-1.5 mb-2 overflow-x-auto pb-1">
                <span className="text-[10px] text-muted-foreground shrink-0">Canned:</span>
                {[
                  "Hello, I am reviewing your request now.",
                  "Could you provide your invoice or order number?",
                  "Your issue has been resolved. Is there anything else?",
                ].map((canned, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setReplyText(canned)}
                    className="rounded-full border border-border/80 bg-background px-2.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground shrink-0"
                  >
                    {canned.substring(0, 30)}...
                  </button>
                ))}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendReply();
                }}
                className="flex items-center gap-2"
              >
                <Input
                  value={replyText}
                  onChange={(e) => {
                    setReplyText(e.target.value);
                    if (selectedConvId) pingTyping(selectedConvId);
                  }}
                  placeholder="Type your reply as support agent..."
                  className="h-9 text-xs rounded-full bg-background"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!replyText.trim() || sending}
                  className="h-9 px-4 rounded-full gap-1.5 text-xs shadow"
                >
                  <Send className="h-3.5 w-3.5" />
                  Send
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <MessageSquare className="h-10 w-10 mb-2 opacity-30" />
            <p className="text-sm font-semibold">Select a conversation from the left inbox</p>
            <p className="text-xs max-w-sm mt-1">
              You will see live chat history and be able to reply directly to customers.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
