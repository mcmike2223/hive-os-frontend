"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Search, Loader2, CheckCircle2, SplitSquareHorizontal, Banknote, MapPin, CalendarDays, Plus, Trash2, FileText } from "lucide-react";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

import { splitHospitalityBill, closeHospitalityOrder } from "@/modules/hospitality/api";
import type { HospitalityServiceOrder } from "@/modules/hospitality/types";
import { cn } from "@/lib/utils";
import { notifyMutationOutcome } from "@/modules/workflow/utils/mutation-outcome";
import InvoiceDialog from "@/modules/hospitality/components/invoice-dialog";
import { DataTable } from "@/components/datatable/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import api from "@/modules/shared/api/http";
import { usePermissions } from "@/hooks/use-permissions";

export default function CheckoutPage() {
  const queryClient = useQueryClient();
  const { hasAnyPermission } = usePermissions();
  const canViewBilling = hasAnyPermission([
    "view_hospitality_billing",
    "manage_hospitality_billing",
  ]);
  const canRecordPayment = hasAnyPermission([
    "create_hospitality_billing",
    "manage_hospitality_billing",
  ]);
  const canCloseOrder = hasAnyPermission([
    "close_hospitality_service_orders",
    "manage_hospitality_service_orders",
  ]);
  const canExportOrders = hasAnyPermission([
    "export_hospitality_reports",
    "manage_hospitality_service_orders",
  ]);
  const [selectedOrder, setSelectedOrder] = useState<HospitalityServiceOrder | null>(null);
  const [isSplitDialogOpen, setIsSplitDialogOpen] = useState(false);
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [invoiceOrder, setInvoiceOrder] = useState<HospitalityServiceOrder | null>(null);
  const [splitRequestKey, setSplitRequestKey] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<string>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tableKey, setTableKey] = useState(0);

  const openInvoiceDialog = (order: HospitalityServiceOrder) => {
    setInvoiceOrder(order);
    setIsInvoiceDialogOpen(true);
  };

  const handleQueryChange = React.useCallback((q: any) => {
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

  const { data, isLoading: isLoadingOrders } = useQuery({
    queryKey: [
      "hospitality",
      "service-orders",
      page,
      pageSize,
      search,
      sortCol,
      sortDir,
      statusFilter,
    ],
    queryFn: async () => {
      const params: Record<string, any> = {
        page,
        per_page: pageSize,
      };
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== "all") params.status = statusFilter;
      if (sortCol) {
        params.sortCol = sortCol;
        params.sortDir = sortDir;
      }

      const res = await api.get("/hospitality/service-orders", { params });
      return {
        rows: res.data?.data || [],
        total: res.data?.meta?.total || res.data?.total || 0,
      };
    },
  });

  const [splits, setSplits] = useState<{split_name: string, amount: string, tip_amount: string, payment_method: string}[]>([
    { split_name: "Guest 1", amount: "", tip_amount: "0", payment_method: "cash" }
  ]);

  const closeOrderMutation = useMutation({
    mutationFn: closeHospitalityOrder,
    onSuccess: (data) => {
      notifyMutationOutcome(data, {
        savedMessage: "Order closed successfully",
        submittedMessage: "Order close submitted for approval",
        queryClient,
      });
      queryClient.invalidateQueries({ queryKey: ["hospitality", "service-orders"] });
      setSelectedOrder(null);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to close order");
    },
  });

  const splitBillMutation = useMutation({
    mutationFn: ({ orderId, payload }: { orderId: number; payload: Record<string, unknown> }) =>
      splitHospitalityBill(orderId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hospitality", "service-orders"] });
      toast.success("Bill split recorded");
      setIsSplitDialogOpen(false);
      setSplits([{ split_name: "Guest 1", amount: "", tip_amount: "0", payment_method: "cash" }]);
      setSplitRequestKey(null);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to record bill split");
    },
  });

  const handleAddSplit = () => {
    setSplits([...splits, { split_name: `Guest ${splits.length + 1}`, amount: "", tip_amount: "0", payment_method: "card" }]);
  };

  const handleRemoveSplit = (index: number) => {
    setSplits(splits.filter((_, i) => i !== index));
  };

  const handleUpdateSplit = (index: number, field: string, value: string) => {
    const newSplits = [...splits];
    newSplits[index] = { ...newSplits[index], [field]: value };
    setSplits(newSplits);
  };

  const handleAutoSplit = () => {
    if (!selectedOrder) return;
    const amountPerPerson = (Number(selectedOrder.total_amount) / splits.length).toFixed(2);
    const newSplits = splits.map(s => ({ ...s, amount: amountPerPerson }));
    setSplits(newSplits);
  };

  const handleSubmitSplit = () => {
    if (!selectedOrder) return;
    splitBillMutation.mutate({
      orderId: selectedOrder.id,
      payload: { splits, idempotency_key: splitRequestKey }
    });
  };

  const openSplitDialog = (order: HospitalityServiceOrder) => {
    setSelectedOrder(order);
    setSplitRequestKey(crypto.randomUUID());
    setSplits([{ split_name: "Guest 1", amount: order.total_amount, tip_amount: "0", payment_method: "cash" }]);
    setIsSplitDialogOpen(true);
  };

  const columns: ColumnDef<HospitalityServiceOrder>[] = [
    {
      id: "order_number",
      accessorKey: "order_number",
      header: "Order Details",
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-foreground">{row.original.order_number}</div>
          <div className="text-xs text-muted-foreground mt-1 flex gap-2 items-center">
            <Banknote className="h-3 w-3" />
            {row.original.items?.length || 0} items
          </div>
        </div>
      )
    },
    {
      id: "location",
      header: "Location & Reservation",
      cell: ({ row }) => (
        <div>
          <div className="text-sm flex items-center gap-1 font-medium">
            <MapPin className="h-3 w-3 text-muted-foreground" />
            {row.original.location?.name || `Table ${row.original.location_id}`}
          </div>
          {row.original.reservation_id && (
            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              Reservation #{row.original.reservation_id}
            </div>
          )}
        </div>
      )
    },
    {
      id: "status",
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant="outline" className={cn(
          "capitalize",
          row.original.status === "pending" ? "bg-amber-100 text-amber-700" :
          row.original.status === "served" ? "bg-blue-100 text-blue-700" :
          row.original.status === "closed" ? "bg-emerald-100 text-emerald-700" :
          "bg-slate-100 text-slate-700"
        )}>
          {row.original.status}
        </Badge>
      )
    },
    {
      id: "total_amount",
      accessorKey: "total_amount",
      header: "Total Amount",
      cell: ({ row }) => (
        <div className="text-right font-black">
          ETB {Number(row.original.total_amount).toLocaleString()}
        </div>
      )
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const order = row.original;
        return (
          <div className="flex items-center justify-end gap-2">
            {canViewBilling && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => openInvoiceDialog(order)}
                className="h-8 text-xs font-bold uppercase tracking-widest text-slate-300 border-slate-800 bg-slate-950 hover:bg-slate-900 hover:text-white"
              >
                <FileText className="mr-1 h-3.5 w-3.5" />
                Invoice
              </Button>
            )}
            {order.status !== "closed" && order.status !== "cancelled" && (
              <>
                {canRecordPayment && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openSplitDialog(order)}
                  className="h-8 text-xs font-bold uppercase tracking-widest text-indigo-600 border-indigo-200 bg-indigo-50 hover:bg-indigo-100"
                >
                  <SplitSquareHorizontal className="mr-1 h-3 w-3" />
                  Split / Pay
                </Button>
                )}
                {canCloseOrder && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => closeOrderMutation.mutate(order.id)}
                    disabled={closeOrderMutation.isPending}
                    className="h-8 text-xs font-bold uppercase tracking-widest text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100"
                  >
                    {closeOrderMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="mr-1 h-3 w-3" />}
                    Close Order
                  </Button>
                )}
              </>
            )}
          </div>
        );
      }
    }
  ];

  const totalSplitAmount = splits.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  const remainingAmount = selectedOrder ? Number(selectedOrder.total_amount) - totalSplitAmount : 0;

  const exportUrl = React.useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (statusFilter !== "all") params.set("status", statusFilter);
    params.set("sortCol", sortCol);
    params.set("sortDir", sortDir);
    return `/hospitality/service-orders/export?${params.toString()}`;
  }, [search, statusFilter, sortCol, sortDir]);

  return (
    <div className="space-y-8 p-6 pb-20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
            <CreditCard className="h-8 w-8 text-indigo-500" />
            POS & Checkout
          </h1>
          <p className="text-muted-foreground">Manage open tabs, split bills, and process payments.</p>
        </div>
      </div>

      <div className="rounded-[2rem] border bg-card overflow-hidden">
        <DataTable
          key={tableKey}
          data={data?.rows || []}
          columns={columns}
          totalEntries={data?.total || 0}
          loading={isLoadingOrders}
          pageIndex={page}
          pageSize={pageSize}
          onQueryChange={handleQueryChange}
          searchPlaceholder="Search Order # or Table..."
          exportEndpoint={exportUrl}
          canCopy={canExportOrders}
          canExport={canExportOrders}
          canPrint={canExportOrders}
          resourceName="service orders"
          syncWithUrl={true}
        />
      </div>

      <Dialog open={isSplitDialogOpen} onOpenChange={setIsSplitDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Split & Process Payment</DialogTitle>
            <DialogDescription>
              Order {selectedOrder?.order_number}. Total: ETB {Number(selectedOrder?.total_amount).toLocaleString()}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            
            <div className="flex justify-between items-center bg-muted/50 p-3 rounded-xl border border-border/50">
              <div className="space-y-1">
                <p className="text-sm font-medium">Remaining to Pay</p>
                <p className={cn("text-xl font-black", remainingAmount < 0 ? "text-red-500" : remainingAmount === 0 ? "text-emerald-500" : "")}>
                  ETB {remainingAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={handleAutoSplit}>
                <SplitSquareHorizontal className="mr-2 h-4 w-4" />
                Split Equally
              </Button>
            </div>

            <div className="space-y-3">
              {splits.map((split, idx) => (
                <div key={idx} className="flex items-center gap-3 bg-card p-3 rounded-xl border border-border">
                  <div className="grid grid-cols-4 gap-3 flex-1">
                    <div className="col-span-1">
                      <Label className="text-xs mb-1 block">Name</Label>
                      <Input value={split.split_name} onChange={(e) => handleUpdateSplit(idx, "split_name", e.target.value)} />
                    </div>
                    <div className="col-span-1">
                      <Label className="text-xs mb-1 block">Amount</Label>
                      <Input type="number" min="0" value={split.amount} onChange={(e) => handleUpdateSplit(idx, "amount", e.target.value)} />
                    </div>
                    <div className="col-span-1">
                      <Label className="text-xs mb-1 block">Tip</Label>
                      <Input type="number" min="0" value={split.tip_amount} onChange={(e) => handleUpdateSplit(idx, "tip_amount", e.target.value)} />
                    </div>
                    <div className="col-span-1">
                      <Label className="text-xs mb-1 block">Method</Label>
                      <Select value={split.payment_method} onValueChange={(val) => handleUpdateSplit(idx, "payment_method", val)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="card">Card</SelectItem>
                          <SelectItem value="telebirr">Telebirr</SelectItem>
                          <SelectItem value="chapa">Chapa</SelectItem>
                          <SelectItem value="arifpay">Arifpay</SelectItem>
                          <SelectItem value="cbe">CBE</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleRemoveSplit(idx)} className="mt-5 text-muted-foreground hover:text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Button variant="outline" className="w-full border-dashed" onClick={handleAddSplit}>
              <Plus className="mr-2 h-4 w-4" />
              Add Split
            </Button>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSplitDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmitSplit} disabled={splitBillMutation.isPending || Math.abs(remainingAmount) > 0.009}>
              {splitBillMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Record Payments
            </Button>
          </DialogFooter>
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
