"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Plus, Pencil, Trash2, Loader2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

import {
  createHospitalityStaffShift,
  updateHospitalityStaffShift,
  deleteHospitalityStaffShift,
} from "@/modules/hospitality/api";
import api from "@/modules/shared/api/http";
import type { HospitalityStaffShift } from "@/modules/hospitality/types";
import { DataTable } from "@/components/datatable/data-table";
import type { ColumnDef } from "@tanstack/react-table";

const roleColors: Record<string, string> = {
  manager: "bg-purple-100 text-purple-700 border-purple-200",
  host: "bg-blue-100 text-blue-700 border-blue-200",
  waiter: "bg-emerald-100 text-emerald-700 border-emerald-200",
  bartender: "bg-orange-100 text-orange-700 border-orange-200",
  chef: "bg-red-100 text-red-700 border-red-200",
  security: "bg-slate-800 text-slate-100 border-slate-900",
  other: "bg-gray-100 text-gray-700 border-gray-200",
};

export default function StaffShiftsPage() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<HospitalityStaffShift | null>(null);
  const [comboboxOpen, setComboboxOpen] = useState(false);

  // DataTable State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortCol, setSortCol] = useState<string>("shift_date");
  const [sortDir, setSortDir] = useState<string>("desc");
  const [tableKey, setTableKey] = useState(0);

  const [formData, setFormData] = useState({
    staff_id: "",
    shift_date: new Date().toISOString().split("T")[0],
    start_at: "",
    end_at: "",
    zone: "",
    role: "waiter",
    is_confirmed: false,
    notes: "",
  });

  // Fetch shifts via paginated API
  const { data: shiftsData, isLoading: isLoadingShifts, isFetching } = useQuery({
    queryKey: ["hospitality", "staff-shifts", page, pageSize, search, roleFilter, statusFilter, sortCol, sortDir],
    queryFn: async () => {
      const params: Record<string, any> = {
        page,
        per_page: pageSize,
      };
      if (search.trim()) params.search = search.trim();
      if (roleFilter !== "all") params.role = roleFilter;
      if (statusFilter !== "all") params.is_confirmed = statusFilter === "confirmed";
      if (sortCol) {
        params.sort_col = sortCol;
        params.sort_dir = sortDir;
      }

      const res = await api.get("/hospitality/staff-shifts", { params });
      return {
        rows: res.data?.data || [],
        total: res.data?.meta?.total || res.data?.total || 0,
      };
    },
    placeholderData: (prev) => prev,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["identity", "users", "staff-page"],
    queryFn: async () => {
      const res = await api.get("/directory/users");
      return Array.isArray(res.data) ? res.data : (res.data.data || []);
    },
  });

  const { data: allShifts = [] } = useQuery({
    queryKey: ["hospitality", "all-shifts-staff"],
    queryFn: async () => {
      const res = await api.get("/hospitality/staff-shifts", { params: { per_page: 1000 } });
      return res.data?.data || [];
    },
  });

  const availableStaff = useMemo(() => {
    const assignedIds = new Set(allShifts.map((s: any) => String(s.staff_id)));
    return users.filter((u: any) => {
      // If editing a shift and this user is the selected staff, always show
      if (editingShift && String(u.id) === formData.staff_id) return true;
      
      // The user expects anyone they "registered" (created a shift for) to disappear from the dropdown
      return !assignedIds.has(String(u.id));
    });
  }, [users, editingShift, formData.staff_id, allShifts]);

  const createMutation = useMutation({
    mutationFn: createHospitalityStaffShift,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hospitality", "staff-shifts"] });
      queryClient.invalidateQueries({ queryKey: ["hospitality", "all-shifts-staff"] });
      toast.success("Shift created successfully");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to create shift");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) =>
      updateHospitalityStaffShift(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hospitality", "staff-shifts"] });
      queryClient.invalidateQueries({ queryKey: ["hospitality", "all-shifts-staff"] });
      toast.success("Shift updated successfully");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to update shift");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteHospitalityStaffShift,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hospitality", "staff-shifts"] });
      queryClient.invalidateQueries({ queryKey: ["hospitality", "all-shifts-staff"] });
      toast.success("Shift deleted");
    },
    onError: (error: any) => {
      toast.error("Failed to delete shift");
    },
  });

  const resetForm = () => {
    setEditingShift(null);
    setFormData({
      staff_id: "",
      shift_date: new Date().toISOString().split("T")[0],
      start_at: "",
      end_at: "",
      zone: "",
      role: "waiter",
      is_confirmed: false,
      notes: "",
    });
  };

  const openEditDialog = useCallback((shift: HospitalityStaffShift) => {
    setEditingShift(shift);
    setFormData({
      staff_id: String(shift.staff_id),
      shift_date: shift.shift_date.split("T")[0],
      start_at: shift.start_at.substring(11, 16),
      end_at: shift.end_at.substring(11, 16),
      zone: shift.zone || "",
      role: shift.role || "waiter",
      is_confirmed: shift.is_confirmed,
      notes: shift.notes || "",
    });
    setIsDialogOpen(true);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      staff_id: Number(formData.staff_id),
      start_at: `${formData.shift_date} ${formData.start_at}:00`,
      end_at: `${formData.shift_date} ${formData.end_at}:00`,
    };

    if (editingShift) {
      updateMutation.mutate({ id: editingShift.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleQueryChange = useCallback((q: any) => {
    if (q.page !== undefined) setPage(q.page);
    if (q.pageSize !== undefined) setPageSize(q.pageSize);
    if (q.search !== undefined) {
      setSearch((prev) => {
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
    queryClient.invalidateQueries({ queryKey: ["hospitality", "staff-shifts"] });
    queryClient.invalidateQueries({ queryKey: ["hospitality", "all-shifts-staff"] });
  }, [queryClient]);

  const resetFilters = useCallback(() => {
    setSearch("");
    setRoleFilter("all");
    setStatusFilter("all");
    setPage(1);
    setTableKey((prev) => prev + 1);
  }, []);

  const handleDeleteRows = useCallback(async (rows: HospitalityStaffShift[]) => {
    try {
      await Promise.all(rows.map((row) => deleteMutation.mutateAsync(row.id)));
      toast.success(`${rows.length} shift(s) deleted.`);
    } catch {
      toast.error("An error occurred during deletion.");
    }
  }, [deleteMutation]);

  const columns = useMemo<ColumnDef<HospitalityStaffShift>[]>(() => [
    {
      id: "staff_member",
      header: "Staff Member",
      accessorFn: (row) => row.staff?.name || "Unknown Staff",
      cell: ({ row }) => {
        const shift = row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold border border-indigo-200">
              {shift.staff?.name?.charAt(0) || "U"}
            </div>
            <div>
              <div className="font-semibold text-foreground text-sm">{shift.staff?.name || "Unknown Staff"}</div>
              <div className="text-xs text-muted-foreground">{shift.staff?.email}</div>
            </div>
          </div>
        );
      }
    },
    {
      id: "shift_date",
      header: "Date",
      accessorKey: "shift_date",
      cell: ({ row }) => {
        const shift = row.original;
        const shiftDate = new Date(shift.shift_date).toLocaleDateString(undefined, {
          weekday: "short", month: "short", day: "numeric"
        });
        return (
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            {shiftDate}
          </div>
        );
      }
    },
    {
      id: "shift_time",
      header: "Time",
      accessorFn: (row) => `${row.start_at} - ${row.end_at}`,
      cell: ({ row }) => {
        const shift = row.original;
        const startTime = new Date(shift.start_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const endTime = new Date(shift.end_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        return (
          <div className="text-sm font-semibold text-foreground">
            {startTime} - {endTime}
          </div>
        );
      }
    },
    {
      id: "role_zone",
      header: "Role & Zone",
      accessorKey: "role",
      cell: ({ row }) => {
        const shift = row.original;
        return (
          <div className="flex flex-col gap-1 items-start">
            <Badge variant="secondary" className={`capitalize font-black border text-[11px] tracking-wider rounded-full py-0.5 px-2 ${roleColors[shift.role || "other"]}`}>
              {shift.role || "Other"}
            </Badge>
            {shift.zone && (
              <span className="text-xs text-muted-foreground font-medium">Zone: {shift.zone}</span>
            )}
          </div>
        );
      }
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "is_confirmed",
      cell: ({ row }) => {
        const shift = row.original;
        return shift.is_confirmed ? (
          <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600 rounded-full font-bold text-[11px] tracking-wider py-0.5 px-2">
            Confirmed
          </Badge>
        ) : (
          <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-200 rounded-full border border-amber-200 font-bold text-[11px] tracking-wider py-0.5 px-2">
            Pending
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
        const shift = row.original;
        return (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => openEditDialog(shift)}
              className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded-full"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (confirm("Are you sure you want to delete this shift?")) {
                  deleteMutation.mutate(shift.id);
                }
              }}
              className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-full"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      }
    }
  ], [openEditDialog, deleteMutation]);

  const exportUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (roleFilter !== "all") params.set("role", roleFilter);
    if (statusFilter !== "all") {
      params.set("is_confirmed", statusFilter === "confirmed" ? "true" : "false");
    }
    params.set("sortCol", sortCol);
    params.set("sortDir", sortDir);
    return `/hospitality/staff-shifts/export?${params.toString()}`;
  }, [search, roleFilter, statusFilter, sortCol, sortDir]);

  return (
    <div className="space-y-8 p-6 pb-20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
            <Users className="h-8 w-8 text-indigo-500" />
            Staff Shifts
          </h1>
          <p className="text-muted-foreground">Manage your team's schedule and zone assignments.</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          if (!open) resetForm();
          setIsDialogOpen(open);
        }}>
          <DialogTrigger asChild>
            <Button className="rounded-full px-6 shadow-xl shadow-primary/20">
              <Plus className="mr-2 h-4 w-4" />
              Schedule Shift
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingShift ? "Edit Shift" : "Schedule New Shift"}</DialogTitle>
              <DialogDescription>
                Assign a staff member to a shift and a service zone.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="staff_id">Staff Member *</Label>
                  <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={comboboxOpen}
                        className="w-full justify-between"
                      >
                        {formData.staff_id
                          ? users.find((u: any) => String(u.id) === formData.staff_id)?.name || "Unknown Staff"
                          : "Select staff member..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[450px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search by name or email..." />
                        <CommandList>
                          <CommandEmpty>No staff member found.</CommandEmpty>
                          <CommandGroup>
                            {availableStaff.map((u: any) => (
                              <CommandItem
                                key={u.id}
                                value={`${u.name} ${u.email}`}
                                onSelect={() => {
                                  setFormData({ ...formData, staff_id: String(u.id) });
                                  setComboboxOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    formData.staff_id === String(u.id) ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {u.name} ({u.email})
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="shift_date">Shift Date *</Label>
                  <Input
                    id="shift_date"
                    type="date"
                    required
                    value={formData.shift_date}
                    onChange={(e) => setFormData({ ...formData, shift_date: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="start_at">Start Time *</Label>
                  <Input
                    id="start_at"
                    type="time"
                    required
                    value={formData.start_at}
                    onChange={(e) => setFormData({ ...formData, start_at: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_at">End Time *</Label>
                  <Input
                    id="end_at"
                    type="time"
                    required
                    value={formData.end_at}
                    onChange={(e) => setFormData({ ...formData, end_at: e.target.value })}
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="zone">Assigned Zone</Label>
                  <Input
                    id="zone"
                    type="text"
                    placeholder="e.g. Patio, Main Floor, VIP"
                    value={formData.zone}
                    onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="role">Shift Role</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(val) => setFormData({ ...formData, role: val })}
                  >
                    <SelectTrigger id="role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="host">Host</SelectItem>
                      <SelectItem value="waiter">Waiter</SelectItem>
                      <SelectItem value="bartender">Bartender</SelectItem>
                      <SelectItem value="chef">Chef</SelectItem>
                      <SelectItem value="security">Security</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="notes">Notes / Instructions</Label>
                  <Textarea
                    id="notes"
                    placeholder="Any special instructions for this shift..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                  />
                </div>

                {editingShift && (
                  <div className="space-y-2 col-span-2 flex items-center justify-between border-t pt-4">
                    <div>
                      <Label className="text-base">Confirm Shift</Label>
                      <p className="text-xs text-muted-foreground">Mark this shift as confirmed by the staff member.</p>
                    </div>
                    <Switch
                      checked={formData.is_confirmed}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_confirmed: checked })}
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="w-full"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingShift ? "Update Shift" : "Schedule Shift"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter Toolbar & DataTable */}
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center bg-card/40 border border-border/40 p-4 rounded-[1.5rem] backdrop-blur-sm px-6">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest text-xs">Filter Role:</span>
            <Select value={roleFilter} onValueChange={(val) => { setRoleFilter(val); setPage(1); }}>
              <SelectTrigger className="w-[180px] rounded-full bg-background/50 border-border/40 h-10">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="host">Host</SelectItem>
                <SelectItem value="waiter">Waiter</SelectItem>
                <SelectItem value="bartender">Bartender</SelectItem>
                <SelectItem value="chef">Chef</SelectItem>
                <SelectItem value="security">Security</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest text-xs">Filter Status:</span>
            <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }}>
              <SelectTrigger className="w-[180px] rounded-full bg-background/50 border-border/40 h-10">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Shifts</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DataTable
          key={tableKey}
          columns={columns}
          data={shiftsData?.rows || []}
          totalEntries={shiftsData?.total || 0}
          loading={isLoadingShifts || isFetching}
          pageIndex={page}
          pageSize={pageSize}
          onQueryChange={handleQueryChange}
          onRefresh={handleRefresh}
          onResetFilters={resetFilters}
          onDeleteRows={handleDeleteRows}
          searchPlaceholder="Search shifts by staff name, email, role or zone..."
          enableRowSelection={true}
          exportEndpoint={exportUrl}
          resourceName="staff shifts"
          syncWithUrl={true}
        />
      </div>
    </div>
  );
}
