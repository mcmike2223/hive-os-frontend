"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchKdsOrders,
  updateKdsItemStatus,
  fetchPreparationStations,
} from "@/modules/hospitality/api";
import {
  Utensils,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ChefHat,
} from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import { initEcho } from "@/lib/echo";
import { getAccessToken, getTenantId } from "@/lib/runtime-context";

type KdsRealtimeEvent = {
  event_id?: string;
  item_id?: number;
  preparation_status?: string;
};

export default function KdsPage() {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canManageKds = hasPermission("manage_hospitality_kds");
  const [selectedStationId, setSelectedStationId] = useState<number | "all">(
    "all",
  );
  const [realtimeStatus, setRealtimeStatus] = useState<"connecting" | "live" | "offline">("connecting");
  const handledRealtimeEventIds = useRef(new Set<string>());

  const { data: stationsData } = useQuery({
    queryKey: ["preparation-stations"],
    queryFn: () => fetchPreparationStations(),
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["kds-orders", selectedStationId],
    queryFn: () =>
      fetchKdsOrders(
        selectedStationId === "all" ? {} : { station_id: selectedStationId },
      ),
    refetchInterval: 5000,
  });

  const orders = data ?? [];
  const stations = stationsData ?? [];
  const realtimeOutletId = stations[0]?.outlet_id ?? undefined;

  useEffect(() => {
    const token = getAccessToken() ?? (typeof window !== "undefined" ? localStorage.getItem("token") : null);
    const tenantId = getTenantId();
    const outletId = realtimeOutletId;

    if (!token || !tenantId || !outletId) {
      setRealtimeStatus("offline");
      return;
    }

    const channelName = `tenant.${tenantId}.outlet.${outletId}.kds`;
    try {
      const echo = initEcho(token);
      if (!echo) return;
      const channel = echo.private(channelName);
      const onSubscribed = () => setRealtimeStatus("live");
      const onSubscriptionError = () => setRealtimeStatus("offline");
      const stopConnectionWatch = echo.connector.onConnectionChange((status) => {
        setRealtimeStatus(status === "connected" ? "live" : status === "connecting" ? "connecting" : "offline");
      });
      const onUpdate = (event: KdsRealtimeEvent) => {
        const eventId = event.event_id;
        if (eventId) {
          if (handledRealtimeEventIds.current.has(eventId)) return;
          handledRealtimeEventIds.current.add(eventId);
          if (handledRealtimeEventIds.current.size > 100) {
            handledRealtimeEventIds.current.delete(handledRealtimeEventIds.current.values().next().value as string);
          }
        }

        setRealtimeStatus("live");
        void queryClient.invalidateQueries({ queryKey: ["kds-orders"] });
      };

      channel.subscribed(onSubscribed);
      channel.error(onSubscriptionError);
      channel.listen(".kds.item.updated", onUpdate);
      onSubscribed();

      return () => {
        stopConnectionWatch();
        echo.leave(channelName);
      };
    } catch {
      setRealtimeStatus("offline");
    }
  }, [queryClient, realtimeOutletId]);

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      updateKdsItemStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kds-orders"] });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "new":
        return "bg-rose-500/10 text-rose-600 border-rose-500/30";
      case "accepted":
      case "preparing":
        return "bg-amber-500/10 text-amber-600 border-amber-500/30 animate-pulse";
      case "ready":
        return "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 font-bold";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1800px] mx-auto min-h-screen bg-background">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <ChefHat className="w-7 h-7 text-primary" />
            Kitchen Display System (KDS)
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time station order queue & ticket preparation status.
            Auto-refreshes every 5s.
          </p>
          <p className="mt-1 text-xs text-muted-foreground" role="status" aria-live="polite">
            Live intake: {realtimeStatus === "live" ? "connected" : realtimeStatus === "connecting" ? "connecting" : "reconnecting"}.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Station Filter */}
          <label className="sr-only" htmlFor="kds-station-filter">Kitchen station</label>
          <select
            id="kds-station-filter"
            value={selectedStationId}
            onChange={(e) =>
              setSelectedStationId(
                e.target.value === "all" ? "all" : Number(e.target.value),
              )
            }
            className="px-3 py-1.5 text-xs font-semibold border border-border rounded-lg bg-card text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <option value="all">All Kitchen & Bar Stations</option>
            {stations.map((station) => (
              <option key={station.id} value={station.id}>
                {station.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => refetch()}
            aria-label="Refresh kitchen tickets"
            className="p-2 border border-border rounded-lg bg-card text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Orders Ticket Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-muted-foreground animate-pulse">
          Loading active kitchen tickets...
        </div>
      ) : orders.length === 0 ? (
        <div className="p-16 text-center border border-dashed border-border rounded-xl text-muted-foreground flex flex-col items-center gap-2">
          <ChefHat className="w-10 h-10 text-muted-foreground/40" />
          <span className="font-bold text-base">
            All clear! No pending kitchen orders.
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-card border-2 border-border rounded-xl flex flex-col justify-between overflow-hidden shadow-lg"
            >
              {/* Order Header */}
              <div className="p-3 bg-muted/50 border-b border-border flex items-center justify-between">
                <div>
                  <div className="font-extrabold text-base text-foreground">
                    {order.order_number}
                  </div>
                  <div className="text-xs text-primary font-bold">
                    {order.location?.label ?? "Dine-In Table"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(order.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>

              {/* Ticket Items */}
              <div className="p-3 space-y-2.5 flex-1 max-h-[400px] overflow-y-auto">
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    data-testid={`kds-item-${item.id}`}
                    className="p-2.5 rounded-lg border border-border bg-background flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-foreground flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">
                          {item.quantity}x
                        </span>
                        <span className="truncate">{item.item_name}</span>
                      </div>
                      {item.seat_number && (
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Seat: #{item.seat_number} | Course: #
                          {item.course_number ?? 1}
                        </div>
                      )}
                    </div>

                    {/* Quick Action Button */}
                    {canManageKds && (
                      <button
                        type="button"
                        disabled={updateStatusMutation.isPending}
                        onClick={() => {
                          const nextStatus =
                            item.preparation_status === "new"
                              ? "accepted"
                              : item.preparation_status === "accepted"
                                ? "preparing"
                                : item.preparation_status === "preparing"
                                  ? "ready"
                                  : "ready";
                          updateStatusMutation.mutate({
                            id: item.id,
                            status: nextStatus,
                          });
                        }}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all active:scale-95 ${getStatusBadge(
                          item.preparation_status,
                        )}`}
                      >
                        {item.preparation_status.toUpperCase()}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
