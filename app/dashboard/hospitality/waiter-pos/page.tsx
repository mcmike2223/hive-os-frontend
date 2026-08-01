"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchWaiterBootstrap, createHospitalityServiceOrder } from "@/modules/hospitality/api";
import { TableGridSelector } from "@/modules/hospitality/components/waiter-pos/TableGridSelector";
import { MenuBrowser } from "@/modules/hospitality/components/waiter-pos/MenuBrowser";
import { OrderCartDrawer } from "@/modules/hospitality/components/waiter-pos/OrderCartDrawer";
import { UtensilsCrossed, ShieldAlert, CheckCircle2 } from "lucide-react";

interface Table {
  id: number;
  label: string;
  capacity: number;
  status: string;
}

interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
}

export default function WaiterPosPage() {
  const queryClient = useQueryClient();
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [selectedOrderTypeCode, setSelectedOrderTypeCode] = useState("dine_in");
  const [guestCount, setGuestCount] = useState(2);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["waiter-pos-bootstrap"],
    queryFn: () => fetchWaiterBootstrap(),
  });

  const outlet = data?.outlet;
  const activeFeatures = data?.active_features ?? {};
  const tables: Table[] = data?.tables ?? [];
  const menuCategories = data?.menu_categories ?? [];
  const orderTypes = data?.order_types ?? [{ id: 1, code: "dine_in", name: "Dine In" }];

  const submitOrderMutation = useMutation({
    mutationFn: createHospitalityServiceOrder,
    onSuccess: (res) => {
      setSuccessMessage("Service Order submitted successfully to kitchen!");
      setCart([]);
      setSelectedTable(null);
      queryClient.invalidateQueries({ queryKey: ["waiter-pos-bootstrap"] });
      queryClient.invalidateQueries({ queryKey: ["hospitality-service-orders"] });
      setTimeout(() => setSuccessMessage(null), 4000);
    },
  });

  const handleAddItem = (item: { id: number; name: string; price: string | number }) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { id: item.id, name: item.name, price: Number(item.price), quantity: 1 }];
    });
  };

  const handleUpdateQuantity = (id: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0)
    );
  };

  const handleRemoveItem = (id: number) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  };

  const handleSubmit = () => {
    if (cart.length === 0) return;

    submitOrderMutation.mutate({
      location_id: selectedTable?.id ?? tables[0]?.id ?? 1,
      items: cart.map((i) => ({
        item_name: i.name,
        quantity: i.quantity,
        unit_price: i.price,
      })),
      notes: `Order Type: ${selectedOrderTypeCode}, Guests: ${guestCount}`,
    });
  };

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading Waiter POS Interface...</div>;
  }

  // Feature Gate Verification
  if (activeFeatures.pos === false && activeFeatures.table_service === false) {
    return (
      <div className="p-12 text-center max-w-lg mx-auto space-y-4">
        <ShieldAlert className="w-12 h-12 text-destructive mx-auto" />
        <h2 className="text-xl font-bold text-foreground">POS Feature Disabled</h2>
        <p className="text-sm text-muted-foreground">
          Point of Sale and Waiter Ordering features are disabled for the current outlet profile.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <UtensilsCrossed className="w-6 h-6 text-primary" />
            Waiter POS Ordering Shell
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Outlet: <span className="font-semibold text-foreground">{outlet?.name ?? "Default Outlet"}</span> | Waiter:{" "}
            <span className="font-semibold text-foreground">{data?.waiter?.name ?? "Staff"}</span>
          </p>
        </div>

        {successMessage && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            {successMessage}
          </div>
        )}
      </div>

      {/* Main Grid: Left = Tables & Menu, Right = Cart Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          {/* Table Grid Selection */}
          <TableGridSelector
            tables={tables}
            selectedTable={selectedTable}
            onSelectTable={(table) => setSelectedTable(table)}
          />

          {/* Menu Browser */}
          <MenuBrowser categories={menuCategories} onAddItem={handleAddItem} />
        </div>

        {/* Right Sticky Cart Drawer */}
        <div className="lg:col-span-4 lg:sticky lg:top-6 self-start">
          <OrderCartDrawer
            tableName={selectedTable?.label}
            cart={cart}
            orderTypes={orderTypes}
            selectedOrderTypeCode={selectedOrderTypeCode}
            guestCount={guestCount}
            onUpdateGuestCount={setGuestCount}
            onUpdateOrderType={setSelectedOrderTypeCode}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
            onSubmitOrder={handleSubmit}
            isSubmitting={submitOrderMutation.isPending}
          />
        </div>
      </div>
    </div>
  );
}
