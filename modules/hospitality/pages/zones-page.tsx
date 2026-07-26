"use client";

import { useState, useMemo, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Map as MapIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  fetchHospitalityZones,
  createHospitalityZone,
  updateHospitalityZone,
  deleteHospitalityZone,
} from "@/modules/hospitality/api";
import type { HospitalityZone } from "@/modules/hospitality/types";
import { DataTable } from "@/components/datatable/data-table";
import type { ColumnDef } from "@tanstack/react-table";

type ZoneForm = {
  id?: number;
  name: string;
  description: string;
};

const DEFAULT_FORM: ZoneForm = {
  name: "",
  description: "",
};

export default function ZonesPage() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [form, setForm] = useState<ZoneForm>(DEFAULT_FORM);

  // DataTable State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<string>("name");
  const [sortDir, setSortDir] = useState<string>("asc");
  const [tableKey, setTableKey] = useState(0);

  const { data: zones = [], isLoading } = useQuery({
    queryKey: ["hospitality", "zones"],
    queryFn: () => fetchHospitalityZones(),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
      };

      if (form.id) {
        return updateHospitalityZone(form.id, payload);
      }
      return createHospitalityZone(payload);
    },
    onSuccess: () => {
      toast.success(form.id ? "Zone updated" : "Zone created");
      queryClient.invalidateQueries({ queryKey: ["hospitality", "zones"] });
      setTableKey(prev => prev + 1);
      closeModal();
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Failed to save zone");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteHospitalityZone,
    onSuccess: () => {
      toast.success("Zone deleted");
      queryClient.invalidateQueries({ queryKey: ["hospitality", "zones"] });
      setTableKey(prev => prev + 1);
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Failed to delete zone");
    },
  });

  const handleQueryChange = useCallback((query: any) => {
    setPage(query.pageIndex);
    setPageSize(query.pageSize);
    setSearch(query.search || "");
    setSortCol(query.sortCol || "name");
    setSortDir(query.sortDir || "asc");
  }, []);

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["hospitality", "zones"] });
    setTableKey(prev => prev + 1);
  }, [queryClient]);

  const resetFilters = useCallback(() => {
    setSearch("");
    setSortCol("name");
    setSortDir("asc");
    setPage(1);
    setTableKey(prev => prev + 1);
  }, []);

  const openCreate = useCallback(() => {
    setForm(DEFAULT_FORM);
    setIsDialogOpen(true);
  }, []);

  const openEdit = useCallback((zone: HospitalityZone) => {
    setForm({
      id: zone.id,
      name: zone.name,
      description: zone.description || "",
    });
    setIsDialogOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsDialogOpen(false);
    setForm(DEFAULT_FORM);
  }, []);

  const handleSave = useCallback(() => {
    if (!form.name.trim()) {
      toast.error("Zone name is required");
      return;
    }
    saveMutation.mutate();
  }, [form.name, saveMutation]);

  const columns = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }: any) => (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500 border border-indigo-100">
              <MapIcon className="h-4 w-4" />
            </div>
            <span className="font-medium">{row.original.name}</span>
          </div>
        ),
      },
      {
        accessorKey: "description",
        header: "Description",
        cell: ({ row }: any) => (
          <span className="text-sm text-muted-foreground">
            {row.original.description || "-"}
          </span>
        ),
      },
      {
        accessorKey: "locations_count",
        header: "Tables",
        cell: ({ row }: any) => (
          <span className="font-medium">{row.original.locations_count ?? 0}</span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }: any) => {
          const zone = row.original;
          return (
            <div className="flex justify-start gap-2">
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={() => openEdit(zone)}
              >
                <Pencil className="mr-1 h-3.5 w-3.5" />
                Edit
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="rounded-full"
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-[2rem] border-border/60 bg-background/95 backdrop-blur-xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Zone</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete "{zone.name}"? This will also affect all tables in this zone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteMutation.mutate(zone.id!)}
                      className="rounded-full"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          );
        },
      },
    ],
    [openEdit, deleteMutation]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Zones</h1>
          <p className="text-muted-foreground">
            Manage zones for organizing your tables and space layout
          </p>
        </div>
        <Button className="rounded-full px-5" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Zone
        </Button>
      </div>

      <DataTable
        key={tableKey}
        columns={columns}
        data={zones}
        totalEntries={zones.length}
        loading={isLoading}
        pageIndex={page}
        pageSize={pageSize}
        onQueryChange={handleQueryChange}
        onRefresh={handleRefresh}
        onResetFilters={resetFilters}
        searchPlaceholder="Search zones..."
        resourceName="zones"
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="rounded-[2rem] border-border/60 bg-background/95 backdrop-blur-xl max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit Zone" : "Create Zone"}</DialogTitle>
            <DialogDescription>
              {form.id ? "Update zone details" : "Add a new zone to organize your space"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Main Dining"
                className="bg-muted/30"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Zone description"
                className="bg-muted/30 resize-none"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="border-t border-border/40 bg-muted/20 px-6 py-4">
            <Button variant="outline" className="rounded-full" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              className="rounded-full"
              disabled={saveMutation.isPending}
              onClick={handleSave}
            >
              {form.id ? "Update Zone" : "Create Zone"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
