"use client";

import React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  Clock,
  Globe2,
  Loader2,
  PackageOpen,
  Sparkles,
  Star,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { B2BApi, type B2BProduct } from "@/modules/b2b-marketplace/api";

function ProductTile({ product }: { product: B2BProduct }) {
  return (
    <Link
      href={`/marketplace/product/${product.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/70 backdrop-blur-xl hover:border-primary/40 hover:shadow-xl transition-all"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted/20">
        {product.image && (
          <img
            src={product.image}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
            onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
          />
        )}
      </div>
      <div className="p-4">
        <p className="line-clamp-2 text-sm font-bold leading-snug min-h-[2.5rem]">{product.name}</p>
        <p className="mt-2 text-lg font-black text-primary">{product.price}</p>
        <p className="text-[11px] text-muted-foreground">MOQ: {product.moq}</p>
      </div>
    </Link>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
      <Icon className="h-5 w-5 text-primary" />
      <p className="mt-2 text-xl font-black">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export default function SupplierDetailPage({ id }: { id?: string }) {
  const { data: supplier, isLoading, isError } = useQuery({
    queryKey: ["b2bSupplier", id],
    queryFn: () => B2BApi.supplier(id!),
    enabled: !!id,
    retry: 1,
  });

  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border/60 bg-background/80 px-4 sm:px-8 py-3 backdrop-blur-xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold hover:text-primary transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to marketplace
        </Link>
        <ThemeToggle />
      </header>

      {isLoading && (
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {(isError || (!isLoading && !supplier)) && (
        <div className="mx-auto max-w-2xl px-4 py-32 text-center">
          <PackageOpen className="mx-auto h-14 w-14 text-muted-foreground/50" />
          <h1 className="mt-6 text-2xl font-black">Supplier not found</h1>
          <Button asChild className="mt-8 rounded-xl">
            <Link href="/">Browse the marketplace</Link>
          </Button>
        </div>
      )}

      {supplier && (
        <main className="mx-auto max-w-6xl px-4 sm:px-8 py-8">
          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-primary/10 via-card/60 to-card/30 p-6 sm:p-8"
          >
            <div className="flex flex-col sm:flex-row items-start gap-6">
              <div className="relative h-20 w-20 shrink-0 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-2xl font-black text-primary border border-primary/20">
                {supplier.logo || supplier.name?.slice(0, 2).toUpperCase()}
                {supplier.premium && (
                  <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-amber-500 flex items-center justify-center shadow-md">
                    <Sparkles className="h-3 w-3 text-white" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{supplier.name}</h1>
                  {supplier.verified && <BadgeCheck className="h-6 w-6 text-blue-500" />}
                  {supplier.premium && (
                    <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      Premium
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground inline-flex items-center gap-2">
                  <Globe2 className="h-4 w-4" /> {supplier.flag} {supplier.country}
                  {supplier.industry && <span>· {supplier.industry}</span>}
                </p>
                <div className="mt-2 inline-flex items-center gap-1.5 text-sm">
                  <Star className="h-4 w-4 text-amber-500 fill-current" />
                  <span className="font-bold">{supplier.rating}</span>
                  <span className="text-muted-foreground">rating</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Stats */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Stat icon={Building2} label="Years in business" value={`${supplier.years}`} />
            <Stat icon={TrendingUp} label="Products listed" value={`${supplier.products}`} />
            <Stat
              icon={Clock}
              label="On-time delivery"
              value={supplier.on_time_rate != null ? `${supplier.on_time_rate}%` : "—"}
            />
            <Stat icon={Star} label="Buyer rating" value={`${supplier.rating}★`} />
          </div>

          {/* Products */}
          <section className="mt-12">
            <h2 className="text-lg font-black mb-5">Products from {supplier.name}</h2>
            {supplier.product_list?.length ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {supplier.product_list.map((p) => (
                  <ProductTile key={p.id} product={p} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No active listings yet.</p>
            )}
          </section>
        </main>
      )}
    </div>
  );
}
