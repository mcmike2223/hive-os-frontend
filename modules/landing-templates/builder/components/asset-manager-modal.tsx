"use client";

import React, { useState, useEffect } from "react";
import { Upload, Trash2, Search, Image as ImageIcon, Copy, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TemplateAsset, fetchAssets, uploadAsset, deleteAsset } from "../../lib/api";

interface AssetManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId?: number;
  onSelectAsset?: (url: string) => void;
}

export const AssetManagerModal: React.FC<AssetManagerModalProps> = ({
  open,
  onOpenChange,
  templateId,
  onSelectAsset,
}) => {
  const [assets, setAssets] = useState<TemplateAsset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const loadAssets = async () => {
    setIsLoading(true);
    try {
      const res = await fetchAssets(templateId);
      setAssets(res.data);
    } catch (e) {
      console.error("Failed to load assets:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadAssets();
    }
  }, [open, templateId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const res = await uploadAsset(file, templateId, file.name);
      setAssets((prev) => [res.data, ...prev]);
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteAsset(id);
      setAssets((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      console.error("Delete failed:", e);
    }
  };

  const handleCopy = (url: string, id: number) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredAssets = assets.filter((a) =>
    a.filename.toLowerCase().includes(search.toLowerCase()) || (a.alt_text && a.alt_text.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-6 rounded-2xl">
        <DialogHeader className="flex flex-row items-center justify-between pb-4 border-b">
          <div>
            <DialogTitle className="text-lg font-bold">Media & Asset Manager</DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Upload images, graphics, and logos for use in your landing templates.
            </p>
          </div>

          <label className="cursor-pointer">
            <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={isUploading} />
            <Button size="sm" asChild disabled={isUploading} className="gap-1.5 shadow-sm">
              <span>
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                <span>Upload Media</span>
              </span>
            </Button>
          </label>
        </DialogHeader>

        <div className="flex items-center gap-3 py-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search media by filename..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 pl-9"
            />
          </div>
          <Badge variant="outline" className="text-xs font-mono">
            {assets.length} items
          </Badge>
        </div>

        <div className="flex-1 overflow-y-auto min-h-[300px]">
          {isLoading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-sm">Loading media gallery...</span>
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-border/60 rounded-2xl p-6 text-center text-muted-foreground">
              <ImageIcon className="h-10 w-10 stroke-[1.5] text-muted-foreground/60 mb-2" />
              <p className="text-sm font-medium text-foreground">No media assets found</p>
              <p className="text-xs text-muted-foreground mt-1">Upload an image to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filteredAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="group relative rounded-xl border border-border/60 overflow-hidden bg-card hover:border-primary/50 hover:shadow-md transition-all flex flex-col"
                >
                  <div className="aspect-video relative bg-muted/40 flex items-center justify-center overflow-hidden">
                    <img
                      src={asset.url}
                      alt={asset.alt_text || asset.filename}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-x-0 bottom-0 flex min-h-14 items-center justify-center gap-2 bg-slate-950/80 px-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                      {onSelectAsset && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-11 px-3 text-xs shadow-sm"
                          onClick={() => {
                            onSelectAsset(asset.url);
                            onOpenChange(false);
                          }}
                        >
                          Select
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-11 w-11"
                        title="Copy URL"
                        aria-label={`Copy URL for ${asset.alt_text || asset.filename}`}
                        onClick={() => handleCopy(asset.url, asset.id)}
                      >
                        {copiedId === asset.id ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        size="icon"
                        variant="destructive"
                        className="h-11 w-11"
                        title="Delete Media"
                        aria-label={`Delete ${asset.alt_text || asset.filename}`}
                        onClick={() => handleDelete(asset.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="p-2.5 flex flex-col justify-between flex-1">
                    <p className="text-xs font-medium truncate" title={asset.filename}>
                      {asset.filename}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
                      <span>{(asset.size_bytes / 1024).toFixed(1)} KB</span>
                      {asset.width && asset.height && (
                        <span>{asset.width}×{asset.height}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
