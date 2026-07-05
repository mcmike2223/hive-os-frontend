"use client";

import * as React from "react";
import { FolderOpen, Link as LinkIcon, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileManagerClient } from "@/components/dashboard/file-manager-client";
import { usePermissions } from "@/hooks/use-permissions";

type PickedFile = {
  name?: string;
  media_details?: { public_url?: string; url?: string };
  url?: string;
  path?: string;
};

/**
 * Resource input for LMS lessons. The user can paste a URL directly, OR open the
 * platform File Manager to upload a new file and pick it. Selecting a file stores
 * its public URL so the resource plays for both authenticated learners and public
 * course previews.
 */
export function LmsResourceField({
  id,
  value,
  onChange,
  placeholder = "https://... or pick from files",
}: {
  id?: string;
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const { hasAnyPermission, hasPermission } = usePermissions();
  const canRead = hasAnyPermission(["view_storage", "manage_storage"]);
  const canManage = hasPermission("manage_storage");

  const handleSelect = (file: PickedFile) => {
    const url =
      file.media_details?.public_url ||
      file.media_details?.url ||
      file.url ||
      file.path ||
      "";
    if (url) {
      onChange(url);
    }
    setOpen(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <LinkIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            id={id}
            type="url"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            className="pl-9"
          />
          {value ? (
            <button
              type="button"
              onClick={() => onChange("")}
              className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Clear resource URL"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
        {canRead ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(true)}
            className="shrink-0 gap-2"
          >
            <FolderOpen className="size-4" aria-hidden="true" />
            Browse files
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        Paste a link, or upload &amp; select a file from your File Manager.
      </p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[80vh] max-w-[1000px] flex-col overflow-hidden rounded-[2rem] p-0">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <div>
              <DialogTitle>File Manager</DialogTitle>
              <DialogDescription>Upload a new file or pick an existing one for this lesson.</DialogDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="rounded-full">
              <X className="size-4" />
            </Button>
          </div>
          <div className="relative flex-1 overflow-hidden">
            <FileManagerClient isPickerMode onFileSelect={handleSelect} access={{ canRead, canManage }} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
