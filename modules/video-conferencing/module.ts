import { Video } from "lucide-react";

import { VIDEO_CONFERENCING_ROUTE_PERMISSIONS } from "@/lib/route-permissions";
import type { FrontendModuleDefinition } from "@/modules/types";

export const videoConferencingModule: FrontendModuleDefinition = {
  id: "video-conferencing",
  name: "Video Conferencing",
  description: "Encrypted meetings, scheduling, invitations, and host controls.",
  backendModule: "Modules\\Chat",
  routePrefixes: ["/dashboard/video-conferencing"],
  navItems: [
    {
      moduleId: "video-conferencing",
      translationKey: "nav.video_conferencing",
      fallbackLabel: "Video conferencing",
      href: "/dashboard/video-conferencing",
      icon: Video,
      subscriptionSlug: "video_conferencing",
      permissions: [...VIDEO_CONFERENCING_ROUTE_PERMISSIONS],
      placement: "primary",
      audience: "tenant",
    },
  ],
};
