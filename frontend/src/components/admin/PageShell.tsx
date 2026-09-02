// Page header + content card shell shared by every management screen.
import type { ReactNode } from "react";
import { fmtNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  count?: number;
  countLabel?: string;
  actions?: ReactNode;
  testid?: string;
}

export function PageHeader({
  title,
  subtitle,
  count,
  countLabel,
  actions,
  testid = "page-header",
}: PageHeaderProps) {
  return (
    <div
      className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-grid pb-3"
      data-testid={testid}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1
            className="text-[22px] leading-tight font-bold tracking-tight text-slate-900"
            data-testid={`${testid}-title`}
          >
            {title}
          </h1>
          {typeof count === "number" ? (
            <span
              className="num rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 ring-inset"
              data-testid={`${testid}-count`}
            >
              {fmtNumber(count)}
              {countLabel ? ` ${countLabel}` : ""}
            </span>
          ) : null}
        </div>
        {subtitle ? (
          <p className="mt-1 max-w-3xl text-[13px] text-slate-500" data-testid={`${testid}-subtitle`}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({
  children,
  className,
  testid,
}: {
  children: ReactNode;
  className?: string;
  testid?: string;
}) {
  return (
    <section
      data-testid={testid}
      className={cn(
        "rounded-lg border border-grid bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  subtitle,
  right,
  className,
  testid,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  className?: string;
  testid?: string;
}) {
  return (
    <div
      data-testid={testid}
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 border-b border-grid px-4 py-3",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-[13px] font-bold tracking-tight text-slate-800">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      {right}
    </div>
  );
}

export function FieldRow({
  label,
  children,
  testid,
}: {
  label: string;
  children: ReactNode;
  testid?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-grid/70 py-2 last:border-b-0">
      <span className="eyebrow text-slate-400">{label}</span>
      <span className="text-[13px] font-medium text-slate-800" data-testid={testid}>
        {children}
      </span>
    </div>
  );
}
