"use client";

import React, { useState } from "react";
import { ImageIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SecureAssetImage } from "@/components/ui/secure-asset-image";
import { FileManagerClient } from "@/components/dashboard/file-manager-client";
import { usePermissions } from "@/hooks/use-permissions";

type PickedFile = {
  media_details?: { public_url?: string; url?: string };
  url?: string;
  path?: string;
};

/**
 * Reusable image field backed by the platform File Manager. Lets the user upload
 * a new file or pick an existing one, and stores the file's ABSOLUTE public URL
 * (`/api/v1/files/{id}/public-serve`) so the image loads on any device, logged in
 * or not.
 */
export function MarketplaceImagePicker({
  value,
  onChange,
  label = "Image",
}: {
  value?: string | null;
  onChange: (url: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const { hasAnyPermission, hasPermission } = usePermissions();
  const canRead = hasAnyPermission(["view_storage", "manage_storage"]);
  const canManage = hasPermission("manage_storage");

  const handleSelect = (file: PickedFile) => {
    const url = file.media_details?.public_url || file.media_details?.url || file.url || file.path || "";
    onChange(url);
    setOpen(false);
  };

  return (
    <div className="space-y-1.5">
      {label && <Label className="text-xs font-bold text-muted-foreground">{label}</Label>}
      <div className="group relative h-28 overflow-hidden rounded-xl border bg-gradient-to-br from-muted/40 to-muted/10">
        {value ? (
          <>
            <SecureAssetImage src={value} alt={label} className="h-full w-full object-cover object-center" />
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)} className="rounded-full text-xs shadow-lg">Change</Button>
              <Button type="button" variant="destructive" size="sm" onClick={() => onChange("")} className="rounded-full text-xs shadow-lg">Remove</Button>
            </div>
          </>
        ) : (
          <button type="button" onClick={() => setOpen(true)} className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-muted-foreground/50 transition-colors hover:text-primary">
            <ImageIcon className="h-6 w-6" />
            <span className="text-[10px] font-medium">Choose / upload image</span>
          </button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[80vh] max-w-[1000px] flex-col overflow-hidden rounded-[2rem] p-0">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <div>
              <DialogTitle>Media Library</DialogTitle>
              <DialogDescription>Upload a new image or pick an existing one.</DialogDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="rounded-full"><X className="h-4 w-4" /></Button>
          </div>
          <div className="relative flex-1 overflow-hidden">
            <FileManagerClient isPickerMode onFileSelect={handleSelect} access={{ canRead, canManage }} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
