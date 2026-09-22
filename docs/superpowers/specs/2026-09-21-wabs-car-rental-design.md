# Wabs Car Rental — Design Spec

**Date:** 2026-09-21  
**Status:** Approved  
**Stack:** Next.js 14 · TypeScript · Tailwind CSS · shadcn/ui · Supabase · Docker

---

## 1. Product Overview

Wabs Car Rental is a luxury car-rental marketplace with two interfaces:

1. **Customer-facing website** — browse vehicles, check availability, calculate prices, create an account, submit rental orders.
2. **Management console** (`/management`) — manage vehicles, images, bookings, customers, availability, pricing, and settings.

**Brand:** Slate Modern — deep navy-charcoal (`#1C2332`), gold accent (`#D4AF6A`), white, Inter font family. Premium, approachable, trustworthy.

---

## 2. Architecture

### Approach
Single Next.js 14 (App Router) application. Customer site and management console co-exist in the same codebase, separated by route groups. Supabase provides PostgreSQL, authentication, storage, and row-level security.

### Project Structure

```
wabs-car-rental/
├── app/
│   ├── (customer)/           # public + authenticated customer routes
│   │   ├── page.tsx          # /  — Home
│   │   ├── vehicles/
│   │   │   ├── page.tsx      # /vehicles — Browse Fleet
│   │   │   └── [id]/page.tsx # /vehicles/[id] — Vehicle Detail
│   │   ├── checkout/page.tsx # /checkout — Multi-step checkout
│   │   └── account/
│   │       ├── page.tsx      # /account — Customer dashboard
│   │       └── bookings/[id]/page.tsx
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   └── reset-password/page.tsx
│   ├── management/
│   │   ├── page.tsx          # /management — Dashboard
│   │   ├── vehicles/
│   │   │   ├── page.tsx      # Vehicle list
│   │   │   ├── new/page.tsx  # Add vehicle
│   │   │   └── [id]/edit/page.tsx
│   │   ├── bookings/
│   │   │   ├── page.tsx      # Booking list
│   │   │   └── [id]/page.tsx # Booking detail
│   │   ├── customers/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── calendar/page.tsx
│   │   ├── maintenance/page.tsx
│   │   └── settings/page.tsx # Admin only
│   └── api/                  # API routes (webhooks, exports)
├── components/
│   ├── ui/                   # shadcn/ui base components
│   ├── customer/             # customer-facing components
│   └── management/           # console components
├── lib/
│   ├── supabase/             # client, server, middleware clients
│   ├── actions/              # server actions
│   ├── validators/           # Zod schemas
│   └── utils/                # pricing, dates, formatting
├── supabase/
│   ├── migrations/           # numbered SQL migration files
│   └── seed.sql
├── docker/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── nginx.conf
└── .env.example
```

### Rendering Strategy
- **Server Components** for all data-fetching pages (SEO, performance)
- **Client Components** for interactive forms, filters, image upload, calendar
- **Server Actions** for all mutations (bookings, vehicle CRUD, status changes)
- **Middleware** for route protection (redirects unauthenticated users, blocks non-managers from `/management`)

### Authorization Layers
| Layer | Mechanism |
|---|---|
| Route access | Next.js middleware checks Supabase session + role |
| Data access | Supabase RLS policies on every table |
| Price calculation | Server actions only — client-sent totals are never trusted |
| Sensitive fields | Service role key used only in server actions, never exposed to client |

---

## 3. Brand & Visual System

| Token | Value | Usage |
|---|---|---|
| `navy` | `#1C2332` | Primary dark background |
| `slate` | `#2A3347` | Secondary backgrounds, borders |
| `deep` | `#0f1623` | Deepest backgrounds, hero |
| `gold` | `#D4AF6A` | Accents, CTAs, highlights |
| `gold-muted` | `#B8963E` | Hover states on gold |
| `white` | `#FFFFFF` | Light section backgrounds |
| `warm-white` | `#FAFAF7` | Off-white surfaces |
| `text-primary` | `#FFFFFF` (dark bg) / `#1C2332` (light bg) | Body text |
| `text-muted` | `#8892A4` | Secondary text |

**Typography:** Inter — headings weight 600–700, body weight 400, prices/codes in Geist Mono.  
**Spacing:** 8px base unit, generous whitespace (Tailwind `space-y-8`, `py-16` sections).  
**Animations:** Subtle `transition-all duration-200` on hover, no gratuitous motion.

---

## 4. Page Map

### Customer Site
| Route | Page |
|---|---|
| `/` | Home — hero, search, featured vehicles, categories, how it works, testimonials, FAQ, newsletter, footer |
| `/vehicles` | Browse Fleet — card grid, filters, sorting |
| `/vehicles/[id]` | Vehicle Detail — gallery, specs, calendar, booking panel, reviews |
| `/checkout` | Multi-step checkout (6 steps) |
| `/account` | Customer dashboard — profile, bookings, favorites, documents, notifications |
| `/account/bookings/[id]` | Booking detail + cancellation |
| `/login` | Login |
| `/register` | Registration |
| `/forgot-password` | Password reset request |
| `/reset-password` | Password reset (token from email) |

### Management Console (manager + admin)
| Route | Page |
|---|---|
| `/management` | Dashboard — fleet stats, booking counts, revenue, recent activity |
| `/management/vehicles` | Vehicle list — table, filters, status badges |
| `/management/vehicles/new` | Add vehicle form |
| `/management/vehicles/[id]/edit` | Edit vehicle + image management |
| `/management/bookings` | Booking list — filters, export |
| `/management/bookings/[id]` | Booking detail — status changes, notes, documents, refunds |
| `/management/customers` | Customer list — search, filter, flag |
| `/management/customers/[id]` | Customer profile — history, documents, notes |
| `/management/calendar` | Fleet availability calendar |
| `/management/maintenance` | Maintenance records |
| `/management/settings` | Global settings (admin only) |

---

## 5. Database Schema

### Identity & Auth
```sql
-- auth.users managed by Supabase

profiles
  id uuid PK references auth.users
  first_name text
  last_name text
  phone text
  date_of_birth date
  address jsonb
  avatar_url text
  is_active boolean DEFAULT true
  flagged boolean DEFAULT false
  internal_notes text
  created_at timestamptz DEFAULT now()
  updated_at timestamptz DEFAULT now()

roles
  id uuid PK
  user_id uuid references auth.users UNIQUE
  role text CHECK (role IN ('customer','manager','admin'))
  created_at timestamptz DEFAULT now()
```

### Fleet
```sql
vehicles
  id uuid PK
  make text NOT NULL
  model text NOT NULL
  trim text
  year integer NOT NULL
  category text CHECK (category IN ('exotic','sports','suv','convertible','executive','electric'))
  vin text UNIQUE
  license_plate text
  exterior_color text
  interior_color text
  seats integer
  doors integer
  transmission text CHECK (transmission IN ('automatic','manual'))
  fuel_type text CHECK (fuel_type IN ('gasoline','diesel','electric','hybrid'))
  horsepower integer
  drivetrain text
  description text
  daily_price numeric(10,2) NOT NULL
  weekly_price numeric(10,2)
  monthly_price numeric(10,2)
  deposit_amount numeric(10,2)
  mileage_limit integer
  extra_mileage_price numeric(6,2)
  min_rental_days integer DEFAULT 1
  max_rental_days integer
  status text CHECK (status IN ('draft','available','reserved','rented','maintenance','inactive')) DEFAULT 'draft'
  is_featured boolean DEFAULT false
  cancellation_policy text
  rental_requirements text
  created_at timestamptz DEFAULT now()
  updated_at timestamptz DEFAULT now()

vehicle_images
  id uuid PK
  vehicle_id uuid references vehicles ON DELETE CASCADE
  storage_path text NOT NULL
  url text NOT NULL
  is_cover boolean DEFAULT false
  sort_order integer DEFAULT 0
  alt_text text
  caption text
  created_at timestamptz DEFAULT now()

vehicle_features
  id uuid PK
  vehicle_id uuid references vehicles ON DELETE CASCADE
  feature text NOT NULL

vehicle_locations
  id uuid PK
  vehicle_id uuid references vehicles ON DELETE CASCADE
  name text
  address text
  city text
  state text
  zip text
  lat numeric
  lng numeric
  delivery_available boolean DEFAULT false
  delivery_fee numeric(8,2) DEFAULT 0
```

### Availability & Maintenance
```sql
vehicle_availability
  id uuid PK
  vehicle_id uuid references vehicles ON DELETE CASCADE
  start_date date NOT NULL
  end_date date NOT NULL
  type text CHECK (type IN ('booking','maintenance','blocked'))
  reference_id uuid  -- booking_id or maintenance_record_id
  reason text
  created_by uuid references auth.users
  created_at timestamptz DEFAULT now()
  CONSTRAINT no_overlap EXCLUDE USING gist (vehicle_id WITH =, daterange(start_date, end_date, '[]') WITH &&)
    WHERE (type IN ('booking','maintenance'))

maintenance_records
  id uuid PK
  vehicle_id uuid references vehicles
  service_date date NOT NULL
  return_date date
  odometer integer
  cost numeric(10,2)
  description text
  vendor text
  created_by uuid references auth.users
  created_at timestamptz DEFAULT now()
```

### Bookings
```sql
bookings
  id uuid PK
  reference text UNIQUE NOT NULL  -- e.g. WBS-2024-001234
  customer_id uuid references auth.users
  vehicle_id uuid references vehicles
  pickup_date timestamptz NOT NULL
  return_date timestamptz NOT NULL
  pickup_method text CHECK (pickup_method IN ('pickup','delivery'))
  pickup_location_id uuid references vehicle_locations
  -- Driver info
  driver_name text NOT NULL
  driver_email text NOT NULL
  driver_phone text NOT NULL
  driver_dob date NOT NULL
  license_number text NOT NULL
  license_expiry date NOT NULL
  license_region text NOT NULL
  -- Pricing (server-calculated, immutable after confirmation)
  rental_days integer NOT NULL
  base_price numeric(10,2) NOT NULL
  delivery_fee numeric(8,2) DEFAULT 0
  tax_amount numeric(10,2) DEFAULT 0
  protection_fee numeric(10,2) DEFAULT 0
  extras_fee numeric(10,2) DEFAULT 0
  discount_amount numeric(10,2) DEFAULT 0
  deposit_amount numeric(10,2) DEFAULT 0
  total_amount numeric(10,2) NOT NULL
  -- Status
  status text CHECK (status IN (
    'draft','pending','awaiting_payment','confirmed',
    'ready_for_pickup','active','completed',
    'cancelled','rejected','refunded'
  )) DEFAULT 'pending'
  promo_code_id uuid references promo_codes
  special_requests text
  internal_notes text
  terms_accepted boolean DEFAULT false
  created_at timestamptz DEFAULT now()
  updated_at timestamptz DEFAULT now()

booking_status_history
  id uuid PK
  booking_id uuid references bookings ON DELETE CASCADE
  status text NOT NULL
  changed_by uuid references auth.users
  note text
  created_at timestamptz DEFAULT now()

booking_extras
  id uuid PK
  booking_id uuid references bookings ON DELETE CASCADE
  extra_id uuid references extras
  quantity integer DEFAULT 1
  unit_price numeric(8,2) NOT NULL
```

### Commerce & Config
```sql
payments
  id uuid PK
  booking_id uuid references bookings
  amount numeric(10,2) NOT NULL
  currency text DEFAULT 'USD'
  method text CHECK (method IN ('mock','stripe','cash'))
  status text CHECK (status IN ('pending','completed','failed','refunded'))
  stripe_payment_intent_id text
  paid_at timestamptz
  created_at timestamptz DEFAULT now()

refunds
  id uuid PK
  booking_id uuid references bookings
  payment_id uuid references payments
  amount numeric(10,2) NOT NULL
  reason text
  processed_by uuid references auth.users
  created_at timestamptz DEFAULT now()

protection_plans
  id uuid PK
  name text NOT NULL
  description text
  daily_price numeric(8,2) NOT NULL
  coverage_details text
  is_active boolean DEFAULT true

extras
  id uuid PK
  name text NOT NULL
  description text
  price numeric(8,2) NOT NULL
  unit text CHECK (unit IN ('per_day','flat')) DEFAULT 'per_day'
  is_active boolean DEFAULT true

promo_codes
  id uuid PK
  code text UNIQUE NOT NULL
  type text CHECK (type IN ('percentage','fixed'))
  value numeric(8,2) NOT NULL
  max_uses integer
  used_count integer DEFAULT 0
  expires_at timestamptz
  is_active boolean DEFAULT true
  created_at timestamptz DEFAULT now()
```

### Supporting
```sql
reviews
  id uuid PK
  booking_id uuid references bookings UNIQUE
  customer_id uuid references auth.users
  vehicle_id uuid references vehicles
  rating integer CHECK (rating BETWEEN 1 AND 5)
  comment text
  is_published boolean DEFAULT false
  created_at timestamptz DEFAULT now()

favorites
  id uuid PK
  customer_id uuid references auth.users
  vehicle_id uuid references vehicles
  created_at timestamptz DEFAULT now()
  UNIQUE (customer_id, vehicle_id)

customer_documents
  id uuid PK
  customer_id uuid references auth.users
  type text CHECK (type IN ('license_front','license_back','passport','other'))
  storage_path text NOT NULL
  url text NOT NULL
  verified boolean DEFAULT false
  uploaded_at timestamptz DEFAULT now()

notifications
  id uuid PK
  user_id uuid references auth.users
  type text NOT NULL
  title text NOT NULL
  body text
  is_read boolean DEFAULT false
  created_at timestamptz DEFAULT now()

audit_logs
  id uuid PK
  actor_id uuid references auth.users
  action text NOT NULL
  entity_type text NOT NULL
  entity_id uuid
  diff jsonb
  created_at timestamptz DEFAULT now()

application_settings
  id uuid PK
  key text UNIQUE NOT NULL
  value jsonb NOT NULL
  updated_by uuid references auth.users
  updated_at timestamptz DEFAULT now()
```

---

## 6. Business Rules

| Rule | Implementation |
|---|---|
| No overlapping bookings | PostgreSQL exclusion constraint on `vehicle_availability` |
| Maintenance blocks reservations | `vehicle_availability` type=maintenance checked before booking |
| Return after pickup | Constraint: `return_date > pickup_date` |
| Minimum driver age 25 | Server action validates `driver_dob` against pickup date |
| Expired licenses rejected | Server action validates `license_expiry > pickup_date` |
| Server-side pricing | Price calculated in server action from DB records, never from request body |
| Customer data isolation | RLS: `customer_id = auth.uid()` on bookings, documents, favorites |
| Manager scope | Role check in middleware; RLS permits managers to read all fleet/booking data |
| Admin-only settings | `/management/settings` blocked to role=manager in middleware + RLS |
| Audit trail | Server actions insert to `audit_logs` on every management mutation |
| Archived vehicles | `status='inactive'` vehicles hidden from customer browse but preserved in bookings |

---

## 7. Checkout Flow (6 Steps)

1. **Dates & Pickup** — date/time range picker, pickup vs delivery, location selection, real-time availability check
2. **Driver Info** — legal name, email, phone, DOB, license number/expiry/region, address
3. **Extras & Protection** — protection plan selection, optional extras with quantity, promo code
4. **Review** — full price breakdown (server-calculated), all booking details, terms acceptance
5. **Payment** — mock payment form (card fields present, no real charge) or Stripe Elements when configured
6. **Confirmation** — booking reference (WBS-YYYY-XXXXXX), summary, next steps, email template queued

---

## 8. Management Console Features

### Dashboard KPIs
Total vehicles · Available · Rented · In maintenance · New requests · Confirmed · Today's pickups · Today's returns · Monthly revenue · Revenue trend chart · Top 5 most-rented vehicles · Recent activity feed

### Vehicle Management
Full CRUD with status workflow: `draft → available → reserved → rented → maintenance → inactive`  
Duplicate vehicle record. View booking history. Image management with drag-and-drop reorder, cover selection, alt text, upload progress, file validation (JPEG/PNG/WebP, max 10MB).

### Booking Management
Status transitions with confirmation dialogs. Internal notes. Document review panel. Manual booking creation. Vehicle reassignment. Pickup/return recording. Refund recording. Status history timeline. CSV export.

### Availability Calendar
Month/week view of full fleet. Color-coded blocks: booking (gold), maintenance (red), blocked (grey). Click to add maintenance or blocked period. Conflict warnings.

---

## 9. Seed Data

12 demo vehicles across all categories:

| Vehicle | Category | Daily Price |
|---|---|---|
| Lamborghini Huracán EVO | Exotic | $1,200 |
| Ferrari 488 Spider | Exotic | $1,100 |
| McLaren 720S | Exotic | $1,350 |
| Porsche 911 Turbo S | Sports | $650 |
| BMW M8 Competition | Sports | $480 |
| Aston Martin DB11 | Sports | $720 |
| Range Rover Autobiography | SUV | $380 |
| Mercedes-Benz G 63 AMG | SUV | $420 |
| Cadillac Escalade Platinum | SUV | $320 |
| Bentley Continental GTC | Convertible | $950 |
| Rolls-Royce Ghost | Executive | $1,500 |
| Tesla Model S Plaid | Electric | $290 |

Plus: 5 customer accounts, bookings in all statuses, 3 protection plans, 5 extras, 2 promo codes, maintenance records, reviews.

**Test accounts:**
- `customer@wabs.com` / `WabsDemo2024!`
- `manager@wabs.com` / `WabsDemo2024!`
- `admin@wabs.com` / `WabsDemo2024!`

---

## 10. Deployment

### Environment Variables
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=
STRIPE_SECRET_KEY=           # optional — enables real payments
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=  # optional
STRIPE_WEBHOOK_SECRET=       # optional
PAYMENT_MODE=mock            # 'mock' | 'stripe'
```

### Docker Deployment
```bash
docker compose up -d         # starts Next.js app + Nginx
```

Multi-stage Dockerfile: build stage (node:20-alpine) → production stage (node:20-alpine slim). Nginx terminates TLS and reverse-proxies to Next.js on port 3000.

---

## 11. Out of Scope (v1)

- Real-time chat / messaging between customer and manager
- Multi-currency switching (USD only; configurable in settings)
- Mobile native app
- Automated email sending (templates prepared, SMTP integration documented but not wired)
- GPS/telematics integration
- Insurance provider API integration
