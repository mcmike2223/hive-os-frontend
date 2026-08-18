'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Laptop, Car, ShieldCheck, Plus, AlertTriangle, Loader2 } from 'lucide-react';
import { hrFetch } from '@/modules/humanresources/api';
import { getWorkspaceScopeKey } from '@/lib/runtime-context';
import { PanelTableSkeleton } from '@/components/ui/loading-states';

export function HrAssetsPanel({ employees }: { employees: any[] }) {
  const queryClient = useQueryClient();
  const scope = getWorkspaceScopeKey();
  const [createOpen, setCreateOpen] = useState(false);
  const [updatingAssetId, setUpdatingAssetId] = useState<number | null>(null);

  const [form, setForm] = useState({
    employee_id: '',
    asset_name: '',
    asset_category: 'it_laptop',
    serial_number: '',
    issued_date: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  const assetsQuery = useQuery({
    queryKey: ['hr-assets', scope],
    queryFn: () => hrFetch<any>('/assets'),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      hrFetch('/assets', {
        method: 'POST',
        body: JSON.stringify({ ...form, employee_id: Number(form.employee_id) }),
      }),
    onSuccess: () => {
      toast.success('Asset custody registered.');
      setCreateOpen(false);
      setForm({
        employee_id: '',
        asset_name: '',
        asset_category: 'it_laptop',
        serial_number: '',
        issued_date: new Date().toISOString().slice(0, 10),
        notes: '',
      });
      queryClient.invalidateQueries({ queryKey: ['hr-assets'] });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      hrFetch(`/assets/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, return_date: status === 'returned' ? new Date().toISOString().slice(0, 10) : null }),
      }),
    onMutate: ({ id }) => {
      setUpdatingAssetId(id);
    },
    onSuccess: () => {
      toast.success('Asset status updated.');
      queryClient.invalidateQueries({ queryKey: ['hr-assets'] });
    },
    onSettled: () => {
      setUpdatingAssetId(null);
    },
  });

  const assets = assetsQuery.data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold">Equipment & Fleet Asset Custody</h3>
          <p className="text-xs text-slate-500">
            Track company equipment (Laptops, Vehicles, Mobile Devices, Fuel Cards, Badges) assigned to employees.
          </p>
        </div>
        <Button type="button" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> Issue Asset Custody
        </Button>
      </div>

      {assetsQuery.isLoading ? (
        <PanelTableSkeleton rows={6} cols={7} />
      ) : (
      <div className="rounded-xl border bg-white overflow-x-auto dark:bg-slate-950">
        <table className="w-full text-left text-xs">
          <thead className="border-b bg-slate-50 font-bold dark:bg-slate-900">
            <tr>
              <th className="p-3">Asset Name</th>
              <th className="p-3">Category</th>
              <th className="p-3">Serial / Plate #</th>
              <th className="p-3">Custodian Employee</th>
              <th className="p-3">Issued Date</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {assets.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-4 text-center text-slate-500">
                  No asset custodies issued yet.
                </td>
              </tr>
            ) : (
              assets.map((a: any) => (
                <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                  <td className="p-3 font-bold">{a.asset_name}</td>
                  <td className="p-3 capitalize">{a.asset_category.replaceAll('_', ' ')}</td>
                  <td className="p-3 font-mono text-slate-500">{a.serial_number || 'N/A'}</td>
                  <td className="p-3 font-semibold">{a.employee?.primary_name}</td>
                  <td className="p-3 text-slate-500">{a.issued_date}</td>
                  <td className="p-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold uppercase ${
                        a.status === 'issued'
                          ? 'bg-blue-100 text-blue-800'
                          : a.status === 'returned'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {a.status}
                    </span>
                  </td>
                  <td className="p-3 text-right space-x-1">
                    {a.status === 'issued' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatusMutation.mutate({ id: a.id, status: 'returned' })}
                        disabled={updatingAssetId !== null}
                        className="h-7 text-[11px]"
                      >
                        {updatingAssetId === a.id ? (
                          <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Returning...</>
                        ) : (
                          'Mark Returned'
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
            <DialogTitle>Issue Asset Custody</DialogTitle>
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
              <Label>Asset Name</Label>
              <Input
                value={form.asset_name}
                onChange={(e) => setForm({ ...form, asset_name: e.target.value })}
                placeholder="MacBook Pro 16-inch / Toyota Hilux"
              />
            </div>
            <div>
              <Label>Category</Label>
              <select
                value={form.asset_category}
                onChange={(e) => setForm({ ...form, asset_category: e.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="it_laptop">IT Laptop / Computer</option>
                <option value="mobile_device">Mobile Phone / Tablet</option>
                <option value="vehicle">Company Vehicle</option>
                <option value="fuel_card">Fuel Card</option>
                <option value="access_badge">Building Access Badge</option>
                <option value="uniform">Work Uniform / Gear</option>
              </select>
            </div>
            <div>
              <Label>Serial / License Plate Number</Label>
              <Input
                value={form.serial_number}
                onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
                placeholder="C02G12345 / 3-12345 AA"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Issuing...</>
              ) : (
                'Issue Asset'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
