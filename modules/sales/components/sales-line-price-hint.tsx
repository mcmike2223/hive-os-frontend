"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@/store/use-translation";

import { salesApi } from "@/modules/sales/api";
import type { PriceResolution } from "@/modules/sales/types";

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value: unknown, currency = "ETB") =>
  `${currency} ${n(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export function SalesLinePriceHint({
  customerId,
  productId,
  quantity,
  currency,
  manualPrice,
}: {
  customerId: string;
  productId: string;
  quantity: string;
  currency: string;
  manualPrice: string;
}) {
  const { t } = useTranslation();
  const enabled = !manualPrice && Boolean(customerId) && Boolean(productId) && Number(quantity) > 0;

  const priceQuery = useQuery({
    queryKey: ["sales", "line-price", customerId, productId, quantity],
    queryFn: () =>
      salesApi
        .priceCheck({
          product_id: Number(productId),
          quantity: Number(quantity),
          customer_id: Number(customerId),
        })
        .then((res) => res.data?.data as PriceResolution),
    enabled,
    staleTime: 30_000,
  });

  if (manualPrice || !enabled) return null;

  if (priceQuery.isLoading) {
    return (
      <p className="text-[11px] text-muted-foreground">
        {t("sales.orders.price_lookup", "Looking up price list…")}
      </p>
    );
  }

  const resolved = priceQuery.data;
  if (!resolved) return null;

  if (resolved.source === "unpriced" || n(resolved.unit_price) <= 0) {
    const hint = resolved.pricing_hint;
    if (hint?.type === "min_quantity") {
      return (
        <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
          {t(
            "sales.orders.price_min_qty",
            "Price {price} on this list starts at qty {qty} — raise the line quantity or add a tier from qty 0 on the price list.",
          )
            .replace("{price}", money(hint.unit_price, currency))
            .replace("{qty}", String(n(hint.min_quantity)))}
        </p>
      );
    }

    return (
      <p className="text-[11px] font-medium text-destructive">
        {t(
          "sales.orders.no_list_price",
          "No price on this customer's list — enter a unit price or add the product under Sales → Price Lists.",
        )}
      </p>
    );
  }

  return (
    <p className="text-[11px] text-muted-foreground">
      {t("sales.orders.list_price", "From price list: {price} ({source})")
        .replace("{price}", money(resolved.unit_price, currency))
        .replace("{source}", resolved.source)}
    </p>
  );
}
