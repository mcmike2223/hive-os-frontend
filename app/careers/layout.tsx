import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Careers & Vacancies",
  description: "Explore open roles and apply to join our team.",
}

export default function CareersLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children
}
