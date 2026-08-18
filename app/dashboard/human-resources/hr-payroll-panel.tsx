'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Wallet, Calculator, FileCheck, DollarSign, Printer, Plus } from 'lucide-react';
import { payrollFetch } from '@/modules/payroll/api';
import { getWorkspaceScopeKey } from '@/lib/runtime-context';
import { PanelTableSkeleton } from '@/components/ui/loading-states';

export function HrPayrollPanel({ employees }: { employees: any[] }) {
  const queryClient = useQueryClient();
  const scope = getWorkspaceScopeKey();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState<any>(null);

  const [form, setForm] = useState({
    employee_id: '',
    pay_period_start: new Date().toISOString().slice(0, 7) + '-01',
    pay_period_end: new Date().toISOString().slice(0, 10),
    transport_allowance: '0',
    other_allowances: '0',
    overtime_amount: '0',
    other_deductions: '0',
    notes: '',
  });

  const payslipsQuery = useQuery({
    queryKey: ['hr-payslips', scope],
    queryFn: () => payrollFetch<any>('/payroll/payslips'),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      payrollFetch('/payroll/payslips', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          employee_id: Number(form.employee_id),
          transport_allowance: Number(form.transport_allowance),
          other_allowances: Number(form.other_allowances),
          overtime_amount: Number(form.overtime_amount),
          other_deductions: Number(form.other_deductions),
        }),
      }),
    onSuccess: () => {
      toast.success('Payslip generated with Ethiopian Tax & Pension calculations.');
      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ['hr-payslips'] });
    },
  });

  const batchMutation = useMutation({
    mutationFn: () =>
      payrollFetch('/payroll/payslips/batch', {
        method: 'POST',
        body: JSON.stringify({
          pay_period_start: new Date().toISOString().slice(0, 7) + '-01',
          pay_period_end: new Date().toISOString().slice(0, 10),
        }),
      }),
    onSuccess: (res: any) => {
      toast.success(`Batch payroll generated: ${res.count} payslips created.`);
      queryClient.invalidateQueries({ queryKey: ['hr-payslips'] });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      payrollFetch(`/payroll/payslips/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      toast.success('Payslip status updated.');
      queryClient.invalidateQueries({ queryKey: ['hr-payslips'] });
    },
  });

  const payslips = payslipsQuery.data?.data ?? [];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {payslipsQuery.isLoading
          ? Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="rounded-[1.5rem] border border-border/50 bg-card/50 p-5"
              >
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                <div className="mt-3 h-8 w-28 animate-pulse rounded-xl bg-muted/60" />
              </div>
            ))
          : (
            <>
        <div className="rounded-xl border border-slate-300 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Wallet className="h-4 w-4 text-emerald-500" />
            Total Monthly Gross
          </div>
          <p className="mt-2 text-2xl font-bold font-mono">
            {payslips.reduce((acc: number, p: any) => acc + Number(p.gross_salary), 0).toLocaleString()} ETB
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Calculator className="h-4 w-4 text-amber-500" />
            Income Tax (Proc 979/2016)
          </div>
          <p className="mt-2 text-2xl font-bold font-mono">
            {payslips.reduce((acc: number, p: any) => acc + Number(p.income_tax), 0).toLocaleString()} ETB
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <FileCheck className="h-4 w-4 text-primary" />
            Pension (Emp 7% + Org 11%)
          </div>
          <p className="mt-2 text-2xl font-bold font-mono">
            {payslips.reduce((acc: number, p: any) => acc + Number(p.employee_pension) + Number(p.employer_pension), 0).toLocaleString()} ETB
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <DollarSign className="h-4 w-4 text-emerald-600" />
            Total Net Payout
          </div>
          <p className="mt-2 text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {payslips.reduce((acc: number, p: any) => acc + Number(p.net_salary), 0).toLocaleString()} ETB
          </p>
        </div>
            </>
          )}
      </div>

      {/* Header Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold">Ethiopian Payroll & Payslips</h3>
          <p className="text-xs text-slate-500">
            Compliant with Tax Proclamation 979/2016 and Pension Proclamations 1268/2021 & 1269/2021.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => batchMutation.mutate()}
            disabled={batchMutation.isPending}
          >
            {batchMutation.isPending ? 'Generating...' : 'Generate Monthly Batch'}
          </Button>
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Create Payslip
          </Button>
        </div>
      </div>

      {/* Data Table */}
      {payslipsQuery.isLoading ? (
        <PanelTableSkeleton rows={6} cols={8} />
      ) : (
      <div className="rounded-xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b bg-slate-50 font-bold dark:bg-slate-900">
            <tr>
              <th className="p-3">Payslip #</th>
              <th className="p-3">Employee</th>
              <th className="p-3">Period</th>
              <th className="p-3">Basic Salary</th>
              <th className="p-3">Gross Salary</th>
              <th className="p-3">Income Tax</th>
              <th className="p-3">Pension (7%)</th>
              <th className="p-3">Net Salary</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {payslips.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-4 text-center text-slate-500">
                  No payslips generated yet. Click "Generate Monthly Batch" or "Create Payslip".
                </td>
              </tr>
            ) : (
              payslips.map((p: any) => (
                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                  <td className="p-3 font-mono font-bold">{p.payslip_number}</td>
                  <td className="p-3 font-bold">{p.employee?.primary_name}</td>
                  <td className="p-3 text-slate-500">
                    {p.pay_period_start} to {p.pay_period_end}
                  </td>
                  <td className="p-3">{Number(p.basic_salary).toLocaleString()} ETB</td>
                  <td className="p-3 font-semibold">{Number(p.gross_salary).toLocaleString()} ETB</td>
                  <td className="p-3 text-red-600">{Number(p.income_tax).toLocaleString()} ETB</td>
                  <td className="p-3 text-blue-600">{Number(p.employee_pension).toLocaleString()} ETB</td>
                  <td className="p-3 font-bold text-teal-600">{Number(p.net_salary).toLocaleString()} ETB</td>
                  <td className="p-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${
                        p.status === 'paid'
                          ? 'bg-emerald-100 text-emerald-800'
                          : p.status === 'approved'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="p-3 text-right space-x-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedPayslip(p)}
                      className="h-7 text-[11px]"
                    >
                      <Printer className="mr-1 h-3 w-3" />
                      View Payslip
                    </Button>
                    {p.status === 'draft' && (
                      <Button
                        size="sm"
                        onClick={() => updateStatusMutation.mutate({ id: p.id, status: 'approved' })}
                        className="h-7 text-[11px]"
                      >
                        Approve
                      </Button>
                    )}
                    {p.status === 'approved' && (
                      <Button
                        size="sm"
                        onClick={() => updateStatusMutation.mutate({ id: p.id, status: 'paid' })}
                        className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-700"
                      >
                        Mark Paid
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Individual Payslip</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-xs">
            <div>
              <Label>Select Employee</Label>
              <select
                value={form.employee_id}
                onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="">Select Employee</option>
                {employees.map((emp: any) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.primary_name} ({emp.employee_number})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={form.pay_period_start}
                  onChange={(e) => setForm({ ...form, pay_period_start: e.target.value })}
                />
              </div>
              <div>
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={form.pay_period_end}
                  onChange={(e) => setForm({ ...form, pay_period_end: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Transport Allowance (ETB)</Label>
                <Input
                  type="number"
                  value={form.transport_allowance}
                  onChange={(e) => setForm({ ...form, transport_allowance: e.target.value })}
                />
              </div>
              <div>
                <Label>Overtime Amount (ETB)</Label>
                <Input
                  type="number"
                  value={form.overtime_amount}
                  onChange={(e) => setForm({ ...form, overtime_amount: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              Calculate & Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Payslip Dialog */}
      {selectedPayslip && (
        <Dialog open={Boolean(selectedPayslip)} onOpenChange={() => setSelectedPayslip(null)}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>Official Payslip Breakdown ({selectedPayslip.payslip_number})</span>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 border rounded-xl p-4 bg-slate-50 dark:bg-slate-900 text-xs">
              <div className="flex justify-between border-b pb-2">
                <div>
                  <p className="font-bold text-sm">{selectedPayslip.employee?.primary_name}</p>
                  <p className="text-slate-500">ID: {selectedPayslip.employee?.employee_number}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">Period: {selectedPayslip.pay_period_start} to {selectedPayslip.pay_period_end}</p>
                  <p className="text-emerald-600 font-bold uppercase">{selectedPayslip.status}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="font-bold border-b pb-1">Earnings (ETB)</p>
                  <div className="flex justify-between"><span>Basic Salary:</span> <span>{Number(selectedPayslip.basic_salary).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span>Transport Allowance:</span> <span>{Number(selectedPayslip.transport_allowance).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span>Overtime Pay:</span> <span>{Number(selectedPayslip.overtime_amount).toLocaleString()}</span></div>
                  <div className="flex justify-between font-bold border-t pt-1"><span>Total Gross:</span> <span>{Number(selectedPayslip.gross_salary).toLocaleString()}</span></div>
                </div>
                <div className="space-y-1">
                  <p className="font-bold border-b pb-1">Statutory Deductions (ETB)</p>
                  <div className="flex justify-between text-red-600"><span>Income Tax (Proc 979):</span> <span>-{Number(selectedPayslip.income_tax).toLocaleString()}</span></div>
                  <div className="flex justify-between text-blue-600"><span>Employee Pension (7%):</span> <span>-{Number(selectedPayslip.employee_pension).toLocaleString()}</span></div>
                  <div className="flex justify-between text-slate-500 text-[11px]"><span>Employer Pension (11%):</span> <span>[{Number(selectedPayslip.employer_pension).toLocaleString()}]</span></div>
                  <div className="flex justify-between font-bold text-teal-600 border-t pt-1 text-sm"><span>Net Take-Home:</span> <span>{Number(selectedPayslip.net_salary).toLocaleString()} ETB</span></div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => window.print()} variant="outline">
                <Printer className="mr-1 h-4 w-4" /> Print Payslip
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
