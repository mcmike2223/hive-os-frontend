"use client";

import React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { B2BDash } from "@/modules/b2b-marketplace/api";

const money = (n: number) => `$${(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function InvoicePage({ id }: { id?: string }) {
  const { data: inv, isLoading, isError } = useQuery({
    queryKey: ["b2b", "invoice", id],
    queryFn: () => B2BDash.orderInvoice(Number(id)),
    enabled: !!id,
    retry: 1,
  });

  if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  if (isError || !inv) {
    return (
      <div className="mx-auto max-w-lg py-32 text-center">
        <h1 className="text-2xl font-black">Invoice not available</h1>
        <Button asChild className="mt-6 rounded-xl"><Link href="/dashboard/b2b-marketplace">Back to dashboard</Link></Button>
      </div>
    );
  }

  const paymentLabel =
    inv.payment_status === "paid" ? "PAID"
    : inv.payment_status === "pending_confirmation" ? "AWAITING CONFIRMATION"
    : "UNPAID";

  return (
    <div className="min-h-screen w-full bg-muted/30 py-6 text-foreground">
      {/* toolbar (hidden when printing) */}
      <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between px-4 print:hidden">
        <Link href="/dashboard/b2b-marketplace" className="inline-flex items-center gap-2 text-sm font-bold hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <Button onClick={() => window.print()} className="rounded-xl gap-2"><Printer className="h-4 w-4" /> Print / Save as PDF</Button>
      </div>

      {/* invoice sheet */}
      <div className="mx-auto max-w-3xl bg-white text-[#1f2430] shadow-sm print:shadow-none" style={{ padding: "40px" }}>
        <div className="flex items-start justify-between border-b pb-6">
          <div>
            <h1 className="text-2xl font-black tracking-tight">INVOICE</h1>
            <p className="mt-1 text-sm text-gray-500">{inv.order_number}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-black">{inv.platform?.name || "Global B2B Marketplace"}</p>
            <p className="text-xs text-gray-500">Marketplace / Merchant of record</p>
            <span className={"mt-2 inline-block rounded px-2 py-0.5 text-xs font-bold " + (inv.payment_status === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
              {paymentLabel}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 py-6 text-sm">
          <div>
            <p className="font-bold text-gray-500">Bill to</p>
            <p className="font-semibold">{inv.shipping?.name}</p>
            {inv.shipping?.company && <p>{inv.shipping.company}</p>}
            <p className="text-gray-600">{inv.shipping?.email}</p>
            {inv.shipping?.phone && <p className="text-gray-600">{inv.shipping.phone}</p>}
            <p className="whitespace-pre-line text-gray-600">{inv.shipping?.address}</p>
          </div>
          <div className="text-right">
            <p><span className="text-gray-500">Invoice date: </span>{new Date(inv.created_at).toLocaleDateString()}</p>
            {inv.paid_at && <p><span className="text-gray-500">Paid: </span>{new Date(inv.paid_at).toLocaleDateString()}</p>}
            {inv.payment_method && <p><span className="text-gray-500">Method: </span>{inv.payment_method}</p>}
            {inv.payment_reference && <p><span className="text-gray-500">Ref: </span>{inv.payment_reference}</p>}
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-y bg-gray-50 text-left">
              <th className="py-2 pl-2">Item</th>
              <th className="py-2 text-right">Qty</th>
              <th className="py-2 text-right">Unit</th>
              <th className="py-2 pr-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {inv.items?.map((it, i) => (
              <tr key={i} className="border-b">
                <td className="py-2 pl-2">{it.name}</td>
                <td className="py-2 text-right">{it.quantity}</td>
                <td className="py-2 text-right">{money(it.unit_price)}</td>
                <td className="py-2 pr-2 text-right">{money(it.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ml-auto mt-4 w-64 text-sm">
          <div className="flex justify-between py-1"><span className="text-gray-500">Subtotal</span><span className="font-semibold">{money(inv.subtotal)}</span></div>
          {inv.is_admin_view && (
            <>
              <div className="flex justify-between py-1 text-gray-500"><span>Platform fee ({inv.platform_fee_percent}%)</span><span>{money(inv.platform_fee_amount)}</span></div>
              <div className="flex justify-between py-1 text-gray-500"><span>Supplier payout</span><span>{money(inv.seller_payout_amount)}</span></div>
            </>
          )}
          <div className="mt-1 flex justify-between border-t py-2 text-base font-black"><span>Total</span><span>{money(inv.subtotal)}</span></div>
        </div>

        {inv.notes && <p className="mt-6 border-t pt-4 text-xs text-gray-500"><b>Notes:</b> {inv.notes}</p>}
        <p className="mt-8 text-center text-[11px] text-gray-400">
          Payment is made to {inv.platform?.name || "the marketplace"}, which settles with the supplier per the marketplace agreement.
        </p>
      </div>
    </div>
  );
}
