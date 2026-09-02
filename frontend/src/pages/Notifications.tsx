// Notification centre: severity-filtered feed with read/unread controls.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { PageHeader, Panel } from "@/components/admin/PageShell";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { FilterSelect, TableToolbar } from "@/components/admin/TableToolbar";
import { apiDelete, apiPatch } from "@/lib/api";
import { fmtDateTime, fmtRelative, titleCase } from "@/lib/format";
import { facetOptions, useFacets, useResourceList, useTableState } from "@/lib/table";
import type { AppNotification } from "@/lib/types";

export default function Notifications() {
  const queryClient = useQueryClient();
  const state = useTableState("created_at", "desc");
  const { data, isLoading, isError, refetch } = useResourceList<AppNotification>(
    "notifications",
    state,
  );
  const { data: facets } = useFacets("notifications");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["notifications"] });

  const setRead = useMutation({
    mutationFn: (vars: { id: string; value: boolean }) =>
      apiPatch<AppNotification>(`/notifications/${vars.id}`, { field: "read", value: vars.value }),
    onSuccess: () => invalidate(),
    onError: () => toast.error("Could not update this notification"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete<{ ok: boolean }>(`/notifications/${id}`),
    onSuccess: () => {
      toast.success("Notification dismissed");
      invalidate();
    },
    onError: () => toast.error("Could not dismiss this notification"),
  });

  const columns: Column<AppNotification>[] = [
    {
      key: "severity",
      header: "Severity",
      sortable: true,
      cell: (row) => (
        <StatusBadge status={row.severity} data-testid={`notification-severity-${row.id}`} />
      ),
    },
    {
      key: "title",
      header: "Notification",
      sortable: true,
      cell: (row) => (
        <div className="min-w-0 max-w-2xl">
          <p
            className={
              row.read
                ? "truncate text-[13px] font-medium text-slate-600"
                : "truncate text-[13px] font-bold text-slate-900"
            }
          >
            {row.title}
          </p>
          <p className="truncate text-[11px] text-slate-500">{row.body}</p>
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      sortable: true,
      cell: (row) => (
        <span className="rounded bg-secondary px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">
          {row.category}
        </span>
      ),
    },
    {
      key: "created_at",
      header: "Received",
      sortable: true,
      cell: (row) => (
        <span className="num text-xs whitespace-nowrap" title={fmtDateTime(row.created_at)}>
          {fmtRelative(row.created_at)}
        </span>
      ),
    },
    {
      key: "read",
      header: "State",
      sortable: true,
      cell: (row) => (
        <StatusBadge
          status={row.read ? "neutral" : "info"}
          label={row.read ? "Read" : "Unread"}
          data-testid={`notification-read-${row.id}`}
        />
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
            onClick={() => setRead.mutate({ id: row.id, value: !row.read })}
            data-testid={`notification-toggle-${row.id}`}
          >
            {row.read ? <BellOff className="size-3.5" /> : <Check className="size-3.5" />}
            {row.read ? "Mark unread" : "Mark read"}
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            className="text-slate-400 hover:text-destructive"
            onClick={() => remove.mutate(row.id)}
            data-testid={`notification-delete-${row.id}`}
            aria-label="Dismiss notification"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div data-testid="notifications-page">
      <PageHeader
        title="Notifications"
        count={data?.total}
        countLabel="items"
        subtitle="Platform alerts, compliance reminders and operational digests for the admin team."
        actions={
          <span className="hidden items-center gap-1.5 text-[11px] text-slate-500 sm:flex">
            <Bell className="size-3.5" /> Delivery preferences live in Settings
          </span>
        }
        testid="notifications-header"
      />

      <Panel testid="notifications-panel">
        <TableToolbar
          testid="notifications"
          search={state.q}
          onSearch={state.setQ}
          searchPlaceholder="Search notifications"
          activeFilterCount={state.activeFilterCount}
          onReset={state.resetFilters}
          onRefresh={() => refetch()}
          filters={
            <>
              <FilterSelect
                label="Severity"
                testid="notifications-filter-severity"
                value={state.filters.severity ?? "all"}
                onChange={(value) => state.setFilter("severity", value)}
                options={facetOptions(facets?.severity, "All severities", titleCase)}
              />
              <FilterSelect
                label="Category"
                testid="notifications-filter-category"
                value={state.filters.category ?? "all"}
                onChange={(value) => state.setFilter("category", value)}
                options={facetOptions(facets?.category, "All categories", (v) => v)}
              />
              <FilterSelect
                label="State"
                testid="notifications-filter-read"
                value={state.filters.read ?? "all"}
                onChange={(value) => state.setFilter("read", value)}
                options={[
                  { value: "all", label: "Read & unread" },
                  { value: "false", label: "Unread only" },
                  { value: "true", label: "Read only" },
                ]}
              />
            </>
          }
        />

        <DataTable
          testid="notifications-table"
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
        />
      </Panel>
    </div>
  );
}
