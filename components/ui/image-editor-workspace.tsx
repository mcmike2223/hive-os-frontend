"use client";

import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Aperture,
  Crop,
  Download,
  Eye,
  FlipHorizontal,
  FlipVertical,
  Focus,
  Image as ImageIcon,
  Link as LinkIcon,
  Maximize,
  Minimize,
  Move,
  Pencil,
  Redo2,
  RotateCcw,
  RotateCw,
  Save,
  ScanLine,
  Scissors,
  Shield,
  Sparkles,
  Undo2,
  Unlink,
  Wand2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  type OpenCvOperation,
  processImageWithOpenCv,
  removePhotoBackground,
} from "@/lib/image-editor-api";
import { getAuthHeaders } from "@/lib/runtime-context";
import { cn } from "@/lib/utils";

export interface ImageEditorWorkspaceProps {
  src: string;
  fetchUrl?: string;
  alt?: string;
  className?: string;
  onSaveEdited?: (file: File) => void;
  onUpgradeRequested?: () => void;
  onEditingChange?: (editing: boolean) => void;
}

type EditTab = "geometry" | "tone" | "opencv" | "export";
type CropHandle = "move" | "n" | "e" | "s" | "w" | "ne" | "nw" | "se" | "sw";

interface CropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface HistoryEntry {
  url: string;
  operation: string;
}

interface OpenCvTool {
  operation: OpenCvOperation;
  label: string;
  description: string;
  icon: LucideIcon;
  transparency?: boolean;
}

const OPENCV_TOOLS: OpenCvTool[] = [
  {
    operation: "smart_cutout",
    label: "Smart cutout",
    description: "GrabCut isolates the main subject and creates a transparent PNG.",
    icon: Scissors,
    transparency: true,
  },
  {
    operation: "logo_cutout",
    label: "Logo cutout",
    description: "Removes a border-connected flat background while preserving artwork.",
    icon: ScanLine,
    transparency: true,
  },
  {
    operation: "background_blur",
    label: "Background blur",
    description: "Keeps the detected subject sharp and softens the scene behind it.",
    icon: Focus,
  },
  {
    operation: "auto_enhance",
    label: "Auto enhance",
    description: "CLAHE restores local contrast without flattening the image.",
    icon: Sparkles,
  },
  {
    operation: "denoise",
    label: "Denoise",
    description: "Reduces colour noise while retaining edges and fine detail.",
    icon: Shield,
  },
  {
    operation: "sharpen",
    label: "Sharpen",
    description: "Adds controlled edge clarity with an unsharp-mask pass.",
    icon: Aperture,
  },
  {
    operation: "edge_sketch",
    label: "Edge sketch",
    description: "Converts the image into a clean pencil-style contour study.",
    icon: Pencil,
  },
];

const checkerboardStyle: React.CSSProperties = {
  backgroundColor: "var(--muted)",
  backgroundImage:
    "linear-gradient(45deg, color-mix(in oklab, var(--foreground) 10%, transparent) 25%, transparent 25%), linear-gradient(-45deg, color-mix(in oklab, var(--foreground) 10%, transparent) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, color-mix(in oklab, var(--foreground) 10%, transparent) 75%), linear-gradient(-45deg, transparent 75%, color-mix(in oklab, var(--foreground) 10%, transparent) 75%)",
  backgroundPosition: "0 0, 0 12px, 12px -12px, -12px 0",
  backgroundSize: "24px 24px",
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

const trimTransparentBlob = async (blob: Blob): Promise<Blob> => {
  if (typeof createImageBitmap !== "function") return blob;

  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    bitmap.close();
    return blob;
  }

  context.drawImage(bitmap, 0, 0);
  const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
  let minX = bitmap.width;
  let minY = bitmap.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < bitmap.height; y += 1) {
    for (let x = 0; x < bitmap.width; x += 1) {
      if (pixels[(y * bitmap.width + x) * 4 + 3] > 12) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    bitmap.close();
    return blob;
  }

  const padding = 12;
  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(bitmap.width - 1, maxX + padding);
  maxY = Math.min(bitmap.height - 1, maxY + padding);
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const output = document.createElement("canvas");
  output.width = width;
  output.height = height;
  output.getContext("2d")?.drawImage(bitmap, minX, minY, width, height, 0, 0, width, height);
  bitmap.close();

  return await new Promise((resolve) => {
    output.toBlob((result) => resolve(result ?? blob), "image/png");
  });
};

export function ImageEditorWorkspace({
  src,
  fetchUrl,
  alt = "Image preview",
  className,
  onSaveEdited,
  onUpgradeRequested,
  onEditingChange,
}: ImageEditorWorkspaceProps) {
  const id = useId().replaceAll(":", "");
  const containerRef = useRef<HTMLElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const cropWrapperRef = useRef<HTMLDivElement>(null);
  const editTriggerRef = useRef<HTMLButtonElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const editingChangeRef = useRef(onEditingChange);
  const ownedUrlsRef = useRef(new Set<string>());
  const dragRef = useRef<{
    handle: CropHandle;
    pointerX: number;
    pointerY: number;
    initial: CropBox;
    scale: number;
  } | null>(null);

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingLabel, setProcessingLabel] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [activeTab, setActiveTab] = useState<EditTab>("geometry");

  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [cropBox, setCropBox] = useState<CropBox>({ x: 0, y: 0, width: 0, height: 0 });
  const [resize, setResize] = useState({ width: 0, height: 0 });
  const [maintainAspect, setMaintainAspect] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [flipHorizontal, setFlipHorizontal] = useState(false);
  const [flipVertical, setFlipVertical] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [hue, setHue] = useState(0);
  const [exportFormat, setExportFormat] = useState("image/png");
  const [exportQuality, setExportQuality] = useState(92);
  const [opencvTolerance, setOpenCvTolerance] = useState(32);
  const [opencvFeather, setOpenCvFeather] = useState(4);
  const [opencvStrength, setOpenCvStrength] = useState(50);
  const [cropRatio, setCropRatio] = useState("free");
  const [tonePreset, setTonePreset] = useState("neutral");

  const currentEntry = history[historyIndex];
  const displaySrc = showOriginal ? history[0]?.url : currentEntry?.url;
  const hasTransparency = currentEntry?.operation === "smart_cutout"
    || currentEntry?.operation === "logo_cutout"
    || currentEntry?.operation === "photo_ai";

  const createOwnedUrl = useCallback((blob: Blob) => {
    const url = URL.createObjectURL(blob);
    ownedUrlsRef.current.add(url);
    return url;
  }, []);

  useEffect(() => {
    editingChangeRef.current = onEditingChange;
  }, [onEditingChange]);

  useEffect(() => {
    const controller = new AbortController();
    ownedUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    ownedUrlsRef.current.clear();
    setIsLoading(true);
    setHistory([]);
    setHistoryIndex(0);

    const load = async () => {
      try {
        if (!fetchUrl) {
          setHistory([{ url: src, operation: "original" }]);
          return;
        }

        const response = await fetch(fetchUrl, {
          headers: getAuthHeaders(),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("The secure image could not be loaded.");
        const url = createOwnedUrl(await response.blob());
        setHistory([{ url, operation: "original" }]);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error(error);
        setHistory([{ url: src, operation: "original" }]);
        toast.error("Secure preview failed; the original image source is being used.");
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    void load();
    return () => controller.abort();
  }, [createOwnedUrl, fetchUrl, src]);

  useEffect(() => () => {
    abortRef.current?.abort();
    editingChangeRef.current?.(false);
    ownedUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    ownedUrlsRef.current.clear();
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const resetVisualAdjustments = useCallback(() => {
    setZoom(1);
    setRotation(0);
    setFlipHorizontal(false);
    setFlipVertical(false);
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setHue(0);
    setCropRatio("free");
    setTonePreset("neutral");
    if (naturalSize.width > 0 && naturalSize.height > 0) {
      setCropBox({ x: 0, y: 0, width: naturalSize.width, height: naturalSize.height });
      setResize({ width: naturalSize.width, height: naturalSize.height });
    }
  }, [naturalSize.height, naturalSize.width]);

  const resetAllEdits = useCallback(() => {
    setHistoryIndex(0);
    setShowOriginal(false);
    setExportFormat("image/png");
    setExportQuality(92);
    resetVisualAdjustments();
    toast.success("The editor returned to the original image.");
  }, [resetVisualAdjustments]);

  const handleImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const width = event.currentTarget.naturalWidth;
    const height = event.currentTarget.naturalHeight;
    setNaturalSize({ width, height });
    setCropBox({ x: 0, y: 0, width, height });
    setResize({ width, height });
  };

  const addHistoryEntry = useCallback((blob: Blob, operation: string) => {
    const url = createOwnedUrl(blob);
    setHistory((entries) => {
      const discarded = entries.slice(historyIndex + 1);
      discarded.forEach((entry) => {
        if (ownedUrlsRef.current.delete(entry.url)) URL.revokeObjectURL(entry.url);
      });
      return [...entries.slice(0, historyIndex + 1), { url, operation }];
    });
    setHistoryIndex((index) => index + 1);
    setShowOriginal(false);
  }, [createOwnedUrl, historyIndex]);

  const sourceBlob = useCallback(async () => {
    if (!currentEntry?.url) throw new Error("No image is ready for processing.");
    const protectedSource = currentEntry.url.includes("/api/v1/files/");
    const response = await fetch(currentEntry.url, protectedSource ? { headers: getAuthHeaders() } : undefined);
    if (!response.ok) throw new Error("The editor could not read the current image.");
    return response.blob();
  }, [currentEntry?.url]);

  const runOpenCv = useCallback(async (tool: OpenCvTool) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsProcessing(true);
    setProcessingLabel(`${tool.label} in progress`);

    try {
      const result = await processImageWithOpenCv(await sourceBlob(), tool.operation, {
        tolerance: opencvTolerance,
        feather: opencvFeather,
        strength: opencvStrength,
        signal: controller.signal,
      });
      const output = tool.transparency ? await trimTransparentBlob(result.blob) : result.blob;
      addHistoryEntry(output, tool.operation);
      if (tool.transparency) setExportFormat("image/png");
      toast.success(`${tool.label} applied with OpenCV.`);
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error(error);
      toast.error(error instanceof Error ? error.message : "OpenCV processing failed.");
    } finally {
      if (!controller.signal.aborted) {
        setIsProcessing(false);
        setProcessingLabel("");
      }
    }
  }, [
    addHistoryEntry,
    opencvFeather,
    opencvStrength,
    opencvTolerance,
    sourceBlob,
  ]);

  const runPhotoAi = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsProcessing(true);
    setProcessingLabel("Photo AI is isolating the subject");

    try {
      const result = await removePhotoBackground(await sourceBlob(), controller.signal);
      addHistoryEntry(await trimTransparentBlob(result.blob), "photo_ai");
      setExportFormat("image/png");
      toast.success("Photo AI created a transparent subject cutout.");
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Photo AI processing failed.");
    } finally {
      if (!controller.signal.aborted) {
        setIsProcessing(false);
        setProcessingLabel("");
      }
    }
  }, [addHistoryEntry, sourceBlob]);

  const applyCropRatio = (ratio: number | null, key: string) => {
    if (!naturalSize.width || !naturalSize.height) return;
    setCropRatio(key);
    if (ratio === null) {
      setCropBox({ x: 0, y: 0, width: naturalSize.width, height: naturalSize.height });
      setResize({ width: naturalSize.width, height: naturalSize.height });
      setMaintainAspect(false);
      return;
    }

    let width = naturalSize.width;
    let height = width / ratio;
    if (height > naturalSize.height) {
      height = naturalSize.height;
      width = height * ratio;
    }
    const x = (naturalSize.width - width) / 2;
    const y = (naturalSize.height - height) / 2;
    setCropBox({ x, y, width, height });
    setResize({ width: Math.round(width), height: Math.round(height) });
    setMaintainAspect(true);
  };

  const applyTonePreset = (preset: "neutral" | "mono" | "warm" | "vivid") => {
    const values = {
      neutral: [100, 100, 100, 0],
      mono: [100, 118, 0, 0],
      warm: [102, 108, 88, 12],
      vivid: [105, 128, 138, 0],
    }[preset];
    setBrightness(values[0]);
    setContrast(values[1]);
    setSaturation(values[2]);
    setHue(values[3]);
    setTonePreset(preset);
  };

  const handleResizeWidth = (value: number) => {
    const width = clamp(Number.isFinite(value) ? value : 10, 10, 12000);
    setResize((current) => ({
      width,
      height: maintainAspect && cropBox.width > 0
        ? Math.round(width * (cropBox.height / cropBox.width))
        : current.height,
    }));
  };

  const handleResizeHeight = (value: number) => {
    const height = clamp(Number.isFinite(value) ? value : 10, 10, 12000);
    setResize((current) => ({
      width: maintainAspect && cropBox.height > 0
        ? Math.round(height * (cropBox.width / cropBox.height))
        : current.width,
      height,
    }));
  };

  const openEditor = () => {
    if (onUpgradeRequested) {
      onUpgradeRequested();
      return;
    }
    setIsEditing(true);
    editingChangeRef.current?.(true);
    requestAnimationFrame(() => {
      containerRef.current?.querySelector<HTMLButtonElement>("[data-slot='tabs-trigger']")?.focus();
    });
  };

  const closeEditor = () => {
    abortRef.current?.abort();
    setIsProcessing(false);
    setProcessingLabel("");
    setIsEditing(false);
    editingChangeRef.current?.(false);
    setShowOriginal(false);
    requestAnimationFrame(() => editTriggerRef.current?.focus());
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (document.fullscreenElement === containerRef.current) await document.exitFullscreen();
      else await containerRef.current.requestFullscreen();
    } catch {
      toast.error("Fullscreen mode is not available in this browser.");
    }
  };

  const updateCrop = useCallback((handle: CropHandle, deltaX: number, deltaY: number, initial = cropBox) => {
    let { x, y, width, height } = initial;
    const minimumSize = Math.max(24, Math.min(naturalSize.width, naturalSize.height) * 0.03);

    if (handle === "move") {
      x += deltaX;
      y += deltaY;
    } else {
      if (handle.includes("w")) {
        x += deltaX;
        width -= deltaX;
      }
      if (handle.includes("e")) width += deltaX;
      if (handle.includes("n")) {
        y += deltaY;
        height -= deltaY;
      }
      if (handle.includes("s")) height += deltaY;
    }

    width = Math.max(minimumSize, width);
    height = Math.max(minimumSize, height);
    x = clamp(x, 0, Math.max(0, naturalSize.width - width));
    y = clamp(y, 0, Math.max(0, naturalSize.height - height));
    width = Math.min(width, naturalSize.width - x);
    height = Math.min(height, naturalSize.height - y);
    const next = { x, y, width, height };
    setCropBox(next);
    setResize({ width: Math.round(width), height: Math.round(height) });
  }, [cropBox, naturalSize.height, naturalSize.width]);

  const handleCropPointerDown = (event: React.PointerEvent<HTMLButtonElement>, handle: CropHandle) => {
    if (!cropWrapperRef.current || !naturalSize.width) return;
    event.preventDefault();
    event.stopPropagation();
    const bounds = cropWrapperRef.current.getBoundingClientRect();
    dragRef.current = {
      handle,
      pointerX: event.clientX,
      pointerY: event.clientY,
      initial: cropBox,
      scale: naturalSize.width / bounds.width,
    };
  };

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (!dragRef.current) return;
      updateCrop(
        dragRef.current.handle,
        (event.clientX - dragRef.current.pointerX) * dragRef.current.scale,
        (event.clientY - dragRef.current.pointerY) * dragRef.current.scale,
        dragRef.current.initial,
      );
    };
    const onPointerUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [updateCrop]);

  const handleCropKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, handle: CropHandle) => {
    const directions: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    const step = event.shiftKey ? 10 : 1;
    updateCrop(handle, direction[0] * step, direction[1] * step);
  };

  const cropHandles = useMemo<Array<{
    handle: CropHandle;
    label: string;
    className: string;
  }>>(() => [
    { handle: "nw", label: "Resize crop from top left", className: "-left-5 -top-5" },
    { handle: "n", label: "Resize crop from top", className: "left-1/2 -top-5 -translate-x-1/2" },
    { handle: "ne", label: "Resize crop from top right", className: "-right-5 -top-5" },
    { handle: "e", label: "Resize crop from right", className: "-right-5 top-1/2 -translate-y-1/2" },
    { handle: "se", label: "Resize crop from bottom right", className: "-bottom-5 -right-5" },
    { handle: "s", label: "Resize crop from bottom", className: "-bottom-5 left-1/2 -translate-x-1/2" },
    { handle: "sw", label: "Resize crop from bottom left", className: "-bottom-5 -left-5" },
    { handle: "w", label: "Resize crop from left", className: "-left-5 top-1/2 -translate-y-1/2" },
  ], []);

  const exportEditedImage = useCallback(() => {
    const image = imageRef.current;
    if (!image || cropBox.width <= 0 || cropBox.height <= 0) return;
    setIsProcessing(true);
    setProcessingLabel("Rendering the edited image");

    try {
      const outputWidth = clamp(Math.round(resize.width || cropBox.width), 10, 12000);
      const outputHeight = clamp(Math.round(resize.height || cropBox.height), 10, 12000);
      const rotated = Math.abs(rotation % 180) === 90;
      const canvas = document.createElement("canvas");
      canvas.width = rotated ? outputHeight : outputWidth;
      canvas.height = rotated ? outputWidth : outputHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("The browser could not create an export canvas.");

      context.translate(canvas.width / 2, canvas.height / 2);
      context.rotate((rotation * Math.PI) / 180);
      context.scale(flipHorizontal ? -1 : 1, flipVertical ? -1 : 1);
      if (exportFormat === "image/jpeg") {
        context.fillStyle = "#ffffff";
        context.fillRect(-outputWidth / 2, -outputHeight / 2, outputWidth, outputHeight);
      }
      context.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) hue-rotate(${hue}deg)`;
      context.drawImage(
        image,
        cropBox.x,
        cropBox.y,
        cropBox.width,
        cropBox.height,
        -outputWidth / 2,
        -outputHeight / 2,
        outputWidth,
        outputHeight,
      );

      const extension = exportFormat === "image/jpeg" ? "jpg" : exportFormat === "image/webp" ? "webp" : "png";
      canvas.toBlob((blob) => {
        if (!blob) {
          toast.error("The edited image could not be encoded.");
          setIsProcessing(false);
          setProcessingLabel("");
          return;
        }

        const file = new File([blob], `edited-${Date.now()}.${extension}`, { type: exportFormat });
        if (onSaveEdited) {
          onSaveEdited(file);
          toast.success("The edited image was prepared as a new file.");
        } else {
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = file.name;
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(url);
          toast.success("The edited image was downloaded.");
        }
        setIsProcessing(false);
        setProcessingLabel("");
      }, exportFormat, exportQuality / 100);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "The image export failed.");
      setIsProcessing(false);
      setProcessingLabel("");
    }
  }, [
    brightness,
    contrast,
    cropBox,
    exportFormat,
    exportQuality,
    flipHorizontal,
    flipVertical,
    hue,
    onSaveEdited,
    resize.height,
    resize.width,
    rotation,
    saturation,
  ]);

  const handleWorkspaceKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (!isEditing) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeEditor();
    } else if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && !isProcessing) {
      event.preventDefault();
      exportEditedImage();
    }
  };

  const renderControlSlider = (
    suffix: string,
    label: string,
    description: string,
    value: number,
    onChange: (value: number) => void,
    minimum: number,
    maximum: number,
    unit = "%",
  ) => {
    const controlId = `${id}-${suffix}`;
    return (
      <Field>
        <div className="flex items-center justify-between gap-3">
          <FieldLabel id={`${controlId}-label`} htmlFor={controlId}>{label}</FieldLabel>
          <output htmlFor={controlId} className="font-mono text-xs font-semibold text-foreground">
            {value}{unit}
          </output>
        </div>
        <Slider
          id={controlId}
          aria-labelledby={`${controlId}-label`}
          aria-describedby={`${controlId}-description`}
          min={minimum}
          max={maximum}
          value={[value]}
          onValueChange={(values) => onChange(values[0] ?? value)}
          className="min-h-11 [&_[data-slot=slider-thumb]]:size-6"
        />
        <FieldDescription id={`${controlId}-description`}>{description}</FieldDescription>
      </Field>
    );
  };

  return (
    <section
      ref={containerRef}
      aria-labelledby={`${id}-title`}
      onKeyDown={handleWorkspaceKeyDown}
      className={cn(
        "flex h-full min-h-[560px] w-full flex-col overflow-hidden rounded-2xl border border-muted-foreground bg-card text-card-foreground shadow-xl",
        "[&_button[data-variant=default]]:bg-foreground [&_button[data-variant=default]]:text-background [&_button[data-variant=default]:hover]:bg-foreground/90",
        "[&_button[data-variant=outline]]:border-muted-foreground [&_button[data-variant=outline]:hover]:bg-secondary [&_button[data-variant=outline]:hover]:text-secondary-foreground",
        "[&_button[data-variant=ghost]:hover]:bg-secondary [&_button[data-variant=ghost]:hover]:text-secondary-foreground",
        "[&_button[data-slot=toggle-group-item]]:border-muted-foreground [&_button[data-slot=toggle-group-item]:hover]:bg-secondary [&_button[data-slot=toggle-group-item]:hover]:text-secondary-foreground",
        "[&_[data-slot=input]]:border-muted-foreground [&_[data-slot=select-trigger]]:border-muted-foreground [&_[data-slot=separator]]:bg-muted-foreground",
        "[&_button:focus-visible]:border-foreground [&_button:focus-visible]:ring-foreground [&_[data-slot=input]:focus-visible]:border-foreground [&_[data-slot=input]:focus-visible]:ring-foreground",
        "[&_[data-slot=select-trigger]:focus-visible]:border-foreground [&_[data-slot=select-trigger]:focus-visible]:ring-foreground [&_[data-slot=slider-thumb]]:border-foreground [&_[data-slot=slider-thumb]:focus-visible]:ring-foreground",
        isEditing && "lg:min-h-[680px]",
        isFullscreen && "fixed inset-0 min-h-screen rounded-none border-0",
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-muted-foreground bg-card/95 px-4 py-3 backdrop-blur md:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-muted-foreground bg-primary/10 text-foreground">
            <ImageIcon aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id={`${id}-title`} className="truncate text-base font-bold tracking-tight md:text-lg">
                {alt}
              </h2>
              {isEditing ? <Badge variant="secondary">Editing</Badge> : null}
              {hasTransparency ? <Badge variant="outline">Transparent PNG</Badge> : null}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {naturalSize.width > 0
                ? `${naturalSize.width} × ${naturalSize.height}px · ${history.length} revision${history.length === 1 ? "" : "s"}`
                : "Secure image preview"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {isEditing ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11"
                aria-label="Undo OpenCV operation"
                title="Undo OpenCV operation"
                disabled={historyIndex <= 0 || isProcessing}
                onClick={() => {
                  setHistoryIndex((index) => Math.max(0, index - 1));
                  setShowOriginal(false);
                }}
              >
                <Undo2 data-icon="inline-start" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11"
                aria-label="Redo OpenCV operation"
                title="Redo OpenCV operation"
                disabled={historyIndex >= history.length - 1 || isProcessing}
                onClick={() => {
                  setHistoryIndex((index) => Math.min(history.length - 1, index + 1));
                  setShowOriginal(false);
                }}
              >
                <Redo2 data-icon="inline-start" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                aria-pressed={showOriginal}
                disabled={history.length <= 1 || isProcessing}
                onClick={() => setShowOriginal((visible) => !visible)}
              >
                <Eye data-icon="inline-start" aria-hidden="true" />
                Compare
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11"
                aria-label="Reset all image edits"
                title="Reset all image edits"
                disabled={isProcessing}
                onClick={resetAllEdits}
              >
                <RotateCcw data-icon="inline-start" aria-hidden="true" />
              </Button>
              <Button type="button" variant="ghost" className="min-h-11" disabled={isProcessing} onClick={closeEditor}>
                <X data-icon="inline-start" aria-hidden="true" />
                Cancel
              </Button>
              <Button type="button" className="min-h-11" disabled={isProcessing} onClick={exportEditedImage}>
                {isProcessing ? <Spinner data-icon="inline-start" role={undefined} aria-hidden="true" /> : <Save data-icon="inline-start" aria-hidden="true" />}
                Save as new
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11"
                aria-label="Zoom image out"
                title="Zoom image out"
                onClick={() => setZoom((value) => clamp(value - 0.2, 0.4, 3))}
              >
                <ZoomOut data-icon="inline-start" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11"
                aria-label="Zoom image in"
                title="Zoom image in"
                onClick={() => setZoom((value) => clamp(value + 0.2, 0.4, 3))}
              >
                <ZoomIn data-icon="inline-start" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11"
                aria-label={isFullscreen ? "Exit fullscreen image preview" : "Open fullscreen image preview"}
                title={isFullscreen ? "Exit fullscreen" : "Open fullscreen"}
                onClick={() => void toggleFullscreen()}
              >
                {isFullscreen
                  ? <Minimize data-icon="inline-start" aria-hidden="true" />
                  : <Maximize data-icon="inline-start" aria-hidden="true" />}
              </Button>
              <Button ref={editTriggerRef} type="button" className="min-h-11" onClick={openEditor}>
                <Wand2 data-icon="inline-start" aria-hidden="true" />
                {onUpgradeRequested ? "Unlock editor" : "Edit image"}
              </Button>
            </>
          )}
        </div>
      </header>

      <div className={cn("grid min-h-0 flex-1", isEditing && "lg:grid-cols-[minmax(0,1fr)_380px]")}>
        <div className="relative flex min-h-[420px] items-center justify-center overflow-hidden bg-muted/30 p-5 lg:min-h-0">
          <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-2">
            <Badge variant="secondary">{Math.round(zoom * 100)}% zoom</Badge>
            {showOriginal ? <Badge variant="secondary">Original preview</Badge> : null}
            {currentEntry?.operation && currentEntry.operation !== "original"
              ? <Badge variant="outline">{currentEntry.operation.replaceAll("_", " ")}</Badge>
              : null}
          </div>

          {isLoading ? (
            <div role="status" className="flex flex-col items-center gap-3 rounded-2xl border bg-card/95 p-6 shadow-lg">
              <Spinner className="size-6" role={undefined} aria-hidden="true" />
              <p className="text-sm font-medium">Fetching the secure image preview…</p>
            </div>
          ) : null}

          {isProcessing ? (
            <div role="status" className="absolute inset-0 z-30 flex items-center justify-center bg-background/75 p-6 backdrop-blur-sm">
              <div className="flex max-w-sm flex-col items-center gap-3 rounded-2xl border bg-card p-6 text-center shadow-xl">
                <Spinner className="size-7" role={undefined} aria-hidden="true" />
                <p className="font-semibold">{processingLabel}</p>
                <p className="text-sm text-muted-foreground">The original stays untouched while a new revision is prepared.</p>
              </div>
            </div>
          ) : null}

          {currentEntry?.url ? (
            <img
              ref={imageRef}
              src={currentEntry.url}
              alt=""
              aria-hidden="true"
              crossOrigin="anonymous"
              onLoad={handleImageLoad}
              className="hidden"
            />
          ) : null}

          {displaySrc ? (
            <div
              className="flex max-h-full max-w-full items-center justify-center rounded-xl border border-muted-foreground p-3 shadow-2xl"
              style={checkerboardStyle}
            >
              <div
                className="flex origin-center items-center justify-center transition-transform duration-200"
                style={{ transform: `scale(${zoom}) rotate(${showOriginal ? 0 : rotation}deg)` }}
              >
                <div
                  ref={cropWrapperRef}
                  className="relative flex max-h-[62vh] max-w-full items-center justify-center"
                  style={{ aspectRatio: naturalSize.width && naturalSize.height ? `${naturalSize.width}/${naturalSize.height}` : "auto" }}
                >
                  <img
                    src={displaySrc}
                    alt={alt}
                    crossOrigin="anonymous"
                    className="block max-h-[62vh] max-w-full rounded-lg object-contain"
                    style={showOriginal ? undefined : {
                      filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) hue-rotate(${hue}deg)`,
                      transform: `scaleX(${flipHorizontal ? -1 : 1}) scaleY(${flipVertical ? -1 : 1})`,
                    }}
                  />

                  {isEditing && activeTab === "geometry" && !showOriginal && naturalSize.width > 0 ? (
                    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg">
                      <div
                        className="pointer-events-none absolute border-2 border-foreground shadow-[0_0_0_9999px_rgba(0,0,0,0.62)]"
                        style={{
                          left: `${(cropBox.x / naturalSize.width) * 100}%`,
                          top: `${(cropBox.y / naturalSize.height) * 100}%`,
                          width: `${(cropBox.width / naturalSize.width) * 100}%`,
                          height: `${(cropBox.height / naturalSize.height) * 100}%`,
                        }}
                      >
                        <button
                          type="button"
                          aria-label="Move crop selection"
                          title="Move crop selection with pointer or arrow keys"
                          className="pointer-events-auto absolute left-1/2 top-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 cursor-move items-center justify-center rounded-full border border-foreground bg-background/95 text-foreground shadow-lg outline-none focus-visible:ring-4 focus-visible:ring-foreground"
                          onPointerDown={(event) => handleCropPointerDown(event, "move")}
                          onKeyDown={(event) => handleCropKeyDown(event, "move")}
                        >
                          <Move aria-hidden="true" />
                        </button>
                        {cropHandles.map((item) => (
                          <button
                            key={item.handle}
                            type="button"
                            aria-label={item.label}
                            title={`${item.label} with pointer or arrow keys`}
                            className={cn(
                              "pointer-events-auto absolute flex size-11 cursor-move items-center justify-center rounded-full outline-none focus-visible:ring-4 focus-visible:ring-foreground",
                              item.className,
                            )}
                            onPointerDown={(event) => handleCropPointerDown(event, item.handle)}
                            onKeyDown={(event) => handleCropKeyDown(event, item.handle)}
                          >
                            <span className="size-3 rounded-full border border-background bg-foreground shadow" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border bg-card/95 p-1 shadow-lg backdrop-blur">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 rounded-full"
              aria-label="Zoom preview out"
              title="Zoom preview out"
              onClick={() => setZoom((value) => clamp(value - 0.15, 0.4, 3))}
            >
              <ZoomOut data-icon="inline-start" aria-hidden="true" />
            </Button>
            <Button type="button" variant="ghost" className="min-h-11 rounded-full px-4 font-mono text-xs" onClick={() => setZoom(1)}>
              Fit 100%
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 rounded-full"
              aria-label="Zoom preview in"
              title="Zoom preview in"
              onClick={() => setZoom((value) => clamp(value + 0.15, 0.4, 3))}
            >
              <ZoomIn data-icon="inline-start" aria-hidden="true" />
            </Button>
          </div>
        </div>

        {isEditing ? (
          <Card className="min-h-0 rounded-none border-0 border-l border-muted-foreground py-0 shadow-none">
            <CardHeader className="border-b border-muted-foreground px-5 py-4">
              <CardTitle><h3 className="text-base">Image lab</h3></CardTitle>
              <CardDescription>Non-destructive controls with server-side OpenCV processing.</CardDescription>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-hidden px-0">
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as EditTab)} className="h-full gap-0">
                <TabsList variant="line" aria-label="Image editing tools" className="grid h-auto w-full grid-cols-4 gap-0 border-b px-2 py-1">
                  <TabsTrigger value="geometry" className="min-h-11 px-1 text-xs"><Crop aria-hidden="true" />Frame</TabsTrigger>
                  <TabsTrigger value="tone" className="min-h-11 px-1 text-xs"><Aperture aria-hidden="true" />Tone</TabsTrigger>
                  <TabsTrigger value="opencv" className="min-h-11 px-1 text-xs"><ScanLine aria-hidden="true" />OpenCV</TabsTrigger>
                  <TabsTrigger value="export" className="min-h-11 px-1 text-xs"><Download aria-hidden="true" />Export</TabsTrigger>
                </TabsList>

                <div className="h-[calc(100%_-_53px)] overflow-y-auto p-5">
                  <TabsContent value="geometry" className="m-0 flex flex-col gap-6">
                    <FieldSet>
                      <FieldLegend>Transform</FieldLegend>
                      <div className="grid grid-cols-2 gap-2">
                        <Button type="button" variant="outline" className="min-h-11" onClick={() => setRotation((value) => value - 90)}>
                          <RotateCcw data-icon="inline-start" aria-hidden="true" />Rotate left
                        </Button>
                        <Button type="button" variant="outline" className="min-h-11" onClick={() => setRotation((value) => value + 90)}>
                          <RotateCw data-icon="inline-start" aria-hidden="true" />Rotate right
                        </Button>
                        <Button type="button" variant="outline" className="min-h-11" aria-pressed={flipHorizontal} onClick={() => setFlipHorizontal((value) => !value)}>
                          <FlipHorizontal data-icon="inline-start" aria-hidden="true" />Flip horizontal
                        </Button>
                        <Button type="button" variant="outline" className="min-h-11" aria-pressed={flipVertical} onClick={() => setFlipVertical((value) => !value)}>
                          <FlipVertical data-icon="inline-start" aria-hidden="true" />Flip vertical
                        </Button>
                      </div>
                    </FieldSet>
                    <Separator />
                    <FieldSet>
                      <FieldLegend>Crop ratio</FieldLegend>
                      <ToggleGroup
                        type="single"
                        value={cropRatio}
                        onValueChange={(value) => {
                          if (!value) return;
                          const ratios: Record<string, number | null> = { free: null, square: 1, landscape: 16 / 9, classic: 4 / 3 };
                          applyCropRatio(ratios[value] ?? null, value);
                        }}
                        variant="outline"
                        className="grid w-full grid-cols-4"
                      >
                        <ToggleGroupItem value="free" className="min-h-11">Free</ToggleGroupItem>
                        <ToggleGroupItem value="square" className="min-h-11">1:1</ToggleGroupItem>
                        <ToggleGroupItem value="landscape" className="min-h-11">16:9</ToggleGroupItem>
                        <ToggleGroupItem value="classic" className="min-h-11">4:3</ToggleGroupItem>
                      </ToggleGroup>
                      <FieldDescription>Drag the crop controls, or focus a handle and use the arrow keys. Hold Shift for larger steps.</FieldDescription>
                    </FieldSet>
                    <FieldGroup className="grid grid-cols-2 gap-3">
                      <Field>
                        <FieldLabel htmlFor={`${id}-crop-width`}>Crop width</FieldLabel>
                        <Input id={`${id}-crop-width`} type="number" min={10} max={naturalSize.width} value={Math.round(cropBox.width)} onChange={(event) => updateCrop("e", Number(event.target.value) - cropBox.width, 0)} />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor={`${id}-crop-height`}>Crop height</FieldLabel>
                        <Input id={`${id}-crop-height`} type="number" min={10} max={naturalSize.height} value={Math.round(cropBox.height)} onChange={(event) => updateCrop("s", 0, Number(event.target.value) - cropBox.height)} />
                      </Field>
                    </FieldGroup>
                  </TabsContent>

                  <TabsContent value="tone" className="m-0 flex flex-col gap-6">
                    <FieldSet>
                      <FieldLegend>Preset</FieldLegend>
                      <ToggleGroup type="single" value={tonePreset} onValueChange={(value) => value && applyTonePreset(value as "neutral" | "mono" | "warm" | "vivid")} variant="outline" className="grid w-full grid-cols-2">
                        <ToggleGroupItem value="neutral" className="min-h-11">Neutral</ToggleGroupItem>
                        <ToggleGroupItem value="mono" className="min-h-11">Mono</ToggleGroupItem>
                        <ToggleGroupItem value="warm" className="min-h-11">Warm</ToggleGroupItem>
                        <ToggleGroupItem value="vivid" className="min-h-11">Vivid</ToggleGroupItem>
                      </ToggleGroup>
                    </FieldSet>
                    <Separator />
                    <FieldGroup>
                      {renderControlSlider("brightness", "Brightness", "Adjust overall light intensity.", brightness, setBrightness, 0, 200)}
                      {renderControlSlider("contrast", "Contrast", "Increase or soften tonal separation.", contrast, setContrast, 0, 200)}
                      {renderControlSlider("saturation", "Saturation", "Control colour intensity.", saturation, setSaturation, 0, 200)}
                      {renderControlSlider("hue", "Hue", "Rotate the colour spectrum.", hue, setHue, 0, 360, "°")}
                    </FieldGroup>
                  </TabsContent>

                  <TabsContent value="opencv" className="m-0 flex flex-col gap-5">
                    <Alert role="note">
                      <Wand2 aria-hidden="true" />
                      <AlertTitle>Photo AI remains available</AlertTitle>
                      <AlertDescription>
                        Use rembg for people and complex products; use OpenCV for deterministic cutouts, cleanup, focus and enhancement.
                        <Button type="button" variant="outline" className="mt-3 min-h-11 w-full" disabled={isProcessing} onClick={() => void runPhotoAi()}>
                          <Wand2 data-icon="inline-start" aria-hidden="true" />Photo AI cutout
                        </Button>
                      </AlertDescription>
                    </Alert>
                    <FieldGroup>
                      {renderControlSlider("opencv-tolerance", "Colour tolerance", "Higher values remove a wider logo background colour range.", opencvTolerance, setOpenCvTolerance, 4, 150, "")}
                      {renderControlSlider("opencv-feather", "Edge feather", "Smooth transparent and subject-mask edges.", opencvFeather, setOpenCvFeather, 0, 25, "px")}
                      {renderControlSlider("opencv-strength", "Effect strength", "Controls blur, enhancement, denoise, sharpen and sketch intensity.", opencvStrength, setOpenCvStrength, 1, 100)}
                    </FieldGroup>
                    <Separator />
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {OPENCV_TOOLS.map((tool) => {
                        const Icon = tool.icon;
                        return (
                          <Button
                            key={tool.operation}
                            type="button"
                            variant="outline"
                            disabled={isProcessing}
                            className="h-auto min-h-24 justify-start whitespace-normal p-3 text-left"
                            onClick={() => void runOpenCv(tool)}
                          >
                            <Icon data-icon="inline-start" aria-hidden="true" />
                            <span className="flex min-w-0 flex-col gap-1">
                              <span className="font-semibold">{tool.label}</span>
                              <span className="text-xs font-normal leading-relaxed text-muted-foreground">{tool.description}</span>
                            </span>
                          </Button>
                        );
                      })}
                    </div>
                  </TabsContent>

                  <TabsContent value="export" className="m-0 flex flex-col gap-6">
                    <FieldGroup>
                      <Field>
                        <FieldLabel htmlFor={`${id}-format`}>Export format</FieldLabel>
                        <Select value={exportFormat} onValueChange={setExportFormat}>
                          <SelectTrigger id={`${id}-format`} className="min-h-11 w-full" aria-describedby={`${id}-format-description`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value="image/png" className="focus:bg-secondary focus:text-secondary-foreground">PNG — transparency and lossless quality</SelectItem>
                              <SelectItem value="image/webp" className="focus:bg-secondary focus:text-secondary-foreground">WebP — compact web delivery</SelectItem>
                              <SelectItem value="image/jpeg" className="focus:bg-secondary focus:text-secondary-foreground">JPEG — smallest photographic files</SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                        <FieldDescription id={`${id}-format-description`}>JPEG fills transparent pixels with white.</FieldDescription>
                      </Field>
                      {renderControlSlider("quality", "Export quality", exportFormat === "image/png" ? "PNG is lossless; this setting is ignored." : "Higher quality creates a larger file.", exportQuality, setExportQuality, 10, 100)}
                    </FieldGroup>
                    <Separator />
                    <FieldGroup className="grid grid-cols-2 gap-3">
                      <Field>
                        <FieldLabel htmlFor={`${id}-width`}>Output width</FieldLabel>
                        <Input id={`${id}-width`} type="number" min={10} max={12000} value={resize.width} onChange={(event) => handleResizeWidth(Number(event.target.value))} aria-describedby={`${id}-dimensions-description`} />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor={`${id}-height`}>Output height</FieldLabel>
                        <Input id={`${id}-height`} type="number" min={10} max={12000} value={resize.height} onChange={(event) => handleResizeHeight(Number(event.target.value))} aria-describedby={`${id}-dimensions-description`} />
                      </Field>
                    </FieldGroup>
                    <p id={`${id}-dimensions-description`} className="text-sm text-muted-foreground">Output dimensions are limited to 12,000 pixels per side.</p>
                    <Button type="button" variant="outline" className="min-h-11" aria-pressed={maintainAspect} onClick={() => setMaintainAspect((value) => !value)}>
                      {maintainAspect
                        ? <LinkIcon data-icon="inline-start" aria-hidden="true" />
                        : <Unlink data-icon="inline-start" aria-hidden="true" />}
                      Maintain aspect ratio
                    </Button>
                  </TabsContent>
                </div>
              </Tabs>
            </CardContent>
            <CardFooter className="min-h-14 justify-between gap-3 border-t border-muted-foreground px-5 py-3">
              <p className="text-xs text-muted-foreground">Esc cancels · Ctrl/⌘ + Enter saves</p>
              <Badge variant="outline">{resize.width} × {resize.height}px</Badge>
            </CardFooter>
          </Card>
        ) : null}
      </div>
    </section>
  );
}
