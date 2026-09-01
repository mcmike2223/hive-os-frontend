"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Cable,
  CheckCircle2,
  Cpu,
  KeyRound,
  Layers,
  Network,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getWorkspaceScopeKey } from "@/lib/runtime-context";
import {
  AttendanceDevice,
  AttendanceDeviceDiscovery,
  AttendanceDeviceWorkspace,
  Employee,
  Paginated,
} from "@/modules/humanresources/api";
import {
  attendanceFetch,
  formatEmployeeNumber,
} from "@/modules/attendance/api";

const controlClass =
  "h-11 border-border bg-background/70 focus-visible:ring-2 focus-visible:ring-ring";
const selectClass =
  "h-11 w-full rounded-md border border-border bg-background/70 px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

const deviceTypeDefaults: Record<
  AttendanceDevice["adapter_type"],
  { code: string; name: string }
> = {
  suprema_biostar2: {
    code: "SUPREMA-BIOSTATION-2",
    name: "Suprema BioStation 2",
  },
  hikvision_isapi: {
    code: "HIKVISION-TERMINAL",
    name: "Hikvision attendance terminal",
  },
  suprema_device_sdk: {
    code: "SUPREMA-DIRECT",
    name: "Suprema direct terminal",
  },
  generic_webhook: {
    code: "ATTENDANCE-WEBHOOK",
    name: "Generic attendance webhook",
  },
  local_connector: {
    code: "ATTENDANCE-CONNECTOR",
    name: "Local attendance connector",
  },
  zkteco_edge: {
    code: "ZKTECO-TERMINAL",
    name: "ZKTeco attendance terminal",
  },
  anviz_edge: {
    code: "ANVIZ-TERMINAL",
    name: "Anviz attendance terminal",
  },
  mock: {
    code: "ATTENDANCE-MOCK",
    name: "Mock attendance device",
  },
};

const STEPS = [
  { id: 1, label: "Device Type", icon: Cpu },
  { id: 2, label: "Connection", icon: Network },
  { id: 3, label: "Authentication", icon: KeyRound },
  { id: 4, label: "Test Connection", icon: Cable },
  { id: 5, label: "Organization Scope", icon: Building2 },
  { id: 6, label: "Employee Mapping", icon: Users },
  { id: 7, label: "Initial Sync", icon: RefreshCw },
  { id: 8, label: "Review", icon: Layers },
  { id: 9, label: "Complete", icon: CheckCircle2 },
];

export function DeviceOnboardingWorkspace() {
  const scope = getWorkspaceScopeKey();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);

  // Form state
  const [adapterType, setAdapterType] =
    useState<AttendanceDevice["adapter_type"]>("suprema_biostar2");
  const [deviceCode, setDeviceCode] = useState(
    deviceTypeDefaults.suprema_biostar2.code,
  );
  const [name, setName] = useState(deviceTypeDefaults.suprema_biostar2.name);
  const [timezone, setTimezone] = useState("Africa/Addis_Ababa");
  const [baseUrl, setBaseUrl] = useState("");
  const [biostarDeviceId, setBiostarDeviceId] = useState("");
  const [deviceIp, setDeviceIp] = useState("");
  const [devicePort, setDevicePort] = useState("");
  const [verifyTls, setVerifyTls] = useState("true");
  const [principal, setPrincipal] = useState("");
  const [secret, setSecret] = useState("");

  const isBioStar = adapterType === "suprema_biostar2";
  const isHikvision = adapterType === "hikvision_isapi";
  const isDirectAdapter = isBioStar || isHikvision;
  const isEdgeAdapter = [
    "suprema_device_sdk",
    "zkteco_edge",
    "anviz_edge",
  ].includes(adapterType);
  const canPoll = isDirectAdapter || adapterType === "mock";

  // Result state
  const [createdDevice, setCreatedDevice] = useState<AttendanceDevice | null>(
    null,
  );
  const [credentialSecret, setCredentialSecret] = useState<{
    keyId: string;
    secret: string;
  } | null>(null);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message?: string;
  } | null>(null);
  const [syncQueued, setSyncQueued] = useState(false);
  const [discovery, setDiscovery] = useState<AttendanceDeviceDiscovery | null>(
    null,
  );

  // Mapping state
  const [mappingEmployeeId, setMappingEmployeeId] = useState("");
  const [mappingExternalId, setMappingExternalId] = useState("");

  const workspace = useQuery({
    queryKey: ["hr-attendance-devices-onboarding", scope],
    queryFn: () =>
      attendanceFetch<{ data: AttendanceDeviceWorkspace }>(
        "/attendance/devices/workspace",
      ),
    refetchInterval: syncQueued ? 3_000 : false,
  });

  const employeesQuery = useQuery({
    queryKey: ["hr-attendance-employees-onboarding", scope],
    queryFn: () =>
      attendanceFetch<Paginated<Employee>>("/employees?per_page=100"),
  });

  const employees = employeesQuery.data?.data ?? [];
  const latestSyncJob = workspace.data?.data.sync_jobs.find(
    (job) => job.attendance_device_id === createdDevice?.id,
  );

  const createDeviceMutation = useMutation({
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
          device_code: deviceCode,
          name,
          adapter_type: adapterType,
          timezone,
          manufacturer:
            adapterType === "hikvision_isapi"
              ? "Hikvision"
              : adapterType.startsWith("suprema")
                ? "Suprema"
                : adapterType === "zkteco_edge"
                  ? "ZKTeco"
                  : adapterType === "anviz_edge"
                    ? "Anviz"
                    : null,
          model: isBioStar ? "BioStation 2" : null,
          configuration: isDirectAdapter
            ? {
                base_url: baseUrl,
                biostar_device_id: isBioStar
                  ? biostarDeviceId || undefined
                  : undefined,
                verify_tls: verifyTls === "true",
                allow_http:
                  verifyTls === "false" && baseUrl.startsWith("http://"),
                event_limit: 100,
                lookback_days: isHikvision ? 2 : undefined,
                tna_key_map: {
                  "1": "clock_in",
                  "2": "clock_out",
                  "3": "break_start",
                  "4": "break_end",
                },
              }
            : isEdgeAdapter
              ? {
                  device_ip: deviceIp || undefined,
                  device_port: devicePort ? Number(devicePort) : undefined,
                  driver:
                    adapterType === "suprema_device_sdk"
                      ? "suprema_device_sdk"
                      : adapterType === "zkteco_edge"
                        ? "zkteco"
                        : "anviz",
                }
              : {},
        }),
      }),
    onSuccess: (response) => {
      setCreatedDevice(response.data);
      if (
        response.meta.display_once &&
        response.meta.key_id &&
        response.meta.credential_secret
      ) {
        setCredentialSecret({
          keyId: response.meta.key_id,
          secret: response.meta.credential_secret,
        });
      }
      toast.success(`Device ${response.data.name} created successfully.`);
      void queryClient.invalidateQueries({
        queryKey: ["hr-attendance-devices", scope],
      });
      void queryClient.invalidateQueries({
        queryKey: ["hr-attendance-devices-onboarding", scope],
      });
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error ? err.message : "Failed to register device.";
      toast.error(msg);
    },
  });

  const rotateCredentialMutation = useMutation({
    mutationFn: () => {
      if (!createdDevice && !deviceCode)
        throw new Error("No device code available.");
      const code = createdDevice?.device_code || deviceCode;
      return attendanceFetch<{
        data: unknown;
        meta: {
          key_id: string;
          credential_secret: string | null;
          display_once: boolean;
        };
      }>(`/attendance/devices/${encodeURIComponent(code)}/credentials/rotate`, {
        method: "POST",
        body: JSON.stringify({
          credential_type: isBioStar
            ? "biostar2_api"
            : isHikvision
              ? "hikvision_isapi"
              : "connector_hmac",
          principal: isDirectAdapter ? principal : null,
          secret: isDirectAdapter ? secret : null,
          configuration: isDirectAdapter
            ? {
                base_url: baseUrl,
                biostar_device_id: isBioStar
                  ? biostarDeviceId || undefined
                  : undefined,
                verify_tls: verifyTls === "true",
                allow_http:
                  verifyTls === "false" && baseUrl.startsWith("http://"),
                event_limit: 100,
                lookback_days: isHikvision ? 2 : undefined,
                tna_key_map: {
                  "1": "clock_in",
                  "2": "clock_out",
                },
              }
            : null,
        }),
      });
    },
    onSuccess: (response) => {
      if (response.meta.display_once && response.meta.credential_secret) {
        setCredentialSecret({
          keyId: response.meta.key_id,
          secret: response.meta.credential_secret,
        });
      }
      toast.success("Device credential authenticated.");
      setSecret("");
      void workspace.refetch();
    },
    onError: (err: unknown) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to set credential.",
      );
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: () => {
      const code = createdDevice?.device_code || deviceCode;
      return attendanceFetch<{ data: { ok: boolean; api?: string } }>(
        `/attendance/devices/${encodeURIComponent(code)}/test`,
        { method: "POST" },
      );
    },
    onSuccess: (res) => {
      setTestResult({
        ok: true,
        message: res.data?.api
          ? `Connection verified: ${res.data.api}`
          : "Device connection test passed successfully.",
      });
      toast.success("Connection test passed!");
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Connection failed.";
      setTestResult({ ok: false, message: msg });
      toast.error("Connection test failed.");
    },
  });

  const mapEmployeeMutation = useMutation({
    mutationFn: () => {
      const code = createdDevice?.device_code || deviceCode;
      return attendanceFetch(
        `/attendance/devices/${encodeURIComponent(code)}/employee-mappings`,
        {
          method: "POST",
          body: JSON.stringify({
            employee_id: Number(mappingEmployeeId),
            external_employee_identifier: mappingExternalId,
          }),
        },
      );
    },
    onSuccess: () => {
      toast.success("Employee mapped to device identity.");
      setMappingEmployeeId("");
      setMappingExternalId("");
    },
    onError: (err: unknown) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to map employee.",
      );
    },
  });

  const discoverMutation = useMutation({
    mutationFn: () => {
      const code = createdDevice?.device_code || deviceCode;
      return attendanceFetch<{ data: AttendanceDeviceDiscovery }>(
        `/attendance/devices/${encodeURIComponent(code)}/discover`,
        {
          method: "POST",
          body: JSON.stringify({ user_limit: 200 }),
        },
      );
    },
    onSuccess: (response) => {
      setDiscovery(response.data);
      toast.success(
        `Found ${response.data.user_count} device user${response.data.user_count === 1 ? "" : "s"}.`,
      );
    },
    onError: (err: unknown) => {
      toast.error(
        err instanceof Error ? err.message : "Could not read device users.",
      );
    },
  });

  const syncMutation = useMutation({
    mutationFn: () => {
      const code = createdDevice?.device_code || deviceCode;
      return attendanceFetch(
        `/attendance/devices/${encodeURIComponent(code)}/sync`,
        {
          method: "POST",
          body: JSON.stringify({ limit: 100 }),
        },
      );
    },
    onSuccess: () => {
      setSyncQueued(true);
      toast.success("Initial device synchronization queued.");
      void queryClient.invalidateQueries({
        queryKey: ["hr-attendance-devices-onboarding", scope],
      });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to queue sync.");
    },
  });

  const handleAdapterChange = (type: typeof adapterType) => {
    setAdapterType(type);
    const defaults = deviceTypeDefaults[type];
    setName(defaults.name);
    setDeviceCode(defaults.code);
  };

  const nextStep = () => {
    if (currentStep === 2 && !createdDevice) {
      createDeviceMutation.mutate(undefined, {
        onSuccess: () => setCurrentStep(3),
      });
      return;
    }
    if (currentStep === 3 && (principal || secret)) {
      rotateCredentialMutation.mutate(undefined, {
        onSuccess: () => setCurrentStep(4),
      });
      return;
    }
    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length));
  };

  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 1));

  return (
    <div className="space-y-6">
      {/* Header */}
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
              Add an attendance device
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              Follow one guided path to register, authenticate, test, map, and
              synchronize a terminal in the active tenant.
            </p>
          </div>
          <Button asChild variant="outline" className="bg-background/70">
            <Link href="/dashboard/attendance/devices">View All Devices</Link>
          </Button>
        </div>

        {/* Step Stepper */}
        <div className="mt-6 overflow-x-auto pb-2">
          <ol className="flex min-w-[700px] items-center justify-between border-t border-border/60 pt-4">
            {STEPS.map((step) => {
              const isActive = currentStep === step.id;
              const isDone = currentStep > step.id;

              return (
                <li key={step.id}>
                  <button
                    type="button"
                    aria-current={isActive ? "step" : undefined}
                    disabled={!isDone && !isActive}
                    onClick={() => setCurrentStep(step.id)}
                    className={`flex min-h-11 flex-col items-center gap-1.5 rounded-md px-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default ${
                      isActive
                        ? "text-primary"
                        : isDone
                          ? "text-emerald-700 dark:text-emerald-300"
                          : "text-muted-foreground"
                    }`}
                  >
                    <span
                      className={`grid h-9 w-9 place-items-center rounded-full border text-xs font-bold transition-all ${
                        isActive
                          ? "border-primary/50 bg-primary/10 text-primary ring-2 ring-primary/30"
                          : isDone
                            ? "border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : "border-border bg-muted text-muted-foreground"
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                      ) : (
                        step.id
                      )}
                    </span>
                    <span className="whitespace-nowrap text-xs font-semibold">
                      {step.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </header>

      <section
        aria-labelledby="database-refresh-protection-title"
        className="rounded-2xl border border-primary/30 bg-primary/10 p-4"
      >
        <div className="flex items-start gap-3">
          <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <h2 id="database-refresh-protection-title" className="font-black text-foreground">
              Database refresh protection
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {workspace.data?.data.recovery.protected
                ? `${workspace.data.data.recovery.device_count} device profile(s) are encrypted in Hive private storage and will be restored by the database seeder.`
                : "Complete authentication once. Hive will encrypt the device profile in private persistent storage so the seeder can restore it after a database refresh."}
            </p>
          </div>
        </div>
      </section>

      {/* Step Content */}
      <Card className="rounded-3xl border-border/60 bg-card/60">
        <CardContent className="p-6">
          {/* STEP 1: DEVICE TYPE */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold">
                  Step 1: Select Device Type
                </h3>
                <p className="text-sm text-muted-foreground">
                  Choose the integration adapter supported by your attendance
                  hardware or software service.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  {
                    id: "hikvision_isapi",
                    title: "Hikvision ISAPI",
                    desc: "Connect directly to a Hikvision terminal for user discovery and attendance polling.",
                    badge: "Direct terminal",
                  },
                  {
                    id: "suprema_biostar2",
                    title: "Suprema BioStar 2",
                    desc: "Use the BioStar 2 Open API for directory discovery and automatic event polling.",
                    badge: "BioStar 2 API",
                  },
                  {
                    id: "suprema_device_sdk",
                    title: "Suprema Device SDK",
                    desc: "Use Hive Edge on the site network to connect directly to Suprema readers.",
                    badge: "Hive Edge",
                  },
                  {
                    id: "zkteco_edge",
                    title: "ZKTeco",
                    desc: "Use Hive Edge to read ZKTeco terminals and forward signed offline-safe events.",
                    badge: "Hive Edge",
                  },
                  {
                    id: "anviz_edge",
                    title: "Anviz",
                    desc: "Use Hive Edge to read Anviz terminals and forward signed offline-safe events.",
                    badge: "Hive Edge",
                  },
                  {
                    id: "generic_webhook",
                    title: "Generic signed webhook",
                    desc: "Receive normalized JSON events from another attendance source.",
                    badge: "Webhook",
                  },
                  {
                    id: "local_connector",
                    title: "Custom local connector",
                    desc: "Connect another LAN reader through the signed Hive Edge contract.",
                    badge: "Hive Edge",
                  },
                  {
                    id: "mock",
                    title: "Mock device",
                    desc: "Generate safe sandbox events for development and acceptance testing.",
                    badge: "Testing",
                  },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={adapterType === item.id}
                    onClick={() =>
                      handleAdapterChange(
                        item.id as AttendanceDevice["adapter_type"],
                      )
                    }
                    className={`min-h-11 rounded-2xl border p-5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      adapterType === item.id
                        ? "border-primary/50 bg-primary/10 ring-1 ring-primary/40"
                        : "border-border/70 bg-background/50 hover:border-primary/40 hover:bg-muted/50"
                    }`}
                  >
                    <span className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-primary">
                        {item.badge}
                      </span>
                      {adapterType === item.id && (
                        <CheckCircle2
                          aria-hidden="true"
                          className="h-5 w-5 text-primary"
                        />
                      )}
                    </span>
                    <span className="mt-2 block text-lg font-bold">
                      {item.title}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      {item.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2: CONNECTION & BASIC DETAILS */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold">
                  Step 2: Connection Settings
                </h3>
                <p className="text-sm text-muted-foreground">
                  Configure identifier codes, names, timezones, and network
                  server endpoint.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="onboard-code">Device Code *</Label>
                  <Input
                    id="onboard-code"
                    value={deviceCode}
                    onChange={(e) => setDeviceCode(e.target.value)}
                    className={controlClass}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="onboard-name">Device Name *</Label>
                  <Input
                    id="onboard-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={controlClass}
                    required
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="onboard-tz">Device Timezone *</Label>
                  <Input
                    id="onboard-tz"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className={controlClass}
                    required
                  />
                </div>

                {isDirectAdapter && (
                  <>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="onboard-url">
                        {isHikvision
                          ? "Hikvision terminal URL"
                          : "BioStar 2 server URL"}
                      </Label>
                      <Input
                        id="onboard-url"
                        type="url"
                        placeholder={
                          isHikvision
                            ? "http://192.168.100.230"
                            : "https://biostar.company.internal"
                        }
                        value={baseUrl}
                        onChange={(e) => setBaseUrl(e.target.value)}
                        className={controlClass}
                      />
                    </div>

                    {isBioStar && (
                      <div className="space-y-2">
                        <Label htmlFor="onboard-biostar-id">
                          BioStar device ID (optional)
                        </Label>
                        <Input
                          id="onboard-biostar-id"
                          value={biostarDeviceId}
                          onChange={(e) => setBiostarDeviceId(e.target.value)}
                          className={controlClass}
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="onboard-tls">TLS verification</Label>
                      <select
                        id="onboard-tls"
                        className={selectClass}
                        value={verifyTls}
                        onChange={(e) => setVerifyTls(e.target.value)}
                      >
                        <option value="true">Required (production)</option>
                        <option value="false">
                          Disabled (isolated LAN only)
                        </option>
                      </select>
                    </div>
                  </>
                )}

                {isEdgeAdapter && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="onboard-device-ip">
                        Terminal IP address
                      </Label>
                      <Input
                        id="onboard-device-ip"
                        inputMode="decimal"
                        placeholder="192.168.1.50"
                        value={deviceIp}
                        onChange={(event) => setDeviceIp(event.target.value)}
                        className={controlClass}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="onboard-device-port">
                        Vendor service port (optional)
                      </Label>
                      <Input
                        id="onboard-device-port"
                        type="number"
                        min={1}
                        max={65535}
                        value={devicePort}
                        onChange={(event) => setDevicePort(event.target.value)}
                        className={controlClass}
                      />
                    </div>
                    <p className="sm:col-span-2 text-sm text-muted-foreground">
                      Hive Edge runs on this site network, discovers the
                      terminal, buffers outages, and sends signed normalized
                      events to Hive.
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: AUTHENTICATION */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold">
                  Step 3: Device Authentication
                </h3>
                <p className="text-sm text-muted-foreground">
                  Configure API credentials or inspect the generated HMAC
                  signing secret.
                </p>
              </div>

              {isDirectAdapter ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="onboard-principal">
                      {isHikvision
                        ? "Device user name"
                        : "BioStar API principal"}
                    </Label>
                    <Input
                      id="onboard-principal"
                      value={principal}
                      onChange={(e) => setPrincipal(e.target.value)}
                      placeholder={isHikvision ? "admin" : "api-admin"}
                      className={controlClass}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="onboard-secret">
                      {isHikvision ? "Device password" : "BioStar password"}
                    </Label>
                    <Input
                      id="onboard-secret"
                      type="password"
                      value={secret}
                      onChange={(e) => setSecret(e.target.value)}
                      className={controlClass}
                    />
                  </div>
                  <p className="sm:col-span-2 text-sm leading-6 text-muted-foreground">
                    The password is encrypted in the database and in Hive's
                    private recovery vault. It is never returned by this API or
                    written to source control.
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-amber-600/30 bg-amber-500/10 p-4">
                  <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-200">
                    <KeyRound className="h-5 w-5" />
                    <span>Inbound Webhook HMAC Secret Issued</span>
                  </div>
                  <p className="mt-2 text-xs text-amber-950 dark:text-amber-100">
                    Use the generated device key and HMAC secret to sign webhook
                    request bodies:
                  </p>
                  {credentialSecret && (
                    <dl className="mt-3 grid gap-2 font-mono text-xs">
                      <div>
                        <dt className="text-muted-foreground">Device Key:</dt>
                        <dd className="break-all font-bold text-foreground">
                          {credentialSecret.keyId}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">HMAC Secret:</dt>
                        <dd className="break-all font-bold text-foreground">
                          {credentialSecret.secret}
                        </dd>
                      </div>
                    </dl>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 4: TEST CONNECTION */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold">Step 4: Test Connection</h3>
                <p className="text-sm text-muted-foreground">
                  Verify network reachability and response from the attendance
                  terminal backend.
                </p>
              </div>

              <div className="rounded-2xl border border-border/60 bg-muted/35 p-6 text-center">
                <Button
                  onClick={() => testConnectionMutation.mutate()}
                  disabled={testConnectionMutation.isPending}
                  className="min-h-11 font-bold"
                >
                  <Cable
                    className={`mr-2 h-4 w-4 ${testConnectionMutation.isPending ? "animate-spin" : ""}`}
                  />
                  {testConnectionMutation.isPending
                    ? "Testing Connection…"
                    : "Run Connection Test"}
                </Button>

                {testResult && (
                  <div
                    className={`mt-4 rounded-xl border p-4 text-sm font-semibold ${
                      testResult.ok
                        ? "border-emerald-600/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
                        : "border-rose-600/30 bg-rose-500/10 text-rose-900 dark:text-rose-100"
                    }`}
                  >
                    {testResult.message}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 5: ORGANIZATION SCOPE */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold">
                  Step 5: Organization Scope
                </h3>
                <p className="text-sm text-muted-foreground">
                  Confirm the tenant boundary that owns this device and its
                  attendance data.
                </p>
              </div>

              <div className="space-y-4 rounded-2xl border border-border/60 bg-muted/35 p-5">
                <div className="flex items-center gap-3">
                  <Building2 className="h-6 w-6 text-primary" />
                  <div>
                    <h4 className="font-bold">Active tenant scope</h4>
                    <p className="text-xs text-muted-foreground">
                      This device, credentials, mappings, and events stay inside
                      the tenant selected for this onboarding session.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: EMPLOYEE MAPPING */}
          {currentStep === 6 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold">Step 6: Employee Mapping</h3>
                <p className="text-sm text-muted-foreground">
                  Map external biometric IDs / card numbers to tenant employee
                  records.
                </p>
              </div>

              {isDirectAdapter && (
                <div className="rounded-2xl border border-border/60 bg-muted/35 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h4 className="font-bold">Read users from the device</h4>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        Hive reads user IDs and names only. Face templates and
                        biometric images are not imported.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11 shrink-0 bg-background/70"
                      onClick={() => discoverMutation.mutate()}
                      disabled={discoverMutation.isPending}
                    >
                      <Search aria-hidden="true" className="mr-2 h-4 w-4" />
                      {discoverMutation.isPending ? "Reading users…" : "Discover device users"}
                    </Button>
                  </div>
                  {discovery && (
                    <div className="mt-4 space-y-2">
                      <Label htmlFor="discovered-device-user">Discovered device user</Label>
                      <select
                        id="discovered-device-user"
                        className={selectClass}
                        value={mappingExternalId}
                        onChange={(event) => setMappingExternalId(event.target.value)}
                      >
                        <option value="">Choose a device user</option>
                        {discovery.users.map((user) => (
                          <option key={user.user_id} value={user.user_id}>
                            {user.name || "Unnamed user"} ({user.user_id})
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-muted-foreground" role="status">
                        {discovery.user_count} users read from {discovery.source}.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="map-emp">Select Tenant Employee</Label>
                  <select
                    id="map-emp"
                    value={mappingEmployeeId}
                    onChange={(e) => setMappingEmployeeId(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">Choose Employee</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.primary_name} (
                        {formatEmployeeNumber(emp.employee_number)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="map-ext">External Device ID / Card</Label>
                  <Input
                    id="map-ext"
                    placeholder="e.g. 42 or CARD-1002"
                    value={mappingExternalId}
                    onChange={(e) => setMappingExternalId(e.target.value)}
                    className={controlClass}
                    aria-describedby="map-ext-help"
                  />
                  <p id="map-ext-help" className="text-xs leading-5 text-muted-foreground">
                    Select a discovered user above or enter the terminal user ID/card number exactly.
                  </p>
                </div>
              </div>

              <Button
                onClick={() => mapEmployeeMutation.mutate()}
                disabled={
                  mapEmployeeMutation.isPending ||
                  !mappingEmployeeId ||
                  !mappingExternalId
                }
                variant="outline"
                className="bg-background/70"
              >
                <Users className="mr-2 h-4 w-4" /> Save Mapping
              </Button>

              {employees.length === 0 && (
                <div
                  role="status"
                  className="rounded-2xl border border-amber-600/30 bg-amber-500/10 p-4 text-sm text-amber-950 dark:text-amber-100"
                >
                  <p className="font-black">
                    No employees are available in this tenant.
                  </p>
                  <p className="mt-1 leading-6">
                    The terminal can be registered and tested now, but punch
                    events cannot be imported until HR creates employees and
                    links their terminal user IDs here.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* STEP 7: INITIAL SYNC */}
          {currentStep === 7 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold">
                  Step 7: Initial Synchronization
                </h3>
                <p className="text-sm text-muted-foreground">
                  Pull recent punch events from the terminal. Only events whose
                  device user IDs are mapped to employees can enter attendance.
                </p>
              </div>

              <div className="rounded-2xl border border-border/60 bg-muted/35 p-6 text-center">
                {canPoll ? (
                  <Button
                    onClick={() => syncMutation.mutate()}
                    disabled={syncMutation.isPending}
                    className="min-h-11 font-bold"
                  >
                    <RefreshCw
                      className={`mr-2 h-4 w-4 ${syncMutation.isPending ? "animate-spin" : ""}`}
                    />
                    {syncMutation.isPending
                      ? "Queuing Sync…"
                      : "Queue Initial Attendance Sync"}
                  </Button>
                ) : (
                  <div className="text-left text-sm text-foreground">
                    <p className="font-bold">This device uses Hive Edge push mode.</p>
                    <ol className="mt-2 list-decimal space-y-1 pl-5 leading-6 text-muted-foreground">
                      <li>Install Hive Edge on a computer on the same LAN as the terminal.</li>
                      <li>Enter the displayed device key, secret, IP address, and vendor driver.</li>
                      <li>Start the connector; buffered signed events appear in Devices &amp; Sync.</li>
                    </ol>
                  </div>
                )}
                {latestSyncJob && (
                  <div
                    role="status"
                    className={`mt-4 rounded-xl border p-4 text-left text-sm ${
                      latestSyncJob.status === "completed"
                        ? "border-emerald-600/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100"
                        : latestSyncJob.status === "partial" ||
                            latestSyncJob.status === "failed"
                          ? "border-amber-600/30 bg-amber-500/10 text-amber-950 dark:text-amber-100"
                          : "border-primary/30 bg-primary/10 text-foreground"
                    }`}
                  >
                    <p className="font-black capitalize">
                      Sync {latestSyncJob.status.replace("_", " ")}
                    </p>
                    <p className="mt-1 leading-6">
                      Received {latestSyncJob.received_count}, accepted{" "}
                      {latestSyncJob.accepted_count}, duplicates{" "}
                      {latestSyncJob.duplicate_count}, rejected{" "}
                      {latestSyncJob.rejected_count}.
                    </p>
                    {latestSyncJob.rejected_count > 0 && (
                      <p className="mt-1 leading-6">
                        Link each terminal user ID to a tenant employee, then
                        run Sync again from Devices &amp; Sync.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 8: REVIEW */}
          {currentStep === 8 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold">
                  Step 8: Review Device Details
                </h3>
                <p className="text-sm text-muted-foreground">
                  Confirm all configuration details before completing
                  registration.
                </p>
              </div>

              <dl className="grid gap-3 rounded-2xl border border-border/60 bg-muted/35 p-5 text-sm">
                <div className="flex justify-between border-b border-border/60 pb-2">
                  <dt className="text-muted-foreground">Device Name:</dt>
                  <dd className="font-bold">{name}</dd>
                </div>
                <div className="flex justify-between border-b border-border/60 pb-2">
                  <dt className="text-muted-foreground">Device Code:</dt>
                  <dd className="font-mono font-bold text-primary">
                    {deviceCode}
                  </dd>
                </div>
                <div className="flex justify-between border-b border-border/60 pb-2">
                  <dt className="text-muted-foreground">Adapter Type:</dt>
                  <dd className="font-bold capitalize">
                    {adapterType.replace("_", " ")}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Timezone:</dt>
                  <dd className="font-bold">{timezone}</dd>
                </div>
              </dl>
            </div>
          )}

          {/* STEP 9: COMPLETE */}
          {currentStep === 9 && (
            <div className="space-y-6 text-center py-6">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-teal-500/20 text-teal-400 ring-4 ring-teal-500/30">
                <CheckCircle2 className="h-8 w-8" />
              </div>

              <div>
                <h3 className="text-2xl font-black">
                  Device Onboarding Complete!
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {name} ({deviceCode}) is now onboarded and active in your
                  tenant context.
                </p>
              </div>

              <div className="flex justify-center gap-3 pt-4">
                <Button asChild className="font-bold">
                  <Link href="/dashboard/attendance/devices">
                    View Device Management
                  </Link>
                </Button>
                <Button asChild variant="outline" className="bg-background/70">
                  <Link href="/dashboard/attendance">
                    Return to Attendance Dashboard
                  </Link>
                </Button>
              </div>
            </div>
          )}

          {/* Stepper Buttons */}
          {currentStep < 9 && (
            <div className="mt-8 flex items-center justify-between border-t border-border/60 pt-5">
              <Button
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 1}
                className="bg-background/70"
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Previous Step
              </Button>

              <Button
                onClick={nextStep}
                disabled={createDeviceMutation.isPending}
                className="font-bold"
              >
                {currentStep === 8 ? "Finish Onboarding" : "Next Step"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
