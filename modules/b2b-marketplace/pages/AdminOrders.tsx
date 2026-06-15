"use client";

import React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, FileText, Loader2, Percent, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { B2BDash, type B2BAdminOrder } from "@/modules/b2b-marketplace/api";

const money = (n: number) => `$${(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const STATUSES = ["pending", "confirmed", "processing", "shipped", "completed", "cancelled"];

export default function AdminOrders() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["b2b", "adminOrders"], queryFn: () => B2BDash.adminOrders() });
  const orders = q.data ?? [];
  const invalidate = () => qc.invalidateQueries({ queryKey: ["b2b", "adminOrders"] });

  const confirm = useMutation({ mutationFn: (id: number) => B2BDash.confirmOrderPayment(id), onSuccess: invalidate });
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => B2BDash.updateOrderStatus(id, { status }),
    onSuccess: invalidate,
  });
  const release = useMutation({
    mutationFn: (id: number) => B2BDash.updateOrderStatus(id, { payout_status: "released" }),
    onSuccess: invalidate,
  });

  // Commission rate (editable)
  const settingsQ = useQuery({ queryKey: ["b2b", "marketplaceSettings"], queryFn: () => B2BDash.marketplaceSettings() });
  const [commission, setCommission] = React.useState<string>("");
  React.useEffect(() => {
    if (settingsQ.data) setCommission(String(settingsQ.data.commission_percent));
  }, [settingsQ.data]);
  const saveCommission = useMutation({
    mutationFn: () => B2BDash.updateCommission(Number(commission)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["b2b", "marketplaceSettings"] }),
  });

  const totalGmv = orders.filter((o) => o.payment_status === "paid").reduce((s, o) => s + o.subtotal, 0);
  const totalFees = orders.filter((o) => o.payment_status === "paid").reduce((s, o) => s + o.platform_fee_amount, 0);

  return (
    <div className="space-y-4">
      {/* Commission rate — set your own */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Percent className="h-5 w-5" /></div>
          <div className="flex-1 min-w-[180px]">
            <p className="text-sm font-bold">Platform commission</p>
            <p className="text-xs text-muted-foreground">Your cut on each order. Applies to new orders; existing orders keep their rate.</p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number" min={0} max={50} step={0.5}
              value={commission}
              onChange={(e) => setCommission(e.target.value)}
              className="h-9 w-24 text-right"
            />
            <span className="text-sm font-bold text-muted-foreground">%</span>
            <Button size="sm" disabled={saveCommission.isPending || commission === ""} onClick={() => saveCommission.mutate()} className="gap-1">
              {saveCommission.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Orders</p><p className="text-2xl font-black">{orders.length}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Paid GMV</p><p className="text-2xl font-black text-primary">{money(totalGmv)}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Platform fees earned</p><p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{money(totalFees)}</p></CardContent></Card>
      </div>

      {q.isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : orders.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No orders yet.</CardContent></Card>
      ) : (
        orders.map((o: B2BAdminOrder) => (
          <Card key={o.id}>
            <CardContent className="space-y-3 py-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[160px]">
                  <p className="text-sm font-black">{o.order_number}</p>
                  <p className="text-xs text-muted-foreground">{o.buyer || o.shipping_name} · {o.items_count} items · {new Date(o.created_at).toLocaleDateString()}</p>
                </div>
                <Badge variant={o.payment_status === "paid" ? "default" : "secondary"}>
                  {o.payment_status.replace("_", " ")}
                </Badge>
                <Badge variant="outline">{o.payout_status === "released" ? "payout released" : "payout pending"}</Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="rounded-lg bg-muted/40 px-3 py-2"><p className="text-[11px] text-muted-foreground">Total</p><p className="font-bold">{money(o.subtotal)}</p></div>
                <div className="rounded-lg bg-muted/40 px-3 py-2"><p className="text-[11px] text-muted-foreground">Fee ({o.platform_fee_percent}%)</p><p className="font-bold text-emerald-600 dark:text-emerald-400">{money(o.platform_fee_amount)}</p></div>
                <div className="rounded-lg bg-muted/40 px-3 py-2"><p className="text-[11px] text-muted-foreground">Supplier payout</p><p className="font-bold">{money(o.seller_payout_amount)}</p></div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {o.payment_status === "pending_confirmation" && (
                  <Button size="sm" disabled={confirm.isPending} onClick={() => confirm.mutate(o.id)} className="gap-1">
                    <Check className="h-3.5 w-3.5" /> Confirm payment {o.payment_reference ? `(${o.payment_reference})` : ""}
                  </Button>
                )}
                <div className="inline-flex items-center gap-1.5">
                  <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                  <Select value={o.status} onValueChange={(v) => setStatus.mutate({ id: o.id, status: v })}>
                    <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {o.payment_status === "paid" && o.payout_status !== "released" && (
                  <Button size="sm" variant="outline" disabled={release.isPending} onClick={() => release.mutate(o.id)}>Release payout</Button>
                )}
                <Button asChild size="sm" variant="ghost" className="gap-1">
                  <Link href={`/marketplace/orders/${o.id}/invoice`} target="_blank"><FileText className="h-3.5 w-3.5" /> Invoice</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
