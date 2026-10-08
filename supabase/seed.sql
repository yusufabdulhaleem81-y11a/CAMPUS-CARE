-- FUD Campus Care — seed.sql
-- Demo/reference data. Run AFTER 0001-0004. Password for all demo users: Password123!
-- WARNING: demo only — rotate or delete these accounts before production use.

-- ---------- Demo auth accounts (id-first login maps to these synthetic emails) ----------
do $$
declare
  u_admin uuid; u_head uuid; u_doc uuid; u_nurse uuid; u_recep uuid; u_lab uuid; u_pharm uuid; u_student uuid;
  pwd text := crypt('Password123!', gen_salt('bf'));
  uid uuid;
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    'admin@clinic.local', pwd, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now())
  returning id into u_admin;

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    'head@clinic.local', pwd, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now())
  returning id into u_head;

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    'doctor@clinic.local', pwd, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now())
  returning id into u_doc;

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    'nurse@clinic.local', pwd, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now())
  returning id into u_nurse;

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    'reception@clinic.local', pwd, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now())
  returning id into u_recep;

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    'lab@clinic.local', pwd, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now())
  returning id into u_lab;

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    'pharmacy@clinic.local', pwd, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now())
  returning id into u_pharm;

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    'student@clinic.local', pwd, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now())
  returning id into u_student;

  insert into public.profiles (id, full_name, role, staff_id, reg_no, email) values
    (u_admin,  'Hauwa Bala',      'admin',       'STF/ADM/001', null, 'admin@clinic.local'),
    (u_head,   'Dr. Musa Iliya',  'hospital_head','STF/HEAD/001', null, 'head@clinic.local'),
    (u_doc,    'Dr. Amina Yusuf', 'doctor',      'STF/MED/014', null, 'doctor@clinic.local'),
    (u_nurse,  'Nurse Sarah Danjuma', 'nurse',   'STF/NUR/032', null, 'nurse@clinic.local'),
    (u_recep,  'Zainab Adamu',    'receptionist','STF/REC/007', null, 'reception@clinic.local'),
    (u_lab,    'Bashir Lawal',    'laboratory',  'STF/LAB/011', null, 'lab@clinic.local'),
    (u_pharm,  'Musa Tanko',      'pharmacist',  'STF/PHA/004', null, 'pharmacy@clinic.local'),
    (u_student,'Ibrahim Kalil',   'student',     null, 'FCO/CSC/24/1001', 'student@clinic.local');

  insert into public.doctors (profile_id, specialty, slot_minutes) values (u_doc, 'General practice', 15);

  insert into public.doctor_schedules (doctor_id, weekday, start_time, end_time) values
    (u_doc, 1, '08:30', '14:00'), (u_doc, 2, '08:30', '14:00'),
    (u_doc, 3, '08:30', '14:00'), (u_doc, 4, '08:30', '14:00'), (u_doc, 5, '08:30', '12:00');

  -- Patient file linked to the demo student
  insert into public.patients (profile_id, category, unit_number, full_name, sex, date_of_birth,
    phone, address, university_id, department, blood_group, allergies, is_verified)
  values (u_student, 'student', 'U-000101', 'Ibrahim Kalil', 'male', '2004-03-14',
    '+2348030000001', 'New Hall, FUD Dutse', 'FCO/CSC/24/1001', 'Computer Science', 'O+', 'Penicillin', true);
end $$;

-- ---------- Catalogues ----------
insert into public.lab_tests (code, name, specimen_type, price) values
  ('FBC',  'Full Blood Count', 'blood', 2500),
  ('MP',   'Malaria Parasite (RDT)', 'blood', 1000),
  ('B/G',  'Blood Genotype', 'blood', 2000),
  ('PCV',  'Packed Cell Volume', 'blood', 1200),
  ('UR/M', 'Urinalysis (Microscopy)', 'urine', 1500),
  ('WIDAL','Widal Test', 'blood', 1800),
  ('FBG',  'Fasting Blood Glucose', 'blood', 1500),
  ('STL',  'Stool Analysis', 'stool', 1500)
on conflict (code) do nothing;

insert into public.medicines (name, category, unit, stock_qty, reorder_level, critical_level) values
  ('Paracetamol 500mg', 'Analgesic', 'tablet', 480, 100, 30),
  ('Amoxicillin 250mg', 'Antibiotic', 'capsule', 60, 80, 20),
  ('Artemether/Lumefantrine', 'Antimalarial', 'tablet', 150, 60, 15),
  ('ORS Sachet', 'Rehydration', 'sachet', 90, 30, 10),
  ('Ibuprofen 400mg', 'Analgesic', 'tablet', 220, 50, 15),
  ('Metronidazole 400mg', 'Antibiotic', 'tablet', 140, 40, 10),
  ('Vitamin C 100mg', 'Supplement', 'tablet', 300, 50, 10),
  ('Hydrochlorothiazide 25mg', 'Antihypertensive', 'tablet', 45, 40, 10)
on conflict (name) do nothing;

insert into public.suppliers (name, contact_person, phone, email, address) values
  ('Kano Med Supplies Ltd', 'Nuhu Garba', '+2348031112222', 'sales@kanomed.ng', '18 Zoo Road, Kano'),
  ('Dutse Pharma Distribution', 'Fatima Sani', '+2348054443333', 'orders@dutsepharma.ng', '5 Murtala Way, Dutse')
on conflict (name) do nothing;
