// Partner profile view — opened from the partners table.
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Ban,
  Briefcase,
  CheckCircle2,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FieldRow, PageHeader, Panel, PanelHeader } from "@/components/admin/PageShell";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { apiGet, apiPatch } from "@/lib/api";
import { fmtDate, fmtMoney, fmtNumber } from "@/lib/format";
import type { Booking, PageResult, Partner, Review } from "@/lib/types";

export default function PartnerDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: partner, isError } = useQuery({
    queryKey: ["partners", "detail", id],
    queryFn: () => apiGet<Partner>(`/partners/${id}`),
    retry: false,
  });

  const { data: bookings } = useQuery({
    queryKey: ["partners", "detail", id, "bookings", partner?.business_name],
    queryFn: () =>
      apiGet<PageResult<Booking>>(
        `/bookings?q=${encodeURIComponent(partner?.business_name ?? "")}&page_size=8&sort=scheduled_date&dir=desc`,
      ),
    enabled: Boolean(partner?.business_name),
    retry: false,
  });

  const { data: reviews } = useQuery({
    queryKey: ["partners", "detail", id, "reviews", partner?.business_name],
    queryFn: () =>
      apiGet<PageResult<Review>>(
        `/reviews?q=${encodeURIComponent(partner?.business_name ?? "")}&page_size=5&sort=created_at&dir=desc`,
      ),
    enabled: Boolean(partner?.business_name),
    retry: false,
  });

  const setField = useMutation({
    mutationFn: (vars: { field: string; value: string }) =>
      apiPatch<Partner>(`/partners/${id}`, vars),
    onSuccess: () => {
      toast.success("Partner record updated");
      queryClient.invalidateQueries({ queryKey: ["partners"] });
    },
    onError: () => toast.error("Could not update this partner"),
  });

  if (isError) {
    return (
      <div data-testid="partner-detail-error">
        <PageHeader
          title="Partner not found"
          subtitle="This record may have been removed, or the operations API is unreachable."
          actions={
            <Button variant="outline" size="sm" onClick={() => navigate("/partners")}>
              <ArrowLeft className="size-3.5" /> Back to partners
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div data-testid="partner-detail-page">
      <PageHeader
        title={partner?.business_name ?? "Loading partner…"}
        subtitle={
          partner
            ? `${partner.code} · owner ${partner.owner_name} · onboarded ${fmtDate(partner.joined_at)}`
            : undefined
        }
        actions={
          <>
            <Link to="/partners">
              <Button variant="outline" size="sm" className="bg-white" data-testid="partner-detail-back">
                <ArrowLeft className="size-3.5" /> Back
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              className="bg-white"
              onClick={() => setField.mutate({ field: "verification_status", value: "verified" })}
              data-testid="partner-detail-verify"
            >
              <ShieldCheck className="size-3.5" /> Mark verified
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setField.mutate({ field: "account_status", value: "suspended" })}
              data-testid="partner-detail-suspend"
            >
              <Ban className="size-3.5" /> Suspend
            </Button>
          </>
        }
        testid="partner-detail-header"
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Panel testid="partner-identity-panel">
            <div className="flex items-center gap-3 border-b border-grid p-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
                <Briefcase className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">
                  {partner?.business_name ?? "—"}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {partner ? (
                    <StatusBadge status={partner.account_status} data-testid="partner-detail-account-status" />
                  ) : null}
                  {partner ? (
                    <StatusBadge
                      status={partner.verification_status}
                      data-testid="partner-detail-verification-status"
                    />
                  ) : null}
                </div>
              </div>
            </div>
            <div className="px-4 py-2">
              <FieldRow label="Partner ID" testid="partner-detail-code">
                <span className="num">{partner?.code ?? "—"}</span>
              </FieldRow>
              <FieldRow label="Owner">{partner?.owner_name ?? "—"}</FieldRow>
              <FieldRow label="Email">
                <span className="flex items-center gap-1.5">
                  <Mail className="size-3.5 text-slate-400" /> {partner?.email ?? "—"}
                </span>
              </FieldRow>
              <FieldRow label="Phone">
                <span className="num flex items-center gap-1.5">
                  <Phone className="size-3.5 text-slate-400" /> {partner?.phone ?? "—"}
                </span>
              </FieldRow>
              <FieldRow label="Service area">
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-3.5 text-slate-400" /> {partner?.city ?? "—"}
                </span>
              </FieldRow>
              <FieldRow label="Categories">
                <span className="flex flex-wrap gap-1">
                  {(partner?.services ?? []).map((service) => (
                    <span
                      key={service}
                      className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-slate-600"
                    >
                      {service}
                    </span>
                  ))}
                </span>
              </FieldRow>
            </div>
          </Panel>

          <Panel testid="partner-metrics-panel">
            <PanelHeader title="Performance" />
            <div className="grid grid-cols-2">
              <div className="border-r border-b border-grid p-4">
                <p className="eyebrow text-slate-400">Rating</p>
                <p className="num mt-1.5 flex items-center gap-1 text-xl font-bold text-slate-900" data-testid="partner-detail-rating">
                  <Star className="size-4 fill-amber-400 text-amber-400" />
                  {partner?.rating?.toFixed(1) ?? "—"}
                </p>
              </div>
              <div className="border-b border-grid p-4">
                <p className="eyebrow text-slate-400">Reviews</p>
                <p className="num mt-1.5 text-xl font-bold text-slate-900">
                  {fmtNumber(partner?.reviews_count ?? 0)}
                </p>
              </div>
              <div className="border-r border-grid p-4">
                <p className="eyebrow text-slate-400">Jobs completed</p>
                <p className="num mt-1.5 text-xl font-bold text-slate-900" data-testid="partner-detail-jobs">
                  {fmtNumber(partner?.jobs_completed ?? 0)}
                </p>
              </div>
              <div className="p-4">
                <p className="eyebrow text-slate-400">Revenue</p>
                <p className="num mt-1.5 text-xl font-bold text-slate-900" data-testid="partner-detail-revenue">
                  {fmtMoney(partner?.revenue ?? 0)}
                </p>
              </div>
            </div>
          </Panel>

          <Panel testid="partner-actions-panel">
            <PanelHeader title="Account controls" />
            <div className="flex flex-wrap gap-2 p-4">
              <Button
                variant="outline"
                size="xs"
                className="bg-white"
                onClick={() => setField.mutate({ field: "account_status", value: "active" })}
                data-testid="partner-detail-activate"
              >
                <CheckCircle2 className="size-3.5" /> Activate
              </Button>
              <Button
                variant="outline"
                size="xs"
                className="bg-white"
                onClick={() => setField.mutate({ field: "verification_status", value: "under_review" })}
                data-testid="partner-detail-review"
              >
                <ShieldCheck className="size-3.5" /> Send to review
              </Button>
              <Button
                variant="outline"
                size="xs"
                className="bg-white"
                onClick={() => setField.mutate({ field: "account_status", value: "deactivated" })}
                data-testid="partner-detail-deactivate"
              >
                <Ban className="size-3.5" /> Deactivate
              </Button>
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel testid="partner-about-panel">
            <PanelHeader title="Business profile" subtitle="Professional summary supplied by the partner" />
            <p className="p-4 text-[13px] leading-relaxed text-slate-600" data-testid="partner-detail-bio">
              {partner?.bio ?? "No profile summary on record."}
            </p>
          </Panel>

          <Panel testid="partner-bookings-panel">
            <PanelHeader
              title="Recent bookings"
              subtitle="Latest appointments fulfilled by this partner"
              right={
                <Link
                  to="/bookings"
                  className="text-[11px] font-semibold text-primary hover:underline"
                  data-testid="partner-detail-all-bookings"
                >
                  View all bookings
                </Link>
              }
            />
            <div className="scroll-slim overflow-x-auto">
              <table className="w-full min-w-max text-sm" data-testid="partner-bookings-table">
                <thead>
                  <tr className="bg-slate-100/90 text-[11px] tracking-wider text-slate-600 uppercase">
                    <th scope="col" className="px-4 py-2.5 text-left font-semibold">Booking</th>
                    <th scope="col" className="px-4 py-2.5 text-left font-semibold">Customer</th>
                    <th scope="col" className="px-4 py-2.5 text-left font-semibold">Service</th>
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
                      data-testid={`partner-booking-row-${booking.id}`}
                    >
                      <td className="num px-4 py-2.5 text-xs font-semibold text-primary">{booking.code}</td>
                      <td className="px-4 py-2.5 text-xs">{booking.customer_name}</td>
                      <td className="px-4 py-2.5 text-xs">{booking.service_name}</td>
                      <td className="num px-4 py-2.5 text-xs whitespace-nowrap">{fmtDate(booking.scheduled_date)}</td>
                      <td className="num px-4 py-2.5 text-right text-xs font-semibold">{fmtMoney(booking.amount)}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={booking.status} /></td>
                    </tr>
                  ))}
                  {(bookings?.items?.length ?? 0) === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-xs text-slate-500">
                        No bookings recorded for this partner yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel testid="partner-reviews-panel">
            <PanelHeader title="Customer reviews" subtitle="Most recent feedback received" />
            <ul className="divide-y divide-grid/70">
              {(reviews?.items ?? []).map((review) => (
                <li key={review.id} className="px-4 py-3" data-testid={`partner-review-${review.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-slate-800">{review.title}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {review.customer_name} · {review.service_name} · {fmtDate(review.created_at)}
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
                  No reviews received yet.
                </li>
              ) : null}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
