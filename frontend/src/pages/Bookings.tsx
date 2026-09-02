// Booking management: dense table with date range + status filters and a detail sheet.
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarRange, CheckCircle2, Download, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { FieldRow, PageHeader, Panel } from "@/components/admin/PageShell";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { FilterSelect, TableToolbar } from "@/components/admin/TableToolbar";
import { apiPatch, apiPost } from "@/lib/api";
import { downloadCsv } from "@/lib/download";
import { fmtDate, fmtDateTime, fmtMoney, titleCase } from "@/lib/format";
import { facetOptions, useFacets, useResourceList, useTableState } from "@/lib/table";
import type { Booking } from "@/lib/types";

export default function Bookings() {
  const queryClient = useQueryClient();
  const state = useTableState("scheduled_date", "desc");
  const [active, setActive] = useState<Booking | null>(null);

  // date bounds ride the same query contract as every other filter
  const dateFrom = state.filters.date_from ?? "";
  const dateTo = state.filters.date_to ?? "";

  const { data, isLoading, isError, refetch } = useResourceList<Booking>("bookings", state);
  const { data: facets } = useFacets("bookings");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["bookings"] });

  const setStatus = useMutation({
    mutationFn: (vars: { id: string; value: string }) =>
      apiPatch<Booking>(`/bookings/${vars.id}`, { field: "status", value: vars.value }),
    onSuccess: (updated, vars) => {
      toast.success(`Booking marked ${titleCase(vars.value).toLowerCase()}`);
      setActive((current) => (current && current.id === vars.id ? updated : current));
      invalidate();
    },
    onError: () => toast.error("Could not update this booking"),
  });

  const bulkStatus = useMutation({
    mutationFn: (value: string) =>
      apiPost<{ updated: number }>("/bookings/bulk", {
        ids: state.selected,
        field: "status",
        value,
      }),
    onSuccess: (result, value) => {
      toast.success(`${result.updated} bookings marked ${titleCase(value).toLowerCase()}`);
      state.setSelected([]);
      invalidate();
    },
    onError: () => toast.error("Bulk update failed"),
  });

  const columns: Column<Booking>[] = [
    {
      key: "code",
      header: "Booking",
      sortable: true,
      cell: (row) => <span className="num text-xs font-semibold text-primary">{row.code}</span>,
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
      key: "service_name",
      header: "Service",
      sortable: true,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-slate-800">{row.service_name}</p>
          <p className="truncate text-[10px] text-slate-500">{row.category}</p>
        </div>
      ),
    },
    { key: "city", header: "City", sortable: true, cell: (row) => <span className="text-xs">{row.city}</span> },
    {
      key: "scheduled_date",
      header: "Scheduled",
      sortable: true,
      cell: (row) => (
        <div className="whitespace-nowrap">
          <p className="num text-xs font-medium text-slate-800">{fmtDate(row.scheduled_date)}</p>
          <p className="num text-[10px] text-slate-500">{row.scheduled_slot}</p>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      sortable: true,
      align: "right",
      cell: (row) => <span className="num text-xs font-semibold text-slate-800">{fmtMoney(row.amount)}</span>,
    },
    {
      key: "payment_status",
      header: "Payment",
      sortable: true,
      cell: (row) => <StatusBadge status={row.payment_status} />,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      cell: (row) => <StatusBadge status={row.status} data-testid={`booking-status-${row.id}`} />,
    },
    {
      key: "channel",
      header: "Channel",
      sortable: true,
      cell: (row) => <span className="text-[11px] text-slate-500">{row.channel}</span>,
    },
  ];

  return (
    <div data-testid="bookings-page">
      <PageHeader
        title="Bookings"
        count={data?.total}
        countLabel="records"
        subtitle="Every appointment on the platform — scheduled, in progress, completed or disputed."
        actions={
          <Button
            variant="outline"
            size="sm"
            className="bg-white"
            data-testid="bookings-export-button"
            onClick={() => {
              downloadCsv("bookings", state.queryString);
              toast.success("Export started — the CSV covers every row matching your filters");
            }}
          >
            <Download className="size-3.5" /> Export CSV
          </Button>
        }
        testid="bookings-header"
      />

      <Panel testid="bookings-panel">
        <TableToolbar
          testid="bookings"
          search={state.q}
          onSearch={state.setQ}
          searchPlaceholder="Search booking, customer, partner or service"
          activeFilterCount={state.activeFilterCount}
          onReset={state.resetFilters}
          onRefresh={() => refetch()}
          filters={
            <>
              <FilterSelect
                label="Status"
                testid="bookings-filter-status"
                value={state.filters.status ?? "all"}
                onChange={(value) => state.setFilter("status", value)}
                options={facetOptions(facets?.status, "All statuses", titleCase)}
              />
              <FilterSelect
                label="Payment"
                testid="bookings-filter-payment"
                value={state.filters.payment_status ?? "all"}
                onChange={(value) => state.setFilter("payment_status", value)}
                options={facetOptions(facets?.payment_status, "All payments", titleCase)}
              />
              <FilterSelect
                label="Category"
                testid="bookings-filter-category"
                value={state.filters.category ?? "all"}
                onChange={(value) => state.setFilter("category", value)}
                options={facetOptions(facets?.category, "All categories", (v) => v)}
              />
              <div className="flex items-center gap-1.5">
                <CalendarRange className="size-3.5 text-slate-400" />
                <Label htmlFor="bookings-date-from" className="sr-only">
                  From date
                </Label>
                <Input
                  id="bookings-date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(event) => state.setFilter("date_from", event.target.value)}
                  data-testid="bookings-filter-date-from"
                  className="h-8 w-[8.5rem] bg-white text-xs"
                />
                <span className="text-xs text-slate-400">to</span>
                <Label htmlFor="bookings-date-to" className="sr-only">
                  To date
                </Label>
                <Input
                  id="bookings-date-to"
                  type="date"
                  value={dateTo}
                  onChange={(event) => state.setFilter("date_to", event.target.value)}
                  data-testid="bookings-filter-date-to"
                  className="h-8 w-[8.5rem] bg-white text-xs"
                />
              </div>
            </>
          }
        />

        <DataTable
          testid="bookings-table"
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
          onRowClick={(row) => setActive(row)}
          activeRowId={active?.id}
          selectable
          selected={state.selected}
          onSelectedChange={state.setSelected}
          bulkActions={
            <>
              <Button
                size="xs"
                variant="ghost"
                className="text-emerald-300 hover:bg-slate-800 hover:text-emerald-200"
                onClick={() => bulkStatus.mutate("completed")}
                data-testid="bookings-bulk-complete"
              >
                <CheckCircle2 className="size-3.5" /> Mark completed
              </Button>
              <Button
                size="xs"
                variant="ghost"
                className="text-red-300 hover:bg-slate-800 hover:text-red-200"
                onClick={() => bulkStatus.mutate("cancelled")}
                data-testid="bookings-bulk-cancel"
              >
                <XCircle className="size-3.5" /> Cancel
              </Button>
            </>
          }
        />
      </Panel>

      <Sheet open={active !== null} onOpenChange={(open) => !open && setActive(null)}>
        <SheetContent className="w-full sm:max-w-md" data-testid="booking-detail-sheet">
          <SheetHeader>
            <SheetTitle className="num text-base">{active?.code ?? "Booking"}</SheetTitle>
            <SheetDescription className="text-xs">
              {active ? `${active.service_name} · ${active.category}` : ""}
            </SheetDescription>
          </SheetHeader>
          {active ? (
            <div className="space-y-4 overflow-y-auto px-4 pb-6">
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusBadge status={active.status} data-testid="booking-detail-status" />
                <StatusBadge status={active.payment_status} />
              </div>

              <div>
                <FieldRow label="Customer" testid="booking-detail-customer">
                  {active.customer_name}
                </FieldRow>
                <FieldRow label="Partner">{active.partner_name}</FieldRow>
                <FieldRow label="Service">{active.service_name}</FieldRow>
                <FieldRow label="Scheduled">
                  <span className="num">
                    {fmtDate(active.scheduled_date)} · {active.scheduled_slot}
                  </span>
                </FieldRow>
                <FieldRow label="Service address">{active.address || "—"}</FieldRow>
                <FieldRow label="City">{active.city}</FieldRow>
                <FieldRow label="Amount" testid="booking-detail-amount">
                  <span className="num font-semibold">{fmtMoney(active.amount)}</span>
                </FieldRow>
                <FieldRow label="Booking channel">{active.channel}</FieldRow>
                <FieldRow label="Created">
                  <span className="num">{fmtDateTime(active.created_at)}</span>
                </FieldRow>
                <FieldRow label="Operator notes">{active.notes || "No notes recorded."}</FieldRow>
              </div>

              <div className="flex flex-wrap gap-2 border-t border-grid pt-3">
                <Button
                  size="xs"
                  variant="outline"
                  className="bg-white"
                  onClick={() => setStatus.mutate({ id: active.id, value: "completed" })}
                  data-testid="booking-detail-complete"
                >
                  <CheckCircle2 className="size-3.5" /> Mark completed
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  className="bg-white"
                  onClick={() => setStatus.mutate({ id: active.id, value: "upcoming" })}
                  data-testid="booking-detail-reschedule"
                >
                  Reopen as upcoming
                </Button>
                <Button
                  size="xs"
                  variant="destructive"
                  onClick={() => setStatus.mutate({ id: active.id, value: "cancelled" })}
                  data-testid="booking-detail-cancel"
                >
                  <XCircle className="size-3.5" /> Cancel booking
                </Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
