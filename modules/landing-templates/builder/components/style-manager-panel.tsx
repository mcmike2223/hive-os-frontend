"use client";

import React, { useEffect, useState } from "react";
import { SlidersHorizontal, Type, Box, Palette } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface StyleManagerPanelProps {
  selectedComponent: any;
  onUpdateStyle: (property: string, value: string) => void;
}

export const StyleManagerPanel: React.FC<StyleManagerPanelProps> = ({
  selectedComponent,
  onUpdateStyle,
}) => {
  const [fontSize, setFontSize] = useState("16px");
  const [color, setColor] = useState("#000000");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [padding, setPadding] = useState("16px");
  const [margin, setMargin] = useState("0px");
  const [borderRadius, setBorderRadius] = useState("8px");

  useEffect(() => {
    if (!selectedComponent) return;
    const styles = selectedComponent.getStyle?.() || {};
    setFontSize(String(styles["font-size"] || "16px"));
    setColor(String(styles.color || "#111827"));
    setBgColor(String(styles["background-color"] || "#ffffff"));
    setPadding(String(styles.padding || "16px"));
    setMargin(String(styles.margin || "0px"));
    setBorderRadius(String(styles["border-radius"] || "8px"));
  }, [selectedComponent]);

  if (!selectedComponent) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
        <SlidersHorizontal className="h-8 w-8 stroke-[1.5] text-muted-foreground/50 mb-2" />
        <p className="text-xs font-medium text-foreground">No Element Selected</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">Click any component on the visual canvas to edit its styles.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col space-y-6 overflow-y-auto bg-background p-5">
      <div className="pb-3 border-b border-border/60">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Selected Element</span>
        <h3 className="text-xs font-bold text-foreground capitalize">{selectedComponent.get?.("tagName") || "Component"}</h3>
      </div>

      {/* Typography */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Type className="h-3.5 w-3.5 text-primary" />
          <span>Typography</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="space-y-1">
            <Label htmlFor="builder-font-size" className="text-xs text-muted-foreground">Font size</Label>
            <Input
              id="builder-font-size"
              value={fontSize}
              onChange={(e) => {
                setFontSize(e.target.value);
                onUpdateStyle("font-size", e.target.value);
              }}
              className="h-11 text-xs font-mono"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="builder-text-color" className="text-xs text-muted-foreground">Text color</Label>
            <div className="flex items-center gap-1.5">
              <input
                id="builder-text-color"
                aria-label="Choose text color"
                type="color"
                value={color}
                onChange={(e) => {
                  setColor(e.target.value);
                  onUpdateStyle("color", e.target.value);
                }}
                className="h-11 w-11 cursor-pointer rounded-lg border border-slate-500"
              />
              <Input
                value={color}
                onChange={(e) => {
                  setColor(e.target.value);
                  onUpdateStyle("color", e.target.value);
                }}
                aria-label="Text color hex value"
                className="h-11 flex-1 text-xs font-mono"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Spacing & Box Model */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Box className="h-3.5 w-3.5 text-blue-500" />
          <span>Spacing & Box Model</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="space-y-1">
            <Label htmlFor="builder-padding" className="text-xs text-muted-foreground">Padding</Label>
            <Input
              id="builder-padding"
              value={padding}
              onChange={(e) => {
                setPadding(e.target.value);
                onUpdateStyle("padding", e.target.value);
              }}
              className="h-11 text-xs font-mono"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="builder-margin" className="text-xs text-muted-foreground">Margin</Label>
            <Input
              id="builder-margin"
              value={margin}
              onChange={(e) => {
                setMargin(e.target.value);
                onUpdateStyle("margin", e.target.value);
              }}
              className="h-11 text-xs font-mono"
            />
          </div>
        </div>
      </div>

      {/* Background & Borders */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Palette className="h-3.5 w-3.5 text-emerald-500" />
          <span>Background & Borders</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="space-y-1">
            <Label htmlFor="builder-background-color" className="text-xs text-muted-foreground">Background</Label>
            <div className="flex items-center gap-1.5">
              <input
                id="builder-background-color"
                aria-label="Choose background color"
                type="color"
                value={bgColor}
                onChange={(e) => {
                  setBgColor(e.target.value);
                  onUpdateStyle("background-color", e.target.value);
                }}
                className="h-11 w-11 cursor-pointer rounded-lg border border-slate-500"
              />
              <Input
                value={bgColor}
                onChange={(e) => {
                  setBgColor(e.target.value);
                  onUpdateStyle("background-color", e.target.value);
                }}
                aria-label="Background color hex value"
                className="h-11 flex-1 text-xs font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="builder-border-radius" className="text-xs text-muted-foreground">Corner radius</Label>
            <Input
              id="builder-border-radius"
              value={borderRadius}
              onChange={(e) => {
                setBorderRadius(e.target.value);
                onUpdateStyle("border-radius", e.target.value);
              }}
              className="h-11 text-xs font-mono"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
