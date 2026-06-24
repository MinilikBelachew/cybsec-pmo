import Image from "next/image";
import Link from "next/link";
import {
  Shield,
  FolderKanban,
  CheckSquare,
  Lock,
  ArrowRight,
  TrendingUp,
  Activity,
  Layers,
  Sparkles,
  Zap,
  Star,
  Globe,
  Settings,
  ShieldAlert,
  ArrowUpRight,
  Cpu,
  UserCheck,
  CheckCircle,
  HelpCircle,
} from "lucide-react";

type LandingPageProps = {
  locale: string;
};

export function LandingPage({ locale }: LandingPageProps) {

  return (
    <div className="relative min-h-screen bg-slate-50 dark:bg-[#07070F] text-slate-900 dark:text-white overflow-x-hidden transition-colors duration-300">
      {/* ── GRADIENT OVERLAYS (Framer Style Glows) ────────────────────────── */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-purple-500/10 dark:bg-purple-600/15 pointer-events-none blur-[120px] -translate-y-1/2" />
      <div className="absolute top-[45%] right-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-500/10 dark:bg-blue-600/10 pointer-events-none blur-[120px]" />

      {/* ── TOP NAVIGATION ────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 dark:border-white/[0.05] bg-white/70 dark:bg-[#07070F]/70 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5 items-center">
              <div className="w-2.5 h-6 bg-purple-600 -skew-x-12 rounded-full shadow-[0_0_15px_rgba(123,63,228,0.5)]" />
              <div className="w-2.5 h-6 bg-blue-500 -skew-x-12 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
            </div>
            <span className="text-xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-slate-950 to-slate-700 dark:from-white dark:to-white/80">
              CYBSEC PMO
            </span>
          </div>

          {/* Centered Navigation Menu */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600 dark:text-white/75">
            <Link href="/" className="hover:text-slate-900 dark:hover:text-white transition">Home</Link>
            <Link href={`/${locale}/dashboard`} className="hover:text-slate-900 dark:hover:text-white transition">Dashboard</Link>
            <Link href={`/${locale}/dashboard/settings`} className="hover:text-slate-900 dark:hover:text-white transition">Directory</Link>
            <Link href="#features" className="hover:text-slate-900 dark:hover:text-white transition">Features</Link>
          </nav>

          {/* CTA Button */}
          <Link
            href={`/${locale}/dashboard`}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl bg-purple-600 hover:bg-purple-500 text-white transition active:scale-[0.98]"
          >
            Get started
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      </header>

      {/* ── HERO SECTION ──────────────────────────────────────────────────── */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-20 lg:pt-28 pb-24 grid lg:grid-cols-12 gap-16 items-center">
        {/* Left: Headings and CTA */}
        <div className="lg:col-span-6 space-y-8 text-center lg:text-left">
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.05] text-slate-950 dark:text-white">
            Build Safer <br />
            with <span className="text-purple-600 dark:text-[#A78BFA]">Intelligent PMO</span>
          </h1>

          <p className="text-lg text-slate-600 dark:text-white/60 leading-relaxed font-light max-w-xl mx-auto lg:mx-0">
            Create, automate, and monitor your enterprise project portfolios with a modern SSO-powered security management platform.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
            <Link
              href={`/${locale}/dashboard`}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-8 py-4 text-sm font-bold rounded-xl bg-purple-600 hover:bg-purple-500 text-white transition active:scale-[0.98]"
            >
              Get started
              <ArrowUpRight className="size-4" />
            </Link>
            <Link
              href={`/${locale}/dashboard/settings`}
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 text-sm font-bold rounded-xl border border-slate-300 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-white/80 transition"
            >
              Join Directory
            </Link>
          </div>
        </div>

        {/* Right: Technical Flowchart Visual */}
        <div className="lg:col-span-6 relative w-full aspect-square max-w-lg mx-auto rounded-3xl overflow-hidden border border-slate-200 dark:border-white/10 bg-white/40 dark:bg-zinc-950/40 backdrop-blur-md p-2">
          <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/10 to-blue-500/10 opacity-30 rounded-3xl" />
          <div className="relative h-full w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-white/5">
            <Image
              src="/auth.jpg"
              alt="CYBSEC PMO Console"
              fill
              className="object-cover object-top hover:scale-[1.01] transition-transform duration-700"
              priority
            />
          </div>
        </div>
      </section>

      {/* ── HORIZONTALLY SCROLLING LOGO CAROUSEL ──────────────────────────── */}
      <section className="relative z-10 w-full py-12 border-y border-slate-200/80 dark:border-white/[0.05] bg-white/30 dark:bg-black/10 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 mb-8 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">
            Enterprise Integrations & Infrastructure Partners
          </p>
        </div>
        
        <div className="relative w-full overflow-hidden flex items-center justify-center">
          {/* Fading side overlays */}
          <div className="absolute inset-y-0 left-0 w-24 sm:w-48 bg-gradient-to-r from-slate-50 dark:from-[#07070F] to-transparent z-10 pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-24 sm:w-48 bg-gradient-to-l from-slate-50 dark:from-[#07070F] to-transparent z-10 pointer-events-none" />

          {/* Scrolling ticker track */}
          <div className="animate-marquee flex gap-16 items-center shrink-0">
            {/* Set 1 */}
            <div className="flex gap-16 items-center shrink-0">
              {/* Microsoft */}
              <div className="flex items-center gap-2 opacity-50 dark:opacity-40 hover:opacity-100 dark:hover:opacity-100 transition-opacity">
                <div className="grid grid-cols-2 gap-0.5 w-5 h-5">
                  <div className="bg-[#F25022] w-2 h-2" />
                  <div className="bg-[#7FBA00] w-2 h-2" />
                  <div className="bg-[#00A4EF] w-2 h-2" />
                  <div className="bg-[#FFB900] w-2 h-2" />
                </div>
                <span className="font-semibold text-sm tracking-tight">Microsoft</span>
              </div>

              {/* Microsoft Teams */}
              <div className="flex items-center gap-2 opacity-50 dark:opacity-40 hover:opacity-100 dark:hover:opacity-100 transition-opacity">
                <svg className="w-5 h-5 text-[#464EB8]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14.5h-2v-2h2v2zm0-3.5h-2V7h2v6z"/>
                </svg>
                <span className="font-semibold text-sm tracking-tight">Teams</span>
              </div>

              {/* Zoho */}
              <div className="flex items-center gap-2 opacity-50 dark:opacity-40 hover:opacity-100 dark:hover:opacity-100 transition-opacity">
                <div className="flex gap-0.5">
                  <div className="w-2.5 h-2.5 bg-[#E21A22] rounded-sm" />
                  <div className="w-2.5 h-2.5 bg-[#009245] rounded-sm" />
                  <div className="w-2.5 h-2.5 bg-[#0071BC] rounded-sm" />
                  <div className="w-2.5 h-2.5 bg-[#F9A01B] rounded-sm" />
                </div>
                <span className="font-semibold text-sm tracking-tight text-slate-800 dark:text-white">ZOHO</span>
              </div>

              {/* Microsoft Outlook */}
              <div className="flex items-center gap-2 opacity-50 dark:opacity-40 hover:opacity-100 dark:hover:opacity-100 transition-opacity">
                <svg className="w-5 h-5 text-[#0078D4]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                </svg>
                <span className="font-semibold text-sm tracking-tight">Outlook</span>
              </div>

              {/* Keka */}
              <div className="flex items-center gap-2 opacity-50 dark:opacity-40 hover:opacity-100 dark:hover:opacity-100 transition-opacity">
                <div className="w-5 h-5 bg-teal-500 rounded-lg flex items-center justify-center text-white text-[10px] font-black">K</div>
                <span className="font-semibold text-sm tracking-tight">keka</span>
              </div>
            </div>

            {/* Set 2 (Duplicate for infinite seamless loop) */}
            <div className="flex gap-16 items-center shrink-0">
              {/* Microsoft */}
              <div className="flex items-center gap-2 opacity-50 dark:opacity-40 hover:opacity-100 dark:hover:opacity-100 transition-opacity">
                <div className="grid grid-cols-2 gap-0.5 w-5 h-5">
                  <div className="bg-[#F25022] w-2 h-2" />
                  <div className="bg-[#7FBA00] w-2 h-2" />
                  <div className="bg-[#00A4EF] w-2 h-2" />
                  <div className="bg-[#FFB900] w-2 h-2" />
                </div>
                <span className="font-semibold text-sm tracking-tight">Microsoft</span>
              </div>

              {/* Microsoft Teams */}
              <div className="flex items-center gap-2 opacity-50 dark:opacity-40 hover:opacity-100 dark:hover:opacity-100 transition-opacity">
                <svg className="w-5 h-5 text-[#464EB8]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14.5h-2v-2h2v2zm0-3.5h-2V7h2v6z"/>
                </svg>
                <span className="font-semibold text-sm tracking-tight">Teams</span>
              </div>

              {/* Zoho */}
              <div className="flex items-center gap-2 opacity-50 dark:opacity-40 hover:opacity-100 dark:hover:opacity-100 transition-opacity">
                <div className="flex gap-0.5">
                  <div className="w-2.5 h-2.5 bg-[#E21A22] rounded-sm" />
                  <div className="w-2.5 h-2.5 bg-[#009245] rounded-sm" />
                  <div className="w-2.5 h-2.5 bg-[#0071BC] rounded-sm" />
                  <div className="w-2.5 h-2.5 bg-[#F9A01B] rounded-sm" />
                </div>
                <span className="font-semibold text-sm tracking-tight text-slate-800 dark:text-white">ZOHO</span>
              </div>

              {/* Microsoft Outlook */}
              <div className="flex items-center gap-2 opacity-50 dark:opacity-40 hover:opacity-100 dark:hover:opacity-100 transition-opacity">
                <svg className="w-5 h-5 text-[#0078D4]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                </svg>
                <span className="font-semibold text-sm tracking-tight">Outlook</span>
              </div>

              {/* Keka */}
              <div className="flex items-center gap-2 opacity-50 dark:opacity-40 hover:opacity-100 dark:hover:opacity-100 transition-opacity">
                <div className="w-5 h-5 bg-teal-500 rounded-lg flex items-center justify-center text-white text-[10px] font-black">K</div>
                <span className="font-semibold text-sm tracking-tight">keka</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES GRID (Clean solid styling, no heavy shadows) ────────────────── */}
      <section id="features" className="relative z-10 max-w-7xl mx-auto px-6 py-24 border-t border-slate-200 dark:border-white/[0.05]">
        <div className="text-center space-y-4 mb-20">
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-950 dark:text-white">
            Everything in one place
          </h2>
          <p className="text-slate-600 dark:text-white/40 max-w-lg mx-auto text-base">
            Four powerful pillars that make managing portfolios faster, smarter, and safer.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Card 1 */}
          <div className="p-8 rounded-3xl border border-slate-200/80 dark:border-white/5 bg-slate-100/50 dark:bg-[#0E0E1B]/50 hover:border-purple-500/30 transition flex flex-col justify-between min-h-[260px] group">
            <div>
              <div className="size-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-6">
                <Sparkles className="size-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white">AI-Powered Insights</h3>
              <p className="text-sm text-slate-600 dark:text-white/60 leading-relaxed font-light">
                Automate complex project statuses with intelligent variance alerts that learn from your project milestones.
              </p>
            </div>
          </div>

          {/* Card 2 */}
          <div className="p-8 rounded-3xl border border-slate-200/80 dark:border-white/5 bg-slate-100/50 dark:bg-[#0E0E1B]/50 hover:border-purple-500/30 transition flex flex-col justify-between min-h-[260px] group">
            <div>
              <div className="size-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-6">
                <Layers className="size-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white">SSO User Directory</h3>
              <p className="text-sm text-slate-600 dark:text-white/60 leading-relaxed font-light">
                Add new enterprise engineers, PMs, and clients in seconds. Synchronize directly with Microsoft Active Directory.
              </p>
            </div>
          </div>

          {/* Card 3 */}
          <div className="p-8 rounded-3xl border border-slate-200/80 dark:border-white/5 bg-slate-100/50 dark:bg-[#0E0E1B]/50 hover:border-purple-500/30 transition flex flex-col justify-between min-h-[260px] group">
            <div>
              <div className="size-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-6">
                <Zap className="size-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white">Fast Performance</h3>
              <p className="text-sm text-slate-600 dark:text-white/60 leading-relaxed font-light">
                Optimized database calls compile dashboard updates in under 50ms, rendering real-time task updates instantly.
              </p>
            </div>
          </div>

          {/* Card 4 */}
          <div className="p-8 rounded-3xl border border-slate-200/80 dark:border-white/5 bg-slate-100/50 dark:bg-[#0E0E1B]/50 hover:border-purple-500/30 transition flex flex-col justify-between min-h-[260px] group">
            <div>
              <div className="size-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-6">
                <Shield className="size-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white">Secure Platform</h3>
              <p className="text-sm text-slate-600 dark:text-white/60 leading-relaxed font-light">
                Multi-tenant workspace isolation with automatic role check middleware to lock down restricted sections.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── ROADMAP GANTT SHOWCASE SECTION ────────────────────────────────── */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-24 border-t border-slate-200 dark:border-white/[0.05]">
        <div className="grid lg:grid-cols-12 gap-16 items-center">
          {/* Left Side: Text Details */}
          <div className="lg:col-span-5 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-purple-500/20 bg-purple-500/10 text-xs font-bold text-purple-600 dark:text-purple-400">
              <FolderKanban className="size-3.5" />
              PORTFOLIO TIMELINES
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-950 dark:text-white">
              Manage Deliverables via Visual Gantt Charts
            </h2>
            <p className="text-slate-600 dark:text-white/60 leading-relaxed font-light">
              Interactive project timelines allow project managers to track task dependencies, assign resources, and check off milestones dynamically in a gorgeous unified gantt console.
            </p>
            <ul className="space-y-3.5 text-sm font-semibold text-slate-700 dark:text-white/80">
              <li className="flex items-center gap-2.5">
                <CheckCircle className="size-4 text-emerald-500" />
                Real-time Gantt tracking & resource allocation
              </li>
              <li className="flex items-center gap-2.5">
                <CheckCircle className="size-4 text-emerald-500" />
                Track dependency paths & delay highlights
              </li>
              <li className="flex items-center gap-2.5">
                <CheckCircle className="size-4 text-emerald-500" />
                Customizable milestone alerts for active tasks
              </li>
            </ul>
          </div>

          {/* Right Side: Generated Gantt Image Showcase */}
          <div className="lg:col-span-7 relative w-full aspect-video rounded-3xl overflow-hidden border border-slate-200 dark:border-white/10 bg-white/40 dark:bg-zinc-950/40 p-2">
            <div className="relative h-full w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-white/5">
              <Image
                src="/gantt.png"
                alt="Gantt Timeline Chart Preview"
                fill
                className="object-cover"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── KANBAN BOARD / ACTIVE WORKFLOWS SECTION ───────────────────────── */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-24 border-t border-slate-200 dark:border-white/[0.05]">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
            Unified Task Execution Board
          </h2>
          <p className="text-slate-600 dark:text-white/40 max-w-md mx-auto text-sm">
            Interactive task management gives all team leads and engineers absolute clarity on active tasks.
          </p>
        </div>

        {/* Mock Kanban Board */}
        <div className="grid sm:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {/* Column 1: To Do */}
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-white/5 bg-slate-100/50 dark:bg-[#0E0E1B]/30 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-white/5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">To Do</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-200 dark:bg-white/5 text-slate-500">2</span>
            </div>
            {/* Task Card */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-zinc-900/50 space-y-2">
              <div className="text-xs font-bold">Draft System Architecture Blueprint</div>
              <p className="text-[11px] text-slate-500 dark:text-white/40 font-light">Draft security specs and database schema layout.</p>
              <div className="flex justify-between items-center pt-2">
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">High</span>
                <span className="text-[9px] font-semibold text-slate-400">June 24</span>
              </div>
            </div>
            {/* Task Card */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-zinc-900/50 space-y-2">
              <div className="text-xs font-bold">Prepare PMO Launch Assets</div>
              <p className="text-[11px] text-slate-500 dark:text-white/40 font-light">Assemble user handbooks and landing resources.</p>
              <div className="flex justify-between items-center pt-2">
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-500 border border-slate-500/20">Medium</span>
                <span className="text-[9px] font-semibold text-slate-400">July 01</span>
              </div>
            </div>
          </div>

          {/* Column 2: In Progress */}
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-white/5 bg-slate-100/50 dark:bg-[#0E0E1B]/30 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-white/5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">In Progress</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-200 dark:bg-white/5 text-slate-500">1</span>
            </div>
            {/* Task Card */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-zinc-900/50 space-y-2">
              <div className="text-xs font-bold">Setup SSO Authentication Router</div>
              <p className="text-[11px] text-slate-500 dark:text-white/40 font-light">Configure Microsoft Entra client endpoints and scopes.</p>
              <div className="flex justify-between items-center pt-2">
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">Active</span>
                <span className="text-[9px] font-semibold text-slate-400">June 21</span>
              </div>
            </div>
          </div>

          {/* Column 3: Done */}
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-white/5 bg-slate-100/50 dark:bg-[#0E0E1B]/30 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-white/5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Completed</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-200 dark:bg-white/5 text-slate-500">1</span>
            </div>
            {/* Task Card */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-zinc-900/50 space-y-2">
              <div className="text-xs font-bold">Configure JIT Provisioning Service</div>
              <p className="text-[11px] text-slate-500 dark:text-white/40 font-light">Verify database upserts on first-time social sign-in.</p>
              <div className="flex justify-between items-center pt-2">
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">Verified</span>
                <span className="text-[9px] font-semibold text-slate-400">June 20</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FLOWCHART CONNECTOR SECTION (Framer Style Node Connections) ──── */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-20 border-t border-slate-200 dark:border-white/[0.05]">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Built for Secure Workspace Collaboration
          </h2>
          <p className="text-slate-500 dark:text-white/40 max-w-md mx-auto text-sm">
            Automatic JIT directory synchronization maps external Microsoft SSO identities directly into project permission scopes.
          </p>
        </div>

        {/* Central Gateway Flowchart */}
        <div className="relative max-w-4xl mx-auto h-[450px] rounded-3xl border border-slate-200 dark:border-white/5 bg-white/30 dark:bg-zinc-950/20 backdrop-blur-md overflow-hidden flex items-center justify-center p-8">
          <div className="absolute inset-0 bg-gradient-to-b from-purple-500/5 to-transparent pointer-events-none" />
          
          {/* Connector SVG Grid Overlay */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="purpleGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Horizontal connection lines */}
            <path d="M 150 225 L 300 225 M 540 225 L 690 225" stroke="url(#purpleGlow)" strokeWidth="2" strokeDasharray="6,4" />
            {/* Vertical connection lines */}
            <path d="M 420 120 L 420 170 M 420 280 L 420 330" stroke="url(#purpleGlow)" strokeWidth="2" strokeDasharray="6,4" />
          </svg>

          {/* Node 1: Left Node (Microsoft Azure SSO Endpoint) */}
          <div className="absolute left-[8%] sm:left-[15%] w-48 p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900/60 text-center space-y-2 z-10 transition hover:scale-105">
            <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Identity Provider</span>
            <div className="text-xs font-bold truncate">microsoft.onmicrosoft.com</div>
            <div className="w-full bg-blue-500/10 text-blue-500 py-1 rounded text-[10px] border border-blue-500/20">Authenticated</div>
          </div>

          {/* Node 2: Central Gateway Node (SSO Proxy Gateway) */}
          <div className="w-60 p-6 rounded-2xl border border-purple-500/40 bg-slate-900 text-white text-center space-y-4 z-10 transition hover:scale-105">
            <div className="size-10 rounded-xl bg-purple-500/20 flex items-center justify-center mx-auto border border-purple-500/40">
              <Cpu className="size-5 text-purple-400 animate-pulse" />
            </div>
            <div>
              <div className="text-sm font-bold">JIT Gateway Proxy</div>
              <div className="text-[10px] text-purple-400">Verifying session tokens...</div>
            </div>
          </div>

          {/* Node 3: Right Node (User Database Sync) */}
          <div className="absolute right-[8%] sm:right-[15%] w-48 p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900/60 text-center space-y-2 z-10 transition hover:scale-105">
            <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest">Database Sync</span>
            <div className="text-xs font-bold truncate">Prisma Client Seeding</div>
            <div className="w-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 py-1 rounded text-[10px] border border-emerald-500/20">Registered User</div>
          </div>

          {/* Node 4: Top Floating Node */}
          <div className="absolute top-[8%] w-44 p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900/40 text-center text-[10px] font-bold z-10 transition hover:scale-105">
            🔒 Token Verified
          </div>

          {/* Node 5: Bottom Floating Node */}
          <div className="absolute bottom-[8%] w-44 p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900/40 text-center text-[10px] font-bold z-10 transition hover:scale-105">
            👤 Role Assigned
          </div>
        </div>
      </section>

      {/* ── FAQ SECTION ───────────────────────────────────────────────────── */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-24 border-t border-slate-200 dark:border-white/[0.05]">
        <div className="text-center space-y-4 mb-20">
          <h2 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
            Frequently Asked Questions
          </h2>
          <p className="text-slate-600 dark:text-white/40 max-w-md mx-auto text-sm">
            Everything you need to know about CYBSEC PMO platform security and setup.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto text-left">
          {/* FAQ 1 */}
          <div className="space-y-2 p-5 rounded-2xl border border-slate-200 dark:border-white/5 bg-slate-100/50 dark:bg-[#0E0E1B]/30">
            <div className="flex gap-2.5 items-center font-bold text-slate-900 dark:text-white text-sm">
              <HelpCircle className="size-4 text-purple-600 dark:text-purple-400 shrink-0" />
              <h4>How does Just-in-Time (JIT) provisioning work?</h4>
            </div>
            <p className="text-xs text-slate-600 dark:text-white/60 leading-relaxed font-light">
              When a user signs in through your Microsoft enterprise tenant, our backend checks if they exist in the PMO database. If not, it automatically registers them with default scopes without needing manual administrator seeding.
            </p>
          </div>

          {/* FAQ 2 */}
          <div className="space-y-2 p-5 rounded-2xl border border-slate-200 dark:border-white/5 bg-slate-100/50 dark:bg-[#0E0E1B]/30">
            <div className="flex gap-2.5 items-center font-bold text-slate-900 dark:text-white text-sm">
              <HelpCircle className="size-4 text-purple-600 dark:text-purple-400 shrink-0" />
              <h4>Can we edit a user's system roles?</h4>
            </div>
            <p className="text-xs text-slate-600 dark:text-white/60 leading-relaxed font-light">
              Yes, Super Admins can access the Directory panel under settings to assign customized system roles (Super Admin, PM, PMO Lead, Team Lead, Client) to users directly.
            </p>
          </div>

          {/* FAQ 3 */}
          <div className="space-y-2 p-5 rounded-2xl border border-slate-200 dark:border-white/5 bg-slate-100/50 dark:bg-[#0E0E1B]/30">
            <div className="flex gap-2.5 items-center font-bold text-slate-900 dark:text-white text-sm">
              <HelpCircle className="size-4 text-purple-600 dark:text-purple-400 shrink-0" />
              <h4>Is the platform optimized for mobile access?</h4>
            </div>
            <p className="text-xs text-slate-600 dark:text-white/60 leading-relaxed font-light">
              Yes, the dashboard uses a fully responsive layouts structure, enabling Project Managers and Clients to track timelines and view budgets seamlessly on phones, tablets, or desktops.
            </p>
          </div>

          {/* FAQ 4 */}
          <div className="space-y-2 p-5 rounded-2xl border border-slate-200 dark:border-white/5 bg-slate-100/50 dark:bg-[#0E0E1B]/30">
            <div className="flex gap-2.5 items-center font-bold text-slate-900 dark:text-white text-sm">
              <HelpCircle className="size-4 text-purple-600 dark:text-purple-400 shrink-0" />
              <h4>What identity providers are supported?</h4>
            </div>
            <p className="text-xs text-slate-600 dark:text-white/60 leading-relaxed font-light">
              We natively support Microsoft Entra ID (formerly Azure Active Directory) including support for multi-factor authentication (MFA) and custom conditional access policies.
            </p>
          </div>
        </div>
      </section>

      {/* ── CALL TO ACTION SECTION ────────────────────────────────────────── */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-20">
        <div className="relative rounded-3xl overflow-hidden border border-slate-200 dark:border-white/15 bg-white dark:bg-[#0E0E1A] p-12 sm:p-20 text-center space-y-8 shadow-sm">
          {/* Intense gradient glow in CTA */}
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-indigo-500/5 dark:from-purple-900/20 dark:to-blue-900/20 pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-purple-500/10 dark:bg-purple-600/10 rounded-full blur-3xl pointer-events-none animate-pulse-glow" />

          {/* Original logo badge in CTA */}
          <div className="flex gap-1.5 items-center justify-center relative z-10">
            <div className="w-2.5 h-6 bg-purple-600 -skew-x-12 rounded-full shadow-[0_0_15px_rgba(123,63,228,0.5)]" />
            <div className="w-2.5 h-6 bg-blue-500 -skew-x-12 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
          </div>

          <div className="relative z-10 space-y-4 max-w-2xl mx-auto">
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-950 dark:text-white leading-tight">
              Start building the future today.
            </h2>
          </div>

          <div className="relative z-10 flex justify-center">
            <Link
              href={`/${locale}/dashboard`}
              className="inline-flex items-center gap-1.5 px-8 py-4 text-sm font-bold rounded-xl bg-purple-600 hover:bg-purple-500 text-white transition active:scale-[0.98] shadow-lg shadow-purple-600/25"
            >
              Get Started
              <ArrowUpRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer className="relative z-10 w-full bg-slate-100 dark:bg-[#06060C] border-t border-slate-200 dark:border-white/[0.05] transition-colors py-16">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-12 gap-12 items-start">
          {/* Brand Info */}
          <div className="md:col-span-5 space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5 items-center">
                <div className="w-2.5 h-6 bg-purple-600 -skew-x-12 rounded-full shadow-[0_0_15px_rgba(123,63,228,0.5)]" />
                <div className="w-2.5 h-6 bg-blue-500 -skew-x-12 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
              </div>
              <span className="text-xl font-bold tracking-tight">CYBSEC PMO</span>
            </div>
            <p className="text-sm text-slate-500 dark:text-white/40 max-w-xs font-light">
              Build Smarter with secure tools designed for modern creators.
            </p>
          </div>

          {/* Nav columns */}
          <div className="md:col-span-7 grid grid-cols-3 gap-8">
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Product</h4>
              <ul className="space-y-2.5 text-sm text-slate-600 dark:text-white/60">
                <li><Link href="/" className="hover:underline">Home</Link></li>
                <li><Link href={`/${locale}/dashboard`} className="hover:underline">Dashboard</Link></li>
                <li><Link href={`/${locale}/dashboard/settings`} className="hover:underline">Directory</Link></li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Company</h4>
              <ul className="space-y-2.5 text-sm text-slate-600 dark:text-white/60">
                <li><Link href="/" className="hover:underline">About</Link></li>
                <li><Link href="/" className="hover:underline">Blog</Link></li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Resources</h4>
              <ul className="space-y-2.5 text-sm text-slate-600 dark:text-white/60">
                <li><span className="opacity-50">Coming Soon</span></li>
                <li><span className="opacity-50">404 Page</span></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom copyright row */}
        <div className="max-w-7xl mx-auto px-6 pt-12 mt-12 border-t border-slate-200 dark:border-white/[0.05] flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-500 dark:text-white/40">
          <p>© 2026 cybsec. All rights reserved.</p>
          <div className="flex gap-4">
            <span className="size-8 rounded-full border border-slate-300 dark:border-white/10 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-white/5 cursor-pointer">𝕏</span>
            <span className="size-8 rounded-full border border-slate-300 dark:border-white/10 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-white/5 cursor-pointer">f</span>
            <span className="size-8 rounded-full border border-slate-300 dark:border-white/10 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-white/5 cursor-pointer">o</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
