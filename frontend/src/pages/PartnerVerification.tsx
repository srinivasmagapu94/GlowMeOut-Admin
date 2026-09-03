// Partner verification queue — the entry point into the review workspace.
import { useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { PageHeader, Panel } from "@/components/admin/PageShell";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { TableToolbar } from "@/components/admin/TableToolbar";
import { Button } from "@/components/ui/button";
import { fmtDate, fmtRelative } from "@/lib/format";
import { apiGet } from "@/lib/api";
import { useTableState } from "@/lib/table";
import type { Application, PartnersApiRecord, PartnersResponse } from "@/lib/types";

function toApplication(record: PartnersApiRecord): Application {
  const name = record.fullName ?? record.ownerName ?? record.owner_name ?? "—";
  const updated = record.LastUpdateTimestamp ?? record.lastUpdateTimestamp ?? "";
  return {
    id: record.partnerUUID ?? record.partnerId ?? record.id ?? record.code ?? name,
    code: record.code ?? record.partnerId ?? record.id ?? "—",
    business_name: record.businessName ?? record.business_name ?? name,
    owner_name: name,
    email: record.email ?? "—",
    phone: record.phoneNumber ?? record.phone ?? "—",
    city: record.city ?? "—",
    address: "",
    business_reg_no: "",
    tax_id: "",
    license_no: "",
    experience_years: 0,
    team_size: 0,
    specialties: record.categories ?? record.services ?? [],
    services: [],
    portfolio: [],
    documents: [],
    notes: [],
    checklist: {},
    status: record.verificationStatus ?? record.verification_status ?? "under_review",
    priority: "normal",
    submitted_at: updated,
    updated_at: updated,
    decision_reason: "",
    age_hours: 0,
    sla_state: "on_track",
    sla_due_in_hours: 0,
  };
}

function docSummary(app: Application) {
  const verified = app.documents.filter((d) => d.status === "verified").length;
  return `${verified}/${app.documents.length}`;
}

const SLA_LABELS: Record<string, string> = {
  breached: "Breached",
  at_risk: "At risk",
  on_track: "On track",
  closed: "Closed",
};

function fmtAge(hours: number): string {
  if (hours < 1) return "<1h";
  if (hours < 48) return `${Math.round(hours)}h`;
  return `${Math.floor(hours / 24)}d ${Math.round(hours % 24)}h`;
}

export function SlaCell({ app, testid }: { app: Application; testid?: string }) {
  const overdue = app.sla_state === "breached";
  return (
    <div className="whitespace-nowrap" data-testid={testid}>
      <StatusBadge
        status={overdue ? "danger" : app.sla_state === "at_risk" ? "warning" : app.sla_state === "closed" ? "neutral" : "success"}
        label={SLA_LABELS[app.sla_state] ?? app.sla_state}
        dot={!(app.sla_state === "closed")}
      />
      <p className="num mt-0.5 text-[10px] text-slate-500">
        {fmtAge(app.age_hours)} old
        {app.sla_state === "closed"
          ? ""
          : overdue
            ? ` · ${fmtAge(Math.abs(app.sla_due_in_hours))} over`
            : ` · ${fmtAge(Math.max(0, app.sla_due_in_hours))} left`}
      </p>
    </div>
  );
}

export default function PartnerVerification() {
  const navigate = useNavigate();
  const state = useTableState("LastUpdateTimestamp", "desc");
  const { data: response, isLoading, isError, refetch } = useQuery({
    queryKey: ["partners", "pending-verification", state.queryKeyPart],
    queryFn: () =>
      apiGet<PartnersResponse>(
        `/ws_glowmeout_admin/findPendingVerificationPartners?page=${state.page - 1}&page_size=${state.pageSize}&sort_by=${encodeURIComponent(state.sort)}&direction=${state.dir}`,
      ),
    placeholderData: (previous) => previous,
  });
  const data = response
    ? {
        items: response.records.map(toApplication),
        total: response.totalRecords,
        page: response.pageNumber + 1,
        pages: Math.max(1, Math.ceil(response.totalRecords / response.pageSize)),
      }
    : undefined;

  const columns: Column<Application>[] = [
    {
      key: "code",
      header: "Application",
      sortable: true,
      cell: (row) => <span className="num text-xs font-semibold text-primary">{row.code}</span>,
    },
    {
      key: "business_name",
      header: "Applicant",
      sortable: true,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-slate-900">{row.business_name}</p>
          <p className="truncate text-[11px] text-slate-500">
            {row.owner_name} · {row.email}
          </p>
        </div>
      ),
    },
    { key: "city", header: "City", sortable: true, cell: (row) => <span className="text-xs">{row.city}</span> },
    {
      key: "experience_years",
      header: "Experience",
      sortable: true,
      align: "right",
      cell: (row) => <span className="num text-xs">{row.experience_years} yrs</span>,
    },
    {
      key: "services",
      header: "Services",
      align: "right",
      cell: (row) => <span className="num text-xs">{row.services.length}</span>,
    },
    {
      key: "documents",
      header: "Documents verified",
      align: "center",
      cell: (row) => (
        <span className="num text-xs font-semibold text-slate-700" data-testid={`verification-docs-${row.id}`}>
          {docSummary(row)}
        </span>
      ),
    },
    {
      key: "priority",
      header: "Priority",
      sortable: true,
      cell: (row) => <StatusBadge status={row.priority} dot={false} />,
    },
    {
      key: "submitted_at",
      header: "Submitted",
      sortable: true,
      cell: (row) => (
        <span className="num text-xs whitespace-nowrap" title={fmtDate(row.submitted_at)}>
          {fmtRelative(row.submitted_at)}
        </span>
      ),
    },
    {
      key: "age_hours",
      header: "SLA (48h target)",
      sortable: true,
      cell: (row) => <SlaCell app={row} testid={`verification-sla-${row.id}`} />,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      cell: (row) => <StatusBadge status={row.status} data-testid={`verification-status-${row.id}`} />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (row) => (
        <Button
          size="xs"
          variant="outline"
          className="bg-white"
          data-testid={`verification-review-${row.id}`}
          onClick={(event) => {
            event.stopPropagation();
            navigate(`/partner-verification/${row.id}`);
          }}
        >
          Review
        </Button>
      ),
    },
  ];

  return (
    <div data-testid="partner-verification-page">
      <PageHeader
        title="Partner verification"
        count={data?.total}
        countLabel="applications"
        subtitle="Compliance review queue for new partner applications — identity, licensing, insurance and banking checks."
        actions={
          <>
            <span className="hidden items-center gap-1.5 text-[11px] text-slate-500 lg:flex">
              <ShieldCheck className="size-3.5" /> Decisions are written to the audit trail
            </span>
          </>
        }
        testid="partner-verification-header"
      />

      <Panel testid="partner-verification-panel">
        <TableToolbar
          testid="verifications"
          search={state.q}
          onSearch={state.setQ}
          searchPlaceholder="Search applicant, owner or application ID"
          activeFilterCount={state.activeFilterCount}
          onReset={state.resetFilters}
          onRefresh={() => refetch()}
        />

        <DataTable
          testid="verifications-table"
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
          onRowClick={(row) => navigate(`/partner-verification/${row.id}`)}
          emptyTitle="No applications in this view"
          emptyHint="Clear the filters to see the full verification queue."
        />
      </Panel>
    </div>
  );
}
