"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Home, ArrowLeftRight, Copy, Check } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Unit Definitions ────────────────────────────────────────────────────────
type UnitDef = { label: string; toBase: number; symbol: string };
type CategoryDef = { name: string; icon: string; color: string; gradient: string; units: Record<string, UnitDef> };

const CATEGORIES: Record<string, CategoryDef> = {
  length: {
    name: "Length", icon: "📏", color: "text-sky-500", gradient: "from-sky-500/10 to-blue-500/5",
    units: {
      m:    { label: "Meter",      toBase: 1,          symbol: "m" },
      km:   { label: "Kilometer",  toBase: 1000,        symbol: "km" },
      cm:   { label: "Centimeter", toBase: 0.01,        symbol: "cm" },
      mm:   { label: "Millimeter", toBase: 0.001,       symbol: "mm" },
      mi:   { label: "Mile",       toBase: 1609.344,    symbol: "mi" },
      yd:   { label: "Yard",       toBase: 0.9144,      symbol: "yd" },
      ft:   { label: "Foot",       toBase: 0.3048,      symbol: "ft" },
      in:   { label: "Inch",       toBase: 0.0254,      symbol: "in" },
      nmi:  { label: "Nautical Mile", toBase: 1852,     symbol: "nmi" },
      ly:   { label: "Light Year", toBase: 9.461e15,    symbol: "ly" },
    },
  },
  weight: {
    name: "Weight / Mass", icon: "⚖️", color: "text-amber-500", gradient: "from-amber-500/10 to-yellow-500/5",
    units: {
      kg:  { label: "Kilogram",  toBase: 1,        symbol: "kg" },
      g:   { label: "Gram",      toBase: 0.001,     symbol: "g" },
      mg:  { label: "Milligram", toBase: 1e-6,      symbol: "mg" },
      t:   { label: "Metric Ton",toBase: 1000,      symbol: "t" },
      lb:  { label: "Pound",     toBase: 0.453592,  symbol: "lb" },
      oz:  { label: "Ounce",     toBase: 0.028349,  symbol: "oz" },
      st:  { label: "Stone",     toBase: 6.35029,   symbol: "st" },
    },
  },
  temperature: {
    name: "Temperature", icon: "🌡️", color: "text-red-500", gradient: "from-red-500/10 to-orange-500/5",
    units: {
      c: { label: "Celsius",    toBase: 1, symbol: "°C" },
      f: { label: "Fahrenheit", toBase: 1, symbol: "°F" },
      k: { label: "Kelvin",     toBase: 1, symbol: "K"  },
    },
  },
  volume: {
    name: "Volume", icon: "🧪", color: "text-teal-500", gradient: "from-teal-500/10 to-emerald-500/5",
    units: {
      l:    { label: "Liter",        toBase: 1,         symbol: "L" },
      ml:   { label: "Milliliter",   toBase: 0.001,     symbol: "mL" },
      m3:   { label: "Cubic Meter",  toBase: 1000,      symbol: "m³" },
      gal:  { label: "US Gallon",    toBase: 3.78541,   symbol: "gal" },
      qt:   { label: "US Quart",     toBase: 0.946353,  symbol: "qt" },
      pt:   { label: "US Pint",      toBase: 0.473176,  symbol: "pt" },
      fl_oz:{ label: "US Fl. Oz",    toBase: 0.0295735, symbol: "fl oz" },
      cup:  { label: "Cup",          toBase: 0.24,      symbol: "cup" },
      tsp:  { label: "Teaspoon",     toBase: 0.00492892,symbol: "tsp" },
      tbsp: { label: "Tablespoon",   toBase: 0.0147868, symbol: "tbsp" },
    },
  },
  area: {
    name: "Area", icon: "🗺️", color: "text-violet-500", gradient: "from-violet-500/10 to-purple-500/5",
    units: {
      m2:  { label: "Sq. Meter",      toBase: 1,          symbol: "m²" },
      km2: { label: "Sq. Kilometer",  toBase: 1e6,         symbol: "km²" },
      cm2: { label: "Sq. Centimeter", toBase: 0.0001,      symbol: "cm²" },
      ha:  { label: "Hectare",        toBase: 10000,       symbol: "ha" },
      ac:  { label: "Acre",           toBase: 4046.86,     symbol: "ac" },
      mi2: { label: "Sq. Mile",       toBase: 2589988.11,  symbol: "mi²" },
      ft2: { label: "Sq. Foot",       toBase: 0.0929,      symbol: "ft²" },
    },
  },
  speed: {
    name: "Speed", icon: "⚡", color: "text-emerald-500", gradient: "from-emerald-500/10 to-green-500/5",
    units: {
      mps:  { label: "Meters/sec",  toBase: 1,         symbol: "m/s" },
      kph:  { label: "km/h",        toBase: 0.277778,  symbol: "km/h" },
      mph:  { label: "Miles/hour",  toBase: 0.44704,   symbol: "mph" },
      knot: { label: "Knot",        toBase: 0.514444,  symbol: "kn" },
      mach: { label: "Mach",        toBase: 340.29,    symbol: "Mach" },
    },
  },
  data: {
    name: "Data Storage", icon: "💾", color: "text-indigo-500", gradient: "from-indigo-500/10 to-blue-600/5",
    units: {
      b:   { label: "Bit",      toBase: 1,              symbol: "b" },
      B:   { label: "Byte",     toBase: 8,              symbol: "B" },
      KB:  { label: "Kilobyte", toBase: 8192,            symbol: "KB" },
      MB:  { label: "Megabyte", toBase: 8_388_608,       symbol: "MB" },
      GB:  { label: "Gigabyte", toBase: 8_589_934_592,   symbol: "GB" },
      TB:  { label: "Terabyte", toBase: 8_796_093_022_208, symbol: "TB" },
      Kbps:{ label: "Kilobit",  toBase: 1000,            symbol: "Kb" },
    },
  },
  pressure: {
    name: "Pressure", icon: "🔵", color: "text-pink-500", gradient: "from-pink-500/10 to-rose-500/5",
    units: {
      pa:   { label: "Pascal",    toBase: 1,         symbol: "Pa" },
      kpa:  { label: "Kilopascal",toBase: 1000,      symbol: "kPa" },
      bar:  { label: "Bar",       toBase: 100000,    symbol: "bar" },
      psi:  { label: "PSI",       toBase: 6894.76,   symbol: "psi" },
      atm:  { label: "Atmosphere",toBase: 101325,    symbol: "atm" },
      mmhg: { label: "mmHg",      toBase: 133.322,   symbol: "mmHg" },
    },
  },
};

// ─── Temperature Conversion ───────────────────────────────────────────────────
function convertTemperature(value: number, from: string, to: string): number {
  let celsius: number;
  switch (from) {
    case "c": celsius = value; break;
    case "f": celsius = (value - 32) * 5 / 9; break;
    case "k": celsius = value - 273.15; break;
    default: celsius = value;
  }
  switch (to) {
    case "c": return celsius;
    case "f": return celsius * 9 / 5 + 32;
    case "k": return celsius + 273.15;
    default: return celsius;
  }
}

function convertValue(value: number, from: string, to: string, category: string): number {
  if (category === "temperature") return convertTemperature(value, from, to);
  const cat = CATEGORIES[category];
  const base = value * cat.units[from].toBase;
  return base / cat.units[to].toBase;
}

function formatResult(n: number): string {
  if (!isFinite(n)) return "∞";
  if (Math.abs(n) === 0) return "0";
  if (Math.abs(n) >= 1e15 || (Math.abs(n) < 1e-6 && n !== 0)) return n.toExponential(6);
  const str = parseFloat(n.toPrecision(10)).toString();
  return str;
}

export default function UnitConverterPage() {
  const [category, setCategory] = useState("length");
  const [fromUnit, setFromUnit] = useState("m");
  const [toUnit, setToUnit] = useState("ft");
  const [inputVal, setInputVal] = useState("1");
  const [copied, setCopied] = useState(false);

  const cat = CATEGORIES[category];
  const units = Object.entries(cat.units);

  // When category changes, reset units to first two
  React.useEffect(() => {
    const keys = Object.keys(CATEGORIES[category].units);
    setFromUnit(keys[0]);
    setToUnit(keys[1] ?? keys[0]);
    setInputVal("1");
  }, [category]);

  const result = useMemo(() => {
    const num = parseFloat(inputVal);
    if (isNaN(num)) return "";
    if (fromUnit === toUnit) return inputVal;
    return formatResult(convertValue(num, fromUnit, toUnit, category));
  }, [inputVal, fromUnit, toUnit, category]);

  // All unit conversions for the "All conversions" panel
  const allConversions = useMemo(() => {
    const num = parseFloat(inputVal);
    if (isNaN(num)) return [];
    return units.map(([key, def]) => ({
      key,
      label: def.label,
      symbol: def.symbol,
      value: key === fromUnit ? num : formatResult(convertValue(num, fromUnit, key, category)),
    }));
  }, [inputVal, fromUnit, category, units]);

  const swap = () => {
    const prevFrom = fromUnit;
    setFromUnit(toUnit);
    setToUnit(prevFrom);
    setInputVal(result || "1");
  };

  const copy = async () => {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Breadcrumb */}
      <div className="flex w-full justify-end items-center gap-3">
        <Breadcrumbs
          items={[
            { label: "Hive.OS", href: "/dashboard", icon: <Home className="h-4 w-4" /> },
            { label: "Apps & Tools" },
            { label: "Converters", href: "/dashboard/tools/converters" },
            { label: "Unit Converter" },
          ]}
        />
      </div>

      {/* Hero */}
      <div className={cn("relative overflow-hidden rounded-[2rem] border border-border/50 bg-card/40 backdrop-blur-md p-8 bg-gradient-to-br", cat.gradient)}>
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full opacity-20 blur-3xl bg-amber-400 pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card/60 text-2xl shadow-inner">
              {cat.icon}
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">Unit Converter</h1>
              <p className="text-sm text-muted-foreground">Convert {cat.name.toLowerCase()} and more — instant, offline, precise</p>
            </div>
          </div>
          <Badge className="bg-card/60 border-border/40 text-foreground text-[11px] px-3 py-1 rounded-full font-mono tracking-widest uppercase">
            ⚡ Client-Side · Instant
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* LEFT: Category + Converter UI */}
        <div className="xl:col-span-8 flex flex-col gap-5">

          {/* Category Selector */}
          <div className="rounded-[1.5rem] border border-border/50 bg-card/40 backdrop-blur-md p-4">
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {Object.entries(CATEGORIES).map(([key, c]) => (
                <button
                  key={key}
                  onClick={() => setCategory(key)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-center transition-all duration-200",
                    category === key
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/50 bg-muted/20 text-muted-foreground hover:border-border hover:bg-muted/40"
                  )}
                >
                  <span className="text-xl">{c.icon}</span>
                  <span className="text-[11px] font-black leading-tight">{c.name.split(" ")[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Main Converter UI */}
          <div className="rounded-[1.5rem] border border-border/50 bg-card/40 backdrop-blur-md p-6">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
              {/* FROM */}
              <div className="flex flex-col gap-3">
                <label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">From</label>
                <select
                  value={fromUnit}
                  onChange={(e) => setFromUnit(e.target.value)}
                  className="w-full rounded-xl border border-border/50 bg-muted/30 px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {units.map(([key, def]) => (
                    <option key={key} value={key}>{def.label} ({def.symbol})</option>
                  ))}
                </select>
                <Input
                  type="number"
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  className="font-mono text-lg h-14 rounded-xl bg-muted/30 border-border/50 focus-visible:ring-primary/30 text-center font-black"
                  placeholder="0"
                />
                <div className="text-center">
                  <span className={cn("text-2xl font-black", cat.color)}>{cat.units[fromUnit]?.symbol}</span>
                </div>
              </div>

              {/* Swap Button */}
              <div className="flex flex-col items-center gap-2 pt-8">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={swap}
                  className="h-10 w-10 rounded-full border-border/50 hover:bg-primary/10 hover:text-primary transition-all duration-300 hover:rotate-180"
                >
                  <ArrowLeftRight className="h-4 w-4" />
                </Button>
              </div>

              {/* TO */}
              <div className="flex flex-col gap-3">
                <label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">To</label>
                <select
                  value={toUnit}
                  onChange={(e) => setToUnit(e.target.value)}
                  className="w-full rounded-xl border border-border/50 bg-muted/30 px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {units.map(([key, def]) => (
                    <option key={key} value={key}>{def.label} ({def.symbol})</option>
                  ))}
                </select>
                <div
                  className={cn(
                    "flex h-14 items-center justify-center rounded-xl border-2 font-mono text-xl font-black transition-all",
                    result ? "border-primary/30 bg-primary/5 text-primary" : "border-border/50 bg-muted/30 text-muted-foreground"
                  )}
                >
                  {result || "—"}
                </div>
                <div className="text-center">
                  <span className={cn("text-2xl font-black", cat.color)}>{cat.units[toUnit]?.symbol}</span>
                </div>
              </div>
            </div>

            {/* Result Summary */}
            {result && (
              <div className="mt-5 flex items-center justify-between gap-3 rounded-xl bg-muted/30 border border-border/40 px-5 py-3 animate-in fade-in">
                <p className="text-sm font-semibold text-muted-foreground">
                  <span className="font-black text-foreground">{inputVal} {cat.units[fromUnit]?.symbol}</span>
                  {" = "}
                  <span className="font-black text-primary">{result} {cat.units[toUnit]?.symbol}</span>
                </p>
                <Button variant="outline" size="sm" className="rounded-full h-7 px-3 text-[11px]" onClick={copy}>
                  {copied ? <Check className="h-3 w-3 mr-1 text-emerald-500" /> : <Copy className="h-3 w-3 mr-1" />}
                  Copy
                </Button>
              </div>
            )}
          </div>

          {/* All Conversions Table */}
          <div className="rounded-[1.5rem] border border-border/50 bg-card/40 backdrop-blur-md overflow-hidden">
            <div className="px-5 py-4 border-b border-border/40">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">All {cat.name} Conversions</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-0 divide-border/30">
              {allConversions.map((conv) => (
                <div
                  key={conv.key}
                  className={cn(
                    "flex flex-col gap-0.5 px-4 py-3 border-b border-r border-border/30 hover:bg-muted/20 transition-colors cursor-default",
                    conv.key === fromUnit && "bg-primary/5"
                  )}
                  onClick={() => {
                    if (conv.key !== fromUnit) {
                      setToUnit(conv.key);
                    }
                  }}
                >
                  <span className="text-[11px] text-muted-foreground font-semibold">{conv.label}</span>
                  <span className={cn("text-sm font-black font-mono truncate", conv.key === fromUnit ? "text-primary" : "text-foreground")}>
                    {conv.value} <span className="text-muted-foreground font-normal text-[11px]">{conv.symbol}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Quick reference */}
        <div className="xl:col-span-4 flex flex-col gap-5">
          <div className="rounded-[1.5rem] border border-border/50 bg-card/40 backdrop-blur-md p-6 space-y-4">
            <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Common Conversions</h2>
            <div className="space-y-2">
              {units.slice(0, 6).map(([key, def]) => {
                const val = parseFloat(inputVal) || 1;
                const from = Object.keys(cat.units)[0];
                const res = key === from ? val : convertValue(val, from, key, category);
                return (
                  <div
                    key={key}
                    onClick={() => setToUnit(key)}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border/30 bg-muted/20 px-3 py-2.5 text-xs cursor-pointer hover:border-primary/30 hover:bg-primary/5 transition-all"
                  >
                    <span className="text-muted-foreground font-semibold">{def.label}</span>
                    <span className="font-black font-mono">{formatResult(res)} <span className="text-muted-foreground">{def.symbol}</span></span>
                  </div>
                );
              })}
            </div>
          </div>

          <Link
            href="/dashboard/tools/converters"
            className="flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-[1.25rem] border border-border/40 bg-card/20 py-3"
          >
            ← All Converters
          </Link>
        </div>
      </div>
    </div>
  );
}
