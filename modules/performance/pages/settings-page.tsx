"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/hooks/use-permissions";
import { performanceApi } from "@/modules/performance/api";
import type { Competency } from "@/modules/performance/types";
import {
  BusyLabel,
  MetricCard,
  PerformanceEmpty,
  PerformanceError,
  PerformanceLoading,
  PerformanceShell,
  PerformanceStatus,
  PerformanceTable,
} from "@/modules/performance/pages/components/performance-shell";
import { useDebouncedValue } from "@/modules/performance/utils";

type CompetencyCategory =
  | "all"
  | "core"
  | "leadership"
  | "functional"
  | "values"
  | "technical";

type CompetencyStatusFilter = "all" | "active" | "inactive";

const competencyCategories = [
  "core",
  "leadership",
  "functional",
  "values",
  "technical",
] as const;

function categoryLabel(category: string): string {
  return category.replaceAll("_", " ");
}

function emptyCompetencyForm() {
  return {
    code: "",
    name: "",
    description: "",
    category: "core",
    max_score: "5",
    default_weight: "0",
    sort_order: "0",
    indicators: "",
  };
}

function competencyToForm(competency: Competency) {
  return {
    code: competency.code,
    name: competency.name,
    description: competency.description ?? "",
    category: competency.category,
    max_score: String(competency.max_score),
    default_weight: String(competency.default_weight),
    sort_order: String(competency.sort_order),
    indicators: (competency.behavioral_indicators ?? []).join("\n"),
  };
}

function hasActiveSettingsFilters(opts: {
  search: string;
  category: CompetencyCategory;
  status: CompetencyStatusFilter;
}): boolean {
  return Boolean(opts.search.trim() || opts.category !== "all" || opts.status !== "all");
}

function competencyPayloadFromForm(form: ReturnType<typeof emptyCompetencyForm>) {
  const indicators = form.indicators
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    code: form.code.trim(),
    name: form.name.trim(),
    description: form.description.trim() || null,
    category: form.category,
    max_score: Number(form.max_score),
    default_weight: Number(form.default_weight),
    behavioral_indicators: indicators,
    sort_order: Number(form.sort_order || 0),
  };
}

export default function PerformanceSettingsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const client = useQueryClient();
  const { hasAnyPermission } = usePermissions();

  const canManage = hasAnyPermission(["manage_competencies", "manage_performance"]);
  const shouldOpenAdd = searchParams.get("add") === "1";
  const initialCompetencyId = searchParams.get("competency_id") ?? "";

  const [creating, setCreating] = React.useState(false);
  const [searchInput, setSearchInput] = React.useState(searchParams.get("search") ?? "");
  const [categoryFilter, setCategoryFilter] = React.useState<CompetencyCategory>(
    (searchParams.get("category") as CompetencyCategory) || "all",
  );
  const [statusFilter, setStatusFilter] = React.useState<CompetencyStatusFilter>(
    (searchParams.get("status") as CompetencyStatusFilter) || "all",
  );
  const [page, setPage] = React.useState(Number(searchParams.get("page") || 1));
  const [inspecting, setInspecting] = React.useState<Competency | null>(null);
  const [editing, setEditing] = React.useState<Competency | null>(null);
  const [form, setForm] = React.useState(emptyCompetencyForm());

  const debouncedSearch = useDebouncedValue(searchInput.trim());
  const rowRefs = React.useRef<Record<number, HTMLTableRowElement | null>>({});
  const deepLinkHandled = React.useRef(false);

  const dashboardQuery = useQuery({
    queryKey: ["performance", "dashboard-settings"],
    queryFn: performanceApi.dashboard,
  });

  const competenciesQuery = useQuery({
    queryKey: ["performance", "competencies", debouncedSearch, categoryFilter, statusFilter, page],
    queryFn: () =>
      performanceApi.competencies({
        page,
        per_page: 25,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(categoryFilter !== "all" ? { category: categoryFilter } : {}),
        ...(statusFilter === "active" ? { active: true } : {}),
        ...(statusFilter === "inactive" ? { active: false } : {}),
      }),
    placeholderData: (previous) => previous,
  });

  const activeStatsQuery = useQuery({
    queryKey: ["performance", "competencies-stats-active"],
    queryFn: () => performanceApi.competencies({ per_page: 1, active: true }),
  });

  const coreStatsQuery = useQuery({
    queryKey: ["performance", "competencies-stats-core"],
    queryFn: () => performanceApi.competencies({ per_page: 1, category: "core", active: true }),
  });

  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["performance"] });
  };

  const errorText = (error: unknown, fallback: string) => {
    if (typeof error === "object" && error && "response" in error) {
      const message = (error as { response?: { data?: { message?: string } } }).response?.data
        ?.message;
      if (message) return message;
    }
    return fallback;
  };

  const syncUrl = React.useCallback(() => {
    const params = new URLSearchParams();
    if (searchInput.trim()) params.set("search", searchInput.trim());
    if (categoryFilter !== "all") params.set("category", categoryFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (inspecting) params.set("competency_id", String(inspecting.id));
    if (page > 1) params.set("page", String(page));
    if (creating) params.set("add", "1");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [
    categoryFilter,
    creating,
    inspecting,
    page,
    pathname,
    router,
    searchInput,
    statusFilter,
  ]);

  React.useEffect(() => {
    syncUrl();
  }, [syncUrl]);

  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch, categoryFilter, statusFilter]);

  React.useEffect(() => {
    if (shouldOpenAdd && canManage) setCreating(true);
  }, [shouldOpenAdd, canManage]);

  React.useEffect(() => {
    deepLinkHandled.current = false;
  }, [initialCompetencyId]);

  React.useEffect(() => {
    if (!initialCompetencyId || deepLinkHandled.current || !competenciesQuery.data) return;
    const match = competenciesQuery.data.data.find(
      (item) => String(item.id) === initialCompetencyId,
    );
    if (!match) return;
    deepLinkHandled.current = true;
    setInspecting(match);
    window.setTimeout(() => {
      rowRefs.current[match.id]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }, [initialCompetencyId, competenciesQuery.data]);

  const createMutation = useMutation({
    mutationFn: performanceApi.createCompetency,
    onSuccess: async () => {
      await refresh();
      setCreating(false);
      setForm(emptyCompetencyForm());
      toast.success("Competency created.");
    },
    onError: (error: unknown) => toast.error(errorText(error, "Competency could not be created.")),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) =>
      performanceApi.updateCompetency(id, payload),
    onSuccess: async () => {
      await refresh();
      setEditing(null);
      setInspecting(null);
      toast.success("Competency updated.");
    },
    onError: (error: unknown) => toast.error(errorText(error, "Competency could not be updated.")),
  });

  const toggleMutation = useMutation({
    mutationFn: (item: Competency) =>
      performanceApi.updateCompetency(item.id, { is_active: !item.is_active }),
    onSuccess: async () => {
      await refresh();
      toast.success("Competency status updated.");
    },
    onError: (error: unknown) =>
      toast.error(errorText(error, "Competency status could not be updated.")),
  });

  const dashboard = dashboardQuery.data;
  const competencies = competenciesQuery.data?.data ?? [];
  const meta = competenciesQuery.data;
  const filtersActive = hasActiveSettingsFilters({
    search: searchInput,
    category: categoryFilter,
    status: statusFilter,
  });
  const refetching = competenciesQuery.isFetching && !competenciesQuery.isLoading;

  const clearFilters = () => {
    setSearchInput("");
    setCategoryFilter("all");
    setStatusFilter("all");
  };

  const openEdit = (competency: Competency) => {
    setEditing(competency);
    setForm(competencyToForm(competency));
  };

  return (
    <PerformanceShell
      title="Competency library and settings"
      description="Define observable behaviors used in self and manager reviews. Deactivate retired competencies to preserve historical scores."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              dashboardQuery.refetch();
              competenciesQuery.refetch();
              activeStatsQuery.refetch();
              coreStatsQuery.refetch();
            }}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          {canManage ? (
            <Button
              type="button"
              aria-expanded={creating}
              aria-controls="new-competency"
              onClick={() => {
                setCreating((value) => !value);
                if (!creating) setForm(emptyCompetencyForm());
              }}
            >
              <Plus aria-hidden="true" data-icon="inline-start" />
              {creating ? "Close competency form" : "New competency"}
            </Button>
          ) : null}
        </div>
      }
    >
      {dashboard ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Link href="/dashboard/performance/settings?status=active" className="block">
            <MetricCard
              title="Active competencies"
              value={activeStatsQuery.data?.total ?? "—"}
              description="Behaviors currently available in review forms."
              status="active"
            />
          </Link>
          <MetricCard
            title="Library size"
            value={meta?.total ?? "—"}
            description="Competencies matching the current filters."
          />
          <Link href="/dashboard/performance/settings?category=core&status=active" className="block">
            <MetricCard
              title="Core behaviors"
              value={coreStatsQuery.data?.total ?? "—"}
              description="Foundational competencies used across every role."
              status="core"
            />
          </Link>
          <Link href="/dashboard/performance/cycles" className="block">
            <MetricCard
              title="Active review cycles"
              value={dashboard.metrics.active_cycles}
              description="Configure goal and competency weights per cycle."
            />
          </Link>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Cycle configuration</h2>
          </CardTitle>
          <CardDescription>
            Competency weights, calibration rules, and review timing are managed per review cycle.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/performance/cycles">
              Manage review cycles
              <ExternalLink className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/performance/reviews">
              Open performance reviews
              <ExternalLink className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      {creating && canManage ? (
        <CompetencyForm
          id="new-competency"
          title="Create competency"
          description="Use observable and role-relevant behaviors. Required fields are identified in each label."
          form={form}
          setForm={setForm}
          busy={createMutation.isPending}
          submitLabel="Create competency"
          onSubmit={() =>
            createMutation.mutate({
              ...competencyPayloadFromForm(form),
              is_active: true,
            })
          }
        />
      ) : null}

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4">
        <div className="space-y-1">
          <Label htmlFor="settings-search" className="text-xs">
            Search
          </Label>
          <Input
            id="settings-search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Code, name, or description"
            className="h-9 w-56"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="settings-category" className="text-xs">
            Category
          </Label>
          <NativeSelect
            id="settings-category"
            className="h-9 w-40"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value as CompetencyCategory)}
          >
            <NativeSelectOption value="all">Any category</NativeSelectOption>
            {competencyCategories.map((category) => (
              <NativeSelectOption key={category} value={category}>
                {categoryLabel(category)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label htmlFor="settings-status" className="text-xs">
            Status
          </Label>
          <NativeSelect
            id="settings-status"
            className="h-9 w-36"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as CompetencyStatusFilter)}
          >
            <NativeSelectOption value="all">Any status</NativeSelectOption>
            <NativeSelectOption value="active">Active</NativeSelectOption>
            <NativeSelectOption value="inactive">Inactive</NativeSelectOption>
          </NativeSelect>
        </div>
        {filtersActive ? (
          <Button variant="ghost" size="sm" className="h-9" onClick={clearFilters}>
            <X className="mr-1 h-3.5 w-3.5" />
            Clear filters
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Competency library</h2>
          </CardTitle>
          <CardDescription>
            Core, leadership, functional, values, and technical behaviors available to performance
            reviews.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {competenciesQuery.isLoading ? (
            <PerformanceLoading cards={2} />
          ) : competenciesQuery.error || !meta ? (
            <div className="space-y-3">
              <PerformanceError error={competenciesQuery.error} />
              <Button variant="outline" size="sm" onClick={() => competenciesQuery.refetch()}>
                Retry
              </Button>
            </div>
          ) : competencies.length === 0 ? (
            <PerformanceEmpty
              title="No competencies found"
              description={
                filtersActive
                  ? "No competencies match these filters."
                  : "Create the first competency to start scoring manager and self reviews."
              }
            />
          ) : (
            <>
              <PerformanceTable<Competency>
                caption="Performance competency library ordered by configured sort order."
                rows={competencies}
                getKey={(row) => row.id}
                rowRef={(row, node) => {
                  rowRefs.current[row.id] = node;
                }}
                columns={[
                  {
                    key: "code",
                    label: "Code",
                    render: (row) => <span className="font-mono font-medium">{row.code}</span>,
                  },
                  {
                    key: "competency",
                    label: "Competency",
                    render: (row) => (
                      <button
                        type="button"
                        className="text-left hover:underline"
                        onClick={() => setInspecting(row)}
                      >
                        <span className="font-medium">{row.name}</span>
                        <p className="max-w-md text-xs text-muted-foreground">
                          {row.description || "No description"}
                        </p>
                      </button>
                    ),
                  },
                  {
                    key: "category",
                    label: "Category",
                    render: (row) => <PerformanceStatus value={row.category} />,
                  },
                  {
                    key: "scale",
                    label: "Scale",
                    align: "right",
                    render: (row) => `0–${Number(row.max_score)}`,
                  },
                  {
                    key: "weight",
                    label: "Default weight",
                    align: "right",
                    render: (row) => `${Number(row.default_weight)}%`,
                  },
                  {
                    key: "status",
                    label: "Status",
                    render: (row) => (
                      <PerformanceStatus value={row.is_active ? "active" : "inactive"} />
                    ),
                  },
                  {
                    key: "action",
                    label: "Action",
                    align: "right",
                    render: (row) =>
                      canManage ? (
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={updateMutation.isPending}
                            onClick={() => openEdit(row)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={toggleMutation.isPending}
                            onClick={() => toggleMutation.mutate(row)}
                          >
                            <Power aria-hidden="true" data-icon="inline-start" />
                            {row.is_active ? "Deactivate" : "Activate"}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setInspecting(row)}
                        >
                          View
                        </Button>
                      ),
                  },
                ]}
              />
              {meta.last_page > 1 ? (
                <div className="mt-4 flex items-center justify-between border-t pt-4">
                  <p className="text-xs text-muted-foreground">
                    Page {meta.current_page} of {meta.last_page} · {meta.total} competencies
                  </p>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      disabled={page <= 1}
                      onClick={() => setPage(Math.max(1, page - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      disabled={page >= meta.last_page}
                      onClick={() => setPage(page + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={inspecting !== null} onOpenChange={(open) => !open && setInspecting(null)}>
        <DialogContent className="sm:max-w-lg">
          {inspecting ? (
            <>
              <DialogHeader>
                <DialogTitle>{inspecting.name}</DialogTitle>
                <DialogDescription>
                  {inspecting.code} · {categoryLabel(inspecting.category)}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <p>{inspecting.description || "No description provided."}</p>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Scale</span>
                  <span>0–{Number(inspecting.max_score)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Default weight</span>
                  <span>{Number(inspecting.default_weight)}%</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Status</span>
                  <PerformanceStatus value={inspecting.is_active ? "active" : "inactive"} />
                </div>
                {inspecting.behavioral_indicators?.length ? (
                  <div>
                    <p className="font-semibold">Behavioral indicators</p>
                    <ul className="mt-1 list-disc pl-5">
                      {inspecting.behavioral_indicators.map((indicator) => (
                        <li key={indicator}>{indicator}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
              {canManage ? (
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setInspecting(null)}>
                    Close
                  </Button>
                  <Button onClick={() => openEdit(inspecting)}>Edit competency</Button>
                </DialogFooter>
              ) : null}
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
            setForm(emptyCompetencyForm());
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          {editing ? (
            <>
              <DialogHeader>
                <DialogTitle>Edit {editing.name}</DialogTitle>
                <DialogDescription>
                  Update observable behaviors while preserving historical review scores.
                </DialogDescription>
              </DialogHeader>
              <CompetencyForm
                id={`edit-competency-${editing.id}`}
                embedded
                form={form}
                setForm={setForm}
                busy={updateMutation.isPending}
                submitLabel="Save changes"
                codeReadOnly
                onSubmit={() =>
                  updateMutation.mutate({
                    id: editing.id,
                    payload: competencyPayloadFromForm(form),
                  })
                }
                onCancel={() => {
                  setEditing(null);
                  setForm(emptyCompetencyForm());
                }}
              />
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </PerformanceShell>
  );
}

function CompetencyForm({
  id,
  title,
  description,
  form,
  setForm,
  busy,
  submitLabel,
  codeReadOnly = false,
  embedded = false,
  onSubmit,
  onCancel,
}: {
  id: string;
  title?: string;
  description?: string;
  form: ReturnType<typeof emptyCompetencyForm>;
  setForm: React.Dispatch<React.SetStateAction<ReturnType<typeof emptyCompetencyForm>>>;
  busy: boolean;
  submitLabel: string;
  codeReadOnly?: boolean;
  embedded?: boolean;
  onSubmit: () => void;
  onCancel?: () => void;
}) {
  const fields = (
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
          <div className="grid gap-4 md:grid-cols-3">
            <Field id={`${id}-code`} label="Code (required)">
              <Input
                id={`${id}-code`}
                value={form.code}
                onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
                required
                maxLength={80}
                readOnly={codeReadOnly}
                className={codeReadOnly ? "bg-muted" : undefined}
              />
            </Field>
            <Field id={`${id}-name`} label="Name (required)">
              <Input
                id={`${id}-name`}
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                required
                maxLength={180}
              />
            </Field>
            <Field id={`${id}-category`} label="Category (required)">
              <NativeSelect
                id={`${id}-category`}
                className="w-full"
                value={form.category}
                onChange={(event) =>
                  setForm((current) => ({ ...current, category: event.target.value }))
                }
                required
              >
                {competencyCategories.map((category) => (
                  <NativeSelectOption key={category} value={category}>
                    {categoryLabel(category)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <Field id={`${id}-description`} label="Description">
            <Textarea
              id={`${id}-description`}
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
              maxLength={4000}
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-3">
            <Field id={`${id}-scale`} label="Maximum score (required)">
              <Input
                id={`${id}-scale`}
                type="number"
                min="1"
                max="10"
                value={form.max_score}
                onChange={(event) =>
                  setForm((current) => ({ ...current, max_score: event.target.value }))
                }
                required
              />
            </Field>
            <Field id={`${id}-weight`} label="Default weight percent">
              <Input
                id={`${id}-weight`}
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={form.default_weight}
                onChange={(event) =>
                  setForm((current) => ({ ...current, default_weight: event.target.value }))
                }
              />
            </Field>
            <Field id={`${id}-order`} label="Sort order">
              <Input
                id={`${id}-order`}
                type="number"
                min="0"
                max="10000"
                value={form.sort_order}
                onChange={(event) =>
                  setForm((current) => ({ ...current, sort_order: event.target.value }))
                }
              />
            </Field>
          </div>
          <Field id={`${id}-indicators`} label="Behavioral indicators">
            <Textarea
              id={`${id}-indicators`}
              value={form.indicators}
              onChange={(event) =>
                setForm((current) => ({ ...current, indicators: event.target.value }))
              }
              aria-describedby={`${id}-indicators-help`}
            />
            <p id={`${id}-indicators-help`} className="text-xs text-muted-foreground">
              Enter one observable behavior per line.
            </p>
          </Field>
          <div className="flex flex-wrap gap-2">
            {onCancel ? (
              <Button type="button" variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            ) : null}
            <Button type="submit" className="w-fit" disabled={busy}>
              <BusyLabel busy={busy}>{submitLabel}</BusyLabel>
            </Button>
          </div>
        </form>
  );

  if (embedded) return <div id={id}>{fields}</div>;

  return (
    <Card id={id}>
      <CardHeader>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{fields}</CardContent>
    </Card>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
