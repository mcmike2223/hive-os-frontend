"use client";

/**
 * The tenant-facing half of the Landing Library, shown at the top of
 * Settings → Landing Page.
 *
 * Two states:
 *  - the tenant is already on a library template  → show it as "Your template"
 *  - the tenant is on nothing                     → show what their business
 *    type entitles them to, so they can pick one
 *
 * Premium templates they cannot use yet arrive `locked` rather than hidden —
 * a tenant who cannot see a template can never decide to buy it.
 */

import * as React from "react";
import { CheckCircle2, Loader2, Lock, Sparkles, Store } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getBackendOrigin } from "@/lib/runtime-context";
import {
  fetchAvailableTemplates,
  selectTemplate,
  type TemplateLibraryCard,
} from "@/modules/landing-templates/lib/api";

type MarketplaceCard = TemplateLibraryCard & { locked?: boolean };

export function TenantTemplateMarketplace({ onSelected }: { onSelected?: () => void }) {
  const [templates, setTemplates] = React.useState<MarketplaceCard[]>([]);
  const [current, setCurrent] = React.useState<{ template_id: number | null; status: string } | null>(null);
  const [recommendedId, setRecommendedId] = React.useState<number | null>(null);
  const [businessLabel, setBusinessLabel] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selecting, setSelecting] = React.useState<number | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await fetchAvailableTemplates();
      setTemplates((data.templates ?? []) as MarketplaceCard[]);
      setCurrent(data.current ? { template_id: data.current.template_id, status: data.current.status } : null);
      setRecommendedId(data.recommended_template_id ?? null);
      setBusinessLabel(data.business_type_meta?.label ?? data.business_type ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your available templates.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const choose = async (template: MarketplaceCard) => {
    setSelecting(template.id);
    try {
      const { message } = await selectTemplate(template.id);
      toast.success(message ?? "Template selected.");
      await load();
      onSelected?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not select that template.");
    } finally {
      setSelecting(null);
    }
  };

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-56 rounded-[1.5rem]" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-between rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        <span>{error}</span>
        <Button variant="ghost" size="sm" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    );
  }

  const active = templates.find((t) => t.id === current?.template_id) ?? null;
  const others = templates.filter((t) => t.id !== current?.template_id);

  return (
    <div className="space-y-4 rounded-[2rem] border border-border/50 bg-card/40 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-black tracking-tight text-foreground">
            <Store className="h-5 w-5 text-primary" />
            {active ? "Your Landing Template" : "Choose a Landing Template"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {active
              ? "This is the design your public homepage is built on. Customize its content below."
              : `Designs available to ${businessLabel || "your business"}. Pick one to start from — you can customize everything afterwards.`}
          </p>
        </div>
        {businessLabel && (
          <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
            {businessLabel}
          </Badge>
        )}
      </div>

      {templates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 px-4 py-10 text-center">
          <p className="text-sm font-semibold text-foreground">No templates are available for your business type yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Contact your account manager to have designs assigned to {businessLabel || "your business type"}.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(active ? [active, ...others] : others).map((template) => (
            <MarketplaceTile
              key={template.id}
              template={template}
              isActive={template.id === current?.template_id}
              isRecommended={template.id === recommendedId}
              status={current?.status}
              busy={selecting === template.id}
              onChoose={() => void choose(template)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MarketplaceTile({
  template,
  isActive,
  isRecommended,
  status,
  busy,
  onChoose,
}: {
  template: MarketplaceCard;
  isActive: boolean;
  isRecommended: boolean;
  status?: string;
  busy: boolean;
  onChoose: () => void;
}) {
  const locked = !!template.locked;

  return (
    <Card
      className={cn(
        "overflow-hidden rounded-[1.5rem] border-border/50 bg-background/60",
        isActive && "border-primary/50 ring-1 ring-primary/30",
      )}
    >
      <div className="relative h-24 overflow-hidden border-b border-border/40">
        {template.thumbnail ? (
          <img
            src={`${getBackendOrigin()}${template.thumbnail}`}
            alt={template.name}
            className={cn("absolute inset-0 h-full w-full object-cover object-top", locked && "blur-[2px] saturate-50")}
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/15 to-transparent" />
        )}
        <div className="absolute right-2 top-2 flex gap-1.5">
          {isActive && <Badge className="border-transparent bg-primary text-primary-foreground">Active</Badge>}
          {!isActive && isRecommended && (
            <Badge variant="outline" className="border-white/25 bg-black/40 text-white">
              Recommended
            </Badge>
          )}
          {locked && (
            <Badge variant="outline" className="border-amber-400/40 bg-black/50 text-amber-200">
              <Lock className="mr-1 h-3 w-3" />
              Premium
            </Badge>
          )}
        </div>
      </div>

      <CardHeader className="space-y-1 p-4 pb-2">
        <h4 className="truncate text-sm font-black tracking-tight text-foreground">{template.name}</h4>
        <p className="line-clamp-2 min-h-[2rem] text-xs leading-5 text-muted-foreground">
          {template.description ?? "No description provided."}
        </p>
      </CardHeader>

      <CardContent className="p-4 pt-0">
        {isActive && status && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {status === "published" ? "Published" : "Draft"}
          </span>
        )}
      </CardContent>

      <CardFooter className="p-4 pt-0">
        {locked ? (
          <Button variant="outline" className="w-full gap-2 rounded-xl border-amber-500/40 text-amber-600 dark:text-amber-300" asChild>
            {/* /dashboard/billing does not exist — subscriptions is the real plan page. */}
            <a href="/dashboard/subscriptions">
              <Lock className="h-3.5 w-3.5" />
              Upgrade to unlock
            </a>
          </Button>
        ) : (
          <Button
            onClick={onChoose}
            disabled={busy || isActive}
            variant={isActive ? "outline" : "default"}
            className="w-full gap-2 rounded-xl"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {isActive ? "In use" : "Use this template"}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

export default TenantTemplateMarketplace;
