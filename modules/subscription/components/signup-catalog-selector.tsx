"use client";

import Link from "next/link";
import { Check, ExternalLink, Layers3, LayoutTemplate, LockKeyhole, Puzzle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type SignupCatalogSubmodule = {
  slug: string;
  name: string;
};

export type SignupCatalogModule = {
  slug: string;
  name: string;
  description?: string;
  category?: string;
  tone?: string;
  recommended_plans?: string[];
  business_types?: string[];
  monthly_price_etb?: number | string;
  billing_type?: "module" | "addon";
  is_addon?: boolean;
  submodules?: SignupCatalogSubmodule[];
  submodule_count?: number;
};

export type SignupLandingTemplate = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  categories?: string[];
  tags?: string[];
  compatibility_score?: number;
  current_version?: string;
  current_version_id?: number;
  is_premium: boolean;
  required_module?: string | null;
  business_types: string[];
  preview_url: string;
};

type ModuleSelectionProps = {
  modules: SignupCatalogModule[];
  plan: string;
  businessType: string;
  planDefaults: Record<string, string[]>;
  selectedModules: string[];
  onSelectedModulesChange: (modules: string[]) => void;
};

function supportsBusinessType(module: SignupCatalogModule, businessType: string) {
  return !module.business_types?.length || module.business_types.includes(businessType);
}

function formatModulePrice(module: SignupCatalogModule) {
  const price = Number(module.monthly_price_etb ?? 0);
  return price > 0 ? `ETB ${price.toLocaleString()}/month` : "Included at no extra cost";
}

function SubmoduleList({ module }: { module: SignupCatalogModule }) {
  const submodules = module.submodules ?? [];

  if (!submodules.length) {
    return <p className="mt-2 text-xs text-muted-foreground">No separate sub-modules.</p>;
  }

  return (
    <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={`${module.name} sub-modules`}>
      {submodules.map((submodule) => (
        <li
          key={`${module.slug}-${submodule.slug}`}
          className="rounded-full border border-slate-500 bg-background px-2.5 py-1 text-[11px] font-semibold text-foreground"
        >
          {submodule.name}
        </li>
      ))}
    </ul>
  );
}

export function SignupModuleSelection({
  modules,
  plan,
  businessType,
  planDefaults,
  selectedModules,
  onSelectedModulesChange,
}: ModuleSelectionProps) {
  const includedSlugs = new Set(planDefaults[plan] ?? []);
  const compatibleModules = modules.filter((module) => supportsBusinessType(module, businessType));
  const includedModules = compatibleModules.filter((module) => includedSlugs.has(module.slug));
  const optionalModules = compatibleModules
    .filter((module) => !includedSlugs.has(module.slug))
    .sort((a, b) => {
      const aRecommended = a.recommended_plans?.includes(plan) ? 1 : 0;
      const bRecommended = b.recommended_plans?.includes(plan) ? 1 : 0;
      return bRecommended - aRecommended || a.name.localeCompare(b.name);
    });

  const toggleModule = (slug: string, checked: boolean) => {
    const next = checked
      ? Array.from(new Set([...selectedModules, slug]))
      : selectedModules.filter((selected) => selected !== slug);
    onSelectedModulesChange(next);
  };

  return (
    <section aria-labelledby="signup-modules-heading" className="rounded-[2rem] border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Layers3 className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h3 id="signup-modules-heading" className="text-base font-black text-foreground">
            Modules and sub-modules
          </h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Your plan includes {includedModules.length} compatible modules. Add optional capabilities now or later from Module Subscriptions.
          </p>
        </div>
      </div>

      <details className="group mt-5 rounded-2xl border border-slate-500 bg-background">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
          <span>Review included modules and sub-modules</span>
          <Badge variant="outline" className="border-slate-500 bg-background text-foreground">
            {includedModules.length} included
          </Badge>
        </summary>
        <ul className="grid gap-3 border-t border-slate-500 p-4 md:grid-cols-2">
          {includedModules.map((module) => (
            <li key={module.slug} className="rounded-2xl border border-slate-500 bg-muted/20 p-4">
              <div className="flex items-start gap-3">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="font-bold text-foreground">{module.name}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{module.description}</p>
                  <SubmoduleList module={module} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </details>

      {optionalModules.length ? (
        <fieldset className="mt-5">
          <legend className="text-sm font-black text-foreground">Optional modules</legend>
          <p id="optional-modules-help" className="mt-1 text-xs leading-5 text-muted-foreground">
            Prices are added to the monthly plan total. Choices incompatible with the selected business type are excluded automatically.
          </p>
          <ul className="mt-3 grid gap-3 md:grid-cols-2" aria-describedby="optional-modules-help">
            {optionalModules.map((module) => {
              const inputId = `signup-module-${module.slug}`;
              const checked = selectedModules.includes(module.slug);

              return (
                <li key={module.slug}>
                  <input
                    id={inputId}
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => toggleModule(module.slug, event.target.checked)}
                    className="peer sr-only"
                  />
                  <label
                    htmlFor={inputId}
                    className={cn(
                      "block min-h-11 cursor-pointer rounded-2xl border border-slate-500 bg-background p-4 transition-colors",
                      "peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2",
                      checked && "border-primary bg-primary/10",
                    )}
                  >
                    <span className="flex items-start gap-3">
                      <span
                        aria-hidden="true"
                        className={cn(
                          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-slate-600 bg-background",
                          checked && "border-primary bg-primary text-primary-foreground",
                        )}
                      >
                        {checked ? <Check className="h-3.5 w-3.5" /> : null}
                      </span>
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-foreground">{module.name}</span>
                          {module.recommended_plans?.includes(plan) ? (
                            <Badge variant="outline" className="border-emerald-700 text-emerald-800 dark:text-emerald-300">
                              Recommended
                            </Badge>
                          ) : null}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-muted-foreground">{module.description}</span>
                        <span className="mt-2 block text-xs font-bold text-foreground">{formatModulePrice(module)}</span>
                        <SubmoduleList module={module} />
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      ) : null}
    </section>
  );
}

type TemplateSelectionProps = {
  templates: SignupLandingTemplate[];
  modules: SignupCatalogModule[];
  businessType: string;
  plan: string;
  planDefaults: Record<string, string[]>;
  selectedTemplateId: number | null;
  onSelectedTemplateChange: (templateId: number | null) => void;
};

export function SignupLandingTemplateSelection({
  templates,
  modules,
  businessType,
  plan,
  planDefaults,
  selectedTemplateId,
  onSelectedTemplateChange,
}: TemplateSelectionProps) {
  const compatibleTemplates = templates.filter((template) => template.business_types.includes(businessType));
  const includedModules = new Set(planDefaults[plan] ?? []);
  const moduleMap = new Map(modules.map((module) => [module.slug, module]));

  return (
    <fieldset className="rounded-[2rem] border border-border bg-card p-5 shadow-sm" aria-describedby="landing-template-help">
      <legend className="px-2 text-base font-black text-foreground">Landing page template (optional)</legend>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <LayoutTemplate className="h-5 w-5" aria-hidden="true" />
        </div>
        <p id="landing-template-help" className="text-sm leading-6 text-muted-foreground">
          Select a master template assigned to this business type. A private draft is created only after payment is confirmed, ready to edit and publish.
        </p>
      </div>

      <ul className="mt-4 grid gap-3 md:grid-cols-2">
        <li>
          <input
            id="landing-template-none"
            type="radio"
            name="landing-template"
            checked={selectedTemplateId === null}
            onChange={() => onSelectedTemplateChange(null)}
            className="peer sr-only"
          />
          <label
            htmlFor="landing-template-none"
            className={cn(
              "flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border border-slate-500 bg-background p-4",
              "peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2",
              selectedTemplateId === null && "border-primary bg-primary/10",
            )}
          >
            <Puzzle className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span>
              <span className="block font-bold text-foreground">Choose later</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">Start with the business-type default and browse templates from your dashboard later.</span>
            </span>
          </label>
        </li>

        {compatibleTemplates.map((template) => {
          const inputId = `landing-template-${template.id}`;
          const checked = selectedTemplateId === template.id;
          const requiredModule = template.required_module ? moduleMap.get(template.required_module) : null;
          const extraPrice = requiredModule && !includedModules.has(requiredModule.slug)
            ? Number(requiredModule.monthly_price_etb ?? 0)
            : 0;

          return (
            <li key={template.id} className="rounded-2xl border border-slate-500 bg-background p-1">
              <input
                id={inputId}
                type="radio"
                name="landing-template"
                checked={checked}
                onChange={() => onSelectedTemplateChange(template.id)}
                className="peer sr-only"
              />
              <label
                htmlFor={inputId}
                className={cn(
                  "block min-h-11 cursor-pointer rounded-xl p-3 transition-colors",
                  "peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2",
                  checked && "bg-primary/10",
                )}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-foreground">{template.name}</span>
                      {template.is_premium ? (
                        <Badge variant="outline" className="border-amber-700 text-amber-800 dark:text-amber-300">
                          <LockKeyhole className="mr-1 h-3 w-3" aria-hidden="true" /> Premium
                        </Badge>
                      ) : null}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">{template.description}</span>
                    <span className="mt-2 block text-xs font-bold text-foreground">
                      {extraPrice > 0 ? `Adds ETB ${extraPrice.toLocaleString()}/month` : "Included with this plan"}
                    </span>
                  </span>
                  <span aria-hidden="true" className={cn("mt-1 h-4 w-4 rounded-full border border-slate-600", checked && "border-4 border-primary")} />
                </span>
              </label>
              <Link
                href={template.preview_url}
                target="_blank"
                rel="noreferrer"
                className="mx-3 mb-3 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-bold text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                Preview {template.name} <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>

      {!compatibleTemplates.length ? (
        <p className="mt-4 rounded-2xl border border-slate-500 bg-muted/20 p-4 text-sm leading-6 text-muted-foreground">
          No published template is assigned to this business type yet. A central administrator can assign one from Landing Pages → Template Library.
        </p>
      ) : null}
    </fieldset>
  );
}
