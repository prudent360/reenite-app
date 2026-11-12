export type RoleName =
  | "customer"
  | "super_admin"
  | "operations_manager"
  | "filing_officer"
  | "front_desk"
  | "finance";

export type User = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  /** Agreed to updates on WhatsApp. */
  whatsapp_updates?: boolean;
  type: "customer" | "staff";
  status: "active" | "suspended";
  avatar_url: string | null;
  email_verified: boolean;
  roles: { name: RoleName; label: string }[];
  /** Staff only. `["*"]` means Super Admin. */
  permissions?: string[];
  last_login_at: string | null;
  created_at: string | null;
};

export type Paginated<T> = {
  data: T[];
  links: { first: string | null; last: string | null; prev: string | null; next: string | null };
  meta: { current_page: number; last_page: number; per_page: number; total: number; from: number | null; to: number | null };
};

/** Shape returned by form Server Actions and consumed by useActionState. */
export type FormState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string[]>;
  values?: Record<string, string>;
};

/* ---------- Service catalogue (money in kobo) ---------- */

export type FieldTypeName =
  | "text"
  | "textarea"
  | "number"
  | "email"
  | "phone"
  | "date"
  | "select"
  | "radio"
  | "checkbox"
  | "file"
  | "people";

export type FormField = {
  id?: number;
  key: string;
  label: string;
  type: FieldTypeName;
  options: string[];
  placeholder: string | null;
  help_text: string | null;
  is_required: boolean;
};

export type DocumentRequirement = { id?: number; label: string; description: string | null; is_required: boolean };

export type ServiceStage = { id?: number; name: string; description: string | null; customer_visible: boolean };

export type Service = {
  id: number;
  service_category_id: number;
  category?: { id: number; name: string; slug: string };
  name: string;
  slug: string;
  summary: string;
  description: string | null;
  service_fee: number;
  government_fee: number;
  total_fee: number;
  turnaround_days: number | null;
  requires_business: boolean;
  is_active: boolean;
  sort_order: number;
  form_fields_count?: number;
  document_requirements_count?: number;
  stages_count?: number;
  form_fields?: FormField[];
  document_requirements?: DocumentRequirement[];
  stages?: ServiceStage[];
  updated_at: string | null;
};

export type ServiceCategory = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  sort_order: number;
  is_active: boolean;
  services_count?: number;
  services?: Service[];
};

export type Bundle = {
  id: number;
  name: string;
  slug: string;
  summary: string;
  description: string | null;
  price: number;
  value_of_services?: number;
  is_active: boolean;
  sort_order: number;
  services?: { id: number; name: string; slug: string; total_fee: number; is_active: boolean }[];
};

export type Catalogue = { categories: ServiceCategory[]; bundles: Bundle[] };

/* ---------- Settings ---------- */

export type GatewayField = {
  name: string;
  label: string;
  secret: boolean;
  required: boolean;
  prefix: string | null;
  help: string | null;
  /** Public keys in full; secrets masked like "sk_test_••••1a2b"; null when not set. */
  value: string | null;
};

export type PaymentGateway = {
  code: "paystack" | "flutterwave" | "stripe";
  label: string;
  description: string;
  dashboard_url: string;
  is_enabled: boolean;
  mode: "test" | "live";
  configured: { test: boolean; live: boolean };
  fields: { test: GatewayField[]; live: GatewayField[] };
  webhook_url: string;
  verified_at: string | null;
  updated_at: string | null;
};

export type BankAccount = { id: number; bank_name: string; account_name: string; account_number: string; is_active: boolean; sort_order: number };

export type BankTransferSettings = { enabled: boolean; instructions: string | null; accounts: BankAccount[] };

export type MailProvider = { key: string; label: string; host: string; port: number; encryption: "tls" | "ssl"; username_hint: string };

export type MailSettings = {
  configured: boolean;
  enabled: boolean;
  provider: string;
  host: string | null;
  port: number | null;
  encryption: "tls" | "ssl";
  username: string | null;
  password_set: boolean;
  from_address: string;
  from_name: string;
  server_mailer: string | null;
  providers: MailProvider[];
};

export type EmailTemplate = {
  key: string;
  name: string;
  description: string;
  group: string;
  is_essential: boolean;
  placeholders: { name: string; label: string }[];
  is_enabled: boolean;
  subject: string;
  heading: string;
  body: string;
  button_text: string | null;
  footer: string | null;
  is_customised: boolean;
  updated_at: string | null;
};

/* ---------- Billing (money in kobo) ---------- */

export type InvoiceStatus = "unpaid" | "paid" | "void";
export type PaymentStatus = "pending" | "success" | "failed" | "abandoned" | "awaiting_review" | "rejected" | "refunded" | "partially_refunded";

export type Payment = {
  reference: string;
  receipt_number: string | null;
  invoice_id: number;
  invoice?: { id: number; number: string; total: number; status: InvoiceStatus };
  customer?: { id: number; name: string; email: string; phone: string | null };
  gateway: string;
  gateway_label: string;
  mode: "test" | "live";
  amount: number;
  currency: string;
  status: PaymentStatus;
  status_label: string;
  channel: string | null;
  amount_refunded: number;
  refundable: number;
  sender_name: string | null;
  transferred_on: string | null;
  has_proof: boolean;
  proof_name: string | null;
  review_note: string | null;
  reviewed_by?: string | null;
  reviewed_at: string | null;
  failure_reason: string | null;
  paid_at: string | null;
  created_at: string | null;
  refunds?: { id: number; amount: number; reason: string; method: "gateway" | "manual"; status: string; gateway_reference: string | null; created_at: string | null }[];
};

export type Invoice = {
  id: number;
  number: string;
  status: InvoiceStatus;
  status_label: string;
  currency: string;
  subtotal: number;
  total: number;
  /** Discount code on the invoice; its discount is already taken off `total`. */
  coupon_code: string | null;
  coupon_discount: number;
  accepts_coupon: boolean;
  amount_paid: number;
  amount_refunded: number;
  balance: number;
  is_payable: boolean;
  /** A pass or membership invoice: paying by card can set up automatic renewal. */
  for_plan?: boolean;
  has_pending_transfer?: boolean;
  due_at: string | null;
  is_overdue: boolean;
  paid_at: string | null;
  voided_at: string | null;
  notes: string | null;
  customer?: { id: number; name: string; email: string; phone: string | null };
  created_by?: string | null;
  items?: { id: number; service_id: number | null; description: string; quantity: number; unit_amount: number; amount: number }[];
  payments?: Payment[];
  created_at: string | null;
};

export type PaymentOptions = {
  gateways: { code: string; label: string; description: string; mode: "test" | "live" }[];
  bank_transfer: { enabled: boolean; instructions: string | null; accounts: { bank_name: string; account_name: string; account_number: string }[] };
};

export type Receipt = {
  payment: Payment;
  invoice: Invoice;
  customer: { name: string; email: string; phone: string | null };
  issuer: { name: string; address: string; email: string };
};

export type FinanceSummary = {
  collected_30d: number;
  refunded_30d: number;
  outstanding: number;
  unpaid_invoices: number;
  awaiting_review: number;
  revenue_by_month: { month: string; label: string; value: number }[];
};

/* ---------- Orders ---------- */

export type OrderStatus = "awaiting_payment" | "received" | "in_progress" | "awaiting_client" | "completed" | "cancelled";

export type OrderFile = {
  id: number;
  kind: "requirement" | "field" | "deliverable";
  label: string;
  name: string;
  mime: string | null;
  size: number;
  status: "pending" | "accepted" | "rejected";
  review_note: string | null;
  created_at: string | null;
};

export type Person = { full_name: string; email?: string | null; phone?: string | null; id_number?: string | null };

export type Order = {
  reference: string;
  status: OrderStatus;
  status_label: string;
  service: { id: number; name: string; slug: string | null };
  customer?: { id: number; name: string; email: string; phone: string | null };
  officer?: { id: number; name: string } | null;
  invoice?: { id: number; number: string; status: InvoiceStatus; total: number; balance: number } | null;
  stages: { index: number; name: string; description: string | null; customer_visible: boolean; state: "done" | "current" | "upcoming" }[];
  current_stage: number;
  progress: number;
  paid_at: string | null;
  due_at: string | null;
  is_overdue: boolean;
  completed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string | null;
  answers?: { key: string; label: string; type: FieldTypeName; is_required: boolean; value: unknown; file: OrderFile | null }[];
  documents?: { id: number; label: string; description: string | null; is_required: boolean; file: OrderFile | null; history: number }[];
  deliverables?: OrderFile[];
  outstanding_documents?: number;
  events?: { id: number; type: string; message: string | null; by: string | null; customer_visible: boolean; created_at: string | null }[];
  messages?: { id: number; body: string; is_internal: boolean; author: string | null; from_staff: boolean; created_at: string | null }[];
};

export type VaultFile = OrderFile & { order_reference: string; service_name: string };

export type OrderSummary = {
  by_status: Record<OrderStatus, number>;
  overdue: number;
  mine: number;
  unassigned: number;
};

/* ---------- Workspace (money in kobo) ---------- */

export type OpeningDay = { day: number; opens: string | null; closes: string | null; closed: boolean };

export type Location = {
  id: number;
  name: string;
  slug: string;
  address: string;
  city: string;
  state: string;
  phone: string | null;
  email: string | null;
  description: string | null;
  amenities: string[];
  hours: OpeningDay[];
  timezone: string;
  is_active: boolean;
  sort_order: number;
  spaces_count?: number;
  spaces?: Space[];
};

export type BookingMode = "exclusive" | "shared";

export type SpaceType = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  booking_mode: BookingMode;
  is_active: boolean;
  sort_order: number;
  spaces_count?: number;
};

export type RateUnit = "hour" | "day" | "week" | "month";

export type SpaceRate = { unit: RateUnit; price: number; is_active: boolean };

export type CancellationRule = { hours_before: number; refund_percent: number };

export type CancellationPolicy = {
  id: number;
  name: string;
  description: string | null;
  rules: CancellationRule[];
  summary: string[];
  is_default: boolean;
  spaces_count?: number;
};

export type AddonChargeType = "per_booking" | "per_hour" | "per_person";

export type Addon = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  charge_type: AddonChargeType;
  max_quantity: number;
  is_active: boolean;
  sort_order: number;
  space_ids?: number[];
};

export type Space = {
  id: number;
  name: string;
  slug: string;
  summary: string | null;
  description: string | null;
  capacity: number;
  amenities: string[];
  hours: OpeningDay[] | null;
  uses_location_hours: boolean;
  min_duration_minutes: number;
  max_duration_minutes: number | null;
  buffer_minutes: number;
  min_notice_minutes: number;
  advance_booking_days: number;
  requires_approval: boolean;
  photo_url: string | null;
  is_active: boolean;
  sort_order: number;
  location_id: number;
  space_type_id: number;
  cancellation_policy_id: number | null;
  location?: { id: number; name: string; slug: string };
  type?: SpaceType;
  cancellation_policy?: CancellationPolicy | null;
  rates?: SpaceRate[];
  addons?: Addon[];
};

export type Closure = {
  id: number;
  location_id: number;
  space_id: number | null;
  location?: string;
  space?: string | null;
  starts_at: string;
  ends_at: string;
  reason: string;
};

export type PassPlan = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  credit_type: "visits" | "hours";
  credits: number;
  period: "week" | "month";
  allowance: string;
  location_id: number | null;
  location?: string | null;
  space_type_ids?: number[];
  space_types?: string[];
  is_active: boolean;
  sort_order: number;
};

export type MembershipPlan = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  billing_period: "month" | "quarter" | "year";
  booking_discount_percent: number;
  perks: string[];
  /** Virtual office: members get a mailbox at this location. */
  mailbox_location_id: number | null;
  mailbox_location?: string | null;
  is_featured: boolean;
  is_active: boolean;
  sort_order: number;
};

/* ---------- Bookings (money in kobo, times as ISO strings in UTC) ---------- */

export type BookingStatus = "held" | "pending_approval" | "confirmed" | "checked_in" | "completed" | "expired" | "cancelled";

export type BookingSettings = { destination: "external" | "internal"; external_url: string };

export type WorkspaceCatalogue = { locations: Location[]; pass_plans: PassPlan[]; memberships: MembershipPlan[] };

/** A named seat in a shared space (hot desk). */
export type SpaceSeat = { id: number; space_id: number; label: string; zone: string | null; is_active: boolean; sort_order: number; bookings_count?: number };

/** Seats for one time window. `free` is null when the space has no named seats. */
export type SeatMap = { seats: { id: number; label: string; zone: string | null; available: boolean }[]; free: number | null; current?: number[] };

export type DayAvailability = {
  date: string;
  closed: boolean;
  reason: string | null;
  opens: string | null;
  closes: string | null;
  starts: { time: string; max_minutes: number }[];
};

export type BookingQuote = {
  starts_at: string;
  ends_at: string;
  lines: { label: string; amount: number }[];
  subtotal: number;
  addons_total: number;
  discount: number;
  discount_label: string | null;
  total: number;
  eligible_pass: { id: number; name: string; credits_needed: number; credits_left: number } | null;
  requires_approval: boolean;
  hold_minutes: number;
};

export type Booking = {
  id: number;
  reference: string;
  status: BookingStatus;
  status_label: string;
  starts_at: string;
  ends_at: string;
  rate_unit: RateUnit;
  quantity: number;
  seats: number;
  /** Named seats, on hot desks that have them set up. */
  assigned_seats?: { id: number; label: string; zone: string | null }[];
  subtotal: number;
  addons_total: number;
  discount: number;
  discount_label: string | null;
  total: number;
  pass_credits_used: number;
  paid_via: "online" | "bank_transfer" | "pass" | "free" | "coupon" | null;
  hold_expires_at: string | null;
  /** Held and still within its payment window. */
  hold_active: boolean;
  check_in_code: string | null;
  checked_in_at: string | null;
  space_name: string;
  location_name: string;
  cancellation_policy: string[];
  notes: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  refund_amount: number;
  can_cancel: boolean;
  refund_preview?: number;
  space?: { id: number; slug: string; name: string; photo_url: string | null; location: { name: string; address: string; city: string; timezone: string } | null };
  addons?: { name: string; quantity: number; total: number }[];
  invoice?: Invoice | null;
  customer?: { id: number; name: string; email: string; phone: string | null; is_guest: boolean };
  checked_in_by?: string | null;
  created_at: string | null;
};

/** Renewal details shared by passes and memberships in "My plans". */
export type PlanRenewalInfo = {
  id: number;
  name: string;
  status: "pending" | "active" | "expired";
  starts_at: string | null;
  ends_at: string | null;
  invoice_id: number | null;
  invoice_payable: boolean;
  /** This period is itself a renewal of an earlier one. */
  is_renewal: boolean;
  auto_renew: boolean;
  /** Price of the next period, or null when the plan is no longer offered. */
  renewal_price: number | null;
  renewal_failure: string | null;
  /** card: renews with the saved card · manual: waits for the customer · unavailable: plan no longer offered */
  renewal_mode: "card" | "manual" | "unavailable";
  renewal: { id: number; status: "pending" | "active"; starts_at: string | null; invoice_id: number | null; invoice_payable: boolean } | null;
};

export type MyPlans = {
  passes: (PlanRenewalInfo & {
    credit_type: "visits" | "hours";
    credits: number;
    credits_left: number;
    period: "week" | "month";
  })[];
  memberships: (PlanRenewalInfo & {
    discount_percent: number;
    billing_period: "month" | "quarter" | "year";
  })[];
  /** The card automatic renewals use. */
  card: { id: number; label: string } | null;
};

export type AdminBookingDay = {
  date: string;
  counts: { bookings: number; arrivals: number; checked_in: number; awaiting_approval: number };
  locations: {
    id: number;
    name: string;
    timezone: string;
    hours: OpeningDay[];
    spaces: {
      id: number;
      name: string;
      capacity: number;
      is_shared: boolean;
      bookings: { reference: string; status: BookingStatus; status_label: string; starts_at: string; ends_at: string; seats: number; seat_labels?: string; customer: string }[];
    }[];
  }[];
};

/* ---------- Reports (money in kobo) ---------- */

export type BusinessReport = {
  from: string;
  to: string;
  totals: {
    collected: number;
    refunded: number;
    net: number;
    previous_collected: number;
    payments: number;
    bookings: number;
    booked_hours: number;
    cancelled_bookings: number;
    orders: number;
    new_customers: number;
    new_guests: number;
  };
  revenue_interval: "day" | "week";
  revenue_series: { key: string; label: string; amount: number }[];
  revenue_by_source: { source: string; amount: number; count: number }[];
  payment_methods: { method: string; amount: number; count: number }[];
  spaces: { space: string; location: string; is_shared: boolean; bookings: number; hours: number; amount: number; occupancy: number }[];
  services: { service: string; orders: number; amount: number }[];
  plans: { passes_sold: number; memberships_sold: number; active_memberships: number };
};

/* ---------- Legal documents and e-signing ---------- */

export type LegalAudience = "selected" | "members" | "all";

export type Signatory = { name: string | null; title: string | null; signature: string | null };

export type LegalDocument = {
  id: number;
  title: string;
  description: string | null;
  file_name: string;
  audience: LegalAudience;
  is_active: boolean;
  signatures_count: number;
  created_at: string;
  audience_count?: number;
};

export type LegalDocumentDetail = LegalDocument & {
  recipients: { id: number; name: string; email: string; signed_at: string | null; signer_name: string | null }[];
  selected_user_ids: number[];
};

export type CustomerOption = { id: number; name: string; email: string };

export type Agreement = {
  id: number;
  title: string;
  description: string | null;
  file_name: string;
  created_at: string;
  is_open: boolean;
  signed_at: string | null;
  signer_name: string | null;
  signatory?: { name: string; title: string | null } | null;
};

/* ---------- Activity log ---------- */

export type ActivityEvent = "auth.login" | "auth.login_failed" | "auth.logout" | "admin.change";

export type ActivityLogEntry = {
  id: number;
  event: ActivityEvent;
  description: string;
  route: string | null;
  method: string | null;
  path: string | null;
  status: number | null;
  succeeded: boolean;
  properties: { subject?: Record<string, string | number>; fields?: string[]; email?: string };
  ip: string | null;
  user_agent: string | null;
  user: { id: number; name: string; email: string; type: string } | null;
  created_at: string;
};

/* ---------- Coupons (money in kobo) ---------- */

export type CouponAppliesTo = "all" | "services" | "bookings" | "plans";

export type Coupon = {
  id: number;
  code: string;
  description: string | null;
  discount_type: "percent" | "fixed";
  /** Percent (1 to 100) or kobo. */
  discount_value: number;
  max_discount: number | null;
  min_spend: number | null;
  label: string;
  applies_to: CouponAppliesTo;
  max_uses: number | null;
  max_uses_per_customer: number | null;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  state: "active" | "scheduled" | "expired" | "used_up" | "off";
  uses: number;
  paid_uses: number;
  discount_given: number;
  created_by?: string | null;
  created_at: string | null;
};

/* ---------- Virtual office ---------- */

export type MailAction = "collect" | "forward" | "scan" | "shred";
export type MailOutcome = "collected" | "forwarded" | "shredded";

export type MailItem = {
  id: number;
  kind: "letter" | "parcel" | "official";
  kind_label: string;
  sender: string | null;
  description: string | null;
  received_at: string;
  status: "waiting" | MailOutcome;
  status_label: string;
  requested_action: MailAction | null;
  request_label: string | null;
  request_note: string | null;
  requested_at: string | null;
  has_scan: boolean;
  scanned_at: string | null;
  handled_at: string | null;
  handled_note: string | null;
  handled_by?: string | null;
  logged_by?: string | null;
  mailbox?: { id: number; number: string; business_name: string; customer: { id: number; name: string; email: string } | null };
};

export type Mailbox = {
  id: number;
  number: string;
  business_name: string;
  state: "active" | "lapsed" | "closed";
  status: "active" | "closed";
  active_until: string | null;
  address_lines?: string[];
  location?: { id: number; name: string; address: string; city: string; state: string };
  membership?: { id: number; name: string; ends_at: string | null } | null;
  waiting_count?: number;
  request_count?: number;
  notes?: string | null;
  customer?: { id: number; name: string; email: string; phone: string | null };
  items?: MailItem[];
  created_at: string | null;
};

/* ---------- Businesses and compliance ---------- */

export type EntityType = "business_name" | "company" | "trustees";
export type ComplianceState = "overdue" | "due_soon" | "upcoming" | "done" | "dismissed";

export type ComplianceItem = {
  id: number;
  business_id: number;
  kind: string;
  kind_label: string;
  authority: string | null;
  title: string;
  period_label: string | null;
  /** YYYY-MM-DD */
  due_on: string;
  /** Negative once it's late. */
  days_left: number;
  state: ComplianceState;
  status: "open" | "done" | "dismissed";
  is_custom: boolean;
  note: string | null;
  completed_at: string | null;
  /** The service that files it for them, when we offer one. */
  service_slug: string | null;
  business?: { id: number; name: string; owner: { id: number; name: string; email: string } | null };
};

export type BusinessHealth = {
  score: number;
  band: "good" | "attention" | "risk";
  label: string;
  issues: { text: string; points: number; kind: "overdue" | "due_soon" | "details" }[];
};

export type Business = {
  id: number;
  name: string;
  entity_type: EntityType;
  entity_type_label: string;
  registration_number: string | null;
  registered_on: string | null;
  tin: string | null;
  vat_registered: boolean;
  has_employees: boolean;
  financial_year_end_month: number;
  state: string | null;
  industry: string | null;
  health?: BusinessHealth;
  next_deadlines?: ComplianceItem[];
  created_at: string;
};

/* ---------- Consultations ---------- */

export type ConsultationMode = "in_person" | "video" | "phone";
export type ConsultationStatus = "pending_payment" | "confirmed" | "completed" | "no_show" | "cancelled" | "expired";

export type ConsultationType = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  mode: ConsultationMode;
  mode_label: string;
  /** ISO weekday ("1" Monday to "7" Sunday) => [opens, closes] in Lagos time. */
  schedule: Record<string, [string, string]>;
  notice_hours: number;
  is_active: boolean;
  sort_order: number;
  upcoming_count?: number;
};

export type Consultation = {
  id: number;
  reference: string;
  name: string;
  mode: ConsultationMode;
  mode_label: string;
  starts_at: string;
  ends_at: string;
  topic: string;
  status: ConsultationStatus;
  status_label: string;
  hold_expires_at: string | null;
  price: number;
  meeting_details: string | null;
  /** Unpaid, and the time is still held. */
  hold_active: boolean;
  /** Awaiting payment or confirmed, and not over yet. */
  is_upcoming: boolean;
  has_started: boolean;
  can_cancel: boolean;
  free_cancel_until: string;
  /** Cancelling now gets a full refund. */
  free_cancel: boolean;
  cancelled_at: string | null;
  cancel_reason: string | null;
  refund_amount: number;
  invoice?: Invoice | null;
  officer?: { id: number; name: string } | null;
  type?: { id: number; slug: string; name: string };
  staff_notes?: string | null;
  raw_meeting_details?: string | null;
  customer?: { id: number; name: string; email: string; phone: string | null };
  created_at: string;
};

/* ---------- WhatsApp ---------- */

export type WhatsAppSettings = {
  enabled: boolean;
  phone_number_id: string | null;
  access_token_set: boolean;
  language: string;
  configured: boolean;
  opted_in_customers: number;
  events: { key: string; name: string; group: string; template: string | null; parameters: { key: string; label: string }[] }[];
};

/* ---------- Appointments (staff book clients) ---------- */

export type AppointmentStatus = "scheduled" | "attended" | "no_show" | "cancelled";

export type AppointmentMode = "in_person" | "phone" | "video";

/** How a client kept past appointments. */
export type ClientHistory = { total: number; on_time: number; late: number; no_show: number; cancelled: number; average_minutes_late: number | null };

export type Appointment = {
  id: number;
  reference: string;
  title: string;
  mode: AppointmentMode;
  mode_label: string;
  /** What the client sees: staff's own details, or the default for the mode. */
  meeting_details: string;
  /** What staff typed, if anything. */
  custom_meeting_details: string | null;
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
  status: AppointmentStatus;
  status_label: string;
  minutes_late: number | null;
  response: "confirmed" | "reschedule_requested" | null;
  response_note: string | null;
  responded_at: string | null;
  reminded_day_at: string | null;
  reminded_hour_at: string | null;
  staff_notes: string | null;
  staff_name: string | null;
  assigned_to: number | null;
  created_by?: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  can_respond: boolean;
  client?: { id: number; name: string; email: string; phone: string | null; is_guest: boolean; whatsapp: boolean; whatsapp_live: boolean };
  history?: ClientHistory;
  created_at: string;
};

/** The client's own view, opened from the link in their messages. */
export type ClientAppointment = Pick<
  Appointment,
  "reference" | "title" | "mode" | "mode_label" | "meeting_details" | "starts_at" | "ends_at" | "status" | "status_label" | "response" | "responded_at" | "staff_name" | "can_respond"
> & { client_first_name?: string; punctuality: string };

export type AppointmentClient = { id: number; name: string; email: string; phone: string | null; is_guest: boolean; history: ClientHistory };

export type AppointmentSettings = { arrive_early_minutes: number; grace_minutes: number; message: string };

/* ---------- Saved cards and renewals ---------- */

export type SavedCard = {
  id: number;
  label: string;
  brand: string | null;
  last4: string;
  expires: string | null;
  is_expired: boolean;
  bank: string | null;
  is_default: boolean;
  test_mode: boolean;
  last_used_at: string | null;
};

export type RenewalRow = {
  kind: "pass" | "membership";
  id: number;
  name: string;
  customer: { id: number; name: string; email: string };
  status: string;
  ends_at: string | null;
  price: number | null;
  auto_renew: boolean;
  card: string | null;
  attempts: number;
  last_attempt_at: string | null;
  failure: string | null;
  renewal_invoice_id: number | null;
};

export type RenewalsOverview = {
  upcoming: RenewalRow[];
  failed: RenewalRow[];
  overdue: { id: number; number: string; customer: { id: number; name: string; email: string }; balance: number; due_at: string | null; reminders_sent: number }[];
  stats: { renewing_14_days: number; auto_renew_share: number | null; overdue_total: number };
};

/** A blog post. body_html comes with a single post; the admin fields only from /admin/blog. */
export type BlogPost = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  cover_url: string | null;
  cover_alt: string | null;
  category: string | null;
  author_name: string | null;
  published_at: string | null;
  reading_minutes: number;
  meta_description: string | null;
  body_html?: string;
  state?: "draft" | "scheduled" | "published";
  own_excerpt?: string | null;
  from_wordpress?: boolean;
  updated_at?: string | null;
  body?: string;
};

export type BlogIndex = Paginated<BlogPost> & { categories: string[] };

export type AppNotification = {
  id: string;
  event: string | null;
  group: string | null;
  title: string;
  body: string;
  /** A path on this site (or a full address), or null when there's nothing to open. */
  url: string | null;
  read: boolean;
  created_at: string | null;
};

export type NotificationFeed = { data: AppNotification[]; unread_count: number };
