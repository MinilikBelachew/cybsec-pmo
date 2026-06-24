import { LoginPage } from "@/domains/auth";

export const metadata = {
  title: "Sign in — PMO",
  description: "Sign in to your account",
};

export default function LoginRoute() {
  return <LoginPage />;
}
