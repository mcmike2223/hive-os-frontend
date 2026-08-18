"use client";

import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, subMonths, startOfMonth, isWithinInterval } from "date-fns";
import { Project } from "../types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";

interface ProjectTrendChartProps {
  projects: Project[];
}

export function ProjectTrendChart({ projects }: ProjectTrendChartProps) {
  // Generate last 6 months of data
  const chartData = Array.from({ length: 6 }).map((_, i) => {
    const monthDate = subMonths(new Date(), 5 - i);
    const start = startOfMonth(monthDate);
    const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

    const count = projects.filter((p) => {
      const createdDate = new Date(p.created_at);
      return isWithinInterval(createdDate, { start, end });
    }).length;

    return {
      month: format(monthDate, "MMM"),
      count,
    };
  });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background/80 backdrop-blur-xl border border-border/50 p-4 rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-300">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-primary" />
            <p className="text-lg font-black tracking-tight leading-none">
              {payload[0].value} <span className="text-xs font-medium text-muted-foreground">Projects</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="bg-card/30 backdrop-blur-md border-muted-foreground/10 overflow-hidden rounded-[2rem] group transition-all duration-500 hover:bg-card/40">
      <CardHeader className="pt-8 px-8 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
            Project Velocity
          </CardTitle>
          <p className="text-xs text-muted-foreground/60 mt-1 font-medium">Creation trends over last 6 months</p>
        </div>
        <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
        </div>
      </CardHeader>
      <CardContent className="h-[300px] w-full p-0 mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground))" opacity={0.05} />
            <XAxis 
                dataKey="month" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fontWeight: 600, fill: "hsl(var(--foreground))", opacity: 0.8 }}
                dy={10}
            />
            <YAxis hide />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1, strokeDasharray: "4 4" }} />
            <Area
              type="natural"
              dataKey="count"
              stroke="hsl(var(--primary))"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorCount)"
              animationDuration={2000}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
