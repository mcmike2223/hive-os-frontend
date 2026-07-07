"use client";

import { useState, useEffect } from "react";
import { GlassWater, CalendarDays, Users, Phone, User, MessageSquare, CheckCircle2, Loader2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getBackendApiRoot, getTenantHeaders } from "@/lib/runtime-context";
import { toast } from "sonner";

interface AvailableTable { id: number; name: string; capacity: number; min_spend: string; }
type Step = "details" | "success";

const publicHeaders = () => ({
  ...getTenantHeaders(),
  "Accept": "application/json",
  "Content-Type": "application/json",
});

export default function PublicBookingPage() {
  const [tables, setTables]         = useState<AvailableTable[]>([]);
  const [tablesLoading, setTablesLoading] = useState(true);
  const [step, setStep]             = useState<Step>("details");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm]             = useState({
    customer_name: "", customer_phone: "", reservation_time: "",
    guest_count: 1, table_id: "", special_requests: "",
  });

  useEffect(() => {
    fetch(`${getBackendApiRoot()}/public/hospitality/available-tables`, { headers: publicHeaders() })
      .then(r => r.json())
      .then(d => setTables(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setTablesLoading(false));
  }, []);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: key === "guest_count" || key === "table_id" ? +e.target.value || e.target.value : e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.table_id)           return toast.error("Please select a table.");
    if (!form.reservation_time)   return toast.error("Please pick a date & time.");
    if (!form.customer_phone)     return toast.error("Phone number is required.");
    setSubmitting(true);
    try {
      const res = await fetch(`${getBackendApiRoot()}/public/hospitality/reserve`, {
        method: "POST",
        headers: publicHeaders(),
        body: JSON.stringify({ ...form, table_id: +form.table_id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Submission failed.");
      setStep("success");
    } catch (err: unknown) {
  const message =
    err instanceof Error ? err.message : "Something went wrong";

  toast.error(message);
    }
    finally {
      setSubmitting(false);
    }
  };

  // â”€â”€â”€ Success screen â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (step === "success") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 flex items-center justify-center p-6">
        <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-[2rem] p-10 text-center max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-300">
          <div className="h-20 w-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/20">
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
          </div>
          <h2 className="text-3xl font-black text-white tracking-tight mb-3">You&apos;re on the list!</h2>
          <p className="text-white/60 font-medium leading-relaxed">
            Your reservation request has been received. Our team will confirm it shortly via phone. See you tonight!
          </p>
          <div className="mt-8 px-5 py-4 rounded-2xl bg-white/5 border border-white/10 text-left space-y-2">
            <div className="text-sm font-bold text-white/90">{form.customer_name}</div>
            <div className="text-sm text-white/50">{new Date(form.reservation_time).toLocaleString()}</div>
            <div className="text-sm text-white/50">{form.guest_count} guests Â· {tables.find(t => t.id === +form.table_id)?.name ?? "Table"}</div>
          </div>
          <button onClick={() => { setStep("details"); setForm({ customer_name:"", customer_phone:"", reservation_time:"", guest_count:1, table_id:"", special_requests:"" }); }}
            className="mt-6 text-sm text-white/40 hover:text-white/70 font-semibold transition-colors">
            Make another booking â†’
          </button>
        </div>
      </div>
    );
  }

  // â”€â”€â”€ Booking form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 flex flex-col items-center justify-center p-6">
      {/* Hero */}
      <div className="text-center mb-10 max-w-xl">
        <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-white/60 text-xs font-bold tracking-widest uppercase mb-6 backdrop-blur-md">
          <GlassWater className="h-3.5 w-3.5" />
          VIP Reservation
        </div>
        <h1 className="text-5xl font-black text-white tracking-tighter leading-none mb-4">Reserve Your Table</h1>
        <p className="text-white/50 font-medium text-lg">Secure your spot for an unforgettable night. No login required.</p>
      </div>

      {/* Form card */}
      <form onSubmit={handleSubmit} className="w-full max-w-lg bg-white/5 border border-white/10 backdrop-blur-xl rounded-[2rem] p-8 shadow-2xl space-y-5">

        {/* Name */}
        <div className="space-y-1.5">
          <label className="text-sm font-bold text-white/70 flex items-center gap-2"><User className="h-3.5 w-3.5" /> Full Name</label>
          <input required type="text" placeholder="e.g. Alex Johnson" value={form.customer_name} onChange={set("customer_name")}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-medium text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all" />
        </div>

        {/* Phone */}
        <div className="space-y-1.5">
          <label className="text-sm font-bold text-white/70 flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> Phone Number</label>
          <input required type="tel" placeholder="+1 555 000 0000" value={form.customer_phone} onChange={set("customer_phone")}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-medium text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all" />
        </div>

        {/* Date & Guest Count */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-white/70 flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5" /> Date & Time</label>
            <input required type="datetime-local" value={form.reservation_time} onChange={set("reservation_time")}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all [color-scheme:dark]" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-white/70 flex items-center gap-2"><Users className="h-3.5 w-3.5" /> Guest Count</label>
            <input required type="number" min={1} max={50} value={form.guest_count} onChange={set("guest_count")}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all" />
          </div>
        </div>

        {/* Table Selection */}
        <div className="space-y-1.5">
          <label className="text-sm font-bold text-white/70 flex items-center gap-2"><GlassWater className="h-3.5 w-3.5" /> Preferred Table</label>
          {tablesLoading ? (
            <div className="flex items-center gap-2 text-white/40 text-sm py-3 px-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading available tables...
            </div>
          ) : tables.length === 0 ? (
            <div className="text-white/40 text-sm py-3 px-4 bg-white/5 rounded-xl border border-white/10">No tables are currently available.</div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {tables.map(t => (
                <label key={t.id} className={`flex items-center justify-between px-4 py-3 rounded-xl border cursor-pointer transition-all ${+form.table_id === t.id ? "border-purple-500 bg-purple-500/10" : "border-white/10 bg-white/5 hover:border-white/30"}`}>
                  <div className="flex items-center gap-3">
                    <input type="radio" name="table_id" value={t.id} checked={+form.table_id === t.id} onChange={set("table_id")} className="sr-only" />
                    <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${+form.table_id === t.id ? "border-purple-500" : "border-white/30"}`}>
                      {+form.table_id === t.id && <div className="h-2 w-2 rounded-full bg-purple-500" />}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">{t.name}</div>
                      <div className="text-xs text-white/40">Up to {t.capacity} guests</div>
                    </div>
                  </div>
                  <div className="text-xs font-black text-purple-400">Min ${t.min_spend}</div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Special Requests */}
        <div className="space-y-1.5">
          <label className="text-sm font-bold text-white/70 flex items-center gap-2"><MessageSquare className="h-3.5 w-3.5" /> Special Requests <span className="text-white/30 font-normal">(optional)</span></label>
          <textarea rows={3} placeholder="Birthday setup, dietary restrictions, preferred seatingâ€¦" value={form.special_requests} onChange={set("special_requests")}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-medium text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all resize-none" />
        </div>

        {/* Submit */}
        <Button type="submit" disabled={submitting} className="w-full h-14 rounded-2xl font-black text-base bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/30 transition-all duration-300">
          {submitting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <span className="flex items-center gap-2">Confirm My Reservation <ChevronRight className="h-5 w-5" /></span>
          )}
        </Button>

        <p className="text-center text-white/30 text-xs">
          Your reservation is subject to approval. We`&apos;`ll reach you on the phone number provided.
        </p>
      </form>
    </div>
  );
}

