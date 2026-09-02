// Operations dashboard: KPI strip, revenue + category charts, pending queue, alerts, activity.
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  BadgeCheck,
  CalendarPlus,
  CircleAlert,
  Info,
  Megaphone,
  OctagonAlert,
  Tag,
  TriangleAlert,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/admin/KpiCard";
import { PageHeader, Panel, PanelHeader } from "@/components/admin/PageShell";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { apiGet } from "@/lib/api";
import { moneyTick, moneyTooltip, seriesTooltip } from "@/lib/chart";
import { fmtDateTime, fmtNumber, fmtRelative, initials } from "@/lib/format";
import type { DashboardSummary } from "@/lib/types";

const PIE_COLORS = ["#1e3a8a", "#2563eb", "#60a5fa", "#0d9488", "#b45309", "#7c3aed"];

const QUICK_ACTIONS = [
  { label: "Review applications", to: "/partner-verification", icon: BadgeCheck },
  { label: "Add a service", to: "/services", icon: CalendarPlus },
  { label: "Create a coupon", to: "/offers", icon: Tag },
  { label: "Open support queue", to: "/support", icon: Megaphone },
  { label: "Onboard a partner", to: "/partners", icon: UserPlus },
];

const SEVERITY_ICON = {
  danger: OctagonAlert,
  warning: TriangleAlert,
  info: Info,
} as const;

export default function Dashboard() {
  const { data, isError, isLoading } = useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: () => apiGet<DashboardSummary>("/dashboard/summary"),
    retry: false,
  });

  const offline = isError || (!data && !isLoading);

  return (
    <div data-testid="dashboard-page">
      <PageHeader
        title="Operations dashboard"
        subtitle="Marketplace health, queues that need attention and the latest activity across every city."
        actions={
          <>
            <span className="hidden text-[11px] text-slate-500 sm:block" data-testid="dashboard-generated-at">
              {data ? `Refreshed ${fmtRelative(data.generated_at)}` : "Awaiting data"}
            </span>
            <Link to="/analytics">
              <Button variant="outline" size="sm" className="bg-white" data-testid="dashboard-analytics-link">
                Full analytics <ArrowRight className="size-3.5" />
              </Button>
            </Link>
          </>
        }
        testid="dashboard-header"
      />

      {offline ? (
        <div
          className="mb-5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800"
          data-testid="dashboard-offline-notice"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          <p>
            Live metrics are unavailable right now. The console shell is still fully navigable —
            figures will populate once the operations API responds.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {(data?.kpis ?? []).map((kpi) => (
          <KpiCard key={kpi.key} kpi={kpi} />
        ))}
        {!data
          ? Array.from({ length: 6 }).map((_, i) => (
              <div
                key={`kpi-skeleton-${i}`}
                className="h-[104px] animate-sheen rounded-lg border border-grid bg-card"
              />
            ))
          : null}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel className="xl:col-span-2" testid="dashboard-revenue-panel">
          <PanelHeader
            title="Gross volume and platform revenue"
            subtitle="Rolling twelve-month trend, settled bookings only"
            right={
              <div className="flex items-center gap-3 text-[11px] text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-[#1e3a8a]" /> Gross volume
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-[#60a5fa]" /> Platform revenue
                </span>
              </div>
            }
          />
          <div className="h-[264px] px-2 py-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.revenue_series ?? []} margin={{ top: 6, right: 12, bottom: 0, left: 4 }}>
                <defs>
                  <linearGradient id="gGross" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1e3a8a" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#1e3a8a" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gFee" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={{ stroke: "#e2e8f0" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                  width={54}
                  tickFormatter={moneyTick}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    fontSize: 12,
                    boxShadow: "0 8px 24px -12px rgba(15,23,42,0.3)",
                  }}
                  formatter={seriesTooltip({ a: "Gross volume", b: "Platform revenue" })}
                />
                <Area
                  type="monotone"
                  dataKey="a"
                  stroke="#1e3a8a"
                  strokeWidth={2}
                  fill="url(#gGross)"
                />
                <Area
                  type="monotone"
                  dataKey="b"
                  stroke="#60a5fa"
                  strokeWidth={2}
                  fill="url(#gFee)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel testid="dashboard-category-panel">
          <PanelHeader title="Volume by service category" subtitle="Share of booking value" />
          <div className="h-[264px] px-2 py-3">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data?.bookings_by_category ?? []}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={52}
                  outerRadius={80}
                  paddingAngle={2}
                  stroke="#ffffff"
                  strokeWidth={2}
                >
                  {(data?.bookings_by_category ?? []).map((entry, index) => (
                    <Cell key={entry.label} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Legend
                  verticalAlign="bottom"
                  height={54}
                  iconType="circle"
                  iconSize={7}
                  formatter={(value: string) => (
                    <span style={{ fontSize: 11, color: "#475569" }}>{value}</span>
                  )}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                  formatter={moneyTooltip}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel testid="dashboard-pending-panel">
          <PanelHeader title="Pending actions" subtitle="Queues waiting on an operator" />
          <ul className="divide-y divide-grid/70">
            {(data?.pending_actions ?? []).map((action) => (
              <li key={action.id}>
                <Link
                  to={action.href}
                  data-testid={`pending-action-${action.id}`}
                  className="group flex items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-slate-50"
                >
                  <span className="num grid size-9 shrink-0 place-items-center rounded-md bg-slate-100 text-sm font-bold text-slate-700 transition-colors duration-150 group-hover:bg-primary group-hover:text-white">
                    {action.count}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-slate-800">
                      {action.label}
                    </span>
                    <span className="block truncate text-[11px] text-slate-500">{action.detail}</span>
                  </span>
                  <StatusBadge status={action.severity} dot={false} />
                </Link>
              </li>
            ))}
            {!data ? (
              <li className="px-4 py-8 text-center text-xs text-slate-400">Loading queues…</li>
            ) : null}
          </ul>
        </Panel>

        <Panel testid="dashboard-alerts-panel">
          <PanelHeader title="Alerts" subtitle="Conditions that need an operational decision" />
          <ul className="divide-y divide-grid/70">
            {(data?.alerts ?? []).map((alert) => {
              const Icon =
                SEVERITY_ICON[alert.severity as keyof typeof SEVERITY_ICON] ?? Info;
              return (
                <li
                  key={alert.id}
                  className="flex gap-3 px-4 py-3"
                  data-testid={`dashboard-alert-${alert.id}`}
                >
                  <Icon
                    className={
                      alert.severity === "danger"
                        ? "mt-0.5 size-4 shrink-0 text-red-600"
                        : alert.severity === "warning"
                          ? "mt-0.5 size-4 shrink-0 text-amber-600"
                          : "mt-0.5 size-4 shrink-0 text-blue-600"
                    }
                  />
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-slate-800">{alert.title}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                      {alert.detail}
                    </p>
                  </div>
                </li>
              );
            })}
            {!data ? (
              <li className="px-4 py-8 text-center text-xs text-slate-400">Loading alerts…</li>
            ) : null}
          </ul>
        </Panel>

        <div className="space-y-4">
          <Panel testid="dashboard-quick-actions-panel">
            <PanelHeader title="Quick actions" />
            <div className="flex flex-wrap gap-2 p-4">
              {QUICK_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.to + action.label}
                    to={action.to}
                    data-testid={`quick-action-${action.label.toLowerCase().replace(/\s+/g, "-")}`}
                    className="inline-flex items-center gap-1.5 rounded-md border border-grid bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-700 transition-[background-color,border-color,transform] duration-150 hover:-translate-y-px hover:border-primary/40 hover:bg-accent hover:text-primary"
                  >
                    <Icon className="size-3.5" /> {action.label}
                  </Link>
                );
              })}
            </div>
          </Panel>

          <Panel testid="dashboard-activity-panel">
            <PanelHeader title="Recent activity" subtitle="Latest marketplace events" />
            <ul className="divide-y divide-grid/70">
              {(data?.activity ?? []).slice(0, 6).map((item) => (
                <li
                  key={item.id}
                  className="flex gap-2.5 px-4 py-2.5"
                  data-testid={`activity-item-${item.id}`}
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-[10px] font-bold text-slate-600">
                    {initials(item.actor)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] text-slate-700">
                      <span className="font-semibold text-slate-900">{item.actor}</span>{" "}
                      {item.action}{" "}
                      <span className="font-semibold text-slate-900">{item.target}</span>
                    </p>
                    <p className="text-[10px] text-slate-400" title={fmtDateTime(item.at)}>
                      {fmtRelative(item.at)}
                    </p>
                  </div>
                  <StatusBadge status={item.kind} dot={false} className="self-center" />
                </li>
              ))}
              {!data ? (
                <li className="px-4 py-8 text-center text-xs text-slate-400">Loading activity…</li>
              ) : null}
            </ul>
          </Panel>
        </div>
      </div>

      <p className="mt-4 text-[11px] text-slate-400" data-testid="dashboard-footnote">
        Figures are computed live from {fmtNumber(data?.kpis?.[4]?.value ?? 0)} in-flight bookings
        and the seeded operational dataset for this environment.
      </p>
    </div>
  );
}
