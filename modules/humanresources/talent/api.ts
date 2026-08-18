import http from "../../shared/api/http";

/**
 * Talent management API surface (48 routes under `v1/hr/talent`).
 *
 * Kept in its own file rather than folded into the HR module's api.ts, which
 * already predates the shared axios client and speaks raw fetch.
 */

// The shared client's baseURL already ends in `/api/v1`, so this is relative
// to that — not the full `v1/hr/talent` path the route file declares.
const BASE_URL = "hr/talent";

type Params = Record<string, unknown>;
type Payload = Record<string, unknown>;

export const talentApi = {
  /** One composed read backing the talent dashboard. */
  overview: (params?: Params) => http.get(`${BASE_URL}/overview`, { params }),

  // ------------------------------------------------------------ competencies
  listCompetencies: (params?: Params) => http.get(`${BASE_URL}/competencies`, { params }),
  createCompetency: (data: Payload) => http.post(`${BASE_URL}/competencies`, data),
  updateCompetency: (id: number, data: Payload) => http.put(`${BASE_URL}/competencies/${id}`, data),
  deleteCompetency: (id: number) => http.delete(`${BASE_URL}/competencies/${id}`),
  setEmployeeCompetency: (data: Payload) => http.post(`${BASE_URL}/competencies/employees`, data),
  setPositionCompetency: (data: Payload) => http.post(`${BASE_URL}/competencies/positions`, data),

  // -------------------------------------------------------------- succession
  pipeline: () => http.get(`${BASE_URL}/succession/pipeline`),
  gap: (employeeId: number, positionId: number) =>
    http.get(`${BASE_URL}/succession/gap`, {
      params: { employee_id: employeeId, position_id: positionId },
    }),

  listCriticalRoles: (params?: Params) => http.get(`${BASE_URL}/succession/critical-roles`, { params }),
  createCriticalRole: (data: Payload) => http.post(`${BASE_URL}/succession/critical-roles`, data),
  updateCriticalRole: (id: number, data: Payload) =>
    http.put(`${BASE_URL}/succession/critical-roles/${id}`, data),
  deleteCriticalRole: (id: number) => http.delete(`${BASE_URL}/succession/critical-roles/${id}`),

  createCandidate: (data: Payload) => http.post(`${BASE_URL}/succession/candidates`, data),
  updateCandidate: (id: number, data: Payload) => http.put(`${BASE_URL}/succession/candidates/${id}`, data),
  deleteCandidate: (id: number) => http.delete(`${BASE_URL}/succession/candidates/${id}`),

  listAspirations: (params?: Params) => http.get(`${BASE_URL}/succession/aspirations`, { params }),
  createAspiration: (data: Payload) => http.post(`${BASE_URL}/succession/aspirations`, data),

  // ---------------------------------------------------------------- training
  trainingSummary: (params?: Params) => http.get(`${BASE_URL}/training/summary`, { params }),

  listCourses: (params?: Params) => http.get(`${BASE_URL}/training/courses`, { params }),
  createCourse: (data: Payload) => http.post(`${BASE_URL}/training/courses`, data),
  updateCourse: (id: number, data: Payload) => http.put(`${BASE_URL}/training/courses/${id}`, data),
  deleteCourse: (id: number) => http.delete(`${BASE_URL}/training/courses/${id}`),

  listSessions: (params?: Params) => http.get(`${BASE_URL}/training/sessions`, { params }),
  createSession: (data: Payload) => http.post(`${BASE_URL}/training/sessions`, data),
  updateSession: (id: number, data: Payload) => http.put(`${BASE_URL}/training/sessions/${id}`, data),
  enrol: (sessionId: number, data: Payload) =>
    http.post(`${BASE_URL}/training/sessions/${sessionId}/enrol`, data),

  listEnrollments: (params?: Params) => http.get(`${BASE_URL}/training/enrollments`, { params }),
  recordOutcome: (id: number, data: Payload) =>
    http.post(`${BASE_URL}/training/enrollments/${id}/outcome`, data),

  listPlans: (params?: Params) => http.get(`${BASE_URL}/training/plans`, { params }),
  createPlan: (data: Payload) => http.post(`${BASE_URL}/training/plans`, data),
  updatePlan: (id: number, data: Payload) => http.put(`${BASE_URL}/training/plans/${id}`, data),
  deletePlan: (id: number) => http.delete(`${BASE_URL}/training/plans/${id}`),

  // ------------------------------------------------------------------ travel
  travelSummary: (params?: Params) => http.get(`${BASE_URL}/travel/summary`, { params }),
  listTravel: (params?: Params) => http.get(`${BASE_URL}/travel`, { params }),
  getTravel: (id: number) => http.get(`${BASE_URL}/travel/${id}`),
  createTravel: (data: Payload) => http.post(`${BASE_URL}/travel`, data),
  updateTravel: (id: number, data: Payload) => http.put(`${BASE_URL}/travel/${id}`, data),
  transitionTravel: (id: number, status: string, notes?: string) =>
    http.post(`${BASE_URL}/travel/${id}/transition`, { status, ...(notes ? { notes } : {}) }),
  addTravelExpense: (id: number, data: Payload) => http.post(`${BASE_URL}/travel/${id}/expenses`, data),
  decideTravelExpense: (expenseId: number, data: Payload) =>
    http.post(`${BASE_URL}/travel/expenses/${expenseId}/decide`, data),

  // ------------------------------------------------------------- offboarding
  offboardingSummary: () => http.get(`${BASE_URL}/offboarding/summary`),
  listOffboarding: (params?: Params) => http.get(`${BASE_URL}/offboarding`, { params }),
  getOffboarding: (id: number) => http.get(`${BASE_URL}/offboarding/${id}`),
  createOffboarding: (data: Payload) => http.post(`${BASE_URL}/offboarding`, data),
  updateOffboarding: (id: number, data: Payload) => http.put(`${BASE_URL}/offboarding/${id}`, data),
  addOffboardingTask: (id: number, data: Payload) => http.post(`${BASE_URL}/offboarding/${id}/tasks`, data),
  updateOffboardingTask: (taskId: number, data: Payload) =>
    http.post(`${BASE_URL}/offboarding/tasks/${taskId}/status`, data),
  clearOffboarding: (id: number) => http.post(`${BASE_URL}/offboarding/${id}/clear`, {}),
  settleOffboarding: (id: number, data: Payload) => http.post(`${BASE_URL}/offboarding/${id}/settle`, data),
};

export default talentApi;
