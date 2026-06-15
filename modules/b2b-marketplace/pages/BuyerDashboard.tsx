"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  CreditCard,
  FileText,
  Heart,
  Loader2,
  MessageSquare,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { B2BDash, type B2BInquiry, type B2BOrder, type B2BQuote } from "@/modules/b2b-marketplace/api";
import { QuoteThreadDialog } from "@/modules/b2b-marketplace/components/QuoteThreadDialog";

function Kpi({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

export default function BuyerDashboard() {
  const qc = useQueryClient();
  const inquiriesQ = useQuery({ queryKey: ["b2b", "myInquiries"], queryFn: () => B2BDash.inquiries("mine") });
  const quotesQ = useQuery({ queryKey: ["b2b", "buyerQuotes"], queryFn: () => B2BDash.quotes() });
  const favsQ = useQuery({ queryKey: ["b2b", "favorites"], queryFn: () => B2BDash.favorites() });
  const ordersQ = useQuery({ queryKey: ["b2b", "myOrders"], queryFn: () => B2BDash.orders() });

  const inquiries = inquiriesQ.data ?? [];
  const quotes = quotesQ.data ?? [];
  const favorites = favsQ.data ?? [];
  const orders = ordersQ.data ?? [];

  const [rfqOpen, setRfqOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", budget_range: "" });
  const [reviewing, setReviewing] = useState<B2BQuote | null>(null);
  const [thread, setThread] = useState<B2BQuote | null>(null);
  const [payingOrder, setPayingOrder] = useState<B2BOrder | null>(null);
  const [payRef, setPayRef] = useState("");

  const payMut = useMutation({
    mutationFn: () => B2BDash.payOrder(payingOrder!.id, payRef || undefined),
    onSuccess: () => { setPayingOrder(null); setPayRef(""); qc.invalidateQueries({ queryKey: ["b2b", "myOrders"] }); },
  });

  const createRfq = useMutation({
    mutationFn: () => B2BDash.createInquiry(form),
    onSuccess: () => {
      setRfqOpen(false);
      setForm({ title: "", description: "", budget_range: "" });
      qc.invalidateQueries({ queryKey: ["b2b", "myInquiries"] });
    },
  });

  const decide = useMutation({
    mutationFn: ({ id, action }: { id: number; action: "accept" | "reject" }) =>
      action === "accept" ? B2BDash.acceptQuote(id) : B2BDash.rejectQuote(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["b2b", "buyerQuotes"] });
      qc.invalidateQueries({ queryKey: ["b2b", "myInquiries"] });
    },
  });

  const deleteRfq = useMutation({
    mutationFn: (id: number) => B2BDash.deleteInquiry(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["b2b", "myInquiries"] }),
  });

  const quotesFor = (inquiryId: number) => quotes.filter((q) => q.inquiry_id === inquiryId);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Kpi label="My RFQs" value={inquiries.length} />
        <Kpi label="Quotes Received" value={quotes.length} />
        <Kpi label="Awarded" value={inquiries.filter((i) => i.status === "awarded").length} />
        <Kpi label="Saved Products" value={favorites.length} />
      </div>

      <Tabs defaultValue="rfqs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rfqs">My RFQs</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="favorites">Favorites</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-3">
          {ordersQ.isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : orders.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No orders yet. Add products to your cart and check out to place an order.</CardContent></Card>
          ) : (
            orders.map((o) => (
              <Card key={o.id}>
                <CardContent className="py-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-[160px]">
                      <p className="text-sm font-black">{o.order_number}</p>
                      <p className="text-xs text-muted-foreground">{o.items_count} item{o.items_count === 1 ? "" : "s"} · {new Date(o.created_at).toLocaleDateString()}</p>
                    </div>
                    <Badge variant={o.payment_status === "paid" ? "default" : o.payment_status === "pending_confirmation" ? "secondary" : "destructive"}>
                      {o.payment_status === "pending_confirmation" ? "awaiting confirmation" : o.payment_status}
                    </Badge>
                    <Badge variant="outline">{o.status}</Badge>
                    <span className="text-lg font-black text-primary">${o.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <div className="flex gap-1.5">
                      {o.payment_status === "unpaid" && (
                        <Button size="sm" onClick={() => setPayingOrder(o)} className="gap-1"><CreditCard className="h-3.5 w-3.5" /> Pay</Button>
                      )}
                      <Button asChild size="sm" variant="outline" className="gap-1">
                        <Link href={`/marketplace/orders/${o.id}/invoice`} target="_blank"><FileText className="h-3.5 w-3.5" /> Invoice</Link>
                      </Button>
                    </div>
                  </div>
                  {o.items && o.items.length > 0 && (
                    <div className="mt-3 divide-y divide-border/50 border-t border-border/50 pt-2">
                      {o.items.map((it, i) => (
                        <div key={i} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                          <span className="min-w-0 flex-1 truncate text-muted-foreground">{it.name}</span>
                          <span className="text-xs text-muted-foreground">{it.quantity} × ${it.unit_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          <span className="w-24 text-right font-bold">${it.line_total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="rfqs" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setRfqOpen(true)} className="rounded-xl gap-2">
              <Plus className="h-4 w-4" /> Post an RFQ
            </Button>
          </div>

          {inquiriesQ.isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : inquiries.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No RFQs yet. Post your first request to start receiving quotes.</CardContent></Card>
          ) : (
            inquiries.map((inq: B2BInquiry) => {
              const qs = quotesFor(inq.id);
              return (
                <Card key={inq.id}>
                  <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                    <div>
                      <CardTitle className="text-base">{inq.title}</CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{inq.description}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <Badge variant={inq.status === "awarded" ? "default" : "secondary"}>{inq.status}</Badge>
                        {inq.budget_range && <Badge variant="outline">Budget: {inq.budget_range}</Badge>}
                        {inq.category && <Badge variant="outline">{inq.category}</Badge>}
                        <Badge variant="outline">{qs.length} quotes</Badge>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deleteRfq.mutate(inq.id)} title="Delete RFQ">
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </CardHeader>
                  {qs.length > 0 && (
                    <CardContent className="space-y-2">
                      {qs.map((q) => (
                        <div key={q.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-3">
                          <div className="flex-1 min-w-[160px]">
                            <p className="text-sm font-bold">
                              {q.seller_flag} {q.seller}{" "}
                              {q.seller_rating != null && (
                                <span className="ml-1 inline-flex items-center gap-0.5 text-xs text-amber-500">
                                  <Star className="h-3 w-3 fill-current" />{q.seller_rating}
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground line-clamp-1">{q.proposal_text}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-black text-primary">${q.amount.toLocaleString()}</p>
                            <p className="text-[11px] text-muted-foreground">{q.delivery_time_days ? `${q.delivery_time_days}d delivery` : "—"}</p>
                          </div>
                          <Badge variant={q.status === "accepted" ? "default" : q.status === "rejected" ? "destructive" : "secondary"}>{q.status}</Badge>
                          <div className="flex gap-1.5">
                            <Button size="sm" variant="outline" onClick={() => setThread(q)} className="gap-1"><MessageSquare className="h-3.5 w-3.5" /></Button>
                            {q.status === "pending" && (
                              <>
                                <Button size="sm" onClick={() => decide.mutate({ id: q.id, action: "accept" })} disabled={decide.isPending}>Accept</Button>
                                <Button size="sm" variant="outline" onClick={() => decide.mutate({ id: q.id, action: "reject" })} disabled={decide.isPending}>Reject</Button>
                              </>
                            )}
                            {q.status === "accepted" && !q.has_review && (
                              <Button size="sm" variant="outline" onClick={() => setReviewing(q)} className="gap-1"><Star className="h-3.5 w-3.5" /> Review</Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  )}
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="favorites">
          {favsQ.isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : favorites.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No saved products yet. Tap the heart on a product to shortlist it.</CardContent></Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {favorites.map((p: any) => (
                <Link key={p.id} href={`/marketplace/product/${p.id}`} className="rounded-2xl border border-border/60 bg-card/60 p-4 hover:border-primary/40 transition-all">
                  <div className="flex items-center gap-2 text-rose-500"><Heart className="h-4 w-4 fill-current" /></div>
                  <p className="mt-2 line-clamp-2 text-sm font-bold">{p.name}</p>
                  <p className="mt-1 text-lg font-black text-primary">{p.price}</p>
                  <p className="text-xs text-muted-foreground">{p.supplier} · {p.location}</p>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Post RFQ */}
      <Dialog open={rfqOpen} onOpenChange={setRfqOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={(e) => { e.preventDefault(); createRfq.mutate(); }}>
            <DialogHeader>
              <DialogTitle className="inline-flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Post a Request for Quote</DialogTitle>
              <DialogDescription>Verified suppliers will respond with competitive quotes.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <Input required placeholder="What are you sourcing? (title)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <Textarea required rows={4} placeholder="Quantity, specs, target price, delivery terms…" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <Input placeholder="Budget range (optional)" value={form.budget_range} onChange={(e) => setForm({ ...form, budget_range: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createRfq.isPending} className="w-full rounded-xl gap-2">
                {createRfq.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Post RFQ
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Review dialog */}
      <ReviewDialog quote={reviewing} onClose={() => setReviewing(null)} onDone={() => { setReviewing(null); qc.invalidateQueries({ queryKey: ["b2b", "buyerQuotes"] }); }} />

      {/* Message thread */}
      <QuoteThreadDialog quote={thread} onClose={() => setThread(null)} />

      {/* Pay an order (direct) */}
      <Dialog open={!!payingOrder} onOpenChange={(o) => { if (!o) { setPayingOrder(null); setPayRef(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="inline-flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" /> Pay order</DialogTitle>
            <DialogDescription>
              {payingOrder?.order_number} · ${payingOrder?.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} to the marketplace.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <p className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
              Transfer the amount to the marketplace settlement account using reference <b className="text-foreground">{payingOrder?.order_number}</b>, then enter your payment reference. The admin confirms receipt and releases the order.
            </p>
            <Input placeholder="Payment / transfer reference" value={payRef} onChange={(e) => setPayRef(e.target.value)} />
          </div>
          <DialogFooter>
            <Button onClick={() => payMut.mutate()} disabled={payMut.isPending} className="w-full rounded-xl gap-2">
              {payMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />} Submit payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReviewDialog({ quote, onClose, onDone }: { quote: B2BQuote | null; onClose: () => void; onDone: () => void }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const submit = useMutation({
    mutationFn: () => B2BDash.createReview({ quote_id: quote!.id, rating, comment }),
    onSuccess: onDone,
  });
  return (
    <Dialog open={!!quote} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Review {quote?.seller}</DialogTitle>
          <DialogDescription>Rate your experience for "{quote?.inquiry_title}".</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-3">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <button key={i} type="button" onClick={() => setRating(i)}>
                <Star className={"h-7 w-7 " + (i <= rating ? "text-amber-500 fill-current" : "text-muted-foreground/30")} />
              </button>
            ))}
          </div>
          <Textarea rows={3} placeholder="Share details of your experience (optional)" value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>
        <DialogFooter>
          <Button onClick={() => submit.mutate()} disabled={submit.isPending} className="w-full rounded-xl gap-2">
            {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Submit Review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
