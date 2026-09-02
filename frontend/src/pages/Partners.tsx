// Partner management: same enterprise table pattern as customers, with rating and services.
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Ban, Briefcase, CheckCircle2, Download, MoreHorizontal, ShieldCheck, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { PageHeader, Panel } from "@/components/admin/PageShell";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { FilterSelect, TableToolbar } from "@/components/admin/TableToolbar";
import { apiPatch, apiPost } from "@/lib/api";
import { downloadCsv } from "@/lib/download";
import { fmtDate, fmtMoney, fmtNumber, titleCase } from "@/lib/format";
import { facetOptions, useFacets, useResourceList, useTableState } from "@/lib/table";
import type { Partner } from "@/lib/types";

export default function Partners() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const state = useTableState("joined_at", "desc");

  const { data, isLoading, isError, refetch } = useResourceList<Partner>("partners", state);
  const { data: facets } = useFacets("partners");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["partners"] });

  const setField = useMutation({
    mutationFn: (vars: { id: string; field: string; value: string }) =>
      apiPatch<Partner>(`/partners/${vars.id}`, { field: vars.field, value: vars.value }),
    onSuccess: () => {
      toast.success("Partner record updated");
      invalidate();
    },
    onError: () => toast.error("Could not update this partner"),
  });

  const bulkStatus = useMutation({
    mutationFn: (value: string) =>
      apiPost<{ updated: number }>("/partners/bulk", {
        ids: state.selected,
        field: "account_status",
        value,
      }),
    onSuccess: (result, value) => {
      toast.success(`${result.updated} partners marked ${titleCase(value).toLowerCase()}`);
      state.setSelected([]);
      invalidate();
    },
    onError: () => toast.error("Bulk update failed"),
  });

  const columns: Column<Partner>[] = [
    {
      key: "code",
      header: "Partner ID",
      sortable: true,
      cell: (row) => <span className="num text-xs font-semibold text-primary">{row.code}</span>,
    },
    {
      key: "business_name",
      header: "Business",
      sortable: true,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-slate-900">{row.business_name}</p>
          <p className="truncate text-[11px] text-slate-500">{row.owner_name} · {row.email}</p>
        </div>
      ),
    },
    {
      key: "services",
      header: "Services",
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.services.slice(0, 2).map((service) => (
            <span
              key={service}
              className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-slate-600"
            >
              {service}
            </span>
          ))}
          {row.services.length > 2 ? (
            <span className="num rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
              +{row.services.length - 2}
            </span>
          ) : null}
        </div>
      ),
    },
    { key: "city", header: "Location", sortable: true, cell: (row) => <span className="text-xs">{row.city}</span> },
    {
      key: "rating",
      header: "Rating",
      sortable: true,
      align: "right",
      cell: (row) => (
        <span className="num inline-flex items-center gap-1 text-xs font-semibold text-slate-800">
          <Star className="size-3.5 fill-amber-400 text-amber-400" />
          {row.rating.toFixed(1)}
          <span className="font-normal text-slate-400">({fmtNumber(row.reviews_count)})</span>
        </span>
      ),
    },
    {
      key: "jobs_completed",
      header: "Jobs",
      sortable: true,
      align: "right",
      cell: (row) => <span className="num text-xs">{fmtNumber(row.jobs_completed)}</span>,
    },
    {
      key: "revenue",
      header: "Revenue",
      sortable: true,
      align: "right",
      cell: (row) => <span className="num text-xs font-semibold text-slate-800">{fmtMoney(row.revenue)}</span>,
    },
    {
      key: "verification_status",
      header: "Verification",
      sortable: true,
      cell: (row) => (
        <StatusBadge status={row.verification_status} data-testid={`partner-verification-${row.id}`} />
      ),
    },
    {
      key: "account_status",
      header: "Account",
      sortable: true,
      cell: (row) => <StatusBadge status={row.account_status} data-testid={`partner-account-${row.id}`} />,
    },
    {
      key: "joined_at",
      header: "Onboarded",
      sortable: true,
      cell: (row) => <span className="num text-xs whitespace-nowrap">{fmtDate(row.joined_at)}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger
            data-testid={`partner-actions-${row.id}`}
            onClick={(event) => event.stopPropagation()}
            className="grid size-7 place-items-center rounded text-slate-400 transition-colors duration-150 hover:bg-secondary hover:text-slate-700"
            aria-label={`Actions for ${row.business_name}`}
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem
              onClick={() => navigate(`/partners/${row.id}`)}
              data-testid={`partner-action-view-${row.id}`}
            >
              <Briefcase className="size-4" /> Open partner profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setField.mutate({ id: row.id, field: "verification_status", value: "verified" })}
              data-testid={`partner-action-verify-${row.id}`}
            >
              <ShieldCheck className="size-4" /> Mark verified
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setField.mutate({ id: row.id, field: "account_status", value: "active" })}
              data-testid={`partner-action-activate-${row.id}`}
            >
              <CheckCircle2 className="size-4" /> Activate account
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setField.mutate({ id: row.id, field: "account_status", value: "suspended" })}
              data-testid={`partner-action-suspend-${row.id}`}
            >
              <Ban className="size-4" /> Suspend account
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div data-testid="partners-page">
      <PageHeader
        title="Partners"
        count={data?.total}
        countLabel="records"
        subtitle="Service providers on the marketplace, their coverage, performance and account state."
        actions={
          <Button
            variant="outline"
            size="sm"
            className="bg-white"
            data-testid="partners-export-button"
            onClick={() => {
              downloadCsv("partners", state.queryString);
              toast.success("Export started — the CSV covers every row matching your filters");
            }}
          >
            <Download className="size-3.5" /> Export CSV
          </Button>
        }
        testid="partners-header"
      />

      <Panel testid="partners-panel">
        <TableToolbar
          testid="partners"
          search={state.q}
          onSearch={state.setQ}
          searchPlaceholder="Search business, owner, email or ID"
          activeFilterCount={state.activeFilterCount}
          onReset={state.resetFilters}
          onRefresh={() => refetch()}
          filters={
            <>
              <FilterSelect
                label="Account status"
                testid="partners-filter-account-status"
                value={state.filters.account_status ?? "all"}
                onChange={(value) => state.setFilter("account_status", value)}
                options={facetOptions(facets?.account_status, "All accounts", titleCase)}
              />
              <FilterSelect
                label="Verification"
                testid="partners-filter-verification"
                value={state.filters.verification_status ?? "all"}
                onChange={(value) => state.setFilter("verification_status", value)}
                options={facetOptions(facets?.verification_status, "All verification", titleCase)}
              />
              <FilterSelect
                label="City"
                testid="partners-filter-city"
                value={state.filters.city ?? "all"}
                onChange={(value) => state.setFilter("city", value)}
                options={facetOptions(facets?.city, "All cities", (v) => v)}
              />
            </>
          }
        />

        <DataTable
          testid="partners-table"
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
          onRowClick={(row) => navigate(`/partners/${row.id}`)}
          selectable
          selected={state.selected}
          onSelectedChange={state.setSelected}
          bulkActions={
            <>
              <Button
                size="xs"
                variant="ghost"
                className="text-emerald-300 hover:bg-slate-800 hover:text-emerald-200"
                onClick={() => bulkStatus.mutate("active")}
                data-testid="partners-bulk-activate"
              >
                <CheckCircle2 className="size-3.5" /> Activate
              </Button>
              <Button
                size="xs"
                variant="ghost"
                className="text-red-300 hover:bg-slate-800 hover:text-red-200"
                onClick={() => bulkStatus.mutate("suspended")}
                data-testid="partners-bulk-suspend"
              >
                <Ban className="size-3.5" /> Suspend
              </Button>
            </>
          }
        />
      </Panel>
    </div>
  );
}
