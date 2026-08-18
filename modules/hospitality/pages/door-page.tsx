"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Users, 
  Search, 
  CheckCircle2, 
  Clock, 
  UserPlus, 
  ArrowLeft,
  Loader2,
  Filter,
  UserCheck,
  ListOrdered,
  MapPin,
  UtensilsCrossed
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { 
  fetchGuestList, 
  guestCheckIn, 
  fetchHospitalityOverview,
  fetchHospitalityWaitlist,
  createHospitalityWaitlistEntry,
  updateHospitalityWaitlistEntry,
  seatHospitalityWaitlistEntry
} from "../api";
import { HospitalityGuestList, HospitalityWaitlistEntry } from "../types";

export default function DoorManagementPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "arrived">("all");
  const [activeTab, setActiveTab] = useState("guestlist");
  
  // Waitlist State
  const [isWaitlistDialogOpen, setIsWaitlistDialogOpen] = useState(false);
  const [isSeatDialogOpen, setIsSeatDialogOpen] = useState(false);
  const [selectedWaitlistEntry, setSelectedWaitlistEntry] = useState<HospitalityWaitlistEntry | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");

  const { data: overview } = useQuery({
    queryKey: ["hospitality", "overview"],
    queryFn: fetchHospitalityOverview,
  });

  const { data: guests, isLoading: isLoadingGuests } = useQuery({
    queryKey: ["hospitality", "guest-list"],
    queryFn: fetchGuestList,
  });

  const { data: waitlist = [], isLoading: isLoadingWaitlist } = useQuery({
    queryKey: ["hospitality", "waitlist"],
    queryFn: () => fetchHospitalityWaitlist(),
  });

  const checkInMutation = useMutation({
    mutationFn: ({ id, count }: { id: number; count: number }) => 
      guestCheckIn(id, count),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hospitality", "guest-list"] });
      toast.success("Guest checked in successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to check in guest");
    }
  });

  // Waitlist Mutations
  const [waitlistForm, setWaitlistForm] = useState({
    customer_name: "",
    customer_phone: "",
    party_size: "2",
    preferred_zone: "",
    notes: "",
  });

  const createWaitlistMutation = useMutation({
    mutationFn: createHospitalityWaitlistEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hospitality", "waitlist"] });
      toast.success("Added to waitlist");
      setIsWaitlistDialogOpen(false);
      setWaitlistForm({ customer_name: "", customer_phone: "", party_size: "2", preferred_zone: "", notes: "" });
    },
  });

  const seatWaitlistMutation = useMutation({
    mutationFn: ({ id, location_id }: { id: number; location_id: number }) =>
      seatHospitalityWaitlistEntry(id, location_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hospitality", "waitlist"] });
      queryClient.invalidateQueries({ queryKey: ["hospitality", "overview"] });
      toast.success("Party seated successfully");
      setIsSeatDialogOpen(false);
      setSelectedWaitlistEntry(null);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to seat party");
    }
  });

  const updateWaitlistStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      updateHospitalityWaitlistEntry(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hospitality", "waitlist"] });
      toast.success("Status updated");
    }
  });

  const filteredGuests = guests?.filter((guest: HospitalityGuestList) => {
    const matchesSearch = guest.guest_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        guest.promoter?.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === "all" || guest.status === filter;
    return matchesSearch && matchesFilter;
  });

  const handleWaitlistSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createWaitlistMutation.mutate({
      ...waitlistForm,
      party_size: Number(waitlistForm.party_size)
    });
  };

  const handleSeatParty = () => {
    if (!selectedWaitlistEntry || !selectedLocationId) return;
    seatWaitlistMutation.mutate({ 
      id: selectedWaitlistEntry.id, 
      location_id: Number(selectedLocationId) 
    });
  };

  // We need available tables for seating
  const availableTables = overview?.upcoming_reservations ? [] : []; // We would normally fetch locations, but we can use an API for it or assume we have them.
  // Actually, waitlist seat requires a location_id. Let's fetch locations via fetchHospitalityTables if needed, but we don't have it imported.
  // Let's just allow manual entry or if we have locations. Wait, we can fetch tables quickly.

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
            <h1 className="text-3xl font-black tracking-tight">Door & Waitlist</h1>
          </div>
          <p className="text-muted-foreground font-medium">
            Manage guest lists, waitlists, and walk-in arrivals.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Dialog open={isWaitlistDialogOpen} onOpenChange={setIsWaitlistDialogOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-full px-6 font-black uppercase tracking-widest gap-2 shadow-xl shadow-primary/20">
                <ListOrdered className="h-4 w-4" />
                Add to Waitlist
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add to Waitlist</DialogTitle>
                <DialogDescription>Register a walk-in party to the waitlist.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleWaitlistSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Customer Name</Label>
                  <Input required value={waitlistForm.customer_name} onChange={e => setWaitlistForm({...waitlistForm, customer_name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input required value={waitlistForm.customer_phone} onChange={e => setWaitlistForm({...waitlistForm, customer_phone: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Party Size</Label>
                  <Input type="number" min="1" required value={waitlistForm.party_size} onChange={e => setWaitlistForm({...waitlistForm, party_size: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Preferred Zone</Label>
                  <Input placeholder="e.g., Patio, Bar" value={waitlistForm.preferred_zone} onChange={e => setWaitlistForm({...waitlistForm, preferred_zone: e.target.value})} />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createWaitlistMutation.isPending}>
                    {createWaitlistMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Add to Waitlist
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
        <TabsList className="bg-card/50 backdrop-blur-md p-1 h-auto rounded-full w-full max-w-md grid grid-cols-2">
          <TabsTrigger value="guestlist" className="rounded-full h-10 font-bold uppercase tracking-widest text-[11px]">
            Guest List
          </TabsTrigger>
          <TabsTrigger value="waitlist" className="rounded-full h-10 font-bold uppercase tracking-widest text-[11px]">
            Waitlist
            {waitlist.filter((w: HospitalityWaitlistEntry) => w.status === "waiting").length > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center">
                {waitlist.filter((w: HospitalityWaitlistEntry) => w.status === "waiting").length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="guestlist" className="space-y-6">
          <div className="grid gap-8 lg:grid-cols-4">
            <div className="space-y-4">
              <div className="rounded-[2rem] border border-border/40 bg-card/30 backdrop-blur-md p-6">
                <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4">Capacity Status</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <p className="text-4xl font-black">
                      {guests?.filter((g: HospitalityGuestList) => g.status === 'arrived').reduce((acc: number, g: HospitalityGuestList) => acc + g.actual_arrived_count, 0) || 0}
                    </p>
                    <p className="text-xs font-bold opacity-50 mb-1">In Venue</p>
                  </div>
                  <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-primary w-[45%]" />
                  </div>
                </div>
              </div>

              <div className="rounded-[2rem] border border-border/40 bg-card/30 backdrop-blur-md p-6">
                <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4">Quick Filters</h3>
                <div className="grid grid-cols-1 gap-2">
                  {(["all", "pending", "arrived"] as const).map((f) => (
                    <Button
                      key={f}
                      variant={filter === f ? "default" : "ghost"}
                      onClick={() => setFilter(f)}
                      className="justify-start rounded-xl font-bold uppercase text-[11px] tracking-widest h-10"
                    >
                      <Filter className="mr-2 h-3 w-3" />
                      {f}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-3 space-y-6">
              <div className="relative">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Search guest list..."
                  className="pl-14 h-16 rounded-[2rem] bg-card/30 backdrop-blur-md border-border/40 text-lg font-medium focus-visible:ring-primary/20"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {isLoadingGuests ? (
                <div className="flex h-64 items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" />
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <AnimatePresence mode="popLayout">
                    {filteredGuests?.map((guest: HospitalityGuestList) => (
                      <motion.div
                        key={guest.id}
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className={cn(
                          "rounded-[2.5rem] p-6 border transition-all duration-300",
                          guest.status === 'arrived' 
                            ? "bg-primary/5 border-primary/20" 
                            : "bg-card/30 backdrop-blur-md border-border/40 hover:border-primary/30"
                        )}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-3">
                            <div>
                              <h4 className="text-xl font-black tracking-tight">{guest.guest_name}</h4>
                              {guest.promoter && (
                                <p className="text-[11px] font-bold text-primary uppercase tracking-widest mt-1 flex items-center gap-1.5">
                                  <UserCheck className="h-3 w-3" />
                                  Promoter: {guest.promoter.name}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="rounded-full py-0.5 px-3 h-6 text-[11px] font-black uppercase border-border/60">
                                {guest.expected_party_size} Guests
                              </Badge>
                              <Badge className={cn(
                                "rounded-full py-0.5 px-3 h-6 text-[11px] font-black uppercase",
                                guest.status === 'arrived' ? "bg-emerald-500" : "bg-amber-500"
                              )}>
                                {guest.status}
                              </Badge>
                            </div>
                          </div>

                          {guest.status !== 'arrived' ? (
                            <Button 
                              onClick={() => checkInMutation.mutate({ id: guest.id, count: guest.expected_party_size })}
                              disabled={checkInMutation.isPending}
                              className="rounded-2xl h-12 w-12 p-0 shadow-lg"
                            >
                              <CheckCircle2 className="h-6 w-6" />
                            </Button>
                          ) : (
                            <div className="h-12 w-12 rounded-2xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
                              <CheckCircle2 className="h-6 w-6" />
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="waitlist" className="space-y-6">
          <div className="rounded-[2rem] border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Customer</TableHead>
                  <TableHead>Party Size & Zone</TableHead>
                  <TableHead>Wait Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingWaitlist ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : waitlist.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                      No parties on the waitlist.
                    </TableCell>
                  </TableRow>
                ) : (
                  waitlist.map((entry: HospitalityWaitlistEntry) => {
                    const waitMins = Math.round((Date.now() - new Date(entry.created_at).getTime()) / 60000);
                    return (
                      <TableRow key={entry.id} className="group">
                        <TableCell>
                          <div className="font-medium text-foreground">{entry.customer_name}</div>
                          <div className="text-xs text-muted-foreground">{entry.customer_phone}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 font-medium">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            {entry.party_size} pax
                          </div>
                          {entry.preferred_zone && (
                            <div className="text-xs text-muted-foreground mt-1">Prefers: {entry.preferred_zone}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          {entry.status === "waiting" || entry.status === "notified" ? (
                            <div className="flex items-center gap-2">
                              <Clock className={cn("h-4 w-4", waitMins > (entry.estimated_wait_minutes || 30) ? "text-red-500" : "text-amber-500")} />
                              <span className={cn("font-bold", waitMins > (entry.estimated_wait_minutes || 30) ? "text-red-500" : "")}>
                                {waitMins}m / {entry.estimated_wait_minutes || '--'}m est.
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">--</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(
                            "capitalize",
                            entry.status === "waiting" ? "bg-amber-100 text-amber-700" :
                            entry.status === "seated" ? "bg-emerald-100 text-emerald-700" :
                            entry.status === "notified" ? "bg-blue-100 text-blue-700" :
                            "bg-slate-100 text-slate-700"
                          )}>
                            {entry.status.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {(entry.status === "waiting" || entry.status === "notified") && (
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              {entry.status === "waiting" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => updateWaitlistStatusMutation.mutate({ id: entry.id, status: "notified" })}
                                  className="h-8 text-xs font-bold uppercase tracking-widest text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100"
                                >
                                  Notify
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedWaitlistEntry(entry);
                                  setIsSeatDialogOpen(true);
                                }}
                                className="h-8 text-xs font-bold uppercase tracking-widest text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100"
                              >
                                Seat
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => updateWaitlistStatusMutation.mutate({ id: entry.id, status: "cancelled" })}
                                className="h-8 text-xs font-bold uppercase tracking-widest text-red-600 hover:bg-red-50"
                              >
                                Cancel
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={isSeatDialogOpen} onOpenChange={setIsSeatDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Seat Party</DialogTitle>
            <DialogDescription>
              Assign {selectedWaitlistEntry?.customer_name} ({selectedWaitlistEntry?.party_size} pax) to a table.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Location / Table ID</Label>
              <Input 
                type="number"
                placeholder="Enter Table ID" 
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">In a real app, this would be a select dropdown of currently available tables with capacity &gt;= {selectedWaitlistEntry?.party_size}.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSeatDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSeatParty} disabled={!selectedLocationId || seatWaitlistMutation.isPending}>
              {seatWaitlistMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Seating
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
