"use client";

import * as React from "react";
import { Building2, Loader2, Tag, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { assignTemplate, unassignTemplate, type TemplateAssignment, type TemplateLibraryCard } from "../lib/api";

type AssignTemplateDialogProps = {
  template: TemplateLibraryCard;
  businessTypes: { key: string; label: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssigned: () => void;
};

export function AssignTemplateDialog({ template, businessTypes, open, onOpenChange, onAssigned }: AssignTemplateDialogProps) {
  const [mode, setMode] = React.useState<"business_type" | "tenant">("business_type");
  const [businessType, setBusinessType] = React.useState<string>("");
  const [tenantId, setTenantId] = React.useState<string>("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const existing = (type: "business_type" | "tenant", id: string) =>
    template.assignments.some((a: TemplateAssignment) => a.type === type && a.id === id);

  const submit = async () => {
    const value = mode === "business_type" ? businessType : tenantId.trim();
    if (!value) {
      setError("Choose a business type or enter a tenant id.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (existing(mode, value)) {
        await unassignTemplate(template.id, { assignable_type: mode, assignable_id: value });
      } else {
        await assignTemplate(template.id, { assignable_type: mode, assignable_id: value });
      }
      onAssigned();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Assignment failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[1.75rem] border-border/60 bg-background/95 backdrop-blur-xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-space text-lg font-black uppercase tracking-tight">
            Assign “{template.name}”
          </DialogTitle>
          <DialogDescription>
            Grant this master template to a business type (all tenants in that category) or to one specific tenant.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode("business_type")}
              className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                mode === "business_type"
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/60 bg-background/50 text-muted-foreground hover:bg-background/80"
              }`}
            >
              <Tag className="h-4 w-4" /> Business type
            </button>
            <button
              type="button"
              onClick={() => setMode("tenant")}
              className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                mode === "tenant"
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/60 bg-background/50 text-muted-foreground hover:bg-background/80"
              }`}
            >
              <UserRound className="h-4 w-4" /> Tenant
            </button>
          </div>

          {mode === "business_type" ? (
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Business category</Label>
              <Select value={businessType || undefined} onValueChange={setBusinessType}>
                <SelectTrigger className="h-11 bg-background/75">
                  <SelectValue placeholder="Select a business type" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/60 shadow-xl">
                  {businessTypes.map((bt) => (
                    <SelectItem key={bt.key} value={bt.key}>
                      <span className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-primary" />
                        {bt.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Tenant id</Label>
              <Input
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                placeholder="e.g. bistro-demo"
                className="h-11 rounded-xl bg-background/75"
              />
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {template.assignments.slice(0, 8).map((a) => (
              <button
                key={`${a.type}-${a.id}`}
                type="button"
                onClick={() => {
                  if (a.type === "business_type") {
                    setMode("business_type");
                    setBusinessType(a.id);
                  } else {
                    setMode("tenant");
                    setTenantId(a.id);
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary"
              >
                {a.type === "business_type" ? <Tag className="h-3 w-3" /> : <UserRound className="h-3 w-3" />}
                {a.id}
              </button>
            ))}
          </div>

          {error && <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">{error}</div>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy} className="gap-2 rounded-xl">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? "Saving…" : "Save assignment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
