"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  GraduationCap,
  Loader2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { publicLearningApi, type LmsPublicCourse } from "@/modules/Lms/api";

const MY_LEARNING_REDIRECT = "/dashboard/learning-management?tab=my-learning";
const SIGN_IN_HREF = `/sign-in?redirect=${encodeURIComponent(MY_LEARNING_REDIRECT)}`;
const ANY_COURSE_VALUE = "auto";

type RegisterForm = {
  name: string;
  email: string;
  password: string;
  courseId: string;
};

const formatMinutes = (minutes: number) => {
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.round(minutes / 60);
  return `${hours} ${hours === 1 ? "hour" : "hours"}`;
};

function CourseOption({ course }: { course: LmsPublicCourse }) {
  return (
    <span className="flex flex-col">
      <span className="font-semibold">{course.title}</span>
      <span className="text-xs text-muted-foreground">
        {course.category || "General"} - {formatMinutes(course.duration_minutes)} - {course.lessons_count} lessons
      </span>
    </span>
  );
}

export default function LmsStudentRegisterPage() {
  const searchParams = useSearchParams();
  const initialCourseId = searchParams.get("course_id") || ANY_COURSE_VALUE;
  const [form, setForm] = React.useState<RegisterForm>({
    name: "",
    email: "",
    password: "",
    courseId: initialCourseId,
  });
  const [createdEmail, setCreatedEmail] = React.useState<string | null>(null);

  const landingQuery = useQuery({
    queryKey: ["public-lms-landing"],
    queryFn: publicLearningApi.getLanding,
    staleTime: 60_000,
  });

  React.useEffect(() => {
    setForm((current) => ({
      ...current,
      courseId: initialCourseId,
    }));
  }, [initialCourseId]);

  const courses = landingQuery.data?.courses ?? [];
  const selectedCourse = courses.find((course) => course.id === form.courseId);

  const register = useMutation({
    mutationFn: () =>
      publicLearningApi.registerStudent({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        course_id: form.courseId === ANY_COURSE_VALUE ? null : form.courseId,
      }),
    onSuccess: (response) => {
      setCreatedEmail(response.data.user.email);
    },
  });

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full text-sm font-black text-slate-700 transition hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-4"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to LMS
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild variant="outline" className="rounded-full border-slate-300 bg-white font-bold text-slate-900">
              <Link href={SIGN_IN_HREF}>Log in</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(13,148,136,0.16),transparent_36%),radial-gradient(circle_at_82%_12%,rgba(245,158,11,0.22),transparent_28%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-20">
          <aside className="self-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-900/10 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-teal-700 shadow-sm">
              <Sparkles className="size-4" aria-hidden="true" />
              Student registration
            </div>
            <h1 className="mt-6 max-w-xl text-4xl font-black leading-tight tracking-tight text-slate-950 sm:text-5xl">
              Join the learning portal and start your course.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-8 text-slate-600">
              Create your learner account, choose a public course, then sign in to continue inside My Learning.
            </p>

            <dl className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {[
                { icon: BookOpenCheck, label: "Courses", value: landingQuery.data?.stats.published_courses ?? courses.length },
                { icon: GraduationCap, label: "Lessons", value: landingQuery.data?.stats.lessons ?? 0 },
                { icon: ShieldCheck, label: "Learners", value: landingQuery.data?.stats.learners ?? 0 },
              ].map((item) => (
                <div key={item.label} className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm">
                  <item.icon className="size-5 text-teal-700" aria-hidden="true" />
                  <dt className="mt-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500">{item.label}</dt>
                  <dd className="mt-1 text-2xl font-black text-slate-950">{item.value}</dd>
                </div>
              ))}
            </dl>
          </aside>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-900/10 sm:p-8">
            {createdEmail ? (
              <div className="grid min-h-[420px] place-items-center text-center">
                <div className="max-w-md">
                  <div className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                    <CheckCircle2 className="size-8" aria-hidden="true" />
                  </div>
                  <h2 className="mt-6 text-3xl font-black tracking-tight text-slate-950">Your learner account is ready</h2>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    Sign in with <strong>{createdEmail}</strong> and the password you just created. Your selected course is waiting in My Learning.
                  </p>
                  <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
                    <Button asChild className="rounded-full bg-teal-700 px-6 font-black text-white hover:bg-teal-800">
                      <Link href={SIGN_IN_HREF}>
                        Open sign in
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className="rounded-full border-slate-300 bg-white px-6 font-bold text-slate-900">
                      <Link href="/">Back to catalog</Link>
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-teal-700">Create account</p>
                  <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Register as a student</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Use an email and password you can remember. Demo students can also use <strong>student@lms-demo.localhost</strong> with <strong>password</strong>.
                  </p>
                </div>

                <form
                  className="mt-7 space-y-5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    register.mutate();
                  }}
                >
                  <div className="grid gap-2">
                    <Label htmlFor="student-name">Full name</Label>
                    <Input
                      id="student-name"
                      required
                      autoComplete="name"
                      value={form.name}
                      onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                      className="h-12 rounded-2xl border-slate-300 bg-white"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="student-email">Email address</Label>
                    <Input
                      id="student-email"
                      required
                      type="email"
                      autoComplete="email"
                      value={form.email}
                      onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                      className="h-12 rounded-2xl border-slate-300 bg-white"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="student-password">Password</Label>
                    <Input
                      id="student-password"
                      required
                      type="password"
                      minLength={8}
                      autoComplete="new-password"
                      value={form.password}
                      onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                      className="h-12 rounded-2xl border-slate-300 bg-white"
                    />
                    <p className="text-xs text-slate-500">Use at least 8 characters.</p>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="student-course">Course</Label>
                    <Select
                      value={form.courseId}
                      onValueChange={(value) => setForm((current) => ({ ...current, courseId: value }))}
                      disabled={landingQuery.isLoading}
                    >
                      <SelectTrigger
                        id="student-course"
                        className={cn("min-h-12 w-full rounded-2xl border-slate-300 bg-white text-left", landingQuery.isError && "border-amber-300")}
                      >
                        <SelectValue placeholder={landingQuery.isLoading ? "Loading courses..." : "Choose a course"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ANY_COURSE_VALUE}>Auto-enroll me in the first available course</SelectItem>
                        {courses.map((course) => (
                          <SelectItem key={course.id} value={course.id}>
                            <CourseOption course={course} />
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedCourse ? (
                      <p className="text-xs leading-5 text-slate-500">
                        {selectedCourse.instructor_name} - {selectedCourse.lessons_count} lessons - {selectedCourse.rating} rating
                      </p>
                    ) : null}
                  </div>

                  {register.isError ? (
                    <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                      {(register.error as Error)?.message || "Registration failed."}
                    </p>
                  ) : null}

                  {landingQuery.isError ? (
                    <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                      Course list could not be loaded. You can still register and we will enroll you in the first available course.
                    </p>
                  ) : null}

                  <Button
                    type="submit"
                    disabled={register.isPending}
                    className="h-12 w-full rounded-full bg-teal-700 text-base font-black text-white hover:bg-teal-800"
                  >
                    {register.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                    Create student account
                  </Button>
                </form>

                <p className="mt-5 text-center text-sm text-slate-600">
                  Already registered?{" "}
                  <Link href={SIGN_IN_HREF} className="font-black text-teal-700 underline-offset-4 hover:underline">
                    Sign in to My Learning
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
