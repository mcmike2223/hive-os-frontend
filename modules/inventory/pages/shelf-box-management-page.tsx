"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  ArrowLeft, 
  Box as BoxIcon, 
  ChevronLeft, 
  Info, 
  Loader2, 
  Package, 
  Plus, 
  Settings2,
  Tag,
  Boxes,
  LayoutGrid
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/store/use-translation";
import { useSearchParams } from "next/navigation";
import { fetchInventoryProduct } from "@/modules/inventory/api";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { 
  fetchInventoryEntityRecords, 
  createInventoryEntityRecord, 
  updateInventoryEntityRecord,
  assignInventoryShelfBox
} from "@/modules/inventory/api";
import type { InventoryEntityRecord } from "@/modules/inventory/types";

const readPayloadValue = (record: InventoryEntityRecord, key: string, fallback: any = null): any => {
  const payload = record.payload;
  if (!payload || typeof payload !== "object") return fallback;
  const val = (payload as Record<string, any>)[key];
  return val ?? fallback;
};

export default function ShelfBoxManagementPage() {
  const { t } = useTranslation();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const shelfId = Number(params.id);
  const addProductId = searchParams.get("add_product_id");

  const [selectedBox, setSelectedBox] = React.useState<{ row: number; col: number; record?: InventoryEntityRecord } | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  const prodQuery = useQuery({
    queryKey: ["inventory", "products", "detail", addProductId],
    queryFn: () => (addProductId ? fetchInventoryProduct(Number(addProductId)) : null),
    enabled: !!addProductId,
  });

  const shelfQuery = useQuery({
    queryKey: ["inventory", "shelves", shelfId],
    queryFn: async () => {
      // In a real app, we'd have a find-by-id, but let's assume we fetch specifically
      const all = await fetchInventoryEntityRecords("shelves", { per_page: 1000 });
      return all.data.find(s => s.id === shelfId);
    }
  });

  const boxesQuery = useQuery({
    queryKey: ["inventory", "shelves", shelfId, "boxes"],
    queryFn: () => fetchInventoryEntityRecords("shelf-boxes", { parent_id: shelfId, per_page: 1000 }),
    enabled: !!shelfId
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (data.id) {
        return updateInventoryEntityRecord("shelf-boxes", data.id, data.payload);
      }
      return createInventoryEntityRecord("shelf-boxes", data.payload);
    },
    onSuccess: () => {
      toast.success(t("inventory.common.saved", "Box updated successfully."));
      queryClient.invalidateQueries({ queryKey: ["inventory", "shelves", shelfId, "boxes"] });
      setIsDialogOpen(false);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? t("inventory.common.failed", "Error saving box."));
    }
  });

  if (shelfQuery.isLoading || boxesQuery.isLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const shelf = shelfQuery.data;
  if (!shelf) return <div className="p-8 text-center text-muted-foreground">{t("inventory.shelves.not_found", "Shelf not found")}</div>;

  const rows = Number(readPayloadValue(shelf, "rows", 1));
  const columns = Number(readPayloadValue(shelf, "columns", 1));
  const capacity = Number(readPayloadValue(shelf, "capacity", 1));

  // Map boxes to grid
  const boxMap = new Map<string, InventoryEntityRecord>();
  boxesQuery.data?.data.forEach(box => {
    const r = readPayloadValue(box, "row");
    const c = readPayloadValue(box, "column");
    if (r != null && c != null) {
      boxMap.set(`${r}-${c}`, box);
    }
  });

  const handleBoxClick = (row: number, col: number) => {
    const record = boxMap.get(`${row}-${col}`);
    setSelectedBox({ row, col, record });
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-8 pb-10">
      {addProductId && (
        <div className="flex items-center justify-between rounded-3xl border border-border bg-muted/50 p-4 mb-6 transition-all animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-black text-foreground">{t("inventory.shelf_boxes.guided_title", "Guided Assignment Mode")}</p>
              <p className="text-xs font-medium text-muted-foreground">
                {t("inventory.shelf_boxes.guided_desc_prefix", "Click an empty box to store")} <span className="font-bold underline text-primary">{prodQuery.data?.product.name ?? t("inventory.common.loading", "Loading...")}</span> {t("inventory.shelf_boxes.guided_desc_suffix", "in this shelf.")}
              </p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="rounded-full font-bold" 
            onClick={() => router.push("/dashboard/inventory/catalog/products")}
          >
            {t("inventory.common.cancel", "Cancel Assignment")}
          </Button>
        </div>
      )}

      {/* Header Area */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-4">
          <Button 
            variant="ghost" 
            size="sm" 
            className="rounded-full -ml-2 text-muted-foreground hover:text-foreground"
            onClick={() => router.back()}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            {t("inventory.shelves.back_to_list", "Back to Shelves")}
          </Button>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <LayoutGrid className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">{t("inventory.warehouses.title", "Warehouse")}: {shelf.parent?.name || t("inventory.common.none", "Unassigned")}</span>
              </div>
              <h1 className="text-3xl font-black tracking-tight underline decoration-primary/30 underline-offset-4">
                {t("inventory.shelves.manage_shelf", "Manage Shelf")}: <span className="text-primary">{shelf.name}</span>
              </h1>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end">
           <Badge variant="outline" className="rounded-full bg-background/50 px-3 py-1 font-mono text-xs backdrop-blur-sm border-primary/20">
             {shelf.code}
           </Badge>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: t("inventory.shelves.col_rows_cols", "Dimensions"), value: `${rows} × ${columns}`, icon: LayoutGrid, color: "text-blue-500" },
          { label: t("inventory.shelf_boxes.total_boxes", "Total Boxes"), value: rows * columns, icon: Boxes, color: "text-purple-500" },
          { label: t("inventory.shelves.col_capacity", "Capacity/Box"), value: `${capacity} ${t("inventory.common.units", "units")}`, icon: BoxIcon, color: "text-orange-500" },
          { label: t("inventory.shelf_boxes.stored_summary", "Stored Items Summary"), value: boxesQuery.data?.total || 0, icon: Package, color: "text-emerald-500" }
        ].map((stat, i) => (
          <div key={i} className="group relative overflow-hidden rounded-[2rem] border border-border/50 bg-background/40 p-6 backdrop-blur-xl transition-all hover:border-primary/30">
            <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-background/80 shadow-sm border border-border/10 ${stat.color}`}>
              <stat.icon className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
            <p className="text-2xl font-black tracking-tight">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-6 rounded-[1.5rem] border border-border/40 bg-muted/20 px-6 py-4 backdrop-blur-sm">
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">{t("inventory.common.legend", "Legend")}</span>
        {[
          { color: "bg-background border-border", label: t("inventory.shelf_boxes.available", "Available") },
          { color: "bg-primary border-primary/30", label: t("inventory.shelf_boxes.occupied", "Occupied") },
          { color: "bg-orange-500 border-orange-500/30", label: t("inventory.shelf_boxes.reserved", "Reserved") },
          { icon: Package, label: t("inventory.common.product", "Product") },
          { icon: Tag, label: t("inventory.common.good", "Good") }
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            {item.color && (
              <div className={`h-4 w-4 rounded-md border shadow-sm ${item.color}`} />
            )}
            {item.icon && (
               <item.icon className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-sm font-medium">{item.label}</span>
          </div>
        ))}
      </div>

      {/* The Grid */}
      <div 
        className="grid gap-3" 
        style={{ 
          gridTemplateColumns: `repeat(${columns}, minmax(140px, 1fr))` 
        }}
      >
        {Array.from({ length: rows }).map((_, rowIndex) => (
          Array.from({ length: columns }).map((_, colIndex) => {
            const r = rowIndex + 1;
            const c = colIndex + 1;
            const box = boxMap.get(`${r}-${c}`);
            const statusValue = readPayloadValue((box || {}) as InventoryEntityRecord, "status", "available");
            const storableType = readPayloadValue((box || {}) as InventoryEntityRecord, "storable_type");
            
            const statusLabel = statusValue === 'occupied' 
              ? t("inventory.shelf_boxes.occupied", "occupied") 
              : statusValue === 'reserved' 
                ? t("inventory.shelf_boxes.reserved", "reserved") 
                : t("inventory.shelf_boxes.available", "available");

            return (
              <button
                key={`${r}-${c}`}
                onClick={() => handleBoxClick(r, c)}
                className={`
                  group relative flex aspect-video flex-col items-center justify-center rounded-[1.5rem] border p-4 transition-all duration-300
                  ${box 
                    ? statusValue === 'occupied' 
                      ? 'bg-primary/10 border-primary/30 hover:bg-primary/20 shadow-lg shadow-primary/5' 
                      : statusValue === 'reserved'
                        ? 'bg-orange-500/10 border-orange-500/30 hover:bg-orange-500/20 shadow-lg shadow-orange-500/5'
                        : 'bg-background border-border hover:border-primary/30 hover:bg-accent/50'
                    : 'bg-muted/10 border-dashed border-border/40 hover:border-primary/30 hover:bg-accent/30'}
                `}
              >
                <span className="absolute left-3 top-3 font-mono text-[11px] font-bold tracking-tighter text-muted-foreground opacity-40 group-hover:opacity-100">
                  R{r}C{c}
                </span>
                
                {box ? (
                  <>
                    <div className={`mb-2 rounded-xl p-2 transition-transform group-hover:scale-110 ${statusValue === 'occupied' ? 'bg-primary/20 text-primary dark:text-primary-foreground' : statusValue === 'reserved' ? 'bg-orange-500/20 text-orange-600 dark:text-orange-400' : 'bg-muted text-muted-foreground'}`}>
                      {storableType === 'product' ? <Package className="h-5 w-5" /> : <Tag className="h-5 w-5" />}
                    </div>
                    <span className="text-xs font-bold tracking-tight truncate max-w-full px-1 text-foreground">{box.name}</span>
                    <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">{statusLabel}</span>
                  </>
                ) : (
                  <Plus className="h-6 w-6 text-muted-foreground/20 transition-all group-hover:scale-110 group-hover:text-primary/40" />
                )}
              </button>
            );
          })
        ))}
      </div>

      {/* Assignment Dialog */}
      <BoxAssignmentDialog 
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        shelfId={shelfId}
        boxData={selectedBox}
        onSave={saveMutation.mutate}
        isPending={saveMutation.isPending}
        addProductId={addProductId}
      />
    </div>
  );
}

function BoxAssignmentDialog({ isOpen, onClose, shelfId, boxData, onSave, isPending, addProductId }: any) {
  const { t } = useTranslation();
  const [formData, setFormData] = React.useState({
    name: "",
    code: "",
    status: "available",
    storable_type: "product",
    storable_id: "",
    quantity_stored: "0",
    notes: ""
  });

  React.useEffect(() => {
    if (boxData?.record) {
      const box = boxData.record;
      setFormData({
        name: box.name,
        code: box.code || "",
        status: readPayloadValue(box, "status", "available"),
        storable_type: readPayloadValue(box, "storable_type", "product"),
        storable_id: String(readPayloadValue(box, "storable_id", "")),
        quantity_stored: String(readPayloadValue(box, "quantity_stored", "0")),
        notes: readPayloadValue(box, "notes", "")
      });
    } else {
      setFormData({
        name: boxData ? `${t("inventory.shelf_boxes.box", "Box")} R${boxData.row}C${boxData.col}` : "",
        code: boxData ? `BX-${shelfId}-${boxData.row}-${boxData.col}` : "",
        status: addProductId ? "occupied" : "available",
        storable_type: "product",
        storable_id: addProductId || "",
        quantity_stored: "0",
        notes: ""
      });
    }
  }, [boxData, shelfId, addProductId, t]);

  const handleSubmit = () => {
    onSave({
      id: boxData?.record?.id,
      payload: {
        name: formData.name,
        code: formData.code,
        parent_id: shelfId,
        is_active: true,
        payload: {
          row: boxData.row,
          column: boxData.col,
          status: formData.status,
          storable_type: formData.storable_type,
          storable_id: Number(formData.storable_id) || null,
          quantity_stored: Number(formData.quantity_stored),
          notes: formData.notes
        }
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl rounded-[2.5rem] border-border/40 bg-background/95 p-0 backdrop-blur-2xl">
        <div className="border-b border-border/20 px-8 py-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tight">
              {boxData?.record ? t("inventory.shelf_boxes.edit_title", "Edit Box") : t("inventory.shelf_boxes.create_title", "Create Box")} - R{boxData?.row}C{boxData?.col}
            </DialogTitle>
            <DialogDescription>
              {t("inventory.shelf_boxes.config_desc", "Configuration for storage coordinates")} R{boxData?.row} {t("inventory.common.and", "and")} C{boxData?.col}.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="grid gap-6 px-8 py-8 md:grid-cols-2">
           <div className="space-y-2">
             <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">{t("inventory.shelf_boxes.name_label", "Box Name")}</Label>
             <Input 
                value={formData.name} 
                onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                className="rounded-2xl border-border/40 bg-background/50 focus:ring-primary/20"
              />
           </div>
           <div className="space-y-2">
             <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">{t("inventory.common.code", "Code")}</Label>
             <Input 
                value={formData.code} 
                onChange={e => setFormData(p => ({ ...p, code: e.target.value }))}
                className="rounded-2xl border-border/40 bg-background/50"
              />
           </div>
           <div className="space-y-2">
             <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">{t("inventory.common.status", "Status")}</Label>
             <Select value={formData.status} onValueChange={v => setFormData(p => ({ ...p, status: v }))}>
               <SelectTrigger className="rounded-2xl border-border/40"><SelectValue /></SelectTrigger>
               <SelectContent className="rounded-2xl">
                 <SelectItem value="available">{t("inventory.shelf_boxes.available", "Available")}</SelectItem>
                 <SelectItem value="occupied">{t("inventory.shelf_boxes.occupied", "Occupied")}</SelectItem>
                 <SelectItem value="reserved">{t("inventory.shelf_boxes.reserved", "Reserved")}</SelectItem>
               </SelectContent>
             </Select>
           </div>
           <div className="space-y-2">
             <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">{t("inventory.shelf_boxes.quantity_label", "Stored Qty")}</Label>
             <Input 
                type="number"
                value={formData.quantity_stored} 
                onChange={e => setFormData(p => ({ ...p, quantity_stored: e.target.value }))}
                className="rounded-2xl border-border/40 bg-background/50"
              />
           </div>
           <div className="space-y-2">
             <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">{t("inventory.shelf_boxes.storable_type", "Storable Type")}</Label>
             <Select value={formData.storable_type} onValueChange={v => setFormData(p => ({ ...p, storable_type: v }))}>
               <SelectTrigger className="rounded-2xl border-border/40"><SelectValue /></SelectTrigger>
               <SelectContent className="rounded-2xl">
                 <SelectItem value="product">{t("inventory.common.product", "Product")}</SelectItem>
                 <SelectItem value="good">{t("inventory.common.good", "Good / Item")}</SelectItem>
               </SelectContent>
             </Select>
           </div>
           <div className="space-y-2">
             <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">{t("inventory.shelf_boxes.storable_id", "Storable ID")}</Label>
             <Input 
                type="number"
                value={formData.storable_id} 
                onChange={e => setFormData(p => ({ ...p, storable_id: e.target.value }))}
                placeholder={t("inventory.common.database_id", "Database ID")}
                className="rounded-2xl border-border/40 bg-background/50"
              />
           </div>
           <div className="space-y-2 md:col-span-2">
             <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">{t("inventory.common.notes", "Notes")}</Label>
             <Textarea 
                value={formData.notes} 
                onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                placeholder={t("inventory.shelf_boxes.notes_placeholder", "Handling instructions...")}
                className="min-h-[100px] rounded-2xl border-border/40 bg-background/50"
              />
           </div>
        </div>

        <DialogFooter className="border-t border-border/20 bg-muted/20 px-8 py-6">
          <Button variant="ghost" onClick={onClose} className="rounded-full font-bold">{t("inventory.common.cancel", "Cancel")}</Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isPending}
            className="rounded-full bg-primary px-8 font-black tracking-tight"
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {boxData?.record 
              ? t("inventory.common.save", "Update Box") 
              : addProductId 
                ? t("inventory.shelf_boxes.assign_btn", "Assign Product to Box") 
                : t("inventory.common.create_assign", "Create & Assign")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
