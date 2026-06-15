"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Loader2, Lock, PackageCheck, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { getAccessToken } from "@/lib/runtime-context";
import { useCart } from "@/modules/b2b-marketplace/cart/cart-store";
import { B2BDash, type B2BOrder } from "@/modules/b2b-marketplace/api";

const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CheckoutPage() {
  const { items, subtotal, setQty, remove, clear } = useCart();
  const loggedIn = typeof window !== "undefined" && !!getAccessToken();
  const [placed, setPlaced] = useState<B2BOrder | null>(null);
  const [authError, setAuthError] = useState(false);
  const [form, setForm] = useState({
    shipping_name: "",
    shipping_company: "",
    shipping_email: "",
    shipping_phone: "",
    shipping_address: "",
    notes: "",
  });

  const [payMethod, setPayMethod] = useState<"direct" | "card">("direct");
  const [reference, setReference] = useState("");
  const [paid, setPaid] = useState(false);

  const place = useMutation({
    mutationFn: () =>
      B2BDash.placeOrder({
        items: items.map((i) => ({ product_id: Number(i.id), quantity: i.quantity })),
        ...form,
      }),
    onSuccess: (order) => {
      setPlaced(order);
      clear();
    },
    onError: (err: any) => {
      const status = err?.response?.status;
      if (status === 401 || status === 403) setAuthError(true);
    },
  });

  const payDirect = useMutation({
    mutationFn: () => B2BDash.payOrder(placed!.id, reference || undefined),
    onSuccess: () => setPaid(true),
  });

  const payCard = useMutation({
    mutationFn: () =>
      B2BDash.stripeCheckout(placed!.id, typeof window !== "undefined" ? window.location.origin + "/dashboard/b2b-marketplace" : ""),
    onSuccess: (res) => { if (res?.checkout_url) window.location.href = res.checkout_url; },
  });

  // ── Order placed → payment ──
  if (placed) {
    if (paid) {
      return (
        <Shell>
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="mx-auto max-w-lg py-20 text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15">
              <PackageCheck className="h-10 w-10 text-emerald-500" />
            </div>
            <h1 className="text-3xl font-black">Payment submitted</h1>
            <p className="mt-2 text-muted-foreground">
              Order <span className="font-bold text-foreground">{placed.order_number}</span> · {money(placed.subtotal)}.
              The marketplace will confirm your payment and release the order to the supplier.
            </p>
            <div className="mt-8 flex justify-center gap-3">
              <Button asChild variant="outline" className="rounded-xl"><Link href="/">Continue sourcing</Link></Button>
              <Button asChild className="rounded-xl"><Link href="/dashboard/b2b-marketplace">View my orders</Link></Button>
            </div>
          </motion.div>
        </Shell>
      );
    }
    return (
      <Shell>
        <div className="mx-auto max-w-lg py-12">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-2xl font-black">Order {placed.order_number} created</h1>
            <p className="mt-1 text-sm text-muted-foreground">Complete payment to the marketplace to confirm it.</p>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card/50 p-5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Amount due</span>
              <span className="text-2xl font-black text-primary">{money(placed.subtotal)}</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Paid to the platform (incl. {placed.platform_fee_percent}% handling); the supplier is paid out after delivery.
            </p>

            {/* Method toggle */}
            <div className="mt-5 grid grid-cols-2 gap-2">
              {([
                { k: "direct", label: "Direct / bank transfer", icon: Lock },
                { k: "card", label: "Pay by card (Stripe)", icon: Lock },
              ] as const).map((m) => (
                <button key={m.k} type="button" onClick={() => setPayMethod(m.k)}
                  className={"rounded-xl border p-3 text-left text-sm font-bold transition-all " + (payMethod === m.k ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border/60 hover:border-primary/40")}>
                  {m.label}
                </button>
              ))}
            </div>

            {payMethod === "direct" ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
                  Transfer <b className="text-foreground">{money(placed.subtotal)}</b> to the marketplace settlement account, using
                  reference <b className="text-foreground">{placed.order_number}</b>, then submit your payment reference below.
                </div>
                <Input placeholder="Your payment / transfer reference" value={reference} onChange={(e) => setReference(e.target.value)} />
                <Button onClick={() => payDirect.mutate()} disabled={payDirect.isPending} className="h-11 w-full rounded-xl font-bold gap-2">
                  {payDirect.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} I've paid — submit
                </Button>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                <Button onClick={() => payCard.mutate()} disabled={payCard.isPending} className="h-11 w-full rounded-xl font-bold gap-2">
                  {payCard.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} Pay by card
                </Button>
                {payCard.isError && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    {(payCard.error as any)?.response?.data?.message || "Card payments aren't enabled yet — use direct transfer, or ask the admin to configure Stripe."}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="mt-4 text-center">
            <Button asChild variant="ghost" className="rounded-xl text-sm"><Link href="/dashboard/b2b-marketplace">Pay later — go to my orders</Link></Button>
          </div>
        </div>
      </Shell>
    );
  }

  // ── Empty cart ──
  if (items.length === 0) {
    return (
      <Shell>
        <div className="mx-auto max-w-lg py-24 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <ShoppingCart className="h-7 w-7 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-black">Your cart is empty</h1>
          <p className="mt-2 text-sm text-muted-foreground">Add products from the marketplace to check out.</p>
          <Button asChild className="mt-6 rounded-xl"><Link href="/">Browse products</Link></Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mx-auto max-w-6xl py-8">
        <h1 className="mb-6 text-3xl font-black tracking-tight">Checkout</h1>
        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          {/* Shipping form */}
          <form
            id="checkout-form"
            onSubmit={(e) => { e.preventDefault(); setAuthError(false); place.mutate(); }}
            className="space-y-5"
          >
            <section className="rounded-3xl border border-border/60 bg-card/50 p-6">
              <h2 className="mb-4 text-lg font-black">Shipping & contact</h2>
              <div className="grid grid-cols-2 gap-3">
                <Input required placeholder="Full name *" value={form.shipping_name} onChange={(e) => setForm({ ...form, shipping_name: e.target.value })} />
                <Input placeholder="Company" value={form.shipping_company} onChange={(e) => setForm({ ...form, shipping_company: e.target.value })} />
                <Input required type="email" placeholder="Work email *" value={form.shipping_email} onChange={(e) => setForm({ ...form, shipping_email: e.target.value })} />
                <Input placeholder="Phone" value={form.shipping_phone} onChange={(e) => setForm({ ...form, shipping_phone: e.target.value })} />
                <div className="col-span-2">
                  <Textarea required rows={3} placeholder="Delivery address *" value={form.shipping_address} onChange={(e) => setForm({ ...form, shipping_address: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <Textarea rows={2} placeholder="Order notes (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>
            </section>

            {!loggedIn && (
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-400">
                You'll need to <Link href="/sign-in" className="font-bold underline">sign in as a buyer</Link> to place this order.
              </p>
            )}
            {authError && (
              <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                Please <Link href="/sign-in" className="font-bold underline">sign in as a buyer</Link> to complete checkout.
              </p>
            )}
          </form>

          {/* Order summary */}
          <aside className="space-y-4">
            <div className="rounded-3xl border border-border/60 bg-card/50 p-6">
              <h2 className="mb-4 text-lg font-black">Order summary</h2>
              <div className="space-y-3">
                {items.map((it) => (
                  <div key={it.id} className="flex items-center gap-3">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted/30">
                      {it.image && <img src={it.image} alt={it.name} className="h-full w-full object-cover" onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-semibold">{it.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <input
                          type="number"
                          min={1}
                          value={it.quantity}
                          onChange={(e) => setQty(it.id, parseInt(e.target.value || "1", 10))}
                          className="w-14 rounded border border-border/60 bg-transparent px-1.5 py-0.5 text-center"
                        />
                        × {money(it.unitPrice)}
                        <button type="button" onClick={() => remove(it.id)} className="ml-auto hover:text-destructive">remove</button>
                      </div>
                    </div>
                    <span className="text-sm font-bold">{money(it.unitPrice * it.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 space-y-2 border-t border-border/60 pt-4 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-bold">{money(subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Freight & taxes</span><span className="text-muted-foreground">Quoted after order</span></div>
                <div className="flex justify-between border-t border-border/60 pt-2 text-base"><span className="font-black">Total</span><span className="font-black text-primary">{money(subtotal)}</span></div>
              </div>
              <Button
                form="checkout-form"
                type="submit"
                disabled={place.isPending}
                className="mt-5 h-12 w-full rounded-xl text-base font-bold gap-2"
              >
                {place.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} Place Order
              </Button>
              <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Trade Assurance & Escrow protected
              </p>
            </div>
          </aside>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border/60 bg-background/80 px-4 sm:px-8 py-3 backdrop-blur-xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold hover:text-primary transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to marketplace
        </Link>
        <ThemeToggle />
      </header>
      <main className="px-4 sm:px-8">{children}</main>
    </div>
  );
}
