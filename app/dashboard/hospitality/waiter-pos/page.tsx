"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ShieldAlert, UtensilsCrossed } from "lucide-react";

import {
  createWaiterHospitalityOrder,
  fetchWaiterBootstrap,
} from "@/modules/hospitality/api";
import { MenuBrowser, type WaiterCartSelection } from "@/modules/hospitality/components/waiter-pos/MenuBrowser";
import { OrderCartDrawer, type WaiterCartItem } from "@/modules/hospitality/components/waiter-pos/OrderCartDrawer";
import { TableGridSelector } from "@/modules/hospitality/components/waiter-pos/TableGridSelector";
import type { HospitalityMenuCategory, HospitalityMenuItem } from "@/modules/hospitality/types";
import { initEcho } from "@/lib/echo";
import { getAccessToken, getTenantId } from "@/lib/runtime-context";

type RestaurantTable = {
  id: number;
  label: string;
  capacity: number;
  status: string;
  table_type?: string;
  zone?: { name: string } | null;
  staff?: { name: string } | null;
};

type OrderType = {
  id: number;
  code: string;
  name: string;
};

type WaiterBootstrap = {
  outlet?: {
    id: number;
    name: string;
    business_type?: string;
  } | null;
  active_features?: Record<string, boolean>;
  tables?: RestaurantTable[];
  assigned_tables?: RestaurantTable[];
  menu_categories?: Array<HospitalityMenuCategory & { items?: HospitalityMenuItem[] }>;
  order_types?: OrderType[];
  waiter?: {
    id?: number | null;
    name?: string | null;
    email?: string | null;
    can_view_all_tables?: boolean;
    assigned_table_count?: number;
  };
};

type WaiterRealtimeEvent = {
  event_id?: string;
  event_type?: string;
  item_id?: number;
  service_order_id?: number;
  preparation_status?: string;
  table_label?: string;
  from_status?: string | null;
  to_status?: string;
};

const createDraftIdempotencyKey = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const value = Math.floor(Math.random() * 16);
    return (character === "x" ? value : (value & 0x3) | 0x8).toString(16);
  });
};

const getErrorMessage = (error: unknown) => {
  if (error && typeof error === "object" && "response" in error) {
    const response = (error as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }).response;
    const firstValidationMessage = response?.data?.errors
      ? Object.values(response.data.errors).flat()[0]
      : null;
    if (firstValidationMessage) return firstValidationMessage;
    if (response?.data?.message) return response.data.message;
  }

  return error instanceof Error ? error.message : "Could not submit the restaurant order.";
};

export default function WaiterPosPage() {
  const queryClient = useQueryClient();
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [selectedOrderTypeCode, setSelectedOrderTypeCode] = useState("dine_in");
  const [guestCount, setGuestCount] = useState(2);
  const [cart, setCart] = useState<WaiterCartItem[]>([]);
  const [draftIdempotencyKey, setDraftIdempotencyKey] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<"connecting" | "live" | "offline">("connecting");
  const handledRealtimeEventIds = useRef(new Set<string>());

  const { data, isLoading } = useQuery<WaiterBootstrap>({
    queryKey: ["waiter-pos-bootstrap"],
    queryFn: () => fetchWaiterBootstrap(),
  });

  const outlet = data?.outlet;
  const activeFeatures = data?.active_features ?? {};
  const tables = data?.tables ?? [];
  const menuCategories = data?.menu_categories ?? [];
  const orderTypes = data?.order_types?.length
    ? data.order_types
    : [{ id: 1, code: "dine_in", name: "Dine In" }];
  const assignedTableCount = data?.waiter?.assigned_table_count ?? data?.assigned_tables?.length ?? 0;
  const canViewAllTables = data?.waiter?.can_view_all_tables ?? false;

  useEffect(() => {
    const token = getAccessToken() ?? (typeof window !== "undefined" ? localStorage.getItem("token") : null);
    const tenantId = getTenantId();
    const outletId = outlet?.id;

    if (!token || !tenantId || !outletId) {
      setRealtimeStatus("offline");
      return;
    }

    const channelName = `tenant.${tenantId}.outlet.${outletId}.waiters`;

    try {
      const echo = initEcho(token);
      const channel = echo.private(channelName);
      const onSubscribed = () => setRealtimeStatus("live");
      const onSubscriptionError = () => setRealtimeStatus("offline");
      const stopConnectionWatch = echo.connector.onConnectionChange((status) => {
        setRealtimeStatus(status === "connected" ? "live" : status === "connecting" ? "connecting" : "offline");
      });
      const markEventHandled = (event: WaiterRealtimeEvent) => {
        const eventId = event.event_id;
        if (eventId) {
          if (handledRealtimeEventIds.current.has(eventId)) return;
          handledRealtimeEventIds.current.add(eventId);
          if (handledRealtimeEventIds.current.size > 100) {
            handledRealtimeEventIds.current.delete(handledRealtimeEventIds.current.values().next().value as string);
          }
        }

        return true;
      };

      const onUpdate = (event: WaiterRealtimeEvent) => {
        if (!markEventHandled(event)) return;

        setRealtimeStatus("live");
        setSuccessMessage(
          event.preparation_status === "ready"
            ? `Kitchen marked item #${event.item_id} ready.`
            : `Live kitchen update received for item #${event.item_id}.`,
        );
        void queryClient.invalidateQueries({ queryKey: ["waiter-pos-bootstrap"] });
        void queryClient.invalidateQueries({ queryKey: ["hospitality-service-orders"] });
        void queryClient.invalidateQueries({ queryKey: ["hospitality", "kds"] });
      };
      const onTableStatusUpdate = (event: WaiterRealtimeEvent) => {
        if (!markEventHandled(event)) return;

        setRealtimeStatus("live");
        setSuccessMessage(
          `Table ${event.table_label ?? ""} changed from ${event.from_status ?? "unknown"} to ${event.to_status ?? "unknown"}.`,
        );
        void queryClient.invalidateQueries({ queryKey: ["waiter-pos-bootstrap"] });
      };

      channel.subscribed(onSubscribed);
      channel.error(onSubscriptionError);
      channel.listen(".waiter.order-item.updated", onUpdate);
      channel.listen(".waiter.table-status.updated", onTableStatusUpdate);
      onSubscribed();

      return () => {
        stopConnectionWatch();
        echo.leave(channelName);
      };
    } catch {
      setRealtimeStatus("offline");
    }
  }, [outlet?.id, queryClient]);

  useEffect(() => {
    if (!orderTypes.some((orderType) => orderType.code === selectedOrderTypeCode)) {
      setSelectedOrderTypeCode(orderTypes[0]?.code ?? "dine_in");
    }
  }, [orderTypes, selectedOrderTypeCode]);

  const submitOrderMutation = useMutation({
    mutationFn: createWaiterHospitalityOrder,
    onSuccess: (response) => {
      setSuccessMessage(
        response?.idempotent_replay
          ? "Restaurant order confirmed from a safe retry."
          : response?.requires_approval
          ? "Order submitted for approval."
          : "Restaurant order sent to the kitchen.",
      );
      setErrorMessage(null);
      setCart([]);
      setSelectedTable(null);
      setDraftIdempotencyKey(null);
      void queryClient.invalidateQueries({ queryKey: ["waiter-pos-bootstrap"] });
      void queryClient.invalidateQueries({ queryKey: ["hospitality-service-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["hospitality", "kds"] });
      window.setTimeout(() => setSuccessMessage(null), 4000);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(getErrorMessage(error));
    },
  });

  const handleAddItem = (item: WaiterCartSelection) => {
    setDraftIdempotencyKey(null);
    setCart((current) => {
      const existing = current.find((cartItem) => cartItem.cartKey === item.cartKey);
      if (existing) {
        return current.map((cartItem) =>
          cartItem.cartKey === item.cartKey
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem,
        );
      }

      return [...current, { ...item, quantity: 1, courseNumber: 1 }];
    });
  };

  const handleUpdateQuantity = (cartKey: string, delta: number) => {
    setDraftIdempotencyKey(null);
    setCart((current) =>
      current
        .map((item) =>
          item.cartKey === cartKey ? { ...item, quantity: item.quantity + delta } : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };

  const handleUpdateItem = (
    cartKey: string,
    patch: Partial<Pick<WaiterCartItem, "notes" | "seatNumber" | "courseNumber">>,
  ) => {
    setDraftIdempotencyKey(null);
    setCart((current) =>
      current.map((item) => (item.cartKey === cartKey ? { ...item, ...patch } : item)),
    );
  };

  const handleRemoveItem = (cartKey: string) => {
    setDraftIdempotencyKey(null);
    setCart((current) => current.filter((item) => item.cartKey !== cartKey));
  };

  const handleSubmit = () => {
    if (cart.length === 0) {
      setErrorMessage("Add at least one menu item before submitting the order.");
      return;
    }

    if (!selectedTable) {
      setErrorMessage("Select a dining table before submitting the order.");
      return;
    }

    setErrorMessage(null);
    const idempotencyKey = draftIdempotencyKey ?? createDraftIdempotencyKey();
    setDraftIdempotencyKey(idempotencyKey);
    submitOrderMutation.mutate({
      idempotencyKey,
      outlet_id: outlet?.id,
      location_id: selectedTable.id,
      order_type_code: selectedOrderTypeCode,
      guest_count: guestCount,
      items: cart.map((item) => ({
        menu_item_id: item.menuItemId,
        item_name: item.name,
        quantity: item.quantity,
        variant_id: item.variantId ?? undefined,
        modifier_option_ids: item.modifierOptionIds,
        notes: item.notes?.trim() || undefined,
        seat_number: item.seatNumber,
        course_number: item.courseNumber ?? 1,
      })),
    });
  };

  if (isLoading) {
    return (
      <main className="p-8 text-center text-muted-foreground">
        <span className="animate-pulse">Loading waiter POS...</span>
      </main>
    );
  }

  if (activeFeatures.pos === false && activeFeatures.table_service === false) {
    return (
      <main className="mx-auto max-w-lg space-y-4 p-12 text-center">
        <ShieldAlert className="mx-auto h-12 w-12 text-red-700 dark:text-red-300" aria-hidden="true" />
        <h1 className="text-xl font-bold text-foreground">POS feature disabled</h1>
        <p className="text-sm text-muted-foreground">
          Point of Sale and waiter ordering features are disabled for the current outlet profile.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1600px] space-y-6 p-4 md:p-6">
      <header className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
            <UtensilsCrossed className="h-6 w-6 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
            Restaurant Waiter POS
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Outlet: <span className="font-semibold text-foreground">{outlet?.name ?? "Default Restaurant"}</span>
            {" | "}
            Waiter: <span className="font-semibold text-foreground">{data?.waiter?.name ?? "Staff"}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground" role="status" aria-live="polite">
            Live kitchen updates: {realtimeStatus === "live" ? "connected" : realtimeStatus === "connecting" ? "connecting" : "reconnecting"}.
          </p>
        </div>

        <div className="space-y-2">
          {successMessage ? (
            <div
              className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300"
              role="status"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              {successMessage}
            </div>
          ) : null}
          {errorMessage ? (
            <div className="rounded-lg border border-red-700 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:border-red-300 dark:bg-red-950/50 dark:text-red-300" role="alert">
              {errorMessage}
            </div>
          ) : null}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <TableGridSelector
            tables={tables}
            selectedTable={selectedTable}
            assignedTableCount={assignedTableCount}
            canViewAllTables={canViewAllTables}
            onSelectTable={(table) => {
              setDraftIdempotencyKey(null);
              setSelectedTable(table);
              setErrorMessage(null);
            }}
          />

          <MenuBrowser categories={menuCategories} onAddItem={handleAddItem} />
        </div>

        <div className="self-start lg:sticky lg:top-6 lg:col-span-4">
          <OrderCartDrawer
            tableName={selectedTable?.label}
            cart={cart}
            orderTypes={orderTypes}
            selectedOrderTypeCode={selectedOrderTypeCode}
            guestCount={guestCount}
            onUpdateGuestCount={(count) => {
              setDraftIdempotencyKey(null);
              setGuestCount(count);
            }}
            onUpdateOrderType={(code) => {
              setDraftIdempotencyKey(null);
              setSelectedOrderTypeCode(code);
            }}
            onUpdateQuantity={handleUpdateQuantity}
            onUpdateItem={handleUpdateItem}
            onRemoveItem={handleRemoveItem}
            onSubmitOrder={handleSubmit}
            isSubmitting={submitOrderMutation.isPending}
          />
        </div>
      </div>
    </main>
  );
}
