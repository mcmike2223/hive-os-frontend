"use client";

import { Minus, Plus, Send, ShoppingBag, Trash2 } from "lucide-react";

import type { WaiterCartSelection } from "./MenuBrowser";

export type WaiterCartItem = WaiterCartSelection & {
  quantity: number;
  notes?: string;
  seatNumber?: number;
  courseNumber?: number;
};

type OrderType = {
  id: number;
  code: string;
  name: string;
};

type Props = {
  tableName?: string;
  cart: WaiterCartItem[];
  orderTypes: OrderType[];
  selectedOrderTypeCode: string;
  guestCount: number;
  onUpdateGuestCount: (count: number) => void;
  onUpdateOrderType: (code: string) => void;
  onUpdateQuantity: (cartKey: string, delta: number) => void;
  onUpdateItem: (cartKey: string, patch: Partial<Pick<WaiterCartItem, "notes" | "seatNumber" | "courseNumber">>) => void;
  onRemoveItem: (cartKey: string) => void;
  onSubmitOrder: () => void;
  isSubmitting?: boolean;
};

const formatMoney = (amount: number) => `ETB ${amount.toFixed(2)}`;

export function OrderCartDrawer({
  tableName,
  cart,
  orderTypes,
  selectedOrderTypeCode,
  guestCount,
  onUpdateGuestCount,
  onUpdateOrderType,
  onUpdateQuantity,
  onUpdateItem,
  onRemoveItem,
  onSubmitOrder,
  isSubmitting = false,
}: Props) {
  const totalAmount = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);

  return (
    <aside
      className="flex h-full flex-col justify-between space-y-4 rounded-lg border border-border bg-card p-5 shadow-lg"
      aria-labelledby="restaurant-order-draft-heading"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex min-w-0 items-center gap-2">
            <ShoppingBag className="h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
            <h2 id="restaurant-order-draft-heading" className="truncate text-base font-bold text-foreground">
              Order Draft {tableName ? `(${tableName})` : ""}
            </h2>
          </div>
          <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            {cart.length} lines
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <div>
            <label htmlFor="restaurant-order-type" className="mb-1 block text-xs font-medium text-muted-foreground">
              Order type
            </label>
            <select
              id="restaurant-order-type"
              value={selectedOrderTypeCode}
              onChange={(event) => onUpdateOrderType(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-slate-500 bg-background px-3 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 dark:focus-visible:ring-emerald-300"
            >
              {orderTypes.map((orderType) => (
                <option key={orderType.id} value={orderType.code}>
                  {orderType.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="restaurant-guest-count" className="mb-1 block text-xs font-medium text-muted-foreground">
              Guests
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Decrease guest count"
                onClick={() => onUpdateGuestCount(Math.max(1, guestCount - 1))}
                className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-500 text-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 dark:focus-visible:ring-emerald-300"
              >
                <Minus className="h-4 w-4" aria-hidden="true" />
              </button>
              <input
                id="restaurant-guest-count"
                type="number"
                min={1}
                value={guestCount}
                onChange={(event) => onUpdateGuestCount(Math.max(1, Number(event.target.value) || 1))}
                className="h-11 w-20 rounded-lg border border-slate-500 bg-background px-3 text-center text-sm font-bold text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 dark:focus-visible:ring-emerald-300"
              />
              <button
                type="button"
                aria-label="Increase guest count"
                onClick={() => onUpdateGuestCount(guestCount + 1)}
                className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-500 text-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 dark:focus-visible:ring-emerald-300"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        <div className="max-h-[52vh] space-y-3 overflow-y-auto pr-1 lg:max-h-[calc(100vh-360px)]">
          {cart.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
              Draft order is empty. Add menu items to start.
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.cartKey} className="space-y-3 rounded-lg border border-border bg-background p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-foreground">{item.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {[
                        item.variantName,
                        item.modifierSummary.length ? item.modifierSummary.join(", ") : null,
                      ]
                        .filter(Boolean)
                        .join(" - ") || "Regular"}
                    </div>
                    <div className="mt-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                      {formatMoney(item.price * item.quantity)}
                    </div>
                  </div>

                  <button
                    type="button"
                    aria-label={`Remove ${item.name}`}
                    onClick={() => onRemoveItem(item.cartKey)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 dark:hover:text-red-300 dark:focus-visible:ring-emerald-300"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center overflow-hidden rounded-lg border border-slate-500">
                    <button
                      type="button"
                      aria-label={`Decrease ${item.name} quantity`}
                      onClick={() => onUpdateQuantity(item.cartKey, -1)}
                      className="flex h-10 w-10 items-center justify-center text-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 dark:focus-visible:ring-emerald-300"
                    >
                      <Minus className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <span className="min-w-10 px-2 text-center text-sm font-bold text-foreground">{item.quantity}</span>
                    <button
                      type="button"
                      aria-label={`Increase ${item.name} quantity`}
                      onClick={() => onUpdateQuantity(item.cartKey, 1)}
                      className="flex h-10 w-10 items-center justify-center text-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 dark:focus-visible:ring-emerald-300"
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      Seat
                      <input
                        type="number"
                        min={1}
                        value={item.seatNumber ?? ""}
                        onChange={(event) =>
                          onUpdateItem(item.cartKey, {
                            seatNumber: event.target.value ? Number(event.target.value) : undefined,
                          })
                        }
                        className="mt-1 h-10 w-full rounded-lg border border-slate-500 bg-card px-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 dark:focus-visible:ring-emerald-300"
                      />
                    </label>
                    <label className="text-xs font-medium text-muted-foreground">
                      Course
                      <input
                        type="number"
                        min={1}
                        value={item.courseNumber ?? 1}
                        onChange={(event) =>
                          onUpdateItem(item.cartKey, {
                            courseNumber: Math.max(1, Number(event.target.value) || 1),
                          })
                        }
                        className="mt-1 h-10 w-full rounded-lg border border-slate-500 bg-card px-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 dark:focus-visible:ring-emerald-300"
                      />
                    </label>
                  </div>
                </div>

                <label className="block text-xs font-medium text-muted-foreground">
                  Kitchen note
                  <textarea
                    value={item.notes ?? ""}
                    onChange={(event) => onUpdateItem(item.cartKey, { notes: event.target.value })}
                    rows={2}
                    className="mt-1 w-full resize-y rounded-lg border border-slate-500 bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 dark:focus-visible:ring-emerald-300"
                  />
                </label>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Estimated total</span>
          <span className="text-lg font-extrabold text-emerald-700 dark:text-emerald-300">{formatMoney(totalAmount)}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Final taxes, service charges, discounts, and approval gates are calculated by the server.
        </p>

        <button
          type="button"
          disabled={cart.length === 0 || isSubmitting}
          onClick={onSubmitOrder}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-md transition-all hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-emerald-300 active:scale-95"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
          {isSubmitting ? "Submitting order..." : "Submit order to kitchen"}
        </button>
      </div>
    </aside>
  );
}
