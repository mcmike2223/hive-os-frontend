import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create your new password",
  description:
    "Replace your temporary password to finish securing your Hive account.",
};

export default function ChangePasswordLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
