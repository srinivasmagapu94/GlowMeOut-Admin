// Customer management: search, filters, sortable columns, bulk selection, pagination.
import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Ban, CheckCircle2, Download, MoreHorizontal, UserRound } from "lucide-react";
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
import { fmtDate, fmtMoney, fmtNumber, initials, titleCase } from "@/lib/format";
import { facetOptions, useFacets, useResourceList, useTableState } from "@/lib/table";
import type { Customer } from "@/lib/types";

export default function Customers() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const state = useTableState("joined_at", "desc");
  const initialQuery = searchParams.get("q");

  useMemo(() => {
    if (initialQuery && !state.q) state.setQ(initialQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  const { data, isLoading, isError, refetch } = useResourceList<Customer>("customers", state);
  const { data: facets } = useFacets("customers");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["customers"] });

  const setStatus = useMutation({
    mutationFn: (vars: { id: string; value: string }) =>
      apiPatch<Customer>(`/customers/${vars.id}`, { field: "status", value: vars.value }),
    onSuccess: (_, vars) => {
      toast.success(`Customer marked ${titleCase(vars.value).toLowerCase()}`);
      invalidate();
    },
    onError: () => toast.error("Could not update this customer"),
  });

  const bulkStatus = useMutation({
    mutationFn: (value: string) =>
      apiPost<{ updated: number }>("/customers/bulk", {
        ids: state.selected,
        field: "status",
        value,
      }),
    onSuccess: (result, value) => {
      toast.success(`${result.updated} customers marked ${titleCase(value).toLowerCase()}`);
      state.setSelected([]);
      invalidate();
    },
    onError: () => toast.error("Bulk update failed"),
  });

  const columns: Column<Customer>[] = [
    {
      key: "code",
      header: "Customer ID",
      sortable: true,
      cell: (row) => <span className="num text-xs font-semibold text-primary">{row.code}</span>,
    },
    {
      key: "name",
      header: "Customer",
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-2.5">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-[10px] font-bold text-slate-600">
            {initials(row.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-slate-900">{row.name}</p>
            <p className="truncate text-[11px] text-slate-500">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "phone",
      header: "Phone",
      cell: (row) => <span className="num text-xs whitespace-nowrap">{row.phone}</span>,
    },
    { key: "city", header: "City", sortable: true, cell: (row) => <span className="text-xs">{row.city}</span> },
    {
      key: "segment",
      header: "Segment",
      sortable: true,
      cell: (row) => <StatusBadge status={row.segment} dot={false} />,
    },
    {
      key: "bookings_count",
      header: "Bookings",
      sortable: true,
      align: "right",
      cell: (row) => <span className="num text-xs">{fmtNumber(row.bookings_count)}</span>,
    },
    {
      key: "total_spent",
      header: "Lifetime value",
      sortable: true,
      align: "right",
      cell: (row) => (
        <span className="num text-xs font-semibold text-slate-800">{fmtMoney(row.total_spent)}</span>
      ),
    },
    {
      key: "joined_at",
      header: "Joined",
      sortable: true,
      cell: (row) => <span className="num text-xs whitespace-nowrap">{fmtDate(row.joined_at)}</span>,
    },
    {
      key: "status",
      header: "Account",
      sortable: true,
      cell: (row) => <StatusBadge status={row.status} data-testid={`customer-status-${row.id}`} />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger
            data-testid={`customer-actions-${row.id}`}
            onClick={(event) => event.stopPropagation()}
            className="grid size-7 place-items-center rounded text-slate-400 transition-colors duration-150 hover:bg-secondary hover:text-slate-700"
            aria-label={`Actions for ${row.name}`}
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem
              onClick={() => navigate(`/customers/${row.id}`)}
              data-testid={`customer-action-view-${row.id}`}
            >
              <UserRound className="size-4" /> Open customer
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setStatus.mutate({ id: row.id, value: "active" })}
              data-testid={`customer-action-activate-${row.id}`}
            >
              <CheckCircle2 className="size-4" /> Mark active
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setStatus.mutate({ id: row.id, value: "suspended" })}
              data-testid={`customer-action-suspend-${row.id}`}
            >
              <Ban className="size-4" /> Suspend account
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div data-testid="customers-page">
      <PageHeader
        title="Customers"
        count={data?.total}
        countLabel="records"
        subtitle="Every registered consumer account, their booking history and lifetime value."
        actions={
          <Button
            variant="outline"
            size="sm"
            className="bg-white"
            data-testid="customers-export-button"
            onClick={() => toast.info("Export queued — the CSV will be emailed to you")}
          >
            <Download className="size-3.5" /> Export CSV
          </Button>
        }
        testid="customers-header"
      />

      <Panel testid="customers-panel">
        <TableToolbar
          testid="customers"
          search={state.q}
          onSearch={state.setQ}
          searchPlaceholder="Search name, email, phone or ID"
          activeFilterCount={state.activeFilterCount}
          onReset={state.resetFilters}
          onRefresh={() => refetch()}
          filters={
            <>
              <FilterSelect
                label="Account status"
                testid="customers-filter-status"
                value={state.filters.status ?? "all"}
                onChange={(value) => state.setFilter("status", value)}
                options={facetOptions(facets?.status, "All statuses", titleCase)}
              />
              <FilterSelect
                label="Segment"
                testid="customers-filter-segment"
                value={state.filters.segment ?? "all"}
                onChange={(value) => state.setFilter("segment", value)}
                options={facetOptions(facets?.segment, "All segments", titleCase)}
              />
              <FilterSelect
                label="City"
                testid="customers-filter-city"
                value={state.filters.city ?? "all"}
                onChange={(value) => state.setFilter("city", value)}
                options={facetOptions(facets?.city, "All cities", (v) => v)}
              />
            </>
          }
        />

        <DataTable
          testid="customers-table"
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
          onRowClick={(row) => navigate(`/customers/${row.id}`)}
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
                data-testid="customers-bulk-activate"
              >
                <CheckCircle2 className="size-3.5" /> Activate
              </Button>
              <Button
                size="xs"
                variant="ghost"
                className="text-red-300 hover:bg-slate-800 hover:text-red-200"
                onClick={() => bulkStatus.mutate("suspended")}
                data-testid="customers-bulk-suspend"
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
