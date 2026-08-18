"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ReceiptText, Plus, Pencil, Trash2, Loader2, ArrowLeft, Search, Filter, MapPin, CalendarDays, Banknote, ClipboardList, PlusCircle, CheckCircle2, Play, ChevronRight, XCircle, FileText } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  fetchHospitalityServiceOrders,
  createHospitalityServiceOrder,
  updateHospitalityServiceOrder,
  fetchHospitalityTables,
  fetchHospitalityReservations,
  fetchHospitalityMenuItems,
} from "@/modules/hospitality/api";
import type { HospitalityServiceOrder, HospitalityLocation, HospitalityReservation, HospitalityMenuItem, HospitalityServiceOrderItem } from "@/modules/hospitality/types";
import { cn } from "@/lib/utils";
import InvoiceDialog from "@/modules/hospitality/components/invoice-dialog";
import OrderCoursingPanel from "@/modules/hospitality/components/order-coursing-panel";
import { DataTable } from "@/components/datatable/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import api from "@/modules/shared/api/http";
import { Checkbox } from "@/components/ui/checkbox";
import { notifyBulkDeleteOutcomes, notifyMutationOutcome } from "@/modules/workflow/utils/mutation-outcome";
import { usePermissions } from "@/hooks/use-permissions";

type PendingOrderItem = {
  menu_item_id: string;
  inventory_item_id: number | null;
  item_name: string;
  quantity: number;
  unit_price: number;
  is_comp: boolean;
  comp_reason: string | null;
};

export default function ServiceOrdersPage() {
  const queryClient = useQueryClient();
  const { hasAnyPermission, hasPermission } = usePermissions();
  const canCreateOrders = hasAnyPermission([
    "create_hospitality_service_orders",
    "manage_hospitality_service_orders",
  ]);
  const canEditOrders = hasAnyPermission([
    "edit_hospitality_service_orders",
    "manage_hospitality_service_orders",
  ]);
  const canDeleteOrders = hasPermission("manage_hospitality_service_orders");
  const canViewBilling = hasAnyPermission([
    "view_hospitality_billing",
    "manage_hospitality_billing",
  ]);
  const canProcessPayments = hasAnyPermission([
    "create_hospitality_billing",
    "manage_hospitality_billing",
  ]);
  const canExportOrders = hasAnyPermission([
    "export_hospitality_reports",
    "manage_hospitality_service_orders",
  ]);
  const canAddComps = hasPermission("comp_hospitality_service_orders");
  
  // DataTable State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortCol, setSortCol] = useState<string>("created_at");
  const [sortDir, setSortDir] = useState<string>("desc");
  const [tableKey, setTableKey] = useState(0);
  const [selectedRowIds, setSelectedRowIds] = useState<Record<string, boolean>>({});

  // Dialog controls
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<HospitalityServiceOrder | null>(null);

  // Create Form State
  const [createForm, setCreateForm] = useState({
    location_id: "",
    reservation_id: "",
    notes: "",
    status: "pending",
  });
  
  // Adding items state
  const [pendingItems, setPendingItems] = useState<PendingOrderItem[]>([]);
  const [selectedMenuItemId, setSelectedMenuItemId] = useState("");
  const [itemQuantity, setItemQuantity] = useState("1");
  const [itemIsComp, setItemIsComp] = useState(false);
  const [itemCompReason, setItemCompReason] = useState("marketing");

  // Edit Form State (for detail view)
  const [editForm, setEditForm] = useState({
    status: "pending",
    notes: "",
  });

  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [invoiceOrder, setInvoiceOrder] = useState<HospitalityServiceOrder | null>(null);

  const openInvoiceDialog = (order: HospitalityServiceOrder) => {
    setInvoiceOrder(order);
    setIsInvoiceDialogOpen(true);
  };

  // Fetch paginated service orders
  const { data: ordersData, isLoading: isLoadingOrders, isFetching } = useQuery({
    queryKey: ["hospitality", "service-orders", page, pageSize, search, statusFilter, sortCol, sortDir],
    queryFn: async () => {
      const params: Record<string, any> = {
        page,
        per_page: pageSize,
        sortCol,
        sortDir,
      };
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== "all") params.status = statusFilter;

      const res = await api.get("/hospitality/service-orders", { params });
      return {
        rows: res.data?.data || [],
        total: res.data?.meta?.total || res.data?.total || 0,
      };
    },
    placeholderData: (prev) => prev,
  });

  // selectedOrder is a snapshot taken when the row was clicked, so coursing and
  // transfers would keep rendering stale seats and held badges after they
  // succeed. Read the live row back out of the refreshed list instead, falling
  // back to the snapshot while a refetch is in flight.
  const liveSelectedOrder = useMemo(() => {
    if (!selectedOrder) return null;

    return (
      (ordersData?.rows as HospitalityServiceOrder[] | undefined)?.find(
        (row) => row.id === selectedOrder.id,
      ) ?? selectedOrder
    );
  }, [ordersData, selectedOrder]);

  const refreshSelectedOrder = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["hospitality", "service-orders"] });
  }, [queryClient]);

  // Fetch tables
  const { data: tables = [] } = useQuery<HospitalityLocation[]>({
    queryKey: ["hospitality", "tables"],
    queryFn: () => fetchHospitalityTables(),
  });

  // Fetch active reservations
  const { data: reservations = [] } = useQuery<HospitalityReservation[]>({
    queryKey: ["hospitality", "reservations"],
    queryFn: () => fetchHospitalityReservations({ status: "confirmed" }),
  });

  // Fetch menu items for ordering
  const { data: menuItems = [] } = useQuery<HospitalityMenuItem[]>({
    queryKey: ["hospitality", "menu-items"],
    queryFn: () => fetchHospitalityMenuItems({ is_available: true }),
  });

  const createMutation = useMutation({
    mutationFn: createHospitalityServiceOrder,
    onSuccess: (data) => {
      notifyMutationOutcome(data, {
        savedMessage: "Service order placed successfully",
        submittedMessage: "Submitted for approval.",
        queryClient,
      });
      queryClient.invalidateQueries({ queryKey: ["hospitality", "service-orders"] });
      setIsCreateDialogOpen(false);
      resetCreateForm();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to place service order");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) =>
      updateHospitalityServiceOrder(id, payload),
    onSuccess: (data) => {
      notifyMutationOutcome(data, {
        savedMessage: "Order updated successfully",
        submittedMessage: "Submitted for approval.",
        queryClient,
      });
      queryClient.invalidateQueries({ queryKey: ["hospitality", "service-orders"] });
      setIsDetailDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to update order");
    },
  });

  const resetCreateForm = () => {
    setCreateForm({
      location_id: "",
      reservation_id: "",
      notes: "",
      status: "pending",
    });
    setPendingItems([]);
    setSelectedMenuItemId("");
    setItemQuantity("1");
    setItemIsComp(false);
    setItemCompReason("marketing");
  };

  const handleAddPendingItem = () => {
    if (!selectedMenuItemId) return;
    const menuItem = menuItems.find(item => String(item.id) === selectedMenuItemId);
    if (!menuItem) return;

    const qty = Number(itemQuantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Please enter a valid quantity");
      return;
    }

    const existingIdx = pendingItems.findIndex(i => 
      i.menu_item_id === selectedMenuItemId && 
      i.is_comp === itemIsComp && 
      i.comp_reason === (itemIsComp ? itemCompReason : null)
    );
    if (existingIdx > -1) {
      const updated = [...pendingItems];
      updated[existingIdx].quantity += qty;
      setPendingItems(updated);
    } else {
      setPendingItems([
        ...pendingItems,
        {
          menu_item_id: selectedMenuItemId,
          inventory_item_id: menuItem.inventory_item_id || null,
          item_name: menuItem.name,
          quantity: qty,
          unit_price: Number(menuItem.price),
          is_comp: itemIsComp,
          comp_reason: itemIsComp ? itemCompReason : null,
        }
      ]);
    }

    setSelectedMenuItemId("");
    setItemQuantity("1");
    setItemIsComp(false);
    setItemCompReason("marketing");
  };

  const handleRemovePendingItem = (index: number) => {
    setPendingItems(pendingItems.filter((_, idx) => idx !== index));
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.location_id) {
      toast.error("Please select a table/location");
      return;
    }
    if (pendingItems.length === 0) {
      toast.error("Please add at least one item to the order");
      return;
    }

    const payload = {
      location_id: Number(createForm.location_id),
      reservation_id: createForm.reservation_id ? Number(createForm.reservation_id) : null,
      notes: createForm.notes || null,
      status: createForm.status,
      items: pendingItems.map(item => ({
        menu_item_id: Number(item.menu_item_id),
        inventory_item_id: item.inventory_item_id,
        item_name: item.item_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        is_comp: item.is_comp,
        comp_reason: item.comp_reason,
      }))
    };

    createMutation.mutate(payload);
  };

  const openDetailDialog = (order: HospitalityServiceOrder) => {
    setSelectedOrder(order);
    setEditForm({
      status: order.status,
      notes: order.notes || "",
    });
    setIsDetailDialogOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    updateMutation.mutate({
      id: selectedOrder.id,
      payload: editForm,
    });
  };

  const orderTotal = pendingItems.reduce((acc, item) => acc + (item.is_comp ? 0 : item.unit_price * item.quantity), 0);

  const statusColors: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    preparing: "bg-indigo-100 text-indigo-700 border-indigo-200",
    served: "bg-blue-100 text-blue-700 border-blue-200",
    closed: "bg-emerald-100 text-emerald-700 border-emerald-200",
    cancelled: "bg-rose-100 text-rose-700 border-rose-200",
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
    if (q.sortCol) {
      setSortCol(q.sortCol);
      setSortDir(q.sortDir || "desc");
    } else {
      setSortCol("created_at");
      setSortDir("desc");
    }
  }, []);

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["hospitality", "service-orders"] });
  }, [queryClient]);

  const resetFilters = useCallback(() => {
    setSearch("");
    setStatusFilter("all");
    setPage(1);
    setTableKey(prev => prev + 1);
  }, []);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => (await api.delete(`/hospitality/service-orders/${id}`)).data,
    onSuccess: (data) => {
      notifyMutationOutcome(data, {
        savedMessage: "Service order deleted.",
        submittedMessage: "Submitted for approval.",
        queryClient,
      });
      queryClient.invalidateQueries({ queryKey: ["hospitality", "service-orders"] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to delete service order");
    },
  });

  const handleDeleteRows = useCallback(async (rows: HospitalityServiceOrder[]) => {
    try {
      const results = await Promise.all(rows.map((row) => deleteMutation.mutateAsync(row.id)));
      notifyBulkDeleteOutcomes(results, {
        savedMessage: (count) => `${count} order(s) deleted.`,
        submittedMessage: "Submitted for approval.",
        queryClient,
      });
    } catch {
      toast.error("An error occurred during deletion. Closed orders cannot be deleted.");
    }
  }, [deleteMutation, queryClient]);

  const exportUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (statusFilter !== "all") params.set("status", statusFilter);
    params.set("sortCol", sortCol);
    params.set("sortDir", sortDir);
    return `/hospitality/service-orders/export?${params.toString()}`;
  }, [search, statusFilter, sortCol, sortDir]);

  const columns = useMemo<ColumnDef<HospitalityServiceOrder>[]>(() => [
    {
      id: "order_info",
      header: "Order Info",
      accessorKey: "order_number",
      cell: ({ row }) => {
        const order = row.original;
        return (
          <div className="py-1">
            <div className="font-bold text-indigo-500">{order.order_number}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {order.created_at ? new Date(order.created_at).toLocaleString() : "N/A"}
            </div>
          </div>
        );
      }
    },
    {
      id: "location",
      header: "Location",
      accessorFn: (row) => row.location?.label || row.location?.name || `Table ${row.location_id}`,
      cell: ({ row }) => {
        const order = row.original;
        return (
          <div className="py-1">
            <div className="font-semibold flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              {order.location?.label || order.location?.name || `Table ${order.location_id}`}
            </div>
            {order.reservation_id && (
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                Reservation Linked
              </div>
            )}
          </div>
        );
      }
    },
    {
      id: "items_count",
      header: "Items Count",
      accessorFn: (row) => row.items?.length || 0,
      cell: ({ row }) => {
        const order = row.original;
        return (
          <Badge variant="secondary" className="font-semibold gap-1.5 rounded-md py-0.5">
            <ClipboardList className="h-3.5 w-3.5" />
            {order.items?.length || 0} items
          </Badge>
        );
      }
    },
    {
      id: "total_amount",
      header: "Total Amount",
      accessorKey: "total_amount",
      meta: { align: "right" as const },
      cell: ({ row }) => {
        const order = row.original;
        return (
          <span className="font-black text-foreground">
            ETB {Number(order.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        );
      }
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "status",
      cell: ({ row }) => {
        const order = row.original;
        return (
          <Badge variant="outline" className={cn("capitalize font-black border text-[11px] tracking-wider rounded-full py-0.5", statusColors[order.status])}>
            {order.status}
          </Badge>
        );
      }
    },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      meta: { align: "right" as const },
      cell: ({ row }) => {
        const order = row.original;
        return (
          <div className="flex items-center justify-end gap-2">
            {canViewBilling && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => openInvoiceDialog(order)}
                className="h-8 text-[11px] font-black uppercase tracking-widest text-slate-300 border-slate-800 bg-slate-950 hover:bg-slate-900 hover:text-white"
              >
                <FileText className="mr-1 h-3.5 w-3.5" />
                Invoice
              </Button>
            )}
            {canEditOrders && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => openDetailDialog(order)}
                className="h-8 text-[11px] font-black uppercase tracking-widest text-indigo-600 border-indigo-200 bg-indigo-50 hover:bg-indigo-100"
              >
                <Pencil className="mr-1 h-3.5 w-3.5" />
                Manage / Details
              </Button>
            )}
          </div>
        );
      }
    }
  ], [canEditOrders, canViewBilling, statusColors]);

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
            <h1 className="text-3xl font-black tracking-tight">Service Orders</h1>
          </div>
          <p className="text-muted-foreground font-medium">
            Monitor active table tabs, place food/beverage orders, and track prep times.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {canCreateOrders && (
          <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
            if (!open) resetCreateForm();
            setIsCreateDialogOpen(open);
          }}>
            <DialogTrigger asChild>
              <Button className="rounded-full px-6 shadow-xl shadow-primary/20">
                <Plus className="mr-2 h-4 w-4" />
                New Service Order
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>New Service Order</DialogTitle>
                <DialogDescription>
                  Select a table and add items from the menu to open an active service ticket.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="location_id">Table / Location *</Label>
                    <Select
                      value={createForm.location_id}
                      onValueChange={(val) => setCreateForm({ ...createForm, location_id: val })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Table" />
                      </SelectTrigger>
                      <SelectContent>
                        {tables.map((table: HospitalityLocation) => (
                          <SelectItem key={table.id} value={String(table.id)}>
                            {table.label} ({table.zone?.name || "No Zone"})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reservation_id">Link Reservation (Optional)</Label>
                    <Select
                      value={createForm.reservation_id}
                      onValueChange={(val) => setCreateForm({ ...createForm, reservation_id: val })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Reservation" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Reservation</SelectItem>
                        {reservations.map((res: HospitalityReservation) => (
                          <SelectItem key={res.id} value={String(res.id)}>
                            {res.customer_name} ({res.reservation_code || `#${res.id}`})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Add Menu Items Section */}
                  <div className="col-span-2 border-t border-border/40 pt-4 space-y-3">
                    <Label className="text-sm font-bold text-indigo-500">Order Items Selector</Label>
                    <div className="flex flex-wrap gap-4 items-end bg-muted/20 border border-border/40 p-4 rounded-xl">
                      <div className="flex-1 min-w-[200px] space-y-2">
                        <Label htmlFor="menu_item_selector" className="text-xs font-bold">Select Menu Item</Label>
                        <Select
                          value={selectedMenuItemId}
                          onValueChange={setSelectedMenuItemId}
                        >
                          <SelectTrigger id="menu_item_selector">
                            <SelectValue placeholder="Search Menu Item..." />
                          </SelectTrigger>
                          <SelectContent>
                            {menuItems.map((item: HospitalityMenuItem) => (
                              <SelectItem key={item.id} value={String(item.id)}>
                                {item.name} - ETB {Number(item.price).toLocaleString()}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="w-[100px] space-y-2">
                        <Label htmlFor="qty_input" className="text-xs font-bold">Quantity</Label>
                        <Input
                          id="qty_input"
                          type="number"
                          min="1"
                          value={itemQuantity}
                          onChange={(e) => setItemQuantity(e.target.value)}
                        />
                      </div>

                      {canAddComps && (
                      <div className="flex items-center gap-2 h-10 px-1">
                        <Checkbox 
                          id="item_is_comp"
                          checked={itemIsComp}
                          onCheckedChange={(checked) => setItemIsComp(!!checked)}
                        />
                        <Label htmlFor="item_is_comp" className="text-xs font-bold cursor-pointer">Complimentary</Label>
                      </div>
                      )}

                      {itemIsComp && (
                        <div className="w-[150px] space-y-2">
                          <Label htmlFor="comp_reason_input" className="text-xs font-bold">Comp Reason</Label>
                          <Input
                            id="comp_reason_input"
                            type="text"
                            placeholder="e.g. VIP, marketing"
                            value={itemCompReason}
                            onChange={(e) => setItemCompReason(e.target.value)}
                          />
                        </div>
                      )}

                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleAddPendingItem}
                        className="h-10"
                      >
                        <PlusCircle className="mr-1 h-4 w-4" />
                        Add
                      </Button>
                    </div>

                    {/* Pending Items Table */}
                    <div className="rounded-xl border bg-background/50 overflow-hidden text-xs mt-3">
                      <Table>
                        <TableHeader>
                          <TableRow className="h-8">
                            <TableHead>Item Name</TableHead>
                            <TableHead className="text-right">Unit Price</TableHead>
                            <TableHead className="text-right">Qty</TableHead>
                            <TableHead className="text-right">Subtotal</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pendingItems.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                                No items added to order yet.
                              </TableCell>
                            </TableRow>
                          ) : (
                            pendingItems.map((item, idx) => (
                              <TableRow key={idx} className="h-8">
                                <TableCell className="font-semibold">
                                  {item.item_name}
                                  {item.is_comp && (
                                    <Badge variant="outline" className="ml-2 text-[11px] text-amber-600 bg-amber-50 border-amber-200 uppercase tracking-widest font-black py-0">
                                      COMP ({item.comp_reason})
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">ETB {item.unit_price.toLocaleString()}</TableCell>
                                <TableCell className="text-right font-bold">{item.quantity}</TableCell>
                                <TableCell className="text-right font-black">ETB {(item.is_comp ? 0 : item.unit_price * item.quantity).toLocaleString()}</TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleRemovePendingItem(idx)}
                                    className="h-6 w-6 text-rose-500 hover:bg-rose-50 hover:text-rose-600 rounded-full"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="flex justify-between items-center bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 text-sm">
                      <span className="font-bold text-indigo-700">Subtotal Amount:</span>
                      <span className="font-black text-indigo-600">ETB {orderTotal.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="notes">Order Preparation Instructions</Label>
                    <Textarea
                      id="notes"
                      placeholder="e.g. Well done, no onions, extra ice..."
                      value={createForm.notes}
                      onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                      rows={2}
                    />
                  </div>
                </div>
                <DialogFooter className="pt-4 border-t border-border/40">
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={createMutation.isPending || pendingItems.length === 0}>
                    {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirm Ticket
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          )}
        </div>
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
                <SelectItem value="all">All Service Orders</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="preparing">Preparing</SelectItem>
                <SelectItem value="served">Served</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DataTable
          key={tableKey}
          columns={columns}
          data={ordersData?.rows || []}
          totalEntries={ordersData?.total || 0}
          loading={isLoadingOrders || isFetching}
          pageIndex={page}
          pageSize={pageSize}
          onQueryChange={handleQueryChange}
          onRefresh={handleRefresh}
          onResetFilters={resetFilters}
          onDeleteRows={canDeleteOrders ? handleDeleteRows : undefined}
          searchPlaceholder="Search service orders by number or notes..."
          enableRowSelection={canDeleteOrders}
          selectedRowIds={selectedRowIds}
          onSelectionChange={(payload) => setSelectedRowIds(payload.selectedRowIds as Record<string, boolean>)}
          exportEndpoint={exportUrl}
          canCopy={canExportOrders}
          canExport={canExportOrders}
          canPrint={canExportOrders}
          resourceName="service orders"
          syncWithUrl={true}
        />
      </div>

      {/* Detail & Status Edit Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Manage Order: {selectedOrder?.order_number}</DialogTitle>
            <DialogDescription>
              Update the ticket preparation status and view order details.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            {selectedOrder && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-3 text-sm">
                  <div>
                    <span className="font-bold text-muted-foreground">Location: </span>
                    <span className="font-bold">{selectedOrder.location?.label || selectedOrder.location?.name || `Table ${selectedOrder.location_id}`}</span>
                  </div>
                  <div>
                    <span className="font-bold text-indigo-700">Total: </span>
                    <span className="font-black text-indigo-600">ETB {Number(selectedOrder.total_amount).toLocaleString()}</span>
                  </div>
                </div>

                {/* Items List */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-muted-foreground">Order Items</Label>
                  <div className="rounded-xl border max-h-[200px] overflow-y-auto text-xs bg-background/30">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead>Item Name</TableHead>
                          <TableHead className="text-right">Unit Price</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedOrder.items?.map((item: HospitalityServiceOrderItem) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-semibold">
                              {item.item_name}
                              {item.is_comp && (
                                <Badge variant="outline" className="ml-2 text-[11px] text-amber-600 bg-amber-50 border-amber-200 uppercase tracking-widest font-black py-0">
                                  COMP ({item.comp_reason})
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">ETB {Number(item.unit_price).toLocaleString()}</TableCell>
                            <TableCell className="text-right font-bold">{Number(item.quantity)}</TableCell>
                            <TableCell className="text-right font-black">ETB {Number(item.total_price).toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <OrderCoursingPanel
                  order={liveSelectedOrder ?? selectedOrder}
                  onChanged={refreshSelectedOrder}
                />

                {/* Status Transitions */}
                <div className="space-y-2">
                  <Label htmlFor="edit_status">Ticket Status</Label>
                  <Select
                    value={editForm.status}
                    onValueChange={(val) => setEditForm({ ...editForm, status: val })}
                    disabled={selectedOrder.status === "closed" || selectedOrder.status === "cancelled"}
                  >
                    <SelectTrigger id="edit_status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending Preparation</SelectItem>
                      <SelectItem value="preparing">Preparing (In Kitchen/Bar)</SelectItem>
                      <SelectItem value="served">Served to Table</SelectItem>
                      <SelectItem value="closed" disabled>Closed (Paid & Finalized)</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit_notes">Notes / Special Instructions</Label>
                  <Textarea
                    id="edit_notes"
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    rows={2}
                    disabled={selectedOrder.status === "closed" || selectedOrder.status === "cancelled"}
                  />
                </div>

                {selectedOrder.status !== "closed" && selectedOrder.status !== "cancelled" && canProcessPayments && (
                  <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex items-center justify-between text-xs font-bold text-indigo-700">
                    <span className="flex items-center gap-1.5">
                      <Banknote className="h-4 w-4" />
                      Ready to split and checkout?
                    </span>
                    <Button asChild size="sm" className="rounded-full shadow-sm px-4 bg-indigo-600 hover:bg-indigo-700">
                      <Link href="/dashboard/hospitality/checkout" className="flex items-center gap-1">
                        Go to POS
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            )}
            <DialogFooter className="pt-4 border-t flex justify-between sm:justify-between items-center w-full">
              {selectedOrder && canViewBilling && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setIsDetailDialogOpen(false);
                    openInvoiceDialog(selectedOrder);
                  }}
                  className="bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Print Invoice
                </Button>
              )}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDetailDialogOpen(false)}>Close</Button>
                {selectedOrder?.status !== "closed" && selectedOrder?.status !== "cancelled" && canEditOrders && (
                  <Button type="submit" disabled={updateMutation.isPending}>
                    {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Status
                  </Button>
                )}
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <InvoiceDialog
        order={invoiceOrder}
        isOpen={isInvoiceDialogOpen}
        onOpenChange={setIsInvoiceDialogOpen}
      />
    </div>
  );
}
