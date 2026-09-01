"use client";

import React, { useState, useEffect, useRef } from "react";
import { DiffEditor } from "@monaco-editor/react";
import { RotateCcw, FileCode, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TemplateLibraryCard, TemplateVersionItem, fetchVersionDiff, rollbackVersion, VersionDiffPayload } from "../../lib/api";

interface MonacoDiffWorkspaceProps {
  template: TemplateLibraryCard;
  versions: TemplateVersionItem[];
  hasDraft: boolean;
  onRollbackComplete: () => void;
}

export const MonacoDiffWorkspace: React.FC<MonacoDiffWorkspaceProps> = ({
  template,
  versions,
  hasDraft,
  onRollbackComplete,
}) => {
  const [fromVersion, setFromVersion] = useState<string>("draft");
  const [toVersion, setToVersion] = useState<string>(versions[0]?.version || template.current_version);
  const [diffPayload, setDiffPayload] = useState<VersionDiffPayload | null>(null);
  const [selectedFile, setSelectedFile] = useState<string>("index.html");
  const [isLoading, setIsLoading] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const fileTabListRef = useRef<HTMLDivElement>(null);

  const loadDiff = async () => {
    setIsLoading(true);
    try {
      const res = await fetchVersionDiff(template.id, fromVersion, toVersion);
      setDiffPayload(res.data);
      if (res.data.files.length > 0 && !res.data.files.some((f) => f.filename === selectedFile)) {
        setSelectedFile(res.data.files[0].filename);
      }
    } catch (e) {
      console.error("Failed to load diff:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDiff();
  }, [fromVersion, toVersion, template.id]);

  const handleRollback = async () => {
    const targetVersionObj = versions.find((v) => v.version === toVersion);
    if (!targetVersionObj) return;

    if (!confirm(`Are you sure you want to rollback to version ${targetVersionObj.version}? This will mint a new version restoring its state.`)) {
      return;
    }

    setIsRollingBack(true);
    try {
      await rollbackVersion(template.id, targetVersionObj.id);
      onRollbackComplete();
    } catch (e) {
      console.error("Rollback failed:", e);
    } finally {
      setIsRollingBack(false);
    }
  };

  const activeDiffFile = diffPayload?.files.find((f) => f.filename === selectedFile) || diffPayload?.files[0];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#1e1e1e] text-white">
      {/* Control Bar */}
      <div className="h-14 bg-[#252526] border-b border-[#333333] px-4 flex items-center justify-between gap-4 select-none shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-[#cccccc]">
            <span className="font-semibold">Compare:</span>
            <Select value={fromVersion} onValueChange={setFromVersion}>
              <SelectTrigger aria-label="Compare from version" className="h-11 w-40 border-[#888888] bg-[#333333] font-mono text-xs text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#252526] border-[#333333] text-white">
                {hasDraft && <SelectItem value="draft">Current Draft</SelectItem>}
                {versions.map((v) => (
                  <SelectItem key={v.id} value={v.version}>
                    v{v.version} {v.is_snapshot ? "(Snapshot)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <span className="text-[#888888] font-mono text-xs">→</span>

          <div className="flex items-center gap-1.5 text-xs text-[#cccccc]">
            <span className="font-semibold">With:</span>
            <Select value={toVersion} onValueChange={setToVersion}>
              <SelectTrigger aria-label="Compare with version" className="h-11 w-40 border-[#888888] bg-[#333333] font-mono text-xs text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#252526] border-[#333333] text-white">
                {versions.map((v) => (
                  <SelectItem key={v.id} value={v.version}>
                    v{v.version} {v.is_snapshot ? "(Snapshot)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Action: Rollback button */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="destructive"
            onClick={handleRollback}
            disabled={isRollingBack || toVersion === "draft"}
            className="h-11 gap-1.5 text-xs font-medium"
          >
            {isRollingBack ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
            <span>Restore to v{toVersion}</span>
          </Button>
        </div>
      </div>

      {/* File Selector Tabs */}
      {diffPayload && diffPayload.files.length > 0 && (
        <div ref={fileTabListRef} role="tablist" aria-label="Version diff files" className="flex min-h-11 shrink-0 items-center gap-1 overflow-x-auto border-b border-[#888888] bg-[#1e1e1e] px-3 select-none">
          {diffPayload.files.map((f, index) => {
            const isActive = f.filename === selectedFile;
            return (
              <button
                key={f.filename}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls="version-diff-panel"
                tabIndex={isActive ? 0 : -1}
                onClick={() => setSelectedFile(f.filename)}
                onKeyDown={(event) => {
                  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                  event.preventDefault();
                  const lastIndex = diffPayload.files.length - 1;
                  const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? lastIndex : event.key === "ArrowRight" ? (index + 1) % diffPayload.files.length : (index - 1 + diffPayload.files.length) % diffPayload.files.length;
                  setSelectedFile(diffPayload.files[nextIndex].filename);
                  requestAnimationFrame(() => fileTabListRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus());
                }}
                className={`flex min-h-11 items-center gap-1.5 rounded-t px-3 font-mono text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                  isActive ? "bg-[#2d2d2d] text-white border-b-2 border-primary" : "text-[#969696] hover:text-white"
                }`}
              >
                <FileCode className="h-3 w-3 text-primary" />
                <span>{f.filename}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Diff Editor Container */}
      <div id="version-diff-panel" role="tabpanel" aria-label={`${selectedFile} version comparison`} className="relative flex-1">
        {isLoading ? (
          <div className="h-full flex items-center justify-center gap-2 text-[#888888]">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm">Calculating diff comparison...</span>
          </div>
        ) : activeDiffFile ? (
          <DiffEditor
            height="100%"
            language={activeDiffFile.language || "html"}
            original={activeDiffFile.from_content}
            modified={activeDiffFile.to_content}
            theme="vs-dark"
            options={{
              fontSize: 13,
              fontFamily: "JetBrains Mono, Menlo, Monaco, monospace",
              readOnly: true,
              renderSideBySide: true,
              automaticLayout: true,
              scrollBeyondLastLine: false,
              minimap: { enabled: false },
            }}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-[#888888]">
            No differences found between selected versions.
          </div>
        )}
      </div>
    </div>
  );
};
