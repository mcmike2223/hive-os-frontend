"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  ArrowLeft, 
  Box as BoxIcon, 
  ChevronLeft,
  Loader2, 
  Package, 
  Plus, 
  Tag,
  Boxes,
  LayoutGrid
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/store/use-translation";
import { useSearchParams } from "next/navigation";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { warehouseApi } from "@/modules/warehouse/api";
import { fetchInventoryProduct, fetchInventoryProducts, fetchInventoryItems } from "@/modules/inventory/api";
import type { InventoryItem, ProductDetailResponse, ProductRecord } from "@/modules/inventory/types";
import type { WarehouseLocation } from "@/modules/warehouse/types";
import { notifyMutationOutcome } from "@/modules/workflow/utils/mutation-outcome";

type StorableListItem = {
  id: number;
  name: string;
  sku: string;
  quantityLabel: string;
};

type BoxAssignmentDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  shelfId: number;
  boxData: { row: number; col: number; record?: WarehouseLocation } | null;
  onSave: (data: {
    id?: number;
    payload: {
      name: string;
      code: string;
      type: "box";
      parent_id: number;
      is_active: boolean;
      metadata: Record<string, unknown>;
    };
  }) => void;
  isPending: boolean;
  addProductId: string | null;
  clearBoxMutation: {
    isPending: boolean;
    mutate: (boxId: number) => void;
  };
};

const readPayloadValue = (record: WarehouseLocation | Record<string, unknown>, key: string, fallback: unknown = null): unknown => {
  const meta = (record as WarehouseLocation).metadata;
  if (!meta || typeof meta !== "object") return fallback;
  const val = (meta as Record<string, unknown>)[key];
  return val ?? fallback;
};

const unwrapProductDetail = (
  res: ProductDetailResponse | ProductRecord | null | undefined
): ProductRecord | null => {
  if (!res) return null;
  if ("product" in res && res.product) return res.product;
  if ("id" in res && "name" in res && "sku" in res) return res as ProductRecord;
  return null;
};

const toStorableListItemFromProduct = (product: ProductRecord): StorableListItem => ({
  id: product.id,
  name: product.name,
  sku: product.sku,
  quantityLabel: String(product.quantity ?? ""),
});

const toStorableListItemFromInventoryItem = (item: InventoryItem): StorableListItem => ({
  id: item.id,
  name: item.name,
  sku: item.sku,
  quantityLabel: String(item.current_stock ?? ""),
});


export function ShelfBoxesPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  
  const highlight_parent_id = searchParams.get("highlight_parent_id");
  const shelfId = highlight_parent_id ? Number(highlight_parent_id) : null;
  const addProductId = searchParams.get("add_product_id");

  const [selectedBox, setSelectedBox] = React.useState<{ row: number; col: number; record?: WarehouseLocation } | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [filterOccupied, setFilterOccupied] = React.useState<"all" | "occupied" | "available">("all");
  const [highlightOccupied, setHighlightOccupied] = React.useState(false);

  const shelfQuery = useQuery({
    queryKey: ["warehouse", "locations", "detail", shelfId],
    queryFn: async () => {
      const res = await warehouseApi.getLocation(shelfId!);
      return res.data?.data || res.data;
    },
    enabled: !!shelfId
  });

  const boxesQuery = useQuery({
    queryKey: ["warehouse", "locations", "boxes", shelfId],
    queryFn: async () => {
      const res = await warehouseApi.listLocations({ type: "box", parent_id: shelfId!, limit: 1000 });
      return res.data?.data || res.data || [];
    },
    enabled: !!shelfId
  });

  const allProductIds = React.useMemo(() => {
    const boxes = boxesQuery.data || [];
    const ids = new Set<number>();
    boxes.forEach((box: any) => {
      const storableId = box.metadata?.storable_id;
      if (storableId) ids.add(Number(storableId));
    });
    return Array.from(ids);
  }, [boxesQuery.data]);

  const productsQuery = useQuery({
    queryKey: ["inventory", "products", "batch", allProductIds],
    queryFn: async (): Promise<Record<number, ProductRecord>> => {
      if (allProductIds.length === 0) return {};
      const results = await Promise.all(allProductIds.map((id) => fetchInventoryProduct(id)));
      const map: Record<number, ProductRecord> = {};
      results.forEach((res, i) => {
        const product = unwrapProductDetail(res);
        if (product) map[allProductIds[i]] = product;
      });
      return map;
    },
    enabled: allProductIds.length > 0,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const warehouseId = shelfQuery.data?.warehouse_id;
      if (data.id) {
        return warehouseApi.updateLocation(data.id, data.payload);
      }
      return warehouseApi.createLocation({ ...data.payload, warehouse_id: warehouseId });
    },
    onSuccess: (response: any) => {
      const body = response?.data ?? response;
      const outcome = notifyMutationOutcome(body, {
        savedMessage: addProductId
          ? t("inventory.shelf_boxes.assigned", "Product assigned to shelf successfully.")
          : t("inventory.common.saved", "Box updated successfully."),
        submittedMessage: t(
          "inventory.shelf_boxes.pending_approval",
          "Shelf assignment submitted for approval."
        ),
        queryClient,
      });
      queryClient.invalidateQueries({ queryKey: ["warehouse", "locations", "boxes", shelfId] });
      queryClient.invalidateQueries({ queryKey: ["warehouse", "locations", "box-counts"] });
      queryClient.invalidateQueries({ queryKey: ["inventory", "products"] });
      setIsDialogOpen(false);
      if (addProductId) {
        router.push("/dashboard/inventory/catalog/products");
      }
      return outcome;
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? t("inventory.common.failed", "Error saving box."));
    }
  });

  const clearBoxMutation = useMutation({
    mutationFn: async (boxId: number) => {
      return warehouseApi.updateLocation(boxId, {
        name: `Box ${selectedBox?.row}x${selectedBox?.col}`,
        metadata: {
          row: selectedBox?.row,
          column: selectedBox?.col,
          status: "available",
          storable_type: null,
          storable_id: null,
          quantity_stored: 0,
          notes: ""
        }
      });
    },
    onSuccess: () => {
      toast.success("Box cleared successfully.");
      queryClient.invalidateQueries({ queryKey: ["warehouse", "locations", "boxes", shelfId] });
      queryClient.invalidateQueries({ queryKey: ["warehouse", "locations", "box-counts"] });
      queryClient.invalidateQueries({ queryKey: ["inventory", "products"] });
      setIsDialogOpen(false);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? "Error clearing box.");
    }
  });

  const deleteBoxMutation = useMutation({
    mutationFn: async (boxId: number) => {
      return warehouseApi.deleteLocation(boxId);
    },
    onSuccess: () => {
      toast.success("Box deleted successfully.");
      queryClient.invalidateQueries({ queryKey: ["warehouse", "locations", "boxes", shelfId] });
      queryClient.invalidateQueries({ queryKey: ["warehouse", "locations", "box-counts"] });
      queryClient.invalidateQueries({ queryKey: ["inventory", "products"] });
      setIsDialogOpen(false);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? "Error deleting box.");
    }
  });

  const boxesDataAll = boxesQuery.data || [];
  const occupiedCount = boxesDataAll.filter((b: any) => b.metadata?.status === "occupied").length;
  const availableCount = boxesDataAll.filter((b: any) => b.metadata?.status !== "occupied").length;
  const totalStoredQty = boxesDataAll.reduce((sum: number, b: any) => sum + (Number(b.metadata?.quantity_stored) || 0), 0);

  const occupiedBoxes = boxesDataAll.filter((b: WarehouseLocation) => b.metadata?.status === "occupied" && b.metadata?.storable_type === "product");
  const uniqueProductsMap = new Map<number, { product: ProductRecord | null; quantity: number; boxes: string[]; productId: number }>();
  occupiedBoxes.forEach((box: WarehouseLocation) => {
    const pid = Number(box.metadata?.storable_id);
    const qty = Number(box.metadata?.quantity_stored) || 0;
    const pos = `R${box.metadata?.row}C${box.metadata?.column}`;
    const productsData = productsQuery.data;
    const productInfo = productsData ? productsData[pid] ?? null : null;
    if (pid && uniqueProductsMap.has(pid)) {
      const existing = uniqueProductsMap.get(pid)!;
      existing.quantity += qty;
      existing.boxes.push(pos);
    } else if (pid) {
      uniqueProductsMap.set(pid, { product: productInfo, quantity: qty, boxes: [pos], productId: pid });
    }
  });
  const uniqueProducts = Array.from(uniqueProductsMap.values());

  if (!shelfId) {
    return (
      <div className="flex h-[400px] flex-col items-center justify-center p-8 text-center bg-muted/20 border border-border/40 rounded-3xl m-8">
         <BoxIcon className="h-12 w-12 text-muted-foreground/50 mb-4" />
         <h2 className="text-xl font-bold mb-2">{t("warehouse.boxes.select_shelf", "Select a shelf to view boxes")}</h2>
         <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            {t("warehouse.boxes.select_shelf_desc", "Boxes are managed visually within their parent shelves. Return to the Shelves page and click 'Manage Boxes' on a specific shelf.")}
         </p>
         <Button onClick={() => router.push("/dashboard/warehouse/locations/shelves")} className="rounded-full shadow-lg shadow-primary/20">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("warehouse.shelves.go_to", "Go to Shelves")}
         </Button>
      </div>
    );
  }

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
  const boxMap = new Map<string, WarehouseLocation>();
  const boxesData: WarehouseLocation[] = Array.isArray(boxesQuery.data)
    ? boxesQuery.data
    : [];
  
  boxesData.forEach((box) => {
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
      {/* Header Area */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-4">
          <Button 
            variant="ghost" 
            size="sm" 
            className="rounded-full -ml-2 text-muted-foreground hover:text-foreground"
            onClick={() => router.push("/dashboard/warehouse/locations/shelves")}
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
                <span className="text-sm font-medium text-muted-foreground">
                  {t("warehouse.title", "Warehouse")}: {shelf.warehouse?.name || t("inventory.common.none", "Unassigned")}
                </span>
              </div>
              <h1 className="text-3xl font-black tracking-tight underline decoration-primary/30 underline-offset-4">
                {t("inventory.shelves.manage_shelf", "Manage Shelf")}: <span className="text-primary">{shelf.name || shelf.code}</span>
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

      {/* Add Product Guidance Banner */}
      {addProductId && (
        <div className="rounded-2xl border border-primary/50 bg-primary/10 p-4 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">Assign Product to Box</p>
              <p className="text-sm text-muted-foreground">Click on any box below to assign this product to it.</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/dashboard/warehouse/locations/shelves")}
              className="rounded-xl"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Search and Filter */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/50 bg-background/40 p-4 backdrop-blur-xl">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="Search by product name or SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-xl bg-background/60"
          />
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={filterOccupied === "all" ? "default" : "outline"}
            className="rounded-full"
            onClick={() => setFilterOccupied("all")}
          >
            All
          </Button>
          <Button
            size="sm"
            variant={filterOccupied === "occupied" ? "default" : "outline"}
            className="rounded-full"
            onClick={() => setFilterOccupied("occupied")}
          >
            Occupied
          </Button>
          <Button
            size="sm"
            variant={filterOccupied === "available" ? "default" : "outline"}
            className="rounded-full"
            onClick={() => setFilterOccupied("available")}
          >
            Available
          </Button>
          <Button
            size="sm"
            variant={highlightOccupied ? "default" : "outline"}
            className={`rounded-full ${highlightOccupied ? "bg-orange-500 hover:bg-orange-600" : ""}`}
            onClick={() => setHighlightOccupied(!highlightOccupied)}
          >
            {highlightOccupied ? "Hide Highlights" : "Show Occupied"}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Dimensions", value: `${rows} × ${columns}`, icon: LayoutGrid, color: "text-blue-500" },
          { label: "Total Boxes", value: rows * columns, icon: Boxes, color: "text-purple-500" },
          { label: "Occupied", value: occupiedCount, icon: Package, color: "text-orange-500" },
          { label: "Available", value: availableCount, icon: BoxIcon, color: "text-green-500" },
          { label: "Total Stored", value: totalStoredQty, icon: Tag, color: "text-emerald-500" }
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

      {/* Unique Products Summary */}
      {uniqueProducts.length > 0 && (
        <div className="rounded-2xl border border-border/50 bg-background/40 p-6 backdrop-blur-xl">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Stored Products Summary ({uniqueProducts.length})
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {uniqueProducts.map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/30">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">
                    {item.product?.name || `Product #${item.productId}`}
                  </div>
                  <div className="text-xs text-muted-foreground flex gap-2">
                    <span>Qty: {item.quantity}</span>
                    <span>•</span>
                    <span>Boxes: {item.boxes.join(", ")}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
            const statusValue = String(readPayloadValue((box || {}) as WarehouseLocation, "status", "available") ?? "available");
            const storableType = readPayloadValue((box || {}) as WarehouseLocation, "storable_type");
            
            const statusLabel = statusValue === "occupied"
              ? t("inventory.shelf_boxes.occupied", "occupied")
              : statusValue === "reserved"
                ? t("inventory.shelf_boxes.reserved", "reserved")
                : t("inventory.shelf_boxes.available", "available");

            const storableId = box?.metadata?.storable_id;
            const storableTypeMeta = box?.metadata?.storable_type;
            const prodInfo =
              storableId && storableTypeMeta === "product"
                ? productsQuery.data?.[Number(storableId)] ?? null
                : null;
            const productName =
              prodInfo?.name ||
              box?.name ||
              (storableTypeMeta === "product"
                ? `Product #${storableId}`
                : storableTypeMeta === "good"
                  ? `Good #${storableId}`
                  : "");
            const productSku = prodInfo?.sku || "";
            const matchesSearch = !searchQuery ||
              productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
              productSku.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesFilter = filterOccupied === "all" ||
              (filterOccupied === "occupied" && statusValue === "occupied") ||
              (filterOccupied === "available" && statusValue !== "occupied");

            if (!matchesSearch || !matchesFilter) {
              return (
                <div key={`${r}-${c}`} className="aspect-video rounded-[1.5rem] border border-dashed border-transparent" />
              );
            }

            return (
              <button
                key={`${r}-${c}`}
                onClick={() => handleBoxClick(r, c)}
                className={`
                  group relative flex aspect-video flex-col items-center justify-center rounded-[1.5rem] border p-4 transition-all duration-300
                  ${highlightOccupied && statusValue === 'occupied' 
                    ? 'ring-4 ring-orange-500 ring-offset-2 ring-offset-background' 
                    : ''}
                  ${box 
                    ? statusValue === 'occupied' 
                      ? 'bg-primary/10 border-primary/30 hover:bg-primary/20 shadow-lg shadow-primary/5' 
                      : statusValue === 'reserved'
                        ? 'bg-orange-500/10 border-orange-500/30 hover:bg-orange-500/20 shadow-lg shadow-orange-500/5'
                        : 'bg-background border-border hover:border-primary/30 hover:bg-accent/50'
                    : 'bg-muted/10 border-dashed border-border/40 hover:border-primary/30 hover:bg-accent/30'}
                `}
              >
                <span className="absolute left-3 top-3 font-mono text-[10px] font-bold tracking-tighter text-muted-foreground opacity-40 group-hover:opacity-100">
                  R{r}C{c}
                </span>
                
                {box ? (
                  <>
                    <div className={`mb-2 rounded-xl p-2 transition-transform group-hover:scale-110 ${statusValue === 'occupied' ? 'bg-primary/20 text-primary dark:text-primary-foreground' : statusValue === 'reserved' ? 'bg-orange-500/20 text-orange-600 dark:text-orange-400' : 'bg-muted text-muted-foreground'}`}>
                      {storableTypeMeta === 'product' ? <Package className="h-5 w-5" /> : <Tag className="h-5 w-5" />}
                    </div>
                    <span className="text-xs font-bold tracking-tight truncate max-w-full px-1 text-foreground">
                      {storableId ? (
                        <div className="text-center">
                          <div className="truncate">{productName}</div>
                          <div className="text-[9px] font-mono text-muted-foreground">{productSku}</div>
                          <div className="text-[9px] font-mono text-orange-600">
                            Qty: {String(readPayloadValue(box, "quantity_stored", 0) ?? 0)}
                          </div>
                        </div>
                      ) : box.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">{statusLabel}</span>
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
        clearBoxMutation={clearBoxMutation}
      />
    </div>
  );
}

function BoxAssignmentDialog({
  isOpen,
  onClose,
  shelfId,
  boxData,
  onSave,
  isPending,
  addProductId,
  clearBoxMutation,
}: BoxAssignmentDialogProps) {
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
  const [productSearch, setProductSearch] = React.useState("");
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const [isClearDialogOpen, setIsClearDialogOpen] = React.useState(false);

  const productsQuery = useQuery({
    queryKey: ["inventory", "products", "list", productSearch, formData.storable_type],
    queryFn: async (): Promise<StorableListItem[]> => {
      try {
        if (formData.storable_type === "good") {
          const res = await fetchInventoryItems({ search: productSearch || undefined, per_page: 50 });
          const rows = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
          return rows.map(toStorableListItemFromInventoryItem);
        }

        const res = await fetchInventoryProducts({ search: productSearch || undefined, per_page: 50 });
        const rows = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        return rows.map(toStorableListItemFromProduct);
      } catch {
        return [];
      }
    },
    enabled: true,
  });

  const specificProductQuery = useQuery({
    queryKey: ["inventory", "product", "detail", addProductId],
    queryFn: async (): Promise<ProductRecord | null> => {
      if (!addProductId) return null;
      try {
        const res = await fetchInventoryProduct(Number(addProductId));
        return unwrapProductDetail(res);
      } catch {
        return null;
      }
    },
    enabled: !!addProductId,
  });

  const selectedProduct = React.useMemo((): StorableListItem | null => {
    if (!formData.storable_id) return null;
    const fromList = productsQuery.data?.find((p) => p.id === Number(formData.storable_id));
    if (fromList) return fromList;
    const guided = specificProductQuery.data;
    if (guided && guided.id === Number(formData.storable_id)) {
      return toStorableListItemFromProduct(guided);
    }
    return null;
  }, [formData.storable_id, productsQuery.data, specificProductQuery.data]);

  React.useEffect(() => {
    if (boxData?.record) {
      const box = boxData.record;
      const existingStorableId = readPayloadValue(box, "storable_id", "");
      const existingStatus = String(readPayloadValue(box, "status", "available") ?? "available");
      const shouldPrefillAssign =
        !!addProductId && !existingStorableId && existingStatus !== "occupied";

      setFormData({
        name: box.name || "",
        code: box.code || "",
        status: shouldPrefillAssign ? "occupied" : existingStatus,
        storable_type: shouldPrefillAssign
          ? "product"
          : String(readPayloadValue(box, "storable_type", "product") ?? "product"),
        storable_id: shouldPrefillAssign
          ? String(addProductId)
          : String(existingStorableId || ""),
        quantity_stored: String(readPayloadValue(box, "quantity_stored", "0") ?? "0"),
        notes: String(readPayloadValue(box, "notes", "") ?? "")
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

  // Prefill product search when guided assign product data loads
  React.useEffect(() => {
    if (!addProductId || !specificProductQuery.data) return;
    const productName = specificProductQuery.data.name || "";
    if (!productName) return;

    const existingStorableId = boxData?.record
      ? readPayloadValue(boxData.record, "storable_id", "")
      : "";
    if (!existingStorableId || String(existingStorableId) === String(addProductId)) {
      setProductSearch(productName);
    }
  }, [addProductId, specificProductQuery.data, boxData?.record]);

  const handleSubmit = () => {
    if (!boxData) return;

    const storableId = Number(formData.storable_id) || null;
    const hasStorable = !!storableId;
    const status = hasStorable
      ? (formData.status === "available" ? "occupied" : formData.status)
      : formData.status;

    onSave({
      id: boxData.record?.id,
      payload: {
        name: formData.name,
        code: formData.code,
        type: "box",
        parent_id: shelfId,
        is_active: true,
        metadata: {
          row: boxData.row,
          column: boxData.col,
          status,
          storable_type: hasStorable ? formData.storable_type : null,
          storable_id: storableId,
          quantity_stored: Number(formData.quantity_stored),
          notes: formData.notes
        }
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(nextOpen) => {
      if (!nextOpen && isDropdownOpen) {
        setIsDropdownOpen(false);
        return;
      }
      if (!nextOpen) onClose();
    }}>
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
            <div className="space-y-2 relative">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Select Product</Label>
              <Input
                placeholder="Search products..."
                value={productSearch}
                onChange={e => {
                  setProductSearch(e.target.value);
                  setIsDropdownOpen(true);
                }}
                onFocus={() => setIsDropdownOpen(true)}
                className="rounded-2xl border-border/40 bg-background/50"
              />
              {productSearch && isDropdownOpen && (
                <div className="absolute z-50 w-full max-h-40 overflow-y-auto border border-border/40 rounded-xl bg-background shadow-lg mt-1">
                  {productsQuery.data?.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          storable_id: String(p.id),
                          name: p.name,
                          status: prev.status === "available" ? "occupied" : prev.status,
                        }));
                        setProductSearch(p.name);
                        setIsDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-muted text-sm border-b border-border/20 last:border-0"
                    >
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">SKU: {p.sku} | Qty: {p.quantityLabel}</div>
                    </button>
                  ))}
                </div>
              )}
              {selectedProduct && (
                <div className="mt-2 p-2 rounded-lg bg-primary/10 border border-primary/30">
                  <div className="text-sm font-bold">{selectedProduct.name}</div>
                  <div className="text-xs text-muted-foreground">SKU: {selectedProduct.sku}</div>
                </div>
              )}
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
          {boxData?.record && (
            <div className="flex-1">
              <AlertDialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={clearBoxMutation.isPending || isPending}
                    className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-xl"
                  >
                    <Loader2 className={`mr-2 h-4 w-4 ${clearBoxMutation.isPending ? "animate-spin" : ""}`} />
                    Clear Box
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-[2rem] border-border/60 bg-background/95 backdrop-blur-xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear Box?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove the product/good from this box.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="rounded-xl bg-orange-600 hover:bg-orange-700"
                      onClick={() => clearBoxMutation.mutate(boxData.record!.id)}
                    >
                      Clear
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
          <Button variant="ghost" onClick={onClose} className="rounded-full font-bold">{t("inventory.common.cancel", "Cancel")}</Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isPending}
            className="rounded-full bg-primary px-8 font-black tracking-tight text-primary-foreground"
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
