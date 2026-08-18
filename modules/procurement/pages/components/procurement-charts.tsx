"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ProcurementDashboard } from "@/modules/procurement/types";
import {
  formatMoney,
  ProcurementTable,
} from "@/modules/procurement/pages/components/procurement-shell";

const colors = [
  "#1d5b49",
  "#9c6514",
  "#4f712f",
  "#874918",
  "#3f7767",
  "#9b4e21",
];
const moneyTick = (value: number) =>
  value >= 1_000_000
    ? `${(value / 1_000_000).toFixed(1)}m`
    : value >= 1_000
      ? `${Math.round(value / 1_000)}k`
      : String(value);

export function ProcurementCharts({ data }: { data: ProcurementDashboard }) {
  return (
    <section
      aria-label="Procurement charts and datasets"
      className="grid min-w-0 gap-6 xl:grid-cols-2"
    >
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Ordered versus invoiced spend</h2>
          </CardTitle>
          <CardDescription>
            Six-month source-to-pay value trend in Ethiopian birr.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="h-72"
            role="img"
            aria-label="Grouped bar chart comparing ordered and invoiced procurement spend by month"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.monthly_spend}
                margin={{ left: 8, right: 8, top: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                />
                <YAxis
                  tickFormatter={moneyTick}
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                />
                <Tooltip formatter={(value) => formatMoney(Number(value))} />
                <Bar
                  dataKey="ordered"
                  name="Ordered"
                  fill="#1d5b49"
                  radius={[6, 6, 0, 0]}
                />
                <Bar
                  dataKey="invoiced"
                  name="Invoiced"
                  fill="#9c6514"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ProcurementTable
            caption="Monthly ordered and invoiced spend represented by the chart."
            rows={data.monthly_spend}
            getKey={(row) => row.month}
            columns={[
              { key: "month", label: "Month", render: (row) => row.month },
              {
                key: "ordered",
                label: "Ordered",
                align: "right",
                render: (row) => formatMoney(row.ordered),
              },
              {
                key: "invoiced",
                label: "Invoiced",
                align: "right",
                render: (row) => formatMoney(row.invoiced),
              },
            ]}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Procurement method mix</h2>
          </CardTitle>
          <CardDescription>
            Relative value by sourcing method; use this to watch competition and
            direct-award concentration.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="h-72"
            role="img"
            aria-label="Donut chart of procurement value by sourcing method"
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.method_mix}
                  dataKey="value"
                  nameKey="method"
                  innerRadius={62}
                  outerRadius={102}
                  paddingAngle={3}
                >
                  {data.method_mix.map((row, index) => (
                    <Cell
                      key={row.method}
                      fill={colors[index % colors.length]}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatMoney(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ProcurementTable
            caption="Procurement method values represented by the chart."
            rows={data.method_mix}
            getKey={(row) => row.method}
            columns={[
              {
                key: "method",
                label: "Method",
                render: (row) => row.method.replaceAll("_", " "),
              },
              {
                key: "count",
                label: "Records",
                align: "right",
                render: (row) => row.count,
              },
              {
                key: "value",
                label: "Value",
                align: "right",
                render: (row) => formatMoney(row.value),
              },
            ]}
          />
        </CardContent>
      </Card>
    </section>
  );
}
