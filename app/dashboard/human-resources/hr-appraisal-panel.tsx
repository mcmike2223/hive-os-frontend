'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Award, Target, Star, Plus, CheckCircle2 } from 'lucide-react';
import { hrFetch } from '@/modules/humanresources/api';
import { getWorkspaceScopeKey } from '@/lib/runtime-context';

export function HrAppraisalPanel({ employees }: { employees: any[] }) {
  const queryClient = useQueryClient();
  const scope = getWorkspaceScopeKey();
  const [createOpen, setCreateOpen] = useState(false);

  const [form, setForm] = useState({
    employee_id: '',
    title: '',
    appraisal_type: 'annual',
    period_start: new Date().toISOString().slice(0, 7) + '-01',
    period_end: new Date().toISOString().slice(0, 10),
    overall_score: '85',
    manager_feedback: '',
    action_plan: '',
  });

  const appraisalsQuery = useQuery({
    queryKey: ['hr-appraisals', scope],
    queryFn: () => hrFetch<any>('/appraisals'),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      hrFetch('/appraisals', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          employee_id: Number(form.employee_id),
          overall_score: Number(form.overall_score),
        }),
      }),
    onSuccess: () => {
      toast.success('Appraisal review recorded.');
      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ['hr-appraisals'] });
    },
  });

  const appraisals = appraisalsQuery.data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold">Performance Appraisals & Goal Tracking (OKRs)</h3>
          <p className="text-xs text-slate-500">
            Conduct 360-degree feedback reviews, track probation 60-day evaluations, and score annual achievements.
          </p>
        </div>
        <Button type="button" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> Schedule Appraisal
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {appraisals.length === 0 ? (
          <div className="col-span-full rounded-xl border p-8 text-center text-xs text-slate-500">
            No performance appraisals scheduled yet. Click "Schedule Appraisal" to initiate a review.
          </div>
        ) : (
          appraisals.map((a: any) => (
            <div key={a.id} className="rounded-xl border bg-white p-5 shadow-sm dark:bg-slate-900 space-y-3">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-800 uppercase">
                  {a.appraisal_type.replaceAll('_', ' ')}
                </span>
                <span className="flex items-center text-amber-500 font-bold text-sm">
                  <Star className="mr-1 h-4 w-4 fill-amber-400" /> {a.overall_score}%
                </span>
              </div>
              <h4 className="font-bold text-base">{a.title}</h4>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Employee: {a.employee?.primary_name}
              </p>
              <div className="text-[11px] text-slate-500 border-t pt-2 space-y-1">
                <p><strong>Period:</strong> {a.period_start} to {a.period_end}</p>
                {a.manager_feedback && <p><strong>Feedback:</strong> {a.manager_feedback}</p>}
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule Performance Appraisal</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-xs">
            <div>
              <Label>Employee</Label>
              <select
                value={form.employee_id}
                onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                className="mt-1 w-full rounded-md border p-2 text-xs"
              >
                <option value="">Select Employee</option>
                {employees.map((emp: any) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.primary_name} ({emp.employee_number})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Appraisal Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Annual Performance Review 2026"
              />
            </div>
            <div>
              <Label>Evaluation Type</Label>
              <select
                value={form.appraisal_type}
                onChange={(e) => setForm({ ...form, appraisal_type: e.target.value })}
                className="mt-1 w-full rounded-md border p-2 text-xs"
              >
                <option value="probation_60_day">Probation 60-Day Review</option>
                <option value="annual">Annual Appraisal</option>
                <option value="bi_annual">Bi-Annual Appraisal</option>
              </select>
            </div>
            <div>
              <Label>Overall Performance Score (0 - 100%)</Label>
              <Input
                type="number"
                value={form.overall_score}
                onChange={(e) => setForm({ ...form, overall_score: e.target.value })}
              />
            </div>
            <div>
              <Label>Manager Feedback</Label>
              <Input
                value={form.manager_feedback}
                onChange={(e) => setForm({ ...form, manager_feedback: e.target.value })}
                placeholder="Strengths and areas for growth..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => createMutation.mutate()}>Save Review</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
