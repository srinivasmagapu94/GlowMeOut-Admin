// Offers & coupons: campaign table plus a create form with usage tracking.
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pause, Play, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { PageHeader, Panel } from "@/components/admin/PageShell";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { FilterSelect, TableToolbar } from "@/components/admin/TableToolbar";
import { ApiError, apiDelete, apiPatch, apiPost } from "@/lib/api";
import { fmtDate, fmtMoney, fmtNumber, titleCase } from "@/lib/format";
import { facetOptions, useFacets, useResourceList, useTableState } from "@/lib/table";
import type { Offer } from "@/lib/types";

const today = () => new Date().toISOString().slice(0, 10);
const inDays = (days: number) =>
  new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

export default function Offers() {
  const queryClient = useQueryClient();
  const state = useTableState("starts_at", "desc");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    code: "",
    title: "",
    description: "",
    discount_type: "percent",
    discount_value: "15",
    min_order: "0",
    audience: "All customers",
    starts_at: today(),
    ends_at: inDays(30),
    usage_limit: "500",
  });

  const { data, isLoading, isError, refetch } = useResourceList<Offer>("offers", state);
  const { data: facets } = useFacets("offers");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["offers"] });

  const createOffer = useMutation({
    mutationFn: () =>
      apiPost<Offer>("/offers", {
        code: form.code.trim().toUpperCase(),
        title: form.title.trim(),
        description: form.description.trim(),
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        min_order: Number(form.min_order),
        audience: form.audience,
        starts_at: form.starts_at,
        ends_at: form.ends_at,
        usage_limit: Number(form.usage_limit),
        status: form.starts_at > today() ? "scheduled" : "active",
      }),
    onSuccess: () => {
      toast.success("Coupon created");
      setOpen(false);
      setForm({ ...form, code: "", title: "" });
      invalidate();
    },
    onError: (err) =>
      toast.error(
        err instanceof ApiError && err.status === 409
          ? "That coupon code already exists"
          : "Could not create this coupon",
      ),
  });

  const patchOffer = useMutation({
    mutationFn: (vars: { id: string; field: string; value: string }) =>
      apiPatch<Offer>(`/offers/${vars.id}`, { field: vars.field, value: vars.value }),
    onSuccess: () => {
      toast.success("Coupon updated");
      invalidate();
    },
    onError: () => toast.error("Could not update this coupon"),
  });

  const removeOffer = useMutation({
    mutationFn: (id: string) => apiDelete<{ ok: boolean }>(`/offers/${id}`),
    onSuccess: () => {
      toast.success("Coupon removed");
      invalidate();
    },
    onError: () => toast.error("Could not remove this coupon"),
  });

  const columns: Column<Offer>[] = [
    {
      key: "code",
      header: "Code",
      sortable: true,
      cell: (row) => (
        <span className="num rounded bg-secondary px-1.5 py-0.5 text-xs font-bold text-primary">
          {row.code}
        </span>
      ),
    },
    {
      key: "title",
      header: "Campaign",
      sortable: true,
      cell: (row) => (
        <div className="min-w-0 max-w-sm">
          <p className="truncate text-[13px] font-semibold text-slate-900">{row.title}</p>
          <p className="truncate text-[11px] text-slate-500">{row.description}</p>
        </div>
      ),
    },
    {
      key: "discount_value",
      header: "Discount",
      sortable: true,
      align: "right",
      cell: (row) => (
        <span className="num text-xs font-semibold text-slate-800">
          {row.discount_type === "percent" ? `${row.discount_value}%` : fmtMoney(row.discount_value)}
        </span>
      ),
    },
    {
      key: "min_order",
      header: "Min order",
      sortable: true,
      align: "right",
      cell: (row) => (
        <span className="num text-xs">{row.min_order > 0 ? fmtMoney(row.min_order) : "—"}</span>
      ),
    },
    {
      key: "audience",
      header: "Audience",
      sortable: true,
      cell: (row) => <span className="text-[11px] text-slate-600">{row.audience}</span>,
    },
    {
      key: "starts_at",
      header: "Starts",
      sortable: true,
      cell: (row) => <span className="num text-xs whitespace-nowrap">{fmtDate(row.starts_at)}</span>,
    },
    {
      key: "ends_at",
      header: "Ends",
      sortable: true,
      cell: (row) => <span className="num text-xs whitespace-nowrap">{fmtDate(row.ends_at)}</span>,
    },
    {
      key: "usage_count",
      header: "Usage",
      sortable: true,
      align: "right",
      cell: (row) => {
        const pct = row.usage_limit ? Math.min(100, (row.usage_count / row.usage_limit) * 100) : 0;
        return (
          <div className="ml-auto w-28">
            <p className="num text-right text-xs text-slate-700">
              {fmtNumber(row.usage_count)} / {fmtNumber(row.usage_limit)}
            </p>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-secondary">
              <div
                className={pct > 90 ? "h-full bg-amber-500" : "h-full bg-primary"}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      cell: (row) => <StatusBadge status={row.status} data-testid={`offer-status-${row.id}`} />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          {row.status === "active" ? (
            <Button
              size="xs"
              variant="outline"
              className="bg-white"
              onClick={() => patchOffer.mutate({ id: row.id, field: "status", value: "paused" })}
              data-testid={`offer-pause-${row.id}`}
            >
              <Pause className="size-3.5" /> Pause
            </Button>
          ) : (
            <Button
              size="xs"
              variant="outline"
              className="bg-white"
              onClick={() => patchOffer.mutate({ id: row.id, field: "status", value: "active" })}
              data-testid={`offer-activate-${row.id}`}
            >
              <Play className="size-3.5" /> Activate
            </Button>
          )}
          <Button
            size="icon-xs"
            variant="ghost"
            className="text-slate-400 hover:text-destructive"
            onClick={() => removeOffer.mutate(row.id)}
            data-testid={`offer-delete-${row.id}`}
            aria-label={`Delete ${row.code}`}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div data-testid="offers-page">
      <PageHeader
        title="Offers & coupons"
        count={data?.total}
        countLabel="campaigns"
        subtitle="Promotional codes, their eligibility windows and how much of each allocation is consumed."
        actions={
          <Button size="sm" onClick={() => setOpen(true)} data-testid="offers-add-button">
            <Plus className="size-3.5" /> Create coupon
          </Button>
        }
        testid="offers-header"
      />

      <Panel testid="offers-panel">
        <TableToolbar
          testid="offers"
          search={state.q}
          onSearch={state.setQ}
          searchPlaceholder="Search code, campaign or audience"
          activeFilterCount={state.activeFilterCount}
          onReset={state.resetFilters}
          onRefresh={() => refetch()}
          filters={
            <>
              <FilterSelect
                label="Status"
                testid="offers-filter-status"
                value={state.filters.status ?? "all"}
                onChange={(value) => state.setFilter("status", value)}
                options={facetOptions(facets?.status, "All statuses", titleCase)}
              />
              <FilterSelect
                label="Discount type"
                testid="offers-filter-type"
                value={state.filters.discount_type ?? "all"}
                onChange={(value) => state.setFilter("discount_type", value)}
                options={facetOptions(facets?.discount_type, "All types", titleCase)}
              />
            </>
          }
        />

        <DataTable
          testid="offers-table"
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg" data-testid="offer-create-dialog">
          <DialogHeader>
            <DialogTitle className="text-base">Create a coupon</DialogTitle>
            <DialogDescription className="text-xs">
              Codes are applied automatically at checkout for customers who meet the audience rule.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="offer-code" className="text-xs font-semibold text-slate-700">
                Coupon code
              </Label>
              <Input
                id="offer-code"
                value={form.code}
                onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
                placeholder="GMOGLOW25"
                data-testid="offer-form-code"
                className="num bg-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="offer-audience" className="text-xs font-semibold text-slate-700">
                Audience
              </Label>
              <FilterSelect
                label="Audience"
                testid="offer-form-audience"
                value={form.audience}
                onChange={(value) => setForm({ ...form, audience: value })}
                options={[
                  { value: "All customers", label: "All customers" },
                  { value: "New customers", label: "New customers" },
                  { value: "VIP segment", label: "VIP segment" },
                  { value: "Lapsed customers", label: "Lapsed customers" },
                ]}
                className="h-9 w-full"
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="offer-title" className="text-xs font-semibold text-slate-700">
                Campaign name
              </Label>
              <Input
                id="offer-title"
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="Monsoon hair care week"
                data-testid="offer-form-title"
                className="bg-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="offer-type" className="text-xs font-semibold text-slate-700">
                Discount type
              </Label>
              <FilterSelect
                label="Discount type"
                testid="offer-form-type"
                value={form.discount_type}
                onChange={(value) => setForm({ ...form, discount_type: value })}
                options={[
                  { value: "percent", label: "Percentage" },
                  { value: "flat", label: "Flat amount" },
                ]}
                className="h-9 w-full"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="offer-value" className="text-xs font-semibold text-slate-700">
                Discount value
              </Label>
              <Input
                id="offer-value"
                type="number"
                value={form.discount_value}
                onChange={(event) => setForm({ ...form, discount_value: event.target.value })}
                data-testid="offer-form-value"
                className="bg-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="offer-min" className="text-xs font-semibold text-slate-700">
                Minimum order (₹)
              </Label>
              <Input
                id="offer-min"
                type="number"
                value={form.min_order}
                onChange={(event) => setForm({ ...form, min_order: event.target.value })}
                data-testid="offer-form-min"
                className="bg-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="offer-limit" className="text-xs font-semibold text-slate-700">
                Redemption limit
              </Label>
              <Input
                id="offer-limit"
                type="number"
                value={form.usage_limit}
                onChange={(event) => setForm({ ...form, usage_limit: event.target.value })}
                data-testid="offer-form-limit"
                className="bg-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="offer-start" className="text-xs font-semibold text-slate-700">
                Starts on
              </Label>
              <Input
                id="offer-start"
                type="date"
                value={form.starts_at}
                onChange={(event) => setForm({ ...form, starts_at: event.target.value })}
                data-testid="offer-form-start"
                className="bg-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="offer-end" className="text-xs font-semibold text-slate-700">
                Ends on
              </Label>
              <Input
                id="offer-end"
                type="date"
                value={form.ends_at}
                onChange={(event) => setForm({ ...form, ends_at: event.target.value })}
                data-testid="offer-form-end"
                className="bg-white"
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="offer-description" className="text-xs font-semibold text-slate-700">
                Description
              </Label>
              <Textarea
                id="offer-description"
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                rows={2}
                data-testid="offer-form-description"
                className="bg-white text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose
              render={
                <Button variant="outline" className="bg-white" data-testid="offer-create-cancel">
                  Cancel
                </Button>
              }
            />
            <Button
              disabled={!form.code.trim() || !form.title.trim() || createOffer.isPending}
              onClick={() => createOffer.mutate()}
              data-testid="offer-create-submit"
            >
              Create coupon
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
