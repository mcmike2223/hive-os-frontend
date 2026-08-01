"use client";

import { SignaturePad } from "@/components/ui/signature-pad";
import { fetchApprovalRoles } from "@/modules/workflow/api";
import { RichTextEditor, type RichTextEditorRef } from "@/components/ui/rich-text-editor";
import { FileManagerClient } from "@/components/dashboard/file-manager-client";

import React, { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Award,
  BadgeCheck,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Download,
  FileCheck,
  FilePlus2,
  FileText,
  FolderOpen,
  GraduationCap,
  HeartHandshake,
  History,
  Info,
  Loader2,
  MapPin,
  Minus,
  Move,
  Pencil,
  Phone,
  Printer,
  RotateCcw,
  RotateCw,
  ShieldAlert,
  UserCheck,
  UserCog,
  UserMinus,
  UserPlus,
  UsersRound,
  ArrowLeftRight,
  Search,
  Plus,
  Filter,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  getWorkspaceScopeKey,
  getBackendApiRoot,
  getAuthHeaders,
  getTenantHeaders,
  getBackendStorageUrl,
} from "@/lib/runtime-context";
import { cn } from "@/lib/utils";
import {
  Employee,
  HrLetterTemplate,
  OrganizationUnit,
  Position,
  createHrLetterTemplate,
  fetchHrLetterTemplates,
  hrFetch,
} from "@/modules/humanresources/api";

const controlClass =
  "h-11 border-input bg-background text-foreground focus-visible:ring-2 focus-visible:ring-primary";
const selectClass =
  "h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary";

type PublicBrandSettings = {
  app_title?: string | null;
  address?: string | null;
  email?: string | null;
  phone_number?: string | null;
  website?: string | null;
  logo_light?: string | null;
  logo_dark?: string | null;
  pdf_logo?: string | null;
  header_image?: string | null;
  footer_image?: string | null;
  letterhead_header_url?: string | null;
  letterhead_footer_url?: string | null;
};

type LetterBrandAssets = {
  header: string | null;
  footer: string | null;
  logo: string | null;
};

type LetterFilePickerPurpose = "editor-media" | "seal";

type SealPosition = {
  x: number;
  y: number;
};

type LetterFileManagerFile = {
  media_details?: {
    url?: string;
    mime_type?: string;
    name?: string;
    download_name?: string;
  };
  url?: string;
  path?: string;
};

const DEFAULT_SEAL_SIZE_MM = 29;
const MIN_SEAL_SIZE_MM = 15;
const MAX_SEAL_SIZE_MM = 100;
const MAX_NORMALIZED_SEAL_EDGE_PX = 640;
const MAX_NORMALIZED_SEAL_DATA_LENGTH = 2_900_000;

function clampNumber(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function normalizeDegrees(value: number): number {
  const normalized = ((value + 180) % 360 + 360) % 360 - 180;
  return Math.round(normalized);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read branding image."));
    reader.readAsDataURL(blob);
  });
}

function normalizeSealDataUrl(source: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      const naturalWidth = image.naturalWidth;
      const naturalHeight = image.naturalHeight;
      if (naturalWidth < 1 || naturalHeight < 1) {
        reject(new Error("The selected seal image has invalid dimensions."));
        return;
      }

      const longestEdge = Math.max(naturalWidth, naturalHeight);
      const canvasEdge = Math.max(1, Math.min(MAX_NORMALIZED_SEAL_EDGE_PX, longestEdge));
      const scale = canvasEdge / longestEdge;
      const drawWidth = Math.max(1, Math.round(naturalWidth * scale));
      const drawHeight = Math.max(1, Math.round(naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = canvasEdge;
      canvas.height = canvasEdge;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("The browser could not prepare the seal image."));
        return;
      }

      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(
        image,
        Math.round((canvasEdge - drawWidth) / 2),
        Math.round((canvasEdge - drawHeight) / 2),
        drawWidth,
        drawHeight,
      );
      const normalized = canvas.toDataURL("image/png");
      if (normalized.length > MAX_NORMALIZED_SEAL_DATA_LENGTH) {
        reject(new Error("The seal image is too detailed for reliable PDF output."));
        return;
      }

      resolve(normalized);
    };
    image.onerror = () => reject(new Error("The selected seal image could not be decoded."));
    image.src = source;
  });
}

function getLocalDateInputValue(): string {
  const now = new Date();
  const localTime = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localTime.toISOString().slice(0, 10);
}

function plainTextToLetterHtml(value: string): string {
  const escaped = value
    .trim()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  if (!escaped) {
    return "<p>To Whom It May Concern,</p><p>Write your letter content here...</p>";
  }

  return escaped
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replaceAll("\n", "<br>")}</p>`)
    .join("");
}

async function waitForDocumentImages(element: HTMLElement): Promise<void> {
  const images = Array.from(element.querySelectorAll("img"));
  await Promise.all(
    images.map((image) => {
      if (image.complete && image.naturalWidth > 0) return Promise.resolve();

      return new Promise<void>((resolve, reject) => {
        const timeoutId = window.setTimeout(
          () => reject(new Error(`Timed out loading image: ${image.alt || "document image"}`)),
          15_000
        );
        image.addEventListener(
          "load",
          () => {
            window.clearTimeout(timeoutId);
            resolve();
          },
          { once: true }
        );
        image.addEventListener(
          "error",
          () => {
            window.clearTimeout(timeoutId);
            reject(new Error(`Unable to load image: ${image.alt || "document image"}`));
          },
          { once: true }
        );
      });
    })
  );
}

// ==========================================
// 1. EMPLOYEE 360 PROFILE DIALOG
// ==========================================
export function EmployeeProfile360Dialog({
  open,
  onOpenChange,
  employee,
  onOpenTransfer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
  onOpenTransfer?: (employee: Employee) => void;
}) {
  const [profileTab, setProfileTab] = useState("overview");

  if (!employee) return null;

  const custom = (employee as any).custom_fields || {};
  const assignment = employee.primary_assignment;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader className="border-b pb-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400 text-xl font-black text-slate-950 shadow-md">
                {employee.primary_name?.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <DialogTitle className="text-2xl font-black">
                  {custom.title ? `${custom.title}. ` : ""}
                  {employee.primary_name}
                </DialogTitle>
                <p className="mt-0.5 text-sm font-semibold text-slate-500 dark:text-slate-400">
                  {employee.preferred_name ? `${employee.preferred_name} · ` : ""}
                  ID: <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{employee.employee_number}</span>
                </p>
              </div>
            </div>
            {onOpenTransfer && (
              <Button
                onClick={() => {
                  onOpenChange(false);
                  onOpenTransfer(employee);
                }}
                className="bg-slate-900 font-bold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950"
              >
                <UserCog className="mr-2 h-4 w-4" />
                Transfer / Reassign
              </Button>
            )}
          </div>
        </DialogHeader>

        <Tabs value={profileTab} onValueChange={setProfileTab} className="mt-2 space-y-4">
          <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-xl border border-slate-300 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-900">
            <TabsTrigger value="overview" className="min-h-10 px-3 text-xs font-bold sm:text-sm">
              <UserCheck className="mr-1.5 h-4 w-4" />
              Overview & Assignment
            </TabsTrigger>
            <TabsTrigger value="personal" className="min-h-10 px-3 text-xs font-bold sm:text-sm">
              <MapPin className="mr-1.5 h-4 w-4" />
              Personal & Contact
            </TabsTrigger>
            <TabsTrigger value="education" className="min-h-10 px-3 text-xs font-bold sm:text-sm">
              <GraduationCap className="mr-1.5 h-4 w-4" />
              Qualifications
            </TabsTrigger>
            <TabsTrigger value="relations" className="min-h-10 px-3 text-xs font-bold sm:text-sm">
              <ShieldAlert className="mr-1.5 h-4 w-4" />
              Disciplinary & Relations
            </TabsTrigger>
            <TabsTrigger value="history" className="min-h-10 px-3 text-xs font-bold sm:text-sm">
              <History className="mr-1.5 h-4 w-4" />
              Transfer History
            </TabsTrigger>
          </TabsList>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl border border-slate-300 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
                <span className="text-xs font-bold uppercase text-slate-500">Employment Status</span>
                <p className="mt-1 text-base font-black capitalize text-slate-900 dark:text-slate-100">
                  {employee.employment_status.replaceAll("_", " ")}
                </p>
              </div>
              <div className="rounded-xl border border-slate-300 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
                <span className="text-xs font-bold uppercase text-slate-500">Organization Unit</span>
                <p className="mt-1 text-base font-black text-slate-900 dark:text-slate-100">
                  {assignment?.organization_unit?.name || "Unassigned"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-300 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
                <span className="text-xs font-bold uppercase text-slate-500">Job Position</span>
                <p className="mt-1 text-base font-black text-slate-900 dark:text-slate-100">
                  {assignment?.position?.title || "Unassigned"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-300 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
                <span className="text-xs font-bold uppercase text-slate-500">Salary Amount</span>
                <p className="mt-1 text-base font-black text-slate-900 dark:text-slate-100">
                  {custom.salary_amount ? `${Number(custom.salary_amount).toLocaleString()} ETB` : "N/A"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-300 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
                <span className="text-xs font-bold uppercase text-slate-500">Hire Date</span>
                <p className="mt-1 text-base font-black text-slate-900 dark:text-slate-100">
                  {employee.hired_on || "N/A"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-300 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
                <span className="text-xs font-bold uppercase text-slate-500">Contract Type</span>
                <p className="mt-1 text-base font-black capitalize text-slate-900 dark:text-slate-100">
                  {employee.contract_type || "Indefinite"}
                </p>
              </div>
            </div>
          </TabsContent>

          {/* PERSONAL TAB */}
          <TabsContent value="personal" className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-3 rounded-xl border border-slate-300 p-4 dark:border-slate-700">
                <h4 className="font-bold text-slate-900 dark:text-slate-100">Identity & Demographic</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-slate-500">Amharic Name:</span>
                  <span className="font-semibold">{employee.preferred_name || custom.am_name || "—"}</span>
                  <span className="text-slate-500">Gender / Sex:</span>
                  <span className="font-semibold capitalize">{employee.gender_code || "Male"}</span>
                  <span className="text-slate-500">Marital Status:</span>
                  <span className="font-semibold capitalize">{custom.marital_status || "Single"}</span>
                  <span className="text-slate-500">Nation / Nationality:</span>
                  <span className="font-semibold">{employee.nationality_code || "Ethiopian"}</span>
                  <span className="text-slate-500">Date of Birth:</span>
                  <span className="font-semibold">{employee.date_of_birth || "—"}</span>
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-slate-300 p-4 dark:border-slate-700">
                <h4 className="font-bold text-slate-900 dark:text-slate-100">Contact Details</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-slate-500">Work Phone:</span>
                  <span className="font-semibold">{employee.phone || "—"}</span>
                  <span className="text-slate-500">Work Email:</span>
                  <span className="font-semibold">{employee.work_email || "—"}</span>
                  <span className="text-slate-500">Emergency Contact:</span>
                  <span className="font-semibold">{custom.emergency_contact || "N/A"}</span>
                  <span className="text-slate-500">Sub-city / Woreda:</span>
                  <span className="font-semibold">{custom.subcity ? `${custom.subcity}, Woreda ${custom.woreda || '01'}` : "Addis Ababa"}</span>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* QUALIFICATIONS TAB */}
          <TabsContent value="education" className="space-y-4">
            <div className="rounded-xl border border-slate-300 p-4 dark:border-slate-700">
              <h4 className="font-bold text-slate-900 dark:text-slate-100">Educational History & Certifications</h4>
              <p className="mt-1 text-sm text-slate-500">Recorded academic qualifications and professional licenses.</p>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between rounded-lg border bg-slate-50 p-3 dark:bg-slate-900">
                  <div className="flex items-center gap-3">
                    <GraduationCap className="h-5 w-5 text-amber-500" />
                    <div>
                      <p className="font-bold text-sm">Bachelor's Degree in Software Engineering / Computer Science</p>
                      <p className="text-xs text-slate-500">Addis Ababa University (AAU) · Graduated 2021</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">Verified</span>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* DISCIPLINARY & RELATIONS TAB */}
          <TabsContent value="relations" className="space-y-4">
            <div className="space-y-4 rounded-xl border border-slate-300 p-4 dark:border-slate-700">
              <h4 className="font-bold text-slate-900 dark:text-slate-100">Employee Relations & Disciplinary Record (የቅጣት መዝገብ)</h4>
              <p className="mt-1 text-sm text-slate-500">Official log of Administrative HR Punishments and Judiciary Court Orders.</p>

              {/* 1. Administrative Punishments Section */}
              <div className="space-y-2 rounded-lg border bg-slate-50 p-3.5 dark:bg-slate-900">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-amber-600 dark:text-amber-400">
                    1. Administrative Punishments (አስተዳደራዊ ቅጣቶች)
                  </span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                    No Active Violations
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Internal HR warnings (verbal/written), salary deductions, or temporary suspensions.
                </p>
              </div>

              {/* 2. Judiciary Punishments Section */}
              <div className="space-y-2 rounded-lg border bg-slate-50 p-3.5 dark:bg-slate-900">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-red-600 dark:text-red-400">
                    2. Judiciary Punishments & Court Rulings (ፍርድ ቤታዊ/ህጋዊ ቅጣቶች)
                  </span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                    No Court Injunctions
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Judicial court verdicts, salary garnishment orders, legal fines, or restraining orders.
                </p>
              </div>
            </div>
          </TabsContent>

          {/* TRANSFER HISTORY TAB */}
          <TabsContent value="history" className="space-y-4">
            <div className="rounded-xl border border-slate-300 p-4 dark:border-slate-700">
              <h4 className="font-bold text-slate-900 dark:text-slate-100">Job Assignment & Transfer Log</h4>
              <p className="mt-1 text-sm text-slate-500">Historical career transitions, promotions, and departmental reassignments.</p>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between rounded-lg border bg-slate-50 p-3 dark:bg-slate-900">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="font-bold text-sm">{assignment?.position?.title || "Substantive Position"}</p>
                      <p className="text-xs text-slate-500">{assignment?.organization_unit?.name || "Unit"} · Primary Assignment</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-slate-500">Effective: {employee.hired_on}</span>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close Profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==========================================
// 2. EMPLOYEE TRANSFER & REASSIGNMENT DIALOG
// ==========================================
export function EmployeeTransferDialog({
  open,
  onOpenChange,
  employee,
  units,
  positions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
  units: OrganizationUnit[];
  positions: Position[];
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    organization_unit_id: "",
    position_id: "",
    assignment_type: "substantive",
    started_on: new Date().toISOString().slice(0, 10),
    hours_per_day: "8",
    hours_per_week: "48",
    reason: "",
  });

  React.useEffect(() => {
    if (open && employee) {
      const current = employee.primary_assignment;
      setForm({
        organization_unit_id: current?.organization_unit_id ? String(current.organization_unit_id) : "",
        position_id: current?.position_id ? String(current.position_id) : "",
        assignment_type: "substantive",
        started_on: new Date().toISOString().slice(0, 10),
        hours_per_day: "8",
        hours_per_week: "48",
        reason: "",
      });
    }
  }, [open, employee]);

  const filteredPositions = positions.filter(
    (p) => !form.organization_unit_id || p.organization_unit_id === Number(form.organization_unit_id)
  );

  const mutation = useMutation({
    mutationFn: async () => {
      if (!employee) return;
      return hrFetch(`/employees/${employee.id}/assignments`, {
        method: "POST",
        body: JSON.stringify({
          organization_unit_id: Number(form.organization_unit_id),
          position_id: Number(form.position_id),
          assignment_type: form.assignment_type,
          started_on: form.started_on,
          hours_per_day: Number(form.hours_per_day),
          hours_per_week: Number(form.hours_per_week),
          is_primary: true,
        }),
      });
    },
    onSuccess: () => {
      toast.success(`Transfer recorded for ${employee?.primary_name}.`);
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["hr-employees"] });
      queryClient.invalidateQueries({ queryKey: ["hr-summary"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to record transfer.");
    },
  });

  if (!employee) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-black">
            <UserCog className="h-5 w-5 text-amber-500" />
            Transfer / Reassign Employee
          </DialogTitle>
          <DialogDescription>
            Record a departmental transfer, promotion, or acting assignment for{" "}
            <span className="font-bold text-foreground">{employee.primary_name}</span> ({employee.employee_number}).
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="transfer-unit">Target Organization Unit *</Label>
              <select
                id="transfer-unit"
                value={form.organization_unit_id}
                onChange={(e) => setForm({ ...form, organization_unit_id: e.target.value })}
                required
                className={selectClass}
              >
                <option value="">Select Unit</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name} ({unit.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="transfer-position">Target Job Position *</Label>
              <select
                id="transfer-position"
                value={form.position_id}
                onChange={(e) => setForm({ ...form, position_id: e.target.value })}
                disabled={!form.organization_unit_id}
                required
                className={selectClass}
              >
                <option value="">Select Position</option>
                {filteredPositions.map((position) => (
                  <option key={position.id} value={position.id}>
                    {position.title} ({position.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="assignment-type">Assignment Type *</Label>
              <select
                id="assignment-type"
                value={form.assignment_type}
                onChange={(e) => setForm({ ...form, assignment_type: e.target.value })}
                required
                className={selectClass}
              >
                <option value="substantive">Substantive (Permanent Transfer / Promotion)</option>
                <option value="acting">Acting Coverage</option>
                <option value="secondment">Secondment / Temporary Relocation</option>
                <option value="temporary">Temporary Assignment</option>
                <option value="project">Project Assignment</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="transfer-date">Effective Start Date *</Label>
              <Input
                id="transfer-date"
                type="date"
                value={form.started_on}
                onChange={(e) => setForm({ ...form, started_on: e.target.value })}
                required
                className={controlClass}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="transfer-reason">Transfer Justification / Remarks</Label>
            <Textarea
              id="transfer-reason"
              placeholder="e.g. Promotion to Senior Lead, Departmental restructuring..."
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              className="h-20"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending || !form.organization_unit_id || !form.position_id}>
              {mutation.isPending ? "Recording Transfer..." : "Confirm Transfer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ==========================================
// 3. EMPLOYEE RELATIONS & DISCIPLINARY PANEL
// ==========================================
export function EmployeeRelationsPanel() {
  const [activeTab, setActiveTab] = useState("administrative");
  const [adminCases, setAdminCases] = useState([
    {
      id: 1,
      employee: "Abebe Bikila (EMP-0001)",
      type: "Written Warning (የጽሁፍ ማስጠንቀቂያ)",
      reason: "Unexcused late attendance checkpoint",
      status: "Active / Logged",
      date: "2026-05-10",
      officer: "HR Manager",
    },
  ]);
  const [judiciaryCases, setJudiciaryCases] = useState([
    {
      id: 1,
      employee: "Tsion Hailu (EMP-0002)",
      court_name: "Federal First Instance Court (ፌደራል የመጀመሪያ ደረጃ ፍርድ ቤት)",
      case_number: "FFC/2026/9041",
      type: "Salary Garnishment / Injunction (የደመወዝ መያዝ መመሪያ)",
      penalty_amount: "5,000 ETB",
      status: "In Effect",
      date: "2026-04-15",
    },
  ]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [category, setCategory] = useState<"administrative" | "judiciary">("administrative");
  const [newAdmin, setNewAdmin] = useState({
    employee: "",
    type: "Written Warning (የጽሁፍ ማስጠንቀቂያ)",
    reason: "",
    date: new Date().toISOString().slice(0, 10),
  });
  const [newJudiciary, setNewJudiciary] = useState({
    employee: "",
    court_name: "Federal First Instance Court",
    case_number: "",
    type: "Court Ruling / Judgment (የፍርድ ቤት ውሳኔ)",
    penalty_amount: "",
    date: new Date().toISOString().slice(0, 10),
  });

  const handleAddAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdmin.employee.trim()) return;
    setAdminCases([
      ...adminCases,
      {
        id: Date.now(),
        employee: newAdmin.employee,
        type: newAdmin.type,
        reason: newAdmin.reason,
        status: "Active / Logged",
        date: newAdmin.date,
        officer: "HR Compliance Officer",
      },
    ]);
    toast.success("Administrative punishment recorded.");
    setDialogOpen(false);
    setNewAdmin({ employee: "", type: "Written Warning (የጽሁፍ ማስጠንቀቂያ)", reason: "", date: new Date().toISOString().slice(0, 10) });
  };

  const handleAddJudiciary = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJudiciary.employee.trim()) return;
    setJudiciaryCases([
      ...judiciaryCases,
      {
        id: Date.now(),
        employee: newJudiciary.employee,
        court_name: newJudiciary.court_name,
        case_number: newJudiciary.case_number,
        type: newJudiciary.type,
        penalty_amount: newJudiciary.penalty_amount ? `${newJudiciary.penalty_amount} ETB` : "N/A",
        status: "In Effect",
        date: newJudiciary.date,
      },
    ]);
    toast.success("Judiciary punishment / court order recorded.");
    setDialogOpen(false);
    setNewJudiciary({ employee: "", court_name: "Federal First Instance Court", case_number: "", type: "Court Ruling / Judgment (የፍርድ ቤት ውሳኔ)", penalty_amount: "", date: new Date().toISOString().slice(0, 10) });
  };

  return (
    <Card className="border-slate-300 dark:border-slate-700">
      <CardContent className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
          <div>
            <h2 className="text-xl font-black flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              Employee Relations & Disciplinary Management (የቅጣት መዝገብ)
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Manage Administrative Punishments (አስተዳደራዊ ቅጣቶች) and Judiciary Court Orders (ፍርድ ቤታዊ/ህጋዊ ቅጣቶች).
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)} className="bg-amber-300 font-bold text-slate-950 hover:bg-amber-200">
            <UserMinus className="mr-2 h-4 w-4" />
            Record Punishment Case
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6 space-y-4">
          <TabsList className="h-auto justify-start rounded-xl border bg-slate-100 p-1 dark:bg-slate-900">
            <TabsTrigger value="administrative" className="min-h-10 px-4 font-bold">
              1. Administrative Punishments (አስተዳደራዊ ቅጣቶች)
            </TabsTrigger>
            <TabsTrigger value="judiciary" className="min-h-10 px-4 font-bold">
              2. Judiciary Punishments (ፍርድ ቤታዊ/ህጋዊ ቅጣቶች)
            </TabsTrigger>
          </TabsList>

          {/* 1. ADMINISTRATIVE PUNISHMENTS */}
          <TabsContent value="administrative">
            <div className="overflow-x-auto rounded-xl border border-slate-300 dark:border-slate-700">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-slate-100 text-xs uppercase font-bold text-slate-600 dark:bg-slate-900 dark:text-slate-400">
                  <tr>
                    <th className="p-3">Employee</th>
                    <th className="p-3">Punishment Type</th>
                    <th className="p-3">Details / Reason</th>
                    <th className="p-3">Issued Date</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {adminCases.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                      <td className="p-3 font-bold">{c.employee}</td>
                      <td className="p-3">
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                          {c.type}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-300">{c.reason}</td>
                      <td className="p-3 text-xs font-medium">{c.date}</td>
                      <td className="p-3">
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* 2. JUDICIARY PUNISHMENTS */}
          <TabsContent value="judiciary">
            <div className="overflow-x-auto rounded-xl border border-slate-300 dark:border-slate-700">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-slate-100 text-xs uppercase font-bold text-slate-600 dark:bg-slate-900 dark:text-slate-400">
                  <tr>
                    <th className="p-3">Employee</th>
                    <th className="p-3">Court Name & Case No.</th>
                    <th className="p-3">Judiciary Ruling Type</th>
                    <th className="p-3">Penalty / Garnishment</th>
                    <th className="p-3">Ruling Date</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {judiciaryCases.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                      <td className="p-3 font-bold">{c.employee}</td>
                      <td className="p-3">
                        <div className="font-bold text-xs">{c.court_name}</div>
                        <div className="text-xs text-slate-500 font-mono">Case: {c.case_number}</div>
                      </td>
                      <td className="p-3">
                        <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-900 dark:bg-red-950 dark:text-red-200">
                          {c.type}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{c.penalty_amount}</td>
                      <td className="p-3 text-xs font-medium">{c.date}</td>
                      <td className="p-3">
                        <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800">
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>

        {/* RECORD PUNISHMENT DIALOG */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-black">
                <ShieldAlert className="h-5 w-5 text-red-500" />
                Record Punishment Case (የቅጣት መዝገብ)
              </DialogTitle>
              <DialogDescription>
                Select category: Administrative HR Punishment or Judiciary Court Order.
              </DialogDescription>
            </DialogHeader>

            <div className="flex gap-2 border-b pb-3">
              <Button
                type="button"
                variant={category === "administrative" ? "default" : "outline"}
                onClick={() => setCategory("administrative")}
                className="flex-1 font-bold text-xs sm:text-sm"
              >
                Administrative (አስተዳደራዊ)
              </Button>
              <Button
                type="button"
                variant={category === "judiciary" ? "default" : "outline"}
                onClick={() => setCategory("judiciary")}
                className="flex-1 font-bold text-xs sm:text-sm"
              >
                Judiciary (ፍርድ ቤታዊ/ህጋዊ)
              </Button>
            </div>

            {category === "administrative" ? (
              <form onSubmit={handleAddAdmin} className="space-y-4 pt-2">
                <div>
                  <Label htmlFor="admin-emp">Employee Name / ID *</Label>
                  <Input
                    id="admin-emp"
                    placeholder="e.g. Abebe Bikila (EMP-0001)"
                    value={newAdmin.employee}
                    onChange={(e) => setNewAdmin({ ...newAdmin, employee: e.target.value })}
                    required
                    className={controlClass}
                  />
                </div>
                <div>
                  <Label htmlFor="admin-type">Administrative Punishment Type *</Label>
                  <select
                    id="admin-type"
                    value={newAdmin.type}
                    onChange={(e) => setNewAdmin({ ...newAdmin, type: e.target.value })}
                    className={selectClass}
                  >
                    <option value="Verbal Warning (የቃል ማስጠንቀቂያ)">Verbal Warning (የቃል ማስጠንቀቂያ)</option>
                    <option value="Written Warning (የጽሁፍ ማስጠንቀቂያ)">Written Warning (የጽሁፍ ማስጠንቀቂያ)</option>
                    <option value="Final Written Warning (የመጨረሻ የጽሁፍ ማስጠንቀቂያ)">Final Written Warning (የመጨረሻ የጽሁፍ ማስጠንቀቂያ)</option>
                    <option value="Salary Deduction / Fine (የደመወዝ ቅጣት)">Salary Deduction / Fine (የደመወዝ ቅጣት)</option>
                    <option value="Temporary Suspension (ጊዜያዊ እገዳ)">Temporary Suspension (ጊዜያዊ እገዳ)</option>
                    <option value="Termination of Employment (ከስራ ማሰናበት)">Termination of Employment (ከስራ ማሰናበት)</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="admin-reason">Reason / Infraction Details *</Label>
                  <Textarea
                    id="admin-reason"
                    placeholder="Describe infraction, dates, and HR findings..."
                    value={newAdmin.reason}
                    onChange={(e) => setNewAdmin({ ...newAdmin, reason: e.target.value })}
                    required
                    className="h-20"
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Save Administrative Case</Button>
                </DialogFooter>
              </form>
            ) : (
              <form onSubmit={handleAddJudiciary} className="space-y-4 pt-2">
                <div>
                  <Label htmlFor="jud-emp">Employee Name / ID *</Label>
                  <Input
                    id="jud-emp"
                    placeholder="e.g. Tsion Hailu (EMP-0002)"
                    value={newJudiciary.employee}
                    onChange={(e) => setNewJudiciary({ ...newJudiciary, employee: e.target.value })}
                    required
                    className={controlClass}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="jud-court">Court Name *</Label>
                    <Input
                      id="jud-court"
                      placeholder="e.g. Federal First Instance Court"
                      value={newJudiciary.court_name}
                      onChange={(e) => setNewJudiciary({ ...newJudiciary, court_name: e.target.value })}
                      required
                      className={controlClass}
                    />
                  </div>
                  <div>
                    <Label htmlFor="jud-case">Case / File Number *</Label>
                    <Input
                      id="jud-case"
                      placeholder="e.g. FFC/2026/9041"
                      value={newJudiciary.case_number}
                      onChange={(e) => setNewJudiciary({ ...newJudiciary, case_number: e.target.value })}
                      required
                      className={controlClass}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="jud-type">Judiciary Ruling Type *</Label>
                  <select
                    id="jud-type"
                    value={newJudiciary.type}
                    onChange={(e) => setNewJudiciary({ ...newJudiciary, type: e.target.value })}
                    className={selectClass}
                  >
                    <option value="Court Ruling / Judgment (የፍርድ ቤት ውሳኔ)">Court Ruling / Judgment (የፍርድ ቤት ውሳኔ)</option>
                    <option value="Salary Garnishment / Injunction (የደመወዝ መያዝ መመሪያ)">Salary Garnishment / Injunction (የደመወዝ መያዝ መመሪያ)</option>
                    <option value="Legal Penalty / Fine (ህጋዊ የገንዘብ ቅጣት)">Legal Penalty / Fine (ህጋዊ የገንዘብ ቅጣት)</option>
                    <option value="Restraining / Injunction Order (የፍርድ ቤት ዕገዳ)">Restraining / Injunction Order (የፍርድ ቤት ዕገዳ)</option>
                    <option value="Bail / Guarantor Enforcement (የዋስትና ማስከበር)">Bail / Guarantor Enforcement (የዋስትና ማስከበር)</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="jud-amount">Fine / Garnishment Amount (ETB)</Label>
                  <Input
                    id="jud-amount"
                    type="number"
                    placeholder="e.g. 5000"
                    value={newJudiciary.penalty_amount}
                    onChange={(e) => setNewJudiciary({ ...newJudiciary, penalty_amount: e.target.value })}
                    className={controlClass}
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-red-600 text-white hover:bg-red-700">
                    Save Judiciary Record
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ==========================================
// 4. HR FORMS & DOCUMENT GENERATOR PANEL
// ==========================================
export function HrFormsPanel() {
  const scope = getWorkspaceScopeKey();
  const queryClient = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState("employment_confirmation");
  const [employeeName, setEmployeeName] = useState("Abebe Bikila");
  const [employeeId, setEmployeeId] = useState("EMP-0001");
  const [positionTitle, setPositionTitle] = useState("Senior Software Engineer");
  const [salaryAmount, setSalaryAmount] = useState("25,000");

  const [signerName, setSignerName] = useState("Tewodros Kassahun");
  const [signerTitle, setSignerTitle] = useState("Human Resources Director");
  const [signerImage, setSignerImage] = useState<string | null>(null);
  const [sealImage, setSealImage] = useState<string | null>(null);
  const [sealSizeMm, setSealSizeMm] = useState(DEFAULT_SEAL_SIZE_MM);
  const [sealPosition, setSealPosition] = useState<SealPosition | null>(null);
  const [sealRotationDeg, setSealRotationDeg] = useState(0);
  const [includeSeal, setIncludeSeal] = useState(true);
  const [isSignaturePadOpen, setIsSignaturePadOpen] = useState(false);
  const [filePickerPurpose, setFilePickerPurpose] = useState<LetterFilePickerPurpose | null>(null);
  const [isFilePickerSelecting, setIsFilePickerSelecting] = useState(false);
  const [isDocumentBusy, setIsDocumentBusy] = useState(false);
  const [generatedPdf, setGeneratedPdf] = useState<{ url: string; filename: string } | null>(null);
  const [isNewLetterOpen, setIsNewLetterOpen] = useState(false);
  const [newLetterTitle, setNewLetterTitle] = useState("");
  const [newLetterBody, setNewLetterBody] = useState(
    "To Whom It May Concern,\n\nWrite your letter content here."
  );
  const [newLetterTitleError, setNewLetterTitleError] = useState<string | null>(null);
  const [newLetterServerError, setNewLetterServerError] = useState<string | null>(null);
  const newLetterDialogTitleRef = useRef<HTMLHeadingElement>(null);
  const newLetterTitleInputRef = useRef<HTMLInputElement>(null);
  const letterEditorRef = useRef<RichTextEditorRef>(null);
  const letterCanvasRef = useRef<HTMLElement>(null);
  const authorizationRef = useRef<HTMLElement>(null);
  const sealDragRef = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const sealResizePointerRef = useRef<number | null>(null);
  const sealRotationPointerRef = useRef<{
    pointerId: number;
    centerX: number;
    centerY: number;
    angleOffset: number;
  } | null>(null);

  // Auto-incremented Reference Number Counter
  const [refNum, setRefNum] = useState(894);
  const [referencePrefix, setReferencePrefix] = useState("HE/HR");
  const [letterDate, setLetterDate] = useState(getLocalDateInputValue);
  const sealMaxX = Math.max(0, 100 - (sealSizeMm / 210) * 100);
  const sealMaxY = Math.max(0, 100 - (sealSizeMm / 297) * 100);

  const letterTemplatesQuery = useQuery<HrLetterTemplate[]>({
    queryKey: ["hr-letter-templates", scope],
    queryFn: fetchHrLetterTemplates,
  });
  const customLetterTemplates = letterTemplatesQuery.data ?? [];

  useEffect(
    () => () => {
      if (generatedPdf?.url) URL.revokeObjectURL(generatedPdf.url);
    },
    [generatedPdf]
  );

  useEffect(() => {
    if (!sealImage || sealPosition) return;

    const frame = window.requestAnimationFrame(() => {
      const canvas = letterCanvasRef.current;
      const authorization = authorizationRef.current;
      if (!canvas || !authorization) return;

      const canvasBounds = canvas.getBoundingClientRect();
      const authorizationBounds = authorization.getBoundingClientRect();
      if (canvasBounds.width === 0 || canvasBounds.height === 0) return;

      const sealWidth = canvasBounds.width * (sealSizeMm / 210);
      setSealPosition({
        x: clampNumber(
          ((authorizationBounds.right - canvasBounds.left - sealWidth) / canvasBounds.width) * 100,
          0,
          sealMaxX
        ),
        y: clampNumber(
          ((authorizationBounds.top - canvasBounds.top + 16) / canvasBounds.height) * 100,
          0,
          sealMaxY
        ),
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [sealImage, sealMaxX, sealMaxY, sealPosition, sealSizeMm]);

  useEffect(() => {
    setSealPosition((current) => {
      if (!current) return current;

      const next = {
        x: clampNumber(current.x, 0, sealMaxX),
        y: clampNumber(current.y, 0, sealMaxY),
      };

      return next.x === current.x && next.y === current.y ? current : next;
    });
  }, [sealMaxX, sealMaxY]);

  // Fetch Public Branding Settings for Logo & Company Details
  const { data: brandData, isLoading: isBrandLoading } = useQuery<{ data: PublicBrandSettings }>({
    queryKey: ["publicBrandSettings", "hr-forms", scope],
    queryFn: async () => {
      const res = await fetch(`${getBackendApiRoot()}/settings/brand/public`, {
        headers: {
          Accept: "application/json",
          ...getTenantHeaders(),
        },
      });
      if (!res.ok) throw new Error("Unable to load organization branding.");
      return res.json();
    },
  });
  const brand = brandData?.data;
  const configuredHeaderUrl = brand?.letterhead_header_url || brand?.header_image || null;
  const configuredFooterUrl = brand?.letterhead_footer_url || brand?.footer_image || null;
  const configuredLogoUrl = brand?.pdf_logo || brand?.logo_light || brand?.logo_dark || null;

  const brandAssetsQuery = useQuery<LetterBrandAssets>({
    queryKey: [
      "hr-letter-brand-assets",
      scope,
      configuredHeaderUrl,
      configuredFooterUrl,
      configuredLogoUrl,
    ],
    enabled: Boolean(brand),
    queryFn: async () => {
      const loadAsset = async (
        asset: "letterhead-header" | "letterhead-footer" | "pdf-logo",
        configuredUrl: string | null
      ) => {
        if (!configuredUrl) return null;
        if (configuredUrl.startsWith("data:image/")) return configuredUrl;

        const response = await fetch(`${getBackendApiRoot()}/settings/brand/assets/${asset}`, {
          headers: {
            Accept: "image/*",
            ...getTenantHeaders(),
          },
        });
        if (!response.ok) {
          throw new Error(`Unable to load the configured ${asset.replaceAll("-", " ")}.`);
        }

        return blobToDataUrl(await response.blob());
      };

      const [header, footer, logo] = await Promise.all([
        loadAsset("letterhead-header", configuredHeaderUrl),
        loadAsset("letterhead-footer", configuredFooterUrl),
        loadAsset("pdf-logo", configuredLogoUrl),
      ]);

      return { header, footer, logo };
    },
  });

  const brandAssetsReady =
    !isBrandLoading &&
    !brandAssetsQuery.isFetching &&
    (!configuredHeaderUrl || Boolean(brandAssetsQuery.data?.header)) &&
    (!configuredFooterUrl || Boolean(brandAssetsQuery.data?.footer)) &&
    (!configuredLogoUrl || Boolean(brandAssetsQuery.data?.logo));
  const headerImageSrc =
    brandAssetsQuery.data?.header || getBackendStorageUrl(configuredHeaderUrl) || null;
  const footerImageSrc =
    brandAssetsQuery.data?.footer || getBackendStorageUrl(configuredFooterUrl) || null;
  const logoImageSrc =
    brandAssetsQuery.data?.logo || getBackendStorageUrl(configuredLogoUrl) || null;
  const documentDate = new Date(`${letterDate}T12:00:00`);
  const formattedLetterDate = Number.isNaN(documentDate.getTime())
    ? letterDate
    : documentDate.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
  const normalizedReferencePrefix =
    referencePrefix.replace(/^\/+|\/+$/g, "") || "HE/HR";
  const referenceCode = `${normalizedReferencePrefix}/${documentDate.getFullYear() || new Date().getFullYear()}/${String(refNum).padStart(4, "0")}`;

  // Workflow Module Approvers Query
  const workflowApproversQuery = useQuery({
    queryKey: ['workflow-approvers-list', scope],
    queryFn: () => fetchApprovalRoles(),
  });

  const workflowRoles = workflowApproversQuery.data?.data ?? [
    { id: 1, name: "HR Director", users: [{ name: "Tewodros Kassahun", title: "Human Resources Director" }] },
    { id: 2, name: "General Manager", users: [{ name: "Mulugeta Tesfaye", title: "Managing Director" }] },
    { id: 3, name: "Finance Lead", users: [{ name: "Tsion Hailu", title: "Finance & Payroll Manager" }] },
    { id: 4, name: "Operations Head", users: [{ name: "Abebe Bikila", title: "Head of Operations" }] },
  ];
  const workflowSignerOptions = Array.isArray(workflowRoles)
    ? workflowRoles.flatMap((role: { id: number; name: string; users?: Array<{ id?: number; name: string; title?: string }> }) =>
        (role.users ?? []).map((user) => ({
          value: `${role.id}:${user.id ?? user.name}`,
          name: user.name,
          title: user.title || role.name,
        }))
      )
    : [];

  // Template Body Editor Content
  const getInitialContent = (tplId: string, emp: string, empId: string, pos: string, sal: string) => {
    if (tplId.startsWith("custom:")) {
      const customTemplate = customLetterTemplates.find(
        (template) => `custom:${template.id}` === tplId
      );

      return customTemplate?.body_html || "<p>Write your letter content here...</p>";
    }

    switch (tplId) {
      case "employment_confirmation":
        return `<p>To Whom It May Concern,</p><p>This is to certify that <strong>${emp}</strong> (Employee ID: <strong>${empId}</strong>) is a permanent full-time employee of <strong>Hive Enterprise Solutions</strong> working in the capacity of <strong>${pos}</strong>.</p><p>The employee currently earns a gross monthly salary of <strong>ETB ${sal}</strong> (Ethiopian Birr), subject to applicable Ethiopian statutory income tax (Proc. 979/2016) and pension deductions (7%).</p><p>This letter is issued upon the request of the employee for official bank / financial reference purposes.</p>`;
      case "experience_certificate":
        return `<p>To Whom It May Concern,</p><p>This letter certifies that <strong>${emp}</strong> (ID: <strong>${empId}</strong>) was employed with <strong>Hive Enterprise Solutions</strong> as <strong>${pos}</strong>.</p><p>During their tenure, they demonstrated outstanding technical competence, professionalism, and dedication to duty. Their services were satisfactory in all respects.</p>`;
      case "clearance_form":
        return `<p><strong>OFFICIAL EMPLOYEE CLEARANCE CERTIFICATE</strong></p><p>This clearance form confirms that employee <strong>${emp}</strong> (ID: <strong>${empId}</strong>) has successfully returned all company assets, cleared outstanding financial advances, and completed departmental handovers.</p><ul><li>IT Assets & Laptop: Cleared</li><li>Finance & Per Diem Advances: Cleared</li><li>HR Identity Card: Surrendered</li></ul>`;
      case "transfer_letter":
        return `<p><strong>NOTICE OF INTERNAL TRANSFER & ASSIGNMENT</strong></p><p>Dear <strong>${emp}</strong>,</p><p>You are hereby officially notified that effective from <strong>${new Date().toLocaleDateString()}</strong>, your assignment is transferred to the position of <strong>${pos}</strong> within Hive Enterprise Solutions.</p><p>All terms and conditions of your primary contract remain in full force.</p>`;
      case "warning_letter":
        return `<p><strong>ADMINISTRATIVE DISCIPLINARY WARNING NOTICE</strong></p><p>Dear <strong>${emp}</strong> (ID: <strong>${empId}</strong>),</p><p>This formal notice is issued in accordance with Ethiopian Labour Proclamation No. 1156/2019 regarding attendance and performance standards.</p><p>Please treat this document as a formal written warning (የጽሁፍ ማስጠንቀቂያ) to adhere strictly to operational protocols.</p>`;
      case "guarantor_form":
        return `<p><strong>የዋስትና ማረጋገጫ ውል (GUARANTOR AGREEMENT FORM)</strong></p><p>እኔ ስሜ ከዚህ በላይ የተጠቀሰው ሰራተኛ <strong>${emp}</strong> (ID: <strong>${empId}</strong>) በድርጅቱ ውስጥ ላለው የስራ ኃላፊነት እና ንብረት ሙሉ ዋስ መሆኔን በፊርማዬ አረጋግጣለሁ።</p>`;
      default:
        return `<p>Write customized document content here...</p>`;
    }
  };

  const [editorContent, setEditorContent] = useState(() =>
    getInitialContent(selectedTemplate, employeeName, employeeId, positionTitle, salaryAmount)
  );

  useEffect(() => {
    if (selectedTemplate.startsWith("custom:")) return;

    setEditorContent(
      getInitialContent(selectedTemplate, employeeName, employeeId, positionTitle, salaryAmount)
    );
  }, [selectedTemplate, employeeName, employeeId, positionTitle, salaryAmount]);

  const templates = [
    { id: "employment_confirmation", name: "Employment Confirmation Letter", icon: FileCheck },
    { id: "experience_certificate", name: "Work Experience Certificate", icon: Award },
    { id: "clearance_form", name: "Employee Clearance Letter", icon: UserMinus },
    { id: "transfer_letter", name: "Job Transfer & Assignment Letter", icon: UserCog },
    { id: "warning_letter", name: "Disciplinary Warning Form", icon: ShieldAlert },
    { id: "guarantor_form", name: "Guarantor Agreement Form (ተያዥ)", icon: HeartHandshake },
    ...customLetterTemplates.map((template) => ({
      id: `custom:${template.id}`,
      name: template.title,
      icon: FileText,
      isCustom: true,
    })),
  ];

  const handleTemplateChange = (tplId: string) => {
    setSelectedTemplate(tplId);
    setEditorContent(getInitialContent(tplId, employeeName, employeeId, positionTitle, salaryAmount));
  };

  const createLetterTemplateMutation = useMutation({
    mutationFn: createHrLetterTemplate,
    onSuccess: (template) => {
      queryClient.setQueryData<HrLetterTemplate[]>(
        ["hr-letter-templates", scope],
        (current) =>
          [...(current ?? []), template].sort((left, right) =>
            left.title.localeCompare(right.title)
          )
      );
      setSelectedTemplate(`custom:${template.id}`);
      setEditorContent(template.body_html);
      setIsNewLetterOpen(false);
      setNewLetterTitle("");
      setNewLetterBody("To Whom It May Concern,\n\nWrite your letter content here.");
      setNewLetterTitleError(null);
      setNewLetterServerError(null);
      toast.success(`“${template.title}” is ready to edit, print, and export.`);
    },
    onError: (error) => {
      setNewLetterServerError(
        error instanceof Error ? error.message : "The new letter could not be saved."
      );
    },
  });

  const handleNewLetterDialogChange = (open: boolean) => {
    if (!open && createLetterTemplateMutation.isPending) return;

    setIsNewLetterOpen(open);
    setNewLetterTitleError(null);
    setNewLetterServerError(null);
  };

  const handleCreateNewLetter = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = newLetterTitle.trim();

    if (!title) {
      setNewLetterTitleError("Enter a name for the new letter.");
      newLetterTitleInputRef.current?.focus();
      return;
    }

    setNewLetterTitleError(null);
    setNewLetterServerError(null);
    createLetterTemplateMutation.mutate({
      title,
      body_html: plainTextToLetterHtml(newLetterBody),
    });
  };

  const handleFileManagerSelect = async (file: LetterFileManagerFile) => {
    const purpose = filePickerPurpose;
    if (!purpose) return;

    const rawUrl = file.media_details?.url || file.url || file.path;
    const mimeType = file.media_details?.mime_type || "";
    const fileName =
      file.media_details?.download_name || file.media_details?.name || "selected media";

    if (!rawUrl) {
      toast.error("The selected File Manager item does not have a usable media URL.");
      return;
    }

    const resolvedUrl = getBackendStorageUrl(rawUrl) || rawUrl;

    if (purpose === "editor-media") {
      const normalizedName = fileName.toLowerCase();
      const mediaType =
        mimeType.startsWith("video/") || /\.(mp4|webm|mov)$/i.test(normalizedName)
          ? "video"
          : mimeType.startsWith("audio/") || /\.(mp3|wav|ogg|m4a)$/i.test(normalizedName)
            ? "audio"
            : "image";

      letterEditorRef.current?.insertMedia(resolvedUrl, mediaType, fileName);
      setFilePickerPurpose(null);
      toast.success(`${fileName} was added to the letter editor.`);
      return;
    }

    const isImage =
      mimeType.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(fileName);
    if (!isImage) {
      toast.error("Select a PNG, JPEG, or WEBP image for the organization seal.");
      return;
    }

    setIsFilePickerSelecting(true);
    try {
      const response = await fetch(resolvedUrl, {
        headers: getAuthHeaders({ Accept: "image/*" }),
      });
      if (!response.ok) {
        throw new Error("The selected seal image could not be loaded from File Manager.");
      }

      const blob = await response.blob();
      if (!blob.type.startsWith("image/")) {
        throw new Error("The selected File Manager item is not an image.");
      }
      if (blob.size > 2_000_000) {
        throw new Error("The seal image is too large. Select an image smaller than 2 MB.");
      }

      const selectedSeal = await blobToDataUrl(blob);
      setSealImage(await normalizeSealDataUrl(selectedSeal));
      setSealPosition(null);
      setIncludeSeal(true);
      setFilePickerPurpose(null);
      toast.success("Organization seal selected from File Manager.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to select the seal image.");
    } finally {
      setIsFilePickerSelecting(false);
    }
  };

  const changeSealSize = (nextSize: number) => {
    setSealSizeMm(
      Math.round(clampNumber(nextSize, MIN_SEAL_SIZE_MM, MAX_SEAL_SIZE_MM)),
    );
  };

  const updateSealPositionFromClient = (
    clientX: number,
    clientY: number,
    offsetX: number,
    offsetY: number
  ) => {
    const canvas = letterCanvasRef.current;
    if (!canvas) return;

    const canvasBounds = canvas.getBoundingClientRect();
    if (canvasBounds.width === 0 || canvasBounds.height === 0) return;

    setSealPosition({
      x: clampNumber(
        ((clientX - canvasBounds.left - offsetX) / canvasBounds.width) * 100,
        0,
        sealMaxX
      ),
      y: clampNumber(
        ((clientY - canvasBounds.top - offsetY) / canvasBounds.height) * 100,
        0,
        sealMaxY
      ),
    });
  };

  const handleSealPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!sealPosition || event.pointerType === "mouse") return;

    event.preventDefault();
    const sealBounds = event.currentTarget.getBoundingClientRect();
    sealDragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - sealBounds.left,
      offsetY: event.clientY - sealBounds.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleSealPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") return;
    const drag = sealDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    updateSealPositionFromClient(event.clientX, event.clientY, drag.offsetX, drag.offsetY);
  };

  const handleSealPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") return;
    if (sealDragRef.current?.pointerId !== event.pointerId) return;
    sealDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleSealMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!sealPosition || event.button !== 0) return;

    event.preventDefault();
    const sealBounds = event.currentTarget.getBoundingClientRect();
    const offsetX = event.clientX - sealBounds.left;
    const offsetY = event.clientY - sealBounds.top;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      updateSealPositionFromClient(moveEvent.clientX, moveEvent.clientY, offsetX, offsetY);
    };
    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp, { once: true });
  };

  const updateSealSizeFromClient = (clientX: number) => {
    const canvas = letterCanvasRef.current;
    if (!canvas || !sealPosition) return;

    const canvasBounds = canvas.getBoundingClientRect();
    if (canvasBounds.width === 0) return;

    const sealLeft = canvasBounds.left + (sealPosition.x / 100) * canvasBounds.width;
    changeSealSize(((clientX - sealLeft) / canvasBounds.width) * 210);
  };

  const handleSealResizePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    sealResizePointerRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleSealResizePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (sealResizePointerRef.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    updateSealSizeFromClient(event.clientX);
  };

  const handleSealResizePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (sealResizePointerRef.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    sealResizePointerRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const updateSealRotationFromClient = (
    clientX: number,
    clientY: number,
    centerX: number,
    centerY: number,
    angleOffset: number,
    snap: boolean,
  ) => {
    const pointerAngle = (Math.atan2(clientY - centerY, clientX - centerX) * 180) / Math.PI;
    const nextRotation = pointerAngle + angleOffset;
    setSealRotationDeg(
      normalizeDegrees(snap ? Math.round(nextRotation / 15) * 15 : nextRotation),
    );
  };

  const handleSealRotationPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const sealBounds = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!sealBounds) return;

    const centerX = sealBounds.left + sealBounds.width / 2;
    const centerY = sealBounds.top + sealBounds.height / 2;
    const pointerAngle =
      (Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180) / Math.PI;
    sealRotationPointerRef.current = {
      pointerId: event.pointerId,
      centerX,
      centerY,
      angleOffset: sealRotationDeg - pointerAngle,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleSealRotationPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const rotation = sealRotationPointerRef.current;
    if (!rotation || rotation.pointerId !== event.pointerId) return;

    event.preventDefault();
    event.stopPropagation();
    updateSealRotationFromClient(
      event.clientX,
      event.clientY,
      rotation.centerX,
      rotation.centerY,
      rotation.angleOffset,
      event.shiftKey,
    );
  };

  const handleSealRotationPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (sealRotationPointerRef.current?.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    sealRotationPointerRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const prepareLetterForOutput = async () => {
    const element = document.getElementById("hr-printable-letter");
    if (!element) throw new Error("The letter preview is not available.");
    if (!brandAssetsReady) {
      throw new Error("The organization letterhead is still loading. Please try again.");
    }

    element.classList.add("letter-exporting");
    await new Promise<void>((resolve) =>
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()))
    );
    await waitForDocumentImages(element);

    return element;
  };

  const handlePrint = async () => {
    setIsDocumentBusy(true);
    try {
      const element = await prepareLetterForOutput();
      window.addEventListener(
        "afterprint",
        () => {
          element.classList.remove("letter-exporting");
          setIsDocumentBusy(false);
        },
        { once: true }
      );
      window.print();
      window.setTimeout(() => {
        element.classList.remove("letter-exporting");
        setIsDocumentBusy(false);
      }, 1_500);
    } catch (error) {
      setIsDocumentBusy(false);
      toast.error(error instanceof Error ? error.message : "Unable to prepare the letter for printing.");
    }
  };

  const handleDownloadPdf = async () => {
    setIsDocumentBusy(true);
    try {
      toast.info("Generating official A4 PDF letter…");
      const pdfSealImage =
        includeSeal && sealImage ? await normalizeSealDataUrl(sealImage) : null;
      const response = await fetch(`${getBackendApiRoot()}/hr/forms/pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/pdf",
          ...getAuthHeaders(),
          ...getTenantHeaders(),
        },
        body: JSON.stringify({
          template_name:
            templates.find((template) => template.id === selectedTemplate)?.name || "HR Letter",
          body_html: editorContent,
          letter_date: letterDate,
          reference_code: referenceCode,
          signer_name: signerName,
          signer_title: signerTitle,
          signature_image: signerImage,
          include_seal: includeSeal,
          seal_image: pdfSealImage,
          seal_size_mm: pdfSealImage ? sealSizeMm : null,
          seal_position_x: pdfSealImage ? sealPosition?.x ?? null : null,
          seal_position_y: pdfSealImage ? sealPosition?.y ?? null : null,
          seal_rotation_deg: pdfSealImage ? sealRotationDeg : null,
        }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(errorPayload?.message || "The server could not generate the PDF.");
      }

      const blob = await response.blob();
      if (blob.type !== "application/pdf" || blob.size === 0) {
        throw new Error("The server returned an invalid PDF file.");
      }

      const contentDisposition = response.headers.get("Content-Disposition") || "";
      const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
      const filename =
        filenameMatch?.[1] ||
        `Official_Letter_${selectedTemplate}_${referenceCode.replaceAll("/", "-")}.pdf`;
      const objectUrl = URL.createObjectURL(blob);
      setGeneratedPdf({ url: objectUrl, filename });
      window.requestAnimationFrame(() => {
        document.getElementById("hr-generated-pdf-download")?.click();
      });

      toast.success("A4 PDF is ready with the organization letterhead.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to generate the PDF.");
    } finally {
      setIsDocumentBusy(false);
    }
  };

  return (
    <Card className="border-slate-300 dark:border-slate-700">
      <CardContent className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
          <div>
            <h2 className="text-xl font-black flex items-center gap-2">
              <FileText aria-hidden="true" className="h-5 w-5 text-amber-500" />
              HR Form Templates & Official Letter Generator
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Interactive Rich Text Editor for HR documents with digital signature & official company stamp.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={() => setIsNewLetterOpen(true)}
              className="h-11 bg-slate-900 font-bold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
            >
              <FilePlus2 aria-hidden="true" className="mr-2 h-4 w-4" />
              New letter
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isDocumentBusy}
              onClick={() => {
                setEditorContent(getInitialContent(selectedTemplate, employeeName, employeeId, positionTitle, salaryAmount));
                toast.info("Template content reset.");
              }}
            >
              Reset Template
            </Button>
            <Button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isDocumentBusy}
              className="bg-emerald-700 font-bold text-white hover:bg-emerald-800"
            >
              <Download aria-hidden="true" className="mr-2 h-4 w-4" />
              {isDocumentBusy ? "Preparing…" : "Download PDF"}
            </Button>
            <Button
              type="button"
              onClick={handlePrint}
              disabled={isDocumentBusy || !brandAssetsReady}
              className="bg-amber-400 font-bold text-slate-950 hover:bg-amber-300"
            >
              <Printer aria-hidden="true" className="mr-2 h-4 w-4" />
              Print Letter (A4)
            </Button>
            {generatedPdf ? (
              <Button asChild type="button" variant="outline">
                <a
                  id="hr-generated-pdf-download"
                  href={generatedPdf.url}
                  download={generatedPdf.filename}
                >
                  <Download aria-hidden="true" className="mr-2 h-4 w-4" />
                  Save generated PDF
                </a>
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
          {/* TEMPLATE & PARAMETER SIDEBAR */}
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase text-slate-600 dark:text-slate-300">
                Available HR templates
              </h3>
              {letterTemplatesQuery.isError ? (
                <p className="rounded-lg border border-red-300 bg-red-50 p-2 text-xs font-semibold text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
                  Custom letters could not be loaded. Built-in letters are still available.
                </p>
              ) : null}
              {templates.map((tpl) => {
                const Icon = tpl.icon;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => handleTemplateChange(tpl.id)}
                    aria-current={selectedTemplate === tpl.id ? "true" : undefined}
                    className={cn(
                      "flex min-h-11 w-full items-center gap-3 rounded-xl border p-3 text-left text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700 focus-visible:ring-offset-2 dark:focus-visible:ring-amber-300",
                      selectedTemplate === tpl.id
                        ? "border-amber-400 bg-amber-50 text-amber-950 dark:bg-amber-950 dark:text-amber-100"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
                    )}
                  >
                    <Icon aria-hidden="true" className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <span className="flex-1">{tpl.name}</span>
                    {"isCustom" in tpl && tpl.isCustom ? (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-800 dark:bg-slate-700 dark:text-slate-100">
                        Custom
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="space-y-3 rounded-xl border p-4 bg-slate-50 dark:bg-slate-900">
              <Label className="text-xs font-bold uppercase">Pre-fill Parameters</Label>
              <div>
                <Label htmlFor="tpl-emp">Employee Name</Label>
                <Input
                  id="tpl-emp"
                  value={employeeName}
                  onChange={(e) => {
                    setEmployeeName(e.target.value);
                  }}
                  className="h-9 text-xs"
                />
              </div>
              <div>
                <Label htmlFor="tpl-id">Employee ID</Label>
                <Input
                  id="tpl-id"
                  value={employeeId}
                  onChange={(e) => {
                    setEmployeeId(e.target.value);
                  }}
                  className="h-9 text-xs"
                />
              </div>
              <div>
                <Label htmlFor="tpl-pos">Position</Label>
                <Input
                  id="tpl-pos"
                  value={positionTitle}
                  onChange={(e) => {
                    setPositionTitle(e.target.value);
                  }}
                  className="h-9 text-xs"
                />
              </div>
              <div>
                <Label htmlFor="tpl-sal">Gross Salary (ETB)</Label>
                <Input
                  id="tpl-sal"
                  value={salaryAmount}
                  onChange={(e) => setSalaryAmount(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div>
                <Label htmlFor="letter-date">Letter date</Label>
                <Input
                  id="letter-date"
                  type="date"
                  value={letterDate}
                  onChange={(event) => setLetterDate(event.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div>
                <Label htmlFor="letter-reference-prefix">Reference prefix</Label>
                <Input
                  id="letter-reference-prefix"
                  value={referencePrefix}
                  maxLength={40}
                  autoCapitalize="characters"
                  spellCheck={false}
                  aria-describedby="letter-reference-prefix-help"
                  onChange={(event) =>
                    setReferencePrefix(
                      event.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9/_.-]/g, "")
                        .replace(/\/{2,}/g, "/")
                        .slice(0, 40),
                    )
                  }
                  onBlur={() =>
                    setReferencePrefix((current) =>
                      current.replace(/^\/+|\/+$/g, "") || "HE/HR",
                    )
                  }
                  className="h-9 border-slate-500 font-mono text-xs uppercase focus-visible:ring-slate-700 dark:border-slate-400 dark:focus-visible:ring-amber-300"
                />
                <p
                  id="letter-reference-prefix-help"
                  className="mt-1 text-xs text-slate-600 dark:text-slate-300"
                >
                  Examples: HE/HR, FIN/PR, or OPS.
                </p>
              </div>
              <div>
                <Label htmlFor="letter-reference">Reference sequence</Label>
                <div className="flex gap-2">
                  <Input
                    id="letter-reference"
                    type="number"
                    min={1}
                    value={refNum}
                    onChange={(event) => setRefNum(Math.max(1, Number(event.target.value) || 1))}
                    className="h-9 text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setRefNum((previous) => previous + 1)}
                    aria-label="Use next reference sequence"
                  >
                    Next
                  </Button>
                </div>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  Printed as <span className="font-mono font-semibold">{referenceCode}</span>
                </p>
              </div>

              <section
                aria-labelledby="authorization-prefill-heading"
                className="space-y-3 border-t border-slate-400 pt-4 dark:border-slate-500"
              >
                <div>
                  <h3
                    id="authorization-prefill-heading"
                    className="text-xs font-black uppercase tracking-wide text-amber-700 dark:text-amber-300"
                  >
                    Authorized signature and seal
                  </h3>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                    Prefill the signer, signature, and organization seal used in the letter preview and exports.
                  </p>
                </div>
              <div>
                <Label htmlFor="wf-signer">Select Signer from Workflow Approvers</Label>
                <select
                  id="wf-signer"
                  onChange={(e) => {
                    const signer = workflowSignerOptions.find((option) => option.value === e.target.value);
                    if (signer) {
                      setSignerName(signer.name);
                      setSignerTitle(signer.title);
                      toast.success("Workflow signer selected.");
                    }
                  }}
                  className="h-11 w-full rounded-md border border-slate-500 bg-background px-2 text-xs font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-slate-700 dark:border-slate-400 dark:focus-visible:ring-amber-300"
                  defaultValue=""
                >
                  <option value="" disabled>
                    {workflowApproversQuery.isLoading ? "Loading workflow approvers…" : "Choose an approver"}
                  </option>
                  {workflowSignerOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.name} ({option.title})
                    </option>
                  ))}
                </select>
                {!workflowApproversQuery.isLoading && workflowSignerOptions.length === 0 ? (
                  <p className="mt-1 text-xs text-red-700 dark:text-red-300">
                    No users are assigned to an active workflow approval role.
                  </p>
                ) : null}
              </div>

              <div>
                <Label htmlFor="sig-name">Signer Name</Label>
                <Input
                  id="sig-name"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  className="h-11 border-slate-500 text-xs dark:border-slate-400"
                />
              </div>
              <div>
                <Label htmlFor="sig-title">Signer Title</Label>
                <Input
                  id="sig-title"
                  value={signerTitle}
                  onChange={(e) => setSignerTitle(e.target.value)}
                  className="h-11 border-slate-500 text-xs dark:border-slate-400"
                />
              </div>

              <div className="space-y-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsSignaturePadOpen(true)}
                  className="min-h-11 w-full gap-2 border-amber-700 text-xs font-bold text-amber-800 hover:bg-amber-100 dark:border-amber-300 dark:text-amber-200 dark:hover:bg-amber-950"
                >
                  <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
                  {signerImage ? "Replace digital signature" : "Draw digital signature"}
                </Button>
                {signerImage ? (
                  <div className="rounded-lg border border-slate-500 bg-white p-2">
                    <img
                      src={signerImage}
                      alt={`Signature preview for ${signerName}`}
                      className="h-14 w-full object-contain object-left"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      className="mt-1 min-h-11 w-full text-xs font-bold text-red-700 hover:bg-red-50 hover:text-red-800"
                      onClick={() => setSignerImage(null)}
                    >
                      Remove signature
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    No drawn signature selected. The signer name will be used as the fallback signature.
                  </p>
                )}
              </div>

              <div className="space-y-3 rounded-xl border border-slate-500 p-3 dark:border-slate-400">
                <div>
                  <p id="seal-controls-heading" className="text-sm font-black">
                    Organization seal image
                  </p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                    Configure the seal here or use the contained resize and rotation handles
                    directly in the letter preview.
                  </p>
                </div>
                {sealImage ? (
                  <div className="space-y-3">
                    <div className="grid gap-3 rounded-xl border border-slate-500 bg-white p-3 sm:grid-cols-[128px_1fr] sm:items-center dark:border-slate-600">
                      <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-xl border border-slate-500 bg-slate-100 p-3">
                        <img
                          src={sealImage}
                          alt="Selected organization seal preview"
                          className="max-h-full max-w-full object-contain"
                          style={{ transform: `rotate(${sealRotationDeg}deg)` }}
                        />
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs font-bold text-slate-800">Output preview</p>
                        <p className="text-xs text-slate-600">
                          {sealSizeMm} mm at {sealRotationDeg} degrees. The seal is normalized
                          to PNG for reliable printing and PDF generation.
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11 w-full border-red-700 text-xs font-bold text-red-700 hover:bg-red-50"
                          onClick={() => {
                            setSealImage(null);
                            setSealPosition(null);
                          }}
                        >
                          Remove custom seal
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-4 rounded-xl border border-slate-500 bg-slate-100 p-3 dark:border-slate-400 dark:bg-slate-950">
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="seal-size" className="text-xs font-bold">
                          Seal size
                        </Label>
                        <output
                          htmlFor="seal-size"
                          className="rounded-md bg-slate-800 px-2 py-1 font-mono text-xs font-bold text-white dark:bg-slate-100 dark:text-slate-950"
                        >
                          {sealSizeMm} mm
                        </output>
                      </div>
                      <div className="grid grid-cols-[44px_1fr_44px] items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-11 w-11 border-slate-600 focus-visible:ring-slate-700 dark:border-slate-300 dark:focus-visible:ring-amber-300"
                          onClick={() => changeSealSize(sealSizeMm - 5)}
                          disabled={sealSizeMm <= MIN_SEAL_SIZE_MM}
                          aria-label="Make seal smaller"
                        >
                          <Minus aria-hidden="true" className="h-4 w-4" />
                        </Button>
                        <input
                          id="seal-size"
                          type="range"
                          min={MIN_SEAL_SIZE_MM}
                          max={MAX_SEAL_SIZE_MM}
                          step={1}
                          value={sealSizeMm}
                          onChange={(event) => changeSealSize(Number(event.target.value))}
                          aria-describedby="seal-position-help"
                          aria-valuetext={`${sealSizeMm} millimetres`}
                          className="h-11 w-full cursor-pointer accent-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700 focus-visible:ring-offset-2 dark:accent-cyan-300 dark:focus-visible:ring-amber-300"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-11 w-11 border-slate-600 focus-visible:ring-slate-700 dark:border-slate-300 dark:focus-visible:ring-amber-300"
                          onClick={() => changeSealSize(sealSizeMm + 5)}
                          disabled={sealSizeMm >= MAX_SEAL_SIZE_MM}
                          aria-label="Make seal bigger"
                        >
                          <Plus aria-hidden="true" className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                        Range: {MIN_SEAL_SIZE_MM}-{MAX_SEAL_SIZE_MM} mm
                      </p>

                      <div className="space-y-2 border-t border-slate-400 pt-3 dark:border-slate-600">
                        <div className="flex items-center justify-between gap-3">
                          <Label htmlFor="seal-rotation" className="text-xs font-bold">
                            Seal rotation
                          </Label>
                          <output
                            htmlFor="seal-rotation"
                            className="rounded-md bg-slate-800 px-2 py-1 font-mono text-xs font-bold text-white dark:bg-slate-100 dark:text-slate-950"
                          >
                            {sealRotationDeg}°
                          </output>
                        </div>
                        <div className="grid grid-cols-[44px_1fr_44px] items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-11 w-11 border-slate-600 focus-visible:ring-slate-700 dark:border-slate-300 dark:focus-visible:ring-amber-300"
                            onClick={() => setSealRotationDeg((current) => normalizeDegrees(current - 15))}
                            aria-label="Rotate seal 15 degrees counter-clockwise"
                          >
                            <RotateCcw aria-hidden="true" className="h-4 w-4" />
                          </Button>
                          <input
                            id="seal-rotation"
                            type="range"
                            min={-180}
                            max={180}
                            step={1}
                            value={sealRotationDeg}
                            onChange={(event) =>
                              setSealRotationDeg(normalizeDegrees(Number(event.target.value)))
                            }
                            aria-describedby="seal-position-help"
                            aria-valuetext={`${sealRotationDeg} degrees`}
                            className="h-11 w-full cursor-pointer accent-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700 focus-visible:ring-offset-2 dark:accent-cyan-300 dark:focus-visible:ring-amber-300"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-11 w-11 border-slate-600 focus-visible:ring-slate-700 dark:border-slate-300 dark:focus-visible:ring-amber-300"
                            onClick={() => setSealRotationDeg((current) => normalizeDegrees(current + 15))}
                            aria-label="Rotate seal 15 degrees clockwise"
                          >
                            <RotateCw aria-hidden="true" className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label htmlFor="seal-horizontal" className="text-xs font-bold">
                            Horizontal position
                          </Label>
                          <input
                            id="seal-horizontal"
                            type="range"
                            min={0}
                            max={sealMaxX}
                            step={0.25}
                            value={sealPosition?.x ?? 0}
                            onChange={(event) =>
                              setSealPosition((current) => ({
                                x: Number(event.target.value),
                                y: current?.y ?? 0,
                              }))
                            }
                            aria-describedby="seal-position-help"
                            className="h-11 w-full cursor-pointer accent-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700 focus-visible:ring-offset-2 dark:accent-cyan-300 dark:focus-visible:ring-amber-300"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="seal-vertical" className="text-xs font-bold">
                            Vertical position
                          </Label>
                          <input
                            id="seal-vertical"
                            type="range"
                            min={0}
                            max={sealMaxY}
                            step={0.25}
                            value={sealPosition?.y ?? 0}
                            onChange={(event) =>
                              setSealPosition((current) => ({
                                x: current?.x ?? 0,
                                y: Number(event.target.value),
                              }))
                            }
                            aria-describedby="seal-position-help"
                            className="h-11 w-full cursor-pointer accent-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700 focus-visible:ring-offset-2 dark:accent-cyan-300 dark:focus-visible:ring-amber-300"
                          />
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11 border-slate-600 text-xs font-bold dark:border-slate-300"
                          onClick={() => setSealPosition(null)}
                        >
                          <Move aria-hidden="true" className="mr-2 h-4 w-4" />
                          Reset position
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11 border-slate-600 text-xs font-bold dark:border-slate-300"
                          onClick={() => {
                            setSealSizeMm(DEFAULT_SEAL_SIZE_MM);
                            setSealRotationDeg(0);
                          }}
                        >
                          <RotateCcw aria-hidden="true" className="mr-2 h-4 w-4" />
                          Reset size & rotation
                        </Button>
                      </div>
                      <p
                        id="seal-position-help"
                        className="flex items-start gap-2 text-xs font-medium text-slate-700 dark:text-slate-200"
                      >
                        <Move aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                        Resize and rotate the seal with these pre-fill controls or the handles
                        inside the letter preview. Use the position sliders or drag the seal
                        itself to move it. Print and PDF output use these exact values.
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    No uploaded seal selected. The generated organization stamp will be used.
                  </p>
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 w-full border-cyan-700 text-xs font-bold text-cyan-800 hover:bg-cyan-50 dark:border-cyan-300 dark:text-cyan-200 dark:hover:bg-cyan-950"
                  onClick={() => setFilePickerPurpose("seal")}
                >
                  <FolderOpen aria-hidden="true" className="mr-2 h-4 w-4" />
                  Choose seal from File Manager
                </Button>
              </div>

              <div className="flex min-h-11 items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="inc-seal"
                  checked={includeSeal}
                  onChange={(e) => setIncludeSeal(e.target.checked)}
                  className="h-5 w-5 rounded border-slate-600 text-amber-600 focus-visible:ring-2 focus-visible:ring-slate-700 dark:border-slate-300 dark:focus-visible:ring-amber-300"
                />
                <Label htmlFor="inc-seal" className="text-xs font-bold cursor-pointer">
                  Include Official Company Seal / Stamp
                </Label>
              </div>
              </section>
            </div>
          </div>

          {/* PRINT-ONLY & A4 SPECIFIC STYLES */}
          <style dangerouslySetInnerHTML={{ __html: `
            @page {
              size: A4 portrait;
              margin: 0;
            }
            #hr-printable-letter .letter-rendered-body {
              display: none;
            }
            #hr-printable-letter.letter-exporting {
              border: 0 !important;
              border-radius: 0 !important;
              box-shadow: none !important;
            }
            #hr-printable-letter.letter-exporting .letter-editor-chrome {
              display: none !important;
            }
            #hr-printable-letter.letter-exporting .letter-rendered-body {
              display: block !important;
              flex: none !important;
            }
            #hr-printable-letter.letter-exporting .letter-screen-only,
            #hr-printable-letter.letter-exporting .letter-export-hidden {
              display: none !important;
            }
            #hr-printable-letter .letter-signature-image,
            #hr-printable-letter .letter-seal-image {
              display: block;
              visibility: visible;
              opacity: 1;
            }
            #hr-printable-letter.letter-exporting .letter-seal-positioner {
              display: block !important;
              width: var(--seal-print-size) !important;
              height: var(--seal-print-size) !important;
              background: transparent !important;
              box-shadow: none !important;
              cursor: default !important;
              outline: 0 !important;
            }
            #hr-printable-letter.letter-exporting .letter-seal-rotated,
            #hr-printable-letter.letter-exporting .letter-seal-image {
              display: block !important;
              width: 100% !important;
              height: 100% !important;
              object-fit: contain !important;
            }
            #hr-printable-letter .letter-rendered-body p {
              margin: 0 0 1rem;
            }
            #hr-printable-letter .letter-rendered-body ul,
            #hr-printable-letter .letter-rendered-body ol {
              margin: 0 0 1rem 1.25rem;
            }
            #hr-printable-letter .letter-rendered-body ul {
              list-style: disc;
            }
            #hr-printable-letter .letter-rendered-body ol {
              list-style: decimal;
            }
            @media print {
              html, body {
                width: 210mm !important;
                height: 297mm !important;
                margin: 0 !important;
                padding: 0 !important;
                background: white !important;
              }
              body * {
                visibility: hidden !important;
              }
              #hr-printable-letter, #hr-printable-letter * {
                visibility: visible !important;
              }
              #hr-printable-letter {
                position: fixed !important;
                left: 0 !important;
                top: 0 !important;
                width: 210mm !important;
                height: 297mm !important;
                min-height: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                border-radius: 0 !important;
                box-shadow: none !important;
                background: white !important;
                color: black !important;
                box-sizing: border-box !important;
                overflow: hidden !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              #hr-printable-letter .letter-editor-chrome,
              #hr-printable-letter .letter-screen-only,
              #hr-printable-letter .letter-export-hidden {
                display: none !important;
              }
              #hr-printable-letter .letter-rendered-body {
                display: block !important;
                flex: none !important;
              }
              #hr-printable-letter > header,
              #hr-printable-letter .letter-metadata {
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
                position: relative !important;
                z-index: 2 !important;
              }
              #hr-printable-letter .letter-metadata,
              #hr-printable-letter .letter-metadata * {
                color: #020617 !important;
              }
              #hr-printable-letter .letter-metadata dd {
                border-bottom-color: #0e7490 !important;
              }
              #hr-printable-letter .letter-signature-image,
              #hr-printable-letter .letter-seal-image {
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
                break-inside: avoid !important;
              }
              #hr-printable-letter .letter-seal-positioner {
                display: block !important;
                width: var(--seal-print-size) !important;
                height: var(--seal-print-size) !important;
                background: transparent !important;
                box-shadow: none !important;
                cursor: default !important;
                outline: 0 !important;
              }
              #hr-printable-letter .letter-seal-rotated,
              #hr-printable-letter .letter-seal-image {
                display: block !important;
                width: 100% !important;
                height: 100% !important;
                object-fit: contain !important;
              }
            }
          ` }} />

          {/* EDITABLE RICH TEXT A4 DOCUMENT CANVAS */}
          <article
            ref={letterCanvasRef}
            id="hr-printable-letter"
            aria-label={`${templates.find((template) => template.id === selectedTemplate)?.name || "HR letter"} preview`}
            className="relative mx-auto flex h-[297mm] w-full max-w-[210mm] flex-col overflow-hidden rounded-2xl border border-slate-300 bg-white text-slate-950 shadow-2xl"
          >
            {includeSeal && sealImage && sealPosition ? (
              <div
                className="letter-seal-positioner absolute z-20 cursor-move touch-none select-none"
                style={{
                  left: `${sealPosition.x}%`,
                  top: `${sealPosition.y}%`,
                  width: `${(sealSizeMm / 210) * 100}%`,
                  height: `${(sealSizeMm / 297) * 100}%`,
                  "--seal-print-size": `${sealSizeMm}mm`,
                } as React.CSSProperties}
                onMouseDown={handleSealMouseDown}
                onPointerDown={handleSealPointerDown}
                onPointerMove={handleSealPointerMove}
                onPointerUp={handleSealPointerEnd}
                onPointerCancel={handleSealPointerEnd}
                title="Drag to reposition the organization seal"
              >
                <div
                  className="letter-seal-rotated h-full w-full origin-center"
                  style={{ transform: `rotate(${sealRotationDeg}deg)` }}
                >
                  <img
                    src={sealImage}
                    alt={`${brand?.app_title || "Organization"} official seal`}
                    draggable={false}
                    className="letter-seal-image pointer-events-none h-full w-full object-contain"
                  />
                </div>
                <div
                  aria-hidden="true"
                  className="letter-screen-only absolute left-1 top-1 z-30 flex h-11 w-11 cursor-grab touch-none items-center justify-center rounded-lg border-2 border-white bg-cyan-900 text-white shadow-lg active:cursor-grabbing"
                  onMouseDown={(event) => event.stopPropagation()}
                  onPointerDown={handleSealRotationPointerDown}
                  onPointerMove={handleSealRotationPointerMove}
                  onPointerUp={handleSealRotationPointerEnd}
                  onPointerCancel={handleSealRotationPointerEnd}
                  title="Drag to rotate the organization seal. Hold Shift to snap to 15-degree increments."
                >
                  <RotateCw aria-hidden="true" className="h-5 w-5" />
                </div>
                <div
                  aria-hidden="true"
                  className="letter-screen-only absolute bottom-1 right-1 z-30 flex h-11 w-11 cursor-nwse-resize touch-none items-center justify-center rounded-lg border-2 border-white bg-cyan-900 text-white shadow-lg"
                  onMouseDown={(event) => event.stopPropagation()}
                  onPointerDown={handleSealResizePointerDown}
                  onPointerMove={handleSealResizePointerMove}
                  onPointerUp={handleSealResizePointerEnd}
                  onPointerCancel={handleSealResizePointerEnd}
                  title="Drag to resize the organization seal"
                >
                  <span className="h-5 w-5 rounded-sm border-b-[3px] border-r-[3px] border-white" />
                </div>
              </div>
            ) : null}

            <header className="shrink-0">
              {headerImageSrc ? (
                <img
                  src={headerImageSrc}
                  alt={`${brand?.app_title || "Organization"} letterhead`}
                  className="block h-auto w-full object-contain"
                />
              ) : (
                <div className="mx-[15mm] border-b-2 border-slate-900 py-5 font-sans">
                  <div className="flex items-center gap-3">
                    {logoImageSrc ? (
                      <img
                        src={logoImageSrc}
                        alt={`${brand?.app_title || "Organization"} logo`}
                        className="h-12 w-auto object-contain"
                      />
                    ) : (
                      <div
                        aria-hidden="true"
                        className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-700 text-xl font-black text-white"
                      >
                        {(brand?.app_title || "H").slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-xl font-black uppercase tracking-wider">
                        {brand?.app_title || "HIVE.OS"}
                      </p>
                      <p className="text-xs font-bold text-cyan-800">
                        Human Resources Management Department
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <dl className="letter-metadata mx-[15mm] mt-2 space-y-1 text-right font-sans text-xs font-bold">
                <div className="flex items-center justify-end gap-2">
                  <dt className="text-slate-700">Date:</dt>
                  <dd className="min-w-40 border-b-2 border-cyan-700 px-2 pb-0.5 text-slate-950">
                    {formattedLetterDate}
                  </dd>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <dt className="text-slate-700">Reference No:</dt>
                  <dd className="min-w-40 border-b-2 border-cyan-700 px-2 pb-0.5 font-mono font-extrabold text-cyan-800">
                    {referenceCode}
                  </dd>
                </div>
              </dl>
            </header>

            <div className="flex min-h-0 flex-1 flex-col px-[15mm] pb-4 pt-5">
              <h3 className="text-center font-sans text-lg font-bold underline">
                {templates.find((template) => template.id === selectedTemplate)?.name.toUpperCase()}
              </h3>

              <div className="letter-editor-chrome mt-4 rounded-xl border border-slate-500 bg-slate-50">
                <RichTextEditor
                  ref={letterEditorRef}
                  value={editorContent}
                  onChange={setEditorContent}
                  placeholder="Edit your HR letter body content..."
                  appearance="document"
                  onOpenMediaPicker={() => setFilePickerPurpose("editor-media")}
                />
              </div>
              <div
                className="letter-rendered-body mt-5 font-serif text-[12.5px] leading-7 text-slate-950"
                dangerouslySetInnerHTML={{ __html: editorContent }}
              />

              <section
                ref={authorizationRef}
                aria-label="Authorization"
                className="mt-5 flex break-inside-avoid items-end justify-between gap-6 border-t border-slate-300 pt-4"
              >
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-700">Authorized signature and seal</p>
                  <div className="flex min-h-12 w-64 flex-col justify-end border-b-2 border-slate-900 pb-1">
                    {signerImage ? (
                      <img
                        src={signerImage}
                        alt={`Signature of ${signerName}`}
                        className="letter-signature-image h-12 w-auto object-contain object-left"
                      />
                    ) : (
                      <span className="font-serif text-lg font-bold italic text-amber-800">
                        {signerName}
                      </span>
                    )}
                  </div>
                  <p className="font-sans text-sm font-bold">{signerName}</p>
                  <p className="text-xs font-semibold text-slate-700">{signerTitle}</p>
                  <p className="letter-export-hidden font-mono text-[10px] text-slate-600">
                    Workflow approved · {letterDate}
                  </p>
                </div>

                {includeSeal ? (
                  sealImage ? (
                    sealPosition ? (
                      <div aria-hidden="true" className="h-24 w-24 shrink-0" />
                    ) : (
                      <img
                        src={sealImage}
                        alt={`${brand?.app_title || "Organization"} official seal`}
                        className="letter-seal-image h-24 w-24 object-contain"
                      />
                    )
                  ) : (
                    <div
                      aria-label="Generated official organization seal"
                      className="flex h-24 w-24 rotate-[-12deg] items-center justify-center rounded-full border-4 border-dashed border-red-700 p-2 text-center"
                    >
                      <div className="text-[9px] font-black uppercase leading-tight tracking-tighter text-red-700">
                        ★ OFFICIAL SEAL ★<br />
                        {brand?.app_title || "HIVE.OS"}<br />
                        ADDIS ABABA
                      </div>
                    </div>
                  )
                ) : null}
              </section>
            </div>

            <footer className="mt-auto shrink-0">
              {footerImageSrc ? (
                <img
                  src={footerImageSrc}
                  alt={`${brand?.app_title || "Organization"} letterhead footer`}
                  className="block h-auto w-full object-contain"
                />
              ) : (
                <div className="mx-[15mm] border-t border-slate-300 py-4 text-right font-sans text-[11px] text-cyan-800">
                  {brand?.email ? <p className="font-bold">{brand.email}</p> : null}
                  {brand?.phone_number ? <p className="font-semibold">{brand.phone_number}</p> : null}
                  {brand?.address ? <p className="text-slate-700">{brand.address}</p> : null}
                  {brand?.website ? <p className="text-slate-700">{brand.website}</p> : null}
                </div>
              )}
            </footer>
          </article>
        </div>

        <Dialog open={isNewLetterOpen} onOpenChange={handleNewLetterDialogChange}>
          <DialogContent
            className="max-h-[90vh] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-xl"
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              newLetterDialogTitleRef.current?.focus();
            }}
          >
            <DialogHeader>
              <DialogTitle ref={newLetterDialogTitleRef} tabIndex={-1}>
                Create a new letter
              </DialogTitle>
              <DialogDescription>
                Give the letter a name and optional starting text. It will be saved only in
                this workspace and opened in the existing editor.
              </DialogDescription>
            </DialogHeader>

            <form className="space-y-5" noValidate onSubmit={handleCreateNewLetter}>
              <div className="space-y-2">
                <Label htmlFor="new-letter-title">
                  Letter name <span aria-hidden="true">*</span>
                </Label>
                <Input
                  ref={newLetterTitleInputRef}
                  id="new-letter-title"
                  value={newLetterTitle}
                  onChange={(event) => {
                    setNewLetterTitle(event.target.value);
                    if (newLetterTitleError) setNewLetterTitleError(null);
                  }}
                  aria-invalid={newLetterTitleError ? "true" : undefined}
                  aria-describedby={
                    newLetterTitleError
                      ? "new-letter-title-hint new-letter-title-error"
                      : "new-letter-title-hint"
                  }
                  className={controlClass}
                />
                <p
                  id="new-letter-title-hint"
                  className="text-sm text-slate-600 dark:text-slate-300"
                >
                  Example: Salary adjustment letter
                </p>
                {newLetterTitleError ? (
                  <p
                    id="new-letter-title-error"
                    className="text-sm font-semibold text-red-700 dark:text-red-300"
                  >
                    {newLetterTitleError}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-letter-body">Starting text</Label>
                <Textarea
                  id="new-letter-body"
                  value={newLetterBody}
                  onChange={(event) => setNewLetterBody(event.target.value)}
                  aria-describedby="new-letter-body-hint"
                  className="min-h-40 border-slate-500 focus-visible:ring-slate-700 dark:border-slate-400 dark:focus-visible:ring-amber-300"
                />
                <p
                  id="new-letter-body-hint"
                  className="text-sm text-slate-600 dark:text-slate-300"
                >
                  You can fully format and edit this text after the letter is created.
                </p>
              </div>

              {newLetterServerError ? (
                <p
                  role="alert"
                  className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
                >
                  {newLetterServerError}
                </p>
              ) : null}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  disabled={createLetterTemplateMutation.isPending}
                  onClick={() => handleNewLetterDialogChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="h-11 bg-slate-900 font-bold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
                  disabled={createLetterTemplateMutation.isPending}
                >
                  {createLetterTemplateMutation.isPending ? (
                    <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FilePlus2 aria-hidden="true" className="mr-2 h-4 w-4" />
                  )}
                  {createLetterTemplateMutation.isPending ? "Creating…" : "Create letter"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog
          open={filePickerPurpose !== null}
          onOpenChange={(open) => {
            if (!open && !isFilePickerSelecting) {
              setFilePickerPurpose(null);
            }
          }}
        >
          <DialogContent className="flex h-[85vh] w-[calc(100vw-2rem)] max-w-6xl flex-col gap-0 overflow-hidden rounded-3xl border-slate-500 bg-background p-0 shadow-2xl">
            <DialogHeader className="shrink-0 border-b border-slate-300 px-6 py-4 text-left dark:border-slate-700">
              <DialogTitle>
                {filePickerPurpose === "seal"
                  ? "Select organization seal"
                  : "Add letter media"}
              </DialogTitle>
              <DialogDescription>
                {filePickerPurpose === "seal"
                  ? "Select an existing image or upload a PNG, JPEG, or WEBP seal, then choose it."
                  : "Select an existing image, video, or audio file—or upload one—then choose it to add it at the editor cursor."}
              </DialogDescription>
            </DialogHeader>
            <div className="file-picker-wrapper relative min-h-0 flex-1 overflow-hidden p-4">
              <style
                dangerouslySetInnerHTML={{
                  __html: `
                    .file-picker-wrapper > div > div:nth-child(1),
                    .file-picker-wrapper > div > div:nth-child(2) > div:nth-child(2) {
                      display: none !important;
                    }
                    .file-picker-wrapper > div {
                      height: 100% !important;
                      min-height: 100% !important;
                      margin: 0 !important;
                    }
                  `,
                }}
              />
              <FileManagerClient
                isPickerMode
                onFileSelect={(file) => void handleFileManagerSelect(file)}
                access={{ canRead: true, canManage: true }}
                acceptedFileTypes={
                  filePickerPurpose === "seal"
                    ? "image/png,image/jpeg,image/webp"
                    : "image/*,video/*,audio/*"
                }
                acceptedFileDescription={
                  filePickerPurpose === "seal"
                    ? "PNG, JPEG, or WEBP images up to 2 MB"
                    : "images, video, or audio"
                }
              />
              {isFilePickerSelecting ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="absolute inset-0 flex items-center justify-center bg-background/90 backdrop-blur-sm"
                >
                  <div className="flex items-center gap-3 rounded-xl border border-slate-500 bg-background px-5 py-3 font-bold shadow-xl">
                    <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
                    Preparing selected seal…
                  </div>
                </div>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>

        {/* SIGNATURE PAD DIALOG */}
        <SignaturePad
          open={isSignaturePadOpen}
          onOpenChange={setIsSignaturePadOpen}
          onSave={(dataUrl: string) => {
            setSignerImage(dataUrl);
            setIsSignaturePadOpen(false);
            toast.success("Digital signature added to the authorization section.");
          }}
        />
      </CardContent>
    </Card>
  );
}

// ==========================================
// 5. EMPLOYEE PROFILE & PERSONAL INFO PANEL
// ==========================================
export function EmployeeProfilePanel({ canManage = true }: { canManage?: boolean }) {
  const [selectedSection, setSelectedSection] = useState("address");
  const [selectedEmp, setSelectedEmp] = useState("EMP-0001");

  const sections = [
    { id: "address", name: "1. Address (አድራሻ)", icon: MapPin },
    { id: "bank_accounts", name: "2. Bank Accounts (የባንክ ሂሳብ)", icon: Building2 },
    { id: "disability", name: "3. Disability Info (የአካል ጉዳት)", icon: Info },
    { id: "higher_education", name: "4. Higher Education (ከፍተኛ ትምህርት)", icon: GraduationCap },
    { id: "school_education", name: "5. Elementary & Secondary Education (1ኛ እና 2ኛ ደረጃ)", icon: GraduationCap },
    { id: "emergency", name: "6. Emergency Contacts (ድንገተኛ አድራሻ)", icon: Phone },
    { id: "guarantor", name: "7. Guarantor Info (ተያዥ)", icon: HeartHandshake },
    { id: "family", name: "8. Family Members (የቤተሰብ መረጃ)", icon: UsersRound },
    { id: "languages", name: "9. Languages (ቋንቋዎች)", icon: FileText },
    { id: "licenses", name: "10. Licenses & Permits (የስራ/መንጃ ፈቃድ)", icon: BadgeCheck },
    { id: "other_info", name: "11. Other Info (ተጨማሪ መረጃ)", icon: FileCheck },
    { id: "experience", name: "12. Work Experience (የስራ ልምድ)", icon: History },
    { id: "disasters", name: "13. Disaster Record (የአደጋ መዝገብ)", icon: AlertTriangle },
    { id: "certifications_awards", name: "14. Certifications & Awards (ምስክር ወረቀትና ሽልማት)", icon: Award },
    { id: "files", name: "15. Attached Files & Documents (የዲጂታል ፋይሎች)", icon: FolderOpen },
  ];

  return (
    <Card className="border-slate-300 dark:border-slate-700">
      <CardContent className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-amber-500" />
                Employee Personal Information & Self-Service (የግል መረጃ)
              </h2>
              {canManage ? (
                <span className="rounded-full bg-purple-100 px-3 py-0.5 text-xs font-bold text-purple-900 dark:bg-purple-950 dark:text-purple-200">
                  Central Super Admin / HR Manager
                </span>
              ) : (
                <span className="rounded-full bg-blue-100 px-3 py-0.5 text-xs font-bold text-blue-900 dark:bg-blue-950 dark:text-blue-200">
                  Employee Self-Service Mode
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {canManage
                ? "Central Super Admin & HR Managers can view and manage personal sub-records for all employees in the organization."
                : "Employees can directly update their own personal information sub-records, education, bank accounts, and guarantors."}
            </p>
          </div>

          {canManage && (
            <div className="flex items-center gap-3">
              <Label htmlFor="emp-select" className="text-xs font-bold uppercase">Target Employee:</Label>
              <select
                id="emp-select"
                value={selectedEmp}
                onChange={(e) => setSelectedEmp(e.target.value)}
                className="h-10 rounded-lg border border-slate-400 bg-background px-3 text-sm font-bold"
              >
                <option value="EMP-0001">Abebe Bikila (EMP-0001)</option>
                <option value="EMP-0002">Tsion Hailu (EMP-0002)</option>
                <option value="EMP-0003">Kebede Tessema (EMP-0003)</option>
              </select>
            </div>
          )}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
          {/* SIDEBAR SUB-MENU */}
          <div className="space-y-1.5 rounded-2xl border bg-slate-50 p-2 dark:bg-slate-900">
            <Label className="px-3 pt-2 text-xs font-bold uppercase tracking-wider text-slate-500">Personal Information Sub-records</Label>
            {sections.map((sec) => {
              const Icon = sec.icon;
              return (
                <button
                  key={sec.id}
                  onClick={() => setSelectedSection(sec.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-bold transition-all",
                    selectedSection === sec.id
                      ? "bg-amber-400 text-slate-950 font-black shadow-sm"
                      : "text-slate-700 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{sec.name}</span>
                </button>
              );
            })}
          </div>

          {/* DISPLAY CONTENT PANEL */}
          <div className="rounded-2xl border p-6 dark:border-slate-800">
            {selectedSection === "address" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <h3 className="text-lg font-bold">1. Address Details (የመኖሪያ አድራሻ)</h3>
                  <Button size="sm" className="bg-amber-300 font-bold text-slate-950 hover:bg-amber-200">+ Add Address</Button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border p-4 bg-slate-50 dark:bg-slate-900">
                    <span className="text-xs font-bold text-amber-600 uppercase">Permanent Residence</span>
                    <p className="mt-2 text-sm font-bold">Addis Ababa, Bole Sub-city</p>
                    <p className="text-xs text-slate-500">Woreda 03 · Kebele 05 · House No. 1204</p>
                  </div>
                  <div className="rounded-xl border p-4 bg-slate-50 dark:bg-slate-900">
                    <span className="text-xs font-bold text-blue-600 uppercase">Temporary Residence</span>
                    <p className="mt-2 text-sm font-bold">Addis Ababa, Yeka Sub-city</p>
                    <p className="text-xs text-slate-500">Woreda 08 · House No. 405</p>
                  </div>
                </div>
              </div>
            )}

            {selectedSection === "bank_accounts" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <h3 className="text-lg font-bold">2. Bank Accounts (የባንክ ሂሳብ)</h3>
                  <Button size="sm" className="bg-amber-300 font-bold text-slate-950 hover:bg-amber-200">+ Add Bank Account</Button>
                </div>
                <div className="rounded-xl border p-4 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold uppercase text-emerald-600">Commercial Bank of Ethiopia (CBE)</span>
                    <p className="text-lg font-mono font-black mt-1">1000294819284</p>
                    <p className="text-xs text-slate-500">Bole Branch · Payroll Savings Account</p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">Primary Payroll</span>
                </div>
              </div>
            )}

            {selectedSection === "disability" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <h3 className="text-lg font-bold">3. Disability Information (የአካል ጉዳት)</h3>
                  <Button size="sm" className="bg-amber-300 font-bold text-slate-950 hover:bg-amber-200">+ Record Disability</Button>
                </div>
                <div className="rounded-xl border p-4 bg-slate-50 dark:bg-slate-900">
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No Disability Registered</p>
                  <p className="text-xs text-slate-500 mt-1">Employee has no registered physical or visual impairments.</p>
                </div>
              </div>
            )}

            {selectedSection === "higher_education" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <h3 className="text-lg font-bold">4. Higher Education (ከፍተኛ ትምህርት)</h3>
                  <Button size="sm" className="bg-amber-300 font-bold text-slate-950 hover:bg-amber-200">+ Add Higher Education</Button>
                </div>
                <div className="rounded-xl border p-4 bg-slate-50 dark:bg-slate-900 space-y-1">
                  <span className="text-xs font-bold uppercase text-amber-600">Bachelor's Degree (BSc)</span>
                  <p className="text-base font-bold">Software Engineering & Computer Science</p>
                  <p className="text-xs text-slate-500">Addis Ababa University (AAU) · Graduated: 2021 · Cumulative GPA: 3.75</p>
                </div>
              </div>
            )}

            {selectedSection === "school_education" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <h3 className="text-lg font-bold">5. Elementary & Secondary Education (1ኛ እና 2ኛ ደረጃ ትምህርት)</h3>
                  <Button size="sm" className="bg-amber-300 font-bold text-slate-950 hover:bg-amber-200">+ Add School</Button>
                </div>
                <div className="rounded-xl border p-4 bg-slate-50 dark:bg-slate-900 space-y-1">
                  <span className="text-xs font-bold uppercase text-blue-600">Grade 12 National Exam Complete</span>
                  <p className="text-base font-bold">Bole Senior Secondary School</p>
                  <p className="text-xs text-slate-500">Completed 2017 · Certificate No. SEC/2017/89201</p>
                </div>
              </div>
            )}

            {selectedSection === "emergency" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <h3 className="text-lg font-bold">6. Emergency Contacts (ድንገተኛ አድራሻ)</h3>
                  <Button size="sm" className="bg-amber-300 font-bold text-slate-950 hover:bg-amber-200">+ Add Emergency Contact</Button>
                </div>
                <div className="rounded-xl border p-4 bg-slate-50 dark:bg-slate-900 space-y-1">
                  <span className="text-xs font-bold uppercase text-red-600">Primary Emergency Contact</span>
                  <p className="text-base font-bold">Kebede Bikila (Father / ወላጅ)</p>
                  <p className="text-xs text-slate-500">Phone: +251 911 223 344 · Addis Ababa, Bole Woreda 03</p>
                </div>
              </div>
            )}

            {selectedSection === "guarantor" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <h3 className="text-lg font-bold">7. Guarantor Information (ተያዥ / የዋስትና ውል)</h3>
                  <Button size="sm" className="bg-amber-300 font-bold text-slate-950 hover:bg-amber-200">+ Add Guarantor (ተያዥ)</Button>
                </div>
                <div className="rounded-xl border p-4 bg-slate-50 dark:bg-slate-900 space-y-1">
                  <span className="text-xs font-bold uppercase text-emerald-600">Verified Corporate Guarantor (ተያዥ)</span>
                  <p className="text-base font-bold">Ato Girma Wolde (Senior Manager, Commercial Bank of Ethiopia)</p>
                  <p className="text-xs text-slate-500">Guarantee Guarantee Amount: 100,000 ETB · Signed Agreement Ref: G-2022/901</p>
                </div>
              </div>
            )}

            {selectedSection === "family" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <h3 className="text-lg font-bold">8. Family Members & Dependents (የቤተሰብ መረጃ)</h3>
                  <Button size="sm" className="bg-amber-300 font-bold text-slate-950 hover:bg-amber-200">+ Add Family Member</Button>
                </div>
                <div className="rounded-xl border p-4 bg-slate-50 dark:bg-slate-900 space-y-1">
                  <span className="text-xs font-bold uppercase text-indigo-600">Spouse (ሚስት)</span>
                  <p className="text-base font-bold">Hiwot Tadesse</p>
                  <p className="text-xs text-slate-500">DOB: 1994-08-12 · Covered under company medical insurance</p>
                </div>
              </div>
            )}

            {selectedSection === "languages" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <h3 className="text-lg font-bold">9. Languages (ቋንቋዎች)</h3>
                  <Button size="sm" className="bg-amber-300 font-bold text-slate-950 hover:bg-amber-200">+ Add Language</Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border p-3 bg-slate-50 dark:bg-slate-900">
                    <p className="font-bold">Amharic (አማርኛ)</p>
                    <p className="text-xs text-slate-500">Native / Mother Tongue (የአፍ መፈቻ)</p>
                  </div>
                  <div className="rounded-xl border p-3 bg-slate-50 dark:bg-slate-900">
                    <p className="font-bold">English (እንግሊዝኛ)</p>
                    <p className="text-xs text-slate-500">Advanced / Fluent (ከፍተኛ/ተናጋሪ)</p>
                  </div>
                </div>
              </div>
            )}

            {selectedSection === "licenses" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <h3 className="text-lg font-bold">10. Licenses & Permits (የስራ/መንጃ ፈቃድ)</h3>
                  <Button size="sm" className="bg-amber-300 font-bold text-slate-950 hover:bg-amber-200">+ Add License</Button>
                </div>
                <div className="rounded-xl border p-4 bg-slate-50 dark:bg-slate-900 space-y-1">
                  <span className="text-xs font-bold uppercase text-amber-600">Driving License - Auto (Grade 2)</span>
                  <p className="text-base font-bold">License No: ET-DRV-90812</p>
                  <p className="text-xs text-slate-500">Issued: Addis Ababa Transport Bureau · Expires: 2028-06-30</p>
                </div>
              </div>
            )}

            {selectedSection === "other_info" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <h3 className="text-lg font-bold">11. Other Info (ተጨማሪ መረጃ)</h3>
                  <Button size="sm" className="bg-amber-300 font-bold text-slate-950 hover:bg-amber-200">+ Edit Info</Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 text-sm">
                  <div className="rounded-lg border p-3 bg-slate-50 dark:bg-slate-900"><span className="text-xs text-slate-500 font-bold">Blood Group:</span> <p className="font-bold">O Positive (O+)</p></div>
                  <div className="rounded-lg border p-3 bg-slate-50 dark:bg-slate-900"><span className="text-xs text-slate-500 font-bold">TIN Number:</span> <p className="font-bold font-mono">0094182901</p></div>
                </div>
              </div>
            )}

            {selectedSection === "experience" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <h3 className="text-lg font-bold">12. Work Experience (የስራ ልምድ)</h3>
                  <Button size="sm" className="bg-amber-300 font-bold text-slate-950 hover:bg-amber-200">+ Add Experience</Button>
                </div>
                <div className="rounded-xl border p-4 bg-slate-50 dark:bg-slate-900 space-y-1">
                  <span className="text-xs font-bold uppercase text-blue-600">Previous Software Developer</span>
                  <p className="text-base font-bold">Ethio Telecom (ኢትዮ ቴሌኮም)</p>
                  <p className="text-xs text-slate-500">Duration: 2020 – 2022 (2 Years) · Reason for leaving: Career growth</p>
                </div>
              </div>
            )}

            {selectedSection === "disasters" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <h3 className="text-lg font-bold">13. Disaster & Accident Record (የአደጋ መዝገብ)</h3>
                  <Button size="sm" className="bg-amber-300 font-bold text-slate-950 hover:bg-amber-200">+ Record Incident</Button>
                </div>
                <div className="rounded-xl border p-4 bg-slate-50 dark:bg-slate-900">
                  <p className="text-sm font-bold text-emerald-600">No Workplace Accidents Recorded</p>
                  <p className="text-xs text-slate-500 mt-1">Clean safety and accident-free workplace record.</p>
                </div>
              </div>
            )}

            {selectedSection === "certifications_awards" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <h3 className="text-lg font-bold">14. Certifications & Awards (ምስክር ወረቀትና ሽልማት)</h3>
                  <Button size="sm" className="bg-amber-300 font-bold text-slate-950 hover:bg-amber-200">+ Add Award / Cert</Button>
                </div>
                <div className="rounded-xl border p-4 bg-slate-50 dark:bg-slate-900 space-y-1">
                  <span className="text-xs font-bold uppercase text-amber-600">AWS Certified Solutions Architect</span>
                  <p className="text-base font-bold">Amazon Web Services (AWS)</p>
                  <p className="text-xs text-slate-500">Issued: 2023 · Validation Code: AWS-908124</p>
                </div>
              </div>
            )}

            {selectedSection === "files" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <h3 className="text-lg font-bold">15. Attached Files & Digital Documents (የዲጂታል ፋይሎች)</h3>
                  <Button size="sm" className="bg-amber-300 font-bold text-slate-950 hover:bg-amber-200">+ Upload Document</Button>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-lg border p-3 bg-slate-50 dark:bg-slate-900">
                    <div className="flex items-center gap-3">
                      <FolderOpen className="h-5 w-5 text-amber-500" />
                      <div>
                        <p className="text-xs text-slate-500">PDF Document · 1.4 MB · Uploaded 2022-01-08</p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline"><Download className="h-4 w-4" /></Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      </CardContent>
    </Card>
  );
}

export function EmployeeTransfersPanel() {
  const scope = getWorkspaceScopeKey();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [unitFilter, setUnitFilter] = useState("all");
  const [openModal, setOpenModal] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<any>(null);

  const [formData, setFormData] = useState({
    employee_id: "",
    to_unit_id: "",
    to_position_id: "",
    left_reason: "Internal Transfer / ዛወር",
    effective_date: new Date().toISOString().slice(0, 10),
    remarks: "",
  });

  const employeesQuery = useQuery({
    queryKey: ["hr-employees-list-transfers", scope],
    queryFn: () => hrFetch<any>("/employees?per_page=100"),
  });

  const unitsQuery = useQuery({
    queryKey: ["hr-units-transfers", scope],
    queryFn: () => hrFetch<any>("/organization-units?per_page=100"),
  });

  const positionsQuery = useQuery({
    queryKey: ["hr-positions-transfers", scope],
    queryFn: () => hrFetch<any>("/positions?per_page=100"),
  });

  const transfersQuery = useQuery({
    queryKey: ["hr-transfers-list", scope],
    queryFn: async () => {
      try {
        const res = await hrFetch<any>("/employee-experiences?per_page=100");
        return res;
      } catch {
        return { data: [] };
      }
    },
  });

  const createTransferMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return hrFetch<any>(`/employees/${data.employee_id}/transfer/store`, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast.success("Employee transfer recorded successfully!");
      queryClient.invalidateQueries({ queryKey: ["hr-transfers-list"] });
      queryClient.invalidateQueries({ queryKey: ["hr-employees-list-transfers"] });
      setOpenModal(false);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to record employee transfer.");
    },
  });

  const employees = employeesQuery.data?.data || [];
  const units = unitsQuery.data?.data || [];
  const positions = positionsQuery.data?.data || [];
  const transfers = transfersQuery.data?.data || [
    {
      id: 101,
      employee_name: "Abebe Bikila",
      emp_id: "EMP-0042",
      from_unit: "Software Development Dept",
      to_unit: "Enterprise Solutions Unit",
      from_position: "Junior Developer",
      to_position: "Senior Systems Analyst",
      reason: "Internal Promotion / ዛወር",
      effective_date: "2026-07-01",
      status: "Completed",
    },
    {
      id: 102,
      employee_name: "Tigist Assefa",
      emp_id: "EMP-0089",
      from_unit: "Human Resources Dept",
      to_unit: "Operations & Logistics",
      from_position: "HR Specialist",
      to_position: "Operations Coordinator",
      reason: "Departmental Restructuring",
      effective_date: "2026-06-15",
      status: "Completed",
    },
    {
      id: 103,
      employee_name: "Dawit Kebede",
      emp_id: "EMP-0112",
      from_unit: "Finance & Accounting",
      to_unit: "Internal Audit Division",
      from_position: "Accountant",
      to_position: "Senior Internal Auditor",
      reason: "Strategic Realignment",
      effective_date: "2026-05-20",
      status: "Completed",
    },
  ];

  const filteredTransfers = transfers.filter((t: any) => {
    const nameMatch = (t.employee_name || t.employee?.primary_name || "").toLowerCase().includes(search.toLowerCase());
    const unitMatch = unitFilter === "all" || t.to_unit === unitFilter || t.organization_unit_id == unitFilter;
    return nameMatch && unitMatch;
  });

  return (
    <Card className="border-slate-300 dark:border-slate-700 shadow-md">
      <CardContent className="p-6 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-amber-500/10 p-2 text-amber-500">
                <ArrowLeftRight className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-foreground">Employee Transfers Submodule</h2>
                <p className="text-sm text-slate-500">
                  Manage organization transfers, internal reassignments, and position updates.
                </p>
              </div>
            </div>
          </div>
          <Button
            onClick={() => setOpenModal(true)}
            className="bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 gap-2 h-11 px-5 rounded-xl shadow"
          >
            <Plus className="h-4 w-4" /> Initiate Employee Transfer
          </Button>
        </div>

        {/* Filters and Search Bar */}
        <div className="grid gap-4 md:grid-cols-[1fr_250px_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search transfer records by employee name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-11 border-slate-300 dark:border-slate-700"
            />
          </div>
          <select
            value={unitFilter}
            onChange={(e) => setUnitFilter(e.target.value)}
            className="h-11 rounded-lg border border-slate-300 bg-background px-3 text-sm text-foreground dark:border-slate-700"
          >
            <option value="all">All Organization Units</option>
            {units.map((u: any) => (
              <option key={u.id} value={u.name || u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <Button variant="outline" className="h-11 px-4 gap-2">
            <Filter className="h-4 w-4" /> Filter
          </Button>
        </div>

        {/* Transfers DataTable */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 dark:bg-slate-900 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 border-b">
              <tr>
                <th className="p-4">#</th>
                <th className="p-4">Employee</th>
                <th className="p-4">From Unit & Position</th>
                <th className="p-4">To Unit & Position</th>
                <th className="p-4">Transfer Reason</th>
                <th className="p-4">Effective Date</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
              {filteredTransfers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    No transfer records found.
                  </td>
                </tr>
              ) : (
                filteredTransfers.map((item: any, idx: number) => (
                  <tr key={item.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                    <td className="p-4 text-slate-400 font-bold">{idx + 1}</td>
                    <td className="p-4">
                      <div className="font-bold text-foreground">
                        {item.employee_name || item.employee?.primary_name || item.employees?.en_name || "Employee #" + item.id}
                      </div>
                      <div className="text-xs text-slate-400">{item.emp_id || "EMP-" + item.id}</div>
                    </td>
                    <td className="p-4">
                      <div className="text-slate-600 dark:text-slate-300 font-semibold">{item.from_unit || item.organization_unit?.name || "Previous Unit"}</div>
                      <div className="text-xs text-slate-400">{item.from_position || "Previous Position"}</div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5 text-amber-600 font-bold dark:text-amber-400">
                        <span>{item.to_unit || item.new_unit?.name || "Target Unit"}</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </div>
                      <div className="text-xs text-slate-400">{item.to_position || "New Position"}</div>
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center rounded-md bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        {item.reason || item.left_reason || "Internal Transfer"}
                      </span>
                    </td>
                    <td className="p-4 text-slate-600 dark:text-slate-300">
                      {item.effective_date || item.start_date || "2026-07-01"}
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-extrabold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        Completed
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedTransfer(item);
                          setPrintModalOpen(true);
                        }}
                        className="gap-1.5 border-slate-300 dark:border-slate-700 hover:bg-amber-500/10 hover:text-amber-600"
                      >
                        <Printer className="h-3.5 w-3.5" /> Letter
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Initiate Transfer Modal */}
        <Dialog open={openModal} onOpenChange={setOpenModal}>
          <DialogContent className="sm:max-w-[650px]">
            <DialogHeader>
              <DialogTitle className="text-xl font-black flex items-center gap-2">
                <ArrowLeftRight className="h-5 w-5 text-amber-500" /> Initiate Employee Transfer
              </DialogTitle>
              <DialogDescription>
                Transfer an employee to a new Organization Unit, Position, and Salary Scale.
              </DialogDescription>
            </DialogHeader>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createTransferMutation.mutate(formData);
              }}
              className="space-y-4 py-2"
            >
              <div>
                <Label className="font-bold">Select Employee <span className="text-red-500">*</span></Label>
                <select
                  required
                  value={formData.employee_id}
                  onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                  className="mt-1 w-full h-11 rounded-lg border border-slate-300 bg-background px-3 text-sm dark:border-slate-700"
                >
                  <option value="">-- Select Employee --</option>
                  {employees.map((emp: any) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.primary_name || emp.en_name} ({emp.emp_id || "EMP-" + emp.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="font-bold">Target Organization Unit <span className="text-red-500">*</span></Label>
                  <select
                    required
                    value={formData.to_unit_id}
                    onChange={(e) => setFormData({ ...formData, to_unit_id: e.target.value })}
                    className="mt-1 w-full h-11 rounded-lg border border-slate-300 bg-background px-3 text-sm dark:border-slate-700"
                  >
                    <option value="">-- Select Target Unit --</option>
                    {units.map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="font-bold">Target Job Position <span className="text-red-500">*</span></Label>
                  <select
                    required
                    value={formData.to_position_id}
                    onChange={(e) => setFormData({ ...formData, to_position_id: e.target.value })}
                    className="mt-1 w-full h-11 rounded-lg border border-slate-300 bg-background px-3 text-sm dark:border-slate-700"
                  >
                    <option value="">-- Select Target Position --</option>
                    {positions.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.title || p.code || "Position #" + p.id}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="font-bold">Transfer Reason <span className="text-red-500">*</span></Label>
                  <Input
                    required
                    value={formData.left_reason}
                    onChange={(e) => setFormData({ ...formData, left_reason: e.target.value })}
                    placeholder="e.g. Internal Promotion, Departmental Restructuring"
                    className="mt-1 h-11"
                  />
                </div>
                <div>
                  <Label className="font-bold">Effective Date <span className="text-red-500">*</span></Label>
                  <Input
                    type="date"
                    required
                    value={formData.effective_date}
                    onChange={(e) => setFormData({ ...formData, effective_date: e.target.value })}
                    className="mt-1 h-11"
                  />
                </div>
              </div>

              <div>
                <Label className="font-bold">Remarks / Internal Notes</Label>
                <Textarea
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="Additional transfer notes..."
                  className="mt-1 min-h-[80px]"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setOpenModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createTransferMutation.isPending} className="bg-amber-500 text-slate-950 font-bold hover:bg-amber-400">
                  {createTransferMutation.isPending ? "Processing..." : "Confirm & Save Transfer"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Print Letter Preview Modal */}
        <Dialog open={printModalOpen} onOpenChange={setPrintModalOpen}>
          <DialogContent className="sm:max-w-[700px]">
            <DialogHeader>
              <DialogTitle className="text-xl font-black flex items-center gap-2">
                <Printer className="h-5 w-5 text-amber-500" /> Official Transfer Notification Letter
              </DialogTitle>
            </DialogHeader>

            {selectedTransfer && (
              <div className="border rounded-xl p-6 bg-white text-slate-900 space-y-4 shadow-inner font-serif text-sm">
                <div className="text-center border-b pb-3 border-slate-300">
                  <h3 className="text-xl font-bold uppercase tracking-wider">HUMAN RESOURCES MANAGEMENT</h3>
                  <p className="text-xs text-slate-500 font-sans">Official Employee Transfer Document</p>
                </div>
                <div className="flex justify-between text-xs font-sans">
                  <span><strong>Ref:</strong> HR/TR/2026/{selectedTransfer.id}</span>
                  <span><strong>Date:</strong> {new Date().toLocaleDateString()}</span>
                </div>
                <div>
                  <p><strong>To:</strong> {selectedTransfer.employee_name || selectedTransfer.employees?.en_name || "Employee"}</p>
                  <p><strong>ID:</strong> {selectedTransfer.emp_id || "EMP-" + selectedTransfer.id}</p>
                </div>
                <div className="font-bold underline text-center uppercase tracking-wide py-1 font-sans">
                  Subject: Notice of Internal Employee Transfer
                </div>
                <p className="leading-relaxed">
                  This letter serves as official confirmation of your internal transfer to a new unit and position within the organization as specified below:
                </p>
                <table className="w-full border-collapse border border-slate-300 text-xs font-sans">
                  <tbody>
                    <tr className="border-b"><td className="p-2 font-bold bg-slate-100 w-1/3">Target Unit:</td><td className="p-2">{selectedTransfer.to_unit || selectedTransfer.new_unit?.name || "Target Unit"}</td></tr>
                    <tr className="border-b"><td className="p-2 font-bold bg-slate-100">New Position:</td><td className="p-2">{selectedTransfer.to_position || "New Position"}</td></tr>
                    <tr className="border-b"><td className="p-2 font-bold bg-slate-100">Transfer Reason:</td><td className="p-2">{selectedTransfer.reason || selectedTransfer.left_reason || "Internal Transfer"}</td></tr>
                    <tr><td className="p-2 font-bold bg-slate-100">Effective Date:</td><td className="p-2">{selectedTransfer.effective_date || "2026-07-01"}</td></tr>
                  </tbody>
                </table>
                <p className="leading-relaxed text-xs">
                  Please report to your new unit head on the effective date. We thank you for your continued dedication to the organization.
                </p>
                <div className="pt-8 text-right font-sans">
                  <div className="inline-block border-t border-slate-400 w-48 text-center pt-1 font-bold text-xs">
                    Authorized Signature<br /><span className="text-slate-500 font-normal">Human Resources Director</span>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setPrintModalOpen(false)}>
                Close
              </Button>
              <Button
                onClick={() => {
                  window.print();
                }}
                className="bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 gap-2"
              >
                <Printer className="h-4 w-4" /> Print Document
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
