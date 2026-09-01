"use client";

import React, { useState } from "react";
import Editor from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { FileCode, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TemplateCodeFile } from "../../lib/api";

interface MonacoCodeWorkspaceProps {
  codeFiles: TemplateCodeFile[];
  onChangeCodeFiles: (files: TemplateCodeFile[]) => void;
  onSyncToCanvas: () => void;
  isSyncing?: boolean;
}

export const MonacoCodeWorkspace: React.FC<MonacoCodeWorkspaceProps> = ({
  codeFiles,
  onChangeCodeFiles,
  onSyncToCanvas,
  isSyncing = false,
}) => {
  const [activeFileName, setActiveFileName] = useState<string>(codeFiles[0]?.name || "index.html");
  const { resolvedTheme } = useTheme();

  const activeFile = codeFiles.find((f) => f.name === activeFileName) || codeFiles[0];

  const handleEditorChange = (value: string | undefined) => {
    if (value === undefined || !activeFile) return;
    const updated = codeFiles.map((f) => (f.name === activeFile.name ? { ...f, content: value } : f));
    onChangeCodeFiles(updated);
  };

  const getLanguage = (file: TemplateCodeFile) => {
    if (file?.language) return file.language;
    if (file?.name.endsWith(".html")) return "html";
    if (file?.name.endsWith(".css")) return "css";
    if (file?.name.endsWith(".js")) return "javascript";
    if (file?.name.endsWith(".json")) return "json";
    return "plaintext";
  };

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % codeFiles.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + codeFiles.length) % codeFiles.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = codeFiles.length - 1;
    if (nextIndex === null || !codeFiles[nextIndex]) return;

    event.preventDefault();
    const nextName = codeFiles[nextIndex].name;
    setActiveFileName(nextName);
    requestAnimationFrame(() => document.getElementById(`code-file-tab-${nextIndex}`)?.focus());
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#1e1e1e] text-white">
      {/* File Tab Bar & Sync Action */}
      <div className="h-11 bg-[#252526] border-b border-[#333333] px-3 flex items-center justify-between gap-3 select-none shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto" role="tablist" aria-label="Template code files">
          {codeFiles.map((file, index) => {
            const isActive = file.name === activeFile?.name;
            return (
              <button
                key={file.name}
                id={`code-file-tab-${index}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls="code-editor-panel"
                tabIndex={isActive ? 0 : -1}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
                onClick={() => setActiveFileName(file.name)}
                className={`flex min-h-11 items-center gap-2 rounded-t-lg border-t-2 px-3 py-1.5 font-mono text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                  isActive
                    ? "bg-[#1e1e1e] text-white border-primary"
                    : "text-[#969696] hover:text-white hover:bg-[#2d2d2d] border-transparent"
                }`}
              >
                <FileCode className={`h-3.5 w-3.5 ${file.name.endsWith(".html") ? "text-orange-400" : file.name.endsWith(".css") ? "text-blue-400" : file.name.endsWith(".js") ? "text-yellow-400" : "text-emerald-400"}`} />
                <span>{file.name}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[11px] font-mono border-white/20 text-white/70 bg-white/5">
            {getLanguage(activeFile)}
          </Badge>

          <Button
            size="sm"
            onClick={onSyncToCanvas}
            disabled={isSyncing}
            className="h-11 gap-1.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-sm"
          >
            <Sparkles className="h-3 w-3" />
            <span>{isSyncing ? "Syncing..." : "Apply Code to Canvas"}</span>
          </Button>
        </div>
      </div>

      {/* Monaco Editor Container */}
      <div id="code-editor-panel" role="tabpanel" aria-label={activeFile ? `${activeFile.name} editor` : "Code editor"} className="flex-1 relative">
        <Editor
          height="100%"
          path={activeFile?.path || activeFile?.name}
          language={getLanguage(activeFile)}
          value={activeFile?.content || ""}
          theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
          onChange={handleEditorChange}
          options={{
            fontSize: 13,
            fontFamily: "JetBrains Mono, Menlo, Monaco, 'Courier New', monospace",
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            wordWrap: "on",
            automaticLayout: true,
            tabSize: 2,
            lineNumbers: "on",
            renderLineHighlight: "all",
            smoothScrolling: true,
            cursorBlinking: "smooth",
            ariaLabel: activeFile ? `Edit ${activeFile.name}` : "Template code editor",
            accessibilitySupport: "auto",
          }}
        />
      </div>

      {/* Status Bar */}
      <div className="h-6 bg-[#007acc] text-white px-3 flex items-center justify-between text-[11px] font-mono shrink-0 select-none">
        <div className="flex items-center gap-3">
          <span>HIVE Monaco Engine</span>
          <span>•</span>
          <span>{activeFile?.path || `/${activeFile?.name}`}</span>
        </div>
        <div className="flex items-center gap-3">
          <span>UTF-8</span>
          <span>Spaces: 2</span>
        </div>
      </div>
    </div>
  );
};
