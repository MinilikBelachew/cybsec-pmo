"use client";

import { useRouter, Link } from "@/i18n/routing";

export default function NotFound() {
  const router = useRouter();

  const handleGoHome = () => {
    router.push("/dashboard");
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between bg-white dark:bg-[#07070F] text-slate-900 dark:text-white transition-colors duration-300 overflow-hidden select-none font-sans">
      {/* ── Organic Corner Background Blobs ──────────────────────────────── */}
      {/* Left Blob */}
      <div className="absolute -bottom-20 -left-20 w-96 h-96 pointer-events-none z-0">
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full fill-sky-100/70 dark:fill-blue-950/30">
          <path d="M44.7,-67.6C56.6,-58.5,64.1,-43.6,70.8,-28.3C77.4,-13,83.2,2.7,80.6,17.9C78,33.1,67,47.7,53.4,57.7C39.7,67.7,23.4,73.1,6.8,71.9C-9.8,70.8,-26.6,63,-40.4,52.6C-54.2,42.2,-64.9,29.3,-69.3,14.3C-73.7,-0.7,-71.7,-17.8,-64.4,-31.7C-57.1,-45.6,-44.5,-56.3,-30.9,-64.4C-17.3,-72.5,-2.7,-78,11.3,-75.8C25.3,-73.6,32.8,-76.7,44.7,-67.6Z" transform="translate(100 100)" />
        </svg>
      </div>

      {/* Right Blob */}
      <div className="absolute -bottom-16 -right-16 w-96 h-96 pointer-events-none z-0">
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full fill-sky-100/70 dark:fill-blue-950/30">
          <path d="M42.7,-62.9C53.7,-53.8,60.1,-38.4,65.6,-22.8C71.1,-7.2,75.7,8.6,71.9,22.7C68.1,36.8,55.9,49.2,42.1,57.7C28.3,66.2,14.2,70.8,-1.2,72.4C-16.5,74,-33.1,72.6,-45.8,63.7C-58.5,54.8,-67.4,38.4,-70.8,21.5C-74.2,4.6,-72.1,-12.8,-64.7,-27.6C-57.3,-42.4,-44.6,-54.6,-30.8,-62.6C-17,-70.6,-2,-74.4,12.3,-71.5C26.6,-68.6,31.7,-72,42.7,-62.9Z" transform="translate(100 100)" />
        </svg>
      </div>

      {/* ── Header Spacer / Minimal Branding ─────────────────────────────── */}
      <header className="relative z-10 w-full p-8 flex items-center justify-between max-w-7xl mx-auto opacity-0">
        <span>Header</span>
      </header>

      {/* ── Main Center Content ──────────────────────────────────────────── */}
      <main className="relative z-10 max-w-2xl mx-auto px-6 text-center my-auto flex flex-col items-center space-y-6">
        {/* Giant 404 Text */}
        <h1 className="text-8xl sm:text-9xl md:text-[11rem] font-black tracking-tight leading-none text-[#0B2545] dark:text-blue-400">
          404
        </h1>

        {/* Description Paragraph */}
        <p className="text-xs sm:text-sm md:text-base text-slate-500 dark:text-white/60 font-medium leading-relaxed max-w-xl mx-auto">
          The workspace page or security resource you are trying to access does not exist, has been moved, or is temporarily unavailable. Let&apos;s get you back to your active project portfolio.
        </p>

        {/* Dark Navy Button */}
        <div className="pt-2">
          <button
            onClick={handleGoHome}
            className="px-8 py-3.5 rounded-xl bg-[#0B2545] hover:bg-[#134074] text-white text-xs sm:text-sm font-bold tracking-wide transition-all duration-200 active:scale-95 shadow-md"
          >
            Go Home
          </button>
        </div>
      </main>

      {/* ── Disconnected Cable Illustration (Bottom Wires & Sparks) ────────── */}
      <div className="relative z-10 w-full h-44 pointer-events-none">
        <svg
          className="w-full h-full overflow-visible"
          viewBox="0 0 1200 160"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
        >
          {/* Left Wavy Wire */}
          <path
            d="M -50 110 C 200 30, 350 150, 500 110"
            stroke="#94A3B8"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {/* Left Plug Head */}
          <g transform="translate(500, 110) rotate(-15)">
            <rect x="-14" y="-8" width="14" height="16" rx="3" fill="#64748B" />
            <rect x="0" y="-5" width="8" height="3" fill="#475569" />
            <rect x="0" y="2" width="8" height="3" fill="#475569" />
          </g>

          {/* Left Electric Sparks */}
          <g transform="translate(515, 100)">
            <path d="M0 0 L6 -6 L3 -6 L8 -12" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10 5 L14 1 L12 1 L16 -3" stroke="#60A5FA" strokeWidth="1.5" strokeLinecap="round" />
          </g>

          {/* Right Wavy Wire */}
          <path
            d="M 1250 120 C 1000 170, 850 40, 700 110"
            stroke="#94A3B8"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {/* Right Socket Head */}
          <g transform="translate(700, 110) rotate(20)">
            <rect x="0" y="-9" width="16" height="18" rx="3" fill="#64748B" />
            <rect x="-4" y="-6" width="4" height="12" rx="1" fill="#475569" />
          </g>

          {/* Right Electric Sparks */}
          <g transform="translate(680, 98)">
            <path d="M0 0 L-6 -6 L-3 -6 L-8 -12" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M-8 6 L-12 2 L-10 2 L-14 -2" stroke="#60A5FA" strokeWidth="1.5" strokeLinecap="round" />
          </g>
        </svg>
      </div>
    </div>
  );
}
