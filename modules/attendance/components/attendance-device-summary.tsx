"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  PlusCircle,
  Radio,
  RefreshCw,
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
    <Card className="overflow-hidden border-slate-700 bg-slate-900 text-white dark:border-slate-800 dark:bg-slate-950 shadow-md">
      <CardContent className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-900/50 text-cyan-300 border border-cyan-500/30">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight">
                Attendance Devices & Connectors
              </h3>
              <p className="text-xs text-slate-400">
                Hardware biometric terminals, BioStar 2 server links, and local API connectors
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {data?.permissions?.can_manage_devices && (
              <Button
                asChild
                size="sm"
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold"
              >
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
              className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white"
            >
              <Link href="/dashboard/attendance/devices">
                <Settings className="mr-1.5 h-4 w-4" />
                Manage Devices ({totalDevices})
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Total Devices
              </span>
              <Server className="h-4 w-4 text-slate-400" />
            </div>
            <p className="mt-2 text-2xl font-black text-white">
              {workspace.isLoading ? "…" : totalDevices}
            </p>
          </div>

          <div className="rounded-xl border border-teal-900/50 bg-teal-950/30 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-400">
                Online / Active
              </span>
              <CheckCircle2 className="h-4 w-4 text-teal-400" />
            </div>
            <p className="mt-2 text-2xl font-black text-teal-300">
              {workspace.isLoading ? "…" : onlineDevices}
            </p>
          </div>

          <div className="rounded-xl border border-rose-900/50 bg-rose-950/30 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
                Offline
              </span>
              <WifiOff className="h-4 w-4 text-rose-400" />
            </div>
            <p className="mt-2 text-2xl font-black text-rose-300">
              {workspace.isLoading ? "…" : offlineDevices}
            </p>
          </div>

          <div className="rounded-xl border border-amber-900/50 bg-amber-950/30 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Needs Attention
              </span>
              <AlertTriangle className="h-4 w-4 text-amber-400" />
            </div>
            <p className="mt-2 text-2xl font-black text-amber-300">
              {workspace.isLoading ? "…" : requiringAttention}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
