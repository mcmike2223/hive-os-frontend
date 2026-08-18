'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Receipt, Check, X, Plus, DollarSign, Loader2 } from 'lucide-react';
import { hrFetch } from '@/modules/humanresources/api';
import { getWorkspaceScopeKey } from '@/lib/runtime-context';
import { PanelTableSkeleton } from '@/components/ui/loading-states';

export function HrExpensesPanel({ employees }: { employees: any[] }) {
  const queryClient = useQueryClient();
  const scope = getWorkspaceScopeKey();
  const [createOpen, setCreateOpen] = useState(false);
  const [updatingAction, setUpdatingAction] = useState<{ id: number; status: string } | null>(null);

  const [form, setForm] = useState({
    employee_id: '',
    category: 'travel',
    amount: '',
    expense_date: new Date().toISOString().slice(0, 10),
    description: '',
  });

  const expensesQuery = useQuery({
    queryKey: ['hr-expenses', scope],
    queryFn: () => hrFetch<any>('/expenses'),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      hrFetch('/expenses', {
        method: 'POST',
        body: JSON.stringify({ ...form, employee_id: Number(form.employee_id), amount: Number(form.amount) }),
      }),
    onSuccess: () => {
      toast.success('Expense claim filed.');
      setCreateOpen(false);
      setForm({
        employee_id: '',
        category: 'travel',
        amount: '',
        expense_date: new Date().toISOString().slice(0, 10),
        description: '',
      });
      queryClient.invalidateQueries({ queryKey: ['hr-expenses'] });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      hrFetch(`/expenses/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, approved_by: 'HR Manager' }),
      }),
    onMutate: ({ id, status }) => {
      setUpdatingAction({ id, status });
    },
    onSuccess: () => {
      toast.success('Expense status updated.');
      queryClient.invalidateQueries({ queryKey: ['hr-expenses'] });
    },
    onSettled: () => {
      setUpdatingAction(null);
    },
  });

  const expenses = expensesQuery.data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold">Expense Claims & Per Diem Reimbursements</h3>
          <p className="text-xs text-slate-500">
            Submit expense reports for business travel, per diem, medical, and supplies reimbursement.
          </p>
        </div>
        <Button type="button" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> File Expense Claim
        </Button>
      </div>

      {expensesQuery.isLoading ? (
        <PanelTableSkeleton rows={6} cols={7} />
      ) : (
      <div className="rounded-xl border bg-white overflow-x-auto dark:bg-slate-950">
        <table className="w-full text-left text-xs">
          <thead className="border-b bg-slate-50 font-bold dark:bg-slate-900">
            <tr>
              <th className="p-3">Claim #</th>
              <th className="p-3">Employee</th>
              <th className="p-3">Category</th>
              <th className="p-3">Date</th>
              <th className="p-3">Amount (ETB)</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {expenses.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-4 text-center text-slate-500">
                  No expense claims submitted yet.
                </td>
              </tr>
            ) : (
              expenses.map((e: any) => (
                <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                  <td className="p-3 font-mono font-bold">{e.claim_number}</td>
                  <td className="p-3 font-bold">{e.employee?.primary_name}</td>
                  <td className="p-3 capitalize">{e.category.replaceAll('_', ' ')}</td>
                  <td className="p-3 text-slate-500">{e.expense_date}</td>
                  <td className="p-3 font-bold text-teal-600">{Number(e.amount).toLocaleString()} ETB</td>
                  <td className="p-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold uppercase ${
                        e.status === 'reimbursed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : e.status === 'approved'
                          ? 'bg-blue-100 text-blue-800'
                          : e.status === 'rejected'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {e.status}
                    </span>
                  </td>
                  <td className="p-3 text-right space-x-1">
                    {e.status === 'submitted' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => updateStatusMutation.mutate({ id: e.id, status: 'approved' })}
                          disabled={updatingAction !== null}
                          className="h-7 text-[11px] bg-blue-600 hover:bg-blue-700"
                        >
                          {updatingAction?.id === e.id && updatingAction?.status === 'approved' ? (
                            <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Approving...</>
                          ) : (
                            'Approve'
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatusMutation.mutate({ id: e.id, status: 'rejected' })}
                          disabled={updatingAction !== null}
                          className="h-7 text-[11px] text-red-600"
                        >
                          {updatingAction?.id === e.id && updatingAction?.status === 'rejected' ? (
                            <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Rejecting...</>
                          ) : (
                            'Reject'
                          )}
                        </Button>
                      </>
                    )}
                    {e.status === 'approved' && (
                      <Button
                        size="sm"
                        onClick={() => updateStatusMutation.mutate({ id: e.id, status: 'reimbursed' })}
                        disabled={updatingAction !== null}
                        className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-700"
                      >
                        {updatingAction?.id === e.id && updatingAction?.status === 'reimbursed' ? (
                          <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Reimbursing...</>
                          ) : (
                            'Reimburse Payout'
                          )}
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>File Expense Claim</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-xs">
            <div>
              <Label>Employee</Label>
              <select
                value={form.employee_id}
                onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
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
              <Label>Expense Category</Label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="travel">Business Travel</option>
                <option value="per_diem">Per Diem Allowance</option>
                <option value="medical">Medical Reimbursement</option>
                <option value="supplies">Office Supplies</option>
              </select>
            </div>
            <div>
              <Label>Amount (ETB)</Label>
              <Input
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="1500.00"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Purpose of expense..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Filing...</>
              ) : (
                'File Claim'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
