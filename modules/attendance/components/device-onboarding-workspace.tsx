"use client";

import { FormEvent, useId, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Cable,
  CheckCircle2,
  Copy,
  Cpu,
  DatabaseZap,
  Fingerprint,
  KeyRound,
  Layers,
  Network,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
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
import { attendanceFetch, formatEmployeeNumber } from "@/modules/attendance/api";

const controlClass =
  "h-11 border-slate-500 focus-visible:ring-2 focus-visible:ring-blue-700 dark:border-slate-400 dark:focus-visible:ring-cyan-300";
const selectClass =
  "h-11 w-full rounded-md border border-slate-500 bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-700 dark:border-slate-400 dark:focus-visible:ring-cyan-300";

const deviceTypeDefaults: Record<
  AttendanceDevice["adapter_type"],
  { code: string; name: string }
> = {
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

const STEPS = [
  { id: 1, label: "Device Type", icon: Cpu },
  { id: 2, label: "Connection", icon: Network },
  { id: 3, label: "Authentication", icon: KeyRound },
  { id: 4, label: "Test Connection", icon: Cable },
  { id: 5, label: "Branch Assignment", icon: Building2 },
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
  const [adapterType, setAdapterType] = useState<
    "suprema_biostar2" | "generic_webhook" | "local_connector" | "mock"
  >("suprema_biostar2");
  const [deviceCode, setDeviceCode] = useState(
    deviceTypeDefaults.suprema_biostar2.code,
  );
  const [name, setName] = useState(deviceTypeDefaults.suprema_biostar2.name);
  const [timezone, setTimezone] = useState("Africa/Addis_Ababa");
  const [baseUrl, setBaseUrl] = useState("");
  const [biostarDeviceId, setBiostarDeviceId] = useState("");
  const [verifyTls, setVerifyTls] = useState("true");
  const [principal, setPrincipal] = useState("");
  const [secret, setSecret] = useState("");

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

  // Mapping state
  const [mappingEmployeeId, setMappingEmployeeId] = useState("");
  const [mappingExternalId, setMappingExternalId] = useState("");

  const workspace = useQuery({
    queryKey: ["hr-attendance-devices-onboarding", scope],
    queryFn: () =>
      attendanceFetch<{ data: AttendanceDeviceWorkspace }>(
        "/attendance/devices/workspace",
      ),
  });

  const employeesQuery = useQuery({
    queryKey: ["hr-attendance-employees-onboarding", scope],
    queryFn: () =>
      attendanceFetch<Paginated<Employee>>("/employees?per_page=100"),
  });

  const employees = employeesQuery.data?.data ?? [];

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
          manufacturer: adapterType === "suprema_biostar2" ? "Suprema" : null,
          model: adapterType === "suprema_biostar2" ? "BioStation 2" : null,
          configuration:
            adapterType === "suprema_biostar2"
              ? {
                  base_url: baseUrl,
                  biostar_device_id: biostarDeviceId || undefined,
                  verify_tls: verifyTls === "true",
                  allow_http:
                    verifyTls === "false" && baseUrl.startsWith("http://"),
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
      const isBioStar = adapterType === "suprema_biostar2";

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
          credential_type: isBioStar ? "biostar2_api" : "connector_hmac",
          principal: isBioStar ? principal : null,
          secret: isBioStar ? secret : null,
          configuration: isBioStar
            ? {
                base_url: baseUrl,
                biostar_device_id: biostarDeviceId || undefined,
                verify_tls: verifyTls === "true",
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
      toast.success("Initial device synchronization queued.");
    },
    onError: (err: unknown) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to queue sync.",
      );
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
              Attendance Device Onboarding Wizard
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              Register, configure, authenticate, and test attendance terminals
              with tenant isolation
            </p>
          </div>
          <Button
            asChild
            variant="outline"
            className="border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700"
          >
            <Link href="/dashboard/attendance/devices">
              View All Devices
            </Link>
          </Button>
        </div>

        {/* Step Stepper */}
        <div className="mt-6 overflow-x-auto pb-2">
          <ol className="flex min-w-[700px] items-center justify-between border-t border-slate-800 pt-4">
            {STEPS.map((step) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isDone = currentStep > step.id;

              return (
                <li
                  key={step.id}
                  onClick={() => {
                    if (isDone || isActive) setCurrentStep(step.id);
                  }}
                  className={`flex flex-col items-center gap-1.5 cursor-pointer transition-colors ${
                    isActive
                      ? "text-cyan-300"
                      : isDone
                        ? "text-teal-400"
                        : "text-slate-500"
                  }`}
                >
                  <span
                    className={`grid h-9 w-9 place-items-center rounded-full text-xs font-bold transition-all ${
                      isActive
                        ? "bg-cyan-500/20 text-cyan-300 ring-2 ring-cyan-400"
                        : isDone
                          ? "bg-teal-500/20 text-teal-300 border border-teal-500/40"
                          : "bg-slate-800 text-slate-400 border border-slate-700"
                    }`}
                  >
                    {isDone ? <CheckCircle2 className="h-4 w-4" /> : step.id}
                  </span>
                  <span className="text-xs font-semibold whitespace-nowrap">
                    {step.label}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </header>

      {/* Step Content */}
      <Card className="border-slate-700 bg-slate-900 text-white dark:border-slate-800 dark:bg-slate-950">
        <CardContent className="p-6">
          {/* STEP 1: DEVICE TYPE */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold">Step 1: Select Device Type</h3>
                <p className="text-sm text-slate-400">
                  Choose the integration adapter supported by your attendance hardware or software service.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  {
                    id: "suprema_biostar2",
                    title: "Suprema BioStation 2",
                    desc: "Connect to BioStar 2 server API for automatic event polling and user directory discovery.",
                    badge: "BioStar 2 API",
                  },
                  {
                    id: "generic_webhook",
                    title: "Generic Attendance Webhook",
                    desc: "Receive signed JSON event payloads over HTTPS webhook with HMAC authentication.",
                    badge: "Webhook / HTTP",
                  },
                  {
                    id: "local_connector",
                    title: "Local Attendance Connector",
                    desc: "Connect local LAN biometric readers using Hive Agent or Local Bridge.",
                    badge: "LAN Bridge",
                  },
                  {
                    id: "mock",
                    title: "Mock Attendance Device",
                    desc: "Simulate attendance event generation for development and sandbox testing.",
                    badge: "Sandbox / Mock",
                  },
                ].map((item) => (
                  <div
                    key={item.id}
                    onClick={() =>
                      handleAdapterChange(item.id as typeof adapterType)
                    }
                    className={`cursor-pointer rounded-xl border p-5 transition-all ${
                      adapterType === item.id
                        ? "border-cyan-400 bg-cyan-950/30 ring-1 ring-cyan-400"
                        : "border-slate-800 bg-slate-950/50 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                        {item.badge}
                      </span>
                      {adapterType === item.id && (
                        <CheckCircle2 className="h-5 w-5 text-cyan-400" />
                      )}
                    </div>
                    <h4 className="mt-2 text-lg font-bold">{item.title}</h4>
                    <p className="mt-1 text-xs leading-relaxed text-slate-300">
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2: CONNECTION & BASIC DETAILS */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold">Step 2: Connection Settings</h3>
                <p className="text-sm text-slate-400">
                  Configure identifier codes, names, timezones, and network server endpoint.
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

                {adapterType === "suprema_biostar2" && (
                  <>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="onboard-url">BioStar 2 Server URL</Label>
                      <Input
                        id="onboard-url"
                        type="url"
                        placeholder="https://biostar.company.internal"
                        value={baseUrl}
                        onChange={(e) => setBaseUrl(e.target.value)}
                        className={controlClass}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="onboard-biostar-id">
                        BioStar Device ID (Optional)
                      </Label>
                      <Input
                        id="onboard-biostar-id"
                        value={biostarDeviceId}
                        onChange={(e) => setBiostarDeviceId(e.target.value)}
                        className={controlClass}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="onboard-tls">TLS Verification</Label>
                      <select
                        id="onboard-tls"
                        className={selectClass}
                        value={verifyTls}
                        onChange={(e) => setVerifyTls(e.target.value)}
                      >
                        <option value="true">Required (Production)</option>
                        <option value="false">
                          Disabled (Internal LAN test)
                        </option>
                      </select>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: AUTHENTICATION */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold">Step 3: Device Authentication</h3>
                <p className="text-sm text-slate-400">
                  Configure API credentials or inspect the generated HMAC signing secret.
                </p>
              </div>

              {adapterType === "suprema_biostar2" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="onboard-principal">BioStar User / API Principal</Label>
                    <Input
                      id="onboard-principal"
                      value={principal}
                      onChange={(e) => setPrincipal(e.target.value)}
                      placeholder="api-admin"
                      className={controlClass}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="onboard-secret">BioStar Password / Secret</Label>
                    <Input
                      id="onboard-secret"
                      type="password"
                      value={secret}
                      onChange={(e) => setSecret(e.target.value)}
                      className={controlClass}
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-900/50 bg-amber-950/20 p-4">
                  <div className="flex items-center gap-2 text-amber-300 font-bold">
                    <KeyRound className="h-5 w-5" />
                    <span>Inbound Webhook HMAC Secret Issued</span>
                  </div>
                  <p className="mt-2 text-xs text-amber-200">
                    Use the generated device key and HMAC secret to sign webhook request bodies:
                  </p>
                  {credentialSecret && (
                    <dl className="mt-3 grid gap-2 font-mono text-xs">
                      <div>
                        <dt className="text-slate-400">Device Key:</dt>
                        <dd className="break-all font-bold text-white">
                          {credentialSecret.keyId}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-400">HMAC Secret:</dt>
                        <dd className="break-all font-bold text-white">
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
                <p className="text-sm text-slate-400">
                  Verify network reachability and response from the attendance terminal backend.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-6 text-center">
                <Button
                  onClick={() => testConnectionMutation.mutate()}
                  disabled={testConnectionMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-500 font-bold min-h-11"
                >
                  <Cable className={`mr-2 h-4 w-4 ${testConnectionMutation.isPending ? "animate-spin" : ""}`} />
                  {testConnectionMutation.isPending
                    ? "Testing Connection…"
                    : "Run Connection Test"}
                </Button>

                {testResult && (
                  <div
                    className={`mt-4 rounded-xl border p-4 text-sm font-semibold ${
                      testResult.ok
                        ? "border-teal-900 bg-teal-950/40 text-teal-300"
                        : "border-rose-900 bg-rose-950/40 text-rose-300"
                    }`}
                  >
                    {testResult.message}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 5: BRANCH ASSIGNMENT */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold">Step 5: Branch Assignment</h3>
                <p className="text-sm text-slate-400">
                  Assign this device to a physical location or organization unit within your tenant.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <Building2 className="h-6 w-6 text-cyan-300" />
                  <div>
                    <h4 className="font-bold">Tenant Organization Scope</h4>
                    <p className="text-xs text-slate-400">
                      Devices are scoped to your active tenant organization.
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
                <p className="text-sm text-slate-400">
                  Map external biometric IDs / card numbers to tenant employee records.
                </p>
              </div>

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
                        {emp.primary_name} ({formatEmployeeNumber(emp.employee_number)})
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
                  />
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
                className="border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700"
              >
                <Users className="mr-2 h-4 w-4" /> Save Mapping
              </Button>
            </div>
          )}

          {/* STEP 7: INITIAL SYNC */}
          {currentStep === 7 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold">Step 7: Initial Synchronization</h3>
                <p className="text-sm text-slate-400">
                  Trigger initial historical attendance sync or user directory discovery.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-6 text-center">
                <Button
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-500 font-bold min-h-11"
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                  {syncMutation.isPending
                    ? "Queuing Sync…"
                    : "Queue Initial Attendance Sync"}
                </Button>
              </div>
            </div>
          )}

          {/* STEP 8: REVIEW */}
          {currentStep === 8 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold">Step 8: Review Device Details</h3>
                <p className="text-sm text-slate-400">
                  Confirm all configuration details before completing registration.
                </p>
              </div>

              <dl className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-5 text-sm">
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <dt className="text-slate-400">Device Name:</dt>
                  <dd className="font-bold">{name}</dd>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <dt className="text-slate-400">Device Code:</dt>
                  <dd className="font-mono font-bold text-cyan-300">{deviceCode}</dd>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <dt className="text-slate-400">Adapter Type:</dt>
                  <dd className="font-bold capitalize">{adapterType.replace("_", " ")}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-400">Timezone:</dt>
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
                <h3 className="text-2xl font-black">Device Onboarding Complete!</h3>
                <p className="mt-1 text-sm text-slate-300">
                  {name} ({deviceCode}) is now onboarded and active in your tenant context.
                </p>
              </div>

              <div className="flex justify-center gap-3 pt-4">
                <Button
                  asChild
                  className="bg-blue-600 hover:bg-blue-500 font-bold"
                >
                  <Link href="/dashboard/attendance/devices">
                    View Device Management
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700"
                >
                  <Link href="/dashboard/attendance">
                    Return to Attendance Dashboard
                  </Link>
                </Button>
              </div>
            </div>
          )}

          {/* Stepper Buttons */}
          {currentStep < 9 && (
            <div className="mt-8 flex items-center justify-between border-t border-slate-800 pt-5">
              <Button
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 1}
                className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Previous Step
              </Button>

              <Button
                onClick={nextStep}
                disabled={createDeviceMutation.isPending}
                className="bg-blue-600 hover:bg-blue-500 font-bold"
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
