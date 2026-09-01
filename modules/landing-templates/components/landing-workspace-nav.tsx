"use client";

import Link from "next/link";
import { Building2, Library, Workflow } from "lucide-react";

import { cn } from "@/lib/utils";

type WorkspaceSection = "library" | "business-types";

const sections = [
  {
    id: "library" as const,
    href: "/dashboard/landing-library",
    label: "Template Library",
    description: "Import, test, assign, and publish",
    icon: Library,
  },
  {
    id: "business-types" as const,
    href: "/dashboard/settings/business-types",
    label: "Business Types",
    description: "Control matching and recommendations",
    icon: Building2,
  },
];

export function LandingWorkspaceNav({ active }: { active: WorkspaceSection }) {
  return (
    <section
      aria-labelledby="landing-workspace-title"
      className="rounded-[1.5rem] border border-border/50 bg-card/50 p-3 shadow-sm"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3 px-2 py-1">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-emerald-700 dark:text-emerald-300">
            <Workflow aria-hidden="true" className="h-5 w-5" />
          </div>
          <div>
            <p
              id="landing-workspace-title"
              className="font-space text-sm font-black tracking-tight text-foreground"
            >
              Landing Pages
            </p>
            <p className="text-xs text-muted-foreground">
              One workflow from uploaded ZIP to a tenant’s live page
            </p>
          </div>
        </div>

        <nav aria-label="Landing Pages workspace">
          <ul className="grid gap-2 sm:grid-cols-2">
            {sections.map((section) => {
              const Icon = section.icon;
              const selected = active === section.id;

              return (
                <li key={section.id}>
                  <Link
                    href={section.href}
                    aria-current={selected ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-2.5 rounded-xl border px-3 py-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 dark:focus-visible:ring-emerald-300",
                      selected
                        ? "border-primary/35 bg-primary/10 text-foreground"
                        : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground",
                    )}
                  >
                    <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                    <span>
                      <span className="block text-xs font-bold">
                        {section.label}
                      </span>
                      <span className="hidden text-[10px] sm:block">
                        {section.description}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </section>
  );
}
