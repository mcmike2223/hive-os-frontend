"use client";

import * as React from "react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Factory,
  Store,
  Truck,
  Briefcase,
  Layers,
  CheckCircle2,
  ArrowRight,
  Boxes,
  Calculator,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { SpotlightCard } from "./reveal";
import { SectionShell, SectionHeading, Eyebrow } from "./section";

type IndustryId = "manufacturing" | "distribution" | "logistics" | "services";

const INDUSTRIES = [
  {
    id: "manufacturing" as IndustryId,
    title: "Manufacturing & Processing",
    icon: Factory,
    tag: "Production & BOM",
    desc: "End-to-end production scheduling, multi-stage Bill of Materials (BOM), raw material depletion, and quality inspection workflows.",
    kpis: [
      { label: "BOM Cost Accuracy", value: "99.8%" },
      { label: "Waste Reduction", value: "-18%" },
      { label: "Lead Time", value: "3.2x Faster" },
    ],
    modules: ["Bill of Materials (BOM)", "Work Order Dispatch", "Batch & Lot Expiry Tracking", "Raw Material Inward", "Quality Inspection"],
    quote: "Centralized our production stages and raw material stock across 3 regional factories with zero ledger discrepancy.",
    author: "Operations Lead, Ethiopian Agro-Processing SC",
  },
  {
    id: "distribution" as IndustryId,
    title: "Wholesale & Distribution",
    icon: Store,
    tag: "Multi-Branch & B2B",
    desc: "Manage multiple regional warehouses, wholesale price tiers, credit limit enforcement, and instant B2B Telebirr & CBE digital payment collections.",
    kpis: [
      { label: "Order Fulfilment", value: "99.4%" },
      { label: "Receivables Aging", value: "-24 Days" },
      { label: "Branch Stock Visibility", value: "Real-time" },
    ],
    modules: ["Multi-Warehouse Transfer", "Credit & Aging Control", "B2B Payment Settlement", "Tiered Wholesale Pricing", "Electronic Invoicing"],
    quote: "Our 14 branch warehouses in Addis Ababa, Hawassa, and Bahir Dar now operate under one single live inventory ledger.",
    author: "Managing Director, National Hardware & Metals",
  },
  {
    id: "logistics" as IndustryId,
    title: "Logistics & Fleet Operations",
    icon: Truck,
    tag: "Transit & Tracking",
    desc: "GPS telematics, automated driver dispatching, route optimization, digital waybills, and fuel consumption reconciliation against receipts.",
    kpis: [
      { label: "Fleet Utilization", value: "+32%" },
      { label: "Fuel Discrepancy", value: "-14%" },
      { label: "On-Time Dispatch", value: "98.2%" },
    ],
    modules: ["GPS Vehicle Telemetry", "Automated Waybills", "Driver & Trip Logs", "Maintenance Reminders", "Fuel Receipt Matcher"],
    quote: "Reduced fuel leakage and automated waybill matching for over 80 commercial trucks moving between Djibouti and Addis Ababa.",
    author: "Fleet Logistics Director, Rift Valley Transport",
  },
  {
    id: "services" as IndustryId,
    title: "Corporate & Professional Services",
    icon: Briefcase,
    tag: "Payroll & Billing",
    desc: "Project profitability tracking, client milestone billing, ERCA tax compliance, and automated Ethiopian income tax & pension payroll runs.",
    kpis: [
      { label: "Payroll Run Time", value: "< 15 Mins" },
      { label: "Tax Compliance", value: "100% Guaranteed" },
      { label: "Billable Accuracy", value: "99.9%" },
    ],
    modules: ["Ethiopian Income Tax (ERCA)", "POESSA Pension Splits", "Client Milestone Invoicing", "Expense Claims", "Document Management"],
    quote: "Monthly payroll with ERCA tax tiers and 7%/11% pension for 250+ employees takes less than 15 minutes now.",
    author: "Head of HR & Finance, AfroTech Consulting",
  },
];

export function ErpIndustrySolutions() {
  const [selectedId, setSelectedId] = useState<IndustryId>("manufacturing");
  const active = INDUSTRIES.find((ind) => ind.id === selectedId) || INDUSTRIES[0];
  const Icon = active.icon;

  return (
    <div className="w-full space-y-8">
      {/* Industry Sector Pills */}
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        {INDUSTRIES.map((ind) => {
          const TabIcon = ind.icon;
          const isSelected = selectedId === ind.id;
          return (
            <button
              key={ind.id}
              onClick={() => setSelectedId(ind.id)}
              className={cn(
                "group flex items-center gap-2.5 rounded-full px-5 py-3 font-space text-xs sm:text-sm font-bold transition-all duration-300",
                isSelected
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105"
                  : "border border-border/80 bg-card/50 text-muted-foreground hover:border-primary/40 hover:bg-card hover:text-foreground"
              )}
            >
              <TabIcon className="h-4 w-4" />
              <span>{ind.title}</span>
            </button>
          );
        })}
      </div>

      {/* Active Industry Showcase Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={active.id}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.25 }}
        >
          <SpotlightCard className="overflow-hidden rounded-3xl border border-border/70 bg-card/60 p-6 sm:p-10 backdrop-blur-xl shadow-2xl">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-center">
              {/* Left Column: Context & Features */}
              <div className="lg:col-span-7 space-y-6">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-primary">
                    Tailored ERP Architecture · {active.tag}
                  </span>
                </div>

                <h3 className="font-space text-2xl sm:text-3xl font-extrabold text-foreground leading-tight">
                  {active.title}
                </h3>

                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                  {active.desc}
                </p>

                {/* KPI chips */}
                <div className="grid grid-cols-3 gap-3 pt-2">
                  {active.kpis.map((kpi, i) => (
                    <div key={i} className="rounded-2xl border border-border/60 bg-background/60 p-3 sm:p-4 text-center">
                      <p className="font-space text-xl sm:text-2xl font-black text-primary">{kpi.value}</p>
                      <p className="font-mono text-[10px] sm:text-[11px] text-muted-foreground mt-0.5">{kpi.label}</p>
                    </div>
                  ))}
                </div>

                {/* Included Key Modules */}
                <div className="space-y-2 pt-2">
                  <p className="font-space text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Pre-Configured Core Modules
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {active.modules.map((m, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-card/40 px-3 py-1.5 font-mono text-xs text-foreground"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300" />
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Customer Voice & CTA */}
              <div className="lg:col-span-5 flex flex-col justify-between h-full rounded-2xl border border-border/70 bg-gradient-to-br from-card via-background to-card p-6 sm:p-8 space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-1 text-amber-800 dark:text-amber-300">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span key={i}>★</span>
                    ))}
                  </div>
                  <blockquote className="font-space text-sm sm:text-base font-medium text-foreground italic leading-relaxed">
                    &ldquo;{active.quote}&rdquo;
                  </blockquote>
                  <p className="font-mono text-xs text-muted-foreground font-semibold">
                    — {active.author}
                  </p>
                </div>

                <div className="pt-6 border-t border-border/60 space-y-3">
                  <Link href="/auth/signup" className="block w-full">
                    <Button className="w-full gap-2 rounded-xl py-6 font-space text-sm font-bold uppercase tracking-wider shadow-lg shadow-primary/20">
                      Deploy {active.title.split(" ")[0]} Suite
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <p className="text-center font-mono text-[10px] text-muted-foreground">
                    Instant database schema creation · 100% data sovereignty
                  </p>
                </div>
              </div>
            </div>
          </SpotlightCard>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
