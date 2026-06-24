import { AuthLayoutShell } from "@/domains/auth";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthLayoutShell>{children}</AuthLayoutShell>;
}
