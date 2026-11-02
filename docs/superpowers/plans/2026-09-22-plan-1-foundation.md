# Wabs Car Rental — Plan 1: Foundation & Auth

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the Next.js project, configure Supabase, run all database migrations, seed demo data, and implement complete authentication (register, login, logout, password reset) with role-based route protection.

**Architecture:** Single Next.js 14 App Router monorepo. Supabase handles auth, Postgres, and storage. Middleware enforces route-level RBAC. Server actions handle all mutations. Zod validates all inputs.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, Supabase JS v2, Zod, React Hook Form, next/font (Inter + Geist Mono)

---

## File Map

```
wabs-car-rental/
├── app/
│   ├── layout.tsx                          # Root layout — fonts, providers
│   ├── (auth)/
│   │   ├── layout.tsx                      # Auth pages layout
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   └── reset-password/page.tsx
│   ├── (customer)/
│   │   └── layout.tsx                      # Customer layout stub
│   └── management/
│       └── layout.tsx                      # Management layout stub
├── components/
│   ├── ui/                                 # shadcn components (button, input, form, etc.)
│   └── auth/
│       ├── login-form.tsx
│       ├── register-form.tsx
│       ├── forgot-password-form.tsx
│       └── reset-password-form.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts                       # Browser Supabase client
│   │   ├── server.ts                       # Server Supabase client (cookies)
│   │   └── middleware.ts                   # Middleware Supabase client
│   ├── actions/
│   │   └── auth.ts                         # Server actions: signIn, signUp, signOut, resetPassword
│   ├── validators/
│   │   └── auth.ts                         # Zod schemas for auth forms
│   └── utils/
│       └── roles.ts                        # Role helpers: getRole, isManager, isAdmin
├── middleware.ts                           # Route protection + session refresh
├── supabase/
│   ├── migrations/
│   │   ├── 001_extensions.sql
│   │   ├── 002_profiles.sql
│   │   ├── 003_roles.sql
│   │   ├── 004_vehicles.sql
│   │   ├── 005_vehicle_images.sql
│   │   ├── 006_vehicle_features.sql
│   │   ├── 007_vehicle_locations.sql
│   │   ├── 008_vehicle_availability.sql
│   │   ├── 009_maintenance_records.sql
│   │   ├── 010_extras_and_plans.sql
│   │   ├── 011_promo_codes.sql
│   │   ├── 012_bookings.sql
│   │   ├── 013_booking_extras.sql
│   │   ├── 014_booking_status_history.sql
│   │   ├── 015_payments.sql
│   │   ├── 016_refunds.sql
│   │   ├── 017_reviews.sql
│   │   ├── 018_favorites.sql
│   │   ├── 019_customer_documents.sql
│   │   ├── 020_notifications.sql
│   │   ├── 021_audit_logs.sql
│   │   ├── 022_application_settings.sql
│   │   └── 023_rls_policies.sql
│   └── seed.sql
├── tailwind.config.ts
├── .env.example
└── package.json
```

---

### Task 1: Scaffold Next.js project

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `next.config.ts`, `.env.example`, `.gitignore`

- [ ] **Step 1: Create the Next.js app**

```bash
cd C:/Users/tandremartial/Repos/CarRental
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=no --import-alias="@/*" --no-git
```

When prompted: choose all defaults. Do not initialize git (already done).

- [ ] **Step 2: Install dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr zod react-hook-form @hookform/resolvers
npm install @radix-ui/react-slot @radix-ui/react-label @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-select @radix-ui/react-toast @radix-ui/react-separator @radix-ui/react-avatar @radix-ui/react-checkbox @radix-ui/react-tabs @radix-ui/react-accordion class-variance-authority clsx tailwind-merge lucide-react
npm install -D @types/node
```

- [ ] **Step 3: Install shadcn/ui**

```bash
npx shadcn@latest init
```

When prompted:
- Style: Default
- Base color: Slate
- CSS variables: Yes

- [ ] **Step 4: Add shadcn components**

```bash
npx shadcn@latest add button input label form card badge separator avatar toast dialog dropdown-menu select tabs accordion
```

- [ ] **Step 5: Write `.env.example`**

Create `.env.example`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
PAYMENT_MODE=mock
# Optional — enables real Stripe payments
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
```

Copy to `.env.local` and fill in your Supabase project values.

- [ ] **Step 6: Configure Tailwind with brand tokens**

Replace `tailwind.config.ts`:
```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: "#1C2332",
        "navy-light": "#2A3347",
        deep: "#0f1623",
        gold: "#D4AF6A",
        "gold-muted": "#B8963E",
        "warm-white": "#FAFAF7",
        "text-muted-wabs": "#8892A4",
      },
      fontFamily: {
        sans: ["var(--font-inter)"],
        mono: ["var(--font-geist-mono)"],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
```

```bash
npm install tailwindcss-animate
```

- [ ] **Step 7: Update root layout with fonts**

Replace `app/layout.tsx`:
```typescript
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Wabs Car Rental — Luxury Fleet",
  description: "Premium luxury car rental. Book exotic, sports, and executive vehicles.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${GeistMono.variable} font-sans antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
```

```bash
npm install geist
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js project with Tailwind, shadcn/ui, and brand tokens"
```

---

### Task 2: Supabase client setup

**Files:**
- Create: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts`

- [ ] **Step 1: Create browser client**

Create `lib/supabase/client.ts`:
```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 2: Create server client**

Create `lib/supabase/server.ts`:
```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

export async function createServiceClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}
```

- [ ] **Step 3: Create middleware client**

Create `lib/supabase/middleware.ts`:
```typescript
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  return { supabaseResponse, user, supabase };
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/supabase/
git commit -m "feat: add Supabase browser, server, and middleware clients"
```

---

### Task 3: Database migrations

**Files:**
- Create: `supabase/migrations/001_extensions.sql` through `023_rls_policies.sql`

- [ ] **Step 1: Create migration 001 — extensions**

Create `supabase/migrations/001_extensions.sql`:
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";
```

- [ ] **Step 2: Create migration 002 — profiles**

Create `supabase/migrations/002_profiles.sql`:
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  date_of_birth DATE,
  address JSONB,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  flagged BOOLEAN NOT NULL DEFAULT FALSE,
  internal_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id) VALUES (NEW.id);
  INSERT INTO roles (user_id, role) VALUES (NEW.id, 'customer');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

- [ ] **Step 3: Create migration 003 — roles**

Create `supabase/migrations/003_roles.sql`:
```sql
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('customer', 'manager', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- [ ] **Step 4: Create migration 004 — vehicles**

Create `supabase/migrations/004_vehicles.sql`:
```sql
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  trim TEXT,
  year INTEGER NOT NULL CHECK (year >= 1990 AND year <= 2030),
  category TEXT NOT NULL CHECK (category IN ('exotic','sports','suv','convertible','executive','electric')),
  vin TEXT UNIQUE,
  license_plate TEXT,
  exterior_color TEXT,
  interior_color TEXT,
  seats INTEGER CHECK (seats > 0),
  doors INTEGER CHECK (doors > 0),
  transmission TEXT CHECK (transmission IN ('automatic','manual')),
  fuel_type TEXT CHECK (fuel_type IN ('gasoline','diesel','electric','hybrid')),
  horsepower INTEGER,
  drivetrain TEXT,
  description TEXT,
  daily_price NUMERIC(10,2) NOT NULL CHECK (daily_price > 0),
  weekly_price NUMERIC(10,2),
  monthly_price NUMERIC(10,2),
  deposit_amount NUMERIC(10,2) DEFAULT 0,
  mileage_limit INTEGER,
  extra_mileage_price NUMERIC(6,2) DEFAULT 0,
  min_rental_days INTEGER NOT NULL DEFAULT 1,
  max_rental_days INTEGER,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','available','reserved','rented','maintenance','inactive')),
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  cancellation_policy TEXT,
  rental_requirements TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vehicles_status ON vehicles(status);
CREATE INDEX idx_vehicles_category ON vehicles(category);
CREATE INDEX idx_vehicles_is_featured ON vehicles(is_featured);
```

- [ ] **Step 5: Create migrations 005–009 — vehicle sub-tables**

Create `supabase/migrations/005_vehicle_images.sql`:
```sql
CREATE TABLE vehicle_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  is_cover BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  alt_text TEXT,
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_vehicle_images_vehicle_id ON vehicle_images(vehicle_id);
CREATE INDEX idx_vehicle_images_sort ON vehicle_images(vehicle_id, sort_order);
```

Create `supabase/migrations/006_vehicle_features.sql`:
```sql
CREATE TABLE vehicle_features (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  feature TEXT NOT NULL
);
CREATE INDEX idx_vehicle_features_vehicle_id ON vehicle_features(vehicle_id);
```

Create `supabase/migrations/007_vehicle_locations.sql`:
```sql
CREATE TABLE vehicle_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  name TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  lat NUMERIC,
  lng NUMERIC,
  delivery_available BOOLEAN NOT NULL DEFAULT FALSE,
  delivery_fee NUMERIC(8,2) NOT NULL DEFAULT 0
);
CREATE INDEX idx_vehicle_locations_vehicle_id ON vehicle_locations(vehicle_id);
```

Create `supabase/migrations/008_vehicle_availability.sql`:
```sql
CREATE TABLE vehicle_availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('booking','maintenance','blocked')),
  reference_id UUID,
  reason TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date),
  EXCLUDE USING gist (
    vehicle_id WITH =,
    daterange(start_date, end_date, '[]') WITH &&
  ) WHERE (type IN ('booking','maintenance'))
);
CREATE INDEX idx_vehicle_availability_vehicle_id ON vehicle_availability(vehicle_id);
CREATE INDEX idx_vehicle_availability_dates ON vehicle_availability(start_date, end_date);
```

Create `supabase/migrations/009_maintenance_records.sql`:
```sql
CREATE TABLE maintenance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id),
  service_date DATE NOT NULL,
  return_date DATE,
  odometer INTEGER,
  cost NUMERIC(10,2),
  description TEXT,
  vendor TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_maintenance_vehicle_id ON maintenance_records(vehicle_id);
```

- [ ] **Step 6: Create migrations 010–011 — extras, plans, promo codes**

Create `supabase/migrations/010_extras_and_plans.sql`:
```sql
CREATE TABLE protection_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  daily_price NUMERIC(8,2) NOT NULL CHECK (daily_price >= 0),
  coverage_details TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE extras (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(8,2) NOT NULL CHECK (price >= 0),
  unit TEXT NOT NULL DEFAULT 'per_day' CHECK (unit IN ('per_day','flat')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);
```

Create `supabase/migrations/011_promo_codes.sql`:
```sql
CREATE TABLE promo_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('percentage','fixed')),
  value NUMERIC(8,2) NOT NULL CHECK (value > 0),
  max_uses INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- [ ] **Step 7: Create migrations 012–016 — bookings and payments**

Create `supabase/migrations/012_bookings.sql`:
```sql
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference TEXT UNIQUE NOT NULL,
  customer_id UUID NOT NULL REFERENCES auth.users(id),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id),
  pickup_date TIMESTAMPTZ NOT NULL,
  return_date TIMESTAMPTZ NOT NULL,
  pickup_method TEXT NOT NULL CHECK (pickup_method IN ('pickup','delivery')),
  pickup_location_id UUID REFERENCES vehicle_locations(id),
  driver_name TEXT NOT NULL,
  driver_email TEXT NOT NULL,
  driver_phone TEXT NOT NULL,
  driver_dob DATE NOT NULL,
  license_number TEXT NOT NULL,
  license_expiry DATE NOT NULL,
  license_region TEXT NOT NULL,
  rental_days INTEGER NOT NULL CHECK (rental_days > 0),
  base_price NUMERIC(10,2) NOT NULL CHECK (base_price >= 0),
  delivery_fee NUMERIC(8,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  protection_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  extras_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  deposit_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'draft','pending','awaiting_payment','confirmed',
    'ready_for_pickup','active','completed',
    'cancelled','rejected','refunded'
  )),
  promo_code_id UUID REFERENCES promo_codes(id),
  protection_plan_id UUID REFERENCES protection_plans(id),
  special_requests TEXT,
  internal_notes TEXT,
  terms_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_booking_dates CHECK (return_date > pickup_date)
);

CREATE INDEX idx_bookings_customer_id ON bookings(customer_id);
CREATE INDEX idx_bookings_vehicle_id ON bookings(vehicle_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_pickup_date ON bookings(pickup_date);
```

Create `supabase/migrations/013_booking_extras.sql`:
```sql
CREATE TABLE booking_extras (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  extra_id UUID NOT NULL REFERENCES extras(id),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price NUMERIC(8,2) NOT NULL
);
```

Create `supabase/migrations/014_booking_status_history.sql`:
```sql
CREATE TABLE booking_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_booking_status_history_booking_id ON booking_status_history(booking_id);
```

Create `supabase/migrations/015_payments.sql`:
```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id),
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  method TEXT NOT NULL CHECK (method IN ('mock','stripe','cash')),
  status TEXT NOT NULL CHECK (status IN ('pending','completed','failed','refunded')),
  stripe_payment_intent_id TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_payments_booking_id ON payments(booking_id);
```

Create `supabase/migrations/016_refunds.sql`:
```sql
CREATE TABLE refunds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id),
  payment_id UUID NOT NULL REFERENCES payments(id),
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  reason TEXT,
  processed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- [ ] **Step 8: Create migrations 017–023 — supporting tables and RLS**

Create `supabase/migrations/017_reviews.sql`:
```sql
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id),
  customer_id UUID NOT NULL REFERENCES auth.users(id),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_reviews_vehicle_id ON reviews(vehicle_id);
```

Create `supabase/migrations/018_favorites.sql`:
```sql
CREATE TABLE favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(customer_id, vehicle_id)
);
CREATE INDEX idx_favorites_customer_id ON favorites(customer_id);
```

Create `supabase/migrations/019_customer_documents.sql`:
```sql
CREATE TABLE customer_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('license_front','license_back','passport','other')),
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_customer_documents_customer_id ON customer_documents(customer_id);
```

Create `supabase/migrations/020_notifications.sql`:
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notifications_user_id ON notifications(user_id, is_read);
```

Create `supabase/migrations/021_audit_logs.sql`:
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  diff JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
```

Create `supabase/migrations/022_application_settings.sql`:
```sql
CREATE TABLE application_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO application_settings (key, value) VALUES
  ('tax_rate', '0.08'),
  ('currency', '"USD"'),
  ('min_driver_age', '25'),
  ('late_return_fee_per_hour', '50'),
  ('default_deposit', '500'),
  ('business_name', '"Wabs Car Rental"'),
  ('business_email', '"hello@wabscarrental.com"'),
  ('business_phone', '"+1 (555) 000-0000"'),
  ('payment_mode', '"mock"');
```

Create `supabase/migrations/023_rls_policies.sql`:
```sql
-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE protection_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_status_history ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user role
CREATE OR REPLACE FUNCTION get_user_role(uid UUID)
RETURNS TEXT AS $$
  SELECT role FROM roles WHERE user_id = uid LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- profiles: users see/edit their own; managers/admins see all
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles_select_staff" ON profiles FOR SELECT USING (get_user_role(auth.uid()) IN ('manager','admin'));
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "profiles_update_staff" ON profiles FOR UPDATE USING (get_user_role(auth.uid()) IN ('manager','admin'));

-- roles: only admins manage roles
CREATE POLICY "roles_select_own" ON roles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "roles_select_admin" ON roles FOR SELECT USING (get_user_role(auth.uid()) = 'admin');
CREATE POLICY "roles_all_admin" ON roles FOR ALL USING (get_user_role(auth.uid()) = 'admin');

-- vehicles: public read for available; staff manage
CREATE POLICY "vehicles_select_public" ON vehicles FOR SELECT USING (status != 'draft' AND status != 'inactive');
CREATE POLICY "vehicles_select_staff" ON vehicles FOR SELECT USING (get_user_role(auth.uid()) IN ('manager','admin'));
CREATE POLICY "vehicles_all_staff" ON vehicles FOR ALL USING (get_user_role(auth.uid()) IN ('manager','admin'));

-- vehicle_images, features, locations: same as vehicles
CREATE POLICY "vehicle_images_select_public" ON vehicle_images FOR SELECT USING (TRUE);
CREATE POLICY "vehicle_images_all_staff" ON vehicle_images FOR ALL USING (get_user_role(auth.uid()) IN ('manager','admin'));
CREATE POLICY "vehicle_features_select_public" ON vehicle_features FOR SELECT USING (TRUE);
CREATE POLICY "vehicle_features_all_staff" ON vehicle_features FOR ALL USING (get_user_role(auth.uid()) IN ('manager','admin'));
CREATE POLICY "vehicle_locations_select_public" ON vehicle_locations FOR SELECT USING (TRUE);
CREATE POLICY "vehicle_locations_all_staff" ON vehicle_locations FOR ALL USING (get_user_role(auth.uid()) IN ('manager','admin'));

-- vehicle_availability: public read; staff manage
CREATE POLICY "va_select_public" ON vehicle_availability FOR SELECT USING (TRUE);
CREATE POLICY "va_all_staff" ON vehicle_availability FOR ALL USING (get_user_role(auth.uid()) IN ('manager','admin'));

-- maintenance_records: staff only
CREATE POLICY "maintenance_all_staff" ON maintenance_records FOR ALL USING (get_user_role(auth.uid()) IN ('manager','admin'));

-- protection_plans, extras: public read; admin manage
CREATE POLICY "plans_select_public" ON protection_plans FOR SELECT USING (is_active = TRUE);
CREATE POLICY "plans_all_admin" ON protection_plans FOR ALL USING (get_user_role(auth.uid()) = 'admin');
CREATE POLICY "extras_select_public" ON extras FOR SELECT USING (is_active = TRUE);
CREATE POLICY "extras_all_admin" ON extras FOR ALL USING (get_user_role(auth.uid()) = 'admin');

-- promo_codes: customers can read active; admin manage
CREATE POLICY "promo_select_auth" ON promo_codes FOR SELECT USING (is_active = TRUE AND auth.uid() IS NOT NULL);
CREATE POLICY "promo_all_admin" ON promo_codes FOR ALL USING (get_user_role(auth.uid()) = 'admin');

-- bookings: customers see own; staff see all
CREATE POLICY "bookings_select_own" ON bookings FOR SELECT USING (customer_id = auth.uid());
CREATE POLICY "bookings_insert_own" ON bookings FOR INSERT WITH CHECK (customer_id = auth.uid());
CREATE POLICY "bookings_select_staff" ON bookings FOR SELECT USING (get_user_role(auth.uid()) IN ('manager','admin'));
CREATE POLICY "bookings_update_staff" ON bookings FOR UPDATE USING (get_user_role(auth.uid()) IN ('manager','admin'));

-- booking_extras, status_history: follow booking access
CREATE POLICY "booking_extras_select_own" ON booking_extras FOR SELECT USING (
  EXISTS (SELECT 1 FROM bookings WHERE id = booking_id AND customer_id = auth.uid())
);
CREATE POLICY "booking_extras_select_staff" ON booking_extras FOR SELECT USING (get_user_role(auth.uid()) IN ('manager','admin'));
CREATE POLICY "booking_extras_all_staff" ON booking_extras FOR ALL USING (get_user_role(auth.uid()) IN ('manager','admin'));
CREATE POLICY "bsh_select_own" ON booking_status_history FOR SELECT USING (
  EXISTS (SELECT 1 FROM bookings WHERE id = booking_id AND customer_id = auth.uid())
);
CREATE POLICY "bsh_select_staff" ON booking_status_history FOR SELECT USING (get_user_role(auth.uid()) IN ('manager','admin'));
CREATE POLICY "bsh_insert_staff" ON booking_status_history FOR INSERT WITH CHECK (get_user_role(auth.uid()) IN ('manager','admin'));

-- payments: customers see own; staff manage
CREATE POLICY "payments_select_own" ON payments FOR SELECT USING (
  EXISTS (SELECT 1 FROM bookings WHERE id = booking_id AND customer_id = auth.uid())
);
CREATE POLICY "payments_all_staff" ON payments FOR ALL USING (get_user_role(auth.uid()) IN ('manager','admin'));

-- refunds: staff only
CREATE POLICY "refunds_all_staff" ON refunds FOR ALL USING (get_user_role(auth.uid()) IN ('manager','admin'));

-- reviews: published reviews are public; own reviews for customers
CREATE POLICY "reviews_select_public" ON reviews FOR SELECT USING (is_published = TRUE);
CREATE POLICY "reviews_select_own" ON reviews FOR SELECT USING (customer_id = auth.uid());
CREATE POLICY "reviews_insert_own" ON reviews FOR INSERT WITH CHECK (customer_id = auth.uid());
CREATE POLICY "reviews_all_staff" ON reviews FOR ALL USING (get_user_role(auth.uid()) IN ('manager','admin'));

-- favorites, documents, notifications: own only + staff
CREATE POLICY "favorites_own" ON favorites FOR ALL USING (customer_id = auth.uid());
CREATE POLICY "documents_own" ON customer_documents FOR ALL USING (customer_id = auth.uid());
CREATE POLICY "documents_staff" ON customer_documents FOR SELECT USING (get_user_role(auth.uid()) IN ('manager','admin'));
CREATE POLICY "notifications_own" ON notifications FOR ALL USING (user_id = auth.uid());

-- audit_logs: staff read
CREATE POLICY "audit_select_staff" ON audit_logs FOR SELECT USING (get_user_role(auth.uid()) IN ('manager','admin'));

-- application_settings: all authenticated read; admin manage
CREATE POLICY "settings_select_auth" ON application_settings FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "settings_all_admin" ON application_settings FOR ALL USING (get_user_role(auth.uid()) = 'admin');
```

- [ ] **Step 9: Run migrations in Supabase**

In your Supabase dashboard → SQL Editor, run each migration file in order (001 through 023). Or use the Supabase CLI if installed:

```bash
# If Supabase CLI is available:
supabase db push
# Otherwise, paste each file into the SQL Editor in order
```

- [ ] **Step 10: Commit**

```bash
git add supabase/
git commit -m "feat: add complete database migrations and RLS policies"
```

---

### Task 4: Seed data

**Files:**
- Create: `supabase/seed.sql`

- [ ] **Step 1: Create seed file**

Create `supabase/seed.sql`:
```sql
-- ============================================================
-- WABS CAR RENTAL — DEMO SEED DATA
-- Run AFTER migrations. Creates test users via Supabase auth API.
-- ============================================================

-- NOTE: Create these users in Supabase Auth dashboard or via CLI first:
-- customer@wabs.com / WabsDemo2024!  → copy UUID → replace CUSTOMER_UUID below
-- manager@wabs.com  / WabsDemo2024!  → copy UUID → replace MANAGER_UUID below
-- admin@wabs.com    / WabsDemo2024!  → copy UUID → replace ADMIN_UUID below
-- Then run this SQL in Supabase SQL Editor with the real UUIDs substituted.

-- Set roles (profiles are auto-created by trigger)
-- UPDATE roles SET role = 'manager' WHERE user_id = 'MANAGER_UUID';
-- UPDATE roles SET role = 'admin'   WHERE user_id = 'ADMIN_UUID';

-- Protection Plans
INSERT INTO protection_plans (id, name, description, daily_price, coverage_details) VALUES
  ('11111111-0000-0000-0000-000000000001', 'Basic Shield', 'Covers minor damage up to $2,500 deductible', 29.00, 'Collision damage waiver. $2,500 deductible. Excludes tires, glass, and underbody.'),
  ('11111111-0000-0000-0000-000000000002', 'Premium Guard', 'Full coverage with $500 deductible', 59.00, 'Collision + comprehensive. $500 deductible. Includes tires and glass.'),
  ('11111111-0000-0000-0000-000000000003', 'Elite Zero', 'Zero deductible complete coverage', 99.00, 'Zero deductible. Full collision, comprehensive, tires, glass, and roadside assistance.');

-- Extras
INSERT INTO extras (id, name, description, price, unit) VALUES
  ('22222222-0000-0000-0000-000000000001', 'GPS Navigation', 'Premium Garmin GPS system', 15.00, 'per_day'),
  ('22222222-0000-0000-0000-000000000002', 'Child Safety Seat', 'Certified infant or toddler seat', 12.00, 'per_day'),
  ('22222222-0000-0000-0000-000000000003', 'Professional Chauffeur', 'Licensed professional driver', 150.00, 'per_day'),
  ('22222222-0000-0000-0000-000000000004', 'Pre-paid Fuel', 'Return the vehicle on empty', 85.00, 'flat'),
  ('22222222-0000-0000-0000-000000000005', 'Airport Transfer', 'One-way airport pickup or dropoff', 95.00, 'flat');

-- Promo Codes
INSERT INTO promo_codes (code, type, value, max_uses, expires_at) VALUES
  ('WABS10', 'percentage', 10.00, 100, NOW() + INTERVAL '1 year'),
  ('LUXURY50', 'fixed', 50.00, 50, NOW() + INTERVAL '6 months');

-- Vehicles
INSERT INTO vehicles (id, make, model, trim, year, category, vin, exterior_color, interior_color, seats, doors, transmission, fuel_type, horsepower, drivetrain, description, daily_price, weekly_price, monthly_price, deposit_amount, mileage_limit, extra_mileage_price, min_rental_days, status, is_featured) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001','Lamborghini','Huracán','EVO Spyder',2023,'exotic','ZA9HU45B4LLA12001','Arancio Borealis','Black Alcantara',2,2,'automatic','gasoline',640,'RWD','The Lamborghini Huracán EVO Spyder combines 640 horsepower with an open-air experience. The 5.2L naturally aspirated V10 delivers a visceral soundtrack unlike any turbocharged competitor.',1200.00,7500.00,24000.00,5000.00,150,5.00,1,'available',true),
  ('aaaaaaaa-0000-0000-0000-000000000002','Ferrari','488','Spider',2022,'exotic','ZFF79ALA4J0238002','Rosso Corsa','Beige Leather',2,2,'automatic','gasoline',710,'RWD','The Ferrari 488 Spider blends 710hp twin-turbo V8 performance with drop-top freedom. Mid-engine balance and Ferrari''s magnetic ride suspension make it as capable as it is stunning.',1100.00,6800.00,22000.00,5000.00,150,5.00,1,'available',true),
  ('aaaaaaaa-0000-0000-0000-000000000003','McLaren','720S','Spider',2023,'exotic','SBM14DCA7LW003003','Papaya Spark','Carbon Black',2,2,'automatic','gasoline',710,'RWD','The McLaren 720S Spider delivers 710hp from a 4.0L twin-turbo V8. The electrochromic glass roof transforms from transparent to opaque at the touch of a button.',1350.00,8500.00,27000.00,5000.00,200,6.00,1,'available',true),
  ('aaaaaaaa-0000-0000-0000-000000000004','Porsche','911','Turbo S Cabriolet',2023,'sports','WP0CB2A92PS004004','Chalk Grey','Black/Chalk',4,2,'automatic','gasoline',650,'AWD','The 911 Turbo S Cabriolet is Porsche''s pinnacle open-air sports car. 650hp, 0-60 in 2.6 seconds, and everyday usability that no other exotic can match.',650.00,4100.00,13000.00,3000.00,200,4.00,1,'available',true),
  ('aaaaaaaa-0000-0000-0000-000000000005','BMW','M8','Competition Gran Coupé',2023,'sports','WBS83AH08NCB05005','Frozen Black','Merino Full Leather',4,4,'automatic','gasoline',617,'AWD','The M8 Competition Gran Coupé pairs 617hp twin-turbo V8 performance with genuine four-seat practicality and BMW''s most advanced technology suite.',480.00,3000.00,9500.00,2500.00,250,3.00,1,'available',false),
  ('aaaaaaaa-0000-0000-0000-000000000006','Aston Martin','DB11','Volante',2022,'sports','SCFRMFCV8NGT06006','Midnight Blue','Tan Bridge of Weir',4,2,'automatic','gasoline',503,'RWD','The DB11 Volante is Aston Martin''s grand touring convertible. 503hp twin-turbo V8, hand-stitched interior, and a fabric roof that opens in 14 seconds.',720.00,4500.00,14500.00,3500.00,200,4.00,2,'available',true),
  ('aaaaaaaa-0000-0000-0000-000000000007','Range Rover','Range Rover','Autobiography LWB',2023,'suv','SALGS2SE5PA107007','Santorini Black','Ebony/Ivory Semi-Aniline',7,4,'automatic','gasoline',523,'AWD','The Range Rover Autobiography LWB defines luxury SUV travel. Executive rear seating, 523hp supercharged V8, and legendary off-road capability wrapped in genuine Connolly leather.',380.00,2400.00,7500.00,2000.00,300,2.50,1,'available',true),
  ('aaaaaaaa-0000-0000-0000-000000000008','Mercedes-Benz','G 63','AMG',2023,'suv','WDCYC7HH4PX308008','Obsidian Black','Black Nappa Leather',5,4,'automatic','gasoline',577,'AWD','The G 63 AMG is an icon reimagined. 577hp handcrafted AMG V8 biturbo in the most recognizable silhouette on the road. Three locking differentials meet Nappa leather.',420.00,2650.00,8200.00,2500.00,250,3.00,1,'available',false),
  ('aaaaaaaa-0000-0000-0000-000000000009','Cadillac','Escalade','Platinum Sport',2024,'suv','1GYS4PKL2PR409009','Shadow Metallic','Whisper Beige',8,4,'automatic','gasoline',420,'AWD','The Escalade Platinum Sport redefines American luxury. 420hp 6.2L V8, curved OLED display spanning 38 inches, and magnetic ride control for a commanding yet smooth ride.',320.00,2000.00,6200.00,1500.00,350,2.00,1,'available',false),
  ('aaaaaaaa-0000-0000-0000-000000000010','Bentley','Continental GTC','Speed',2023,'convertible','SCBCR23W8EC010010','Beluga','Linen/Black Hide',4,2,'automatic','gasoline',650,'AWD','The Continental GTC Speed is the fastest Bentley convertible ever made. 650hp W12, 208mph top speed, and a Mulliner-appointed cabin that redefines open-air grand touring.',950.00,5900.00,19000.00,4000.00,200,5.00,2,'available',true),
  ('aaaaaaaa-0000-0000-0000-000000000011','Rolls-Royce','Ghost','Black Badge',2023,'executive','SCA664S5XPU011011','Black',  'Black/Mandarin',5,4,'automatic','gasoline',591,'AWD','The Ghost Black Badge is Rolls-Royce for those who forge their own path. 591hp twin-turbo V12, self-levelling air suspension, and a Starlight Headliner with 1,340 individual fiber optic stars.',1500.00,9500.00,30000.00,6000.00,100,8.00,3,'available',true),
  ('aaaaaaaa-0000-0000-0000-000000000012','Tesla','Model S','Plaid',2024,'electric','5YJSA1E68PF012012','Midnight Silver','Black/White',5,4,'automatic','electric',1020,'AWD','The Tesla Model S Plaid delivers 1,020hp and 0-60 in 1.99 seconds — the quickest production car ever made. Range of 396 miles, Full Self-Driving capability, and a 17-inch cinematic display.',290.00,1800.00,5600.00,1500.00,NULL,0.00,1,'available',false);

-- Vehicle Features
INSERT INTO vehicle_features (vehicle_id, feature) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001','Carbon Ceramic Brakes'),('aaaaaaaa-0000-0000-0000-000000000001','Sport Exhaust'),('aaaaaaaa-0000-0000-0000-000000000001','Lifting Front Axle'),('aaaaaaaa-0000-0000-0000-000000000001','Apple CarPlay'),('aaaaaaaa-0000-0000-0000-000000000001','Backup Camera'),
  ('aaaaaaaa-0000-0000-0000-000000000002','Rear-View Camera'),('aaaaaaaa-0000-0000-0000-000000000002','Carbon Fiber Package'),('aaaaaaaa-0000-0000-0000-000000000002','Racing Seats'),('aaaaaaaa-0000-0000-0000-000000000002','Apple CarPlay'),
  ('aaaaaaaa-0000-0000-0000-000000000003','Electrochromic Roof'),('aaaaaaaa-0000-0000-0000-000000000003','Variable Drift Control'),('aaaaaaaa-0000-0000-0000-000000000003','MSO Bespoke Audio'),('aaaaaaaa-0000-0000-0000-000000000003','Track Telemetry'),
  ('aaaaaaaa-0000-0000-0000-000000000004','PDCC Sport'),('aaaaaaaa-0000-0000-0000-000000000004','Burmester Audio'),('aaaaaaaa-0000-0000-0000-000000000004','Night Vision'),('aaaaaaaa-0000-0000-0000-000000000004','Massaging Seats'),
  ('aaaaaaaa-0000-0000-0000-000000000007','Meridian Sound System'),('aaaaaaaa-0000-0000-0000-000000000007','Air Suspension'),('aaaaaaaa-0000-0000-0000-000000000007','Massage Seats'),('aaaaaaaa-0000-0000-0000-000000000007','Panoramic Roof'),('aaaaaaaa-0000-0000-0000-000000000007','Executive Rear Seating'),
  ('aaaaaaaa-0000-0000-0000-000000000011','Starlight Headliner'),('aaaaaaaa-0000-0000-0000-000000000011','Spirit of Ecstasy'),('aaaaaaaa-0000-0000-0000-000000000011','Bespoke Audio'),('aaaaaaaa-0000-0000-0000-000000000011','Lambswool Floor Mats'),
  ('aaaaaaaa-0000-0000-0000-000000000012','Full Self-Driving'),('aaaaaaaa-0000-0000-0000-000000000012','Autopilot'),('aaaaaaaa-0000-0000-0000-000000000012','Supercharging'),('aaaaaaaa-0000-0000-0000-000000000012','Gaming'),('aaaaaaaa-0000-0000-0000-000000000012','Premium Audio');

-- Vehicle Locations
INSERT INTO vehicle_locations (vehicle_id, name, address, city, state, zip, delivery_available, delivery_fee) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001','Wabs Beverly Hills','9560 Wilshire Blvd','Beverly Hills','CA','90212',true,150.00),
  ('aaaaaaaa-0000-0000-0000-000000000002','Wabs Beverly Hills','9560 Wilshire Blvd','Beverly Hills','CA','90212',true,150.00),
  ('aaaaaaaa-0000-0000-0000-000000000003','Wabs Beverly Hills','9560 Wilshire Blvd','Beverly Hills','CA','90212',true,150.00),
  ('aaaaaaaa-0000-0000-0000-000000000004','Wabs Malibu','22000 Pacific Coast Hwy','Malibu','CA','90265',true,200.00),
  ('aaaaaaaa-0000-0000-0000-000000000005','Wabs Beverly Hills','9560 Wilshire Blvd','Beverly Hills','CA','90212',false,0.00),
  ('aaaaaaaa-0000-0000-0000-000000000006','Wabs Malibu','22000 Pacific Coast Hwy','Malibu','CA','90265',true,200.00),
  ('aaaaaaaa-0000-0000-0000-000000000007','Wabs Beverly Hills','9560 Wilshire Blvd','Beverly Hills','CA','90212',true,150.00),
  ('aaaaaaaa-0000-0000-0000-000000000008','Wabs Beverly Hills','9560 Wilshire Blvd','Beverly Hills','CA','90212',true,150.00),
  ('aaaaaaaa-0000-0000-0000-000000000009','Wabs LAX','1 World Way','Los Angeles','CA','90045',false,0.00),
  ('aaaaaaaa-0000-0000-0000-000000000010','Wabs Malibu','22000 Pacific Coast Hwy','Malibu','CA','90265',true,200.00),
  ('aaaaaaaa-0000-0000-0000-000000000011','Wabs Beverly Hills','9560 Wilshire Blvd','Beverly Hills','CA','90212',true,250.00),
  ('aaaaaaaa-0000-0000-0000-000000000012','Wabs LAX','1 World Way','Los Angeles','CA','90045',false,0.00);
```

- [ ] **Step 2: Create test users and run seed**

1. Go to Supabase Dashboard → Authentication → Users → Add User (x3):
   - `customer@wabs.com` / `WabsDemo2024!`
   - `manager@wabs.com` / `WabsDemo2024!`
   - `admin@wabs.com` / `WabsDemo2024!`
2. Copy each user's UUID from the Users table
3. Open `supabase/seed.sql`, uncomment the `UPDATE roles` lines, and replace `MANAGER_UUID` and `ADMIN_UUID` with the real UUIDs
4. Run the full seed.sql in the Supabase SQL Editor

- [ ] **Step 3: Commit**

```bash
git add supabase/seed.sql
git commit -m "feat: add seed data for 12 demo vehicles, protection plans, extras, and promo codes"
```

---

### Task 5: Role utilities and middleware

**Files:**
- Create: `lib/utils/roles.ts`, `middleware.ts`

- [ ] **Step 1: Create role utilities**

Create `lib/utils/roles.ts`:
```typescript
import { createClient } from "@/lib/supabase/server";

export type UserRole = "customer" | "manager" | "admin";

export async function getUserRole(): Promise<UserRole | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  return (data?.role as UserRole) ?? "customer";
}

export function isManagerOrAdmin(role: UserRole | null): boolean {
  return role === "manager" || role === "admin";
}

export function isAdmin(role: UserRole | null): boolean {
  return role === "admin";
}
```

- [ ] **Step 2: Create middleware**

Create `middleware.ts` in project root:
```typescript
import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user, supabase } = await updateSession(request);
  const path = request.nextUrl.pathname;

  // Auth routes: redirect authenticated users away
  const authPaths = ["/login", "/register", "/forgot-password"];
  if (authPaths.some((p) => path.startsWith(p)) && user) {
    return NextResponse.redirect(new URL("/account", request.url));
  }

  // Account routes: require authentication
  if (path.startsWith("/account") && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Checkout: require authentication
  if (path.startsWith("/checkout") && !user) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirect", path);
    return NextResponse.redirect(redirectUrl);
  }

  // Management console: require manager or admin role
  if (path.startsWith("/management")) {
    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const { data: roleData } = await supabase
      .from("roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const role = roleData?.role;

    if (role !== "manager" && role !== "admin") {
      return NextResponse.redirect(new URL("/", request.url));
    }

    // Settings page: admin only
    if (path.startsWith("/management/settings") && role !== "admin") {
      return NextResponse.redirect(new URL("/management", request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 3: Commit**

```bash
git add lib/utils/roles.ts middleware.ts
git commit -m "feat: add role utilities and route protection middleware"
```

---

### Task 6: Auth validators and server actions

**Files:**
- Create: `lib/validators/auth.ts`, `lib/actions/auth.ts`

- [ ] **Step 1: Create auth Zod validators**

Create `lib/validators/auth.ts`:
```typescript
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const registerSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
```

- [ ] **Step 2: Create auth server actions**

Create `lib/actions/auth.ts`:
```typescript
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema } from "@/lib/validators/auth";

export async function signIn(formData: FormData) {
  const raw = { email: formData.get("email"), password: formData.get("password") };
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: error.message };

  redirect("/account");
}

export async function signUp(formData: FormData) {
  const raw = {
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  };

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        first_name: parsed.data.firstName,
        last_name: parsed.data.lastName,
      },
    },
  });
  if (error) return { error: error.message };

  // Update profile with name (trigger creates the row)
  if (data.user) {
    await supabase.from("profiles").update({
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
    }).eq("id", data.user.id);
  }

  redirect("/account");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function requestPasswordReset(formData: FormData) {
  const raw = { email: formData.get("email") };
  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
  });
  if (error) return { error: error.message };

  return { success: true };
}

export async function resetPassword(formData: FormData) {
  const raw = {
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  };
  const parsed = resetPasswordSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.message };

  redirect("/login");
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/validators/auth.ts lib/actions/auth.ts
git commit -m "feat: add Zod auth validators and server actions"
```

---

### Task 7: Auth UI pages

**Files:**
- Create: `app/(auth)/layout.tsx`, `app/(auth)/login/page.tsx`, `app/(auth)/register/page.tsx`, `app/(auth)/forgot-password/page.tsx`, `app/(auth)/reset-password/page.tsx`
- Create: `components/auth/login-form.tsx`, `components/auth/register-form.tsx`, `components/auth/forgot-password-form.tsx`, `components/auth/reset-password-form.tsx`

- [ ] **Step 1: Create auth layout**

Create `app/(auth)/layout.tsx`:
```typescript
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-deep flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <a href="/" className="inline-flex items-center gap-2">
            <span className="text-2xl font-bold tracking-widest text-white uppercase">WABS</span>
            <span className="text-xs font-light tracking-[0.3em] text-gold uppercase">Car Rental</span>
          </a>
        </div>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create login form component**

Create `components/auth/login-form.tsx`:
```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@/lib/validators/auth";
import { signIn } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function LoginForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginInput) => {
    setLoading(true);
    setServerError(null);
    const formData = new FormData();
    formData.append("email", data.email);
    formData.append("password", data.password);
    const result = await signIn(formData);
    if (result?.error) {
      setServerError(result.error);
      setLoading(false);
    }
  };

  return (
    <Card className="bg-navy border-navy-light">
      <CardHeader>
        <CardTitle className="text-white text-xl">Sign In</CardTitle>
        <CardDescription className="text-text-muted-wabs">Welcome back to Wabs Car Rental</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="email" className="text-white">Email</Label>
            <Input id="email" type="email" {...register("email")}
              className="bg-navy-light border-navy-light text-white placeholder:text-text-muted-wabs focus:border-gold"
              placeholder="you@example.com" />
            {errors.email && <p className="text-red-400 text-xs">{errors.email.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="password" className="text-white">Password</Label>
            <Input id="password" type="password" {...register("password")}
              className="bg-navy-light border-navy-light text-white placeholder:text-text-muted-wabs focus:border-gold" />
            {errors.password && <p className="text-red-400 text-xs">{errors.password.message}</p>}
          </div>
          {serverError && (
            <p className="text-red-400 text-sm bg-red-950/30 p-3 rounded">{serverError}</p>
          )}
          <Button type="submit" disabled={loading}
            className="w-full bg-gold hover:bg-gold-muted text-deep font-semibold">
            {loading ? "Signing in..." : "Sign In"}
          </Button>
          <div className="text-center space-y-2">
            <a href="/forgot-password" className="text-gold text-sm hover:underline block">
              Forgot your password?
            </a>
            <p className="text-text-muted-wabs text-sm">
              No account?{" "}
              <a href="/register" className="text-gold hover:underline">Create one</a>
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Create register form component**

Create `components/auth/register-form.tsx`:
```typescript
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterInput } from "@/lib/validators/auth";
import { signUp } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function RegisterForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterInput) => {
    setLoading(true);
    setServerError(null);
    const formData = new FormData();
    Object.entries(data).forEach(([k, v]) => formData.append(k, v));
    const result = await signUp(formData);
    if (result?.error) {
      setServerError(result.error);
      setLoading(false);
    }
  };

  return (
    <Card className="bg-navy border-navy-light">
      <CardHeader>
        <CardTitle className="text-white text-xl">Create Account</CardTitle>
        <CardDescription className="text-text-muted-wabs">Join Wabs Car Rental</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="firstName" className="text-white">First Name</Label>
              <Input id="firstName" {...register("firstName")}
                className="bg-navy-light border-navy-light text-white placeholder:text-text-muted-wabs focus:border-gold" />
              {errors.firstName && <p className="text-red-400 text-xs">{errors.firstName.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="lastName" className="text-white">Last Name</Label>
              <Input id="lastName" {...register("lastName")}
                className="bg-navy-light border-navy-light text-white placeholder:text-text-muted-wabs focus:border-gold" />
              {errors.lastName && <p className="text-red-400 text-xs">{errors.lastName.message}</p>}
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="email" className="text-white">Email</Label>
            <Input id="email" type="email" {...register("email")}
              className="bg-navy-light border-navy-light text-white placeholder:text-text-muted-wabs focus:border-gold" />
            {errors.email && <p className="text-red-400 text-xs">{errors.email.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="password" className="text-white">Password</Label>
            <Input id="password" type="password" {...register("password")}
              className="bg-navy-light border-navy-light text-white placeholder:text-text-muted-wabs focus:border-gold" />
            {errors.password && <p className="text-red-400 text-xs">{errors.password.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="confirmPassword" className="text-white">Confirm Password</Label>
            <Input id="confirmPassword" type="password" {...register("confirmPassword")}
              className="bg-navy-light border-navy-light text-white placeholder:text-text-muted-wabs focus:border-gold" />
            {errors.confirmPassword && <p className="text-red-400 text-xs">{errors.confirmPassword.message}</p>}
          </div>
          {serverError && (
            <p className="text-red-400 text-sm bg-red-950/30 p-3 rounded">{serverError}</p>
          )}
          <Button type="submit" disabled={loading}
            className="w-full bg-gold hover:bg-gold-muted text-deep font-semibold">
            {loading ? "Creating account..." : "Create Account"}
          </Button>
          <p className="text-center text-text-muted-wabs text-sm">
            Already have an account?{" "}
            <a href="/login" className="text-gold hover:underline">Sign in</a>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Create forgot-password and reset-password form components**

Create `components/auth/forgot-password-form.tsx`:
```typescript
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validators/auth";
import { requestPasswordReset } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ForgotPasswordForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordInput) => {
    setLoading(true);
    setServerError(null);
    const formData = new FormData();
    formData.append("email", data.email);
    const result = await requestPasswordReset(formData);
    if (result?.error) {
      setServerError(result.error);
    } else {
      setSuccess(true);
    }
    setLoading(false);
  };

  if (success) {
    return (
      <Card className="bg-navy border-navy-light">
        <CardContent className="pt-6 text-center space-y-3">
          <p className="text-gold text-lg font-semibold">Check your email</p>
          <p className="text-text-muted-wabs text-sm">We sent a password reset link to your email address.</p>
          <a href="/login" className="text-gold text-sm hover:underline block">Back to sign in</a>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-navy border-navy-light">
      <CardHeader>
        <CardTitle className="text-white text-xl">Reset Password</CardTitle>
        <CardDescription className="text-text-muted-wabs">Enter your email and we'll send a reset link</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="email" className="text-white">Email</Label>
            <Input id="email" type="email" {...register("email")}
              className="bg-navy-light border-navy-light text-white placeholder:text-text-muted-wabs focus:border-gold" />
            {errors.email && <p className="text-red-400 text-xs">{errors.email.message}</p>}
          </div>
          {serverError && <p className="text-red-400 text-sm bg-red-950/30 p-3 rounded">{serverError}</p>}
          <Button type="submit" disabled={loading}
            className="w-full bg-gold hover:bg-gold-muted text-deep font-semibold">
            {loading ? "Sending..." : "Send Reset Link"}
          </Button>
          <a href="/login" className="text-gold text-sm hover:underline block text-center">Back to sign in</a>
        </form>
      </CardContent>
    </Card>
  );
}
```

Create `components/auth/reset-password-form.tsx`:
```typescript
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validators/auth";
import { resetPassword } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ResetPasswordForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = async (data: ResetPasswordInput) => {
    setLoading(true);
    setServerError(null);
    const formData = new FormData();
    formData.append("password", data.password);
    formData.append("confirmPassword", data.confirmPassword);
    const result = await resetPassword(formData);
    if (result?.error) {
      setServerError(result.error);
      setLoading(false);
    }
  };

  return (
    <Card className="bg-navy border-navy-light">
      <CardHeader>
        <CardTitle className="text-white text-xl">Set New Password</CardTitle>
        <CardDescription className="text-text-muted-wabs">Choose a strong password for your account</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="password" className="text-white">New Password</Label>
            <Input id="password" type="password" {...register("password")}
              className="bg-navy-light border-navy-light text-white placeholder:text-text-muted-wabs focus:border-gold" />
            {errors.password && <p className="text-red-400 text-xs">{errors.password.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="confirmPassword" className="text-white">Confirm Password</Label>
            <Input id="confirmPassword" type="password" {...register("confirmPassword")}
              className="bg-navy-light border-navy-light text-white placeholder:text-text-muted-wabs focus:border-gold" />
            {errors.confirmPassword && <p className="text-red-400 text-xs">{errors.confirmPassword.message}</p>}
          </div>
          {serverError && <p className="text-red-400 text-sm bg-red-950/30 p-3 rounded">{serverError}</p>}
          <Button type="submit" disabled={loading}
            className="w-full bg-gold hover:bg-gold-muted text-deep font-semibold">
            {loading ? "Updating..." : "Update Password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Wire up auth pages**

Create `app/(auth)/login/page.tsx`:
```typescript
import { LoginForm } from "@/components/auth/login-form";
export default function LoginPage() { return <LoginForm />; }
```

Create `app/(auth)/register/page.tsx`:
```typescript
import { RegisterForm } from "@/components/auth/register-form";
export default function RegisterPage() { return <RegisterForm />; }
```

Create `app/(auth)/forgot-password/page.tsx`:
```typescript
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
export default function ForgotPasswordPage() { return <ForgotPasswordForm />; }
```

Create `app/(auth)/reset-password/page.tsx`:
```typescript
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
export default function ResetPasswordPage() { return <ResetPasswordForm />; }
```

- [ ] **Step 6: Commit**

```bash
git add app/(auth)/ components/auth/
git commit -m "feat: add complete auth UI — login, register, forgot/reset password"
```

---

### Task 8: Smoke test auth flows

**Files:**
- No new files — manual verification

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Expected: Server starts on http://localhost:3000

- [ ] **Step 2: Verify redirect logic**

1. Visit `http://localhost:3000/account` → should redirect to `/login`
2. Visit `http://localhost:3000/management` → should redirect to `/login`
3. Log in as `manager@wabs.com` / `WabsDemo2024!`
4. Visit `http://localhost:3000/management` → should load (stub page is fine)
5. Log in as `customer@wabs.com` / `WabsDemo2024!`
6. Visit `http://localhost:3000/management` → should redirect to `/`
7. Visit `http://localhost:3000/management/settings` as manager → should redirect to `/management`

- [ ] **Step 3: Verify registration**

1. Visit `/register`, create a new account with a fresh email
2. Should redirect to `/account` (stub is fine)
3. Check Supabase dashboard → Auth → Users — new user should appear
4. Check database → `profiles` table — row auto-created by trigger
5. Check `roles` table — role=customer auto-assigned

- [ ] **Step 4: Verify password reset**

1. Visit `/forgot-password`, enter a valid email
2. Should show "Check your email" success message (actual email delivery depends on Supabase email config)

- [ ] **Step 5: Final commit for Plan 1**

```bash
git add -A
git commit -m "feat: complete Plan 1 — foundation, migrations, seed data, auth"
```
