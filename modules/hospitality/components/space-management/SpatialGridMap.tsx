"use client";

import { motion } from "framer-motion";
import { HospitalityLocation, HospitalityZone } from "../../types";
import { cn } from "@/lib/utils";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Sofa, Users, Sparkles, User, Utensils } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SpatialGridMapProps {
  zones: HospitalityZone[];
  businessType: string;
  onLocationClick: (location: HospitalityLocation) => void;
}

const statusColors = {
  available: "bg-emerald-500 shadow-emerald-500/40",
  reserved: "bg-amber-500 shadow-amber-500/40",
  occupied: "bg-destructive shadow-destructive/40",
  dirty: "bg-sky-500 shadow-sky-500/40",
};

const statusGradients = {
  available: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/20 text-emerald-500",
  reserved: "from-amber-500/20 to-amber-500/5 border-amber-500/20 text-amber-500",
  occupied: "from-destructive/20 to-destructive/5 border-destructive/20 text-destructive",
  dirty: "from-sky-500/20 to-sky-500/5 border-sky-500/20 text-sky-500",
};

export default function SpatialGridMap({ zones, businessType, onLocationClick }: SpatialGridMapProps) {
  const isNightclub = businessType === "nightclub";
  const LocationIcon = isNightclub ? Sofa : Utensils;

  return (
    <div className="space-y-12">
      {zones?.map((zone) => (
        <div key={zone.id} className="space-y-6">
          <div className="flex items-center gap-4 px-2">
            <h3 className="text-2xl font-black tracking-tighter uppercase">{zone.name}</h3>
            <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
            <Badge variant="outline" className="rounded-full px-4 py-1 border-white/10 bg-white/5 text-[11px] font-black opacity-60">
              {zone.locations?.length || 0} {isNightclub ? "Units" : "Tables"}
            </Badge>
          </div>

          <div className="rounded-[3rem] border border-white/5 bg-card/20 backdrop-blur-3xl p-10 shadow-2xl relative overflow-hidden">
            {/* Background Glows */}
            <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-6 relative z-10">
              {zone.locations?.map((location: HospitalityLocation) => (
                <TooltipProvider key={location.id}>
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <motion.button
                        whileHover={{ scale: 1.05, y: -8, rotate: 2 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => onLocationClick(location)}
                        className={cn(
                          "aspect-square rounded-[2.5rem] p-6 flex flex-col items-center justify-center gap-3 transition-all duration-500 relative overflow-hidden group border",
                          "bg-gradient-to-br shadow-lg",
                          statusGradients[location.status]
                        )}
                      >
                        {/* Glass Reflection */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                        {/* Status Pulsing Dot */}
                        <div className={cn(
                          "absolute top-5 right-5 h-2.5 w-2.5 rounded-full",
                          statusColors[location.status],
                          "animate-pulse shadow-lg"
                        )} />

                        <div className="relative">
                          <LocationIcon className={cn(
                            "h-10 w-10 transition-all duration-500 group-hover:scale-110",
                            location.status === 'occupied' && "animate-bounce"
                          )} />
                          {location.assigned_staff_id && (
                            <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-white text-black flex items-center justify-center border-2 border-card">
                              <User className="h-3 w-3" />
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col items-center text-center">
                          <span className="text-sm font-black tracking-tighter uppercase line-clamp-1">{location.label}</span>
                          <span className="text-[11px] font-black opacity-60 uppercase tracking-[0.2em] mt-0.5">
                            Cap: {location.capacity}
                          </span>
                        </div>
                        
                        {isNightclub && location.min_spend && (
                          <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="absolute bottom-4 flex items-center gap-1 bg-primary/20 px-2 py-0.5 rounded-full border border-primary/20"
                          >
                            <Sparkles className="h-2 w-2 text-primary" />
                            <span className="text-[7px] font-black text-primary uppercase tracking-tighter">VIP</span>
                          </motion.div>
                        )}
                      </motion.button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="rounded-3xl p-6 border border-white/10 bg-card/90 backdrop-blur-2xl shadow-2xl min-w-[200px]">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between gap-6">
                          <div>
                            <h5 className="text-xl font-black tracking-tight">{location.label}</h5>
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                              {isNightclub ? "Sofa Lounge" : "Dining Table"}
                            </p>
                          </div>
                          <Badge className={cn(
                            "rounded-full border-none px-4 py-1 text-[11px] font-black uppercase tracking-[0.15em] text-white",
                            statusColors[location.status]
                          )}>
                            {location.status}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/5">
                          <div className="space-y-1">
                            <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">Capacity</p>
                            <p className="text-sm font-black flex items-center gap-1.5">
                              <Users className="h-4 w-4 opacity-40" />
                              {location.capacity} People
                            </p>
                          </div>
                          {isNightclub && (
                            <div className="space-y-1">
                              <p className="text-[11px] font-black text-primary uppercase tracking-widest">Min Spend</p>
                              <p className="text-sm font-black text-primary">ETB {location.min_spend}</p>
                            </div>
                          )}
                        </div>

                        {location.staff && (
                          <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5">
                            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-black text-xs">
                              {location.staff.name.charAt(0)}
                            </div>
                            <div>
                              <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">Assigned Staff</p>
                              <p className="text-xs font-bold">{location.staff.name}</p>
                            </div>
                          </div>
                        )}
                        
                        <p className="text-[11px] font-medium text-muted-foreground/60 italic">
                          Click to manage status and assignments
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
