"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Boxes,
  CircleDollarSign,
  Loader2,
  Factory,
  FileText,
  Layers,
  Star,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { fetchB2BOverview } from "@/modules/b2b-marketplace/api";

const COLORS = ["#6366f1", "#f59e0b", "#ec4899", "#10b981", "#8b5cf6", "#0ea5e9", "#ef4444", "#14b8a6"];

const fmtMoney = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : `$${n.toFixed(0)}`;

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-border/60 bg-card/60 p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-black tracking-tight">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export default function B2BAnalyticsDashboard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["b2b", "overview"],
    queryFn: fetchB2BOverview,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-3xl" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-72 rounded-3xl" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-4 text-center">
        <div className="p-4 rounded-full bg-destructive/10 text-destructive">
          <TrendingUp className="h-8 w-8 opacity-50" />
        </div>
        <div className="max-w-md space-y-1">
          <h2 className="text-xl font-black">Analytics unavailable</h2>
          <p className="text-sm text-muted-foreground">
            We couldn't load marketplace analytics. Check your session and try again.
          </p>
        </div>
        <Button variant="outline" className="rounded-full" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  const k = data.kpis;
  const kpiCards = [
    { label: "Active Products", value: k.active_products.toLocaleString(), hint: `${k.total_products} total listings`, icon: Boxes, tone: "from-sky-500/20 to-cyan-500/10 border-sky-500/30" },
    { label: "Verified Suppliers", value: k.verified_suppliers.toLocaleString(), hint: `${k.total_suppliers} registered`, icon: Factory, tone: "from-violet-500/20 to-fuchsia-500/10 border-violet-500/30" },
    { label: "Accepted GMV", value: fmtMoney(k.gmv), hint: `${fmtMoney(k.pipeline_value)} in pipeline`, icon: CircleDollarSign, tone: "from-emerald-500/20 to-teal-500/10 border-emerald-500/30" },
    { label: "Avg. Rating", value: `${k.avg_product_rating}★`, hint: `${k.total_categories} categories`, icon: Star, tone: "from-amber-500/20 to-orange-500/10 border-amber-500/30" },
  ];

  const secondaryStats = [
    { label: "Open Inquiries", value: k.open_inquiries, total: k.total_inquiries, icon: FileText },
    { label: "Accepted Quotes", value: k.accepted_quotes, total: k.total_quotes, icon: Layers },
  ];

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((c) => (
          <div
            key={c.label}
            className={`relative overflow-hidden rounded-3xl border bg-gradient-to-br p-5 ${c.tone}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{c.label}</p>
                <p className="mt-2 text-3xl font-black tracking-tight">{c.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{c.hint}</p>
              </div>
              <div className="rounded-2xl bg-background/60 p-2.5">
                <c.icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Listings trend */}
        <ChartCard title="New Listings" subtitle="Products added · last 14 days">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data.listings_trend}>
              <defs>
                <linearGradient id="b2bTrend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(d: string) => d.slice(5)}
                tick={{ fontSize: 11 }}
                stroke="currentColor"
                className="text-muted-foreground"
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" width={28} />
              <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
              <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} fill="url(#b2bTrend)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Products by category */}
        <ChartCard title="Products by Category" subtitle="Active listings per category">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.products_by_category} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11 }}
                width={120}
                stroke="currentColor"
                className="text-muted-foreground"
              />
              <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} cursor={{ fill: "rgba(99,102,241,0.08)" }} />
              <Bar dataKey="count" radius={[0, 8, 8, 0]}>
                {data.products_by_category.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Suppliers by country */}
        <ChartCard title="Suppliers by Country" subtitle="Geographic distribution">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={data.suppliers_by_country}
                dataKey="count"
                nameKey="country"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={85}
                paddingAngle={3}
                label={(e: any) => `${e.country} (${e.count})`}
                labelLine={false}
                fontSize={11}
              >
                {data.suppliers_by_country.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Price bands */}
        <ChartCard title="Price Distribution" subtitle="Listings by FOB price band">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.price_bands}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} stroke="currentColor" className="text-muted-foreground" />
              <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} cursor={{ fill: "rgba(16,185,129,0.08)" }} />
              <Bar dataKey="count" radius={[8, 8, 0, 0]} fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Top products + funnel stats */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard title="Top Products" subtitle="By buyer traction (reviews)">
            <div className="divide-y divide-border/50">
              {data.top_products.map((p, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-black text-primary">
                    {i + 1}
                  </span>
                  <span className="flex-1 truncate text-sm font-semibold">{p.name}</span>
                  <span className="inline-flex items-center gap-1 text-xs text-amber-500">
                    <Star className="h-3.5 w-3.5 fill-current" /> {p.rating}
                  </span>
                  <span className="w-16 text-right text-xs text-muted-foreground">{p.reviews.toLocaleString()}</span>
                  <span className="w-16 text-right text-sm font-bold text-primary">{fmtMoney(p.price)}</span>
                </div>
              ))}
              {data.top_products.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">No products yet.</p>
              )}
            </div>
          </ChartCard>
        </div>

        <ChartCard title="Sourcing Funnel" subtitle="Inquiries & quotes">
          <div className="space-y-4">
            {secondaryStats.map((s) => (
              <div key={s.label} className="rounded-2xl border border-border/60 bg-background/40 p-4">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold">
                    <s.icon className="h-4 w-4 text-muted-foreground" /> {s.label}
                  </span>
                  <span className="text-2xl font-black">{s.value}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">of {s.total} total</p>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
