"use client";

import { useState, useMemo, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Loader2, Tag as TagIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  fetchHospitalityMenuCategories,
  createHospitalityMenuCategory,
  updateHospitalityMenuCategory,
  deleteHospitalityMenuCategory,
} from "@/modules/hospitality/api";
import type { HospitalityMenuCategory } from "@/modules/hospitality/types";
import { DataTable } from "@/components/datatable/data-table";
import type { ColumnDef } from "@tanstack/react-table";

type CategoryForm = {
  id?: number;
  name: string;
  slug: string;
  description: string;
  color: string;
  icon: string;
  sort_order: string;
  is_active: boolean;
};

const DEFAULT_FORM: CategoryForm = {
  name: "",
  slug: "",
  description: "",
  color: "#6366f1",
  icon: "Tag",
  sort_order: "0",
  is_active: true,
};

const ICON_OPTIONS = [
  { value: "Tag", label: "Tag" },
  { value: "Flame", label: "Flame" },
  { value: "Utensils", label: "Utensils" },
  { value: "Cake", label: "Cake" },
  { value: "Wine", label: "Wine" },
  { value: "Coffee", label: "Coffee" },
  { value: "Pizza", label: "Pizza" },
  { value: "IceCream", label: "Ice Cream" },
  { value: "Drumstick", label: "Drumstick" },
  { value: "Sandwich", label: "Sandwich" },
];

const COLOR_OPTIONS = [
  { value: "#ef4444", label: "Red" },
  { value: "#f97316", label: "Orange" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#eab308", label: "Yellow" },
  { value: "#84cc16", label: "Lime" },
  { value: "#22c55e", label: "Green" },
  { value: "#14b8a6", label: "Teal" },
  { value: "#06b6d4", label: "Cyan" },
  { value: "#0ea5e9", label: "Sky" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#6366f1", label: "Indigo" },
  { value: "#8b5cf6", label: "Violet" },
  { value: "#a855f7", label: "Purple" },
  { value: "#d946ef", label: "Fuchsia" },
  { value: "#ec4899", label: "Pink" },
  { value: "#f43f5e", label: "Rose" },
];

export default function MenuCategoriesPage() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [form, setForm] = useState<CategoryForm>(DEFAULT_FORM);

  // DataTable State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<string>("name");
  const [sortDir, setSortDir] = useState<string>("asc");
  const [tableKey, setTableKey] = useState(0);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["hospitality", "menu-categories"],
    queryFn: () => fetchHospitalityMenuCategories(),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim() || undefined,
        description: form.description.trim() || undefined,
        color: form.color,
        icon: form.icon,
        sort_order: parseInt(form.sort_order) || 0,
        is_active: form.is_active,
      };

      if (form.id) {
        return updateHospitalityMenuCategory(form.id, payload);
      }
      return createHospitalityMenuCategory(payload);
    },
    onSuccess: () => {
      toast.success(form.id ? "Category updated" : "Category created");
      queryClient.invalidateQueries({ queryKey: ["hospitality", "menu-categories"] });
      setTableKey(prev => prev + 1);
      closeModal();
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Failed to save category");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteHospitalityMenuCategory,
    onSuccess: () => {
      toast.success("Category deleted");
      queryClient.invalidateQueries({ queryKey: ["hospitality", "menu-categories"] });
      setTableKey(prev => prev + 1);
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Failed to delete category");
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
    queryClient.invalidateQueries({ queryKey: ["hospitality", "menu-categories"] });
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

  const openEdit = useCallback((category: HospitalityMenuCategory) => {
    setForm({
      id: category.id,
      name: category.name,
      slug: category.slug || "",
      description: category.description || "",
      color: category.color || "#6366f1",
      icon: category.icon || "Tag",
      sort_order: String(category.sort_order || 0),
      is_active: category.is_active ?? true,
    });
    setIsDialogOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsDialogOpen(false);
    setForm(DEFAULT_FORM);
  }, []);

  const handleSave = useCallback(() => {
    if (!form.name.trim()) {
      toast.error("Category name is required");
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
            <div
              className="h-6 w-6 rounded-full"
              style={{ backgroundColor: row.original.color || "#6366f1" }}
            />
            <span className="font-medium">{row.original.name}</span>
          </div>
        ),
      },
      {
        accessorKey: "slug",
        header: "Slug",
        cell: ({ row }: any) => (
          <span className="text-sm text-muted-foreground">{row.original.slug || "-"}</span>
        ),
      },
      {
        accessorKey: "icon",
        header: "Icon",
        cell: ({ row }: any) => (
          <Badge variant="outline" className="bg-muted/50">
            {row.original.icon || "Tag"}
          </Badge>
        ),
      },
      {
        accessorKey: "sort_order",
        header: "Sort Order",
        cell: ({ row }: any) => <span>{row.original.sort_order ?? 0}</span>,
      },
      {
        accessorKey: "is_active",
        header: "Status",
        cell: ({ row }: any) => (
          <Badge
            variant={row.original.is_active ? "default" : "secondary"}
            className={row.original.is_active ? "bg-emerald-500" : "bg-muted"}
          >
            {row.original.is_active ? "Active" : "Inactive"}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }: any) => {
          const category = row.original;
          return (
            <div className="flex justify-start gap-2">
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={() => openEdit(category)}
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
                    <AlertDialogTitle>Delete Category</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete "{category.name}"? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteMutation.mutate(category.id!)}
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
          <h1 className="text-2xl font-bold tracking-tight">Menu Categories</h1>
          <p className="text-muted-foreground">
            Manage menu categories for organizing your menu items
          </p>
        </div>
        <Button className="rounded-full px-5" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Category
        </Button>
      </div>

      <DataTable
        key={tableKey}
        columns={columns}
        data={categories}
        totalEntries={categories.length}
        loading={isLoading}
        pageIndex={page}
        pageSize={pageSize}
        onQueryChange={handleQueryChange}
        onRefresh={handleRefresh}
        onResetFilters={resetFilters}
        searchPlaceholder="Search categories..."
        resourceName="categories"
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="rounded-[2rem] border-border/60 bg-background/95 backdrop-blur-xl max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit Category" : "Create Category"}</DialogTitle>
            <DialogDescription>
              {form.id ? "Update category details" : "Add a new menu category"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Starters"
                className="bg-muted/30"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="e.g., starters"
                className="bg-muted/30"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Category description"
                className="bg-muted/30 resize-none"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="color">Color</Label>
                <Select value={form.color} onValueChange={(val) => setForm({ ...form, color: val })}>
                  <SelectTrigger className="bg-muted/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLOR_OPTIONS.map((color) => (
                      <SelectItem key={color.value} value={color.value}>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-4 w-4 rounded-full"
                            style={{ backgroundColor: color.value }}
                          />
                          {color.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="icon">Icon</Label>
                <Select value={form.icon} onValueChange={(val) => setForm({ ...form, icon: val })}>
                  <SelectTrigger className="bg-muted/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ICON_OPTIONS.map((icon) => (
                      <SelectItem key={icon.value} value={icon.value}>
                        {icon.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sort_order">Sort Order</Label>
              <Input
                id="sort_order"
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                placeholder="0"
                className="bg-muted/30"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={form.is_active}
                onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
              />
              <Label htmlFor="is_active">Active</Label>
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
              {saveMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {form.id ? "Update Category" : "Create Category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
