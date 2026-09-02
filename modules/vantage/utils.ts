import * as React from "react";
import type { MetricFormat } from "@/modules/vantage/types";

export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Formats a value the way its metric definition says it should be read. */
export function formatMetricValue(
  value: number | null | undefined,
  format: MetricFormat | string = "number",
  unit: string | null = null,
): string {
  if (value === null || value === undefined) return "—";

  switch (format) {
    case "currency":
      return `ETB ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    case "percent":
      return `${value.toFixed(1)}%`;
    case "duration":
      return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} h`;
    default:
      return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ""}`;
  }
}
