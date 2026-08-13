"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sofa, Plus, Pencil, Trash2, Loader2, ArrowLeft, Search, Filter, MapPin, Users, Sparkles } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchHospitalityTables,
  fetchFloorPlan,
  createHospitalityTable,
  updateHospitalityTable,
  deleteHospitalityTable,
  fetchHospitalityOverview,
} from "@/modules/hospitality/api";
import type { HospitalityLocation, HospitalityZone } from "@/modules/hospitality/types";
import { cn } from "@/lib/utils";

export default function TablesManagementPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<HospitalityLocation | null>(null);

  const [formData, setFormData] = useState({
    label: "",
    zone_id: "",
    capacity: "4",
    min_spend: "0",
    status: "available",
    table_type: "standard",
    is_active: true,
  });

  // Fetch tables
  const { data: tables = [], isLoading: isLoadingTables } = useQuery({
    queryKey: ["hospitality", "tables"],
    queryFn: () => fetchHospitalityTables(),
  });

  // Fetch zones from floor plan
  const { data: zones = [] } = useQuery<HospitalityZone[]>({
    queryKey: ["hospitality", "floor-plan"],
    queryFn: () => fetchFloorPlan(),
  });

  // Fetch overview for business type check
  const { data: overview } = useQuery({
    queryKey: ["hospitality", "overview"],
    queryFn: fetchHospitalityOverview,
  });

  const isNightclub = overview?.business_type === "nightclub";

  const createMutation = useMutation({
    mutationFn: createHospitalityTable,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hospitality", "tables"] });
      queryClient.invalidateQueries({ queryKey: ["hospitality", "floor-plan"] });
      toast.success("Table created successfully");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to create table");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) =>
      updateHospitalityTable(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hospitality", "tables"] });
      queryClient.invalidateQueries({ queryKey: ["hospitality", "floor-plan"] });
      toast.success("Table updated successfully");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to update table");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteHospitalityTable,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hospitality", "tables"] });
      queryClient.invalidateQueries({ queryKey: ["hospitality", "floor-plan"] });
      toast.success("Table deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to delete table");
    },
  });

  const resetForm = () => {
    setEditingTable(null);
    setFormData({
      label: "",
      zone_id: "",
      capacity: "4",
      min_spend: "0",
      status: "available",
      table_type: "standard",
      is_active: true,
    });
  };

  const openEditDialog = (table: HospitalityLocation) => {
    setEditingTable(table);
    setFormData({
      label: table.label,
      zone_id: table.zone_id ? String(table.zone_id) : "",
      capacity: String(table.capacity),
      min_spend: String(table.min_spend || 0),
      status: table.status,
      table_type: table.table_type || "standard",
      is_active: table.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      capacity: Number(formData.capacity),
      min_spend: Number(formData.min_spend),
      zone_id: formData.zone_id ? Number(formData.zone_id) : null,
    };

    if (editingTable) {
      updateMutation.mutate({ id: editingTable.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const statusColors: Record<string, string> = {
    available: "bg-emerald-500 hover:bg-emerald-600 text-white border-transparent",
    reserved: "bg-amber-500 hover:bg-amber-600 text-white border-transparent",
    occupied: "bg-rose-500 hover:bg-rose-600 text-white border-transparent",
    dirty: "bg-sky-500 hover:bg-sky-600 text-white border-transparent",
  };

  const filteredTables = tables.filter((table) => {
    const matchesSearch = table.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (table.zone?.name && table.zone.name.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === "all" || table.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
            <h1 className="text-3xl font-black tracking-tight">Tables & Layout</h1>
          </div>
          <p className="text-muted-foreground font-medium">
            Manage your physical assets, table designations, and seating configurations.
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          if (!open) resetForm();
          setIsDialogOpen(open);
        }}>
          <DialogTrigger asChild>
            <Button className="rounded-full px-6 shadow-xl shadow-primary/20">
              <Plus className="mr-2 h-4 w-4" />
              Add Table
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingTable ? "Edit Table Details" : "Create New Table"}</DialogTitle>
              <DialogDescription>
                Configure the table name, service zone, seating capacity, and default status.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="label">Table Label / Name *</Label>
                  <Input
                    id="label"
                    placeholder="e.g. Table 12, VIP Cabana 1"
                    required
                    value={formData.label}
                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="table_type">Table Type</Label>
                  <Select
                    value={formData.table_type}
                    onValueChange={(val) => setFormData({ ...formData, table_type: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard Table</SelectItem>
                      <SelectItem value="vip">VIP Area / Lounge</SelectItem>
                      <SelectItem value="bar">Bar Counter Seating</SelectItem>
                      <SelectItem value="booth">Booth Seating</SelectItem>
                      <SelectItem value="lounge">Lounge Sofa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="zone">Service Zone</Label>
                  <Select
                    value={formData.zone_id}
                    onValueChange={(val) => setFormData({ ...formData, zone_id: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Zone" />
                    </SelectTrigger>
                    <SelectContent>
                      {zones.map((zone: HospitalityZone) => (
                        <SelectItem key={zone.id} value={String(zone.id)}>
                          {zone.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="capacity">Capacity (Guests) *</Label>
                  <Input
                    id="capacity"
                    type="number"
                    min="1"
                    required
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="min_spend">Minimum Spend (ETB)</Label>
                  <Input
                    id="min_spend"
                    type="number"
                    min="0"
                    value={formData.min_spend}
                    onChange={(e) => setFormData({ ...formData, min_spend: e.target.value })}
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="status">Seating Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(val: any) => setFormData({ ...formData, status: val })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Available (Vacant & Clean)</SelectItem>
                      <SelectItem value="reserved">Reserved (Booked Ahead)</SelectItem>
                      <SelectItem value="occupied">Occupied (Seated)</SelectItem>
                      <SelectItem value="dirty">Dirty (Needs Clearing)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="w-full mt-4"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingTable ? "Save Seating Layout" : "Publish Seating Layout"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-card/40 border border-border/40 p-4 rounded-[1.5rem] backdrop-blur-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by label or zone..." 
            className="pl-9 rounded-full bg-background/50 border-border/40"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] rounded-full bg-background/50 border-border/40">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="reserved">Reserved</SelectItem>
              <SelectItem value="occupied">Occupied</SelectItem>
              <SelectItem value="dirty">Dirty</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tables Grid */}
      {isLoadingTables ? (
        <div className="flex h-[40vh] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500 opacity-60" />
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/50">Fetching Tables...</p>
          </div>
        </div>
      ) : filteredTables.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[30vh] border border-dashed rounded-[2rem] bg-card/20 border-border/40 text-center p-8">
          <Sofa className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="font-bold text-muted-foreground/60">No tables matching your filters found</p>
          <p className="text-xs text-muted-foreground/40 mt-1">Try refining your search or add a new table.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredTables.map((table: HospitalityLocation) => (
            <div 
              key={table.id} 
              className={cn(
                "group relative rounded-[2rem] border bg-gradient-to-br from-card to-background p-6 transition-all duration-300",
                "hover:-translate-y-1.5 hover:shadow-xl hover:border-indigo-500/20"
              )}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="space-y-1">
                  <h3 className="font-black text-xl tracking-tight">{table.label}</h3>
                  <Badge variant="secondary" className="capitalize rounded-md text-[11px] font-bold px-2 py-0.5">
                    {table.table_type.replace('_', ' ')}
                  </Badge>
                </div>
                
                <Badge className={cn("rounded-full px-3 py-0.5 text-[11px] font-black uppercase tracking-widest border shadow-sm", statusColors[table.status])}>
                  {table.status}
                </Badge>
              </div>

              <div className="space-y-3 border-t border-border/40 pt-4 text-xs font-semibold text-muted-foreground">
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{table.zone?.name || "Unassigned Zone"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5" />
                  <span>Up to {table.capacity} guests</span>
                </div>
                {isNightclub && Number(table.min_spend) > 0 && (
                  <div className="flex items-center gap-2 text-indigo-500 font-bold">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Min Spend: ETB {Number(table.min_spend).toLocaleString()}</span>
                  </div>
                )}
              </div>

              {/* Action Controls on Hover */}
              <div className="absolute right-4 bottom-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => openEditDialog(table)}
                  className="h-8 w-8 rounded-full border-border/60 bg-background/50 hover:bg-indigo-50 hover:text-indigo-600 transition-all shadow-sm"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    if (confirm(`Are you sure you want to delete ${table.label}?`)) {
                      deleteMutation.mutate(table.id);
                    }
                  }}
                  className="h-8 w-8 rounded-full border-border/60 bg-background/50 hover:bg-rose-50 hover:text-rose-600 transition-all shadow-sm"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
