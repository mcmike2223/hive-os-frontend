import type { Metadata } from "next";
import { HumanResourcesClient } from "../client";

export const metadata: Metadata = {
  title: "HR Forms & Letters | HIVE.OS",
};

export default function FormsPage() {
  return <HumanResourcesClient defaultTab="forms" />;
}
