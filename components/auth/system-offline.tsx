"use client";

import React from "react";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusTicker } from "@/components/ui/status-ticker"; // 🚀 Import the Ticker

interface SystemOfflineProps {
  supportEmail: string;
  onLogout: () => void;
}

export function SystemOffline({ supportEmail, onLogout }: SystemOfflineProps) {
  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground relative overflow-hidden">
      
      {/* 🚀 THE LIVE TICKER (Attached to the very top) */}
      <div className="w-full absolute top-0 left-0 z-50">
        <StatusTicker />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 relative mt-10">
        {/* Background Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-destructive/5 blur-[150px] rounded-full pointer-events-none" />
        
        <div className="relative z-10 flex flex-col items-center text-center max-w-lg">
          <div className="relative mb-8 group">
            <div className="absolute inset-0 bg-destructive blur-3xl opacity-20 group-hover:opacity-40 transition-opacity duration-1000 animate-pulse" />
            <div className="relative bg-destructive/10 p-6 rounded-[2.5rem] border border-destructive/20 shadow-2xl">
              <ShieldAlert className="h-16 w-16 text-destructive animate-pulse" />
            </div>
          </div>
          
          <h1 className="text-6xl font-space font-black tracking-tighter mb-4 uppercase bg-gradient-to-b from-foreground to-foreground/50 bg-clip-text text-transparent">
            Cluster <span className="text-destructive">Locked</span>
          </h1>
          
          <p className="text-muted-foreground font-inter leading-relaxed mb-10 text-sm tracking-wide">
            Hive core is currently undergoing a scheduled synchronization protocol. Access is restricted to primary maintenance units.
          </p>

          <Button 
            variant="outline" 
            onClick={onLogout} 
            className="rounded-2xl px-12 h-14 border-border/50 bg-background/50 backdrop-blur-sm shadow-xl hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-all font-bold uppercase tracking-[0.2em] text-xs"
          >
            Sever Connection
          </Button>
          
          <p className="mt-8 text-[11px] text-muted-foreground/50 uppercase tracking-widest">
            Emergency Override: <a href={`mailto:${supportEmail}`} className="text-primary/70 hover:text-primary transition-colors">{supportEmail}</a>
          </p>
        </div>
      </div>

      {/* Footer System Telemetry */}
      <div className="absolute bottom-6 font-mono text-[11px] text-muted-foreground/30 uppercase tracking-[0.5em] select-none w-full text-center pointer-events-none">
        HIVE.OS // PROTOCOL_LOCKDOWN // EST_RESTORE: PENDING
      </div>
    </div>
  );
}