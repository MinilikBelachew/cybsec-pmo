import Link from "next/link";
import { APP_NAME } from "@/shared/constants";

export const metadata = { title: `Not found — ${APP_NAME}` };

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
      <p className="text-5xl font-bold">404</p>
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="text-sm text-muted">The page you are looking for does not exist.</p>
      <Link href="/dashboard" className="mt-2 text-sm underline underline-offset-4">
        Back to dashboard
      </Link>
    </div>
  );
}
