import Image from "next/image";

type AuthLayoutShellProps = {
  children: React.ReactNode;
};

export function AuthLayoutShell({ children }: AuthLayoutShellProps) {
  return (
    <div className="relative flex min-h-screen w-full overflow-hidden bg-background text-foreground transition-colors duration-300">
      {/* Background grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.05] dark:opacity-[0.03] pointer-events-none animate-grid-slide"
        style={{
          backgroundImage: `
            radial-gradient(circle, currentColor 1px, transparent 1px),
            linear-gradient(to right, currentColor 1px, transparent 1px),
            linear-gradient(to bottom, currentColor 1px, transparent 1px)
          `,
          backgroundSize: "20px 20px, 40px 40px, 40px 40px",
        }}
      />

      {/* Ambient glowing blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-purple-600/10 dark:bg-purple-600/15 pointer-events-none animate-pulse-glow" />
      <div
        className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/10 dark:bg-blue-600/15 pointer-events-none animate-pulse-glow"
        style={{ animationDelay: "-6s" }}
      />

      {/* Left section - Enlarged Preview Frame with Integrated Header & Floating Text */}
      <div className="relative hidden w-1/2 lg:flex flex-col p-6 lg:p-8 z-10 border-r border-border/60 bg-muted/10 dark:bg-transparent">
        {/* Prominent Image Frame Container */}
        <div className="relative flex-1 w-full rounded-3xl overflow-hidden border border-border/80 dark:border-white/10 bg-card dark:bg-[#0b0f17]">
          {/* Light mode image */}
          <Image
            src="/auth_dashboard_light_v2.png"
            alt="Cyber PMO Dashboard Preview (Light)"
            fill
            className="object-cover object-center pointer-events-none dark:hidden"
            priority
          />

          {/* Dark mode image */}
          <Image
            src="/auth_dashboard_dark_v2.png"
            alt="Cyber PMO Dashboard Preview (Dark)"
            fill
            className="object-cover object-center pointer-events-none hidden dark:block"
            priority
          />

          {/* Top Gradient Overlay for Header Readability */}
          <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-background/90 via-background/40 to-transparent dark:from-black/90 dark:via-black/40 dark:to-transparent z-20 pointer-events-none" />

          {/* Top Floating Title inside the image */}
          <div className="absolute top-8 left-8 z-30 flex items-center gap-2">
            <div className="flex gap-1.5 items-center">
              <div className="w-2.5 h-7 bg-purple-600 -skew-x-12 rounded-full shadow-[0_0_15px_rgba(123,63,228,0.5)]" />
              <div className="w-2.5 h-7 bg-blue-500 -skew-x-12 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
            </div>
            <span className="text-2xl font-black tracking-wider text-foreground dark:text-white">
              CYBSEC PMO
            </span>
          </div>

          {/* Bottom Gradient Overlay for Text Readability */}
          <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-background/95 via-background/60 to-transparent dark:from-black/90 dark:via-black/50 dark:to-transparent z-20 pointer-events-none" />

          {/* Floating Bottom Text layer with high z-index */}
          <div className="absolute bottom-8 left-8 right-8 z-30 max-w-lg">
            <h2 className="text-3xl lg:text-4xl font-extrabold leading-tight tracking-tight mb-3 text-foreground dark:text-white">
              Secure, Intelligent, <span className="italic font-light text-blue-600 dark:text-blue-400">Autonomous.</span>
            </h2>
            <p className="text-sm text-muted-foreground dark:text-white/80 leading-relaxed font-light">
              The next-generation project management office. Enterprise security meets real-time workspace
              optimization, automated budget controls, and unified single sign-on.
            </p>
          </div>
        </div>
      </div>

      {/* Right section - Auth Form Container */}
      <div className="relative flex w-full lg:w-1/2 flex-col items-center justify-center p-8 md:p-16 bg-muted/20 dark:bg-[#0E0E15]/90">
        <div className="absolute top-1/4 right-10 w-72 h-72 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 left-10 w-72 h-72 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 w-full max-w-md p-8 sm:p-10 rounded-3xl border border-border/80 dark:border-white/10 bg-card/90 dark:bg-gradient-to-b dark:from-white/[0.02] dark:to-transparent backdrop-blur-2xl">
          {children}
        </div>
      </div>
    </div>
  );
}




