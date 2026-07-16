import React from "react";
import { useQuery } from "@tanstack/react-query";
import { projectApi } from "../api";
import { ProjectCard } from "./ProjectCard";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Empty, 
  EmptyDescription, 
  EmptyHeader, 
  EmptyMedia, 
  EmptyTitle 
} from "@/components/ui/empty";
import { Briefcase } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import type { Project } from "../types";

interface ProjectListProps {
  projects?: Project[];
  isLoading?: boolean;
  viewMode?: "grid" | "list";
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
} as const;

const item = {
  hidden: { y: 20, opacity: 0 },
  show: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 24 } },
} as const;

export const ProjectList: React.FC<ProjectListProps> = ({ 
  projects: providedProjects, 
  isLoading: providedLoading,
  viewMode = "grid" 
}) => {
  const { data, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => projectApi.getProjects(),
    enabled: !providedProjects,
  });

  const loading = providedLoading ?? isLoading;

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-[280px] w-full rounded-2xl" />
          </div>
        ))}
      </div>
    );
  }

  const projects = providedProjects ?? data?.data ?? [];

  if (projects.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Briefcase className="h-6 w-6" />
            </EmptyMedia>
            <EmptyTitle>No projects found</EmptyTitle>
            <EmptyDescription>
              Get started by creating your first project to manage tasks and collaborate with your team.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </motion.div>
    );
  }

  if (viewMode === "list") {
    return (
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-4 pb-10"
      >
        <AnimatePresence mode="popLayout">
          {projects.map((project) => (
            <motion.div key={project.id} variants={item} layout>
              <div 
                className="flex items-center gap-6 p-5 bg-card border border-border/40 rounded-[2rem] shadow-lg shadow-black/5 hover:border-primary/40 hover:shadow-primary/5 transition-all group cursor-pointer" 
                onClick={() => window.location.href = `/dashboard/project-management/projects/${project.id}`}
              >
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center font-black text-primary text-xl group-hover:scale-105 transition-transform border border-primary/20">
                  {project.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black tracking-tight truncate group-hover:text-primary transition-colors">{project.name}</h3>
                    {project.is_template && (
                      <Badge className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600 border-violet-500/20 shrink-0">
                        Template
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-medium truncate mt-0.5">{project.description ? project.description.replace(/<[^>]*>/g, '').trim() : "No description provided."}</p>
                </div>
                
                <div className="hidden md:flex flex-col items-start gap-1.5 px-4 border-l border-border/40">
                  <span className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/50">Status</span>
                  <Badge className="text-[9px] uppercase font-black px-2 py-0.5 rounded-lg bg-muted text-muted-foreground border-none">
                    {project.status.replace('_', ' ')}
                  </Badge>
                </div>

                <div className="hidden lg:flex flex-col items-start gap-1.5 w-48 px-4 border-l border-border/40">
                  <div className="flex justify-between w-full items-center">
                    <span className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/50">Progress</span>
                    <span className="text-[10px] font-black text-primary">{project.progress || 0}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${project.progress || 0}%` }} />
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1.5 px-4 border-l border-border/40">
                  <span className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/50">Deadline</span>
                  <span className="text-xs font-black tracking-tight">{project.end_date ? format(new Date(project.end_date), "MMM d, yyyy") : "No Date"}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    );
  }

  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 pb-10"
    >
      <AnimatePresence mode="popLayout">
        {projects.map((project) => (
          <motion.div key={project.id} variants={item} layout>
            <ProjectCard project={project} />
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
};
