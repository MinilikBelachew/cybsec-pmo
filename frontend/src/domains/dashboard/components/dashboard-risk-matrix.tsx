"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/shared/utils/cn";

const RISKS = [
  { id: "R1", label: "Credential leak",     likelihood: 3, impact: 4, owner: "SOC Team" },
  { id: "R2", label: "Zoho Sync Delay",     likelihood: 2, impact: 3, owner: "Integrations" },
  { id: "R3", label: "Resource Bottleneck", likelihood: 2, impact: 4, owner: "PMO Lead" },
  { id: "R4", label: "Scope creep",         likelihood: 4, impact: 3, owner: "Proj Manager" },
  { id: "R5", label: "Compliance gap",      likelihood: 1, impact: 4, owner: "GRC Auditor" },
];

function cellColor(l: number, imp: number) {
  const score = l * imp;
  if (score >= 12) return "bg-rose-100 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800";
  if (score >= 6)  return "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800";
  return "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800";
}

function riskColor(l: number, imp: number) {
  const score = l * imp;
  if (score >= 12) return "bg-rose-500 text-white";
  if (score >= 6)  return "bg-amber-400 text-white";
  return "bg-emerald-500 text-white";
}

export function RiskMatrix() {
  const t = useTranslations("Dashboard");

  return (
    <div className="p-4 rounded-xl bg-card/70 backdrop-blur-md border border-border/40 space-y-3 h-full flex flex-col justify-between">
      <div className="flex items-center justify-between shrink-0">
        <p className="text-sm font-bold">{t("riskRegister")}</p>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-rose-500" /> {t("high")}</span>
          <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-amber-400" /> {t("medium")}</span>
          <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-emerald-500" /> {t("low")}</span>
        </div>
      </div>

      <div className="flex-1 min-h-[180px]">
        <div className="flex gap-1 h-full">
          <div className="flex flex-col justify-between pb-5 shrink-0">
            {["Certain", "Likely", "Possible", "Rare"].map((key) => (
              <span key={key} className="text-[9px] text-muted-foreground/60 w-12 text-end leading-tight pe-1">
                {t(`likelihood${key}`)}
              </span>
            ))}
          </div>
          <div className="flex-1 space-y-1">
            {[4, 3, 2, 1].map((l) => (
              <div key={l} className="flex gap-1">
                {[1, 2, 3, 4].map((imp) => {
                  const risksHere = RISKS.filter((r) => r.likelihood === l && r.impact === imp);
                  return (
                    <div
                      key={imp}
                      className={cn("flex-1 min-h-[32px] rounded-lg border flex flex-wrap items-center justify-center gap-0.5 p-1 transition-colors", cellColor(l, imp))}
                    >
                      {risksHere.map((r) => (
                        <span
                          key={r.id}
                          title={`${r.label} — ${r.owner}`}
                          className={cn("text-[9px] font-bold px-1 py-0.5 rounded cursor-default", riskColor(l, imp))}
                        >
                          {r.id}
                        </span>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
            <div className="flex gap-1 mt-1">
              {["Low", "Medium", "High", "Critical"].map((key) => (
                <div key={key} className="flex-1 text-center text-[9px] text-muted-foreground/60">
                  {t(`impact${key}`)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-1.5 border-t border-border/40 pt-2 shrink-0">
        {RISKS.slice(0, 4).map((r) => (
          <div key={r.id} className="flex items-center gap-2">
            <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0", riskColor(r.likelihood, r.impact))}>
              {r.id}
            </span>
            <span className="text-xs text-foreground flex-1 truncate">{r.label}</span>
            <span className="text-[10px] text-muted-foreground shrink-0">{r.owner}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
