import api from "@/modules/shared/api/http";
import type { Checkin, Competency, Feedback, Goal, ImprovementPlan, Paginated, PerformanceDashboard, PerformanceReferences, PerformanceReview, ReviewCycle } from "@/modules/performance/types";

type Params = Record<string, string | number | boolean | undefined>;
type Payload = Record<string, unknown>;
type DataEnvelope<T> = { data: T };

export const performanceApi = {
  dashboard: async () => (await api.get<DataEnvelope<PerformanceDashboard>>("/performance/dashboard")).data.data,
  references: async () => (await api.get<DataEnvelope<PerformanceReferences>>("/performance/references")).data.data,
  cycles: async (params: Params = {}) => (await api.get<Paginated<ReviewCycle>>("/performance/cycles", { params })).data,
  createCycle: async (payload: Payload) => (await api.post<DataEnvelope<ReviewCycle>>("/performance/cycles", payload)).data.data,
  updateCycle: async (id: number, payload: Payload) => (await api.patch<DataEnvelope<ReviewCycle>>(`/performance/cycles/${id}`, payload)).data.data,
  cycleAction: async (id: number, action: "activate" | "open-calibration" | "complete" | "cancel", payload: Payload = {}) => (await api.post(`/performance/cycles/${id}/actions/${action}`, payload)).data,
  competencies: async (params: Params = {}) => (await api.get<Paginated<Competency>>("/performance/competencies", { params })).data,
  createCompetency: async (payload: Payload) => (await api.post<DataEnvelope<Competency>>("/performance/competencies", payload)).data.data,
  updateCompetency: async (id: number, payload: Payload) => (await api.patch<DataEnvelope<Competency>>(`/performance/competencies/${id}`, payload)).data.data,
  goals: async (params: Params = {}) => (await api.get<Paginated<Goal>>("/performance/goals", { params })).data,
  createGoal: async (payload: Payload) => (await api.post<DataEnvelope<Goal>>("/performance/goals", payload)).data.data,
  updateGoal: async (id: number, payload: Payload) => (await api.patch<DataEnvelope<Goal>>(`/performance/goals/${id}`, payload)).data.data,
  goalAction: async (id: number, action: "submit" | "approve" | "mark-at-risk" | "block" | "cancel" | "reopen", payload: Payload = {}) => (await api.post(`/performance/goals/${id}/actions/${action}`, payload)).data,
  reviews: async (params: Params = {}) => (await api.get<Paginated<PerformanceReview>>("/performance/reviews", { params })).data,
  review: async (id: number) => (await api.get<DataEnvelope<PerformanceReview>>(`/performance/reviews/${id}`)).data.data,
  reviewAction: async (id: number, action: "self-submit" | "manager-submit" | "calibrate" | "acknowledge", payload: Payload) => (await api.post<DataEnvelope<PerformanceReview>>(`/performance/reviews/${id}/actions/${action}`, payload)).data.data,
  feedback: async (params: Params = {}) => (await api.get<Paginated<Feedback>>("/performance/feedback", { params })).data,
  createFeedback: async (payload: Payload) => (await api.post<DataEnvelope<Feedback>>("/performance/feedback", payload)).data.data,
  updateFeedback: async (id: number, payload: Payload) => (await api.patch<DataEnvelope<Feedback>>(`/performance/feedback/${id}`, payload)).data.data,
  checkins: async (params: Params = {}) => (await api.get<Paginated<Checkin>>("/performance/checkins", { params })).data,
  createCheckin: async (payload: Payload) => (await api.post<DataEnvelope<Checkin>>("/performance/checkins", payload)).data.data,
  updateCheckin: async (id: number, payload: Payload) => (await api.patch<DataEnvelope<Checkin>>(`/performance/checkins/${id}`, payload)).data.data,
  plans: async (params: Params = {}) => (await api.get<Paginated<ImprovementPlan>>("/performance/improvement-plans", { params })).data,
  createPlan: async (payload: Payload) => (await api.post<DataEnvelope<ImprovementPlan>>("/performance/improvement-plans", payload)).data.data,
  updatePlan: async (id: number, payload: Payload) => (await api.patch<DataEnvelope<ImprovementPlan>>(`/performance/improvement-plans/${id}`, payload)).data.data,
  planAction: async (id: number, action: "activate" | "acknowledge" | "successful" | "extend" | "unsuccessful" | "cancel", payload: Payload = {}) => (await api.post(`/performance/improvement-plans/${id}/actions/${action}`, payload)).data,
  report: async (params: Params = {}) => (await api.get<DataEnvelope<PerformanceDashboard>>("/performance/reports/summary", { params })).data.data,
  exportReport: async (params: Params = {}) => (await api.get<Blob>("/performance/reports/export", { params, responseType: "blob" })).data,
  exportUrl: "/performance/reports/export",
};

