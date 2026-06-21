import { LoginForm } from "@/domains/auth/components/login-form";
import { useTranslations } from "next-intl";

export const metadata = {
  title: "Sign in — PMO",
  description: "Sign in to your account",
};

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Welcome Back</h1>
        <p className="text-sm text-white/50 font-light">
          Please authenticate with your enterprise Microsoft account.
        </p>
      </div>

      <div className="space-y-4">
        <LoginForm />
      </div>

      <p className="text-center text-xs text-white/40 leading-relaxed">
        This platform uses Single Sign-On (SSO) for authentication. <br />
        If you have trouble logging in, please contact your systems administrator.
      </p>
    </div>
  );
}
