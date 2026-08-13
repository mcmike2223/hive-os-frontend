"use client";

import * as React from "react";
import { Check, Minus, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { useTranslation } from "@/store/use-translation";
import { Reveal } from "./reveal";
import { SectionHeading, SectionShell } from "./section";

type Support = "yes" | "no" | "partial";

/**
 * Positioning table: spreadsheets vs. an imported foreign ERP vs. Hive.
 *
 * The competitor columns are deliberately unnamed and describe structural
 * traits (priced in USD, no ERCA bands shipped, no Telebirr rail) rather than
 * any specific vendor's feature list — those are properties of the category we
 * can stand behind, not claims about a product we have not tested.
 */
export function LandingCompare() {
  const { t } = useTranslation();

  const columns = [
    t("landing.compare.col_sheets", "Spreadsheets & separate tools"),
    t("landing.compare.col_foreign", "Imported foreign ERP"),
    t("landing.compare.col_hive", "Hive"),
  ];

  const rows: { label: string; values: [Support, Support, Support] }[] = [
    {
      label: t("landing.compare.row_tax", "ERCA tax bands & VAT built in"),
      values: ["no", "partial", "yes"],
    },
    {
      label: t("landing.compare.row_pension", "7% / 11% pension split automated"),
      values: ["no", "no", "yes"],
    },
    {
      label: t("landing.compare.row_payments", "Telebirr, CBE & Chapa reconciliation"),
      values: ["no", "no", "yes"],
    },
    {
      label: t("landing.compare.row_offline", "Keeps working through an outage"),
      values: ["partial", "no", "yes"],
    },
    {
      label: t("landing.compare.row_currency", "Billed in ETB"),
      values: ["yes", "no", "yes"],
    },
    {
      label: t("landing.compare.row_amharic", "Amharic interface"),
      values: ["partial", "no", "yes"],
    },
    {
      label: t("landing.compare.row_branches", "Multi-branch stock in one ledger"),
      values: ["no", "yes", "yes"],
    },
    {
      label: t("landing.compare.row_onprem", "On-premise option"),
      values: ["partial", "partial", "yes"],
    },
    {
      label: t("landing.compare.row_support", "Support in your timezone"),
      values: ["no", "no", "yes"],
    },
  ];

  return (
    <SectionShell id="compare" tone="base" glow="primary">
      <SectionHeading
        eyebrow={t("landing.compare.eyebrow", "Why teams switch")}
        title={t("landing.compare.title", "Software that already knows")}
        accent={t("landing.compare.title_accent", "where it is")}
        description={t(
          "landing.compare.desc",
          "Most ERPs treat Ethiopian tax, pension and payment rails as a customisation project. Hive ships with them.",
        )}
      />

      <Reveal variant="scale">
        {/* The table scrolls inside its own container so the page body never
            does. The row-label column is sticky: at 390px the Hive column sits
            off-screen, and without a pinned label you cannot tell which row you
            scrolled to — which is the entire point of the comparison. */}
        <div className="overflow-x-auto rounded-3xl border border-border/70 bg-card/30 backdrop-blur-sm">
          <table className="w-full min-w-[38rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-border/70">
                <th
                  scope="col"
                  className="sticky left-0 z-20 w-[38%] min-w-[13rem] bg-card px-5 py-5 sm:bg-transparent"
                />
                {columns.map((col, index) => {
                  const isHive = index === columns.length - 1;
                  return (
                    <th
                      key={col}
                      scope="col"
                      className={cn(
                        "px-4 py-5 text-center align-bottom font-space text-sm font-bold",
                        isHive
                          ? "rounded-t-2xl bg-primary/10 text-primary"
                          : "text-muted-foreground",
                      )}
                    >
                      {col}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.label}
                  className="group border-b border-border/50 transition-colors last:border-0 hover:bg-foreground/[0.02]"
                >
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-card px-5 py-4 text-sm font-medium text-foreground sm:bg-transparent"
                  >
                    {row.label}
                  </th>
                  {row.values.map((value, index) => {
                    const isHive = index === row.values.length - 1;
                    return (
                      <td
                        key={index}
                        className={cn("px-4 py-4 text-center", isHive && "bg-primary/[0.06]")}
                      >
                        <SupportMark value={value} emphasis={isHive} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground sm:hidden">
          {t("landing.compare.swipe", "Swipe the table →")}
        </p>
      </Reveal>

      <p className="mt-6 text-center font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {t(
          "landing.compare.footnote",
          "Comparison describes the category, not any single named product",
        )}
      </p>
    </SectionShell>
  );
}

function SupportMark({ value, emphasis }: { value: Support; emphasis?: boolean }) {
  const label =
    value === "yes" ? "Supported" : value === "partial" ? "Partial" : "Not supported";

  if (value === "yes") {
    return (
      <span
        aria-label={label}
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-full",
          emphasis ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary",
        )}
      >
        <Check className="h-4 w-4" strokeWidth={3} />
      </span>
    );
  }

  if (value === "partial") {
    return (
      <span
        aria-label={label}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/15 text-amber-500"
      >
        <Minus className="h-4 w-4" strokeWidth={3} />
      </span>
    );
  }

  return (
    <span
      aria-label={label}
      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground/60"
    >
      <X className="h-4 w-4" strokeWidth={3} />
    </span>
  );
}
