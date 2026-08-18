"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Maximize, Map as MapIcon, Users, Sparkles } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { fetchFloorPlan, updateLocationStatus, fetchHospitalityOverview } from "@/modules/hospitality/api";
import SpatialGridMap from "../components/space-management/SpatialGridMap";
import { useState } from "react";
import { HospitalityLocation } from "../types";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function SpaceManagementPage() {
  const queryClient = useQueryClient();
  const [selectedLocation, setSelectedLocation] = useState<HospitalityLocation | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const { data: overview } = useQuery({
    queryKey: ["hospitality", "overview"],
    queryFn: fetchHospitalityOverview,
  });

  const { data: zones, isLoading } = useQuery({
    queryKey: ["hospitality", "floor-plan"],
    queryFn: () => fetchFloorPlan(),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => 
      updateLocationStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hospitality", "floor-plan"] });
      queryClient.invalidateQueries({ queryKey: ["hospitality", "overview"] });
      toast.success("Location status updated");
    },
  });

  const allLocations = zones?.flatMap((z: any) => z.locations) || [];
  const businessType = overview?.business_type || "restaurant";

  return (
    <div className="space-y-8 p-6 pb-20">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="rounded-full">
              <Link href="/dashboard/hospitality">
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back
              </Link>
            </Button>
            <h1 className="text-3xl font-black tracking-tight">Space Management</h1>
          </div>
          <p className="text-muted-foreground font-medium">
            Real-time visual map of your venue layout and occupation.
          </p>
        </div>
        
        <div className="flex items-center gap-3 bg-card/50 backdrop-blur-sm border border-border/40 p-1.5 rounded-full">
          <Button variant="ghost" size="sm" className="rounded-full px-4 h-9 font-bold text-xs uppercase tracking-widest">
            <MapIcon className="mr-2 h-3.5 w-3.5" />
            Floor Plan
          </Button>
          <Button variant="ghost" size="sm" className="rounded-full px-4 h-9 font-bold text-xs uppercase tracking-widest opacity-50">
            <Maximize className="mr-2 h-3.5 w-3.5" />
            Grid Editor
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-[60vh] items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
            <p className="text-xs font-black uppercase tracking-widest opacity-30">Synchronizing Floor Data...</p>
          </div>
        </div>
      ) : (
        <div className="space-y-10">
          <SpatialGridMap 
            zones={zones || []} 
            businessType={businessType}
            onLocationClick={(loc) => {
              setSelectedLocation(loc);
              setIsDetailsOpen(true);
            }}
          />

          <div className="rounded-[2.5rem] border border-border/40 bg-card/30 backdrop-blur-md p-8">
            <h3 className="text-xl font-black tracking-tight mb-6 flex items-center gap-3">
              <div className="w-2 h-6 rounded-full bg-primary" />
              Occupation Summary
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Available", status: "available", color: "bg-emerald-500" },
                { label: "Reserved", status: "reserved", color: "bg-amber-500" },
                { label: "Occupied", status: "occupied", color: "bg-destructive" },
                { label: "Dirty", status: "dirty", color: "bg-sky-500" },
              ].map((s) => (
                <div key={s.status} className="p-4 rounded-3xl bg-background/50 border border-border/40 text-center">
                  <div className={`mx-auto w-2 h-2 rounded-full ${s.color} mb-2 shadow-lg`} />
                  <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-black mt-1">
                    {allLocations.filter((l: HospitalityLocation) => l.status === s.status).length}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <Dialog open={isDetailsOpen && !!selectedLocation} onOpenChange={(open) => {
            if (!open) {
              setIsDetailsOpen(false);
              setSelectedLocation(null);
            }
          }}>
            <DialogContent className="rounded-[2rem] border border-border/40 bg-card/90 backdrop-blur-2xl p-8 max-w-md shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-2">
                  <div className="w-2 h-6 rounded-full bg-amber-500" />
                  Live Details
                </DialogTitle>
              </DialogHeader>
              {selectedLocation && (
                <div className="space-y-6 mt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xl font-black tracking-tight">{selectedLocation.label}</h4>
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{selectedLocation.table_type}</p>
                    </div>
                    <Badge className="rounded-full px-4 py-1 font-black uppercase text-[11px]">
                      {selectedLocation.status}
                    </Badge>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-4 text-sm font-bold">
                      <Users className="h-5 w-5 text-muted-foreground" />
                      <span>{selectedLocation.capacity} Guests Max</span>
                    </div>
                    {businessType === "nightclub" && selectedLocation.min_spend && (
                      <div className="flex items-center gap-4 text-sm font-bold text-primary">
                        <Sparkles className="h-5 w-5" />
                        <span>Min Spend: ETB {selectedLocation.min_spend}</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-4 border-t border-border/40">
                    {["available", "occupied", "reserved", "dirty"].map((status) => (
                      <Button
                        key={status}
                        variant={selectedLocation.status === status ? "default" : "outline"}
                        size="sm"
                        className="rounded-xl text-[11px] font-black uppercase tracking-widest"
                        onClick={() => {
                          statusMutation.mutate({ id: selectedLocation.id, status }, {
                            onSuccess: () => {
                              setSelectedLocation(prev => prev ? { ...prev, status: status as any } : null);
                            }
                          });
                        }}
                        disabled={statusMutation.isPending}
                      >
                        {status}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}
