"use client";

import { FormEvent, useEffect, useId, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Copy,
  KeyRound,
  MonitorSmartphone,
  QrCode,
  RadioTower,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { AttendanceDeviceConnectors } from "@/app/dashboard/human-resources/attendance-device-connectors";
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
  AttendanceCaptureMethod,
  AttendanceCaptureWorkspace as CaptureWorkspace,
  AttendanceEventType,
  Employee,
} from "@/modules/humanresources/api";
import { attendanceFetch } from "@/modules/attendance/api";

const controlClass =
  "h-11 border-slate-500 focus-visible:ring-2 focus-visible:ring-blue-700 dark:border-slate-400 dark:focus-visible:ring-cyan-300";
const selectClass =
  "h-11 w-full rounded-md border border-slate-500 bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-700 dark:border-slate-400 dark:focus-visible:ring-cyan-300";
const methods: Array<{ value: AttendanceCaptureMethod; label: string }> = [
  { value: "barcode", label: "Barcode" },
  { value: "permanent_qr", label: "Permanent QR" },
  { value: "dynamic_qr", label: "Rotating QR" },
  { value: "rfid", label: "RFID" },
  { value: "nfc", label: "NFC" },
  { value: "pin", label: "PIN" },
];
const permanentMethods = methods.filter(
  (method) => method.value !== "dynamic_qr",
);
const eventLabels: Record<AttendanceEventType, string> = {
  clock_in: "Clock in",
  clock_out: "Clock out",
  break_start: "Start break",
  break_end: "End break",
};

function idempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `capture:${crypto.randomUUID()}`;
  }
  return `capture:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatDateTime(value: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function FormError({ message }: { message: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, [message]);

  return (
    <div
      ref={ref}
      tabIndex={-1}
      className="rounded-lg border border-red-700 bg-red-50 p-3 text-sm font-semibold text-red-900 outline-none focus-visible:ring-2 focus-visible:ring-red-700 dark:border-red-300 dark:bg-red-950 dark:text-red-100"
    >
      {message}
    </div>
  );
}

function MethodBadge({ method }: { method: AttendanceCaptureMethod }) {
  return (
    <span className="inline-flex rounded-full border border-blue-700 bg-blue-50 px-2 py-1 text-xs font-bold text-blue-950 dark:border-cyan-300 dark:bg-slate-950 dark:text-cyan-100">
      {methods.find((item) => item.value === method)?.label ?? method}
    </span>
  );
}

export function AttendanceCaptureWorkspace({
  employees,
}: {
  employees: Employee[];
}) {
  const scope = getWorkspaceScopeKey();
  const queryClient = useQueryClient();
  const stationHintId = useId();
  const credentialHintId = useId();
  const qrHintId = useId();
  const scanHintId = useId();
  const [displayOnce, setDisplayOnce] = useState<{
    label: string;
    value: string;
  } | null>(null);
  const [stationForm, setStationForm] = useState({
    station_code: "",
    name: "",
    timezone: "Africa/Addis_Ababa",
    allowed_methods: methods.map((method) => method.value),
  });
  const [credentialForm, setCredentialForm] = useState({
    employee_id: "",
    credential_type: "barcode" as Exclude<
      AttendanceCaptureMethod,
      "dynamic_qr"
    >,
    credential_value: "",
    label: "",
  });
  const [qrForm, setQrForm] = useState({
    mode: "employee" as "employee" | "workplace",
    employee_id: "",
    kiosk_station_id: "",
    expires_in_seconds: "120",
    maximum_uses: "1",
  });
  const [scanForm, setScanForm] = useState({
    kiosk_station_id: "",
    capture_method: "barcode" as AttendanceCaptureMethod,
    credential_value: "",
    employee_id: "",
    event_type: "clock_in" as AttendanceEventType,
  });

  const workspace = useQuery({
    queryKey: ["hr-attendance-capture", scope],
    queryFn: () =>
      attendanceFetch<{ data: CaptureWorkspace }>("/attendance/capture/workspace"),
    refetchInterval: 15_000,
  });
  const data = workspace.data?.data;
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: ["hr-attendance-capture", scope],
    });

  const createStation = useMutation({
    mutationFn: () =>
      attendanceFetch<{
        data: CaptureWorkspace["stations"][number];
        meta: { station_token: string };
      }>("/attendance/kiosk-stations", {
        method: "POST",
        body: JSON.stringify(stationForm),
      }),
    onSuccess: (response) => {
      setDisplayOnce({
        label: "Station token",
        value: response.meta.station_token,
      });
      setStationForm({
        station_code: "",
        name: "",
        timezone: "Africa/Addis_Ababa",
        allowed_methods: methods.map((method) => method.value),
      });
      toast.success("Capture station created.");
      void refresh();
    },
  });

  const rotateStation = useMutation({
    mutationFn: (stationId: number) =>
      attendanceFetch<{ data: unknown; meta: { station_token: string } }>(
        `/attendance/kiosk-stations/${stationId}/rotate-token`,
        { method: "POST" },
      ),
    onSuccess: (response) => {
      setDisplayOnce({
        label: "New station token",
        value: response.meta.station_token,
      });
      toast.success("Station token rotated.");
      void refresh();
    },
  });

  const createCredential = useMutation({
    mutationFn: () =>
      attendanceFetch<{
        data: CaptureWorkspace["credentials"][number];
        meta: { credential_value: string; generated: boolean };
      }>("/attendance/credentials", {
        method: "POST",
        body: JSON.stringify({
          ...credentialForm,
          employee_id: Number(credentialForm.employee_id),
          credential_value: credentialForm.credential_value || null,
        }),
      }),
    onSuccess: (response) => {
      if (response.meta.generated) {
        setDisplayOnce({
          label: "Generated employee credential",
          value: response.meta.credential_value,
        });
      }
      setCredentialForm((current) => ({
        ...current,
        employee_id: "",
        credential_value: "",
        label: "",
      }));
      toast.success("Employee attendance credential issued.");
      void refresh();
    },
  });

  const revokeCredential = useMutation({
    mutationFn: (credentialId: number) =>
      attendanceFetch(`/attendance/credentials/${credentialId}/revoke`, {
        method: "POST",
      }),
    onSuccess: () => {
      toast.success("Attendance credential revoked.");
      void refresh();
    },
  });

  const createQr = useMutation({
    mutationFn: () =>
      attendanceFetch<{
        data: CaptureWorkspace["dynamic_qr_sessions"][number];
        meta: { qr_value: string };
      }>("/attendance/dynamic-qr-sessions", {
        method: "POST",
        body: JSON.stringify({
          mode: qrForm.mode,
          employee_id: qrForm.employee_id ? Number(qrForm.employee_id) : null,
          kiosk_station_id: qrForm.kiosk_station_id
            ? Number(qrForm.kiosk_station_id)
            : null,
          expires_in_seconds: Number(qrForm.expires_in_seconds),
          maximum_uses: Number(qrForm.maximum_uses),
        }),
      }),
    onSuccess: (response) => {
      setDisplayOnce({
        label: "Rotating QR value",
        value: response.meta.qr_value,
      });
      setScanForm((current) => ({
        ...current,
        kiosk_station_id: qrForm.kiosk_station_id || current.kiosk_station_id,
        capture_method: "dynamic_qr",
        credential_value: response.meta.qr_value,
        employee_id: qrForm.mode === "workplace" ? qrForm.employee_id : "",
      }));
      toast.success(
        "Rotating QR session created and loaded into the scan desk.",
      );
      void refresh();
    },
  });

  const revokeQr = useMutation({
    mutationFn: (sessionId: number) =>
      attendanceFetch(`/attendance/dynamic-qr-sessions/${sessionId}/revoke`, {
        method: "POST",
      }),
    onSuccess: () => {
      toast.success("Rotating QR session revoked.");
      void refresh();
    },
  });

  const captureScan = useMutation({
    mutationFn: () =>
      attendanceFetch<{
        data: CaptureWorkspace["scan_attempts"][number];
        meta: { accepted: boolean; duplicate: boolean };
      }>("/attendance/capture/events", {
        method: "POST",
        body: JSON.stringify({
          kiosk_station_id: Number(scanForm.kiosk_station_id),
          capture_method: scanForm.capture_method,
          credential_value: scanForm.credential_value,
          employee_id: scanForm.employee_id
            ? Number(scanForm.employee_id)
            : null,
          event_type: scanForm.event_type,
          occurred_at: new Date().toISOString(),
          source_timezone:
            Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          idempotency_key: idempotencyKey(),
        }),
      }),
    onSuccess: (response) => {
      toast.success(
        response.meta.duplicate
          ? "This scan was already processed."
          : "Scan accepted and added to the attendance event ledger.",
      );
      setScanForm((current) => ({ ...current, credential_value: "" }));
      void refresh();
      void queryClient.invalidateQueries({
        queryKey: ["hr-attendance", scope],
      });
    },
    onError: () => {
      void refresh();
    },
  });

  const copyDisplayValue = async () => {
    if (!displayOnce) return;
    await navigator.clipboard.writeText(displayOnce.value);
    toast.success(`${displayOnce.label} copied.`);
  };

  if (workspace.isLoading) {
    return (
      <Card
        id="capture-desk"
        className="border-slate-500 dark:border-slate-400"
      >
        <CardContent className="flex min-h-40 items-center justify-center gap-2 p-6 text-sm font-semibold">
          <RefreshCw
            aria-hidden="true"
            className="h-4 w-4 animate-spin motion-reduce:animate-none"
          />
          Loading capture desk…
        </CardContent>
      </Card>
    );
  }

  if (workspace.isError || !data) {
    return (
      <Card id="capture-desk" className="border-red-700 dark:border-red-300">
        <CardContent className="p-6">
          <h3 className="text-xl font-black">Kiosks and credential capture</h3>
          <p className="mt-2 text-sm text-red-800 dark:text-red-200">
            {errorMessage(
              workspace.error,
              "The capture workspace could not be loaded.",
            )}
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-4 min-h-11"
            onClick={() => workspace.refetch()}
          >
            <RefreshCw aria-hidden="true" /> Retry loading capture desk
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <section
      id="capture-desk"
      aria-labelledby="capture-desk-title"
      className="scroll-mt-24 space-y-4"
    >
      <header className="overflow-hidden rounded-2xl border border-blue-700 bg-slate-950 text-white dark:border-cyan-300">
        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-200">
              <RadioTower aria-hidden="true" className="h-4 w-4" /> Capture
              control
            </p>
            <h3
              id="capture-desk-title"
              className="mt-2 text-2xl font-black tracking-tight"
            >
              One desk for every attendance signal
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-200">
              Issue employee credentials, prepare rotating QR sessions, manage
              stations, and prove that every scan reaches the immutable
              attendance ledger.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-slate-500 bg-slate-900 p-3">
            <ShieldCheck aria-hidden="true" className="h-6 w-6 text-cyan-200" />
            <p className="max-w-56 text-xs font-semibold text-slate-100">
              Raw badge, PIN, RFID, NFC, and QR values are never stored.
            </p>
          </div>
        </div>
        <div className="grid border-t border-slate-500 sm:grid-cols-3">
          {[
            "Credential resolved",
            "Station policy checked",
            "Event normalized",
          ].map((label, index) => (
            <div
              key={label}
              className="flex items-center gap-3 border-slate-500 p-3 sm:not-last:border-r"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cyan-300 font-mono text-sm font-black text-cyan-100">
                {index + 1}
              </span>
              <span className="text-sm font-bold">{label}</span>
            </div>
          ))}
        </div>
      </header>

      {displayOnce && (
        <div
          role="status"
          className="rounded-xl border border-amber-700 bg-amber-50 p-4 text-amber-950 dark:border-amber-300 dark:bg-amber-950 dark:text-amber-100"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-black">{displayOnce.label} · shown once</p>
              <code className="mt-1 block break-all text-sm">
                {displayOnce.value}
              </code>
            </div>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 border-amber-800 bg-white text-amber-950 hover:bg-amber-100 dark:border-amber-200 dark:bg-amber-950 dark:text-amber-100"
              onClick={copyDisplayValue}
            >
              <Copy aria-hidden="true" /> Copy {displayOnce.label.toLowerCase()}
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        {data.permissions.can_manage_devices && (
          <Card className="border-slate-500 dark:border-slate-400">
            <CardContent className="p-5">
              <div className="flex items-center gap-2">
                <MonitorSmartphone
                  aria-hidden="true"
                  className="h-5 w-5 text-blue-800 dark:text-cyan-200"
                />
                <h4 className="text-lg font-black">Create a capture station</h4>
              </div>
              <form
                className="mt-4 space-y-4"
                onSubmit={(event: FormEvent) => {
                  event.preventDefault();
                  createStation.mutate();
                }}
              >
                {createStation.isError && (
                  <FormError
                    message={errorMessage(
                      createStation.error,
                      "The capture station could not be created.",
                    )}
                  />
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="capture-station-code">
                      Station code (required)
                    </Label>
                    <Input
                      id="capture-station-code"
                      value={stationForm.station_code}
                      onChange={(event) =>
                        setStationForm((current) => ({
                          ...current,
                          station_code: event.target.value,
                        }))
                      }
                      required
                      aria-describedby={stationHintId}
                      className={controlClass}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="capture-station-name">
                      Station name (required)
                    </Label>
                    <Input
                      id="capture-station-name"
                      value={stationForm.name}
                      onChange={(event) =>
                        setStationForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      required
                      className={controlClass}
                    />
                  </div>
                </div>
                <p
                  id={stationHintId}
                  className="text-xs text-slate-600 dark:text-slate-300"
                >
                  Use a stable location code such as HQ-MAIN-01.
                </p>
                <fieldset>
                  <legend className="text-sm font-semibold">
                    Allowed capture methods (choose at least one)
                  </legend>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    {methods.map((method) => (
                      <label
                        key={method.value}
                        className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-500 px-3 text-sm font-semibold dark:border-slate-400"
                      >
                        <input
                          type="checkbox"
                          value={method.value}
                          checked={stationForm.allowed_methods.includes(
                            method.value,
                          )}
                          onChange={(event) =>
                            setStationForm((current) => ({
                              ...current,
                              allowed_methods: event.target.checked
                                ? [...current.allowed_methods, method.value]
                                : current.allowed_methods.filter(
                                    (value) => value !== method.value,
                                  ),
                            }))
                          }
                          className="h-5 w-5 accent-blue-700 outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700 dark:accent-cyan-300 dark:focus-visible:outline-cyan-300"
                        />
                        {method.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="space-y-2">
                  <Label htmlFor="capture-station-timezone">
                    Station timezone
                  </Label>
                  <Input
                    id="capture-station-timezone"
                    value={stationForm.timezone}
                    onChange={(event) =>
                      setStationForm((current) => ({
                        ...current,
                        timezone: event.target.value,
                      }))
                    }
                    required
                    className={controlClass}
                  />
                </div>
                <Button
                  type="submit"
                  className="min-h-11"
                  disabled={
                    createStation.isPending ||
                    stationForm.allowed_methods.length === 0
                  }
                >
                  <MonitorSmartphone aria-hidden="true" /> Create station
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {data.permissions.can_manage_credentials && (
          <Card className="border-slate-500 dark:border-slate-400">
            <CardContent className="p-5">
              <div className="flex items-center gap-2">
                <KeyRound
                  aria-hidden="true"
                  className="h-5 w-5 text-blue-800 dark:text-cyan-200"
                />
                <h4 className="text-lg font-black">
                  Issue an employee credential
                </h4>
              </div>
              <form
                className="mt-4 space-y-4"
                onSubmit={(event: FormEvent) => {
                  event.preventDefault();
                  createCredential.mutate();
                }}
              >
                {createCredential.isError && (
                  <FormError
                    message={errorMessage(
                      createCredential.error,
                      "The employee credential could not be issued.",
                    )}
                  />
                )}
                <div className="space-y-2">
                  <Label htmlFor="capture-credential-employee">
                    Employee (required)
                  </Label>
                  <select
                    id="capture-credential-employee"
                    value={credentialForm.employee_id}
                    onChange={(event) =>
                      setCredentialForm((current) => ({
                        ...current,
                        employee_id: event.target.value,
                      }))
                    }
                    required
                    className={selectClass}
                  >
                    <option value="">Choose an employee</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.primary_name} · {employee.employee_number}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="capture-credential-type">
                      Credential type
                    </Label>
                    <select
                      id="capture-credential-type"
                      value={credentialForm.credential_type}
                      onChange={(event) =>
                        setCredentialForm((current) => ({
                          ...current,
                          credential_type: event.target.value as Exclude<
                            AttendanceCaptureMethod,
                            "dynamic_qr"
                          >,
                        }))
                      }
                      className={selectClass}
                    >
                      {permanentMethods.map((method) => (
                        <option key={method.value} value={method.value}>
                          {method.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="capture-credential-label">
                      Credential label
                    </Label>
                    <Input
                      id="capture-credential-label"
                      value={credentialForm.label}
                      onChange={(event) =>
                        setCredentialForm((current) => ({
                          ...current,
                          label: event.target.value,
                        }))
                      }
                      className={controlClass}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="capture-credential-value">
                    Credential value
                  </Label>
                  <Input
                    id="capture-credential-value"
                    type={
                      credentialForm.credential_type === "pin"
                        ? "password"
                        : "text"
                    }
                    value={credentialForm.credential_value}
                    onChange={(event) =>
                      setCredentialForm((current) => ({
                        ...current,
                        credential_value: event.target.value,
                      }))
                    }
                    aria-describedby={credentialHintId}
                    autoComplete="off"
                    className={controlClass}
                  />
                  <p
                    id={credentialHintId}
                    className="text-xs text-slate-600 dark:text-slate-300"
                  >
                    Leave blank to generate a strong value. Entered values are
                    hashed before storage.
                  </p>
                </div>
                <Button
                  type="submit"
                  className="min-h-11"
                  disabled={createCredential.isPending}
                >
                  <KeyRound aria-hidden="true" /> Issue credential
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {data.permissions.can_manage_credentials && (
          <Card className="border-slate-500 dark:border-slate-400">
            <CardContent className="p-5">
              <div className="flex items-center gap-2">
                <QrCode
                  aria-hidden="true"
                  className="h-5 w-5 text-blue-800 dark:text-cyan-200"
                />
                <h4 className="text-lg font-black">
                  Create a rotating QR session
                </h4>
              </div>
              <form
                className="mt-4 space-y-4"
                onSubmit={(event: FormEvent) => {
                  event.preventDefault();
                  createQr.mutate();
                }}
              >
                {createQr.isError && (
                  <FormError
                    message={errorMessage(
                      createQr.error,
                      "The rotating QR session could not be created.",
                    )}
                  />
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="capture-qr-mode">QR purpose</Label>
                    <select
                      id="capture-qr-mode"
                      value={qrForm.mode}
                      onChange={(event) =>
                        setQrForm((current) => ({
                          ...current,
                          mode: event.target.value as "employee" | "workplace",
                        }))
                      }
                      aria-describedby={qrHintId}
                      className={selectClass}
                    >
                      <option value="employee">Employee identity</option>
                      <option value="workplace">
                        Workplace check-in point
                      </option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="capture-qr-station">
                      Station{" "}
                      {qrForm.mode === "workplace"
                        ? "(required)"
                        : "(optional)"}
                    </Label>
                    <select
                      id="capture-qr-station"
                      value={qrForm.kiosk_station_id}
                      onChange={(event) =>
                        setQrForm((current) => ({
                          ...current,
                          kiosk_station_id: event.target.value,
                        }))
                      }
                      required={qrForm.mode === "workplace"}
                      className={selectClass}
                    >
                      <option value="">Any allowed station</option>
                      {data.stations
                        .filter((station) => station.is_active)
                        .map((station) => (
                          <option key={station.id} value={station.id}>
                            {station.name} · {station.station_code}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="capture-qr-employee">
                    Employee{" "}
                    {qrForm.mode === "employee"
                      ? "(required)"
                      : "(used by this test scan)"}
                  </Label>
                  <select
                    id="capture-qr-employee"
                    value={qrForm.employee_id}
                    onChange={(event) =>
                      setQrForm((current) => ({
                        ...current,
                        employee_id: event.target.value,
                      }))
                    }
                    required={qrForm.mode === "employee"}
                    className={selectClass}
                  >
                    <option value="">Choose an employee</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.primary_name} · {employee.employee_number}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="capture-qr-expiry">
                      Expires after (seconds)
                    </Label>
                    <Input
                      id="capture-qr-expiry"
                      type="number"
                      min={30}
                      max={900}
                      value={qrForm.expires_in_seconds}
                      onChange={(event) =>
                        setQrForm((current) => ({
                          ...current,
                          expires_in_seconds: event.target.value,
                        }))
                      }
                      required
                      className={controlClass}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="capture-qr-uses">Maximum scans</Label>
                    <Input
                      id="capture-qr-uses"
                      type="number"
                      min={1}
                      max={100}
                      value={qrForm.maximum_uses}
                      onChange={(event) =>
                        setQrForm((current) => ({
                          ...current,
                          maximum_uses: event.target.value,
                        }))
                      }
                      required
                      className={controlClass}
                    />
                  </div>
                </div>
                <p
                  id={qrHintId}
                  className="text-xs text-slate-600 dark:text-slate-300"
                >
                  Rotating QR values expire after 30–900 seconds and reject
                  replay after their scan limit.
                </p>
                <Button
                  type="submit"
                  className="min-h-11"
                  disabled={createQr.isPending}
                >
                  <QrCode aria-hidden="true" /> Create rotating QR
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {data.permissions.can_operate_kiosk && (
          <Card className="border-blue-700 bg-blue-50 dark:border-cyan-300 dark:bg-slate-950">
            <CardContent className="p-5">
              <div className="flex items-center gap-2">
                <ScanLine
                  aria-hidden="true"
                  className="h-5 w-5 text-blue-800 dark:text-cyan-200"
                />
                <h4 className="text-lg font-black">
                  Test the real capture pipeline
                </h4>
              </div>
              <form
                className="mt-4 space-y-4"
                onSubmit={(event: FormEvent) => {
                  event.preventDefault();
                  captureScan.mutate();
                }}
              >
                {captureScan.isError && (
                  <FormError
                    message={errorMessage(
                      captureScan.error,
                      "The scan was rejected. Review the station, method, value, and QR validity.",
                    )}
                  />
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="capture-scan-station">
                      Capture station (required)
                    </Label>
                    <select
                      id="capture-scan-station"
                      value={scanForm.kiosk_station_id}
                      onChange={(event) =>
                        setScanForm((current) => ({
                          ...current,
                          kiosk_station_id: event.target.value,
                        }))
                      }
                      required
                      className={selectClass}
                    >
                      <option value="">Choose a station</option>
                      {data.stations
                        .filter((station) => station.is_active)
                        .map((station) => (
                          <option key={station.id} value={station.id}>
                            {station.name} · {station.station_code}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="capture-scan-method">
                      Presented method
                    </Label>
                    <select
                      id="capture-scan-method"
                      value={scanForm.capture_method}
                      onChange={(event) =>
                        setScanForm((current) => ({
                          ...current,
                          capture_method: event.target
                            .value as AttendanceCaptureMethod,
                        }))
                      }
                      className={selectClass}
                    >
                      {methods.map((method) => (
                        <option key={method.value} value={method.value}>
                          {method.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="capture-scan-value">
                    Scanned credential or QR value (required)
                  </Label>
                  <Input
                    id="capture-scan-value"
                    type={
                      scanForm.capture_method === "pin" ? "password" : "text"
                    }
                    value={scanForm.credential_value}
                    onChange={(event) =>
                      setScanForm((current) => ({
                        ...current,
                        credential_value: event.target.value,
                      }))
                    }
                    required
                    aria-describedby={scanHintId}
                    autoComplete="off"
                    className={controlClass}
                  />
                  <p
                    id={scanHintId}
                    className="text-xs text-slate-700 dark:text-slate-200"
                  >
                    This submits to the same normalized event pipeline used by
                    attendance calculations.
                  </p>
                </div>
                {scanForm.capture_method === "dynamic_qr" && (
                  <div className="space-y-2">
                    <Label htmlFor="capture-scan-employee">
                      Employee for a workplace QR
                    </Label>
                    <select
                      id="capture-scan-employee"
                      value={scanForm.employee_id}
                      onChange={(event) =>
                        setScanForm((current) => ({
                          ...current,
                          employee_id: event.target.value,
                        }))
                      }
                      className={selectClass}
                    >
                      <option value="">Encoded employee QR</option>
                      {employees.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.primary_name} · {employee.employee_number}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="capture-scan-event">Attendance action</Label>
                  <select
                    id="capture-scan-event"
                    value={scanForm.event_type}
                    onChange={(event) =>
                      setScanForm((current) => ({
                        ...current,
                        event_type: event.target.value as AttendanceEventType,
                      }))
                    }
                    className={selectClass}
                  >
                    {Object.entries(eventLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  type="submit"
                  className="min-h-11"
                  disabled={captureScan.isPending}
                >
                  <ScanLine aria-hidden="true" /> Process test scan
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="border-slate-500 dark:border-slate-400">
          <CardContent className="p-5">
            <h4 className="text-lg font-black">Capture stations</h4>
            <div className="mt-3 space-y-3">
              {data.stations.length ? (
                data.stations.map((station) => (
                  <article
                    key={station.id}
                    className="rounded-xl border border-slate-500 p-4 dark:border-slate-400"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h5 className="font-black">{station.name}</h5>
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                          {station.station_code} · {station.timezone}
                        </p>
                      </div>
                      <span className="font-mono text-xs font-bold">
                        Token {station.token_hint}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {station.allowed_methods.map((method) => (
                        <MethodBadge key={method} method={method} />
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-300">
                      <span>
                        Last seen: {formatDateTime(station.last_seen_at)}
                      </span>
                      {data.permissions.can_manage_devices && (
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11"
                          disabled={rotateStation.isPending}
                          onClick={() => rotateStation.mutate(station.id)}
                        >
                          <RefreshCw aria-hidden="true" /> Rotate token
                        </Button>
                      )}
                    </div>
                  </article>
                ))
              ) : (
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  No capture stations yet. Create the first station above.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-500 dark:border-slate-400">
          <CardContent className="p-5">
            <h4 className="text-lg font-black">Employee credentials</h4>
            <div className="mt-3 space-y-3">
              {data.credentials.length ? (
                data.credentials.slice(0, 12).map((credential) => (
                  <article
                    key={credential.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-500 p-4 dark:border-slate-400"
                  >
                    <div>
                      <p className="font-black">
                        {credential.employee?.primary_name ?? "Employee"}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        {credential.employee?.employee_number} ·{" "}
                        {credential.identifier_hint}
                      </p>
                      <div className="mt-2">
                        <MethodBadge method={credential.credential_type} />
                      </div>
                    </div>
                    {credential.status === "active" ? (
                      data.permissions.can_manage_credentials && (
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11 border-red-700 text-red-800 dark:border-red-300 dark:text-red-200"
                          disabled={revokeCredential.isPending}
                          onClick={() => revokeCredential.mutate(credential.id)}
                        >
                          <XCircle aria-hidden="true" /> Revoke
                        </Button>
                      )
                    ) : (
                      <span className="text-xs font-black uppercase tracking-wide text-slate-600 dark:text-slate-300">
                        Revoked
                      </span>
                    )}
                  </article>
                ))
              ) : (
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  No credentials issued yet.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-500 dark:border-slate-400">
          <CardContent className="p-5">
            <h4 className="text-lg font-black">Rotating QR sessions</h4>
            <div className="mt-3 space-y-3">
              {data.dynamic_qr_sessions.length ? (
                data.dynamic_qr_sessions.slice(0, 12).map((session) => {
                  const active =
                    !session.revoked_at &&
                    new Date(session.expires_at).getTime() > Date.now() &&
                    session.use_count < session.maximum_uses;
                  return (
                    <article
                      key={session.id}
                      className="rounded-xl border border-slate-500 p-4 dark:border-slate-400"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-black">
                            {session.mode === "employee"
                              ? (session.employee?.primary_name ??
                                "Employee QR")
                              : (session.kiosk_station?.name ?? "Workplace QR")}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-300">
                            Expires {formatDateTime(session.expires_at)} ·{" "}
                            {session.use_count}/{session.maximum_uses} scans
                          </p>
                        </div>
                        <span className="text-xs font-black uppercase tracking-wide">
                          {active ? "Active" : "Closed"}
                        </span>
                      </div>
                      {active && data.permissions.can_manage_credentials && (
                        <Button
                          type="button"
                          variant="outline"
                          className="mt-3 min-h-11 border-red-700 text-red-800 dark:border-red-300 dark:text-red-200"
                          disabled={revokeQr.isPending}
                          onClick={() => revokeQr.mutate(session.id)}
                        >
                          <XCircle aria-hidden="true" /> Revoke QR
                        </Button>
                      )}
                    </article>
                  );
                })
              ) : (
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  No rotating QR sessions yet.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {data.permissions.can_view_audit && (
        <Card className="border-slate-500 dark:border-slate-400">
          <CardContent className="p-0">
            <div className="border-b border-slate-500 p-5 dark:border-slate-400">
              <h4 className="text-lg font-black">Immutable scan audit</h4>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Accepted and rejected attempts are retained without the
                presented credential value.
              </p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableCaption>
                  Recent kiosk and scanner attempts, newest first.
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Received</TableHead>
                    <TableHead scope="col">Station</TableHead>
                    <TableHead scope="col">Employee</TableHead>
                    <TableHead scope="col">Method</TableHead>
                    <TableHead scope="col">Action</TableHead>
                    <TableHead scope="col">Outcome</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.scan_attempts.length ? (
                    data.scan_attempts.map((attempt) => (
                      <TableRow key={attempt.attempt_uuid}>
                        <TableCell>
                          <time dateTime={attempt.received_at}>
                            {formatDateTime(attempt.received_at)}
                          </time>
                        </TableCell>
                        <TableCell className="font-semibold">
                          {attempt.station?.name ?? "Unknown station"}
                        </TableCell>
                        <TableCell>
                          {attempt.employee?.primary_name ?? "Not resolved"}
                        </TableCell>
                        <TableCell>
                          <MethodBadge method={attempt.capture_method} />
                        </TableCell>
                        <TableCell>{eventLabels[attempt.event_type]}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1 font-bold">
                            {attempt.outcome === "accepted" ? (
                              <CheckCircle2
                                aria-hidden="true"
                                className="h-4 w-4 text-teal-800 dark:text-teal-200"
                              />
                            ) : (
                              <XCircle
                                aria-hidden="true"
                                className="h-4 w-4 text-red-800 dark:text-red-200"
                              />
                            )}
                            {attempt.outcome === "accepted"
                              ? "Accepted"
                              : `Rejected · ${attempt.reason_code?.replaceAll("_", " ") ?? "invalid"}`}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-10 text-center text-slate-600 dark:text-slate-300"
                      >
                        No scan attempts yet. Use the test capture pipeline
                        above.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <AttendanceDeviceConnectors employees={employees} />
    </section>
  );
}
