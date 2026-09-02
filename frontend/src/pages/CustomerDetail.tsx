// Customer detail view — opened by clicking a row in the customers table.
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Ban, CheckCircle2, Mail, MapPin, Phone, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FieldRow, PageHeader, Panel, PanelHeader } from "@/components/admin/PageShell";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { apiGet, apiPatch } from "@/lib/api";
import { fmtDate, fmtMoney, fmtNumber, fmtRelative, initials, titleCase } from "@/lib/format";
import type { Booking, Customer, PageResult, Review } from "@/lib/types";

export default function CustomerDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: customer, isError } = useQuery({
    queryKey: ["customers", "detail", id],
    queryFn: () => apiGet<Customer>(`/customers/${id}`),
    retry: false,
  });

  const { data: bookings } = useQuery({
    queryKey: ["customers", "detail", id, "bookings", customer?.name],
    queryFn: () =>
      apiGet<PageResult<Booking>>(
        `/bookings?q=${encodeURIComponent(customer?.name ?? "")}&page_size=8&sort=scheduled_date&dir=desc`,
      ),
    enabled: Boolean(customer?.name),
    retry: false,
  });

  const { data: reviews } = useQuery({
    queryKey: ["customers", "detail", id, "reviews", customer?.name],
    queryFn: () =>
      apiGet<PageResult<Review>>(
        `/reviews?q=${encodeURIComponent(customer?.name ?? "")}&page_size=5&sort=created_at&dir=desc`,
      ),
    enabled: Boolean(customer?.name),
    retry: false,
  });

  const setStatus = useMutation({
    mutationFn: (value: string) =>
      apiPatch<Customer>(`/customers/${id}`, { field: "status", value }),
    onSuccess: (_, value) => {
      toast.success(`Account marked ${titleCase(value).toLowerCase()}`);
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: () => toast.error("Could not update this account"),
  });

  if (isError) {
    return (
      <div data-testid="customer-detail-error">
        <PageHeader
          title="Customer not found"
          subtitle="This record may have been removed, or the operations API is unreachable."
          actions={
            <Button variant="outline" size="sm" onClick={() => navigate("/customers")}>
              <ArrowLeft className="size-3.5" /> Back to customers
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div data-testid="customer-detail-page">
      <PageHeader
        title={customer?.name ?? "Loading customer…"}
        subtitle={
          customer
            ? `${customer.code} · joined ${fmtDate(customer.joined_at)} · last active ${fmtRelative(customer.last_active)}`
            : undefined
        }
        actions={
          <>
            <Link to="/customers">
              <Button variant="outline" size="sm" className="bg-white" data-testid="customer-detail-back">
                <ArrowLeft className="size-3.5" /> Back
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              className="bg-white"
              onClick={() => setStatus.mutate("active")}
              data-testid="customer-detail-activate"
            >
              <CheckCircle2 className="size-3.5" /> Mark active
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setStatus.mutate("suspended")}
              data-testid="customer-detail-suspend"
            >
              <Ban className="size-3.5" /> Suspend
            </Button>
          </>
        }
        testid="customer-detail-header"
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Panel testid="customer-identity-panel">
            <div className="flex items-center gap-3 border-b border-grid p-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {initials(customer?.name)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">
                  {customer?.name ?? "—"}
                </p>
                <div className="mt-1 flex items-center gap-1.5">
                  {customer ? <StatusBadge status={customer.status} data-testid="customer-detail-status" /> : null}
                  {customer ? <StatusBadge status={customer.segment} dot={false} /> : null}
                </div>
              </div>
            </div>
            <div className="space-y-0 px-4 py-2">
              <FieldRow label="Customer ID" testid="customer-detail-code">
                <span className="num">{customer?.code ?? "—"}</span>
              </FieldRow>
              <FieldRow label="Email">
                <span className="flex items-center gap-1.5">
                  <Mail className="size-3.5 text-slate-400" /> {customer?.email ?? "—"}
                </span>
              </FieldRow>
              <FieldRow label="Phone">
                <span className="num flex items-center gap-1.5">
                  <Phone className="size-3.5 text-slate-400" /> {customer?.phone ?? "—"}
                </span>
              </FieldRow>
              <FieldRow label="City">
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-3.5 text-slate-400" /> {customer?.city ?? "—"}
                </span>
              </FieldRow>
              <FieldRow label="Average rating given">
                <span className="num flex items-center gap-1.5">
                  <Star className="size-3.5 fill-amber-400 text-amber-400" />
                  {customer?.avg_rating_given?.toFixed(1) ?? "—"}
                </span>
              </FieldRow>
            </div>
          </Panel>

          <Panel testid="customer-metrics-panel">
            <PanelHeader title="Account metrics" />
            <div className="grid grid-cols-2 divide-x divide-grid">
              <div className="p-4">
                <p className="eyebrow text-slate-400">Bookings</p>
                <p className="num mt-1.5 text-xl font-bold text-slate-900" data-testid="customer-detail-bookings-count">
                  {fmtNumber(customer?.bookings_count ?? 0)}
                </p>
              </div>
              <div className="p-4">
                <p className="eyebrow text-slate-400">Lifetime value</p>
                <p className="num mt-1.5 text-xl font-bold text-slate-900" data-testid="customer-detail-ltv">
                  {fmtMoney(customer?.total_spent ?? 0)}
                </p>
              </div>
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel testid="customer-bookings-panel">
            <PanelHeader
              title="Recent bookings"
              subtitle="Most recent appointments linked to this customer"
              right={
                <Link
                  to="/bookings"
                  className="text-[11px] font-semibold text-primary hover:underline"
                  data-testid="customer-detail-all-bookings"
                >
                  View all bookings
                </Link>
              }
            />
            <div className="scroll-slim overflow-x-auto">
              <table className="w-full min-w-max text-sm" data-testid="customer-bookings-table">
                <thead>
                  <tr className="bg-slate-100/90 text-[11px] tracking-wider text-slate-600 uppercase">
                    <th scope="col" className="px-4 py-2.5 text-left font-semibold">Booking</th>
                    <th scope="col" className="px-4 py-2.5 text-left font-semibold">Service</th>
                    <th scope="col" className="px-4 py-2.5 text-left font-semibold">Partner</th>
                    <th scope="col" className="px-4 py-2.5 text-left font-semibold">Date</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold">Amount</th>
                    <th scope="col" className="px-4 py-2.5 text-left font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(bookings?.items ?? []).map((booking, index) => (
                    <tr
                      key={booking.id}
                      className={index % 2 === 1 ? "bg-slate-50/40" : "bg-white"}
                      data-testid={`customer-booking-row-${booking.id}`}
                    >
                      <td className="num px-4 py-2.5 text-xs font-semibold text-primary">{booking.code}</td>
                      <td className="px-4 py-2.5 text-xs">{booking.service_name}</td>
                      <td className="px-4 py-2.5 text-xs">{booking.partner_name}</td>
                      <td className="num px-4 py-2.5 text-xs whitespace-nowrap">{fmtDate(booking.scheduled_date)}</td>
                      <td className="num px-4 py-2.5 text-right text-xs font-semibold">{fmtMoney(booking.amount)}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={booking.status} /></td>
                    </tr>
                  ))}
                  {(bookings?.items?.length ?? 0) === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-xs text-slate-500">
                        No bookings recorded against this customer yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel testid="customer-reviews-panel">
            <PanelHeader title="Reviews written" subtitle="Feedback this customer left for partners" />
            <ul className="divide-y divide-grid/70">
              {(reviews?.items ?? []).map((review) => (
                <li key={review.id} className="px-4 py-3" data-testid={`customer-review-${review.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-slate-800">{review.title}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {review.partner_name} · {review.service_name} · {fmtDate(review.created_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="num flex items-center gap-1 text-xs font-semibold text-slate-700">
                        <Star className="size-3.5 fill-amber-400 text-amber-400" />
                        {review.rating}
                      </span>
                      <StatusBadge status={review.status} />
                    </div>
                  </div>
                </li>
              ))}
              {(reviews?.items?.length ?? 0) === 0 ? (
                <li className="px-4 py-10 text-center text-xs text-slate-500">
                  This customer has not written any reviews.
                </li>
              ) : null}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
