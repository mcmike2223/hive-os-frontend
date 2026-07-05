import { BarChart3, BookOpen, GraduationCap, LayoutDashboard, Users } from "lucide-react";
import type { FrontendModuleDefinition } from "@/modules/types";
import {
  LEARNING_MANAGEMENT_COURSE_ROUTE_PERMISSIONS,
  LEARNING_MANAGEMENT_LEARNER_ROUTE_PERMISSIONS,
  LEARNING_MANAGEMENT_REPORT_ROUTE_PERMISSIONS,
  LEARNING_MANAGEMENT_ROUTE_PERMISSIONS,
} from "@/lib/route-permissions";

export const lmsModule: FrontendModuleDefinition = {
  id: "lms",
  name: "Learning Management",
  description: "Course, lesson, enrollment, learner progress, and training analytics workspace.",
  backendModule: "Modules\\LearningManagement",
  routePrefixes: [
    "/dashboard/learning-management",
  ],
  navItems: [
    {
      moduleId: "lms",
      translationKey: "nav.learning_management",
      fallbackLabel: "Learning Dashboard",
      href: "/dashboard/learning-management",
      icon: LayoutDashboard,
      subscriptionSlug: "learning_management",
      permissions: [...LEARNING_MANAGEMENT_ROUTE_PERMISSIONS],
      placement: "primary",
    },
    {
      moduleId: "lms",
      translationKey: "nav.lms_courses",
      fallbackLabel: "Courses",
      href: "/dashboard/learning-management/courses",
      icon: BookOpen,
      subscriptionSlug: "learning_management",
      permissions: [...LEARNING_MANAGEMENT_COURSE_ROUTE_PERMISSIONS],
      placement: "primary",
    },
    {
      moduleId: "lms",
      translationKey: "nav.lms_learners",
      fallbackLabel: "Learners",
      href: "/dashboard/learning-management/learners",
      icon: Users,
      subscriptionSlug: "learning_management",
      permissions: [...LEARNING_MANAGEMENT_LEARNER_ROUTE_PERMISSIONS],
      placement: "secondary",
    },
    {
      moduleId: "lms",
      translationKey: "nav.lms_reports",
      fallbackLabel: "Learning Reports",
      href: "/dashboard/learning-management/reports",
      icon: BarChart3,
      subscriptionSlug: "learning_management",
      permissions: [...LEARNING_MANAGEMENT_REPORT_ROUTE_PERMISSIONS],
      placement: "secondary",
    },
    {
      moduleId: "lms",
      translationKey: "nav.my_learning",
      fallbackLabel: "My Learning",
      href: "/dashboard/learning-management?tab=my-learning",
      icon: GraduationCap,
      subscriptionSlug: "learning_management",
      permissions: ["view_my_learning", "view_learning_management", "manage_learning_management"],
      placement: "secondary",
    },
  ],
};
