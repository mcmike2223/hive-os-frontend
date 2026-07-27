"use client";

import React, { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpenCheck,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  Pencil,
  Search,
  Settings2,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAuthHeaders, getBackendApiRoot, getWorkspaceScopeKey } from "@/lib/runtime-context";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

type CatalogDefinition = {
  slug: string;
  name: string;
  group: string;
  sensitive?: boolean;
  parent_catalog?: string;
  fields?: Array<{ key: string; label: string; type: "text" | "textarea" | "number" | "date" | "url" | "boolean" | "select"; required?: boolean; options?: Record<string, string> }>;
};

type LocalizedName = { en?: string; am?: string };

type ReferenceValue = {
  id: number;
  catalog: string;
  code: string | null;
  name: LocalizedName;
  description: string | null;
  parent_id: number | null;
  parent?: { id: number; name: LocalizedName } | null;
  is_active: boolean;
  is_system: boolean;
  sort_order: number;
  metadata?: Record<string, string | number | boolean | null>;
};

type PaginatedReferences = {
  data: ReferenceValue[];
  meta: { current_page: number; last_page: number; total: number; from?: number; to?: number };
};

type ReferenceOption = {
  value: number;
  code: string | null;
  label: LocalizedName;
  parent_id: number | null;
};

type ReferenceForm = {
  code: string;
  name: string;
  description: string;
  parent_id: string;
  sort_order: string;
  is_active: boolean;
  metadata: Record<string, string | number | boolean>;
};

const EMPTY_FORM: ReferenceForm = {
  code: "",
  name: "",
  description: "",
  parent_id: "",
  sort_order: "0",
  is_active: true,
  metadata: {},
};

const GROUP_LABELS: Record<string, string> = {
  organization: "Organization",
  employment: "Employment",
  personal: "Personal details",
  geography: "Geography",
  education: "Education and skills",
  employee: "Employee records",
  financial: "Financial",
  documents: "Documents",
  safety: "Safety and incidents",
  leave: "Leave and absence",
  calendar: "Calendar",
  integration: "Integrations",
  localization: "Languages and translations",
  experience: "Experience and branding",
};

async function hrSettingsFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${getBackendApiRoot()}/hr/settings${path}`, {
    ...options,
    headers: {
      ...getAuthHeaders(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const validationMessage = payload?.errors
      ? Object.values(payload.errors).flat().find((message) => typeof message === "string")
      : null;
    throw new Error(
      typeof validationMessage === "string"
        ? validationMessage
        : payload?.message || `The settings request failed with status ${response.status}.`,
    );
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

function displayName(name?: LocalizedName | null): string {
  return name?.en?.trim() || name?.am?.trim() || "Unnamed value";
}

export function ErpReferenceSettings({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const workspaceScope = getWorkspaceScopeKey();
  const [selectedCatalog, setSelectedCatalog] = useState("");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingValue, setEditingValue] = useState<ReferenceValue | null>(null);
  const [form, setForm] = useState<ReferenceForm>(EMPTY_FORM);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (formError) document.getElementById("erp-reference-form-error")?.focus();
  }, [formError]);

  const catalogsQuery = useQuery({
    queryKey: ["hr-settings-catalogs", workspaceScope],
    queryFn: () => hrSettingsFetch<{ data: CatalogDefinition[] }>("/catalogs"),
  });
  const catalogs = catalogsQuery.data?.data ?? [];

  useEffect(() => {
    if (!selectedCatalog && catalogs.length > 0) setSelectedCatalog(catalogs[0].slug);
  }, [catalogs, selectedCatalog]);

  const selectedDefinition = catalogs.find((catalog) => catalog.slug === selectedCatalog);
  const groupedCatalogs = useMemo(
    () => Object.entries(
      catalogs.reduce<Record<string, CatalogDefinition[]>>((groups, catalog) => {
        (groups[catalog.group] ??= []).push(catalog);
        return groups;
      }, {}),
    ),
    [catalogs],
  );

  const valuesQuery = useQuery({
    queryKey: ["hr-settings-values", workspaceScope, selectedCatalog, deferredSearch, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), per_page: "25" });
      if (deferredSearch) params.set("search", deferredSearch);
      return hrSettingsFetch<PaginatedReferences>(`/${selectedCatalog}?${params.toString()}`);
    },
    enabled: Boolean(selectedCatalog),
    placeholderData: (previous) => previous,
  });

  const parentOptionsQuery = useQuery({
    queryKey: ["hr-settings-options", workspaceScope, selectedDefinition?.parent_catalog],
    queryFn: () => hrSettingsFetch<{ data: ReferenceOption[] }>(`/${selectedDefinition?.parent_catalog}/options`),
    enabled: Boolean(selectedDefinition?.parent_catalog && dialogOpen),
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        code: form.code || null,
        name: form.name.trim(),
        description: form.description.trim() || null,
        parent_id: form.parent_id ? Number(form.parent_id) : null,
        sort_order: Number(form.sort_order) || 0,
        is_active: form.is_active,
        metadata: form.metadata,
      };
      return hrSettingsFetch(
        `/${selectedCatalog}${editingValue ? `/${editingValue.id}` : ""}`,
        { method: editingValue ? "PATCH" : "POST", body: JSON.stringify(payload) },
      );
    },
    onSuccess: () => {
      toast.success(editingValue ? "Reference value updated." : "Reference value created.");
      setDialogOpen(false);
      setFormError("");
      queryClient.invalidateQueries({ queryKey: ["hr-settings-values", workspaceScope, selectedCatalog] });
      queryClient.invalidateQueries({ queryKey: ["hr-settings-options", workspaceScope, selectedCatalog] });
    },
    onError: (error) => setFormError(getErrorMessage(error, "The reference value could not be saved.")),
  });

  const deleteMutation = useMutation({
    mutationFn: (value: ReferenceValue) => hrSettingsFetch(`/${selectedCatalog}/${value.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Reference value deleted.");
      queryClient.invalidateQueries({ queryKey: ["hr-settings-values", workspaceScope, selectedCatalog] });
      queryClient.invalidateQueries({ queryKey: ["hr-settings-options", workspaceScope, selectedCatalog] });
    },
    onError: (error) => toast.error(getErrorMessage(error, "The reference value could not be deleted.")),
  });

  const openCreate = () => {
    setEditingValue(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setDialogOpen(true);
  };

  const openEdit = (value: ReferenceValue) => {
    setEditingValue(value);
    setForm({
      code: value.code ?? "",
      name: value.name.en ?? "",
      description: value.description ?? "",
      parent_id: value.parent_id ? String(value.parent_id) : "",
      sort_order: String(value.sort_order),
      is_active: value.is_active,
      metadata: Object.fromEntries(Object.entries(value.metadata ?? {}).map(([key, item]) => [key, item ?? ""])),
    });
    setFormError("");
    setDialogOpen(true);
  };

  const removeValue = (value: ReferenceValue) => {
    if (value.is_system) return;
    if (window.confirm(`Delete “${displayName(value.name)}”? This action cannot be undone.`)) {
      deleteMutation.mutate(value);
    }
  };

  const meta = valuesQuery.data?.meta;
  const values = valuesQuery.data?.data ?? [];

  return (
    <section aria-labelledby="erp-reference-settings-title" className="space-y-5">
      <Card className="overflow-hidden rounded-[2rem] border-border/60 bg-card/70 shadow-sm">
        <div className="grid gap-px border-b border-border/60 bg-border/60 sm:grid-cols-3">
          <div className="bg-card px-5 py-4 sm:px-7"><p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">ERP parity</p><p className="mt-1 text-2xl font-black text-foreground">{catalogs.length}</p><p className="text-xs text-muted-foreground">settings domains available</p></div>
          <div className="bg-card px-5 py-4 sm:px-7"><p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Coverage</p><p className="mt-1 text-2xl font-black text-emerald-700 dark:text-emerald-300">Complete</p><p className="text-xs text-muted-foreground">legacy settings mapped</p></div>
          <div className="bg-slate-900 px-5 py-4 text-white dark:bg-amber-300 dark:text-slate-950 sm:px-7"><div className="flex items-center gap-2"><Sparkles aria-hidden="true" className="h-4 w-4"/><p className="text-xs font-bold uppercase tracking-[0.14em]">Hive enhanced</p></div><p className="mt-1 text-sm font-semibold">Tenant-safe API, bilingual names, validation and history-ready records.</p></div>
        </div>
        <header className="flex flex-col gap-4 border-b border-border/60 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950">
              <BookOpenCheck aria-hidden="true" className="h-5 w-5 text-amber-700 dark:text-amber-300" />
            </div>
            <div>
              <h2 id="erp-reference-settings-title" className="text-xl font-black tracking-tight text-foreground sm:text-2xl">
                ERP reference data
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Manage the controlled values used by employee, payroll, attendance, recruitment, and finance workflows.
              </p>
            </div>
          </div>
          {canManage && (
            <Button onClick={openCreate} disabled={!selectedDefinition} className="min-h-11 rounded-xl bg-slate-900 px-5 text-white hover:bg-slate-800 focus-visible:ring-slate-700 dark:bg-amber-300 dark:text-slate-950 dark:hover:bg-amber-200 dark:focus-visible:ring-amber-300">
              <CirclePlus aria-hidden="true" className="mr-2 h-4 w-4" /> Add value
            </Button>
          )}
        </header>

        <div className="grid min-h-[620px] grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)]">
          <nav aria-label="ERP settings categories" className="border-b border-border/60 bg-muted/20 p-3 lg:border-b-0 lg:border-r">
            {catalogsQuery.isLoading ? (
              <p role="status" className="p-4 text-sm text-muted-foreground">Loading settings categories…</p>
            ) : catalogsQuery.isError ? (
              <p className="p-4 text-sm text-destructive">Settings categories could not be loaded.</p>
            ) : (
              <div className="max-h-[580px] space-y-5 overflow-y-auto pr-1">
                {groupedCatalogs.map(([group, entries]) => (
                  <div key={group}>
                    <h3 className="mb-2 px-3 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                      {GROUP_LABELS[group] ?? group}
                    </h3>
                    <ul className="space-y-1">
                      {entries.map((catalog) => (
                        <li key={catalog.slug}>
                          <button
                            type="button"
                            onClick={() => { setSelectedCatalog(catalog.slug); setPage(1); setSearch(""); }}
                            aria-current={selectedCatalog === catalog.slug ? "page" : undefined}
                            className={cn(
                              "flex min-h-11 w-full min-w-0 items-center rounded-xl border px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                              selectedCatalog === catalog.slug
                                ? "border-amber-700 bg-amber-50 text-foreground dark:border-amber-300 dark:bg-amber-950"
                                : "border-transparent text-muted-foreground hover:border-border hover:bg-background hover:text-foreground",
                            )}
                          >
                            <span className="min-w-0 break-words leading-5">{catalog.name}</span>
                            {catalog.sensitive && <span className="sr-only">Sensitive data category</span>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </nav>

          <div className="min-w-0 p-4 sm:p-6">
            <div className="mb-5 space-y-4">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-foreground">{selectedDefinition?.group ?? "Settings"}</p>
                <h3 className="mt-1 text-lg font-bold text-foreground">{selectedDefinition?.name ?? "Choose a category"}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {meta ? `${meta.total} configured value${meta.total === 1 ? "" : "s"}` : "Select a category to manage its values."}
                </p>
              </div>
              <div className="w-full">
                <Label htmlFor="erp-settings-search">Search this category</Label>
                <div className="relative mt-2">
                  <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="erp-settings-search"
                    type="search"
                    value={search}
                    onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                    className="h-11 border-slate-500 pl-10 focus-visible:ring-slate-700 dark:border-slate-400 dark:focus-visible:ring-amber-300"
                    placeholder="Search by name, code, or description"
                  />
                </div>
              </div>
            </div>

            {valuesQuery.isLoading ? (
              <div role="status" className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">Loading reference values…</div>
            ) : valuesQuery.isError ? (
              <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5">
                <h4 className="font-bold text-destructive">Reference values could not be loaded</h4>
                <p className="mt-1 text-sm text-muted-foreground">Check the Human Resources subscription and your HR settings permission, then try again.</p>
                <Button variant="outline" className="mt-4 border-slate-500 dark:border-slate-400" onClick={() => valuesQuery.refetch()}>Try again</Button>
              </div>
            ) : values.length === 0 ? (
              <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/10 p-8 text-center">
                <Settings2 aria-hidden="true" className="h-9 w-9 text-muted-foreground" />
                <h4 className="mt-4 text-base font-bold text-foreground">No values found</h4>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  {deferredSearch ? "Change the search text to see more results." : "Add the first controlled value for this category."}
                </p>
                {canManage && !deferredSearch && <Button onClick={openCreate} className="mt-4 bg-slate-900 text-white hover:bg-slate-800 dark:bg-amber-300 dark:text-slate-950 dark:hover:bg-amber-200">Add first value</Button>}
              </div>
            ) : (
              <>
                <Table>
                  <TableCaption className="sr-only">
                    {selectedDefinition?.name} values, including code, parent, status, and available actions.
                  </TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">Name</TableHead>
                      <TableHead scope="col">Code</TableHead>
                      <TableHead scope="col">Parent</TableHead>
                      <TableHead scope="col">Status</TableHead>
                      {canManage && <TableHead scope="col" className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {values.map((value) => (
                      <TableRow key={value.id}>
                        <TableCell className="min-w-52 whitespace-normal">
                          <div className="font-semibold text-foreground">{displayName(value.name)}</div>
                          {value.name.am && <div lang="am" className="mt-0.5 text-xs text-muted-foreground">{value.name.am}</div>}
                          {value.description && <div className="mt-1 line-clamp-1 text-xs text-muted-foreground">{value.description}</div>}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{value.code || "—"}</TableCell>
                        <TableCell>{displayName(value.parent?.name) === "Unnamed value" ? "—" : displayName(value.parent?.name)}</TableCell>
                        <TableCell>
                          <span className={cn(
                            "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                            value.is_active ? "border-emerald-700 bg-emerald-50 text-emerald-800 dark:border-emerald-500 dark:bg-emerald-950 dark:text-emerald-200" : "border-border bg-muted text-muted-foreground",
                          )}>
                            {value.is_active ? "Active" : "Inactive"}
                          </span>
                        </TableCell>
                        {canManage && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEdit(value)} aria-label={`Edit ${displayName(value.name)}`} className="focus-visible:ring-slate-700 dark:focus-visible:ring-amber-300">
                                <Pencil aria-hidden="true" className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeValue(value)}
                                disabled={value.is_system || deleteMutation.isPending}
                                aria-label={`Delete ${displayName(value.name)}`}
                                className="text-red-700 hover:text-red-800 focus-visible:ring-slate-700 dark:text-red-300 dark:hover:text-red-200 dark:focus-visible:ring-amber-300"
                              >
                                <Trash2 aria-hidden="true" className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {meta && meta.last_page > 1 && (
                  <div className="mt-5 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">Page {meta.current_page} of {meta.last_page}</p>
                    <div className="flex gap-2">
                      <Button variant="outline" className="border-slate-500 dark:border-slate-400" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={meta.current_page <= 1}>
                        <ChevronLeft aria-hidden="true" className="mr-1 h-4 w-4" /> Previous
                      </Button>
                      <Button variant="outline" className="border-slate-500 dark:border-slate-400" onClick={() => setPage((current) => Math.min(meta.last_page, current + 1))} disabled={meta.current_page >= meta.last_page}>
                        Next <ChevronRight aria-hidden="true" className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingValue ? `Edit ${displayName(editingValue.name)}` : `Add ${selectedDefinition?.name ?? "reference value"}`}</DialogTitle>
            <DialogDescription>
              These values are shared by ERP forms and reports in this workspace. Enter the primary name used by your organization.
            </DialogDescription>
          </DialogHeader>

          <form
            id="erp-reference-form"
            onSubmit={(event) => { event.preventDefault(); setFormError(""); saveMutation.mutate(); }}
            className="grid gap-5 py-2 sm:grid-cols-2"
          >
            {formError && (
              <div id="erp-reference-form-error" tabIndex={-1} className="rounded-xl border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive sm:col-span-2">
                {formError}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="reference-name">Name <span aria-hidden="true">*</span></Label>
              <Input
                id="reference-name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                required
                aria-invalid={Boolean(formError)}
                aria-describedby={formError ? "erp-reference-form-error" : undefined}
                autoFocus
                className="border-slate-500 focus-visible:ring-slate-700 dark:border-slate-400 dark:focus-visible:ring-amber-300"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reference-code">Code</Label>
              <Input
                id="reference-code"
                value={form.code}
                onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
                aria-describedby="reference-code-help"
                className="border-slate-500 focus-visible:ring-slate-700 dark:border-slate-400 dark:focus-visible:ring-amber-300"
              />
              <p id="reference-code-help" className="text-xs text-muted-foreground">Optional stable code for imports and integrations.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reference-sort-order">Display order</Label>
              <Input
                id="reference-sort-order"
                type="number"
                min="0"
                max="1000000"
                inputMode="numeric"
                value={form.sort_order}
                onChange={(event) => setForm((current) => ({ ...current, sort_order: event.target.value }))}
                className="border-slate-500 focus-visible:ring-slate-700 dark:border-slate-400 dark:focus-visible:ring-amber-300"
              />
            </div>
            {selectedDefinition?.parent_catalog && (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="reference-parent">Parent {catalogs.find((item) => item.slug === selectedDefinition.parent_catalog)?.name}</Label>
                <Select value={form.parent_id || "none"} onValueChange={(value) => setForm((current) => ({ ...current, parent_id: value === "none" ? "" : value }))}>
                  <SelectTrigger id="reference-parent" aria-describedby="reference-parent-help" className="border-slate-500 focus-visible:ring-slate-700 dark:border-slate-400 dark:focus-visible:ring-amber-300">
                    <SelectValue placeholder="Choose a parent value" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No parent</SelectItem>
                    {(parentOptionsQuery.data?.data ?? []).map((option) => (
                      <SelectItem key={option.value} value={String(option.value)}>{displayName(option.label)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p id="reference-parent-help" className="text-xs text-muted-foreground">Connect this value to the correct geographic parent.</p>
              </div>
            )}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="reference-description">Description</Label>
              <textarea
                id="reference-description"
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                rows={3}
                className="flex w-full rounded-md border border-slate-500 bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-slate-700 dark:border-slate-400 dark:focus-visible:ring-amber-300"
              />
            </div>
            {(selectedDefinition?.fields ?? []).map((field) => {
              const fieldId = `reference-metadata-${field.key}`;
              const value = form.metadata[field.key] ?? (field.type === "boolean" ? false : "");
              if (field.type === "boolean") return (
                <div key={field.key} className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
                  <Label htmlFor={fieldId}>{field.label}</Label>
                  <Switch id={fieldId} checked={Boolean(value)} onCheckedChange={(checked) => setForm((current) => ({ ...current, metadata: { ...current.metadata, [field.key]: checked } }))} />
                </div>
              );
              return (
                <div key={field.key} className={cn("space-y-2", field.type === "textarea" && "sm:col-span-2")}>
                  <Label htmlFor={fieldId}>{field.label}{field.required && <> <span aria-hidden="true">*</span></>}</Label>
                  {field.type === "select" ? (
                    <Select value={String(value)} onValueChange={(next) => setForm((current) => ({ ...current, metadata: { ...current.metadata, [field.key]: next } }))}>
                      <SelectTrigger id={fieldId} className="border-slate-500 dark:border-slate-400"><SelectValue placeholder={`Choose ${field.label.toLowerCase()}`} /></SelectTrigger>
                      <SelectContent>{Object.entries(field.options ?? {}).map(([optionValue, label]) => <SelectItem key={optionValue} value={optionValue}>{label}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : field.type === "textarea" ? (
                    <textarea id={fieldId} required={field.required} rows={4} value={String(value)} onChange={(event) => setForm((current) => ({ ...current, metadata: { ...current.metadata, [field.key]: event.target.value } }))} className="flex w-full rounded-md border border-slate-500 bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-slate-700 dark:border-slate-400 dark:focus-visible:ring-amber-300" />
                  ) : (
                    <Input id={fieldId} required={field.required} type={field.type} value={String(value)} onChange={(event) => setForm((current) => ({ ...current, metadata: { ...current.metadata, [field.key]: field.type === "number" && event.target.value !== "" ? Number(event.target.value) : event.target.value } }))} className="border-slate-500 focus-visible:ring-slate-700 dark:border-slate-400 dark:focus-visible:ring-amber-300" />
                  )}
                </div>
              );
            })}
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-4 sm:col-span-2">
              <div>
                <Label htmlFor="reference-active">Available for use</Label>
                <p className="mt-1 text-xs text-muted-foreground">Inactive values remain in history but are hidden from new forms.</p>
              </div>
              <Switch id="reference-active" checked={form.is_active} onCheckedChange={(checked) => setForm((current) => ({ ...current, is_active: checked }))} className="border border-slate-500 data-[state=checked]:bg-slate-800 dark:border-slate-400 dark:data-[state=checked]:bg-amber-300" />
            </div>
          </form>

          <DialogFooter>
            <Button variant="outline" className="border-slate-500 dark:border-slate-400" onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button type="submit" form="erp-reference-form" disabled={saveMutation.isPending || !form.name.trim()} className="bg-slate-900 text-white hover:bg-slate-800 dark:bg-amber-300 dark:text-slate-950 dark:hover:bg-amber-200">
              {saveMutation.isPending ? "Saving…" : "Save value"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
