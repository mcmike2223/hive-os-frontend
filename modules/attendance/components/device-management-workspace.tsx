"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Cable,
  CheckCircle2,
  Cpu,
  DatabaseZap,
  KeyRound,
  Layers,
  PlusCircle,
  RefreshCw,
  Search,
  Server,
  Settings,
  ShieldCheck,
  Trash2,
  Users,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";

import { AttendanceDeviceConnectors } from "@/app/dashboard/human-resources/attendance-device-connectors";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getWorkspaceScopeKey } from "@/lib/runtime-context";
import {
  AttendanceDevice,
  AttendanceDeviceWorkspace,
  Employee,
  Paginated,
} from "@/modules/humanresources/api";
import { attendanceFetch } from "@/modules/attendance/api";

function formatDateTime(value: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function DeviceManagementWorkspace() {
  const scope = getWorkspaceScopeKey();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"devices" | "connectors" | "sync_history">("devices");

  const workspace = useQuery({
    queryKey: ["hr-attendance-devices-workspace", scope],
    queryFn: () =>
      attendanceFetch<{ data: AttendanceDeviceWorkspace }>(
        "/attendance/devices/workspace",
      ),
    refetchInterval: 15_000,
  });

  const employeesQuery = useQuery({
    queryKey: ["hr-attendance-employees-mgmt", scope],
    queryFn: () =>
      attendanceFetch<Paginated<Employee>>("/employees?per_page=100"),
  });

  const data = workspace.data?.data;
  const devices = data?.devices ?? [];
  const employees = employeesQuery.data?.data ?? [];

  const filteredDevices = devices.filter(
    (d) =>
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.device_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.adapter_type.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const testDevice = useMutation({
    mutationFn: (deviceCode: string) =>
      attendanceFetch<{ data: { ok: boolean } }>(
        `/attendance/devices/${encodeURIComponent(deviceCode)}/test`,
        { method: "POST" },
      ),
    onSuccess: () => {
      toast.success("Device connection test passed.");
      void workspace.refetch();
    },
    onError: (err: unknown) => {
      toast.error(
        err instanceof Error ? err.message : "Device connection test failed.",
      );
    },
  });

  const syncDevice = useMutation({
    mutationFn: (deviceCode: string) =>
      attendanceFetch(
        `/attendance/devices/${encodeURIComponent(deviceCode)}/sync`,
        {
          method: "POST",
          body: JSON.stringify({ limit: 100 }),
        },
      ),
    onSuccess: () => {
      toast.success("Device sync job queued.");
      void workspace.refetch();
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 p-6 text-white dark:border-slate-800 dark:bg-slate-950 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="text-slate-300 hover:text-white"
              >
                <Link href="/dashboard/attendance">
                  <ArrowLeft className="mr-1 h-4 w-4" /> Back to Attendance
                </Link>
              </Button>
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight">
              Attendance Device Management
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              Inspect device health, sync status, credentials, and connector bay configurations
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {data?.permissions?.can_manage_devices && (
              <Button
                asChild
                className="bg-blue-600 hover:bg-blue-500 font-bold"
              >
                <Link href="/dashboard/attendance/device-onboarding">
                  <PlusCircle className="mr-1.5 h-4 w-4" /> Onboard New Device
                </Link>
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => workspace.refetch()}
              disabled={workspace.isFetching}
              className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${workspace.isFetching ? "animate-spin" : ""}`}
              />
              Refresh Status
            </Button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mt-6 flex border-b border-slate-800 gap-6">
          <button
            onClick={() => setActiveTab("devices")}
            className={`pb-3 text-sm font-bold border-b-2 transition-colors ${
              activeTab === "devices"
                ? "border-cyan-400 text-cyan-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Registered Devices ({devices.length})
          </button>
          <button
            onClick={() => setActiveTab("connectors")}
            className={`pb-3 text-sm font-bold border-b-2 transition-colors ${
              activeTab === "connectors"
                ? "border-cyan-400 text-cyan-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Connector Bay & Advanced Setup
          </button>
          <button
            onClick={() => setActiveTab("sync_history")}
            className={`pb-3 text-sm font-bold border-b-2 transition-colors ${
              activeTab === "sync_history"
                ? "border-cyan-400 text-cyan-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Sync Jobs ({data?.sync_jobs?.length ?? 0})
          </button>
        </div>
      </header>

      {/* TAB 1: REGISTERED DEVICES */}
      {activeTab === "devices" && (
        <Card className="border-slate-700 bg-slate-900 text-white dark:border-slate-800 dark:bg-slate-950">
          <CardContent className="p-0">
            <div className="flex flex-wrap items-center justify-between gap-4 p-5 border-b border-slate-800">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search devices by name, code, or adapter..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-slate-950 border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>

              <div className="text-xs text-slate-400 font-semibold">
                Showing {filteredDevices.length} of {devices.length} devices
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableCaption>
                  Registered tenant attendance devices and biometric terminals.
                </TableCaption>
                <TableHeader>
                  <TableRow className="border-slate-800 hover:bg-slate-900/50">
                    <TableHead className="text-slate-400" scope="col">Device</TableHead>
                    <TableHead className="text-slate-400" scope="col">Adapter</TableHead>
                    <TableHead className="text-slate-400" scope="col">Status</TableHead>
                    <TableHead className="text-slate-400" scope="col">Health</TableHead>
                    <TableHead className="text-slate-400" scope="col">Last Sync / Seen</TableHead>
                    <TableHead className="text-right text-slate-400" scope="col">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDevices.length ? (
                    filteredDevices.map((device) => (
                      <TableRow
                        key={device.id}
                        className="border-slate-800 hover:bg-slate-950/50"
                      >
                        <TableCell className="font-semibold">
                          <div className="font-bold text-white">{device.name}</div>
                          <div className="font-mono text-xs text-cyan-300">
                            {device.device_code}
                          </div>
                        </TableCell>
                        <TableCell className="capitalize text-slate-300 text-xs">
                          {device.adapter_type.replace("_", " ")}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold capitalize ${
                              device.status === "active"
                                ? "bg-teal-950/60 border border-teal-800 text-teal-300"
                                : "bg-amber-950/60 border border-amber-800 text-amber-300"
                            }`}
                          >
                            {device.status.replace("_", " ")}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold capitalize ${
                              device.health_status === "healthy"
                                ? "bg-teal-950/60 border border-teal-800 text-teal-300"
                                : device.health_status === "unhealthy"
                                  ? "bg-rose-950/60 border border-rose-800 text-rose-300"
                                  : "bg-slate-800 text-slate-300"
                            }`}
                          >
                            {device.health_status}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-slate-300">
                          {formatDateTime(device.last_seen_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => testDevice.mutate(device.device_code)}
                              disabled={testDevice.isPending}
                              className="h-8 border-slate-700 bg-slate-800 text-xs text-slate-200 hover:bg-slate-700"
                            >
                              Test
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => syncDevice.mutate(device.device_code)}
                              disabled={syncDevice.isPending}
                              className="h-8 border-slate-700 bg-slate-800 text-xs text-slate-200 hover:bg-slate-700"
                            >
                              Sync
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-8 text-center text-slate-400"
                      >
                        {workspace.isLoading
                          ? "Loading device records..."
                          : "No devices found matching search query."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 2: CONNECTOR BAY */}
      {activeTab === "connectors" && (
        <AttendanceDeviceConnectors employees={employees} />
      )}

      {/* TAB 3: SYNC HISTORY */}
      {activeTab === "sync_history" && (
        <Card className="border-slate-700 bg-slate-900 text-white dark:border-slate-800 dark:bg-slate-950">
          <CardContent className="p-0">
            <div className="p-5 border-b border-slate-800">
              <h3 className="text-lg font-bold">Device Sync History & Audit Log</h3>
              <p className="text-xs text-slate-400">
                Recent synchronization jobs, event counts, and processing results
              </p>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableCaption>Recent attendance synchronization job logs.</TableCaption>
                <TableHeader>
                  <TableRow className="border-slate-800 hover:bg-slate-900/50">
                    <TableHead className="text-slate-400" scope="col">Job UUID</TableHead>
                    <TableHead className="text-slate-400" scope="col">Device</TableHead>
                    <TableHead className="text-slate-400" scope="col">Direction / Adapter</TableHead>
                    <TableHead className="text-slate-400" scope="col">Counts</TableHead>
                    <TableHead className="text-slate-400" scope="col">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.sync_jobs ?? []).length ? (
                    data?.sync_jobs.map((job) => (
                      <TableRow
                        key={job.id}
                        className="border-slate-800 hover:bg-slate-950/50"
                      >
                        <TableCell className="font-mono text-xs text-cyan-300">
                          {job.job_uuid.slice(0, 8)}
                        </TableCell>
                        <TableCell className="font-semibold text-slate-200">
                          {job.device?.name ?? "Unknown Device"}
                        </TableCell>
                        <TableCell className="text-xs text-slate-300 capitalize">
                          {job.direction} · {job.adapter_type.replace("_", " ")}
                        </TableCell>
                        <TableCell className="text-xs text-slate-300 font-mono">
                          Rec: {job.received_count} | Acc: {job.accepted_count} | Dup: {job.duplicate_count} | Rej: {job.rejected_count}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold capitalize ${
                              job.status === "completed"
                                ? "bg-teal-950/60 border border-teal-800 text-teal-300"
                                : job.status === "failed"
                                  ? "bg-rose-950/60 border border-rose-800 text-rose-300"
                                  : "bg-amber-950/60 border border-amber-800 text-amber-300"
                            }`}
                          >
                            {job.status}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-slate-400">
                        No sync jobs recorded.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
