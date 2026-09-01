"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, PlusCircle, RefreshCw, Search } from "lucide-react";
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
  const [activeTab, setActiveTab] = useState<
    "devices" | "connectors" | "sync_history"
  >("devices");

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
  const latestSyncJob = data?.sync_jobs?.[0];
  const rejectedEvents = latestSyncJob?.rejected_count ?? 0;

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
    onError: (err: unknown) => {
      toast.error(
        err instanceof Error ? err.message : "Device sync could not be queued.",
      );
    },
  });

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/60 p-6 shadow-sm backdrop-blur-md">
        <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-primary/10 blur-3xl" />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="relative">
            <div className="flex items-center gap-2">
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="-ml-3 text-muted-foreground hover:text-foreground"
              >
                <Link href="/dashboard/attendance">
                  <ArrowLeft className="mr-1 h-4 w-4" /> Back to Attendance
                </Link>
              </Button>
            </div>
            <p className="mt-3 text-xs font-black uppercase tracking-[0.16em] text-primary">
              Attendance Management
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-foreground">
              Devices & Sync
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              Monitor terminal health, map device users, manage secure
              connectors, and review every synchronization result.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {data?.permissions?.can_manage_devices && (
              <Button asChild className="font-bold">
                <Link href="/dashboard/attendance/device-onboarding">
                  <PlusCircle className="mr-1.5 h-4 w-4" /> Onboard New Device
                </Link>
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => workspace.refetch()}
              disabled={workspace.isFetching}
              className="bg-background/70"
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${workspace.isFetching ? "animate-spin" : ""}`}
              />
              Refresh Status
            </Button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div
          role="group"
          aria-label="Device management views"
          className="mt-6 grid gap-1 rounded-2xl border border-border/60 bg-muted/60 p-1 sm:grid-cols-3"
        >
          <button
            id="device-tab-devices"
            type="button"
            aria-pressed={activeTab === "devices"}
            aria-controls="device-panel-devices"
            onClick={() => setActiveTab("devices")}
            className={`min-h-11 rounded-xl px-3 py-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              activeTab === "devices"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
            }`}
          >
            Registered Devices ({devices.length})
          </button>
          <button
            id="device-tab-connectors"
            type="button"
            aria-pressed={activeTab === "connectors"}
            aria-controls="device-panel-connectors"
            onClick={() => setActiveTab("connectors")}
            className={`min-h-11 rounded-xl px-3 py-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              activeTab === "connectors"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
            }`}
          >
            Employee Mapping & Connectors
          </button>
          <button
            id="device-tab-sync"
            type="button"
            aria-pressed={activeTab === "sync_history"}
            aria-controls="device-panel-sync"
            onClick={() => setActiveTab("sync_history")}
            className={`min-h-11 rounded-xl px-3 py-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              activeTab === "sync_history"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
            }`}
          >
            Sync Jobs ({data?.sync_jobs?.length ?? 0})
          </button>
        </div>
      </header>

      {/* TAB 1: REGISTERED DEVICES */}
      {activeTab === "devices" && (
        <div
          id="device-panel-devices"
          role="region"
          aria-labelledby="device-tab-devices"
          className="space-y-4"
        >
          {rejectedEvents > 0 && (
            <section
              aria-labelledby="device-mapping-needed-title"
              className="rounded-2xl border border-amber-600/30 bg-amber-500/10 p-4 text-amber-950 dark:text-amber-100"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 id="device-mapping-needed-title" className="font-black">
                    Attendance events are waiting for employee mapping
                  </h2>
                  <p className="mt-1 text-sm leading-6">
                    The latest sync retrieved{" "}
                    {latestSyncJob?.received_count ?? 0} events;{" "}
                    {rejectedEvents} were not imported because their device user
                    IDs are not linked to employee records in the active
                    organization.
                  </p>
                </div>
                {data?.permissions?.can_map_employees && (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 shrink-0 border-amber-700/50 bg-background/70"
                    onClick={() => setActiveTab("connectors")}
                  >
                    Open employee mapping
                  </Button>
                )}
              </div>
            </section>
          )}
          <Card className="rounded-3xl border-border/60 bg-card/60">
            <CardContent className="p-0">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 p-5">
                <div className="relative w-full max-w-sm">
                  <Search
                    aria-hidden="true"
                    className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"
                  />
                  <Input
                    placeholder="Search devices by name, code, or adapter..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="Search registered attendance devices"
                    className="pl-9"
                  />
                </div>

                <div
                  className="text-xs font-semibold text-muted-foreground"
                  aria-live="polite"
                >
                  Showing {filteredDevices.length} of {devices.length} devices
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableCaption>
                    Registered tenant attendance devices and biometric
                    terminals.
                  </TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">Device</TableHead>
                      <TableHead scope="col">Adapter</TableHead>
                      <TableHead scope="col">Status</TableHead>
                      <TableHead scope="col">Health</TableHead>
                      <TableHead scope="col">Last Sync / Seen</TableHead>
                      <TableHead className="text-right" scope="col">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDevices.length ? (
                      filteredDevices.map((device) => (
                        <TableRow key={device.id} className="hover:bg-muted/40">
                          <TableCell className="font-semibold">
                            <div className="font-bold text-foreground">
                              {device.name}
                            </div>
                            <div className="font-mono text-xs text-primary">
                              {device.device_code}
                            </div>
                            {(device.model || device.serial_number) && (
                              <div className="mt-1 text-xs text-muted-foreground">
                                {[device.model, device.serial_number]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-xs capitalize text-muted-foreground">
                            {device.adapter_type.replace("_", " ")}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold capitalize ${
                                device.status === "active"
                                  ? "border border-emerald-600/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                                  : "border border-amber-600/30 bg-amber-500/10 text-amber-900 dark:text-amber-200"
                              }`}
                            >
                              {device.status.replace("_", " ")}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold capitalize ${
                                device.health_status === "healthy"
                                  ? "border border-emerald-600/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                                  : device.health_status === "unhealthy"
                                    ? "border border-rose-600/30 bg-rose-500/10 text-rose-800 dark:text-rose-200"
                                    : "border border-border bg-muted text-muted-foreground"
                              }`}
                            >
                              {device.health_status}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDateTime(device.last_seen_at)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  testDevice.mutate(device.device_code)
                                }
                                disabled={testDevice.isPending}
                                className="min-h-10 text-xs"
                              >
                                Test
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  syncDevice.mutate(device.device_code)
                                }
                                disabled={syncDevice.isPending}
                                className="min-h-10 text-xs"
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
                          className="py-8 text-center text-muted-foreground"
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
        </div>
      )}

      {/* TAB 2: CONNECTOR BAY */}
      {activeTab === "connectors" && (
        <div
          id="device-panel-connectors"
          role="region"
          aria-labelledby="device-tab-connectors"
        >
          <AttendanceDeviceConnectors employees={employees} />
        </div>
      )}

      {/* TAB 3: SYNC HISTORY */}
      {activeTab === "sync_history" && (
        <Card
          id="device-panel-sync"
          role="region"
          aria-labelledby="device-tab-sync"
          className="rounded-3xl border-border/60 bg-card/60"
        >
          <CardContent className="p-0">
            <div className="border-b border-border/60 p-5">
              <h3 className="text-lg font-bold">
                Device Sync History & Audit Log
              </h3>
              <p className="text-xs text-muted-foreground">
                Recent synchronization jobs, event counts, and processing
                results
              </p>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableCaption>
                  Recent attendance synchronization job logs.
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Job UUID</TableHead>
                    <TableHead scope="col">Device</TableHead>
                    <TableHead scope="col">Direction / Adapter</TableHead>
                    <TableHead scope="col">Counts</TableHead>
                    <TableHead scope="col">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.sync_jobs ?? []).length ? (
                    data?.sync_jobs.map((job) => (
                      <TableRow key={job.id} className="hover:bg-muted/40">
                        <TableCell className="font-mono text-xs text-primary">
                          {job.job_uuid.slice(0, 8)}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {job.device?.name ?? "Unknown Device"}
                        </TableCell>
                        <TableCell className="text-xs capitalize text-muted-foreground">
                          {job.direction} · {job.adapter_type.replace("_", " ")}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          Rec: {job.received_count} | Acc: {job.accepted_count}{" "}
                          | Dup: {job.duplicate_count} | Rej:{" "}
                          {job.rejected_count}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold capitalize ${
                              job.status === "completed"
                                ? "border border-emerald-600/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                                : job.status === "failed"
                                  ? "border border-rose-600/30 bg-rose-500/10 text-rose-800 dark:text-rose-200"
                                  : "border border-amber-600/30 bg-amber-500/10 text-amber-900 dark:text-amber-200"
                            }`}
                          >
                            {job.status}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-8 text-center text-muted-foreground"
                      >
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
