"use client";

import { useRouter } from "@/i18n/routing";
import { Sparkles, ArrowLeft } from "lucide-react";
import Image from "next/image";

export default function NotFound() {
  const router = useRouter();

  const handleGoBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-between bg-[#e8eff9] p-6 text-slate-800 font-sans">
      {/* Header bar */}
      <div className="flex w-full max-w-5xl items-center justify-between py-2 z-10">
        <div className="flex items-center gap-2 font-bold text-slate-700 text-sm">
          <Sparkles className="size-5 text-indigo-500 fill-indigo-500/20" />
          <span>Cybsec</span>
        </div>
        <button
          onClick={() => router.push("/login")}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold shadow-xs hover:bg-slate-50 transition-colors cursor-pointer"
        >
          Log In
        </button>
      </div>

      {/* Main content container */}
      <div className="flex flex-col items-center justify-center space-y-6 py-6 z-10">
        {/* Main Illustration */}
        <div className="w-full max-w-xs md:max-w-sm overflow-hidden rounded-[2rem] border-4 border-white bg-white/50 shadow-lg">
          <Image
            src="/404-illustration.png"
            alt="Oops, I think we're lost"
            width={380}
            height={380}
            priority
            className="w-full h-auto object-cover"
          />
        </div>

        {/* Text */}
        <div className="space-y-1.5 text-center">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-800">
            Oops, I think we're lost
          </h1>
          <p className="text-xs md:text-sm text-slate-500 font-medium">
            Let's get you back somewhere familiar...
          </p>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <button
            onClick={handleGoBack}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <ArrowLeft className="size-4 text-slate-500" />
            Back to home
          </button>
        </div>
      </div>

      {/* Footer spacing */}
      <div className="h-12 w-full" />
    </div>
  );
}
