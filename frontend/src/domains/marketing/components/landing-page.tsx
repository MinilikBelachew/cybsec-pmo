import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  FolderKanban,
  GanttChartSquare,
  Shield,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/shared/utils/cn";

type LandingPageProps = {
  locale: string;
};

const INTEGRATIONS = [
  "Microsoft Entra ID",
  "Microsoft Teams",
  "Outlook",
  "Zoho",
  "Keka",
];

const FEATURES = [
  {
    icon: FolderKanban,
    title: "Portfolio control",
    description:
      "Create projects, assign PMs, track milestones, and keep delivery aligned across departments.",
  },
  {
    icon: GanttChartSquare,
    title: "Execution visibility",
    description:
      "Gantt timelines, dependencies, and active tasks in one workspace — built for PMO and delivery teams.",
  },
  {
    icon: ShieldCheck,
    title: "Governed access",
    description:
      "Role-based permissions, SSO, and audit trails designed for enterprise security operations.",
  },
  {
    icon: ClipboardList,
    title: "Audit by design",
    description:
      "System-wide audit for admins and project-scoped history for PMs — every critical action recorded.",
  },
];

const FAQ = [
  {
    q: "How does sign-in work?",
    a: "Users authenticate with Microsoft Entra ID. First-time users are provisioned automatically into the directory.",
  },
  {
    q: "Who can see the audit trail?",
    a: "Super Admins and IT Admins see the full audit log. PMs, PMO Leads, and Team Leads see audit events inside their projects.",
  },
  {
    q: "Can we import MS Project schedules?",
    a: "Yes. Upload an .mpp, .mpx, or MSPDI .xml file to preview tasks and dependencies before saving into a project.",
  },
];

function LogoMark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="flex gap-1 items-center">
        <div className="h-5 w-1.5 -skew-x-12 rounded-full bg-primary" />
        <div className="h-5 w-1.5 -skew-x-12 rounded-full bg-primary/50" />
      </div>
      <span className="text-base font-semibold tracking-tight text-foreground">
        CYBSEC PMO
      </span>
    </div>
  );
}

export function LandingPage({ locale }: LandingPageProps) {
  const dashboardHref = `/${locale}/dashboard`;

  return (
    <div className="relative h-screen overflow-x-hidden bg-background text-foreground">
      {/* Ambient background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -left-32 top-0 h-[28rem] w-[28rem] rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute -right-24 top-1/3 h-[24rem] w-[24rem] rounded-full bg-violet-500/6 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.35] dark:opacity-[0.18]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, hsl(var(--border)) 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <LogoMark />
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#product" className="transition-colors hover:text-foreground">
              Product
            </a>
            <a href="#faq" className="transition-colors hover:text-foreground">
              FAQ
            </a>
          </nav>
          <Link
            href={dashboardHref}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Open workspace
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-6 pb-20 pt-16 md:pt-24 lg:pb-28">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Shield className="size-3.5 text-primary" />
              Enterprise PMO for cybersecurity delivery
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl md:text-6xl md:leading-[1.08]">
              Run projects with clarity,
              <span className="block text-primary">not spreadsheet chaos.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
              CYBSEC PMO unifies portfolio planning, task execution, permissions,
              and audit — secured with Microsoft SSO for modern security teams.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href={dashboardHref}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 sm:w-auto"
              >
                Get started
                <ArrowUpRight className="size-4" />
              </Link>
              <a
                href="#product"
                className="inline-flex w-full items-center justify-center rounded-full border border-border bg-card px-6 py-3 text-sm font-medium text-foreground transition hover:bg-muted/50 sm:w-auto"
              >
                See the product
              </a>
            </div>
          </div>

          {/* Hero visual */}
          <div
            id="product"
            className="relative mx-auto mt-16 max-w-5xl overflow-hidden rounded-2xl border border-border bg-card/50 p-1.5 shadow-sm"
          >
            <div className="relative aspect-[16/10] overflow-hidden rounded-[14px] border border-border/60 bg-muted">
              <Image
                src="/landing-dashboard-light.png"
                alt="CYBSEC PMO dashboard"
                fill
                className="object-cover object-top dark:hidden"
                priority
              />
              <Image
                src="/landing-dashboard-dark.png"
                alt="CYBSEC PMO dashboard"
                fill
                className="hidden object-cover object-top dark:block"
                priority
              />
            </div>
          </div>
        </section>

        {/* Integrations */}
        <section className="border-y border-border/60 bg-muted/30 py-10">
          <div className="mx-auto max-w-6xl px-6">
            <p className="mb-6 text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Works with your stack
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
              {INTEGRATIONS.map((name) => (
                <span
                  key={name}
                  className="text-sm font-medium text-muted-foreground/80 transition-colors hover:text-foreground"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl px-6 py-20 md:py-28">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              Everything your PMO needs
            </h2>
            <p className="mt-4 text-muted-foreground">
              A focused platform for planning, executing, and governing security
              projects — without the noise of generic tools.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {FEATURES.map((feature) => (
              <article
                key={feature.title}
                className="group rounded-2xl border border-border bg-card/60 p-6 transition hover:border-primary/25 hover:bg-card"
              >
                <div className="mb-4 inline-flex rounded-xl border border-border bg-muted/60 p-2.5 text-primary">
                  <feature.icon className="size-5" />
                </div>
                <h3 className="text-lg font-medium text-foreground">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* Gantt highlight */}
        <section className="border-t border-border/60 bg-muted/20 py-20 md:py-28">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 lg:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-primary">Portfolio timelines</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
                See dependencies before they become delays
              </h2>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                Interactive Gantt views connect phases, tasks, and predecessors so
                PMs can spot bottlenecks early and keep delivery on track.
              </p>
              <ul className="mt-8 space-y-3">
                {[
                  "FS / SS / FF / SF dependency types",
                  "Project and portfolio-level views",
                  "MPP import for schedule migration",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-2.5 text-sm text-foreground"
                  >
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="overflow-hidden rounded-2xl border border-border bg-card p-1.5 shadow-sm">
              <div className="relative aspect-video overflow-hidden rounded-[14px] border border-border/60">
                <Image
                  src="/landing-gantt-light.png"
                  alt="Gantt chart preview"
                  fill
                  className="object-cover object-left-top dark:hidden"
                />
                <Image
                  src="/landing-gantt-dark.png"
                  alt="Gantt chart preview"
                  fill
                  className="hidden object-cover object-left-top dark:block"
                />
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-6 py-20 md:py-24">
          <div className="rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-card to-card px-8 py-12 text-center md:px-14 md:py-16">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              Ready to run delivery with confidence?
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground md:text-base">
              Sign in with your organization account and start managing projects,
              tasks, and audit trails in minutes.
            </p>
            <Link
              href={dashboardHref}
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              Go to dashboard
              <ArrowUpRight className="size-4" />
            </Link>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-t border-border/60 py-20 md:py-28">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto mb-12 max-w-xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight text-foreground">
                Common questions
              </h2>
            </div>
            <div className="mx-auto grid max-w-3xl gap-4">
              {FAQ.map((item) => (
                <div
                  key={item.q}
                  className="rounded-2xl border border-border bg-card/50 px-6 py-5"
                >
                  <h3 className="text-sm font-medium text-foreground">{item.q}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {item.a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/20 py-12">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 md:flex-row md:items-start md:justify-between">
          <div>
            <LogoMark />
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              Secure project management for cybersecurity operations teams.
            </p>
          </div>
          <div className="flex gap-16 text-sm">
            <div>
              <p className="font-medium text-foreground">Product</p>
              <ul className="mt-3 space-y-2 text-muted-foreground">
                <li>
                  <Link href={dashboardHref} className="hover:text-foreground">
                    Dashboard
                  </Link>
                </li>
                <li>
                  <a href="#features" className="hover:text-foreground">
                    Features
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-foreground">Company</p>
              <ul className="mt-3 space-y-2 text-muted-foreground">
                <li>© 2026 CYBSEC</li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
