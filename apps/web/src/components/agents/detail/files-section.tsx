"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, File, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentFile } from "@/lib/types";
import { api } from "@/lib/api";

interface FilesSectionProps {
  agentId: string;
  files: AgentFile[];
  onFilesChange: (files: AgentFile[]) => void;
}

export function FilesSection({ agentId, files, onFilesChange }: FilesSectionProps) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      setUploading(true);
      try {
        const uploaded: AgentFile[] = [];
        for (const file of Array.from(fileList)) {
          const result = await api.uploadAgentFile(agentId, file);
          uploaded.push(result);
        }
        onFilesChange([...files, ...uploaded]);
      } catch {
        // upload failed silently for now
      } finally {
        setUploading(false);
      }
    },
    [agentId, files, onFilesChange]
  );

  const handleDelete = useCallback(
    async (fileId: string) => {
      try {
        await api.deleteAgentFile(agentId, fileId);
        onFilesChange(files.filter((f) => f.id !== fileId));
      } catch {
        // delete failed
      }
    },
    [agentId, files, onFilesChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      handleUpload(e.dataTransfer.files);
    },
    [handleUpload]
  );

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.15em]">
        Knowledge
      </h3>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 cursor-pointer transition-colors",
          dragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-muted-foreground/50"
        )}
      >
        {uploading ? (
          <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
        ) : (
          <Upload className="h-6 w-6 text-muted-foreground" />
        )}
        <p className="text-sm text-muted-foreground">
          {uploading
            ? "Uploading..."
            : "Drop files here or click to upload"}
        </p>
        <p className="text-xs text-muted-foreground/60">
          PDF, TXT, MD, JSON up to 10MB
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.txt,.md,.json,.csv,.doc,.docx"
          onChange={(e) => handleUpload(e.target.files)}
          className="hidden"
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-1">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card/50 px-3 py-2 group"
            >
              <File className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-foreground truncate flex-1">
                {file.filename}
              </span>
              {file.fileSize && (
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatSize(file.fileSize)}
                </span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(file.id);
                }}
                className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
