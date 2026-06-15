"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Boxes,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  Send,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { B2BApi, B2BDash, type B2BInquiry, type B2BMyProduct, type B2BQuote } from "@/modules/b2b-marketplace/api";
import { QuoteThreadDialog } from "@/modules/b2b-marketplace/components/QuoteThreadDialog";

function Kpi({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent><div className="text-2xl font-bold">{value}</div></CardContent>
    </Card>
  );
}

const EMPTY_PRODUCT: Partial<B2BMyProduct> = {
  name: "", description: "", price: undefined, price_unit: "", moq: "", lead_time: "",
  location: "", image_url: "", category_id: null, is_active: true, trade_assurance: true,
};

export default function SellerDashboard() {
  const qc = useQueryClient();
  const openRfqsQ = useQuery({ queryKey: ["b2b", "openRfqs"], queryFn: () => B2BDash.inquiries("open") });
  const myQuotesQ = useQuery({ queryKey: ["b2b", "sellerQuotes"], queryFn: () => B2BDash.quotes() });
  const productsQ = useQuery({ queryKey: ["b2b", "myProducts"], queryFn: () => B2BDash.myProducts() });
  const categoriesQ = useQuery({ queryKey: ["b2b", "publicCategories"], queryFn: () => B2BApi.categories() });
  const salesQ = useQuery({ queryKey: ["b2b", "sellerOrders"], queryFn: () => B2BDash.sellerOrders() });

  const openRfqs = openRfqsQ.data ?? [];
  const myQuotes = myQuotesQ.data ?? [];
  const products = productsQ.data ?? [];
  const categories = categoriesQ.data ?? [];
  const sales = salesQ.data ?? [];

  const [quoting, setQuoting] = useState<B2BInquiry | null>(null);
  const [thread, setThread] = useState<B2BQuote | null>(null);
  const [editing, setEditing] = useState<Partial<B2BMyProduct> | null>(null);

  const deleteProduct = useMutation({
    mutationFn: (id: string) => B2BDash.deleteProduct(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["b2b", "myProducts"] }),
  });

  const wins = myQuotes.filter((q) => q.status === "accepted").length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Kpi label="Open RFQs" value={openRfqs.length} />
        <Kpi label="My Quotes" value={myQuotes.length} />
        <Kpi label="Won Deals" value={wins} />
        <Kpi label="My Products" value={products.length} />
      </div>

      <Tabs defaultValue="rfqs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rfqs">Open RFQs</TabsTrigger>
          <TabsTrigger value="quotes">My Quotes</TabsTrigger>
          <TabsTrigger value="products">My Products</TabsTrigger>
          <TabsTrigger value="sales">My Sales</TabsTrigger>
        </TabsList>

        {/* Sales — orders containing my products */}
        <TabsContent value="sales" className="space-y-3">
          {salesQ.isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : sales.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No sales yet. When buyers order your products, they appear here with your payout (after the platform fee).</CardContent></Card>
          ) : (
            sales.map((o) => (
              <Card key={o.id}>
                <CardContent className="space-y-2 py-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-[160px]">
                      <p className="text-sm font-black">{o.order_number}</p>
                      <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</p>
                    </div>
                    <Badge variant={o.payment_status === "paid" ? "default" : "secondary"}>{o.payment_status.replace("_", " ")}</Badge>
                    <Badge variant="outline">{o.status}</Badge>
                    <div className="text-right">
                      <p className="text-[11px] text-muted-foreground">Your payout</p>
                      <p className="text-lg font-black text-primary">${o.my_payout.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                  <div className="divide-y divide-border/50 border-t border-border/50 pt-1">
                    {o.my_items.map((it, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                        <span className="min-w-0 flex-1 truncate text-muted-foreground">{it.name}</span>
                        <span className="text-xs text-muted-foreground">×{it.quantity}</span>
                        <span className="w-24 text-right font-bold">${it.line_total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Open RFQ feed */}
        <TabsContent value="rfqs" className="space-y-3">
          {openRfqsQ.isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : openRfqs.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No open RFQs right now. Check back soon.</CardContent></Card>
          ) : (
            openRfqs.map((inq) => (
              <Card key={inq.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                  <div>
                    <CardTitle className="text-base">{inq.title}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{inq.description}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      {inq.budget_range && <Badge variant="outline">Budget: {inq.budget_range}</Badge>}
                      {inq.category && <Badge variant="outline">{inq.category}</Badge>}
                      <Badge variant="secondary">{inq.quotes_count} quotes so far</Badge>
                    </div>
                  </div>
                  <Button size="sm" className="rounded-xl gap-1 shrink-0" onClick={() => setQuoting(inq)}>
                    <FileText className="h-4 w-4" /> Quote
                  </Button>
                </CardHeader>
              </Card>
            ))
          )}
        </TabsContent>

        {/* My quotes */}
        <TabsContent value="quotes" className="space-y-3">
          {myQuotesQ.isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : myQuotes.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">You haven't submitted any quotes yet.</CardContent></Card>
          ) : (
            myQuotes.map((q) => (
              <Card key={q.id}>
                <CardContent className="flex flex-wrap items-center gap-3 py-4">
                  <div className="flex-1 min-w-[160px]">
                    <p className="text-sm font-bold">{q.inquiry_title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{q.proposal_text}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-primary">${q.amount.toLocaleString()}</p>
                    <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1"><Clock className="h-3 w-3" />{q.delivery_time_days ?? "—"}d</p>
                  </div>
                  <Badge variant={q.status === "accepted" ? "default" : q.status === "rejected" ? "destructive" : "secondary"}>{q.status}</Badge>
                  <Button size="sm" variant="outline" onClick={() => setThread(q)} className="gap-1"><MessageSquare className="h-3.5 w-3.5" /> Chat</Button>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Products CRUD */}
        <TabsContent value="products" className="space-y-3">
          <div className="flex justify-end">
            <Button onClick={() => setEditing({ ...EMPTY_PRODUCT })} className="rounded-xl gap-2"><Plus className="h-4 w-4" /> Add Product</Button>
          </div>
          {productsQ.isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : products.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No products listed yet. Add your first listing to appear in the marketplace.</CardContent></Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => (
                <Card key={p.id} className="overflow-hidden">
                  <div className="relative aspect-[4/3] bg-muted/20">
                    {p.image_url && <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} />}
                    {!p.is_active && <Badge variant="destructive" className="absolute top-2 left-2">Inactive</Badge>}
                  </div>
                  <CardContent className="space-y-1 py-3">
                    <p className="line-clamp-2 text-sm font-bold min-h-[2.5rem]">{p.name}</p>
                    <p className="text-lg font-black text-primary">{p.price != null ? `$${p.price.toLocaleString()}` : "—"}{p.price_unit ? ` ${p.price_unit}` : ""}</p>
                    <p className="text-xs text-muted-foreground">{p.category ?? "Uncategorized"} · MOQ {p.moq || "—"}</p>
                    <div className="flex gap-1.5 pt-2">
                      <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => setEditing(p)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteProduct.mutate(p.id)}><Trash2 className="h-4 w-4 text-muted-foreground" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Submit quote */}
      <QuoteDialog inquiry={quoting} onClose={() => setQuoting(null)} onDone={() => { setQuoting(null); qc.invalidateQueries({ queryKey: ["b2b", "sellerQuotes"] }); qc.invalidateQueries({ queryKey: ["b2b", "openRfqs"] }); }} />

      {/* Product editor */}
      <ProductDialog
        product={editing}
        categories={categories}
        onClose={() => setEditing(null)}
        onDone={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["b2b", "myProducts"] }); }}
      />

      {/* Messaging */}
      <QuoteThreadDialog quote={thread} onClose={() => setThread(null)} />
    </div>
  );
}

function QuoteDialog({ inquiry, onClose, onDone }: { inquiry: B2BInquiry | null; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ amount: "", delivery_time_days: "", proposal_text: "" });
  React.useEffect(() => { setForm({ amount: "", delivery_time_days: "", proposal_text: "" }); }, [inquiry?.id]);
  const submit = useMutation({
    mutationFn: () => B2BDash.createQuote({
      inquiry_id: inquiry!.id,
      amount: Number(form.amount),
      delivery_time_days: form.delivery_time_days ? Number(form.delivery_time_days) : undefined,
      proposal_text: form.proposal_text,
    }),
    onSuccess: onDone,
  });
  return (
    <Dialog open={!!inquiry} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={(e) => { e.preventDefault(); submit.mutate(); }}>
          <DialogHeader>
            <DialogTitle>Submit a Quote</DialogTitle>
            <DialogDescription className="truncate">{inquiry?.title}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <Input required type="number" min="0" step="0.01" placeholder="Quote amount (USD)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            <Input type="number" min="0" placeholder="Delivery time (days)" value={form.delivery_time_days} onChange={(e) => setForm({ ...form, delivery_time_days: e.target.value })} />
            <Textarea required rows={4} placeholder="Your proposal: pricing terms, specs, capacity…" value={form.proposal_text} onChange={(e) => setForm({ ...form, proposal_text: e.target.value })} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submit.isPending} className="w-full rounded-xl gap-2">
              {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send Quote
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProductDialog({
  product, categories, onClose, onDone,
}: {
  product: Partial<B2BMyProduct> | null;
  categories: { id: number; name: string }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState<Partial<B2BMyProduct>>(product ?? {});
  React.useEffect(() => { setForm(product ?? {}); }, [product]);
  const isEdit = !!product?.id;

  const save = useMutation({
    mutationFn: () => {
      const payload: Partial<B2BMyProduct> = {
        name: form.name,
        description: form.description ?? null,
        category_id: form.category_id ?? null,
        price: form.price != null && form.price !== ("" as any) ? Number(form.price) : null,
        price_unit: form.price_unit || null,
        moq: form.moq || null,
        lead_time: form.lead_time || null,
        location: form.location || null,
        image_url: form.image_url || null,
        is_active: form.is_active ?? true,
        trade_assurance: form.trade_assurance ?? true,
      };
      return isEdit ? B2BDash.updateProduct(product!.id!, payload) : B2BDash.createProduct(payload);
    },
    onSuccess: onDone,
  });

  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <DialogHeader>
            <DialogTitle className="inline-flex items-center gap-2"><Boxes className="h-5 w-5 text-primary" /> {isEdit ? "Edit Product" : "Add Product"}</DialogTitle>
            <DialogDescription>This listing appears in the public marketplace.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            <div className="col-span-2"><Input required placeholder="Product name" value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="col-span-2"><Textarea rows={3} placeholder="Description" value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <Select value={form.category_id ? String(form.category_id) : undefined} onValueChange={(v) => setForm({ ...form, category_id: Number(v) })}>
              <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="MOQ (e.g. 100 units)" value={form.moq ?? ""} onChange={(e) => setForm({ ...form, moq: e.target.value })} />
            <Input type="number" min="0" step="0.01" placeholder="Price (USD)" value={form.price ?? ""} onChange={(e) => setForm({ ...form, price: e.target.value as any })} />
            <Input placeholder="Price unit (e.g. / kg)" value={form.price_unit ?? ""} onChange={(e) => setForm({ ...form, price_unit: e.target.value })} />
            <Input placeholder="Lead time (e.g. 7-15 days)" value={form.lead_time ?? ""} onChange={(e) => setForm({ ...form, lead_time: e.target.value })} />
            <Input placeholder="Location" value={form.location ?? ""} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <div className="col-span-2"><Input placeholder="Image URL (e.g. /images/b2b/...)" value={form.image_url ?? ""} onChange={(e) => setForm({ ...form, image_url: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={save.isPending} className="w-full rounded-xl gap-2">
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} {isEdit ? "Save Changes" : "Create Product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
