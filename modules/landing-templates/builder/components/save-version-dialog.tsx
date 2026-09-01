"use client";

import React, { useState } from "react";
import { GitCommit, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

interface SaveVersionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentVersion: string;
  onSave: (label: string, changelog: string) => Promise<void>;
}

export const SaveVersionDialog: React.FC<SaveVersionDialogProps> = ({
  open,
  onOpenChange,
  currentVersion,
  onSave,
}) => {
  const [label, setLabel] = useState("");
  const [changelog, setChangelog] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSave(label.trim(), changelog.trim());
      setLabel("");
      setChangelog("");
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitCommit className="h-5 w-5 text-primary" />
              <span>Mint New Version</span>
            </DialogTitle>
            <DialogDescription>
              Create an immutable snapshot version from your current draft. Current version is <strong>v{currentVersion}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="version-label">Version Label</Label>
              <Input
                id="version-label"
                placeholder="e.g. Hero Redesign & Mobile Improvements"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="version-changelog">Changelog & Notes</Label>
              <Textarea
                id="version-changelog"
                placeholder="Describe what changed in this version..."
                rows={4}
                value={changelog}
                onChange={(e) => setChangelog(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="gap-1.5">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitCommit className="h-4 w-4" />}
              <span>Save Version</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
