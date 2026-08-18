"use client";

import { useState, useMemo, useCallback, FormEvent, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Loader2, ArrowLeft, Phone, User, Clock, CheckCircle2, XCircle, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  createHospitalityReservation,
  updateHospitalityReservation,
  fetchHospitalityTables,
} from "@/modules/hospitality/api";
import type { HospitalityReservation, HospitalityLocation } from "@/modules/hospitality/types";
import { cn } from "@/lib/utils";
import { DataTable } from "@/components/datatable/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import api from "@/modules/shared/api/http";
import { initEcho } from "@/lib/echo";
import { getAccessToken, getTenantId } from "@/lib/runtime-context";
import { notifyBulkDeleteOutcomes, notifyMutationOutcome } from "@/modules/workflow/utils/mutation-outcome";

export default function ReservationsPage() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<HospitalityReservation | null>(null);

  // Real-time updates from public reservation events via Laravel Echo / Reverb
  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = getAccessToken();
    const tenantId = getTenantId();
    if (!token || !tenantId) return;

    try {
      const echo = initEcho(token);
      const channelName = `dashboard.${tenantId.toLowerCase()}`;
      const channel = echo.private(channelName);
      
      channel.listen('.activity.logged', (e: { activity?: { subject_type?: string; causer?: string } }) => {
        const activity = e.activity;
        if (activity && activity.subject_type === 'Reservation') {
          queryClient.invalidateQueries({ queryKey: ["hospitality", "reservations"] });
          toast.info(`New reservation request from ${activity.causer || 'Guest'} received in real time!`);
        }
      });

      return () => {
        echo.leaveChannel(channelName);
      };
    } catch (err) {
      console.error("WS-DEBUG: [ERROR] Echo crashed:", err);
    }
  }, [queryClient]);

  // Customer Selection State
  const [isCustomerPopoverOpen, setIsCustomerPopoverOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  
  const [newCustomerData, setNewCustomerData] = useState({
    name: "",
    phone: "",
    email: "",
    tier: "none",
  });

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(customerSearch), 300);
    return () => clearTimeout(timer);
  }, [customerSearch]);

  const { data: customerSearchResults = [], isLoading: isLoadingCustomerSearch } = useQuery({
    queryKey: ["hospitality", "customers-search", debouncedSearch],
    queryFn: async () => {
      const res = await api.get("/hospitality/customers", { 
        params: { search: debouncedSearch, per_page: 20 } 
      });
      return res.data?.data || [];
    },
    enabled: isDialogOpen && !isCreatingCustomer,
  });

  const createCustomerMutation = useMutation({
    mutationFn: (payload: any) => api.post("/hospitality/customers", payload),
    onSuccess: (res) => {
      const newCustomer = res.data;
      queryClient.invalidateQueries({ queryKey: ["hospitality", "customers-search"] });
      toast.success("Customer profile created!");
      
      // Select the new customer for the reservation
      setFormData(prev => ({
        ...prev,
        customer_profile_id: String(newCustomer.id),
        customer_name: newCustomer.name,
        customer_phone: newCustomer.phone || "",
      }));
      
      setIsCreatingCustomer(false);
      setNewCustomerData({ name: "", phone: "", email: "", tier: "none" });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to create customer");
    },
  });

  // DataTable State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortCol, setSortCol] = useState<string>("reservation_time");
  const [sortDir, setSortDir] = useState<string>("desc");
  const [tableKey, setTableKey] = useState(0);

  const [formData, setFormData] = useState({
    customer_profile_id: "",
    customer_name: "",
    customer_phone: "",
    guest_count: "2",
    reservation_time: new Date().toISOString().slice(0, 16),
    location_id: "",
    status: "pending",
    special_requests: "",
    expected_spend: "0",
  });

  // Fetch paginated reservations
  const { data: reservationsData, isLoading: isLoadingReservations, isFetching } = useQuery({
    queryKey: ["hospitality", "reservations", page, pageSize, search, statusFilter, sortCol, sortDir],
    queryFn: async () => {
      const params: Record<string, any> = {
        page,
        per_page: pageSize,
      };
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== "all") params.status = statusFilter;
      
      const res = await api.get("/hospitality/reservations", { params });
      return {
        rows: res.data?.data || [],
        total: res.data?.meta?.total || res.data?.total || 0,
      };
    },
    placeholderData: (prev) => prev,
  });

  // Fetch tables to assign
  const { data: tables = [] } = useQuery<HospitalityLocation[]>({
    queryKey: ["hospitality", "tables"],
    queryFn: () => fetchHospitalityTables(),
  });

  const createMutation = useMutation({
    mutationFn: createHospitalityReservation,
    onSuccess: (data) => {
      notifyMutationOutcome(data, {
        savedMessage: "Reservation booked successfully",
        submittedMessage: "Submitted for approval.",
        queryClient,
      });
      queryClient.invalidateQueries({ queryKey: ["hospitality", "reservations"] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to create reservation");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) =>
      updateHospitalityReservation(id, payload),
    onSuccess: (data) => {
      notifyMutationOutcome(data, {
        savedMessage: "Reservation details updated",
        submittedMessage: "Submitted for approval.",
        queryClient,
      });
      queryClient.invalidateQueries({ queryKey: ["hospitality", "reservations"] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to update reservation");
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      updateHospitalityReservation(id, { status }),
    onSuccess: (data, variables) => {
      notifyMutationOutcome(data, {
        savedMessage: `Reservation status set to ${variables.status}`,
        submittedMessage: "Submitted for approval.",
        queryClient,
      });
      queryClient.invalidateQueries({ queryKey: ["hospitality", "reservations"] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to update status");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => (await api.delete(`/hospitality/reservations/${id}`)).data,
    onSuccess: (data) => {
      notifyMutationOutcome(data, {
        savedMessage: "Reservation deleted.",
        submittedMessage: "Submitted for approval.",
        queryClient,
      });
      queryClient.invalidateQueries({ queryKey: ["hospitality", "reservations"] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to delete reservation");
    },
  });

  const resetForm = () => {
    setEditingReservation(null);
    setFormData({
      customer_profile_id: "",
      customer_name: "",
      customer_phone: "",
      guest_count: "2",
      reservation_time: new Date().toISOString().slice(0, 16),
      location_id: "",
      status: "pending",
      special_requests: "",
      expected_spend: "0",
    });
    setIsCreatingCustomer(false);
    setCustomerSearch("");
  };

  const openEditDialog = (res: HospitalityReservation) => {
    setEditingReservation(res);
    setFormData({
      customer_profile_id: res.customer_profile_id ? String(res.customer_profile_id) : "",
      customer_name: res.customer_name,
      customer_phone: res.customer_phone || "",
      guest_count: String(res.guest_count),
      reservation_time: res.reservation_time ? res.reservation_time.slice(0, 16) : new Date().toISOString().slice(0, 16),
      location_id: res.location_id ? String(res.location_id) : "",
      status: res.status,
      special_requests: res.special_requests || "",
      expected_spend: String(res.expected_spend || 0),
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      customer_profile_id: formData.customer_profile_id ? Number(formData.customer_profile_id) : null,
      guest_count: Number(formData.guest_count),
      expected_spend: Number(formData.expected_spend),
      location_id: formData.location_id ? Number(formData.location_id) : null,
      reservation_time: formData.reservation_time.replace("T", " ") + ":00",
    };

    if (editingReservation) {
      updateMutation.mutate({ id: editingReservation.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const statusColors: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    confirmed: "bg-emerald-100 text-emerald-700 border-emerald-200",
    cancelled: "bg-rose-100 text-rose-700 border-rose-200",
    completed: "bg-blue-100 text-blue-700 border-blue-200",
  };

  const handleQueryChange = useCallback((q: any) => {
    if (q.page !== undefined) setPage(q.page);
    if (q.pageSize !== undefined) setPageSize(q.pageSize);
    if (q.search !== undefined) {
      setSearch(prev => {
        if (prev !== q.search) {
          setPage(1);
        }
        return q.search;
      });
    }
    if (q.sortCol) setSortCol(q.sortCol);
    if (q.sortDir) setSortDir(q.sortDir);
  }, []);

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["hospitality", "reservations"] });
  }, [queryClient]);

  const resetFilters = useCallback(() => {
    setSearch("");
    setStatusFilter("all");
    setPage(1);
    setTableKey(prev => prev + 1);
  }, []);

  const handleDeleteRows = useCallback(async (rows: HospitalityReservation[]) => {
    try {
      const results = await Promise.all(rows.map((row) => deleteMutation.mutateAsync(row.id)));
      notifyBulkDeleteOutcomes(results, {
        savedMessage: (count) => `${count} reservation(s) deleted.`,
        submittedMessage: "Submitted for approval.",
        queryClient,
      });
    } catch {
      toast.error("An error occurred during deletion.");
    }
  }, [deleteMutation, queryClient]);

  const columns = useMemo<ColumnDef<HospitalityReservation>[]>(() => [
    {
      id: "code_customer",
      header: "Code & Customer",
      accessorKey: "customer_name",
      cell: ({ row }) => {
        const res = row.original;
        return (
          <div className="py-1">
            <div className="font-bold flex items-center gap-1.5 text-indigo-500 text-xs">
              {res.reservation_code || `#RES-${res.id}`}
            </div>
            <div className="font-semibold text-foreground flex items-center gap-1.5 mt-1 text-sm">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              {res.customer_name}
            </div>
          </div>
        );
      }
    },
    {
      id: "party_details",
      header: "Party Details",
      accessorKey: "guest_count",
      cell: ({ row }) => {
        const res = row.original;
        return (
          <div className="py-1">
            <div className="text-sm font-semibold">{res.guest_count} guests</div>
            {res.customer_phone && (
              <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {res.customer_phone}
              </div>
            )}
          </div>
        );
      }
    },
    {
      id: "scheduled_time",
      header: "Scheduled Time",
      accessorKey: "reservation_time",
      cell: ({ row }) => {
        const res = row.original;
        const resTime = new Date(res.reservation_time).toLocaleString(undefined, {
          weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        return (
          <div className="text-sm font-semibold flex items-center gap-1.5 py-1">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            {resTime}
          </div>
        );
      }
    },
    {
      id: "assigned_table",
      header: "Assigned Table",
      accessorFn: (row) => row.location?.label || "No Seating",
      cell: ({ row }) => {
        const res = row.original;
        return res.location ? (
          <Badge variant="secondary" className="font-semibold gap-1 bg-indigo-50 text-indigo-700 border-indigo-100 border py-0.5">
            <UtensilsCrossed className="h-3.5 w-3.5" />
            {res.location.label}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground italic">No seating assigned</span>
        );
      }
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "status",
      cell: ({ row }) => {
        const res = row.original;
        return (
          <Badge variant="outline" className={cn("capitalize font-black border text-[11px] tracking-wider rounded-full py-0.5", statusColors[res.status])}>
            {res.status}
          </Badge>
        );
      }
    },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      meta: { align: "right" },
      cell: ({ row }) => {
        const res = row.original;
        return (
          <div className="flex items-center justify-end gap-2">
            {res.status === "pending" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateStatusMutation.mutate({ id: res.id, status: "confirmed" })}
                disabled={updateStatusMutation.isPending}
                className="h-8 text-[11px] font-black uppercase tracking-widest text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 rounded-lg"
              >
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                Confirm
              </Button>
            )}
            {res.status === "confirmed" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateStatusMutation.mutate({ id: res.id, status: "completed" })}
                disabled={updateStatusMutation.isPending}
                className="h-8 text-[11px] font-black uppercase tracking-widest text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-lg"
              >
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                Seat Guest
              </Button>
            )}
            {res.status !== "cancelled" && res.status !== "completed" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateStatusMutation.mutate({ id: res.id, status: "cancelled" })}
                disabled={updateStatusMutation.isPending}
                className="h-8 text-[11px] font-black uppercase tracking-widest text-rose-600 border-rose-200 bg-rose-50 hover:bg-rose-100 rounded-lg"
              >
                <XCircle className="mr-1 h-3.5 w-3.5" />
                Cancel
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => openEditDialog(res)}
              className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded-full"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        );
      }
    }
  ], [updateStatusMutation.isPending]);

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
            <h1 className="text-3xl font-black tracking-tight">Reservations Queue</h1>
          </div>
          <p className="text-muted-foreground font-medium">
            Review booked guests, schedule VIP layouts, and check arrivals.
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          if (!open) resetForm();
          setIsDialogOpen(open);
        }}>
          <DialogTrigger asChild>
            <Button className="rounded-full px-6 shadow-xl shadow-primary/20">
              <Plus className="mr-2 h-4 w-4" />
              New Reservation
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[550px] rounded-[2rem] border border-border/50">
            {isCreatingCustomer ? (
              <div className="space-y-4">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setIsCreatingCustomer(false)}>
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    Quick Create Customer
                  </DialogTitle>
                  <DialogDescription>
                    Create a new CRM profile to link to this reservation.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4 py-4">
                  <div className="space-y-2 col-span-2">
                    <Label>Full Name *</Label>
                    <Input 
                      value={newCustomerData.name} 
                      onChange={e => setNewCustomerData({...newCustomerData, name: e.target.value})} 
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number *</Label>
                    <Input 
                      value={newCustomerData.phone} 
                      onChange={e => setNewCustomerData({...newCustomerData, phone: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input 
                      type="email"
                      value={newCustomerData.email} 
                      onChange={e => setNewCustomerData({...newCustomerData, email: e.target.value})} 
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreatingCustomer(false)}>Cancel</Button>
                  <Button 
                    disabled={!newCustomerData.name || !newCustomerData.phone || createCustomerMutation.isPending}
                    onClick={() => createCustomerMutation.mutate(newCustomerData)}
                  >
                    {createCustomerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create & Select
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <>
            <DialogHeader>
              <DialogTitle>{editingReservation ? "Edit Reservation Details" : "Book New Reservation"}</DialogTitle>
              <DialogDescription>
                Fill out the customer information and assign them to an available table.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label>CRM Customer Profile *</Label>
                  <Popover open={isCustomerPopoverOpen} onOpenChange={setIsCustomerPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={isCustomerPopoverOpen}
                        className={cn(
                          "w-full justify-between font-normal bg-background/50 hover:bg-background/80 transition-colors border-border/50",
                          !formData.customer_profile_id && "text-muted-foreground"
                        )}
                      >
                        {formData.customer_profile_id
                          ? customerSearchResults.find((c: any) => String(c.id) === formData.customer_profile_id)?.name 
                            || formData.customer_name 
                            || "Select customer..."
                          : "Select CRM customer..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[450px] p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput 
                          placeholder="Search CRM customers by name or phone..." 
                          value={customerSearch}
                          onValueChange={setCustomerSearch}
                        />
                        <CommandList>
                          <CommandEmpty className="py-6 text-center text-sm">
                            {isLoadingCustomerSearch ? (
                              <div className="flex items-center justify-center text-muted-foreground">
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Searching CRM...
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-3">
                                <p className="text-muted-foreground">No customer found.</p>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => {
                                    setNewCustomerData(prev => ({ ...prev, name: customerSearch }));
                                    setIsCustomerPopoverOpen(false);
                                    setIsCreatingCustomer(true);
                                  }}
                                >
                                  <Plus className="mr-2 h-4 w-4" />
                                  Create "{customerSearch}" in CRM
                                </Button>
                              </div>
                            )}
                          </CommandEmpty>
                          <CommandGroup>
                            {customerSearchResults.map((customer: any) => (
                              <CommandItem
                                key={customer.id}
                                value={customer.name}
                                onSelect={() => {
                                  setFormData(prev => ({ 
                                    ...prev, 
                                    customer_profile_id: String(customer.id),
                                    customer_name: customer.name,
                                    customer_phone: customer.phone || "",
                                  }));
                                  setIsCustomerPopoverOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    formData.customer_profile_id === String(customer.id) ? "opacity-100 text-indigo-500" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span className="font-medium">{customer.name}</span>
                                  <span className="text-xs text-muted-foreground">{customer.phone} • Tier: {customer.tier || "Standard"}</span>
                                </div>
                              </CommandItem>
                            ))}
                            {customerSearchResults.length > 0 && (
                              <CommandItem
                                onSelect={() => {
                                  setNewCustomerData(prev => ({ ...prev, name: customerSearch }));
                                  setIsCustomerPopoverOpen(false);
                                  setIsCreatingCustomer(true);
                                }}
                                className="border-t mt-2 pt-2 text-indigo-500 justify-center font-medium cursor-pointer"
                              >
                                <Plus className="mr-2 h-4 w-4" />
                                Create New Customer Profile
                              </CommandItem>
                            )}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <p className="text-[11px] text-muted-foreground mt-1">Linking a CRM profile automatically sets the name and phone.</p>
                </div>
                
                {/* We still keep these inputs but make them readonly if a profile is linked, or keep them editable? 
                    Better to keep them editable in case they want to adjust just for this booking, 
                    but default to profile data. */}
                <div className="space-y-2">
                  <Label htmlFor="customer_name">Reservation Name *</Label>
                  <Input
                    id="customer_name"
                    required
                    value={formData.customer_name}
                    onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customer_phone">Phone Number</Label>
                  <Input
                    id="customer_phone"
                    value={formData.customer_phone}
                    onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="guest_count">Party Size (Guests) *</Label>
                  <Input
                    id="guest_count"
                    type="number"
                    min="1"
                    required
                    value={formData.guest_count}
                    onChange={(e) => setFormData({ ...formData, guest_count: e.target.value })}
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="reservation_time">Date & Time *</Label>
                  <Input
                    id="reservation_time"
                    type="datetime-local"
                    required
                    value={formData.reservation_time}
                    onChange={(e) => setFormData({ ...formData, reservation_time: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location_id">Assigned Table / Sofa</Label>
                  <Select
                    value={formData.location_id}
                    onValueChange={(val) => setFormData({ ...formData, location_id: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Table" />
                    </SelectTrigger>
                    <SelectContent>
                      {tables.map((table: HospitalityLocation) => (
                        <SelectItem key={table.id} value={String(table.id)}>
                          {table.label} ({table.zone?.name || "No Zone"} - Cap: {table.capacity})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Reservation Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(val: any) => setFormData({ ...formData, status: val })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending Approval</SelectItem>
                      <SelectItem value="confirmed">Confirmed / Booked</SelectItem>
                      <SelectItem value="completed">Completed (Seated/Left)</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="expected_spend">Expected Spend (ETB)</Label>
                  <Input
                    id="expected_spend"
                    type="number"
                    min="0"
                    value={formData.expected_spend}
                    onChange={(e) => setFormData({ ...formData, expected_spend: e.target.value })}
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="special_requests">Special Requests / Notes</Label>
                  <Textarea
                    id="special_requests"
                    placeholder="Allergies, VIP considerations, cake request, window table..."
                    value={formData.special_requests}
                    onChange={(e) => setFormData({ ...formData, special_requests: e.target.value })}
                    rows={3}
                  />
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
                  {editingReservation ? "Save Booking" : "Confirm Booking"}
                </Button>
              </DialogFooter>
            </form>
            </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter Toolbar & DataTable */}
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center bg-card/40 border border-border/40 p-4 rounded-[1.5rem] backdrop-blur-sm px-6">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest text-xs">Filter Status:</span>
            <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }}>
              <SelectTrigger className="w-[180px] rounded-full bg-background/50 border-border/40 h-10">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Bookings</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DataTable
          key={tableKey}
          columns={columns}
          data={reservationsData?.rows || []}
          totalEntries={reservationsData?.total || 0}
          loading={isLoadingReservations || isFetching}
          pageIndex={page}
          pageSize={pageSize}
          onQueryChange={handleQueryChange}
          onRefresh={handleRefresh}
          onResetFilters={resetFilters}
          onDeleteRows={handleDeleteRows}
          searchPlaceholder="Search bookings by name, phone, or code..."
          enableRowSelection={true}
          syncWithUrl={true}
        />
      </div>
    </div>
  );
}
