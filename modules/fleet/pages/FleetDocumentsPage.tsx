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
import { fleetApi } from "@/modules/fleet/api";
import type { FleetDocument, FleetDriver, FleetVehicle } from "@/modules/fleet/types";
import { StatTile } from "@/modules/shared/charts/primitives";

const DOCUMENT_TYPES = ["insurance", "road_worthiness", "libre", "permit", "licence"] as const;

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value: unknown) =>
  `ETB ${n(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default function FleetDocumentsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [tableQuery, setTableQuery] = React.useState({ page: 1, pageSize: 10, search: "" });
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    subject: "vehicle",
    subject_id: "",
    type: "insurance",
    reference: "",
    issuer: "",
    expires_on: "",
    cost: "0",
  });

  const listQuery = useQuery({
    queryKey: ["fleet", "documents", tableQuery],
    queryFn: () =>
      fleetApi.listDocuments({ page: tableQuery.page, limit: tableQuery.pageSize }).then((res) => res.data),
  });

  const overviewQuery = useQuery({
    queryKey: ["fleet", "overview-compliance"],
    queryFn: () => fleetApi.overview().then((res) => res.data),
  });

  const vehiclesQuery = useQuery({
    queryKey: ["fleet", "vehicle-options"],
    queryFn: () => fleetApi.listVehicles({ limit: 100 }).then((res) => res.data),
  });

  const driversQuery = useQuery({
    queryKey: ["fleet", "driver-options"],
    queryFn: () => fleetApi.listDrivers({ limit: 100 }).then((res) => res.data),
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["fleet"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const create = useMutation({
    mutationFn: () =>
      fleetApi.createDocument({
        // Exactly one subject key is sent; the API refuses a document that
        // belongs to neither a vehicle nor a driver.
        [`${form.subject}_id`]: Number(form.subject_id),
        type: form.type,
        reference: form.reference || null,
        issuer: form.issuer || null,
        expires_on: form.expires_on,
        cost: Number(form.cost || 0),
      }),
    onSuccess: () => {
      toast.success(t("fleet.documents.saved", "Document recorded."));
      invalidate();
      setOpen(false);
      setForm({ ...form, subject_id: "", reference: "", issuer: "", expires_on: "" });
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("fleet.documents.save_failed", "Could not record it."))),
  });

  const remove = useMutation({
    mutationFn: (id: number) => fleetApi.deleteDocument(id),
    onSuccess: () => {
      toast.success(t("fleet.documents.deleted", "Document removed."));
      invalidate();
    },
    onError: (error: any) => toast.error(errorText(error, "Could not remove it.")),
  });

  const handleTableQueryChange = React.useCallback((query: DataTableQuery) => {
    setTableQuery({
      page: Number(query.page || 1),
      pageSize: Number(query.pageSize || 10),
      search: String(query.search ?? ""),
    });
  }, []);

  const compliance = overviewQuery.data?.data?.compliance;
  const vehicles = (vehiclesQuery.data?.data ?? []) as FleetVehicle[];
  const drivers = (driversQuery.data?.data ?? []) as FleetDriver[];

  const subjectOptions =
    form.subject === "vehicle"
      ? vehicles.map((v) => ({ id: v.id, label: v.registration }))
      : drivers.map((d) => ({ id: d.id, label: d.name }));

  const columns = React.useMemo<ColumnDef<FleetDocument>[]>(
    () => [
      {
        accessorKey: "type",
        header: t("fleet.documents.type", "Type"),
        cell: ({ row }) => (
          <span className="font-medium capitalize">{row.original.type.replace(/_/g, " ")}</span>
        ),
      },
      {
        id: "subject",
        header: t("fleet.documents.subject", "Belongs to"),
        cell: ({ row }) => (
          <span className="text-xs">
            {row.original.vehicle?.registration ?? row.original.driver?.name ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "reference",
        header: t("fleet.documents.reference", "Reference"),
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.reference ?? "—"}</span>
        ),
      },
      {
        accessorKey: "expires_on",
        header: t("fleet.documents.expires", "Expires"),
        cell: ({ row }) => {
          const days = row.original.days_to_expiry;

          return (
            <div className="space-y-0.5">
              <p
                className={`text-xs tabular-nums ${
                  row.original.is_expired ? "font-semibold text-destructive" : ""
                }`}
              >
                {String(row.original.expires_on).slice(0, 10)}
              </p>
              {days !== null && days !== undefined ? (
                <p className="text-[11px] text-muted-foreground">
                  {days < 0
                    ? t("fleet.documents.ago", "{n} days ago").replace("{n}", String(Math.abs(days)))
                    : t("fleet.documents.in", "in {n} days").replace("{n}", String(days))}
                </p>
              ) : null}
            </div>
          );
        },
      },
      {
        id: "state",
        header: t("fleet.common.status", "Status"),
        cell: ({ row }) =>
          row.original.is_expired ? (
            <Badge variant="destructive" className="text-[11px]">
              {t("fleet.documents.expired", "Expired")}
            </Badge>
          ) : (row.original.days_to_expiry ?? 999) <= 30 ? (
            <Badge variant="secondary" className="text-[11px]">
              {t("fleet.documents.expiring", "Expiring")}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[11px]">
              {t("fleet.documents.valid", "Valid")}
            </Badge>
          ),
      },
      {
        accessorKey: "cost",
        header: t("fleet.documents.cost", "Cost"),
        cell: ({ row }) => <span className="tabular-nums">{money(row.original.cost)}</span>,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => remove.mutate(row.original.id)}
              aria-label={t("fleet.common.delete", "Delete")}
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
            {t("fleet.documents.title", "Documents and Compliance")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "fleet.documents.subtitle",
              "Insurance, road-worthiness and licences — the papers that ground a vehicle or a driver if nobody acts in time.",
            )}
          </p>
        </div>
        <Button className="rounded-full px-5" onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("fleet.documents.add", "Add Document")}
        </Button>
      </div>

      {compliance ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label={t("fleet.documents.expired", "Expired")}
            value={n(compliance.expired).toLocaleString()}
            alert={n(compliance.expired) > 0}
          />
          <StatTile
            label={t("fleet.documents.expiring_30", "Within 30 days")}
            value={n(compliance.expiring_soon).toLocaleString()}
            alert={n(compliance.expiring_soon) > 0}
          />
          <StatTile
            label={t("fleet.documents.lapsed_licences", "Lapsed licences")}
            value={n(compliance.licences_expired).toLocaleString()}
            alert={n(compliance.licences_expired) > 0}
          />
          <StatTile
            label={t("fleet.documents.unknown_licences", "No expiry on file")}
            value={n(compliance.licences_unknown).toLocaleString()}
            meta={t("fleet.documents.unknown_meta", "records to chase, not lapses")}
          />
        </div>
      ) : null}

      <DataTable
        columns={columns}
        data={(listQuery.data?.data ?? []) as FleetDocument[]}
        totalEntries={listQuery.data?.meta?.total ?? 0}
        loading={listQuery.isLoading}
        pageIndex={tableQuery.page}
        pageSize={tableQuery.pageSize}
        onQueryChange={handleTableQueryChange}
        searchPlaceholder={t("fleet.documents.search", "Search documents...")}
        resourceName="fleet-documents"
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("fleet.documents.add", "Add Document")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "fleet.documents.form_desc",
                  "A document belongs to a vehicle or to a driver — never to neither.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="doc-subject">{t("fleet.documents.belongs_to", "Belongs to")}</Label>
              <select
                id="doc-subject"
                value={form.subject}
                onChange={(event) => setForm({ ...form, subject: event.target.value, subject_id: "" })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="vehicle">{t("fleet.documents.a_vehicle", "A vehicle")}</option>
                <option value="driver">{t("fleet.documents.a_driver", "A driver")}</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-subject-id">{t("fleet.documents.record", "Record")}</Label>
              <select
                id="doc-subject-id"
                value={form.subject_id}
                onChange={(event) => setForm({ ...form, subject_id: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{t("fleet.common.select", "Select...")}</option>
                {subjectOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-type">{t("fleet.documents.type", "Type")}</Label>
              <select
                id="doc-type"
                value={form.type}
                onChange={(event) => setForm({ ...form, type: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm capitalize"
              >
                {DOCUMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-expires">{t("fleet.documents.expires", "Expires")}</Label>
              <Input
                id="doc-expires"
                type="date"
                value={form.expires_on}
                onChange={(event) => setForm({ ...form, expires_on: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-ref">{t("fleet.documents.reference", "Reference")}</Label>
              <Input
                id="doc-ref"
                value={form.reference}
                onChange={(event) => setForm({ ...form, reference: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-issuer">{t("fleet.documents.issuer", "Issuer")}</Label>
              <Input
                id="doc-issuer"
                value={form.issuer}
                onChange={(event) => setForm({ ...form, issuer: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-cost">{t("fleet.documents.cost", "Cost")}</Label>
              <Input
                id="doc-cost"
                type="number"
                min={0}
                value={form.cost}
                onChange={(event) => setForm({ ...form, cost: event.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("fleet.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => create.mutate()}
              disabled={create.isPending || !form.subject_id || !form.expires_on}
            >
              {t("fleet.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
