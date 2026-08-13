"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Utensils, Plus, Pencil, Trash2, Loader2, Tags, Image as ImageIcon, X, Box } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import {
  fetchHospitalityMenuItems,
  fetchHospitalityMenuCategories,
  createHospitalityMenuItem,
  updateHospitalityMenuItem,
  deleteHospitalityMenuItem,
} from "@/modules/hospitality/api";
import type { HospitalityMenuItem, HospitalityMenuCategory } from "@/modules/hospitality/types";

import { FileManagerClient } from "@/components/dashboard/file-manager-client";
import { usePermissions } from "@/hooks/use-permissions";
import { DataTable } from "@/components/datatable/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import api from "@/modules/shared/api/http";
import { SecureAssetImage } from "@/components/ui/secure-asset-image";
import { Model3DViewer } from "@/components/ui/model-3d-viewer";

export default function MenuManagementPage() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<HospitalityMenuItem | null>(null);

  // Media picker state
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [mediaPickerTarget, setMediaPickerTarget] = useState<"image" | "model_3d">("image");

  const openMediaPicker = (target: "image" | "model_3d") => {
    setMediaPickerTarget(target);
    setIsMediaPickerOpen(true);
  };

  // Permissions hook
  const { hasAnyPermission, hasPermission } = usePermissions();
  const canBrowseAssetLibrary = hasAnyPermission(["view_storage", "manage_storage"]);
  const canManageStorage = hasPermission("manage_storage");

  // DataTable State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<string>("sort_order");
  const [sortDir, setSortDir] = useState<string>("asc");
  const [tableKey, setTableKey] = useState(0);
  const [selectedRowIds, setSelectedRowIds] = useState<Record<string, boolean>>({});
  const [active3DModel, setActive3DModel] = useState<{ url: string; name: string } | null>(null);

  const { data: menuItemsData, isLoading: isLoadingItems, isFetching } = useQuery({
    queryKey: ["hospitality", "menu-items", page, pageSize, search, sortCol, sortDir],
    queryFn: async () => {
      const params: Record<string, any> = {
        page,
        per_page: pageSize,
        sortCol,
        sortDir,
      };
      if (search.trim()) params.search = search.trim();

      const res = await api.get("/hospitality/menu-items", { params });
      
      const rows = res.data?.data || (Array.isArray(res.data) ? res.data : []);
      const total = res.data?.meta?.total || res.data?.total || rows.length;
      return {
        rows,
        total,
      };
    },
    placeholderData: (prev) => prev,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["hospitality", "menu-categories"],
    queryFn: () => fetchHospitalityMenuCategories(),
  });

  const [formData, setFormData] = useState({
    name: "",
    category_id: "",
    description: "",
    price: "",
    cost_price: "",
    is_available: true,
    is_featured: false,
    preparation_time_minutes: "",
    image_url: "",
    model_3d_url: "",
  });

  const createMutation = useMutation({
    mutationFn: createHospitalityMenuItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hospitality", "menu-items"] });
      toast.success("Menu item created successfully");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to create menu item");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) =>
      updateHospitalityMenuItem(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hospitality", "menu-items"] });
      toast.success("Menu item updated successfully");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to update menu item");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteHospitalityMenuItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hospitality", "menu-items"] });
      toast.success("Menu item deleted");
    },
    onError: (error: any) => {
      toast.error("Failed to delete menu item");
    },
  });

  const resetForm = () => {
    setEditingItem(null);
    setFormData({
      name: "",
      category_id: "",
      description: "",
      price: "",
      cost_price: "",
      is_available: true,
      is_featured: false,
      preparation_time_minutes: "",
      image_url: "",
      model_3d_url: "",
    });
  };

  const openEditDialog = (item: HospitalityMenuItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      category_id: String(item.category_id),
      description: item.description || "",
      price: item.price,
      cost_price: item.cost_price || "",
      is_available: item.is_available,
      is_featured: item.is_featured,
      preparation_time_minutes: item.preparation_time_minutes ? String(item.preparation_time_minutes) : "",
      image_url: item.image_url || "",
      model_3d_url: item.model_3d_url || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      category_id: Number(formData.category_id),
      price: Number(formData.price),
      cost_price: formData.cost_price ? Number(formData.cost_price) : null,
      preparation_time_minutes: formData.preparation_time_minutes ? Number(formData.preparation_time_minutes) : null,
    };

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleFileSelect = (file: any) => {
    const url = file.media_details?.public_url || file.media_details?.url || file.url || file.path;
    if (mediaPickerTarget === "image") {
      setFormData((prev) => ({ ...prev, image_url: url }));
      toast.success("Image selected from media library");
    } else {
      setFormData((prev) => ({ ...prev, model_3d_url: url }));
      toast.success("3D model selected from media library");
    }
    setIsMediaPickerOpen(false);
  };

  const handleQueryChange = useCallback((q: any) => {
    if (q.page !== undefined) setPage(q.page);
    if (q.pageSize !== undefined) setPageSize(q.pageSize);
    if (q.search !== undefined) {
      setSearch(prev => {
        if (prev !== q.search) {
          setPage(1);
        }
        return q.search;
      });
    }
    if (q.sortCol) {
      setSortCol(q.sortCol);
      setSortDir(q.sortDir || "asc");
    } else {
      setSortCol("sort_order");
      setSortDir("asc");
    }
  }, []);

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["hospitality", "menu-items"] });
  }, [queryClient]);

  const resetFilters = useCallback(() => {
    setSearch("");
    setPage(1);
    setTableKey(prev => prev + 1);
  }, []);

  const handleDeleteRows = useCallback(async (rows: HospitalityMenuItem[]) => {
    try {
      await Promise.all(rows.map((row) => deleteMutation.mutateAsync(row.id)));
      toast.success(`${rows.length} item(s) deleted.`);
    } catch {
      toast.error("An error occurred during deletion.");
    }
  }, [deleteMutation]);

  const columns = useMemo<ColumnDef<HospitalityMenuItem>[]>(() => [
    {
      id: "image",
      header: "Image",
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original;
        
        if (!item.image_url) {
          if (item.model_3d_url) {
            return (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 w-10 p-0 rounded-lg bg-blue-50 border-blue-100 hover:bg-blue-100 text-blue-600 flex flex-col items-center justify-center gap-0.5"
                onClick={() => setActive3DModel({ url: item.model_3d_url!, name: item.name })}
              >
                <Box className="h-4 w-4 text-blue-500" />
                <span className="text-[11px] font-black uppercase tracking-wider leading-none">3D</span>
              </Button>
            );
          }
          return (
            <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500 border border-indigo-100">
              <ImageIcon className="h-4 w-4" />
            </div>
          );
        }

        const has3d = !!item.model_3d_url;

        return (
          <div className="relative group h-10 w-10 rounded-lg overflow-hidden border bg-muted">
            {has3d ? (
              <button
                type="button"
                className="h-full w-full relative cursor-pointer focus:outline-none"
                onClick={() => setActive3DModel({ url: item.model_3d_url!, name: item.name })}
                title="Click to view in 3D"
              >
                <SecureAssetImage src={item.image_url} alt={item.name} className="h-full w-full object-cover transition-transform group-hover:scale-110" />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Box className="h-4 w-4 text-white animate-pulse" />
                </div>
                <div className="absolute bottom-0 right-0 bg-blue-600 text-white text-[7px] px-1 font-black rounded-tl uppercase">
                  3D
                </div>
              </button>
            ) : (
              <SecureAssetImage src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
            )}
          </div>
        );
      }
    },
    {
      id: "name",
      header: "Name",
      accessorKey: "name",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div>
            <div className="font-bold text-foreground">{item.name}</div>
            {item.description && (
              <div className="text-xs text-muted-foreground truncate max-w-[250px]">{item.description}</div>
            )}
          </div>
        );
      }
    },
    {
      id: "category",
      header: "Category",
      accessorFn: (row) => row.category?.name || "Uncategorized",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <Badge variant="outline" className="bg-muted/50 rounded-md">
            {item.category?.name || "Uncategorized"}
          </Badge>
        );
      }
    },
    {
      id: "price",
      header: "Price",
      accessorKey: "price",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <span className="font-black text-foreground">
            ETB {Number(item.price).toLocaleString()}
          </span>
        );
      }
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "is_available",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <Badge
            variant={item.is_available ? "default" : "secondary"}
            className={item.is_available ? "bg-emerald-500 hover:bg-emerald-600 rounded-full" : "rounded-full"}
          >
            {item.is_available ? "Available" : "Unavailable"}
          </Badge>
        );
      }
    },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      meta: { align: "right" as const },
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => openEditDialog(item)}
              className="h-8 text-[11px] font-black uppercase tracking-widest text-indigo-600 border-indigo-200 bg-indigo-50 hover:bg-indigo-100"
            >
              <Pencil className="mr-1 h-3.5 w-3.5" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (confirm("Are you sure you want to delete this item?")) {
                  deleteMutation.mutate(item.id);
                }
              }}
              className="h-8 text-[11px] font-black uppercase tracking-widest text-red-600 border-red-200 bg-red-50 hover:bg-red-100"
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        );
      }
    }
  ], []);

  if (isLoadingItems) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
            <Utensils className="h-8 w-8 text-indigo-500" />
            Menu Management
          </h1>
          <p className="text-muted-foreground">Manage your food and beverage offerings.</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          if (!open) resetForm();
          setIsDialogOpen(open);
        }}>
          <DialogTrigger asChild>
            <Button className="rounded-full px-6 shadow-xl shadow-primary/20">
              <Plus className="mr-2 h-4 w-4" />
              Add Menu Item
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto rounded-[2rem]">
            <DialogHeader>
              <DialogTitle>{editingItem ? "Edit Menu Item" : "Create Menu Item"}</DialogTitle>
              <DialogDescription>
                Fill out the details below to {editingItem ? "update the" : "add a new"} menu item.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="name">Item Name *</Label>
                  <Input
                    id="name"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select
                    value={formData.category_id}
                    onValueChange={(val) => setFormData({ ...formData, category_id: val })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={String(cat.id)}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="price">Selling Price (ETB) *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cost_price">Cost Price (ETB)</Label>
                  <Input
                    id="cost_price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.cost_price}
                    onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prep_time">Prep Time (mins)</Label>
                  <Input
                    id="prep_time"
                    type="number"
                    min="0"
                    value={formData.preparation_time_minutes}
                    onChange={(e) => setFormData({ ...formData, preparation_time_minutes: e.target.value })}
                  />
                </div>

                <div className="space-y-2 col-span-2 border-t pt-4">
                  <Label htmlFor="image_url" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Item Image</Label>
                  <div className="flex gap-4 items-center">
                    <div className="h-16 w-16 rounded-xl overflow-hidden bg-muted border flex items-center justify-center text-muted-foreground shrink-0 bg-card/40">
                      {formData.image_url ? (
                        formData.image_url.toLowerCase().endsWith(".glb") || formData.image_url.toLowerCase().endsWith(".gltf") ? (
                          <div className="flex flex-col items-center justify-center text-blue-500">
                            <Box className="h-6 w-6" />
                            <span className="text-[11px] font-black uppercase tracking-wider">3D</span>
                          </div>
                        ) : (
                          <SecureAssetImage src={formData.image_url} alt="Preview" className="h-full w-full object-cover" />
                        )
                      ) : (
                        <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openMediaPicker("image")}
                          className="rounded-full"
                        >
                          Choose from Media Library
                        </Button>
                        {formData.image_url && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setFormData({ ...formData, image_url: "" })}
                            className="text-rose-500 hover:text-rose-600 rounded-full"
                          >
                            Remove Image
                          </Button>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Select or upload an image using the file manager.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 col-span-2 border-t pt-4">
                  <Label htmlFor="model_3d_url" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">3D Model (.glb / .gltf)</Label>
                  <div className="flex gap-4 items-center">
                    <div className="h-16 w-16 rounded-xl overflow-hidden bg-muted border flex items-center justify-center text-muted-foreground shrink-0 bg-card/40">
                      {formData.model_3d_url ? (
                        <div className="flex flex-col items-center justify-center text-blue-500">
                          <Box className="h-6 w-6" />
                          <span className="text-[11px] font-black uppercase tracking-wider">3D</span>
                        </div>
                      ) : (
                        <Box className="h-6 w-6 text-muted-foreground/40" />
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openMediaPicker("model_3d")}
                          className="rounded-full"
                        >
                          Choose 3D Model
                        </Button>
                        {formData.model_3d_url && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setFormData({ ...formData, model_3d_url: "" })}
                            className="text-rose-500 hover:text-rose-600 rounded-full"
                          >
                            Remove 3D Model
                          </Button>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Select or upload a 3D model (.glb / .gltf) using the file manager.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3 col-span-2">
                  <div className="space-y-0.5">
                    <Label>Available for Sale</Label>
                    <p className="text-xs text-muted-foreground">Customers can order this item.</p>
                  </div>
                  <Switch
                    checked={formData.is_available}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_available: checked })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="w-full"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingItem ? "Save Changes" : "Create Item"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <DataTable
        key={tableKey}
        columns={columns}
        data={menuItemsData?.rows || []}
        totalEntries={menuItemsData?.total || 0}
        loading={isLoadingItems || isFetching}
        pageIndex={page}
        pageSize={pageSize}
        onQueryChange={handleQueryChange}
        onRefresh={handleRefresh}
        onResetFilters={resetFilters}
        onDeleteRows={handleDeleteRows}
        searchPlaceholder="Search menu items by name, description or tag..."
        enableRowSelection={true}
        selectedRowIds={selectedRowIds}
        onSelectionChange={(payload) => setSelectedRowIds(payload.selectedRowIds as Record<string, boolean>)}
        resourceName="menu items"
        syncWithUrl={true}
      />

      {/* Media Picker Dialog */}
      <Dialog
        open={isMediaPickerOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setIsMediaPickerOpen(false);
            return;
          }
          setIsMediaPickerOpen(true);
        }}
      >
        <DialogContent className="flex h-[80vh] max-w-[1000px] flex-col p-0 overflow-hidden rounded-[2rem]">
          <div className="flex items-center justify-between border-b px-6 py-4 bg-background/50 backdrop-blur-md">
            <div>
              <DialogTitle>Media Library</DialogTitle>
              <DialogDescription>Select an image for this menu item</DialogDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setIsMediaPickerOpen(false)} className="rounded-full">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="file-picker-wrapper relative flex-1 overflow-hidden">
            <style dangerouslySetInnerHTML={{ __html: `
              .file-picker-wrapper > div > div:nth-child(1), 
              .file-picker-wrapper > div > div:nth-child(2) > div:nth-child(2) { display: none !important; }
              .file-picker-wrapper > div { height: 100% !important; min-height: 100% !important; margin: 0 !important; }
            `}} />
            <FileManagerClient 
              isPickerMode={true}
              onFileSelect={handleFileSelect}
              access={{ canRead: canBrowseAssetLibrary, canManage: canManageStorage }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* 3D Model Viewer Dialog */}
      <Dialog
        open={!!active3DModel}
        onOpenChange={(open) => {
          if (!open) setActive3DModel(null);
        }}
      >
        <DialogContent className="flex h-[80vh] max-w-[800px] flex-col p-0 overflow-hidden rounded-[2rem]">
          <div className="flex items-center justify-between border-b px-6 py-4 bg-background/50 backdrop-blur-md">
            <div>
              <DialogTitle>{active3DModel?.name}</DialogTitle>
              <DialogDescription>3D Model Preview</DialogDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setActive3DModel(null)} className="rounded-full">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 p-6 bg-muted/10 flex items-center justify-center overflow-hidden">
            {active3DModel && (
              <Model3DViewer
                src={active3DModel.url}
                alt={active3DModel.name}
                className="w-full h-full min-h-[400px] rounded-2xl border bg-card"
                viewerClassName="h-full w-full"
                showOpenButton={false}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
