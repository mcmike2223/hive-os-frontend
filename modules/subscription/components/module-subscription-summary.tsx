"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TenantSelectedModule } from "@/modules/subscription/types";

type Props = {
  modules?: TenantSelectedModule[] | null;
  emptyLabel?: string;
  maxVisible?: number;
  className?: string;
};

export function ModuleSubscriptionSummary({
  modules,
  emptyLabel = "No modules enabled",
  maxVisible = 4,
  className,
}: Props) {
  const activeModules = modules ?? [];

  if (activeModules.length === 0) {
    return <p className={cn("text-xs text-muted-foreground", className)}>{emptyLabel}</p>;
  }

  const visibleModules = activeModules.slice(0, maxVisible);
  const remainingCount = activeModules.length - visibleModules.length;

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {visibleModules.map((module) => (
        <Badge
          key={`${module.source}-${module.slug}`}
          variant="outline"
          className={cn(
            "rounded-full border-border/60 bg-background/80 px-3 py-1 text-[11px] uppercase tracking-widest",
            module.source === "custom" ? "text-amber-600" : "text-foreground/80"
          )}
        >
          {module.name}
        </Badge>
      ))}
      {remainingCount > 0 ? (
        <Badge
          variant="outline"
          className="rounded-full border-border/60 bg-muted/40 px-3 py-1 text-[11px] uppercase tracking-widest text-muted-foreground"
        >
          +{remainingCount} more
        </Badge>
      ) : null}
    </div>
  );
}

