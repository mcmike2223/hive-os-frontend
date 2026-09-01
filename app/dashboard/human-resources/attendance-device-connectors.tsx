"use client";

import { FormEvent, useId, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Cable,
  CheckCircle2,
  Copy,
  DatabaseZap,
  FileUp,
  Fingerprint,
  HeartPulse,
  KeyRound,
  Link2,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  AttendanceDeviceDiscovery,
  AttendanceDeviceWorkspace,
  Employee,
} from "@/modules/humanresources/api";
import { attendanceFetch } from "@/modules/attendance/api";

const controlClass =
  "h-11 border-slate-500 focus-visible:ring-2 focus-visible:ring-blue-700 dark:border-slate-400 dark:focus-visible:ring-cyan-300";
const selectClass =
  "h-11 w-full rounded-md border border-slate-500 bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-700 dark:border-slate-400 dark:focus-visible:ring-cyan-300";

function formatDateTime(value: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function deviceLabel(device: AttendanceDevice) {
  return `${device.name} · ${device.device_code}`;
}

type QuickAddAdapter = string;

const deviceTypeDefaults: Record<string, { code: string; name: string }> = {
  suprema_biostar2: {
    code: "SUPREMA-BIOSTATION-2",
    name: "Suprema BioStation 2",
  },
  generic_webhook: {
    code: "ATTENDANCE-WEBHOOK",
    name: "Generic attendance webhook",
  },
  local_connector: {
    code: "ATTENDANCE-CONNECTOR",
    name: "Local attendance connector",
  },
  mock: {
    code: "ATTENDANCE-MOCK",
    name: "Mock attendance device",
  },
};

export function AttendanceDeviceConnectors({
  employees,
}: {
  employees: Employee[];
}) {
  const scope = getWorkspaceScopeKey();
  const queryClient = useQueryClient();
  const deviceHintId = useId();
  const deviceTypeHintId = useId();
  const credentialHintId = useId();
  const discoveryHintId = useId();
  const discoveredDeviceHintId = useId();
  const discoveredUserHintId = useId();
  const mappingHintId = useId();
  const importHintId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [displayOnce, setDisplayOnce] = useState<{
    keyId: string;
    secret: string;
  } | null>(null);
  const [bioStarDiscovery, setBioStarDiscovery] =
    useState<AttendanceDeviceDiscovery | null>(null);
  const [deviceForm, setDeviceForm] = useState({
    device_code: "SUPREMA-BIOSTATION-2",
    name: "Suprema BioStation 2",
    adapter_type: "suprema_biostar2" as QuickAddAdapter,
    timezone: "Africa/Addis_Ababa",
    base_url: "",
    biostar_device_id: "",
    verify_tls: "true",
  });
  const [credentialForm, setCredentialForm] = useState({
    device_code: "",
    base_url: "",
    biostar_device_id: "",
    verify_tls: "true",
    tna_clock_in: "1",
    tna_clock_out: "2",
    tna_break_start: "3",
    tna_break_end: "4",
    principal: "",
    secret: "",
  });
  const [mappingForm, setMappingForm] = useState({
    device_code: "",
    employee_id: "",
    external_employee_identifier: "",
  });
  const [importForm, setImportForm] = useState({
    device_id: "",
    file: null as File | null,
  });

  const workspace = useQuery({
    queryKey: ["hr-attendance-devices", scope],
    queryFn: () =>
      attendanceFetch<{ data: AttendanceDeviceWorkspace }>(
        "/attendance/devices/workspace",
      ),
    refetchInterval: 15_000,
  });
  const data = workspace.data?.data;
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: ["hr-attendance-devices", scope],
    });

  const createDevice = useMutation({
    mutationFn: () =>
      attendanceFetch<{
        data: AttendanceDevice;
        meta: {
          key_id?: string;
          credential_secret?: string;
          display_once: boolean;
        };
      }>("/attendance/devices", {
        method: "POST",
        body: JSON.stringify({
          device_code: deviceForm.device_code,
          name: deviceForm.name,
          adapter_type: deviceForm.adapter_type,
          timezone: deviceForm.timezone,
          manufacturer:
            deviceForm.adapter_type === "suprema_biostar2" ? "Suprema" : null,
          model:
            deviceForm.adapter_type === "suprema_biostar2"
              ? "BioStation 2"
              : null,
          configuration:
            deviceForm.adapter_type === "suprema_biostar2"
              ? {
                  base_url: deviceForm.base_url,
                  biostar_device_id: deviceForm.biostar_device_id || undefined,
                  verify_tls: deviceForm.verify_tls === "true",
                  allow_http:
                    deviceForm.verify_tls === "false" &&
                    deviceForm.base_url.startsWith("http://"),
                  event_limit: 100,
                  tna_key_map: {
                    "1": "clock_in",
                    "2": "clock_out",
                    "3": "break_start",
                    "4": "break_end",
                  },
                }
              : {},
        }),
      }),
    onSuccess: (response) => {
      if (
        response.meta.display_once &&
        response.meta.key_id &&
        response.meta.credential_secret
      ) {
        setDisplayOnce({
          keyId: response.meta.key_id,
          secret: response.meta.credential_secret,
        });
      }
      setCredentialForm((current) => ({
        ...current,
        device_code: response.data.device_code,
        base_url: response.data.configuration?.base_url ?? "",
        biostar_device_id: response.data.configuration?.biostar_device_id ?? "",
        verify_tls:
          response.data.configuration?.verify_tls === false ? "false" : "true",
        tna_clock_in:
          Object.entries(response.data.configuration?.tna_key_map ?? {}).find(
            ([, eventType]) => eventType === "clock_in",
          )?.[0] ?? "1",
        tna_clock_out:
          Object.entries(response.data.configuration?.tna_key_map ?? {}).find(
            ([, eventType]) => eventType === "clock_out",
          )?.[0] ?? "2",
        tna_break_start:
          Object.entries(response.data.configuration?.tna_key_map ?? {}).find(
            ([, eventType]) => eventType === "break_start",
          )?.[0] ?? "3",
        tna_break_end:
          Object.entries(response.data.configuration?.tna_key_map ?? {}).find(
            ([, eventType]) => eventType === "break_end",
          )?.[0] ?? "4",
      }));
      setMappingForm((current) => ({
        ...current,
        device_code: response.data.device_code,
      }));
      setImportForm((current) => ({
        ...current,
        device_id: String(response.data.id),
      }));
      toast.success(`${response.data.name} was added.`);
      void refresh();
    },
  });

  const discoverDevice = useMutation({
    mutationFn: (deviceCode: string) =>
      attendanceFetch<{
        data: AttendanceDeviceDiscovery;
        meta: { biometric_data_included: false };
      }>(`/attendance/devices/${encodeURIComponent(deviceCode)}/discover`, {
        method: "POST",
        body: JSON.stringify({ user_limit: 500, user_offset: 0 }),
      }),
    onSuccess: (response) => {
      setBioStarDiscovery(response.data);
      if (
        response.data.devices.length === 1 &&
        !credentialForm.biostar_device_id
      ) {
        setCredentialForm((current) => ({
          ...current,
          biostar_device_id: response.data.devices[0].id,
        }));
      }
      toast.success(
        `BioStar returned ${response.data.device_count} device(s) and ${response.data.user_count} user(s).`,
      );
      void refresh();
    },
    onError: (error) =>
      toast.error(errorMessage(error, "BioStar discovery failed.")),
  });

  const updateDeviceConfiguration = useMutation({
    mutationFn: () =>
      attendanceFetch<{
        data: AttendanceDevice;
      }>(
        `/attendance/devices/${encodeURIComponent(credentialForm.device_code)}/configuration`,
        {
          method: "PATCH",
          body: JSON.stringify({
            configuration: {
              biostar_device_id: credentialForm.biostar_device_id,
            },
          }),
        },
      ),
    onSuccess: (response) => {
      toast.success(
        `${response.data.name} will now fetch events from the selected BioStar device.`,
      );
      setMappingForm((current) => ({
        ...current,
        device_code: response.data.device_code,
      }));
      void refresh();
    },
  });

  const rotateCredential = useMutation({
    mutationFn: () => {
      const device = data?.devices.find(
        (item) => item.device_code === credentialForm.device_code,
      );
      const isBioStar = device?.adapter_type === "suprema_biostar2";

      return attendanceFetch<{
        data: unknown;
        meta: {
          key_id: string;
          credential_secret: string | null;
          display_once: boolean;
        };
      }>(
        `/attendance/devices/${encodeURIComponent(credentialForm.device_code)}/credentials/rotate`,
        {
          method: "POST",
          body: JSON.stringify({
            credential_type: isBioStar ? "biostar2_api" : "connector_hmac",
            principal: isBioStar ? credentialForm.principal : null,
            secret: isBioStar ? credentialForm.secret : null,
            configuration: isBioStar
              ? {
                  base_url: credentialForm.base_url,
                  biostar_device_id:
                    credentialForm.biostar_device_id || undefined,
                  verify_tls: credentialForm.verify_tls === "true",
                  allow_http:
                    credentialForm.verify_tls === "false" &&
                    credentialForm.base_url.startsWith("http://"),
                  event_limit: 100,
                  tna_key_map: {
                    [credentialForm.tna_clock_in]: "clock_in",
                    [credentialForm.tna_clock_out]: "clock_out",
                    [credentialForm.tna_break_start]: "break_start",
                    [credentialForm.tna_break_end]: "break_end",
                  },
                }
              : null,
          }),
        },
      );
    },
    onSuccess: (response) => {
      if (response.meta.display_once && response.meta.credential_secret) {
        setDisplayOnce({
          keyId: response.meta.key_id,
          secret: response.meta.credential_secret,
        });
      }
      setCredentialForm((current) => ({
        ...current,
        principal: "",
        secret: "",
      }));
      toast.success("Device credential rotated.");
      const selected = data?.devices.find(
        (device) => device.device_code === credentialForm.device_code,
      );
      if (selected?.adapter_type === "suprema_biostar2") {
        discoverDevice.mutate(credentialForm.device_code);
      }
      void refresh();
    },
  });

  const mapEmployee = useMutation({
    mutationFn: () =>
      attendanceFetch(
        `/attendance/devices/${encodeURIComponent(mappingForm.device_code)}/employee-mappings`,
        {
          method: "POST",
          body: JSON.stringify({
            employee_id: Number(mappingForm.employee_id),
            external_employee_identifier:
              mappingForm.external_employee_identifier,
          }),
        },
      ),
    onSuccess: () => {
      setMappingForm((current) => ({
        ...current,
        employee_id: "",
        external_employee_identifier: "",
      }));
      toast.success("External device identity mapped to the employee.");
      void refresh();
    },
  });

  const testDevice = useMutation({
    mutationFn: (deviceCode: string) =>
      attendanceFetch(
        `/attendance/devices/${encodeURIComponent(deviceCode)}/test`,
        {
          method: "POST",
        },
      ),
    onSuccess: () => {
      toast.success("Device connection test passed.");
      void refresh();
    },
    onError: (error) =>
      toast.error(errorMessage(error, "Device connection test failed.")),
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
      toast.success("Device sync queued.");
      void refresh();
    },
  });

  const importEvents = useMutation({
    mutationFn: () => {
      const body = new FormData();
      body.append("attendance_device_id", importForm.device_id);
      if (importForm.file) body.append("file", importForm.file);

      return attendanceFetch("/attendance/imports", {
        method: "POST",
        body,
      });
    },
    onSuccess: () => {
      setImportForm((current) => ({ ...current, file: null }));
      if (fileRef.current) fileRef.current.value = "";
      toast.success("Attendance import queued.");
      void refresh();
    },
  });

  const selectedCredentialDevice = data?.devices.find(
    (device) => device.device_code === credentialForm.device_code,
  );
  const isBioStarCredential =
    selectedCredentialDevice?.adapter_type === "suprema_biostar2";
  const hasActiveBioStarCredential =
    selectedCredentialDevice?.credentials?.some(
      (credential) =>
        credential.credential_type === "biostar2_api" &&
        credential.status === "active",
    ) ?? false;
  const selectedMappingDevice = data?.devices.find(
    (device) => device.device_code === mappingForm.device_code,
  );
  const discoveredUsers =
    selectedMappingDevice?.adapter_type === "suprema_biostar2" &&
    bioStarDiscovery?.device_code === selectedMappingDevice.device_code
      ? bioStarDiscovery.users
      : [];
  const bioStarTnaKeys = [
    credentialForm.tna_clock_in.trim(),
    credentialForm.tna_clock_out.trim(),
    credentialForm.tna_break_start.trim(),
    credentialForm.tna_break_end.trim(),
  ];
  const hasValidBioStarTnaKeys =
    bioStarTnaKeys.every((key) => key.length > 0) &&
    new Set(bioStarTnaKeys).size === bioStarTnaKeys.length;
  const mutationError =
    createDevice.error ||
    rotateCredential.error ||
    discoverDevice.error ||
    updateDeviceConfiguration.error ||
    mapEmployee.error ||
    importEvents.error;

  return (
    <section
      aria-labelledby="attendance-connectors-heading"
      className="mt-6 space-y-5"
    >
      <Card className="overflow-hidden rounded-3xl border-border/60 bg-card/60 shadow-sm">
        <CardContent className="relative p-0">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(circle_at_12%_10%,hsl(var(--primary)/0.12),transparent_32%),linear-gradient(120deg,transparent_48%,hsl(var(--primary)/0.08)_49%,transparent_50%)]"
          />
          <div className="relative grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-primary">
                <Cable aria-hidden="true" className="h-4 w-4" />
                Connector bay
              </div>
              <h4
                id="attendance-connectors-heading"
                className="max-w-3xl text-2xl font-black tracking-tight"
              >
                Vendor devices, imports, and secure local connectors
              </h4>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                Hikvision, Suprema, ZKTeco, Anviz, CSV, and signed connector
                events enter the same tenant-safe attendance ledger without
                duplication.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => void refresh()}
              disabled={workspace.isFetching}
              className="min-h-11 bg-background/70 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RefreshCw
                aria-hidden="true"
                className={`mr-2 h-4 w-4 ${workspace.isFetching ? "animate-spin" : ""}`}
              />
              Refresh connector status
            </Button>
          </div>
          <ol className="relative grid border-t border-border/60 bg-muted/50 sm:grid-cols-5">
            {[
              ["1", "Source"],
              ["2", "Authenticate"],
              ["3", "Map"],
              ["4", "Normalize"],
              ["5", "Acknowledge"],
            ].map(([number, label]) => (
              <li
                key={number}
                className="flex min-h-14 items-center gap-3 border-b border-border/60 px-4 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-primary/30 bg-primary/10 font-black text-primary">
                  {number}
                </span>
                <span className="text-sm font-bold text-foreground">
                  {label}
                </span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {displayOnce && (
        <div
          role="status"
          className="rounded-xl border-2 border-amber-700 bg-amber-50 p-4 text-amber-950 dark:border-amber-300 dark:bg-amber-950 dark:text-amber-50"
        >
          <div className="flex items-start gap-3">
            <KeyRound aria-hidden="true" className="mt-0.5 h-5 w-5" />
            <div className="min-w-0 flex-1">
              <p className="font-black">Copy this connector credential now</p>
              <p className="mt-1 text-sm">
                Hive will not show the secret again. Keep it in the local
                connector&apos;s protected secret store.
              </p>
              <dl className="mt-3 grid gap-2 text-sm">
                <div>
                  <dt className="font-bold">Device key</dt>
                  <dd className="break-all font-mono">{displayOnce.keyId}</dd>
                </div>
                <div>
                  <dt className="font-bold">HMAC secret</dt>
                  <dd className="break-all font-mono">{displayOnce.secret}</dd>
                </div>
              </dl>
              <Button
                type="button"
                className="mt-3 min-h-11 bg-amber-900 text-white hover:bg-amber-950 focus-visible:ring-2 focus-visible:ring-amber-900 dark:bg-amber-100 dark:text-amber-950 dark:hover:bg-white dark:focus-visible:ring-amber-100"
                onClick={async () => {
                  await navigator.clipboard.writeText(
                    `X-Hive-Device-Key=${displayOnce.keyId}\nHIVE_DEVICE_SECRET=${displayOnce.secret}`,
                  );
                  toast.success("Connector credential copied.");
                }}
              >
                <Copy aria-hidden="true" className="mr-2 h-4 w-4" />
                Copy connector credential
              </Button>
            </div>
          </div>
        </div>
      )}

      {mutationError && (
        <div
          tabIndex={-1}
          className="rounded-lg border border-red-700 bg-red-50 p-3 text-sm font-semibold text-red-900 outline-none focus-visible:ring-2 focus-visible:ring-red-700 dark:border-red-300 dark:bg-red-950 dark:text-red-100"
        >
          {errorMessage(
            mutationError,
            "The connector operation could not be completed.",
          )}
        </div>
      )}

      {workspace.isLoading ? (
        <div
          role="status"
          className="rounded-xl border border-slate-500 p-8 text-center font-semibold text-slate-700 dark:border-slate-400 dark:text-slate-200"
        >
          Loading device connectors…
        </div>
      ) : workspace.isError || !data ? (
        <div className="rounded-xl border border-red-700 bg-red-50 p-4 text-red-900 dark:border-red-300 dark:bg-red-950 dark:text-red-100">
          Device connectors could not be loaded.
        </div>
      ) : (
        <>
          <div className="grid gap-5 xl:grid-cols-2">
            {data.permissions.can_manage_devices && (
              <Card className="border-slate-500 dark:border-slate-400">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-950 text-blue-100 dark:border dark:border-cyan-300">
                      <Fingerprint aria-hidden="true" className="h-5 w-5" />
                    </div>
                    <div>
                      <h5 className="text-lg font-black">
                        Quick add an API source
                      </h5>
                      <p
                        id={deviceHintId}
                        className="mt-1 text-sm text-slate-600 dark:text-slate-300"
                      >
                        BioStation 2 uses the BioStar 2 server API. Generic
                        sources receive signed pushes through the local
                        connector endpoint. Use guided Device Onboarding for
                      </p>
                    </div>
                  </div>
                  <form
                    className="mt-5 grid gap-4 sm:grid-cols-2"
                    onSubmit={(event: FormEvent) => {
                      event.preventDefault();
                      createDevice.mutate();
                    }}
                    aria-describedby={deviceHintId}
                  >
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="connector-adapter">Device type</Label>
                      <select
                        id="connector-adapter"
                        className={selectClass}
                        value={deviceForm.adapter_type}
                        aria-describedby={deviceTypeHintId}
                        onChange={(event) => {
                          const adapter = event.target
                            .value as typeof deviceForm.adapter_type;
                          const catalogEntry = data.adapters.find(
                            (item) => item.value === adapter,
                          );
                          const defaults = deviceTypeDefaults[adapter] ?? {
                            code: adapter.replaceAll("_", "-").toUpperCase(),
                            name: catalogEntry?.label ?? "Attendance device",
                          };
                          setDeviceForm((current) => ({
                            ...current,
                            adapter_type: adapter,
                            name: defaults.name,
                            device_code: defaults.code,
                            base_url:
                              adapter === "suprema_biostar2"
                                ? current.base_url
                                : "",
                            biostar_device_id:
                              adapter === "suprema_biostar2"
                                ? current.biostar_device_id
                                : "",
                          }));
                        }}
                        required
                      >
                        {data.adapters.map((adapter) => (
                          <option key={adapter.value} value={adapter.value}>
                            {adapter.label}
                          </option>
                        ))}
                      </select>
                      <p
                        id={deviceTypeHintId}
                        className="text-xs text-slate-600 dark:text-slate-300"
                      >
                        Choosing Suprema BioStation 2 automatically uses the
                        BioStar 2 API adapter.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="connector-code">Device code</Label>
                      <Input
                        id="connector-code"
                        className={controlClass}
                        value={deviceForm.device_code}
                        onChange={(event) =>
                          setDeviceForm((current) => ({
                            ...current,
                            device_code: event.target.value,
                          }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="connector-name">Device name</Label>
                      <Input
                        id="connector-name"
                        className={controlClass}
                        value={deviceForm.name}
                        onChange={(event) =>
                          setDeviceForm((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="connector-timezone">
                        Device timezone
                      </Label>
                      <Input
                        id="connector-timezone"
                        className={controlClass}
                        value={deviceForm.timezone}
                        onChange={(event) =>
                          setDeviceForm((current) => ({
                            ...current,
                            timezone: event.target.value,
                          }))
                        }
                        required
                      />
                    </div>
                    {deviceForm.adapter_type === "suprema_biostar2" && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="biostar-server">
                            BioStar 2 server URL
                          </Label>
                          <Input
                            id="biostar-server"
                            type="url"
                            className={controlClass}
                            value={deviceForm.base_url}
                            onChange={(event) =>
                              setDeviceForm((current) => ({
                                ...current,
                                base_url: event.target.value,
                              }))
                            }
                            placeholder="https://biostar.example.internal"
                          />
                          <p className="text-xs text-slate-600 dark:text-slate-300">
                            Leave this empty to save the device as configuration
                            required, then add the real URL with its encrypted
                            credential.
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="biostar-device-id">
                            BioStar device ID
                          </Label>
                          <Input
                            id="biostar-device-id"
                            className={controlClass}
                            value={deviceForm.biostar_device_id}
                            onChange={(event) =>
                              setDeviceForm((current) => ({
                                ...current,
                                biostar_device_id: event.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="biostar-tls">
                            TLS certificate verification
                          </Label>
                          <select
                            id="biostar-tls"
                            className={selectClass}
                            value={deviceForm.verify_tls}
                            onChange={(event) =>
                              setDeviceForm((current) => ({
                                ...current,
                                verify_tls: event.target.value,
                              }))
                            }
                          >
                            <option value="true">Required</option>
                            <option value="false">
                              Disabled for isolated test LAN
                            </option>
                          </select>
                        </div>
                      </>
                    )}
                    <Button
                      type="submit"
                      disabled={createDevice.isPending}
                      className="min-h-11 bg-blue-800 text-white hover:bg-blue-950 focus-visible:ring-2 focus-visible:ring-blue-800 dark:bg-cyan-200 dark:text-slate-950 dark:hover:bg-cyan-100 dark:focus-visible:ring-cyan-200 sm:col-span-2"
                    >
                      <DatabaseZap
                        aria-hidden="true"
                        className="mr-2 h-4 w-4"
                      />
                      {createDevice.isPending
                        ? "Adding device…"
                        : "Add device source"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {data.permissions.can_manage_credentials && (
              <Card className="border-slate-500 dark:border-slate-400">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-teal-900 text-teal-100 dark:border dark:border-teal-200">
                      <ShieldCheck aria-hidden="true" className="h-5 w-5" />
                    </div>
                    <div>
                      <h5 className="text-lg font-black">
                        Source authentication
                      </h5>
                      <p
                        id={credentialHintId}
                        className="mt-1 text-sm text-slate-600 dark:text-slate-300"
                      >
                        BioStar usernames and passwords are encrypted. Inbound
                        connector secrets are generated and displayed once.
                      </p>
                    </div>
                  </div>
                  <form
                    className="mt-5 grid gap-4"
                    onSubmit={(event: FormEvent) => {
                      event.preventDefault();
                      rotateCredential.mutate();
                    }}
                    aria-describedby={credentialHintId}
                  >
                    <div className="space-y-2">
                      <Label htmlFor="credential-device">Device</Label>
                      <select
                        id="credential-device"
                        className={selectClass}
                        value={credentialForm.device_code}
                        onChange={(event) => {
                          const deviceCode = event.target.value;
                          setBioStarDiscovery(null);
                          setMappingForm((current) => ({
                            ...current,
                            device_code: deviceCode,
                            external_employee_identifier: "",
                          }));
                          setCredentialForm((current) => {
                            const selected = data.devices.find(
                              (device) => device.device_code === deviceCode,
                            );
                            return {
                              ...current,
                              device_code: deviceCode,
                              base_url: selected?.configuration?.base_url ?? "",
                              biostar_device_id:
                                selected?.configuration?.biostar_device_id ??
                                "",
                              verify_tls:
                                selected?.configuration?.verify_tls === false
                                  ? "false"
                                  : "true",
                              tna_clock_in:
                                Object.entries(
                                  selected?.configuration?.tna_key_map ?? {},
                                ).find(
                                  ([, eventType]) => eventType === "clock_in",
                                )?.[0] ?? "1",
                              tna_clock_out:
                                Object.entries(
                                  selected?.configuration?.tna_key_map ?? {},
                                ).find(
                                  ([, eventType]) => eventType === "clock_out",
                                )?.[0] ?? "2",
                              tna_break_start:
                                Object.entries(
                                  selected?.configuration?.tna_key_map ?? {},
                                ).find(
                                  ([, eventType]) =>
                                    eventType === "break_start",
                                )?.[0] ?? "3",
                              tna_break_end:
                                Object.entries(
                                  selected?.configuration?.tna_key_map ?? {},
                                ).find(
                                  ([, eventType]) => eventType === "break_end",
                                )?.[0] ?? "4",
                              principal: "",
                              secret: "",
                            };
                          });
                        }}
                        required
                      >
                        <option value="">Select a device</option>
                        {data.devices.map((device) => (
                          <option
                            key={device.device_code}
                            value={device.device_code}
                          >
                            {deviceLabel(device)}
                          </option>
                        ))}
                      </select>
                    </div>
                    {isBioStarCredential && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="biostar-credential-server">
                            BioStar 2 server URL
                          </Label>
                          <Input
                            id="biostar-credential-server"
                            type="url"
                            className={controlClass}
                            value={credentialForm.base_url}
                            onChange={(event) =>
                              setCredentialForm((current) => ({
                                ...current,
                                base_url: event.target.value,
                              }))
                            }
                            placeholder="https://biostar.example.internal"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="biostar-credential-device-id">
                            BioStar device ID
                          </Label>
                          <Input
                            id="biostar-credential-device-id"
                            className={controlClass}
                            value={credentialForm.biostar_device_id}
                            onChange={(event) =>
                              setCredentialForm((current) => ({
                                ...current,
                                biostar_device_id: event.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="biostar-credential-tls">
                            TLS certificate verification
                          </Label>
                          <select
                            id="biostar-credential-tls"
                            className={selectClass}
                            value={credentialForm.verify_tls}
                            onChange={(event) =>
                              setCredentialForm((current) => ({
                                ...current,
                                verify_tls: event.target.value,
                              }))
                            }
                          >
                            <option value="true">Required</option>
                            <option value="false">
                              Disabled for isolated test LAN
                            </option>
                          </select>
                        </div>
                        <fieldset className="space-y-3 rounded-xl border border-slate-400 p-4 dark:border-slate-500">
                          <legend className="px-1 text-sm font-semibold text-slate-950 dark:text-slate-50">
                            BioStar T&amp;A key mapping
                          </legend>
                          <p className="text-sm text-slate-700 dark:text-slate-200">
                            Match the numeric or text keys configured in BioStar
                            2. The defaults are 1–4 and each key must be unique.
                          </p>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor="biostar-tna-clock-in">
                                Clock in key
                              </Label>
                              <Input
                                id="biostar-tna-clock-in"
                                className={controlClass}
                                value={credentialForm.tna_clock_in}
                                onChange={(event) =>
                                  setCredentialForm((current) => ({
                                    ...current,
                                    tna_clock_in: event.target.value,
                                  }))
                                }
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="biostar-tna-clock-out">
                                Clock out key
                              </Label>
                              <Input
                                id="biostar-tna-clock-out"
                                className={controlClass}
                                value={credentialForm.tna_clock_out}
                                onChange={(event) =>
                                  setCredentialForm((current) => ({
                                    ...current,
                                    tna_clock_out: event.target.value,
                                  }))
                                }
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="biostar-tna-break-start">
                                Break start key
                              </Label>
                              <Input
                                id="biostar-tna-break-start"
                                className={controlClass}
                                value={credentialForm.tna_break_start}
                                onChange={(event) =>
                                  setCredentialForm((current) => ({
                                    ...current,
                                    tna_break_start: event.target.value,
                                  }))
                                }
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="biostar-tna-break-end">
                                Break end key
                              </Label>
                              <Input
                                id="biostar-tna-break-end"
                                className={controlClass}
                                value={credentialForm.tna_break_end}
                                onChange={(event) =>
                                  setCredentialForm((current) => ({
                                    ...current,
                                    tna_break_end: event.target.value,
                                  }))
                                }
                                required
                              />
                            </div>
                          </div>
                          {!hasValidBioStarTnaKeys && (
                            <p
                              role="alert"
                              className="text-sm font-semibold text-red-800 dark:text-red-200"
                            >
                              Enter four different, non-empty T&amp;A keys.
                            </p>
                          )}
                        </fieldset>
                        <div className="space-y-2">
                          <Label htmlFor="biostar-login">
                            BioStar 2 login ID
                          </Label>
                          <Input
                            id="biostar-login"
                            autoComplete="username"
                            className={controlClass}
                            value={credentialForm.principal}
                            onChange={(event) =>
                              setCredentialForm((current) => ({
                                ...current,
                                principal: event.target.value,
                              }))
                            }
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="biostar-password">
                            BioStar 2 password
                          </Label>
                          <Input
                            id="biostar-password"
                            type="password"
                            autoComplete="new-password"
                            className={controlClass}
                            value={credentialForm.secret}
                            onChange={(event) =>
                              setCredentialForm((current) => ({
                                ...current,
                                secret: event.target.value,
                              }))
                            }
                            required
                          />
                        </div>
                      </>
                    )}
                    <Button
                      type="submit"
                      variant="outline"
                      disabled={
                        rotateCredential.isPending ||
                        !credentialForm.device_code ||
                        (isBioStarCredential && !hasValidBioStarTnaKeys)
                      }
                      className="min-h-11 border-teal-800 text-teal-950 hover:bg-teal-50 focus-visible:ring-2 focus-visible:ring-teal-800 dark:border-teal-200 dark:text-teal-100 dark:hover:bg-teal-950 dark:focus-visible:ring-teal-200"
                    >
                      <KeyRound aria-hidden="true" className="mr-2 h-4 w-4" />
                      {isBioStarCredential
                        ? "Save encrypted BioStar credential"
                        : "Rotate connector secret"}
                    </Button>
                  </form>
                  {isBioStarCredential && (
                    <div className="mt-5 rounded-xl border border-slate-500 bg-slate-50 p-4 dark:border-slate-400 dark:bg-slate-950">
                      <p className="font-black text-slate-950 dark:text-slate-50">
                        BioStar directory
                      </p>
                      <p
                        id={discoveryHintId}
                        className="mt-1 text-sm text-slate-700 dark:text-slate-200"
                      >
                        Save the encrypted credential, then discover the
                        BioStation devices and user IDs available through this
                        BioStar 2 server.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        aria-describedby={discoveryHintId}
                        className="mt-4 min-h-11 border-teal-800 text-teal-950 hover:bg-white focus-visible:ring-2 focus-visible:ring-teal-800 dark:border-teal-200 dark:text-teal-100 dark:hover:bg-slate-900 dark:focus-visible:ring-teal-200"
                        disabled={
                          !hasActiveBioStarCredential ||
                          discoverDevice.isPending
                        }
                        onClick={() =>
                          discoverDevice.mutate(credentialForm.device_code)
                        }
                      >
                        <RefreshCw
                          aria-hidden="true"
                          className={`mr-2 h-4 w-4 ${
                            discoverDevice.isPending ? "animate-spin" : ""
                          }`}
                        />
                        {discoverDevice.isPending
                          ? "Discovering BioStar…"
                          : "Discover BioStar devices and users"}
                      </Button>
                      {!hasActiveBioStarCredential && (
                        <p className="mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                          Save a BioStar login ID and password first.
                        </p>
                      )}
                      {bioStarDiscovery?.device_code ===
                        credentialForm.device_code && (
                        <div className="mt-4 space-y-4">
                          <p
                            role="status"
                            className="rounded-lg border border-slate-500 bg-white p-3 text-sm font-semibold text-slate-800 dark:border-slate-400 dark:bg-slate-900 dark:text-slate-100"
                          >
                            BioStar returned {bioStarDiscovery.device_count}{" "}
                            device(s) and {bioStarDiscovery.user_count} user(s)
                            at {formatDateTime(bioStarDiscovery.fetched_at)}.
                          </p>
                          <div className="space-y-2">
                            <Label htmlFor="biostar-discovered-device">
                              BioStar device
                            </Label>
                            <select
                              id="biostar-discovered-device"
                              className={selectClass}
                              aria-describedby={discoveredDeviceHintId}
                              value={credentialForm.biostar_device_id}
                              onChange={(event) =>
                                setCredentialForm((current) => ({
                                  ...current,
                                  biostar_device_id: event.target.value,
                                }))
                              }
                            >
                              <option value="">Select a BioStar device</option>
                              {bioStarDiscovery.devices.map((device) => (
                                <option key={device.id} value={device.id}>
                                  {device.name}
                                  {device.model ? ` · ${device.model}` : ""}
                                  {` · ${device.id}`}
                                </option>
                              ))}
                            </select>
                            <p
                              id={discoveredDeviceHintId}
                              className="text-xs text-slate-600 dark:text-slate-300"
                            >
                              Event synchronization will be limited to this
                              device ID.
                            </p>
                          </div>
                          <Button
                            type="button"
                            className="min-h-11 bg-teal-900 text-white hover:bg-teal-950 focus-visible:ring-2 focus-visible:ring-teal-900 dark:bg-teal-200 dark:text-teal-950 dark:hover:bg-teal-100 dark:focus-visible:ring-teal-200"
                            disabled={
                              !credentialForm.biostar_device_id ||
                              updateDeviceConfiguration.isPending
                            }
                            onClick={() => updateDeviceConfiguration.mutate()}
                          >
                            <CheckCircle2
                              aria-hidden="true"
                              className="mr-2 h-4 w-4"
                            />
                            Use selected BioStar device
                          </Button>
                          <p className="text-xs text-slate-600 dark:text-slate-300">
                            Hive reads directory identifiers only. Fingerprint
                            templates, face templates, and profile photos are
                            not imported.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {data.permissions.can_map_employees && (
              <Card className="border-slate-500 dark:border-slate-400">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-900 text-amber-100 dark:border dark:border-amber-200">
                      <Link2 aria-hidden="true" className="h-5 w-5" />
                    </div>
                    <div>
                      <h5 className="text-lg font-black">
                        Map a device identity
                      </h5>
                      <p
                        id={mappingHintId}
                        className="mt-1 text-sm text-slate-600 dark:text-slate-300"
                      >
                        Match a terminal user ID or connector employee ID to one
                        registered ERP employee.
                      </p>
                    </div>
                  </div>
                  <form
                    className="mt-5 grid gap-4"
                    onSubmit={(event: FormEvent) => {
                      event.preventDefault();
                      mapEmployee.mutate();
                    }}
                    aria-describedby={mappingHintId}
                  >
                    <div className="space-y-2">
                      <Label htmlFor="mapping-device">Device</Label>
                      <select
                        id="mapping-device"
                        className={selectClass}
                        value={mappingForm.device_code}
                        onChange={(event) =>
                          setMappingForm((current) => ({
                            ...current,
                            device_code: event.target.value,
                            external_employee_identifier: "",
                          }))
                        }
                        required
                      >
                        <option value="">Select a device</option>
                        {data.devices.map((device) => (
                          <option
                            key={device.device_code}
                            value={device.device_code}
                          >
                            {deviceLabel(device)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mapping-employee">ERP employee</Label>
                      <select
                        id="mapping-employee"
                        className={selectClass}
                        value={mappingForm.employee_id}
                        onChange={(event) =>
                          setMappingForm((current) => ({
                            ...current,
                            employee_id: event.target.value,
                          }))
                        }
                        required
                      >
                        <option value="">Select an employee</option>
                        {employees.map((employee) => (
                          <option key={employee.id} value={employee.id}>
                            {employee.primary_name} · {employee.employee_number}
                          </option>
                        ))}
                      </select>
                    </div>
                    {discoveredUsers.length ? (
                      <div className="space-y-2">
                        <Label htmlFor="biostar-user">BioStar user</Label>
                        <select
                          id="biostar-user"
                          className={selectClass}
                          aria-describedby={discoveredUserHintId}
                          value={mappingForm.external_employee_identifier}
                          onChange={(event) =>
                            setMappingForm((current) => ({
                              ...current,
                              external_employee_identifier: event.target.value,
                            }))
                          }
                          required
                        >
                          <option value="">Select a BioStar user</option>
                          {discoveredUsers.map((user) => (
                            <option
                              key={user.user_id}
                              value={user.user_id}
                              disabled={user.disabled}
                            >
                              {user.name} · {user.user_id}
                              {user.user_group_name
                                ? ` · ${user.user_group_name}`
                                : ""}
                              {user.disabled ? " · disabled" : ""}
                            </option>
                          ))}
                        </select>
                        <p
                          id={discoveredUserHintId}
                          className="text-xs text-slate-600 dark:text-slate-300"
                        >
                          This creates an identifier mapping; no biometric data
                          is copied into Hive.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label htmlFor="external-employee-id">
                          External employee identifier
                        </Label>
                        <Input
                          id="external-employee-id"
                          className={controlClass}
                          value={mappingForm.external_employee_identifier}
                          onChange={(event) =>
                            setMappingForm((current) => ({
                              ...current,
                              external_employee_identifier: event.target.value,
                            }))
                          }
                          required
                        />
                      </div>
                    )}
                    <Button
                      type="submit"
                      variant="outline"
                      disabled={mapEmployee.isPending}
                      className="min-h-11 border-amber-800 text-amber-950 hover:bg-amber-50 focus-visible:ring-2 focus-visible:ring-amber-800 dark:border-amber-200 dark:text-amber-100 dark:hover:bg-amber-950 dark:focus-visible:ring-amber-200"
                    >
                      <Link2 aria-hidden="true" className="mr-2 h-4 w-4" />
                      Save employee mapping
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {data.permissions.can_import_events && (
              <Card className="border-slate-500 dark:border-slate-400">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-950 text-violet-100 dark:border dark:border-violet-200">
                      <FileUp aria-hidden="true" className="h-5 w-5" />
                    </div>
                    <div>
                      <h5 className="text-lg font-black">
                        Import offline events
                      </h5>
                      <p
                        id={importHintId}
                        className="mt-1 text-sm text-slate-600 dark:text-slate-300"
                      >
                        CSV, TXT, XLSX, or XLS up to 10 MB. Required columns:
                        external_employee_identifier, device_event_id,
                        event_type, occurred_at.
                      </p>
                    </div>
                  </div>
                  <form
                    className="mt-5 grid gap-4"
                    onSubmit={(event: FormEvent) => {
                      event.preventDefault();
                      importEvents.mutate();
                    }}
                    aria-describedby={importHintId}
                  >
                    <div className="space-y-2">
                      <Label htmlFor="import-device">Source device</Label>
                      <select
                        id="import-device"
                        className={selectClass}
                        value={importForm.device_id}
                        onChange={(event) =>
                          setImportForm((current) => ({
                            ...current,
                            device_id: event.target.value,
                          }))
                        }
                        required
                      >
                        <option value="">Select a device</option>
                        {data.devices.map((device) => (
                          <option key={device.id} value={device.id}>
                            {deviceLabel(device)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="attendance-import-file">
                        Attendance data file
                      </Label>
                      <Input
                        ref={fileRef}
                        id="attendance-import-file"
                        type="file"
                        accept=".csv,.txt,.xlsx,.xls"
                        className="min-h-11 border-slate-500 file:mr-3 file:border-0 file:bg-transparent file:font-bold focus-visible:ring-2 focus-visible:ring-blue-700 dark:border-slate-400 dark:focus-visible:ring-cyan-300"
                        onChange={(event) =>
                          setImportForm((current) => ({
                            ...current,
                            file: event.target.files?.[0] ?? null,
                          }))
                        }
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      variant="outline"
                      disabled={
                        importEvents.isPending ||
                        !importForm.device_id ||
                        !importForm.file
                      }
                      className="min-h-11 border-violet-800 text-violet-950 hover:bg-violet-50 focus-visible:ring-2 focus-visible:ring-violet-800 dark:border-violet-200 dark:text-violet-100 dark:hover:bg-violet-950 dark:focus-visible:ring-violet-200"
                    >
                      <FileUp aria-hidden="true" className="mr-2 h-4 w-4" />
                      Queue protected import
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>

          <Card className="border-slate-500 dark:border-slate-400">
            <CardContent className="p-0">
              <div className="flex flex-col gap-2 border-b border-slate-500 p-5 dark:border-slate-400">
                <h5 className="text-lg font-black">Connected device health</h5>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Connection tests never expose stored credentials. Vendor API
                  and connector syncs are queued and normalized before they
                  reach daily attendance calculations.
                </p>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableCaption>
                    Attendance device adapters, health, mappings, event counts,
                    and available operations.
                  </TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">Device</TableHead>
                      <TableHead scope="col">Adapter</TableHead>
                      <TableHead scope="col">Health</TableHead>
                      <TableHead scope="col">Mapped employees</TableHead>
                      <TableHead scope="col">Events</TableHead>
                      <TableHead scope="col">Last contact</TableHead>
                      <TableHead scope="col">Operations</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.devices.length ? (
                      data.devices.map((device) => (
                        <TableRow key={device.id}>
                          <TableCell className="min-w-52">
                            <span className="block font-black">
                              {device.name}
                            </span>
                            <span className="text-xs text-slate-600 dark:text-slate-300">
                              {device.device_code}
                            </span>
                          </TableCell>
                          <TableCell>
                            {data.adapters.find(
                              (adapter) =>
                                adapter.value === device.adapter_type,
                            )?.label ?? device.adapter_type}
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-2 font-bold capitalize">
                              {device.health_status === "healthy" ? (
                                <CheckCircle2
                                  aria-hidden="true"
                                  className="h-4 w-4 text-teal-800 dark:text-teal-200"
                                />
                              ) : device.health_status === "unhealthy" ? (
                                <TriangleAlert
                                  aria-hidden="true"
                                  className="h-4 w-4 text-red-800 dark:text-red-200"
                                />
                              ) : (
                                <HeartPulse
                                  aria-hidden="true"
                                  className="h-4 w-4 text-amber-800 dark:text-amber-200"
                                />
                              )}
                              {device.health_status}
                            </span>
                          </TableCell>
                          <TableCell>
                            {device.employee_mappings_count}
                          </TableCell>
                          <TableCell>
                            {device.attendance_events_count}
                          </TableCell>
                          <TableCell>
                            {formatDateTime(device.last_seen_at)}
                          </TableCell>
                          <TableCell>
                            <div className="flex min-w-52 flex-wrap gap-2">
                              {data.permissions.can_manage_devices && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={testDevice.isPending}
                                  onClick={() =>
                                    testDevice.mutate(device.device_code)
                                  }
                                  className="min-h-10 border-slate-700 focus-visible:ring-2 focus-visible:ring-blue-700 dark:border-slate-300 dark:focus-visible:ring-cyan-300"
                                >
                                  Test connection
                                </Button>
                              )}
                              {data.permissions.can_sync_devices &&
                                ["suprema_biostar2", "mock"].includes(
                                  device.adapter_type,
                                ) && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    disabled={syncDevice.isPending}
                                    onClick={() =>
                                      syncDevice.mutate(device.device_code)
                                    }
                                    className="min-h-10 bg-blue-800 text-white hover:bg-blue-950 focus-visible:ring-2 focus-visible:ring-blue-800 dark:bg-cyan-200 dark:text-slate-950 dark:hover:bg-cyan-100 dark:focus-visible:ring-cyan-200"
                                  >
                                    Queue event sync
                                  </Button>
                                )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="py-10 text-center text-slate-600 dark:text-slate-300"
                        >
                          No device sources are configured yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-500 dark:border-slate-400">
            <CardContent className="p-0">
              <div className="border-b border-slate-500 p-5 dark:border-slate-400">
                <h5 className="text-lg font-black">
                  Import and synchronization activity
                </h5>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Recent source jobs show accepted, duplicate, and rejected
                  counts without displaying raw credentials or biometric data.
                </p>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableCaption>
                    Recent attendance connector, import, and polling jobs.
                  </TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">Created</TableHead>
                      <TableHead scope="col">Device</TableHead>
                      <TableHead scope="col">Source</TableHead>
                      <TableHead scope="col">Status</TableHead>
                      <TableHead scope="col">Received</TableHead>
                      <TableHead scope="col">Accepted</TableHead>
                      <TableHead scope="col">Duplicates</TableHead>
                      <TableHead scope="col">Rejected</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.sync_jobs.length ? (
                      data.sync_jobs.map((job) => (
                        <TableRow key={job.job_uuid}>
                          <TableCell>
                            {formatDateTime(job.created_at)}
                          </TableCell>
                          <TableCell className="font-semibold">
                            {job.device?.name ?? "Removed device"}
                          </TableCell>
                          <TableCell className="capitalize">
                            {job.direction.replaceAll("_", " ")}
                          </TableCell>
                          <TableCell className="font-bold capitalize">
                            {job.status}
                          </TableCell>
                          <TableCell>{job.received_count}</TableCell>
                          <TableCell>{job.accepted_count}</TableCell>
                          <TableCell>{job.duplicate_count}</TableCell>
                          <TableCell>{job.rejected_count}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="py-10 text-center text-slate-600 dark:text-slate-300"
                        >
                          No connector or import jobs have run yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </section>
  );
}
