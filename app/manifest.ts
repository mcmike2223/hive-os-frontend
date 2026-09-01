import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HIVE.OS",
    short_name: "HIVE.OS",
    description: "Enterprise Resource Planning Control Hub",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#10b981",
    icons: [
      { src: "/branding/hive-os-favicon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/branding/hive-os-favicon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
