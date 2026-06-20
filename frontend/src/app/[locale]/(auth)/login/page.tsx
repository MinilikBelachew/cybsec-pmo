import { Link } from "@/i18n/routing";
import { LoginForm } from "@/domains/auth/components/login-form";
import { APP_NAME } from "@/shared/constants";
import { CheckCircle2 } from "lucide-react";

export const metadata = {
  title: `Sign in — ${APP_NAME}`,
  description: "Sign in to your account",
};

export default function LoginPage() {
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
            The enterprise project management platform.
          </h1>
          <p className="text-muted-foreground text-lg mb-8 max-w-md">
            Streamline your workflow, manage tasks efficiently, and collaborate with your team in real-time.
          </p>
          <div className="space-y-4">
            {["Advanced RBAC permissions", "Real-time task synchronization", "Automated kanban workflows"].map((feature) => (
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
            <h2 className="text-3xl font-semibold tracking-tight">Welcome back</h2>
            <p className="text-muted-foreground">
              Enter your credentials to access your account
            </p>
          </div>

          <LoginForm />

          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-medium text-foreground hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
