// Audit log: an immutable, searchable timeline of every admin action.
import { useMemo } from "react";
import { Download, ShieldAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { PageHeader, Panel } from "@/components/admin/PageShell";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { FilterSelect, TableToolbar } from "@/components/admin/TableToolbar";
import { downloadCsv } from "@/lib/download";
import { fmtDateTime, fmtRelative, initials, titleCase } from "@/lib/format";
import { facetOptions, useFacets, useResourceList, useTableState } from "@/lib/table";
import type { AuditEntry } from "@/lib/types";

const ENTITY_LABELS: Record<string, string> = {
  application: "Verification",
  partners: "Partner",
  customers: "Customer",
  bookings: "Booking",
  payments: "Payment",
  reviews: "Review",
  tickets: "Ticket",
  offers: "Coupon",
  services: "Service",
  notifications: "Notification",
  settings: "Settings",
  admin: "Admin",
};

export default function AuditLog() {
  const state = useTableState("at", "desc");
  const { data, isLoading, isError, refetch } = useResourceList<AuditEntry>("audit", state);
  const { data: facets } = useFacets("audit");

  const dateFrom = state.filters.date_from ?? "";
  const dateTo = state.filters.date_to ?? "";

  const columns: Column<AuditEntry>[] = useMemo(
    () => [
      {
        key: "at",
        header: "When",
        sortable: true,
        cell: (row) => (
          <div className="whitespace-nowrap">
            <p className="num text-xs font-medium text-slate-800">{fmtDateTime(row.at)}</p>
            <p className="text-[10px] text-slate-500">{fmtRelative(row.at)}</p>
          </div>
        ),
      },
      {
        key: "actor_name",
        header: "Actor",
        sortable: true,
        cell: (row) => (
          <div className="flex items-center gap-2.5">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-[10px] font-bold text-slate-600">
              {initials(row.actor_name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-slate-900">{row.actor_name}</p>
              <p className="truncate text-[10px] text-slate-500">{row.actor_role}</p>
            </div>
          </div>
        ),
      },
      {
        key: "action_label",
        header: "Action",
        sortable: true,
        cell: (row) => (
          <div className="min-w-0 max-w-sm">
            <p className="truncate text-[13px] font-medium text-slate-800">{row.action_label}</p>
            <p className="num truncate text-[10px] text-slate-400">{row.action}</p>
          </div>
        ),
      },
      {
        key: "entity_type",
        header: "Area",
        sortable: true,
        cell: (row) => (
          <span className="rounded bg-secondary px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">
            {ENTITY_LABELS[row.entity_type] ?? titleCase(row.entity_type)}
          </span>
        ),
      },
      {
        key: "entity_label",
        header: "Target",
        sortable: true,
        cell: (row) => (
          <span className="block max-w-xs truncate text-xs text-slate-700">
            {row.entity_label || "—"}
          </span>
        ),
      },
      {
        key: "detail",
        header: "Detail",
        cell: (row) => (
          <span className="block max-w-md truncate text-[11px] text-slate-500" title={row.detail}>
            {row.detail || "—"}
          </span>
        ),
      },
      {
        key: "severity",
        header: "Severity",
        sortable: true,
        cell: (row) => (
          <StatusBadge status={row.severity} data-testid={`audit-severity-${row.id}`} />
        ),
      },
    ],
    [],
  );

  return (
    <div data-testid="audit-page">
      <PageHeader
        title="Audit log"
        count={data?.total}
        countLabel="entries"
        subtitle="Immutable record of every admin action — approvals, rejections, suspensions, refunds, payout and coupon changes."
        actions={
          <>
            <span className="hidden items-center gap-1.5 text-[11px] text-slate-500 lg:flex">
              <ShieldAlert className="size-3.5" /> Entries cannot be edited or deleted
            </span>
            <Button
              variant="outline"
              size="sm"
              className="bg-white"
              onClick={() => downloadCsv("audit", state.queryString)}
              data-testid="audit-export-button"
            >
              <Download className="size-3.5" /> Export CSV
            </Button>
          </>
        }
        testid="audit-header"
      />

      <Panel testid="audit-panel">
        <TableToolbar
          testid="audit"
          search={state.q}
          onSearch={state.setQ}
          searchPlaceholder="Search actor, action, target or detail"
          activeFilterCount={state.activeFilterCount}
          onReset={state.resetFilters}
          onRefresh={() => refetch()}
          filters={
            <>
              <FilterSelect
                label="Area"
                testid="audit-filter-entity-type"
                value={state.filters.entity_type ?? "all"}
                onChange={(value) => state.setFilter("entity_type", value)}
                options={facetOptions(
                  facets?.entity_type,
                  "All areas",
                  (v) => ENTITY_LABELS[v] ?? titleCase(v),
                )}
              />
              <FilterSelect
                label="Actor"
                testid="audit-filter-actor"
                value={state.filters.actor_name ?? "all"}
                onChange={(value) => state.setFilter("actor_name", value)}
                options={facetOptions(facets?.actor_name, "All actors", (v) => v)}
              />
              <FilterSelect
                label="Severity"
                testid="audit-filter-severity"
                value={state.filters.severity ?? "all"}
                onChange={(value) => state.setFilter("severity", value)}
                options={facetOptions(facets?.severity, "All severities", titleCase)}
              />
              <div className="flex items-center gap-1.5">
                <Label htmlFor="audit-date-from" className="sr-only">
                  From date
                </Label>
                <Input
                  id="audit-date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(event) => state.setFilter("date_from", event.target.value)}
                  data-testid="audit-filter-date-from"
                  className="h-8 w-[8.5rem] bg-white text-xs"
                />
                <span className="text-xs text-slate-400">to</span>
                <Label htmlFor="audit-date-to" className="sr-only">
                  To date
                </Label>
                <Input
                  id="audit-date-to"
                  type="date"
                  value={dateTo}
                  onChange={(event) => state.setFilter("date_to", event.target.value)}
                  data-testid="audit-filter-date-to"
                  className="h-8 w-[8.5rem] bg-white text-xs"
                />
              </div>
            </>
          }
        />

        <DataTable
          testid="audit-table"
          columns={columns}
          rows={data?.items ?? []}
          getRowId={(row) => row.id}
          total={data?.total ?? 0}
          page={data?.page ?? state.page}
          pages={data?.pages ?? 1}
          pageSize={state.pageSize}
          sort={state.sort}
          dir={state.dir}
          onSort={state.toggleSort}
          onPage={state.setPage}
          onPageSize={state.setPageSize}
          isLoading={isLoading}
          isError={isError}
          density="compact"
          emptyTitle="No audit entries match the current filters"
          emptyHint="Widen the date range or clear the filters to see more history."
        />
      </Panel>
    </div>
  );
}
