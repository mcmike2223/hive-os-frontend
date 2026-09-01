"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  PlusCircle,
  Server,
  Settings,
  WifiOff,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getWorkspaceScopeKey } from "@/lib/runtime-context";
import { attendanceFetch } from "@/modules/attendance/api";
import type { AttendanceDeviceWorkspace } from "@/modules/humanresources/api";

export function AttendanceDeviceSummary() {
  const scope = getWorkspaceScopeKey();

  const workspace = useQuery({
    queryKey: ["hr-attendance-devices-summary", scope],
    queryFn: () =>
      attendanceFetch<{ data: AttendanceDeviceWorkspace }>(
        "/attendance/devices/workspace",
      ),
    refetchInterval: 30_000,
  });

  const data = workspace.data?.data;
  const devices = data?.devices ?? [];

  const totalDevices = devices.length;
  const onlineDevices = devices.filter(
    (d) => d.health_status === "healthy" && d.status === "active",
  ).length;
  const offlineDevices = devices.filter(
    (d) => d.health_status === "unhealthy" || d.status === "inactive",
  ).length;
  const requiringAttention = devices.filter(
    (d) =>
      d.status === "configuration_required" ||
      d.health_status === "degraded" ||
      d.health_status === "unknown",
  ).length;

  return (
    <Card className="overflow-hidden rounded-3xl border-border/60 bg-card/60 shadow-sm backdrop-blur-md">
      <CardContent className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight">
                Attendance Devices & Connectors
              </h3>
              <p className="text-xs text-muted-foreground">
                Biometric terminals, server integrations, and signed edge
                connectors
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {data?.permissions?.can_manage_devices && (
              <Button asChild size="sm" className="font-bold">
                <Link href="/dashboard/attendance/device-onboarding">
                  <PlusCircle className="mr-1.5 h-4 w-4" />
                  Onboard Device
                </Link>
              </Button>
            )}
            <Button
              asChild
              variant="outline"
              size="sm"
              className="bg-background/70"
            >
              <Link href="/dashboard/attendance/devices">
                <Settings className="mr-1.5 h-4 w-4" />
                Manage Devices ({totalDevices})
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Total Devices
              </span>
              <Server className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-black text-foreground">
              {workspace.isLoading ? "…" : totalDevices}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-600/25 bg-emerald-500/10 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                Online / Active
              </span>
              <CheckCircle2 className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
            </div>
            <p className="mt-2 text-2xl font-black text-emerald-800 dark:text-emerald-200">
              {workspace.isLoading ? "…" : onlineDevices}
            </p>
          </div>

          <div className="rounded-2xl border border-rose-600/25 bg-rose-500/10 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">
                Offline
              </span>
              <WifiOff className="h-4 w-4 text-rose-700 dark:text-rose-300" />
            </div>
            <p className="mt-2 text-2xl font-black text-rose-800 dark:text-rose-200">
              {workspace.isLoading ? "…" : offlineDevices}
            </p>
          </div>

          <div className="rounded-2xl border border-amber-600/25 bg-amber-500/10 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                Needs Attention
              </span>
              <AlertTriangle className="h-4 w-4 text-amber-800 dark:text-amber-300" />
            </div>
            <p className="mt-2 text-2xl font-black text-amber-900 dark:text-amber-200">
              {workspace.isLoading ? "…" : requiringAttention}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
