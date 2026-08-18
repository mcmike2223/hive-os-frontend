"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Globe2,
  Heart,
  Loader2,
  MapPin,
  MessageSquare,
  PackageOpen,
  Send,
  ShieldCheck,
  Star,
  Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { getAccessToken } from "@/lib/runtime-context";
import { cn } from "@/lib/utils";
import { B2BApi, B2BDash, type B2BProduct } from "@/modules/b2b-marketplace/api";
import { AddToCartButton } from "@/modules/b2b-marketplace/cart/AddToCartButton";

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={
            "h-3.5 w-3.5 " +
            (i <= Math.round(rating)
              ? "text-amber-500 fill-current"
              : "text-muted-foreground/30")
          }
        />
      ))}
    </span>
  );
}

function RelatedCard({ product }: { product: B2BProduct }) {
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

export default function ProductDetailPage({ id }: { id?: string }) {
  const { data: product, isLoading, isError } = useQuery({
    queryKey: ["b2bProduct", id],
    queryFn: () => B2BApi.product(id!),
    enabled: !!id,
    retry: 1,
  });

  const [rfqOpen, setRfqOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [favBusy, setFavBusy] = useState(false);
  const loggedIn = typeof window !== "undefined" && !!getAccessToken();

  const toggleFavorite = async () => {
    if (!id || favBusy) return;
    setFavBusy(true);
    try {
      const res: any = await B2BDash.toggleFavorite(id);
      setFavorited(!!res?.favorited);
    } catch {
      // Not signed in (or no buyer access) — bounce to sign-in.
      window.location.href = "/sign-in";
    } finally {
      setFavBusy(false);
    }
  };

  const submitRfq = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
    }, 800);
  };

  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      {/* Slim top bar */}
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

      {(isError || (!isLoading && !product)) && (
        <div className="mx-auto max-w-2xl px-4 py-32 text-center">
          <PackageOpen className="mx-auto h-14 w-14 text-muted-foreground/50" />
          <h1 className="mt-6 text-2xl font-black">Product not found</h1>
          <p className="mt-2 text-muted-foreground">
            This listing may have been removed or is no longer available.
          </p>
          <Button asChild className="mt-8 rounded-xl">
            <Link href="/">Browse the marketplace</Link>
          </Button>
        </div>
      )}

      {product && (
        <main className="mx-auto max-w-6xl px-4 sm:px-8 py-8">
          {/* Breadcrumb */}
          <nav className="mb-6 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link href="/" className="hover:text-primary">Marketplace</Link>
            {product.category && (
              <>
                <ChevronRight className="h-3 w-3" />
                <span>{product.category}</span>
              </>
            )}
            <ChevronRight className="h-3 w-3" />
            <span className="truncate text-foreground font-semibold">{product.name}</span>
          </nav>

          <div className="grid gap-8 lg:grid-cols-2">
            {/* Image */}
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="relative aspect-square overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-muted/30 to-muted/10"
            >
              {product.image && (
                <img
                  src={product.image}
                  alt={product.name}
                  className="h-full w-full object-cover"
                  onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
                />
              )}
              <div className="absolute top-4 left-4 flex flex-wrap gap-2">
                {product.badges.map((b) => (
                  <Badge key={b} className="bg-background/90 text-foreground border border-border/60 shadow">
                    {b}
                  </Badge>
                ))}
              </div>
            </motion.div>

            {/* Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
              className="flex flex-col"
            >
              <h1 className="text-2xl sm:text-3xl font-black leading-tight tracking-tight">{product.name}</h1>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <Stars rating={product.rating} />
                  <span className="font-bold">{product.rating}</span>
                  <span className="text-muted-foreground">· {product.reviews.toLocaleString()} reviews</span>
                </span>
                {product.location && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-4 w-4" /> {product.location}
                  </span>
                )}
              </div>

              <div className="mt-6 rounded-2xl border border-border/60 bg-card/60 p-5">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">FOB Price</p>
                <p className="text-4xl font-black text-primary leading-none mt-1">{product.price}</p>
                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Min. Order (MOQ)</p>
                    <p className="font-bold">{product.moq}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Lead Time</p>
                    <p className="font-bold inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> {product.lead_time}
                    </p>
                  </div>
                </div>
                {product.trade_assurance && (
                  <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck className="h-4 w-4" /> Trade Assurance protected
                  </div>
                )}
              </div>

              <div className="mt-5">
                <AddToCartButton
                  product={{ id: product.id, name: product.name, image: product.image, supplier: product.supplier, priceLabel: product.price, moq: product.moq }}
                  size="lg"
                  label="Add to Cart"
                  className="w-full h-12 text-base"
                />
              </div>

              <div className="mt-3 flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={() => { setSubmitted(false); setRfqOpen(true); }}
                  className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground font-bold gap-2"
                >
                  <FileText className="h-4 w-4" /> Request a Quote
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setSubmitted(false); setRfqOpen(true); }}
                  className="flex-1 h-12 rounded-xl font-bold gap-2"
                >
                  <MessageSquare className="h-4 w-4" /> Contact Supplier
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={toggleFavorite}
                  disabled={favBusy}
                  title={loggedIn ? "Save to favorites" : "Sign in to save"}
                  className="h-12 w-12 rounded-xl shrink-0"
                >
                  <Heart className={cn("h-5 w-5", favorited && "fill-rose-500 text-rose-500")} />
                </Button>
              </div>

              {/* Supplier */}
              {product.supplier_detail && (
                <Link
                  href={`/marketplace/supplier/${product.supplier_detail.id}`}
                  className="mt-6 flex items-center gap-4 rounded-2xl border border-border/60 bg-card/40 p-4 hover:border-primary/40 transition-all"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-sm font-black text-primary border border-primary/20">
                    {product.supplier_detail.logo || product.supplier?.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm inline-flex items-center gap-1.5">
                      {product.supplier_detail.name}
                      {product.supplier_detail.verified && <BadgeCheck className="h-4 w-4 text-blue-500" />}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {product.supplier_detail.flag} {product.supplier_detail.country} · {product.supplier_detail.years} yrs · {product.supplier_detail.rating}★
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </Link>
              )}
            </motion.div>
          </div>

          {/* Description */}
          {product.description && (
            <section className="mt-12">
              <h2 className="text-lg font-black mb-3">Product Overview</h2>
              <p className="text-muted-foreground leading-relaxed max-w-3xl">{product.description}</p>
            </section>
          )}

          {/* Related */}
          {product.related?.length > 0 && (
            <section className="mt-14">
              <h2 className="text-lg font-black mb-5 inline-flex items-center gap-2">
                <Store className="h-5 w-5 text-primary" /> More in {product.category || "this category"}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {product.related.map((r) => (
                  <RelatedCard key={r.id} product={r} />
                ))}
              </div>
            </section>
          )}
        </main>
      )}

      {/* RFQ / Contact dialog (simulated submit) */}
      <Dialog open={rfqOpen} onOpenChange={setRfqOpen}>
        <DialogContent className="sm:max-w-md">
          {submitted ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
              <DialogTitle className="mt-4">Request sent</DialogTitle>
              <DialogDescription className="mt-2">
                The supplier will respond to your inquiry shortly.
              </DialogDescription>
              <Button className="mt-6 rounded-xl" onClick={() => setRfqOpen(false)}>Done</Button>
            </div>
          ) : (
            <form onSubmit={submitRfq}>
              <DialogHeader>
                <DialogTitle className="inline-flex items-center gap-2">
                  <Globe2 className="h-5 w-5 text-primary" /> Request a Quote
                </DialogTitle>
                <DialogDescription>{product?.name}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-4">
                <Input required placeholder="Your name" />
                <Input required type="email" placeholder="Work email" />
                <Input placeholder="Company" />
                <Textarea
                  required
                  placeholder="Quantity, target price, customization, delivery terms…"
                  defaultValue={product ? `I'm interested in "${product.name}" (MOQ ${product.moq}). Please send your best quote.` : ""}
                  rows={4}
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={submitting} className="w-full rounded-xl gap-2">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {submitting ? "Sending…" : "Send Request"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
