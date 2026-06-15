"use client";

import React from "react";
import { motion } from "framer-motion";
import { Boxes, Globe2, Package, ShoppingBag, Tag, Truck } from "lucide-react";

const ICONS = [ShoppingBag, Package, Truck, Globe2, Tag, Boxes, Tag, Package, Globe2];
const COLORS = [
  "from-rose-500/30 to-rose-500/5",
  "from-indigo-500/30 to-indigo-500/5",
  "from-amber-500/30 to-amber-500/5",
  "from-emerald-500/30 to-emerald-500/5",
  "from-sky-500/30 to-sky-500/5",
  "from-fuchsia-500/30 to-fuchsia-500/5",
  "from-amber-500/30 to-amber-500/5",
  "from-rose-500/30 to-rose-500/5",
  "from-indigo-500/30 to-indigo-500/5",
];

function prettyName(name?: string) {
  if (!name) return "Marketplace";
  return name
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function MarketplacePreloader({ brandName }: { brandName?: string }) {
  const name = prettyName(brandName);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-[#0a0712]">
      {/* ambient glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(244,63,94,0.18),transparent_60%)]" />
        <div className="absolute left-[30%] top-[35%] h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.16),transparent_60%)]" />
        <div className="absolute right-[28%] bottom-[30%] h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.14),transparent_60%)]" />
      </div>

      {/* product-tile grid filling in, like a catalog loading */}
      <div className="relative grid grid-cols-3 gap-3">
        {ICONS.map((Icon, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.4, y: 14 }}
            animate={{ opacity: [0, 1, 1, 0.35], scale: [0.4, 1, 1, 0.9], y: [14, 0, 0, 0] }}
            transition={{
              duration: 1.8,
              delay: (i % 3) * 0.12 + Math.floor(i / 3) * 0.18,
              repeat: Infinity,
              repeatDelay: 0.4,
              ease: "easeInOut",
            }}
            className={`flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br ${COLORS[i]} backdrop-blur-sm shadow-[0_8px_30px_rgba(0,0,0,0.3)]`}
          >
            <Icon className="h-6 w-6 text-white/85" />
          </motion.div>
        ))}

        {/* sweeping shine across the grid */}
        <motion.div
          aria-hidden
          initial={{ x: "-120%" }}
          animate={{ x: "120%" }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent"
        />
      </div>

      {/* brand + status */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.6 }}
        className="relative mt-12 flex flex-col items-center"
      >
        <h1 className="bg-gradient-to-r from-rose-400 via-fuchsia-400 to-amber-300 bg-clip-text text-3xl font-black tracking-tight text-transparent">
          {name}
        </h1>
        <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.3em] text-white/45">
          Loading marketplace
        </p>

        {/* indeterminate shimmer bar */}
        <div className="relative mt-5 h-1.5 w-56 overflow-hidden rounded-full bg-white/10">
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-y-0 w-1/2 rounded-full bg-gradient-to-r from-rose-500 via-fuchsia-500 to-amber-400"
          />
        </div>

        {/* pulsing trust chips */}
        <div className="mt-6 flex items-center gap-4 text-[10px] font-semibold uppercase tracking-widest text-white/40">
          {["Verified suppliers", "Secure escrow", "Global trade"].map((t, i) => (
            <motion.span
              key={t}
              animate={{ opacity: [0.3, 0.9, 0.3] }}
              transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.4 }}
            >
              {t}
            </motion.span>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
