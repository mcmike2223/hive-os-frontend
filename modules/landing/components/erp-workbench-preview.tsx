"use client";

import * as React from "react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  FileText,
  Boxes,
  Truck,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  QrCode,
  ArrowRight,
  Sparkles,
  Layers,
  Fuel,
  Users,
  ShieldCheck,
  Percent,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useTranslation } from "@/store/use-translation";

type TabId = "invoicing" | "inventory" | "fleet" | "procurement" | "ledger";

export function ErpWorkbenchPreview() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabId>("invoicing");

  // Invoicing Interactive State
  const [invoiceItems, setInvoiceItems] = useState([
    { desc: "Industrial Solar Inverters (10kW)", qty: 2, price: 185000 },
    { desc: "Deep Cycle Gel Batteries (200Ah)", qty: 8, price: 42000 },
    { desc: "Installation & System Commissioning", qty: 1, price: 35000 },
  ]);
  const [applyVat, setApplyVat] = useState(true);
  const [applyWithholding, setApplyWithholding] = useState(false);

  // Computed Invoice
  const subtotal = invoiceItems.reduce((acc, item) => acc + item.qty * item.price, 0);
  const vatAmount = applyVat ? subtotal * 0.15 : 0;
  const withholdingAmount = applyWithholding ? subtotal * 0.02 : 0;
  const totalAmount = subtotal + vatAmount - withholdingAmount;

  // Inventory Interactive State
  const [selectedWarehouse, setSelectedWarehouse] = useState("Addis Ababa Central Hub");
  const [stockItems, setStockItems] = useState([
    { sku: "SKU-9941", name: "Premium Portland Cement (50kg)", stock: 1420, min: 500, unit: "Bags", status: "In Stock", price: 1150 },
    { sku: "SKU-8820", name: "Reinforcement Steel Rebar (12mm)", stock: 85, min: 200, unit: "Tons", status: "Low Stock", price: 89000 },
    { sku: "SKU-3312", name: "Copper Electrical Cable (4mm)", stock: 620, min: 150, unit: "Rolls", status: "Optimal", price: 6400 },
    { sku: "SKU-1049", name: "Heavy-Duty Safety Boots (Size 42-45)", stock: 340, min: 100, unit: "Pairs", status: "In Stock", price: 3200 },
  ]);

  // Fleet Interactive State
  const [fleetVehicles] = useState([
    { id: "ETH-3-49201", model: "Isuzu FSR 10-Ton", driver: "Abebe Kebede", route: "Addis → Adama Expressway", status: "In Transit", fuel: 78, speed: "68 km/h" },
    { id: "ETH-3-88192", model: "Toyota Hilux 4x4", driver: "Dawit Haile", route: "Hawassa Industrial Park", status: "Delivered", fuel: 92, speed: "0 km/h" },
    { id: "ETH-3-11029", model: "Volvo FH16 40-Ton", driver: "Mohammed Nur", route: "Mojo Dry Port Loading", status: "Loading", fuel: 64, speed: "0 km/h" },
  ]);

  const tabs = [
    {
      id: "invoicing" as TabId,
      label: "Invoicing & VAT",
      badge: "ERCA / MOR 15%",
      icon: FileText,
      color: "text-emerald-700 dark:text-emerald-300",
      bg: "bg-emerald-500/10 border-emerald-500/20",
    },
    {
      id: "inventory" as TabId,
      label: "Multi-Warehouse",
      badge: "Multi-Branch",
      icon: Boxes,
      color: "text-indigo-700 dark:text-indigo-300",
      bg: "bg-indigo-500/10 border-indigo-500/20",
    },
    {
      id: "fleet" as TabId,
      label: "Fleet & Logistics",
      badge: "GPS Telemetry",
      icon: Truck,
      color: "text-sky-700 dark:text-sky-300",
      bg: "bg-sky-500/10 border-sky-500/20",
    },
    {
      id: "procurement" as TabId,
      label: "Procurement & RFQs",
      badge: "Supplier Bids",
      icon: ShoppingCart,
      color: "text-amber-800 dark:text-amber-300",
      bg: "bg-amber-500/10 border-amber-500/20",
    },
    {
      id: "ledger" as TabId,
      label: "Financial Ledger",
      badge: "P&L / Audit",
      icon: TrendingUp,
      color: "text-violet-700 dark:text-violet-300",
      bg: "bg-violet-500/10 border-violet-500/20",
    },
  ];

  const formatETB = (val: number) =>
    val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="w-full rounded-3xl border border-border/80 bg-card/50 p-2 sm:p-3 shadow-2xl backdrop-blur-xl">
      {/* Top Interactive Tab Bar */}
      <div className="flex overflow-x-auto no-scrollbar items-center gap-2 border-b border-border/60 pb-3 px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "group relative flex shrink-0 items-center gap-2.5 rounded-2xl px-4 py-2.5 font-space text-xs font-bold transition-all duration-300",
                isActive
                  ? "bg-background text-foreground shadow-md border border-border"
                  : "text-muted-foreground hover:bg-card/80 hover:text-foreground border border-transparent"
              )}
            >
              <div className={cn("flex h-6 w-6 items-center justify-center rounded-lg border", tab.bg)}>
                <Icon className={cn("h-3.5 w-3.5", tab.color)} />
              </div>
              <span>{tab.label}</span>
              <span className="hidden md:inline-block rounded-md bg-muted/60 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
                {tab.badge}
              </span>
              {isActive && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute inset-x-2 -bottom-3 h-0.5 bg-primary"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Main Interactive Workbench Screen */}
      <div className="p-4 sm:p-6">
        <AnimatePresence mode="wait">
          {/* TAB 1: INVOICING & ETHIOPIAN TAX */}
          {activeTab === "invoicing" && (
            <motion.div
              key="invoicing"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Header Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-space text-base font-bold text-foreground">Tax Invoice #INV-2026-0841</span>
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                      VAT COMPLIANT
                    </span>
                  </div>
                  <p className="font-mono text-xs text-muted-foreground mt-0.5">
                    Customer: Ethio Telecom Enterprise Solutions · TIN: 0019283741
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer font-mono text-xs text-muted-foreground hover:text-foreground">
                    <input
                      type="checkbox"
                      checked={applyVat}
                      onChange={(e) => setApplyVat(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                    />
                    <span>15% VAT</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer font-mono text-xs text-muted-foreground hover:text-foreground">
                    <input
                      type="checkbox"
                      checked={applyWithholding}
                      onChange={(e) => setApplyWithholding(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                    />
                    <span>2% WHT</span>
                  </label>
                </div>
              </div>

              {/* Item Lines Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="border-b border-border/70 text-muted-foreground">
                    <tr>
                      <th className="pb-2 font-bold">Item Description</th>
                      <th className="pb-2 text-center font-bold">Qty</th>
                      <th className="pb-2 text-right font-bold">Unit Price (ETB)</th>
                      <th className="pb-2 text-right font-bold">Total (ETB)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {invoiceItems.map((item, idx) => (
                      <tr key={idx} className="group hover:bg-card/40">
                        <td className="py-2.5 font-sans font-medium text-foreground">{item.desc}</td>
                        <td className="py-2.5 text-center tabular-nums text-muted-foreground">{item.qty}</td>
                        <td className="py-2.5 text-right tabular-nums text-muted-foreground">{formatETB(item.price)}</td>
                        <td className="py-2.5 text-right font-bold tabular-nums text-foreground">{formatETB(item.qty * item.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Calculation Summary Box */}
              <div className="flex flex-col sm:flex-row items-end justify-between gap-6 pt-4 border-t border-border/70">
                <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/60 p-3 text-xs">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <QrCode className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-space font-bold text-foreground">Telebirr & CBE Payment QR</p>
                    <p className="font-mono text-[10px] text-muted-foreground">Instant B2B invoice settlement enabled</p>
                  </div>
                </div>

                <div className="w-full sm:w-72 space-y-2 font-mono text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal:</span>
                    <span className="tabular-nums font-semibold text-foreground">{formatETB(subtotal)} ETB</span>
                  </div>
                  {applyVat && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>VAT (15%):</span>
                      <span className="tabular-nums font-semibold text-foreground">+{formatETB(vatAmount)} ETB</span>
                    </div>
                  )}
                  {applyWithholding && (
                    <div className="flex justify-between text-red-700 dark:text-red-300">
                      <span>Withholding (2%):</span>
                      <span className="tabular-nums font-semibold">-{formatETB(withholdingAmount)} ETB</span>
                    </div>
                  )}
                  <div className="h-px bg-border/80 my-1" />
                  <div className="flex justify-between items-baseline pt-1">
                    <span className="font-space text-sm font-bold text-foreground">Total Payable:</span>
                    <span className="font-space text-xl font-extrabold text-primary tabular-nums">
                      {formatETB(totalAmount)} <span className="text-xs font-normal text-muted-foreground">ETB</span>
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 2: INVENTORY & MULTI-WAREHOUSE */}
          {activeTab === "inventory" && (
            <motion.div
              key="inventory"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
                <div>
                  <h4 className="font-space text-base font-bold text-foreground">Multi-Warehouse Stock Ledger</h4>
                  <p className="font-mono text-xs text-muted-foreground">Real-time inventory levels, batch tracking, & reorder points</p>
                </div>

                {/* Warehouse Selector */}
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <select
                    value={selectedWarehouse}
                    onChange={(e) => setSelectedWarehouse(e.target.value)}
                    className="rounded-xl border border-border/80 bg-background px-3 py-1.5 font-space text-xs font-bold text-foreground focus:border-primary focus:outline-none"
                  >
                    <option>Addis Ababa Central Hub</option>
                    <option>Hawassa Regional Warehouse</option>
                    <option>Dire Dawa Distribution Center</option>
                  </select>
                </div>
              </div>

              {/* Stock Items Grid */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {stockItems.map((item) => {
                  const isLow = item.stock <= item.min;
                  return (
                    <div
                      key={item.sku}
                      className={cn(
                        "rounded-2xl border p-4 transition-all duration-300",
                        isLow
                          ? "border-amber-500/40 bg-amber-500/5 shadow-sm"
                          : "border-border/60 bg-card/40 hover:border-primary/40 hover:bg-card/70"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{item.sku}</span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 font-mono text-[10px] font-bold",
                            isLow ? "bg-amber-500/10 text-amber-800 dark:text-amber-300" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          )}
                        >
                          {item.status}
                        </span>
                      </div>
                      <h5 className="font-space text-sm font-bold text-foreground mb-1 leading-snug">{item.name}</h5>
                      <div className="flex items-baseline justify-between mt-3 pt-2 border-t border-border/40 font-mono text-xs">
                        <span className="text-muted-foreground">
                          Stock: <strong className="text-foreground">{item.stock} {item.unit}</strong> (Min: {item.min})
                        </span>
                        <span className="font-bold text-primary">{formatETB(item.price)} ETB</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/50 p-3 font-mono text-xs text-muted-foreground">
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  <CheckCircle2 className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                  <span>Automated Purchase Reorder Triggers</span>
                </div>
                <span>Sync frequency: Instantaneous Websocket</span>
              </div>
            </motion.div>
          )}

          {/* TAB 3: FLEET & LOGISTICS */}
          {activeTab === "fleet" && (
            <motion.div
              key="fleet"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
                <div>
                  <h4 className="font-space text-base font-bold text-foreground">Live Fleet Telemetry & Dispatches</h4>
                  <p className="font-mono text-xs text-muted-foreground">GPS vehicle tracking, driver performance, & automated fuel logs</p>
                </div>
                <span className="flex items-center gap-2 font-mono text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                  3 Active Dispatches
                </span>
              </div>

              {/* Fleet Cards */}
              <div className="space-y-3">
                {fleetVehicles.map((v) => (
                  <div
                    key={v.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card/40 p-4 transition-all hover:border-primary/40 hover:bg-card/70"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
                        <Truck className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-foreground">{v.id}</span>
                          <span className="text-xs text-muted-foreground">· {v.model}</span>
                        </div>
                        <p className="font-sans text-xs text-muted-foreground mt-0.5">
                          Driver: <strong className="text-foreground">{v.driver}</strong> · Route: <span className="text-primary">{v.route}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-5 font-mono text-xs">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Fuel className="h-3.5 w-3.5 text-amber-800 dark:text-amber-300" />
                        <span>{v.fuel}% Fuel</span>
                      </div>
                      <span className="font-bold text-foreground">{v.speed}</span>
                      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary">
                        {v.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* TAB 4: PROCUREMENT & VENDORS */}
          {activeTab === "procurement" && (
            <motion.div
              key="procurement"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between border-b border-border/60 pb-4">
                <div>
                  <h4 className="font-space text-base font-bold text-foreground">Procurement & RFQ Comparison Matrix</h4>
                  <p className="font-mono text-xs text-muted-foreground">Automated supplier tender evaluations and three-way PO matching</p>
                </div>
                <span className="rounded-full bg-primary/10 px-3 py-1 font-mono text-xs font-bold text-primary">
                  PO-2026-910
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { supplier: "Muger Cement Enterprise", quote: "ETB 1,120,000", lead: "3 Days", rating: "98% On-Time", winner: true },
                  { supplier: "National Cement SC", quote: "ETB 1,180,000", lead: "5 Days", rating: "94% On-Time", winner: false },
                  { supplier: "Dangote Industries Ethiopia", quote: "ETB 1,210,000", lead: "2 Days", rating: "96% On-Time", winner: false },
                ].map((bid, i) => (
                  <div
                    key={i}
                    className={cn(
                      "rounded-2xl border p-4 transition-all relative overflow-hidden",
                      bid.winner
                        ? "border-emerald-500/40 bg-emerald-500/5 shadow-md shadow-emerald-500/5"
                        : "border-border/60 bg-card/40 opacity-80"
                    )}
                  >
                    {bid.winner && (
                      <span className="absolute top-2 right-2 rounded-md bg-emerald-500 text-white font-mono text-[9px] font-bold px-1.5 py-0.5">
                        RECOMMENDED
                      </span>
                    )}
                    <h5 className="font-space text-sm font-bold text-foreground mb-2 pr-12">{bid.supplier}</h5>
                    <p className="font-space text-lg font-extrabold text-foreground mb-2">{bid.quote}</p>
                    <div className="space-y-1 font-mono text-xs text-muted-foreground">
                      <p>Lead time: <strong className="text-foreground">{bid.lead}</strong></p>
                      <p>Reliability: <strong className="text-emerald-700 dark:text-emerald-300">{bid.rating}</strong></p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* TAB 5: FINANCIAL LEDGER */}
          {activeTab === "ledger" && (
            <motion.div
              key="ledger"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between border-b border-border/60 pb-4">
                <div>
                  <h4 className="font-space text-base font-bold text-foreground">Real-Time General Ledger & P&L</h4>
                  <p className="font-mono text-xs text-muted-foreground">Consolidated financial health across all operational branches</p>
                </div>
                <span className="font-mono text-xs text-muted-foreground">FY 2025/2026</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-border/60 bg-card/40 p-4">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Total Revenue (YTD)</span>
                  <p className="mt-1 font-space text-2xl font-black text-emerald-700 dark:text-emerald-300">ETB 48.2M</p>
                  <p className="mt-1 font-mono text-[11px] text-emerald-700 dark:text-emerald-300">+22.4% vs last period</p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-card/40 p-4">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Operating Expenses</span>
                  <p className="mt-1 font-space text-2xl font-black text-foreground">ETB 31.8M</p>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">Payroll, Logistics, Raw Materials</p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-card/40 p-4">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Net Operating Profit</span>
                  <p className="mt-1 font-space text-2xl font-black text-primary">ETB 16.4M</p>
                  <p className="mt-1 font-mono text-[11px] text-primary">34.0% Operating Margin</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Workbench CTA */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border/60 bg-card/30 px-5 py-3.5 rounded-2xl mt-2 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground font-mono">
          <ShieldCheck className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
          <span>Every transaction auto-generates audit logs with tenant schema isolation</span>
        </div>
        <Link href="/auth/signup">
          <Button size="sm" className="gap-1.5 rounded-xl font-space text-xs font-bold uppercase tracking-wider">
            Launch Your ERP Node <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
