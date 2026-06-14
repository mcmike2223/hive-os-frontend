"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleDollarSign,
  Clock,
  FileText,
  Flame,
  Globe2,
  Headphones,
  HelpCircle,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Menu,
  MessageSquare,
  Phone,
  Plane,
  Plus,
  Quote as QuoteIcon,
  Rocket,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Ship,
  ShoppingCart,
  Sparkles,
  Star,
  Store,
  TrendingUp,
  Truck,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useTranslation } from "@/store/use-translation";
import { motion, AnimatePresence, useInView, useMotionValue, animate } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  isTenantHost,
  getPublicServeUrl,
  getBackendApiRoot,
  getTenantHeaders,
  getAccessToken,
} from "@/lib/runtime-context";
import { type TenantLandingTemplate } from "@/modules/tenancy/landing-template";
import { B2BApi } from "@/modules/b2b-marketplace/api";
import { HeroGlobe } from "@/modules/b2b-marketplace/components/HeroGlobe";
import { MarketplaceBackdrop } from "@/modules/b2b-marketplace/components/MarketplaceBackdrop";
import { CartSheet } from "@/modules/b2b-marketplace/cart/CartSheet";
import { useCart } from "@/modules/b2b-marketplace/cart/cart-store";
import { AddToCartButton } from "@/modules/b2b-marketplace/cart/AddToCartButton";

type B2BBrandSettings = {
  app_title?: string | null;
  logo_light?: string | null;
  logo_dark?: string | null;
  footer_text?: string | null;
} | null;

/* ─────────────────────────────────────────────────────────────────────────
   📦 DATA
   ───────────────────────────────────────────────────────────────────────── */

type Category = {
  name: string;
  slug: string;
  img: string;
  count: string;
  growth: string;
  description: string;
  suppliers: number;
};

type Product = {
  id: string;
  name: string;
  price: string;
  moq: string;
  img: string;
  supplier: string;
  supplierLogo: string;
  rating: number;
  reviews: number;
  location: string;
  verified: boolean;
  tradeAssurance: boolean;
  badges: string[];
  leadTime: string;
  category: string;
};

type Supplier = {
  id?: number;
  name: string;
  logo: string;
  country: string;
  flag: string;
  rating: number;
  years: number;
  products: number;
  verified: boolean;
  premium: boolean;
  onTimeRate?: number | null;
};

type Testimonial = {
  quote: string;
  author: string;
  role: string;
  company: string;
  flag: string;
  amount: string;
};

const CATEGORIES: Category[] = [
  {
    name: "Electronics & Gadgets",
    slug: "electronics-gadgets",
    img: "/images/b2b/cat_electronics.png",
    count: "1.2k+ Products",
    growth: "+24%",
    description: "Phones, laptops, IoT and consumer electronics from audited factories.",
    suppliers: 482,
  },
  {
    name: "Industrial Machinery",
    slug: "industrial-machinery",
    img: "/images/b2b/cat_machinery.png",
    count: "850+ Products",
    growth: "+11%",
    description: "Heavy equipment, CNC tools, and assembly line solutions.",
    suppliers: 217,
  },
  {
    name: "Apparel & Textiles",
    slug: "apparel-textiles",
    img: "/images/b2b/cat_apparel.png",
    count: "2.5k+ Products",
    growth: "+38%",
    description: "Cut-and-sew factories, fabrics, and full-package apparel sourcing.",
    suppliers: 631,
  },
  {
    name: "Agriculture & Food",
    slug: "agriculture-food",
    img: "/images/b2b/cat_agriculture.png",
    count: "920+ Products",
    growth: "+19%",
    description: "Single-origin coffee, spices, oilseeds, and packaged commodities.",
    suppliers: 308,
  },
];

const PRODUCTS: Product[] = [
  {
    id: "p-1",
    name: "NextGen Pro Smartphone 1TB — Bulk Wholesale",
    price: "$450.00",
    moq: "50 units",
    img: "/images/b2b/prod_smartphone.png",
    supplier: "TechTronics Ltd.",
    supplierLogo: "TT",
    rating: 4.9,
    reviews: 1248,
    location: "Shenzhen, China",
    verified: true,
    tradeAssurance: true,
    badges: ["Trending", "Fast Ship"],
    leadTime: "7-15 days",
    category: "Electronics & Gadgets",
  },
  {
    id: "p-2",
    name: "HX-900 Industrial Excavator — 22 ton class",
    price: "$85,000.00",
    moq: "1 unit",
    img: "/images/b2b/prod_excavator.png",
    supplier: "HeavyBuild Machineries",
    supplierLogo: "HB",
    rating: 4.8,
    reviews: 312,
    location: "Lagos, Nigeria",
    verified: true,
    tradeAssurance: true,
    badges: ["Top Rated"],
    leadTime: "30-45 days",
    category: "Industrial Machinery",
  },
  {
    id: "p-3",
    name: "Premium Ethiopian Coffee — Grade 1, Single Origin",
    price: "$4.50 / kg",
    moq: "1,000 kg",
    img: "/images/b2b/prod_coffee.png",
    supplier: "Abyssinia Roasters",
    supplierLogo: "AR",
    rating: 5.0,
    reviews: 586,
    location: "Addis Ababa, Ethiopia",
    verified: true,
    tradeAssurance: true,
    badges: ["Organic", "Fair Trade"],
    leadTime: "5-10 days",
    category: "Agriculture & Food",
  },
  {
    id: "p-4",
    name: "Heavy-Duty Cotton Workwear — OEM Cut & Sew",
    price: "$8.20 / piece",
    moq: "5,000 pieces",
    img: "/images/b2b/cat_apparel.png",
    supplier: "Habesha Garment PLC",
    supplierLogo: "HG",
    rating: 4.7,
    reviews: 204,
    location: "Hawassa, Ethiopia",
    verified: true,
    tradeAssurance: true,
    badges: ["OEM", "Eco"],
    leadTime: "21-30 days",
    category: "Apparel & Textiles",
  },
  {
    id: "p-5",
    name: "Smart 4K LED Display 55\" — Hospitality & Retail",
    price: "$210.00",
    moq: "100 units",
    img: "/images/b2b/cat_electronics.png",
    supplier: "Nova Display Co.",
    supplierLogo: "ND",
    rating: 4.6,
    reviews: 421,
    location: "Dubai, UAE",
    verified: true,
    tradeAssurance: true,
    badges: ["Hot"],
    leadTime: "10-20 days",
    category: "Electronics & Gadgets",
  },
  {
    id: "p-6",
    name: "Sesame Seeds — Hulled, Sortex Cleaned",
    price: "$2.10 / kg",
    moq: "5,000 kg",
    img: "/images/b2b/cat_agriculture.png",
    supplier: "Humera Agri Exports",
    supplierLogo: "HA",
    rating: 4.9,
    reviews: 178,
    location: "Humera, Ethiopia",
    verified: true,
    tradeAssurance: true,
    badges: ["Export Ready"],
    leadTime: "3-7 days",
    category: "Agriculture & Food",
  },
];

const SUPPLIERS: Supplier[] = [
  { name: "TechTronics Ltd.", logo: "TT", country: "China", flag: "🇨🇳", rating: 4.9, years: 12, products: 1240, verified: true, premium: true },
  { name: "HeavyBuild Machineries", logo: "HB", country: "Nigeria", flag: "🇳🇬", rating: 4.8, years: 18, products: 312, verified: true, premium: true },
  { name: "Abyssinia Roasters", logo: "AR", country: "Ethiopia", flag: "🇪🇹", rating: 5.0, years: 9, products: 86, verified: true, premium: true },
  { name: "Nova Display Co.", logo: "ND", country: "UAE", flag: "🇦🇪", rating: 4.6, years: 7, products: 421, verified: true, premium: false },
  { name: "Habesha Garment PLC", logo: "HG", country: "Ethiopia", flag: "🇪🇹", rating: 4.7, years: 14, products: 204, verified: true, premium: false },
  { name: "Humera Agri Exports", logo: "HA", country: "Ethiopia", flag: "🇪🇹", rating: 4.9, years: 22, products: 178, verified: true, premium: true },
];

const TESTIMONIALS: Testimonial[] = [
  {
    quote: "We sourced $1.2M worth of excavators in a single RFQ. The escrow protected every shipment and on-time delivery was 100%.",
    author: "Daniel Tesfaye",
    role: "Procurement Director",
    company: "Horn Construction Group",
    flag: "🇪🇹",
    amount: "$1.2M deal",
  },
  {
    quote: "The verified supplier badges let us skip weeks of due diligence. We've now transacted in 14 new countries without a single dispute.",
    author: "Fatima Al-Rashid",
    role: "Head of Sourcing",
    company: "Gulf Trade Holdings",
    flag: "🇦🇪",
    amount: "$3.4M in 90 days",
  },
  {
    quote: "Comparing quotes from 8 suppliers used to take a week. Here it takes an afternoon — and the data rooms are airtight.",
    author: "Marcus Williams",
    role: "VP Supply Chain",
    company: "Bluefield Imports",
    flag: "🇺🇸",
    amount: "14 countries",
  },
];

const STATS = [
  { value: "10,400+", label: "Verified Suppliers", icon: Store },
  { value: "$2.8B", label: "Annual GMV", icon: CircleDollarSign },
  { value: "184", label: "Countries Served", icon: Globe2 },
  { value: "99.2%", label: "On-Time Delivery", icon: Truck },
];

/** Counts up the numeric part of a formatted stat (e.g. "$2.8B", "10,400+") when scrolled into view. */
function AnimatedStatValue({ value }: { value: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const mv = useMotionValue(0);

  const m = /^(\D*)([\d,.]+)(.*)$/.exec(value);
  const prefix = m?.[1] ?? "";
  const numStr = m?.[2] ?? value;
  const suffix = m?.[3] ?? "";
  const hasComma = numStr.includes(",");
  const decimals = numStr.includes(".") ? numStr.split(".")[1].length : 0;
  const targetNum = parseFloat(numStr.replace(/,/g, "")) || 0;

  const fmt = (v: number) => {
    const fixed = v.toFixed(decimals);
    return hasComma
      ? Number(fixed).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
      : fixed;
  };

  const [display, setDisplay] = useState(fmt(0));

  useEffect(() => {
    if (!inView || !m) {
      if (!m) setDisplay(value);
      return;
    }
    const controls = animate(mv, targetNum, {
      duration: 1.5,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(fmt(v)),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView]);

  if (!m) return <span ref={ref}>{value}</span>;
  return (
    <span ref={ref}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}

const FAQ_ITEMS = [
  {
    q: "How does the Escrow service protect my payment?",
    a: "Funds are held in a regulated escrow account until you confirm the goods match your quality, quantity, and lead-time requirements. Only then are they released to the supplier.",
  },
  {
    q: "What does \"Verified Supplier\" mean?",
    a: "Every supplier passes a multi-stage KYC, document, and on-site audit. We verify business licenses, export history, and production capacity before they can transact on the platform.",
  },
  {
    q: "Can I post a custom RFQ and get competing quotes?",
    a: "Yes. Use the Post Inquiry button to publish a Request for Quote. Verified suppliers in the matching category will respond with sealed offers you can compare side-by-side.",
  },
  {
    q: "Which payment methods are supported?",
    a: "We support SWIFT wire transfer, T/T, L/C at sight, Escrow, and local rails including Telebirr, CBE Birr, Chapa, and ArifPay. Payment terms are negotiable per supplier.",
  },
  {
    q: "How are disputes and quality issues resolved?",
    a: "Our trade assurance team mediates within 48 hours, backed by independent third-party inspections (SGS, Bureau Veritas) and a structured refund or replacement workflow.",
  },
  {
    q: "Is there a fee to use the marketplace?",
    a: "Buyers pay nothing to source, post RFQs, or message suppliers. A small escrow fee (0.6-1.2%) only applies to successfully released transactions.",
  },
];

/* ─────────────────────────────────────────────────────────────────────────
   🧩 SUB COMPONENTS
   ───────────────────────────────────────────────────────────────────────── */

function Stars({ rating }: { rating: number }) {
  return (
    <div className="inline-flex items-center gap-0.5 text-amber-500">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn("h-3.5 w-3.5", i <= Math.round(rating) ? "fill-current" : "opacity-30")}
        />
      ))}
    </div>
  );
}

function PillBadge({
  icon: Icon,
  children,
  tone = "primary",
}: {
  icon: React.ElementType;
  children: React.ReactNode;
  tone?: "primary" | "emerald" | "blue" | "amber" | "violet";
}) {
  const toneClass = {
    primary: "bg-primary/10 text-primary border-primary/20",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
  }[tone];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest backdrop-blur", toneClass)}>
      <Icon className="h-3 w-3" />
      {children}
    </span>
  );
}

function ProductCard({
  product,
  onContact,
  onQuote,
}: {
  product: Product;
  onContact: (p: Product) => void;
  onQuote: (p: Product) => void;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.4 }}
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-border/60 bg-card/70 backdrop-blur-xl shadow-sm hover:shadow-2xl hover:shadow-primary/10 hover:border-primary/40 transition-all duration-500"
    >
      <Link
        href={`/marketplace/product/${product.id}`}
        className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-muted/30 to-muted/10 block"
      >
        <img
          src={product.img}
          alt={product.name}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {product.badges.map((b) => (
            <span
              key={b}
              className="inline-flex items-center gap-1 rounded-full bg-background/90 backdrop-blur-md border border-border/60 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-foreground shadow"
            >
              {b === "Trending" && <Flame className="h-3 w-3 text-orange-500" />}
              {b === "Top Rated" && <Star className="h-3 w-3 text-amber-500 fill-current" />}
              {b === "Organic" && <Sparkles className="h-3 w-3 text-emerald-500" />}
              {b === "Hot" && <Flame className="h-3 w-3 text-rose-500" />}
              {b === "Fast Ship" && <Plane className="h-3 w-3 text-blue-500" />}
              {b === "OEM" && <Settings2 className="h-3 w-3 text-violet-500" />}
              {b === "Eco" && <Sparkles className="h-3 w-3 text-emerald-500" />}
              {b === "Fair Trade" && <BadgeCheck className="h-3 w-3 text-blue-500" />}
              {b === "Export Ready" && <Ship className="h-3 w-3 text-blue-500" />}
              {b}
            </span>
          ))}
        </div>
        {product.tradeAssurance && (
          <div className="absolute top-3 right-3">
            <PillBadge icon={ShieldCheck} tone="emerald">
              Trade Assurance
            </PillBadge>
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-5 gap-4">
        <div>
          <Link
            href={`/marketplace/product/${product.id}`}
            className="block line-clamp-2 text-base font-bold leading-snug tracking-tight text-foreground min-h-[2.75rem] hover:text-primary transition-colors"
          >
            {product.name}
          </Link>
          <button
            onClick={() => onContact(product)}
            className="mt-2 flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors text-left"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-primary/20 to-primary/5 text-[10px] font-black text-primary">
              {product.supplierLogo}
            </span>
            <span className="font-semibold truncate">{product.supplier}</span>
            {product.verified && <BadgeCheck className="h-3.5 w-3.5 text-blue-500 shrink-0" />}
          </button>
          <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
            <Stars rating={product.rating} />
            <span className="font-bold text-foreground">{product.rating}</span>
            <span>· {product.reviews.toLocaleString()} reviews</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-md bg-muted/50 px-2 py-1">
            <MapPin className="h-3 w-3" /> {product.location}
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-muted/50 px-2 py-1">
            <Clock className="h-3 w-3" /> {product.leadTime}
          </span>
        </div>

        <div className="mt-auto border-t border-border/50 pt-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">FOB Price</p>
            <p className="text-2xl font-black text-primary leading-none mt-1">{product.price}</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              MOQ: <span className="font-bold text-foreground">{product.moq}</span>
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Button
              size="sm"
              onClick={() => onContact(product)}
              className="h-9 rounded-xl bg-foreground text-background hover:bg-foreground/90 font-bold text-xs gap-1"
            >
              <MessageSquare className="h-3.5 w-3.5" /> Contact
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onQuote(product)}
              className="h-9 rounded-xl border-border/60 font-bold text-xs gap-1"
            >
              <FileText className="h-3.5 w-3.5" /> Get Quote
            </Button>
          </div>
        </div>

        <AddToCartButton
          product={{ id: product.id, name: product.name, image: product.img, supplier: product.supplier, priceLabel: product.price, moq: product.moq }}
          className="w-full h-9 text-xs"
        />
      </div>
    </motion.article>
  );
}

function SupplierCard({ supplier }: { supplier: Supplier }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="group flex flex-col gap-4 rounded-3xl border border-border/60 bg-card/60 backdrop-blur-xl p-6 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all"
    >
      <div className="flex items-start gap-4">
        <div className="relative h-14 w-14 shrink-0 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-lg font-black text-primary border border-primary/20">
          {supplier.logo}
          {supplier.premium && (
            <div className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-amber-500 flex items-center justify-center shadow-md">
              <Sparkles className="h-2.5 w-2.5 text-white" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h4 className="font-bold text-sm truncate">{supplier.name}</h4>
            {supplier.verified && <BadgeCheck className="h-4 w-4 text-blue-500 shrink-0" />}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {supplier.flag} {supplier.country} · {supplier.years} yrs
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <Stars rating={supplier.rating} />
            <span className="text-[11px] font-bold">{supplier.rating}</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-xl bg-muted/40 px-3 py-2">
          <p className="text-muted-foreground">Products</p>
          <p className="font-bold text-foreground">{supplier.products.toLocaleString()}</p>
        </div>
        <div className="rounded-xl bg-muted/40 px-3 py-2">
          <p className="text-muted-foreground">On-Time</p>
          <p className="font-bold text-emerald-600 dark:text-emerald-400">
            {supplier.onTimeRate != null ? `${supplier.onTimeRate}%` : "98.7%"}
          </p>
        </div>
      </div>
      {supplier.id != null ? (
        <Button
          asChild
          variant="outline"
          size="sm"
          className="w-full h-9 rounded-xl text-xs font-bold group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all"
        >
          <Link href={`/marketplace/supplier/${supplier.id}`}>
            View Supplier <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
          </Link>
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="w-full h-9 rounded-xl text-xs font-bold group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all"
        >
          View Supplier <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      )}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   🪟 MODAL: RFQ + Contact Supplier
   ───────────────────────────────────────────────────────────────────────── */

type FormState = "idle" | "submitting" | "success" | "error";

function ContactSupplierDialog({
  product,
  open,
  onOpenChange,
}: {
  product: Product | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [state, setState] = useState<FormState>("idle");
  const [form, setForm] = useState({ name: "", email: "", company: "", message: "" });

  useEffect(() => {
    if (!open) {
      setState("idle");
      setForm({ name: "", email: "", company: "", message: "" });
    }
  }, [open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setState("submitting");
    setTimeout(() => {
      setState("success");
    }, 800);
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-3xl border-border/60 bg-card/95 backdrop-blur-xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            Trade-Assured Inquiry
          </div>
          <DialogTitle className="text-xl font-black tracking-tight">
            Contact {product.supplier}
          </DialogTitle>
          <DialogDescription>
            Your message goes directly to the supplier. Replies typically arrive within 24 hours.
          </DialogDescription>
        </DialogHeader>

        {state === "success" ? (
          <div className="py-8 text-center space-y-3">
            <div className="mx-auto h-14 w-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <h3 className="text-lg font-black">Inquiry sent</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              We've forwarded your message to <span className="font-bold text-foreground">{product.supplier}</span>.
              Watch your inbox — and your dashboard — for their reply.
            </p>
            <Button
              onClick={() => onOpenChange(false)}
              className="mt-4 rounded-full px-6 font-bold"
            >
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="rounded-2xl border border-border/60 bg-muted/30 p-3 flex items-center gap-3">
              <img
                src={product.img}
                alt={product.name}
                className="h-12 w-12 rounded-xl object-cover"
                onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold line-clamp-1">{product.name}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {product.supplier} · MOQ {product.moq}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Name *</label>
                <Input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Jane Doe"
                  className="h-10 rounded-xl bg-muted/30"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Company</label>
                <Input
                  value={form.company}
                  onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                  placeholder="Acme Imports"
                  className="h-10 rounded-xl bg-muted/30"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Business Email *</label>
              <Input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="you@company.com"
                className="h-10 rounded-xl bg-muted/30"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Message *</label>
              <Textarea
                required
                rows={4}
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                placeholder={`Hi ${product.supplier}, we're interested in ${product.name} (MOQ ${product.moq}). Please send your best FOB price and lead time to Lagos.`}
                className="rounded-xl bg-muted/30 resize-none"
              />
            </div>

            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-[11px] text-emerald-700 dark:text-emerald-300 flex items-start gap-2">
              <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>Your contact details are protected by our Buyer Privacy Shield. Suppliers see your inquiry only after mutual confirmation.</span>
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="rounded-full font-bold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={state === "submitting"}
                className="rounded-full px-6 font-bold gap-2 shadow-lg shadow-primary/20"
              >
                {state === "submitting" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Sending…
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" /> Send Inquiry
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RfqDialog({
  open,
  onOpenChange,
  prefill,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prefill?: string;
}) {
  const [state, setState] = useState<FormState>("idle");
  const [form, setForm] = useState({
    title: prefill ?? "",
    category: "general",
    quantity: "",
    targetPrice: "",
    destination: "",
    details: "",
    name: "",
    email: "",
  });

  useEffect(() => {
    if (open) {
      setForm((f) => ({ ...f, title: prefill ?? f.title }));
    } else {
      setState("idle");
    }
  }, [open, prefill]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setState("submitting");
    setTimeout(() => {
      setState("success");
    }, 900);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl rounded-3xl border-border/60 bg-card/95 backdrop-blur-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary">
            <FileText className="h-3.5 w-3.5" />
            Post a Request for Quote
          </div>
          <DialogTitle className="text-2xl font-black tracking-tight">
            Get sealed quotes from verified suppliers
          </DialogTitle>
          <DialogDescription>
            Free to post. Suppliers typically respond within 24-72 hours.
          </DialogDescription>
        </DialogHeader>

        {state === "success" ? (
          <div className="py-10 text-center space-y-4">
            <div className="mx-auto h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            </div>
            <h3 className="text-xl font-black">RFQ Published</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Your RFQ has been broadcast to 1,000+ suppliers in the matching category.
              You'll receive sealed quotes in your dashboard inbox.
            </p>
            <div className="flex justify-center gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setState("idle");
                  setForm({ title: "", category: "general", quantity: "", targetPrice: "", destination: "", details: "", name: "", email: "" });
                }}
                className="rounded-full font-bold"
              >
                Post Another
              </Button>
              <Link href="/auth/signup" onClick={() => onOpenChange(false)}>
                <Button className="rounded-full font-bold gap-2 shadow-lg shadow-primary/20">
                  Open My Dashboard <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">What do you need? *</label>
              <Input
                required
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. 10,000 cotton t-shirts, OEM, neutral label"
                className="h-11 rounded-xl bg-muted/30"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Category *</label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger className="h-11 rounded-xl bg-muted/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="electronics">Electronics & Gadgets</SelectItem>
                    <SelectItem value="machinery">Industrial Machinery</SelectItem>
                    <SelectItem value="apparel">Apparel & Textiles</SelectItem>
                    <SelectItem value="agriculture">Agriculture & Food</SelectItem>
                    <SelectItem value="general">General / Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Quantity *</label>
                <Input
                  required
                  value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                  placeholder="e.g. 5,000 units"
                  className="h-11 rounded-xl bg-muted/30"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Target Price</label>
                <Input
                  value={form.targetPrice}
                  onChange={(e) => setForm((f) => ({ ...f, targetPrice: e.target.value }))}
                  placeholder="e.g. $4.50 / unit"
                  className="h-11 rounded-xl bg-muted/30"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ship To</label>
                <Input
                  value={form.destination}
                  onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))}
                  placeholder="e.g. Mombasa, Kenya"
                  className="h-11 rounded-xl bg-muted/30"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Specifications</label>
              <Textarea
                rows={4}
                value={form.details}
                onChange={(e) => setForm((f) => ({ ...f, details: e.target.value }))}
                placeholder="Quality grade, packaging, certifications, sample requirements…"
                className="rounded-xl bg-muted/30 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Your Name *</label>
                <Input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Jane Doe"
                  className="h-11 rounded-xl bg-muted/30"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Email *</label>
                <Input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="you@company.com"
                  className="h-11 rounded-xl bg-muted/30"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="rounded-full font-bold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={state === "submitting"}
                className="rounded-full px-6 font-bold gap-2 shadow-lg shadow-primary/20"
              >
                {state === "submitting" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Publishing…
                  </>
                ) : (
                  <>
                    <Rocket className="h-4 w-4" /> Publish RFQ
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   🧭 NAV
   ───────────────────────────────────────────────────────────────────────── */

function TopNav({ onPostRfq, onOpenCart, brandName = "B2B Marketplace" }: { onPostRfq: () => void; onOpenCart: () => void; brandName?: string }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const { count: cartCount } = useCart();

  useEffect(() => {
    setLoggedIn(!!getAccessToken());
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { label: "Categories", href: "#categories" },
    { label: "Products", href: "#products" },
    { label: "Suppliers", href: "#suppliers" },
    { label: "How it Works", href: "#escrow" },
    { label: "FAQ", href: "#faq" },
  ];

  const onTenantHost = typeof window !== "undefined" ? isTenantHost(window.location.hostname) : true;
  const signInHref = onTenantHost ? "/sign-in" : "/sign-in";
  const signUpHref = "/auth/signup";

  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-background/80 backdrop-blur-2xl border-b border-border/60 shadow-sm"
          : "bg-transparent"
      )}
    >
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="relative h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-rose-500 flex items-center justify-center shadow-lg shadow-primary/30 group-hover:scale-110 transition-transform">
              <Globe2 className="h-5 w-5 text-white" />
              <div className="absolute inset-0 rounded-xl bg-primary/40 blur-xl -z-10 opacity-50 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-black tracking-tight">{brandName}</p>
              <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Marketplace</p>
            </div>
          </Link>

          <div className="hidden lg:flex items-center gap-1">
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="px-3.5 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground rounded-full hover:bg-muted/60 transition-colors"
              >
                {l.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <div className="hidden sm:flex items-center">
              <LanguageSwitcher />
              <div className="w-px h-5 bg-border mx-1" />
              <ThemeToggle />
            </div>
            <Link href={loggedIn ? "/dashboard/b2b-marketplace" : signInHref} className="hidden sm:block">
              <Button variant="ghost" className="rounded-full font-bold text-sm h-9 px-4">
                {loggedIn ? "Dashboard" : "Sign In"}
              </Button>
            </Link>
            <Button
              variant="outline"
              size="icon"
              onClick={onOpenCart}
              aria-label="Open cart"
              className="relative h-9 w-9 rounded-full"
            >
              <ShoppingCart className="h-4 w-4" />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-black text-primary-foreground">
                  {cartCount}
                </span>
              )}
            </Button>
            <Button
              onClick={onPostRfq}
              className="rounded-full font-bold text-sm h-9 px-4 gap-1.5 shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
            >
              <Rocket className="h-4 w-4" />
              <span className="hidden sm:inline">Post RFQ</span>
              <span className="sm:hidden">RFQ</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="lg:hidden h-9 w-9 rounded-full"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="lg:hidden overflow-hidden border-t border-border/60"
            >
              <div className="py-3 space-y-1">
                {links.map((l) => (
                  <a
                    key={l.label}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="block px-3 py-2 text-sm font-semibold text-foreground rounded-lg hover:bg-muted/60"
                  >
                    {l.label}
                  </a>
                ))}
                <Link
                  href={signInHref}
                  className="block px-3 py-2 text-sm font-semibold rounded-lg hover:bg-muted/60"
                >
                  Sign In
                </Link>
                <Link
                  href={signUpHref}
                  className="block px-3 py-2 text-sm font-bold text-primary rounded-lg hover:bg-muted/60"
                >
                  Create Free Account
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </header>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   🌐 MAIN COMPONENT
   ───────────────────────────────────────────────────────────────────────── */

export default function B2BLandingTemplate({
  brandSettings,
  template,
  tenantName,
}: {
  brandSettings?: B2BBrandSettings;
  template?: TenantLandingTemplate | null;
  tenantName?: string;
} = {}) {
  const { t } = useTranslation();

  // ── Resolve content from the tenant landing template; fall back to built-in defaults ──
  const b2b = template?.b2b ?? {};
  const brandName = brandSettings?.app_title?.trim() || tenantName?.trim() || "B2B Marketplace";
  const pubImg = (u?: string) => {
    if (!u) return "";
    // Absolute URLs and rooted public paths (e.g. /images/b2b/…) pass through untouched;
    // bare storage keys are resolved to a public serve URL.
    if (u.startsWith("http") || u.startsWith("/")) return u;
    return getPublicServeUrl(u) ?? u;
  };

  // ── Live marketplace catalog (real DB data) — takes priority over template/defaults ──
  const apiRoot = getBackendApiRoot();
  const { data: liveCatalog } = useQuery({
    queryKey: ["b2bPublicCatalog", tenantName ?? "tenant"],
    queryFn: async () => {
      const headers = { Accept: "application/json", ...getTenantHeaders() };
      const pull = async (path: string) => {
        try {
          const res = await fetch(`${apiRoot}/public/b2b/${path}`, { headers });
          if (!res.ok) return [];
          const json = await res.json();
          return Array.isArray(json?.data) ? json.data : [];
        } catch {
          return [];
        }
      };
      const [categories, products, suppliers] = await Promise.all([
        pull("categories"),
        pull("products"),
        pull("suppliers"),
      ]);
      return { categories, products, suppliers };
    },
    staleTime: 120000,
    retry: 1,
  });
  const liveCategories: any[] = liveCatalog?.categories ?? [];
  const liveProducts: any[] = liveCatalog?.products ?? [];
  const liveSuppliers: any[] = liveCatalog?.suppliers ?? [];

  const STAT_ICONS: Record<string, React.ElementType> = {
    store: Store, suppliers: Store, dollar: CircleDollarSign, gmv: CircleDollarSign,
    globe: Globe2, countries: Globe2, truck: Truck, delivery: Truck,
    users: Users, shield: ShieldCheck, trending: TrendingUp, chart: BarChart3,
  };

  const hero = {
    badge: b2b.hero?.badge?.trim() || "Trusted by 24,000+ businesses in 184 countries",
    title: b2b.hero?.title?.trim() || "Source globally.",
    titleHighlight: b2b.hero?.title_highlight?.trim() || "Scale confidently.",
    subtitle:
      b2b.hero?.subtitle?.trim() ||
      "Connect with verified wholesale manufacturers, run competitive RFQs, and ship safely with built-in Escrow and end-to-end logistics tracking.",
    searchPlaceholder: b2b.hero?.search_placeholder?.trim() || "Search 10,400+ products, suppliers, MOQs…",
    trending:
      Array.isArray(b2b.hero?.trending) && b2b.hero!.trending!.length > 0
        ? b2b.hero!.trending!
        : ["Smartphones", "Coffee Beans", "Excavators", "Workwear", "Solar Panels"],
  };

  const stats =
    Array.isArray(b2b.stats) && b2b.stats.length > 0
      ? b2b.stats.slice(0, 4).map((s) => ({ value: s.value, label: s.label, icon: STAT_ICONS[(s.icon || "").toLowerCase()] ?? Store }))
      : STATS;

  const slugify = (s: string) =>
    (s || "").toLowerCase().replace(/&/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const mapCategory = (c: any): Category => ({
    name: c.name,
    slug: c.slug || slugify(c.name),
    img: pubImg(c.image) || "/images/b2b/cat_electronics.png",
    count: c.count ?? "",
    growth: c.growth ?? "",
    description: c.description ?? "",
    suppliers: c.suppliers ?? 0,
  });
  const mapProduct = (p: any, i: number): Product => ({
    id: p.id != null ? String(p.id) : `p-${i}`,
    name: p.name,
    price: p.price ?? "",
    moq: p.moq ?? "",
    img: pubImg(p.image),
    supplier: p.supplier ?? "",
    supplierLogo: p.supplier_logo || (p.supplier ? p.supplier.slice(0, 2).toUpperCase() : "SP"),
    rating: p.rating ?? 5,
    reviews: p.reviews ?? 0,
    location: p.location ?? "",
    verified: p.verified ?? true,
    tradeAssurance: p.trade_assurance ?? true,
    badges: Array.isArray(p.badges) ? p.badges : [],
    leadTime: p.lead_time ?? "",
    category: p.category ?? "",
  });
  const mapSupplier = (s: any): Supplier => ({
    id: typeof s.id === "number" ? s.id : undefined,
    name: s.name,
    logo: s.logo || (s.name ? s.name.slice(0, 2).toUpperCase() : "SP"),
    country: s.country ?? "",
    flag: s.flag ?? "",
    rating: s.rating ?? 5,
    years: s.years ?? 0,
    products: s.products ?? 0,
    verified: s.verified ?? true,
    premium: s.premium ?? false,
    onTimeRate: s.on_time_rate ?? null,
  });

  // Priority: live DB catalog → tenant landing template → built-in demo defaults.
  const categories: Category[] =
    liveCategories.length > 0
      ? liveCategories.map(mapCategory)
      : Array.isArray(b2b.categories) && b2b.categories.length > 0
        ? b2b.categories.map(mapCategory)
        : CATEGORIES;

  const products: Product[] =
    liveProducts.length > 0
      ? liveProducts.map(mapProduct)
      : Array.isArray(b2b.products) && b2b.products.length > 0
        ? b2b.products.map(mapProduct)
        : PRODUCTS;

  const suppliers: Supplier[] =
    liveSuppliers.length > 0
      ? liveSuppliers.map(mapSupplier)
      : Array.isArray(b2b.suppliers) && b2b.suppliers.length > 0
        ? b2b.suppliers.map(mapSupplier)
        : SUPPLIERS;

  const testimonials: Testimonial[] =
    Array.isArray(b2b.testimonials) && b2b.testimonials.length > 0
      ? b2b.testimonials.map((tm) => ({
          quote: tm.quote,
          author: tm.author,
          role: tm.role ?? "",
          company: tm.company ?? "",
          flag: tm.flag ?? "",
          amount: tm.amount ?? "",
        }))
      : TESTIMONIALS;

  const faqs =
    Array.isArray(b2b.faqs) && b2b.faqs.length > 0
      ? b2b.faqs.map((f) => ({ q: f.question, a: f.answer }))
      : FAQ_ITEMS;

  const cta = {
    badge: b2b.cta?.badge?.trim() || "Start in 60 seconds",
    title: b2b.cta?.title?.trim() || "Ready to scale your global sourcing?",
    description: b2b.cta?.description?.trim() || "Join 24,000+ businesses already trading with confidence. No fees to source.",
  };

  // Category options for the search filter, derived from the resolved categories
  const categoryOptions = categories.map((c) => c.name);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchCategory, setSearchCategory] = useState("all");
  const [contactProduct, setContactProduct] = useState<Product | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [rfqOpen, setRfqOpen] = useState(false);
  const [rfqPrefill, setRfqPrefill] = useState<string | undefined>(undefined);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Debounce the search box so we don't hammer Meilisearch on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
    return () => clearTimeout(id);
  }, [searchQuery]);

  // Meilisearch-backed product search (server side) when a query is present.
  const { data: searchHits, isFetching: isSearching } = useQuery({
    queryKey: ["b2bSearch", debouncedQuery, searchCategory],
    queryFn: () => B2BApi.search(debouncedQuery, searchCategory !== "all" ? searchCategory : undefined),
    enabled: debouncedQuery.length > 0,
    staleTime: 30000,
  });

  const filteredProducts = useMemo(() => {
    // With an active query, show Meilisearch results (already category-filtered server-side).
    if (debouncedQuery.length > 0) {
      return (searchHits ?? []).map(mapProduct);
    }
    // No query → simple client-side category filter over the loaded catalog.
    return products.filter((p) => searchCategory === "all" || p.category === searchCategory);
  }, [debouncedQuery, searchHits, products, searchCategory]);

  const handleContact = (p: Product) => {
    setContactProduct(p);
    setContactOpen(true);
  };

  const handleQuote = (p: Product) => {
    setRfqPrefill(`${p.name} (MOQ ${p.moq})`);
    setRfqOpen(true);
  };

  const handlePostRfq = () => {
    setRfqPrefill(undefined);
    setRfqOpen(true);
  };

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  return (
    <div className="relative min-h-screen w-full text-foreground overflow-x-hidden">
      {/* 🌌 Living WebGL trade-network backdrop (whole page) */}
      <MarketplaceBackdrop />
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(244,63,94,0.06),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(59,130,246,0.06),transparent_55%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.03)_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:60px_60px] opacity-60" />
      </div>

      <TopNav onPostRfq={handlePostRfq} onOpenCart={() => setCartOpen(true)} brandName={brandName} />
      <CartSheet open={cartOpen} onOpenChange={setCartOpen} />

      {/* 1️⃣ HERO */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 px-4 sm:px-6 overflow-hidden">
        {/* 🌐 three.js trade-network globe (decorative background) */}
        <HeroGlobe className="pointer-events-none absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 h-[680px] w-[680px] sm:h-[820px] sm:w-[820px] max-w-none opacity-60 dark:opacity-70 [mask-image:radial-gradient(circle,black_35%,transparent_72%)]" />
        <div className="relative z-10 mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-4xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 backdrop-blur-md px-4 py-1.5 text-xs font-bold text-primary mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              {hero.badge}
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-black tracking-tighter leading-[0.95]">
              {hero.title}
              <br />
              <span className="bg-gradient-to-r from-primary via-rose-500 to-amber-500 bg-clip-text text-transparent">
                {hero.titleHighlight}
              </span>
            </h1>

            <p className="mt-7 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              {hero.subtitle}
            </p>

            {/* Search bar */}
            <div className="mt-10 mx-auto max-w-3xl">
              <div className="relative rounded-3xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-2xl shadow-primary/10 p-2 sm:p-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <Select value={searchCategory} onValueChange={setSearchCategory}>
                    <SelectTrigger className="h-12 sm:h-14 sm:w-44 rounded-2xl border-0 bg-muted/40 font-semibold text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      <SelectItem value="all">All Categories</SelectItem>
                      {categoryOptions.map((name) => (
                        <SelectItem key={name} value={name}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex-1 relative flex items-center">
                    <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          scrollTo("products");
                        }
                      }}
                      placeholder={hero.searchPlaceholder}
                      className="h-12 sm:h-14 pl-10 rounded-2xl border-0 bg-muted/30 text-base focus-visible:ring-0"
                    />
                  </div>
                  <Button
                    onClick={() => scrollTo("products")}
                    className="h-12 sm:h-14 px-6 rounded-2xl font-bold text-base gap-2 shadow-lg shadow-primary/30 hover:scale-[1.02] active:scale-100 transition-transform"
                  >
                    <Search className="h-4 w-4" /> Search
                  </Button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
                <span className="text-[10px] font-bold uppercase tracking-widest mr-1">Trending:</span>
                {hero.trending.map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setSearchQuery(t);
                      setTimeout(() => scrollTo("products"), 50);
                    }}
                    className="rounded-full border border-border/60 bg-background/60 px-3 py-1 hover:border-primary hover:text-primary transition-colors"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Trust strip */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs sm:text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-500" /> Trade Assurance
              </span>
              <span className="inline-flex items-center gap-1.5">
                <BadgeCheck className="h-4 w-4 text-blue-500" /> Verified Suppliers
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Ship className="h-4 w-4 text-violet-500" /> End-to-End Logistics
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-amber-500" /> Escrow Protection
              </span>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto"
          >
            {stats.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.label}
                  className="group rounded-3xl border border-border/60 bg-card/60 backdrop-blur-xl p-6 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all"
                >
                  <Icon className="h-5 w-5 text-primary mb-3 group-hover:scale-110 transition-transform" />
                  <p className="text-3xl font-black tracking-tight"><AnimatedStatValue value={s.value} /></p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">
                    {s.label}
                  </p>
                </div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* 2️⃣ CATEGORIES */}
      <section id="categories" className="py-20 px-4 sm:px-6 bg-muted/10 border-y border-border/60 backdrop-blur-[2px]">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
            <div>
              <Badge className="mb-3 bg-primary/10 text-primary border-primary/20 text-[10px]">
                Top Sourcing Categories
              </Badge>
              <h2 className="text-4xl sm:text-5xl font-black tracking-tight">
                Browse by industry
              </h2>
              <p className="text-muted-foreground mt-2 max-w-xl">
                Pre-vetted factories and bulk suppliers across the world's most competitive categories.
              </p>
            </div>
            <Button
              variant="ghost"
              className="rounded-full font-bold gap-1"
              onClick={() => { setSearchQuery(""); setSearchCategory("all"); scrollTo("products"); }}
            >
              Browse all products <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {categories.map((c, i) => (
              <motion.div
                key={c.name}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05, duration: 0.4 }}
              >
              <Link
                href={`/marketplace/category/${c.slug}`}
                className="group relative block text-left overflow-hidden rounded-3xl aspect-[4/5] border border-border/60 hover:border-primary/50 transition-all hover:shadow-2xl hover:shadow-primary/10"
              >
                <img
                  src={c.img}
                  alt={c.name}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                  onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/10" />
                <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute inset-0 p-6 flex flex-col justify-end text-white">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold backdrop-blur">
                      <TrendingUp className="h-3 w-3" /> {c.growth}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">
                      {c.suppliers} suppliers
                    </span>
                  </div>
                  <h3 className="text-2xl font-black mb-1.5">{c.name}</h3>
                  <p className="text-sm text-white/80 line-clamp-2">{c.description}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs font-bold text-white/90">{c.count}</span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur px-3 py-1.5 text-xs font-bold group-hover:bg-white group-hover:text-black transition-all">
                      View details
                      <ArrowRight className="h-3.5 w-3.5 -rotate-45 group-hover:rotate-0 transition-transform" />
                    </span>
                  </div>
                </div>
              </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 3️⃣ TRENDING PRODUCTS */}
      <section id="products" className="py-24 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
            <div>
              <Badge className="mb-3 bg-orange-500/10 text-orange-500 border-orange-500/20 text-[10px]">
                <Flame className="h-3 w-3 mr-1" /> Trending Wholesale
              </Badge>
              <h2 className="text-4xl sm:text-5xl font-black tracking-tight">
                {searchQuery
                  ? `Results for "${searchQuery}"`
                  : searchCategory !== "all"
                  ? searchCategory
                  : "High-margin deals, low MOQs"}
              </h2>
              <p className="text-muted-foreground mt-2 inline-flex items-center gap-2">
                {isSearching && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                {debouncedQuery
                  ? `${filteredProducts.length} result${filteredProducts.length === 1 ? "" : "s"} via Meilisearch`
                  : `${filteredProducts.length} of ${products.length} products · curated daily`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery("");
                  setSearchCategory("all");
                }}
                className="rounded-full font-bold text-sm h-10"
              >
                <X className="h-4 w-4 mr-1" /> Clear
              </Button>
              <Button
                onClick={handlePostRfq}
                className="rounded-full font-bold text-sm h-10 gap-1.5 shadow-lg shadow-primary/20"
              >
                <Plus className="h-4 w-4" /> Post RFQ
              </Button>
            </div>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border/60 bg-card/40 p-16 text-center">
              <div className="mx-auto h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
                <Search className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-black">No products match your filters</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                Post a custom RFQ and let our verified suppliers come to you with sealed offers.
              </p>
              <Button
                onClick={handlePostRfq}
                className="mt-4 rounded-full font-bold gap-1.5 shadow-lg shadow-primary/20"
              >
                <Rocket className="h-4 w-4" /> Post a Free RFQ
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  onContact={handleContact}
                  onQuote={handleQuote}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 4️⃣ SUPPLIER DIRECTORY */}
      <section id="suppliers" className="py-24 px-4 sm:px-6 bg-muted/10 border-y border-border/60 backdrop-blur-[2px]">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
            <div>
              <Badge className="mb-3 bg-blue-500/10 text-blue-500 border-blue-500/20 text-[10px]">
                <Users className="h-3 w-3 mr-1" /> Top-Rated Suppliers
              </Badge>
              <h2 className="text-4xl sm:text-5xl font-black tracking-tight">
                Verified partners, on-time delivery
              </h2>
              <p className="text-muted-foreground mt-2 max-w-xl">
                Every supplier is KYC-verified, on-site audited, and tracked on 30+ service metrics.
              </p>
            </div>
            <Button asChild variant="ghost" className="rounded-full font-bold gap-1">
              <Link href="/auth/signup">
                Browse all suppliers <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {suppliers.map((s) => (
              <SupplierCard key={s.name} supplier={s} />
            ))}
          </div>
        </div>
      </section>

      {/* 5️⃣ ESCROW TIMELINE */}
      <section id="escrow" className="py-24 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px] -z-10" />
        <div className="mx-auto max-w-6xl">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <Badge className="mb-3 bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px]">
              <ShieldCheck className="h-3 w-3 mr-1" /> Protected End-to-End
            </Badge>
            <h2 className="text-4xl sm:text-5xl font-black tracking-tight">
              From inquiry to delivery — fully secured
            </h2>
            <p className="text-muted-foreground mt-4 text-lg">
              Our integrated Escrow holds funds until you've received and verified the goods.
              Zero risk, total visibility.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6 relative">
            <div className="hidden md:block absolute top-10 left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-border to-transparent" />
            {[
              { step: "01", title: "Browse & RFQ", desc: "Discover suppliers or post a custom Request for Quote.", icon: Search, color: "text-blue-500", bg: "bg-blue-500/10" },
              { step: "02", title: "Fund Escrow", desc: "Deposit funds safely. Money is held in a regulated vault.", icon: Lock, color: "text-violet-500", bg: "bg-violet-500/10" },
              { step: "03", title: "Produce & Ship", desc: "Supplier produces, our logistics partners handle freight.", icon: Truck, color: "text-amber-500", bg: "bg-amber-500/10" },
              { step: "04", title: "Inspect & Release", desc: "Inspect on arrival. Approve to release funds to supplier.", icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10" },
            ].map((s, i) => {
              const Icon = s.icon;
              return (
                <motion.div
                  key={s.step}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.4 }}
                  className="relative text-center space-y-4"
                >
                  <div className="relative mx-auto">
                    <div className={cn("h-20 w-20 mx-auto rounded-3xl border-2 border-border bg-card shadow-xl flex items-center justify-center", s.bg)}>
                      <Icon className={cn("h-8 w-8", s.color)} />
                    </div>
                    <div className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-foreground text-background text-xs font-black flex items-center justify-center shadow-lg">
                      {s.step}
                    </div>
                  </div>
                  <h3 className="font-black text-lg">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-[200px] mx-auto">
                    {s.desc}
                  </p>
                </motion.div>
              );
            })}
          </div>

          <div className="mt-16 grid sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {[
              { icon: ShieldCheck, label: "Funds held in regulated escrow", tone: "text-emerald-500" },
              { icon: FileText, label: "Third-party inspection (SGS / BV)", tone: "text-blue-500" },
              { icon: Headphones, label: "24/7 dispute resolution team", tone: "text-violet-500" },
            ].map((t) => {
              const Icon = t.icon;
              return (
                <div
                  key={t.label}
                  className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/60 backdrop-blur p-4"
                >
                  <Icon className={cn("h-5 w-5 shrink-0", t.tone)} />
                  <span className="text-sm font-semibold">{t.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 6️⃣ TESTIMONIALS */}
      <section className="py-24 px-4 sm:px-6 bg-muted/10 border-y border-border/60 backdrop-blur-[2px]">
        <div className="mx-auto max-w-6xl">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <Badge className="mb-3 bg-primary/10 text-primary border-primary/20 text-[10px]">
              <QuoteIcon className="h-3 w-3 mr-1" /> Stories from our buyers
            </Badge>
            <h2 className="text-4xl sm:text-5xl font-black tracking-tight">
              Trusted by procurement teams worldwide
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {testimonials.map((tm, i) => (
              <motion.figure
                key={tm.author}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                className="rounded-3xl border border-border/60 bg-card/70 backdrop-blur-xl p-7 hover:border-primary/30 hover:shadow-xl transition-all"
              >
                <QuoteIcon className="h-7 w-7 text-primary/40 mb-3" />
                <blockquote className="text-sm leading-relaxed text-foreground">
                  "{tm.quote}"
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-sm font-black text-primary">
                    {tm.author.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{tm.author}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {tm.role} · {tm.company}
                    </p>
                  </div>
                  <span className="text-xl">{tm.flag}</span>
                </figcaption>
                <div className="mt-4 pt-4 border-t border-border/60 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                  <span className="text-muted-foreground">{tm.amount}</span>
                  <Stars rating={5} />
                </div>
              </motion.figure>
            ))}
          </div>
        </div>
      </section>

      {/* 7️⃣ WHY US / VALUE PROPS */}
      <section className="py-24 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <Badge className="mb-3 bg-amber-500/10 text-amber-500 border-amber-500/20 text-[10px]">
              <Sparkles className="h-3 w-3 mr-1" /> Why {brandName}
            </Badge>
            <h2 className="text-4xl sm:text-5xl font-black tracking-tight">
              Built for serious buyers
            </h2>
            <p className="text-muted-foreground mt-4 text-lg">
              Procurement teams move 3× faster on our platform vs. cold outreach.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: BadgeCheck, title: "Verified suppliers", desc: "KYC, business license, and on-site audit. No resellers, no middlemen.", tone: "text-blue-500" },
              { icon: Lock, title: "Escrow on every order", desc: "Funds release only when goods match your specs. Chargeback-free payments.", tone: "text-emerald-500" },
              { icon: Ship, title: "Logistics network", desc: "Freight forwarding, customs, and last-mile delivery in 184 countries.", tone: "text-violet-500" },
              { icon: FileText, title: "Quote comparison", desc: "Compare sealed offers side-by-side. Save 8+ hours per sourcing cycle.", tone: "text-amber-500" },
              { icon: Headphones, title: "Multilingual support", desc: "Account managers fluent in EN, FR, AR, ZH, AM, SW, and 12 more languages.", tone: "text-rose-500" },
              { icon: BarChart3, title: "Spend analytics", desc: "Real-time dashboards, savings tracker, and supplier performance scorecards.", tone: "text-cyan-500" },
            ].map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="group rounded-3xl border border-border/60 bg-card/60 backdrop-blur-xl p-6 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all"
                >
                  <div className={cn("h-12 w-12 rounded-2xl bg-muted/60 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform", f.tone)}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-black tracking-tight">{f.title}</h3>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{f.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 8️⃣ FAQ */}
      <section id="faq" className="py-24 px-4 sm:px-6 bg-muted/10 border-y border-border/60 backdrop-blur-[2px]">
        <div className="mx-auto max-w-3xl">
          <div className="text-center mb-12">
            <Badge className="mb-3 bg-primary/10 text-primary border-primary/20 text-[10px]">
              <HelpCircle className="h-3 w-3 mr-1" /> Frequently asked
            </Badge>
            <h2 className="text-4xl sm:text-5xl font-black tracking-tight">
              Answers before you ask
            </h2>
          </div>

          <div className="space-y-3">
            {faqs.map((item, idx) => {
              const open = openFaq === idx;
              return (
                <div
                  key={item.q}
                  className={cn(
                    "rounded-2xl border bg-card/70 backdrop-blur transition-all",
                    open ? "border-primary/40 shadow-lg shadow-primary/5" : "border-border/60"
                  )}
                >
                  <button
                    onClick={() => setOpenFaq(open ? null : idx)}
                    className="w-full flex items-center justify-between gap-4 p-5 text-left"
                  >
                    <span className="font-bold text-sm sm:text-base">{item.q}</span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-muted-foreground shrink-0 transition-transform",
                        open && "rotate-180 text-foreground"
                      )}
                    />
                  </button>
                  <AnimatePresence>
                    {open && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">
                          {item.a}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 9️⃣ CTA */}
      <section className="py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-primary via-rose-500 to-amber-500 p-1 shadow-2xl shadow-primary/30">
            <div className="relative rounded-[2.2rem] bg-gradient-to-br from-primary to-rose-600 p-10 sm:p-16 text-center text-white overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.2),transparent_50%),radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.15),transparent_50%)]" />
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="relative z-10 max-w-2xl mx-auto space-y-6"
              >
                <Badge className="bg-white/20 text-white border-white/30 backdrop-blur">
                  <Rocket className="h-3 w-3 mr-1" /> {cta.badge}
                </Badge>
                <h2 className="text-4xl sm:text-5xl font-black leading-tight">
                  {cta.title}
                </h2>
                <p className="text-white/85 text-lg">
                  {cta.description}
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
                  <Button
                    onClick={handlePostRfq}
                    size="lg"
                    className="h-14 px-8 rounded-full font-bold text-base bg-white text-rose-600 hover:bg-white/90 gap-2 shadow-xl"
                  >
                    <FileText className="h-4 w-4" /> Post a Free RFQ
                  </Button>
                  <Link href="/auth/signup">
                    <Button
                      size="lg"
                      variant="outline"
                      className="h-14 px-8 rounded-full font-bold text-base bg-transparent border-white/40 text-white hover:bg-white/10 gap-2 w-full"
                    >
                      <Store className="h-4 w-4" /> Become a Supplier
                    </Button>
                  </Link>
                </div>
                <p className="text-xs text-white/70 pt-2">
                  Already have an account?{" "}
                  <Link href="/sign-in" className="underline font-bold hover:text-white">
                    Sign in
                  </Link>
                </p>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* 🔟 FOOTER */}
      <footer className="border-t border-border/60 bg-card/30 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
            <div className="col-span-2 sm:col-span-1">
              <Link href="/" className="flex items-center gap-2.5 group">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-rose-500 flex items-center justify-center shadow-lg shadow-primary/30 group-hover:scale-110 transition-transform">
                  <Globe2 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-black tracking-tight">{brandName}</p>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Marketplace</p>
                </div>
              </Link>
              <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
                The world's most trusted B2B sourcing platform. Verified suppliers, escrow payments, and end-to-end logistics in 184 countries.
              </p>
              <div className="flex items-center gap-2 mt-4">
                {[
                  { icon: Globe2, label: "EN" },
                  { icon: Mail, label: "Contact" },
                  { icon: Phone, label: "Call" },
                ].map((s) => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.label}
                      className="h-9 w-9 rounded-full border border-border/60 hover:border-primary hover:text-primary flex items-center justify-center transition-colors"
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest text-foreground mb-4">Marketplace</h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li><a href="#categories" className="hover:text-primary transition-colors">Categories</a></li>
                <li><a href="#products" className="hover:text-primary transition-colors">Trending Products</a></li>
                <li><a href="#suppliers" className="hover:text-primary transition-colors">Top Suppliers</a></li>
                <li><button onClick={handlePostRfq} className="hover:text-primary transition-colors">Post RFQ</button></li>
              </ul>
            </div>
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest text-foreground mb-4">Trust</h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li><a href="#escrow" className="hover:text-primary transition-colors">How Escrow Works</a></li>
                <li><a href="#escrow" className="hover:text-primary transition-colors">Trade Assurance</a></li>
                <li><a href="#faq" className="hover:text-primary transition-colors">FAQ</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Dispute Center</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest text-foreground mb-4">Company</h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li><Link href="/auth/signup" className="hover:text-primary transition-colors">Create Account</Link></li>
                <li><Link href="/sign-in" className="hover:text-primary transition-colors">Sign In</Link></li>
                <li><Link href="/request-demo" className="hover:text-primary transition-colors">Request Demo</Link></li>
                <li><a href="#" className="hover:text-primary transition-colors">Contact Sales</a></li>
              </ul>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} {brandName} · All rights reserved
            </p>
            <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
              <a href="#" className="hover:text-foreground">Privacy</a>
              <a href="#" className="hover:text-foreground">Terms</a>
              <a href="#" className="hover:text-foreground">Cookies</a>
            </div>
          </div>
        </div>
      </footer>

      {/* Floating action: scroll-to-top */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.6, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.6, y: 20 }}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="fixed bottom-6 right-6 z-40 h-12 w-12 rounded-full bg-foreground text-background shadow-2xl flex items-center justify-center hover:scale-110 transition-transform"
          >
            <ChevronUp className="h-5 w-5" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Modals */}
      <ContactSupplierDialog
        product={contactProduct}
        open={contactOpen}
        onOpenChange={setContactOpen}
      />
      <RfqDialog open={rfqOpen} onOpenChange={setRfqOpen} prefill={rfqPrefill} />
    </div>
  );
}
