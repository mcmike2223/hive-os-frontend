"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/store/use-translation";

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
import { strategyApi } from "@/modules/strategy/api";
import type { StrategyPlan, StrategyReview } from "@/modules/strategy/types";
import { EmptyPanel, LoadingPanel, Panel, StatTile } from "@/modules/shared/charts/primitives";

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const today = () => new Date().toISOString().slice(0, 10);

export default function StrategyReviewsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [planOpen, setPlanOpen] = React.useState(false);
  const [reviewOpen, setReviewOpen] = React.useState(false);

  const [planForm, setPlanForm] = React.useState({
    code: "",
    name: "",
    vision: "",
    mission: "",
    starts_on: today(),
    ends_on: "",
    status: "draft",
  });

  const [reviewForm, setReviewForm] = React.useState({
    plan_id: "",
    period_label: "",
    held_on: today(),
    chaired_by: "",
    attendees: "",
    decisions: "",
  });

  const plansQuery = useQuery({
    queryKey: ["strategy", "plans"],
    queryFn: () => strategyApi.listPlans({ limit: 50 }).then((res) => res.data),
  });

  const reviewsQuery = useQuery({
    queryKey: ["strategy", "reviews"],
    queryFn: () => strategyApi.listReviews({ limit: 50 }).then((res) => res.data),
  });

  const overviewQuery = useQuery({
    queryKey: ["strategy", "overview-reviews"],
    queryFn: () => strategyApi.overview().then((res) => res.data),
  });

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["strategy"] });
  }, [queryClient]);

  const errorText = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const createPlan = useMutation({
    mutationFn: () =>
      strategyApi.createPlan({
        code: planForm.code,
        name: planForm.name,
        vision: planForm.vision || null,
        mission: planForm.mission || null,
        starts_on: planForm.starts_on,
        ends_on: planForm.ends_on,
        status: planForm.status,
      }),
    onSuccess: () => {
      toast.success(t("strategy.plans.saved", "Plan created."));
      invalidate();
      setPlanOpen(false);
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("strategy.plans.save_failed", "Could not create it."))),
  });

  const createReview = useMutation({
    mutationFn: () =>
      strategyApi.createReview({
        plan_id: Number(reviewForm.plan_id),
        period_label: reviewForm.period_label,
        held_on: reviewForm.held_on,
        chaired_by: reviewForm.chaired_by || null,
        attendees: reviewForm.attendees || null,
        decisions: reviewForm.decisions || null,
      }),
    onSuccess: () => {
      toast.success(
        t("strategy.reviews.saved", "Review minuted with the score as it stands today."),
      );
      invalidate();
      setReviewOpen(false);
    },
    onError: (error: any) =>
      toast.error(errorText(error, t("strategy.reviews.save_failed", "Could not minute it."))),
  });

  const plans = (plansQuery.data?.data ?? []) as StrategyPlan[];
  const reviews = (reviewsQuery.data?.data ?? []) as StrategyReview[];
  const overview = overviewQuery.data?.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {t("strategy.reviews.title", "Plans and Reviews")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "strategy.reviews.subtitle",
              "The minute book. Each review freezes the score as it stood on the day, so a late reading cannot rewrite what the board was actually told.",
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-full px-5" onClick={() => setPlanOpen(true)}>
            {t("strategy.plans.add", "New Plan")}
          </Button>
          <Button
            className="rounded-full px-5"
            onClick={() => {
              setReviewOpen(true);
              setReviewForm((current) => ({
                ...current,
                plan_id: current.plan_id || String(overview?.plan?.id ?? ""),
              }));
            }}
            disabled={plans.length === 0}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t("strategy.reviews.add", "Minute Review")}
          </Button>
        </div>
      </div>

      {overview?.plan ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile
            label={t("strategy.overview.plan_score", "Plan score today")}
            value={overview.score === null ? "—" : `${n(overview.score).toFixed(1)}%`}
          />
          <StatTile
            label={t("strategy.reviews.elapsed", "Plan elapsed")}
            value={`${n(overview.plan.elapsed_percent).toFixed(0)}%`}
            meta={t("strategy.reviews.days_meta", "{n} days remaining").replace(
              "{n}",
              String(n(overview.plan.days_remaining)),
            )}
          />
          <StatTile
            label={t("strategy.reviews.count", "Reviews minuted")}
            value={reviews.length.toLocaleString()}
          />
        </div>
      ) : null}

      <Panel
        title={t("strategy.plans.title", "Plans")}
        description={t(
          "strategy.plans.desc",
          "Only one plan is normally active; the rest are kept for the record.",
        )}
      >
        {plansQuery.isLoading ? (
          <LoadingPanel label={t("strategy.common.loading", "Loading plans...")} />
        ) : plans.length === 0 ? (
          <EmptyPanel label={t("strategy.plans.none", "No plans yet.")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-3 font-semibold">{t("strategy.plans.plan", "Plan")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("strategy.common.status", "Status")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("strategy.plans.period", "Period")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("strategy.reviews.elapsed", "Elapsed")}</th>
                  <th className="pb-2 pr-6 text-right font-semibold">
                    {t("strategy.plans.contents", "Contents")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => (
                  <tr key={plan.id} className="border-b border-border/40 last:border-0">
                    <td className="py-2 pr-3">
                      <span className="block font-medium">{plan.name}</span>
                      <span className="block text-[11px] text-muted-foreground">{plan.code}</span>
                    </td>
                    <td className="py-2 pr-3">
                      <Badge variant="outline" className="text-[11px] capitalize">
                        {plan.status}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3 text-xs tabular-nums">
                      {String(plan.starts_on).slice(0, 10)} → {String(plan.ends_on).slice(0, 10)}
                    </td>
                    <td className="py-2 pr-3 text-xs tabular-nums">
                      {n(plan.elapsed_percent).toFixed(0)}%
                      {plan.days_remaining !== null && plan.days_remaining !== undefined ? (
                        <span
                          className={`block text-[11px] ${
                            plan.days_remaining < 0 ? "text-destructive" : "text-muted-foreground"
                          }`}
                        >
                          {plan.days_remaining < 0
                            ? t("strategy.plans.overrun", "{n} days past its end").replace(
                                "{n}",
                                String(Math.abs(plan.days_remaining)),
                              )
                            : t("strategy.reviews.days_meta", "{n} days remaining").replace(
                                "{n}",
                                String(plan.days_remaining),
                              )}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-6 text-right text-xs tabular-nums">
                      {t("strategy.plans.contents_meta", "{o} objectives · {i} initiatives")
                        .replace("{o}", String(n(plan.objectives_count)))
                        .replace("{i}", String(n(plan.initiatives_count)))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        title={t("strategy.reviews.minutes", "Board reviews")}
        description={t(
          "strategy.reviews.minutes_desc",
          "The reported score is a snapshot taken when the review was minuted, not a live figure.",
        )}
      >
        {reviewsQuery.isLoading ? (
          <LoadingPanel label={t("strategy.common.loading", "Loading reviews...")} />
        ) : reviews.length === 0 ? (
          <EmptyPanel label={t("strategy.reviews.none", "No reviews minuted yet.")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-3 font-semibold">{t("strategy.reviews.period", "Period")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("strategy.reviews.held", "Held")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("strategy.reviews.chair", "Chair")}</th>
                  <th className="pb-2 pr-3 font-semibold">{t("strategy.reviews.reported", "Reported score")}</th>
                  <th className="pb-2 pr-6 font-semibold">{t("strategy.reviews.decisions", "Decisions")}</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((review) => (
                  <tr key={review.id} className="border-b border-border/40 last:border-0">
                    <td className="py-2 pr-3 font-medium tabular-nums">{review.period_label}</td>
                    <td className="py-2 pr-3 text-xs tabular-nums">
                      {String(review.held_on).slice(0, 10)}
                    </td>
                    <td className="py-2 pr-3 text-xs">{review.chaired_by ?? "—"}</td>
                    <td className="py-2 pr-3 text-sm font-bold tabular-nums">
                      {review.reported_score === null ? "—" : `${n(review.reported_score).toFixed(1)}%`}
                    </td>
                    <td className="py-2 pr-6 text-xs text-muted-foreground">
                      {review.decisions ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* New plan */}
      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("strategy.plans.add", "New Plan")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "strategy.plans.add_desc",
                  "The start and end dates are what every score is judged against — they decide how much of the plan has elapsed.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="p-code">{t("strategy.common.code", "Code")}</Label>
              <Input
                id="p-code"
                value={planForm.code}
                onChange={(event) => setPlanForm({ ...planForm, code: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-status">{t("strategy.common.status", "Status")}</Label>
              <select
                id="p-status"
                value={planForm.status}
                onChange={(event) => setPlanForm({ ...planForm, status: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm capitalize"
              >
                {["draft", "active", "closed", "archived"].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="p-name">{t("strategy.common.name", "Name")}</Label>
              <Input
                id="p-name"
                value={planForm.name}
                onChange={(event) => setPlanForm({ ...planForm, name: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-start">{t("strategy.plans.starts", "Starts")}</Label>
              <Input
                id="p-start"
                type="date"
                value={planForm.starts_on}
                onChange={(event) => setPlanForm({ ...planForm, starts_on: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-end">{t("strategy.plans.ends", "Ends")}</Label>
              <Input
                id="p-end"
                type="date"
                min={planForm.starts_on}
                value={planForm.ends_on}
                onChange={(event) => setPlanForm({ ...planForm, ends_on: event.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="p-vision">{t("strategy.plans.vision", "Vision")}</Label>
              <Input
                id="p-vision"
                value={planForm.vision}
                onChange={(event) => setPlanForm({ ...planForm, vision: event.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="p-mission">{t("strategy.plans.mission", "Mission")}</Label>
              <Input
                id="p-mission"
                value={planForm.mission}
                onChange={(event) => setPlanForm({ ...planForm, mission: event.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setPlanOpen(false)}>
              {t("strategy.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => createPlan.mutate()}
              disabled={
                createPlan.isPending ||
                !planForm.code.trim() ||
                !planForm.name.trim() ||
                !planForm.ends_on
              }
            >
              {t("strategy.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Minute a review */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="sm:max-w-lg rounded-[2rem] border-border/60 bg-background/95 p-0 backdrop-blur-xl">
          <div className="border-b border-border/40 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("strategy.reviews.add", "Minute Review")}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "strategy.reviews.add_desc",
                  "The score is captured from the live scorecard now and then frozen, so this record keeps saying what the board was told even after later readings arrive.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="v-plan">{t("strategy.overview.plan", "Plan")}</Label>
              <select
                id="v-plan"
                value={reviewForm.plan_id}
                onChange={(event) => setReviewForm({ ...reviewForm, plan_id: event.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{t("strategy.common.select", "Select...")}</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-period">{t("strategy.reviews.period", "Period")}</Label>
              <Input
                id="v-period"
                value={reviewForm.period_label}
                onChange={(event) =>
                  setReviewForm({ ...reviewForm, period_label: event.target.value })
                }
                placeholder="2026-Q4"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-held">{t("strategy.reviews.held", "Held on")}</Label>
              <Input
                id="v-held"
                type="date"
                value={reviewForm.held_on}
                onChange={(event) => setReviewForm({ ...reviewForm, held_on: event.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="v-chair">{t("strategy.reviews.chair", "Chaired by")}</Label>
              <Input
                id="v-chair"
                value={reviewForm.chaired_by}
                onChange={(event) => setReviewForm({ ...reviewForm, chaired_by: event.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="v-decisions">{t("strategy.reviews.decisions", "Decisions")}</Label>
              <Input
                id="v-decisions"
                value={reviewForm.decisions}
                onChange={(event) => setReviewForm({ ...reviewForm, decisions: event.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border/40 px-6 py-4">
            <Button variant="ghost" onClick={() => setReviewOpen(false)}>
              {t("strategy.common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={() => createReview.mutate()}
              disabled={
                createReview.isPending || !reviewForm.plan_id || !reviewForm.period_label.trim()
              }
            >
              {t("strategy.common.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
