import { Link } from "@/i18n/routing";
import { RegisterForm } from "@/domains/auth/components/register-form";
import { APP_NAME } from "@/shared/constants";
import { CheckCircle2 } from "lucide-react";

export const metadata = {
  title: `Create account — ${APP_NAME}`,
  description: "Create a new account",
};

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Left panel - hidden on mobile */}
      <div className="hidden lg:flex w-1/2 bg-muted/30 border-r flex-col justify-between p-12">
        <div>
          <div className="flex items-center gap-2 font-bold text-2xl mb-12">
            <div className="w-8 h-8 rounded bg-foreground flex items-center justify-center">
              <span className="text-background text-lg">{APP_NAME[0]}</span>
            </div>
            {APP_NAME}
          </div>
          <h1 className="text-4xl font-semibold tracking-tight mb-4 max-w-md">
            Join the most powerful workspace.
          </h1>
          <p className="text-muted-foreground text-lg mb-8 max-w-md">
            Sign up today and experience the difference of a truly integrated project management suite.
          </p>
          <div className="space-y-4">
            {["Get started in seconds", "Invite unlimited team members", "Bank-grade security"].map((feature) => (
              <div key={feature} className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
        </div>
      </div>

      {/* Right panel - auth form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-8">
        <div className="w-full max-w-[400px] space-y-8">
          <div className="space-y-2 text-center lg:text-left">
            <h2 className="text-3xl font-semibold tracking-tight">Create an account</h2>
            <p className="text-muted-foreground">
              Enter your details below to get started
            </p>
          </div>

          <RegisterForm />

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-foreground hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
