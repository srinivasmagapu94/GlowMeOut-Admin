// Analytics: KPI cards, trend lines, category bars and a rating donut with range/category filters.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { KpiCard } from "@/components/admin/KpiCard";
import { PageHeader, Panel, PanelHeader } from "@/components/admin/PageShell";
import { FilterSelect } from "@/components/admin/TableToolbar";
import { apiGet } from "@/lib/api";
import { moneyTick, moneyTooltip, reviewsTooltip, seriesTooltip, sliceLabel } from "@/lib/chart";
import { fmtRelative } from "@/lib/format";
import type { AnalyticsOverview } from "@/lib/types";

const PIE_COLORS = ["#1e3a8a", "#2563eb", "#60a5fa", "#0d9488", "#b45309"];

const CATEGORIES = [
  { value: "all", label: "All categories" },
  { value: "Hair", label: "Hair" },
  { value: "Skin", label: "Skin" },
  { value: "Nails", label: "Nails" },
  { value: "Spa & Massage", label: "Spa & Massage" },
  { value: "Makeup", label: "Makeup" },
  { value: "Grooming", label: "Grooming" },
];

const RANGES = [
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "12m", label: "Last 12 months" },
];

const axis = {
  tick: { fontSize: 11, fill: "#64748b" },
  axisLine: { stroke: "#e2e8f0" },
  tickLine: false,
} as const;

const tooltipStyle = {
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  fontSize: 12,
  boxShadow: "0 8px 24px -12px rgba(15,23,42,0.3)",
} as const;

export default function Analytics() {
  const [range, setRange] = useState("12m");
  const [category, setCategory] = useState("all");

  const { data } = useQuery({
    queryKey: ["analytics", "overview", range, category],
    queryFn: () =>
      apiGet<AnalyticsOverview>(
        `/analytics/overview?range=${range}&category=${encodeURIComponent(category)}`,
      ),
    retry: false,
  });

  return (
    <div data-testid="analytics-page">
      <PageHeader
        title="Analytics"
        subtitle="Commercial and operational performance across the marketplace."
        actions={
          <>
            <FilterSelect
              label="Date range"
              testid="analytics-filter-range"
              value={range}
              onChange={setRange}
              options={RANGES}
            />
            <FilterSelect
              label="Category"
              testid="analytics-filter-category"
              value={category}
              onChange={setCategory}
              options={CATEGORIES}
            />
            <span className="hidden text-[11px] text-slate-500 lg:block" data-testid="analytics-generated-at">
              {data ? `Updated ${fmtRelative(data.generated_at)}` : "Loading…"}
            </span>
          </>
        }
        testid="analytics-header"
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {(data?.kpis ?? []).map((kpi) => (
          <KpiCard key={kpi.key} kpi={kpi} testid={`analytics-kpi-${kpi.key}`} />
        ))}
        {!data
          ? Array.from({ length: 6 }).map((_, i) => (
              <div
                key={`analytics-kpi-skeleton-${i}`}
                className="h-[104px] animate-sheen rounded-lg border border-grid bg-card"
              />
            ))
          : null}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel testid="analytics-revenue-panel">
          <PanelHeader
            title="Revenue trend"
            subtitle={data?.range_label ?? "Gross volume against retained commission"}
          />
          <div className="h-[280px] px-2 py-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.revenue_series ?? []} margin={{ top: 6, right: 14, bottom: 0, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                <XAxis dataKey="label" {...axis} />
                <YAxis {...axis} axisLine={false} width={54} tickFormatter={moneyTick} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={seriesTooltip({ a: "Gross volume", b: "Platform revenue" })}
                />
                <Line type="monotone" dataKey="a" stroke="#1e3a8a" strokeWidth={2.2} dot={false} />
                <Line
                  type="monotone"
                  dataKey="b"
                  stroke="#60a5fa"
                  strokeWidth={2.2}
                  strokeDasharray="4 3"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel testid="analytics-bookings-panel">
          <PanelHeader title="Booking volume" subtitle="Total bookings against completed bookings" />
          <div className="h-[280px] px-2 py-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.bookings_series ?? []} margin={{ top: 6, right: 14, bottom: 0, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                <XAxis dataKey="label" {...axis} />
                <YAxis {...axis} axisLine={false} width={40} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={seriesTooltip({ a: "Bookings", b: "Completed" }, false)}
                />
                <Bar dataKey="a" fill="#1e3a8a" radius={[3, 3, 0, 0]} maxBarSize={22} />
                <Bar dataKey="b" fill="#93c5fd" radius={[3, 3, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel testid="analytics-category-panel">
          <PanelHeader title="Value by category" subtitle="Booking value share" />
          <div className="h-[260px] px-2 py-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data?.category_split ?? []}
                layout="vertical"
                margin={{ top: 4, right: 16, bottom: 4, left: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" horizontal={false} />
                <XAxis type="number" {...axis} tickFormatter={moneyTick} />
                <YAxis type="category" dataKey="label" {...axis} width={92} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={moneyTooltip} />
                <Bar dataKey="value" fill="#2563eb" radius={[0, 3, 3, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel testid="analytics-city-panel">
          <PanelHeader title="Value by city" subtitle="Top performing markets" />
          <div className="h-[260px] px-2 py-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data?.city_split ?? []}
                layout="vertical"
                margin={{ top: 4, right: 16, bottom: 4, left: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" horizontal={false} />
                <XAxis type="number" {...axis} tickFormatter={moneyTick} />
                <YAxis type="category" dataKey="label" {...axis} width={92} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={moneyTooltip} />
                <Bar dataKey="value" fill="#0d9488" radius={[0, 3, 3, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel testid="analytics-rating-panel">
          <PanelHeader title="Rating distribution" subtitle="Share of submitted reviews" />
          <div className="h-[260px] px-2 py-3">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data?.rating_split ?? []}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={48}
                  outerRadius={82}
                  paddingAngle={2}
                  stroke="#ffffff"
                  strokeWidth={2}
                  label={sliceLabel}
                  labelLine={false}
                >
                  {(data?.rating_split ?? []).map((entry, index) => (
                    <Cell key={entry.label} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={reviewsTooltip}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
    </div>
  );
}
