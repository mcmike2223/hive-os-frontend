"use client";

import React, { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Plus, Pencil, Save, Building2 } from "lucide-react";
import { toast } from "sonner";
import { useDebounce } from "@/hooks/use-debounce";

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
import { useTranslation } from "@/store/use-translation";
import { getAuthHeaders, getBackendApiRoot, getWorkspaceScopeKey } from "@/lib/runtime-context";
import type { ColumnDef } from "@tanstack/react-table";

type BusinessType = {
  key: string;
  label: string;
  description: string;
  icon: string;
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

const DEFAULT_TYPES: BusinessType[] = [
  { key: "general", label: "General Business", description: "Balanced for agencies and multipurpose brands", icon: "building-2" },
  { key: "retail", label: "Retail Store", description: "For stores and merchandise", icon: "store" },
  { key: "warehouse", label: "Warehouse", description: "For storage and logistics", icon: "warehouse" },
  { key: "hotel", label: "Hotel", description: "For hotels and hospitality", icon: "hotel" },
  { key: "hospital", label: "Hospital", description: "For healthcare facilities", icon: "hospital" },
  { key: "restaurant", label: "Restaurant", description: "For restaurants and food service", icon: "utensils" },
];

export default function BusinessTypesPage() {
  const { t } = useTranslation();
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

  const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({});

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["settings", "business-types", workspaceScope, page, size, search, sortCol, sortDir],
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
      const json = await res.json();
      return json;
    },
  });

  const businessTypes = data?.data?.business_types ?? data?.business_types ?? DEFAULT_TYPES;
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

  const handleQueryChange = useCallback((newParams: Record<string, unknown>) => {
    const params = new URLSearchParams();
    if (newParams.page !== undefined) params.set("page", String(newParams.page));
    if (newParams.size !== undefined) params.set("size", String(newParams.size));
    if (newParams.search !== undefined && newParams.search) params.set("search", String(newParams.search));
    if (newParams.sortCol) params.set("sortCol", String(newParams.sortCol));
    if (newParams.sortDir) params.set("sortDir", String(newParams.sortDir));

    const newUrl = `/dashboard/settings/business-types?${params.toString()}`;
    window.history.pushState({}, "", newUrl);
  }, []);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleDeleteRows = useCallback(async (rows: BusinessType[]) => {
    const keysToDelete = rows.map((r: BusinessType) => r.key);
    const newTypes = businessTypes.filter((bt: BusinessType) => !keysToDelete.includes(bt.key));
    await handleSave(newTypes);
    queryClient.setQueryData(["settings", "business-types", page, size, search, sortCol, sortDir], {
      ...data,
      data: { business_types: newTypes },
      total: newTypes.length
    });
    toast.success(`Deleted ${rows.length} business type(s)`);
  }, [businessTypes, handleSave, queryClient, data, page, size, search, sortCol, sortDir]);

  const handleSubmit = async () => {
    let newTypes: BusinessType[];
    if (editingKey) {
      newTypes = businessTypes.map((bt: BusinessType) =>
        bt.key === editingKey ? { key: form.key, label: form.label, description: form.description, icon: form.icon } : bt
      );
    } else {
      newTypes = [...businessTypes, { key: form.key, label: form.label, description: form.description, icon: form.icon }];
    }

    try {
      await handleSave(newTypes);
      queryClient.setQueryData(["settings", "business-types", page, size, search, sortCol, sortDir], {
        ...data,
        data: { business_types: newTypes },
        total: newTypes.length
      });
      toast.success("Business types saved successfully");
      setIsOpen(false);
      setForm(DEFAULT_FORM);
      setEditingKey(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save");
    }
  };

  const handleEdit = (bt: BusinessType) => {
    setEditingKey(bt.key);
    setForm({ key: bt.key, label: bt.label, description: bt.description, icon: bt.icon });
    setIsOpen(true);
  };

  const handleDelete = async (key: string) => {
    const newTypes = businessTypes.filter((bt: BusinessType) => bt.key !== key);
    try {
      await handleSave(newTypes);
      queryClient.setQueryData(["settings", "business-types", page, size, search, sortCol, sortDir], {
        ...data,
        data: { business_types: newTypes },
        total: newTypes.length
      });
      toast.success("Business type deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    }
  };

  const columns: ColumnDef<BusinessType>[] = [
    {
      accessorKey: "label",
      header: "Business Type",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-primary" />
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
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.description}</span>,
    },
    {
      accessorKey: "icon",
      header: "Icon",
      cell: ({ row }) => <code className="text-xs bg-muted px-2 py-1 rounded">{row.original.icon}</code>,
    },
    {
      id: "actions",
      header: "Actions",
      size: 100,
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => handleEdit(row.original)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" className="text-red-500 hover:text-red-600" onClick={() => handleDelete(row.original.key)}>
            <span className="sr-only">Delete</span>
            ×
          </Button>
        </div>
      ),
    },
  ];

  const exportUrl = `${getBackendApiRoot()}/settings/landing-templates/export?search=${encodeURIComponent(search)}&sortCol=${sortCol}&sortDir=${sortDir}`;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Business Types</h1>
          <p className="text-muted-foreground">Manage business types for your tenants</p>
        </div>
        <Button className="rounded-full" onClick={() => { setEditingKey(null); setForm(DEFAULT_FORM); setIsOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Business Type
        </Button>
      </div>

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
        onSelectionChange={(rows) => setSelectedRows(rows)}
        onDeleteRows={handleDeleteRows}
        onRefresh={handleRefresh}
        exportEndpoint={exportUrl}
        resourceName="business-types"
        syncWithUrl={true}
        getRowId={(row) => row.key}
      />

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingKey ? "Edit Business Type" : "Add Business Type"}</DialogTitle>
            <DialogDescription>
              Define a new business type for tenant registration
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Key (unique identifier)</Label>
              <Input
                value={form.key}
                onChange={(e) => setForm({ ...form, key: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
                placeholder="e.g. hotel, restaurant, warehouse"
                disabled={!!editingKey}
              />
            </div>
            <div className="space-y-2">
              <Label>Label</Label>
              <Input
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="e.g. Hotel Business"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Brief description of this business type"
              />
            </div>
            <div className="space-y-2">
              <Label>Icon</Label>
              <Input
                value={form.icon}
                onChange={(e) => setForm({ ...form, icon: e.target.value })}
                placeholder="e.g. building-2, hotel, utensils"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!form.key || !form.label}>
              <Save className="mr-2 h-4 w-4" />
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
