"use client";

import * as React from "react";
import { Layers3, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { SignupCatalogModule } from "@/modules/subscription/components/signup-catalog-selector";

type DemoScopeSelectorProps = {
  modules: SignupCatalogModule[];
  businessType: string;
  selectedModules: string[];
  selectedSubmodules: string[];
  onChange: (modules: string[], submodules: string[]) => void;
  disabled?: boolean;
  idPrefix?: string;
};

function supportsBusinessType(module: SignupCatalogModule, businessType: string) {
  return !module.business_types?.length || module.business_types.includes(businessType);
}

export function DemoScopeSelector({
  modules,
  businessType,
  selectedModules,
  selectedSubmodules,
  onChange,
  disabled = false,
  idPrefix = "demo-scope",
}: DemoScopeSelectorProps) {
  const [search, setSearch] = React.useState("");
  const helpId = `${idPrefix}-help`;
  const searchId = `${idPrefix}-search`;
  const normalizedSearch = search.trim().toLowerCase();
  const compatibleModules = React.useMemo(
    () => modules
      .filter((module) => supportsBusinessType(module, businessType))
      .filter((module) => {
        if (!normalizedSearch) return true;
        return [module.name, module.description, module.category]
          .some((value) => value?.toLowerCase().includes(normalizedSearch));
      })
      .sort((left, right) => left.name.localeCompare(right.name)),
    [businessType, modules, normalizedSearch],
  );

  const toggleModule = (module: SignupCatalogModule, checked: boolean) => {
    const moduleSubmodules = (module.submodules ?? []).map(
      (submodule) => `${module.slug}:${submodule.slug}`,
    );
    const nextModules = checked
      ? Array.from(new Set([...selectedModules, module.slug]))
      : selectedModules.filter((slug) => slug !== module.slug);
    const nextSubmodules = checked
      ? Array.from(new Set([...selectedSubmodules, ...moduleSubmodules]))
      : selectedSubmodules.filter((key) => !key.startsWith(`${module.slug}:`));

    onChange(nextModules, nextSubmodules);
  };

  const toggleSubmodule = (moduleSlug: string, submoduleSlug: string, checked: boolean) => {
    const key = `${moduleSlug}:${submoduleSlug}`;
    const nextModules = selectedModules.includes(moduleSlug)
      ? selectedModules
      : [...selectedModules, moduleSlug];
    const nextSubmodules = checked
      ? Array.from(new Set([...selectedSubmodules, key]))
      : selectedSubmodules.filter((selected) => selected !== key);

    onChange(nextModules, nextSubmodules);
  };

  return (
    <FieldSet aria-describedby={helpId}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
            <Layers3 aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <FieldLegend>Demo modules and sub-modules</FieldLegend>
            <FieldDescription id={helpId}>
              Parent modules control navigation. Sub-modules control the exact functionality available inside them.
            </FieldDescription>
          </div>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Current demo scope">
          <Badge variant="secondary">{selectedModules.length} modules</Badge>
          <Badge variant="outline">{selectedSubmodules.length} sub-modules</Badge>
        </div>
      </div>

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={searchId}>Find a module</FieldLabel>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id={searchId}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search the live catalog"
              className="h-11 pl-10"
              disabled={disabled}
            />
          </div>
        </Field>

        {compatibleModules.length ? (
          <ul className="grid min-w-0 gap-3 lg:grid-cols-2">
            {compatibleModules.map((module) => {
              const moduleId = `${idPrefix}-module-${module.slug}`;
              const moduleChecked = selectedModules.includes(module.slug);
              const submodules = module.submodules ?? [];

              return (
                <li key={module.slug} className="min-w-0 rounded-xl border bg-card p-3 shadow-xs">
                  <Field orientation="horizontal" className="min-h-11 items-start">
                    <Checkbox
                      id={moduleId}
                      checked={moduleChecked}
                      onCheckedChange={(checked) => toggleModule(module, checked === true)}
                      disabled={disabled}
                      aria-describedby={`${moduleId}-description`}
                    />
                    <FieldContent className="min-w-0">
                      <FieldLabel htmlFor={moduleId} className="min-h-11 cursor-pointer flex-wrap items-start">
                        <span className="min-w-0 break-words">{module.name}</span>
                        {module.category ? <Badge variant="outline">{module.category}</Badge> : null}
                      </FieldLabel>
                      <FieldDescription id={`${moduleId}-description`}>
                        {module.description || "Available in the live module catalog."}
                      </FieldDescription>
                    </FieldContent>
                  </Field>

                  {moduleChecked && submodules.length ? (
                    <FieldSet className="mt-3 gap-2 border-t pt-3">
                      <FieldLegend variant="label">Included sub-modules</FieldLegend>
                      <ul className="flex flex-col gap-1">
                        {submodules.map((submodule) => {
                          const key = `${module.slug}:${submodule.slug}`;
                          const childId = `${idPrefix}-submodule-${module.slug}-${submodule.slug}`;
                          return (
                            <li key={key}>
                              <Field orientation="horizontal" className="min-h-11 rounded-md px-2 py-1 hover:bg-muted/50">
                                <Checkbox
                                  id={childId}
                                  checked={selectedSubmodules.includes(key)}
                                  onCheckedChange={(checked) => toggleSubmodule(module.slug, submodule.slug, checked === true)}
                                  disabled={disabled}
                                />
                                <FieldLabel htmlFor={childId} className="min-h-11 flex-1 cursor-pointer items-center">
                                  {submodule.name}
                                </FieldLabel>
                              </Field>
                            </li>
                          );
                        })}
                      </ul>
                    </FieldSet>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No compatible modules match this search.
          </p>
        )}
      </FieldGroup>
    </FieldSet>
  );
}
