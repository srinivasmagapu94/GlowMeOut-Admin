// Status vocabularies across the console map onto five tones. One place to change them.
import { titleCase } from "@/lib/format";
import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warning: "bg-amber-50 text-amber-700 ring-amber-200",
  danger: "bg-red-50 text-red-700 ring-red-200",
  info: "bg-blue-50 text-blue-700 ring-blue-200",
  neutral: "bg-slate-100 text-slate-600 ring-slate-200",
};

const DOT_CLASS: Record<Tone, string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  info: "bg-blue-500",
  neutral: "bg-slate-400",
};

const TONE_BY_STATUS: Record<string, Tone> = {
  // accounts
  active: "success",
  verified: "success",
  published: "success",
  settled: "success",
  captured: "success",
  paid: "success",
  completed: "success",
  resolved: "success",
  closed: "neutral",
  enabled: "success",

  // in-flight
  pending: "warning",
  under_review: "info",
  in_progress: "info",
  in_review: "info",
  upcoming: "info",
  authorised: "info",
  scheduled: "info",
  waiting: "warning",
  correction_requested: "warning",
  on_hold: "warning",
  open: "warning",
  paused: "warning",
  dormant: "neutral",
  not_applicable: "neutral",

  // negative
  rejected: "danger",
  suspended: "danger",
  failed: "danger",
  disputed: "danger",
  cancelled: "danger",
  removed: "danger",
  flagged: "danger",
  refunded: "warning",
  expired: "neutral",
  deactivated: "neutral",
  disabled: "neutral",

  // priorities
  urgent: "danger",
  high: "warning",
  medium: "info",
  low: "neutral",

  // segments
  vip: "info",
  frequent: "success",
  standard: "neutral",
  "at risk": "danger",
  at_risk: "danger",

  // severities
  critical: "danger",
  info: "info",
  success: "success",
  warning: "warning",
};

export function toneFor(status: string): Tone {
  return TONE_BY_STATUS[status?.toLowerCase?.() ?? ""] ?? "neutral";
}

interface StatusBadgeProps {
  status: string;
  label?: string;
  dot?: boolean;
  className?: string;
  "data-testid"?: string;
}

export function StatusBadge({
  status,
  label,
  dot = true,
  className,
  "data-testid": testId,
}: StatusBadgeProps) {
  const tone = toneFor(status);
  return (
    <span
      data-testid={testId}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ring-1 ring-inset",
        TONE_CLASS[tone],
        className,
      )}
    >
      {dot ? <span className={cn("size-1.5 rounded-full", DOT_CLASS[tone])} /> : null}
      {label ?? titleCase(status)}
    </span>
  );
}
