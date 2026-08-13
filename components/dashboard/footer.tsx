// components/dashboard/footer.tsx
"use client";

import React from "react";

export function DashboardFooter() {
  return (
    <footer className="w-full flex items-center justify-between px-4 py-2 text-[11px] font-mono text-muted-foreground uppercase tracking-widest border-t border-border/40 bg-background/30 rounded-2xl backdrop-blur-md">
      <div>&copy; {new Date().getFullYear()} Techive Technology Solutions</div>
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          SYSTEM_OPTIMAL
        </span>
        <span className="hidden sm:inline-block">v3.1.0-RC4</span>
      </div>
    </footer>
  );
}