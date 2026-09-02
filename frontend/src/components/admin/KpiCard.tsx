// Compact metric tile used on the dashboard and analytics screens.
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { fmtKpi } from "@/lib/format";
import type { Kpi } from "@/lib/types";
import { cn } from "@/lib/utils";

export function KpiCard({ kpi, testid }: { kpi: Kpi; testid?: string }) {
  const positive = kpi.delta_pct > 0;
  const flat = kpi.delta_pct === 0;
  const Icon = flat ? Minus : positive ? ArrowUpRight : ArrowDownRight;

  return (
    <div
      data-testid={testid ?? `kpi-${kpi.key}`}
      className="group relative overflow-hidden rounded-lg border border-grid bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-[box-shadow,border-color] duration-200 hover:border-primary/30 hover:shadow-[0_6px_18px_-8px_rgba(30,58,138,0.35)]"
    >
      <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      <p className="eyebrow text-slate-400">{kpi.label}</p>
      <p
        className="num mt-2 text-[26px] leading-none font-bold text-slate-900"
        data-testid={`${testid ?? `kpi-${kpi.key}`}-value`}
      >
        {fmtKpi(kpi.value, kpi.unit)}
      </p>
      <div className="mt-2.5 flex items-center gap-2">
        <span
          className={cn(
            "num inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-semibold",
            flat
              ? "bg-slate-100 text-slate-600"
              : positive
                ? "bg-emerald-50 text-emerald-700"
                : "bg-red-50 text-red-700",
          )}
        >
          <Icon className="size-3" />
          {Math.abs(kpi.delta_pct).toFixed(1)}%
        </span>
        <span className="truncate text-[11px] text-slate-500">{kpi.hint}</span>
      </div>
    </div>
  );
}
