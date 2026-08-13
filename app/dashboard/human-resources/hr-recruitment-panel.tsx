'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Briefcase, UserPlus, CheckCircle, Star, Plus, ArrowRight } from 'lucide-react';
import { hrFetch } from '@/modules/humanresources/api';
import { getWorkspaceScopeKey } from '@/lib/runtime-context';

const STAGES = [
  { code: 'applied', label: 'Applied' },
  { code: 'shortlisted', label: 'Shortlisted' },
  { code: 'written_exam', label: 'Written Exam' },
  { code: 'interview', label: 'Interview' },
  { code: 'offer_sent', label: 'Offer Sent' },
  { code: 'hired', label: 'Hired' },
];

export function HrRecruitmentPanel() {
  const queryClient = useQueryClient();
  const scope = getWorkspaceScopeKey();
  const [activeTab, setActiveTab] = useState<'postings' | 'kanban'>('kanban');
  const [createPostingOpen, setCreatePostingOpen] = useState(false);
  const [addApplicantOpen, setAddApplicantOpen] = useState(false);

  const [postingForm, setPostingForm] = useState({
    title: '',
    code: 'JOB-' + Math.floor(1000 + Math.random() * 9000),
    vacancies_count: '1',
    employment_type: 'full_time',
    location: 'Addis Ababa',
    description: '',
  });

  const [applicantForm, setApplicantForm] = useState({
    job_posting_id: '',
    candidate_name: '',
    email: '',
    phone: '',
    notes: '',
  });

  const postingsQuery = useQuery({
    queryKey: ['hr-job-postings', scope],
    queryFn: () => hrFetch<any>('/recruitment/job-postings'),
  });

  const applicantsQuery = useQuery({
    queryKey: ['hr-applicants', scope],
    queryFn: () => hrFetch<any>('/recruitment/applicants'),
  });

  const createPostingMutation = useMutation({
    mutationFn: () =>
      hrFetch('/recruitment/job-postings', {
        method: 'POST',
        body: JSON.stringify({ ...postingForm, vacancies_count: Number(postingForm.vacancies_count) }),
      }),
    onSuccess: () => {
      toast.success('Job posting created successfully.');
      setCreatePostingOpen(false);
      queryClient.invalidateQueries({ queryKey: ['hr-job-postings'] });
    },
  });

  const addApplicantMutation = useMutation({
    mutationFn: () =>
      hrFetch('/recruitment/applicants', {
        method: 'POST',
        body: JSON.stringify({ ...applicantForm, job_posting_id: Number(applicantForm.job_posting_id) }),
      }),
    onSuccess: () => {
      toast.success('Applicant registered successfully.');
      setAddApplicantOpen(false);
      queryClient.invalidateQueries({ queryKey: ['hr-applicants'] });
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: ({ id, stage }: { id: number; stage: string }) =>
      hrFetch(`/recruitment/applicants/${id}/stage`, {
        method: 'PATCH',
        body: JSON.stringify({ stage }),
      }),
    onSuccess: () => {
      toast.success('Candidate moved to next stage.');
      queryClient.invalidateQueries({ queryKey: ['hr-applicants'] });
    },
  });

  const hireMutation = useMutation({
    mutationFn: (id: number) =>
      hrFetch(`/recruitment/applicants/${id}/hire`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Candidate successfully hired & promoted to Employee Profile!');
      queryClient.invalidateQueries({ queryKey: ['hr-applicants'] });
      queryClient.invalidateQueries({ queryKey: ['hr-employees-table'] });
    },
  });

  const postings = postingsQuery.data?.data ?? [];
  const applicants = applicantsQuery.data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold">Recruitment & Applicant Pipeline (ATS)</h3>
          <p className="text-xs text-slate-500">
            Publish job openings, track candidate evaluation stages, and promote hired applicants to Employee Directory.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border p-1 text-xs">
            <button
              className={`px-3 py-1 font-bold rounded-md ${activeTab === 'kanban' ? 'bg-amber-500 text-white' : ''}`}
              onClick={() => setActiveTab('kanban')}
            >
              Candidate Pipeline
            </button>
            <button
              className={`px-3 py-1 font-bold rounded-md ${activeTab === 'postings' ? 'bg-amber-500 text-white' : ''}`}
              onClick={() => setActiveTab('postings')}
            >
              Job Postings ({postings.length})
            </button>
          </div>
          <Button type="button" variant="outline" onClick={() => setCreatePostingOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> New Job Opening
          </Button>
          <Button type="button" onClick={() => setAddApplicantOpen(true)}>
            <UserPlus className="mr-1 h-4 w-4" /> Add Candidate
          </Button>
        </div>
      </div>

      {activeTab === 'kanban' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6 overflow-x-auto">
          {STAGES.map((s) => {
            const stageApplicants = applicants.filter((a: any) => a.stage === s.code);
            return (
              <div key={s.code} className="rounded-xl border border-slate-300 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900 min-w-[200px]">
                <div className="flex items-center justify-between border-b pb-2 mb-3">
                  <span className="font-bold text-xs">{s.label}</span>
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold dark:bg-slate-800">
                    {stageApplicants.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {stageApplicants.map((app: any) => (
                    <div key={app.id} className="rounded-lg border bg-white p-3 shadow-sm dark:bg-slate-950 text-xs space-y-2">
                      <div className="font-bold text-sm">{app.candidate_name}</div>
                      <div className="text-slate-500 text-[11px]">{app.email}</div>
                      <div className="text-slate-400 text-[11px]">Job: {app.job_posting?.title || 'General'}</div>
                      <div className="flex items-center justify-between pt-2 border-t">
                        {app.stage !== 'hired' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const nextIdx = STAGES.findIndex((st) => st.code === app.stage) + 1;
                              if (nextIdx < STAGES.length) {
                                updateStageMutation.mutate({ id: app.id, stage: STAGES[nextIdx].code });
                              }
                            }}
                            className="h-6 text-[11px] px-1 text-amber-600"
                          >
                            Advance <ArrowRight className="ml-1 h-3 w-3" />
                          </Button>
                        )}
                        {app.stage === 'offer_sent' && (
                          <Button
                            size="sm"
                            onClick={() => hireMutation.mutate(app.id)}
                            className="h-6 text-[11px] bg-emerald-600 hover:bg-emerald-700"
                          >
                            Hire Candidate
                          </Button>
                        )}
                        {app.stage === 'hired' && (
                          <span className="flex items-center text-emerald-600 font-bold text-[11px]">
                            <CheckCircle className="mr-1 h-3 w-3" /> Employee Active
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {postings.map((p: any) => (
            <div key={p.id} className="rounded-xl border border-slate-300 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-slate-400">{p.code}</span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800 capitalize">
                  {p.status}
                </span>
              </div>
              <h4 className="font-bold text-base">{p.title}</h4>
              <p className="text-xs text-slate-500 line-clamp-2">{p.description || 'No description available.'}</p>
              <div className="flex justify-between text-xs text-slate-400 border-t pt-3">
                <span>Vacancies: <strong>{p.vacancies_count}</strong></span>
                <span>Location: <strong>{p.location}</strong></span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={createPostingOpen} onOpenChange={setCreatePostingOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Job Opening</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-xs">
            <div>
              <Label>Job Title</Label>
              <Input
                value={postingForm.title}
                onChange={(e) => setPostingForm({ ...postingForm, title: e.target.value })}
                placeholder="e.g. Senior Accountant"
              />
            </div>
            <div>
              <Label>Vacancies Count</Label>
              <Input
                type="number"
                value={postingForm.vacancies_count}
                onChange={(e) => setPostingForm({ ...postingForm, vacancies_count: e.target.value })}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={postingForm.description}
                onChange={(e) => setPostingForm({ ...postingForm, description: e.target.value })}
                placeholder="Job responsibilities..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreatePostingOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => createPostingMutation.mutate()}>Save Job Opening</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addApplicantOpen} onOpenChange={setAddApplicantOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Register Candidate Application</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-xs">
            <div>
              <Label>Select Job Opening</Label>
              <select
                value={applicantForm.job_posting_id}
                onChange={(e) => setApplicantForm({ ...applicantForm, job_posting_id: e.target.value })}
                className="mt-1 w-full rounded-md border p-2 text-xs"
              >
                <option value="">Select Job Opening</option>
                {postings.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Candidate Name</Label>
              <Input
                value={applicantForm.candidate_name}
                onChange={(e) => setApplicantForm({ ...applicantForm, candidate_name: e.target.value })}
                placeholder="Abebe Bikila"
              />
            </div>
            <div>
              <Label>Email Address</Label>
              <Input
                type="email"
                value={applicantForm.email}
                onChange={(e) => setApplicantForm({ ...applicantForm, email: e.target.value })}
                placeholder="abebe@example.com"
              />
            </div>
            <div>
              <Label>Phone Number</Label>
              <Input
                value={applicantForm.phone}
                onChange={(e) => setApplicantForm({ ...applicantForm, phone: e.target.value })}
                placeholder="+251 911 223344"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddApplicantOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => addApplicantMutation.mutate()}>Register Applicant</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
