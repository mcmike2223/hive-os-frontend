import api from "@/modules/shared/api/http";
import { getBackendApiRoot, getTenantHeaders } from "@/lib/runtime-context";

const LMS_PREFIX = "/learning-management";

export type LmsCourseStatus = "draft" | "published" | "archived";
export type LmsCourseLevel = "beginner" | "intermediate" | "advanced" | "expert";
export type LmsLessonType = "article" | "video" | "live" | "assessment" | "file" | "link";
export type LmsEnrollmentStatus = "assigned" | "in_progress" | "completed" | "overdue" | "cancelled";

export type LmsUser = {
  id: number;
  name: string;
  email: string;
  avatar_path?: string | null;
};

export type LmsLesson = {
  id: string;
  course_id: string;
  title: string;
  content_type: LmsLessonType;
  content?: string | null;
  resource_url?: string | null;
  duration_minutes: number;
  sort_order: number;
  is_required: boolean;
};

export type LmsCourse = {
  id: string;
  title: string;
  code?: string | null;
  category?: string | null;
  level: LmsCourseLevel;
  status: LmsCourseStatus;
  visibility: "internal" | "assigned" | "public";
  summary?: string | null;
  description?: string | null;
  duration_minutes: number;
  passing_score: number;
  capacity?: number | null;
  published_at?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  lessons?: LmsLesson[];
  lessons_count?: number;
  enrollments_count?: number;
  completed_enrollments_count?: number;
  completion_rate?: number;
};

export type LmsLessonProgress = {
  id: string;
  enrollment_id: string;
  lesson_id: string;
  status: "not_started" | "in_progress" | "completed";
  progress_percent: number;
  score?: string | number | null;
  lesson?: LmsLesson;
};

export type LmsEnrollment = {
  id: string;
  course_id: string;
  user_id: number;
  assigned_by?: number | null;
  status: LmsEnrollmentStatus;
  progress_percent: number;
  score?: string | number | null;
  due_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  last_accessed_at?: string | null;
  notes?: string | null;
  course?: LmsCourse;
  learner?: LmsUser;
  assigned_by_user?: LmsUser;
  lesson_progress?: LmsLessonProgress[];
};

export type LmsSummary = {
  stats: {
    courses: number;
    published_courses: number;
    draft_courses: number;
    enrollments: number;
    active_enrollments: number;
    completed_enrollments: number;
    overdue_enrollments: number;
    average_progress: number;
  };
  recent_courses: LmsCourse[];
  due_soon: LmsEnrollment[];
};

export type LmsLearnerSummary = {
  user_id: number;
  enrollments_count: number;
  completed_count: number;
  active_count: number;
  average_progress: number;
  learner?: LmsUser;
};

export type LmsReports = {
  status_breakdown: Array<{ status: LmsEnrollmentStatus; value: number }>;
  category_breakdown: Array<{ category: string; value: number }>;
  top_courses: LmsCourse[];
};

export type LmsPublicCategory = {
  name: string;
  courses_count: number;
};

export type LmsPublicCourse = {
  id: string;
  title: string;
  code?: string | null;
  category?: string | null;
  level: LmsCourseLevel;
  summary?: string | null;
  description?: string | null;
  duration_minutes: number;
  lessons_count: number;
  enrollments_count: number;
  rating: string;
  image: string;
  instructor_name: string;
  badge: string;
};

export type LmsPublicInstructor = {
  name: string;
  role: string;
  image: string;
  description: string;
};

export type LmsPublicLanding = {
  stats: {
    published_courses: number;
    lessons: number;
    learners: number;
    enrollments: number;
    average_progress: number;
  };
  categories: LmsPublicCategory[];
  courses: LmsPublicCourse[];
  instructors: LmsPublicInstructor[];
};

export type LmsPublicLevel = {
  name: string;
  courses_count: number;
};

export type LmsPublicCourseList = {
  courses: LmsPublicCourse[];
  categories: LmsPublicCategory[];
  levels: LmsPublicLevel[];
  total: number;
};

export type LmsPublicLesson = {
  id: string;
  title: string;
  content_type: LmsLessonType;
  duration_minutes: number;
  sort_order: number;
  is_required: boolean;
  preview_url?: string | null;
};

export type LmsPublicCourseDetail = LmsPublicCourse & {
  instructor_role: string;
  instructor_image: string;
  instructor_bio: string;
  preview_url?: string | null;
  lessons: LmsPublicLesson[];
  related: LmsPublicCourse[];
};

export type LmsPublicCourseFilters = {
  search?: string;
  category?: string;
  level?: LmsCourseLevel;
  sort?: "newest" | "popular" | "title";
};

export type LmsStudentRegistrationPayload = {
  name: string;
  email: string;
  password: string;
  course_id?: string | null;
};

export type LmsStudentRegistrationResponse = {
  message: string;
  data: {
    user: LmsUser;
    course: LmsPublicCourse | null;
    enrollment_id: string | null;
  };
};

export type LmsCoursePayload = Partial<Pick<
  LmsCourse,
  "title" | "code" | "category" | "level" | "status" | "visibility" | "summary" | "description" | "duration_minutes" | "passing_score" | "capacity" | "starts_at" | "ends_at"
>> & {
  lessons?: Array<Partial<LmsLesson> & { title: string }>;
};

export const learningApi = {
  getSummary: () => api.get<LmsSummary>(`${LMS_PREFIX}/summary`).then((res) => res.data),
  getCourses: (params?: { search?: string; status?: LmsCourseStatus | "all"; level?: LmsCourseLevel | "all"; per_page?: number }) =>
    api.get<{ data: LmsCourse[] }>(`${LMS_PREFIX}/courses`, {
      params: {
        ...params,
        status: params?.status === "all" ? undefined : params?.status,
        level: params?.level === "all" ? undefined : params?.level,
      },
    }).then((res) => res.data),
  getCourse: (id: string) => api.get<LmsCourse>(`${LMS_PREFIX}/courses/${id}`).then((res) => res.data),
  createCourse: (data: LmsCoursePayload) => api.post<LmsCourse>(`${LMS_PREFIX}/courses`, data).then((res) => res.data),
  updateCourse: (id: string, data: LmsCoursePayload) => api.put<LmsCourse>(`${LMS_PREFIX}/courses/${id}`, data).then((res) => res.data),
  deleteCourse: (id: string) => api.delete(`${LMS_PREFIX}/courses/${id}`),
  publishCourse: (id: string) => api.post<LmsCourse>(`${LMS_PREFIX}/courses/${id}/publish`).then((res) => res.data),
  archiveCourse: (id: string) => api.post<LmsCourse>(`${LMS_PREFIX}/courses/${id}/archive`).then((res) => res.data),
  addLesson: (courseId: string, data: Partial<LmsLesson> & { title: string }) =>
    api.post<LmsLesson>(`${LMS_PREFIX}/courses/${courseId}/lessons`, data).then((res) => res.data),
  updateLesson: (courseId: string, lessonId: string, data: Partial<LmsLesson>) =>
    api.put<LmsLesson>(`${LMS_PREFIX}/courses/${courseId}/lessons/${lessonId}`, data).then((res) => res.data),
  deleteLesson: (courseId: string, lessonId: string) => api.delete(`${LMS_PREFIX}/courses/${courseId}/lessons/${lessonId}`),
  getEnrollments: (params?: { course_id?: string; status?: LmsEnrollmentStatus | "all"; search?: string; per_page?: number }) =>
    api.get<{ data: LmsEnrollment[] }>(`${LMS_PREFIX}/enrollments`, {
      params: {
        ...params,
        status: params?.status === "all" ? undefined : params?.status,
      },
    }).then((res) => res.data),
  createEnrollments: (data: { course_id: string; user_ids: number[]; due_at?: string | null; notes?: string | null }) =>
    api.post<LmsEnrollment[]>(`${LMS_PREFIX}/enrollments`, data).then((res) => res.data),
  updateEnrollment: (id: string, data: Partial<LmsEnrollment>) =>
    api.put<LmsEnrollment>(`${LMS_PREFIX}/enrollments/${id}`, data).then((res) => res.data),
  updateLessonProgress: (enrollmentId: string, lessonId: string, data: { status: "not_started" | "in_progress" | "completed"; progress_percent?: number; score?: number | null }) =>
    api.post<LmsLessonProgress>(`${LMS_PREFIX}/enrollments/${enrollmentId}/lessons/${lessonId}/progress`, data).then((res) => res.data),
  getMyLearning: () => api.get<LmsEnrollment[]>(`${LMS_PREFIX}/my-learning`).then((res) => res.data),
  getLearners: () => api.get<LmsLearnerSummary[]>(`${LMS_PREFIX}/learners`).then((res) => res.data),
  getReports: () => api.get<LmsReports>(`${LMS_PREFIX}/reports`).then((res) => res.data),
  searchUsers: (search: string) => api.get<LmsUser[]>(`${LMS_PREFIX}/users/search`, { params: { search } }).then((res) => res.data),
};

async function publicLmsFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const extraHeaders = init?.headers instanceof Headers
    ? Object.fromEntries(init.headers.entries())
    : Array.isArray(init?.headers)
      ? Object.fromEntries(init.headers)
      : init?.headers ?? {};

  const res = await fetch(`${getBackendApiRoot()}/public/lms/${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...getTenantHeaders({ allowUnsigned: true }),
      ...extraHeaders,
    },
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(json?.message || `LMS request failed (${res.status})`);
  }

  return json as T;
}

export const publicLearningApi = {
  getLanding: async () => {
    const json = await publicLmsFetch<{ data: LmsPublicLanding }>("landing");
    return json.data;
  },
  getCourses: async (filters?: LmsPublicCourseFilters) => {
    const params = new URLSearchParams();
    if (filters?.search) params.set("search", filters.search);
    if (filters?.category) params.set("category", filters.category);
    if (filters?.level) params.set("level", filters.level);
    if (filters?.sort) params.set("sort", filters.sort);

    const query = params.toString();
    const json = await publicLmsFetch<{ data: LmsPublicCourseList }>(`courses${query ? `?${query}` : ""}`);
    return json.data;
  },
  getCourse: async (id: string) => {
    const json = await publicLmsFetch<{ data: LmsPublicCourseDetail }>(`courses/${encodeURIComponent(id)}`);
    return json.data;
  },
  registerStudent: (payload: LmsStudentRegistrationPayload) =>
    publicLmsFetch<LmsStudentRegistrationResponse>("students/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
