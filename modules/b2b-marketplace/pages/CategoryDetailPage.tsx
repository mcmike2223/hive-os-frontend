"use client";

import React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BadgeCheck,
  Clock,
  Loader2,
  MapPin,
  PackageOpen,
  ShieldCheck,
  Star,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { B2BApi, type B2BProduct, type B2BSupplier } from "@/modules/b2b-marketplace/api";

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
        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          {product.badges.slice(0, 2).map((b) => (
            <Badge key={b} className="bg-background/90 text-foreground border border-border/60 text-[11px]">{b}</Badge>
          ))}
        </div>
      </div>
      <div className="p-4">
        <p className="line-clamp-2 text-sm font-bold leading-snug min-h-[2.5rem]">{product.name}</p>
        <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
          <Star className="h-3 w-3 text-amber-500 fill-current" /> {product.rating} · {product.reviews.toLocaleString()}
        </div>
        <p className="mt-2 text-lg font-black text-primary">{product.price}</p>
        <p className="text-[11px] text-muted-foreground">MOQ: {product.moq}</p>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
          {product.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{product.location}</span>}
          {product.lead_time && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{product.lead_time}</span>}
        </div>
      </div>
    </Link>
  );
}

function SupplierTile({ supplier }: { supplier: B2BSupplier }) {
  return (
    <Link
      href={`/marketplace/supplier/${supplier.id}`}
      className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/60 p-4 hover:border-primary/40 transition-all"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-sm font-black text-primary border border-primary/20">
        {supplier.logo || supplier.name?.slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold inline-flex items-center gap-1">
          {supplier.name}{supplier.verified && <BadgeCheck className="h-3.5 w-3.5 text-blue-500" />}
        </p>
        <p className="text-xs text-muted-foreground">{supplier.flag} {supplier.country} · {supplier.rating}★</p>
      </div>
    </Link>
  );
}

export default function CategoryDetailPage({ slug }: { slug?: string }) {
  const { data: cat, isLoading, isError } = useQuery({
    queryKey: ["b2bCategory", slug],
    queryFn: () => B2BApi.category(slug!),
    enabled: !!slug,
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
        <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      )}

      {(isError || (!isLoading && !cat)) && (
        <div className="mx-auto max-w-2xl px-4 py-32 text-center">
          <PackageOpen className="mx-auto h-14 w-14 text-muted-foreground/50" />
          <h1 className="mt-6 text-2xl font-black">Category not found</h1>
          <Button asChild className="mt-8 rounded-xl"><Link href="/">Browse the marketplace</Link></Button>
        </div>
      )}

      {cat && (
        <main>
          {/* Hero banner */}
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative overflow-hidden border-b border-border/60"
          >
            {cat.image && (
              <img src={cat.image} alt={cat.name} className="absolute inset-0 h-full w-full object-cover opacity-30" onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/40" />
            <div className="relative mx-auto max-w-6xl px-4 sm:px-8 py-16">
              <Badge className="mb-3 bg-primary/10 text-primary border-primary/20">Industry Category</Badge>
              <h1 className="text-4xl sm:text-5xl font-black tracking-tight">{cat.name}</h1>
              {cat.description && <p className="mt-3 max-w-2xl text-muted-foreground">{cat.description}</p>}
              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-card/70 border border-border/60 px-3 py-1 font-bold">
                  {cat.product_count} products
                </span>
                {cat.growth && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 font-bold text-emerald-600 dark:text-emerald-400">
                    <TrendingUp className="h-3.5 w-3.5" /> {cat.growth} demand
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 rounded-full bg-card/70 border border-border/60 px-3 py-1 font-bold">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> {cat.suppliers.length} verified suppliers
                </span>
              </div>
            </div>
          </motion.section>

          <div className="mx-auto max-w-6xl px-4 sm:px-8 py-10 space-y-12">
            {/* Products */}
            <section>
              <h2 className="text-lg font-black mb-5">Products in {cat.name}</h2>
              {cat.products.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active listings in this category yet.</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {cat.products.map((p) => <ProductTile key={p.id} product={p} />)}
                </div>
              )}
            </section>

            {/* Suppliers */}
            {cat.suppliers.length > 0 && (
              <section>
                <h2 className="text-lg font-black mb-5">Suppliers serving {cat.name}</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {cat.suppliers.map((s) => <SupplierTile key={s.id} supplier={s} />)}
                </div>
              </section>
            )}
          </div>
        </main>
      )}
    </div>
  );
}
