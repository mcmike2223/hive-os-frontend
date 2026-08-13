"use client";

import * as React from "react";
import { Check, Layers, PlusCircle, Sparkles, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  TenantCatalogModule,
  TenantCustomModuleInput,
} from "@/modules/subscription/types";

type Props = {
  catalog: TenantCatalogModule[];
  selectedModules: string[];
  customModules: TenantCustomModuleInput[];
  onSelectedModulesChange: (next: string[]) => void;
  onCustomModulesChange: (next: TenantCustomModuleInput[]) => void;
  plan?: string;
  disabled?: boolean;
  purchaseLockedModules?: boolean;
  onLockedModuleRequest?: (module: TenantCatalogModule) => void;
  showCustomModules?: boolean;
};

const toneClasses: Record<string, string> = {
  rose: "border-rose-200 bg-rose-50/80 text-rose-700",
  violet: "border-violet-200 bg-violet-50/80 text-violet-700",
  sky: "border-sky-200 bg-sky-50/80 text-sky-700",
  amber: "border-amber-200 bg-amber-50/80 text-amber-700",
  emerald: "border-emerald-200 bg-emerald-50/80 text-emerald-700",
  cyan: "border-cyan-200 bg-cyan-50/80 text-cyan-700",
  indigo: "border-indigo-200 bg-indigo-50/80 text-indigo-700",
  orange: "border-orange-200 bg-orange-50/80 text-orange-700",
  lime: "border-lime-200 bg-lime-50/80 text-lime-700",
  teal: "border-teal-200 bg-teal-50/80 text-teal-700",
  slate: "border-slate-200 bg-slate-50/80 text-slate-700",
};

const createEmptyCustomModule = (): TenantCustomModuleInput => ({
  name: "",
  description: "",
  category: "Custom",
});

export function ModuleSubscriptionSelector({
  catalog,
  selectedModules,
  customModules,
  onSelectedModulesChange,
  onCustomModulesChange,
  plan,
  disabled = false,
  purchaseLockedModules = false,
  onLockedModuleRequest,
  showCustomModules = true,
}: Props) {
  const groupedCatalog = React.useMemo(() => {
    return catalog.reduce<Record<string, TenantCatalogModule[]>>((groups, module) => {
      const group = groups[module.category] ?? [];
      group.push(module);
      groups[module.category] = group;
      return groups;
    }, {});
  }, [catalog]);

  const toggleModule = (module: TenantCatalogModule) => {
    if (disabled) return;

    const slug = module.slug;
    const isLockedPaidAddon =
      purchaseLockedModules &&
      !selectedModules.includes(slug) &&
      !module.included_in_plan &&
      module.status !== "active";

    if (isLockedPaidAddon) {
      onLockedModuleRequest?.(module);
      return;
    }

    if (selectedModules.includes(slug)) {
      onSelectedModulesChange(selectedModules.filter((item) => item !== slug));
      return;
    }

    onSelectedModulesChange([...selectedModules, slug]);
  };

  const addCustomModule = () => {
    if (disabled) return;
    onCustomModulesChange([...customModules, createEmptyCustomModule()]);
  };

  const updateCustomModule = (
    index: number,
    key: keyof TenantCustomModuleInput,
    value: string
  ) => {
    const next = customModules.map((module, currentIndex) =>
      currentIndex === index ? { ...module, [key]: value } : module
    );
    onCustomModulesChange(next);
  };

  const removeCustomModule = (index: number) => {
    if (disabled) return;
    onCustomModulesChange(customModules.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleCardKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
    slug: string
  ) => {
    if (disabled) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const module = catalog.find((item) => item.slug === slug);
      if (module) {
        toggleModule(module);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h5 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Layers className="h-4 w-4 text-primary" /> Included Catalog Modules
            </h5>
            <p className="text-xs text-muted-foreground">
              Choose the built-in modules this tenant should be able to use.
            </p>
          </div>
          <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] uppercase tracking-widest">
            {selectedModules.length} selected
          </Badge>
        </div>

        <div className="space-y-4">
          {Object.entries(groupedCatalog).map(([category, modules]) => (
            <div key={category} className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-border/60" />
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted-foreground">
                  {category}
                </p>
                <div className="h-px flex-1 bg-border/60" />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {modules.map((module) => {
                  const checked = selectedModules.includes(module.slug);
                  const toneClass = toneClasses[module.tone] ?? toneClasses.slate;
                  const isRecommended = !!plan && module.recommended_plans.includes(plan.toLowerCase());
                  const isLockedPaidAddon =
                    purchaseLockedModules &&
                    !checked &&
                    !module.included_in_plan &&
                    module.status !== "active";

                  return (
                    <div
                      key={module.slug}
                      role="checkbox"
                      tabIndex={disabled ? -1 : 0}
                      aria-checked={checked}
                      aria-disabled={disabled}
                      onClick={() => toggleModule(module)}
                      onKeyDown={(event) => handleCardKeyDown(event, module.slug)}
                      className={cn(
                        "flex items-start gap-3 rounded-[1.5rem] border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                        checked
                          ? "border-primary/40 bg-primary/5 shadow-sm"
                          : "border-border/60 bg-background/80 hover:border-primary/20 hover:bg-muted/40",
                        isLockedPaidAddon ? "border-amber-300/50 bg-amber-50/40" : "",
                        disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"
                      )}
                    >
                      <div
                        aria-hidden="true"
                        className={cn(
                          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border transition-colors",
                          checked
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-transparent"
                        )}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-foreground">{module.name}</p>
                          <Badge variant="outline" className={cn("rounded-full px-2 py-0.5 text-[11px] uppercase tracking-widest", toneClass)}>
                            {module.category}
                          </Badge>
                          {isRecommended ? (
                            <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] uppercase tracking-widest text-emerald-700">
                              Recommended
                            </Badge>
                          ) : null}
                          {module.included_in_plan && !checked ? (
                            <Badge variant="outline" className="rounded-full border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] uppercase tracking-widest text-sky-700">
                              Included
                            </Badge>
                          ) : null}
                          {isLockedPaidAddon ? (
                            <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] uppercase tracking-widest text-amber-700">
                              ETB {Number(module.monthly_price_etb ?? 0).toFixed(0)}
                            </Badge>
                          ) : null}
                          {module.status === "pending" ? (
                            <Badge variant="outline" className="rounded-full border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] uppercase tracking-widest text-indigo-700">
                              Payment Pending
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          {module.description}
                        </p>
                        {isLockedPaidAddon ? (
                          <p className="text-[11px] font-semibold text-amber-700">
                            Tap to subscribe and unlock this addon.
                          </p>
                        ) : null}
                        {module.status === "pending" ? (
                          <p className="text-[11px] font-semibold text-indigo-700">
                            Payment is in progress for this module. It will activate automatically once confirmed.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showCustomModules ? (
        <div className="space-y-4 rounded-[1.5rem] border border-dashed border-border/70 bg-muted/20 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h5 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Sparkles className="h-4 w-4 text-amber-500" /> Custom Modules
            </h5>
            <p className="text-xs text-muted-foreground">
              Add tenant-specific addons beyond the built-in catalog, like internal tools or partner integrations.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addCustomModule}
            disabled={disabled}
            className="rounded-full"
          >
            <PlusCircle className="mr-2 h-4 w-4" /> Add Custom Module
          </Button>
        </div>

        {customModules.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No custom modules added yet.
          </p>
        ) : (
          <div className="space-y-3">
            {customModules.map((module, index) => (
              <div
                key={`custom-module-${index}`}
                className="space-y-3 rounded-[1.25rem] border border-border/60 bg-background/70 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 px-3 py-1 text-[11px] uppercase tracking-widest text-amber-700">
                    Custom Module {index + 1}
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCustomModule(index)}
                    disabled={disabled}
                    className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-widest text-muted-foreground">
                      Module Name
                    </Label>
                    <Input
                      value={module.name ?? ""}
                      onChange={(event) => updateCustomModule(index, "name", event.target.value)}
                      disabled={disabled}
                      placeholder="Audio Studio"
                      className="h-11 bg-background"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-widest text-muted-foreground">
                      Category
                    </Label>
                    <Input
                      value={module.category ?? ""}
                      onChange={(event) => updateCustomModule(index, "category", event.target.value)}
                      disabled={disabled}
                      placeholder="Custom"
                      className="h-11 bg-background"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-widest text-muted-foreground">
                    Description
                  </Label>
                  <Textarea
                    value={module.description ?? ""}
                    onChange={(event) => updateCustomModule(index, "description", event.target.value)}
                    disabled={disabled}
                    rows={3}
                    placeholder="Describe what this tenant-specific module does."
                    className="min-h-[92px] bg-background"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      ) : null}
    </div>
  );
}

