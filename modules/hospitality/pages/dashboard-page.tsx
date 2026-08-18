"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarCheck2,
  CircleDollarSign,
  Loader2,
  ReceiptText,
  Sofa,
  Utensils,
  TrendingUp,
  Plus,
  Map as MapIcon,
  Users,
  Coins,
  TrendingDown,
  DollarSign,
  Gift,
  Megaphone,
} from "lucide-react";
import { motion } from "framer-motion";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchHospitalityOverview } from "@/modules/hospitality/api";
import { cn } from "@/lib/utils";

const cardStyles = [
  "from-sky-500/20 to-cyan-500/10 border-sky-500/30",
  "from-amber-500/20 to-orange-500/10 border-amber-500/30",
  "from-violet-500/20 to-fuchsia-500/10 border-violet-500/30",
  "from-emerald-500/20 to-teal-500/10 border-emerald-500/30",
];

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  AreaChart,
  Area,
} from "recharts";

const COLORS = ["#6366f1", "#f59e0b", "#ec4899", "#10b981", "#8b5cf6"];

export default function HospitalityDashboardPage() {
  const [financialPeriod, setFinancialPeriod] = useState<"daily" | "weekly" | "monthly">("daily");

  const { data: overview, isLoading, isError } = useQuery({
    queryKey: ["hospitality", "overview"],
    queryFn: fetchHospitalityOverview,
  });

  if (isLoading) {
    return (
      <div className="space-y-8 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-4 w-full max-w-2xl" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-40 rounded-full" />
            <Skeleton className="h-10 w-40 rounded-full" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-3xl" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !overview) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4 text-center">
        <div className="p-4 rounded-full bg-destructive/10 text-destructive">
          <Utensils className="h-8 w-8 opacity-50" />
        </div>
        <div className="max-w-md space-y-2">
          <h2 className="text-xl font-black tracking-tight">Dashboard Unavailable</h2>
          <p className="text-sm text-muted-foreground">
            We're having trouble loading the hospitality operations data. Please ensure your session is valid and try again.
          </p>
        </div>
        <Button 
          variant="outline" 
          className="rounded-full"
          onClick={() => window.location.reload()}
        >
          Retry Connection
        </Button>
      </div>
    );
  }

  const isNightclub = overview.business_type === "nightclub";
  const locationLabel = isNightclub ? "Sofa" : "Table";
  const locationLabelPlural = isNightclub ? "Sofas" : "Tables";

  const summaryCards = [
    {
      label: `Active ${locationLabelPlural}`,
      value: `${overview.tables?.active || 0}/${overview.tables?.total || 0}`,
      hint: `${overview.tables?.available || 0} available now`,
      icon: Sofa,
      href: "/dashboard/hospitality/tables",
    },
    {
      label: "Pending Reservations",
      value: String(overview.reservations?.pending || 0),
      hint: `${overview.reservations?.today_total || 0} bookings today`,
      icon: CalendarCheck2,
      href: "/dashboard/hospitality/reservations",
    },
    {
      label: "Open Service Orders",
      value: String(overview.orders?.open || 0),
      hint: `${overview.orders?.closed_today || 0} closed today`,
      icon: ReceiptText,
      href: "/dashboard/hospitality/service-orders",
    },
    {
      label: "Revenue Today",
      value: `ETB ${(overview.orders?.revenue_today || 0).toLocaleString()}`,
      hint: "Closed orders only",
      icon: CircleDollarSign,
      href: "/dashboard/inventory",
    },
  ];

  return (
    <div className="relative space-y-10 pb-20 overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-violet-500/5 rounded-full blur-[100px] animate-breathe" />
        <div className="absolute inset-0 tech-grid opacity-[0.03] dark:opacity-[0.07]" />
      </div>

      <motion.section 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[2.5rem] border border-border/40 bg-gradient-to-br from-indigo-500/10 via-violet-500/5 to-background p-8"
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 text-xs font-black uppercase tracking-[0.2em]">
              <TrendingUp className="h-3 w-3" />
              {isNightclub ? "Nightclub Intelligence" : "Real-time Operations"}
            </div>
            <h1 className="flex items-center gap-4 text-4xl font-black tracking-tight">
              <span className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-3 text-indigo-500 shadow-lg shadow-indigo-500/20">
                <Utensils className="h-8 w-8" />
              </span>
              Hospitality Center
            </h1>
            <p className="max-w-2xl text-base text-muted-foreground font-medium leading-relaxed">
              Manage floor layout, reservations, service orders, menu, events, and customer operations from one premium cockpit.
              {isNightclub && " Optimized for lounge and VIP management."}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="rounded-full px-8 shadow-xl shadow-primary/20 transition-all hover:scale-105 active:scale-95">
              <Link href="/dashboard/hospitality/reservations">
                New Reservation
                <Plus className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-full px-8 backdrop-blur-sm border-border/60 hover:bg-background/80">
              <Link href="/dashboard/hospitality/space" className="flex items-center gap-2">
                <MapIcon className="h-5 w-5" />
                Space View
              </Link>
            </Button>
            {isNightclub && (
              <Button asChild variant="secondary" size="lg" className="rounded-full px-8 backdrop-blur-sm border-border/60">
                <Link href="/dashboard/hospitality/door" className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Door Check-in
                </Link>
              </Button>
            )}
            <Button asChild variant="ghost" size="lg" className="rounded-full px-8 opacity-60 hover:opacity-100">
              <Link href="/dashboard/hospitality/tables">View {locationLabelPlural}</Link>
            </Button>
          </div>
        </div>
      </motion.section>

      {/* Financial Overview Cockpit */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[2.5rem] border border-border/40 bg-card/30 backdrop-blur-md p-8 shadow-sm space-y-6"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
              <Coins className="h-6 w-6 text-indigo-500 animate-pulse" />
              Financial Overview
            </h2>
            <p className="text-sm text-muted-foreground font-medium">
              Monitor sales income, operational expenses, and net revenue.
            </p>
          </div>
          <div className="inline-flex rounded-full border border-border/60 bg-background/50 p-1">
            {(["daily", "weekly", "monthly"] as const).map((period) => (
              <button
                key={period}
                onClick={() => setFinancialPeriod(period)}
                className={cn(
                  "rounded-full px-5 py-1.5 text-xs font-black uppercase tracking-wider transition-all",
                  financialPeriod === period
                    ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/80"
                )}
              >
                {period}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {/* Income Card */}
          <div className="relative overflow-hidden rounded-[2rem] border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-6 transition-all hover:scale-[1.02]">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-600/80 dark:text-emerald-400/80">Sales Income</p>
                <h3 className="text-3xl font-black tracking-tight">
                  ETB {(overview.financials?.[financialPeriod]?.income || 0).toLocaleString()}
                </h3>
                <p className="text-xs text-muted-foreground font-bold">Gross income from closed orders</p>
              </div>
              <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-500">
                <Coins className="h-6 w-6" />
              </div>
            </div>
          </div>

          {/* Expenses Card */}
          <div className="relative overflow-hidden rounded-[2rem] border border-rose-500/20 bg-gradient-to-br from-rose-500/10 to-rose-500/5 p-6 transition-all hover:scale-[1.02]">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-rose-600/80 dark:text-rose-400/80">Total Expenses</p>
                <h3 className="text-3xl font-black tracking-tight">
                  ETB {(overview.financials?.[financialPeriod]?.expenses || 0).toLocaleString()}
                </h3>
                <p className="text-xs text-muted-foreground font-bold">COGS, purchases & operating costs</p>
              </div>
              <div className="rounded-2xl bg-rose-500/10 p-3 text-rose-500">
                <TrendingDown className="h-6 w-6" />
              </div>
            </div>
          </div>

          {/* Marketing Comps Card */}
          <div className="relative overflow-hidden rounded-[2rem] border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-amber-500/5 p-6 transition-all hover:scale-[1.02]">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-600/80 dark:text-amber-400/80">Marketing Comps</p>
                <h3 className="text-3xl font-black tracking-tight">
                  ETB {(overview.financials?.[financialPeriod]?.comps || 0).toLocaleString()}
                </h3>
                <p className="text-xs text-muted-foreground font-bold">Cost of complimentary items</p>
              </div>
              <div className="rounded-2xl bg-amber-500/10 p-3 text-amber-500">
                <Gift className="h-6 w-6" />
              </div>
            </div>
          </div>

          {/* Net Profit Card */}
          <div className={cn(
            "relative overflow-hidden rounded-[2rem] border p-6 transition-all hover:scale-[1.02]",
            (overview.financials?.[financialPeriod]?.net_revenue || 0) >= 0
              ? "border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 to-indigo-500/5 text-foreground"
              : "border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-amber-500/5 text-foreground"
          )}>
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-600/80 dark:text-indigo-400/80">Net Revenue</p>
                <h3 className="text-3xl font-black tracking-tight">
                  ETB {(overview.financials?.[financialPeriod]?.net_revenue || 0).toLocaleString()}
                </h3>
                <p className="text-xs text-muted-foreground font-bold">Net take-home profit margins</p>
              </div>
              <div className={cn(
                "rounded-2xl p-3",
                (overview.financials?.[financialPeriod]?.net_revenue || 0) >= 0 ? "bg-indigo-500/10 text-indigo-500" : "bg-amber-500/10 text-amber-500"
              )}>
                <DollarSign className="h-6 w-6" />
              </div>
            </div>
          </div>
        </div>

        {/* Comparison Bar Chart */}
        <div className="h-[200px] w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={[
                {
                  name: "Financial Comparison",
                  Income: overview.financials?.[financialPeriod]?.income || 0,
                  Expenses: overview.financials?.[financialPeriod]?.expenses || 0,
                  Profit: overview.financials?.[financialPeriod]?.net_revenue || 0,
                }
              ]}
              barGap={12}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.1} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} hide />
              <YAxis axisLine={false} tickLine={false} fontSize={11} fontWeight={600} tickFormatter={(val) => `ETB ${val.toLocaleString()}`} />
              <Tooltip 
                contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                formatter={(val: any) => `ETB ${val.toLocaleString()}`}
              />
              <Bar dataKey="Income" fill="#10b981" name="Sales Income" radius={[8, 8, 0, 0]} maxBarSize={80} />
              <Bar dataKey="Expenses" fill="#f43f5e" name="Total Expenses" radius={[8, 8, 0, 0]} maxBarSize={80} />
              <Bar dataKey="Profit" fill="#6366f1" name="Net Revenue" radius={[8, 8, 0, 0]} maxBarSize={80} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.section>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
            >
              <Link
                href={card.href}
                className={cn(
                  "group relative block overflow-hidden rounded-[2rem] border bg-gradient-to-br p-6 transition-all duration-300",
                  "hover:-translate-y-2 hover:shadow-2xl",
                  cardStyles[index]
                )}
              >
                <div className="relative z-10 flex items-start justify-between">
                  <div className="space-y-2">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">{card.label}</p>
                    <h2 className="text-4xl font-black tracking-tighter">{card.value}</h2>
                    <p className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                      {card.hint}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-indigo-500/10 p-3 text-indigo-500 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110">
                    <Icon className="h-6 w-6" />
                  </div>
                </div>
                <div className="absolute -bottom-6 -right-6 opacity-[0.03] transition-transform duration-500 group-hover:scale-125 group-hover:opacity-[0.06]">
                  <Icon className="h-32 w-32" />
                </div>
              </Link>
            </motion.div>
          );
        })}
      </section>

      {overview.analytics && (
        <div className="space-y-8">
          {/* Row 1: Full-width Revenue Trend (Area Chart) */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[2.5rem] border border-border/40 bg-card/30 backdrop-blur-md p-8 shadow-sm"
          >
            <h3 className="mb-6 text-xl font-black tracking-tight flex items-center gap-2">
              <div className="w-2 h-6 rounded-full bg-indigo-500" />
              Daily Revenue Trend (Last 7 Days)
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={overview.analytics.revenue_trend || []}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.1} />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    fontSize={11} 
                    fontWeight={600} 
                    tickFormatter={(val) => {
                      try {
                        const d = new Date(val);
                        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
                      } catch(e) {
                        return val;
                      }
                    }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    fontSize={11} 
                    fontWeight={600} 
                    tickFormatter={(val) => `ETB ${val.toLocaleString()}`}
                  />
                  <Tooltip 
                    cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '3 3' }}
                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(val: any) => [`ETB ${val.toLocaleString()}`, 'Revenue']}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.section>

          {/* Row 2: Seating Analytics (Two Columns) */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Column 2a: Seating Status */}
            <motion.section
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="rounded-[2.5rem] border border-border/40 bg-card/30 backdrop-blur-md p-8 shadow-sm"
            >
              <h3 className="mb-6 text-xl font-black tracking-tight flex items-center gap-2">
                <div className="w-2 h-6 rounded-full bg-indigo-500" />
                {locationLabel} Occupancy Status
              </h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={(overview.analytics.table_status_breakdown || []).filter((item: any) => item.count > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="count"
                      nameKey="status"
                      label={({ status, count }) => `${status}: ${count}`}
                    >
                      {(overview.analytics.table_status_breakdown || []).map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </motion.section>

            {/* Column 2b: Seating Types distribution */}
            <motion.section
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="rounded-[2.5rem] border border-border/40 bg-card/30 backdrop-blur-md p-8 shadow-sm"
            >
              <h3 className="mb-6 text-xl font-black tracking-tight flex items-center gap-2">
                <div className="w-2 h-6 rounded-full bg-pink-500" />
                Seating Type Distribution
              </h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={(overview.analytics.table_type_breakdown || []).filter((item: any) => item.count > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={0}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="count"
                      nameKey="type"
                      label={({ type, count }) => `${type}: ${count}`}
                    >
                      {(overview.analytics.table_type_breakdown || []).map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </motion.section>
          </div>

          {/* Row 3: Busy Hours & Reservation Outlook */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Column 3a: Busy Hours */}
            <motion.section
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="rounded-[2.5rem] border border-border/40 bg-card/30 backdrop-blur-md p-8 shadow-sm"
            >
              <h3 className="mb-6 text-xl font-black tracking-tight flex items-center gap-2">
                <div className="w-2 h-6 rounded-full bg-amber-500" />
                Today's Order Load (By Hour)
              </h3>
              <div className="h-[300px] w-full flex items-center justify-center">
                {(!overview.analytics.busy_hours || overview.analytics.busy_hours.length === 0) ? (
                  <p className="text-sm text-muted-foreground font-medium">No order activity today yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={overview.analytics.busy_hours || []}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.1} />
                      <XAxis dataKey="hour" axisLine={false} tickLine={false} fontSize={11} fontWeight={600} />
                      <YAxis axisLine={false} tickLine={false} fontSize={12} fontWeight={600} />
                      <Tooltip 
                        cursor={{ fill: 'currentColor', opacity: 0.05 }}
                        contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                      <Bar dataKey="count" fill="#f59e0b" name="Orders" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </motion.section>

            {/* Column 3b: Reservations Outlook */}
            <motion.section
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="rounded-[2.5rem] border border-border/40 bg-card/30 backdrop-blur-md p-8 shadow-sm"
            >
              <h3 className="mb-6 text-xl font-black tracking-tight flex items-center gap-2">
                <div className="w-2 h-6 rounded-full bg-emerald-500" />
                Reservations Forecast (Next 7 Days)
              </h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={overview.analytics.weekly_reservations_trend || []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.1} />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      fontSize={11} 
                      fontWeight={600} 
                      tickFormatter={(val) => {
                        try {
                          const d = new Date(val);
                          return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
                        } catch(e) {
                          return val;
                        }
                      }}
                    />
                    <YAxis axisLine={false} tickLine={false} fontSize={12} fontWeight={600} />
                    <Tooltip 
                      cursor={{ fill: 'currentColor', opacity: 0.05 }}
                      contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="count" fill="#10b981" name="Reservations" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.section>
          </div>

          {/* Row 4: Nightclub Promoters/Arrivals if applicable */}
          {isNightclub && (
            <div className="grid gap-6 lg:grid-cols-2 mb-6">
              <motion.section
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="rounded-[2.5rem] border border-border/40 bg-card/30 backdrop-blur-md p-8 shadow-sm"
              >
                <h3 className="mb-6 text-xl font-black tracking-tight flex items-center gap-2">
                  <div className="w-2 h-6 rounded-full bg-indigo-500" />
                  Guest Arrival Status
                </h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={overview.analytics.guest_arrivals || []}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="count"
                        nameKey="status"
                        label={({ status, count }) => `${status}: ${count}`}
                      >
                        {(overview.analytics.guest_arrivals || []).map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </motion.section>

              <motion.section
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="rounded-[2.5rem] border border-border/40 bg-card/30 backdrop-blur-md p-8 shadow-sm"
              >
                <h3 className="mb-6 text-xl font-black tracking-tight flex items-center gap-2">
                  <div className="w-2 h-6 rounded-full bg-amber-500" />
                  Top Promoters (Today)
                </h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={overview.analytics.promoter_stats || []}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.1} />
                      <XAxis dataKey="promoter.name" axisLine={false} tickLine={false} fontSize={12} fontWeight={600} />
                      <YAxis axisLine={false} tickLine={false} fontSize={12} fontWeight={600} />
                      <Tooltip 
                        cursor={{ fill: 'currentColor', opacity: 0.05 }}
                        contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                      <Bar dataKey="total_guests_brought" fill="#6366f1" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </motion.section>
            </div>
          )}

          {/* Row 5: Popular Items & Comps Breakdown */}
          <div className="grid gap-6 lg:grid-cols-2">
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[2.5rem] border border-border/40 bg-card/30 backdrop-blur-md p-8 shadow-sm"
            >
              <h3 className="mb-6 text-xl font-black tracking-tight flex items-center gap-2">
                <div className="w-2 h-6 rounded-full bg-violet-500" />
                Most Popular Menu Items (Sales Volume)
              </h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={overview.analytics.popular_items || []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.1} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={10} fontWeight={600} />
                    <YAxis axisLine={false} tickLine={false} fontSize={12} fontWeight={600} />
                    <Tooltip 
                      cursor={{ fill: 'currentColor', opacity: 0.05 }}
                      contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="quantity" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[2.5rem] border border-border/40 bg-card/30 backdrop-blur-md p-8 shadow-sm"
            >
              <h3 className="mb-6 text-xl font-black tracking-tight flex items-center gap-2">
                <div className="w-2 h-6 rounded-full bg-amber-500" />
                Marketing Comps Breakdown (By Reason)
              </h3>
              <div className="h-[300px] w-full flex items-center justify-center">
                {!overview.analytics.comps_breakdown || overview.analytics.comps_breakdown.length === 0 ? (
                  <div className="text-center space-y-2">
                    <div className="mx-auto w-10 h-10 rounded-full bg-muted/20 flex items-center justify-center">
                      <Megaphone className="h-5 w-5 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm text-muted-foreground font-medium">No comps tracked yet.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={overview.analytics.comps_breakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        nameKey="reason"
                        label={({ reason, value }) => `${reason}: ETB ${value.toLocaleString()}`}
                      >
                        {overview.analytics.comps_breakdown.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        formatter={(val: any) => `ETB ${val.toLocaleString()}`}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </motion.section>
          </div>
        </div>
      )}

      <motion.section 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[2.5rem] border border-border/40 bg-card/30 backdrop-blur-md p-8 shadow-sm"
      >
        <div className="mb-8 flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl font-black tracking-tight">Upcoming Reservations</h2>
            <p className="text-sm text-muted-foreground font-medium">Scheduled bookings for the next 24 hours</p>
          </div>
          <Button asChild variant="ghost" className="rounded-full text-xs font-black uppercase tracking-widest text-primary hover:bg-primary/5">
            <Link href="/dashboard/hospitality/reservations" className="flex items-center gap-2">
              View Full Queue
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {!overview.upcoming_reservations || overview.upcoming_reservations.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-border/40 bg-background/40 py-16 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted/20 flex items-center justify-center mb-4">
              <CalendarCheck2 className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="text-base font-bold text-muted-foreground/60">No upcoming reservations found</p>
            <p className="text-sm text-muted-foreground/40 mt-1">New bookings will appear here automatically</p>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {overview.upcoming_reservations.map((reservation, i) => (
              <motion.div 
                key={reservation.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="group flex items-center justify-between gap-4 rounded-[1.5rem] border border-border/40 bg-background/50 p-5 transition-all hover:border-indigo-500/30 hover:bg-indigo-500/[0.02]"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500">
                    <span className="text-[11px] font-black uppercase">{new Date(reservation.reservation_time).toLocaleString('en-US', { month: 'short' })}</span>
                    <span className="text-lg font-black leading-none">{new Date(reservation.reservation_time).getDate()}</span>
                  </div>
                  <div>
                    <p className="text-base font-black tracking-tight">{reservation.customer_name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground font-bold">
                      <span>{new Date(reservation.reservation_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="opacity-30">•</span>
                      <span>{reservation.guest_count} Guests</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="hidden sm:flex flex-col items-end gap-1">
                    <Badge variant="secondary" className="rounded-md font-mono text-[11px] bg-muted/50">
                      {reservation.reservation_code ?? `#${reservation.id}`}
                    </Badge>
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{reservation.location?.label ?? `${locationLabel} TBD`}</span>
                  </div>
                  <Badge 
                    variant={reservation.status === "confirmed" ? "default" : "outline"}
                    className={cn(
                      "rounded-full px-3 py-0.5 text-[11px] font-black uppercase tracking-widest",
                      reservation.status === "confirmed" && "bg-emerald-500 hover:bg-emerald-600 border-none"
                    )}
                  >
                    {reservation.status}
                  </Badge>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.section>
    </div>
  );
}

