import Link from "next/link";
import { ArrowRight, BarChart3, BookOpenCheck, Clock3 } from "lucide-react";

import { type LmsPublicCourse } from "@/modules/Lms/api";
import { LMS_TOKENS, Stars, TemplateImage } from "@/modules/Lms/components/lms-site";

const LEVEL_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  expert: "Expert",
};

function formatDuration(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) return "Self-paced";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export function CourseCard({ course }: { course: LmsPublicCourse }) {
  return (
    <Link
      href={`/courses/${course.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-[0_6px_16px_rgba(20,3,66,0.05)] transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_30px_60px_-15px_rgba(20,3,66,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6440FB] focus-visible:ring-offset-4"
    >
      <div
        className="relative m-2.5 aspect-[16/10] overflow-hidden rounded-xl"
        style={{ backgroundColor: LMS_TOKENS.lavender }}
      >
        <TemplateImage
          src={course.image}
          alt={`${course.title} course preview`}
          className="transition duration-500 group-hover:scale-105"
        />
        {course.category ? (
          <div
            className="absolute left-3 top-3 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white"
            style={{ backgroundColor: LMS_TOKENS.purple }}
          >
            {course.category}
          </div>
        ) : null}
        {course.badge ? (
          <div
            className="absolute right-3 top-3 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide"
            style={{ backgroundColor: LMS_TOKENS.green, color: LMS_TOKENS.navy }}
          >
            {course.badge}
          </div>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col px-5 pb-5 pt-3">
        <div className="flex items-center gap-2">
          <Stars rating={course.rating} />
        </div>
        <h3
          className="mt-3 line-clamp-2 text-lg font-bold leading-snug"
          style={{ color: LMS_TOKENS.navy }}
        >
          {course.title}
        </h3>
        {course.summary ? (
          <p className="mt-2 line-clamp-2 text-sm leading-6" style={{ color: LMS_TOKENS.muted }}>
            {course.summary}
          </p>
        ) : null}
        <div
          className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]"
          style={{ color: LMS_TOKENS.muted }}
        >
          <span className="inline-flex items-center gap-1.5">
            <BookOpenCheck className="size-4" style={{ color: LMS_TOKENS.purple }} aria-hidden="true" />
            {course.lessons_count} {course.lessons_count === 1 ? "lesson" : "lessons"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="size-4" style={{ color: LMS_TOKENS.purple }} aria-hidden="true" />
            {formatDuration(course.duration_minutes)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <BarChart3 className="size-4" style={{ color: LMS_TOKENS.purple }} aria-hidden="true" />
            {LEVEL_LABELS[course.level] ?? course.level}
          </span>
        </div>
        <div
          className="mt-5 flex items-center justify-between border-t pt-4"
          style={{ borderColor: LMS_TOKENS.border }}
        >
          <span className="truncate text-sm font-medium" style={{ color: LMS_TOKENS.navy }}>
            {course.instructor_name}
          </span>
          <span
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-bold transition group-hover:gap-2.5"
            style={{ color: LMS_TOKENS.purple }}
          >
            View course
            <ArrowRight className="size-4" aria-hidden="true" />
          </span>
        </div>
      </div>
    </Link>
  );
}
