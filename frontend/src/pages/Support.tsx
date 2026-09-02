// Support & disputes: priority-driven ops queue with assignment and a ticket detail sheet.
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Headphones, Scale, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { apiPatch } from "@/lib/api";
import { fmtDateTime, fmtMoney, fmtRelative, titleCase } from "@/lib/format";
import { facetOptions, useFacets, useResourceList, useTableState } from "@/lib/table";
import type { Ticket } from "@/lib/types";

const AGENTS = [
  "Nadia Farooqui",
  "Tomas Vega",
  "Priya Balan",
  "Owen Whitaker",
  "Chitra Menon",
  "Unassigned",
];

export default function Support() {
  const queryClient = useQueryClient();
  const state = useTableState("created_at", "desc");
  const [active, setActive] = useState<Ticket | null>(null);

  const { data, isLoading, isError, refetch } = useResourceList<Ticket>("tickets", state);
  const { data: facets } = useFacets("tickets");

  const patchTicket = useMutation({
    mutationFn: (vars: { id: string; field: string; value: string }) =>
      apiPatch<Ticket>(`/tickets/${vars.id}`, { field: vars.field, value: vars.value }),
    onSuccess: (updated) => {
      toast.success("Ticket updated");
      setActive((current) => (current && current.id === updated.id ? updated : current));
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
    onError: () => toast.error("Could not update this ticket"),
  });

  const columns: Column<Ticket>[] = [
    {
      key: "code",
      header: "Ticket",
      sortable: true,
      cell: (row) => <span className="num text-xs font-semibold text-primary">{row.code}</span>,
    },
    {
      key: "priority",
      header: "Priority",
      sortable: true,
      cell: (row) => <StatusBadge status={row.priority} data-testid={`ticket-priority-${row.id}`} />,
    },
    {
      key: "subject",
      header: "Subject",
      sortable: true,
      cell: (row) => (
        <div className="min-w-0 max-w-md">
          <p className="truncate text-[13px] font-semibold text-slate-900">{row.subject}</p>
          <p className="truncate text-[11px] text-slate-500">{row.category}</p>
        </div>
      ),
    },
    {
      key: "kind",
      header: "Type",
      sortable: true,
      cell: (row) => (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600">
          {row.kind === "dispute" ? (
            <Scale className="size-3.5 text-amber-600" />
          ) : (
            <Headphones className="size-3.5 text-blue-600" />
          )}
          {titleCase(row.kind)}
        </span>
      ),
    },
    {
      key: "requester_name",
      header: "Requester",
      sortable: true,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-slate-800">{row.requester_name}</p>
          <p className="truncate text-[10px] text-slate-500">{row.requester_type}</p>
        </div>
      ),
    },
    {
      key: "amount_disputed",
      header: "Disputed",
      sortable: true,
      align: "right",
      cell: (row) => (
        <span className="num text-xs">
          {row.amount_disputed > 0 ? fmtMoney(row.amount_disputed) : "—"}
        </span>
      ),
    },
    {
      key: "assignee",
      header: "Assignee",
      sortable: true,
      cell: (row) => (
        <span
          className={
            row.assignee === "Unassigned"
              ? "text-[11px] font-semibold text-amber-700"
              : "text-xs text-slate-700"
          }
        >
          {row.assignee}
        </span>
      ),
    },
    {
      key: "created_at",
      header: "Raised",
      sortable: true,
      cell: (row) => (
        <span className="num text-xs whitespace-nowrap" title={fmtDateTime(row.created_at)}>
          {fmtRelative(row.created_at)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      cell: (row) => <StatusBadge status={row.status} data-testid={`ticket-status-${row.id}`} />,
    },
  ];

  return (
    <div data-testid="support-page">
      <PageHeader
        title="Support & disputes"
        count={data?.total}
        countLabel="tickets"
        subtitle="Customer and partner escalations, ordered so the highest-priority work surfaces first."
        testid="support-header"
      />

      <Panel testid="support-panel">
        <TableToolbar
          testid="tickets"
          search={state.q}
          onSearch={state.setQ}
          searchPlaceholder="Search ticket, subject or requester"
          activeFilterCount={state.activeFilterCount}
          onReset={state.resetFilters}
          onRefresh={() => refetch()}
          filters={
            <>
              <FilterSelect
                label="Status"
                testid="tickets-filter-status"
                value={state.filters.status ?? "all"}
                onChange={(value) => state.setFilter("status", value)}
                options={facetOptions(facets?.status, "All statuses", titleCase)}
              />
              <FilterSelect
                label="Priority"
                testid="tickets-filter-priority"
                value={state.filters.priority ?? "all"}
                onChange={(value) => state.setFilter("priority", value)}
                options={facetOptions(facets?.priority, "All priorities", titleCase)}
              />
              <FilterSelect
                label="Type"
                testid="tickets-filter-kind"
                value={state.filters.kind ?? "all"}
                onChange={(value) => state.setFilter("kind", value)}
                options={facetOptions(facets?.kind, "Support & disputes", titleCase)}
              />
              <FilterSelect
                label="Assignee"
                testid="tickets-filter-assignee"
                value={state.filters.assignee ?? "all"}
                onChange={(value) => state.setFilter("assignee", value)}
                options={facetOptions(facets?.assignee, "All assignees", (v) => v)}
              />
            </>
          }
        />

        <DataTable
          testid="tickets-table"
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
          onRowClick={(row) => setActive(row)}
          activeRowId={active?.id}
        />
      </Panel>

      <Sheet open={active !== null} onOpenChange={(open) => !open && setActive(null)}>
        <SheetContent className="w-full sm:max-w-md" data-testid="ticket-detail-sheet">
          <SheetHeader>
            <SheetTitle className="num text-base">{active?.code ?? "Ticket"}</SheetTitle>
            <SheetDescription className="text-xs">{active?.subject ?? ""}</SheetDescription>
          </SheetHeader>
          {active ? (
            <div className="space-y-4 overflow-y-auto px-4 pb-6">
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusBadge status={active.status} data-testid="ticket-detail-status" />
                <StatusBadge status={active.priority} />
                <StatusBadge status={active.kind === "dispute" ? "warning" : "info"} dot={false} label={titleCase(active.kind)} />
              </div>

              <p className="rounded-md bg-secondary/60 p-3 text-[12px] leading-relaxed text-slate-700" data-testid="ticket-detail-body">
                {active.body}
              </p>

              <div>
                <FieldRow label="Requester" testid="ticket-detail-requester">
                  {active.requester_name} · {active.requester_type}
                </FieldRow>
                <FieldRow label="Category">{active.category}</FieldRow>
                <FieldRow label="Assignee">{active.assignee}</FieldRow>
                {active.amount_disputed > 0 ? (
                  <FieldRow label="Amount disputed">
                    <span className="num font-semibold">{fmtMoney(active.amount_disputed)}</span>
                  </FieldRow>
                ) : null}
                <FieldRow label="Raised">
                  <span className="num">{fmtDateTime(active.created_at)}</span>
                </FieldRow>
                <FieldRow label="Last update">
                  <span className="num">{fmtDateTime(active.updated_at)}</span>
                </FieldRow>
              </div>

              <div className="space-y-2 border-t border-grid pt-3">
                <p className="eyebrow text-slate-400">Assign to</p>
                <FilterSelect
                  label="Assignee"
                  testid="ticket-detail-assignee-select"
                  value={active.assignee}
                  onChange={(value) =>
                    patchTicket.mutate({ id: active.id, field: "assignee", value })
                  }
                  options={AGENTS.map((agent) => ({ value: agent, label: agent }))}
                  className="w-full"
                />
              </div>

              <div className="flex flex-wrap gap-2 border-t border-grid pt-3">
                <Button
                  size="xs"
                  variant="outline"
                  className="bg-white"
                  onClick={() => patchTicket.mutate({ id: active.id, field: "status", value: "in_progress" })}
                  data-testid="ticket-detail-progress"
                >
                  <UserCheck className="size-3.5" /> Start work
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  className="bg-white"
                  onClick={() => patchTicket.mutate({ id: active.id, field: "priority", value: "urgent" })}
                  data-testid="ticket-detail-escalate"
                >
                  Escalate to urgent
                </Button>
                <Button
                  size="xs"
                  onClick={() => patchTicket.mutate({ id: active.id, field: "status", value: "resolved" })}
                  data-testid="ticket-detail-resolve"
                >
                  <CheckCircle2 className="size-3.5" /> Resolve
                </Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
