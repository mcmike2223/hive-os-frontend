"use client";

import React, { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "./button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import { Eraser } from "lucide-react";

interface SignaturePadProps {
  /** Controlled open state */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (base64Image: string) => void;
  onClose?: () => void;
}

/**
 * Manually trim canvas to avoid `trim-canvas` dependency issues in webpack
 * (Throws: trim_canvas__WEBPACK_IMPORTED_MODULE_8__ is not a function)
 */
function manuallyTrimCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement | null {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  const width = canvas.width;
  const height = canvas.height;
  const pixels = ctx.getImageData(0, 0, width, height).data;

  let top = height;
  let left = width;
  let right = 0;
  let bottom = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = pixels[(y * width + x) * 4 + 3];
      if (alpha > 0) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }

  if (top > bottom || left > right) return null;

  const trimmedWidth = right - left + 1;
  const trimmedHeight = bottom - top + 1;
  const trimmedCanvas = document.createElement("canvas");
  trimmedCanvas.width = trimmedWidth;
  trimmedCanvas.height = trimmedHeight;
  const trimmedCtx = trimmedCanvas.getContext("2d");

  if (trimmedCtx) {
    trimmedCtx.drawImage(
      canvas,
      left, top, trimmedWidth, trimmedHeight,
      0, 0, trimmedWidth, trimmedHeight
    );
  }

  return trimmedCanvas;
}

export function SignaturePad({ open, onOpenChange, onSave, onClose }: SignaturePadProps) {
  const padRef = useRef<SignatureCanvas>(null);
  const [penColor] = useState("#000000");

  // Clear the canvas every time the dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => padRef.current?.clear(), 50);
    }
  }, [open]);

  const handleClear = () => {
    padRef.current?.clear();
  };

  const handleSave = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (padRef.current?.isEmpty()) return;

    const rawCanvas = padRef.current?.getCanvas();
    if (!rawCanvas) return;

    const trimmed = manuallyTrimCanvas(rawCanvas);
    if (!trimmed) return;

    const PADDING = 20;
    const canvas = document.createElement("canvas");
    canvas.width = trimmed.width + PADDING * 2;
    canvas.height = trimmed.height + PADDING * 2;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(trimmed, PADDING, PADDING);
    }

    const dataUrl = canvas.toDataURL("image/png");
    onSave(dataUrl);
  };

  return (
    <>
      {createPortal(
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Draw Signature</DialogTitle>
              <DialogDescription>
                Use your mouse or touch screen to draw your signature below.
              </DialogDescription>
            </DialogHeader>

            {/* Canvas area — forced to look like paper */}
            <div className="border rounded-md bg-white relative cursor-crosshair overflow-hidden touch-none shadow-inner">
              {/* Grid guide */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage:
                    "linear-gradient(to bottom, transparent calc(100% - 1px), hsl(var(--border)) 100%)",
                  backgroundSize: "100% 48px",
                  backgroundPosition: "0 32px",
                }}
              />
              <SignatureCanvas
                ref={padRef}
                penColor={penColor}
                canvasProps={{
                  className: "w-full h-[200px] signature-canvas",
                }}
                backgroundColor="transparent"
              />
            </div>

            <p className="text-[11px] text-muted-foreground text-center -mt-1">
              Tip: Your signature will be saved with a white background for better visibility.
            </p>

            <DialogFooter className="flex items-center justify-between mt-2">
              <Button variant="destructive" size="sm" onClick={handleClear} type="button">
                <Eraser className="h-4 w-4 mr-2" />
                Clear
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} type="button">
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} type="button">
                  Insert Signature
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>,
        document.body
      )}
    </>
  );
}
