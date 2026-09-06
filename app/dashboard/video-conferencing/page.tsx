import type { Metadata } from "next";

import { VideoConferencingPage } from "@/modules/video-conferencing/pages/video-conferencing-page";

export const metadata: Metadata = {
  title: "Video Conferencing | Hive",
  description: "Schedule and host encrypted video meetings with your Hive team.",
};

export default function VideoConferencingRoute() {
  return <VideoConferencingPage />;
}
