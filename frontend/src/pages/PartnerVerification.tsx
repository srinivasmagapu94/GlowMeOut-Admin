// Partner verification queue — the entry point into the review workspace.
import { useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { PageHeader, Panel } from "@/components/admin/PageShell";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { FilterSelect, TableToolbar } from "@/components/admin/TableToolbar";
import { Button } from "@/components/ui/button";
import { fmtDate, fmtRelative, titleCase } from "@/lib/format";
import { facetOptions, useFacets, useResourceList, useTableState } from "@/lib/table";
import type { Application } from "@/lib/types";

function docSummary(app: Application) {
  const verified = app.documents.filter((d) => d.status === "verified").length;
  return `${verified}/${app.documents.length}`;
}

export default function PartnerVerification() {
  const navigate = useNavigate();
  const state = useTableState("submitted_at", "desc");
  const { data, isLoading, isError, refetch } = useResourceList<Application>(
    "verifications",
    state,
  );
  const { data: facets } = useFacets("verifications");

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
          <span className="hidden items-center gap-1.5 text-[11px] text-slate-500 sm:flex">
            <ShieldCheck className="size-3.5" /> Decisions are written to the audit trail
          </span>
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
          filters={
            <>
              <FilterSelect
                label="Status"
                testid="verifications-filter-status"
                value={state.filters.status ?? "all"}
                onChange={(value) => state.setFilter("status", value)}
                options={facetOptions(facets?.status, "All statuses", titleCase)}
              />
              <FilterSelect
                label="Priority"
                testid="verifications-filter-priority"
                value={state.filters.priority ?? "all"}
                onChange={(value) => state.setFilter("priority", value)}
                options={facetOptions(facets?.priority, "All priorities", titleCase)}
              />
              <FilterSelect
                label="City"
                testid="verifications-filter-city"
                value={state.filters.city ?? "all"}
                onChange={(value) => state.setFilter("city", value)}
                options={facetOptions(facets?.city, "All cities", (v) => v)}
              />
            </>
          }
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
