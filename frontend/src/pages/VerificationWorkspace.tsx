// Verification workspace: 70/30 split — application evidence left, decision sidebar right.
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  CircleSlash,
  Clock,
  Eye,
  ExternalLink,
  FileText,
  MessageSquarePlus,
  PencilLine,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FieldRow, PageHeader, Panel, PanelHeader } from "@/components/admin/PageShell";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ApiError, apiGet, apiPatch, apiPost } from "@/lib/api";
import { fmtDateTime, fmtMoney, fmtRelative, titleCase } from "@/lib/format";
import type { Application, PartnerDetailsResponse } from "@/lib/types";

const CHECKLIST_LABELS: Record<string, string> = {
  identity_verified: "Government ID matches applicant",
  licence_validated: "Cosmetology licence validated with issuer",
  address_confirmed: "Studio address confirmed",
  bank_details_matched: "Bank account matches business name",
  background_check_clear: "Background check returned clear",
};

const DOC_STATUSES = ["pending", "verified", "rejected"];

type DecisionAction = "approve" | "reject" | "request_correction";

function mapPartnerDetails(partner: PartnerDetailsResponse): Application {
  const verification = partner.partnerOnBoardingVerification;
  const submittedAt = partner.createTimestamp;
  const updatedAt = partner.lastUpdateTimestamp;
  const ageHours = Math.max(0, (Date.now() - new Date(submittedAt).getTime()) / 3_600_000);
  const documentStatus = (documentType: string) => {
    const type = documentType.trim().toUpperCase();
    if (type === "KYC") return verification?.isKYCValidated ? "verified" : "pending";
    if (type === "CERTIFICATE") {
      return verification?.isCertificateValidated ? "verified" : "pending";
    }
    if (["BANK", "BANKDOCUMENT", "BANKDOCUMENTS"].includes(type)) {
      return verification?.isBankDetailsValidated ? "verified" : "pending";
    }
    return "pending";
  };
  const fallbackDocuments = [
    {
      id: "kyc",
      name: "KYC details",
      doc_type: "kyc",
      file_label: partner.partnerKYC?.aadhaarNumber ? "Aadhaar submitted" : "KYC details",
      uploaded_at: submittedAt,
      status: documentStatus("KYC"),
    },
    {
      id: "certificate",
      name: "Certificate details",
      doc_type: "certificate",
      file_label: "Certificate validation",
      uploaded_at: submittedAt,
      status: documentStatus("CERTIFICATE"),
    },
    {
      id: "bank",
      name: "Bank details",
      doc_type: "bank",
      file_label: partner.partnerBankDetails?.bankName ?? "Bank details",
      uploaded_at: submittedAt,
      status: documentStatus("BANK"),
    },
  ];
  const documents =
    partner.partnerDocuments && partner.partnerDocuments.length > 0
      ? partner.partnerDocuments.map((document, index) => ({
          id: String(document.partnerDocumentUUID ?? document.id ?? document.documentType ?? index),
          document_uuid: document.partnerDocumentUUID,
          name:
            document.name ??
            document.documentName ??
            titleCase(document.documentType ?? document.document_type),
          doc_type: document.documentType ?? document.document_type ?? "document",
          file_label:
            document.fileLabel ??
            document.file_label ??
            document.documentName ??
            document.name ??
            "Uploaded document",
          url:
            document.documentUrl ??
            document.documentURL ??
            document.fileUrl ??
            document.fileURL ??
            document.url,
          uploaded_at:
            document.createTimestamp ?? document.uploadedAt ?? document.uploadTimestamp ?? submittedAt,
          status: document.status?.toLowerCase() ?? documentStatus(document.documentType ?? document.document_type ?? ""),
        }))
      : fallbackDocuments;

  return {
    id: partner.partnerUUID,
    code: String(partner.id),
    business_name: partner.fullName,
    owner_name: partner.fullName,
    email: partner.emailAddress,
    phone: partner.mobileNumber,
    city: partner.city,
    address: `${partner.fullAddress}, ${partner.state} - ${partner.pinCode}`,
    business_reg_no: "—",
    tax_id: partner.partnerKYC?.panNumber ?? "—",
    license_no: "—",
    experience_years: 0,
    team_size: 0,
    specialties: (partner.partnerServiceType ?? []).map((service) => service.serviceType),
    services: (partner.partnerServiceType ?? []).map((service) => ({
      name: service.serviceType,
      category: service.serviceType,
      duration_min: 0,
      price: 0,
    })),
    portfolio: [],
    documents,
    notes: verification?.comments
      ? [{ id: "onboarding", author: "Partner", text: verification.comments, created_at: updatedAt, kind: "system" }]
      : [],
    checklist: {
      identity_verified: verification?.isKYCValidated ?? false,
      licence_validated: verification?.isCertificateValidated ?? false,
      bank_details_matched: verification?.isBankDetailsValidated ?? false,
    },
    status: partner.verificationStatus.toLowerCase(),
    priority: "normal",
    submitted_at: submittedAt,
    updated_at: updatedAt,
    decision_reason: verification?.comments ?? "",
    age_hours: ageHours,
    sla_state: "on_track",
    sla_due_in_hours: Math.max(0, 48 - ageHours),
  };
}

const DECISION_COPY: Record<DecisionAction, { title: string; description: string; cta: string }> = {
  approve: {
    title: "Approve this partner",
    description:
      "The applicant becomes an active, verified partner and can start accepting bookings immediately.",
    cta: "Confirm approval",
  },
  reject: {
    title: "Reject this application",
    description:
      "The applicant is notified that their application was unsuccessful. A reason is required and is stored on the audit trail.",
    cta: "Confirm rejection",
  },
  request_correction: {
    title: "Request a correction",
    description:
      "The applicant is asked to re-submit specific information or documents. Explain exactly what is needed.",
    cta: "Send correction request",
  },
};

export default function VerificationWorkspace() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [action, setAction] = useState<DecisionAction | null>(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  const queryKey = ["verifications", "detail", id];
  const { data: app, isError } = useQuery({
    queryKey,
    queryFn: async () =>
      mapPartnerDetails(
        await apiGet<PartnerDetailsResponse>(`/ws_glowmeout_admin/getPartnerDetailsByUUID/${id}`),
      ),
    retry: false,
  });

  const onSettled = (updated: Application) => {
    queryClient.setQueryData(queryKey, updated);
    queryClient.invalidateQueries({ queryKey: ["verifications", "list"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const decide = useMutation({
    mutationFn: (vars: { action: DecisionAction; reason: string }) =>
      apiPost<Application>(`/verifications/${id}/decision`, vars),
    onSuccess: (updated, vars) => {
      onSettled(updated);
      toast.success(
        vars.action === "approve"
          ? "Partner approved and activated"
          : vars.action === "reject"
            ? "Application rejected"
            : "Correction requested from the applicant",
      );
      setAction(null);
      setReason("");
    },
    onError: (err) =>
      toast.error(
        err instanceof ApiError && err.status === 400
          ? "A reason is required for this decision"
          : "The decision could not be recorded",
      ),
  });

  const approvePartner = useMutation({
    mutationFn: () => apiPost<void>(`/ws_glowmeout_admin/approvePartner/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      queryClient.invalidateQueries({ queryKey: ["verifications"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setAction(null);
      setReason("");
      toast.success("Partner approved and activated");
      navigate("/partners");
    },
    onError: (err) =>
      toast.error(
        err instanceof ApiError && err.status === 404
          ? "Partner was not found"
          : "Partner approval could not be completed",
      ),
  });

  const setDocStatus = useMutation({
    mutationFn: (vars: {
      certificateUUID: string;
      documentType: string;
      status: "verified" | "rejected";
    }) =>
      apiPost<void>("/ws_glowmeout_admin/approveORRejectCertificate", {
        partnerUUID: app?.id,
        certificateUUID: vars.certificateUUID,
        isApproved: vars.status === "verified",
        documentType: vars.documentType.trim().toUpperCase(),
        comments: "",
      }),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Application>(queryKey);
      queryClient.setQueryData<Application>(queryKey, (current) =>
        current
          ? {
              ...current,
              documents: current.documents.map((document) =>
                document.document_uuid === vars.certificateUUID
                  ? { ...document, status: vars.status }
                  : document,
              ),
            }
          : current,
      );
      return { previous };
    },
    onSuccess: (_result, vars) => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(`Document marked ${titleCase(vars.status).toLowerCase()}`);
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toast.error("Could not update this document");
    },
  });

  const toggleCheck = useMutation({
    mutationFn: (vars: { key: string; value: boolean }) =>
      apiPatch<Application>(`/verifications/${id}/checklist/${vars.key}`, {
        status: String(vars.value),
      }),
    onSuccess: onSettled,
    onError: () => toast.error("Could not update the checklist"),
  });

  const addNote = useMutation({
    mutationFn: (text: string) => apiPost<Application>(`/verifications/${id}/notes`, { text }),
    onSuccess: (updated) => {
      onSettled(updated);
      setNote("");
      toast.success("Note added to the audit trail");
    },
    onError: () => toast.error("Could not add this note"),
  });

  if (isError) {
    return (
      <div data-testid="verification-workspace-error">
        <PageHeader
          title="Application not found"
          subtitle="This application may have been withdrawn, or the operations API is unreachable."
          actions={
            <Button variant="outline" size="sm" onClick={() => navigate("/partner-verification")}>
              <ArrowLeft className="size-3.5" /> Back to queue
            </Button>
          }
        />
      </div>
    );
  }

  const verifiedDocs = (app?.documents ?? []).filter((d) => d.status === "verified").length;
  const checklistDone = Object.values(app?.checklist ?? {}).filter(Boolean).length;
  const checklistTotal = Object.keys(app?.checklist ?? {}).length;
  const decided = app?.status === "verified" || app?.status === "rejected";

  return (
    <div data-testid="verification-workspace-page">
      <PageHeader
        title={app?.business_name ?? "Loading application…"}
        subtitle={
          app
            ? `${app.code} · submitted ${fmtRelative(app.submitted_at)} · ${app.city} · ${app.experience_years} years experience`
            : undefined
        }
        actions={
          <>
            <Link to="/partner-verification">
              <Button variant="outline" size="sm" className="bg-white" data-testid="verification-back">
                <ArrowLeft className="size-3.5" /> Back to queue
              </Button>
            </Link>
            {app ? <StatusBadge status={app.status} data-testid="verification-workspace-status" /> : null}
          </>
        }
        testid="verification-workspace-header"
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* ------------------------------------------------ main evidence area */}
        <div className="space-y-4">
          <Panel testid="verification-partner-info">
            <PanelHeader title="Partner information" subtitle="Identity and registration details as submitted" />
            <div className="grid grid-cols-1 gap-x-8 px-4 py-2 sm:grid-cols-2">
              <FieldRow label="Business name" testid="verification-business-name">
                {app?.business_name ?? "—"}
              </FieldRow>
              <FieldRow label="Owner / principal">{app?.owner_name ?? "—"}</FieldRow>
              <FieldRow label="Email">{app?.email ?? "—"}</FieldRow>
              <FieldRow label="Phone">
                <span className="num">{app?.phone ?? "—"}</span>
              </FieldRow>
              <FieldRow label="Registered address">{app?.address ?? "—"}</FieldRow>
              <FieldRow label="City">{app?.city ?? "—"}</FieldRow>
              <FieldRow label="Business registration no.">
                <span className="num">{app?.business_reg_no ?? "—"}</span>
              </FieldRow>
              <FieldRow label="Tax identifier">
                <span className="num">{app?.tax_id ?? "—"}</span>
              </FieldRow>
            </div>
          </Panel>

          <Panel testid="verification-professional-info">
            <PanelHeader title="Professional information" subtitle="Licensing, tenure and specialisations" />
            <div className="grid grid-cols-1 gap-x-8 px-4 py-2 sm:grid-cols-2">
              <FieldRow label="Licence number" testid="verification-license-no">
                <span className="num">{app?.license_no ?? "—"}</span>
              </FieldRow>
              <FieldRow label="Years of experience">
                <span className="num">{app?.experience_years ?? "—"}</span>
              </FieldRow>
              <FieldRow label="Team size">
                <span className="num">{app?.team_size ?? "—"}</span>
              </FieldRow>
              <FieldRow label="Specialisations">
                <span className="flex flex-wrap gap-1">
                  {(app?.specialties ?? []).map((item) => (
                    <span
                      key={item}
                      className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-slate-600"
                    >
                      {item}
                    </span>
                  ))}
                </span>
              </FieldRow>
            </div>
          </Panel>

          <Panel testid="verification-services">
            <PanelHeader
              title="Services and pricing"
              subtitle="Proposed service menu submitted with the application"
            />
            <div className="scroll-slim overflow-x-auto">
              <table className="w-full min-w-max text-sm" data-testid="verification-services-table">
                <thead>
                  <tr className="bg-slate-100/90 text-[11px] tracking-wider text-slate-600 uppercase">
                    <th scope="col" className="px-4 py-2.5 text-left font-semibold">Service</th>
                    <th scope="col" className="px-4 py-2.5 text-left font-semibold">Category</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold">Duration</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {(app?.services ?? []).map((service, index) => (
                    <tr
                      key={`${service.name}-${index}`}
                      className={index % 2 === 1 ? "bg-slate-50/40" : "bg-white"}
                    >
                      <td className="px-4 py-2.5 text-xs font-medium text-slate-800">{service.name}</td>
                      <td className="px-4 py-2.5 text-xs">{service.category}</td>
                      <td className="num px-4 py-2.5 text-right text-xs">{service.duration_min} min</td>
                      <td className="num px-4 py-2.5 text-right text-xs font-semibold">
                        {fmtMoney(service.price)}
                      </td>
                    </tr>
                  ))}
                  {(app?.services?.length ?? 0) === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-xs text-slate-500">
                        No services submitted.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel testid="verification-portfolio">
            <PanelHeader title="Work portfolio" subtitle="Sample work supplied by the applicant" />
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
              {(app?.portfolio ?? []).map((url, index) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setPreview(url)}
                  data-testid={`verification-portfolio-${index}`}
                  className="group relative aspect-4/3 overflow-hidden rounded-md border border-grid bg-secondary"
                >
                  <img
                    src={url}
                    alt={`Portfolio sample ${index + 1}`}
                    loading="lazy"
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <span className="absolute inset-0 grid place-items-center bg-slate-900/0 opacity-0 transition-[background-color,opacity] duration-200 group-hover:bg-slate-900/40 group-hover:opacity-100">
                    <Eye className="size-5 text-white" />
                  </span>
                </button>
              ))}
              {(app?.portfolio?.length ?? 0) === 0 ? (
                <p className="col-span-full py-6 text-center text-xs text-slate-500">
                  No portfolio images were submitted.
                </p>
              ) : null}
            </div>
          </Panel>

          <Panel testid="verification-documents">
            <PanelHeader
              title="Uploaded documents"
              subtitle="Set a status on each document as you complete the check"
              right={
                <span className="num text-[11px] font-semibold text-slate-600" data-testid="verification-doc-progress">
                  {verifiedDocs}/{app?.documents.length ?? 0} verified
                </span>
              }
            />
            <ul className="divide-y divide-grid/70">
              {(app?.documents ?? []).map((doc) => (
                <li
                  key={doc.id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3"
                  data-testid={`verification-document-${doc.id}`}
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-md bg-secondary text-slate-500">
                    <FileText className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-slate-800">{titleCase(doc.doc_type)}</p>
                    {doc.url ? (
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex max-w-full items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                        data-testid={`verification-document-${doc.id}-link`}
                      >
                        <ExternalLink className="size-3 shrink-0" />
                        <span className="truncate">Open document</span>
                      </a>
                    ) : null}
                  </div>
                  <StatusBadge status={doc.status} data-testid={`verification-document-status-${doc.id}`} />
                  <div className="flex items-center gap-1">
                    {DOC_STATUSES.map((status) => (
                      <Button
                        key={status}
                        size="xs"
                        variant={doc.status === status ? "default" : "outline"}
                        disabled={setDocStatus.isPending}
                        onClick={() => {
                          if (
                            doc.document_uuid &&
                            (status === "verified" || status === "rejected")
                          ) {
                            setDocStatus.mutate({
                              certificateUUID: doc.document_uuid,
                              documentType: doc.doc_type,
                              status,
                            });
                          }
                        }}
                        data-testid={`verification-doc-${doc.id}-set-${status}`}
                        className={doc.status === status ? "" : "bg-white"}
                      >
                        {titleCase(status)}
                      </Button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        {/* ------------------------------------------------ decision sidebar */}
        <div className="space-y-4 xl:sticky xl:top-[76px] xl:self-start">
          <Panel testid="verification-status-panel">
            <PanelHeader title="Verification status" />
            <div className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <span className="eyebrow text-slate-400">Current state</span>
                {app ? <StatusBadge status={app.status} /> : null}
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Priority</span>
                {app ? <StatusBadge status={app.priority} dot={false} /> : null}
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Last updated</span>
                <span className="num text-slate-700">{fmtRelative(app?.updated_at)}</span>
              </div>
              {app ? (
                <div
                  className={
                    app.sla_state === "breached"
                      ? "rounded-md border border-red-200 bg-red-50 px-2.5 py-2"
                      : app.sla_state === "at_risk"
                        ? "rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2"
                        : "rounded-md border border-grid bg-secondary/50 px-2.5 py-2"
                  }
                  data-testid="verification-sla-panel"
                >
                  <div className="flex items-center justify-between">
                    <span className="eyebrow text-slate-500">Response SLA (48h)</span>
                    <StatusBadge
                      status={
                        app.sla_state === "breached"
                          ? "danger"
                          : app.sla_state === "at_risk"
                            ? "warning"
                            : app.sla_state === "closed"
                              ? "neutral"
                              : "success"
                      }
                      label={
                        app.sla_state === "breached"
                          ? "Breached"
                          : app.sla_state === "at_risk"
                            ? "At risk"
                            : app.sla_state === "closed"
                              ? "Closed"
                              : "On track"
                      }
                      data-testid="verification-sla-state"
                    />
                  </div>
                  <p className="num mt-1 text-[11px] text-slate-600">
                    Waiting {Math.round(app.age_hours)}h
                    {app.sla_state === "closed"
                      ? " · decision recorded"
                      : app.sla_due_in_hours < 0
                        ? ` · ${Math.abs(Math.round(app.sla_due_in_hours))}h over target`
                        : ` · ${Math.round(app.sla_due_in_hours)}h remaining`}
                  </p>
                </div>
              ) : null}
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Compliance progress</span>
                  <span className="num font-semibold text-slate-700">
                    {checklistDone}/{checklistTotal}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-300"
                    style={{
                      width: `${checklistTotal ? (checklistDone / checklistTotal) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
              {app?.decision_reason ? (
                <p
                  className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800"
                  data-testid="verification-decision-reason"
                >
                  <span className="font-semibold">Last decision reason:</span> {app.decision_reason}
                </p>
              ) : null}
            </div>
          </Panel>

          <Panel testid="verification-actions-panel">
            <PanelHeader title="Decision" subtitle="Recorded against your admin account" />
            <div className="space-y-2 p-4">
              <Button
                className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
                disabled={decided || decide.isPending || approvePartner.isPending}
                onClick={() => {
                  setAction("approve");
                  setReason("");
                }}
                data-testid="verification-approve-button"
              >
                <Check className="size-4" /> Approve partner
              </Button>
              <Button
                variant="outline"
                className="w-full border-amber-300 bg-white text-amber-700 hover:bg-amber-50"
                disabled={decide.isPending || approvePartner.isPending}
                onClick={() => {
                  setAction("request_correction");
                  setReason("");
                }}
                data-testid="verification-correction-button"
              >
                <PencilLine className="size-4" /> Request correction
              </Button>
              <Button
                variant="destructive"
                className="w-full"
                disabled={decided || decide.isPending || approvePartner.isPending}
                onClick={() => {
                  setAction("reject");
                  setReason("");
                }}
                data-testid="verification-reject-button"
              >
                <CircleSlash className="size-4" /> Reject application
              </Button>
              {decided ? (
                <p className="pt-1 text-[11px] text-slate-500" data-testid="verification-decided-note">
                  This application has a final decision. Request a correction to reopen it with the
                  applicant.
                </p>
              ) : null}
            </div>
          </Panel>

          <Panel testid="verification-checklist-panel">
            <PanelHeader title="Compliance checklist" />
            <ul className="divide-y divide-grid/70">
              {Object.entries(app?.checklist ?? {}).map(([key, value]) => (
                <li key={key} className="flex items-start gap-2.5 px-4 py-2.5">
                  <Checkbox
                    checked={value}
                    onCheckedChange={(checked) =>
                      toggleCheck.mutate({ key, value: Boolean(checked) })
                    }
                    id={`check-${key}`}
                    data-testid={`verification-checklist-${key}`}
                    className="mt-0.5"
                  />
                  <Label
                    htmlFor={`check-${key}`}
                    className="cursor-pointer text-[12px] leading-snug font-medium text-slate-700"
                  >
                    {CHECKLIST_LABELS[key] ?? titleCase(key)}
                  </Label>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel testid="verification-notes-panel">
            <PanelHeader title="Admin notes & audit trail" />
            <div className="border-b border-grid p-4">
              <Textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Record what you checked, who you spoke to, or what is still outstanding…"
                rows={3}
                data-testid="verification-note-input"
                className="bg-white text-xs"
              />
              <Button
                size="sm"
                className="mt-2 w-full"
                disabled={!note.trim() || addNote.isPending}
                onClick={() => addNote.mutate(note.trim())}
                data-testid="verification-note-submit"
              >
                <MessageSquarePlus className="size-3.5" /> Add note
              </Button>
            </div>
            <ul className="max-h-80 divide-y divide-grid/70 overflow-y-auto">
              {[...(app?.notes ?? [])].reverse().map((entry) => (
                <li key={entry.id} className="px-4 py-3" data-testid={`verification-note-${entry.id}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[12px] font-semibold text-slate-800">{entry.author}</p>
                    <StatusBadge status={entry.kind === "note" ? "info" : entry.kind} dot={false} />
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{entry.text}</p>
                  <p className="num mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                    <Clock className="size-3" /> {fmtDateTime(entry.created_at)}
                  </p>
                </li>
              ))}
              {(app?.notes?.length ?? 0) === 0 ? (
                <li className="px-4 py-8 text-center text-xs text-slate-500">
                  No notes recorded yet.
                </li>
              ) : null}
            </ul>
          </Panel>
        </div>
      </div>

      {/* decision confirmation */}
      <Dialog open={action !== null} onOpenChange={(open) => !open && setAction(null)}>
        <DialogContent className="sm:max-w-md" data-testid="verification-decision-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4 text-primary" />
              {action ? DECISION_COPY[action].title : ""}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {action ? DECISION_COPY[action].description : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="decision-reason" className="text-xs font-semibold text-slate-700">
              {action === "approve" ? "Note (optional)" : "Reason (required)"}
            </Label>
            <Textarea
              id="decision-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={4}
              placeholder={
                action === "approve"
                  ? "Anything worth recording about this approval…"
                  : "Explain precisely what is wrong or missing…"
              }
              data-testid="verification-decision-reason-input"
              className="bg-white text-xs"
            />
          </div>
          <DialogFooter>
            <DialogClose
              render={
                <Button variant="outline" className="bg-white" data-testid="verification-decision-cancel">
                  <X className="size-3.5" /> Cancel
                </Button>
              }
            />
            <Button
              disabled={
                decide.isPending ||
                approvePartner.isPending ||
                (action !== "approve" && !reason.trim())
              }
              onClick={() => {
                if (!action) return;
                if (action === "approve") {
                  approvePartner.mutate();
                } else {
                  decide.mutate({ action, reason: reason.trim() });
                }
              }}
              data-testid="verification-decision-confirm"
              className={
                action === "reject"
                  ? "bg-destructive text-white hover:bg-destructive/90"
                  : action === "approve"
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : ""
              }
            >
              {action ? DECISION_COPY[action].cta : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* portfolio preview */}
      <Dialog open={preview !== null} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="sm:max-w-2xl" data-testid="verification-portfolio-dialog">
          <DialogHeader>
            <DialogTitle className="text-base">Portfolio sample</DialogTitle>
            <DialogDescription className="text-xs">
              Submitted by {app?.business_name ?? "the applicant"} as evidence of previous work.
            </DialogDescription>
          </DialogHeader>
          {preview ? (
            <img
              src={preview}
              alt="Portfolio preview"
              className="max-h-[60vh] w-full rounded-md object-contain"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
