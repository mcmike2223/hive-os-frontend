"use client";

import * as React from "react";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calculator,
  ChevronDown,
  ChevronUp,
  Coins,
  Copy,
  Check,
  Building,
  User,
  ShieldCheck,
  HelpCircle,
  Percent,
  Sliders,
  Sparkles,
  ArrowRight,
  Receipt,
  FileSpreadsheet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { WindowChrome } from "./section";
import { useTranslation } from "@/store/use-translation";
import { Button } from "@/components/ui/button";

// ─── Ethiopian Tax Proclamation 979/2016 Brackets ──────────────────────────
export type TaxBracket = {
  min: number;
  max: number;
  rate: number;
  deduction: number;
  label: string;
};

export const TAX_BRACKETS: TaxBracket[] = [
  { min: 0, max: 600, rate: 0.0, deduction: 0, label: "0 – 600 ETB (0%)" },
  { min: 601, max: 1650, rate: 0.1, deduction: 60, label: "601 – 1,650 ETB (10%)" },
  { min: 1651, max: 3200, rate: 0.15, deduction: 142.5, label: "1,651 – 3,200 ETB (15%)" },
  { min: 3201, max: 5250, rate: 0.2, deduction: 302.5, label: "3,201 – 5,250 ETB (20%)" },
  { min: 5251, max: 7800, rate: 0.25, deduction: 565, label: "5,251 – 7,800 ETB (25%)" },
  { min: 7801, max: 10900, rate: 0.3, deduction: 955, label: "7,801 – 10,900 ETB (30%)" },
  { min: 10901, max: Infinity, rate: 0.35, deduction: 1500, label: "Over 10,900 ETB (35%)" },
];

export function calculateEthiopianTax(taxableIncome: number): {
  tax: number;
  effectiveRate: number;
  bracketTier: number;
  bracketBreakdown: {
    bracket: TaxBracket;
    amountInBracket: number;
    taxForBracket: number;
  }[];
} {
  const income = Math.max(0, taxableIncome);
  if (income <= 0) {
    return { tax: 0, effectiveRate: 0, bracketTier: 0, bracketBreakdown: [] };
  }

  // 1. Calculate total income tax via bracket deduction formula
  let tax = 0;
  let bracketTier = 1;

  if (income <= 600) {
    tax = 0;
    bracketTier = 1;
  } else if (income <= 1650) {
    tax = income * 0.1 - 60;
    bracketTier = 2;
  } else if (income <= 3200) {
    tax = income * 0.15 - 142.5;
    bracketTier = 3;
  } else if (income <= 5250) {
    tax = income * 0.2 - 302.5;
    bracketTier = 4;
  } else if (income <= 7800) {
    tax = income * 0.25 - 565;
    bracketTier = 5;
  } else if (income <= 10900) {
    tax = income * 0.3 - 955;
    bracketTier = 6;
  } else {
    tax = income * 0.35 - 1500;
    bracketTier = 7;
  }

  tax = Math.max(0, Math.round(tax * 100) / 100);

  // 2. Progressive slice-by-slice breakdown for transparency
  const bracketBreakdown: {
    bracket: TaxBracket;
    amountInBracket: number;
    taxForBracket: number;
  }[] = [];

  for (const b of TAX_BRACKETS) {
    if (income < b.min) continue;

    const lower = b.min === 0 ? 0 : b.min - 1;
    const upper = b.max === Infinity ? income : Math.min(income, b.max);
    const amountInBracket = Math.max(0, upper - lower);

    if (amountInBracket > 0) {
      const taxForBracket = Math.round(amountInBracket * b.rate * 100) / 100;
      bracketBreakdown.push({
        bracket: b,
        amountInBracket,
        taxForBracket,
      });
    }
  }

  const effectiveRate = income > 0 ? (tax / income) * 100 : 0;

  return {
    tax,
    effectiveRate: Math.round(effectiveRate * 10) / 10,
    bracketTier,
    bracketBreakdown,
  };
}

const PRESETS = [10000, 25000, 50000, 100000, 180000];

export function EthiopianPayrollCalculator() {
  const { t } = useTranslation();

  // Inputs
  const [basicSalary, setBasicSalary] = useState<number>(25000);
  const [taxableAllowance, setTaxableAllowance] = useState<number>(0);
  const [nonTaxableAllowance, setNonTaxableAllowance] = useState<number>(0);
  const [overtimeBonus, setOvertimeBonus] = useState<number>(0);
  const [otherDeductions, setOtherDeductions] = useState<number>(0);
  const [includePension, setIncludePension] = useState<boolean>(true);
  const [includeEmployerPension, setIncludeEmployerPension] = useState<boolean>(true);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [showBracketTable, setShowBracketTable] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Calculations
  const grossEarnings = basicSalary + taxableAllowance + nonTaxableAllowance + overtimeBonus;
  const taxableIncome = Math.max(0, basicSalary + taxableAllowance + overtimeBonus);

  const { tax: incomeTax, effectiveRate, bracketTier, bracketBreakdown } = useMemo(
    () => calculateEthiopianTax(taxableIncome),
    [taxableIncome],
  );

  const employeePension = includePension ? Math.round(basicSalary * 0.07 * 100) / 100 : 0;
  const employerPension = includeEmployerPension ? Math.round(basicSalary * 0.11 * 100) / 100 : 0;
  const totalPension = employeePension + employerPension;

  const totalDeductions = incomeTax + employeePension + otherDeductions;
  const netSalary = Math.max(0, grossEarnings - totalDeductions);
  const totalCostToCompany = grossEarnings + employerPension;

  // Percentage distribution for visual bar
  const netPercent = grossEarnings > 0 ? (netSalary / grossEarnings) * 100 : 0;
  const taxPercent = grossEarnings > 0 ? (incomeTax / grossEarnings) * 100 : 0;
  const pensionPercent = grossEarnings > 0 ? (employeePension / grossEarnings) * 100 : 0;
  const otherPercent = grossEarnings > 0 ? (otherDeductions / grossEarnings) * 100 : 0;

  const formatETB = (val: number) =>
    val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleCopySummary = () => {
    const text = `--- Ethiopian Payslip Summary (Hive.OS) ---
Gross Earnings: ${formatETB(grossEarnings)} ETB
Taxable Income: ${formatETB(taxableIncome)} ETB
Income Tax (ERCA): ${formatETB(incomeTax)} ETB (${effectiveRate}% effective)
Employee Pension (7%): ${formatETB(employeePension)} ETB
Other Deductions: ${formatETB(otherDeductions)} ETB
Total Deductions: ${formatETB(totalDeductions)} ETB
====================================
NET TAKE-HOME PAY: ${formatETB(netSalary)} ETB
====================================
Employer Pension (11%): ${formatETB(employerPension)} ETB
Total Cost to Company (CTC): ${formatETB(totalCostToCompany)} ETB
Calculation standard: Ethiopian Income Tax Proclamation 979/2016`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-xl mx-auto rounded-3xl border border-border/80 bg-card/70 p-1 shadow-2xl backdrop-blur-xl">
      <div className="overflow-hidden rounded-[1.35rem] border border-border/60 bg-background/85">
        {/* Top Chrome Header */}
        <div className="flex items-center justify-between border-b border-border/70 bg-card/50 px-5 py-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-space font-bold uppercase tracking-wider text-foreground">
              Ethiopian Payroll & Tax Calculator
            </span>
          </div>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-[10px] font-bold text-primary">
            Proclamation 979/2016
          </span>
        </div>

        <div className="p-5 sm:p-6 space-y-6">
          {/* Main Input: Basic Monthly Salary */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-space text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Basic Monthly Salary (ETB)
              </label>
              <span className="font-mono text-xs text-primary font-semibold">
                Tier {bracketTier} ({TAX_BRACKETS[bracketTier - 1]?.rate * 100 || 0}%)
              </span>
            </div>

            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-muted-foreground font-mono font-bold text-sm">
                ETB
              </div>
              <input
                type="number"
                min="0"
                step="500"
                value={basicSalary || ""}
                onChange={(e) => setBasicSalary(Math.max(0, Number(e.target.value) || 0))}
                className="w-full rounded-2xl border border-border/80 bg-card/60 pl-14 pr-4 py-3 font-space text-2xl font-black text-foreground shadow-inner transition-colors focus:border-primary focus:bg-background focus:outline-none"
                placeholder="25,000"
              />
            </div>

            {/* Quick Presets */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-mono text-muted-foreground mr-1">Presets:</span>
              {PRESETS.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setBasicSalary(amount)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 font-mono text-xs font-bold transition-all",
                    basicSalary === amount
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                      : "border border-border/70 bg-card/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  {amount >= 1000 ? `${amount / 1000}k` : amount}
                </button>
              ))}
            </div>
          </div>

          {/* Expandable Advanced Options (Allowances, Bonuses, Deductions, Pension toggle) */}
          <div className="rounded-2xl border border-border/60 bg-card/30 p-3.5 transition-all">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex w-full items-center justify-between font-space text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              <div className="flex items-center gap-2">
                <Sliders className="h-3.5 w-3.5 text-primary" />
                <span>Allowances, Deductions & Pension Settings</span>
                {(taxableAllowance > 0 || nonTaxableAllowance > 0 || otherDeductions > 0 || !includePension) && (
                  <span className="flex h-2 w-2 rounded-full bg-primary" />
                )}
              </div>
              {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            <AnimatePresence>
              {showAdvanced && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 space-y-4 pt-3 border-t border-border/50 text-xs"
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block font-mono text-[11px] text-muted-foreground">
                        Taxable Allowance (Position/Housing)
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground font-mono text-xs">
                          ETB
                        </span>
                        <input
                          type="number"
                          min="0"
                          value={taxableAllowance || ""}
                          onChange={(e) => setTaxableAllowance(Math.max(0, Number(e.target.value) || 0))}
                          placeholder="0"
                          className="w-full rounded-xl border border-border/70 bg-background/80 pl-11 pr-3 py-2 font-mono text-xs font-semibold focus:border-primary focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block font-mono text-[11px] text-muted-foreground">
                        Non-Taxable Allowance (Exempt Transport)
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground font-mono text-xs">
                          ETB
                        </span>
                        <input
                          type="number"
                          min="0"
                          value={nonTaxableAllowance || ""}
                          onChange={(e) => setNonTaxableAllowance(Math.max(0, Number(e.target.value) || 0))}
                          placeholder="0"
                          className="w-full rounded-xl border border-border/70 bg-background/80 pl-11 pr-3 py-2 font-mono text-xs font-semibold focus:border-primary focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block font-mono text-[11px] text-muted-foreground">
                        Overtime / Bonus / Extra
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground font-mono text-xs">
                          ETB
                        </span>
                        <input
                          type="number"
                          min="0"
                          value={overtimeBonus || ""}
                          onChange={(e) => setOvertimeBonus(Math.max(0, Number(e.target.value) || 0))}
                          placeholder="0"
                          className="w-full rounded-xl border border-border/70 bg-background/80 pl-11 pr-3 py-2 font-mono text-xs font-semibold focus:border-primary focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block font-mono text-[11px] text-muted-foreground">
                        Other Deductions (Loan, Cost-share)
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground font-mono text-xs">
                          ETB
                        </span>
                        <input
                          type="number"
                          min="0"
                          value={otherDeductions || ""}
                          onChange={(e) => setOtherDeductions(Math.max(0, Number(e.target.value) || 0))}
                          placeholder="0"
                          className="w-full rounded-xl border border-border/70 bg-background/80 pl-11 pr-3 py-2 font-mono text-xs font-semibold focus:border-primary focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-border/40">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includePension}
                        onChange={(e) => setIncludePension(e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                      />
                      <span className="font-mono text-xs">Employee Pension (7%)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeEmployerPension}
                        onChange={(e) => setIncludeEmployerPension(e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                      />
                      <span className="font-mono text-xs">Employer Pension (11%)</span>
                    </label>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Visual Percentage Distribution Bar */}
          <div>
            <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground mb-1.5">
              <span>Salary Allocation Breakdown</span>
              <span className="font-bold text-foreground">{effectiveRate}% Effective Tax</span>
            </div>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-border/40 p-0.5 gap-0.5">
              <div
                style={{ width: `${Math.max(0, netPercent)}%` }}
                title={`Net Salary: ${netPercent.toFixed(1)}%`}
                className="h-full rounded-l-full bg-emerald-500 transition-all duration-500"
              />
              <div
                style={{ width: `${Math.max(0, taxPercent)}%` }}
                title={`Income Tax: ${taxPercent.toFixed(1)}%`}
                className="h-full bg-amber-500 transition-all duration-500"
              />
              <div
                style={{ width: `${Math.max(0, pensionPercent)}%` }}
                title={`Employee Pension: ${pensionPercent.toFixed(1)}%`}
                className="h-full bg-indigo-500 transition-all duration-500"
              />
              {otherPercent > 0 && (
                <div
                  style={{ width: `${Math.max(0, otherPercent)}%` }}
                  title={`Other Deductions: ${otherPercent.toFixed(1)}%`}
                  className="h-full rounded-r-full bg-slate-400 transition-all duration-500"
                />
              )}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] font-mono text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Net Pay ({netPercent.toFixed(1)}%)
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Tax ({taxPercent.toFixed(1)}%)
              </span>
              {includePension && (
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-indigo-500" />
                  Pension ({pensionPercent.toFixed(1)}%)
                </span>
              )}
            </div>
          </div>

          {/* Hero Result: NET TAKE-HOME PAY */}
          <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-5 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300 font-bold">
                  Net Take-Home Pay
                </span>
                <div className="mt-1 flex items-baseline justify-center sm:justify-start gap-1.5">
                  <span className="font-space text-3xl sm:text-4xl font-extrabold tabular-nums tracking-tight text-foreground">
                    {formatETB(netSalary)}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">ETB</span>
                </div>
              </div>

              <div className="flex items-center justify-center sm:justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopySummary}
                  className="h-8 gap-1.5 rounded-xl border-emerald-500/30 bg-background/50 font-mono text-xs font-bold hover:border-emerald-500 hover:bg-emerald-500/10"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>Copy Payslip</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Detailed Itemized Payslip Breakdown Table */}
          <div className="space-y-2.5 rounded-2xl border border-border/70 bg-card/40 p-4 font-mono text-xs">
            <div className="flex justify-between items-center text-muted-foreground pb-2 border-b border-border/50">
              <span>Gross Earnings</span>
              <span className="font-bold text-foreground tabular-nums">{formatETB(grossEarnings)} ETB</span>
            </div>

            {taxableAllowance > 0 || nonTaxableAllowance > 0 || overtimeBonus > 0 ? (
              <div className="flex justify-between items-center text-muted-foreground">
                <span className="text-[11px] pl-2">↳ Taxable Base</span>
                <span className="tabular-nums">{formatETB(taxableIncome)} ETB</span>
              </div>
            ) : null}

            <div className="flex justify-between items-center text-red-700 dark:text-red-300">
              <span className="flex items-center gap-1.5">
                <span>Income Tax (ERCA)</span>
                <span className="text-[10px] rounded bg-red-500/10 px-1.5 py-0.5 text-red-700 dark:text-red-300">
                  {effectiveRate}%
                </span>
              </span>
              <span className="font-bold tabular-nums">-{formatETB(incomeTax)} ETB</span>
            </div>

            {includePension && (
              <div className="flex justify-between items-center text-amber-800 dark:text-amber-300">
                <span>Employee Pension (7%)</span>
                <span className="font-bold tabular-nums">-{formatETB(employeePension)} ETB</span>
              </div>
            )}

            {otherDeductions > 0 && (
              <div className="flex justify-between items-center text-slate-500">
                <span>Other Deductions</span>
                <span className="font-bold tabular-nums">-{formatETB(otherDeductions)} ETB</span>
              </div>
            )}

            <div className="h-px bg-border/60 my-1" />

            <div className="flex justify-between items-center font-bold">
              <span>Total Deductions</span>
              <span className="text-red-700 dark:text-red-300 tabular-nums">-{formatETB(totalDeductions)} ETB</span>
            </div>

            {includeEmployerPension && (
              <>
                <div className="h-px bg-border/60 my-1" />
                <div className="flex justify-between items-center text-muted-foreground text-[11px]">
                  <span>Employer Pension (11% Company Cost)</span>
                  <span className="tabular-nums">+{formatETB(employerPension)} ETB</span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground text-[11px]">
                  <span>Total Cost to Company (CTC)</span>
                  <span className="font-bold text-foreground tabular-nums">{formatETB(totalCostToCompany)} ETB</span>
                </div>
              </>
            )}
          </div>

          {/* Toggle Progressive Tax Brackets Details */}
          <div>
            <button
              type="button"
              onClick={() => setShowBracketTable(!showBracketTable)}
              className="flex w-full items-center justify-between rounded-xl border border-border/60 bg-card/30 px-3.5 py-2.5 font-mono text-xs text-muted-foreground hover:bg-card/60 hover:text-foreground"
            >
              <span className="flex items-center gap-1.5">
                <FileSpreadsheet className="h-3.5 w-3.5 text-primary" />
                <span>View Progressive Tax Bracket Breakdown</span>
              </span>
              {showBracketTable ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>

            <AnimatePresence>
              {showBracketTable && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-2 overflow-hidden rounded-xl border border-border/70 bg-card/60"
                >
                  <table className="w-full text-left font-mono text-[11px]">
                    <thead className="border-b border-border/70 bg-muted/40 text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-bold">Salary Tier</th>
                        <th className="px-3 py-2 font-bold">Rate</th>
                        <th className="px-3 py-2 font-bold">Taxable Chunk</th>
                        <th className="px-3 py-2 text-right font-bold">Tax</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {bracketBreakdown.map(({ bracket, amountInBracket, taxForBracket }, idx) => (
                        <tr key={idx} className="hover:bg-muted/20">
                          <td className="px-3 py-1.5 text-foreground">{bracket.label.split(" (")[0]}</td>
                          <td className="px-3 py-1.5 font-bold text-primary">{(bracket.rate * 100).toFixed(0)}%</td>
                          <td className="px-3 py-1.5 text-muted-foreground tabular-nums">{formatETB(amountInBracket)} ETB</td>
                          <td className="px-3 py-1.5 text-right font-bold text-foreground tabular-nums">{formatETB(taxForBracket)} ETB</td>
                        </tr>
                      ))}
                      <tr className="bg-primary/5 font-bold text-foreground">
                        <td colSpan={3} className="px-3 py-2">
                          Total ERCA Income Tax
                        </td>
                        <td className="px-3 py-2 text-right text-primary tabular-nums">
                          {formatETB(incomeTax)} ETB
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
