"use client";

import * as React from "react";
import Link from "next/link";

/**
 * Inline-SVG chart primitives shared by every module dashboard.
 *
 * Conventions held across every chart here:
 *  - marks are thin (bars capped at 24px, lines 2px), gridlines are solid
 *    hairlines one step off the surface, and the data is the only loud thing;
 *  - adjacent fills are separated by a 2px surface gap, and markers carry a 2px
 *    surface ring, rather than by drawing borders around marks;
 *  - series colours come from the app's validated categorical tokens in fixed
 *    order, so a series keeps its hue when a filter changes the row count;
 *  - every chart has a table view, so no value is reachable only by hovering,
 *    and hover state is mirrored on keyboard focus.
 */

const SERIES = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"] as const;

/** Severity ramp for ordered risk bands. Reserved for state, never for identity. */
const SEVERITY: Record<string, string> = {
  critical: "var(--sc-critical)",
  warning: "var(--sc-warning)",
  caution: "var(--sc-caution)",
  good: "var(--sc-good)",
};

/** Measure the container so strokes and text render at true pixel size. */
function useChartWidth<T extends HTMLElement>() {
  const ref = React.useRef<T | null>(null);
  const [width, setWidth] = React.useState(0);

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.round(entry.contentRect.width));
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

/**
 * Every value entering a chart is coerced here.
 *
 * API shapes drift — a field added on one side and not yet deployed on the
 * other arrives as undefined, and `undefined.toLocaleString()` takes the whole
 * dashboard down with an error boundary. A chart should degrade to zero, not
 * white-screen the page it sits on.
 */
const num = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const compact = (value: number) =>
  Math.abs(value) >= 1000
    ? `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`
    : `${Math.round(value * 100) / 100}`;

/**
 * Round the axis top up to a clean number so ticks land on 0 / 250 / 500
 * rather than 0 / 252 / 504. Axis ticks carry the values that aren't directly
 * labelled, so they have to be readable at a glance.
 */
function niceCeiling(value: number): number {
  if (value <= 0) return 1;

  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalised = value / magnitude;
  const step = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;

  return step * magnitude;
}

/** Rounded data-end at the top, square where it meets the baseline. */
function columnPath(x: number, y: number, width: number, height: number, radius = 4) {
  const r = Math.min(radius, width / 2, Math.max(height, 0));
  if (height <= 0) return "";

  return [
    `M${x},${y + height}`,
    `V${y + r}`,
    `Q${x},${y} ${x + r},${y}`,
    `H${x + width - r}`,
    `Q${x + width},${y} ${x + width},${y + r}`,
    `V${y + height}`,
    "Z",
  ].join(" ");
}

function ChartFrame({
  title,
  description,
  legend,
  showTable,
  onToggleTable,
  dimmed,
  children,
  table,
  tableLabel,
}: {
  title: string;
  description?: string;
  legend?: React.ReactNode;
  showTable: boolean;
  onToggleTable: () => void;
  dimmed?: boolean;
  children: React.ReactNode;
  table: React.ReactNode;
  tableLabel: string;
}) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card p-5">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-black tracking-tight">{title}</h2>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        <div className="flex items-center gap-3">
          {legend}
          <button
            type="button"
            onClick={onToggleTable}
            aria-pressed={showTable}
            className="rounded-full border border-border/60 px-3 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            {showTable ? tableLabel : "Table"}
          </button>
        </div>
      </header>

      {/* Refetch holds the previous render at reduced opacity — no skeleton flash. */}
      <div className={dimmed ? "opacity-50 transition-opacity" : "transition-opacity"}>
        {showTable ? <div className="overflow-x-auto">{table}</div> : children}
      </div>
    </section>
  );
}

function Legend({ items }: { items: Array<{ label: string; color: string; shape: "line" | "rect" }> }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
          {item.shape === "line" ? (
            <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: item.color }} />
          ) : (
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
          )}
          {item.label}
        </span>
      ))}
    </div>
  );
}

function Tooltip({
  x,
  y,
  width,
  children,
}: {
  x: number;
  y: number;
  width: number;
  children: React.ReactNode;
}) {
  // Flip to the left of the pointer near the right edge so the readout never
  // leaves the card.
  const flip = x > width - 160;

  return (
    <div
      className="pointer-events-none absolute z-10 min-w-[9rem] rounded-xl border border-border/60 bg-popover/95 p-2.5 shadow-lg backdrop-blur"
      style={{ left: flip ? x - 150 : x + 14, top: Math.max(4, y - 12) }}
      role="tooltip"
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------- trend chart

export type TrendPoint = { date: string; [key: string]: string | number };

type TrendSeries = { key: string; label: string; suffix?: string };

/**
 * Two measures on one 0–100 axis over time.
 *
 * Both series are percentages, so they share a single scale — never a second
 * y-axis, which would invent a correlation the data does not contain.
 */
export function TrendChart({
  title,
  description,
  points,
  series,
  emptyLabel,
  dimmed,
  maxValue,
}: {
  title: string;
  description?: string;
  points: TrendPoint[];
  series: TrendSeries[];
  emptyLabel: string;
  dimmed?: boolean;
  /**
   * Top of the y-axis. Pass 100 for percentage measures; leave it out and the
   * axis scales to the data. Hard-coding a 0–100 scale silently flattened every
   * absolute-quantity series to the ceiling.
   */
  maxValue?: number;
}) {
  const { ref, width } = useChartWidth<HTMLDivElement>();
  const [active, setActive] = React.useState<number | null>(null);
  const [showTable, setShowTable] = React.useState(false);

  const height = 240;
  const pad = { top: 16, right: 56, bottom: 28, left: 44 };
  const plotW = Math.max(0, width - pad.left - pad.right);
  const plotH = height - pad.top - pad.bottom;

  const axisMax = React.useMemo(() => {
    if (maxValue !== undefined) return maxValue;

    const observed = points.flatMap((point) => series.map((s) => num(point[s.key])));

    return niceCeiling(Math.max(...observed, 1));
  }, [maxValue, points, series]);

  const ticks = React.useMemo(
    () => [0, 0.25, 0.5, 0.75, 1].map((ratio) => axisMax * ratio),
    [axisMax],
  );

  const xFor = (index: number) =>
    points.length <= 1 ? pad.left + plotW / 2 : pad.left + (index / (points.length - 1)) * plotW;
  const yFor = (value: number) =>
    pad.top + plotH - (Math.max(0, Math.min(axisMax, value)) / (axisMax || 1)) * plotH;

  // Direct end-labels only survive when the series separate at the right edge.
  // Where they converge, stacking them would detach each label from its line,
  // so the legend and tooltip carry identity instead.
  const endLabelsCollide = React.useMemo(() => {
    if (points.length === 0 || series.length < 2) return false;

    const ys = series.map((s) => yFor(num(points[points.length - 1][s.key])));

    return ys.some((y, i) => ys.some((other, j) => i !== j && Math.abs(y - other) < 14));
  }, [points, series, axisMax, plotH]);

  const legend = (
    <Legend items={series.map((s, i) => ({ label: s.label, color: SERIES[i], shape: "line" as const }))} />
  );

  const table = (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border/60 text-left text-xs uppercase tracking-widest text-muted-foreground">
          <th className="py-2 pr-3 font-semibold">Date</th>
          {series.map((s) => (
            <th key={s.key} className="py-2 pr-3 text-right font-semibold">
              {s.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {points.map((point) => (
          <tr key={point.date} className="border-b border-border/30">
            <td className="py-2 pr-3">{point.date}</td>
            {series.map((s) => (
              <td key={s.key} className="py-2 pr-3 text-right tabular-nums">
                {num(point[s.key]).toLocaleString()}
                {s.suffix ?? ""}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <ChartFrame
      title={title}
      description={description}
      legend={legend}
      showTable={showTable}
      onToggleTable={() => setShowTable((v) => !v)}
      dimmed={dimmed}
      table={table}
      tableLabel="Chart"
    >
      <div ref={ref} className="relative w-full">
        {points.length === 0 ? (
          <p className="py-16 text-center text-sm italic text-muted-foreground">{emptyLabel}</p>
        ) : width === 0 ? (
          <div style={{ height }} />
        ) : (
          <>
            <svg
              width={width}
              height={height}
              role="img"
              aria-label={title}
              tabIndex={0}
              className="outline-none focus-visible:ring-2 focus-visible:ring-primary"
              onPointerMove={(event) => {
                const bounds = event.currentTarget.getBoundingClientRect();
                const relative = event.clientX - bounds.left - pad.left;
                const step = points.length <= 1 ? 1 : plotW / (points.length - 1);
                setActive(Math.max(0, Math.min(points.length - 1, Math.round(relative / step))));
              }}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(points.length - 1)}
              onBlur={() => setActive(null)}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                  event.preventDefault();
                  setActive((current) => {
                    const next = (current ?? points.length - 1) + (event.key === "ArrowRight" ? 1 : -1);
                    return Math.max(0, Math.min(points.length - 1, next));
                  });
                }
              }}
            >
              {ticks.map((tick) => (
                <g key={tick}>
                  <line
                    x1={pad.left}
                    x2={pad.left + plotW}
                    y1={yFor(tick)}
                    y2={yFor(tick)}
                    stroke="hsl(var(--border))"
                    strokeWidth={1}
                  />
                  <text
                    x={pad.left - 8}
                    y={yFor(tick) + 4}
                    textAnchor="end"
                    className="fill-muted-foreground text-[10px] tabular-nums"
                  >
                    {compact(tick)}
                  </text>
                </g>
              ))}

              {/* First, middle and last date only — a tick per day turns to mush. */}
              {[0, Math.floor((points.length - 1) / 2), points.length - 1]
                .filter((index, position, all) => all.indexOf(index) === position && index >= 0)
                .map((index) => (
                  <text
                    key={index}
                    x={xFor(index)}
                    y={height - 8}
                    textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}
                    className="fill-muted-foreground text-[10px] tabular-nums"
                  >
                    {points[index].date.slice(5)}
                  </text>
                ))}

              {active !== null ? (
                <line
                  x1={xFor(active)}
                  x2={xFor(active)}
                  y1={pad.top}
                  y2={pad.top + plotH}
                  stroke="hsl(var(--border))"
                  strokeWidth={1}
                />
              ) : null}

              {series.map((s, seriesIndex) => {
                const path = points
                  .map((point, index) => `${index === 0 ? "M" : "L"}${xFor(index)},${yFor(num(point[s.key]))}`)
                  .join(" ");

                const lastValue = Number(points[points.length - 1][s.key]);

                return (
                  <g key={s.key}>
                    <path
                      d={path}
                      fill="none"
                      stroke={SERIES[seriesIndex]}
                      strokeWidth={2}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                    {/* End marker with a 2px surface ring so overlapping series
                        stay legible where they cross. */}
                    <circle
                      cx={xFor(points.length - 1)}
                      cy={yFor(lastValue)}
                      r={4}
                      fill={SERIES[seriesIndex]}
                      stroke="hsl(var(--card))"
                      strokeWidth={2}
                    />
                    {/* Direct end-label: the secondary encoding that carries
                        identity where hue separation is marginal under CVD.
                        Dropped when the series converge, so labels never
                        overlap or detach from their line. */}
                    {endLabelsCollide ? null : (
                      <text
                        x={xFor(points.length - 1) + 10}
                        y={yFor(lastValue) + 4}
                        className="fill-foreground text-[11px] font-bold"
                      >
                        {/* One decimal at most: a direct label is a glance
                            value, and the tooltip and table carry precision. */}
                        {lastValue.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                        {s.suffix ?? ""}
                      </text>
                    )}
                    {active !== null ? (
                      <circle
                        cx={xFor(active)}
                        cy={yFor(Number(points[active][s.key]))}
                        r={4}
                        fill={SERIES[seriesIndex]}
                        stroke="hsl(var(--card))"
                        strokeWidth={2}
                      />
                    ) : null}
                  </g>
                );
              })}
            </svg>

            {active !== null ? (
              <Tooltip x={xFor(active)} y={pad.top} width={width}>
                <p className="mb-1 text-[11px] font-semibold text-muted-foreground">{points[active].date}</p>
                {series.map((s, index) => (
                  <p key={s.key} className="flex items-center justify-between gap-3 text-xs">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: SERIES[index] }} />
                      {s.label}
                    </span>
                    <span className="font-bold tabular-nums text-foreground">
                      {num(points[active][s.key]).toLocaleString()}
                      {s.suffix ?? ""}
                    </span>
                  </p>
                ))}
              </Tooltip>
            ) : null}
          </>
        )}
      </div>
    </ChartFrame>
  );
}

// --------------------------------------------------------------- column chart

export function ColumnChart({
  title,
  description,
  rows: rawRows,
  emptyLabel,
  valueLabel,
  dimmed,
}: {
  title: string;
  description?: string;
  rows: Array<{ key: string; label: string; value: number; meta?: string }>;
  emptyLabel: string;
  valueLabel: string;
  dimmed?: boolean;
}) {
  const rows = React.useMemo(
    () => rawRows.map((row) => ({ ...row, value: num(row.value) })),
    [rawRows],
  );
  const { ref, width } = useChartWidth<HTMLDivElement>();
  const [active, setActive] = React.useState<number | null>(null);
  const [showTable, setShowTable] = React.useState(false);

  const height = 220;
  const pad = { top: 16, right: 8, bottom: 30, left: 44 };
  const plotW = Math.max(0, width - pad.left - pad.right);
  const plotH = height - pad.top - pad.bottom;

  const max = niceCeiling(Math.max(...rows.map((row) => row.value), 1));
  const band = rows.length > 0 ? plotW / rows.length : 0;
  // Capped so the bar never fills its slot; the leftover is the 2px gap and air.
  const barWidth = Math.min(24, Math.max(2, band - 8));

  const table = (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border/60 text-left text-xs uppercase tracking-widest text-muted-foreground">
          <th className="py-2 pr-3 font-semibold">Category</th>
          <th className="py-2 text-right font-semibold">{valueLabel}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} className="border-b border-border/30">
            <td className="py-2 pr-3">{row.label}</td>
            <td className="py-2 text-right tabular-nums">{row.value.toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <ChartFrame
      title={title}
      description={description}
      showTable={showTable}
      onToggleTable={() => setShowTable((v) => !v)}
      dimmed={dimmed}
      table={table}
      tableLabel="Chart"
    >
      <div ref={ref} className="relative w-full">
        {rows.length === 0 ? (
          <p className="py-16 text-center text-sm italic text-muted-foreground">{emptyLabel}</p>
        ) : width === 0 ? (
          <div style={{ height }} />
        ) : (
          <>
            <svg width={width} height={height} role="img" aria-label={title}>
              {[0, 0.5, 1].map((ratio) => (
                <g key={ratio}>
                  <line
                    x1={pad.left}
                    x2={pad.left + plotW}
                    y1={pad.top + plotH - ratio * plotH}
                    y2={pad.top + plotH - ratio * plotH}
                    stroke="hsl(var(--border))"
                    strokeWidth={1}
                  />
                  <text
                    x={pad.left - 8}
                    y={pad.top + plotH - ratio * plotH + 4}
                    textAnchor="end"
                    className="fill-muted-foreground text-[10px] tabular-nums"
                  >
                    {compact(max * ratio)}
                  </text>
                </g>
              ))}

              {rows.map((row, index) => {
                const barHeight = (row.value / max) * plotH;
                const x = pad.left + index * band + (band - barWidth) / 2;
                const y = pad.top + plotH - barHeight;
                const isActive = active === index;

                return (
                  <g key={row.key}>
                    <path
                      d={columnPath(x, y, barWidth, barHeight)}
                      fill={SERIES[1]}
                      opacity={active === null || isActive ? 1 : 0.55}
                    />
                    {/* Hit target spans the whole band and the full height, so
                        the pointer never has to find a 6px bar. */}
                    <rect
                      x={pad.left + index * band}
                      y={pad.top}
                      width={band}
                      height={plotH}
                      fill="transparent"
                      tabIndex={0}
                      role="button"
                      aria-label={`${row.label}: ${row.value.toLocaleString()} ${valueLabel}`}
                      className="outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      onPointerEnter={() => setActive(index)}
                      onPointerLeave={() => setActive(null)}
                      onFocus={() => setActive(index)}
                      onBlur={() => setActive(null)}
                    />
                  </g>
                );
              })}

              {/* Label the ends only — a tick under every column is unreadable. */}
              {[0, rows.length - 1]
                .filter((index, position, all) => all.indexOf(index) === position && index >= 0)
                .map((index) => (
                  <text
                    key={index}
                    x={pad.left + index * band + band / 2}
                    y={height - 8}
                    textAnchor={index === 0 ? "start" : "end"}
                    className="fill-muted-foreground text-[10px]"
                  >
                    {rows[index].label.slice(0, 12)}
                  </text>
                ))}
            </svg>

            {active !== null ? (
              <Tooltip x={pad.left + active * band + band / 2} y={pad.top} width={width}>
                <p className="text-sm font-bold tabular-nums text-foreground">
                  {rows[active].value.toLocaleString()}
                </p>
                <p className="text-[11px] text-muted-foreground">{rows[active].label}</p>
                {rows[active].meta ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">{rows[active].meta}</p>
                ) : null}
              </Tooltip>
            ) : null}
          </>
        )}
      </div>
    </ChartFrame>
  );
}

// ------------------------------------------------------------ severity bands

/**
 * Ordered risk bands. These carry state, not identity, so they use the reserved
 * severity ramp and each band ships its written label — never colour alone.
 */
export function SeverityBands({
  title,
  description,
  bands: rawBands,
  emptyLabel,
  dimmed,
}: {
  title: string;
  description?: string;
  bands: Array<{ key: string; label: string; severity: string; count: number }>;
  emptyLabel: string;
  dimmed?: boolean;
}) {
  const bands = React.useMemo(
    () => rawBands.map((band) => ({ ...band, count: num(band.count) })),
    [rawBands],
  );
  const [showTable, setShowTable] = React.useState(false);
  const total = bands.reduce((sum, band) => sum + band.count, 0);
  const max = Math.max(...bands.map((band) => band.count), 1);

  const table = (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border/60 text-left text-xs uppercase tracking-widest text-muted-foreground">
          <th className="py-2 pr-3 font-semibold">Band</th>
          <th className="py-2 pr-3 font-semibold">Severity</th>
          <th className="py-2 text-right font-semibold">Lines</th>
        </tr>
      </thead>
      <tbody>
        {bands.map((band) => (
          <tr key={band.key} className="border-b border-border/30">
            <td className="py-2 pr-3">{band.label}</td>
            <td className="py-2 pr-3 capitalize">{band.severity}</td>
            <td className="py-2 text-right tabular-nums">{band.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <ChartFrame
      title={title}
      description={description}
      showTable={showTable}
      onToggleTable={() => setShowTable((v) => !v)}
      dimmed={dimmed}
      table={table}
      tableLabel="Chart"
    >
      {total === 0 ? (
        <p className="py-10 text-center text-sm italic text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="space-y-3">
          {bands.map((band) => (
            <div key={band.key} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium">{band.label}</span>
                <span className="text-sm font-bold tabular-nums">{band.count.toLocaleString()}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(band.count / max) * 100}%`,
                    backgroundColor: SEVERITY[band.severity] ?? SEVERITY.good,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </ChartFrame>
  );
}

// --------------------------------------------------------------- ranked bars

/**
 * A single measure across categories — a magnitude question, so every bar wears
 * the same hue and rank is read from length and order.
 */
export function RankedBarChart({
  title,
  description,
  rows: rawRows,
  emptyLabel,
  valueLabel,
  valueSuffix = "",
  dimmed,
}: {
  title: string;
  description?: string;
  rows: Array<{ key: string; label: string; value: number; meta?: string; href?: string }>;
  emptyLabel: string;
  valueLabel: string;
  valueSuffix?: string;
  dimmed?: boolean;
}) {
  const rows = React.useMemo(
    () => rawRows.map((row) => ({ ...row, value: num(row.value) })),
    [rawRows],
  );
  const [active, setActive] = React.useState<string | null>(null);
  const [showTable, setShowTable] = React.useState(false);
  const max = Math.max(...rows.map((row) => Math.abs(row.value)), 1);

  const table = (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border/60 text-left text-xs uppercase tracking-widest text-muted-foreground">
          <th className="py-2 pr-3 font-semibold">Category</th>
          <th className="py-2 text-right font-semibold">{valueLabel}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} className="border-b border-border/30">
            <td className="py-2 pr-3">{row.label}</td>
            <td className="py-2 text-right tabular-nums">
              {row.value.toLocaleString()}
              {valueSuffix}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <ChartFrame
      title={title}
      description={description}
      showTable={showTable}
      onToggleTable={() => setShowTable((v) => !v)}
      dimmed={dimmed}
      table={table}
      tableLabel="Chart"
    >
      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm italic text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="space-y-2.5">
          {rows.map((row) => {
            const inner = (
              <>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm font-medium">{row.label}</span>
                  <span className="shrink-0 text-sm font-bold tabular-nums">
                    {row.value.toLocaleString()}
                    {valueSuffix}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-opacity"
                    style={{
                      width: `${(Math.abs(row.value) / max) * 100}%`,
                      backgroundColor: SERIES[1],
                      opacity: active === null || active === row.key ? 1 : 0.55,
                    }}
                  />
                </div>
                {row.meta ? <p className="text-[11px] text-muted-foreground">{row.meta}</p> : null}
              </>
            );

            const className =
              "space-y-1 rounded-lg outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary" +
              (row.href ? " block hover:bg-muted/30" : "");

            return row.href ? (
              <Link
                key={row.key}
                href={row.href}
                className={className}
                onPointerEnter={() => setActive(row.key)}
                onPointerLeave={() => setActive(null)}
              >
                {inner}
              </Link>
            ) : (
              <div
                key={row.key}
                tabIndex={0}
                role="group"
                aria-label={`${row.label}: ${row.value.toLocaleString()}${valueSuffix}`}
                className={className}
                onPointerEnter={() => setActive(row.key)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(row.key)}
                onBlur={() => setActive(null)}
              >
                {inner}
              </div>
            );
          })}
        </div>
      )}
    </ChartFrame>
  );
}
