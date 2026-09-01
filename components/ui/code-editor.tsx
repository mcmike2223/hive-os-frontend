"use client";

import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useTheme } from 'next-themes';
import { 
  Loader2, Copy, Check, Plus, X, Eye, Code2, Paintbrush, 
  Maximize, Minimize, Map, DownloadCloud, FileCode2, FileJson, 
  FileType2, Search, WrapText, Upload, PanelLeft, FileText,
  FileBox, FileDigit, Database, Terminal, FileCode, Command,
  PanelBottom, Sparkles, ChevronRight, Minus, AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/store/use-translation';
import { toast } from 'sonner';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
});

export interface VirtualFile {
  name: string;
  language: string;
  content: string;
}

interface CodeEditorProps {
  files: VirtualFile[];
  setFiles: (files: VirtualFile[]) => void;
  showPreview?: boolean;
  setShowPreview?: (val: boolean) => void;
  previewHtml?: string;
  /**
   * Full-bleed preview to render instead of the A4 `previewHtml` frame. Use
   * when the preview is a live page (e.g. an iframe of the real template
   * route) rather than a document — the paper-sized container crops it.
   */
  previewNode?: React.ReactNode;
  className?: string;
  readOnly?: boolean;
}

// 🚀 UNIVERSAL LANGUAGE MAPPER
const getLanguageFromFilename = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'html': case 'htm': return 'html';
    case 'css': return 'css';
    case 'js': case 'jsx': return 'javascript';
    case 'ts': case 'tsx': return 'typescript';
    case 'json': return 'json';
    case 'py': return 'python';
    case 'java': return 'java';
    case 'c': case 'cpp': case 'h': case 'hpp': return 'cpp';
    case 'cs': return 'csharp';
    case 'go': return 'go';
    case 'rs': return 'rust';
    case 'php': return 'php';
    case 'rb': return 'ruby';
    case 'sql': return 'sql';
    case 'xml': return 'xml';
    case 'yaml': case 'yml': return 'yaml';
    case 'md': case 'markdown': return 'markdown';
    case 'sh': case 'bash': return 'shell';
    case 'ini': return 'ini';
    case 'bat': return 'bat';
    default: return 'plaintext';
  }
};

// 🚀 SMART ICON MAPPER
const getFileIcon = (lang: string, className: string = "h-3.5 w-3.5") => {
  switch (lang) {
    case 'html': return <FileCode2 className={cn(className, "text-orange-500")} />;
    case 'css': return <FileType2 className={cn(className, "text-blue-400")} />;
    case 'javascript': return <FileCode2 className={cn(className, "text-yellow-400")} />;
    case 'typescript': return <FileCode2 className={cn(className, "text-blue-500")} />;
    case 'json': return <FileJson className={cn(className, "text-green-400")} />;
    case 'python': return <FileCode className={cn(className, "text-blue-300")} />;
    case 'java': case 'cpp': case 'csharp': return <FileBox className={cn(className, "text-purple-400")} />;
    case 'sql': case 'database': return <Database className={cn(className, "text-pink-400")} />;
    case 'shell': case 'bat': return <Terminal className={cn(className, "text-gray-300")} />;
    case 'markdown': return <FileText className={cn(className, "text-blue-300")} />;
    case 'yaml': case 'xml': return <FileDigit className={cn(className, "text-red-400")} />;
    default: return <FileText className={cn(className, "text-gray-400")} />;
  }
};

type MonacoMarker = {
  message: string;
  startLineNumber: number;
  startColumn: number;
  severity: number;
};

const getCodeEditorErrorMessage = (error: unknown, fallback = "Unexpected editor error.") => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return fallback;
};

type MonacoEditorBoundaryProps = {
  onError: (error: unknown) => void;
  children: React.ReactNode;
};

type MonacoEditorBoundaryState = {
  hasError: boolean;
};

class MonacoEditorBoundary extends React.Component<
  MonacoEditorBoundaryProps,
  MonacoEditorBoundaryState
> {
  state: MonacoEditorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): MonacoEditorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    this.props.onError(error);
  }

  render() {
    if (this.state.hasError) {
      return null;
    }

    return this.props.children;
  }
}

const SNIPPET_LIBRARY: Record<string, Array<{ label: string; body: string }>> = {
  html: [
    {
      label: "Hero section",
      body: `<section class="hero">\n  <span class="eyebrow">Premium</span>\n  <h1>Build a stronger first impression.</h1>\n  <p>Lead with clarity, confidence, and a sharper call to action.</p>\n</section>`,
    },
  ],
  css: [
    {
      label: "Glass card",
      body: `.glass-card {\n  border: 1px solid rgba(255,255,255,0.18);\n  background: rgba(255,255,255,0.72);\n  backdrop-filter: blur(18px);\n  border-radius: 28px;\n  box-shadow: 0 24px 64px rgba(15,23,42,0.12);\n}`,
    },
  ],
  javascript: [
    {
      label: "Click handler",
      body: `const target = document.querySelector("[data-action]");\n\ntarget?.addEventListener("click", () => {\n  console.log("Action triggered");\n});`,
    },
  ],
  typescript: [
    {
      label: "Typed config",
      body: `type LandingConfig = {\n  title: string;\n  description: string;\n};\n\nconst config: LandingConfig = {\n  title: "Build a stronger brand front door",\n  description: "Lead with premium positioning and faster conversion.",\n};`,
    },
  ],
  json: [
    {
      label: "Stat item",
      body: `{\n  "value": "98%",\n  "label": "customer satisfaction"\n}`,
    },
    {
      label: "Highlight card",
      body: `{\n  "kicker": "Signature",\n  "title": "A polished first impression",\n  "description": "Use stronger copy, clearer proof, and a sharper next step."\n}`,
    },
  ],
  default: [
    {
      label: "Notes block",
      body: `TODO\n- refine copy\n- tune spacing\n- review CTA links`,
    },
  ],
};

const getSnippetsForLanguage = (language: string) =>
  SNIPPET_LIBRARY[language] ?? SNIPPET_LIBRARY.default;

const createUniqueFilename = (filename: string, existingNames: string[]): string => {
  const lowerExisting = new Set(existingNames.map((name) => name.toLowerCase()));

  if (!lowerExisting.has(filename.toLowerCase())) {
    return filename;
  }

  const dotIndex = filename.lastIndexOf('.');
  const base = dotIndex > 0 ? filename.slice(0, dotIndex) : filename;
  const extension = dotIndex > 0 ? filename.slice(dotIndex) : "";
  let attempt = 2;

  while (lowerExisting.has(`${base}-${attempt}${extension}`.toLowerCase())) {
    attempt += 1;
  }

  return `${base}-${attempt}${extension}`;
};

export function CodeEditor({ 
  files, 
  setFiles, 
  showPreview = false,
  setShowPreview,
  previewHtml = "",
  previewNode,
  className,
  readOnly = false
}: CodeEditorProps) {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const deferredPreviewHtml = useDeferredValue(previewHtml);
  const previewDocumentKey = useMemo(() => {
    let hash = 0;
    for (let index = 0; index < deferredPreviewHtml.length; index += 1) {
      hash = ((hash << 5) - hash + deferredPreviewHtml.charCodeAt(index)) | 0;
    }
    return `${deferredPreviewHtml.length}:${hash}`;
  }, [deferredPreviewHtml]);
  
  const [activeFile, setActiveFile] = useState<string>(files[0]?.name || '');
  const [copied, setCopied] = useState(false);
  const [isAddingFile, setIsAddingFile] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showSnippets, setShowSnippets] = useState(false);
  const [showCommandMenu, setShowCommandMenu] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [monacoError, setMonacoError] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState(14);
  const [lineNumbers, setLineNumbers] = useState(true);
  const [diagnostics, setDiagnostics] = useState<MonacoMarker[]>([]);
  const [cursorPosition, setCursorPosition] = useState({ lineNumber: 1, column: 1 });
  
  // Editor Features State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showMinimap, setShowMinimap] = useState(false);
  const [wordWrap, setWordWrap] = useState<"on" | "off">("on");
  const [showSidebar, setShowSidebar] = useState(() => files.length > 1);
  
  const editorRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null); 
  const fileInputRef = useRef<HTMLInputElement>(null);
  const commandInputRef = useRef<HTMLInputElement>(null);
  const cursorListenerRef = useRef<{ dispose: () => void } | null>(null);

  const activeFileState = useMemo(
    () => files.find((file) => file.name === activeFile) ?? files[0] ?? null,
    [activeFile, files]
  );
  const activeContent = activeFileState?.content || "";
  const activeLanguage = activeFileState?.language || "plaintext";
  const activeSnippets = useMemo(() => getSnippetsForLanguage(activeLanguage), [activeLanguage]);

  useEffect(() => {
    if (!files.length) {
      setActiveFile('');
      return;
    }

    if (!files.some((file) => file.name === activeFile)) {
      setActiveFile(files[0].name);
    }
  }, [activeFile, files]);

  useEffect(() => {
    return () => {
      cursorListenerRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    if (!showCommandMenu) {
      return;
    }

    const timer = window.setTimeout(() => {
      commandInputRef.current?.focus();
      commandInputRef.current?.select();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [showCommandMenu]);

  // Handle Fullscreen natively
  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        document.exitFullscreen().catch(() => {});
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setCommandQuery("");
        setShowCommandMenu(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  useEffect(() => {
    if (monacoError) {
      toast.error(`Editor engine fallback active: ${monacoError}`);
    }
  }, [monacoError]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        const message = err instanceof Error ? err.message : "The browser blocked fullscreen mode.";
        toast.error(`Fullscreen failed: ${message}`);
      });
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const reportMonacoRuntimeError = (
    error: unknown,
    fallback = "The editor engine failed to initialize.",
  ) => {
    const message = getCodeEditorErrorMessage(error, fallback);
    console.error("[CodeEditor] Monaco runtime error", error);
    setMonacoError((current) => current ?? message);
  };

  const handleEditorBeforeMount = (monacoInstance: any) => {
    try {
      monacoInstance.editor.defineTheme('hive-workbench-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'comment', foreground: '7d8590', fontStyle: 'italic' },
          { token: 'keyword', foreground: '7dd3fc' },
          { token: 'string', foreground: '86efac' },
        ],
        colors: {
          'editor.background': '#1e1e1e',
          'editorLineNumber.foreground': '#5b6471',
          'editorLineNumber.activeForeground': '#f8fafc',
          'editorCursor.foreground': '#5eead4',
          'editor.selectionBackground': '#0f766e55',
        },
      });

      monacoInstance.editor.defineTheme('hive-workbench-light', {
        base: 'vs',
        inherit: true,
        rules: [
          { token: 'comment', foreground: '64748b', fontStyle: 'italic' },
          { token: 'keyword', foreground: '0f766e' },
          { token: 'string', foreground: '0369a1' },
        ],
        colors: {
          'editor.background': '#f8fafc',
          'editorLineNumber.foreground': '#94a3b8',
          'editorLineNumber.activeForeground': '#0f172a',
          'editorCursor.foreground': '#0f766e',
          'editor.selectionBackground': '#99f6e455',
        },
      });
    } catch (error) {
      reportMonacoRuntimeError(error);
    }
  };

  const focusEditor = () => {
    if (!editorRef.current) {
      toast.info("Editor is still loading.");
      return false;
    }

    editorRef.current.focus?.();
    return true;
  };

  const runEditorAction = (
    actionId: string,
    fallbackMessage: string,
    options?: { requiresWritable?: boolean },
  ) => {
    if (monacoError) {
      toast.info("Monaco editor is unavailable in this session.");
      return;
    }

    if (options?.requiresWritable && readOnly) {
      toast.info("This editor is in read-only mode.");
      return;
    }

    if (!focusEditor()) {
      return;
    }

    try {
      const action = editorRef.current?.getAction?.(actionId);

      if (!action?.run) {
        toast.info(fallbackMessage);
        return;
      }

      const result = action.run();

      if (result && typeof result.then === "function") {
        void result.catch((error: unknown) => {
          console.error(`[CodeEditor] Failed action ${actionId}`, error);
          toast.error(fallbackMessage);
        });
      }
    } catch (error) {
      console.error(`[CodeEditor] Failed action ${actionId}`, error);
      toast.error(fallbackMessage);
    }
  };

  const handleEditorDidMount = (editor: any, monacoInstance: any) => {
    try {
      editorRef.current = editor;
      cursorListenerRef.current?.dispose();
      cursorListenerRef.current = editor.onDidChangeCursorPosition((event: any) => {
        setCursorPosition({
          lineNumber: event.position.lineNumber,
          column: event.position.column,
        });
      });

      editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, () => {
        if (!readOnly) {
          void editor.getAction('editor.action.formatDocument')?.run();
        }
      });

      editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyB, () => {
        setShowSidebar((current: boolean) => !current);
      });
    } catch (error) {
      reportMonacoRuntimeError(error, "Editor shortcuts failed to register.");
    }
  };

  const handleContentChange = (val: string | undefined) => {
    if (readOnly) return;
    setFiles(files.map(f => f.name === activeFile ? { ...f, content: val || '' } : f));
  };

  const openCommandPalette = () => {
    setCommandQuery("");
    setShowCommandMenu(true);
  };

  const closeCommandPalette = () => {
    setShowCommandMenu(false);
    setCommandQuery("");
  };

  const formatCode = () =>
    runEditorAction('editor.action.formatDocument', "Formatting is not available for this file yet.", {
      requiresWritable: true,
    });

  const triggerSearch = () =>
    runEditorAction('actions.find', "Search is not ready until the editor is fully focused.");
  const handleValidate = (markers: MonacoMarker[]) => setDiagnostics(markers);

  const insertSnippet = (body: string, label: string) => {
    if (readOnly) return;

    if (!editorRef.current || monacoError) {
      setFiles(files.map((entry) =>
        entry.name === activeFile
          ? { ...entry, content: `${entry.content}${entry.content.endsWith('\n') || entry.content.length === 0 ? '' : '\n'}${body}` }
          : entry,
      ));
      toast.success(`Inserted ${label}`);
      return;
    }

    const selection = editorRef.current.getSelection();
    if (!selection) return;

    editorRef.current.executeEdits('snippet-insert', [
      {
        range: selection,
        text: body,
        forceMoveMarkers: true,
      },
    ]);
    editorRef.current.focus();
    toast.success(`Inserted ${label}`);
  };

  const handleCopy = () => {
    if (!activeContent) {
      toast.info("There is no code to copy yet.");
      return;
    }

    void navigator.clipboard.writeText(activeContent)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success(t('tools.toast_copied', "Copied to clipboard!"));
      })
      .catch(() => {
        toast.error("Clipboard access is not available in this browser context.");
      });
  };

  const handleDownloadFile = () => {
    if (!activeFile) {
      toast.info("Choose a file before downloading.");
      return;
    }

    const blob = new Blob([activeContent], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = activeFile;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Downloaded ${activeFile}`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const content = event.target?.result as string;
        const nextName = createUniqueFilename(file.name, files.map((entry) => entry.name));
        const lang = getLanguageFromFilename(nextName);

        setFiles([...files, { name: nextName, language: lang, content }]);
        setActiveFile(nextName);
        toast.success(`Imported ${nextName}`);
    };
    reader.readAsText(file);
    e.target.value = ''; 
  };

  const handleAddFile = () => {
    if (!newFileName.trim()) return toast.error(t('tools.filename_req', "Filename is required."));
    
    const normalizedName = newFileName.trim().replace(/\s+/g, '-');
    const nextName = createUniqueFilename(normalizedName, files.map((file) => file.name));

    const lang = getLanguageFromFilename(nextName);
    const newFile = { name: nextName, language: lang, content: "" };
    
    setFiles([...files, newFile]);
    setActiveFile(nextName);
    setIsAddingFile(false);
    setNewFileName("");
  };

  const removeFile = (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    if (files.length <= 1) return; // Require at least one tab
    
    const newFiles = files.filter(f => f.name !== name);
    setFiles(newFiles);
    
    if (activeFile === name) {
        setActiveFile(newFiles[newFiles.length - 1].name);
    }
  };

  const commandItems = useMemo(() => {
    const items = [
      {
        id: "find",
        label: "Find in file",
        shortcut: "Ctrl/Cmd+F",
        description: "Open Monaco search for the active file.",
        action: () => triggerSearch(),
      },
      {
        id: "format",
        label: "Format document",
        shortcut: "Ctrl/Cmd+S",
        description: readOnly
          ? "Disabled because the editor is read-only."
          : "Run the formatter for the current file.",
        disabled: readOnly,
        action: () => formatCode(),
      },
      {
        id: "preview",
        label: showPreview ? "Show code editor" : "Show live preview",
        description: showPreview
          ? "Return to the editable source view."
          : "Switch to the rendered preview for the current template.",
        hidden: !setShowPreview,
        action: () => setShowPreview?.(!showPreview),
      },
      {
        id: "explorer",
        label: showSidebar ? "Hide explorer" : "Show explorer",
        shortcut: "Ctrl/Cmd+B",
        description: "Toggle the file explorer sidebar.",
        action: () => setShowSidebar((current) => !current),
      },
      {
        id: "wrap",
        label: wordWrap === "on" ? "Disable word wrap" : "Enable word wrap",
        description: "Toggle wrapping for long lines.",
        action: () => setWordWrap((current) => (current === "on" ? "off" : "on")),
      },
      {
        id: "minimap",
        label: showMinimap ? "Hide minimap" : "Show minimap",
        description: "Toggle the code overview rail on the right.",
        action: () => setShowMinimap((current) => !current),
      },
      {
        id: "diagnostics",
        label: showDiagnostics ? "Hide problems panel" : "Show problems panel",
        description: "Open the diagnostics list for the active file.",
        action: () => setShowDiagnostics((current) => !current),
      },
      {
        id: "snippets",
        label: showSnippets ? "Hide snippet shelf" : "Show snippet shelf",
        description: "Show insertable snippets for the current language.",
        action: () => setShowSnippets((current) => !current),
      },
      {
        id: "line-numbers",
        label: lineNumbers ? "Hide line numbers" : "Show line numbers",
        description: "Toggle editor line numbers.",
        action: () => setLineNumbers((current) => !current),
      },
      {
        id: "font-up",
        label: "Increase font size",
        description: "Make the editor text larger.",
        action: () => setFontSize((current) => Math.min(22, current + 1)),
      },
      {
        id: "font-down",
        label: "Decrease font size",
        description: "Make the editor text smaller.",
        action: () => setFontSize((current) => Math.max(12, current - 1)),
      },
      {
        id: "copy",
        label: "Copy current file",
        description: "Copy the active file contents to the clipboard.",
        action: () => handleCopy(),
      },
      {
        id: "download",
        label: "Download current file",
        description: "Export the active file to your device.",
        action: () => handleDownloadFile(),
      },
      {
        id: "fullscreen",
        label: isFullscreen ? "Exit fullscreen" : "Enter fullscreen",
        description: "Expand the workbench to fullscreen mode.",
        action: () => toggleFullscreen(),
      },
      {
        id: "new-file",
        label: "Create new file",
        description: "Add another virtual file to this workbench.",
        hidden: readOnly,
        action: () => setIsAddingFile(true),
      },
      {
        id: "import-file",
        label: "Import local file",
        description: "Bring a file from disk into the editor.",
        hidden: readOnly,
        action: () => fileInputRef.current?.click(),
      },
    ];

    return items.filter((item) => !item.hidden);
  }, [
    formatCode,
    handleCopy,
    isFullscreen,
    lineNumbers,
    readOnly,
    setShowPreview,
    showDiagnostics,
    showMinimap,
    showPreview,
    showSidebar,
    showSnippets,
    triggerSearch,
    wordWrap,
  ]);

  const filteredCommandItems = useMemo(() => {
    const query = commandQuery.trim().toLowerCase();

    if (!query) {
      return commandItems;
    }

    return commandItems.filter((item) =>
      [item.label, item.description, item.shortcut]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query))
    );
  }, [commandItems, commandQuery]);

  return (
    <div 
      ref={containerRef} 
      className={cn(
        "relative flex flex-col border border-border/50 overflow-hidden shadow-sm transition-all duration-300", 
        isFullscreen ? "bg-[#1e1e1e] w-screen h-screen rounded-none border-0 z-[9999]" : "rounded-[1.5rem] bg-[#1e1e1e] dark:bg-[#1e1e1e]",
        className
      )}
    >
      
      {/* 🚀 VS Code Style Top Bar / Tab Row */}
      <div className="flex items-center justify-between bg-[#252526] border-b border-[#333] shrink-0 overflow-x-auto no-scrollbar">
        
        <div className="flex items-center h-10">
          
          {/* Sidebar Toggle & Traffic Lights */}
          <div className="flex gap-3 px-4 shrink-0 items-center border-r border-[#333] h-full">
            <div className="flex gap-1.5 hidden sm:flex">
              <div className="w-3 h-3 rounded-full bg-[#ff5f56] shadow-sm"></div>
              <div className="w-3 h-3 rounded-full bg-[#ffbd2e] shadow-sm"></div>
              <div className="w-3 h-3 rounded-full bg-[#27c93f] shadow-sm"></div>
            </div>
            <button 
              type="button"
              onClick={() => setShowSidebar(!showSidebar)} 
              className={cn("p-1 rounded-md transition-colors", showSidebar ? "bg-[#333] text-white" : "text-gray-400 hover:text-white")}
              title="Toggle Explorer"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
          </div>

          {/* Tabs */}
          {files.map(f => (
            <div 
              key={f.name} 
              onClick={() => setActiveFile(f.name)}
              className={cn(
                "group px-4 h-full flex items-center gap-2 border-r border-[#333] cursor-pointer transition-all min-w-[120px] max-w-[200px]",
                activeFile === f.name 
                  ? "bg-[#1e1e1e] border-t-2 border-t-indigo-500 text-white" 
                  : "bg-[#2d2d2d] text-gray-400 hover:bg-[#1e1e1e] border-t-2 border-t-transparent"
              )}
            >
              {getFileIcon(f.language)}
              <span className="truncate text-xs font-mono select-none">{f.name}</span>
              {!readOnly && files.length > 1 && (
                <button type="button" onClick={(e) => removeFile(e, f.name)} className="opacity-0 group-hover:opacity-100 hover:text-red-400 ml-auto transition-opacity">
                    <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}

          {/* Add File Buttons */}
          {!readOnly && (
            isAddingFile ? (
              <div className="px-2 flex items-center gap-1 h-full border-r border-[#333] bg-[#1e1e1e]">
                  <input 
                      autoFocus 
                      value={newFileName} 
                      onChange={(e) => setNewFileName(e.target.value)} 
                      onBlur={() => {
                        if (!newFileName.trim()) {
                          setIsAddingFile(false);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddFile();
                        }
                        if (e.key === 'Escape') {
                          e.preventDefault();
                          setIsAddingFile(false);
                          setNewFileName("");
                        }
                      }}
                      placeholder="style.css"
                      className="bg-[#252526] text-white text-xs font-mono px-2 py-1 rounded outline-none w-32 border border-[#444] focus:border-indigo-500" 
                  />
                  <button
                      type="button"
                      onClick={handleAddFile}
                      className="p-1 text-emerald-400 hover:text-emerald-300"
                      title="Create file"
                  >
                      <Check className="h-3.5 w-3.5" />
                  </button>
              </div>
            ) : (
              <div className="flex h-full border-r border-[#333]">
                  <button type="button" onClick={() => setIsAddingFile(true)} className="px-3 h-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#1e1e1e] transition-colors border-r border-[#333]" title={t('tools.new_file', "New File...")}>
                      <Plus className="h-4 w-4" />
                  </button>
                  <input type="file" ref={fileInputRef} className="hidden" accept="*" onChange={handleFileUpload} />
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="px-3 h-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#1e1e1e] transition-colors" title="Import Local File">
                      <Upload className="h-3.5 w-3.5" />
                  </button>
              </div>
            )
          )}
        </div>

        {/* Main Toolbar */}
        <div className="flex items-center gap-1.5 px-3 shrink-0">
          
          {setShowPreview && (
            <div className="flex bg-[#181818] p-0.5 rounded-lg border border-[#333] shadow-inner mr-2 hidden sm:flex">
              <button type="button" onClick={() => setShowPreview(false)} className={cn("px-3 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1.5", !showPreview ? "bg-[#333] text-white shadow-sm" : "text-gray-400 hover:text-white")}>
                  <Code2 className="h-3 w-3" /> {t('tools.code_raw', 'Code')}
              </button>
              <button type="button" onClick={() => setShowPreview(true)} className={cn("px-3 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1.5", showPreview ? "bg-indigo-500 text-white shadow-sm" : "text-gray-400 hover:text-white")}>
                  <Eye className="h-3 w-3" /> {t('tools.code_render', 'Preview')}
              </button>
            </div>
          )}

          <Button type="button" variant="ghost" size="icon" onClick={openCommandPalette} className="h-7 w-7 rounded-md text-gray-400 hover:text-white hover:bg-[#333]" title="Command Palette">
            <Command className="h-3.5 w-3.5" />
          </Button>

          {!showPreview && (
            <>
              <Button type="button" variant="ghost" size="icon" onClick={triggerSearch} className="h-7 w-7 rounded-md text-gray-400 hover:text-white hover:bg-[#333] hidden sm:flex" title="Find & Replace">
                <Search className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={() => setWordWrap(w => w === "on" ? "off" : "on")} className={cn("h-7 w-7 rounded-md hidden sm:flex", wordWrap === "on" ? "text-indigo-400 bg-[#333]" : "text-gray-400 hover:text-white hover:bg-[#333]")} title="Toggle Word Wrap">
                <WrapText className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={() => setShowMinimap(!showMinimap)} className={cn("h-7 w-7 rounded-md hidden sm:flex", showMinimap ? "text-indigo-400 bg-[#333]" : "text-gray-400 hover:text-white hover:bg-[#333]")} title={t('tools.toggle_minimap', "Toggle Minimap")}>
                <Map className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={() => setShowDiagnostics((current) => !current)} className={cn("h-7 w-7 rounded-md hidden sm:flex", showDiagnostics ? "text-indigo-400 bg-[#333]" : "text-gray-400 hover:text-white hover:bg-[#333]")} title="Problems Panel">
                <PanelBottom className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={() => setShowSnippets((current) => !current)} className={cn("h-7 w-7 rounded-md hidden sm:flex", showSnippets ? "text-indigo-400 bg-[#333]" : "text-gray-400 hover:text-white hover:bg-[#333]")} title="Snippet Shelf">
                <Sparkles className="h-3.5 w-3.5" />
              </Button>
               
              <div className="w-px h-4 bg-[#444] mx-0.5 hidden sm:block"></div>
               
              {!readOnly && (
                <Button type="button" variant="ghost" size="icon" onClick={formatCode} className="h-7 w-7 rounded-md text-gray-400 hover:text-indigo-400 hover:bg-[#333]" title={t('tools.format_code', "Format Code")}>
                  <Paintbrush className="h-3.5 w-3.5" />
                </Button>
              )}
               
              <Button type="button" variant="ghost" size="icon" onClick={() => setLineNumbers((current) => !current)} className={cn("h-7 w-7 rounded-md hidden sm:flex", lineNumbers ? "text-indigo-400 bg-[#333]" : "text-gray-400 hover:text-white hover:bg-[#333]")} title="Toggle Line Numbers">
                <PanelLeft className="h-3.5 w-3.5 rotate-180" />
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={() => setFontSize((current) => Math.max(12, current - 1))} className="h-7 w-7 rounded-md text-gray-400 hover:text-white hover:bg-[#333]" title="Decrease Font Size">
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={() => setFontSize((current) => Math.min(22, current + 1))} className="h-7 w-7 rounded-md text-gray-400 hover:text-white hover:bg-[#333]" title="Increase Font Size">
                <Plus className="h-3.5 w-3.5" />
              </Button>
              
              <Button type="button" variant="ghost" size="icon" onClick={handleDownloadFile} className="h-7 w-7 rounded-md text-gray-400 hover:text-emerald-400 hover:bg-[#333]" title={t('tools.download_file', "Download File")}>
                <DownloadCloud className="h-3.5 w-3.5" />
              </Button>
               
              <Button type="button" variant="ghost" size="icon" onClick={handleCopy} className="h-7 w-7 rounded-md text-gray-400 hover:text-blue-400 hover:bg-[#333]" title={t('tools.copy_code', "Copy")}>
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
               
              <div className="w-px h-4 bg-[#444] mx-0.5"></div>
            </>
          )}

          <Button type="button" variant="ghost" size="icon" onClick={toggleFullscreen} className="h-7 w-7 rounded-md text-gray-400 hover:text-white hover:bg-[#333]" title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Mode"}>
            {isFullscreen ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* 🚀 Main Content Area: Explorer + Editor */}
      {showCommandMenu && (
        <div className="absolute inset-0 z-30 flex items-start justify-center bg-[#09090bcc] px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#101114] shadow-[0_32px_120px_rgba(0,0,0,0.45)]">
            <div className="border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
                <Command className="h-4 w-4 text-cyan-300" />
                <input
                  ref={commandInputRef}
                  value={commandQuery}
                  onChange={(event) => setCommandQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      closeCommandPalette();
                    }

                    if (event.key === "Enter" && filteredCommandItems[0] && !filteredCommandItems[0].disabled) {
                      event.preventDefault();
                      closeCommandPalette();
                      filteredCommandItems[0].action();
                    }
                  }}
                  placeholder="Search editor commands"
                  className="h-8 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-500"
                />
                <button
                  type="button"
                  onClick={closeCommandPalette}
                  className="rounded-md p-1 text-gray-500 transition hover:bg-white/5 hover:text-white"
                  title="Close command menu"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="max-h-[24rem] overflow-y-auto p-2">
              {filteredCommandItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center">
                  <p className="text-sm font-semibold text-white">No matching editor command</p>
                  <p className="mt-1 text-xs text-gray-400">Try a broader keyword like preview, format, explorer, or download.</p>
                </div>
              ) : (
                filteredCommandItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={item.disabled}
                    onClick={() => {
                      closeCommandPalette();
                      item.action();
                    }}
                    className={cn(
                      "flex w-full items-start justify-between gap-4 rounded-[1.2rem] px-4 py-3 text-left transition",
                      item.disabled
                        ? "cursor-not-allowed opacity-60"
                        : "hover:bg-white/[0.04] focus-visible:bg-white/[0.05]"
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{item.label}</p>
                      <p className="mt-1 text-xs leading-5 text-gray-400">{item.description}</p>
                    </div>
                    {item.shortcut ? (
                      <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] font-medium text-gray-300">
                        {item.shortcut}
                      </span>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden bg-[#1e1e1e]">
        
        {/* File Explorer Sidebar */}
        {showSidebar && (
          <div className="w-48 sm:w-60 bg-[#252526] border-r border-[#333] flex flex-col shrink-0">
            <div className="px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-gray-400 border-b border-[#333]">
              Explorer
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              {files.map(f => (
                <div 
                  key={`sidebar-${f.name}`}
                  onClick={() => setActiveFile(f.name)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-1.5 cursor-pointer group text-sm font-mono",
                    activeFile === f.name ? "bg-[#37373d] text-white" : "text-gray-400 hover:bg-[#2a2d2e] hover:text-gray-200"
                  )}
                >
                  {getFileIcon(f.language, "h-4 w-4 shrink-0")}
                  <span className="truncate flex-1">{f.name}</span>
                  {!readOnly && files.length > 1 && (
                    <button 
                      type="button"
                      onClick={(e) => removeFile(e, f.name)} 
                      className={cn("opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity", activeFile === f.name && "opacity-100")}
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {showSnippets && (
              <div className="border-t border-[#333] p-3 space-y-2">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">
                  <Sparkles className="h-3.5 w-3.5" />
                  Snippets
                </div>
                <div className="space-y-2">
                  {activeSnippets.map((snippet) => (
                    <button
                      key={snippet.label}
                      type="button"
                      onClick={() => insertSnippet(snippet.body, snippet.label)}
                      className="w-full rounded-xl border border-[#333] bg-[#1e1e1e] px-3 py-2 text-left transition hover:border-indigo-500/50 hover:bg-[#2a2d2e]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-white">{snippet.label}</span>
                        <ChevronRight className="h-3.5 w-3.5 text-gray-500" />
                      </div>
                      <p className="mt-1 text-[11px] text-gray-400 line-clamp-3 whitespace-pre-wrap">
                        {snippet.body}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Monaco / Live Preview Area */}
        <div className="flex flex-1 w-full bg-[#1e1e1e] min-w-0 flex-col">
          <div className="relative flex-1 min-w-0">
            {showPreview ? (
                previewNode ? (
                  <div className="absolute inset-0 overflow-hidden bg-white">{previewNode}</div>
                ) : (
                  <div className="absolute inset-0 bg-[#e0e0e0] flex justify-center overflow-auto p-4 sm:p-8">
                      <div className="bg-white shadow-xl w-full max-w-[210mm] min-h-[297mm] mx-auto overflow-hidden relative">
                        <iframe
                          key={previewDocumentKey}
                          title="Rendered template preview"
                          srcDoc={deferredPreviewHtml}
                          className="absolute inset-0 h-full w-full border-none"
                          sandbox="allow-scripts"
                        />
                      </div>
                  </div>
                )
            ) : (
              monacoError ? (
                <div className="absolute inset-0 flex flex-col bg-[#111315]">
                  <div className="border-b border-amber-400/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
                    Monaco editor is unavailable right now. Using safe text mode instead. ({monacoError})
                  </div>
                  <textarea
                    value={activeContent}
                    onChange={(event) => handleContentChange(event.target.value)}
                    readOnly={readOnly}
                    spellCheck={false}
                    className="h-full w-full flex-1 resize-none border-0 bg-[#111315] px-4 py-4 font-mono text-sm text-slate-100 outline-none"
                  />
                </div>
              ) : (
                <MonacoEditorBoundary onError={(error) => reportMonacoRuntimeError(error)}>
                  <MonacoEditor
                      path={activeFileState?.name}
                      height="100%"
                      language={activeLanguage}
                      theme={resolvedTheme === 'light' ? 'hive-workbench-light' : 'hive-workbench-dark'}
                      beforeMount={handleEditorBeforeMount as any}
                      value={activeContent}
                      onChange={handleContentChange}
                      onMount={handleEditorDidMount}
                      onValidate={handleValidate as any}
                      options={{
                          minimap: { enabled: showMinimap },
                          fontSize,
                          lineNumbers: lineNumbers ? "on" : "off",
                          wordWrap: wordWrap,
                          formatOnPaste: true,
                          formatOnType: true,
                          padding: { top: 16, bottom: 16 },
                          scrollBeyondLastLine: false,
                          smoothScrolling: true,
                          stickyScroll: { enabled: true },
                          bracketPairColorization: { enabled: true },
                          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                          cursorBlinking: "smooth",
                          cursorSmoothCaretAnimation: "on",
                          readOnly: readOnly,
                      }}
                      loading={
                          <div className="flex flex-col items-center justify-center h-full text-gray-400 bg-[#1e1e1e]">
                              <Loader2 className="h-6 w-6 animate-spin mb-3 text-indigo-500" />
                              <span className="text-[11px] uppercase tracking-widest font-bold">Mounting Engine...</span>
                          </div>
                      }
                  />
                </MonacoEditorBoundary>
              )
            )}
          </div>

          {!showPreview && showDiagnostics && (
            <div className="border-t border-[#333] bg-[#151515] max-h-44 overflow-y-auto">
              <div className="flex items-center justify-between px-4 py-2 border-b border-[#333]">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Problems
                </div>
                <span className="text-[11px] text-gray-500">{diagnostics.length} issue{diagnostics.length === 1 ? "" : "s"}</span>
              </div>
              <div className="p-3 space-y-2">
                {diagnostics.length === 0 ? (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                    No current diagnostics in this file.
                  </div>
                ) : diagnostics.map((marker, index) => (
                  <button
                    key={`${marker.message}-${index}`}
                    type="button"
                    onClick={() => {
                      editorRef.current?.revealPositionInCenter?.({
                        lineNumber: marker.startLineNumber,
                        column: marker.startColumn,
                      });
                      editorRef.current?.setPosition?.({
                        lineNumber: marker.startLineNumber,
                        column: marker.startColumn,
                      });
                      editorRef.current?.focus?.();
                    }}
                    className="w-full rounded-xl border border-[#333] bg-[#1e1e1e] px-3 py-2 text-left hover:border-indigo-500/50"
                  >
                    <div className="text-xs font-semibold text-white">Ln {marker.startLineNumber}, Col {marker.startColumn}</div>
                    <div className="mt-1 text-xs text-gray-400">{marker.message}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-[#333] bg-[#181818] px-4 py-2 text-[11px] text-gray-400">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="rounded-full bg-[#252526] px-3 py-1">{activeFileState?.name || "No file"}</span>
          <span className="rounded-full bg-[#252526] px-3 py-1 uppercase tracking-wider">{activeLanguage}</span>
          <span className="rounded-full bg-[#252526] px-3 py-1">Ln {cursorPosition.lineNumber}, Col {cursorPosition.column}</span>
          <span className="rounded-full bg-[#252526] px-3 py-1">{wordWrap === "on" ? "Wrap On" : "Wrap Off"}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="rounded-full bg-[#252526] px-3 py-1">{fontSize}px</span>
          <span className="rounded-full bg-[#252526] px-3 py-1">{diagnostics.length} issue{diagnostics.length === 1 ? "" : "s"}</span>
        </div>
      </div>
    </div>
  );
} 
