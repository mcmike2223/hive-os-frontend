"use client";

import Link from "next/link";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  Clock3,
  Filter,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  publicLearningApi,
  type LmsCourseLevel,
  type LmsPublicCourse,
} from "@/modules/Lms/api";
import {
  LMS_FONT_HREF,
  LMS_FONT_STACK,
  LMS_TOKENS,
  LmsSiteFooter,
  LmsSiteHeader,
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

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "popular", label: "Most popular" },
  { value: "title", label: "Alphabetical" },
] as const;

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

function CheckboxRow({
  label,
  count,
  checked,
  onToggle,
}: {
  label: string;
  count?: number;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-3 py-2 text-left"
    >
      <span className="flex items-center gap-3">
        <span
          className={cn(
            "grid size-5 place-items-center rounded-md border transition",
            checked ? "border-transparent text-white" : "border-[#D9DBE4] bg-white"
          )}
          style={checked ? { backgroundColor: LMS_TOKENS.purple } : undefined}
        >
          {checked ? (
            <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
              <path d="M13 4.5 6.5 11 3 7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : null}
        </span>
        <span
          className="text-[15px]"
          style={{ color: checked ? LMS_TOKENS.navy : LMS_TOKENS.muted }}
        >
          {label}
        </span>
      </span>
      {typeof count === "number" ? (
        <span className="text-sm" style={{ color: LMS_TOKENS.muted }}>
          {count}
        </span>
      ) : null}
    </button>
  );
}

export default function CoursesPage() {
  const { brandSettings, brandName } = useLmsPublicBrand();

  const [searchInput, setSearchInput] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState<string | null>(null);
  const [level, setLevel] = React.useState<LmsCourseLevel | null>(null);
  const [sort, setSort] = React.useState<(typeof SORT_OPTIONS)[number]["value"]>("newest");
  const [mobileFiltersOpen, setMobileFiltersOpen] = React.useState(false);

  // Seed filters from the URL (e.g. a category card links to /courses?category=Foo).
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const urlCategory = params.get("category");
    const urlLevel = params.get("level");
    const urlSearch = params.get("search");
    if (urlCategory) setCategory(urlCategory);
    if (urlLevel && urlLevel in LEVEL_LABELS) setLevel(urlLevel as LmsCourseLevel);
    if (urlSearch) {
      setSearchInput(urlSearch);
      setSearch(urlSearch);
    }
  }, []);

  React.useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["publicLmsCourses", { search, category, level, sort }],
    queryFn: () =>
      publicLearningApi.getCourses({
        search: search || undefined,
        category: category || undefined,
        level: level || undefined,
        sort,
      }),
    staleTime: 60000,
  });

  const courses = data?.courses ?? [];
  const categories = data?.categories ?? [];
  const levels = data?.levels ?? [];
  const hasActiveFilters = Boolean(category || level || search);

  const clearFilters = () => {
    setCategory(null);
    setLevel(null);
    setSearch("");
    setSearchInput("");
  };

  const styleVars = { fontFamily: LMS_FONT_STACK } as React.CSSProperties;

  const filterPanel = (
    <div className="space-y-8">
      <div>
        <h3
          className="text-xs font-bold uppercase tracking-[0.18em]"
          style={{ color: LMS_TOKENS.navy }}
        >
          Categories
        </h3>
        <div className="mt-3">
          <CheckboxRow label="All categories" checked={!category} onToggle={() => setCategory(null)} />
          {categories.map((item) => (
            <CheckboxRow
              key={item.name}
              label={item.name}
              count={item.courses_count}
              checked={category === item.name}
              onToggle={() => setCategory((prev) => (prev === item.name ? null : item.name))}
            />
          ))}
          {categories.length === 0 ? (
            <p className="py-2 text-sm" style={{ color: LMS_TOKENS.muted }}>
              No categories yet.
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <h3
          className="text-xs font-bold uppercase tracking-[0.18em]"
          style={{ color: LMS_TOKENS.navy }}
        >
          Level
        </h3>
        <div className="mt-3">
          <CheckboxRow label="All levels" checked={!level} onToggle={() => setLevel(null)} />
          {levels.map((item) => (
            <CheckboxRow
              key={item.name}
              label={LEVEL_LABELS[item.name] ?? item.name}
              count={item.courses_count}
              checked={level === item.name}
              onToggle={() =>
                setLevel((prev) => (prev === item.name ? null : (item.name as LmsCourseLevel)))
              }
            />
          ))}
        </div>
      </div>

      {hasActiveFilters ? (
        <button
          type="button"
          onClick={clearFilters}
          className="inline-flex items-center gap-2 text-sm font-bold"
          style={{ color: LMS_TOKENS.purple }}
        >
          <X className="size-4" aria-hidden="true" />
          Clear all filters
        </button>
      ) : null}
    </div>
  );

  return (
    <main
      className="min-h-screen bg-white text-[#140342] antialiased"
      style={styleVars}
    >
      { }
      <link rel="stylesheet" href={LMS_FONT_HREF} precedence="default" />

      <LmsSiteHeader
        brandSettings={brandSettings}
        brandName={brandName}
        announcement="Browse the full published course catalog and start learning today."
      />

      {/* Page header */}
      <section className="relative overflow-hidden" style={{ backgroundColor: LMS_TOKENS.navy }}>
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            background:
              "radial-gradient(38rem 38rem at 88% -10%, rgba(100,64,251,0.32), transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
          <nav className="flex items-center gap-2 text-sm text-white/55" aria-label="Breadcrumb">
            <Link href="/" className="transition hover:text-white">Home</Link>
            <span aria-hidden="true">/</span>
            <span className="text-white/85">Courses</span>
          </nav>
          <h1 className="mt-4 max-w-2xl text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Explore all courses
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-8 text-white/70">
            Filter the published catalog by category and level, then open any course to view its
            curriculum and start learning.
          </p>
        </div>
      </section>

      {/* Toolbar */}
      <section className="border-b" style={{ borderColor: LMS_TOKENS.border, backgroundColor: LMS_TOKENS.lightBg }}>
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div className="relative w-full md:max-w-md">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2"
              style={{ color: LMS_TOKENS.muted }}
              aria-hidden="true"
            />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search courses..."
              className="h-12 w-full rounded-full border bg-white pl-12 pr-4 text-[15px] outline-none transition focus:border-[#6440FB]"
              style={{ borderColor: LMS_TOKENS.border, color: LMS_TOKENS.navy }}
              aria-label="Search courses"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(true)}
              className="inline-flex h-12 items-center gap-2 rounded-full border bg-white px-5 text-[15px] font-medium lg:hidden"
              style={{ borderColor: LMS_TOKENS.border, color: LMS_TOKENS.navy }}
            >
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              Filters
            </button>
            <div className="flex items-center gap-2">
              <span className="hidden text-sm sm:inline" style={{ color: LMS_TOKENS.muted }}>
                Sort by
              </span>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as typeof sort)}
                className="h-12 rounded-full border bg-white px-5 text-[15px] font-medium outline-none focus:border-[#6440FB]"
                style={{ borderColor: LMS_TOKENS.border, color: LMS_TOKENS.navy }}
                aria-label="Sort courses"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="py-12 lg:py-16">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[260px_1fr] lg:px-8">
          <aside className="hidden lg:block">
            <div
              className="sticky top-28 rounded-2xl border p-6"
              style={{ borderColor: LMS_TOKENS.border }}
            >
              <div className="mb-6 flex items-center gap-2">
                <Filter className="size-4" style={{ color: LMS_TOKENS.purple }} aria-hidden="true" />
                <span className="text-sm font-bold" style={{ color: LMS_TOKENS.navy }}>
                  Filter courses
                </span>
              </div>
              {filterPanel}
            </div>
          </aside>

          <div>
            <div className="mb-6 flex items-center justify-between">
              <p className="text-sm" style={{ color: LMS_TOKENS.muted }}>
                {isLoading ? "Loading courses..." : `Showing ${courses.length} ${courses.length === 1 ? "course" : "courses"}`}
              </p>
            </div>

            {isError ? (
              <div
                className="rounded-2xl border p-10 text-center"
                style={{ borderColor: LMS_TOKENS.border }}
              >
                <p className="text-base font-bold" style={{ color: LMS_TOKENS.navy }}>
                  We couldn&apos;t load the catalog.
                </p>
                <p className="mt-2 text-sm" style={{ color: LMS_TOKENS.muted }}>
                  Please refresh the page and try again.
                </p>
              </div>
            ) : isLoading ? (
              <div className="grid gap-7 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-80 animate-pulse rounded-2xl"
                    style={{ backgroundColor: LMS_TOKENS.lightBg }}
                  />
                ))}
              </div>
            ) : courses.length === 0 ? (
              <div
                className="rounded-2xl border p-12 text-center"
                style={{ borderColor: LMS_TOKENS.border }}
              >
                <p className="text-lg font-bold" style={{ color: LMS_TOKENS.navy }}>
                  No courses match your filters.
                </p>
                <p className="mt-2 text-sm" style={{ color: LMS_TOKENS.muted }}>
                  Try clearing filters or adjusting your search.
                </p>
                {hasActiveFilters ? (
                  <Button
                    onClick={clearFilters}
                    className="mt-6 h-11 rounded-lg px-6 font-medium text-white"
                    style={{ backgroundColor: LMS_TOKENS.purple }}
                  >
                    Clear filters
                  </Button>
                ) : (
                  <Button
                    asChild
                    className="mt-6 h-11 rounded-lg px-6 font-medium text-white"
                    style={{ backgroundColor: LMS_TOKENS.purple }}
                  >
                    <Link href={REGISTER_HREF}>Register as student</Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid gap-7 sm:grid-cols-2 xl:grid-cols-3">
                {courses.map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <LmsSiteFooter brandSettings={brandSettings} brandName={brandName} />

      {/* Mobile filter drawer */}
      {mobileFiltersOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileFiltersOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 w-[86%] max-w-sm overflow-y-auto bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <span className="text-base font-bold" style={{ color: LMS_TOKENS.navy }}>
                Filter courses
              </span>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="grid size-9 place-items-center rounded-full border"
                style={{ borderColor: LMS_TOKENS.border, color: LMS_TOKENS.navy }}
                aria-label="Close filters"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            {filterPanel}
            <Button
              onClick={() => setMobileFiltersOpen(false)}
              className="mt-8 h-12 w-full rounded-lg font-medium text-white"
              style={{ backgroundColor: LMS_TOKENS.purple }}
            >
              Show {courses.length} courses
            </Button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
