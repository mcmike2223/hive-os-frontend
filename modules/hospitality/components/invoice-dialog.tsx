"use client";

import { useState, useEffect } from "react";
import { Printer, FileText, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { HospitalityServiceOrder } from "@/modules/hospitality/types";

interface InvoiceDialogProps {
  order: HospitalityServiceOrder | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

// Helper to convert numbers to English words
function numberToWords(num: number): string {
  if (num === 0) return "Zero";
  
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const scales = ["", "Thousand", "Million", "Billion"];
  
  function convertGroup(n: number): string {
    let s = "";
    if (n >= 100) {
      s += ones[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }
    if (n >= 20) {
      s += tens[Math.floor(n / 10)] + " ";
      n %= 10;
    }
    if (n > 0) {
      s += ones[n] + " ";
    }
    return s.trim();
  }
  
  const parts = num.toFixed(2).split(".");
  const integerPart = parseInt(parts[0], 10);
  const decimalPart = parseInt(parts[1], 10);
  
  let result = "";
  let temp = integerPart;
  let scaleIdx = 0;
  
  while (temp > 0) {
    const group = temp % 1000;
    if (group > 0) {
      result = convertGroup(group) + (scales[scaleIdx] ? " " + scales[scaleIdx] : "") + " " + result;
    }
    temp = Math.floor(temp / 1000);
    scaleIdx++;
  }
  
  result = result.trim() || "Zero";
  result += " Birr";
  
  if (decimalPart > 0) {
    result += " and " + convertGroup(decimalPart) + " Cents";
  }
  
  return result + " Only";
}

export default function InvoiceDialog({ order, isOpen, onOpenChange }: InvoiceDialogProps) {
  const [customerName, setCustomerName] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");

  useEffect(() => {
    if (order) {
      setCustomerName(order.reservation?.customer_name || "");
      setInvoiceDate(order.created_at ? new Date(order.created_at).toLocaleDateString() : new Date().toLocaleDateString());
    }
  }, [order]);

  if (!order) return null;

  const totalAmount = Number(order.total_amount);
  const totalInWords = numberToWords(totalAmount);

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* Print styles injected dynamically when dialog is open */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-invoice-content, #printable-invoice-content * {
            visibility: visible !important;
          }
          #printable-invoice-content {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: 20px !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: white !important;
            color: black !important;
          }
          .dialog-close-btn {
            display: none !important;
          }
        }
      `}} />

      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[650px] max-h-[95vh] overflow-y-auto bg-slate-900 border-slate-800 text-slate-100 p-6">
          <DialogHeader className="border-b border-slate-800 pb-4">
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-indigo-400">
              <FileText className="h-5 w-5" />
              Generate Invoice / ደረሰኝ
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Preview and customize the bill invoice format before printing.
            </DialogDescription>
          </DialogHeader>

          {/* Editable settings before printing */}
          <div className="grid grid-cols-2 gap-4 py-4 border-b border-slate-800">
            <div className="space-y-1.5">
              <Label htmlFor="customer_name_input" className="text-xs text-slate-400">To / ለ (Customer Name)</Label>
              <Input
                id="customer_name_input"
                className="bg-slate-950 border-slate-800 text-slate-100 h-9"
                placeholder="e.g. Guest Name / Company"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invoice_date_input" className="text-xs text-slate-400">Date / ቀን</Label>
              <Input
                id="invoice_date_input"
                className="bg-slate-950 border-slate-800 text-slate-100 h-9"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </div>
          </div>

          {/* Printable Receipt Preview */}
          <div className="py-6 flex justify-center bg-slate-950/40 rounded-xl border border-slate-800/60 p-4 overflow-x-auto">
            <div
              id="printable-invoice-content"
              className="w-[100%] max-w-[500px] bg-white text-slate-900 p-6 rounded shadow-lg border border-slate-200 font-mono text-sm leading-relaxed"
            >
              {/* Header */}
              <div className="text-center space-y-1 border-b-2 border-slate-900 pb-4">
                <h2 className="text-xl font-black tracking-wider uppercase text-slate-950">Savory Lounge</h2>
                <p className="text-xs font-bold text-slate-500">Bole, Addis Ababa, Ethiopia</p>
                <div className="pt-2 text-xs font-black uppercase border border-slate-900 px-2 py-0.5 inline-block bg-slate-100">
                  Cash Receipt / Invoice / ደረሰኝ
                </div>
              </div>

              {/* Invoice Meta */}
              <div className="grid grid-cols-2 gap-y-2 py-4 text-xs font-bold border-b border-dashed border-slate-400">
                <div>
                  <span className="text-slate-500">To / ለ:</span>{" "}
                  <span className="underline decoration-dotted text-slate-950">{customerName || "Cash Customer"}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500">Date / ቀን:</span>{" "}
                  <span className="text-slate-950">{invoiceDate}</span>
                </div>
                <div>
                  <span className="text-slate-500">Invoice No. / ቁጥር:</span>{" "}
                  <span className="text-slate-950">{order.order_number}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500">Location / ጠረጴዛ:</span>{" "}
                  <span className="text-slate-950">{order.location?.label || `Table ${order.location_id}`}</span>
                </div>
              </div>

              {/* Table */}
              <table className="w-full text-xs text-left border-collapse mt-4">
                <thead>
                  <tr className="border-b-2 border-slate-900 text-[11px] font-black uppercase text-slate-600">
                    <th className="py-1.5 w-8">No.<br/>ተ.ቁ</th>
                    <th className="py-1.5">Description<br/>ዝርዝር</th>
                    <th className="py-1.5 text-center w-12">Unit<br/>መለኪያ</th>
                    <th className="py-1.5 text-right w-10">Qty<br/>መጠን</th>
                    <th className="py-1.5 text-right w-20">Unit Price<br/>ያንዱ ዋጋ</th>
                    <th className="py-1.5 text-right w-20">Total Price<br/>ጠቅላላ ዋጋ</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items?.map((item, index) => (
                    <tr key={item.id || index} className="border-b border-slate-200">
                      <td className="py-2 text-slate-500">{index + 1}</td>
                      <td className="py-2 font-bold text-slate-900">{item.item_name}</td>
                      <td className="py-2 text-center text-slate-500">Pcs</td>
                      <td className="py-2 text-right font-bold text-slate-900">{Number(item.quantity)}</td>
                      <td className="py-2 text-right text-slate-600">{Number(item.unit_price).toFixed(2)}</td>
                      <td className="py-2 text-right font-black text-slate-950">{Number(item.total_price).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div className="mt-4 pt-3 border-t-2 border-slate-900 space-y-3">
                <div className="flex justify-between items-center text-sm font-black text-slate-950">
                  <span>Total Price / ጠቅላላ ዋጋ:</span>
                  <span className="border-b-4 border-double border-slate-950 px-1 bg-slate-50">
                    ETB {totalAmount.toFixed(2)}
                  </span>
                </div>

                <div className="text-xs pt-1 border-t border-dashed border-slate-300">
                  <span className="text-slate-500 block text-[11px] font-bold uppercase">Amount in Words / የገንዘብ ልክ በፊደል:</span>
                  <span className="font-bold text-slate-900 italic">{totalInWords}</span>
                </div>
              </div>

              {/* Footer / Signature */}
              <div className="mt-8 pt-4 border-t border-slate-300 grid grid-cols-2 text-[11px] font-bold">
                <div>
                  <span className="text-slate-500">Served By / አስተናጋጅ:</span>
                  <p className="text-slate-900 font-bold mt-1">{order.served_by?.name || "Waiter"}</p>
                </div>
                <div className="text-right space-y-4">
                  <span className="text-slate-500">Signature / ፊርማ:</span>
                  <div className="border-b border-slate-900 w-28 ml-auto pt-4"></div>
                </div>
              </div>

              <div className="text-center text-[11px] text-slate-400 mt-8 font-sans">
                Thank you for visiting Savory Lounge!
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-slate-800 pt-4 flex items-center justify-between sm:justify-between">
            <span className="text-xs text-slate-500">Pressing Print will launch browser printer.</span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-900 hover:text-white"
              >
                Close
              </Button>
              <Button
                type="button"
                onClick={handlePrint}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-md px-4"
              >
                <Printer className="mr-2 h-4 w-4" />
                Print Invoice
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
