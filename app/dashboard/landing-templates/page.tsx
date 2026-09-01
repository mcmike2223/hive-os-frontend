import { redirect } from "next/navigation";

export default function LegacyLandingTemplatesPage() {
  // Keep bookmarked URLs working while maintaining one source of truth.
  redirect("/dashboard/landing-library");
}
