"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BadgePercent, BellRing, CalendarClock, CreditCard, Loader2, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  archiveSubscriptionCoupon,
  createSubscriptionCoupon,
  updateSubscriptionBillingPolicy,
  updateSubscriptionCoupon,
} from "@/modules/subscription/api";
import type {
  SubscriptionAdminPlan,
  SubscriptionBillingCycle,
  SubscriptionBillingPolicy,
  SubscriptionCoupon,
} from "@/modules/subscription/types";

type Props = {
  policy: SubscriptionBillingPolicy;
  coupons: SubscriptionCoupon[];
  plans: SubscriptionAdminPlan[];
};

type CouponDraft = Omit<SubscriptionCoupon, "id" | "redemptions_count">;

const scopes: CouponDraft["applicable_scopes"] = [
  "public_signup",
  "hybrid_activation",
  "tenant_upgrade",
  "tenant_renewal",
];
const cycles: SubscriptionBillingCycle[] = ["monthly", "yearly"];

const emptyCoupon = (): CouponDraft => ({
  code: "",
  name: "",
  description: "",
  discount_type: "percent",
  discount_value: 10,
  valid_from: null,
  valid_until: null,
  max_redemptions: null,
  max_redemptions_per_tenant: 1,
  applicable_scopes: [...scopes],
  applicable_plans: [],
  applicable_billing_cycles: [...cycles],
  is_active: true,
});

const errorMessage = (error: unknown, fallback: string) => {
  if (typeof error === "object" && error && "response" in error) {
    return (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? fallback;
  }
  return fallback;
};

const dateInput = (value?: string | null) => value ? value.slice(0, 16) : "";

export function SubscriptionBillingControls({ policy, coupons, plans }: Props) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = React.useState(policy);
  const [couponOpen, setCouponOpen] = React.useState(false);
  const [editingCouponId, setEditingCouponId] = React.useState<string | null>(null);
  const [couponDraft, setCouponDraft] = React.useState<CouponDraft>(emptyCoupon);

  React.useEffect(() => setDraft(policy), [policy]);

  const policyMutation = useMutation({
    mutationFn: () => updateSubscriptionBillingPolicy(draft),
    onSuccess: async () => {
      toast.success("Billing policy saved.");
      await queryClient.invalidateQueries({ queryKey: ["subscription-admin"] });
    },
    onError: (error) => toast.error(errorMessage(error, "Could not save the billing policy.")),
  });

  const couponMutation = useMutation({
    mutationFn: () => editingCouponId
      ? updateSubscriptionCoupon(editingCouponId, couponDraft)
      : createSubscriptionCoupon(couponDraft),
    onSuccess: async () => {
      toast.success(editingCouponId ? "Coupon updated." : "Coupon created.");
      setCouponOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["subscription-admin"] });
    },
    onError: (error) => toast.error(errorMessage(error, "Could not save the coupon.")),
  });

  const archiveMutation = useMutation({
    mutationFn: archiveSubscriptionCoupon,
    onSuccess: async () => {
      toast.success("Coupon archived.");
      await queryClient.invalidateQueries({ queryKey: ["subscription-admin"] });
    },
    onError: (error) => toast.error(errorMessage(error, "Could not archive the coupon.")),
  });

  const openCoupon = (coupon?: SubscriptionCoupon) => {
    setEditingCouponId(coupon?.id ?? null);
    setCouponDraft(coupon ? {
      code: coupon.code,
      name: coupon.name,
      description: coupon.description,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      valid_from: coupon.valid_from,
      valid_until: coupon.valid_until,
      max_redemptions: coupon.max_redemptions,
      max_redemptions_per_tenant: coupon.max_redemptions_per_tenant,
      applicable_scopes: coupon.applicable_scopes,
      applicable_plans: coupon.applicable_plans,
      applicable_billing_cycles: coupon.applicable_billing_cycles,
      is_active: coupon.is_active,
    } : emptyCoupon());
    setCouponOpen(true);
  };

  const setNumber = (key: keyof SubscriptionBillingPolicy, value: string) => {
    setDraft((current) => ({ ...current, [key]: Number(value) }));
  };

  const setActivationAmount = (plan: string, cycle: SubscriptionBillingCycle, value: string) => {
    setDraft((current) => ({
      ...current,
      hybrid_activation_amounts_etb: {
        ...current.hybrid_activation_amounts_etb,
        [plan]: {
          monthly: current.hybrid_activation_amounts_etb?.[plan]?.monthly ?? 0,
          yearly: current.hybrid_activation_amounts_etb?.[plan]?.yearly ?? 0,
          [cycle]: Number(value),
        },
      },
    }));
  };

  return (
    <div className="space-y-6">
      <Alert>
        <CalendarClock aria-hidden="true" />
        <AlertTitle>One billing control plane</AlertTitle>
        <AlertDescription>
          Gateway payments, direct-transfer approvals, activation locks, renewals, and reminders all use this policy.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.6fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BellRing aria-hidden="true" /> Billing & reminders</CardTitle>
            <CardDescription>Set terms, the overdue grace period, and how often tenant admins see the due-payment modal.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {([
                  ["monthly_term_days", "Monthly term", "Days"],
                  ["yearly_term_days", "Yearly term", "Days"],
                  ["yearly_discount_percent", "Yearly discount", "%"],
                  ["grace_period_days", "Grace period", "Days"],
                  ["renewal_warning_days", "Warn before due", "Days"],
                  ["reminder_interval_hours", "Popup interval", "Hours"],
                  ["reminder_max_displays", "Popup limit", "Times"],
                ] as const).map(([key, label, suffix]) => (
                  <Field key={key}>
                    <FieldLabel htmlFor={`policy-${key}`}>{label}</FieldLabel>
                    <div className="relative">
                      <Input id={`policy-${key}`} type="number" min="0" value={draft[key]} onChange={(event) => setNumber(key, event.target.value)} className="pr-16" />
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">{suffix}</span>
                    </div>
                  </Field>
                ))}
              </div>

              <Field orientation="horizontal" className="rounded-xl border p-4">
                <div className="flex-1">
                  <FieldLabel htmlFor="hybrid-enabled">Allow hybrid signup</FieldLabel>
                  <FieldDescription>The signup page mentions a later activation payment without revealing its amount.</FieldDescription>
                </div>
                <Switch id="hybrid-enabled" checked={draft.hybrid_enabled} onCheckedChange={(checked) => setDraft((current) => ({ ...current, hybrid_enabled: checked }))} />
              </Field>

              <Field>
                <FieldLabel htmlFor="hybrid-notice">Public hybrid notice</FieldLabel>
                <Textarea id="hybrid-notice" value={draft.hybrid_signup_notice} onChange={(event) => setDraft((current) => ({ ...current, hybrid_signup_notice: event.target.value }))} />
              </Field>

              <fieldset className="space-y-3">
                <legend className="text-sm font-semibold">Hybrid activation amounts</legend>
                <p className="text-sm text-muted-foreground">These amounts are private during signup and appear only after the tenant signs in.</p>
                <div className="overflow-x-auto rounded-xl border">
                  <Table>
                    <TableHeader><TableRow><TableHead>Plan</TableHead><TableHead>Monthly ETB</TableHead><TableHead>Yearly ETB</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {plans.filter((plan) => plan.status === "active").map((plan) => (
                        <TableRow key={plan.slug}>
                          <TableCell className="font-medium">{plan.name}</TableCell>
                          {cycles.map((cycle) => (
                            <TableCell key={cycle}>
                              <Input aria-label={`${plan.name} ${cycle} hybrid activation amount`} type="number" min="0" value={draft.hybrid_activation_amounts_etb?.[plan.slug]?.[cycle] ?? 0} onChange={(event) => setActivationAmount(plan.slug, cycle, event.target.value)} className="min-w-32" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </fieldset>

              <Button type="button" onClick={() => policyMutation.mutate()} disabled={policyMutation.isPending} className="w-fit">
                {policyMutation.isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}
                Save billing policy
              </Button>
            </FieldGroup>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><CreditCard aria-hidden="true" /> Payment operations</CardTitle><CardDescription>Configure gateways or review submitted bank transfers.</CardDescription></CardHeader>
            <CardContent className="grid gap-3">
              <Button asChild variant="outline"><Link href="/dashboard/settings?tab=payments">Payment gateways</Link></Button>
              <Button asChild variant="outline"><Link href="/dashboard/direct-transfer-reviews">Direct-transfer approvals</Link></Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Current policy</CardTitle></CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">Warning window</span><strong>{draft.renewal_warning_days} days</strong></div>
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">Reminder cadence</span><strong>Every {draft.reminder_interval_hours}h</strong></div>
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">Missed-payment grace</span><strong>{draft.grace_period_days} days</strong></div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div><CardTitle className="flex items-center gap-2"><BadgePercent aria-hidden="true" /> Coupons</CardTitle><CardDescription>Limit promotions by checkout type, plan, billing cycle, date, and usage.</CardDescription></div>
          <Button type="button" onClick={() => openCoupon()}><Plus aria-hidden="true" /> New coupon</Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Discount</TableHead><TableHead>Uses</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {coupons.length === 0 ? <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No coupons yet.</TableCell></TableRow> : coupons.map((coupon) => (
                  <TableRow key={coupon.id}>
                    <TableCell><div className="font-semibold">{coupon.code}</div><div className="text-xs text-muted-foreground">{coupon.name}</div></TableCell>
                    <TableCell>{coupon.discount_type === "percent" ? `${coupon.discount_value}%` : `ETB ${coupon.discount_value}`}</TableCell>
                    <TableCell>{coupon.redemptions_count}{coupon.max_redemptions ? ` / ${coupon.max_redemptions}` : ""}</TableCell>
                    <TableCell><Badge variant={coupon.is_active ? "default" : "secondary"}>{coupon.is_active ? "Active" : "Paused"}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button type="button" variant="ghost" size="icon" aria-label={`Edit ${coupon.code}`} onClick={() => openCoupon(coupon)}><Pencil aria-hidden="true" /></Button>
                      <Button type="button" variant="ghost" size="icon" aria-label={`Archive ${coupon.code}`} onClick={() => archiveMutation.mutate(coupon.id)} disabled={archiveMutation.isPending}><Trash2 aria-hidden="true" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <CouponDialog open={couponOpen} onOpenChange={setCouponOpen} draft={couponDraft} setDraft={setCouponDraft} plans={plans} editing={Boolean(editingCouponId)} saving={couponMutation.isPending} onSave={() => couponMutation.mutate()} />
    </div>
  );
}

function CouponDialog({ open, onOpenChange, draft, setDraft, plans, editing, saving, onSave }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: CouponDraft;
  setDraft: React.Dispatch<React.SetStateAction<CouponDraft>>;
  plans: SubscriptionAdminPlan[];
  editing: boolean;
  saving: boolean;
  onSave: () => void;
}) {
  const toggle = <T extends string>(key: "applicable_scopes" | "applicable_plans" | "applicable_billing_cycles", value: T) => {
    setDraft((current) => {
      const values = current[key] as string[];
      return { ...current, [key]: values.includes(value) ? values.filter((item) => item !== value) : [...values, value] };
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{editing ? "Edit coupon" : "Create coupon"}</DialogTitle><DialogDescription>Empty plan or scope selections mean the coupon applies everywhere.</DialogDescription></DialogHeader>
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field><FieldLabel htmlFor="coupon-code">Code</FieldLabel><Input id="coupon-code" value={draft.code} onChange={(event) => setDraft((current) => ({ ...current, code: event.target.value.toUpperCase() }))} /></Field>
            <Field><FieldLabel htmlFor="coupon-name">Name</FieldLabel><Input id="coupon-name" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></Field>
            <Field><FieldLabel htmlFor="coupon-type">Discount type</FieldLabel><NativeSelect id="coupon-type" value={draft.discount_type} onChange={(event) => setDraft((current) => ({ ...current, discount_type: event.target.value as CouponDraft["discount_type"] }))} className="w-full"><NativeSelectOption value="percent">Percentage</NativeSelectOption><NativeSelectOption value="fixed">Fixed ETB</NativeSelectOption></NativeSelect></Field>
            <Field><FieldLabel htmlFor="coupon-value">Discount value</FieldLabel><Input id="coupon-value" type="number" min="0.01" value={draft.discount_value} onChange={(event) => setDraft((current) => ({ ...current, discount_value: Number(event.target.value) }))} /></Field>
            <Field><FieldLabel htmlFor="coupon-from">Valid from</FieldLabel><Input id="coupon-from" type="datetime-local" value={dateInput(draft.valid_from)} onChange={(event) => setDraft((current) => ({ ...current, valid_from: event.target.value || null }))} /></Field>
            <Field><FieldLabel htmlFor="coupon-until">Valid until</FieldLabel><Input id="coupon-until" type="datetime-local" value={dateInput(draft.valid_until)} onChange={(event) => setDraft((current) => ({ ...current, valid_until: event.target.value || null }))} /></Field>
            <Field><FieldLabel htmlFor="coupon-max">Total redemption limit</FieldLabel><Input id="coupon-max" type="number" min="1" value={draft.max_redemptions ?? ""} onChange={(event) => setDraft((current) => ({ ...current, max_redemptions: event.target.value ? Number(event.target.value) : null }))} /></Field>
            <Field><FieldLabel htmlFor="coupon-tenant-max">Limit per tenant</FieldLabel><Input id="coupon-tenant-max" type="number" min="1" value={draft.max_redemptions_per_tenant} onChange={(event) => setDraft((current) => ({ ...current, max_redemptions_per_tenant: Number(event.target.value) }))} /></Field>
          </div>
          <Field><FieldLabel htmlFor="coupon-description">Description</FieldLabel><Textarea id="coupon-description" value={draft.description ?? ""} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} /></Field>
          <ChoiceGroup legend="Checkout types" values={scopes} selected={draft.applicable_scopes} onToggle={(value) => toggle("applicable_scopes", value)} />
          <ChoiceGroup legend="Billing cycles" values={cycles} selected={draft.applicable_billing_cycles} onToggle={(value) => toggle("applicable_billing_cycles", value)} />
          <ChoiceGroup legend="Plans" values={plans.map((plan) => plan.slug)} selected={draft.applicable_plans} onToggle={(value) => toggle("applicable_plans", value)} />
          <Field orientation="horizontal"><FieldLabel htmlFor="coupon-active">Coupon active</FieldLabel><Switch id="coupon-active" checked={draft.is_active} onCheckedChange={(checked) => setDraft((current) => ({ ...current, is_active: checked }))} /></Field>
        </FieldGroup>
        <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="button" onClick={onSave} disabled={saving || !draft.code.trim() || !draft.name.trim()}>{saving ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />} Save coupon</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChoiceGroup<T extends string>({ legend, values, selected, onToggle }: { legend: string; values: T[]; selected: T[]; onToggle: (value: T) => void }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {values.map((value) => {
          const id = `${legend}-${value}`.replaceAll(" ", "-").toLowerCase();
          return <label key={value} htmlFor={id} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm"><input id={id} type="checkbox" checked={selected.includes(value)} onChange={() => onToggle(value)} /> {value.replaceAll("_", " ")}</label>;
        })}
      </div>
    </fieldset>
  );
}
