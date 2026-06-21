import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen w-full overflow-hidden bg-[#0A0A0F] text-white">
      {/* ── BACKGROUND GRAPHICS ────────────────────────────────────────────── */}
      {/* Moving Tech Grid Background */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none animate-grid-slide"
        style={{
          backgroundImage: `
            radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px),
            linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)
          `,
          backgroundSize: "20px 20px, 40px 40px, 40px 40px",
        }}
      />

      {/* Floating Glowing Neon Spheres */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-purple-600/10 pointer-events-none animate-pulse-glow" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/10 pointer-events-none animate-pulse-glow" style={{ animationDelay: "-6s" }} />

      {/* ── LEFT SIDE: Brand Presentation & Dashboard Mock ────────────────── */}
      <div className="relative hidden w-1/2 lg:flex flex-col justify-between p-16 z-10 border-r border-white/5 bg-gradient-to-br from-white/[0.01] to-transparent">
        {/* Logo and Brand */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 items-center">
            <div className="w-2.5 h-7 bg-purple-600 -skew-x-12 rounded-full shadow-[0_0_20px_rgba(123,63,228,0.6)]" />
            <div className="w-2.5 h-7 bg-blue-500 -skew-x-12 rounded-full shadow-[0_0_20px_rgba(59,130,246,0.6)]" />
          </div>
          <span className="text-2xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/70">
            CYBSEC PMO
          </span>
        </div>

        {/* Floating Dashboard Frame */}
        <div className="my-auto relative max-w-lg mx-auto w-full aspect-square animate-float">
          <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/20 to-blue-500/20 rounded-3xl blur-2xl opacity-40" />
          <div className="relative h-full w-full rounded-3xl overflow-hidden border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] glass-panel">
            <Image
              src="/auth.jpg"
              alt="Cyber PMO Dashboard Preview"
              fill
              className="object-cover object-center"
              priority
            />
            {/* Top Bar Window Mock */}
            <div className="absolute top-0 inset-x-0 h-10 bg-black/40 backdrop-blur-md border-b border-white/5 flex items-center px-4 gap-2">
              <div className="w-3.5 h-3.5 rounded-full bg-red-500/30 border border-red-500/50" />
              <div className="w-3.5 h-3.5 rounded-full bg-yellow-500/30 border border-yellow-500/50" />
              <div className="w-3.5 h-3.5 rounded-full bg-green-500/30 border border-green-500/50" />
              <div className="ml-4 text-xs font-semibold text-white/40 tracking-wider">SECURE ENVIRONMENT</div>
            </div>
          </div>
        </div>

        {/* Footer Mission Text */}
        <div className="max-w-md">
          <h2 className="text-4xl font-extrabold leading-tight tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-br from-white to-white/60">
            Secure, Intelligent, <span className="italic font-light text-blue-400">Autonomous.</span>
          </h2>
          <p className="text-sm text-white/50 leading-relaxed font-light">
            The next-generation project management office. Enterprise security meets real-time workspace optimization, automated budget controls, and unified single sign-on.
          </p>
        </div>
      </div>

      {/* ── RIGHT SIDE: Auth Login Form Card ──────────────────────────────── */}
      <div className="relative flex w-full lg:w-1/2 flex-col items-center justify-center p-8 md:p-16 bg-[#0E0E15]/90">
        {/* Floating tech background shapes for right side */}
        <div className="absolute top-1/4 right-10 w-72 h-72 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 left-10 w-72 h-72 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 w-full max-w-md p-8 sm:p-10 rounded-3xl border border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          {children}
        </div>
      </div>
    </div>
  );
}
