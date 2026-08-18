"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { productionApi } from "@/modules/production/api";
import type { ProductionLine } from "@/modules/production/types";

const LINE_TYPES = [
  { value: "blow_fill_cap", label: "Blow-Fill-Cap" },
  { value: "three_in_one", label: "3-in-1 Rinse-Fill-Cap" },
  { value: "jar_line", label: "20L Returnable Jar" },
  { value: "preform_blowing", label: "Preform Blowing" },
  { value: "packing", label: "Packing / Shrink Wrap" },
  { value: "manual", label: "Manual / Semi-Automatic" },
];

type LineForm = {
  id?: number;
  name: string;
  code: string;
  line_type: string;
  rated_speed_bph: string;
  supported_formats: string;
  commissioned_on: string;
  is_active: boolean;
  notes: string;
};

const DEFAULT_FORM: LineForm = {
  name: "",
  code: "",
  line_type: "blow_fill_cap",
  rated_speed_bph: "",
  supported_formats: "",
  commissioned_on: "",
  is_active: true,
  notes: "",
};

export default function ProductionLinesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [tableQuery, setTableQuery] = React.useState({
    page: 1,
    pageSize: 10,
    search: "",
    sortCol: "name",
    sortDir: "asc" as "asc" | "desc",
  });
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<LineForm>(DEFAULT_FORM);

  const linesQuery = useQuery({
    queryKey: ["production", "lines", tableQuery],
    queryFn: () =>
      productionApi
        .listLines({
          search: tableQuery.search || undefined,
          page: tableQuery.page,
          limit: tableQuery.pageSize,
          sort_col: tableQuery.sortCol,
          sort_dir: tableQuery.sortDir,
        })
        .then((res) => res.data),
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim(),
        line_type: form.line_type,
        rated_speed_bph: Number(form.rated_speed_bph || 0),
        supported_formats: form.supported_formats
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        commissioned_on: form.commissioned_on || undefined,
        is_active: form.is_active,
        notes: form.notes || undefined,
      };

      return form.id ? productionApi.updateLine(form.id, payload) : productionApi.createLine(payload);
    },
    onSuccess: () => {
      toast.success(t("production.lines.saved", "Production line saved."));
      queryClient.invalidateQueries({ queryKey: ["production", "lines"] });
      setOpen(false);
      setForm(DEFAULT_FORM);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || t("production.lines.save_failed", "Could not save the line."));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => productionApi.deleteLine(id),
    onSuccess: (response) => {
      toast.success(response?.data?.message || t("production.lines.deleted", "Production line removed."));
      queryClient.invalidateQueries({ queryKey: ["production", "lines"] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || t("production.lines.delete_failed", "Could not remove the line."));
    },
  });

  const handleTableQueryChange = React.useCallback((query: DataTableQuery) => {
    setTableQuery({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || 10),
      search: String(query.search ?? ""),
      sortCol: String(query.sortCol || "name"),
      sortDir: query.sortDir === "desc" ? "desc" : "asc",
    });
  }, []);

  const columns = React.useMemo<ColumnDef<ProductionLine>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("production.lines.col_line", "Line"),
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-bold">{row.original.name}</p>
            <p className="font-mono text-[11px] text-muted-foreground">{row.original.code}</p>
          </div>
        ),
      },
      {
        accessorKey: "line_type",
        header: t("production.common.type", "Type"),
        cell: ({ row }) => (
          <Badge variant="outline" className="text-[11px] font-semibold">
            {LINE_TYPES.find((type) => type.value === row.original.line_type)?.label ?? row.original.line_type}
          </Badge>
        ),
      },
      {
        accessorKey: "rated_speed_bph",
        header: t("production.lines.rated_speed", "Rated Speed"),
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">
            {Number(row.original.rated_speed_bph).toLocaleString()} {t("production.lines.bph", "bph")}
          </span>
        ),
      },
      {
        id: "formats",
        header: t("production.lines.formats", "Formats"),
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {(row.original.supported_formats ?? []).map((format) => (
              <Badge key={format} variant="secondary" className="text-[10px] font-bold">
                {format}
              </Badge>
            ))}
            {(row.original.supported_formats ?? []).length === 0 ? (
              <span className="text-xs text-muted-foreground">-</span>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "is_active",
        header: t("production.common.status", "Status"),
        cell: ({ row }) =>
          row.original.is_active ? (
            <Badge variant="outline" className="border-transparent bg-emerald-500/15 text-[11px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
              {t("production.common.active", "Active")}
            </Badge>
          ) : (
            <Badge variant="outline" className="border-transparent bg-muted text-[11px] font-black uppercase tracking-widest text-muted-foreground">
              {t("production.common.retired", "Retired")}
            </Badge>
          ),
      },
      {
        id: "actions",
        header: t("production.common.actions", "Actions"),
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => {
                const line = row.original;
                setForm({
                  id: line.id,
                  name: line.name,
                  code: line.code,
                  line_type: line.line_type,
                  rated_speed_bph: String(line.rated_speed_bph ?? ""),
                  supported_formats: (line.supported_formats ?? []).join(", "),
                  commissioned_on: line.commissioned_on ?? "",
                  is_active: line.is_active,
                  notes: line.notes ?? "",
                });
                setOpen(true);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 text-destructive"
              onClick={() => deleteMutation.mutate(row.original.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    [deleteMutation, t],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">{t("production.lines.title", "Production Lines")}</h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "production.lines.subtitle",
              "The rated speed here is the denominator of the OEE performance factor, so keep it at the real nameplate.",
            )}
          </p>
        </div>
        <Button
          className="rounded-full px-5"
          onClick={() => {
            setForm(DEFAULT_FORM);
            setOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {t("production.lines.add_btn", "Add Line")}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={(linesQuery.data?.data ?? []) as ProductionLine[]}
        totalEntries={linesQuery.data?.meta?.total ?? 0}
        loading={linesQuery.isLoading}
        pageIndex={tableQuery.page}
        pageSize={tableQuery.pageSize}
        onQueryChange={handleTableQueryChange}
        searchPlaceholder={t("production.lines.search_placeholder", "Search lines...")}
        resourceName="production-lines"
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {form.id
                  ? t("production.lines.edit_title", "Edit Production Line")
                  : t("production.lines.create_title", "Add Production Line")}
              </DialogTitle>
              <DialogDescription>
                {t("production.lines.create_desc", "Describe the equipment as it runs, not as it was sold.")}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="line-name">{t("production.common.name", "Name")}</Label>
              <Input
                id="line-name"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Line 1 — PET Blow-Fill-Cap"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="line-code">{t("production.common.code", "Code")}</Label>
              <Input
                id="line-code"
                value={form.code}
                onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
                placeholder="L1"
              />
              <p className="text-[11px] text-muted-foreground">
                {t("production.lines.code_hint", "The code prefixes every lot number produced on this line.")}
              </p>
            </div>
            <div className="space-y-2">
              <Label>{t("production.common.type", "Type")}</Label>
              <Select value={form.line_type} onValueChange={(value) => setForm((prev) => ({ ...prev, line_type: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LINE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="line-speed">{t("production.lines.rated_speed_bph", "Rated Speed (bottles/hour)")}</Label>
              <Input
                id="line-speed"
                type="number"
                value={form.rated_speed_bph}
                onChange={(event) => setForm((prev) => ({ ...prev, rated_speed_bph: event.target.value }))}
                placeholder="6000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="line-formats">{t("production.lines.supported_formats", "Supported Formats")}</Label>
              <Input
                id="line-formats"
                value={form.supported_formats}
                onChange={(event) => setForm((prev) => ({ ...prev, supported_formats: event.target.value }))}
                placeholder="0.5L, 1L, 2L"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="line-commissioned">{t("production.lines.commissioned", "Commissioned On")}</Label>
              <Input
                id="line-commissioned"
                type="date"
                value={form.commissioned_on}
                onChange={(event) => setForm((prev) => ({ ...prev, commissioned_on: event.target.value }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="line-notes">{t("production.common.notes", "Notes")}</Label>
              <Input
                id="line-notes"
                value={form.notes}
                onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 bg-muted/20 px-6 py-4">
            <Button variant="outline" className="rounded-full" onClick={() => setOpen(false)}>
              {t("production.common.cancel", "Cancel")}
            </Button>
            <Button
              className="rounded-full"
              disabled={saveMutation.isPending}
              onClick={() => {
                if (!form.name.trim() || !form.code.trim()) {
                  toast.error(t("production.lines.required_fields", "Name and code are required."));
                  return;
                }
                saveMutation.mutate();
              }}
            >
              {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("production.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
