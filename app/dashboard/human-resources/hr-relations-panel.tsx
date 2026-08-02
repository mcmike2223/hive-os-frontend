"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, ShieldAlert, UserMinus } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { getWorkspaceScopeKey } from "@/lib/runtime-context";
import { Employee, hrFetch } from "@/modules/humanresources/api";

const controlClass =
  "h-11 border-slate-500 focus-visible:ring-slate-700 dark:border-slate-400 dark:focus-visible:ring-amber-300";
const selectClass =
  "h-11 w-full rounded-md border border-slate-500 bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-slate-700 dark:border-slate-400 dark:focus-visible:ring-amber-300";

type PunishmentEmployee = Pick<
  Employee,
  "id" | "employee_number" | "primary_name" | "employment_status"
>;

type PunishmentEffect = { effect: string; detail: string };

type AdministrativePunishmentRecord = {
  id: number;
  employee_id: number;
  punishment_type: string;
  reason: string;
  status: string;
  issued_on: string;
  ends_on?: string | null;
  issued_by_name: string | null;
  resolution_notes?: string | null;
  effects_applied?: PunishmentEffect[] | null;
  employee?: PunishmentEmployee | null;
};

type JudiciaryPunishmentRecord = {
  id: number;
  employee_id: number;
  court_name: string;
  case_number: string;
  ruling_type: string;
  penalty_amount: string | number | null;
  currency: string;
  status: string;
  issued_on: string;
  ends_on?: string | null;
  resolution_notes?: string | null;
  effects_applied?: PunishmentEffect[] | null;
  employee?: PunishmentEmployee | null;
};

function employeeOptionLabel(
  employee: Pick<Employee, "primary_name" | "employee_number">,
) {
  return `${employee.primary_name} (${employee.employee_number})`;
}

function formatPunishmentEffects(effects: PunishmentEffect[] | undefined | null) {
  if (!effects?.length) return null;
  return effects.map((item) => item.detail).join(" ");
}

function isAdminActive(status: string) {
  return status === "active";
}

function isJudiciaryActive(status: string) {
  return status === "in_effect";
}

function isTerminationCase(caseItem: AdministrativePunishmentRecord) {
  return caseItem.punishment_type.includes("Termination");
}

function resolveAdminLabel(caseItem: AdministrativePunishmentRecord) {
  if (isTerminationCase(caseItem)) {
    return null;
  }
  if (caseItem.punishment_type.includes("Temporary Suspension")) {
    return "Lift Suspension";
  }
  return "Close Case";
}

export function EmployeeRelationsPanel({
  employees = [],
}: {
  employees?: Employee[];
}) {
  const scope = getWorkspaceScopeKey();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("administrative");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [category, setCategory] = useState<"administrative" | "judiciary">(
    "administrative",
  );
  const [editingAdmin, setEditingAdmin] =
    useState<AdministrativePunishmentRecord | null>(null);
  const [editingJudiciary, setEditingJudiciary] =
    useState<JudiciaryPunishmentRecord | null>(null);
  const [resolvingAdmin, setResolvingAdmin] = useState<{
    caseItem: AdministrativePunishmentRecord;
    status: "closed" | "overturned";
  } | null>(null);
  const [resolvingJudiciary, setResolvingJudiciary] = useState<{
    caseItem: JudiciaryPunishmentRecord;
    status: "closed" | "stayed";
  } | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [resolutionEndsOn, setResolutionEndsOn] = useState("");

  const [newAdmin, setNewAdmin] = useState({
    employee_id: "",
    type: "Written Warning (የጽሁፍ ማስጠንቀቂያ)",
    reason: "",
    date: new Date().toISOString().slice(0, 10),
    ends_on: "",
  });
  const [newJudiciary, setNewJudiciary] = useState({
    employee_id: "",
    court_name: "",
    case_number: "",
    type: "Court Ruling / Judgment (የፍርድ ቤት ውሳኔ)",
    penalty_amount: "",
    date: new Date().toISOString().slice(0, 10),
    ends_on: "",
  });
  const [editAdminForm, setEditAdminForm] = useState({
    reason: "",
    issued_on: "",
    ends_on: "",
    issued_by_name: "",
  });
  const [editJudiciaryForm, setEditJudiciaryForm] = useState({
    court_name: "",
    case_number: "",
    penalty_amount: "",
    issued_on: "",
    ends_on: "",
  });

  const adminQuery = useQuery({
    queryKey: ["hr-administrative-punishments", scope],
    queryFn: () =>
      hrFetch<{ data: AdministrativePunishmentRecord[] }>(
        "/administrative-punishments?per_page=100",
      ),
  });

  const judiciaryQuery = useQuery({
    queryKey: ["hr-judiciary-punishments", scope],
    queryFn: () =>
      hrFetch<{ data: JudiciaryPunishmentRecord[] }>(
        "/judiciary-punishments?per_page=100",
      ),
  });

  const adminCases = adminQuery.data?.data ?? [];
  const judiciaryCases = judiciaryQuery.data?.data ?? [];

  const invalidateRelated = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["hr-administrative-punishments"] }),
      queryClient.invalidateQueries({ queryKey: ["hr-judiciary-punishments"] }),
      queryClient.invalidateQueries({ queryKey: ["hr-employees"] }),
      queryClient.invalidateQueries({ queryKey: ["hr-employees-table"] }),
      queryClient.invalidateQueries({ queryKey: ["all-employees-list"] }),
      queryClient.invalidateQueries({ queryKey: ["hr-summary"] }),
      queryClient.invalidateQueries({ queryKey: ["hr-positions"] }),
    ]);
  };

  const toastWithEffects = (message: string, effects?: PunishmentEffect[]) => {
    const note = formatPunishmentEffects(effects);
    toast.success(note ? `${message} ${note}` : message);
  };

  const adminCreateMutation = useMutation({
    mutationFn: () =>
      hrFetch<{
        message?: string;
        data: AdministrativePunishmentRecord;
        effects?: PunishmentEffect[];
      }>("/administrative-punishments", {
        method: "POST",
        body: JSON.stringify({
          employee_id: Number(newAdmin.employee_id),
          punishment_type: newAdmin.type,
          reason: newAdmin.reason,
          issued_on: newAdmin.date,
          ends_on: newAdmin.ends_on || null,
        }),
      }),
    onSuccess: async (response) => {
      toastWithEffects(
        response.message ?? "Administrative punishment recorded.",
        response.effects,
      );
      setDialogOpen(false);
      setNewAdmin({
        employee_id: "",
        type: "Written Warning (የጽሁፍ ማስጠንቀቂያ)",
        reason: "",
        date: new Date().toISOString().slice(0, 10),
        ends_on: "",
      });
      await invalidateRelated();
    },
    onError: (failure) => {
      toast.error(
        failure instanceof Error
          ? failure.message
          : "Could not save administrative punishment.",
      );
    },
  });

  const judiciaryCreateMutation = useMutation({
    mutationFn: () =>
      hrFetch<{
        message?: string;
        data: JudiciaryPunishmentRecord;
        effects?: PunishmentEffect[];
      }>("/judiciary-punishments", {
        method: "POST",
        body: JSON.stringify({
          employee_id: Number(newJudiciary.employee_id),
          court_name: newJudiciary.court_name.trim(),
          case_number: newJudiciary.case_number.trim(),
          ruling_type: newJudiciary.type,
          penalty_amount: newJudiciary.penalty_amount
            ? Number(newJudiciary.penalty_amount)
            : null,
          issued_on: newJudiciary.date,
          ends_on: newJudiciary.ends_on || null,
        }),
      }),
    onSuccess: async (response) => {
      toastWithEffects(
        response.message ?? "Judiciary punishment recorded.",
        response.effects,
      );
      setDialogOpen(false);
      setNewJudiciary({
        employee_id: "",
        court_name: "",
        case_number: "",
        type: "Court Ruling / Judgment (የፍርድ ቤት ውሳኔ)",
        penalty_amount: "",
        date: new Date().toISOString().slice(0, 10),
        ends_on: "",
      });
      await invalidateRelated();
    },
    onError: (failure) => {
      toast.error(
        failure instanceof Error
          ? failure.message
          : "Could not save judiciary punishment.",
      );
    },
  });

  const adminUpdateMutation = useMutation({
    mutationFn: () =>
      hrFetch<{ message?: string; data: AdministrativePunishmentRecord }>(
        `/administrative-punishments/${editingAdmin!.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            reason: editAdminForm.reason,
            issued_on: editAdminForm.issued_on,
            ends_on: editAdminForm.ends_on || null,
            issued_by_name: editAdminForm.issued_by_name || null,
          }),
        },
      ),
    onSuccess: async (response) => {
      toast.success(response.message ?? "Case updated.");
      setEditingAdmin(null);
      await invalidateRelated();
    },
    onError: (failure) => {
      toast.error(failure instanceof Error ? failure.message : "Update failed.");
    },
  });

  const judiciaryUpdateMutation = useMutation({
    mutationFn: () =>
      hrFetch<{ message?: string; data: JudiciaryPunishmentRecord }>(
        `/judiciary-punishments/${editingJudiciary!.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            court_name: editJudiciaryForm.court_name,
            case_number: editJudiciaryForm.case_number,
            penalty_amount: editJudiciaryForm.penalty_amount
              ? Number(editJudiciaryForm.penalty_amount)
              : null,
            issued_on: editJudiciaryForm.issued_on,
            ends_on: editJudiciaryForm.ends_on || null,
          }),
        },
      ),
    onSuccess: async (response) => {
      toast.success(response.message ?? "Case updated.");
      setEditingJudiciary(null);
      await invalidateRelated();
    },
    onError: (failure) => {
      toast.error(failure instanceof Error ? failure.message : "Update failed.");
    },
  });

  const adminResolveMutation = useMutation({
    mutationFn: () =>
      hrFetch<{
        message?: string;
        data: AdministrativePunishmentRecord;
        effects?: PunishmentEffect[];
      }>(`/administrative-punishments/${resolvingAdmin!.caseItem.id}/resolve`, {
        method: "POST",
        body: JSON.stringify({
          status: resolvingAdmin!.status,
          resolution_notes: resolutionNotes || null,
          ends_on: resolutionEndsOn || null,
        }),
      }),
    onSuccess: async (response) => {
      toastWithEffects(response.message ?? "Case resolved.", response.effects);
      setResolvingAdmin(null);
      setResolutionNotes("");
      setResolutionEndsOn("");
      await invalidateRelated();
    },
    onError: (failure) => {
      toast.error(
        failure instanceof Error ? failure.message : "Could not resolve case.",
      );
    },
  });

  const judiciaryResolveMutation = useMutation({
    mutationFn: () =>
      hrFetch<{
        message?: string;
        data: JudiciaryPunishmentRecord;
        effects?: PunishmentEffect[];
      }>(`/judiciary-punishments/${resolvingJudiciary!.caseItem.id}/resolve`, {
        method: "POST",
        body: JSON.stringify({
          status: resolvingJudiciary!.status,
          resolution_notes: resolutionNotes || null,
          ends_on: resolutionEndsOn || null,
        }),
      }),
    onSuccess: async (response) => {
      toastWithEffects(response.message ?? "Case resolved.", response.effects);
      setResolvingJudiciary(null);
      setResolutionNotes("");
      setResolutionEndsOn("");
      await invalidateRelated();
    },
    onError: (failure) => {
      toast.error(
        failure instanceof Error ? failure.message : "Could not resolve case.",
      );
    },
  });

  const openAdminEdit = (caseItem: AdministrativePunishmentRecord) => {
    setEditingAdmin(caseItem);
    setEditAdminForm({
      reason: caseItem.reason,
      issued_on: caseItem.issued_on,
      ends_on: caseItem.ends_on ?? "",
      issued_by_name: caseItem.issued_by_name ?? "",
    });
  };

  const openJudiciaryEdit = (caseItem: JudiciaryPunishmentRecord) => {
    setEditingJudiciary(caseItem);
    setEditJudiciaryForm({
      court_name: caseItem.court_name,
      case_number: caseItem.case_number,
      penalty_amount:
        caseItem.penalty_amount != null ? String(caseItem.penalty_amount) : "",
      issued_on: caseItem.issued_on,
      ends_on: caseItem.ends_on ?? "",
    });
  };

  return (
    <Card className="border-slate-300 dark:border-slate-700">
      <CardContent className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              Employee Relations & Disciplinary Management (የቅጣት መዝገብ)
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Record cases, edit details, then close or lift suspension. Overturn is only for reversing a permanent termination.
            </p>
          </div>
          <Button
            onClick={() => setDialogOpen(true)}
            className="bg-amber-300 font-bold text-slate-950 hover:bg-amber-200"
          >
            <UserMinus className="mr-2 h-4 w-4" />
            Record Punishment Case
          </Button>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="mt-6 space-y-4"
        >
          <TabsList className="h-auto justify-start rounded-xl border bg-slate-100 p-1 dark:bg-slate-900">
            <TabsTrigger value="administrative" className="min-h-10 px-4 font-bold">
              1. Administrative Punishments
            </TabsTrigger>
            <TabsTrigger value="judiciary" className="min-h-10 px-4 font-bold">
              2. Judiciary Punishments
            </TabsTrigger>
          </TabsList>

          <TabsContent value="administrative">
            <div className="overflow-x-auto rounded-xl border border-slate-300 dark:border-slate-700">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-slate-100 text-xs font-bold uppercase text-slate-600 dark:bg-slate-900 dark:text-slate-400">
                  <tr>
                    <th className="p-3">Employee</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Reason</th>
                    <th className="p-3">Issued</th>
                    <th className="p-3">Ends</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Effects</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {adminQuery.isLoading ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-sm text-slate-500">
                        Loading...
                      </td>
                    </tr>
                  ) : adminCases.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-sm text-slate-500">
                        No administrative punishments recorded yet.
                      </td>
                    </tr>
                  ) : (
                    adminCases.map((c) => {
                      const closeLabel = resolveAdminLabel(c);
                      return (
                        <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                          <td className="p-3 font-bold">
                            {c.employee
                              ? employeeOptionLabel(c.employee)
                              : `Employee #${c.employee_id}`}
                          </td>
                          <td className="p-3">
                            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                              {c.punishment_type}
                            </span>
                          </td>
                          <td className="max-w-[220px] p-3 text-slate-600 dark:text-slate-300">
                            {c.reason}
                          </td>
                          <td className="p-3 text-xs font-medium">{c.issued_on}</td>
                          <td className="p-3 text-xs font-medium">{c.ends_on || "—"}</td>
                          <td className="p-3">
                            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold capitalize text-emerald-800">
                              {c.status.replaceAll("_", " ")}
                            </span>
                          </td>
                          <td className="p-3 text-xs text-slate-500">
                            {formatPunishmentEffects(c.effects_applied) ?? "—"}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            {isAdminActive(c.status) ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    aria-label="Case actions"
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuItem onSelect={() => openAdminEdit(c)}>
                                    Edit details
                                  </DropdownMenuItem>
                                  {closeLabel ? (
                                    <DropdownMenuItem
                                      onSelect={() => {
                                        setResolvingAdmin({
                                          caseItem: c,
                                          status: "closed",
                                        });
                                        setResolutionEndsOn(
                                          c.ends_on ||
                                            new Date().toISOString().slice(0, 10),
                                        );
                                        setResolutionNotes("");
                                      }}
                                    >
                                      {closeLabel}
                                    </DropdownMenuItem>
                                  ) : null}
                                  {isTerminationCase(c) ? (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        className="text-red-600 focus:text-red-600"
                                        onSelect={() => {
                                          setResolvingAdmin({
                                            caseItem: c,
                                            status: "overturned",
                                          });
                                          setResolutionEndsOn(
                                            c.ends_on ||
                                              new Date().toISOString().slice(0, 10),
                                          );
                                          setResolutionNotes("");
                                        }}
                                      >
                                        Overturn termination
                                      </DropdownMenuItem>
                                    </>
                                  ) : null}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              <span className="text-xs text-slate-400">Resolved</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="judiciary">
            <div className="overflow-x-auto rounded-xl border border-slate-300 dark:border-slate-700">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-slate-100 text-xs font-bold uppercase text-slate-600 dark:bg-slate-900 dark:text-slate-400">
                  <tr>
                    <th className="p-3">Employee</th>
                    <th className="p-3">Court</th>
                    <th className="p-3">Case</th>
                    <th className="p-3">Ruling</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Issued</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {judiciaryQuery.isLoading ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-sm text-slate-500">
                        Loading...
                      </td>
                    </tr>
                  ) : judiciaryCases.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-sm text-slate-500">
                        No judiciary punishments recorded yet.
                      </td>
                    </tr>
                  ) : (
                    judiciaryCases.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                        <td className="p-3 font-bold">
                          {c.employee
                            ? employeeOptionLabel(c.employee)
                            : `Employee #${c.employee_id}`}
                        </td>
                        <td className="p-3">{c.court_name}</td>
                        <td className="p-3 font-mono text-xs">{c.case_number}</td>
                        <td className="p-3">
                          <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-900 dark:bg-red-950 dark:text-red-200">
                            {c.ruling_type}
                          </span>
                        </td>
                        <td className="p-3">
                          {c.penalty_amount != null && c.penalty_amount !== ""
                            ? `${Number(c.penalty_amount).toLocaleString()} ${c.currency || "ETB"}`
                            : "N/A"}
                        </td>
                        <td className="p-3 text-xs font-medium">{c.issued_on}</td>
                        <td className="p-3">
                          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold capitalize text-emerald-800">
                            {c.status.replaceAll("_", " ")}
                          </span>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {isJudiciaryActive(c.status) ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  aria-label="Case actions"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem onSelect={() => openJudiciaryEdit(c)}>
                                  Edit details
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={() => {
                                    setResolvingJudiciary({
                                      caseItem: c,
                                      status: "closed",
                                    });
                                    setResolutionEndsOn(
                                      c.ends_on ||
                                        new Date().toISOString().slice(0, 10),
                                    );
                                    setResolutionNotes("");
                                  }}
                                >
                                  Close case
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={() => {
                                    setResolvingJudiciary({
                                      caseItem: c,
                                      status: "stayed",
                                    });
                                    setResolutionEndsOn(
                                      c.ends_on ||
                                        new Date().toISOString().slice(0, 10),
                                    );
                                    setResolutionNotes("");
                                  }}
                                >
                                  Stay case
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <span className="text-xs text-slate-400">Resolved</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>

        {/* Create dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-black">
                <ShieldAlert className="h-5 w-5 text-red-500" />
                Record Punishment Case
              </DialogTitle>
              <DialogDescription>
                Choose administrative or judiciary, then link a real employee.
              </DialogDescription>
            </DialogHeader>

            <div className="flex gap-2 border-b pb-3">
              <Button
                type="button"
                variant={category === "administrative" ? "default" : "outline"}
                onClick={() => setCategory("administrative")}
                className="flex-1 text-xs font-bold sm:text-sm"
              >
                Administrative
              </Button>
              <Button
                type="button"
                variant={category === "judiciary" ? "default" : "outline"}
                onClick={() => setCategory("judiciary")}
                className="flex-1 text-xs font-bold sm:text-sm"
              >
                Judiciary
              </Button>
            </div>

            {category === "administrative" ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  adminCreateMutation.mutate();
                }}
                className="space-y-4 pt-2"
              >
                <div>
                  <Label htmlFor="admin-emp">Employee *</Label>
                  <select
                    id="admin-emp"
                    value={newAdmin.employee_id}
                    onChange={(e) =>
                      setNewAdmin({ ...newAdmin, employee_id: e.target.value })
                    }
                    required
                    className={selectClass}
                  >
                    <option value="">Select employee</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employeeOptionLabel(employee)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="admin-type">Punishment Type *</Label>
                  <select
                    id="admin-type"
                    value={newAdmin.type}
                    onChange={(e) => setNewAdmin({ ...newAdmin, type: e.target.value })}
                    className={selectClass}
                  >
                    <option value="Verbal Warning (የቃል ማስጠንቀቂያ)">Verbal Warning</option>
                    <option value="Written Warning (የጽሁፍ ማስጠንቀቂያ)">Written Warning</option>
                    <option value="Final Written Warning (የመጨረሻ የጽሁፍ ማስጠንቀቂያ)">
                      Final Written Warning
                    </option>
                    <option value="Salary Deduction / Fine (የደመወዝ ቅጣት)">
                      Salary Deduction / Fine
                    </option>
                    <option value="Temporary Suspension (ጊዜያዊ እገዳ)">
                      Temporary Suspension
                    </option>
                    <option value="Termination of Employment (ከስራ ማሰናበት)">
                      Termination of Employment
                    </option>
                  </select>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="admin-date">Issued Date *</Label>
                    <Input
                      id="admin-date"
                      type="date"
                      value={newAdmin.date}
                      onChange={(e) => setNewAdmin({ ...newAdmin, date: e.target.value })}
                      required
                      className={controlClass}
                    />
                  </div>
                  <div>
                    <Label htmlFor="admin-ends">Ends On (optional)</Label>
                    <Input
                      id="admin-ends"
                      type="date"
                      value={newAdmin.ends_on}
                      onChange={(e) =>
                        setNewAdmin({ ...newAdmin, ends_on: e.target.value })
                      }
                      className={controlClass}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="admin-reason">Reason *</Label>
                  <Textarea
                    id="admin-reason"
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
                  <Button
                    type="submit"
                    disabled={
                      adminCreateMutation.isPending ||
                      !newAdmin.employee_id ||
                      employees.length === 0
                    }
                  >
                    {adminCreateMutation.isPending ? "Saving..." : "Save Case"}
                  </Button>
                </DialogFooter>
              </form>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  judiciaryCreateMutation.mutate();
                }}
                className="space-y-4 pt-2"
              >
                <div>
                  <Label htmlFor="jud-emp">Employee *</Label>
                  <select
                    id="jud-emp"
                    value={newJudiciary.employee_id}
                    onChange={(e) =>
                      setNewJudiciary({ ...newJudiciary, employee_id: e.target.value })
                    }
                    required
                    className={selectClass}
                  >
                    <option value="">Select employee</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employeeOptionLabel(employee)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="jud-court">Court Name *</Label>
                    <Input
                      id="jud-court"
                      placeholder="e.g. Federal First Instance Court"
                      value={newJudiciary.court_name}
                      onChange={(e) =>
                        setNewJudiciary({ ...newJudiciary, court_name: e.target.value })
                      }
                      required
                      className={controlClass}
                    />
                  </div>
                  <div>
                    <Label htmlFor="jud-case">Case Number *</Label>
                    <Input
                      id="jud-case"
                      placeholder="e.g. FFC/2026/9041"
                      value={newJudiciary.case_number}
                      onChange={(e) =>
                        setNewJudiciary({ ...newJudiciary, case_number: e.target.value })
                      }
                      required
                      className={controlClass}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="jud-type">Ruling Type *</Label>
                  <select
                    id="jud-type"
                    value={newJudiciary.type}
                    onChange={(e) =>
                      setNewJudiciary({ ...newJudiciary, type: e.target.value })
                    }
                    className={selectClass}
                  >
                    <option value="Court Ruling / Judgment (የፍርድ ቤት ውሳኔ)">
                      Court Ruling / Judgment
                    </option>
                    <option value="Salary Garnishment / Injunction (የደመወዝ መያዝ መመሪያ)">
                      Salary Garnishment
                    </option>
                    <option value="Legal Penalty / Fine (ህጋዊ የገንዘብ ቅጣት)">
                      Legal Penalty / Fine
                    </option>
                    <option value="Restraining / Injunction Order (የፍርድ ቤት ዕገዳ)">
                      Restraining Order
                    </option>
                    <option value="Bail / Guarantor Enforcement (የዋስትና ማስከበር)">
                      Bail Enforcement
                    </option>
                  </select>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="jud-amount">Amount (ETB)</Label>
                    <Input
                      id="jud-amount"
                      type="number"
                      placeholder="e.g. 5000"
                      value={newJudiciary.penalty_amount}
                      onChange={(e) =>
                        setNewJudiciary({
                          ...newJudiciary,
                          penalty_amount: e.target.value,
                        })
                      }
                      className={controlClass}
                    />
                  </div>
                  <div>
                    <Label htmlFor="jud-date">Ruling Date *</Label>
                    <Input
                      id="jud-date"
                      type="date"
                      value={newJudiciary.date}
                      onChange={(e) =>
                        setNewJudiciary({ ...newJudiciary, date: e.target.value })
                      }
                      required
                      className={controlClass}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-red-600 text-white hover:bg-red-700"
                    disabled={
                      judiciaryCreateMutation.isPending ||
                      !newJudiciary.employee_id ||
                      employees.length === 0
                    }
                  >
                    {judiciaryCreateMutation.isPending ? "Saving..." : "Save Record"}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit admin */}
        <Dialog
          open={!!editingAdmin}
          onOpenChange={(open) => !open && setEditingAdmin(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Administrative Case</DialogTitle>
              <DialogDescription>
                Update case details. Type and employee stay fixed after creation.
              </DialogDescription>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                adminUpdateMutation.mutate();
              }}
            >
              <div>
                <Label>Reason *</Label>
                <Textarea
                  value={editAdminForm.reason}
                  onChange={(e) =>
                    setEditAdminForm({ ...editAdminForm, reason: e.target.value })
                  }
                  required
                  className="h-20"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Issued On *</Label>
                  <Input
                    type="date"
                    value={editAdminForm.issued_on}
                    onChange={(e) =>
                      setEditAdminForm({ ...editAdminForm, issued_on: e.target.value })
                    }
                    required
                    className={controlClass}
                  />
                </div>
                <div>
                  <Label>Ends On</Label>
                  <Input
                    type="date"
                    value={editAdminForm.ends_on}
                    onChange={(e) =>
                      setEditAdminForm({ ...editAdminForm, ends_on: e.target.value })
                    }
                    className={controlClass}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingAdmin(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={adminUpdateMutation.isPending}>
                  {adminUpdateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit judiciary */}
        <Dialog
          open={!!editingJudiciary}
          onOpenChange={(open) => !open && setEditingJudiciary(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Judiciary Case</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                judiciaryUpdateMutation.mutate();
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Court Name *</Label>
                  <Input
                    value={editJudiciaryForm.court_name}
                    onChange={(e) =>
                      setEditJudiciaryForm({
                        ...editJudiciaryForm,
                        court_name: e.target.value,
                      })
                    }
                    required
                    className={controlClass}
                  />
                </div>
                <div>
                  <Label>Case Number *</Label>
                  <Input
                    value={editJudiciaryForm.case_number}
                    onChange={(e) =>
                      setEditJudiciaryForm({
                        ...editJudiciaryForm,
                        case_number: e.target.value,
                      })
                    }
                    required
                    className={controlClass}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Amount (ETB)</Label>
                  <Input
                    type="number"
                    value={editJudiciaryForm.penalty_amount}
                    onChange={(e) =>
                      setEditJudiciaryForm({
                        ...editJudiciaryForm,
                        penalty_amount: e.target.value,
                      })
                    }
                    className={controlClass}
                  />
                </div>
                <div>
                  <Label>Issued On *</Label>
                  <Input
                    type="date"
                    value={editJudiciaryForm.issued_on}
                    onChange={(e) =>
                      setEditJudiciaryForm({
                        ...editJudiciaryForm,
                        issued_on: e.target.value,
                      })
                    }
                    required
                    className={controlClass}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingJudiciary(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={judiciaryUpdateMutation.isPending}>
                  {judiciaryUpdateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Resolve admin */}
        <Dialog
          open={!!resolvingAdmin}
          onOpenChange={(open) => !open && setResolvingAdmin(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {resolvingAdmin?.status === "overturned"
                  ? "Overturn Termination"
                  : resolvingAdmin?.caseItem.punishment_type.includes("Suspension")
                    ? "Lift Suspension"
                    : "Close Case"}
              </DialogTitle>
              <DialogDescription>
                {resolvingAdmin?.status === "overturned"
                  ? "Reverses the termination and restores the employee to active status. Re-assign positions manually if needed."
                  : "Updates the case status and reverses related effects where applicable (e.g. restore employment status after suspension)."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Effective End Date</Label>
                <Input
                  type="date"
                  value={resolutionEndsOn}
                  onChange={(e) => setResolutionEndsOn(e.target.value)}
                  className={controlClass}
                />
              </div>
              <div>
                <Label>Resolution Notes</Label>
                <Textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Optional notes for the HR file..."
                  className="h-20"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setResolvingAdmin(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant={
                  resolvingAdmin?.status === "overturned" ? "destructive" : "default"
                }
                disabled={adminResolveMutation.isPending}
                onClick={() => adminResolveMutation.mutate()}
              >
                {adminResolveMutation.isPending ? "Saving..." : "Confirm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Resolve judiciary */}
        <Dialog
          open={!!resolvingJudiciary}
          onOpenChange={(open) => !open && setResolvingJudiciary(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {resolvingJudiciary?.status === "stayed" ? "Stay Case" : "Close Case"}
              </DialogTitle>
              <DialogDescription>
                Marks the judiciary case resolved and clears related payroll/legal
                follow-up flags.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Effective End Date</Label>
                <Input
                  type="date"
                  value={resolutionEndsOn}
                  onChange={(e) => setResolutionEndsOn(e.target.value)}
                  className={controlClass}
                />
              </div>
              <div>
                <Label>Resolution Notes</Label>
                <Textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  className="h-20"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setResolvingJudiciary(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={judiciaryResolveMutation.isPending}
                onClick={() => judiciaryResolveMutation.mutate()}
              >
                {judiciaryResolveMutation.isPending ? "Saving..." : "Confirm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
