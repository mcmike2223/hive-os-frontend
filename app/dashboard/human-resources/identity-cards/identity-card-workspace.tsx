"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import {
  BadgeCheck,
  Ban,
  CheckCircle2,
  Copy,
  CreditCard,
  FileClock,
  History,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { getWorkspaceScopeKey } from "@/lib/runtime-context";
import {
  deleteIdentityCardTemplate,
  duplicateIdentityCardTemplate,
  fetchEligibleIdentityEmployees,
  fetchIdentityCards,
  fetchIdentityCardTemplates,
  fetchIdentityCardWorkspace,
  IDENTITY_CARD_FIELDS,
  issueIdentityCards,
  renewIdentityCard,
  revokeIdentityCard,
  saveIdentityCardTemplate,
  verifyIdentityCard,
  type EmployeeIdentityCard,
  type IdentityCardField,
  type IdentityCardTemplate,
  type IdentityCardTemplatePayload,
  type IdentityCardVerification,
} from "@/modules/humanresources/identity-cards";

const today = () => new Date().toISOString().slice(0, 10);
const fieldLabel = (field: string) =>
  field.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const emptyTemplate: IdentityCardTemplatePayload = {
  code: "",
  name: "",
  description: "",
  card_type: "employee",
  orientation: "landscape",
  width_mm: 85.6,
  height_mm: 53.98,
  primary_color: "#0F172A",
  accent_color: "#D97706",
  text_color: "#FFFFFF",
  front_fields: [
    "organization_name",
    "photo",
    "primary_name",
    "employee_number",
    "position",
    "organization_unit",
    "expires_on",
    "qr_code",
  ],
  back_fields: [
    "card_number",
    "issued_on",
    "expires_on",
    "work_email",
    "verification_instructions",
    "qr_code",
  ],
  validity_months: 24,
  is_default: false,
  is_active: true,
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "The request could not be completed.";
}

function StatusBadge({ status }: { status: EmployeeIdentityCard["effective_status"] }) {
  const styles = {
    active: "border-emerald-300 bg-emerald-50 text-emerald-800",
    expired: "border-amber-300 bg-amber-50 text-amber-900",
    revoked: "border-red-300 bg-red-50 text-red-800",
    replaced: "border-slate-300 bg-slate-100 text-slate-700",
  };
  return (
    <Badge variant="outline" className={styles[status]}>
      {fieldLabel(status)}
    </Badge>
  );
}

function IdentityCardPreview({
  card,
  template,
  employeeName,
  employeeNumber,
  position,
  organizationUnit,
}: {
  card?: EmployeeIdentityCard | null;
  template?: IdentityCardTemplate | null;
  employeeName?: string;
  employeeNumber?: string;
  position?: string | null;
  organizationUnit?: string | null;
}) {
  const selectedTemplate = template ?? card?.template;
  const name =
    employeeName ?? card?.employee?.primary_name ?? card?.snapshot?.primary_name ?? "Employee name";
  const number =
    employeeNumber ??
    card?.employee?.employee_number ??
    card?.snapshot?.employee_number ??
    "EMP-000";
  const role =
    position ??
    card?.employee?.primary_assignment?.position?.title ??
    card?.snapshot?.position ??
    "Position";
  const unit =
    organizationUnit ??
    card?.employee?.primary_assignment?.organization_unit?.name ??
    card?.snapshot?.organization_unit ??
    "Organization unit";
  const verificationValue =
    typeof window === "undefined"
      ? card?.verification_path ?? "HIVE.OS employee identity card"
      : card
        ? `${window.location.origin}${card.verification_path}`
        : window.location.href;
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className="identity-card-print relative mx-auto aspect-[1.586/1] w-full max-w-[540px] overflow-hidden rounded-[1.4rem] border border-white/20 p-5 text-white shadow-2xl"
      style={{
        backgroundColor: selectedTemplate?.primary_color ?? "#0F172A",
        color: selectedTemplate?.text_color ?? "#FFFFFF",
      }}
      aria-label={`Employee ID card preview for ${name}`}
    >
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-2/5 skew-x-[-12deg] translate-x-10 opacity-90"
        style={{ backgroundColor: selectedTemplate?.accent_color ?? "#D97706" }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px)",
          backgroundSize: "22px 22px",
        }}
        aria-hidden="true"
      />
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/70">
              Verified workforce credential
            </p>
            <p className="mt-1 text-lg font-black tracking-tight">
              {card?.snapshot?.organization_name ?? "HIVE.OS"}
            </p>
          </div>
          <ShieldCheck className="h-8 w-8" aria-hidden="true" />
        </div>
        <div className="flex items-end gap-4">
          <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl border-2 border-white/60 bg-white/15 text-2xl font-black">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-black">{name}</p>
            <p className="truncate text-sm font-semibold text-white/85">{role}</p>
            <p className="truncate text-xs text-white/70">{unit}</p>
            <p className="mt-2 font-mono text-xs tracking-wider">{number}</p>
          </div>
          <div className="rounded-xl bg-white p-1.5 text-slate-950">
            <QRCodeSVG value={verificationValue} size={58} level="M" />
          </div>
        </div>
        <div className="flex items-end justify-between gap-3 text-[10px] text-white/75">
          <span>{card?.card_number ?? "Generated when issued"}</span>
          <span>Expires {card?.expires_on ?? "per template policy"}</span>
        </div>
      </div>
    </div>
  );
}

const identityCardTabs = new Set(["cards", "issue", "templates", "verify"]);

export function IdentityCardWorkspace({ initialTab = "cards" }: { initialTab?: string }) {
  const scope = getWorkspaceScopeKey();
  const queryClient = useQueryClient();
  const templateTriggerRef = useRef<HTMLElement | null>(null);
  const [tab, setTab] = useState(
    identityCardTabs.has(initialTab) ? initialTab : "cards",
  );
  const [cardSearch, setCardSearch] = useState("");
  const [cardStatus, setCardStatus] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [selectedEmployees, setSelectedEmployees] = useState<number[]>([]);
  const [previewCard, setPreviewCard] = useState<EmployeeIdentityCard | null>(null);
  const [revokeCard, setRevokeCard] = useState<EmployeeIdentityCard | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [renewCard, setRenewCard] = useState<EmployeeIdentityCard | null>(null);
  const [renewForm, setRenewForm] = useState({
    template_id: "",
    issued_on: today(),
    expires_on: "",
    reason: "",
    notes: "",
  });
  const [verifyValue, setVerifyValue] = useState("");
  const [verification, setVerification] = useState<IdentityCardVerification | null>(null);
  const [templateEditor, setTemplateEditor] = useState<IdentityCardTemplate | "new" | null>(null);
  const [templateForm, setTemplateForm] =
    useState<IdentityCardTemplatePayload>(emptyTemplate);
  const [deleteTemplate, setDeleteTemplate] = useState<IdentityCardTemplate | null>(null);
  const [issueForm, setIssueForm] = useState({
    template_id: "",
    issued_on: today(),
    expires_on: "",
    notes: "",
  });

  const workspaceQuery = useQuery({
    queryKey: ["hr-identity-card-workspace", scope],
    queryFn: fetchIdentityCardWorkspace,
  });
  const cardsQuery = useQuery({
    queryKey: ["hr-identity-cards", scope, cardSearch, cardStatus],
    queryFn: () => fetchIdentityCards({ search: cardSearch, status: cardStatus }),
  });
  const employeesQuery = useQuery({
    queryKey: ["hr-identity-card-employees", scope, employeeSearch],
    queryFn: () => fetchEligibleIdentityEmployees(employeeSearch),
  });
  const templatesQuery = useQuery({
    queryKey: ["hr-identity-card-templates", scope],
    queryFn: fetchIdentityCardTemplates,
  });

  const workspace = workspaceQuery.data?.data;
  const templates = templatesQuery.data?.data ?? workspace?.templates ?? [];
  const employees = employeesQuery.data?.data ?? [];
  const availableEmployees = employees.filter((employee) => !employee.active_card);
  const selectedEmployee = employees.find((employee) =>
    selectedEmployees.includes(employee.id),
  );
  const selectedTemplate = templates.find(
    (template) => String(template.id) === issueForm.template_id,
  );

  useEffect(() => {
    if (!issueForm.template_id && templates.length > 0) {
      const defaultTemplate = templates.find((item) => item.is_default) ?? templates[0];
      setIssueForm((current) => ({
        ...current,
        template_id: String(defaultTemplate.id),
      }));
    }
  }, [issueForm.template_id, templates]);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["hr-identity-card-workspace"] }),
      queryClient.invalidateQueries({ queryKey: ["hr-identity-cards"] }),
      queryClient.invalidateQueries({ queryKey: ["hr-identity-card-employees"] }),
      queryClient.invalidateQueries({ queryKey: ["hr-identity-card-templates"] }),
    ]);
  };

  const issueMutation = useMutation({
    mutationFn: () =>
      issueIdentityCards({
        employee_ids: selectedEmployees,
        template_id: Number(issueForm.template_id),
        issued_on: issueForm.issued_on,
        expires_on: issueForm.expires_on || undefined,
        notes: issueForm.notes || undefined,
      }),
    onSuccess: async (result) => {
      toast.success(result.message ?? "Employee ID card issued.");
      setPreviewCard(result.data[0] ?? null);
      setSelectedEmployees([]);
      await invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const revokeMutation = useMutation({
    mutationFn: () => revokeIdentityCard(revokeCard!.id, revokeReason),
    onSuccess: async (card) => {
      toast.success("Employee ID card revoked.");
      setRevokeCard(null);
      setRevokeReason("");
      setPreviewCard(card);
      await invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const renewMutation = useMutation({
    mutationFn: () =>
      renewIdentityCard(renewCard!.id, {
        template_id: renewForm.template_id
          ? Number(renewForm.template_id)
          : undefined,
        issued_on: renewForm.issued_on,
        expires_on: renewForm.expires_on || undefined,
        reason: renewForm.reason || undefined,
        notes: renewForm.notes || undefined,
      }),
    onSuccess: async (card) => {
      toast.success("A renewed employee ID card was created.");
      setRenewCard(null);
      setPreviewCard(card);
      await invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const verifyMutation = useMutation({
    mutationFn: verifyIdentityCard,
    onSuccess: (result) => setVerification(result.data),
    onError: (error) => {
      setVerification(null);
      toast.error(errorMessage(error));
    },
  });
  const templateMutation = useMutation({
    mutationFn: () =>
      saveIdentityCardTemplate(
        templateForm,
        templateEditor === "new" ? undefined : templateEditor?.id,
      ),
    onSuccess: async () => {
      toast.success(templateEditor === "new" ? "Template created." : "Template updated.");
      setTemplateEditor(null);
      await invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const duplicateMutation = useMutation({
    mutationFn: (template: IdentityCardTemplate) =>
      duplicateIdentityCardTemplate(template.id, {
        code: `${template.code}-COPY-${String(Date.now()).slice(-4)}`,
        name: `${template.name} Copy`,
      }),
    onSuccess: async () => {
      toast.success("Template duplicated and ready to edit.");
      await invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteIdentityCardTemplate(deleteTemplate!.id),
    onSuccess: async () => {
      toast.success("Unused template deleted.");
      setDeleteTemplate(null);
      await invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("verify");
    if (!value) return;
    setTab("verify");
    setVerifyValue(value);
    verifyMutation.mutate(value);
    // Run only for the initial QR route.
  }, []);

  const summaryCards = useMemo(
    () => [
      { label: "Active cards", value: workspace?.summary.active ?? 0, icon: BadgeCheck },
      {
        label: "Expiring in 30 days",
        value: workspace?.summary.expiring_soon ?? 0,
        icon: FileClock,
      },
      {
        label: "Employees without cards",
        value: workspace?.summary.unissued_employees ?? 0,
        icon: UsersRound,
      },
      {
        label: "Card history",
        value: workspace?.summary.total_history ?? 0,
        icon: History,
      },
    ],
    [workspace],
  );

  const openTemplateEditor = (
    template?: IdentityCardTemplate,
    trigger?: HTMLElement,
  ) => {
    templateTriggerRef.current = trigger ?? null;
    setTemplateEditor(template ?? "new");
    setTemplateForm(
      template
        ? {
            code: template.code,
            name: template.name,
            description: template.description ?? "",
            card_type: template.card_type,
            orientation: template.orientation,
            width_mm: template.width_mm,
            height_mm: template.height_mm,
            primary_color: template.primary_color,
            accent_color: template.accent_color,
            text_color: template.text_color,
            front_fields: template.front_fields,
            back_fields: template.back_fields,
            validity_months: template.validity_months,
            is_default: template.is_default,
            is_active: template.is_active,
          }
        : { ...emptyTemplate, front_fields: [...emptyTemplate.front_fields], back_fields: [...emptyTemplate.back_fields] },
    );
  };

  const toggleTemplateField = (
    side: "front_fields" | "back_fields",
    field: IdentityCardField,
    checked: boolean,
  ) => {
    setTemplateForm((current) => ({
      ...current,
      [side]: checked
        ? [...current[side], field]
        : current[side].filter((item) => item !== field),
    }));
  };

  const submitVerification = (event: FormEvent) => {
    event.preventDefault();
    const publicId =
      verifyValue.match(
        /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
      )?.[0] ?? verifyValue.trim();
    if (publicId) verifyMutation.mutate(publicId);
  };

  return (
    <main className="min-w-0 space-y-6 pb-12">
      <style jsx global>{`
        @media print {
          body * { visibility: hidden !important; }
          .identity-card-print, .identity-card-print * { visibility: visible !important; }
          .identity-card-print { position: fixed !important; inset: 24px auto auto 24px !important; width: 540px !important; }
        }
      `}</style>
      <header className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 px-5 py-7 text-white shadow-xl sm:px-8">
        <div
          className="absolute inset-0 opacity-15"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)",
            backgroundSize: "28px 28px",
          }}
          aria-hidden="true"
        />
        <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-400">
              Human Resources · Secure credentials
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              Employee ID Management
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Design, issue, verify, renew, revoke, and print employee credentials
              directly from the authoritative HR directory.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => {
              setTab("issue");
              document.getElementById("identity-card-tabs")?.focus();
            }}
            className="min-h-11 bg-amber-700 font-bold text-white hover:bg-amber-800"
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Issue employee cards
          </Button>
        </div>
      </header>

      <section aria-labelledby="credential-summary-heading">
        <h2 id="credential-summary-heading" className="sr-only">
          Credential summary
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((item) => (
            <Card key={item.label} className="border-slate-200 shadow-sm">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-950 text-amber-400">
                  <item.icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-2xl font-black tabular-nums">
                    {workspaceQuery.isLoading ? "—" : item.value}
                  </p>
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto pb-1">
          <TabsList
            id="identity-card-tabs"
            aria-label="Employee ID management views"
            className="h-auto min-w-max p-1"
          >
            <TabsTrigger value="cards" className="min-h-10 px-4">
              Cards & history
            </TabsTrigger>
            <TabsTrigger value="issue" className="min-h-10 px-4">
              Issue cards
            </TabsTrigger>
            <TabsTrigger value="templates" className="min-h-10 px-4">
              Templates
            </TabsTrigger>
            <TabsTrigger value="verify" className="min-h-10 px-4">
              Verify a card
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="cards" className="space-y-4">
          <Card>
            <CardHeader className="gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <CardTitle>Issued card register</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Search the full audit history, including revoked and replaced credentials.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_180px]">
                <div>
                  <Label htmlFor="card-search">Search cards</Label>
                  <div className="relative mt-1">
                    <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <Input
                      id="card-search"
                      value={cardSearch}
                      onChange={(event) => setCardSearch(event.target.value)}
                      placeholder="Card number or verification ID"
                      className="pl-9"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="card-status">Card status</Label>
                  <NativeSelect
                    id="card-status"
                    value={cardStatus}
                    onChange={(event) => setCardStatus(event.target.value)}
                    className="mt-1 w-full"
                  >
                    <NativeSelectOption value="">All statuses</NativeSelectOption>
                    <NativeSelectOption value="active">Active</NativeSelectOption>
                    <NativeSelectOption value="expired">Expired</NativeSelectOption>
                    <NativeSelectOption value="revoked">Revoked</NativeSelectOption>
                    <NativeSelectOption value="replaced">Replaced</NativeSelectOption>
                  </NativeSelect>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[860px] text-left text-sm">
                  <caption className="sr-only">
                    Employee identity cards and available actions
                  </caption>
                  <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                    <tr>
                      <th scope="col" className="px-4 py-3">Employee</th>
                      <th scope="col" className="px-4 py-3">Card number</th>
                      <th scope="col" className="px-4 py-3">Issued</th>
                      <th scope="col" className="px-4 py-3">Expires</th>
                      <th scope="col" className="px-4 py-3">Status</th>
                      <th scope="col" className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {cardsQuery.isLoading ? (
                      <tr><td colSpan={6} className="p-5"><Skeleton className="h-14 w-full" /></td></tr>
                    ) : (cardsQuery.data?.data.length ?? 0) === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-muted-foreground">
                          No identity cards match this view.
                        </td>
                      </tr>
                    ) : (
                      cardsQuery.data?.data.map((card) => (
                        <tr key={card.id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-3">
                            <p className="font-bold">{card.employee?.primary_name ?? card.snapshot.primary_name}</p>
                            <p className="text-xs text-muted-foreground">{card.employee?.employee_number ?? card.snapshot.employee_number}</p>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">{card.card_number}</td>
                          <td className="px-4 py-3">{card.issued_on}</td>
                          <td className="px-4 py-3">{card.expires_on ?? "No expiry"}</td>
                          <td className="px-4 py-3"><StatusBadge status={card.effective_status} /></td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <Button type="button" size="sm" variant="outline" onClick={() => setPreviewCard(card)}>
                                View
                              </Button>
                              {card.effective_status === "active" && (
                                <>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setRenewCard(card);
                                      setRenewForm({
                                        template_id: String(card.template_id),
                                        issued_on: today(),
                                        expires_on: "",
                                        reason: "",
                                        notes: "",
                                      });
                                    }}
                                  >
                                    Renew
                                  </Button>
                                  <Button type="button" size="sm" variant="destructive" onClick={() => setRevokeCard(card)}>
                                    Revoke
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {cardsQuery.isError && (
                <p role="alert" className="mt-3 text-sm text-destructive">
                  {errorMessage(cardsQuery.error)}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="issue" className="space-y-4">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,.8fr)]">
            <Card>
              <CardHeader>
                <CardTitle>Select eligible employees</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Active cards cannot be duplicated. Use Renew from the register when a replacement is needed.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="employee-card-search">Search HR employees</Label>
                  <Input
                    id="employee-card-search"
                    value={employeeSearch}
                    onChange={(event) => setEmployeeSearch(event.target.value)}
                    placeholder="Name, employee number, or work email"
                    className="mt-1"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedEmployees(availableEmployees.map((employee) => employee.id))}
                    disabled={availableEmployees.length === 0}
                  >
                    Select all available
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedEmployees([])}>
                    Clear selection
                  </Button>
                  <span className="self-center text-sm font-semibold" aria-live="polite">
                    {selectedEmployees.length} selected
                  </span>
                </div>
                <div className="max-h-[430px] overflow-auto rounded-xl border">
                  <table className="w-full min-w-[620px] text-left text-sm">
                    <caption className="sr-only">Employees eligible for an identity card</caption>
                    <thead className="sticky top-0 border-b bg-slate-50">
                      <tr>
                        <th scope="col" className="w-12 p-3">Select</th>
                        <th scope="col" className="p-3">Employee</th>
                        <th scope="col" className="p-3">Assignment</th>
                        <th scope="col" className="p-3">Card eligibility</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {employees.map((employee) => (
                        <tr key={employee.id}>
                          <td className="p-3">
                            <Checkbox
                              checked={selectedEmployees.includes(employee.id)}
                              disabled={Boolean(employee.active_card)}
                              onCheckedChange={(checked) =>
                                setSelectedEmployees((current) =>
                                  checked
                                    ? [...new Set([...current, employee.id])]
                                    : current.filter((id) => id !== employee.id),
                                )
                              }
                              aria-label={`Select ${employee.primary_name}`}
                            />
                          </td>
                          <td className="p-3">
                            <p className="font-bold">{employee.primary_name}</p>
                            <p className="text-xs text-muted-foreground">{employee.employee_number}</p>
                          </td>
                          <td className="p-3">
                            <p>{employee.position ?? "No position"}</p>
                            <p className="text-xs text-muted-foreground">{employee.organization_unit ?? "No unit"}</p>
                          </td>
                          <td className="p-3">
                            {employee.active_card ? (
                              <span className="text-xs font-semibold text-amber-800">
                                Active card {employee.active_card.card_number}
                              </span>
                            ) : (
                              <span className="text-xs font-semibold text-emerald-700">Ready to issue</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-5">
              <Card>
                <CardHeader><CardTitle>Issue details</CardTitle></CardHeader>
                <CardContent>
                  <form
                    className="space-y-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (selectedEmployees.length === 0) {
                        toast.error("Select at least one eligible employee.");
                        return;
                      }
                      issueMutation.mutate();
                    }}
                  >
                    <div>
                      <Label htmlFor="issue-template">Card template</Label>
                      <NativeSelect
                        id="issue-template"
                        required
                        value={issueForm.template_id}
                        onChange={(event) => setIssueForm({ ...issueForm, template_id: event.target.value })}
                        className="mt-1 w-full"
                      >
                        <NativeSelectOption value="">Select a template</NativeSelectOption>
                        {templates.filter((template) => template.is_active).map((template) => (
                          <NativeSelectOption key={template.id} value={template.id}>
                            {template.name} · {template.validity_months} months
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="issued-on">Issue date</Label>
                        <Input id="issued-on" type="date" required value={issueForm.issued_on} onChange={(event) => setIssueForm({ ...issueForm, issued_on: event.target.value })} className="mt-1" />
                      </div>
                      <div>
                        <Label htmlFor="expires-on">Custom expiry date</Label>
                        <Input id="expires-on" type="date" min={issueForm.issued_on} value={issueForm.expires_on} onChange={(event) => setIssueForm({ ...issueForm, expires_on: event.target.value })} className="mt-1" />
                        <p className="mt-1 text-xs text-muted-foreground">Leave blank to use the template policy.</p>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="issue-notes">Issuance notes</Label>
                      <Textarea id="issue-notes" value={issueForm.notes} onChange={(event) => setIssueForm({ ...issueForm, notes: event.target.value })} className="mt-1" maxLength={2000} />
                    </div>
                    <Button type="submit" className="min-h-11 w-full" disabled={issueMutation.isPending || selectedEmployees.length === 0}>
                      {issueMutation.isPending ? "Issuing securely…" : `Issue ${selectedEmployees.length || ""} card${selectedEmployees.length === 1 ? "" : "s"}`}
                    </Button>
                  </form>
                </CardContent>
              </Card>
              <IdentityCardPreview
                template={selectedTemplate}
                employeeName={selectedEmployee?.primary_name}
                employeeNumber={selectedEmployee?.employee_number}
                position={selectedEmployee?.position}
                organizationUnit={selectedEmployee?.organization_unit}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-black">Credential templates</h2>
              <p className="text-sm text-muted-foreground">
                Configure card dimensions, identity fields, colors, validity, and default policy.
              </p>
            </div>
            <Button
              type="button"
              onClick={(event) => openTemplateEditor(undefined, event.currentTarget)}
            >
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              New template
            </Button>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {templates.map((template) => (
              <Card key={template.id}>
                <CardHeader className="flex-row items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle>{template.name}</CardTitle>
                      {template.is_default && <Badge>Default</Badge>}
                      {!template.is_active && <Badge variant="outline">Inactive</Badge>}
                    </div>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">{template.code}</p>
                  </div>
                  <div className="flex gap-1" aria-label={`Actions for ${template.name}`}>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={(event) =>
                        openTemplateEditor(template, event.currentTarget)
                      }
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      <span className="sr-only">Edit {template.name}</span>
                    </Button>
                    <Button type="button" size="icon" variant="ghost" onClick={() => duplicateMutation.mutate(template)}>
                      <Copy className="h-4 w-4" aria-hidden="true" />
                      <span className="sr-only">Duplicate {template.name}</span>
                    </Button>
                    <Button type="button" size="icon" variant="ghost" onClick={() => setDeleteTemplate(template)}>
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      <span className="sr-only">Delete {template.name}</span>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <IdentityCardPreview template={template} />
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div><p className="font-bold">{template.validity_months}</p><p className="text-xs text-muted-foreground">Months valid</p></div>
                    <div><p className="font-bold">{template.front_fields.length}</p><p className="text-xs text-muted-foreground">Front fields</p></div>
                    <div><p className="font-bold">{template.cards_count ?? 0}</p><p className="text-xs text-muted-foreground">Cards issued</p></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="verify">
          <Card className="mx-auto max-w-3xl">
            <CardHeader>
              <CardTitle>Verify an employee credential</CardTitle>
              <p className="text-sm text-muted-foreground">
                Paste a card QR link or verification ID. Results are restricted to authorized HR users.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              <form onSubmit={submitVerification} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <Label htmlFor="verification-id">QR link or verification ID</Label>
                  <Input id="verification-id" value={verifyValue} onChange={(event) => setVerifyValue(event.target.value)} required className="mt-1 font-mono" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
                </div>
                <Button type="submit" className="min-h-10" disabled={verifyMutation.isPending}>
                  <Search className="mr-2 h-4 w-4" aria-hidden="true" />
                  {verifyMutation.isPending ? "Checking…" : "Verify card"}
                </Button>
              </form>
              <div aria-live="polite">
                {verification && (
                  <div className={`rounded-2xl border p-5 ${verification.is_valid ? "border-emerald-300 bg-emerald-50" : "border-red-300 bg-red-50"}`}>
                    <div className="flex items-start gap-3">
                      {verification.is_valid ? (
                        <CheckCircle2 className="mt-0.5 h-6 w-6 text-emerald-700" aria-hidden="true" />
                      ) : (
                        <Ban className="mt-0.5 h-6 w-6 text-red-700" aria-hidden="true" />
                      )}
                      <div>
                        <h3 className="font-black">{verification.is_valid ? "Valid active credential" : "Credential is not valid"}</h3>
                        <p className="mt-1 text-sm">{verification.card.employee.primary_name} · {verification.card.employee.employee_number}</p>
                        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                          <div><dt className="text-muted-foreground">Card number</dt><dd className="font-mono font-semibold">{verification.card.card_number}</dd></div>
                          <div><dt className="text-muted-foreground">Status</dt><dd className="font-semibold">{fieldLabel(verification.card.effective_status)}</dd></div>
                          <div><dt className="text-muted-foreground">Assignment</dt><dd className="font-semibold">{verification.card.employee.position ?? "Not assigned"}</dd></div>
                          <div><dt className="text-muted-foreground">Expires</dt><dd className="font-semibold">{verification.card.expires_on ?? "No expiry"}</dd></div>
                        </dl>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(previewCard)} onOpenChange={(open) => !open && setPreviewCard(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Employee ID card</DialogTitle>
            <DialogDescription>
              {previewCard?.card_number} · {previewCard?.employee?.primary_name ?? previewCard?.snapshot.primary_name}
            </DialogDescription>
          </DialogHeader>
          <IdentityCardPreview card={previewCard} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPreviewCard(null)}>Close</Button>
            <Button type="button" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" aria-hidden="true" />
              Print card
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(revokeCard)} onOpenChange={(open) => !open && setRevokeCard(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke this credential?</DialogTitle>
            <DialogDescription>
              Revocation is retained in the audit history and immediately makes the QR verification invalid.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="revoke-reason">Reason for revocation</Label>
            <Textarea id="revoke-reason" required value={revokeReason} onChange={(event) => setRevokeReason(event.target.value)} className="mt-1" maxLength={1000} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRevokeCard(null)}>Cancel</Button>
            <Button type="button" variant="destructive" disabled={revokeMutation.isPending || revokeReason.trim().length < 5} onClick={() => revokeMutation.mutate()}>
              Revoke credential
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(renewCard)} onOpenChange={(open) => !open && setRenewCard(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renew employee credential</DialogTitle>
            <DialogDescription>
              The current card becomes Replaced and remains linked to the new card for audit history.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div>
              <Label htmlFor="renew-template">Template</Label>
              <NativeSelect id="renew-template" value={renewForm.template_id} onChange={(event) => setRenewForm({ ...renewForm, template_id: event.target.value })} className="mt-1 w-full">
                {templates.filter((template) => template.is_active).map((template) => (
                  <NativeSelectOption key={template.id} value={template.id}>{template.name}</NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label htmlFor="renew-issued-on">New issue date</Label><Input id="renew-issued-on" type="date" required value={renewForm.issued_on} onChange={(event) => setRenewForm({ ...renewForm, issued_on: event.target.value })} className="mt-1" /></div>
              <div><Label htmlFor="renew-expires-on">Custom expiry</Label><Input id="renew-expires-on" type="date" min={renewForm.issued_on} value={renewForm.expires_on} onChange={(event) => setRenewForm({ ...renewForm, expires_on: event.target.value })} className="mt-1" /></div>
            </div>
            <div><Label htmlFor="renew-reason">Renewal reason</Label><Input id="renew-reason" value={renewForm.reason} onChange={(event) => setRenewForm({ ...renewForm, reason: event.target.value })} className="mt-1" /></div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRenewCard(null)}>Cancel</Button>
            <Button type="button" disabled={renewMutation.isPending} onClick={() => renewMutation.mutate()}>
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              Create renewed card
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(templateEditor)} onOpenChange={(open) => !open && setTemplateEditor(null)}>
        <DialogContent
          className="max-h-[94vh] overflow-y-auto sm:max-w-4xl"
          onCloseAutoFocus={(event) => {
            if (!templateTriggerRef.current) return;
            event.preventDefault();
            templateTriggerRef.current.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>{templateEditor === "new" ? "Create credential template" : "Edit credential template"}</DialogTitle>
            <DialogDescription>
              Choose only fields staff need. The preview updates with your brand colors.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,.9fr)]"
            onSubmit={(event) => {
              event.preventDefault();
              templateMutation.mutate();
            }}
          >
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label htmlFor="template-name">Template name</Label><Input id="template-name" required value={templateForm.name} onChange={(event) => setTemplateForm({ ...templateForm, name: event.target.value })} className="mt-1" /></div>
                <div><Label htmlFor="template-code">Template code</Label><Input id="template-code" required pattern="[A-Za-z0-9][A-Za-z0-9_-]*" value={templateForm.code} onChange={(event) => setTemplateForm({ ...templateForm, code: event.target.value.toUpperCase() })} className="mt-1 font-mono" /></div>
              </div>
              <div><Label htmlFor="template-description">Description</Label><Textarea id="template-description" value={templateForm.description ?? ""} onChange={(event) => setTemplateForm({ ...templateForm, description: event.target.value })} className="mt-1" maxLength={2000} /></div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div><Label htmlFor="template-orientation">Orientation</Label><NativeSelect id="template-orientation" value={templateForm.orientation} onChange={(event) => setTemplateForm({ ...templateForm, orientation: event.target.value as "landscape" | "portrait" })} className="mt-1 w-full"><NativeSelectOption value="landscape">Landscape</NativeSelectOption><NativeSelectOption value="portrait">Portrait</NativeSelectOption></NativeSelect></div>
                <div><Label htmlFor="template-validity">Validity (months)</Label><Input id="template-validity" type="number" min={1} max={120} required value={templateForm.validity_months} onChange={(event) => setTemplateForm({ ...templateForm, validity_months: Number(event.target.value) })} className="mt-1" /></div>
                <div><Label htmlFor="template-type">Credential type</Label><NativeSelect id="template-type" value={templateForm.card_type} onChange={(event) => setTemplateForm({ ...templateForm, card_type: event.target.value as IdentityCardTemplatePayload["card_type"] })} className="mt-1 w-full"><NativeSelectOption value="employee">Employee</NativeSelectOption><NativeSelectOption value="contractor">Contractor</NativeSelectOption><NativeSelectOption value="visitor">Visitor</NativeSelectOption><NativeSelectOption value="badge">Badge</NativeSelectOption></NativeSelect></div>
              </div>
              <fieldset>
                <legend className="text-sm font-semibold">Brand colors</legend>
                <div className="mt-2 grid gap-3 sm:grid-cols-3">
                  {(["primary_color", "accent_color", "text_color"] as const).map((key) => (
                    <div key={key}>
                      <Label htmlFor={key}>{fieldLabel(key)}</Label>
                      <div className="mt-1 flex gap-2">
                        <Input id={key} type="color" value={templateForm[key]} onChange={(event) => setTemplateForm({ ...templateForm, [key]: event.target.value.toUpperCase() })} className="h-10 w-14 p-1" />
                        <Input aria-label={`${fieldLabel(key)} hexadecimal value`} value={templateForm[key]} pattern="#[0-9A-Fa-f]{6}" onChange={(event) => setTemplateForm({ ...templateForm, [key]: event.target.value.toUpperCase() })} className="font-mono" />
                      </div>
                    </div>
                  ))}
                </div>
              </fieldset>
              {(["front_fields", "back_fields"] as const).map((side) => (
                <fieldset key={side} className="rounded-xl border p-4">
                  <legend className="px-1 text-sm font-bold">{side === "front_fields" ? "Front fields" : "Back fields"}</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {IDENTITY_CARD_FIELDS.map((field) => (
                      <label key={field} className="flex min-h-10 items-center gap-2 rounded-lg px-2 hover:bg-slate-50">
                        <Checkbox checked={templateForm[side].includes(field)} onCheckedChange={(checked) => toggleTemplateField(side, field, checked === true)} />
                        <span className="text-sm">{fieldLabel(field)}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
              <div className="flex flex-wrap gap-5">
                <label className="flex min-h-10 items-center gap-2"><Checkbox checked={templateForm.is_default} onCheckedChange={(checked) => setTemplateForm({ ...templateForm, is_default: checked === true })} /><span className="text-sm font-semibold">Default template</span></label>
                <label className="flex min-h-10 items-center gap-2"><Checkbox checked={templateForm.is_active} onCheckedChange={(checked) => setTemplateForm({ ...templateForm, is_active: checked === true })} /><span className="text-sm font-semibold">Active for issuing</span></label>
              </div>
            </div>
            <div className="space-y-4 lg:sticky lg:top-0 lg:self-start">
              <IdentityCardPreview template={{ ...templateForm, id: 0 }} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setTemplateEditor(null)}>Cancel</Button>
                <Button type="submit" disabled={templateMutation.isPending || templateForm.front_fields.length === 0}>
                  {templateMutation.isPending ? "Saving…" : "Save template"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTemplate)} onOpenChange={(open) => !open && setDeleteTemplate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete unused template?</DialogTitle>
            <DialogDescription>
              Templates linked to issued cards or marked as default cannot be deleted. You can edit the template and make it inactive instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTemplate(null)}>Cancel</Button>
            <Button type="button" variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
              Delete template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
