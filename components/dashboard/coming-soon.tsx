// components/dashboard/coming-soon.tsx
import React from "react";
import { Hammer, Sparkles, ArrowLeft, Cpu } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ComingSoonProps {
  title?: string;
  description?: string;
  moduleName?: string;
}

export function ComingSoon({ 
  title = "Module Offline", 
  description = "This node is currently under construction and will be deployed in a future system update.",
  moduleName = "System"
}: ComingSoonProps) {
  return (
    <div className="relative flex flex-col items-center justify-center min-h-[70vh] w-full rounded-[2rem] border border-border/40 bg-card/20 overflow-hidden">
      
      {/* 🔮 Background Glow Effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[200px] h-[200px] bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-[250px] h-[250px] bg-indigo-500/10 rounded-full blur-[90px] pointer-events-none" />

      {/* 🏗️ Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-4">
        <Badge variant="outline" className="mb-6 px-4 py-1.5 border-primary/30 bg-primary/10 text-primary font-mono text-[11px] uppercase tracking-[0.2em] flex items-center gap-2">
          <Sparkles className="h-3 w-3" />
          In Development
        </Badge>

        <div className="relative flex items-center justify-center w-20 h-20 mb-6 rounded-3xl bg-card/50 border border-border/50 shadow-xl backdrop-blur-xl">
          <Cpu className="h-10 w-10 text-muted-foreground animate-pulse" />
          <div className="absolute -bottom-2 -right-2 bg-primary text-primary-foreground p-1.5 rounded-xl border-2 border-background shadow-lg">
            <Hammer className="h-4 w-4" />
          </div>
        </div>

        <h1 className="text-3xl md:text-4xl font-black font-space tracking-tight text-foreground mb-3">
          {title}
        </h1>
        
        <p className="text-sm md:text-base text-muted-foreground max-w-md mx-auto mb-8 leading-relaxed">
          The <span className="font-semibold text-foreground">{moduleName}</span> matrix is currently being forged by our engineering team. {description}
        </p>

        <div className="flex items-center gap-4">
          <Button asChild variant="default" className="rounded-xl px-6 h-11 font-semibold shadow-lg shadow-primary/20">
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" /> Return to Command Hub
            </Link>
          </Button>
        </div>
      </div>
      
      {/* 🧑‍💻 Decorative code overlay */}
      <div className="absolute bottom-4 left-6 pointer-events-none opacity-20 hidden md:block">
        <pre className="text-[11px] font-mono text-primary leading-tight">
          <code>
            {`> _INIT_DEPLOYMENT_SEQ...`}
            <br />
            {`> STATUS: PENDING`}
            <br />
            {`> ALLOCATING_RESOURCES...`}
          </code>
        </pre>
      </div>
    </div>
  );
}