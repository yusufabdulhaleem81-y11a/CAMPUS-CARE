-- FUD Campus Care — 0002_functions.sql
-- Atomic RPCs + automatic audit triggers. The database says no even if the app lies.

-- ============================================================ HELPERS
create or replace function public.current_role_of()
returns user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid()
                 and role in ('receptionist','nurse','doctor','laboratory','pharmacist','admin','super_admin','hospital_head'));
$$;

create or replace function public.is_management()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid()
                 and role in ('admin','super_admin','hospital_head'));
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','patients','clinic_settings','emergency_cases']
  loop
    execute format('drop trigger if exists trg_touch_%1$s on public.%1$s', t);
    execute format('create trigger trg_touch_%1$s before update on public.%1$s
                    for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- ============================================================ AUDIT
-- Audit writer: actor is always derived from the authenticated session, never
-- passed in by the client. Granting execute to authenticated lets staff record
-- honest actions; reading history is restricted in 0003.
create or replace function public.log_audit(
  p_action text,
  p_patient_id uuid default null,
  p_encounter_id uuid default null,
  p_table_name text default null,
  p_record_id text default null,
  p_old jsonb default null,
  p_new jsonb default null,
  p_reason text default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); v_role text; v_name text;
begin
  if v_actor is not null then
    select role::text, full_name into v_role, v_name from public.profiles where id = v_actor;
  end if;
  insert into public.audit_logs (actor_id, actor_role, actor_name, action, patient_id, encounter_id,
                                 table_name, record_id, old_value, new_value, reason)
  values (v_actor, v_role, v_name, p_action, p_patient_id, p_encounter_id, p_table_name,
          p_record_id, p_old, p_new, p_reason);
end $$;

grant execute on function public.log_audit to authenticated;

-- Automatic audit triggers on every clinically important write.
create or replace function public.audit_row_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_patient uuid; v_enc uuid; v_action text; v_record text;
begin
  v_action := lower(tg_op) || '_' || tg_table_name;
  if tg_table_name = 'queue_entries' then v_action := tg_op = 'INSERT' ? 'check_in' : 'queue_' || lower(tg_op); end if;
  if tg_op in ('INSERT','UPDATE') then
    v_record := coalesce(new.id::text, new.encounter_id::text);
    case tg_table_name
      when 'vitals' then v_patient := new.patient_id; v_enc := new.encounter_id;
      when 'nursing_assessments' then v_patient := new.patient_id; v_enc := new.encounter_id;
      when 'consultations' then v_enc := new.encounter_id; v_patient := (select patient_id from public.encounters where id = new.encounter_id);
      when 'diagnoses' then v_patient := new.patient_id; v_enc := new.encounter_id;
      when 'prescriptions' then v_patient := new.patient_id; v_enc := new.encounter_id;
      when 'lab_orders' then v_patient := new.patient_id; v_enc := new.encounter_id;
      when 'dispensings' then v_patient := new.patient_id; v_enc := new.encounter_id;
      when 'encounters' then v_patient := new.patient_id; v_enc := new.id;
      when 'appointments' then v_patient := new.patient_id;
      when 'queue_entries' then v_patient := new.patient_id; v_enc := new.encounter_id;
      when 'emergency_cases' then v_patient := new.patient_id;
    end case;
  else
    v_record := coalesce(old.id::text, old.encounter_id::text);
  end if;
  perform public.log_audit(v_action, v_patient, v_enc, tg_table_name, v_record,
                           case when tg_op = 'UPDATE' then to_jsonb(old) end,
                           case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end);
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['patients','encounters','appointments','queue_entries','vitals',
    'nursing_assessments','consultations','diagnoses','prescriptions','lab_orders',
    'dispensings','stock_movements','purchase_requests','emergency_cases','attendance','shifts']
  loop
    execute format('drop trigger if exists trg_audit_%1$s on public.%1$s', t);
    execute format('create trigger trg_audit_%1$s after insert or update or delete on public.%1$s
                    for each row execute function public.audit_row_trigger()', t);
  end loop;
end $$;

-- ============================================================ UNIT NUMBERS
create or replace function public.generate_unit_number()
returns text language plpgsql security definer set search_path = public as $$
declare v_next int; v_prefix text;
begin
  perform pg_advisory_xact_lock(hashtext('unit_number'));
  select unit_number_next, unit_number_prefix into v_next, v_prefix from public.clinic_settings where id = 1;
  update public.clinic_settings set unit_number_next = v_next + 1, updated_at = now() where id = 1;
  return v_prefix || '-' || lpad(v_next::text, 6, '0');
end $$;

-- ============================================================ PATIENT REGISTRATION
-- Reception / clinical staff register any patient category.
create or replace function public.register_patient(
  p_full_name text, p_category patient_category, p_phone text default null,
  p_sex text default null, p_date_of_birth date default null, p_address text default null,
  p_blood_group text default null, p_allergies text default null, p_chronic_conditions text default null,
  p_next_of_kin_name text default null, p_next_of_kin_phone text default null,
  p_next_of_kin_relationship text default null,
  p_university_id text default null, p_department text default null
) returns public.patients language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); v_row public.patients;
begin
  if not public.is_staff() then raise exception 'Only clinic staff can register patients'; end if;
  if p_university_id is not null and exists (
    select 1 from public.patients where university_id = p_university_id) then
    raise exception 'A patient file already exists for this university ID';
  end if;
  insert into public.patients (category, unit_number, full_name, phone, sex, date_of_birth, address,
    blood_group, allergies, chronic_conditions, next_of_kin_name, next_of_kin_phone,
    next_of_kin_relationship, university_id, department, created_by)
  values (p_category, public.generate_unit_number(), p_full_name, p_phone, p_sex, p_date_of_birth,
    p_address, p_blood_group, p_allergies, p_chronic_conditions, p_next_of_kin_name,
    p_next_of_kin_phone, p_next_of_kin_relationship, p_university_id, p_department, v_actor)
  returning * into v_row;
  return v_row;
end $$;

-- Open self-registration (pilot setting): anonymous visitors create their own file,
-- marked unverified until reception checks a physical ID.
create or replace function public.self_register_patient(
  p_full_name text, p_phone text, p_sex text, p_date_of_birth date default null,
  p_address text default null, p_next_of_kin_name text default null,
  p_next_of_kin_phone text default null
) returns public.patients language plpgsql security definer set search_path = public as $$
declare v_setting boolean; v_actor uuid := auth.uid(); v_row public.patients;
begin
  select allow_open_signup into v_setting from public.clinic_settings where id = 1;
  if not coalesce(v_setting, false) then raise exception 'Open registration is currently disabled'; end if;
  insert into public.patients (category, unit_number, full_name, phone, sex, date_of_birth, address,
    next_of_kin_name, next_of_kin_phone, profile_id, is_verified)
  values ('external', public.generate_unit_number(), p_full_name, p_phone, p_sex, p_date_of_birth,
    p_address, p_next_of_kin_name, p_next_of_kin_phone, v_actor, false)
  returning * into v_row;
  return v_row;
end $$;
grant execute on function public.self_register_patient to anon, authenticated;

-- ============================================================ BOOKING
create or replace function public.booked_slots(p_doctor_id uuid, p_date date)
returns table (slot_time time) language sql stable security definer set search_path = public as $$
  select start_time from public.appointments
  where doctor_id = p_doctor_id and appointment_date = p_date and status = 'booked';
$$;
grant execute on function public.booked_slots to anon, authenticated;

create or replace function public.book_appointment(
  p_patient_id uuid, p_doctor_id uuid, p_date date, p_start_time time, p_service text default 'General consultation'
) returns public.appointments language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); v_role user_role; v_slot int; v_end time;
  v_sched record; v_ref text;
begin
  if v_actor is null then raise exception 'Sign in to book an appointment'; end if;
  select role into v_role from public.profiles where id = v_actor;
  if v_role = 'student' then
    if not exists (select 1 from public.patients where id = p_patient_id and profile_id = v_actor) then
      raise exception 'You can only book for your own patient file';
    end if;
  elsif v_role not in ('receptionist','admin','super_admin','hospital_head','doctor') then
    raise exception 'Booking not permitted for your role';
  end if;
  if p_date < current_date then raise exception 'Cannot book a date in the past'; end if;

  select slot_minutes into v_slot from public.doctors
  where profile_id = p_doctor_id and is_accepting_appointments;
  if v_slot is null then raise exception 'This doctor is not accepting appointments'; end if;
  v_end := p_start_time + make_interval(mins => v_slot);

  select 1 into v_sched from public.doctor_schedules
  where doctor_id = p_doctor_id and is_active and weekday = extract(dow from p_date)::int
    and start_time <= p_start_time and end_time >= v_end;
  if not found then raise exception 'The selected time is outside this doctor''s schedule'; end if;

  if exists (select 1 from public.schedule_blocks where doctor_id = p_doctor_id and block_date = p_date
      and (start_time is null or (start_time < v_end and coalesce(end_time, '23:59'::time) > p_start_time))) then
    raise exception 'The doctor is unavailable at this time'; end if;

  if exists (select 1 from public.appointments where doctor_id = p_doctor_id
      and appointment_date = p_date and status = 'booked'
      and start_time < v_end and end_time > p_start_time) then
    raise exception 'This slot has just been taken. Pick another time'; end if;

  if exists (select 1 from public.appointments where patient_id = p_patient_id
      and appointment_date = p_date and status = 'booked') then
    raise exception 'This patient already has a booking on that date'; end if;

  v_ref := 'CC-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));
  insert into public.appointments (patient_id, doctor_id, appointment_date, start_time, end_time,
    service, reference, booked_by)
  values (p_patient_id, p_doctor_id, p_date, p_start_time, v_end, p_service, v_ref, v_actor)
  returning * into v_sched;
  return v_sched;
end $$;

create or replace function public.cancel_appointment(p_appointment_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); v_role user_role; v_appt record;
begin
  select * into v_appt from public.appointments where id = p_appointment_id and status = 'booked';
  if not found then raise exception 'Appointment not found or already handled'; end if;
  select role into v_role from public.profiles where id = v_actor;
  if v_role = 'student' and not exists (
    select 1 from public.patients where id = v_appt.patient_id and profile_id = v_actor) then
    raise exception 'You can only cancel your own appointments';
  elsif v_role not in ('student','receptionist','admin','super_admin','hospital_head','doctor') then
    raise exception 'Not permitted';
  end if;
  update public.appointments set status = 'cancelled' where id = p_appointment_id;
  perform public.log_audit('appointment_cancelled', v_appt.patient_id, null, 'appointments',
    p_appointment_id::text, to_jsonb(v_appt), jsonb_build_object('status','cancelled'), p_reason);
end $$;

-- ============================================================ CHECK-IN + QUEUE
create or replace function public.check_in_patient(
  p_patient_id uuid, p_encounter_type encounter_type default 'walk_in',
  p_chief_complaint text default null, p_appointment_id uuid default null
) returns record language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); v_enc uuid; v_num int; v_appt record;
begin
  if not public.is_staff() then raise exception 'Only clinic staff can check patients in'; end if;
  perform pg_advisory_xact_lock(hashtext('queue_' || current_date::text));

  if p_appointment_id is not null then
    select * into v_appt from public.appointments
    where id = p_appointment_id and patient_id = p_patient_id and status = 'booked';
    if not found then raise exception 'Booking not found or already checked in'; end if;
    update public.appointments set status = 'checked_in' where id = p_appointment_id;
  end if;

  if exists (select 1 from public.encounters where patient_id = p_patient_id and status = 'open') then
    raise exception 'This patient already has an open visit. Close it first';
  end if;

  insert into public.encounters (patient_id, appointment_id, encounter_type, chief_complaint, opened_by)
  values (p_patient_id, p_appointment_id, p_encounter_type, p_chief_complaint, v_actor)
  returning id into v_enc;

  select coalesce(max(queue_number), 0) + 1 into v_num
  from public.queue_entries where queue_date = current_date;

  insert into public.queue_entries (encounter_id, patient_id, queue_date, queue_number, priority,
    status, assigned_to)
  values (v_enc, p_patient_id, current_date, v_num,
    case p_encounter_type when 'emergency' then 1 else 5 end, 'waiting', v_actor);

  return (v_enc, v_num)::record;
end $$;

create or replace function public.queue_transition(p_queue_id uuid, p_action text)
returns void language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); v_row public.queue_entries;
begin
  if not public.is_staff() then raise exception 'Not permitted'; end if;
  select * into v_row from public.queue_entries where id = p_queue_id for update;
  if not found then raise exception 'Queue entry not found'; end if;
  case p_action
    when 'call' then
      if v_row.status not in ('waiting','skipped') then raise exception 'Cannot call from status %', v_row.status; end if;
      update public.queue_entries set status = 'called', called_at = now(), assigned_to = v_actor where id = p_queue_id;
    when 'start' then
      if v_row.status not in ('called','skipped') then raise exception 'Call the patient before starting'; end if;
      update public.queue_entries set status = 'in_consult', started_at = now(), assigned_to = v_actor where id = p_queue_id;
    when 'complete' then
      if v_row.status not in ('in_consult','called') then raise exception 'Cannot complete from status %', v_row.status; end if;
      update public.queue_entries set status = 'completed', completed_at = now() where id = p_queue_id;
      update public.encounters set status = 'closed', closed_at = now(), closed_by = v_actor
        where id = v_row.encounter_id and status = 'open';
    when 'skip' then
      update public.queue_entries set status = 'skipped' where id = p_queue_id and status = 'waiting';
    when 'cancel' then
      update public.queue_entries set status = 'cancelled' where id = p_queue_id and status in ('waiting','called','skipped');
      update public.encounters set status = 'closed', closed_at = now(), closed_by = v_actor where id = v_row.encounter_id and status = 'open';
    else raise exception 'Unknown queue action';
  end case;
end $$;

-- ============================================================ PHARMACY
create or replace function public.dispense_prescription_item(
  p_prescription_id uuid, p_item_id uuid, p_quantity int
) returns void language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); v_role user_role;
  v_item record; v_rx record; v_med record; v_patient uuid;
begin
  select role into v_role from public.profiles where id = v_actor;
  if v_role not in ('pharmacist','admin','super_admin') then
    raise exception 'Only pharmacy staff can dispense'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'Quantity must be positive'; end if;

  select * into v_rx from public.prescriptions where id = p_prescription_id and status in ('pending','partially_dispensed') for update;
  if not found then raise exception 'Prescription not found or already fully dispensed'; end if;
  select * into v_item from public.prescription_items
    where id = p_item_id and prescription_id = p_prescription_id for update;
  if not found then raise exception 'Prescription item not found'; end if;
  if v_item.dispensed_qty + p_quantity > v_item.quantity then
    raise exception 'Cannot dispense more than prescribed (remaining: %)', v_item.quantity - v_item.dispensed_qty;
  end if;

  select * into v_med from public.medicines where id = coalesce(v_item.medicine_id,
    (select id from public.medicines where lower(name) = lower(v_item.medicine_name) and is_active limit 1)) for update;
  if v_med.id is null then raise exception 'Medicine "%" is not in the catalogue', v_item.medicine_name; end if;
  if v_med.stock_qty < p_quantity then
    raise exception 'Insufficient stock for % (available: %)', v_med.name, v_med.stock_qty;
  end if;

  select patient_id into v_patient from public.encounters where id = v_rx.encounter_id;

  update public.medicines set stock_qty = stock_qty - p_quantity where id = v_med.id;
  insert into public.dispensings (prescription_id, prescription_item_id, medicine_id, encounter_id,
    patient_id, quantity, dispensed_by)
  values (p_prescription_id, p_item_id, v_med.id, v_rx.encounter_id, v_patient, p_quantity, v_actor);
  insert into public.stock_movements (medicine_id, movement_type, quantity_change, reason, performed_by, reference_id)
  values (v_med.id, 'dispense', -p_quantity, 'Dispensed to patient', v_actor, p_item_id);
  update public.prescription_items
    set dispensed_qty = dispensed_qty + p_quantity,
        medicine_id = coalesce(medicine_id, v_med.id)
    where id = p_item_id;
  update public.prescriptions set status =
    case when exists (
      select 1 from public.prescription_items where prescription_id = p_prescription_id
      and dispensed_qty < quantity) then 'partially_dispensed' else 'dispensed' end
    where id = p_prescription_id;

  if v_patient is not null then
    insert into public.notifications (user_id, title, body, type)
    select profile_id, 'Medicines dispensed', 'Your medicines are ready. Collected at the pharmacy.', 'pharmacy'
    from public.patients where id = v_patient and profile_id is not null;
  end if;
  perform public.refresh_stock_alerts(v_med.id);
end $$;

create or replace function public.receive_stock(
  p_medicine_id uuid, p_quantity int, p_batch_no text default null,
  p_expiry_date date default null, p_reason text default 'Stock receipt'
) returns void language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); v_role user_role;
begin
  select role into v_role from public.profiles where id = v_actor;
  if v_role not in ('pharmacist','admin','super_admin') then raise exception 'Not permitted'; end if;
  if p_quantity <= 0 then raise exception 'Quantity must be positive'; end if;
  update public.medicines set stock_qty = stock_qty + p_quantity where id = p_medicine_id;
  insert into public.stock_movements (medicine_id, movement_type, quantity_change, batch_no,
    expiry_date, reason, performed_by)
  values (p_medicine_id, 'receipt', p_quantity, p_batch_no, p_expiry_date, p_reason, v_actor);
  perform public.refresh_stock_alerts(p_medicine_id);
end $$;

create or replace function public.correct_stock(
  p_medicine_id uuid, p_new_qty int, p_reason text
) returns void language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); v_role user_role; v_old int;
begin
  if p_reason is null or length(trim(p_reason)) < 5 then
    raise exception 'A correction reason is required'; end if;
  select role into v_role from public.profiles where id = v_actor;
  if v_role not in ('pharmacist','admin','super_admin') then raise exception 'Not permitted'; end if;
  if p_new_qty < 0 then raise exception 'Stock cannot be negative'; end if;
  select stock_qty into v_old from public.medicines where id = p_medicine_id for update;
  update public.medicines set stock_qty = p_new_qty where id = p_medicine_id;
  insert into public.stock_movements (medicine_id, movement_type, quantity_change, reason, performed_by)
  values (p_medicine_id, 'correction', p_new_qty - v_old, p_reason, v_actor);
  perform public.refresh_stock_alerts(p_medicine_id);
end $$;

-- Automated stock level detection from real usage
create or replace function public.refresh_stock_alerts(p_medicine_id uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare m record; v_usage numeric; v_level alert_level; v_days numeric;
begin
  for m in
    select * from public.medicines
    where is_active and (p_medicine_id is null or id = p_medicine_id)
  loop
    select coalesce(sum(-quantity_change) / 14.0, 0) into v_usage
    from public.stock_movements
    where medicine_id = m.id and movement_type = 'dispense' and created_at > now() - interval '14 days';

    v_level := case
      when m.stock_qty = 0 then 'out_of_stock'::alert_level
      when m.stock_qty <= m.critical_level then 'critical'::alert_level
      when m.stock_qty <= m.reorder_level then 'low'::alert_level
      else null end;

    v_days := case when v_usage > 0 then round(m.stock_qty / v_usage, 1) end;

    -- resolve stale alerts for this medicine
    update public.stock_alerts set status = 'resolved'
    where medicine_id = m.id and status = 'open' and (v_level is null or alert_level <> v_level);

    if v_level is not null then
      insert into public.stock_alerts (medicine_id, alert_level, stock_qty, usage_per_day, days_remaining)
      values (m.id, v_level, m.stock_qty, v_usage, v_days)
      on conflict (medicine_id, alert_level) where status = 'open'
      do update set stock_qty = excluded.stock_qty, usage_per_day = excluded.usage_per_day,
                    days_remaining = excluded.days_remaining, created_at = now();
    end if;
  end loop;
end $$;
grant execute on function public.refresh_stock_alerts to authenticated;

create or replace function public.acknowledge_alert(p_alert_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.stock_alerts set status = 'acknowledged', acknowledged_by = auth.uid()
  where id = p_alert_id and status = 'open';
$$;

-- ============================================================ PURCHASE REQUESTS
create or replace function public.create_purchase_request(p_notes text default null, p_items jsonb)
returns public.purchase_requests language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); v_role user_role; v_req public.purchase_requests; v_item jsonb;
begin
  select role into v_role from public.profiles where id = v_actor;
  if v_role not in ('pharmacist','admin','super_admin') then raise exception 'Not permitted'; end if;
  if jsonb_array_length(p_items) = 0 then raise exception 'Add at least one medicine to the request'; end if;

  insert into public.purchase_requests (request_number, created_by, notes)
  values ('PR-' || to_char(now(),'YYYYMMDD') || '-' || upper(substr(encode(gen_random_bytes(2),'hex'),1,4)), v_actor, p_notes)
  returning * into v_req;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into public.purchase_request_items (request_id, medicine_id, quantity_requested, supplier_id)
    values (v_req.id, (v_item->>'medicine_id')::uuid, (v_item->>'quantity')::int,
            nullif(v_item->>'supplier_id','')::uuid);
  end loop;
  return v_req;
end $$;

create or replace function public.decide_purchase_request(
  p_request_id uuid, p_approve boolean, p_reason text default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); v_role user_role;
begin
  select role into v_role from public.profiles where id = v_actor;
  if v_role not in ('hospital_head','admin','super_admin') then
    raise exception 'Only management can approve or reject purchase requests'; end if;
  update public.purchase_requests
  set status = case when p_approve then 'approved' else 'rejected' end,
      decided_by = v_actor, decided_at = now(), decision_reason = p_reason
  where id = p_request_id and status = 'submitted';
  if not found then raise exception 'Request not found or already decided'; end if;
end $$;

create or replace function public.mark_purchase_received(p_request_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); v_role user_role; v_it record;
begin
  select role into v_role from public.profiles where id = v_actor;
  if v_role not in ('pharmacist','admin','super_admin') then raise exception 'Not permitted'; end if;
  update public.purchase_requests set status = 'received'
    where id = p_request_id and status = 'approved';
  if not found then raise exception 'Request not found or not approved'; end if;
  for v_it in
    select i.medicine_id, coalesce(i.quantity_approved, i.quantity_requested) as qty
    from public.purchase_request_items i where i.request_id = p_request_id
  loop
    perform public.receive_stock(v_it.medicine_id, v_it.qty, null, null, 'Purchase request received');
  end loop;
end $$;

-- ============================================================ EMERGENCY
create or replace function public.create_emergency_case(
  p_caller_name text, p_caller_phone text, p_location text, p_description text,
  p_priority triage_priority default 'serious', p_patient_id uuid default null
) returns public.emergency_cases language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); v_role user_role; v_row public.emergency_cases; v_seq int;
begin
  if v_actor is not null then
    select role into v_role from public.profiles where id = v_actor;
  end if;
  perform pg_advisory_xact_lock(hashtext('emergency_case'));
  select coalesce(max(substring(case_number from '\d+$')::int), 0) + 1 into v_seq
  from public.emergency_cases where case_number like 'EM-' || to_char(now(),'YYYY') || '-%';
  insert into public.emergency_cases (case_number, caller_name, caller_phone, location, description,
    priority, patient_id, created_by)
  values ('EM-' || to_char(now(),'YYYY') || '-' || lpad(v_seq::text, 4, '0'),
    p_caller_name, p_caller_phone, p_location, p_description, p_priority, p_patient_id, v_actor)
  returning * into v_row;
  return v_row;
end $$;
grant execute on function public.create_emergency_case to anon, authenticated;

create or replace function public.update_emergency_case(
  p_case_id uuid, p_action text, p_staff_id uuid default null, p_triage_notes text default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); v_role user_role;
begin
  if not public.is_staff() then raise exception 'Not permitted'; end if;
  case p_action
    when 'respond' then
      update public.emergency_cases set status = 'responding', assigned_to = coalesce(p_staff_id, v_actor),
        triage_notes = coalesce(p_triage_notes, triage_notes), updated_at = now()
        where id = p_case_id and status = 'open';
    when 'handover' then
      update public.emergency_cases set status = 'handed_over', handed_over_to = p_staff_id,
        handed_over_at = now(), updated_at = now()
        where id = p_case_id and status in ('open','responding');
    when 'close' then
      update public.emergency_cases set status = 'closed', closed_at = now(), updated_at = now()
        where id = p_case_id and status in ('open','responding','handed_over');
    else raise exception 'Unknown emergency action';
  end case;
  if not found then raise exception 'Case not found or status does not allow this action'; end if;
end $$;

-- ============================================================ STAFF ATTENDANCE
create or replace function public.staff_check_in(p_shift_id uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); v_late boolean; v_sched timestamptz;
begin
  if v_actor is null then raise exception 'Sign in first'; end if;
  if p_shift_id is not null then
    select starts_at into v_sched from public.shifts where id = p_shift_id and staff_id = v_actor;
    v_late := v_sched is not null and now() > v_sched + interval '15 minutes';
  end if;
  insert into public.attendance (staff_id, shift_id, work_date, check_in_at, status)
  values (v_actor, p_shift_id, current_date, now(), case when v_late then 'late' else 'present' end)
  on conflict (staff_id, work_date) do update
    set check_in_at = now(), status = case when v_late then 'late' else 'present' end;
end $$;

create or replace function public.staff_check_out()
returns void language sql security definer set search_path = public as $$
  update public.attendance set check_out_at = now(), status = 'present'
  where staff_id = auth.uid() and work_date = current_date and check_out_at is null;
$$;

create or replace function public.create_handover(
  p_summary text, p_open_cases_note text, p_to_staff_id uuid default null
) returns void language sql security definer set search_path = public as $$
  insert into public.handovers (from_staff_id, to_staff_id, from_shift_type, to_shift_type, summary, open_cases_note)
  select auth.uid(), p_to_staff_id, s.shift_type, null, p_summary, p_open_cases_note
  from (select shift_type from public.shifts
        where staff_id = auth.uid() and now() between starts_at and ends_at limit 1) s;
$$;

-- ============================================================ NOTIFICATIONS HELPER
create or replace function public.notify_user(p_user_id uuid, p_title text, p_body text, p_type text default 'info', p_link text default null)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, title, body, type, link) values (p_user_id, p_title, p_body, p_type, p_link);
$$;
