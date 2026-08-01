"use client";

import { ShoppingBag, Trash2, Plus, Minus, Send, UserCheck } from "lucide-react";

interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
  seat_number?: number;
}

interface OrderType {
  id: number;
  code: string;
  name: string;
}

interface Props {
  tableName?: string;
  cart: CartItem[];
  orderTypes: OrderType[];
  selectedOrderTypeCode: string;
  guestCount: number;
  onUpdateGuestCount: (count: number) => void;
  onUpdateOrderType: (code: string) => void;
  onUpdateQuantity: (id: number, delta: number) => void;
  onRemoveItem: (id: number) => void;
  onSubmitOrder: () => void;
  isSubmitting?: boolean;
}

export function OrderCartDrawer({
  tableName,
  cart,
  orderTypes,
  selectedOrderTypeCode,
  guestCount,
  onUpdateGuestCount,
  onUpdateOrderType,
  onUpdateQuantity,
  onRemoveItem,
  onSubmitOrder,
  isSubmitting = false,
}: Props) {
  const totalAmount = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4 flex flex-col justify-between h-full shadow-lg">
      <div className="space-y-4">
        {/* Cart Header */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-base text-foreground">
              Order Draft {tableName ? `(${tableName})` : ""}
            </h2>
          </div>
          <span className="text-xs bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">
            {cart.length} items
          </span>
        </div>

        {/* Order Type & Guest Count */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <label className="block font-medium text-muted-foreground mb-1">Order Type</label>
            <select
              value={selectedOrderTypeCode}
              onChange={(e) => onUpdateOrderType(e.target.value)}
              className="w-full px-2 py-1.5 border border-border rounded-lg bg-background text-foreground"
            >
              {orderTypes.map((ot) => (
                <option key={ot.id} value={ot.code}>
                  {ot.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-muted-foreground mb-1">Guests</label>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onUpdateGuestCount(Math.max(1, guestCount - 1))}
                className="w-7 h-7 flex items-center justify-center border border-border rounded-md text-foreground hover:bg-muted font-bold"
              >
                -
              </button>
              <span className="w-8 text-center font-bold text-sm text-foreground">{guestCount}</span>
              <button
                onClick={() => onUpdateGuestCount(guestCount + 1)}
                className="w-7 h-7 flex items-center justify-center border border-border rounded-md text-foreground hover:bg-muted font-bold"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Cart Item List */}
        <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
          {cart.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              Draft order is empty. Click "+ Add" on any menu item.
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.id} className="p-2.5 rounded-lg border border-border bg-background flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-xs text-foreground truncate">{item.name}</div>
                  <div className="text-[11px] text-primary font-bold">
                    ETB {(item.price * item.quantity).toFixed(2)}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center border border-border rounded-lg overflow-hidden">
                    <button
                      onClick={() => onUpdateQuantity(item.id, -1)}
                      className="px-2 py-0.5 text-xs text-foreground hover:bg-muted font-bold"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="px-2 text-xs font-bold text-foreground">{item.quantity}</span>
                    <button
                      onClick={() => onUpdateQuantity(item.id, 1)}
                      className="px-2 py-0.5 text-xs text-foreground hover:bg-muted font-bold"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <button
                    onClick={() => onRemoveItem(item.id)}
                    className="text-muted-foreground hover:text-destructive p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Cart Summary & Submit */}
      <div className="border-t border-border pt-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total Amount</span>
          <span className="font-extrabold text-lg text-primary">ETB {totalAmount.toFixed(2)}</span>
        </div>

        <button
          disabled={cart.length === 0 || isSubmitting}
          onClick={onSubmitOrder}
          className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 disabled:opacity-50 transition-all shadow-md"
        >
          <Send className="w-4 h-4" />
          {isSubmitting ? "Submitting Order..." : "Submit Order to Kitchen"}
        </button>
      </div>
    </div>
  );
}
