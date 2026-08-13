"use client";

import React from "react";
import { GitPullRequest, CheckCircle2, XCircle, Loader2, GitMerge, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface GitStatusBadgeProps {
  prUrl?: string | null;
  prStatus?: string | null;
  buildStatus?: string | null;
}

export function GitStatusBadge({ prUrl, prStatus, buildStatus }: GitStatusBadgeProps) {
  if (!prUrl && !buildStatus) return null;

  return (
    <div className="flex items-center gap-2">
      {prUrl && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <a 
                href={prUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className={cn(
                  "flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-black uppercase transition-all hover:scale-105",
                  prStatus === 'merged' ? "bg-violet-500/10 text-violet-500 border border-violet-500/20" :
                  prStatus === 'closed' ? "bg-rose-500/10 text-rose-500 border border-rose-500/20" :
                  "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                )}
                onClick={(e) => e.stopPropagation()}
              >
                {prStatus === 'merged' ? <GitMerge className="h-3 w-3" /> : <GitPullRequest className="h-3 w-3" />}
                {prStatus || 'open'}
              </a>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs font-bold">Pull Request: {prStatus || 'open'}</p>
              <p className="text-[11px] opacity-70">Click to view on Repository</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {buildStatus && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cn(
                "flex items-center justify-center w-5 h-5 rounded-full border shadow-sm transition-all hover:scale-110",
                buildStatus === 'success' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" :
                buildStatus === 'failure' ? "bg-rose-500/10 border-rose-500/20 text-rose-500" :
                buildStatus === 'running' ? "bg-primary/10 border-primary/20 text-primary" :
                "bg-muted border-border text-muted-foreground"
              )}>
                {buildStatus === 'success' && <CheckCircle2 className="h-3 w-3" />}
                {buildStatus === 'failure' && <XCircle className="h-3 w-3" />}
                {buildStatus === 'running' && <Loader2 className="h-3 w-3 animate-spin" />}
                {buildStatus === 'pending' && <Clock className="h-3 w-3" />}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs font-bold uppercase tracking-widest">Build Status: {buildStatus}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
