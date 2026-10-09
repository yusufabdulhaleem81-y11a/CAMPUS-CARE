# FUD Campus Care

Clinic management system for Federal University Dutse: a patient-facing student
portal, a role-based staff clinic workspace (reception, nursing, doctors,
laboratory, pharmacy, administration, hospital management), emergency workflows,
inventory, and disease surveillance.

Monorepo layout:

| Folder | What it is |
|---|---|
| `frontend/` | React 19 + TypeScript + Vite + Tailwind 4 SPA (React Router 7) |
| `server/` | Express 5 API on port **8787** — authentication, role authorization, and all database access |
| `supabase/` | PostgreSQL schema, functions/RPCs, RLS policies, analytics views, seed data |

## Architecture in one paragraph

The frontend never talks to Postgres directly (one deliberate exception: the
portal Notifications panel reads the signed-in student's own notifications
through the Supabase client, which is RLS-protected). It calls the Express API,
which validates every request's Supabase JWT, loads the caller's profile, and
enforces role checks server-side. Sensitive multi-step operations (registration,
booking, check-in, queue transitions, dispensing, stock, emergency cases,
handovers) run as **atomic database RPCs** with their own authorization checks,
so permissions do not depend on the API or the UI alone. Row Level Security is
enabled on every table. The service-role key is used only inside the server for
account provisioning and management analytics (which return aggregated,
non-identifying rows).

## Prerequisites

- Node.js 18+ (Node 20+ recommended)
- A Supabase project (hosted, or a local one via the Supabase CLI + Docker)

## 1. Database setup

Run the SQL in `supabase/migrations/` **in order** (0001 → 0004), then
`supabase/seed.sql`, using the Supabase SQL editor or `psql`:

```bash
# with psql, using your project's database URL
psql "$DATABASE_URL" -f supabase/migrations/0001_schema.sql
psql "$DATABASE_URL" -f supabase/migrations/0002_functions.sql
psql "$DATABASE_URL" -f supabase/migrations/0003_rls.sql
psql "$DATABASE_URL" -f supabase/migrations/0004_analytics.sql
psql "$DATABASE_URL" -f supabase/seed.sql
```

With the Supabase CLI instead:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push          # applies supabase/migrations/*.sql in order
supabase db execute -f supabase/seed.sql
```

What the migrations give you: tables and constraints for patients (student /
university_staff / external categories), staff profiles and roles, appointments,
encounters, queues, triage/vitals/nursing, consultations, diagnoses,
prescriptions and dispensing, lab tests/orders/results with a verify-then-release
workflow, medicines/stock movements/alerts/purchase requests, emergency cases,
shifts/attendance/handovers, notifications, audit-log triggers, clinic settings,
concurrency-safe Clinic Unit Number generation (advisory lock + monotonically
increasing counter — issued numbers are never reused), RLS policies for all
tables, and analytics views for management/surveillance.

`seed.sql` creates **demo accounts only** — all with password `Password123!`:

| Login ID | Role | Name |
|---|---|---|
| `STF/ADM/001` | admin | Hauwa Bala |
| `STF/HEAD/001` | hospital_head | Dr. Musa Iliya |
| `STF/MED/014` | doctor | Dr. Amina Yusuf |
| `STF/NUR/032` | nurse | Nurse Sarah Danjuma |
| `STF/REC/007` | receptionist | Zainab Adamu |
| `STF/LAB/011` | laboratory | Bashir Lawal |
| `STF/PHA/004` | pharmacist | Musa Tanko |
| `FCO/CSC/24/1001` | student | Ibrahim Kalil |

> **Before production:** rotate or delete these demo accounts (Admin →
> Administration in the app, or Supabase Auth admin API).

## 2. Configure the server

```bash
cd server
cp .env.example .env    # then edit .env with your real Supabase values
npm install
```

Required values in `server/.env`:

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — from
  Supabase → Project Settings → API
- `PORT` (default 8787), `FRONTEND_ORIGIN` (default http://localhost:5173)

## 3. Configure the frontend

```bash
cd frontend
cp .env.example .env    # VITE_API_URL + VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
npm install
```

`VITE_API_URL` should be `http://localhost:8787/api` for local development.
Without the Supabase values the app still works; only the portal Notifications
panel will show an empty list.

## 4. Run

```bash
# terminal 1
cd server && npm run dev        # API on http://localhost:8787

# terminal 2
cd frontend && npm run dev      # app on http://localhost:5173
```

Open http://localhost:5173 and sign in with any demo account above.

## Checks and builds

```bash
cd frontend && npm run lint     # oxlint
cd frontend && npm run build    # tsc -b && vite build → dist/
cd server && npm run build      # tsc → dist/
```

## Test accounts and roles

Roles in the system: `student`, `receptionist`, `nurse`, `doctor`,
`laboratory`, `pharmacist`, `hospital_head`, `admin`, `super_admin`.
Each role lands on its own home page after login (see `homeForRole` in
`frontend/src/lib/auth.tsx`). Staff accounts are created by an admin in the
Administration page; students self-register on the Signup page, which provisions
their auth account, profile, and Clinic Unit Number atomically.

## Data safety notes

- Clinic Unit Numbers are generated under `pg_advisory_xact_lock` from a
  counter in `clinic_settings` — never reset that counter on a live system.
- Clinical history is preserved: corrections go through audit records and stock
  adjustments are movement-logged, not overwritten.
- The frontend never holds the service-role key; CORS is restricted to
  `FRONTEND_ORIGIN`.
