"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  GraduationCap,
  Loader2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

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
import {
  LMS_MY_LEARNING_PATH,
  LMS_TOKENS,
  LmsSiteFooter,
  LmsSiteHeader,
  useLmsPublicBrand,
} from "@/modules/Lms/components/lms-site";
import { LmsFormShell } from "@/modules/Lms/components/lms-form-panel";

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
  const { brandSettings, brandName } = useLmsPublicBrand();

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
    <>
      <LmsSiteHeader brandSettings={brandSettings} brandName={brandName} />
      <LmsFormShell>
        <div className="w-full max-w-2xl rounded-[2rem] border border-black/5 bg-white p-8 shadow-2xl sm:p-12" style={{ boxShadow: "0 30px 60px -20px rgba(20,3,66,0.25)" }}>
          {createdEmail ? (
            <div className="grid min-h-[420px] place-items-center text-center">
              <div className="max-w-md">
                <div
                  className="mx-auto grid size-16 place-items-center rounded-full"
                  style={{ backgroundColor: `${LMS_TOKENS.green}26`, color: LMS_TOKENS.greenDark }}
                >
                  <CheckCircle2 className="size-8" aria-hidden="true" />
                </div>
                <h2 className="mt-6 text-3xl font-bold tracking-tight" style={{ color: LMS_TOKENS.navy }}>
                  Your learner account is ready
                </h2>
                <p className="mt-3 text-sm leading-7 text-[#4F547B]">
                  Sign in with <strong style={{ color: LMS_TOKENS.navy }}>{createdEmail}</strong> and the password you just
                  created. Your selected course is waiting in My Learning.
                </p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <Button
                    asChild
                    className="h-12 rounded-2xl px-8 text-[15px] font-bold transition hover:brightness-95"
                    style={{ backgroundColor: LMS_TOKENS.green, color: LMS_TOKENS.navy }}
                  >
                    <Link href={`/lms-login?redirect=${encodeURIComponent(LMS_MY_LEARNING_PATH)}`}>
                      Open sign in
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    className="h-12 rounded-2xl border-2 border-[#E4E4F0] bg-white px-8 text-[15px] font-bold text-[#4F547B] hover:bg-[#F7F8FB]"
                  >
                    <Link href="/">Back to catalog</Link>
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div>
                <span
                  className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em]"
                  style={{ backgroundColor: `${LMS_TOKENS.purple}1a`, color: LMS_TOKENS.purple }}
                >
                  <Sparkles className="size-3.5" aria-hidden="true" />
                  Create account
                </span>
                <h2 className="mt-4 text-3xl font-bold tracking-tight" style={{ color: LMS_TOKENS.navy }}>
                  Sign Up
                </h2>
                <p className="mt-2 text-sm text-[#4F547B]">
                  Already have an account?{" "}
                  <Link
                    href={`/lms-login?redirect=${encodeURIComponent(LMS_MY_LEARNING_PATH)}`}
                    className="font-semibold underline-offset-4 hover:underline"
                    style={{ color: LMS_TOKENS.purple }}
                  >
                    Log in
                  </Link>
                </p>
              </div>

              <form
                className="mt-8 space-y-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  register.mutate();
                }}
              >
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="student-name" className="text-[15px] font-semibold" style={{ color: LMS_TOKENS.navy }}>
                      Full name *
                    </Label>
                    <Input
                      id="student-name"
                      required
                      autoComplete="name"
                      value={form.name}
                      onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                      className="h-13 rounded-2xl border-[#E4E4F0] bg-white text-[15px] focus:ring-2 focus:ring-[#6440FB]/40"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="student-email" className="text-[15px] font-semibold" style={{ color: LMS_TOKENS.navy }}>
                      Email address *
                    </Label>
                    <Input
                      id="student-email"
                      required
                      type="email"
                      autoComplete="email"
                      value={form.email}
                      onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                      className="h-13 rounded-2xl border-[#E4E4F0] bg-white text-[15px] focus:ring-2 focus:ring-[#6440FB]/40"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="student-password" className="text-[15px] font-semibold" style={{ color: LMS_TOKENS.navy }}>
                      Password *
                    </Label>
                    <Input
                      id="student-password"
                      required
                      type="password"
                      minLength={8}
                      autoComplete="new-password"
                      value={form.password}
                      onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                      className="h-13 rounded-2xl border-[#E4E4F0] bg-white text-[15px] focus:ring-2 focus:ring-[#6440FB]/40"
                    />
                    <p className="text-xs text-[#9AA0C3]">Use at least 8 characters.</p>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="student-course" className="text-[15px] font-semibold" style={{ color: LMS_TOKENS.navy }}>
                      Course
                    </Label>
                    <Select
                      value={form.courseId}
                      onValueChange={(value) => setForm((current) => ({ ...current, courseId: value }))}
                      disabled={landingQuery.isLoading}
                    >
                      <SelectTrigger
                        id="student-course"
                        className={cn(
                          "min-h-13 w-full rounded-2xl border-[#E4E4F0] bg-white text-left text-[15px]",
                          landingQuery.isError && "border-amber-300"
                        )}
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
                      <p className="text-xs leading-5 text-[#9AA0C3]">
                        {selectedCourse.instructor_name} - {selectedCourse.lessons_count} lessons - {selectedCourse.rating} rating
                      </p>
                    ) : null}
                  </div>
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
                  className="h-13 w-full rounded-2xl text-[16px] font-bold transition hover:brightness-95 active:scale-[0.99]"
                  style={{ backgroundColor: LMS_TOKENS.green, color: LMS_TOKENS.navy }}
                >
                  {register.isPending ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : null}
                  Create student account
                </Button>
              </form>

              <p className="mt-6 rounded-2xl px-4 py-3 text-center text-xs leading-5 text-[#4F547B]" style={{ backgroundColor: `${LMS_TOKENS.lavender}80` }}>
                Demo students can also use <strong style={{ color: LMS_TOKENS.navy }}>student@lms-demo.localhost</strong> with{" "}
                <strong style={{ color: LMS_TOKENS.navy }}>password</strong>. After registering, sign in to{" "}
                <strong style={{ color: LMS_TOKENS.navy }}>My Learning</strong> to start your courses.
              </p>

              <div className="mt-6 grid grid-cols-3 gap-3">
                {[
                  { icon: BookOpenCheck, label: "Courses", value: landingQuery.data?.stats.published_courses ?? courses.length },
                  { icon: GraduationCap, label: "Lessons", value: landingQuery.data?.stats.lessons ?? 0 },
                  { icon: ShieldCheck, label: "Learners", value: landingQuery.data?.stats.learners ?? 0 },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-[#EDEDED] p-4 text-center" style={{ backgroundColor: "#F7F8FB" }}>
                    <item.icon className="mx-auto size-5" style={{ color: LMS_TOKENS.purple }} aria-hidden="true" />
                    <dt className="mt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#9AA0C3]">{item.label}</dt>
                    <dd className="mt-1 text-xl font-bold" style={{ color: LMS_TOKENS.navy }}>
                      {item.value}
                    </dd>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </LmsFormShell>
      <LmsSiteFooter brandSettings={brandSettings} brandName={brandName} />
    </>
  );
}
