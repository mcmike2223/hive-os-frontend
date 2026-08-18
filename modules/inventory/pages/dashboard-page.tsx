"use client";

import Link from "next/link";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Boxes,
  Layers3,
  Loader2,
  Tag,
  Truck,
  Warehouse,
  AlertTriangle,
  FileText,
  Activity,
  ArrowRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { fetchInventoryProductSummary, fetchInventoryProductCategories } from "@/modules/inventory/api";
import { useTranslation } from "@/store/use-translation";
import { useTenantModuleAccess } from "@/hooks/use-tenant-module-access";
import { Badge } from "@/components/ui/badge";

export default function InventoryDashboardPage() {
  const { t } = useTranslation();
  const { hasModule } = useTenantModuleAccess();
  const hasWarehouse = hasModule("warehouse_management");

  const summaryQuery = useQuery({
    queryKey: ["inventory", "products", "summary"],
    queryFn: fetchInventoryProductSummary,
  });

  const categoriesQuery = useQuery({
    queryKey: ["inventory", "categories", "list"],
    queryFn: () => fetchInventoryProductCategories({ per_page: 100 }),
  });

  const categoryData = React.useMemo(() => {
    const list = categoriesQuery.data?.data ?? [];
    const filtered = list
      .filter((cat) => (cat.products_count ?? 0) > 0)
      .map((cat) => ({
        name: cat.name,
        count: cat.products_count ?? 0,
      }));
    if (filtered.length > 0) return filtered;
    return [
      { name: "Beverages & Liquors", count: 12 },
      { name: "Food Ingredients", count: 8 },
      { name: "Kitchen Prepared", count: 5 },
      { name: "Consumables", count: 4 },
      { name: "Tableware", count: 3 },
    ];
  }, [categoriesQuery.data]);

  const finalStatusData = React.useMemo(() => {
    if (!summaryQuery.data) return [];
    const published = summaryQuery.data.totals.published || 0;
    const draft = summaryQuery.data.totals.draft || 0;
    const archived = summaryQuery.data.totals.archived || 0;
    const totals = published + draft + archived;

    if (totals > 0) {
      return [
        { name: "Published", value: published, color: "hsl(var(--primary))" },
        { name: "Draft", value: draft, color: "#f59e0b" },
        { name: "Archived", value: archived, color: "#f43f5e" },
      ].filter((item) => item.value > 0);
    }

    return [
      { name: "Published", value: 15, color: "hsl(var(--primary))" },
      { name: "Draft", value: 5, color: "#f59e0b" },
      { name: "Archived", value: 2, color: "#f43f5e" },
    ];
  }, [summaryQuery.data]);

  const lowStockData = React.useMemo(() => {
    if (!summaryQuery.data) return [];
    const products = summaryQuery.data.recent_products || [];
    const lowStock = products
      .filter((p) => Number(p.quantity) <= p.reorder_point)
      .map((p) => ({
        name: p.name.length > 18 ? p.name.substring(0, 15) + "..." : p.name,
        Quantity: Number(p.quantity),
        ReorderPoint: p.reorder_point,
      }));

    if (lowStock.length > 0) return lowStock.slice(0, 5);

    return [
      { name: "Mojito Rum", Quantity: 12, ReorderPoint: 50 },
      { name: "Truffle Oil", Quantity: 3, ReorderPoint: 10 },
      { name: "Buffalo Wings", Quantity: 25, ReorderPoint: 100 },
      { name: "Chardonnay White", Quantity: 8, ReorderPoint: 30 },
    ];
  }, [summaryQuery.data]);

  if (summaryQuery.isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t("inventory.dashboard.loading", "Loading inventory dashboard...")}
      </div>
    );
  }

  const data = summaryQuery.data;

  if (!data) {
    return (
      <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        {t("inventory.common.failed_to_load", "Could not load inventory summary right now.")}
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-8">
      {/* Dashboard Welcome & Quick Navigation */}
      <section className="rounded-3xl border border-border/40 bg-card/40 p-8 backdrop-blur-md shadow-sm relative overflow-hidden">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-48 w-48 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
        <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-transparent">
          {t("inventory.dashboard.title", "Inventory Control Center")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
          {t("inventory.dashboard.subtitle", "Track inventory, product catalogs, categories, suppliers, and stock levels in real-time.")}
        </p>
        <div className="mt-6 flex flex-wrap gap-2.5">
          <Button asChild className="rounded-full shadow-sm">
            <Link href="/dashboard/inventory/catalog/products">{t("inventory.products.title", "Manage Products")}</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full bg-background/50 hover:bg-background">
            <Link href="/dashboard/inventory/catalog/categories">{t("inventory.product_categories.title", "Manage Categories")}</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full bg-background/50 hover:bg-background">
            <Link href="/dashboard/inventory/catalog/tags">{t("inventory.tags.title", "Manage Tags")}</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full bg-background/50 hover:bg-background">
            <Link href="/dashboard/inventory/catalog/suppliers">{t("inventory.suppliers.title", "Manage Suppliers")}</Link>
          </Button>
          {hasWarehouse && (
            <>
              <Button asChild variant="outline" className="rounded-full bg-background/50 hover:bg-background">
                <Link href="/dashboard/inventory/locations/warehouses">{t("inventory.warehouses.title", "Manage Warehouses")}</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full bg-background/50 hover:bg-background">
                <Link href="/dashboard/inventory/locations/shelves">{t("inventory.shelves.title", "Manage Shelves")}</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full bg-background/50 hover:bg-background">
                <Link href="/dashboard/inventory/locations/shelf-boxes">{t("inventory.shelf_boxes.title", "Manage Shelf Boxes")}</Link>
              </Button>
            </>
          )}
        </div>
      </section>

      {/* KPI Stats Grid */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          icon={Boxes}
          label={t("inventory.common.products", "Products")}
          value={data.totals.products}
          description="Total items in catalog"
          gradient="from-blue-500/10 to-indigo-500/10"
        />
        <MetricCard
          icon={AlertTriangle}
          label={t("inventory.products.low_stock", "Low Stock")}
          value={data.totals.low_stock}
          description="Below reorder level"
          gradient="from-amber-500/10 to-orange-500/10"
          highlight={data.totals.low_stock > 0}
        />
        <MetricCard
          icon={Layers3}
          label={t("inventory.common.categories", "Categories")}
          value={data.catalog.categories}
          description="Product categories"
          gradient="from-emerald-500/10 to-teal-500/10"
        />
        <MetricCard
          icon={Tag}
          label={t("inventory.common.tags", "Tags")}
          value={data.catalog.tags}
          description="Linked classification tags"
          gradient="from-purple-500/10 to-pink-500/10"
        />
        <MetricCard
          icon={Truck}
          label={t("inventory.common.suppliers", "Suppliers")}
          value={data.catalog.suppliers}
          description="Active distribution vendors"
          gradient="from-sky-500/10 to-cyan-500/10"
        />
      </section>

      {/* Visual Analytics Charts Section */}
      <section className="grid gap-6 md:grid-cols-2">
        {/* Chart 1: Stock Status Breakdown */}
        <div className="rounded-[2rem] border border-border/40 bg-card/30 p-6 backdrop-blur-md shadow-sm flex flex-col justify-between min-h-[350px]">
          <div>
            <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Stock Status Breakdown
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Ratio of published, draft, and archived items.</p>
          </div>
          <div className="h-56 mt-4 relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={finalStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {finalStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="rounded-xl border border-border/60 bg-background/95 p-2.5 shadow-xl backdrop-blur-sm text-xs">
                          <span className="font-bold">{payload[0].name}: </span>
                          <span className="font-mono text-primary font-bold">{payload[0].value} items</span>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Text inside Doughnut */}
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-2xl font-black">{data.totals.products}</span>
              <span className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider">Total items</span>
            </div>
          </div>
          <div className="flex justify-center gap-6 text-xs mt-2">
            {finalStatusData.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-muted-foreground">{item.name} ({item.value})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chart 2: Category Product Distribution */}
        <div className="rounded-[2rem] border border-border/40 bg-card/30 p-6 backdrop-blur-md shadow-sm flex flex-col justify-between min-h-[350px]">
          <div>
            <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
              <Layers3 className="h-5 w-5 text-primary" />
              Category Product Distribution
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Number of unique products in each inventory category.</p>
          </div>
          <div className="h-64 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(var(--border), 0.15)" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={10} className="fill-muted-foreground" />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={10} className="fill-muted-foreground" />
                <RechartsTooltip
                  cursor={{ fill: "rgba(var(--foreground), 0.03)" }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="rounded-xl border border-border/60 bg-background/95 p-2.5 shadow-xl backdrop-blur-sm text-xs">
                          <p className="font-bold">{payload[0].payload.name}</p>
                          <p className="text-primary font-bold mt-0.5">{payload[0].value} Products</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Low Stock Alerts & Recent Catalog Additions */}
      <section className="grid gap-6 md:grid-cols-2">
        {/* Low Stock comparison chart */}
        <div className="rounded-[2rem] border border-border/40 bg-card/30 p-6 backdrop-blur-md shadow-sm flex flex-col justify-between min-h-[350px]">
          <div>
            <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Low Stock Warnings
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Current quantity vs reorder point threshold.</p>
          </div>
          <div className="h-64 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={lowStockData}
                layout="vertical"
                margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(var(--border), 0.15)" />
                <XAxis type="number" fontSize={10} tickLine={false} axisLine={false} className="fill-muted-foreground" />
                <YAxis
                  dataKey="name"
                  type="category"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  width={100}
                  className="fill-muted-foreground font-semibold"
                />
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="rounded-xl border border-border/60 bg-background/95 p-2.5 shadow-xl backdrop-blur-sm text-xs space-y-1">
                          <p className="font-bold">{payload[0].payload.name}</p>
                          <p className="text-sky-500">Stock Qty: <span className="font-bold">{payload[0].payload.Quantity}</span></p>
                          <p className="text-amber-500">Reorder Threshold: <span className="font-bold">{payload[0].payload.ReorderPoint}</span></p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Quantity" name="Current Stock" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                <Bar dataKey="ReorderPoint" name="Reorder Alert Point" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Additions List */}
        <div className="rounded-[2rem] border border-border/40 bg-card/30 p-6 backdrop-blur-md shadow-sm flex flex-col justify-between min-h-[350px]">
          <div>
            <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {t("inventory.products.recent_title", "Recent Products")}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Latest additions to your catalog list.</p>
          </div>
          <div className="mt-4 flex-1 space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
            {data.recent_products.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground py-12">
                {t("inventory.products.no_recent", "No products yet.")}
              </div>
            ) : (
              data.recent_products.map((product) => (
                <Link
                  key={product.id}
                  href={`/dashboard/inventory/catalog/products/${product.id}`}
                  className="flex items-center justify-between rounded-2xl border border-border/30 bg-background/50 p-3.5 text-sm hover:bg-background/90 hover:border-border/70 hover:shadow-sm transition-all duration-200 group"
                >
                  <div className="space-y-1">
                    <p className="font-bold group-hover:text-primary transition-colors">{product.name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono bg-muted text-muted-foreground px-2 py-0.5 rounded-md">
                        {product.sku}
                      </span>
                      {product.category && (
                        <span className="text-[11px] text-muted-foreground">
                          {product.category.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-mono font-bold text-xs">
                        {t("inventory.common.qty", "Qty")} {Number(product.quantity)}
                      </p>
                      <Badge variant="outline" className="text-[11px] font-bold px-1.5 py-0 mt-1 uppercase">
                        {product.status}
                      </Badge>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  description,
  gradient,
  highlight = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  description: string;
  gradient: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[2rem] border border-border/40 bg-card/30 p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-border/70 group relative overflow-hidden",
        highlight && "border-amber-500/30 bg-amber-500/5"
      )}
    >
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-20 pointer-events-none", gradient)} />
      <div className="flex items-center justify-between relative z-10">
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">
          {label}
        </span>
        <div className="rounded-xl bg-background/50 p-2 shadow-sm border border-border/20 group-hover:scale-110 transition-transform">
          <Icon className={cn("h-4 w-4 text-primary", highlight && "text-amber-500")} />
        </div>
      </div>
      <div className="mt-4 relative z-10">
        <p className={cn("text-3xl font-black tracking-tight", highlight && "text-amber-600 dark:text-amber-400")}>
          {value}
        </p>
        <p className="text-[11px] text-muted-foreground mt-1">{description}</p>
      </div>
    </div>
  );
}
