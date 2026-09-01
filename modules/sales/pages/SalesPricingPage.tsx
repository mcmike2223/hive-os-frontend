"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/store/use-translation";

import { Badge } from "@/components/ui/badge";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { fetchInventoryProducts } from "@/modules/inventory/api";
import type { ProductRecord } from "@/modules/inventory/types";
import { salesApi } from "@/modules/sales/api";
import type { PriceResolution, SalesCustomer, SalesPriceList, SalesPriceListItem } from "@/modules/sales/types";
import { SalesConfirmDialog, useSalesConfirmDialog } from "@/modules/sales/components/sales-confirm-dialog";
import { EmptyPanel, LoadingPanel, Panel } from "@/modules/shared/charts/primitives";

const SOURCE_LABELS: Record<string, string> = {
  explicit: "Explicit list",
  customer: "Customer list",
  default: "Default list",
  unpriced: "No price found",
};

type ListForm = {
  id?: number;
  code: string;
  name: string;
  currency: string;
  valid_from: string;
  valid_to: string;
  is_default: boolean;
  is_active: boolean;
};

type ItemForm = {
  product_id: string;
  unit_price: string;
  min_quantity: string;
  discount_percent: string;
};

const DEFAULT_LIST_FORM: ListForm = {
  code: "",
  name: "",
  currency: "ETB",
  valid_from: "",
  valid_to: "",
  is_default: false,
  is_active: true,
};

const DEFAULT_ITEM_FORM: ItemForm = {
  product_id: "",
  unit_price: "",
  min_quantity: "0",
  discount_percent: "0",
};

function unwrapList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object" && "data" in payload) {
    const inner = (payload as { data: unknown }).data;
    if (Array.isArray(inner)) return inner;
  }
  return [];
}

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value: unknown, currency = "ETB") =>
  `${currency} ${n(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

function productLabel(products: Map<number, ProductRecord>, productId: number) {
  const product = products.get(productId);
  if (!product) return `Product #${productId}`;
  if (product.name && product.sku) return `${product.name} (${product.sku})`;
  return product.name || product.sku || `Product #${productId}`;
}

function netUnitPrice(unitPrice: number, discountPercent: number) {
  return unitPrice * (1 - discountPercent / 100);
}

function formatValidity(list: SalesPriceList) {
  const from = list.valid_from ? String(list.valid_from).slice(0, 10) : "—";
  const to = list.valid_to ? String(list.valid_to).slice(0, 10) : "—";
  return `${from} → ${to}`;
}

export default function SalesPricingPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { requestConfirm, closeConfirm, confirmDialogProps } = useSalesConfirmDialog();

  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [listSearch, setListSearch] = React.useState("");
  const [effectiveOnly, setEffectiveOnly] = React.useState(false);
  const [itemsPage, setItemsPage] = React.useState(1);
  const [itemsPageSize] = React.useState(25);
  const [productFilter, setProductFilter] = React.useState("all");

  const [listOpen, setListOpen] = React.useState(false);
  const [listForm, setListForm] = React.useState<ListForm>(DEFAULT_LIST_FORM);

  const [itemForm, setItemForm] = React.useState<ItemForm>(DEFAULT_ITEM_FORM);
  const [editingItemKey, setEditingItemKey] = React.useState<string | null>(null);

  const [check, setCheck] = React.useState({
    product_id: "",
    quantity: "1",
    customer_id: "",
    use_selected_list: true,
  });
  const [checkPair, setCheckPair] = React.useState<{
    product: number;
    quantity: number;
    customer_id?: number;
    price_list_id?: number;
  } | null>(null);

  const [deletingListId, setDeletingListId] = React.useState<number | null>(null);
  const [deletingItemId, setDeletingItemId] = React.useState<number | null>(null);

  const pickerOpenRef = React.useRef(false);
  const pickerCloseTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [openPickerCount, setOpenPickerCount] = React.useState(0);

  const handlePickerOpenChange = React.useCallback((open: boolean) => {
    if (pickerCloseTimerRef.current) {
      clearTimeout(pickerCloseTimerRef.current);
      pickerCloseTimerRef.current = null;
    }
    if (open) {
      pickerOpenRef.current = true;
      setOpenPickerCount((c) => c + 1);
      return;
    }
    pickerOpenRef.current = true;
    setOpenPickerCount((c) => Math.max(0, c - 1));
    pickerCloseTimerRef.current = setTimeout(() => {
      pickerOpenRef.current = false;
      pickerCloseTimerRef.current = null;
    }, 300);
  }, []);

  const blockOutsideDismiss = React.useCallback((event: { preventDefault: () => void }) => {
    event.preventDefault();
  }, []);

  const allowDialogClose = React.useCallback(
    (open: boolean, close: () => void) => {
      if (!open && (pickerOpenRef.current || openPickerCount > 0)) return;
      if (!open) close();
    },
    [openPickerCount],
  );

  const listsQuery = useQuery({
    queryKey: ["sales", "price-lists", listSearch, effectiveOnly],
    queryFn: () =>
      salesApi
        .listPriceLists({
          limit: 100,
          search: listSearch || undefined,
          effective_only: effectiveOnly ? 1 : undefined,
        })
        .then((res) => res.data),
  });

  const lists = (listsQuery.data?.data ?? []) as SalesPriceList[];
  const activeId = selectedId ?? lists[0]?.id ?? null;
  const activeList = lists.find((l) => l.id === activeId);

  const productsQuery = useQuery({
    queryKey: ["inventory", "products", "sales-pricing-picker"],
    queryFn: async () => unwrapList<ProductRecord>(await fetchInventoryProducts({ per_page: 200, limit: 200 })),
  });

  const customersQuery = useQuery({
    queryKey: ["sales", "customer-options", "pricing-check"],
    queryFn: () => salesApi.listCustomers({ limit: 200, is_active: 1 }).then((res) => res.data),
  });

  const itemsQuery = useQuery({
    queryKey: ["sales", "price-list-items", activeId, itemsPage, itemsPageSize, productFilter],
    queryFn: () =>
      salesApi
        .listPriceListItems(activeId!, {
          page: itemsPage,
          limit: itemsPageSize,
          product_id: productFilter === "all" ? undefined : Number(productFilter),
        })
        .then((res) => res.data),
    enabled: activeId !== null,
  });

  const checkQuery = useQuery({
    queryKey: ["sales", "price-check", checkPair],
    queryFn: () =>
      salesApi
        .priceCheck({
          product_id: checkPair!.product,
          quantity: checkPair!.quantity,
          customer_id: checkPair!.customer_id,
          price_list_id: checkPair!.price_list_id,
        })
        .then((res) => res.data),
    enabled: checkPair !== null,
  });

  const productById = React.useMemo(() => {
    const map = new Map<number, ProductRecord>();
    for (const p of productsQuery.data ?? []) {
      map.set(p.id, p);
    }
    return map;
  }, [productsQuery.data]);

  const customers = (customersQuery.data?.data ?? []) as SalesCustomer[];

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["sales"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const resetItemForm = React.useCallback(() => {
    setItemForm(DEFAULT_ITEM_FORM);
    setEditingItemKey(null);
  }, []);

  const saveList = useMutation({
    mutationFn: () => {
      const payload = {
        code: listForm.code,
        name: listForm.name,
        currency: listForm.currency,
        valid_from: listForm.valid_from || null,
        valid_to: listForm.valid_to || null,
        is_default: listForm.is_default,
        is_active: listForm.is_active,
      };

      return listForm.id
        ? salesApi.updatePriceList(listForm.id, payload)
        : salesApi.createPriceList(payload);
    },
    onSuccess: () => {
      toast.success(t("sales.pricing.list_saved", "Price list saved."));
      invalidate();
      setListOpen(false);
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("sales.pricing.list_failed", "Could not save the price list."))),
  });

  const deleteList = useMutation({
    mutationFn: (id: number) => {
      setDeletingListId(id);
      return salesApi.deletePriceList(id);
    },
    onSuccess: () => {
      toast.success(t("sales.pricing.list_deleted", "Price list deleted."));
      setSelectedId(null);
      invalidate();
      closeConfirm();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("sales.pricing.delete_failed", "Could not delete it."))),
    onSettled: () => setDeletingListId(null),
  });

  const saveItem = useMutation({
    mutationFn: () =>
      salesApi.createPriceListItem(activeId!, {
        product_id: Number(itemForm.product_id),
        unit_price: Number(itemForm.unit_price || 0),
        min_quantity: Number(itemForm.min_quantity || 0),
        discount_percent: Number(itemForm.discount_percent || 0),
      }),
    onSuccess: () => {
      toast.success(
        editingItemKey
          ? t("sales.pricing.item_updated", "Price tier updated.")
          : t("sales.pricing.item_saved", "Price saved."),
      );
      invalidate();
      resetItemForm();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("sales.pricing.item_failed", "Could not save the price."))),
  });

  const deleteItem = useMutation({
    mutationFn: (itemId: number) => {
      setDeletingItemId(itemId);
      return salesApi.deletePriceListItem(itemId);
    },
    onSuccess: () => {
      toast.success(t("sales.pricing.item_deleted", "Price removed."));
      invalidate();
      closeConfirm();
    },
    onError: (error: any) => toast.error(errorText(error, t("sales.pricing.item_delete_failed", "Could not remove it."))),
    onSettled: () => setDeletingItemId(null),
  });

  const startEditItem = React.useCallback((item: SalesPriceListItem) => {
    setEditingItemKey(`${item.product_id}-${item.min_quantity}`);
    setItemForm({
      product_id: String(item.product_id),
      unit_price: String(item.unit_price),
      min_quantity: String(item.min_quantity),
      discount_percent: String(item.discount_percent ?? 0),
    });
  }, []);

  const openNewList = React.useCallback(() => {
    setListForm(DEFAULT_LIST_FORM);
    setListOpen(true);
  }, []);

  const openEditList = React.useCallback((list: SalesPriceList) => {
    setListForm({
      id: list.id,
      code: list.code,
      name: list.name,
      currency: list.currency,
      valid_from: list.valid_from ? String(list.valid_from).slice(0, 10) : "",
      valid_to: list.valid_to ? String(list.valid_to).slice(0, 10) : "",
      is_default: list.is_default,
      is_active: list.is_active,
    });
    setListOpen(true);
  }, []);

  const runPriceCheck = React.useCallback(() => {
    if (!check.product_id) return;
    setCheckPair({
      product: Number(check.product_id),
      quantity: Number(check.quantity || 1),
      customer_id: check.customer_id ? Number(check.customer_id) : undefined,
      price_list_id: check.use_selected_list && activeId ? activeId : undefined,
    });
  }, [activeId, check]);

  const items = (itemsQuery.data?.data ?? []) as SalesPriceListItem[];
  const itemsTotal = itemsQuery.data?.meta?.total ?? 0;
  const itemsLastPage = itemsQuery.data?.meta?.last_page ?? 1;
  const resolution: PriceResolution | undefined = checkQuery.data?.data;
  const resolvedList = resolution?.price_list_id
    ? lists.find((l) => l.id === resolution.price_list_id)
    : null;
  const checkCurrency = resolvedList?.currency ?? activeList?.currency ?? "ETB";
  const resolvedListName = resolvedList?.name ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">{t("sales.pricing.title", "Price Lists")}</h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "sales.pricing.subtitle",
              "What each product costs, and the quantity at which a cheaper tier takes over.",
            )}
          </p>
        </div>
        <Button className="rounded-full px-5" onClick={openNewList}>
          <Plus className="mr-2 h-4 w-4" />
          {t("sales.pricing.add_list", "New Price List")}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_1fr]">
        <Panel title={t("sales.pricing.lists", "Lists")}>
          <div className="mb-3 space-y-2">
            <Input
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              placeholder={t("sales.pricing.search_lists", "Search lists...")}
              className="h-9"
            />
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={effectiveOnly}
                onChange={(e) => setEffectiveOnly(e.target.checked)}
              />
              {t("sales.pricing.effective_only", "Effective today only")}
            </label>
          </div>

          {listsQuery.isPending ? (
            <LoadingPanel label={t("sales.common.loading", "Loading...")} />
          ) : listsQuery.isError ? (
            <EmptyPanel label={t("sales.pricing.lists_failed", "Could not load price lists.")} />
          ) : lists.length === 0 ? (
            <EmptyPanel label={t("sales.pricing.no_lists", "No price lists yet.")} />
          ) : (
            <div className="space-y-1.5">
              {lists.map((list) => (
                <button
                  key={list.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(list.id);
                    setItemsPage(1);
                    resetItemForm();
                  }}
                  aria-current={activeId === list.id ? "true" : undefined}
                  className={`flex w-full flex-col rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                    activeId === list.id
                      ? "border-primary bg-primary/10"
                      : "border-border/60 hover:bg-muted/50"
                  }`}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{list.name}</span>
                      <span className="block font-mono text-[11px] text-muted-foreground">
                        {list.code} · {list.currency}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      {list.is_default ? (
                        <Badge className="text-[10px]">{t("sales.pricing.default", "Default")}</Badge>
                      ) : null}
                      {!list.is_active ? (
                        <Badge variant="secondary" className="text-[10px]">
                          {t("sales.common.inactive", "Inactive")}
                        </Badge>
                      ) : null}
                    </span>
                  </span>
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    {formatValidity(list)} · {list.items_count ?? 0}{" "}
                    {t("sales.pricing.tiers", "tiers")}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel
            title={t("sales.pricing.prices", "Prices")}
            description={
              activeList
                ? `${activeList.name} · ${formatValidity(activeList)}`
                : t(
                    "sales.pricing.prices_desc",
                    "The tier with the highest minimum at or below the ordered quantity wins.",
                  )
            }
            action={
              activeId !== null && activeList ? (
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEditList(activeList)}>
                    {t("sales.common.edit", "Edit")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    disabled={deletingListId === activeId}
                    onClick={() => {
                      requestConfirm({
                        title: t("sales.pricing.delete_list_title", "Delete Price List"),
                        description: t("sales.pricing.delete_list_confirm", "Delete this price list?"),
                        confirmLabel: t("sales.common.delete", "Delete"),
                        onConfirm: () => deleteList.mutate(activeId),
                      });
                    }}
                  >
                    {deletingListId === activeId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      t("sales.common.delete", "Delete")
                    )}
                  </Button>
                </div>
              ) : undefined
            }
          >
            {activeId === null ? (
              <EmptyPanel label={t("sales.pricing.select_list", "Select a price list.")} />
            ) : itemsQuery.isPending ? (
              <LoadingPanel label={t("sales.common.loading", "Loading...")} />
            ) : itemsQuery.isError ? (
              <EmptyPanel label={t("sales.pricing.items_failed", "Could not load prices.")} />
            ) : (
              <>
                <div className="mb-3 flex flex-wrap items-end gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">{t("sales.pricing.filter_product", "Product")}</Label>
                    <Select
                      value={productFilter}
                      onValueChange={(v) => {
                        setProductFilter(v);
                        setItemsPage(1);
                      }}
                    >
                      <SelectTrigger className="h-9 w-[14rem]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("sales.common.all", "All")}</SelectItem>
                        {(productsQuery.data ?? []).map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.name || p.sku || `#${p.id}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {items.length === 0 ? (
                  <EmptyPanel label={t("sales.pricing.no_prices", "No prices on this list yet.")} />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[36rem] text-sm">
                      <thead>
                        <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <th className="pb-2 font-semibold">{t("sales.pricing.product", "Product")}</th>
                          <th className="pb-2 text-right font-semibold">{t("sales.pricing.from_qty", "From qty")}</th>
                          <th className="pb-2 text-right font-semibold">{t("sales.pricing.unit_price", "Unit price")}</th>
                          <th className="pb-2 text-right font-semibold">{t("sales.pricing.discount", "Discount")}</th>
                          <th className="pb-2 text-right font-semibold">{t("sales.pricing.net", "Net")}</th>
                          <th className="pb-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => {
                          const isDeleting = deletingItemId === item.id;
                          const itemKey = `${item.product_id}-${item.min_quantity}`;
                          const isEditing = editingItemKey === itemKey;
                          return (
                            <tr
                              key={item.id}
                              className={`border-b border-border/40 last:border-0 ${isEditing ? "bg-primary/5" : ""}`}
                            >
                              <td className="py-2">{productLabel(productById, item.product_id)}</td>
                              <td className="py-2 text-right tabular-nums">{n(item.min_quantity)}</td>
                              <td className="py-2 text-right font-semibold tabular-nums">
                                {money(item.unit_price, activeList?.currency)}
                              </td>
                              <td className="py-2 text-right tabular-nums">
                                {n(item.discount_percent) > 0 ? `${n(item.discount_percent)}%` : "—"}
                              </td>
                              <td className="py-2 text-right tabular-nums">
                                {money(
                                  netUnitPrice(n(item.unit_price), n(item.discount_percent)),
                                  activeList?.currency,
                                )}
                              </td>
                              <td className="py-2 text-right">
                                <div className="flex justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={isDeleting}
                                    onClick={() => startEditItem(item)}
                                    aria-label={t("sales.common.edit", "Edit")}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive"
                                    disabled={isDeleting}
                                    onClick={() => {
                                      requestConfirm({
                                        title: t("sales.pricing.delete_item_title", "Remove Price Tier"),
                                        description: t("sales.pricing.delete_item_confirm", "Remove this price tier?"),
                                        confirmLabel: t("sales.common.delete", "Delete"),
                                        onConfirm: () => deleteItem.mutate(item.id),
                                      });
                                    }}
                                    aria-label={t("sales.common.delete", "Delete")}
                                  >
                                    {isDeleting ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {itemsLastPage > 1 ? (
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {t("sales.pricing.page_of", "Page {page} of {total}")
                        .replace("{page}", String(itemsPage))
                        .replace("{total}", String(itemsLastPage))}{" "}
                      · {itemsTotal} {t("sales.pricing.tiers", "tiers")}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        disabled={itemsPage <= 1}
                        onClick={() => setItemsPage((p) => Math.max(1, p - 1))}
                      >
                        {t("sales.common.prev", "Prev")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        disabled={itemsPage >= itemsLastPage}
                        onClick={() => setItemsPage((p) => p + 1)}
                      >
                        {t("sales.common.next", "Next")}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
            )}

            {activeId !== null ? (
              <div className="mt-4 space-y-3 border-t border-border/40 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {editingItemKey
                    ? t("sales.pricing.edit_tier", "Edit tier")
                    : t("sales.pricing.add_price", "Add price")}
                </p>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1.5">
                    <Label>{t("sales.pricing.product", "Product")}</Label>
                    <Select
                      value={itemForm.product_id || "none"}
                      onOpenChange={handlePickerOpenChange}
                      onValueChange={(v) => setItemForm({ ...itemForm, product_id: v === "none" ? "" : v })}
                    >
                      <SelectTrigger className="h-9 w-[14rem]">
                        <SelectValue placeholder={t("sales.common.select", "Select...")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("sales.common.select", "Select...")}</SelectItem>
                        {(productsQuery.data ?? []).map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.name || p.sku || `#${p.id}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("sales.pricing.from_qty", "From qty")}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={itemForm.min_quantity}
                      onChange={(e) => setItemForm({ ...itemForm, min_quantity: e.target.value })}
                      className="h-9 w-28"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      {t(
                        "sales.pricing.from_qty_hint",
                        "0 = all quantities. A tier only applies when the order qty is at least this amount.",
                      )}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("sales.pricing.unit_price", "Unit price")}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={itemForm.unit_price}
                      onChange={(e) => setItemForm({ ...itemForm, unit_price: e.target.value })}
                      className="h-9 w-32"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("sales.pricing.discount", "Discount %")}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={itemForm.discount_percent}
                      onChange={(e) => setItemForm({ ...itemForm, discount_percent: e.target.value })}
                      className="h-9 w-24"
                    />
                  </div>
                  <Button
                    variant="outline"
                    className="h-9"
                    disabled={saveItem.isPending || !itemForm.product_id || !itemForm.unit_price}
                    onClick={() => saveItem.mutate()}
                  >
                    {saveItem.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {editingItemKey ? t("sales.common.save", "Save") : t("sales.pricing.add_price", "Add price")}
                  </Button>
                  {editingItemKey ? (
                    <Button variant="ghost" className="h-9" onClick={resetItemForm}>
                      {t("sales.common.cancel", "Cancel")}
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </Panel>

          <Panel
            title={t("sales.pricing.check", "Price check")}
            description={t(
              "sales.pricing.check_desc",
              "What a quantity would actually be priced at, and which list answered.",
            )}
          >
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label>{t("sales.pricing.product", "Product")}</Label>
                <Select
                  value={check.product_id || "none"}
                  onOpenChange={handlePickerOpenChange}
                  onValueChange={(v) => setCheck({ ...check, product_id: v === "none" ? "" : v })}
                >
                  <SelectTrigger className="h-9 w-[14rem]">
                    <SelectValue placeholder={t("sales.common.select", "Select...")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("sales.common.select", "Select...")}</SelectItem>
                    {(productsQuery.data ?? []).map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name || p.sku || `#${p.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("sales.pricing.quantity", "Quantity")}</Label>
                <Input
                  type="number"
                  min={0}
                  value={check.quantity}
                  onChange={(e) => setCheck({ ...check, quantity: e.target.value })}
                  className="h-9 w-28"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("sales.common.customer", "Customer")}</Label>
                <Select
                  value={check.customer_id || "none"}
                  onOpenChange={handlePickerOpenChange}
                  onValueChange={(v) => setCheck({ ...check, customer_id: v === "none" ? "" : v })}
                >
                  <SelectTrigger className="h-9 w-[14rem]">
                    <SelectValue placeholder={t("sales.common.optional", "Optional")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("sales.common.optional", "Optional")}</SelectItem>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={String(customer.id)}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <label className="flex h-9 items-center gap-2 rounded-md border border-border/60 px-3 text-xs">
                <input
                  type="checkbox"
                  checked={check.use_selected_list}
                  disabled={activeId === null}
                  onChange={(e) => setCheck({ ...check, use_selected_list: e.target.checked })}
                />
                {t("sales.pricing.use_selected_list", "Use selected list")}
              </label>
              <Button variant="outline" className="h-9" disabled={!check.product_id} onClick={runPriceCheck}>
                <Search className="mr-2 h-4 w-4" />
                {t("sales.pricing.check_action", "Check")}
              </Button>
            </div>

            {checkQuery.isFetching ? (
              <LoadingPanel label={t("sales.pricing.checking", "Checking price...")} />
            ) : checkQuery.isError ? (
              <EmptyPanel label={t("sales.pricing.check_failed", "Could not resolve the price.")} />
            ) : resolution ? (
              <div className="mt-4 space-y-3 border-t border-border/40 pt-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      {t("sales.pricing.resolved", "Resolved price")}
                    </p>
                    <p className="text-3xl font-black tracking-tight">
                      {money(resolution.unit_price, checkCurrency)}
                    </p>
                  </div>
                  {n(resolution.discount_percent) > 0 ? (
                    <div>
                      <p className="text-xs text-muted-foreground">{t("sales.pricing.net", "Net")}</p>
                      <p className="text-xl font-bold tabular-nums">
                        {money(
                          netUnitPrice(resolution.unit_price, n(resolution.discount_percent)),
                          checkCurrency,
                        )}
                      </p>
                    </div>
                  ) : null}
                  <Badge
                    variant={resolution.source === "unpriced" ? "destructive" : "outline"}
                    className="text-[11px]"
                  >
                    {SOURCE_LABELS[resolution.source] ??
                      t("sales.pricing.from_source", "from {source} list").replace("{source}", resolution.source)}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  {resolution.price_list_id ? (
                    <span>
                      {t("sales.pricing.list_id", "List")}:{" "}
                      <span className="font-medium text-foreground">
                        {resolvedListName ?? `#${resolution.price_list_id}`}
                      </span>
                    </span>
                  ) : null}
                  {n(resolution.discount_percent) > 0 ? (
                    <span>
                      {t("sales.pricing.plus_discount", "plus {n}% discount").replace(
                        "{n}",
                        String(n(resolution.discount_percent)),
                      )}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}
          </Panel>
        </div>
      </div>

      <Dialog
        open={listOpen}
        onOpenChange={(open) => allowDialogClose(open, () => (open ? setListOpen(true) : setListOpen(false)))}
      >
        <DialogContent
          className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl"
          onPointerDownOutside={blockOutsideDismiss}
        >
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {listForm.id
                  ? t("sales.pricing.edit_list", "Edit Price List")
                  : t("sales.pricing.add_list", "New Price List")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "sales.pricing.list_desc",
                  "Only one list can be the tenant default; making this one default clears the other.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="list-code">{t("sales.common.code", "Code")}</Label>
              <Input
                id="list-code"
                value={listForm.code}
                onChange={(event) => setListForm({ ...listForm, code: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="list-name">{t("sales.common.name", "Name")}</Label>
              <Input
                id="list-name"
                value={listForm.name}
                onChange={(event) => setListForm({ ...listForm, name: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="list-currency">{t("sales.pricing.currency", "Currency")}</Label>
              <Input
                id="list-currency"
                maxLength={3}
                value={listForm.currency}
                onChange={(event) =>
                  setListForm({ ...listForm, currency: event.target.value.toUpperCase() })
                }
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="list-default"
                checked={listForm.is_default}
                onCheckedChange={(checked) => setListForm({ ...listForm, is_default: checked })}
              />
              <Label htmlFor="list-default">{t("sales.pricing.default", "Default")}</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="list-active"
                checked={listForm.is_active}
                onCheckedChange={(checked) => setListForm({ ...listForm, is_active: checked })}
              />
              <Label htmlFor="list-active">{t("sales.common.active", "Active")}</Label>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="list-from">{t("sales.pricing.valid_from", "Valid from")}</Label>
              <Input
                id="list-from"
                type="date"
                value={listForm.valid_from}
                onChange={(event) => setListForm({ ...listForm, valid_from: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="list-to">{t("sales.pricing.valid_to", "Valid to")}</Label>
              <Input
                id="list-to"
                type="date"
                min={listForm.valid_from || undefined}
                value={listForm.valid_to}
                onChange={(event) => setListForm({ ...listForm, valid_to: event.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setListOpen(false)}>
              {t("sales.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => saveList.mutate()}
              disabled={saveList.isPending || !listForm.code.trim() || !listForm.name.trim()}
            >
              {saveList.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("sales.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SalesConfirmDialog
        {...confirmDialogProps}
        pending={deleteList.isPending || deleteItem.isPending}
      />
    </div>
  );
}
