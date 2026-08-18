"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LayoutGrid, Users, Filter, Map as MapIcon, Search, Grid3X3, List } from "lucide-react";
import { HospitalityZone, HospitalityLocation } from "../../types";
import LocationCard from "./LocationCard";
import SpatialGridMap from "./SpatialGridMap";
import GuestListSidebar from "./GuestListSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

// API placeholders
const fetchZones = async (assignedOnly: boolean): Promise<HospitalityZone[]> => {
  const url = new URL("/api/v1/hospitality/space/zones", window.location.origin);
  if (assignedOnly) url.searchParams.append("assigned_only", "true");
  
  const response = await fetch(url.toString());
  if (!response.ok) throw new Error("Failed to fetch zones");
  return response.json();
};

const updateLocationStatus = async ({ id, status }: { id: number; status: string }) => {
  const response = await fetch(`/api/v1/hospitality/space/locations/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) throw new Error("Failed to update status");
  return response.json();
};

interface SpaceManagementProps {
  businessType: string;
  isWaiter?: boolean;
}

export default function SpaceManagement({ businessType, isWaiter = false }: SpaceManagementProps) {
  const queryClient = useQueryClient();
  const [activeZoneId, setActiveZoneId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");

  const { data: zones, isLoading } = useQuery({
    queryKey: ["hospitality", "zones", isWaiter],
    queryFn: () => fetchZones(isWaiter),
  });

  const statusMutation = useMutation({
    mutationFn: updateLocationStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hospitality", "zones"] });
    },
  });

  const handleStatusChange = (id: number, status: HospitalityLocation["status"]) => {
    statusMutation.mutate({ id, status });
  };

  const isNightclub = businessType === "nightclub";
  const locationLabelPlural = isNightclub ? "Sofas" : "Locations";

  if (isLoading) {
    return (
      <div className="space-y-8 p-6">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-32 rounded-full" />)}
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-48 rounded-[2rem]" />)}
        </div>
      </div>
    );
  }

  const processedZones = zones?.map(zone => ({
    ...zone,
    locations: (zone.locations || []).filter(loc => 
      loc.label.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(zone => 
    (!activeZoneId || zone.id === activeZoneId) && (zone.locations?.length || 0) > 0
  ) || [];

  const allLocations = zones?.flatMap(z => z.locations || []) || [];
  const searchedLocations = allLocations.filter(loc => 
    loc.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-20">
      {/* Nightclub Specific Sidebar */}
      {isNightclub && <GuestListSidebar />}

      {/* Header & Controls */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between px-2">
        <div className="space-y-1">
          <h2 className="text-4xl font-black tracking-tighter flex items-center gap-4">
            <span className="p-3 rounded-2xl bg-primary/10 text-primary shadow-inner">
              <MapIcon className="h-8 w-8" />
            </span>
            {isNightclub ? "Lounge Map" : "Floor Plan"}
          </h2>
          <p className="text-sm text-muted-foreground font-medium pl-1">
            Manage {locationLabelPlural.toLowerCase()} and status in real-time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="bg-muted/20 p-1 rounded-full">
            <TabsList className="bg-transparent border-none">
              <TabsTrigger value="list" className="rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Grid3X3 className="h-4 w-4 mr-2" />
                Cards
              </TabsTrigger>
              <TabsTrigger value="grid" className="rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <LayoutGrid className="h-4 w-4 mr-2" />
                Spatial
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative w-full max-w-xs sm:w-64">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder={`Search ${locationLabelPlural.toLowerCase()}...`}
              className="rounded-full pl-11 bg-muted/20 border-none h-12 focus-visible:ring-primary/30 text-base"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" className="rounded-full h-12 px-6 border-border/40 font-bold hover:bg-muted/30">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
        </div>
      </div>

      {/* Zone Tabs */}
      <div className="flex items-center gap-3 overflow-x-auto pb-4 no-scrollbar px-2">
        <Button
          variant={activeZoneId === null ? "default" : "outline"}
          className={cn(
            "rounded-full px-8 h-11 font-black uppercase text-[11px] tracking-[0.2em] transition-all",
            activeZoneId === null ? "shadow-xl shadow-primary/20 scale-105" : "border-border/60 hover:border-primary/40"
          )}
          onClick={() => setActiveZoneId(null)}
        >
          All Zones
        </Button>
        {zones?.map((zone) => (
          <Button
            key={zone.id}
            variant={activeZoneId === zone.id ? "default" : "outline"}
            className={cn(
              "rounded-full px-8 h-11 font-black uppercase text-[11px] tracking-[0.2em] transition-all",
              activeZoneId === zone.id ? "shadow-xl shadow-primary/20 scale-105" : "border-border/60 hover:border-primary/40"
            )}
            onClick={() => setActiveZoneId(zone.id)}
          >
            {zone.name}
          </Button>
        ))}
      </div>

      {/* Main View Area */}
      <AnimatePresence mode="wait">
        {viewMode === "grid" ? (
          <motion.div
            key="grid"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: "circOut" }}
          >
            <SpatialGridMap 
              zones={processedZones}
              businessType={businessType}
              onLocationClick={(loc) => {
                // Future: Open detail modal
              }}
            />
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: "circOut" }}
          >
            {searchedLocations.length > 0 ? (
              <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 px-2">
                {searchedLocations.map((location) => (
                  <LocationCard
                    key={location.id}
                    location={location}
                    businessType={businessType}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-32 text-center bg-card/10 rounded-[3rem] border border-dashed border-border/40">
                <div className="w-24 h-24 rounded-full bg-muted/20 flex items-center justify-center mb-6">
                  <LayoutGrid className="h-10 w-10 text-muted-foreground/30" />
                </div>
                <h3 className="text-2xl font-black tracking-tight text-muted-foreground">No {locationLabelPlural.toLowerCase()} found</h3>
                <p className="text-sm text-muted-foreground/60 max-w-xs mt-3 font-medium">
                  Try adjusting your search or filters to find what you're looking for.
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-10 rounded-[3rem] border border-white/5 bg-card/20 backdrop-blur-xl p-8 shadow-inner mt-12 mx-2">
        <div className="flex items-center gap-3 group cursor-help">
          <div className="h-4 w-4 rounded-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)] group-hover:scale-125 transition-transform" />
          <span className="text-[11px] font-black uppercase tracking-[0.2em] opacity-70 group-hover:opacity-100 transition-opacity">Available</span>
        </div>
        <div className="flex items-center gap-3 group cursor-help">
          <div className="h-4 w-4 rounded-full bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)] group-hover:scale-125 transition-transform" />
          <span className="text-[11px] font-black uppercase tracking-[0.2em] opacity-70 group-hover:opacity-100 transition-opacity">Reserved</span>
        </div>
        <div className="flex items-center gap-3 group cursor-help">
          <div className="h-4 w-4 rounded-full bg-destructive shadow-[0_0_15px_rgba(239,68,68,0.5)] group-hover:scale-125 transition-transform" />
          <span className="text-[11px] font-black uppercase tracking-[0.2em] opacity-70 group-hover:opacity-100 transition-opacity">Occupied</span>
        </div>
        <div className="flex items-center gap-3 group cursor-help">
          <div className="h-4 w-4 rounded-full bg-sky-500 shadow-[0_0_15px_rgba(14,165,233,0.5)] group-hover:scale-125 transition-transform" />
          <span className="text-[11px] font-black uppercase tracking-[0.2em] opacity-70 group-hover:opacity-100 transition-opacity">Needs Cleaning</span>
        </div>
      </div>
    </div>
  );
}
