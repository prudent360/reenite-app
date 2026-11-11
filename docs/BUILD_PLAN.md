# Reenite Business Suite — Build Plan

> "Building a Business? Don't Build Alone."
> Done-for-you incorporation, tax, online presence and workspace for Nigerian businesses.

Status: **M1 to M6 complete — M6 (Booking engine) on 2026-10-27.** M6 adds an admin switch (Settings > Space booking) that sends "Book a space" either to this site or to the existing book.reenite.com; it defaults to book.reenite.com, and this site refuses bookings while it does. Guest booking is supported (guest accounts become normal accounts on registration or password reset). Check-in uses a 6-character code, and the booking pass shows it as a QR code that opens the admin check-in with the code filled in (2026-11-10). Next: M7 Dashboards & polish. **M8 hardening (2026-11-06):** activity log (Admin > Activity log, Super Admin only; admin changes, sign-ins and failed sign-ins, kept a year), hourly per-email sign-in limit, visitor IP forwarded from the website with INTERNAL_API_KEY, daily backups (`app:backup`, `--files` weekly), queue run from cron on shared hosting (QUEUE_FROM_SCHEDULER), `ProductionSeeder` + `app:create-admin`, /privacy and /terms (NDPA 2023, drafts for legal review), sitemap, robots and share image. Deployment steps: docs/DEPLOY.md (Hostinger API + Vercel web). **2026-11-10:** uploads capped at 3MB (fits Vercel's 4.5MB request limit); discount codes (Admin > Finance > Coupons, `coupons.manage`), applied to the invoice so they work on orders, bookings, passes, memberships and staff invoices, and a 100% code settles the invoice; virtual office (a membership plan can include a mailbox at a location; Admin > Mail for the front desk, `mail.manage`; customers see their address and mail at Dashboard > Mailbox and ask for collect, forward, scan or shred). **2026-11-10 (later):** My Businesses with a compliance calendar (deadlines worked out from business type, registration date, TIN, VAT and PAYE; emailed 14 and 3 days before and once when missed; Admin > Compliance for officers, `compliance.manage`) and a 0 to 100 business health score; paid consultations with officers (Dashboard > Consultations; types, weekly hours and assignment under Admin > Consultations, `consultations.manage` / `consultations.view_assigned`; held 30 minutes while unpaid, full refund 24+ hours before); WhatsApp updates through the WhatsApp Cloud API for customers who opt in (Admin > Settings > WhatsApp).

Seeded service prices (including government fees) are placeholders until Reenite confirms real figures.

Local development uses SQLite (`api/database/database.sqlite`); switch `DB_CONNECTION=mysql` and credentials in `api/.env` for MySQL.

---

## 1. Architecture

```
┌──────────────────────────┐        HTTPS / JSON        ┌───────────────────────────┐
│  web/  (Next.js 16)      │  ───────────────────────▶  │  api/  (Laravel 13)       │
│  - Public marketing site │   Sanctum token auth       │  - REST API /api/v1       │
│  - Customer dashboard    │                            │  - Queues + scheduler     │
│  - Admin / staff console │  ◀───────────────────────  │  - Payment webhooks       │
└──────────────────────────┘                            └─────────────┬─────────────┘
                                                                      │
                     ┌──────────────┬──────────────┬─────────────────┼──────────────┐
                     ▼              ▼              ▼                 ▼              ▼
                  MySQL         Redis*        R2 / S3 (private)   Paystack /     Resend / Termii
                (primary)   (queue, cache,   documents & media   Flutterwave /   (email, SMS,
                             slot holds)                          Stripe          WhatsApp)
```
\* Local dev uses the `database` queue/cache driver; Redis in production.

**Repo layout (monorepo)**
```
reenite-business/
├─ api/          Laravel 13 API (PHP 8.4+)
├─ web/          Next.js 16 + TypeScript + Tailwind + shadcn/ui
└─ docs/         This plan, API notes, deployment guide
```

**Key choices**
- Auth: Laravel Sanctum (SPA cookie auth for web, tokens available for a future mobile app).
- Roles/permissions: `spatie/laravel-permission`.
- Money stored as integer **kobo** (NGN × 100) to avoid float errors.
- Timezone: stored UTC, displayed `Africa/Lagos`.
- Files: private bucket, served via short-lived signed URLs only.
- API versioned under `/api/v1`, JSON resources, consistent error envelope.

---

## 2. Brand & UI System

| Token | Value |
|---|---|
| `--navy-900` (primary, sampled from logo) | `#1A2142` |
| `--navy-700` | `#2A3260` |
| `--navy-50` | `#E8EAF2` |
| `--orange-500` (accent, sampled from logo) | `#F05A28` |
| `--orange-50` | `#FDEBE4` |

**Brand assets** (`docs/brand/`):
- `reenite-logo-full.png`: full lockup (icon + wordmark), 2344×626
- `reenite-icon-color.svg`: icon, navy dots + orange chevron (redrawn as vector from the logo)
- `reenite-icon-white.svg` / `reenite-icon-white-accent.svg`: for navy/dark backgrounds
- `reenite-icon-mono.jpg`, `reenite-icon-color.png`: originals

The favicon and app icons will be generated from the SVG. A white wordmark for dark backgrounds will be made by recoloring the PNG (a real SVG wordmark from the designer would be better).
| `--bg` | `#F7F8FB` |
| success / warning / danger | green / amber / red scales |

- Headings: **Plus Jakarta Sans** (800/700). Body: **Inter**.
- Icons: Lucide (SVG) only — no emojis.
- Brand motifs: three-dot loader, chevron step markers, faded diamond hero pattern.
- Layout: navy sidebar (collapsible) on desktop; bottom tab bar on mobile; Cmd+K command palette; dark mode.
- Every long-running thing shows a **status timeline** with the assigned Reenite officer's face.

---

## 3. Roles

| Role | Can do |
|---|---|
| **Customer** | Own businesses, orders, bookings, documents, invoices, messages |
| **Customer team member** | Invited by owner; scoped permissions per business |
| **Super Admin** | Everything, including payment & system settings |
| **Operations Manager** | Services, orders, assignment, reports |
| **Filing Officer** | Their assigned orders, customer docs for those orders |
| **Front Desk** | Workspace bookings, check-in, (phase 2) mail logging |
| **Finance** | Payments, refunds, bank-transfer approval, invoices |

---

## 4. Data Model

### 4.1 Identity & businesses
| Table | Key columns |
|---|---|
| `users` | name, email, phone, password, avatar, type (customer/staff), email_verified_at, phone_verified_at, status |
| `businesses` | owner_id, name, type (business_name/ltd/incorporated_trustees/other), rc_number, tin, status (prospective/registered), registered_address, industry |
| `business_members` | business_id, user_id, role (owner/admin/viewer) |
| `business_people` | business_id, kind (director/shareholder/proprietor/trustee/secretary), full_name, nin*, dob*, address*, shares, id_document_id |

\* encrypted at rest (Laravel encrypted casts).

### 4.2 Service catalogue (admin-built)
| Table | Key columns |
|---|---|
| `service_categories` | name, slug, icon, sort, is_active (Incorporation, Tax, Regulatory, Online Presence) |
| `services` | category_id, name, slug, summary, description, service_fee, government_fee, turnaround_days, is_active, requires_business |
| `service_form_fields` | service_id, key, label, type (text/select/date/file/people-list/...), options, required, sort — **form builder** |
| `service_document_requirements` | service_id, label, description, required |
| `service_stages` | service_id, name, sort, customer_visible — **custom timeline per service** |
| `bundles` / `bundle_service` | name, price, services included |

### 4.3 Orders (done-for-you pipeline)
| Table | Key columns |
|---|---|
| `orders` | reference (RN-2026-000123), user_id, business_id, service_id / bundle_id, status, current_stage_id, assigned_to, due_at, sla_breached, subtotal, discount, total |
| `order_answers` | order_id, field_key, value |
| `order_documents` | order_id, document_id, requirement_id, status (pending/accepted/rejected), note |
| `order_events` | order_id, actor_id, type (stage_change/note/request_info/upload), payload, customer_visible |
| `order_deliverables` | order_id, document_id, title (e.g. "CAC Certificate") |

**Order statuses:** `draft → awaiting_payment → received → in_progress ⇄ awaiting_client → submitted → completed` (+ `cancelled`, `refunded`).

### 4.4 Documents
| Table | Key columns |
|---|---|
| `documents` | owner (polymorphic: user/business/order), uploaded_by, disk, path, original_name, mime, size, category, visibility (customer/staff_only) |

### 4.5 Workspace
| Table | Key columns |
|---|---|
| `locations` | name, slug, address, city, state, lat, lng, phone, email, photos, amenities, timezone, is_active |
| `location_hours` | location_id, day_of_week, opens_at, closes_at, is_closed |
| `space_types` | name, slug, icon, booking_mode (**exclusive** / **shared**) — admin-extensible (Event Space, Podcast Studio, Hot Desk, Private Office…) |
| `spaces` | location_id, space_type_id, name, slug, description, capacity, photos, amenities, is_active, **min_duration, max_duration, buffer_minutes, advance_booking_days, cancellation_policy_id**, requires_approval |
| `space_hours` | space_id, day_of_week, opens_at, closes_at, is_closed (overrides location hours) |
| `space_rates` | space_id, unit (**hour/day/week/month**), price, is_active |
| `addons` / `addon_space` | name, price, charge_type (per_booking/per_hour/per_unit), max_qty, is_active |
| `blackout_dates` | scope (location/space), scope_id, starts_at, ends_at, reason |
| `cancellation_policies` | name, rules JSON e.g. `[{hours_before:48, refund_pct:100},{hours_before:24, refund_pct:50},{hours_before:0, refund_pct:0}]` |

**Flexible plans & memberships**
| Table | Key columns |
|---|---|
| `pass_plans` | name ("3 visits / week", "12 visits / month", "10 studio hours / month"), price, credit_type (**visits/hours**), credits, period (**week/month**), validity_days, is_active |
| `pass_plan_space` | which spaces / space types a plan can be redeemed on |
| `membership_plans` | name, price, billing_period (month/quarter/year), included pass_plan credits, booking_discount_pct, locations covered, perks JSON |
| `customer_passes` | user_id, pass_plan_id or membership_id, credits_total, credits_used, period_starts_at, period_ends_at, status |
| `pass_redemptions` | customer_pass_id, booking_id, credits |

**Bookings**
| Table | Key columns |
|---|---|
| `bookings` | reference (BK-…), user_id, space_id, starts_at, ends_at, seats, rate_unit, status, hold_expires_at, subtotal, addons_total, discount, total, paid_via (gateway/pass/transfer), check_in_code, checked_in_at, cancelled_at, refund_amount |
| `booking_addons` | booking_id, addon_id, qty, unit_price, total |

**Booking statuses:** `held → confirmed → checked_in → completed` | `held → expired` | `pending_approval` (bank transfer) | `cancelled` / `refunded`.

**Availability rule (server-side, inside a DB transaction with row lock on the space):**
1. Inside location *and* space opening hours.
2. Not overlapping any blackout.
3. Duration within min/max; start within advance_booking_days.
4. **Exclusive** space: no overlapping `held|confirmed|checked_in|pending_approval` booking (including buffer).
   **Shared** space (hot desk): sum of overlapping seats + requested ≤ capacity.
5. Create booking as `held`, `hold_expires_at = now + 15 min`; scheduler expires stale holds every minute.

### 4.6 Payments & billing
| Table | Key columns |
|---|---|
| `payment_gateways` | code (paystack/flutterwave/stripe/bank_transfer), is_enabled, mode (test/live), **credentials (encrypted JSON)**, supported_currencies, sort |
| `bank_accounts` | bank_name, account_name, account_number (for manual transfer) |
| `payments` | reference, payable (polymorphic: order/booking/pass/membership/invoice), user_id, gateway, amount, currency, status (pending/success/failed/refunded), gateway_reference, raw_response, proof_document_id, verified_by |
| `refunds` | payment_id, amount, reason, status, processed_by |
| `coupons` | code, type (pct/fixed), value, applies_to, max_uses, expires_at |
| `invoices` / `invoice_items` | auto-generated receipt per payment (PDF) |
| `settings` | key/value (VAT %, currency, company info, notification toggles) |

**Payment flow:** `POST /payments/initiate` → redirect/inline gateway → **webhook** (`/webhooks/{gateway}`, signature verified, idempotent on gateway_reference) → mark payment success → event `PaymentSucceeded` → listener confirms booking / moves order to `received` / activates pass → notifications. Browser callback only *polls* status; it never confirms.

### 4.7 Communication
| Table | Key columns |
|---|---|
| `conversations` / `messages` | per order (and general support), attachments |
| `notifications` | Laravel database notifications (bell icon) |
| `notification_templates` | event, channel (email/sms/whatsapp), subject, body — admin-editable |

### 4.8 Content
`pages`, `faqs`, `testimonials`, `posts` (guides/blog) — simple CMS for the public site.

### 4.9 Audit
`activity_log` (`spatie/laravel-activitylog`) — who viewed/changed sensitive records (NDPA).

---

## 5. API Surface (`/api/v1`)

**Auth:** `register`, `login`, `logout`, `me`, `forgot-password`, `reset-password`, `verify-email`, `verify-phone` (OTP via Termii).

**Public:** `services`, `services/{slug}`, `bundles`, `locations`, `locations/{slug}`, `spaces/{slug}`, `spaces/{id}/availability?date=`, `pass-plans`, `membership-plans`, `pages/{slug}`, `faqs`, `posts`.

**Customer (auth):**
- `businesses` CRUD, `businesses/{id}/people`, `businesses/{id}/members` (invite)
- `orders` (create from service, list, show), `orders/{id}/answers`, `orders/{id}/documents`, `orders/{id}/messages`
- `documents` (upload, list, signed download)
- `bookings/quote` (price calc), `bookings` (create hold), `bookings/{id}/cancel`, `bookings/{id}/qr`
- `passes` (my passes & balances), `memberships/subscribe`
- `payments/initiate`, `payments/{ref}/status`, `payments/{ref}/proof` (bank transfer)
- `invoices`, `notifications`, `dashboard/summary`

**Admin (auth + permission):**
- `admin/services`, `admin/services/{id}/fields|requirements|stages`, `admin/bundles`, `admin/categories`
- `admin/orders` (filters, kanban), `admin/orders/{id}/assign|stage|request-info|deliverables`
- `admin/locations`, `admin/locations/{id}/hours`, `admin/spaces`, `admin/spaces/{id}/hours|rates|addons`, `admin/space-types`, `admin/addons`, `admin/blackouts`, `admin/cancellation-policies`
- `admin/pass-plans`, `admin/membership-plans`
- `admin/bookings`, `admin/bookings/{id}/check-in` (QR scan), `admin/bookings/{id}/approve`
- `admin/payments`, `admin/payments/{id}/verify` (bank transfer), `admin/refunds`
- `admin/settings/payments` (gateways + keys), `admin/settings/general`, `admin/notification-templates`, `admin/coupons`
- `admin/users`, `admin/staff` (+ roles), `admin/reports/*`, `admin/cms/*`

**Webhooks:** `webhooks/paystack`, `webhooks/flutterwave`, `webhooks/stripe`.

---

## 6. Screens

### Public site
- Home (poster-style hero, services, how-it-works, workspace teaser, testimonials, CTA)
- Services catalogue + service detail (price breakdown: service fee vs government fee)
- "Which business type is right for me?" quiz
- Workspace: locations → location → space detail with availability calendar & booking widget
- Plans & memberships, About, Contact, Guides/blog, FAQ, Login/Register

### Customer dashboard
- **Overview**: Business Health card, next deadlines, active orders (progress), upcoming bookings, quick actions
- **My Businesses** (switcher in sidebar) → profile, people, documents
- **Services** → browse → order wizard (intake form → documents → review → pay)
- **Orders** → list → detail (timeline, officer card, requests for info, messages, deliverables)
- **Workspace** → book, my bookings (QR), passes & membership balances
- **Documents** vault, **Billing** (payments, invoices, receipts), **Messages**, **Notifications**, **Settings** (profile, security, team)

### Admin console
- **Overview**: revenue, orders by status, SLA breaches, today's bookings, occupancy
- **Orders** kanban + table, order detail workspace (customer docs, stage controls, internal notes)
- **Services builder** (fields, required docs, stages, pricing), Bundles
- **Workspace**: Locations, Spaces (hours/rates/add-ons/rules), Space types, Blackouts, Cancellation policies, Pass plans, Memberships, Bookings calendar, **Front-desk check-in** (QR scanner, mobile-friendly)
- **Finance**: Payments, transfer verification queue, Refunds, Coupons
- **Customers** CRM, **Staff & roles**
- **Settings**: Payment gateways, General, Notification templates, CMS

---

## 7. Build Milestones (Phase 1 / MVP)

| # | Milestone | Done when |
|---|---|---|
| **M1** | Foundations | Laravel API + Next.js scaffolded, MySQL, Sanctum auth (register/login/verify), roles seeded, design system (tokens, layout shells, components), public site skeleton |
| **M2** | Service catalogue & form builder | Admin creates categories/services/fields/requirements/stages; public catalogue renders them |
| **M3** | Payments core | Gateway settings UI, Paystack + Flutterwave + bank transfer (Stripe toggleable), webhooks, idempotency, receipts |
| **M4** | Orders pipeline | Customer order wizard → pay → order received; admin kanban, assign, stages, request-info, deliverables, messages, notifications; document vault with signed URLs |
| **M5** | Workspace setup | Locations, spaces, hours, rates, add-ons, blackouts, policies, pass plans, memberships — all admin CRUD |
| **M6** | Booking engine | Availability calc, quotes, holds, auto-confirm via webhook, pass redemption, cancellation/refunds, QR check-in, booking calendar |
| **M7** | Dashboards & polish | Customer overview + health score, admin reports, CMS, responsive QA, dark mode, empty states, seed demo data |
| **M8** | Hardening & deploy | Feature tests (availability, payments, permissions), rate limiting, audit log, backups, deployment to Forge/Cloud + Vercel |

Each milestone is verified (automated tests + running app) before moving on.

### Phase 2
Done: compliance calendar & auto reminders, virtual office + mail handling, customer-facing invoicing, WhatsApp notifications, consultations booking.

### Phase 3
Payroll/HR basics, legal templates + e-signature, AI assistant, member marketplace/community, events ticketing.

---

## 8. Hosting (production)

| Component | Choice |
|---|---|
| API | **Chosen: Hostinger** (api.reenite.com, PHP 8.3+, cron-driven scheduler and queue). Alternatives: Laravel Cloud or Forge |
| Frontend | Vercel (app.reenite.com) |
| Database | MySQL in hPanel |
| Queue/cache | Database driver (no Redis on shared hosting) |
| Files | Hostinger disk (private storage; persists, so no object storage needed) |
| DNS/WAF | Cloudflare |
| Email / SMS | Resend or Mailgun / Termii |
| Monitoring | Sentry + Laravel Pulse; daily DB backups |

Rough starting cost: ~$60–100/month (verify current pricing).

---

## 9. Security & Compliance (NDPA 2023)
- Encrypted casts for NIN/DOB/addresses and gateway credentials.
- Private storage, signed URLs (≤10 min), staff access only to assigned orders.
- Audit log on sensitive views/changes; data export & deletion on request.
- Webhook signature verification, idempotent processing, rate limits on auth/OTP.
- Privacy policy, terms, cookie notice; documented cross-border transfer safeguards.

---

## 10. Seed Data

### Locations
| Location | Status | Notes |
|---|---|---|
| **Reenite Uyo**, Uyo, Akwa Ibom State | **Real** (HQ) | Street address, phone and photos to be filled in by admin |
| Reenite Lekki, Lagos | Demo | Flagged `is_demo`; one-click "remove demo data" in admin |
| Reenite Wuse 2, Abuja | Demo | Same |

### Spaces per location (placeholder prices, editable)
| Space | Type | Mode | Capacity | Rates (NGN) |
|---|---|---|---|---|
| Main Event Hall | Event Space | exclusive | 80 | hourly 25,000 · daily 150,000 |
| Podcast Studio A | Podcast Studio | exclusive | 4 | hourly 15,000 · daily 90,000 |
| Open Workspace | Hot Desk | shared | 20 | daily 5,000 · weekly 22,000 · monthly 75,000 |
| Private Office 1–2 | Private Office | exclusive | 4 | daily 20,000 · weekly 90,000 · monthly 300,000 |

Hours: Mon–Fri 08:00–20:00, Sat 10:00–16:00, Sun closed. Studio buffer: 15 minutes. Blackouts: Nigerian public holidays for the current year.

### Flexible pass plans
- Flex 3: 3 hot-desk visits/week, NGN 13,500
- Flex 12: 12 hot-desk visits/month, NGN 50,000
- Studio 10: 10 podcast hours/month, NGN 120,000

### Memberships
- Starter: monthly, Flex 12 included, 10% off studio/event bookings
- Business: monthly, unlimited hot desk, 4 studio hours, 15% off, business address use (phase 2)

### Add-ons
Podcast engineer (per hour), projector & screen (per booking), catering per head (per unit), extra hour.

### Services
Placeholder CAC/FIRS/regulatory/online-presence services with sensible NGN service fees and government fees shown separately. All can be edited in the admin.

## 11. Open items
1. Exact Uyo address, phone, photos and opening hours (admin can enter these later).
2. Real service list and prices (placeholders until then).
3. Email/SMS sender name (default "Reenite").
