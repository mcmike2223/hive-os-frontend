"use client";

import { motion } from "framer-motion";
import { Sofa, User, Clock, AlertCircle, Sparkles } from "lucide-react";
import { HospitalityLocation } from "../../types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

interface LocationCardProps {
  location: HospitalityLocation;
  businessType: string;
  onStatusChange: (id: number, status: HospitalityLocation["status"]) => void;
}

const statusColors = {
  available: "bg-emerald-500 shadow-emerald-500/50",
  reserved: "bg-amber-500 shadow-amber-500/50",
  occupied: "bg-destructive shadow-destructive/50",
  dirty: "bg-sky-500 shadow-sky-500/50",
};

const statusLabels = {
  available: "Available",
  reserved: "Reserved",
  occupied: "Occupied",
  dirty: "Needs Cleaning",
};

export default function LocationCard({ location, businessType, onStatusChange }: LocationCardProps) {
  const isNightclub = businessType === "nightclub";
  const locationLabel = isNightclub ? "Sofa" : "Location";
  const Icon = isNightclub ? Sofa : Sofa; // Both can use Sofa or Utensils, but prompt said lounge-style for nightclub

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "group relative rounded-[2rem] border bg-card/30 backdrop-blur-sm p-5 transition-all duration-300 hover:shadow-xl",
        location.status === "available" && "hover:border-emerald-500/30",
        location.status === "reserved" && "hover:border-amber-500/30",
        location.status === "occupied" && "hover:border-destructive/30",
        location.status === "dirty" && "hover:border-sky-500/30"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex h-12 w-12 items-center justify-center rounded-2xl transition-transform group-hover:scale-110 group-hover:rotate-3",
            location.status === "available" && "bg-emerald-500/10 text-emerald-500",
            location.status === "reserved" && "bg-amber-500/10 text-amber-500",
            location.status === "occupied" && "bg-destructive/10 text-destructive",
            location.status === "dirty" && "bg-sky-500/10 text-sky-500"
          )}>
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-black tracking-tight">{location.label}</h3>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
              {locationLabel} • Capacity: {location.capacity}
            </p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/20 text-muted-foreground transition-colors hover:bg-muted/40">
              <span className="sr-only">Open menu</span>
              <div className="h-1.5 w-1.5 rounded-full bg-current" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-2xl border-none bg-card/80 backdrop-blur-xl p-2 shadow-2xl">
            <DropdownMenuItem onClick={() => onStatusChange(location.id, "available")} className="rounded-xl gap-2 font-bold text-emerald-500">
              <div className="w-2 h-2 rounded-full bg-emerald-500" /> Mark Available
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStatusChange(location.id, "occupied")} className="rounded-xl gap-2 font-bold text-destructive">
              <div className="w-2 h-2 rounded-full bg-destructive" /> Seat Guest
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStatusChange(location.id, "reserved")} className="rounded-xl gap-2 font-bold text-amber-500">
              <div className="w-2 h-2 rounded-full bg-amber-500" /> Reserve
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStatusChange(location.id, "dirty")} className="rounded-xl gap-2 font-bold text-sky-500">
              <div className="w-2 h-2 rounded-full bg-sky-500" /> Mark Dirty
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-6 space-y-4">
        {isNightclub && (
          <div className="flex items-center justify-between rounded-xl bg-primary/5 p-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-[11px] font-black uppercase tracking-wider">Min. Spend</span>
            </div>
            <span className="text-sm font-black text-primary">ETB {location.min_spend}</span>
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <Badge className={cn(
            "rounded-full border-none px-3 py-0.5 text-[11px] font-black uppercase tracking-widest text-white shadow-lg",
            statusColors[location.status]
          )}>
            {statusLabels[location.status]}
          </Badge>

          {location.assigned_staff_id && (
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
              <User className="h-3 w-3" />
              <span>{location.staff?.name || "Assigned"}</span>
            </div>
          )}
        </div>
      </div>

      <div className={cn(
        "absolute -bottom-1 left-1/2 h-1 w-12 -translate-x-1/2 rounded-full blur-sm transition-opacity opacity-50",
        statusColors[location.status]
      )} />
    </motion.div>
  );
}
