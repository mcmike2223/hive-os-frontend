"use client";

import React, { useState } from "react";
import {
  Layout,
  Sparkles,
  Utensils,
  Building2,
  Factory,
  Search,
  Columns,
  Grid,
  CreditCard,
  MessageSquareQuote,
  HelpCircle,
  Navigation,
  Footprints,
  Plus
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type BlockCategory = "all" | "layout" | "typography" | "hive_ui" | "restaurant" | "hotel" | "manufacturing" | "retail" | "healthcare" | "education";

export interface CustomBlock {
  id: string;
  name: string;
  category: BlockCategory;
  description: string;
  icon: React.ReactNode;
  content: string;
}

export const HIVE_BLOCKS: CustomBlock[] = [
  // Layout
  {
    id: "layout-container",
    name: "Container",
    category: "layout",
    description: "Responsive max-width container with auto padding.",
    icon: <Layout className="h-4 w-4" />,
    content: `<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div class="p-8 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-slate-500">
        Drop elements inside this Container
      </div>
    </div>`,
  },
  {
    id: "layout-2col",
    name: "2 Columns (50 / 50)",
    category: "layout",
    description: "Two-column responsive flex/grid layout.",
    icon: <Columns className="h-4 w-4" />,
    content: `<div class="grid grid-cols-1 md:grid-cols-2 gap-8 py-8 items-center">
      <div class="space-y-4">
        <h3 class="text-2xl font-bold">Left Column</h3>
        <p class="text-slate-600 dark:text-slate-400">Add content, copy, or bullet points here.</p>
      </div>
      <div class="bg-slate-100 dark:bg-slate-800 rounded-2xl p-8 text-center min-h-[200px] flex items-center justify-center">
        <span class="text-slate-400">Right Column Visual / Image</span>
      </div>
    </div>`,
  },
  {
    id: "layout-3col",
    name: "3 Columns Grid",
    category: "layout",
    description: "Three-column grid for features, cards, or metrics.",
    icon: <Grid className="h-4 w-4" />,
    content: `<div class="grid grid-cols-1 md:grid-cols-3 gap-6 py-8">
      <div class="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-2">
        <h4 class="font-semibold text-lg">Card One</h4>
        <p class="text-sm text-slate-500">Description for the first card column.</p>
      </div>
      <div class="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-2">
        <h4 class="font-semibold text-lg">Card Two</h4>
        <p class="text-sm text-slate-500">Description for the second card column.</p>
      </div>
      <div class="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-2">
        <h4 class="font-semibold text-lg">Card Three</h4>
        <p class="text-sm text-slate-500">Description for the third card column.</p>
      </div>
    </div>`,
  },

  // Hive UI Components
  {
    id: "hive-hero-modern",
    name: "Modern Gradient Hero",
    category: "hive_ui",
    description: "High-impact hero with badge, dual CTA, and metric counter.",
    icon: <Sparkles className="h-4 w-4 text-primary" />,
    content: `<section class="relative overflow-hidden py-20 lg:py-32 bg-slate-950 text-white">
      <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(15,118,110,0.25),transparent_50%)]"></div>
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-8">
        <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-teal-500/30 bg-teal-500/10 text-teal-300 text-xs font-medium">
          <span class="h-2 w-2 rounded-full bg-teal-400 animate-pulse"></span>
          Next-Generation SaaS Platform
        </div>
        <h1 class="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight max-w-4xl mx-auto leading-tight">
          Supercharge Your Business with <span class="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-300">Intelligent Operations</span>
        </h1>
        <p class="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto">
          Scale effortlessly with automated workflows, real-time analytics, and enterprise multi-tenant security built right in.
        </p>
        <div class="flex flex-wrap items-center justify-center gap-4 pt-4">
          <a href="#get-started" class="px-8 py-3.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold shadow-lg shadow-teal-500/25 transition-all">
            Get Started Free
          </a>
          <a href="#demo" class="px-8 py-3.5 rounded-xl border border-slate-800 hover:bg-slate-900 text-slate-200 font-semibold transition-all">
            Book Live Demo
          </a>
        </div>
      </div>
    </section>`,
  },
  {
    id: "hive-navbar",
    name: "Glassmorphism Navbar",
    category: "hive_ui",
    description: "Sticky header with brand logo, links, and CTA button.",
    icon: <Navigation className="h-4 w-4" />,
    content: `<nav class="sticky top-0 z-50 backdrop-blur-md bg-white/80 dark:bg-slate-950/80 border-b border-slate-200/60 dark:border-slate-800/60">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="h-8 w-8 rounded-lg bg-teal-600 flex items-center justify-center text-white font-bold text-lg">H</div>
          <span class="font-bold text-lg tracking-tight">HIVE ERP</span>
        </div>
        <div class="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600 dark:text-slate-300">
          <a href="#features" class="hover:text-teal-600 transition-colors">Features</a>
          <a href="#solutions" class="hover:text-teal-600 transition-colors">Solutions</a>
          <a href="#pricing" class="hover:text-teal-600 transition-colors">Pricing</a>
          <a href="#contact" class="hover:text-teal-600 transition-colors">Contact</a>
        </div>
        <div class="flex items-center gap-3">
          <a href="#login" class="text-sm font-medium hover:text-teal-600 px-3 py-2">Sign In</a>
          <a href="#signup" class="text-sm font-semibold bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-xl shadow-sm transition-all">Start Free</a>
        </div>
      </div>
    </nav>`,
  },
  {
    id: "hive-pricing-table",
    name: "3-Tier Pricing Table",
    category: "hive_ui",
    description: "Starter, Pro, and Enterprise pricing cards with feature list.",
    icon: <CreditCard className="h-4 w-4 text-emerald-500" />,
    content: `<section class="py-20 bg-slate-50 dark:bg-slate-900/50" id="pricing">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div class="text-center space-y-3">
          <h2 class="text-3xl sm:text-4xl font-bold tracking-tight">Simple, Transparent Pricing</h2>
          <p class="text-slate-500 max-w-xl mx-auto text-sm sm:text-base">Choose the perfect plan for your business scale. Upgrade or cancel anytime.</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-8 space-y-6 shadow-sm">
            <h3 class="font-bold text-xl">Starter</h3>
            <p class="text-sm text-slate-500">Essential tools for small teams.</p>
            <div class="text-3xl font-extrabold">$29<span class="text-sm font-normal text-slate-400">/mo</span></div>
            <ul class="space-y-3 text-sm text-slate-600 dark:text-slate-400">
              <li>✓ Up to 5 team members</li>
              <li>✓ 10 GB cloud storage</li>
              <li>✓ Basic analytics dashboard</li>
            </ul>
            <a href="#choose" class="block text-center py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 font-semibold hover:bg-slate-50 dark:hover:bg-slate-900">Choose Starter</a>
          </div>
          <div class="rounded-2xl border-2 border-teal-500 bg-white dark:bg-slate-950 p-8 space-y-6 shadow-xl relative">
            <div class="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-teal-500 text-slate-950 font-semibold text-xs rounded-full">Most Popular</div>
            <h3 class="font-bold text-xl">Professional</h3>
            <p class="text-sm text-slate-500">Full platform automation for growth.</p>
            <div class="text-3xl font-extrabold">$79<span class="text-sm font-normal text-slate-400">/mo</span></div>
            <ul class="space-y-3 text-sm text-slate-600 dark:text-slate-400">
              <li>✓ Up to 25 team members</li>
              <li>✓ Unlimited cloud storage</li>
              <li>✓ Advanced automation workflows</li>
              <li>✓ 24/7 priority support</li>
            </ul>
            <a href="#choose" class="block text-center py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold shadow-md shadow-teal-500/20">Choose Pro</a>
          </div>
          <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-8 space-y-6 shadow-sm">
            <h3 class="font-bold text-xl">Enterprise</h3>
            <p class="text-sm text-slate-500">Dedicated compliance and SLA.</p>
            <div class="text-3xl font-extrabold">$199<span class="text-sm font-normal text-slate-400">/mo</span></div>
            <ul class="space-y-3 text-sm text-slate-600 dark:text-slate-400">
              <li>✓ Unlimited users & branches</li>
              <li>✓ Dedicated account manager</li>
              <li>✓ Custom ERP integrations</li>
              <li>✓ 99.99% uptime SLA</li>
            </ul>
            <a href="#choose" class="block text-center py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 font-semibold hover:bg-slate-50 dark:hover:bg-slate-900">Contact Sales</a>
          </div>
        </div>
      </div>
    </section>`,
  },
  {
    id: "hive-testimonials",
    name: "Customer Testimonials",
    category: "hive_ui",
    description: "Customer quote cards with avatar and 5-star rating.",
    icon: <MessageSquareQuote className="h-4 w-4 text-purple-500" />,
    content: `<section class="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
      <div class="text-center space-y-3">
        <h2 class="text-3xl font-bold tracking-tight">Trusted by Industry Leaders</h2>
        <p class="text-slate-500 max-w-lg mx-auto text-sm">See how modern businesses transform operations with our software.</p>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div class="p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 space-y-4 shadow-sm">
          <div class="flex text-amber-400 text-sm">★★★★★</div>
          <p class="text-slate-700 dark:text-slate-300 italic">"The transition cut our production bottlenecks by 40% in under two months. The landing pages converted 3x better immediately."</p>
          <div class="pt-2 flex items-center gap-3 border-t border-slate-100 dark:border-slate-800">
            <div class="h-10 w-10 rounded-full bg-teal-500/20 text-teal-700 font-bold flex items-center justify-center">SC</div>
            <div>
              <div class="font-semibold text-sm">Sarah Jenkins</div>
              <div class="text-xs text-slate-500">COO at Apex Bottling Corp</div>
            </div>
          </div>
        </div>
        <div class="p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 space-y-4 shadow-sm">
          <div class="flex text-amber-400 text-sm">★★★★★</div>
          <p class="text-slate-700 dark:text-slate-300 italic">"Clean code, seamless visual builder, and tenant isolation that gives our franchise owners complete peace of mind."</p>
          <div class="pt-2 flex items-center gap-3 border-t border-slate-100 dark:border-slate-800">
            <div class="h-10 w-10 rounded-full bg-purple-500/20 text-purple-700 font-bold flex items-center justify-center">MR</div>
            <div>
              <div class="font-semibold text-sm">Marcus Reed</div>
              <div class="text-xs text-slate-500">Head of Technology, Grand Horizon Hotels</div>
            </div>
          </div>
        </div>
      </div>
    </section>`,
  },
  {
    id: "hive-faq",
    name: "FAQ Accordion",
    category: "hive_ui",
    description: "Expandable questions and answers section.",
    icon: <HelpCircle className="h-4 w-4 text-blue-500" />,
    content: `<section class="py-20 bg-slate-50 dark:bg-slate-900/40">
      <div class="max-w-4xl mx-auto px-4 sm:px-6 space-y-8">
        <h2 class="text-3xl font-bold text-center">Frequently Asked Questions</h2>
        <div class="space-y-4">
          <div class="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 space-y-2">
            <h4 class="font-semibold text-base">How does multi-tenant template assignment work?</h4>
            <p class="text-sm text-slate-600 dark:text-slate-400">Master templates are managed centrally and can be assigned to specific business types or individual tenant instances with zero cross-tenant data leakage.</p>
          </div>
          <div class="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 space-y-2">
            <h4 class="font-semibold text-base">Can I edit templates in both visual and code modes?</h4>
            <p class="text-sm text-slate-600 dark:text-slate-400">Yes! Changes made visually persist to the project tree, and Monaco code edits can be synchronized with an automatic recovery snapshot.</p>
          </div>
        </div>
      </div>
    </section>`,
  },
  {
    id: "hive-footer",
    name: "Mega Footer",
    category: "hive_ui",
    description: "4-column footer with newsletter subscribe and copyright.",
    icon: <Footprints className="h-4 w-4" />,
    content: `<footer class="bg-slate-950 text-slate-400 py-16 border-t border-slate-900">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div class="space-y-3">
          <div class="text-white font-bold text-lg">HIVE ERP</div>
          <p class="text-sm text-slate-400">Enterprise operational intelligence for scaling modern organizations.</p>
        </div>
        <div class="space-y-2 text-sm">
          <div class="text-white font-semibold mb-3">Solutions</div>
          <div><a href="#" class="hover:text-white">Manufacturing</a></div>
          <div><a href="#" class="hover:text-white">Hospitality</a></div>
          <div><a href="#" class="hover:text-white">Water Bottling</a></div>
        </div>
        <div class="space-y-2 text-sm">
          <div class="text-white font-semibold mb-3">Company</div>
          <div><a href="#" class="hover:text-white">About Us</a></div>
          <div><a href="#" class="hover:text-white">Careers</a></div>
          <div><a href="#" class="hover:text-white">Privacy Policy</a></div>
        </div>
        <div class="space-y-3">
          <div class="text-white font-semibold">Stay Updated</div>
          <div class="flex gap-2">
            <input type="email" placeholder="Enter email" class="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-teal-500 w-full" />
            <button class="px-4 py-2 rounded-lg bg-teal-500 text-slate-950 font-semibold text-xs">Join</button>
          </div>
        </div>
      </div>
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 mt-12 border-t border-slate-900 text-xs text-slate-600 flex justify-between">
        <span>© 2026 HIVE SaaS Platform. All rights reserved.</span>
        <span>Built with Next.js & Laravel</span>
      </div>
    </footer>`,
  },

  // Industry: Restaurant
  {
    id: "ind-restaurant-menu",
    name: "Restaurant Menu Grid",
    category: "restaurant",
    description: "Food menu items with price tags and chef recommendation badges.",
    icon: <Utensils className="h-4 w-4 text-orange-500" />,
    content: `<div class="py-16 max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
      <div class="text-center space-y-2">
        <span class="text-xs uppercase tracking-widest text-amber-500 font-bold">Signature Offerings</span>
        <h2 class="text-3xl font-serif font-bold">Chef's Tasting Menu</h2>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex justify-between items-start">
          <div class="space-y-1">
            <h4 class="font-bold text-lg">Truffle Infused Risotto</h4>
            <p class="text-xs text-slate-500">Arborio rice, wild mushrooms, aged parmesan, fresh black truffle shavings.</p>
          </div>
          <span class="font-serif font-bold text-lg text-amber-600">$34</span>
        </div>
        <div class="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex justify-between items-start">
          <div class="space-y-1">
            <h4 class="font-bold text-lg">Pan-Seared Sea Bass</h4>
            <p class="text-xs text-slate-500">Saffron beurre blanc, asparagus spears, crushed herb baby potatoes.</p>
          </div>
          <span class="font-serif font-bold text-lg text-amber-600">$42</span>
        </div>
      </div>
    </div>`,
  },

  // Industry: Manufacturing
  {
    id: "ind-manufacturing-specs",
    name: "Factory Spec & ISO Certs",
    category: "manufacturing",
    description: "Production throughput metrics, ISO 9001 badges, and capacity.",
    icon: <Factory className="h-4 w-4 text-blue-500" />,
    content: `<div class="py-16 bg-slate-900 text-white">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div class="text-center space-y-3">
          <h2 class="text-3xl font-bold tracking-tight">High-Capacity Automated Production</h2>
          <p class="text-slate-400 max-w-xl mx-auto text-sm">Engineered for 99.9% uptime and strict regulatory compliance.</p>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div class="p-6 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-1">
            <div class="text-3xl font-black text-teal-400">12,000+</div>
            <div class="text-xs text-slate-400 uppercase tracking-wider">Units / Hour</div>
          </div>
          <div class="p-6 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-1">
            <div class="text-3xl font-black text-teal-400">ISO 9001</div>
            <div class="text-xs text-slate-400 uppercase tracking-wider">Certified Quality</div>
          </div>
          <div class="p-6 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-1">
            <div class="text-3xl font-black text-teal-400">99.8%</div>
            <div class="text-xs text-slate-400 uppercase tracking-wider">Sterility Assurance</div>
          </div>
          <div class="p-6 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-1">
            <div class="text-3xl font-black text-teal-400">24/7</div>
            <div class="text-xs text-slate-400 uppercase tracking-wider">IoT Telemetry</div>
          </div>
        </div>
      </div>
    </div>`,
  },

  // Industry: Hotel
  {
    id: "ind-hotel-suite",
    name: "Hotel Suite Showcase",
    category: "hotel",
    description: "Luxury suite showcase card with amenities and booking button.",
    icon: <Building2 className="h-4 w-4 text-emerald-500" />,
    content: `<div class="py-16 max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center rounded-3xl border border-slate-200 dark:border-slate-800 p-8 bg-white dark:bg-slate-950 shadow-md">
        <div class="aspect-video rounded-2xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-400 font-medium">
          Suite Photo Showcase
        </div>
        <div class="space-y-4">
          <div class="text-xs font-bold uppercase tracking-widest text-teal-600">Executive Collection</div>
          <h3 class="text-2xl sm:text-3xl font-serif font-bold">Presidential Panoramic Suite</h3>
          <p class="text-sm text-slate-600 dark:text-slate-400">Floor-to-ceiling city views, private balcony, marble spa bathroom, and 24-hour butler service.</p>
          <div class="flex items-center gap-4 text-xs text-slate-500">
            <span>🛏 King Bed</span>
            <span>🛁 Jacuzzi Spa</span>
            <span>📶 High-Speed WiFi</span>
          </div>
          <div class="pt-4 flex items-center justify-between">
            <div class="text-2xl font-bold font-serif">$380<span class="text-xs font-sans font-normal text-slate-400"> / night</span></div>
            <a href="#reserve" class="px-6 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-500">Reserve Suite</a>
          </div>
        </div>
      </div>
    </div>`,
  },
];

interface BlockLibraryProps {
  onInsertBlock: (content: string) => void;
}

const BLOCK_FILTERS: Array<{ id: BlockCategory; label: string }> = [
  { id: "all", label: "All" },
  { id: "hive_ui", label: "Hive UI" },
  { id: "layout", label: "Layout" },
  { id: "restaurant", label: "Restaurant" },
  { id: "manufacturing", label: "Manufacturing" },
  { id: "hotel", label: "Hotel" },
];

export const BlockLibrary: React.FC<BlockLibraryProps> = ({ onInsertBlock }) => {
  const [activeCategory, setActiveCategory] = useState<BlockCategory>("all");
  const [search, setSearch] = useState("");

  const filteredBlocks = HIVE_BLOCKS.filter((b) => {
    const matchCat = activeCategory === "all" || b.category === activeCategory;
    const matchSearch = b.name.toLowerCase().includes(search.toLowerCase()) || b.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="flex flex-col h-full bg-background border-r border-border/60 select-none">
      {/* Category Pills & Search */}
      <div className="p-3 border-b border-border/50 space-y-2.5 shrink-0">
        <Label htmlFor="builder-block-search" className="text-xs font-semibold text-slate-700 dark:text-slate-200">
          Find a component
        </Label>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            id="builder-block-search"
            type="search"
            placeholder="Search blocks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 bg-muted/40 pl-8 text-xs"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px]" role="group" aria-label="Component categories">
          {BLOCK_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              aria-pressed={activeCategory === filter.id}
              onClick={() => setActiveCategory(filter.id)}
              className={`min-h-11 shrink-0 rounded-lg px-3 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                activeCategory === filter.id
                  ? "bg-blue-700 text-white"
                  : "bg-muted/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Block List Grid */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {filteredBlocks.map((block) => (
          <button
            key={block.id}
            type="button"
            onClick={() => onInsertBlock(block.content)}
            className="group flex w-full items-start justify-between gap-3 rounded-xl border border-slate-500 bg-card p-3.5 text-left shadow-sm transition-[border-color,background-color,box-shadow] hover:border-blue-600 hover:bg-blue-50/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-slate-500 dark:hover:border-blue-400 dark:hover:bg-blue-950/30"
          >
            <span className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 shrink-0 rounded-lg bg-slate-100 p-2.5 text-slate-700 transition-colors group-hover:bg-blue-100 group-hover:text-blue-800 dark:bg-slate-800 dark:text-slate-200 dark:group-hover:bg-blue-950 dark:group-hover:text-blue-200">
                {block.icon}
              </span>
              <span className="min-w-0 space-y-1">
                <span className="block truncate text-xs font-bold tracking-tight text-foreground transition-colors group-hover:text-blue-800 dark:group-hover:text-blue-200">
                  {block.name}
                </span>
                <span className="block line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                  {block.description}
                </span>
              </span>
            </span>

            <Plus className="mt-2 h-4 w-4 shrink-0 text-blue-700 opacity-60 transition-opacity group-hover:opacity-100 dark:text-blue-300" aria-hidden="true" />
          </button>
        ))}
        {filteredBlocks.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300" role="status">
            No components match this search.
          </p>
        )}
      </div>
    </div>
  );
};
