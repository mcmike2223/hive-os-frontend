"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import { getBackendApiRoot } from "@/lib/runtime-context";

export function StatusTicker() {
  const { data } = useQuery({
    queryKey: ["systemStatusTicker"],
    queryFn: async () => {
      const res = await fetch(`${getBackendApiRoot()}/system/status-ticker`);
      if (!res.ok) throw new Error();
      return res.json();
    },
    refetchInterval: 10000, // Sync every 10 seconds
  });

  const message = data?.message || "Establishing uplink to system core...";

  return (
    <div className="w-full bg-destructive/10 border-b border-destructive/20 h-10 overflow-hidden whitespace-nowrap flex items-center relative group">
      {/* Fixed Label on the Left */}
      <div className="flex items-center gap-2 px-6 bg-background h-full z-20 border-r border-destructive/20 text-destructive font-mono text-[11px] font-black uppercase tracking-[0.2em] shadow-[10px_0_20px_rgba(0,0,0,0.5)]">
        <Activity className="h-3 w-3 animate-pulse" /> 
        System_Log:
      </div>
      
      {/* Marquee Wrapper */}
      <div className="flex items-center gap-20 animate-marquee z-10 pl-4">
        <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-[0.3em] font-bold flex gap-10 items-center">
          {message} <span className="text-destructive/50">//</span> {message} <span className="text-destructive/50">//</span> {message}
        </span>
        {/* Duplicate span for seamless looping */}
        <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-[0.3em] font-bold flex gap-10 items-center">
          {message} <span className="text-destructive/50">//</span> {message} <span className="text-destructive/50">//</span> {message}
        </span>
      </div>

      {/* Inline styles for the marquee animation */}
      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 40s linear infinite;
        }
      `}</style>
    </div>
  );
}
