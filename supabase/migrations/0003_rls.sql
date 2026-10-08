-- FUD Campus Care — 0003_rls.sql
-- Row Level Security: the frontend is never trusted.

alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.doctors enable row level security;
alter table public.doctor_schedules enable row level security;
alter table public.schedule_blocks enable row level security;
alter table public.appointments enable row level security;
alter table public.encounters enable row level security;
alter table public.queue_entries enable row level security;
alter table public.vitals enable row level security;
alter table public.nursing_assessments enable row level security;
alter table public.consultations enable row level security;
alter table public.diagnoses enable row level security;
alter table public.prescriptions enable row level security;
alter table public.prescription_items enable row level security;
alter table public.lab_tests enable row level security;
alter table public.lab_orders enable row level security;
alter table public.lab_results enable row level security;
alter table public.medicines enable row level security;
alter table public.stock_movements enable row level security;
alter table public.suppliers enable row level security;
alter table public.purchase_requests enable row level security;
alter table public.purchase_request_items enable row level security;
alter table public.dispensings enable row level security;
alter table public.stock_alerts enable row level security;
alter table public.shifts enable row level security;
alter table public.attendance enable row level security;
alter table public.handovers enable row level security;
alter table public.emergency_cases enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.clinic_settings enable row level security;

-- ============================================================ PROFILES
-- Own profile always; staff read all profiles (needed for accountability names);
-- patients see only their own.
create policy profiles_select on public.profiles for select using (
  id = auth.uid() or public.is_staff()
);
create policy profiles_update_self on public.profiles for update using (
  id = auth.uid()
) with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));
-- Role changes happen only through admin service-layer operations (Node API).

-- ============================================================ PATIENTS
-- Patient sees own file (via profile link). Staff see all. Identity columns are
-- operational data required by reception; no anon access.
create policy patients_select on public.patients for select using (
  public.is_staff() or (profile_id = auth.uid() and auth.uid() is not null)
);
create policy patients_insert_staff on public.patients for insert with check (
  public.is_staff()
);
create policy patients_update_staff on public.patients for update using (public.is_staff());

-- ============================================================ PROVIDERS & SCHEDULES (public read for booking)
create policy doctors_read on public.doctors for select using (true);
create policy doctor_schedules_read on public.doctor_schedules for select using (true);
create policy schedule_blocks_read on public.schedule_blocks for select using (true);
create policy doctors_manage on public.doctors for all using (public.is_management()) with check (public.is_management());
create policy schedules_manage on public.doctor_schedules for all using (public.is_management()) with check (public.is_management());
create policy blocks_manage on public.schedule_blocks for all using (public.is_staff()) with check (public.is_staff());

-- ============================================================ APPOINTMENTS
create policy appointments_read on public.appointments for select using (
  public.is_staff()
  or exists (select 1 from public.patients p where p.id = appointments.patient_id and p.profile_id = auth.uid())
);
create policy appointments_insert on public.appointments for insert with check (
  exists (select 1 from public.patients p
          join public.profiles pr on pr.id = auth.uid()
          where p.id = appointments.patient_id and (p.profile_id = auth.uid() or pr.role in ('receptionist','admin','super_admin','hospital_head','doctor')))
);
create policy appointments_update on public.appointments for update using (
  public.is_staff()
  or exists (select 1 from public.patients p where p.id = appointments.patient_id and p.profile_id = auth.uid())
);

-- ============================================================ ENCOUNTERS / QUEUE (staff only, except own read)
create policy encounters_read on public.encounters for select using (
  public.is_staff()
  or exists (select 1 from public.patients p where p.id = encounters.patient_id and p.profile_id = auth.uid())
);
create policy encounters_write on public.encounters for insert with check (public.is_staff());
create policy encounters_update on public.encounters for update using (public.is_staff());

create policy queue_read on public.queue_entries for select using (public.is_staff());
create policy queue_write on public.queue_entries for insert with check (public.is_staff());
create policy queue_update on public.queue_entries for update using (public.is_staff());

-- ============================================================ CLINICAL RECORDS
create policy vitals_read on public.vitals for select using (
  public.is_staff()
  or exists (select 1 from public.patients p where p.id = vitals.patient_id and p.profile_id = auth.uid())
);
create policy vitals_write on public.vitals for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('nurse','doctor','admin','super_admin'))
);
create policy nursing_read on public.nursing_assessments for select using (
  public.is_staff()
  or exists (select 1 from public.patients p where p.id = nursing_assessments.patient_id and p.profile_id = auth.uid())
);
create policy nursing_write on public.nursing_assessments for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('nurse','doctor','admin','super_admin'))
);
create policy consultations_read on public.consultations for select using (
  public.is_staff()
  or exists (select 1 from public.encounters e join public.patients p on p.id = e.patient_id
             where e.id = consultations.encounter_id and p.profile_id = auth.uid())
);
create policy consultations_write on public.consultations for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('doctor','admin','super_admin'))
);
create policy consultations_update on public.consultations for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('doctor','admin','super_admin'))
);
create policy diagnoses_read on public.diagnoses for select using (
  public.is_staff()
  or exists (select 1 from public.patients p where p.id = diagnoses.patient_id and p.profile_id = auth.uid())
);
create policy diagnoses_write on public.diagnoses for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('doctor','nurse','admin','super_admin'))
);

-- ============================================================ PRESCRIPTIONS
create policy prescriptions_read on public.prescriptions for select using (
  public.is_staff()
  or exists (select 1 from public.patients p where p.id = prescriptions.patient_id and p.profile_id = auth.uid())
);
create policy prescriptions_write on public.prescriptions for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('doctor','admin','super_admin'))
);
create policy prescriptions_update on public.prescriptions for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('doctor','pharmacist','admin','super_admin'))
);
create policy rx_items_read on public.prescription_items for select using (
  exists (select 1 from public.prescriptions r where r.id = prescription_items.prescription_id
          and (public.is_staff()
               or exists (select 1 from public.patients p where p.id = r.patient_id and p.profile_id = auth.uid())))
);
create policy rx_items_write on public.prescription_items for insert with check (
  exists (select 1 from public.prescriptions r
          where r.id = prescription_items.prescription_id
          and exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.role in ('doctor','admin','super_admin')))
);
create policy rx_items_update on public.prescription_items for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('doctor','pharmacist','admin','super_admin'))
);

-- ============================================================ LABORATORY
create policy lab_tests_read on public.lab_tests for select using (true);
create policy lab_tests_manage on public.lab_tests for all using (public.is_management()) with check (public.is_management());
create policy lab_orders_read on public.lab_orders for select using (
  public.is_staff()
  or (lab_orders.status = 'released'
      and exists (select 1 from public.patients p where p.id = lab_orders.patient_id and p.profile_id = auth.uid()))
);
create policy lab_orders_write on public.lab_orders for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('doctor','nurse','admin','super_admin'))
);
create policy lab_orders_update on public.lab_orders for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('laboratory','doctor','admin','super_admin'))
);
-- Unreleased results are invisible to patients: the join is on released orders only.
create policy lab_results_read on public.lab_results for select using (
  exists (select 1 from public.lab_orders o
          where o.id = lab_results.order_id
          and (public.is_staff()
               or (o.status = 'released'
                   and exists (select 1 from public.patients p where p.id = o.patient_id and p.profile_id = auth.uid()))))
);
create policy lab_results_write on public.lab_results for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('laboratory','admin','super_admin'))
);
create policy lab_results_update on public.lab_results for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('laboratory','admin','super_admin'))
);

-- ============================================================ PHARMACY
create policy medicines_read on public.medicines for select using (
  public.is_staff()
  or exists (select 1 from public.profiles where id = auth.uid() and role = 'student')
);
create policy medicines_manage on public.medicines for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('pharmacist','admin','super_admin'))
) with check (exists (select 1 from public.profiles where id = auth.uid() and role in ('pharmacist','admin','super_admin')));
create policy stock_movements_read on public.stock_movements for select using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('pharmacist','admin','super_admin','hospital_head'))
);
create policy stock_movements_insert on public.stock_movements for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('pharmacist','admin','super_admin'))
);
create policy suppliers_read on public.suppliers for select using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('pharmacist','admin','super_admin','hospital_head'))
);
create policy suppliers_manage on public.suppliers for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('pharmacist','admin','super_admin'))
) with check (exists (select 1 from public.profiles where id = auth.uid() and role in ('pharmacist','admin','super_admin')));
create policy purchase_requests_read on public.purchase_requests for select using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('pharmacist','admin','super_admin','hospital_head'))
);
create policy purchase_requests_insert on public.purchase_requests for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('pharmacist','admin','super_admin'))
);
create policy purchase_requests_update on public.purchase_requests for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('pharmacist','admin','super_admin','hospital_head'))
);
create policy purchase_items_read on public.purchase_request_items for select using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('pharmacist','admin','super_admin','hospital_head'))
);
create policy purchase_items_write on public.purchase_request_items for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('pharmacist','admin','super_admin'))
) with check (exists (select 1 from public.profiles where id = auth.uid() and role in ('pharmacist','admin','super_admin')));
create policy dispensings_read on public.dispensings for select using (
  public.is_staff()
  or exists (select 1 from public.patients p where p.id = dispensings.patient_id and p.profile_id = auth.uid())
);
create policy stock_alerts_read on public.stock_alerts for select using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('pharmacist','admin','super_admin','hospital_head'))
);
create policy stock_alerts_update on public.stock_alerts for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('pharmacist','admin','super_admin'))
);

-- ============================================================ STAFF OPERATIONS
create policy shifts_read on public.shifts for select using (
  public.is_staff() or shifts.staff_id = auth.uid()
);
create policy shifts_write on public.shifts for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','super_admin','hospital_head'))
) with check (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','super_admin','hospital_head')));
create policy attendance_read on public.attendance for select using (
  public.is_staff()
);
create policy attendance_write_self on public.attendance for insert with check (
  attendance.staff_id = auth.uid()
);
create policy attendance_update on public.attendance for update using (
  attendance.staff_id = auth.uid()
  or exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','super_admin','hospital_head'))
);
create policy handovers_read on public.handovers for select using (public.is_staff());
create policy handovers_write on public.handovers for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('nurse','doctor','receptionist','admin','super_admin','hospital_head'))
);

-- ============================================================ EMERGENCY
-- Anyone may file an emergency request; case management is staff-only, except
-- the reporter can follow their own case.
create policy emergency_read on public.emergency_cases for select using (
  public.is_staff() or created_by = auth.uid()
);
create policy emergency_insert on public.emergency_cases for insert with check (true);
create policy emergency_update on public.emergency_cases for update using (public.is_staff());

-- ============================================================ NOTIFICATIONS
create policy notifications_own on public.notifications for select using (user_id = auth.uid());
create policy notifications_update_own on public.notifications for update using (user_id = auth.uid());
create policy notifications_insert on public.notifications for insert with check (public.is_staff());

-- ============================================================ AUDIT
-- Insert happens only through the SECURITY DEFINER log_audit function (no insert
-- policy for clients). Reading history is management-level.
create policy audit_select on public.audit_logs for select using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','super_admin','hospital_head'))
);

-- ============================================================ SETTINGS
create policy settings_read on public.clinic_settings for select using (true);
create policy settings_manage on public.clinic_settings for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','super_admin'))
);
