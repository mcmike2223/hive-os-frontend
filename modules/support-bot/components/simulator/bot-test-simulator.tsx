"use client";

import * as React from "react";
import {
  Bot,
  Send,
  User,
  RotateCcw,
  Sparkles,
  ChevronRight,
  Headphones,
  Info,
  CheckCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  PublicSupportSessionCredentials,
  supportBotApi,
} from "../../api/support-bot-api";
import { SupportBot } from "../../types";
import { readableTextColor } from "../../utils/widget-colors";

interface Props {
  bot: SupportBot;
  onClose?: () => void;
}

interface ChatMessage {
  id: string;
  sender_type: "visitor" | "bot" | "agent" | "system";
  content: string;
  payload?: any;
  created_at: string;
}

export function BotTestSimulator({ bot, onClose }: Props) {
  const [credentials, setCredentials] =
    React.useState<PublicSupportSessionCredentials | null>(null);
  const [resetGeneration, setResetGeneration] = React.useState(0);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [convStatus, setConvStatus] = React.useState<string>("active");
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const botIdentifier = bot.public_id || bot.slug;
  const brandColor = bot.primary_color || "#3b82f6";
  const brandForeground = readableTextColor(brandColor);
  React.useEffect(() => {
    let cancelled = false;

    const initialise = async () => {
      setLoading(true);

      try {
        const res = await supportBotApi.publicInitSession(
          botIdentifier,
          undefined,
          { name: "Test Tester" },
        );
        if (cancelled) return;

        setCredentials({
          session_id: res.session_id,
          session_token: res.session_token,
        });
        setMessages(
          (res.messages ?? []).map((m: any) => ({
            id: String(m.id || Math.random()),
            sender_type: m.sender_type,
            content: m.content,
            payload: m.payload,
            created_at: m.created_at || new Date().toISOString(),
          })),
        );
        setConvStatus(res.status ?? "active");
      } catch (error) {
        if (!cancelled) console.error("Init session error", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void initialise();

    return () => {
      cancelled = true;
    };
  }, [botIdentifier, resetGeneration]);

  const handleReset = () => {
    setCredentials(null);
    setMessages([]);
    setConvStatus("active");
    setResetGeneration((value) => value + 1);
  };

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || inputValue.trim();
    if (!text || loading || !credentials) return;

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      sender_type: "visitor",
      content: text,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputValue("");
    setLoading(true);

    try {
      const res = await supportBotApi.publicSendMessage(botIdentifier, credentials, text);
      if (res?.messages) {
        const botMsgs: ChatMessage[] = res.messages.map((m: any) => ({
          id: String(m.id || `b_${Date.now()}_${Math.random()}`),
          sender_type: m.sender_type || "bot",
          content: m.content,
          payload: m.payload,
          created_at: m.created_at || new Date().toISOString(),
        }));
        setMessages((prev) => [...prev, ...botMsgs]);
      }
      if (res?.status) {
        setConvStatus(res.status);
      }
    } catch (e) {
      console.error("Send message error", e);
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sender_type: "system",
          content: "Failed to communicate with bot endpoint.",
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border/80 bg-card shadow-2xl">
      {/* Simulator Header */}
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg shadow-sm"
            style={{ backgroundColor: brandColor, color: brandForeground }}
          >
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">{bot.name}</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                Simulator
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Session: {credentials?.session_id.substring(0, 10) ?? "starting"}...
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleReset}
            className="min-h-11 gap-1 text-xs text-muted-foreground hover:text-foreground"
            title="Reset conversation session"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
          {onClose && (
            <Button size="sm" variant="ghost" onClick={onClose} className="h-11 w-11 p-0" aria-label="Close simulator">
              ✕
            </Button>
          )}
        </div>
      </div>

      {/* Escalation Alert Bar */}
      {convStatus === "escalated" && (
        <div className="flex items-center gap-2 bg-amber-500/10 px-4 py-2 text-amber-700 dark:text-amber-300 text-xs border-b border-amber-500/20">
          <Headphones className="h-4 w-4 shrink-0" />
          <span>This conversation has escalated to Live Human Support.</span>
        </div>
      )}

      {/* Messages Timeline */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-background/50" role="log" aria-live="polite" aria-relevant="additions text">
        {messages.map((msg) => {
          const isUser = msg.sender_type === "visitor";
          const isSystem = msg.sender_type === "system";

          if (isSystem) {
            return (
              <div key={msg.id} className="flex justify-center my-2">
                <span className="rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  {msg.content}
                </span>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}
            >
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${
                  isUser ? "bg-primary text-primary-foreground" : ""
                }`}
                style={!isUser ? { backgroundColor: brandColor, color: brandForeground } : undefined}
              >
                {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
              </div>

              <div className={`max-w-[80%] space-y-1.5 ${isUser ? "items-end text-right" : "items-start"}`}>
                <div
                  className={`rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-sm ${
                    isUser
                      ? "bg-primary text-primary-foreground rounded-tr-none"
                      : "bg-muted/90 text-foreground border border-border/60 rounded-tl-none"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>

                  {/* RAG Citation Badge */}
                  {msg.payload?.source_kb && (
                    <div className="mt-2 pt-1.5 border-t border-border/40 flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Sparkles className="h-3 w-3 text-amber-500" />
                      <span>Answered from: {msg.payload.source_kb}</span>
                    </div>
                  )}
                </div>

                {/* Quick Reply Pills */}
                {msg.payload?.quick_replies && msg.payload.quick_replies.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {msg.payload.quick_replies.map((btnText: string, i: number) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSend(btnText)}
                        className="rounded-full border border-primary/40 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-primary transition-all hover:bg-primary hover:text-primary-foreground hover:shadow"
                      >
                        {btnText}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground text-xs pl-9">
            <div className="flex space-x-1">
              <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
              <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:0.2s]" />
              <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:0.4s]" />
            </div>
            <span>{bot.name} is typing...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Box */}
      <div className="border-t border-border/60 bg-muted/20 p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <label htmlFor="support-bot-simulator-message" className="shrink-0 text-[10px] font-medium text-muted-foreground">Message</label>
          <Input
            id="support-bot-simulator-message"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type a message to test..."
            disabled={loading}
            className="h-11 min-w-0 flex-1 text-xs rounded-full bg-background border-border/80 focus-visible:ring-primary"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!inputValue.trim() || loading || !credentials}
            className="h-11 w-11 rounded-full p-0 shadow"
            style={{ backgroundColor: brandColor, color: brandForeground }}
            aria-label="Send test message"
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </form>
      </div>
    </div>
  );
}
