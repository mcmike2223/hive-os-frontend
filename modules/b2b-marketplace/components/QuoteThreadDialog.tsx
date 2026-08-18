"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { B2BDash, type B2BQuote } from "@/modules/b2b-marketplace/api";

export function QuoteThreadDialog({ quote, onClose }: { quote: B2BQuote | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");

  const messagesQ = useQuery({
    queryKey: ["b2b", "quoteMessages", quote?.id],
    queryFn: () => B2BDash.messages(quote!.id),
    enabled: !!quote,
  });

  const send = useMutation({
    mutationFn: () => B2BDash.sendMessage(quote!.id, text),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["b2b", "quoteMessages", quote?.id] });
    },
  });

  const messages = messagesQ.data ?? [];

  return (
    <Dialog open={!!quote} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Negotiation · {quote?.seller}</DialogTitle>
          <DialogDescription className="truncate">{quote?.inquiry_title}</DialogDescription>
        </DialogHeader>

        <div className="max-h-72 space-y-2 overflow-y-auto py-2">
          {messagesQ.isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : messages.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No messages yet. Start the conversation.</p>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={cn("flex", m.is_me ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[80%] rounded-2xl px-3 py-2 text-sm", m.is_me ? "bg-primary text-primary-foreground" : "bg-muted")}>
                  {!m.is_me && <p className="text-[11px] font-bold opacity-70">{m.sender}</p>}
                  <p>{m.message}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); if (text.trim()) send.mutate(); }}
          className="flex gap-2"
        >
          <Input placeholder="Type a message…" value={text} onChange={(e) => setText(e.target.value)} />
          <Button type="submit" size="icon" disabled={send.isPending || !text.trim()} className="shrink-0">
            {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
