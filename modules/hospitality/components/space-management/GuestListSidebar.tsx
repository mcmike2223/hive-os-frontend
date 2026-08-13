"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Users, 
  Search, 
  CheckCircle2, 
  Clock, 
  UserPlus, 
  X,
  SearchX
} from "lucide-react";
import { HospitalityGuestList } from "../../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const fetchGuestList = async (): Promise<HospitalityGuestList[]> => {
  const response = await fetch("/api/v1/hospitality/door/guest-list");
  if (!response.ok) throw new Error("Failed to fetch guest list");
  return response.json();
};

const checkInGuest = async ({ id, actual_arrived_count }: { id: number; actual_arrived_count: number }) => {
  const response = await fetch(`/api/v1/hospitality/door/check-in/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actual_arrived_count }),
  });
  if (!response.ok) throw new Error("Failed to check in guest");
  return response.json();
};

export default function GuestListSidebar() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: guests, isLoading } = useQuery({
    queryKey: ["hospitality", "guest-list"],
    queryFn: fetchGuestList,
  });

  const checkInMutation = useMutation({
    mutationFn: checkInGuest,
    onSuccess: (data) => {
      toast.success(data.message || "Guest checked in!");
      queryClient.invalidateQueries({ queryKey: ["hospitality", "guest-list"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to check in guest");
    }
  });

  const filteredGuests = guests?.filter(guest => 
    guest.guest_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    guest.promoter?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      {/* Toggle Button */}
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed right-0 top-1/2 -translate-y-1/2 rounded-l-[2rem] h-20 w-14 shadow-2xl z-40 bg-primary hover:bg-primary/90 flex flex-col items-center justify-center gap-1 group transition-all hover:w-16 border-y border-l border-white/10"
      >
        <Users className="h-6 w-6 text-primary-foreground group-hover:scale-110 transition-transform" />
        <span className="text-[11px] font-black uppercase tracking-tighter text-primary-foreground [writing-mode:vertical-lr] rotate-180">Guests</span>
      </Button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-background/40 backdrop-blur-md z-[50]"
            />

            {/* Sidebar */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-card border-l border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.3)] z-[51] flex flex-col"
            >
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-3xl font-black tracking-tighter flex items-center gap-3">
                      <Users className="h-8 w-8 text-primary" />
                      Guest List
                    </h3>
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                      {guests?.filter(g => g.status === 'pending').length || 0} Waiting • {guests?.filter(g => g.status === 'arrived').length || 0} Arrived
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="rounded-full h-12 w-12 hover:bg-white/5">
                    <X className="h-6 w-6" />
                  </Button>
                </div>

                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    placeholder="Search guest or promoter..."
                    className="pl-12 rounded-[1.5rem] bg-white/5 border-white/10 h-14 text-lg focus-visible:ring-primary/30 transition-all focus:bg-white/10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <ScrollArea className="flex-1 px-8">
                <div className="space-y-4 pb-10">
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 opacity-50">
                      <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                      <p className="mt-6 font-black uppercase text-[11px] tracking-[0.2em] animate-pulse">Retrieving List</p>
                    </div>
                  ) : filteredGuests?.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
                      <SearchX className="h-16 w-16 mb-4 text-muted-foreground/20" />
                      <p className="font-black uppercase text-[11px] tracking-[0.2em]">No Matches Found</p>
                    </div>
                  ) : (
                    filteredGuests?.map((guest) => (
                      <motion.div
                        key={guest.id}
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          "group relative rounded-[2rem] p-6 border transition-all duration-500",
                          guest.status === 'arrived' 
                            ? "bg-primary/10 border-primary/20" 
                            : "bg-white/5 border-white/5 hover:border-primary/40 hover:bg-white/10"
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-2">
                            <h4 className="font-black tracking-tight text-xl">{guest.guest_name}</h4>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="rounded-full text-[11px] font-black uppercase py-0.5 px-3 h-6 flex items-center gap-1.5 border-primary/30 text-primary bg-primary/5">
                                <Users className="h-3 w-3" />
                                {guest.expected_party_size} Guests
                              </Badge>
                              {guest.promoter && (
                                <div className="flex items-center gap-1.5 px-3 h-6 rounded-full bg-white/5 border border-white/5 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                  {guest.promoter.name}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {guest.status === 'arrived' ? (
                            <div className="h-12 w-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-[0_0_20px_rgba(var(--primary),0.4)]">
                              <CheckCircle2 className="h-7 w-7" />
                            </div>
                          ) : (
                            <Button 
                              className="rounded-2xl h-12 px-6 font-black text-[11px] uppercase tracking-widest shadow-xl transition-all hover:scale-105 active:scale-95"
                              onClick={() => {
                                const count = window.prompt(`Actual headcount for ${guest.guest_name}?`, guest.expected_party_size.toString());
                                if (count !== null) {
                                  const actualCount = parseInt(count);
                                  if (!isNaN(actualCount)) {
                                    checkInMutation.mutate({ 
                                      id: guest.id, 
                                      actual_arrived_count: actualCount 
                                    });
                                  } else {
                                    toast.error("Please enter a valid number");
                                  }
                                }
                              }}
                              disabled={checkInMutation.isPending}
                            >
                              Check In
                            </Button>
                          )}
                        </div>
                        
                        {guest.status === 'arrived' && (
                          <div className="mt-4 pt-4 border-t border-primary/10 text-[11px] font-black uppercase text-primary/70 tracking-[0.1em] flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5" />
                            Checked in with {guest.actual_arrived_count} people
                          </div>
                        )}
                      </motion.div>
                    ))
                  )}
                </div>
              </ScrollArea>
              
              <div className="p-8 border-t border-white/10 bg-white/5">
                <Button className="w-full rounded-[1.5rem] h-14 font-black uppercase tracking-[0.15em] gap-3 text-sm shadow-2xl hover:scale-[1.02] transition-transform">
                  <UserPlus className="h-5 w-5" />
                  Add Walk-in
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
