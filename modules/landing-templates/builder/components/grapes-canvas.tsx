"use client";

import React, { useEffect, useRef, useState, useId } from "react";
import type { Editor } from "grapesjs";
import "grapesjs/dist/css/grapes.min.css";
import { ViewportMode } from "./builder-topbar";

interface GrapesCanvasProps {
  initialProjectData?: Record<string, unknown> | null;
  initialHtml?: string;
  initialCss?: string;
  viewport?: ViewportMode;
  customWidth?: number;
  onEditorInit: (editor: Editor) => void;
  onUpdate: () => void;
  onSelectComponent: (component: any) => void;
}

export const GrapesCanvas: React.FC<GrapesCanvasProps> = ({
  initialProjectData,
  initialHtml,
  initialCss,
  viewport = "desktop",
  customWidth = 1440,
  onEditorInit,
  onUpdate,
  onSelectComponent,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const canvasRegionRef = useRef<HTMLElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Keep references to prevent stale closures in editor event listeners
  const onUpdateRef = useRef(onUpdate);
  const onSelectComponentRef = useRef(onSelectComponent);
  const onEditorInitRef = useRef(onEditorInit);
  const initialProjectDataRef = useRef(initialProjectData);
  const initialHtmlRef = useRef(initialHtml);
  const initialCssRef = useRef(initialCss);
  const updateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const readyTimerRef = useRef<NodeJS.Timeout | null>(null);
  const failureTimerRef = useRef<NodeJS.Timeout | null>(null);
  const focusCanvasWhenReadyRef = useRef(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const canvasHeadingId = useId();

  onUpdateRef.current = onUpdate;
  onSelectComponentRef.current = onSelectComponent;
  onEditorInitRef.current = onEditorInit;
  initialProjectDataRef.current = initialProjectData;
  initialHtmlRef.current = initialHtml;
  initialCssRef.current = initialCss;

  const getViewportWidth = () => {
    switch (viewport) {
      case "mobile":
        return "390px";
      case "tablet":
        return "768px";
      case "laptop":
        return "1024px";
      case "custom":
        return `${customWidth}px`;
      case "desktop":
      default:
        return "100%";
    }
  };

  useEffect(() => {
    if (!containerRef.current || editorRef.current || typeof window === "undefined") return;

    let isMounted = true;
    setIsReady(false);
    setLoadError(null);

    failureTimerRef.current = setTimeout(() => {
      if (!isMounted || editorRef.current) return;
      setLoadError("The canvas engine did not start in time. Try again to reload it without leaving the builder.");
    }, 8000);

    import("grapesjs").then((mod) => {
      if (!isMounted || !containerRef.current || editorRef.current) return;
      const grapesjs = mod.default || mod;

      const editor = grapesjs.init({
        container: containerRef.current,
        fromElement: false,
        height: "100%",
        width: "100%",
        storageManager: false,
        panels: { defaults: [] },
        canvas: { styles: [], scripts: [] },
      });

      editorRef.current = editor;

      const attachHostStyles = () => {
        const canvasDocument = editor.Canvas.getDocument?.();
        if (!canvasDocument) return;

        document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]').forEach((source) => {
          const href = source.href;
          if (!href || new URL(href, window.location.href).origin !== window.location.origin) return;
          const alreadyAttached = Array.from(
            canvasDocument.head.querySelectorAll<HTMLLinkElement>("link[data-hive-canvas-style]"),
          ).some((link) => link.dataset.hiveCanvasStyle === href);
          if (alreadyAttached) return;

          const link = canvasDocument.createElement("link");
          link.rel = "stylesheet";
          link.href = href;
          link.dataset.hiveCanvasStyle = href;
          canvasDocument.head.appendChild(link);
        });
      };

      const applyTemplateStyles = () => {
        const canvasDocument = editor.Canvas.getDocument?.();
        if (!canvasDocument) return;

        if (initialCssRef.current) {
          let styleEl = canvasDocument.getElementById("hive-template-inline-css") as HTMLStyleElement | null;
          if (!styleEl) {
            styleEl = canvasDocument.createElement("style");
            styleEl.id = "hive-template-inline-css";
            canvasDocument.head.appendChild(styleEl);
          }
          styleEl.textContent = initialCssRef.current;
        }
      };

      const revealCanvas = () => {
        if (!isMounted) return;
        attachHostStyles();
        applyTemplateStyles();
        editor.refresh?.();
        setLoadError(null);
        setIsReady(true);
        if (failureTimerRef.current) clearTimeout(failureTimerRef.current);
        if (focusCanvasWhenReadyRef.current) {
          focusCanvasWhenReadyRef.current = false;
          requestAnimationFrame(() => canvasRegionRef.current?.focus());
        }
      };

      // Subscribe before hydrating project data. GrapesJS can load its iframe
      // immediately, so attaching this listener later creates an infinite loader.
      editor.on("load", revealCanvas);
      editor.on("canvas:frame:load", revealCanvas);

      // Inspect if project data is valid structured GrapesJS project data
      const projectData = initialProjectDataRef.current as any;
      const isSeedWrapper = Boolean(
        projectData?.pages?.[0]?.frames?.[0]?.component?.components?.[0]?.tagName === "main" &&
        typeof projectData?.pages?.[0]?.frames?.[0]?.component?.components?.[0]?.content === "string"
      );

      const hasValidProjectData = Boolean(
        projectData &&
        typeof projectData === "object" &&
        Object.keys(projectData).length > 0 &&
        !isSeedWrapper
      );

      if (hasValidProjectData) {
        try {
          editor.loadProjectData(projectData);
          if (initialCssRef.current) {
            editor.setStyle(initialCssRef.current);
          }
        } catch (e) {
          console.warn("Could not load project data, fallback to HTML/CSS:", e);
          if (initialHtmlRef.current) editor.setComponents(initialHtmlRef.current);
          if (initialCssRef.current) editor.setStyle(initialCssRef.current);
        }
      } else {
        if (initialHtmlRef.current) editor.setComponents(initialHtmlRef.current);
        if (initialCssRef.current) editor.setStyle(initialCssRef.current);
      }

      editor.on("component:selected", (model: any) => {
        onSelectComponentRef.current(model);
      });

      editor.on("component:deselected", () => {
        onSelectComponentRef.current(null);
      });

      // GrapesJS can emit several update events for one pointer action. Batch
      // them before serialising the project so dragging and typing stay smooth.
      editor.on("update", () => {
        if (updateTimerRef.current) clearTimeout(updateTimerRef.current);
        updateTimerRef.current = setTimeout(() => onUpdateRef.current(), 240);
      });

      onEditorInitRef.current(editor);

      // The ready events are preferred, but a loaded editor must never remain
      // hidden because an iframe event was missed by the browser.
      requestAnimationFrame(() => requestAnimationFrame(revealCanvas));
      readyTimerRef.current = setTimeout(revealCanvas, 1200);
    }).catch((err) => {
      console.error("Failed to load grapesjs module:", err);
      if (!isMounted) return;
      if (failureTimerRef.current) clearTimeout(failureTimerRef.current);
      setLoadError("The visual canvas could not start. Try again, or use the Code workspace while the canvas reloads.");
    });

    return () => {
      isMounted = false;
      if (updateTimerRef.current) clearTimeout(updateTimerRef.current);
      if (readyTimerRef.current) clearTimeout(readyTimerRef.current);
      if (failureTimerRef.current) clearTimeout(failureTimerRef.current);
      if (editorRef.current) {
        try {
          editorRef.current.destroy();
        } catch {
          // ignore cleanup error
        }
        editorRef.current = null;
      }
    };
  }, [retryNonce]);

  return (
    <section
      ref={canvasRegionRef}
      aria-labelledby={canvasHeadingId}
      aria-busy={!isReady && !loadError}
      tabIndex={-1}
      className="relative flex h-full w-full flex-1 items-center justify-center overflow-auto bg-[linear-gradient(135deg,#e8eef7_25%,transparent_25%),linear-gradient(225deg,#e8eef7_25%,transparent_25%),linear-gradient(45deg,#e8eef7_25%,transparent_25%),linear-gradient(315deg,#e8eef7_25%,#f4f7fb_25%)] bg-[length:20px_20px] bg-[position:10px_0,10px_0,0_0,0_0] p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 dark:bg-[linear-gradient(135deg,#172033_25%,transparent_25%),linear-gradient(225deg,#172033_25%,transparent_25%),linear-gradient(45deg,#172033_25%,transparent_25%),linear-gradient(315deg,#172033_25%,#0b1020_25%)] dark:focus-visible:ring-blue-400 sm:p-6"
    >
      <h2 id={canvasHeadingId} className="sr-only">Visual page canvas</h2>
      <div
        className="relative flex h-full min-h-[520px] max-h-full flex-col overflow-hidden rounded-xl border border-slate-500 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)] transition-[width] duration-300 ease-out dark:border-slate-500 dark:bg-slate-950"
        style={{
          width: getViewportWidth(),
          maxWidth: "100%",
        }}
      >
        {!isReady && !loadError && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white text-sm font-medium text-slate-700 dark:bg-slate-950 dark:text-slate-200" role="status">
            Preparing canvas…
          </div>
        )}
        {loadError && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white p-6 dark:bg-slate-950" role="alert">
            <div className="max-w-md text-center">
              <p className="text-base font-semibold text-slate-950 dark:text-white">Canvas could not start</p>
              <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">{loadError}</p>
              <button
                type="button"
                className="mt-5 min-h-11 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:bg-blue-600 dark:hover:bg-blue-500 dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-slate-950"
                onClick={() => {
                  focusCanvasWhenReadyRef.current = true;
                  setRetryNonce((value) => value + 1);
                }}
              >
                Try canvas again
              </button>
            </div>
          </div>
        )}
        <div ref={containerRef} className="flex-1 w-full h-full" />
      </div>
    </section>
  );
};
