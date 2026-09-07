import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Teach the Assistant | Hive.OS",
  description: "Review unanswered questions and teach approved answers to the Hive assistant.",
};

export default function AssistantLearningLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
