import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Online Assessment",
  description: "Complete your secure online recruitment assessment.",
}

export default function AssessmentLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children
}
