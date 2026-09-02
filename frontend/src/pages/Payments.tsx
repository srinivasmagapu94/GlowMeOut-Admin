// Finance view: settlement summary cards above a transaction table with status badges.
import { useQuery } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, RefreshCcw, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { PageHeader, Panel } from "@/components/admin/PageShell";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { FilterSelect, TableToolbar } from "@/components/admin/TableToolbar";
import { apiGet, apiPatch } from "@/lib/api";
import { downloadCsv } from "@/lib/download";
import { fmtCompactMoney, fmtDateTime, fmtMoneyPrecise, fmtNumber, titleCase } from "@/lib/format";
import { facetOptions, useFacets, useResourceList, useTableState } from "@/lib/table";
import type { DashboardSummary, Payment } from "@/lib/types";

export default function Payments() {
  const queryClient = useQueryClient();
  const state = useTableState("created_at", "desc");
  const { data, isLoading, isError, refetch } = useResourceList<Payment>("payments", state);
  const { data: facets } = useFacets("payments");

  const { data: summary } = useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: () => apiGet<DashboardSummary>("/dashboard/summary"),
    retry: false,
  });

  const gross = summary?.kpis.find((k) => k.key === "gross_volume")?.value ?? 0;
  const revenue = summary?.kpis.find((k) => k.key === "platform_revenue")?.value ?? 0;
  const failedPayouts =
    summary?.pending_actions.find((action) => action.id === "payouts")?.count ?? 0;

  const setStatus = useMutation({
    mutationFn: (vars: { id: string; field: string; value: string }) =>
      apiPatch<Payment>(`/payments/${vars.id}`, { field: vars.field, value: vars.value }),
    onSuccess: () => {
      toast.success("Transaction updated");
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    },
    onError: () => toast.error("Could not update this transaction"),
  });

  const cards = [
    {
      key: "gross",
      label: "Gross captured volume",
      value: fmtCompactMoney(gross),
      hint: "All successfully captured payments",
    },
    {
      key: "revenue",
      label: "Platform commission",
      value: fmtCompactMoney(revenue),
      hint: "Retained fee across captured payments",
    },
    {
      key: "payout",
      label: "Partner payouts",
      value: fmtCompactMoney(Math.max(0, gross - revenue)),
      hint: "Net amount owed to service partners",
    },
    {
      key: "failed",
      label: "Failed settlements",
      value: fmtNumber(failedPayouts),
      hint: "Payouts returned by the settlement bank",
      danger: failedPayouts > 0,
    },
  ];

  const columns: Column<Payment>[] = [
    {
      key: "code",
      header: "Transaction",
      sortable: true,
      cell: (row) => <span className="num text-xs font-semibold text-primary">{row.code}</span>,
    },
    {
      key: "booking_code",
      header: "Booking",
      sortable: true,
      cell: (row) => <span className="num text-xs text-slate-600">{row.booking_code}</span>,
    },
    {
      key: "customer_name",
      header: "Customer",
      sortable: true,
      cell: (row) => <span className="text-xs font-medium text-slate-800">{row.customer_name}</span>,
    },
    {
      key: "partner_name",
      header: "Partner",
      sortable: true,
      cell: (row) => <span className="text-xs">{row.partner_name}</span>,
    },
    {
      key: "method",
      header: "Method",
      sortable: true,
      cell: (row) => <span className="text-[11px] text-slate-600">{row.method}</span>,
    },
    {
      key: "amount",
      header: "Gross",
      sortable: true,
      align: "right",
      cell: (row) => (
        <span className="num text-xs font-semibold text-slate-900">{fmtMoneyPrecise(row.amount)}</span>
      ),
    },
    {
      key: "platform_fee",
      header: "Commission",
      sortable: true,
      align: "right",
      cell: (row) => <span className="num text-xs text-slate-600">{fmtMoneyPrecise(row.platform_fee)}</span>,
    },
    {
      key: "partner_payout",
      header: "Partner payout",
      sortable: true,
      align: "right",
      cell: (row) => <span className="num text-xs text-slate-700">{fmtMoneyPrecise(row.partner_payout)}</span>,
    },
    {
      key: "status",
      header: "Payment",
      sortable: true,
      cell: (row) => <StatusBadge status={row.status} data-testid={`payment-status-${row.id}`} />,
    },
    {
      key: "settlement_status",
      header: "Settlement",
      sortable: true,
      cell: (row) => <StatusBadge status={row.settlement_status} />,
    },
    {
      key: "created_at",
      header: "Captured",
      sortable: true,
      cell: (row) => <span className="num text-xs whitespace-nowrap">{fmtDateTime(row.created_at)}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="xs"
            variant="outline"
            className="bg-white"
            onClick={() => setStatus.mutate({ id: row.id, field: "settlement_status", value: "settled" })}
            data-testid={`payment-settle-${row.id}`}
          >
            <Wallet className="size-3.5" /> Settle
          </Button>
          <Button
            size="xs"
            variant="outline"
            className="bg-white"
            onClick={() => setStatus.mutate({ id: row.id, field: "status", value: "refunded" })}
            data-testid={`payment-refund-${row.id}`}
          >
            <RefreshCcw className="size-3.5" /> Refund
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div data-testid="payments-page">
      <PageHeader
        title="Payments & settlements"
        count={data?.total}
        countLabel="transactions"
        subtitle="Captured payments, retained commission and the partner payout position."
        actions={
          <Button
            variant="outline"
            size="sm"
            className="bg-white"
            data-testid="payments-export-button"
            onClick={() => {
              downloadCsv("payments", state.queryString);
              toast.success("Export started — the CSV covers every row matching your filters");
            }}
          >
            <Download className="size-3.5" /> Export ledger
          </Button>
        }
        testid="payments-header"
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.key}
            data-testid={`payments-card-${card.key}`}
            className="rounded-lg border border-grid bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-[border-color] duration-200 hover:border-primary/30"
          >
            <p className="eyebrow text-slate-400">{card.label}</p>
            <p
              className={
                card.danger
                  ? "num mt-2 text-[26px] leading-none font-bold text-destructive"
                  : "num mt-2 text-[26px] leading-none font-bold text-slate-900"
              }
            >
              {card.value}
            </p>
            <p className="mt-2 text-[11px] text-slate-500">{card.hint}</p>
          </div>
        ))}
      </div>

      <Panel testid="payments-panel">
        <TableToolbar
          testid="payments"
          search={state.q}
          onSearch={state.setQ}
          searchPlaceholder="Search transaction, booking, customer or partner"
          activeFilterCount={state.activeFilterCount}
          onReset={state.resetFilters}
          onRefresh={() => refetch()}
          filters={
            <>
              <FilterSelect
                label="Payment status"
                testid="payments-filter-status"
                value={state.filters.status ?? "all"}
                onChange={(value) => state.setFilter("status", value)}
                options={facetOptions(facets?.status, "All payments", titleCase)}
              />
              <FilterSelect
                label="Settlement"
                testid="payments-filter-settlement"
                value={state.filters.settlement_status ?? "all"}
                onChange={(value) => state.setFilter("settlement_status", value)}
                options={facetOptions(facets?.settlement_status, "All settlements", titleCase)}
              />
              <FilterSelect
                label="Method"
                testid="payments-filter-method"
                value={state.filters.method ?? "all"}
                onChange={(value) => state.setFilter("method", value)}
                options={facetOptions(facets?.method, "All methods", (v) => v)}
              />
            </>
          }
        />

        <DataTable
          testid="payments-table"
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
        />
      </Panel>
    </div>
  );
}
