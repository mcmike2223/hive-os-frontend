"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/store/use-translation";

import { DataTable, type DataTableQuery } from "@/components/datatable/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { productionApi } from "@/modules/production/api";
import type { ProductionBom } from "@/modules/production/types";

const COMPONENT_TYPES = [
  "preform",
  "cap",
  "label",
  "shrink_film",
  "carton",
  "pallet",
  "chemical",
  "water",
  "other",
] as const;

type ItemDraft = {
  component_product_id: string;
  component_type: string;
  quantity_per_unit: string;
  uom: string;
  scrap_percent: string;
  is_critical: boolean;
};

const EMPTY_ITEM: ItemDraft = {
  component_product_id: "",
  component_type: "preform",
  quantity_per_unit: "1",
  uom: "pcs",
  scrap_percent: "0",
  is_critical: false,
};

type BomForm = {
  id?: number;
  product_id: string;
  name: string;
  code: string;
  version: string;
  pack_size_ml: string;
  units_per_pack: string;
  water_litres_per_unit: string;
  expected_yield_percent: string;
  shelf_life_days: string;
  items: ItemDraft[];
};

const DEFAULT_FORM: BomForm = {
  product_id: "",
  name: "",
  code: "",
  version: "1",
  pack_size_ml: "500",
  units_per_pack: "12",
  water_litres_per_unit: "0.52",
  expected_yield_percent: "98",
  shelf_life_days: "365",
  items: [{ ...EMPTY_ITEM }],
};

export default function BillsOfMaterialsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [tableQuery, setTableQuery] = React.useState({
    page: 1,
    pageSize: 10,
    search: "",
    sortCol: "created_at",
    sortDir: "desc" as "asc" | "desc",
  });
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<BomForm>(DEFAULT_FORM);

  const bomsQuery = useQuery({
    queryKey: ["production", "boms", tableQuery, statusFilter],
    queryFn: () =>
      productionApi
        .listBoms({
          search: tableQuery.search || undefined,
          page: tableQuery.page,
          limit: tableQuery.pageSize,
          sort_col: tableQuery.sortCol,
          sort_dir: tableQuery.sortDir,
          status: statusFilter === "all" ? undefined : statusFilter,
        })
        .then((res) => res.data),
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["production", "boms"] });
  }, [queryClient]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        product_id: Number(form.product_id),
        name: form.name.trim(),
        code: form.code.trim(),
        version: Number(form.version || 1),
        pack_size_ml: Number(form.pack_size_ml || 0),
        units_per_pack: Number(form.units_per_pack || 1),
        water_litres_per_unit: Number(form.water_litres_per_unit || 0),
        expected_yield_percent: Number(form.expected_yield_percent || 100),
        shelf_life_days: form.shelf_life_days ? Number(form.shelf_life_days) : undefined,
        items: form.items
          .filter((item) => item.component_product_id)
          .map((item) => ({
            component_product_id: Number(item.component_product_id),
            component_type: item.component_type,
            quantity_per_unit: Number(item.quantity_per_unit || 0),
            uom: item.uom || "pcs",
            scrap_percent: Number(item.scrap_percent || 0),
            is_critical: item.is_critical,
          })),
      };

      return form.id ? productionApi.updateBom(form.id, payload) : productionApi.createBom(payload);
    },
    onSuccess: () => {
      toast.success(t("production.boms.saved", "Bill of materials saved."));
      invalidate();
      setOpen(false);
      setForm(DEFAULT_FORM);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || t("production.boms.save_failed", "Could not save the BOM."));
    },
  });

  const activateMutation = useMutation({
    mutationFn: (id: number) => productionApi.activateBom(id),
    onSuccess: () => {
      toast.success(t("production.boms.activated", "This version is now the active recipe; the previous one is archived."));
      invalidate();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || t("production.boms.activate_failed", "Could not activate the BOM."));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => productionApi.deleteBom(id),
    onSuccess: () => {
      toast.success(t("production.boms.deleted", "Bill of materials deleted."));
      invalidate();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || t("production.boms.delete_failed", "Could not delete the BOM."));
    },
  });

  const handleTableQueryChange = React.useCallback((query: DataTableQuery) => {
    setTableQuery({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || 10),
      search: String(query.search ?? ""),
      sortCol: String(query.sortCol || "created_at"),
      sortDir: query.sortDir === "asc" ? "asc" : "desc",
    });
  }, []);

  const columns = React.useMemo<ColumnDef<ProductionBom>[]>(
    () => [
      {
        accessorKey: "code",
        header: t("production.boms.col_bom", "Recipe"),
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-bold">{row.original.name}</p>
            <p className="font-mono text-[11px] text-muted-foreground">
              {row.original.code} · v{row.original.version}
            </p>
          </div>
        ),
      },
      {
        id: "pack",
        header: t("production.boms.col_pack", "Pack"),
        cell: ({ row }) => (
          <div className="space-y-0.5 text-xs">
            <p className="font-semibold">{Number(row.original.pack_size_ml).toLocaleString()} ml</p>
            <p className="text-muted-foreground">
              {row.original.units_per_pack} {t("production.boms.per_pack", "per pack")}
            </p>
          </div>
        ),
      },
      {
        id: "components",
        header: t("production.boms.col_components", "Components"),
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {(row.original.items ?? []).slice(0, 5).map((item) => (
              <Badge key={item.id} variant="secondary" className="text-[10px] font-bold">
                {item.component_type}
              </Badge>
            ))}
            {(row.original.items ?? []).length === 0 ? (
              <span className="text-xs text-muted-foreground">-</span>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "water_litres_per_unit",
        header: t("production.boms.col_water", "Water / unit"),
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">{Number(row.original.water_litres_per_unit).toFixed(3)} L</span>
        ),
      },
      {
        accessorKey: "status",
        header: t("production.common.status", "Status"),
        cell: ({ row }) => {
          const status = row.original.status;
          const classes =
            status === "active"
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              : status === "draft"
                ? "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                : "bg-muted text-muted-foreground";

          return (
            <Badge variant="outline" className={`border-transparent text-[11px] font-black uppercase tracking-widest ${classes}`}>
              {status}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: t("production.common.actions", "Actions"),
        cell: ({ row }) => {
          const bom = row.original;
          return (
            <div className="flex items-center gap-1.5">
              {bom.status !== "active" ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => activateMutation.mutate(bom.id)}
                >
                  <CheckCircle2 className="h-3 w-3" />
                  {t("production.boms.activate", "Activate")}
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => {
                  setForm({
                    id: bom.id,
                    product_id: String(bom.product_id),
                    name: bom.name,
                    code: bom.code,
                    version: String(bom.version),
                    pack_size_ml: String(bom.pack_size_ml),
                    units_per_pack: String(bom.units_per_pack),
                    water_litres_per_unit: String(bom.water_litres_per_unit),
                    expected_yield_percent: String(bom.expected_yield_percent),
                    shelf_life_days: bom.shelf_life_days ? String(bom.shelf_life_days) : "",
                    items: (bom.items ?? []).map((item) => ({
                      component_product_id: String(item.component_product_id),
                      component_type: item.component_type,
                      quantity_per_unit: String(item.quantity_per_unit),
                      uom: item.uom,
                      scrap_percent: String(item.scrap_percent),
                      is_critical: item.is_critical,
                    })),
                  });
                  setOpen(true);
                }}
              >
                {t("production.common.edit", "Edit")}
              </Button>
              {bom.status !== "active" ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive"
                  onClick={() => deleteMutation.mutate(bom.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </div>
          );
        },
      },
    ],
    [activateMutation, deleteMutation, t],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {t("production.boms.title", "Bills of Materials")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "production.boms.subtitle",
              "What one saleable bottle consumes — preform, cap, label, film, and treated water — including the scrap allowance.",
            )}
          </p>
        </div>
        <Button
          className="rounded-full px-5"
          onClick={() => {
            setForm(DEFAULT_FORM);
            setOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {t("production.boms.add_btn", "New Recipe")}
        </Button>
      </div>

      <div className="flex items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">{t("production.common.status", "Status")}</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[10rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("production.common.all", "All")}</SelectItem>
              {["draft", "active", "archived"].map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={(bomsQuery.data?.data ?? []) as ProductionBom[]}
        totalEntries={bomsQuery.data?.meta?.total ?? 0}
        loading={bomsQuery.isLoading}
        pageIndex={tableQuery.page}
        pageSize={tableQuery.pageSize}
        onQueryChange={handleTableQueryChange}
        searchPlaceholder={t("production.boms.search_placeholder", "Search recipes...")}
        resourceName="production-boms"
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {form.id ? t("production.boms.edit_title", "Edit Recipe") : t("production.boms.create_title", "New Recipe")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "production.boms.create_desc",
                  "Scrap percentage is added on top of the theoretical quantity, so a 2% preform allowance draws 1.02 preforms per bottle.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="max-h-[60vh] space-y-5 overflow-y-auto px-6 py-5">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="bom-product">{t("production.common.product_id", "Finished Product ID")}</Label>
                <Input
                  id="bom-product"
                  type="number"
                  value={form.product_id}
                  onChange={(event) => setForm((prev) => ({ ...prev, product_id: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bom-name">{t("production.common.name", "Name")}</Label>
                <Input
                  id="bom-name"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="0.5L Still Water"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bom-code">{t("production.common.code", "Code")}</Label>
                <Input
                  id="bom-code"
                  value={form.code}
                  onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
                  placeholder="BOM-500ML"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bom-pack">{t("production.boms.pack_size", "Fill Volume (ml)")}</Label>
                <Input
                  id="bom-pack"
                  type="number"
                  value={form.pack_size_ml}
                  onChange={(event) => setForm((prev) => ({ ...prev, pack_size_ml: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bom-units">{t("production.boms.units_per_pack", "Units per Pack")}</Label>
                <Input
                  id="bom-units"
                  type="number"
                  value={form.units_per_pack}
                  onChange={(event) => setForm((prev) => ({ ...prev, units_per_pack: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bom-water">{t("production.boms.water_per_unit", "Water per Unit (L)")}</Label>
                <Input
                  id="bom-water"
                  type="number"
                  step="0.001"
                  value={form.water_litres_per_unit}
                  onChange={(event) => setForm((prev) => ({ ...prev, water_litres_per_unit: event.target.value }))}
                />
                <p className="text-[11px] text-muted-foreground">
                  {t("production.boms.water_hint", "Include the rinse allowance, not just the fill volume.")}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bom-yield">{t("production.boms.expected_yield", "Expected Yield (%)")}</Label>
                <Input
                  id="bom-yield"
                  type="number"
                  step="0.01"
                  value={form.expected_yield_percent}
                  onChange={(event) => setForm((prev) => ({ ...prev, expected_yield_percent: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bom-shelf">{t("production.boms.shelf_life", "Shelf Life (days)")}</Label>
                <Input
                  id="bom-shelf"
                  type="number"
                  value={form.shelf_life_days}
                  onChange={(event) => setForm((prev) => ({ ...prev, shelf_life_days: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bom-version">{t("production.boms.version", "Version")}</Label>
                <Input
                  id="bom-version"
                  type="number"
                  min="1"
                  value={form.version}
                  onChange={(event) => setForm((prev) => ({ ...prev, version: event.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold">{t("production.boms.components", "Components")}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => setForm((prev) => ({ ...prev, items: [...prev.items, { ...EMPTY_ITEM }] }))}
                >
                  <Plus className="h-3 w-3" />
                  {t("production.boms.add_component", "Add Component")}
                </Button>
              </div>

              {form.items.map((item, index) => (
                <div key={index} className="grid gap-2 rounded-xl border border-border/40 bg-background p-3 md:grid-cols-12">
                  <div className="md:col-span-3">
                    <Label className="text-[11px]">{t("production.common.product_id", "Product ID")}</Label>
                    <Input
                      type="number"
                      className="h-9"
                      value={item.component_product_id}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          items: prev.items.map((candidate, candidateIndex) =>
                            candidateIndex === index
                              ? { ...candidate, component_product_id: event.target.value }
                              : candidate,
                          ),
                        }))
                      }
                    />
                  </div>
                  <div className="md:col-span-3">
                    <Label className="text-[11px]">{t("production.common.type", "Type")}</Label>
                    <Select
                      value={item.component_type}
                      onValueChange={(value) =>
                        setForm((prev) => ({
                          ...prev,
                          items: prev.items.map((candidate, candidateIndex) =>
                            candidateIndex === index ? { ...candidate, component_type: value } : candidate,
                          ),
                        }))
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COMPONENT_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type.replace(/_/g, " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-[11px]">{t("production.boms.qty_per_unit", "Qty / unit")}</Label>
                    <Input
                      type="number"
                      step="0.000001"
                      className="h-9"
                      value={item.quantity_per_unit}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          items: prev.items.map((candidate, candidateIndex) =>
                            candidateIndex === index
                              ? { ...candidate, quantity_per_unit: event.target.value }
                              : candidate,
                          ),
                        }))
                      }
                    />
                  </div>
                  <div className="md:col-span-1">
                    <Label className="text-[11px]">{t("production.common.uom", "UoM")}</Label>
                    <Input
                      className="h-9"
                      value={item.uom}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          items: prev.items.map((candidate, candidateIndex) =>
                            candidateIndex === index ? { ...candidate, uom: event.target.value } : candidate,
                          ),
                        }))
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-[11px]">{t("production.boms.scrap", "Scrap %")}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="h-9"
                      value={item.scrap_percent}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          items: prev.items.map((candidate, candidateIndex) =>
                            candidateIndex === index ? { ...candidate, scrap_percent: event.target.value } : candidate,
                          ),
                        }))
                      }
                    />
                  </div>
                  <div className="flex items-end justify-between gap-2 md:col-span-1">
                    <label className="flex items-center gap-1.5 text-[11px]">
                      <Checkbox
                        checked={item.is_critical}
                        onCheckedChange={(checked) =>
                          setForm((prev) => ({
                            ...prev,
                            items: prev.items.map((candidate, candidateIndex) =>
                              candidateIndex === index ? { ...candidate, is_critical: checked === true } : candidate,
                            ),
                          }))
                        }
                      />
                      {t("production.boms.critical", "Critical")}
                    </label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 shrink-0 p-0 text-destructive"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          items: prev.items.filter((_, candidateIndex) => candidateIndex !== index),
                        }))
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 bg-muted/20 px-6 py-4">
            <Button variant="outline" className="rounded-full" onClick={() => setOpen(false)}>
              {t("production.common.cancel", "Cancel")}
            </Button>
            <Button
              className="rounded-full"
              disabled={saveMutation.isPending}
              onClick={() => {
                if (!form.product_id || !form.name.trim() || !form.code.trim()) {
                  toast.error(t("production.boms.required_fields", "Product, name, and code are required."));
                  return;
                }
                saveMutation.mutate();
              }}
            >
              {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("production.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
