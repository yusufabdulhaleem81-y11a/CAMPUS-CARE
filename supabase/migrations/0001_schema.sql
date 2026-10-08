-- FUD Campus Care — 0001_schema.sql
-- Core relational schema. Normalized; the patient file is the center.
-- Conventions: uuid PKs, timestamptz for instants, date/time for clinic-day facts,
-- partial unique indexes for "one active X" business rules.

create extension if not exists "pgcrypto";

-- ============================================================ ENUMS
do $$ begin
  create type user_role as enum ('student','receptionist','nurse','doctor','laboratory','pharmacist','admin','super_admin','hospital_head');
exception when duplicate_object then null; end $$;

do $$ begin
  create type patient_category as enum ('student','university_staff','external');
exception when duplicate_object then null; end $$;

do $$ begin
  create type encounter_type as enum ('appointment','walk_in','emergency');
exception when duplicate_object then null; end $$;

do $$ begin
  create type appointment_status as enum ('booked','checked_in','cancelled','no_show');
exception when duplicate_object then null; end $$;

do $$ begin
  create type queue_status as enum ('waiting','called','in_consult','completed','skipped','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type encounter_status as enum ('open','closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type prescription_status as enum ('pending','partially_dispensed','dispensed','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lab_order_status as enum ('ordered','sample_collected','result_entered','verified','released','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type movement_type as enum ('receipt','dispense','adjustment','correction');
exception when duplicate_object then null; end $$;

do $$ begin
  create type purchase_status as enum ('submitted','approved','rejected','received');
exception when duplicate_object then null; end $$;

do $$ begin
  create type alert_level as enum ('low','critical','out_of_stock');
exception when duplicate_object then null; end $$;

do $$ begin
  create type alert_status as enum ('open','acknowledged','resolved');
exception when duplicate_object then null; end $$;

do $$ begin
  create type emergency_status as enum ('open','responding','handed_over','closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type triage_priority as enum ('critical','serious','minor');
exception when duplicate_object then null; end $$;

do $$ begin
  create type shift_type as enum ('morning','afternoon','night');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attendance_status as enum ('present','late','absent','on_duty');
exception when duplicate_object then null; end $$;

-- ============================================================ IDENTITY
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  role user_role not null default 'student',
  staff_id text unique,
  reg_no text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================ PATIENT FILE CENTER
-- One patient = one clinic file = one Unit Number. Patients may exist without an
-- auth account (registered by reception). Category does not change the shape.
create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  category patient_category not null default 'external',
  unit_number text not null unique,
  full_name text not null,
  date_of_birth date,
  sex text check (sex in ('male','female')),
  phone text,
  address text,
  blood_group text,
  allergies text,
  chronic_conditions text,
  next_of_kin_name text,
  next_of_kin_phone text,
  next_of_kin_relationship text,
  university_id text,             -- Reg No (students) or Staff ID (university staff)
  department text,
  is_verified boolean not null default false,  -- reception saw a physical ID
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists patients_full_name_idx on public.patients using gin (to_tsvector('simple', full_name));
create index if not exists patients_profile_idx on public.patients(profile_id);
create unique index if not exists patients_university_id_uniq
  on public.patients(university_id) where university_id is not null;

-- ============================================================ PROVIDERS & SCHEDULES
create table if not exists public.doctors (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  specialty text,
  slot_minutes int not null default 15 check (slot_minutes between 5 and 120),
  is_accepting_appointments boolean not null default true
);

create table if not exists public.doctor_schedules (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(profile_id) on delete cascade,
  weekday int not null check (weekday between 0 and 6), -- 0=Sunday
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  check (end_time > start_time)
);

create table if not exists public.schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(profile_id) on delete cascade,
  block_date date not null,
  start_time time,
  end_time time,                  -- null/null = whole day blocked
  reason text,
  created_by uuid references public.profiles(id) on delete set null
);

-- ============================================================ APPOINTMENTS
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  doctor_id uuid not null references public.doctors(profile_id),
  appointment_date date not null,
  start_time time not null,
  end_time time not null,
  service text not null default 'General consultation',
  status appointment_status not null default 'booked',
  reference text not null unique,
  encounter_id uuid,              -- set when the booking converts to a visit
  booked_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);
-- one live booking per patient per day, and one booking per doctor-slot
create unique index if not exists appointments_patient_day_uniq
  on public.appointments(patient_id, appointment_date) where status = 'booked';
create unique index if not exists appointments_slot_uniq
  on public.appointments(doctor_id, appointment_date, start_time) where status = 'booked';

-- ============================================================ ENCOUNTERS (VISITS)
create table if not exists public.encounters (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  encounter_type encounter_type not null default 'walk_in',
  status encounter_status not null default 'open',
  chief_complaint text,
  opened_by uuid references public.profiles(id) on delete set null,
  closed_by uuid references public.profiles(id) on delete set null,
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);
create unique index if not exists encounters_open_per_patient_uniq
  on public.encounters(patient_id) where status = 'open';

-- ============================================================ QUEUE
create table if not exists public.queue_entries (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null unique references public.encounters(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  queue_date date not null default current_date,
  queue_number int not null,
  priority int not null default 5,           -- 1 = emergency first
  status queue_status not null default 'waiting',
  called_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (queue_date, queue_number)
);
create index if not exists queue_today_idx on public.queue_entries(queue_date, status, priority);

-- ============================================================ CLINICAL RECORDS
create table if not exists public.vitals (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  recorded_by uuid references public.profiles(id) on delete set null,
  temperature_c numeric(4,1),
  systolic int, diastolic int,
  pulse int, resp_rate int, spo2 int,
  weight_kg numeric(5,1), height_cm numeric(5,1),
  notes text,
  recorded_at timestamptz not null default now()
);

create table if not exists public.nursing_assessments (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  recorded_by uuid references public.profiles(id) on delete set null,
  assessment text not null,
  intervention text,
  escalated_to_doctor boolean not null default false,
  recorded_at timestamptz not null default now()
);

create table if not exists public.consultations (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null unique references public.encounters(id) on delete cascade,
  doctor_id uuid not null references public.profiles(id) on delete set null,
  presentation text not null,
  examination text,
  treatment_plan text,
  follow_up_date date,
  consultation_at timestamptz not null default now()
);

create table if not exists public.diagnoses (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  code text,                       -- ICD-style code where known
  name text not null,
  diagnosed_by uuid references public.profiles(id) on delete set null,
  diagnosed_at timestamptz not null default now()
);
create index if not exists diagnoses_name_idx on public.diagnoses(lower(name));

create table if not exists public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  prescribed_by uuid references public.profiles(id) on delete set null,
  status prescription_status not null default 'pending',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.prescription_items (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.prescriptions(id) on delete cascade,
  medicine_id uuid,                -- matched to catalogue at dispense time
  medicine_name text not null,
  dosage text not null,
  frequency text not null,
  duration_days int,
  quantity int not null check (quantity > 0),
  dispensed_qty int not null default 0 check (dispensed_qty >= 0)
);

-- ============================================================ LABORATORY
create table if not exists public.lab_tests (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  specimen_type text not null default 'blood',
  price numeric(10,2) not null default 0,
  is_active boolean not null default true
);

create table if not exists public.lab_orders (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  test_id uuid not null references public.lab_tests(id),
  ordered_by uuid references public.profiles(id) on delete set null,
  status lab_order_status not null default 'ordered',
  clinical_note text,
  ordered_at timestamptz not null default now(),
  sample_collected_at timestamptz,
  released_at timestamptz,
  released_by uuid references public.profiles(id) on delete set null
);
create index if not exists lab_orders_status_idx on public.lab_orders(status, ordered_at);

create table if not exists public.lab_results (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.lab_orders(id) on delete cascade,
  result_text text not null,
  remarks text,
  entered_by uuid references public.profiles(id) on delete set null,
  verified_by uuid references public.profiles(id) on delete set null,
  entered_at timestamptz not null default now()
);

-- ============================================================ PHARMACY
create table if not exists public.medicines (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text,
  unit text not null default 'tablet',
  stock_qty int not null default 0 check (stock_qty >= 0),
  reorder_level int not null default 20,
  critical_level int not null default 5,
  is_active boolean not null default true
);

create table if not exists public.stock_movements (
  id bigserial primary key,
  medicine_id uuid not null references public.medicines(id) on delete cascade,
  movement_type movement_type not null,
  quantity_change int not null,          -- signed; dispense is negative
  batch_no text,
  expiry_date date,
  reason text,
  performed_by uuid references public.profiles(id) on delete set null,
  reference_id uuid,                     -- prescription/dispensing/purchase id
  created_at timestamptz not null default now()
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  contact_person text,
  phone text,
  email text,
  address text
);

create table if not exists public.purchase_requests (
  id uuid primary key default gen_random_uuid(),
  request_number text not null unique,
  status purchase_status not null default 'submitted',
  created_by uuid references public.profiles(id) on delete set null,
  notes text,
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  decision_reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.purchase_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.purchase_requests(id) on delete cascade,
  medicine_id uuid not null references public.medicines(id),
  quantity_requested int not null check (quantity_requested > 0),
  quantity_approved int check (quantity_approved >= 0),
  supplier_id uuid references public.suppliers(id) on delete set null
);

create table if not exists public.dispensings (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.prescriptions(id) on delete cascade,
  prescription_item_id uuid not null references public.prescription_items(id) on delete cascade,
  medicine_id uuid not null references public.medicines(id),
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  quantity int not null check (quantity > 0),
  dispensed_by uuid references public.profiles(id) on delete set null,
  dispensed_at timestamptz not null default now()
);

-- ============================================================ STOCK ALERTS (automated)
create table if not exists public.stock_alerts (
  id uuid primary key default gen_random_uuid(),
  medicine_id uuid not null references public.medicines(id) on delete cascade,
  alert_level alert_level not null,
  stock_qty int not null,
  usage_per_day numeric(10,2),
  days_remaining numeric(10,1),
  status alert_status not null default 'open',
  acknowledged_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
-- one open alert per medicine per level
create unique index if not exists stock_alerts_open_uniq
  on public.stock_alerts(medicine_id, alert_level) where status = 'open';

-- ============================================================ STAFF OPERATIONS
create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles(id) on delete cascade,
  shift_date date not null,
  shift_type shift_type not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  department text not null default 'clinic',
  is_emergency_responsible boolean not null default false,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  check (ends_at > starts_at),
  unique (staff_id, shift_date, shift_type)
);
create index if not exists shifts_range_idx on public.shifts(starts_at, ends_at);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles(id) on delete cascade,
  shift_id uuid references public.shifts(id) on delete set null,
  work_date date not null,
  check_in_at timestamptz,
  check_out_at timestamptz,
  status attendance_status not null default 'present',
  unique (staff_id, work_date)
);

create table if not exists public.handovers (
  id uuid primary key default gen_random_uuid(),
  from_staff_id uuid not null references public.profiles(id) on delete set null,
  to_staff_id uuid references public.profiles(id) on delete set null,
  from_shift_type shift_type,
  to_shift_type shift_type,
  summary text not null,
  open_cases_note text,
  created_at timestamptz not null default now()
);

-- ============================================================ EMERGENCY
create table if not exists public.emergency_cases (
  id uuid primary key default gen_random_uuid(),
  case_number text not null unique,
  patient_id uuid references public.patients(id) on delete set null,
  caller_name text,
  caller_phone text,
  location text not null,
  description text not null,
  priority triage_priority not null default 'serious',
  status emergency_status not null default 'open',
  triage_notes text,
  assigned_to uuid references public.profiles(id) on delete set null,
  handed_over_to uuid references public.profiles(id) on delete set null,
  handed_over_at timestamptz,
  closed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================ NOTIFICATIONS
create table if not exists public.notifications (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  type text not null default 'info',
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);

-- ============================================================ AUDIT (append-only, function-only)
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_role text,
  actor_name text,
  action text not null,
  patient_id uuid,
  encounter_id uuid,
  table_name text,
  record_id text,
  old_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_patient_idx on public.audit_logs(patient_id, created_at desc);
create index if not exists audit_logs_actor_idx on public.audit_logs(actor_id, created_at desc);

-- ============================================================ SETTINGS
create table if not exists public.clinic_settings (
  id int primary key default 1 check (id = 1),
  clinic_name text not null default 'FUD Campus Care Clinic',
  unit_number_prefix text not null default 'U',
  unit_number_next int not null default 1,
  allow_open_signup boolean not null default true,
  emergency_phone text not null default '+234 000 000 0000',
  opening_time time not null default '08:00',
  closing_time time not null default '17:00',
  updated_at timestamptz not null default now()
);
insert into public.clinic_settings (id) values (1) on conflict (id) do nothing;
