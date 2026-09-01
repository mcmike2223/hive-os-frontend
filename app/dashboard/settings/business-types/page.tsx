"use client";

import React, { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Building2, Loader2, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/datatable/data-table";
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
import { Textarea } from "@/components/ui/textarea";
import {
  getAuthHeaders,
  getBackendApiRoot,
  getWorkspaceScopeKey,
} from "@/lib/runtime-context";
import { LandingWorkspaceNav } from "@/modules/landing-templates/components/landing-workspace-nav";
import type { ColumnDef } from "@tanstack/react-table";

type BusinessType = {
  key: string;
  label: string;
  description: string;
  icon: string;
  default_template_key?: string;
  default_template?: Record<string, unknown>;
  templates?: Array<Record<string, unknown>>;
};

type FormState = {
  key: string;
  label: string;
  description: string;
  icon: string;
};

const DEFAULT_FORM: FormState = {
  key: "",
  label: "",
  description: "",
  icon: "building-2",
};

export default function BusinessTypesPage() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const workspaceScope = getWorkspaceScopeKey();

  const page = parseInt(searchParams.get("page") || "0", 10);
  const size = parseInt(searchParams.get("size") || "10", 10);
  const search = searchParams.get("search") || "";
  const sortCol = searchParams.get("sortCol") || "label";
  const sortDir = searchParams.get("sortDir") || "asc";

  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [isOpen, setIsOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BusinessType | null>(null);

  const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({});

  const {
    data,
    isLoading,
    isFetching,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: [
      "settings",
      "business-types",
      workspaceScope,
      page,
      size,
      search,
      sortCol,
      sortDir,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("size", String(size));
      if (search) params.set("search", search);
      params.set("sortCol", sortCol);
      params.set("sortDir", sortDir);

      const url = `${getBackendApiRoot()}/settings/landing-templates?${params.toString()}`;
      const headers = getAuthHeaders();
      const res = await fetch(url, { headers });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          json.message || `Failed to load business types (${res.status})`,
        );
      }
      return json;
    },
  });

  const businessTypes: BusinessType[] =
    data?.data?.business_types ?? data?.business_types ?? [];
  const totalEntries = data?.total ?? businessTypes.length;

  const handleSave = useCallback(async (types: BusinessType[]) => {
    const url = `${getBackendApiRoot()}/settings/landing-templates`;
    const headers = getAuthHeaders({ "Content-Type": "application/json" });
    const payload = { business_types: types };
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.message || `Failed to save (${res.status})`);
    }
    return res.json();
  }, []);

  const handleQueryChange = useCallback(
    (newParams: Record<string, unknown>) => {
      const params = new URLSearchParams();
      if (newParams.page !== undefined)
        params.set("page", String(newParams.page));
      if (newParams.size !== undefined)
        params.set("size", String(newParams.size));
      if (newParams.search !== undefined && newParams.search)
        params.set("search", String(newParams.search));
      if (newParams.sortCol) params.set("sortCol", String(newParams.sortCol));
      if (newParams.sortDir) params.set("sortDir", String(newParams.sortDir));

      const newUrl = `/dashboard/settings/business-types?${params.toString()}`;
      window.history.pushState({}, "", newUrl);
    },
    [],
  );

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleDeleteRows = useCallback(
    async (rows: BusinessType[]) => {
      const keysToDelete = rows.map((r: BusinessType) => r.key);
      if (keysToDelete.includes("general")) {
        toast.error(
          "General Business is the fallback type and cannot be deleted.",
        );
        return;
      }

      const newTypes = businessTypes.filter(
        (bt: BusinessType) => !keysToDelete.includes(bt.key),
      );
      await handleSave(newTypes);
      queryClient.setQueryData(
        ["settings", "business-types", page, size, search, sortCol, sortDir],
        {
          ...data,
          data: { business_types: newTypes },
          total: newTypes.length,
        },
      );
      setSelectedRows({});
      toast.success(`Deleted ${rows.length} business type(s)`);
    },
    [
      businessTypes,
      handleSave,
      queryClient,
      data,
      page,
      size,
      search,
      sortCol,
      sortDir,
    ],
  );

  const handleSubmit = async () => {
    const normalizedKey = form.key.trim().toLowerCase();
    const normalizedLabel = form.label.trim();

    setFormError(null);
    if (!normalizedKey || !normalizedLabel) {
      setFormError("Key and label are required.");
      return;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedKey)) {
      setFormError(
        "Use lowercase letters, numbers, and single hyphens for the key.",
      );
      return;
    }
    if (
      businessTypes.some(
        (type) => type.key === normalizedKey && type.key !== editingKey,
      )
    ) {
      setFormError(`The key “${normalizedKey}” is already in use.`);
      return;
    }

    const nextValues = {
      label: normalizedLabel,
      description: form.description.trim(),
      icon: form.icon.trim() || "building-2",
    };
    let newTypes: BusinessType[];
    if (editingKey) {
      newTypes = businessTypes.map((bt: BusinessType) =>
        bt.key === editingKey ? { ...bt, ...nextValues } : bt,
      );
    } else {
      newTypes = [...businessTypes, { key: normalizedKey, ...nextValues }];
    }

    setIsSaving(true);
    try {
      await handleSave(newTypes);
      queryClient.setQueryData(
        ["settings", "business-types", page, size, search, sortCol, sortDir],
        {
          ...data,
          data: { business_types: newTypes },
          total: newTypes.length,
        },
      );
      toast.success("Business types saved successfully");
      setIsOpen(false);
      setForm(DEFAULT_FORM);
      setEditingKey(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save";
      setFormError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (bt: BusinessType) => {
    setEditingKey(bt.key);
    setForm({
      key: bt.key,
      label: bt.label,
      description: bt.description,
      icon: bt.icon,
    });
    setFormError(null);
    setIsOpen(true);
  };

  const handleDelete = (type: BusinessType) => {
    if (type.key === "general") {
      toast.error(
        "General Business is the fallback type and cannot be deleted.",
      );
      return;
    }
    setDeleteTarget(type);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    const newTypes = businessTypes.filter(
      (bt: BusinessType) => bt.key !== deleteTarget.key,
    );
    setIsSaving(true);
    try {
      await handleSave(newTypes);
      queryClient.setQueryData(
        ["settings", "business-types", page, size, search, sortCol, sortDir],
        {
          ...data,
          data: { business_types: newTypes },
          total: newTypes.length,
        },
      );
      toast.success(`${deleteTarget.label} deleted`);
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    } finally {
      setIsSaving(false);
    }
  };

  const columns: ColumnDef<BusinessType>[] = [
    {
      accessorKey: "label",
      header: "Business Type",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
          </div>
          <div>
            <p className="font-semibold">{row.original.label}</p>
            <p className="text-xs text-muted-foreground">{row.original.key}</p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.description}
        </span>
      ),
    },
    {
      accessorKey: "icon",
      header: "Icon",
      cell: ({ row }) => (
        <code className="text-xs bg-muted px-2 py-1 rounded">
          {row.original.icon}
        </code>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      size: 100,
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button
            size="icon"
            variant="outline"
            className="min-h-11 min-w-11"
            aria-label={`Edit ${row.original.label}`}
            title={`Edit ${row.original.label}`}
            onClick={() => handleEdit(row.original)}
          >
            <Pencil aria-hidden="true" className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="min-h-11 min-w-11 text-destructive hover:text-destructive"
            aria-label={`Delete ${row.original.label}`}
            title={`Delete ${row.original.label}`}
            onClick={() => handleDelete(row.original)}
          >
            <Trash2 aria-hidden="true" className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const exportUrl = `${getBackendApiRoot()}/settings/landing-templates/export?search=${encodeURIComponent(search)}&sortCol=${sortCol}&sortDir=${sortDir}`;

  return (
    <div className="space-y-6 p-6">
      <LandingWorkspaceNav active="business-types" />

      <div className="flex flex-col gap-4 rounded-[2rem] border border-border/50 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_35%)] p-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
            Matching rules
          </p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">
            Business Types
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Define the tenant categories used to recommend, assign, and filter
            landing templates. Template content stays in the library.
          </p>
        </div>
        <Button
          className="min-h-11 rounded-xl"
          onClick={() => {
            setEditingKey(null);
            setForm(DEFAULT_FORM);
            setFormError(null);
            setIsOpen(true);
          }}
        >
          <Plus aria-hidden="true" className="mr-2 h-4 w-4" />
          Add Business Type
        </Button>
      </div>

      <p className="sr-only" aria-live="polite">
        {isFetching
          ? "Refreshing business types"
          : `${businessTypes.length} business types loaded`}
      </p>

      {queryError && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between"
        >
          <span>
            {queryError instanceof Error
              ? queryError.message
              : "Could not load business types."}
          </span>
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => void refetch()}
          >
            Retry
          </Button>
        </div>
      )}

      <DataTable
        key={businessTypes.length}
        columns={columns}
        data={businessTypes}
        totalEntries={totalEntries}
        loading={isLoading || isFetching}
        pageIndex={page}
        pageSize={size}
        pageSizeOptions={[10, 25, 50, 100]}
        onQueryChange={handleQueryChange}
        searchPlaceholder="Search business types..."
        enableRowSelection={true}
        selectedRowIds={selectedRows}
        onSelectionChange={(payload) => setSelectedRows(payload.selectedRowIds)}
        onDeleteRows={handleDeleteRows}
        onRefresh={handleRefresh}
        exportEndpoint={exportUrl}
        resourceName="business-types"
        syncWithUrl={true}
        getRowId={(row) => row.key}
      />

      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) setFormError(null);
        }}
      >
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingKey ? "Edit Business Type" : "Add Business Type"}
            </DialogTitle>
            <DialogDescription>
              Business types drive template matching; they do not store template
              code.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="business-type-key">Key (unique identifier)</Label>
              <Input
                id="business-type-key"
                value={form.key}
                onChange={(e) =>
                  setForm({
                    ...form,
                    key: e.target.value.toLowerCase().replace(/\s+/g, "-"),
                  })
                }
                placeholder="e.g. hotel, restaurant, warehouse"
                disabled={!!editingKey}
                aria-invalid={!!formError && !form.key}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="business-type-label">Label</Label>
              <Input
                id="business-type-label"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="e.g. Hotel Business"
                aria-invalid={!!formError && !form.label}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="business-type-description">Description</Label>
              <Textarea
                id="business-type-description"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Brief description of this business type"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="business-type-icon">Icon</Label>
              <Input
                id="business-type-icon"
                value={form.icon}
                onChange={(e) => setForm({ ...form, icon: e.target.value })}
                placeholder="e.g. building-2, hotel, utensils"
              />
            </div>
            {formError && (
              <p
                role="alert"
                className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {formError}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => setIsOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              className="min-h-11"
              onClick={handleSubmit}
              disabled={isSaving || !form.key || !form.label}
            >
              {isSaving ? (
                <Loader2
                  aria-hidden="true"
                  className="mr-2 h-4 w-4 animate-spin"
                />
              ) : (
                <Save aria-hidden="true" className="mr-2 h-4 w-4" />
              )}
              {isSaving ? "Saving…" : "Save Business Type"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {deleteTarget?.label}?</DialogTitle>
            <DialogDescription>
              This removes the matching category. Deletion is blocked if a
              tenant or active template assignment still uses it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => setDeleteTarget(null)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="min-h-11"
              onClick={() => void confirmDelete()}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2
                  aria-hidden="true"
                  className="mr-2 h-4 w-4 animate-spin"
                />
              ) : (
                <Trash2 aria-hidden="true" className="mr-2 h-4 w-4" />
              )}
              Delete Business Type
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
