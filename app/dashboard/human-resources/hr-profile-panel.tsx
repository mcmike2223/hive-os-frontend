"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Award,
  BadgeCheck,
  Building2,
  FileCheck,
  FileText,
  FolderOpen,
  GraduationCap,
  HeartHandshake,
  History,
  Info,
  MapPin,
  Phone,
  Pencil,
  Plus,
  Trash2,
  UserCheck,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useUser } from "@/hooks/use-user";
import { getAuthHeaders, getBackendApiRoot, getWorkspaceScopeKey } from "@/lib/runtime-context";
import { cn } from "@/lib/utils";
import {
  Employee,
  EmployeeProfileOtherInfo,
  EmployeeProfileSectionKey,
  ReferenceOption,
  createEmployeeProfileRecord,
  deleteEmployeeProfileRecord,
  fetchEmployeeProfile,
  hrFetch,
  hrReferenceOptions,
  referenceOptionLabel,
  updateEmployeeOtherInfo,
  updateEmployeeProfileRecord,
  uploadEmployeeProfileDocument,
} from "@/modules/humanresources/api";

type FieldDef = {
  key: string;
  label: string;
  type?: "text" | "textarea" | "date" | "number" | "checkbox" | "select" | "file";
  catalog?: string;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
};

type SectionDef = {
  id: EmployeeProfileSectionKey | "other_info";
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  fields?: FieldDef[];
  titleKeys?: string[];
  subtitleKeys?: string[];
};

const sections: SectionDef[] = [
  {
    id: "address",
    name: "1. Address (አድራሻ)",
    icon: MapPin,
    fields: [
      { key: "address_type", label: "Address type", type: "select", catalog: "address-types", required: true },
      { key: "city", label: "City" },
      { key: "region", label: "Region" },
      { key: "zone", label: "Zone" },
      { key: "woreda", label: "Woreda" },
      { key: "kebele", label: "Kebele" },
      { key: "house_number", label: "House number" },
      { key: "street_line", label: "Street / details", type: "textarea" },
      { key: "is_primary", label: "Primary address", type: "checkbox" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    titleKeys: ["address_type", "city"],
    subtitleKeys: ["woreda", "kebele", "house_number"],
  },
  {
    id: "bank_accounts",
    name: "2. Bank Accounts (የባንክ ሂሳብ)",
    icon: Building2,
    fields: [
      { key: "bank_code", label: "Bank", type: "select", catalog: "banks", required: true },
      { key: "account_type", label: "Account type", type: "select", catalog: "bank-account-types" },
      { key: "account_number", label: "Account number", required: true },
      { key: "branch_name", label: "Branch" },
      { key: "account_holder_name", label: "Account holder" },
      { key: "is_primary_payroll", label: "Primary payroll account", type: "checkbox" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    titleKeys: ["bank_code", "account_number"],
    subtitleKeys: ["branch_name", "account_type"],
  },
  {
    id: "disability",
    name: "3. Disability Info (የአካል ጉዳት)",
    icon: Info,
    fields: [
      { key: "disability_type", label: "Disability type", type: "select", catalog: "disability-types", required: true },
      { key: "severity", label: "Severity" },
      { key: "recorded_on", label: "Recorded on", type: "date" },
      { key: "requires_accommodation", label: "Requires accommodation", type: "checkbox" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "accommodation_notes", label: "Accommodation notes", type: "textarea" },
    ],
    titleKeys: ["disability_type"],
    subtitleKeys: ["severity", "recorded_on"],
  },
  {
    id: "higher_education",
    name: "4. Higher Education (ከፍተኛ ትምህርት)",
    icon: GraduationCap,
    fields: [
      { key: "level_code", label: "Level", type: "select", catalog: "education-levels" },
      { key: "field_code", label: "Field", type: "select", catalog: "educational-fields" },
      { key: "institute_name", label: "Institute", required: true },
      { key: "degree_title", label: "Degree / program title" },
      { key: "graduated_year", label: "Graduation year", type: "number" },
      { key: "gpa", label: "GPA" },
      { key: "gpa_scale", label: "GPA scale" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    titleKeys: ["degree_title", "institute_name"],
    subtitleKeys: ["level_code", "graduated_year", "gpa"],
  },
  {
    id: "school_education",
    name: "5. Elementary & Secondary Education",
    icon: GraduationCap,
    fields: [
      { key: "level_label", label: "Level label" },
      { key: "school_name", label: "School name", required: true },
      { key: "completed_year", label: "Completed year", type: "number" },
      { key: "certificate_number", label: "Certificate number" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    titleKeys: ["school_name"],
    subtitleKeys: ["level_label", "completed_year", "certificate_number"],
  },
  {
    id: "emergency",
    name: "6. Emergency Contacts (ድንገተኛ አድራሻ)",
    icon: Phone,
    fields: [
      { key: "full_name", label: "Full name", required: true },
      { key: "relationship_code", label: "Relationship", type: "select", catalog: "relationships" },
      { key: "phone", label: "Phone", required: true },
      { key: "alternate_phone", label: "Alternate phone" },
      { key: "address", label: "Address", type: "textarea" },
      { key: "is_primary", label: "Primary contact", type: "checkbox" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    titleKeys: ["full_name"],
    subtitleKeys: ["relationship_code", "phone"],
  },
  {
    id: "guarantor",
    name: "7. Guarantor Info (ተያዥ)",
    icon: HeartHandshake,
    fields: [
      { key: "full_name", label: "Full name", required: true },
      { key: "organization", label: "Organization" },
      { key: "job_title", label: "Job title" },
      { key: "phone", label: "Phone" },
      { key: "national_id_number", label: "National ID" },
      { key: "guarantee_amount", label: "Guarantee amount", type: "number" },
      { key: "currency", label: "Currency" },
      { key: "agreement_reference", label: "Agreement reference" },
      { key: "signed_on", label: "Signed on", type: "date" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    titleKeys: ["full_name"],
    subtitleKeys: ["organization", "guarantee_amount", "agreement_reference"],
  },
  {
    id: "family",
    name: "8. Family Members (የቤተሰብ መረጃ)",
    icon: UsersRound,
    fields: [
      { key: "full_name", label: "Full name", required: true },
      { key: "relationship_code", label: "Relationship", type: "select", catalog: "relationships" },
      { key: "date_of_birth", label: "Date of birth", type: "date" },
      { key: "phone", label: "Phone" },
      { key: "is_dependent", label: "Dependent", type: "checkbox" },
      { key: "covered_by_insurance", label: "Covered by insurance", type: "checkbox" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    titleKeys: ["full_name"],
    subtitleKeys: ["relationship_code", "date_of_birth"],
  },
  {
    id: "languages",
    name: "9. Languages (ቋንቋዎች)",
    icon: FileText,
    fields: [
      { key: "language_code", label: "Language", type: "select", catalog: "languages", required: true },
      { key: "proficiency_code", label: "Proficiency", type: "select", catalog: "language-levels" },
      { key: "is_native", label: "Native / mother tongue", type: "checkbox" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    titleKeys: ["language_code"],
    subtitleKeys: ["proficiency_code"],
  },
  {
    id: "licenses",
    name: "10. Licenses & Permits",
    icon: BadgeCheck,
    fields: [
      { key: "license_type", label: "License type", type: "select", catalog: "license-types", required: true },
      { key: "license_number", label: "License number", required: true },
      { key: "issuing_authority", label: "Issuing authority" },
      { key: "issued_on", label: "Issued on", type: "date" },
      { key: "expires_on", label: "Expires on", type: "date" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    titleKeys: ["license_type", "license_number"],
    subtitleKeys: ["issuing_authority", "expires_on"],
  },
  {
    id: "other_info",
    name: "11. Other Info (ተጨማሪ መረጃ)",
    icon: FileCheck,
  },
  {
    id: "experience",
    name: "12. Work Experience (የስራ ልምድ)",
    icon: History,
    fields: [
      { key: "employer_name", label: "Employer", required: true },
      { key: "job_title", label: "Job title" },
      { key: "started_on", label: "Started on", type: "date" },
      { key: "ended_on", label: "Ended on", type: "date" },
      { key: "leaving_reason", label: "Leaving reason" },
      { key: "responsibilities", label: "Responsibilities", type: "textarea" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    titleKeys: ["job_title", "employer_name"],
    subtitleKeys: ["started_on", "ended_on", "leaving_reason"],
  },
  {
    id: "disasters",
    name: "13. Disaster Record (የአደጋ መዝገብ)",
    icon: AlertTriangle,
    fields: [
      { key: "incident_type", label: "Incident type", required: true },
      { key: "severity", label: "Severity" },
      { key: "occurred_on", label: "Occurred on", type: "date" },
      { key: "location", label: "Location" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "outcome", label: "Outcome", type: "textarea" },
    ],
    titleKeys: ["incident_type"],
    subtitleKeys: ["occurred_on", "severity", "location"],
  },
  {
    id: "certifications_awards",
    name: "14. Certifications & Awards",
    icon: Award,
    fields: [
      { key: "title", label: "Title", required: true },
      { key: "issuer", label: "Issuer" },
      { key: "credential_code", label: "Credential / validation code" },
      { key: "issued_on", label: "Issued on", type: "date" },
      { key: "expires_on", label: "Expires on", type: "date" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    titleKeys: ["title"],
    subtitleKeys: ["issuer", "credential_code", "issued_on"],
  },
  {
    id: "files",
    name: "15. Attached Files & Documents",
    icon: FolderOpen,
    fields: [
      { key: "title", label: "Document title", required: true },
      { key: "category", label: "Category" },
      { key: "file", label: "File", type: "file", required: true },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    titleKeys: ["title", "file_name"],
    subtitleKeys: ["category", "mime_type", "file_size"],
  },
];

function displayValue(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (value == null || value === "") return null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function recordHeading(
  record: Record<string, unknown>,
  keys: string[] | undefined,
  fallback: string,
) {
  const parts = (keys ?? [])
    .map((key) => displayValue(record, key))
    .filter(Boolean);
  return parts.length ? parts.join(" · ") : fallback;
}

export function EmployeeProfileWorkspace({
  canManage = true,
}: {
  canManage?: boolean;
}) {
  const scope = getWorkspaceScopeKey();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const [selectedSection, setSelectedSection] = useState<string>("address");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [file, setFile] = useState<File | null>(null);
  const [otherInfo, setOtherInfo] = useState<EmployeeProfileOtherInfo>({});

  const employeesQuery = useQuery({
    queryKey: ["hr-employees-profile", scope],
    queryFn: () =>
      hrFetch<{ data: Employee[] }>("/employees?per_page=100"),
  });

  const employees = employeesQuery.data?.data ?? [];

  useEffect(() => {
    if (!employees.length) return;
    if (canManage) {
      if (!selectedEmployeeId) {
        setSelectedEmployeeId(String(employees[0].id));
      }
      return;
    }
    const mine = employees.find(
      (employee) => String(employee.user_id) === String(user?.id),
    );
    setSelectedEmployeeId(mine ? String(mine.id) : "");
  }, [employees, canManage, selectedEmployeeId, user?.id]);

  const profileQuery = useQuery({
    queryKey: ["hr-employee-profile", scope, selectedEmployeeId],
    queryFn: () => fetchEmployeeProfile(selectedEmployeeId),
    enabled: Boolean(selectedEmployeeId),
  });

  useEffect(() => {
    if (profileQuery.data?.other_info) {
      setOtherInfo(profileQuery.data.other_info);
    }
  }, [profileQuery.data?.other_info]);

  const activeSection = sections.find((section) => section.id === selectedSection);
  const catalogKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const section of sections) {
      for (const field of section.fields ?? []) {
        if (field.catalog) keys.add(field.catalog);
      }
    }
    keys.add("marital-statuses");
    keys.add("religions");
    keys.add("titles");
    return Array.from(keys);
  }, []);

  const catalogQueries = useQuery({
    queryKey: ["hr-profile-catalogs", scope, catalogKeys.join(",")],
    queryFn: async (): Promise<Record<string, ReferenceOption[]>> => {
      const entries = await Promise.all(
        catalogKeys.map(async (catalog) => {
          try {
            const options = await hrReferenceOptions(catalog);
            return [catalog, options] as const;
          } catch {
            return [catalog, [] as ReferenceOption[]] as const;
          }
        }),
      );
      return Object.fromEntries(entries);
    },
  });

  const invalidateProfile = () => {
    queryClient.invalidateQueries({
      queryKey: ["hr-employee-profile", scope, selectedEmployeeId],
    });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEmployeeId || !activeSection || activeSection.id === "other_info") {
        throw new Error("Invalid section.");
      }
      const section = activeSection.id as EmployeeProfileSectionKey;
      if (section === "files") {
        if (editing?.id) {
          const payload: Record<string, unknown> = {
            title: form.title,
            category: form.category || null,
            notes: form.notes || null,
          };
          return updateEmployeeProfileRecord(
            selectedEmployeeId,
            section,
            Number(editing.id),
            payload,
          );
        }
        if (!file) throw new Error("Choose a file to upload.");
        return uploadEmployeeProfileDocument(selectedEmployeeId, {
          title: String(form.title || ""),
          category: form.category ? String(form.category) : undefined,
          notes: form.notes ? String(form.notes) : undefined,
          file,
        });
      }

      const payload: Record<string, unknown> = {};
      for (const field of activeSection.fields ?? []) {
        if (field.type === "file") continue;
        let value = form[field.key];
        if (field.type === "checkbox") value = Boolean(value);
        if (field.type === "number" && value !== "" && value != null) {
          value = Number(value);
        }
        if (value === "") value = null;
        payload[field.key] = value;
      }

      if (editing?.id) {
        return updateEmployeeProfileRecord(
          selectedEmployeeId,
          section,
          Number(editing.id),
          payload,
        );
      }
      return createEmployeeProfileRecord(selectedEmployeeId, section, payload);
    },
    onSuccess: () => {
      toast.success(editing ? "Record updated." : "Record created.");
      setDialogOpen(false);
      setEditing(null);
      setFile(null);
      invalidateProfile();
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Could not save record.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (record: Record<string, unknown>) => {
      if (!selectedEmployeeId || !activeSection || activeSection.id === "other_info") {
        throw new Error("Invalid section.");
      }
      await deleteEmployeeProfileRecord(
        selectedEmployeeId,
        activeSection.id as EmployeeProfileSectionKey,
        Number(record.id),
      );
    },
    onSuccess: () => {
      toast.success("Record deleted.");
      invalidateProfile();
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Could not delete record.");
    },
  });

  const otherInfoMutation = useMutation({
    mutationFn: () => updateEmployeeOtherInfo(selectedEmployeeId, otherInfo),
    onSuccess: () => {
      toast.success("Other info saved.");
      invalidateProfile();
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Could not save other info.");
    },
  });

  const openCreate = () => {
    const defaults: Record<string, unknown> = {};
    for (const field of activeSection?.fields ?? []) {
      defaults[field.key] = field.type === "checkbox" ? false : "";
    }
    if (activeSection?.id === "guarantor") defaults.currency = "ETB";
    setEditing(null);
    setForm(defaults);
    setFile(null);
    setDialogOpen(true);
  };

  const openEdit = (record: Record<string, unknown>) => {
    const next: Record<string, unknown> = {};
    for (const field of activeSection?.fields ?? []) {
      if (field.type === "file") continue;
      next[field.key] = record[field.key] ?? (field.type === "checkbox" ? false : "");
    }
    setEditing(record);
    setForm(next);
    setFile(null);
    setDialogOpen(true);
  };

  const sectionRecords =
    activeSection && activeSection.id !== "other_info"
      ? profileQuery.data?.sections?.[activeSection.id] ?? []
      : [];

  const catalogOptions = (catalog?: string): ReferenceOption[] => {
    if (!catalog) return [];
    return catalogQueries.data?.[catalog] ?? [];
  };

  const selectedEmployee = employees.find(
    (employee) => String(employee.id) === selectedEmployeeId,
  );

  return (
    <Card className="border-slate-300 dark:border-slate-700">
      <CardContent className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="flex items-center gap-2 text-xl font-black">
                <UserCheck className="h-5 w-5 text-amber-500" />
                Employee Personal Information & Self-Service
              </h2>
              <span
                className={cn(
                  "rounded-full px-3 py-0.5 text-xs font-bold",
                  canManage
                    ? "bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-200"
                    : "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200",
                )}
              >
                {canManage ? "HR Manager" : "Employee Self-Service"}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Manage personal sub-records linked to a real employee profile.
            </p>
          </div>

          {canManage ? (
            <div className="flex items-center gap-3">
              <Label htmlFor="emp-select" className="text-xs font-bold uppercase">
                Target Employee
              </Label>
              <select
                id="emp-select"
                value={selectedEmployeeId}
                onChange={(event) => setSelectedEmployeeId(event.target.value)}
                className="h-10 rounded-lg border border-slate-400 bg-background px-3 text-sm font-bold"
                disabled={employeesQuery.isLoading || employees.length === 0}
              >
                {employees.length === 0 ? (
                  <option value="">No employees found</option>
                ) : (
                  employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.primary_name} ({employee.employee_number})
                    </option>
                  ))
                )}
              </select>
            </div>
          ) : selectedEmployee ? (
            <div className="rounded-lg border px-3 py-2 text-sm font-bold">
              {selectedEmployee.primary_name} ({selectedEmployee.employee_number})
            </div>
          ) : (
            <p className="text-sm font-semibold text-red-600">
              Your user account is not linked to an employee record.
            </p>
          )}
        </div>

        {!selectedEmployeeId ? (
          <div className="mt-8 rounded-xl border border-dashed p-10 text-center text-sm text-slate-500">
            {canManage
              ? "Create an employee first, then return here to manage personal records."
              : "Ask HR to link your user account to an employee before using self-service profile."}
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
            <div className="space-y-1.5 rounded-2xl border bg-slate-50 p-2 dark:bg-slate-900">
              <Label className="px-3 pt-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                Personal Information Sub-records
              </Label>
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setSelectedSection(section.id)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-bold transition-all",
                      selectedSection === section.id
                        ? "bg-amber-400 font-black text-slate-950 shadow-sm"
                        : "text-slate-700 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{section.name}</span>
                  </button>
                );
              })}
            </div>

            <div className="rounded-2xl border p-6 dark:border-slate-800">
              {profileQuery.isLoading ? (
                <p className="text-sm text-slate-500">Loading profile…</p>
              ) : profileQuery.isError ? (
                <p className="text-sm font-semibold text-red-600">
                  {profileQuery.error instanceof Error
                    ? profileQuery.error.message
                    : "Could not load profile."}
                </p>
              ) : selectedSection === "other_info" ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-3">
                    <h3 className="text-lg font-bold">11. Other Info</h3>
                    <Button
                      size="sm"
                      className="bg-amber-300 font-bold text-slate-950 hover:bg-amber-200"
                      onClick={() => otherInfoMutation.mutate()}
                      disabled={otherInfoMutation.isPending}
                    >
                      {otherInfoMutation.isPending ? "Saving…" : "Save Other Info"}
                    </Button>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label>TIN number</Label>
                      <Input
                        value={otherInfo.tin_number ?? ""}
                        onChange={(event) =>
                          setOtherInfo({ ...otherInfo, tin_number: event.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>Blood group</Label>
                      <Input
                        value={otherInfo.blood_group ?? ""}
                        onChange={(event) =>
                          setOtherInfo({ ...otherInfo, blood_group: event.target.value })
                        }
                        placeholder="e.g. O+"
                      />
                    </div>
                    <div>
                      <Label>Marital status</Label>
                      <select
                        className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
                        value={otherInfo.marital_status_code ?? ""}
                        onChange={(event) =>
                          setOtherInfo({
                            ...otherInfo,
                            marital_status_code: event.target.value,
                          })
                        }
                      >
                        <option value="">Select…</option>
                        {catalogOptions("marital-statuses").map((option) => (
                          <option
                            key={option.code ?? option.value}
                            value={option.code ?? String(option.value)}
                          >
                            {referenceOptionLabel(option)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label>Religion</Label>
                      <select
                        className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
                        value={otherInfo.religion_code ?? ""}
                        onChange={(event) =>
                          setOtherInfo({ ...otherInfo, religion_code: event.target.value })
                        }
                      >
                        <option value="">Select…</option>
                        {catalogOptions("religions").map((option) => (
                          <option
                            key={option.code ?? option.value}
                            value={option.code ?? String(option.value)}
                          >
                            {referenceOptionLabel(option)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label>Title</Label>
                      <select
                        className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
                        value={otherInfo.title_code ?? ""}
                        onChange={(event) =>
                          setOtherInfo({ ...otherInfo, title_code: event.target.value })
                        }
                      >
                        <option value="">Select…</option>
                        {catalogOptions("titles").map((option) => (
                          <option
                            key={option.code ?? option.value}
                            value={option.code ?? String(option.value)}
                          >
                            {referenceOptionLabel(option)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-3">
                    <h3 className="text-lg font-bold">{activeSection?.name}</h3>
                    <Button
                      size="sm"
                      className="bg-amber-300 font-bold text-slate-950 hover:bg-amber-200"
                      onClick={openCreate}
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      Add
                    </Button>
                  </div>

                  {sectionRecords.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">
                      No records yet. Click Add to create the first one.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {sectionRecords.map((record) => (
                        <div
                          key={String(record.id)}
                          className="flex flex-wrap items-start justify-between gap-3 rounded-xl border bg-slate-50 p-4 dark:bg-slate-900"
                        >
                          <div className="min-w-0 space-y-1">
                            <p className="font-bold">
                              {recordHeading(
                                record,
                                activeSection?.titleKeys,
                                `Record #${record.id}`,
                              )}
                            </p>
                            <p className="text-xs text-slate-500">
                              {recordHeading(record, activeSection?.subtitleKeys, "—")}
                            </p>
                            {activeSection?.id === "files" && record.id ? (
                              <button
                                type="button"
                                className="text-xs font-bold text-amber-700 underline"
                                onClick={async () => {
                                  try {
                                    const response = await fetch(
                                      `${getBackendApiRoot()}/hr/employees/${selectedEmployeeId}/profile/files/${record.id}/download`,
                                      { headers: getAuthHeaders() },
                                    );
                                    if (!response.ok) {
                                      throw new Error("Download failed.");
                                    }
                                    const blob = await response.blob();
                                    const url = URL.createObjectURL(blob);
                                    const anchor = document.createElement("a");
                                    anchor.href = url;
                                    anchor.download = String(record.file_name || "document");
                                    anchor.click();
                                    URL.revokeObjectURL(url);
                                  } catch (error) {
                                    toast.error(
                                      error instanceof Error
                                        ? error.message
                                        : "Could not download file.",
                                    );
                                  }
                                }}
                              >
                                Download
                              </button>
                            ) : null}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEdit(record)}
                            >
                              <Pencil className="mr-1 h-3.5 w-3.5" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                if (confirm("Delete this record?")) {
                                  deleteMutation.mutate(record);
                                }
                              }}
                            >
                              <Trash2 className="mr-1 h-3.5 w-3.5" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editing ? "Edit" : "Add"} {activeSection?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              {(activeSection?.fields ?? []).map((field) => {
                if (field.type === "file") {
                  if (editing) return null;
                  return (
                    <div key={field.key}>
                      <Label>{field.label}</Label>
                      <Input
                        type="file"
                        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                      />
                    </div>
                  );
                }
                if (field.type === "checkbox") {
                  return (
                    <label key={field.key} className="flex items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={Boolean(form[field.key])}
                        onChange={(event) =>
                          setForm({ ...form, [field.key]: event.target.checked })
                        }
                      />
                      {field.label}
                    </label>
                  );
                }
                if (field.type === "textarea") {
                  return (
                    <div key={field.key}>
                      <Label>{field.label}</Label>
                      <Textarea
                        value={String(form[field.key] ?? "")}
                        onChange={(event) =>
                          setForm({ ...form, [field.key]: event.target.value })
                        }
                      />
                    </div>
                  );
                }
                if (field.type === "select" || field.catalog) {
                  const options = catalogOptions(field.catalog);
                  return (
                    <div key={field.key}>
                      <Label>{field.label}</Label>
                      <select
                        className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
                        value={String(form[field.key] ?? "")}
                        onChange={(event) =>
                          setForm({ ...form, [field.key]: event.target.value })
                        }
                        required={field.required}
                      >
                        <option value="">Select…</option>
                        {options.map((option) => (
                          <option
                            key={option.code ?? option.value}
                            value={option.code ?? String(option.value)}
                          >
                            {referenceOptionLabel(option)}
                          </option>
                        ))}
                        {!options.length && form[field.key] ? (
                          <option value={String(form[field.key])}>
                            {String(form[field.key])}
                          </option>
                        ) : null}
                      </select>
                    </div>
                  );
                }
                return (
                  <div key={field.key}>
                    <Label>{field.label}</Label>
                    <Input
                      type={
                        field.type === "date"
                          ? "date"
                          : field.type === "number"
                            ? "number"
                            : "text"
                      }
                      value={String(form[field.key] ?? "")}
                      onChange={(event) =>
                        setForm({ ...form, [field.key]: event.target.value })
                      }
                      required={field.required}
                    />
                  </div>
                );
              })}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

export default EmployeeProfileWorkspace;
