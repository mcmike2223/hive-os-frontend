"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  FileText,
  Layers,
  Lock,
  PlayCircle,
  Radio,
  ShieldCheck,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { VideoPlayer } from "@/components/ui/video-player";
import { getStreamUrl } from "@/lib/runtime-context";
import { cn } from "@/lib/utils";
import {
  publicLearningApi,
  type LmsLessonType,
  type LmsPublicLesson,
} from "@/modules/Lms/api";
import { CourseCard } from "../course-card";
import {
  LMS_FONT_HREF,
  LMS_FONT_STACK,
  LMS_TOKENS,
  LmsSiteFooter,
  LmsSiteHeader,
  LOGIN_HREF,
  REGISTER_HREF,
  Stars,
  TemplateImage,
  useLmsPublicBrand,
} from "@/modules/Lms/components/lms-site";

const LEVEL_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  expert: "Expert",
};

const LESSON_ICONS: Record<LmsLessonType, typeof PlayCircle> = {
  video: PlayCircle,
  article: FileText,
  live: Radio,
  assessment: CheckCircle2,
  file: FileText,
  link: FileText,
};

function formatDuration(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) return "Self-paced";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function LessonRow({
  lesson,
  index,
  onPlay,
  isActive,
}: {
  lesson: LmsPublicLesson;
  index: number;
  onPlay?: () => void;
  isActive: boolean;
}) {
  const Icon = LESSON_ICONS[lesson.content_type] ?? FileText;
  const previewable = Boolean(lesson.preview_url);

  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-2xl border px-4 py-4 transition",
        isActive ? "shadow-[0_10px_30px_-12px_rgba(100,64,251,0.5)]" : ""
      )}
      style={{
        borderColor: isActive ? LMS_TOKENS.purple : LMS_TOKENS.border,
        backgroundColor: isActive ? "rgba(100,64,251,0.04)" : "#fff",
      }}
    >
      <span
        className="grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold"
        style={{ backgroundColor: LMS_TOKENS.lavender, color: LMS_TOKENS.purple }}
      >
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold" style={{ color: LMS_TOKENS.navy }}>
          {lesson.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]" style={{ color: LMS_TOKENS.muted }}>
          <span className="inline-flex items-center gap-1.5 capitalize">
            <Icon className="size-3.5" aria-hidden="true" />
            {lesson.content_type}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="size-3.5" aria-hidden="true" />
            {formatDuration(lesson.duration_minutes)}
          </span>
        </div>
      </div>
      {previewable ? (
        <button
          type="button"
          onClick={onPlay}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition"
          style={{ backgroundColor: LMS_TOKENS.lavender, color: LMS_TOKENS.purple }}
        >
          <PlayCircle className="size-4" aria-hidden="true" />
          Preview
        </button>
      ) : (
        <span
          className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium"
          style={{ color: LMS_TOKENS.muted }}
        >
          <Lock className="size-3.5" aria-hidden="true" />
          Locked
        </span>
      )}
    </div>
  );
}

export default function CourseDetailPage() {
  const params = useParams<{ id: string }>();
  const courseId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const { brandSettings, brandName } = useLmsPublicBrand();

  const { data: course, isLoading, isError } = useQuery({
    queryKey: ["publicLmsCourse", courseId],
    queryFn: () => publicLearningApi.getCourse(courseId as string),
    enabled: Boolean(courseId),
    retry: 1,
  });

  const previewLessons = React.useMemo(
    () => (course?.lessons ?? []).filter((lesson) => Boolean(lesson.preview_url)),
    [course]
  );
  const [activeLessonId, setActiveLessonId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setActiveLessonId(previewLessons[0]?.id ?? null);
  }, [previewLessons]);

  const activeLesson =
    previewLessons.find((lesson) => lesson.id === activeLessonId) ?? previewLessons[0] ?? null;
  const activeSrc = activeLesson?.preview_url ? getStreamUrl(activeLesson.preview_url) : null;

  const styleVars = { fontFamily: LMS_FONT_STACK } as React.CSSProperties;

  const shell = (children: React.ReactNode) => (
    <main className="min-h-screen bg-white text-[#140342] antialiased" style={styleVars}>
      { }
      <link rel="stylesheet" href={LMS_FONT_HREF} precedence="default" />
      <LmsSiteHeader brandSettings={brandSettings} brandName={brandName} />
      {children}
      <LmsSiteFooter brandSettings={brandSettings} brandName={brandName} />
    </main>
  );

  if (isLoading) {
    return shell(
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="h-8 w-40 animate-pulse rounded-full" style={{ backgroundColor: LMS_TOKENS.lightBg }} />
        <div className="mt-6 h-14 w-3/4 animate-pulse rounded-2xl" style={{ backgroundColor: LMS_TOKENS.lightBg }} />
        <div className="mt-10 aspect-video w-full animate-pulse rounded-3xl" style={{ backgroundColor: LMS_TOKENS.lightBg }} />
      </div>
    );
  }

  if (isError || !course) {
    return shell(
      <div className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold" style={{ color: LMS_TOKENS.navy }}>
          Course not found
        </h1>
        <p className="mt-4 text-base" style={{ color: LMS_TOKENS.muted }}>
          This course may be unpublished or no longer available.
        </p>
        <Button
          asChild
          className="mt-8 h-12 rounded-lg px-7 font-medium text-white"
          style={{ backgroundColor: LMS_TOKENS.purple }}
        >
          <Link href="/courses">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to courses
          </Link>
        </Button>
      </div>
    );
  }

  const included = [
    { icon: BookOpenCheck, label: `${course.lessons_count} ${course.lessons_count === 1 ? "lesson" : "lessons"}` },
    { icon: Clock3, label: formatDuration(course.duration_minutes) },
    { icon: BarChart3, label: LEVEL_LABELS[course.level] ?? course.level },
    { icon: Users, label: `${course.enrollments_count} enrolled` },
    { icon: ShieldCheck, label: "Progress tracking" },
    { icon: BadgeCheck, label: "Completion record" },
  ];

  return shell(
    <>
      {/* ===== Page header (dark) ===== */}
      <section className="relative overflow-hidden" style={{ backgroundColor: LMS_TOKENS.navy }}>
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            background:
              "radial-gradient(40rem 40rem at 90% -10%, rgba(100,64,251,0.34), transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <nav className="flex items-center gap-2 text-sm text-white/55" aria-label="Breadcrumb">
            <Link href="/" className="transition hover:text-white">Home</Link>
            <span aria-hidden="true">/</span>
            <Link href="/courses" className="transition hover:text-white">Courses</Link>
            <span aria-hidden="true">/</span>
            <span className="truncate text-white/85">{course.title}</span>
          </nav>

          <div className="mt-6 max-w-3xl">
            {course.category ? (
              <span
                className="inline-flex rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white"
                style={{ backgroundColor: LMS_TOKENS.purple }}
              >
                {course.category}
              </span>
            ) : null}
            <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
              {course.title}
            </h1>
            {course.summary ? (
              <p className="mt-4 text-lg leading-8 text-white/70">{course.summary}</p>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-white/80">
              <Stars rating={course.rating} />
              <span className="inline-flex items-center gap-2">
                <BookOpenCheck className="size-4" style={{ color: LMS_TOKENS.green }} aria-hidden="true" />
                {course.lessons_count} {course.lessons_count === 1 ? "lesson" : "lessons"}
              </span>
              <span className="inline-flex items-center gap-2">
                <Clock3 className="size-4" style={{ color: LMS_TOKENS.green }} aria-hidden="true" />
                {formatDuration(course.duration_minutes)}
              </span>
              <span className="inline-flex items-center gap-2">
                <BarChart3 className="size-4" style={{ color: LMS_TOKENS.green }} aria-hidden="true" />
                {LEVEL_LABELS[course.level] ?? course.level}
              </span>
              <span className="inline-flex items-center gap-2">
                <Users className="size-4" style={{ color: LMS_TOKENS.green }} aria-hidden="true" />
                Taught by {course.instructor_name}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Body ===== */}
      <section className="py-12 lg:py-16">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_380px] lg:px-8">
          <div>
            {/* Video player or locked poster */}
            <div className="overflow-hidden rounded-3xl">
              {activeSrc ? (
                <VideoPlayer
                  key={activeLesson?.id}
                  src={activeSrc}
                  poster={undefined}
                  title={activeLesson?.title}
                  watermark={brandName}
                  className="!rounded-3xl"
                />
              ) : (
                <div className="relative aspect-video w-full overflow-hidden rounded-3xl" style={{ backgroundColor: LMS_TOKENS.navy }}>
                  <TemplateImage src={course.image} alt={`${course.title} preview`} priority />
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#140342]/70 text-center">
                    <span
                      className="grid size-16 place-items-center rounded-full text-white"
                      style={{ backgroundColor: LMS_TOKENS.purple }}
                    >
                      <Lock className="size-7" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-lg font-bold text-white">Preview not available</p>
                      <p className="mt-1 text-sm text-white/70">Register as a student to unlock all lessons.</p>
                    </div>
                    <Button
                      asChild
                      className="h-11 rounded-lg px-6 font-medium text-white"
                      style={{ backgroundColor: LMS_TOKENS.purple }}
                    >
                      <Link href={`${REGISTER_HREF}?course_id=${encodeURIComponent(course.id)}`}>
                        Register to watch
                      </Link>
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Overview */}
            <div className="mt-12">
              <h2 className="text-2xl font-bold tracking-tight" style={{ color: LMS_TOKENS.navy }}>
                About this course
              </h2>
              <div className="mt-4 space-y-4 text-[15px] leading-8" style={{ color: LMS_TOKENS.muted }}>
                {(course.description || course.summary || "This course is part of the published learning catalog. Register to access every lesson and track your progress.")
                  .split("\n")
                  .filter(Boolean)
                  .map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
              </div>
            </div>

            {/* Curriculum */}
            <div className="mt-12">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold tracking-tight" style={{ color: LMS_TOKENS.navy }}>
                  Course content
                </h2>
                <span className="inline-flex items-center gap-2 text-sm" style={{ color: LMS_TOKENS.muted }}>
                  <Layers className="size-4" aria-hidden="true" />
                  {course.lessons.length} {course.lessons.length === 1 ? "lesson" : "lessons"}
                </span>
              </div>
              <div className="mt-5 space-y-3">
                {course.lessons.length === 0 ? (
                  <p className="rounded-2xl border p-6 text-sm" style={{ borderColor: LMS_TOKENS.border, color: LMS_TOKENS.muted }}>
                    Lessons for this course will appear here once published.
                  </p>
                ) : (
                  course.lessons.map((lesson, index) => (
                    <LessonRow
                      key={lesson.id}
                      lesson={lesson}
                      index={index}
                      isActive={Boolean(lesson.preview_url) && lesson.id === activeLesson?.id}
                      onPlay={() => {
                        setActiveLessonId(lesson.id);
                        if (typeof window !== "undefined") {
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <aside>
            <div className="lg:sticky lg:top-28">
              <div
                className="overflow-hidden rounded-3xl border shadow-[0_20px_50px_-24px_rgba(20,3,66,0.35)]"
                style={{ borderColor: LMS_TOKENS.border }}
              >
                <div className="relative aspect-[16/10]" style={{ backgroundColor: LMS_TOKENS.lavender }}>
                  <TemplateImage src={course.image} alt={`${course.title} cover`} />
                  {activeSrc ? (
                    <button
                      type="button"
                      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                      className="absolute inset-0 grid place-items-center bg-[#140342]/30 transition hover:bg-[#140342]/45"
                      aria-label="Play preview"
                    >
                      <span className="grid size-16 place-items-center rounded-full bg-white/90 text-[#6440FB] shadow-xl">
                        <PlayCircle className="size-8" aria-hidden="true" />
                      </span>
                    </button>
                  ) : null}
                </div>
                <div className="p-6">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold" style={{ color: LMS_TOKENS.navy }}>
                      Free
                    </span>
                    <span className="text-sm font-medium" style={{ color: LMS_TOKENS.muted }}>
                      to enroll
                    </span>
                  </div>
                  <Button
                    asChild
                    className="mt-5 h-13 w-full rounded-lg text-[15px] font-medium text-white shadow-lg"
                    style={{ backgroundColor: LMS_TOKENS.purple, boxShadow: "0 16px 32px rgba(100,64,251,0.3)" }}
                  >
                    <Link href={`${REGISTER_HREF}?course_id=${encodeURIComponent(course.id)}`}>
                      Enroll now
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    className="mt-3 h-13 w-full rounded-lg text-[15px] font-medium"
                    style={{ borderColor: LMS_TOKENS.border, color: LMS_TOKENS.navy }}
                  >
                    <Link href={LOGIN_HREF}>I already have an account</Link>
                  </Button>

                  <div className="mt-6 border-t pt-6" style={{ borderColor: LMS_TOKENS.border }}>
                    <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: LMS_TOKENS.navy }}>
                      This course includes
                    </p>
                    <ul className="mt-4 space-y-3">
                      {included.map((item) => (
                        <li key={item.label} className="flex items-center gap-3 text-[15px]" style={{ color: LMS_TOKENS.muted }}>
                          <item.icon className="size-4 shrink-0" style={{ color: LMS_TOKENS.purple }} aria-hidden="true" />
                          {item.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Instructor */}
              <div
                className="mt-6 rounded-3xl border p-6"
                style={{ borderColor: LMS_TOKENS.border }}
              >
                <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: LMS_TOKENS.navy }}>
                  Instructor
                </p>
                <div className="mt-4 flex items-center gap-4">
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-full" style={{ backgroundColor: LMS_TOKENS.lavender }}>
                    <TemplateImage src={course.instructor_image} alt={course.instructor_name} sizes="56px" />
                  </div>
                  <div>
                    <p className="text-base font-bold" style={{ color: LMS_TOKENS.navy }}>
                      {course.instructor_name}
                    </p>
                    <p className="text-sm" style={{ color: LMS_TOKENS.purple }}>
                      {course.instructor_role}
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-7" style={{ color: LMS_TOKENS.muted }}>
                  {course.instructor_bio}
                </p>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* ===== Related ===== */}
      {course.related.length > 0 ? (
        <section className="py-16" style={{ backgroundColor: LMS_TOKENS.lightBg }}>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: LMS_TOKENS.navy }}>
                Related courses
              </h2>
              <Link
                href="/courses"
                className="inline-flex items-center gap-2 text-[15px] font-bold transition hover:gap-3"
                style={{ color: LMS_TOKENS.purple }}
              >
                View all
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
            <div className="mt-8 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
              {course.related.map((related) => (
                <CourseCard key={related.id} course={related} />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
