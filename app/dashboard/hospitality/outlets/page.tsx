"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchHospitalityOutlets,
  createHospitalityOutlet,
  updateOutletFeatures,
} from "@/modules/hospitality/api";
import { Building2, Sliders, Plus, Check, X, ShieldAlert } from "lucide-react";

interface Outlet {
  id: number;
  name: string;
  code: string | null;
  business_type: string;
  currency: string;
  timezone: string;
  is_active: boolean;
  feature_overrides: Record<string, boolean> | null;
}

export default function OutletsPage() {
  const queryClient = useQueryClient();
  const [selectedOutlet, setSelectedOutlet] = useState<Outlet | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newOutlet, setNewOutlet] = useState({
    name: "",
    code: "",
    business_type: "restaurant",
    currency: "ETB",
    timezone: "Africa/Addis_Ababa",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["hospitality-outlets"],
    queryFn: () => fetchHospitalityOutlets(),
  });

  const outlets: Outlet[] = data?.data ?? [];
  const businessTypes: { value: string; label: string }[] = data?.business_types ?? [
    { value: "restaurant", label: "Restaurant" },
    { value: "cafe", label: "Café" },
    { value: "bar", label: "Bar" },
    { value: "hotel", label: "Hotel" },
    { value: "bakery", label: "Bakery" },
    { value: "catering", label: "Catering Company" },
    { value: "cloud_kitchen", label: "Cloud Kitchen" },
  ];

  const createMutation = useMutation({
    mutationFn: createHospitalityOutlet,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hospitality-outlets"] });
      setIsCreateOpen(false);
      setNewOutlet({ name: "", code: "", business_type: "restaurant", currency: "ETB", timezone: "Africa/Addis_Ababa" });
    },
  });

  const featureMutation = useMutation({
    mutationFn: ({ id, overrides }: { id: number; overrides: Record<string, boolean> }) =>
      updateOutletFeatures(id, overrides),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hospitality-outlets"] });
      queryClient.invalidateQueries({ queryKey: ["hospitality-features"] });
    },
  });

  const handleToggleFeature = (featureKey: string, currentValue: boolean) => {
    if (!selectedOutlet) return;
    const currentOverrides = selectedOutlet.feature_overrides ?? {};
    const updatedOverrides = { ...currentOverrides, [featureKey]: !currentValue };
    setSelectedOutlet({ ...selectedOutlet, feature_overrides: updatedOverrides });
    featureMutation.mutate({ id: selectedOutlet.id, overrides: updatedOverrides });
  };

  const featureCatalog = [
    { key: "pos", label: "POS Checkout", group: "POS & Ordering" },
    { key: "table_service", label: "Table Service", group: "POS & Ordering" },
    { key: "counter_service", label: "Counter Ordering", group: "POS & Ordering" },
    { key: "qr_ordering", label: "QR Self-Ordering", group: "POS & Ordering" },
    { key: "menu", label: "Menu Management", group: "Culinary" },
    { key: "recipes", label: "Recipes & BOM", group: "Culinary" },
    { key: "kitchen", label: "Kitchen Display System", group: "Kitchen & Bar" },
    { key: "bar", label: "Bar Station", group: "Kitchen & Bar" },
    { key: "reservations", label: "Table Reservations", group: "Operations" },
    { key: "waitlist", label: "Guest Waitlist", group: "Operations" },
    { key: "hotel", label: "Hotel Operations", group: "Lodging" },
    { key: "rooms", label: "Room Management", group: "Lodging" },
    { key: "housekeeping", label: "Housekeeping", group: "Lodging" },
    { key: "room_service", label: "Room Service POS", group: "Lodging" },
    { key: "events", label: "Event Management", group: "Events" },
    { key: "catering", label: "Catering Operations", group: "Events" },
    { key: "inventory", label: "Inventory Consumption", group: "ERP" },
    { key: "accounting", label: "Accounting Posting", group: "ERP" },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Building2 className="w-7 h-7 text-primary" />
            Hospitality Outlets & Business Profiles
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure hospitality outlets, select business profiles, and manage dynamic feature assignment.
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-medium px-4 py-2 rounded-lg hover:opacity-90 transition-opacity text-sm shadow"
        >
          <Plus className="w-4 h-4" />
          Add Hospitality Outlet
        </button>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground animate-pulse">Loading hospitality outlets...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Outlet List Card */}
          <div className="lg:col-span-1 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Outlets ({outlets.length})</h2>
            {outlets.map((outlet) => (
              <div
                key={outlet.id}
                onClick={() => setSelectedOutlet(outlet)}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  selectedOutlet?.id === outlet.id
                    ? "border-primary bg-primary/5 shadow-md"
                    : "border-border hover:border-primary/50 bg-card"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">{outlet.name}</h3>
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-primary/10 text-primary capitalize">
                    {outlet.business_type.replace("_", " ")}
                  </span>
                </div>
                <div className="mt-2 text-xs text-muted-foreground flex items-center justify-between">
                  <span>Code: {outlet.code || "N/A"}</span>
                  <span>{outlet.currency}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Feature Matrix / Configuration */}
          <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5 space-y-5">
            {selectedOutlet ? (
              <>
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                      <Sliders className="w-5 h-5 text-primary" />
                      Feature Configuration: {selectedOutlet.name}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Business Profile Defaults ({selectedOutlet.business_type}) + Tenant Feature Overrides
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {featureCatalog.map((feat) => {
                    const isEnabled = selectedOutlet.feature_overrides?.[feat.key] ?? true;
                    return (
                      <div
                        key={feat.key}
                        className="flex items-center justify-between p-3 rounded-lg border border-border bg-background hover:border-border/80"
                      >
                        <div>
                          <div className="text-sm font-medium text-foreground">{feat.label}</div>
                          <div className="text-xs text-muted-foreground">{feat.group}</div>
                        </div>
                        <button
                          onClick={() => handleToggleFeature(feat.key, isEnabled)}
                          className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                            isEnabled
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                              : "bg-muted text-muted-foreground border border-border"
                          }`}
                        >
                          {isEnabled ? "Enabled" : "Disabled"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                <Sliders className="w-10 h-10 stroke-1 text-muted-foreground/50" />
                <span>Select an outlet from the left menu to view and configure dynamic features.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-lg font-bold text-foreground">Add Hospitality Outlet</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <label className="block font-medium text-foreground mb-1">Outlet Name</label>
                <input
                  type="text"
                  value={newOutlet.name}
                  onChange={(e) => setNewOutlet({ ...newOutlet, name: e.target.value })}
                  placeholder="e.g. Central City Restaurant & Bar"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                />
              </div>
              <div>
                <label className="block font-medium text-foreground mb-1">Business Profile Type</label>
                <select
                  value={newOutlet.business_type}
                  onChange={(e) => setNewOutlet({ ...newOutlet, business_type: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground capitalize"
                >
                  {businessTypes.map((bt) => (
                    <option key={bt.value} value={bt.value}>
                      {bt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-foreground mb-1">Currency</label>
                  <input
                    type="text"
                    value={newOutlet.currency}
                    onChange={(e) => setNewOutlet({ ...newOutlet, currency: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                  />
                </div>
                <div>
                  <label className="block font-medium text-foreground mb-1">Outlet Code</label>
                  <input
                    type="text"
                    value={newOutlet.code}
                    onChange={(e) => setNewOutlet({ ...newOutlet, code: e.target.value })}
                    placeholder="OUT-01"
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button
                onClick={() => setIsCreateOpen(false)}
                className="px-4 py-2 text-sm font-medium border border-border rounded-lg text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={() => createMutation.mutate(newOutlet)}
                className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90"
              >
                Create Outlet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
