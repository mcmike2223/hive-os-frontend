"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Trash2 } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { salesApi } from "@/modules/sales/api";
import type { PriceResolution, SalesPriceList, SalesPriceListItem } from "@/modules/sales/types";
import { EmptyPanel, LoadingPanel, Panel } from "@/modules/shared/charts/primitives";

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value: unknown) => `ETB ${n(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export default function SalesPricingPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [listOpen, setListOpen] = React.useState(false);
  const [listForm, setListForm] = React.useState({
    id: undefined as number | undefined,
    code: "",
    name: "",
    currency: "ETB",
    valid_from: "",
    valid_to: "",
    is_default: false,
    is_active: true,
  });

  const [itemForm, setItemForm] = React.useState({
    product_id: "",
    unit_price: "",
    min_quantity: "0",
    discount_percent: "0",
  });

  const [check, setCheck] = React.useState({ product_id: "", quantity: "1" });
  const [checkPair, setCheckPair] = React.useState<{ product: number; quantity: number } | null>(null);

  const listsQuery = useQuery({
    queryKey: ["sales", "price-lists"],
    queryFn: () => salesApi.listPriceLists({ limit: 100 }).then((res) => res.data),
  });

  const lists = (listsQuery.data?.data ?? []) as SalesPriceList[];
  const activeId = selectedId ?? lists[0]?.id ?? null;

  const itemsQuery = useQuery({
    queryKey: ["sales", "price-list-items", activeId],
    queryFn: () => salesApi.listPriceListItems(activeId!, { limit: 100 }).then((res) => res.data),
    enabled: activeId !== null,
  });

  const checkQuery = useQuery({
    queryKey: ["sales", "price-check", checkPair],
    queryFn: () =>
      salesApi
        .priceCheck({ product_id: checkPair!.product, quantity: checkPair!.quantity })
        .then((res) => res.data),
    enabled: checkPair !== null,
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["sales"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

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
    mutationFn: (id: number) => salesApi.deletePriceList(id),
    onSuccess: () => {
      toast.success(t("sales.pricing.list_deleted", "Price list deleted."));
      setSelectedId(null);
      invalidate();
    },
    // The API refuses to delete the default list and says why; relay that.
    onError: (error: any) =>
      toast.error(errorText(error, t("sales.pricing.delete_failed", "Could not delete it."))),
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
      toast.success(t("sales.pricing.item_saved", "Price saved."));
      invalidate();
      setItemForm({ product_id: "", unit_price: "", min_quantity: "0", discount_percent: "0" });
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("sales.pricing.item_failed", "Could not save the price."))),
  });

  const deleteItem = useMutation({
    mutationFn: (itemId: number) => salesApi.deletePriceListItem(itemId),
    onSuccess: () => {
      toast.success(t("sales.pricing.item_deleted", "Price removed."));
      invalidate();
    },
    onError: (error: any) => toast.error(errorText(error, "Could not remove it.")),
  });

  const items = (itemsQuery.data?.data ?? []) as SalesPriceListItem[];
  const resolution: PriceResolution | undefined = checkQuery.data?.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {t("sales.pricing.title", "Price Lists")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "sales.pricing.subtitle",
              "What each product costs, and the quantity at which a cheaper tier takes over.",
            )}
          </p>
        </div>
        <Button
          className="rounded-full px-5"
          onClick={() => {
            setListForm({
              id: undefined,
              code: "",
              name: "",
              currency: "ETB",
              valid_from: "",
              valid_to: "",
              is_default: false,
              is_active: true,
            });
            setListOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {t("sales.pricing.add_list", "New Price List")}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_1fr]">
        <Panel title={t("sales.pricing.lists", "Lists")}>
          {listsQuery.isLoading ? (
            <LoadingPanel label={t("sales.common.loading", "Loading...")} />
          ) : lists.length === 0 ? (
            <EmptyPanel label={t("sales.pricing.no_lists", "No price lists yet.")} />
          ) : (
            <div className="space-y-1.5">
              {lists.map((list) => (
                <button
                  key={list.id}
                  type="button"
                  onClick={() => setSelectedId(list.id)}
                  aria-current={activeId === list.id ? "true" : undefined}
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                    activeId === list.id
                      ? "border-primary bg-primary/10"
                      : "border-border/60 hover:bg-muted/50"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{list.name}</span>
                    <span className="block font-mono text-[11px] text-muted-foreground">
                      {list.code} · {list.currency}
                    </span>
                  </span>
                  {list.is_default ? (
                    <Badge className="ml-2 shrink-0 text-[10px]">
                      {t("sales.pricing.default", "Default")}
                    </Badge>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel
            title={t("sales.pricing.prices", "Prices")}
            description={t(
              "sales.pricing.prices_desc",
              "The tier with the highest minimum at or below the ordered quantity wins.",
            )}
            action={
              activeId !== null ? (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const list = lists.find((l) => l.id === activeId);
                      if (!list) return;
                      setListForm({
                        id: list.id,
                        code: list.code,
                        name: list.name,
                        currency: list.currency,
                        valid_from: list.valid_from ?? "",
                        valid_to: list.valid_to ?? "",
                        is_default: list.is_default,
                        is_active: list.is_active,
                      });
                      setListOpen(true);
                    }}
                  >
                    {t("sales.common.edit", "Edit")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => deleteList.mutate(activeId)}
                  >
                    {t("sales.common.delete", "Delete")}
                  </Button>
                </div>
              ) : undefined
            }
          >
            {activeId === null ? (
              <EmptyPanel label={t("sales.pricing.select_list", "Select a price list.")} />
            ) : itemsQuery.isLoading ? (
              <LoadingPanel label={t("sales.common.loading", "Loading...")} />
            ) : items.length === 0 ? (
              <EmptyPanel label={t("sales.pricing.no_prices", "No prices on this list yet.")} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[32rem] text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="pb-2 font-semibold">{t("sales.pricing.product", "Product")}</th>
                      <th className="pb-2 text-right font-semibold">
                        {t("sales.pricing.from_qty", "From qty")}
                      </th>
                      <th className="pb-2 text-right font-semibold">
                        {t("sales.pricing.unit_price", "Unit price")}
                      </th>
                      <th className="pb-2 text-right font-semibold">
                        {t("sales.pricing.discount", "Discount")}
                      </th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-b border-border/40 last:border-0">
                        <td className="py-2">#{item.product_id}</td>
                        <td className="py-2 text-right tabular-nums">{n(item.min_quantity)}</td>
                        <td className="py-2 text-right font-semibold tabular-nums">
                          {money(item.unit_price)}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {n(item.discount_percent) > 0 ? `${n(item.discount_percent)}%` : "—"}
                        </td>
                        <td className="py-2 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => deleteItem.mutate(item.id)}
                            aria-label={t("sales.common.delete", "Delete")}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeId !== null ? (
              <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-border/40 pt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="item-product">{t("sales.pricing.product_id", "Product ID")}</Label>
                  <Input
                    id="item-product"
                    type="number"
                    value={itemForm.product_id}
                    onChange={(event) => setItemForm({ ...itemForm, product_id: event.target.value })}
                    className="h-9 w-32"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="item-qty">{t("sales.pricing.from_qty", "From qty")}</Label>
                  <Input
                    id="item-qty"
                    type="number"
                    min={0}
                    value={itemForm.min_quantity}
                    onChange={(event) => setItemForm({ ...itemForm, min_quantity: event.target.value })}
                    className="h-9 w-28"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="item-price">{t("sales.pricing.unit_price", "Unit price")}</Label>
                  <Input
                    id="item-price"
                    type="number"
                    min={0}
                    value={itemForm.unit_price}
                    onChange={(event) => setItemForm({ ...itemForm, unit_price: event.target.value })}
                    className="h-9 w-32"
                  />
                </div>
                <Button
                  variant="outline"
                  className="h-9"
                  disabled={saveItem.isPending || !itemForm.product_id || !itemForm.unit_price}
                  onClick={() => saveItem.mutate()}
                >
                  {t("sales.pricing.add_price", "Add price")}
                </Button>
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
                <Label htmlFor="check-product">{t("sales.pricing.product_id", "Product ID")}</Label>
                <Input
                  id="check-product"
                  type="number"
                  value={check.product_id}
                  onChange={(event) => setCheck({ ...check, product_id: event.target.value })}
                  className="h-9 w-32"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="check-qty">{t("sales.pricing.quantity", "Quantity")}</Label>
                <Input
                  id="check-qty"
                  type="number"
                  min={0}
                  value={check.quantity}
                  onChange={(event) => setCheck({ ...check, quantity: event.target.value })}
                  className="h-9 w-28"
                />
              </div>
              <Button
                variant="outline"
                className="h-9"
                disabled={!check.product_id}
                onClick={() =>
                  setCheckPair({
                    product: Number(check.product_id),
                    quantity: Number(check.quantity || 1),
                  })
                }
              >
                <Search className="mr-2 h-4 w-4" />
                {t("sales.pricing.check_action", "Check")}
              </Button>
            </div>

            {resolution ? (
              <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-border/40 pt-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    {t("sales.pricing.resolved", "Resolved price")}
                  </p>
                  <p className="text-3xl font-black tracking-tight">
                    {money(resolution.unit_price)}
                  </p>
                </div>
                <Badge
                  variant={resolution.source === "unpriced" ? "destructive" : "outline"}
                  className="text-[11px] capitalize"
                >
                  {resolution.source === "unpriced"
                    ? t("sales.pricing.unpriced", "No price found")
                    : t("sales.pricing.from_source", "from {source} list").replace(
                        "{source}",
                        resolution.source,
                      )}
                </Badge>
                {n(resolution.discount_percent) > 0 ? (
                  <span className="text-sm text-muted-foreground">
                    {t("sales.pricing.plus_discount", "plus {n}% discount").replace(
                      "{n}",
                      String(n(resolution.discount_percent)),
                    )}
                  </span>
                ) : null}
              </div>
            ) : null}
          </Panel>
        </div>
      </div>

      <Dialog open={listOpen} onOpenChange={setListOpen}>
        <DialogContent className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
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
              {t("sales.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
