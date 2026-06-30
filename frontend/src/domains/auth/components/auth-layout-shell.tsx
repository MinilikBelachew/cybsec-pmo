import { ReactNode } from "react";

type AuthLayoutShellProps = {
  children: ReactNode;
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

      {/* Soft Microsoft color gradient at the top (ClickUp style matching screenshot) */}
      <div 
        className="absolute top-0 inset-x-0 h-[200px] pointer-events-none opacity-[0.22] dark:opacity-[0.12]"
        style={{
          backgroundImage: 'linear-gradient(to right, #f25022, #ffb900, #7fba00, #00a4ef)',
          WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)',
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)',
        }}
      />

      {/* Center section - Auth Form Container */}
      <div className="relative flex w-full flex-col items-center justify-center p-8 md:p-16 bg-muted/20 dark:bg-[#0E0E15]/90">
        <div className="absolute top-1/4 right-10 w-72 h-72 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 left-10 w-72 h-72 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 w-full max-w-md p-8 sm:p-10 rounded-3xl border border-border/80 dark:border-white/10 bg-card/90 dark:bg-gradient-to-b dark:from-white/[0.02] dark:to-transparent backdrop-blur-2xl">
          {children}
        </div>
      </div>
    </div>
  );
}




