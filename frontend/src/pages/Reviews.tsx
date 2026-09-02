// Review moderation: rating filters, status controls and bulk moderation actions.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Flag, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { PageHeader, Panel } from "@/components/admin/PageShell";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { FilterSelect, TableToolbar } from "@/components/admin/TableToolbar";
import { apiPatch, apiPost } from "@/lib/api";
import { fmtDate, titleCase } from "@/lib/format";
import { facetOptions, useFacets, useResourceList, useTableState } from "@/lib/table";
import type { Review } from "@/lib/types";

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          className={
            index < rating
              ? "size-3.5 fill-amber-400 text-amber-400"
              : "size-3.5 fill-slate-200 text-slate-200"
          }
        />
      ))}
      <span className="num ml-1 text-xs font-semibold text-slate-700">{rating}.0</span>
    </span>
  );
}

export default function Reviews() {
  const queryClient = useQueryClient();
  const state = useTableState("created_at", "desc");
  const { data, isLoading, isError, refetch } = useResourceList<Review>("reviews", state);
  const { data: facets } = useFacets("reviews");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["reviews"] });

  const setStatus = useMutation({
    mutationFn: (vars: { id: string; value: string }) =>
      apiPatch<Review>(`/reviews/${vars.id}`, { field: "status", value: vars.value }),
    onSuccess: (_, vars) => {
      toast.success(`Review ${titleCase(vars.value).toLowerCase()}`);
      invalidate();
    },
    onError: () => toast.error("Could not moderate this review"),
  });

  const bulkStatus = useMutation({
    mutationFn: (value: string) =>
      apiPost<{ updated: number }>("/reviews/bulk", {
        ids: state.selected,
        field: "status",
        value,
      }),
    onSuccess: (result, value) => {
      toast.success(`${result.updated} reviews ${titleCase(value).toLowerCase()}`);
      state.setSelected([]);
      invalidate();
    },
    onError: () => toast.error("Bulk moderation failed"),
  });

  const columns: Column<Review>[] = [
    {
      key: "code",
      header: "Review",
      sortable: true,
      cell: (row) => <span className="num text-xs font-semibold text-primary">{row.code}</span>,
    },
    {
      key: "rating",
      header: "Rating",
      sortable: true,
      cell: (row) => <Stars rating={row.rating} />,
    },
    {
      key: "title",
      header: "Feedback",
      sortable: true,
      cell: (row) => (
        <div className="min-w-0 max-w-md">
          <p className="truncate text-[13px] font-semibold text-slate-900">{row.title}</p>
          <p className="truncate text-[11px] text-slate-500">{row.body}</p>
        </div>
      ),
    },
    {
      key: "customer_name",
      header: "Customer",
      sortable: true,
      cell: (row) => <span className="text-xs">{row.customer_name}</span>,
    },
    {
      key: "partner_name",
      header: "Partner",
      sortable: true,
      cell: (row) => <span className="text-xs font-medium text-slate-800">{row.partner_name}</span>,
    },
    {
      key: "service_name",
      header: "Service",
      cell: (row) => <span className="text-xs">{row.service_name}</span>,
    },
    {
      key: "created_at",
      header: "Submitted",
      sortable: true,
      cell: (row) => <span className="num text-xs whitespace-nowrap">{fmtDate(row.created_at)}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      cell: (row) => (
        <div className="flex flex-col gap-1">
          <StatusBadge status={row.status} data-testid={`review-status-${row.id}`} />
          {row.flagged_reason ? (
            <span className="text-[10px] text-slate-400">{row.flagged_reason}</span>
          ) : null}
        </div>
      ),
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
            onClick={() => setStatus.mutate({ id: row.id, value: "published" })}
            data-testid={`review-publish-${row.id}`}
          >
            <CheckCircle2 className="size-3.5" /> Publish
          </Button>
          <Button
            size="xs"
            variant="outline"
            className="bg-white"
            onClick={() => setStatus.mutate({ id: row.id, value: "flagged" })}
            data-testid={`review-flag-${row.id}`}
          >
            <Flag className="size-3.5" /> Flag
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            className="text-slate-400 hover:text-destructive"
            onClick={() => setStatus.mutate({ id: row.id, value: "removed" })}
            data-testid={`review-remove-${row.id}`}
            aria-label="Remove review"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div data-testid="reviews-page">
      <PageHeader
        title="Reviews"
        count={data?.total}
        countLabel="reviews"
        subtitle="Customer feedback awaiting moderation, published ratings and flagged content."
        testid="reviews-header"
      />

      <Panel testid="reviews-panel">
        <TableToolbar
          testid="reviews"
          search={state.q}
          onSearch={state.setQ}
          searchPlaceholder="Search review text, customer or partner"
          activeFilterCount={state.activeFilterCount}
          onReset={state.resetFilters}
          onRefresh={() => refetch()}
          filters={
            <>
              <FilterSelect
                label="Status"
                testid="reviews-filter-status"
                value={state.filters.status ?? "all"}
                onChange={(value) => state.setFilter("status", value)}
                options={facetOptions(facets?.status, "All statuses", titleCase)}
              />
              <FilterSelect
                label="Rating"
                testid="reviews-filter-rating"
                value={state.filters.rating ?? "all"}
                onChange={(value) => state.setFilter("rating", value)}
                options={[
                  { value: "all", label: "All ratings" },
                  { value: "5", label: "5 stars" },
                  { value: "4", label: "4 stars" },
                  { value: "3", label: "3 stars" },
                  { value: "2", label: "2 stars" },
                  { value: "1", label: "1 star" },
                ]}
              />
            </>
          }
        />

        <DataTable
          testid="reviews-table"
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
          selectable
          selected={state.selected}
          onSelectedChange={state.setSelected}
          bulkActions={
            <>
              <Button
                size="xs"
                variant="ghost"
                className="text-emerald-300 hover:bg-slate-800 hover:text-emerald-200"
                onClick={() => bulkStatus.mutate("published")}
                data-testid="reviews-bulk-publish"
              >
                <CheckCircle2 className="size-3.5" /> Publish
              </Button>
              <Button
                size="xs"
                variant="ghost"
                className="text-red-300 hover:bg-slate-800 hover:text-red-200"
                onClick={() => bulkStatus.mutate("removed")}
                data-testid="reviews-bulk-remove"
              >
                <Trash2 className="size-3.5" /> Remove
              </Button>
            </>
          }
        />
      </Panel>
    </div>
  );
}
