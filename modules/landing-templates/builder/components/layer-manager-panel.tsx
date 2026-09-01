"use client";

import React, { useEffect, useRef } from "react";
import { Layers } from "lucide-react";

interface LayerManagerPanelProps {
  editor: any;
}

export const LayerManagerPanel: React.FC<LayerManagerPanelProps> = ({ editor }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editor || !containerRef.current) return;

    const renderedLayers = editor.LayerManager?.render?.();
    if (!renderedLayers) return;
    containerRef.current.replaceChildren(renderedLayers);

    return () => {
      if (containerRef.current?.contains(renderedLayers)) {
        containerRef.current.replaceChildren();
      }
    };
  }, [editor]);

  return (
    <div className="flex flex-col h-full bg-background select-none">
      <div className="p-3 border-b border-border/60 flex items-center justify-between">
        <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-primary" />
          <span>DOM Layers</span>
        </span>
      </div>

      <div ref={containerRef} id="gjs-layers-container" className="flex-1 overflow-y-auto p-2 text-xs" />
    </div>
  );
};
