// Service & category management: table plus add/edit form and enable/disable toggles.
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Power, Trash2 } from "lucide-react";
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
import { apiDelete, apiPatch, apiPost } from "@/lib/api";
import { fmtMoney, fmtNumber, fmtRelative } from "@/lib/format";
import { facetOptions, useFacets, useResourceList, useTableState } from "@/lib/table";
import type { ServiceItem } from "@/lib/types";

interface FormState {
  name: string;
  category: string;
  description: string;
  duration_min: string;
  base_price: string;
  commission_pct: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  category: "",
  description: "",
  duration_min: "60",
  base_price: "1500",
  commission_pct: "15",
};

export default function Services() {
  const queryClient = useQueryClient();
  const state = useTableState("name", "asc");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceItem | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const { data, isLoading, isError, refetch } = useResourceList<ServiceItem>("services", state);
  const { data: facets } = useFacets("services");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["services"] });
  };

  const createService = useMutation({
    mutationFn: () =>
      apiPost<ServiceItem>("/services", {
        name: form.name.trim(),
        category: form.category.trim(),
        description: form.description.trim(),
        duration_min: Number(form.duration_min),
        base_price: Number(form.base_price),
        commission_pct: Number(form.commission_pct),
        enabled: true,
      }),
    onSuccess: () => {
      toast.success("Service created");
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      invalidate();
    },
    onError: () => toast.error("Could not create this service"),
  });

  const patchService = useMutation({
    mutationFn: (vars: { id: string; field: string; value: string | number | boolean }) =>
      apiPatch<ServiceItem>(`/services/${vars.id}`, { field: vars.field, value: vars.value }),
    onSuccess: () => {
      toast.success("Service updated");
      invalidate();
    },
    onError: () => toast.error("Could not update this service"),
  });

  const removeService = useMutation({
    mutationFn: (id: string) => apiDelete<{ ok: boolean }>(`/services/${id}`),
    onSuccess: () => {
      toast.success("Service removed");
      invalidate();
    },
    onError: () => toast.error("Could not remove this service"),
  });

  const saveEdit = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const updates: { field: string; value: string | number }[] = [
        { field: "name", value: form.name.trim() },
        { field: "category", value: form.category.trim() },
        { field: "description", value: form.description.trim() },
        { field: "duration_min", value: Number(form.duration_min) },
        { field: "base_price", value: Number(form.base_price) },
        { field: "commission_pct", value: Number(form.commission_pct) },
      ];
      for (const update of updates) {
        await apiPatch<ServiceItem>(`/services/${editing.id}`, update);
      }
    },
    onSuccess: () => {
      toast.success("Service saved");
      setEditing(null);
      setForm(EMPTY_FORM);
      invalidate();
    },
    onError: () => toast.error("Could not save this service"),
  });

  const openEdit = (service: ServiceItem) => {
    setEditing(service);
    setForm({
      name: service.name,
      category: service.category,
      description: service.description,
      duration_min: String(service.duration_min),
      base_price: String(service.base_price),
      commission_pct: String(service.commission_pct),
    });
  };

  const columns: Column<ServiceItem>[] = [
    {
      key: "name",
      header: "Service",
      sortable: true,
      cell: (row) => (
        <div className="min-w-0 max-w-md">
          <p className="truncate text-[13px] font-semibold text-slate-900">{row.name}</p>
          <p className="truncate text-[11px] text-slate-500">{row.description}</p>
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
      key: "duration_min",
      header: "Duration",
      sortable: true,
      align: "right",
      cell: (row) => <span className="num text-xs">{row.duration_min} min</span>,
    },
    {
      key: "base_price",
      header: "Base price",
      sortable: true,
      align: "right",
      cell: (row) => <span className="num text-xs font-semibold text-slate-800">{fmtMoney(row.base_price)}</span>,
    },
    {
      key: "commission_pct",
      header: "Commission",
      sortable: true,
      align: "right",
      cell: (row) => <span className="num text-xs">{row.commission_pct.toFixed(1)}%</span>,
    },
    {
      key: "partners_count",
      header: "Partners",
      sortable: true,
      align: "right",
      cell: (row) => <span className="num text-xs">{fmtNumber(row.partners_count)}</span>,
    },
    {
      key: "bookings_count",
      header: "Bookings",
      sortable: true,
      align: "right",
      cell: (row) => <span className="num text-xs">{fmtNumber(row.bookings_count)}</span>,
    },
    {
      key: "enabled",
      header: "State",
      sortable: true,
      cell: (row) => (
        <StatusBadge
          status={row.enabled ? "enabled" : "disabled"}
          data-testid={`service-state-${row.id}`}
        />
      ),
    },
    {
      key: "updated_at",
      header: "Updated",
      sortable: true,
      cell: (row) => <span className="num text-xs whitespace-nowrap">{fmtRelative(row.updated_at)}</span>,
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
            onClick={() => openEdit(row)}
            data-testid={`service-edit-${row.id}`}
          >
            <Pencil className="size-3.5" /> Edit
          </Button>
          <Button
            size="xs"
            variant="outline"
            className="bg-white"
            onClick={() => patchService.mutate({ id: row.id, field: "enabled", value: !row.enabled })}
            data-testid={`service-toggle-${row.id}`}
          >
            <Power className="size-3.5" /> {row.enabled ? "Disable" : "Enable"}
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            className="text-slate-400 hover:text-destructive"
            onClick={() => removeService.mutate(row.id)}
            data-testid={`service-delete-${row.id}`}
            aria-label={`Delete ${row.name}`}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  const formFields = (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2 space-y-1.5">
        <Label htmlFor="service-name" className="text-xs font-semibold text-slate-700">
          Service name
        </Label>
        <Input
          id="service-name"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          placeholder="Signature haircut & finish"
          data-testid="service-form-name"
          className="bg-white"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="service-category" className="text-xs font-semibold text-slate-700">
          Category
        </Label>
        <Input
          id="service-category"
          value={form.category}
          onChange={(event) => setForm({ ...form, category: event.target.value })}
          placeholder="Hair"
          data-testid="service-form-category"
          className="bg-white"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="service-duration" className="text-xs font-semibold text-slate-700">
          Duration (minutes)
        </Label>
        <Input
          id="service-duration"
          type="number"
          value={form.duration_min}
          onChange={(event) => setForm({ ...form, duration_min: event.target.value })}
          data-testid="service-form-duration"
          className="bg-white"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="service-price" className="text-xs font-semibold text-slate-700">
          Base price (₹)
        </Label>
        <Input
          id="service-price"
          type="number"
          value={form.base_price}
          onChange={(event) => setForm({ ...form, base_price: event.target.value })}
          data-testid="service-form-price"
          className="bg-white"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="service-commission" className="text-xs font-semibold text-slate-700">
          Commission (%)
        </Label>
        <Input
          id="service-commission"
          type="number"
          value={form.commission_pct}
          onChange={(event) => setForm({ ...form, commission_pct: event.target.value })}
          data-testid="service-form-commission"
          className="bg-white"
        />
      </div>
      <div className="col-span-2 space-y-1.5">
        <Label htmlFor="service-description" className="text-xs font-semibold text-slate-700">
          Description
        </Label>
        <Textarea
          id="service-description"
          value={form.description}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
          rows={3}
          placeholder="What the service includes, and any aftercare notes."
          data-testid="service-form-description"
          className="bg-white text-xs"
        />
      </div>
    </div>
  );

  return (
    <div data-testid="services-page">
      <PageHeader
        title="Services & categories"
        count={data?.total}
        countLabel="services"
        subtitle="The bookable service catalogue, its pricing bands and commission rates."
        actions={
          <Button
            size="sm"
            onClick={() => {
              setForm(EMPTY_FORM);
              setDialogOpen(true);
            }}
            data-testid="services-add-button"
          >
            <Plus className="size-3.5" /> Add service
          </Button>
        }
        testid="services-header"
      />

      <Panel testid="services-panel">
        <TableToolbar
          testid="services"
          search={state.q}
          onSearch={state.setQ}
          searchPlaceholder="Search service or category"
          activeFilterCount={state.activeFilterCount}
          onReset={state.resetFilters}
          onRefresh={() => refetch()}
          filters={
            <>
              <FilterSelect
                label="Category"
                testid="services-filter-category"
                value={state.filters.category ?? "all"}
                onChange={(value) => state.setFilter("category", value)}
                options={facetOptions(facets?.category, "All categories", (v) => v)}
              />
              <FilterSelect
                label="State"
                testid="services-filter-enabled"
                value={state.filters.enabled ?? "all"}
                onChange={(value) => state.setFilter("enabled", value)}
                options={[
                  { value: "all", label: "All states" },
                  { value: "true", label: "Enabled" },
                  { value: "false", label: "Disabled" },
                ]}
              />
            </>
          }
        />

        <DataTable
          testid="services-table"
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg" data-testid="service-create-dialog">
          <DialogHeader>
            <DialogTitle className="text-base">Add a service</DialogTitle>
            <DialogDescription className="text-xs">
              New services become bookable as soon as they are enabled and assigned to partners.
            </DialogDescription>
          </DialogHeader>
          {formFields}
          <DialogFooter>
            <DialogClose
              render={
                <Button variant="outline" className="bg-white" data-testid="service-create-cancel">
                  Cancel
                </Button>
              }
            />
            <Button
              disabled={!form.name.trim() || !form.category.trim() || createService.isPending}
              onClick={() => createService.mutate()}
              data-testid="service-create-submit"
            >
              Create service
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-lg" data-testid="service-edit-dialog">
          <DialogHeader>
            <DialogTitle className="text-base">Edit service</DialogTitle>
            <DialogDescription className="text-xs">
              Changes apply to new bookings; existing appointments keep their agreed price.
            </DialogDescription>
          </DialogHeader>
          {formFields}
          <DialogFooter>
            <DialogClose
              render={
                <Button variant="outline" className="bg-white" data-testid="service-edit-cancel">
                  Cancel
                </Button>
              }
            />
            <Button
              disabled={!form.name.trim() || saveEdit.isPending}
              onClick={() => saveEdit.mutate()}
              data-testid="service-edit-submit"
            >
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
