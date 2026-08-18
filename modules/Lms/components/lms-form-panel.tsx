"use client";

import * as React from "react";
import {
  BookOpenCheck,
  GraduationCap,
  Medal,
  Sparkles,
  Star,
  Trophy,
} from "lucide-react";

import { LMS_TOKENS } from "./lms-site";

/* ============================================================================
 * Shared "form page" visual — the dark navy composition panel lifted from the
 * lms2 (Educrat) login/signup templates: a navy backdrop, a soft radial glow
 * and floating course-themed cards that drift with the mouse (parallax).
 * Used by both the student login and registration pages so they match the LMS
 * landing template.
 * ==========================================================================*/

const FLOATERS = [
  {
    icon: BookOpenCheck,
    label: "Course completed",
    caption: "Progress, tracked live",
    accent: LMS_TOKENS.green,
    className: "left-[6%] top-[12%] w-44",
    depth: 30,
    delay: "0s",
  },
  {
    icon: GraduationCap,
    label: "New lesson available",
    caption: "Pick up where you left off",
    accent: LMS_TOKENS.purple,
    className: "right-[7%] top-[8%] w-48",
    depth: 45,
    delay: "0.8s",
  },
  {
    icon: Star,
    label: "4.9 rated instructors",
    caption: "Learn from the best",
    accent: "#E59819",
    className: "left-[10%] bottom-[18%] w-44",
    depth: 25,
    delay: "1.6s",
  },
  {
    icon: Trophy,
    label: "Certificate earned",
    caption: "Show what you know",
    accent: LMS_TOKENS.greenDark,
    className: "right-[9%] bottom-[10%] w-48",
    depth: 55,
    delay: "2.2s",
  },
  {
    icon: Medal,
    label: "Top learner badge",
    caption: "Compete with peers",
    accent: "#00E5CC",
    className: "left-[42%] top-[6%] w-40",
    depth: 20,
    delay: "1.1s",
  },
];

const useParallax = () => {
  const ref = React.useRef<HTMLDivElement>(null);
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let frame = 0;
    const onMove = (event: MouseEvent) => {
      const rect = element.getBoundingClientRect();
      const x = (event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5;
      const y = (event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setOffset({ x, y }));
    };

    element.addEventListener("mousemove", onMove);
    return () => {
      element.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  return { ref, offset };
};

export function LmsFormPanelVisual({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle: string;
}) {
  const { ref, offset } = useParallax();

  return (
    <div
      ref={ref}
      className="relative hidden h-full min-h-[640px] overflow-hidden lg:block"
      style={{ backgroundColor: LMS_TOKENS.navy }}
    >
      {/* Radial glow */}
      <div
        className="pointer-events-none absolute -left-24 -top-24 h-[480px] w-[480px] rounded-full opacity-40 blur-3xl"
        style={{ background: `radial-gradient(circle, ${LMS_TOKENS.purple}66 0%, transparent 70%)` }}
      />
      <div
        className="pointer-events-none absolute -bottom-32 -right-20 h-[460px] w-[460px] rounded-full opacity-30 blur-3xl"
        style={{ background: `radial-gradient(circle, ${LMS_TOKENS.green}55 0%, transparent 70%)` }}
      />

      {/* Grid texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />

      {/* Floating cards */}
      {FLOATERS.map((item) => {
        const x = offset.x * item.depth;
        const y = offset.y * item.depth;
        return (
          <div
            key={item.label}
            className={`absolute ${item.className} animate-[lms-form-float_7s_ease-in-out_infinite] rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur-md`}
            style={{
              animationDelay: item.delay,
              transform: `translate(${x}px, ${y}px)`,
              transition: "transform 0.2s ease-out",
              boxShadow: "0 24px 48px -16px rgba(0,0,0,0.5)",
            }}
          >
            <div
              className="grid size-10 place-items-center rounded-xl"
              style={{ backgroundColor: `${item.accent}26`, color: item.accent }}
            >
              <item.icon className="size-5" aria-hidden="true" />
            </div>
            <p className="mt-3 text-sm font-semibold text-white">{item.label}</p>
            <p className="mt-0.5 text-xs text-white/50">{item.caption}</p>
          </div>
        );
      })}

      {/* Headline */}
      <div className="relative z-10 flex min-h-full flex-col justify-center px-14 py-16 xl:px-20">
        <span
          className="inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white"
          style={{ backgroundColor: `${LMS_TOKENS.purple}66`, border: `1px solid ${LMS_TOKENS.purple}` }}
        >
          <Sparkles className="size-3.5" aria-hidden="true" style={{ color: LMS_TOKENS.green }} />
          {eyebrow}
        </span>
        <h2 className="mt-7 max-w-md text-5xl font-bold leading-[1.1] tracking-tight text-white xl:text-[3.4rem]">
          {title}
        </h2>
        <p className="mt-6 max-w-sm text-base leading-7 text-white/70">{subtitle}</p>

        <div className="mt-10 flex items-center gap-3">
          <div className="flex -space-x-2.5">
            {["#6440FB", "#00FF84", "#E59819", "#00E5CC"].map((color) => (
              <span
                key={color}
                className="grid size-9 place-items-center rounded-full border-2 text-[10px] font-black text-white"
                style={{ backgroundColor: color, borderColor: LMS_TOKENS.navy }}
              >
                {["A", "S", "L", "M"][["#6440FB", "#00FF84", "#E59819", "#00E5CC"].indexOf(color)]}
              </span>
            ))}
          </div>
          <p className="text-sm text-white/60">
            Join thousands of learners <span className="text-white">on the platform</span>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes lms-form-float {
          0%, 100% { margin-top: 0; }
          50% { margin-top: -10px; }
        }
      `}</style>
    </div>
  );
}

export function LmsFormShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col" style={{ backgroundColor: LMS_TOKENS.beige }}>
      <div className="flex flex-1 flex-col lg:grid lg:grid-cols-[0.9fr_1.1fr]">
        <LmsFormPanelVisual
          eyebrow="Learning management"
          title={
            <>
              Learn anything, <span style={{ color: LMS_TOKENS.green }}>anytime</span>, from anywhere.
            </>
          }
          subtitle="Your courses, lessons and certificates — all in one beautiful place built for the way you learn."
        />
        <div className="relative flex flex-1 items-center justify-center px-4 py-12 sm:px-10 lg:py-16">
          {children}
        </div>
      </div>
    </main>
  );
}
