// Hand-written mirrors of the Pydantic models in backend/models/schemas.py.
// Nothing infers across the Python boundary — change both sides in the same edit.

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  title: string;
  avatar_url: string;
  last_login: string | null;
}

export interface AdminLoginResponse {
  adminUUID?: string;
  validAdmin: boolean;
  errorMessage?: string;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface Customer {
  id: string;
  code: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  segment: string;
  status: string;
  bookings_count: number;
  total_spent: number;
  avg_rating_given: number;
  joined_at: string;
  last_active: string;
  notes: string;
}

export interface Partner {
  id: string;
  code: string;
  business_name: string;
  owner_name: string;
  email: string;
  phone: string;
  city: string;
  services: string[];
  rating: number;
  reviews_count: number;
  jobs_completed: number;
  revenue: number;
  account_status: string;
  verification_status: string;
  joined_at: string;
  bio: string;
}

export interface PartnersApiRecord {
  id?: string;
  partnerUUID?: string;
  partnerId?: string;
  code?: string;
  fullName?: string;
  owner_name?: string;
  ownerName?: string;
  business_name?: string;
  businessName?: string;
  email?: string;
  phone?: string;
  phoneNumber?: string;
  city?: string;
  services?: string[];
  categories?: string[];
  rating?: number;
  reviews_count?: number;
  reviewsCount?: number;
  jobs_completed?: number;
  jobsCompleted?: number;
  revenue?: number;
  account_status?: string;
  accountStatus?: string;
  verification_status?: string;
  verificationStatus?: string;
  joined_at?: string;
  onBoardingTimestamp?: string;
  onboardingTimestamp?: string;
  LastUpdateTimestamp?: string;
  lastUpdateTimestamp?: string;
}

export interface PartnersResponse {
  records: PartnersApiRecord[];
  pageNumber: number;
  pageSize: number;
  sortBy: string;
  sortDirection: string;
  totalRecords: number;
}

export interface PartnerDetailsResponse {
  accountStatus: string;
  city: string;
  createTimestamp: string;
  emailAddress: string;
  expirationTimestamp: string | null;
  fullAddress: string;
  fullName: string;
  id: number;
  lastUpdateTimestamp: string;
  mobileNumber: string;
  onBoardingTimestamp: string;
  partnerBankDetails?: {
    accountHolderName: string;
    accountNumber: string;
    bankName: string;
    ifscCode: string;
  } | null;
  partnerDocuments?: {
    id?: string | number;
    partnerDocumentUUID?: string;
    documentType?: string;
    document_type?: string;
    name?: string;
    documentName?: string;
    fileLabel?: string;
    file_label?: string;
    documentUrl?: string;
    documentURL?: string;
    fileUrl?: string;
    fileURL?: string;
    url?: string;
    createTimestamp?: string;
    uploadedAt?: string;
    uploadTimestamp?: string;
    expirationTimestamp?: string | null;
    lastUpdateTimestamp?: string;
    status?: string;
  }[] | null;
  partnerKYC?: {
    aadhaarNumber: string;
    panNumber: string | null;
  } | null;
  partnerOnBoardingVerification?: {
    comments: string;
    isBankDetailsValidated: boolean;
    isCertificateValidated: boolean;
    isKYCValidated: boolean;
    isProfileAccepted: boolean;
    isProfileRejected: boolean;
    lastUpdateTimestamp: string;
  } | null;
  partnerServiceType?: { serviceType: string }[];
  partnerUUID: string;
  pinCode: string;
  state: string;
  verificationStatus: string;
}

export interface VerificationDocument {
  id: string;
  document_uuid?: string;
  name: string;
  doc_type: string;
  file_label: string;
  url?: string;
  uploaded_at: string;
  status: string;
}

export interface VerificationNote {
  id: string;
  author: string;
  text: string;
  created_at: string;
  kind: string;
}

export interface VerificationService {
  name: string;
  category: string;
  duration_min: number;
  price: number;
}

export interface Application {
  id: string;
  code: string;
  business_name: string;
  owner_name: string;
  email: string;
  phone: string;
  city: string;
  address: string;
  business_reg_no: string;
  tax_id: string;
  license_no: string;
  experience_years: number;
  team_size: number;
  specialties: string[];
  services: VerificationService[];
  portfolio: string[];
  documents: VerificationDocument[];
  notes: VerificationNote[];
  checklist: Record<string, boolean>;
  status: string;
  priority: string;
  submitted_at: string;
  updated_at: string;
  decision_reason: string;
  age_hours: number;
  sla_state: string;
  sla_due_in_hours: number;
}

export interface AuditEntry {
  id: string;
  at: string;
  actor_name: string;
  actor_role: string;
  action: string;
  action_label: string;
  entity_type: string;
  entity_label: string;
  entity_id: string;
  detail: string;
  severity: string;
}

export interface ServiceItem {
  id: string;
  name: string;
  category: string;
  description: string;
  duration_min: number;
  base_price: number;
  commission_pct: number;
  partners_count: number;
  bookings_count: number;
  enabled: boolean;
  updated_at: string;
}

export interface Booking {
  id: string;
  code: string;
  customer_name: string;
  partner_name: string;
  service_name: string;
  category: string;
  city: string;
  scheduled_date: string;
  scheduled_slot: string;
  amount: number;
  payment_status: string;
  status: string;
  channel: string;
  created_at: string;
  address: string;
  notes: string;
}

export interface Payment {
  id: string;
  code: string;
  booking_code: string;
  customer_name: string;
  partner_name: string;
  amount: number;
  platform_fee: number;
  partner_payout: number;
  method: string;
  status: string;
  settlement_status: string;
  created_at: string;
}

export interface Review {
  id: string;
  code: string;
  customer_name: string;
  partner_name: string;
  service_name: string;
  rating: number;
  title: string;
  body: string;
  status: string;
  flagged_reason: string;
  created_at: string;
}

export interface Ticket {
  id: string;
  code: string;
  subject: string;
  body: string;
  kind: string;
  category: string;
  requester_name: string;
  requester_type: string;
  priority: string;
  status: string;
  assignee: string;
  amount_disputed: number;
  created_at: string;
  updated_at: string;
}

export interface Offer {
  id: string;
  code: string;
  title: string;
  description: string;
  discount_type: string;
  discount_value: number;
  min_order: number;
  audience: string;
  starts_at: string;
  ends_at: string;
  usage_count: number;
  usage_limit: number;
  status: string;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  category: string;
  severity: string;
  created_at: string;
  read: boolean;
}

export interface Kpi {
  key: string;
  label: string;
  value: number;
  unit: string;
  delta_pct: number;
  trend: string;
  hint: string;
}

export interface SeriesPoint {
  label: string;
  a: number;
  b: number;
}

export interface SlicePoint {
  label: string;
  value: number;
}

export interface ActivityItem {
  id: string;
  actor: string;
  action: string;
  target: string;
  at: string;
  kind: string;
}

export interface PendingAction {
  id: string;
  label: string;
  detail: string;
  count: number;
  href: string;
  severity: string;
}

export interface AlertItem {
  id: string;
  title: string;
  detail: string;
  severity: string;
  at: string;
}

export interface DashboardSummary {
  kpis: Kpi[];
  revenue_series: SeriesPoint[];
  bookings_by_category: SlicePoint[];
  activity: ActivityItem[];
  pending_actions: PendingAction[];
  alerts: AlertItem[];
  generated_at: string;
}

export interface AnalyticsOverview {
  kpis: Kpi[];
  revenue_series: SeriesPoint[];
  bookings_series: SeriesPoint[];
  category_split: SlicePoint[];
  city_split: SlicePoint[];
  rating_split: SlicePoint[];
  range_label: string;
  generated_at: string;
}

export interface RoleItem {
  id: string;
  name: string;
  description: string;
  members: number;
  permissions: string[];
}

export interface PlatformSettings {
  platform_name: string;
  support_email: string;
  default_commission_pct: number;
  booking_cancellation_window_hrs: number;
  payout_cycle: string;
  auto_approve_reviews: boolean;
  require_document_reverification_months: number;
  maintenance_mode: boolean;
  two_factor_required: boolean;
  session_timeout_min: number;
  notify_new_application: boolean;
  notify_dispute_raised: boolean;
  notify_payout_failure: boolean;
  notify_weekly_digest: boolean;
}

export type Facets = Record<string, (string | number | boolean)[]>;
