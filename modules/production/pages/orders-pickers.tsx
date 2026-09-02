"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchInventoryProduct, fetchInventoryProducts } from "@/modules/inventory/api";
import type { ProductDetailResponse, ProductRecord } from "@/modules/inventory/types";
import { warehouseApi } from "@/modules/warehouse/api";
import type { Warehouse, WarehouseLocation } from "@/modules/warehouse/types";
import { useDebouncedValue } from "../utils";

export function unwrapList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown }).data)) {
    return (payload as { data: T[] }).data;
  }
  return [];
}

function unwrapProductDetail(
  res: ProductDetailResponse | ProductRecord | null | undefined,
): ProductRecord | null {
  if (!res) return null;
  if ("product" in res && res.product) return res.product;
  if ("id" in res && "name" in res && "sku" in res) return res as ProductRecord;
  return null;
}

export function productPickerLabel(product: Pick<ProductRecord, "id" | "name" | "sku">): string {
  const sku = product.sku ? ` (${product.sku})` : "";
  return `${product.name}${sku}`;
}

export function locationPickerLabel(loc: WarehouseLocation): string {
  const site = loc.warehouse?.name || loc.warehouse?.code;
  const spot = loc.name || loc.code || `Location #${loc.id}`;
  return site ? `${site} · ${spot}` : spot;
}

export function warehousePickerLabel(wh: Warehouse): string {
  return wh.code ? `${wh.code} — ${wh.name}` : wh.name;
}

type BasePickerProps = {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  enabled?: boolean;
  placeholder?: string;
  emptyText?: string;
  allowClear?: boolean;
};

export function ProductSearchPicker({
  id,
  label,
  value,
  onChange,
  disabled = false,
  enabled = true,
  placeholder,
  emptyText = "No products found.",
  allowClear = false,
}: BasePickerProps) {
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebouncedValue(search);

  const listQuery = useQuery({
    queryKey: ["inventory", "products", "orders-picker", debouncedSearch],
    queryFn: async () => {
      const res = await fetchInventoryProducts({
        search: debouncedSearch || undefined,
        per_page: 50,
        limit: 50,
      });
      return unwrapList<ProductRecord>(res);
    },
    enabled: enabled && !disabled,
  });

  const selectedQuery = useQuery({
    queryKey: ["inventory", "product", "orders-picker", value],
    queryFn: async () => unwrapProductDetail(await fetchInventoryProduct(Number(value))),
    enabled: enabled && !!value,
  });

  const options = React.useMemo(() => {
    const list = listQuery.data ?? [];
    const selected = selectedQuery.data;
    if (!selected || list.some((product) => product.id === selected.id)) return list;
    return [selected, ...list];
  }, [listQuery.data, selectedQuery.data]);

  const loading = listQuery.isLoading || (!!value && selectedQuery.isLoading && !selectedQuery.data);

  return (
    <div className="space-y-2">
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      {!disabled ? (
        <Input
          id={id ? `${id}-search` : undefined}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name or SKU..."
          disabled={!enabled}
        />
      ) : null}
      <Select
        value={value || (allowClear ? "none" : undefined)}
        onValueChange={(next) => onChange(next === "none" ? "" : next)}
        disabled={disabled || !enabled}
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder={loading ? "Loading…" : placeholder ?? "Select a product"} />
        </SelectTrigger>
        <SelectContent>
          {allowClear ? <SelectItem value="none">—</SelectItem> : null}
          {options.map((product) => (
            <SelectItem key={product.id} value={String(product.id)}>
              {productPickerLabel(product)}
            </SelectItem>
          ))}
          {!loading && options.length === 0 ? (
            <div className="px-2 py-3 text-xs text-muted-foreground">{emptyText}</div>
          ) : null}
        </SelectContent>
      </Select>
      {listQuery.isFetching && !listQuery.isLoading ? (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Updating…
        </p>
      ) : null}
    </div>
  );
}

type LocationPickerProps = BasePickerProps & {
  warehouseId?: string;
};

export function LocationSearchPicker({
  id,
  label,
  value,
  onChange,
  disabled = false,
  enabled = true,
  placeholder,
  emptyText = "No locations found.",
  allowClear = false,
  warehouseId,
}: LocationPickerProps) {
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebouncedValue(search);

  const listQuery = useQuery({
    queryKey: ["warehouse", "locations", "orders-picker", debouncedSearch, warehouseId],
    queryFn: async () => {
      const res = await warehouseApi.listLocations({
        search: debouncedSearch || undefined,
        warehouse_id: warehouseId || undefined,
        limit: 100,
      });
      return unwrapList<WarehouseLocation>(res.data);
    },
    enabled: enabled && !disabled,
  });

  const selectedQuery = useQuery({
    queryKey: ["warehouse", "location", "orders-picker", value],
    queryFn: async () => {
      const res = await warehouseApi.getLocation(Number(value));
      return (res.data?.data ?? res.data) as WarehouseLocation;
    },
    enabled: enabled && !!value && !listQuery.data?.some((loc) => String(loc.id) === value),
  });

  const options = React.useMemo(() => {
    const list = listQuery.data ?? [];
    const selected = selectedQuery.data;
    if (!selected || list.some((loc) => loc.id === selected.id)) return list;
    return [selected, ...list];
  }, [listQuery.data, selectedQuery.data]);

  const loading = listQuery.isLoading;

  return (
    <div className="space-y-2">
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      {!disabled ? (
        <Input
          id={id ? `${id}-search` : undefined}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name or code..."
          disabled={!enabled}
        />
      ) : null}
      <Select
        value={value || (allowClear ? "none" : undefined)}
        onValueChange={(next) => onChange(next === "none" ? "" : next)}
        disabled={disabled || !enabled}
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder={loading ? "Loading…" : placeholder ?? "Select a location"} />
        </SelectTrigger>
        <SelectContent>
          {allowClear ? <SelectItem value="none">—</SelectItem> : null}
          {options.map((loc) => (
            <SelectItem key={loc.id} value={String(loc.id)}>
              {locationPickerLabel(loc)}
            </SelectItem>
          ))}
          {!loading && options.length === 0 ? (
            <div className="px-2 py-3 text-xs text-muted-foreground">{emptyText}</div>
          ) : null}
        </SelectContent>
      </Select>
    </div>
  );
}

export function WarehouseSearchPicker({
  id,
  label,
  value,
  onChange,
  disabled = false,
  enabled = true,
  placeholder,
  emptyText = "No warehouses found.",
  allowClear = false,
}: BasePickerProps) {
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebouncedValue(search);

  const listQuery = useQuery({
    queryKey: ["warehouse", "list", "orders-picker", debouncedSearch],
    queryFn: async () => {
      const res = await warehouseApi.listWarehouses({
        search: debouncedSearch || undefined,
        limit: 100,
      });
      return unwrapList<Warehouse>(res.data);
    },
    enabled: enabled && !disabled,
  });

  const selectedQuery = useQuery({
    queryKey: ["warehouse", "detail", "orders-picker", value],
    queryFn: async () => {
      const res = await warehouseApi.getWarehouse(Number(value));
      return (res.data?.data ?? res.data) as Warehouse;
    },
    enabled: enabled && !!value && !listQuery.data?.some((wh) => String(wh.id) === value),
  });

  const options = React.useMemo(() => {
    const list = listQuery.data ?? [];
    const selected = selectedQuery.data;
    if (!selected || list.some((wh) => wh.id === selected.id)) return list;
    return [selected, ...list];
  }, [listQuery.data, selectedQuery.data]);

  const loading = listQuery.isLoading;

  return (
    <div className="space-y-2">
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      {!disabled ? (
        <Input
          id={id ? `${id}-search` : undefined}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name or code..."
          disabled={!enabled}
        />
      ) : null}
      <Select
        value={value || (allowClear ? "none" : undefined)}
        onValueChange={(next) => onChange(next === "none" ? "" : next)}
        disabled={disabled || !enabled}
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder={loading ? "Loading…" : placeholder ?? "Select a warehouse"} />
        </SelectTrigger>
        <SelectContent>
          {allowClear ? <SelectItem value="none">—</SelectItem> : null}
          {options.map((wh) => (
            <SelectItem key={wh.id} value={String(wh.id)}>
              {warehousePickerLabel(wh)}
            </SelectItem>
          ))}
          {!loading && options.length === 0 ? (
            <div className="px-2 py-3 text-xs text-muted-foreground">{emptyText}</div>
          ) : null}
        </SelectContent>
      </Select>
    </div>
  );
}
