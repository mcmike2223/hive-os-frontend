"use client";

import React from "react";
import { Sliders } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TraitManagerPanelProps {
  selectedComponent: any;
  onUpdateTrait: (traitName: string, value: string) => void;
}

export const TraitManagerPanel: React.FC<TraitManagerPanelProps> = ({
  selectedComponent,
  onUpdateTrait,
}) => {
  if (!selectedComponent) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
        <Sliders className="h-8 w-8 stroke-[1.5] text-muted-foreground/50 mb-2" />
        <p className="text-xs font-medium text-foreground">No Element Selected</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">Select a component to inspect its attributes.</p>
      </div>
    );
  }

  const attrs = selectedComponent.getAttributes?.() || {};

  return (
    <div className="flex h-full flex-col space-y-4 overflow-y-auto bg-background p-5">
      <div className="pb-3 border-b border-border/60">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Attributes & Traits</span>
        <h3 className="text-xs font-bold text-foreground">{selectedComponent.getName?.() || "Component"}</h3>
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="builder-element-id" className="text-xs text-muted-foreground">Element ID</Label>
          <Input
            id="builder-element-id"
            value={attrs.id || ""}
            onChange={(e) => onUpdateTrait("id", e.target.value)}
            className="h-11 text-xs font-mono"
            placeholder="custom-id"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="builder-css-classes" className="text-xs text-muted-foreground">CSS classes</Label>
          <Input
            id="builder-css-classes"
            value={attrs.class || ""}
            onChange={(e) => onUpdateTrait("class", e.target.value)}
            className="h-11 text-xs font-mono"
            placeholder="e.g. py-12 text-center"
          />
        </div>

        {selectedComponent.get?.("tagName") === "a" && (
          <div className="space-y-1">
            <Label htmlFor="builder-link-url" className="text-xs text-muted-foreground">Link URL</Label>
            <Input
              id="builder-link-url"
              value={attrs.href || ""}
              onChange={(e) => onUpdateTrait("href", e.target.value)}
              className="h-11 text-xs font-mono"
              placeholder="https:// or #section"
            />
          </div>
        )}

        {selectedComponent.get?.("tagName") === "img" && (
          <>
            <div className="space-y-1">
              <Label htmlFor="builder-image-source" className="text-xs text-muted-foreground">Image source</Label>
              <Input
                id="builder-image-source"
                value={attrs.src || ""}
                onChange={(e) => onUpdateTrait("src", e.target.value)}
                className="h-11 text-xs font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="builder-image-alt" className="text-xs text-muted-foreground">Alternative text</Label>
              <Input
                id="builder-image-alt"
                value={attrs.alt || ""}
                onChange={(e) => onUpdateTrait("alt", e.target.value)}
                className="h-11 text-xs"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};
