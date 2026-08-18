"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/store/use-translation";

import { DataTable, type DataTableQuery } from "@/components/datatable/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { talentApi } from "@/modules/humanresources/talent/api";
import type { Competency } from "@/modules/humanresources/talent/types";

type CompetencyForm = {
  id?: number;
  code: string;
  name: string;
  category: string;
  description: string;
  max_level: string;
  is_active: boolean;
};

const DEFAULT_COMPETENCY: CompetencyForm = {
  code: "",
  name: "",
  category: "",
  description: "",
  max_level: "5",
  is_active: true,
};

type AssessForm = { employee_id: string; competency_id: string; proficiency_level: string; evidence: string };
type RequirementForm = { position_id: string; competency_id: string; required_level: string; is_critical: boolean };

export default function CompetenciesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [tableQuery, setTableQuery] = React.useState({ page: 1, pageSize: 10, search: "" });
  const [formOpen, setFormOpen] = React.useState(false);
  const [form, setForm] = React.useState<CompetencyForm>(DEFAULT_COMPETENCY);
  const [assessOpen, setAssessOpen] = React.useState(false);
  const [assess, setAssess] = React.useState<AssessForm>({
    employee_id: "",
    competency_id: "",
    proficiency_level: "1",
    evidence: "",
  });
  const [requirementOpen, setRequirementOpen] = React.useState(false);
  const [requirement, setRequirement] = React.useState<RequirementForm>({
    position_id: "",
    competency_id: "",
    required_level: "3",
    is_critical: false,
  });

  const listQuery = useQuery({
    queryKey: ["hr-talent", "competencies", tableQuery],
    queryFn: () =>
      talentApi
        .listCompetencies({
          page: tableQuery.page,
          limit: tableQuery.pageSize,
          search: tableQuery.search || undefined,
        })
        .then((res) => res.data),
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["hr-talent"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) =>
    error?.response?.data?.message || fallback;

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        code: form.code,
        name: form.name,
        category: form.category || null,
        description: form.description || null,
        max_level: Number(form.max_level || 5),
        is_active: form.is_active,
      };

      return form.id ? talentApi.updateCompetency(form.id, payload) : talentApi.createCompetency(payload);
    },
    onSuccess: () => {
      toast.success(t("hr_talent.competencies.saved", "Competency saved."));
      invalidate();
      setFormOpen(false);
      setForm(DEFAULT_COMPETENCY);
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("hr_talent.competencies.save_failed", "Could not save the competency."))),
  });

  const remove = useMutation({
    mutationFn: (id: number) => talentApi.deleteCompetency(id),
    // The API deactivates rather than deletes when assessments already
    // reference the competency, and says so in the message. Surface its words
    // instead of claiming a delete that did not happen.
    onSuccess: (response: any) => {
      toast.success(response?.data?.message || t("hr_talent.competencies.deleted", "Competency deleted."));
      invalidate();
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("hr_talent.competencies.delete_failed", "Could not remove it."))),
  });

  const saveAssessment = useMutation({
    mutationFn: () =>
      talentApi.setEmployeeCompetency({
        employee_id: Number(assess.employee_id),
        competency_id: Number(assess.competency_id),
        proficiency_level: Number(assess.proficiency_level || 0),
        assessed_on: new Date().toISOString().slice(0, 10),
        evidence: assess.evidence || null,
      }),
    onSuccess: () => {
      toast.success(t("hr_talent.competencies.assessed", "Assessment recorded."));
      invalidate();
      setAssessOpen(false);
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("hr_talent.competencies.assess_failed", "Could not record the assessment."))),
  });

  const saveRequirement = useMutation({
    mutationFn: () =>
      talentApi.setPositionCompetency({
        position_id: Number(requirement.position_id),
        competency_id: Number(requirement.competency_id),
        required_level: Number(requirement.required_level || 1),
        is_critical: requirement.is_critical,
      }),
    onSuccess: () => {
      toast.success(t("hr_talent.competencies.required", "Position requirement saved."));
      invalidate();
      setRequirementOpen(false);
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("hr_talent.competencies.require_failed", "Could not save the requirement."))),
  });

  const handleTableQueryChange = React.useCallback((query: DataTableQuery) => {
    setTableQuery({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || 10),
      search: String(query.search ?? ""),
    });
  }, []);

  const competencies = (listQuery.data?.data ?? []) as Competency[];

  const columns = React.useMemo<ColumnDef<Competency>[]>(
    () => [
      {
        id: "competency",
        header: t("hr_talent.competencies.competency", "Competency"),
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-bold">{row.original.name}</p>
            <p className="font-mono text-[11px] text-muted-foreground">{row.original.code}</p>
          </div>
        ),
      },
      {
        accessorKey: "category",
        header: t("hr_talent.common.category", "Category"),
        cell: ({ row }) =>
          row.original.category ? (
            <Badge variant="outline" className="text-[11px] font-semibold capitalize">
              {row.original.category.replace(/_/g, " ")}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: "max_level",
        header: t("hr_talent.competencies.scale", "Scale"),
        cell: ({ row }) => (
          <span className="text-xs tabular-nums">1 – {row.original.max_level}</span>
        ),
      },
      {
        accessorKey: "is_active",
        header: t("hr_talent.common.status", "Status"),
        cell: ({ row }) => (
          <Badge variant={row.original.is_active ? "default" : "secondary"} className="text-[11px]">
            {row.original.is_active
              ? t("hr_talent.common.active", "Active")
              : t("hr_talent.common.retired", "Retired")}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setForm({
                  id: row.original.id,
                  code: row.original.code,
                  name: row.original.name,
                  category: row.original.category ?? "",
                  description: row.original.description ?? "",
                  max_level: String(row.original.max_level ?? 5),
                  is_active: row.original.is_active,
                });
                setFormOpen(true);
              }}
            >
              {t("hr_talent.common.edit", "Edit")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => remove.mutate(row.original.id)}
              aria-label={t("hr_talent.common.remove", "Remove")}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [t, remove],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {t("hr_talent.competencies.title", "Competency Framework")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "hr_talent.competencies.subtitle",
              "The skills the business names, the level each role needs, and where each person currently stands.",
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-full px-5" onClick={() => setRequirementOpen(true)}>
            {t("hr_talent.competencies.set_requirement", "Role Requirement")}
          </Button>
          <Button variant="outline" className="rounded-full px-5" onClick={() => setAssessOpen(true)}>
            {t("hr_talent.competencies.assess", "Assess Employee")}
          </Button>
          <Button
            className="rounded-full px-5"
            onClick={() => {
              setForm(DEFAULT_COMPETENCY);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t("hr_talent.competencies.add", "Add Competency")}
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={competencies}
        totalEntries={listQuery.data?.meta?.total ?? 0}
        loading={listQuery.isLoading}
        pageIndex={tableQuery.page}
        pageSize={tableQuery.pageSize}
        onQueryChange={handleTableQueryChange}
        searchPlaceholder={t("hr_talent.competencies.search", "Search competencies...")}
        resourceName="hr-competencies"
      />

      {/* Competency */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {form.id
                  ? t("hr_talent.competencies.edit", "Edit Competency")
                  : t("hr_talent.competencies.new", "New Competency")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "hr_talent.competencies.form_desc",
                  "A competency is measured on one scale everywhere it is used, so keep the scale stable once people have been assessed against it.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="comp-code">{t("hr_talent.common.code", "Code")}</Label>
              <Input
                id="comp-code"
                value={form.code}
                onChange={(event) => setForm({ ...form, code: event.target.value })}
                placeholder="LEAD-01"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="comp-name">{t("hr_talent.common.name", "Name")}</Label>
              <Input
                id="comp-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="comp-category">{t("hr_talent.common.category", "Category")}</Label>
              <Input
                id="comp-category"
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
                placeholder={t("hr_talent.competencies.category_hint", "Leadership, Technical, Safety...")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="comp-max">{t("hr_talent.competencies.max_level", "Highest level")}</Label>
              <Input
                id="comp-max"
                type="number"
                min={1}
                max={10}
                value={form.max_level}
                onChange={(event) => setForm({ ...form, max_level: event.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="comp-desc">{t("hr_talent.common.description", "Description")}</Label>
              <Textarea
                id="comp-desc"
                rows={3}
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </div>
            <div className="flex items-center gap-3 sm:col-span-2">
              <Switch
                id="comp-active"
                checked={form.is_active}
                onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
              />
              <Label htmlFor="comp-active">{t("hr_talent.common.active", "Active")}</Label>
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setFormOpen(false)}>
              {t("hr_talent.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending || !form.code.trim() || !form.name.trim()}
            >
              {t("hr_talent.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assessment */}
      <Dialog open={assessOpen} onOpenChange={setAssessOpen}>
        <DialogContent className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("hr_talent.competencies.assess", "Assess Employee")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "hr_talent.competencies.assess_desc",
                  "Recording a level here closes succession gaps and moves development plans forward automatically.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="assess-employee">{t("hr_talent.common.employee_id", "Employee ID")}</Label>
              <Input
                id="assess-employee"
                type="number"
                value={assess.employee_id}
                onChange={(event) => setAssess({ ...assess, employee_id: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="assess-competency">{t("hr_talent.competencies.competency", "Competency")}</Label>
              <select
                id="assess-competency"
                value={assess.competency_id}
                onChange={(event) => setAssess({ ...assess, competency_id: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{t("hr_talent.common.select", "Select...")}</option>
                {competencies.map((competency) => (
                  <option key={competency.id} value={competency.id}>
                    {competency.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="assess-level">{t("hr_talent.competencies.level", "Level")}</Label>
              <Input
                id="assess-level"
                type="number"
                min={0}
                max={10}
                value={assess.proficiency_level}
                onChange={(event) => setAssess({ ...assess, proficiency_level: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="assess-evidence">{t("hr_talent.competencies.evidence", "Evidence")}</Label>
              <Input
                id="assess-evidence"
                value={assess.evidence}
                onChange={(event) => setAssess({ ...assess, evidence: event.target.value })}
                placeholder={t("hr_talent.competencies.evidence_hint", "Certificate, appraisal, observation")}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setAssessOpen(false)}>
              {t("hr_talent.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => saveAssessment.mutate()}
              disabled={saveAssessment.isPending || !assess.employee_id || !assess.competency_id}
            >
              {t("hr_talent.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Position requirement */}
      <Dialog open={requirementOpen} onOpenChange={setRequirementOpen}>
        <DialogContent className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("hr_talent.competencies.set_requirement", "Role Requirement")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "hr_talent.competencies.require_desc",
                  "Marking a requirement critical caps anyone who does not meet it below ready-now, however well they score elsewhere.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="require-position">{t("hr_talent.common.position_id", "Position ID")}</Label>
              <Input
                id="require-position"
                type="number"
                value={requirement.position_id}
                onChange={(event) => setRequirement({ ...requirement, position_id: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="require-competency">{t("hr_talent.competencies.competency", "Competency")}</Label>
              <select
                id="require-competency"
                value={requirement.competency_id}
                onChange={(event) => setRequirement({ ...requirement, competency_id: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{t("hr_talent.common.select", "Select...")}</option>
                {competencies.map((competency) => (
                  <option key={competency.id} value={competency.id}>
                    {competency.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="require-level">{t("hr_talent.competencies.required_level", "Required level")}</Label>
              <Input
                id="require-level"
                type="number"
                min={1}
                max={10}
                value={requirement.required_level}
                onChange={(event) => setRequirement({ ...requirement, required_level: event.target.value })}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="require-critical"
                checked={requirement.is_critical}
                onCheckedChange={(checked) => setRequirement({ ...requirement, is_critical: checked })}
              />
              <Label htmlFor="require-critical">{t("hr_talent.competencies.critical", "Critical")}</Label>
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setRequirementOpen(false)}>
              {t("hr_talent.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => saveRequirement.mutate()}
              disabled={saveRequirement.isPending || !requirement.position_id || !requirement.competency_id}
            >
              {t("hr_talent.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
