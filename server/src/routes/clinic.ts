import { Router } from 'express';
import { z } from 'zod';
import { admin } from '../supabase.js';
import { authRequired, fail, from, roleRequired, rpc } from '../middleware.js';

export const clinicRouter = Router();
clinicRouter.use(authRequired);

// ============================================================ PATIENTS

const registerSchema = z.object({
  full_name: z.string().min(3, 'Full name is required'),
  category: z.enum(['student', 'university_staff', 'external']).default('external'),
  phone: z.string().optional().nullable(),
  sex: z.enum(['male', 'female']).optional().nullable(),
  date_of_birth: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  blood_group: z.string().optional().nullable(),
  allergies: z.string().optional().nullable(),
  chronic_conditions: z.string().optional().nullable(),
  next_of_kin_name: z.string().optional().nullable(),
  next_of_kin_phone: z.string().optional().nullable(),
  next_of_kin_relationship: z.string().optional().nullable(),
  university_id: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
});

clinicRouter.post('/patients', roleRequired('receptionist', 'nurse', 'doctor', 'admin', 'super_admin'), async (req, res) => {
  try {
    const body = registerSchema.parse(req.body);
    const { data, error } = await rpc(req, 'register_patient', {
      p_full_name: body.full_name, p_category: body.category,
      p_phone: body.phone || null, p_sex: body.sex || null,
      p_date_of_birth: body.date_of_birth || null, p_address: body.address || null,
      p_blood_group: body.blood_group || null, p_allergies: body.allergies || null,
      p_chronic_conditions: body.chronic_conditions || null,
      p_next_of_kin_name: body.next_of_kin_name || null, p_next_of_kin_phone: body.next_of_kin_phone || null,
      p_next_of_kin_relationship: body.next_of_kin_relationship || null,
      p_university_id: body.university_id?.toUpperCase() || null, p_department: body.department || null,
    });
    if (error) throw error;
    res.status(201).json(data);
  } catch (e) {
    fail(res, e, e instanceof z.ZodError ? 422 : 400);
  }
});

/** Search by Unit Number, university ID, phone, or name. */
clinicRouter.get('/patients/search', roleRequired('receptionist', 'nurse', 'doctor', 'laboratory', 'pharmacist', 'admin', 'super_admin', 'hospital_head'), async (req, res) => {
  try {
    const q = String(req.query.q ?? '').trim();
    if (q.length < 2) return res.json([]);
    const like = `%${q}%`;
    const { data, error } = await from(req, 'patients')
      .select('id, unit_number, full_name, category, university_id, phone, sex, date_of_birth, is_verified')
      // Quote each value: search terms may contain PostgREST delimiters (comma, slash, parenthesis)
      .or(`unit_number.ilike."${like}",university_id.ilike."${like}",phone.ilike."${like}",full_name.ilike."${like}"`)
      .limit(20);
    if (error) throw error;
    res.json(data);
  } catch (e) {
    fail(res, e);
  }
});

/** Full longitudinal patient file: identity + encounters + clinical records. */
clinicRouter.get('/patients/:id', async (req, res) => {
  try {
    const db = from(req, 'patients');
    const { data: patient, error } = await db.select('*').eq('id', req.params.id).single();
    if (error) return res.status(404).json({ error: 'Patient file not found' });

    const [encounters, appointments, diagnoses, prescriptions, labs, dispensings] = await Promise.all([
      from(req, 'encounters').select('*').eq('patient_id', patient.id).order('opened_at', { ascending: false }),
      from(req, 'appointments').select('id, reference, appointment_date, start_time, end_time, service, status, doctor_id')
        .eq('patient_id', patient.id).order('appointment_date', { ascending: false }),
      from(req, 'diagnoses').select('*').eq('patient_id', patient.id).order('diagnosed_at', { ascending: false }),
      from(req, 'prescriptions').select('*, prescription_items(*)').eq('patient_id', patient.id).order('created_at', { ascending: false }),
      from(req, 'lab_orders').select('*, lab_tests(name, code), lab_results(*)').eq('patient_id', patient.id).order('ordered_at', { ascending: false }),
      from(req, 'dispensings').select('*, medicines(name), prescription_items(dosage, frequency)').eq('patient_id', patient.id).order('dispensed_at', { ascending: false }),
    ]);
    res.json({ patient, encounters: encounters.data ?? [], appointments: appointments.data ?? [],
      diagnoses: diagnoses.data ?? [], prescriptions: prescriptions.data ?? [],
      labs: labs.data ?? [], dispensings: dispensings.data ?? [] });
  } catch (e) {
    fail(res, e, 500);
  }
});

/** Patient timeline across all sources, ordered newest first. */
clinicRouter.get('/patients/:id/timeline', async (req, res) => {
  try {
    const pid = req.params.id;
    const [enc, dx, rx, labs, disp] = await Promise.all([
      from(req, 'encounters').select('*').eq('patient_id', pid).order('opened_at', { ascending: false }).limit(50),
      from(req, 'diagnoses').select('*').eq('patient_id', pid).order('diagnosed_at', { ascending: false }).limit(50),
      from(req, 'prescriptions').select('*, prescription_items(*)').eq('patient_id', pid).order('created_at', { ascending: false }).limit(50),
      from(req, 'lab_orders').select('*, lab_tests(name), lab_results(result_text, remarks, entered_at)').eq('patient_id', pid).order('ordered_at', { ascending: false }).limit(50),
      from(req, 'dispensings').select('*, medicines(name)').eq('patient_id', pid).order('dispensed_at', { ascending: false }).limit(50),
    ]);
    type Event = { at: string; kind: string; title: string; detail: string };
    const events: Event[] = [];
    for (const e of enc.data ?? []) events.push({ at: e.opened_at, kind: 'visit', title: `${e.encounter_type.replace('_', ' ')} visit opened`, detail: e.chief_complaint ?? '' });
    for (const d of dx.data ?? []) events.push({ at: d.diagnosed_at, kind: 'diagnosis', title: `Diagnosed: ${d.name}`, detail: d.code ? `Code ${d.code}` : '' });
    for (const r of rx.data ?? []) events.push({ at: r.created_at, kind: 'prescription', title: 'Prescription issued', detail: (r.prescription_items ?? []).map((i: { medicine_name: string }) => i.medicine_name).join(', ') });
    for (const l of labs.data ?? []) events.push({ at: l.ordered_at, kind: 'lab', title: `Lab test: ${l.lab_tests?.name ?? 'test'}`, detail: `Status: ${l.status}` });
    for (const d of disp.data ?? []) events.push({ at: d.dispensed_at, kind: 'dispense', title: `Dispensed: ${d.medicines?.name ?? 'medicine'}`, detail: `Qty ${d.quantity}` });
    events.sort((a, b) => b.at.localeCompare(a.at));
    res.json(events);
  } catch (e) {
    fail(res, e, 500);
  }
});

// ============================================================ APPOINTMENTS

/** Real availability: doctor schedules for a weekday minus booked slots, past times and blocks. */
clinicRouter.get('/appointments/availability', async (req, res) => {
  try {
    const doctorId = z.string().uuid().parse(req.query.doctorId);
    const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(req.query.date);
    const dow = new Date(date + 'T00:00:00').getDay();

    const [schedules, booked, blocks, doctorRow] = await Promise.all([
      from(req, 'doctor_schedules').select('*').eq('doctor_id', doctorId).eq('weekday', dow).eq('is_active', true),
      from(req, 'appointments').select('start_time').eq('doctor_id', doctorId).eq('appointment_date', date).eq('status', 'booked'),
      from(req, 'schedule_blocks').select('start_time, end_time').eq('doctor_id', doctorId).eq('block_date', date),
      from(req, 'doctors').select('slot_minutes, is_accepting_appointments').eq('profile_id', doctorId).single(),
    ]);
    if (!doctorRow.data?.is_accepting_appointments) return res.json({ slots: [] });

    const taken = new Set((booked.data ?? []).map((b: { start_time: string }) => b.start_time.slice(0, 5)));
    const slots: { time: string; available: boolean }[] = [];
    for (const s of schedules.data ?? []) {
      const [sh, sm] = s.start_time.split(':').map(Number);
      const [eh, em] = s.end_time.split(':').map(Number);
      for (let m = sh * 60 + sm; m + s.slot_minutes <= eh * 60 + em; m += s.slot_minutes) {
        const time = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
        const blocked = (blocks.data ?? []).some((b: { start_time: string | null; end_time: string | null }) =>
          !b.start_time || (b.start_time.slice(0, 5) < `${String(Math.floor((m + s.slot_minutes) / 60)).padStart(2, '0')}:${String((m + s.slot_minutes) % 60).padStart(2, '0')}`
            && (b.end_time?.slice(0, 5) ?? '23:59') > time));
        slots.push({ time, available: !taken.has(time) && !blocked });
      }
    }
    res.json({ slots });
  } catch (e) {
    fail(res, e, e instanceof z.ZodError ? 422 : 400);
  }
});

const bookSchema = z.object({
  patient_id: z.string().uuid(),
  doctor_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  service: z.string().default('General consultation'),
});

clinicRouter.post('/appointments', async (req, res) => {
  try {
    const body = bookSchema.parse(req.body);
    const { data, error } = await rpc(req, 'book_appointment', {
      p_patient_id: body.patient_id, p_doctor_id: body.doctor_id,
      p_date: body.date, p_start_time: body.time, p_service: body.service,
    });
    if (error) throw error;
    res.status(201).json(data);
  } catch (e) {
    fail(res, e, e instanceof z.ZodError ? 422 : 400);
  }
});

clinicRouter.get('/appointments', roleRequired('receptionist', 'doctor', 'nurse', 'admin', 'super_admin', 'hospital_head'), async (req, res) => {
  try {
    const date = String(req.query.date ?? new Date().toISOString().slice(0, 10));
    let query = from(req, 'appointments')
      .select('*, patients(unit_number, full_name, phone), doctors(profiles(full_name))')
      .eq('appointment_date', date)
      .order('start_time');
    if (req.profile!.role === 'doctor' && req.query.mine === 'true') {
      query = query.eq('doctor_id', req.userId!);
    }
    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (e) {
    fail(res, e, 500);
  }
});

clinicRouter.post('/appointments/:id/cancel', async (req, res) => {
  try {
    const { error } = await rpc(req, 'cancel_appointment', {
      p_appointment_id: req.params.id, p_reason: req.body?.reason ?? null,
    });
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    fail(res, e);
  }
});

clinicRouter.get('/doctors', async (req, res) => {
  try {
    const { data, error } = await from(req, 'doctors')
      .select('profile_id, specialty, slot_minutes, is_accepting_appointments, profiles(full_name)')
      .eq('is_accepting_appointments', true);
    if (error) throw error;
    res.json(data);
  } catch (e) {
    fail(res, e, 500);
  }
});

// ============================================================ RECEPTION / QUEUE

const checkInSchema = z.object({
  patient_id: z.string().uuid(),
  encounter_type: z.enum(['walk_in', 'appointment', 'emergency']).default('walk_in'),
  chief_complaint: z.string().optional().nullable(),
  appointment_id: z.string().uuid().optional().nullable(),
});

clinicRouter.post('/check-in', roleRequired('receptionist', 'nurse', 'admin', 'super_admin'), async (req, res) => {
  try {
    const body = checkInSchema.parse(req.body);
    const { data, error } = await rpc(req, 'check_in_patient', {
      p_patient_id: body.patient_id, p_encounter_type: body.encounter_type,
      p_chief_complaint: body.chief_complaint || null, p_appointment_id: body.appointment_id || null,
    });
    if (error) throw error;
    res.status(201).json(data);
  } catch (e) {
    fail(res, e, e instanceof z.ZodError ? 422 : 400);
  }
});

clinicRouter.get('/queue', roleRequired('receptionist', 'nurse', 'doctor', 'admin', 'super_admin', 'hospital_head'), async (req, res) => {
  try {
    const { data, error } = await from(req, 'queue_entries')
      .select('*, patients(unit_number, full_name, category), encounters(id, chief_complaint, encounter_type, status, vitals(temperature_c, systolic, diastolic, pulse, spo2), nursing_assessments(assessment, escalated_to_doctor), consultations(id))')
      .eq('queue_date', String(req.query.date ?? new Date().toISOString().slice(0, 10)))
      .in('status', ['waiting', 'called', 'in_consult', 'skipped'])
      .order('priority').order('queue_number');
    if (error) throw error;
    res.json(data);
  } catch (e) {
    fail(res, e, 500);
  }
});

clinicRouter.post('/queue/:id/:action', roleRequired('receptionist', 'nurse', 'doctor', 'admin', 'super_admin'), async (req, res) => {
  try {
    const action = z.enum(['call', 'start', 'complete', 'skip', 'cancel']).parse(req.params.action);
    const { error } = await rpc(req, 'queue_transition', {
      p_queue_id: req.params.id, p_action: action,
    });
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, e instanceof z.ZodError ? 422 : 400);
  }
});

// ============================================================ CLINICAL RECORDS

const vitalsSchema = z.object({
  encounter_id: z.string().uuid(),
  temperature_c: z.number().min(30).max(45).optional(),
  systolic: z.number().int().min(50).max(260).optional(),
  diastolic: z.number().int().min(30).max(180).optional(),
  pulse: z.number().int().min(30).max(230).optional(),
  resp_rate: z.number().int().min(5).max(80).optional(),
  spo2: z.number().int().min(40).max(100).optional(),
  weight_kg: z.number().min(1).max(400).optional(),
  height_cm: z.number().min(30).max(250).optional(),
  notes: z.string().optional(),
});

clinicRouter.post('/vitals', roleRequired('nurse', 'doctor', 'admin', 'super_admin'), async (req, res) => {
  try {
    const body = vitalsSchema.parse(req.body);
    const { data: enc } = await from(req, 'encounters').select('patient_id').eq('id', body.encounter_id).single();
    if (!enc) return res.status(404).json({ error: 'Encounter not found' });
    const { data, error } = await from(req, 'vitals').insert({
      encounter_id: body.encounter_id, patient_id: enc.patient_id,
      recorded_by: req.userId,
      temperature_c: body.temperature_c ?? null, systolic: body.systolic ?? null,
      diastolic: body.diastolic ?? null, pulse: body.pulse ?? null,
      resp_rate: body.resp_rate ?? null, spo2: body.spo2 ?? null,
      weight_kg: body.weight_kg ?? null, height_cm: body.height_cm ?? null,
      notes: body.notes ?? null,
    }).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (e) {
    fail(res, e, e instanceof z.ZodError ? 422 : 400);
  }
});

const assessmentSchema = z.object({
  encounter_id: z.string().uuid(),
  assessment: z.string().min(3, 'Assessment is required'),
  intervention: z.string().optional(),
  escalated_to_doctor: z.boolean().default(false),
});

clinicRouter.post('/nursing-assessments', roleRequired('nurse', 'doctor', 'admin', 'super_admin'), async (req, res) => {
  try {
    const body = assessmentSchema.parse(req.body);
    const { data: enc } = await from(req, 'encounters').select('patient_id').eq('id', body.encounter_id).single();
    if (!enc) return res.status(404).json({ error: 'Encounter not found' });
    const { data, error } = await from(req, 'nursing_assessments').insert({
      encounter_id: body.encounter_id, patient_id: enc.patient_id, recorded_by: req.userId,
      assessment: body.assessment, intervention: body.intervention ?? null,
      escalated_to_doctor: body.escalated_to_doctor,
    }).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (e) {
    fail(res, e, e instanceof z.ZodError ? 422 : 400);
  }
});

const consultSchema = z.object({
  encounter_id: z.string().uuid(),
  presentation: z.string().min(3, 'Clinical presentation is required'),
  examination: z.string().optional(),
  treatment_plan: z.string().optional(),
  follow_up_date: z.string().optional().nullable(),
  diagnoses: z.array(z.object({ name: z.string().min(2), code: z.string().optional() })).default([]),
});

clinicRouter.post('/consultations', roleRequired('doctor', 'admin', 'super_admin'), async (req, res) => {
  try {
    const body = consultSchema.parse(req.body);
    const db = from(req, 'encounters');
    const { data: enc } = await db.select('patient_id').eq('id', body.encounter_id).single();
    if (!enc) return res.status(404).json({ error: 'Encounter not found' });

    const { data: consult, error } = await from(req, 'consultations').upsert({
      encounter_id: body.encounter_id, doctor_id: req.userId, presentation: body.presentation,
      examination: body.examination ?? null, treatment_plan: body.treatment_plan ?? null,
      follow_up_date: body.follow_up_date || null,
    }, { onConflict: 'encounter_id' }).select().single();
    if (error) throw error;

    if (body.diagnoses.length) {
      const { error: dxError } = await from(req, 'diagnoses').insert(
        body.diagnoses.map((d) => ({
          encounter_id: body.encounter_id, patient_id: enc.patient_id,
          code: d.code ?? null, name: d.name, diagnosed_by: req.userId,
        })),
      );
      if (dxError) throw dxError;
    }
    res.status(201).json(consult);
  } catch (e) {
    fail(res, e, e instanceof z.ZodError ? 422 : 400);
  }
});

const rxSchema = z.object({
  encounter_id: z.string().uuid(),
  notes: z.string().optional(),
  items: z.array(z.object({
    medicine_name: z.string().min(2),
    dosage: z.string().min(1),
    frequency: z.string().min(1),
    duration_days: z.number().int().min(1).max(365),
    quantity: z.number().int().min(1).max(1000),
  })).min(1, 'Add at least one medicine'),
});

clinicRouter.post('/prescriptions', roleRequired('doctor', 'admin', 'super_admin'), async (req, res) => {
  try {
    const body = rxSchema.parse(req.body);
    const { data: enc } = await from(req, 'encounters').select('patient_id').eq('id', body.encounter_id).single();
    if (!enc) return res.status(404).json({ error: 'Encounter not found' });

    const { data: rx, error } = await from(req, 'prescriptions').insert({
      encounter_id: body.encounter_id, patient_id: enc.patient_id, prescribed_by: req.userId,
      notes: body.notes ?? null,
    }).select().single();
    if (error) throw error;

    const { data: meds } = await admin.from('medicines').select('id, name');
    const byName = new Map((meds ?? []).map((m: { id: string; name: string }) => [m.name.toLowerCase(), m.id]));
    const { error: itemError } = await from(req, 'prescription_items').insert(
      body.items.map((i) => ({
        prescription_id: rx.id, medicine_id: byName.get(i.medicine_name.toLowerCase()) ?? null,
        medicine_name: i.medicine_name, dosage: i.dosage, frequency: i.frequency,
        duration_days: i.duration_days, quantity: i.quantity,
      })),
    );
    if (itemError) throw itemError;

    if (enc.patient_id) {
      const { data: p } = await admin.from('patients').select('profile_id').eq('id', enc.patient_id).single();
      if (p?.profile_id) {
        await admin.from('notifications').insert({
          user_id: p.profile_id, title: 'New prescription',
          body: 'Your doctor has prescribed medication. Visit the pharmacy to collect.',
          type: 'prescription',
        });
      }
    }
    res.status(201).json(rx);
  } catch (e) {
    fail(res, e, e instanceof z.ZodError ? 422 : 400);
  }
});

// ============================================================ LABORATORY

clinicRouter.get('/lab/tests', async (req, res) => {
  const { data, error } = await from(req, 'lab_tests').select('*').eq('is_active', true).order('name');
  if (error) return fail(res, error, 500);
  res.json(data);
});

clinicRouter.post('/lab/orders', roleRequired('doctor', 'nurse', 'admin', 'super_admin'), async (req, res) => {
  try {
    const body = z.object({
      encounter_id: z.string().uuid(),
      test_ids: z.array(z.string().uuid()).min(1, 'Select at least one test'),
      clinical_note: z.string().optional(),
    }).parse(req.body);
    const { data: enc } = await from(req, 'encounters').select('patient_id').eq('id', body.encounter_id).single();
    if (!enc) return res.status(404).json({ error: 'Encounter not found' });
    const { data, error } = await from(req, 'lab_orders').insert(
      body.test_ids.map((test_id) => ({
        encounter_id: body.encounter_id, patient_id: enc.patient_id,
        test_id, ordered_by: req.userId, clinical_note: body.clinical_note ?? null,
      })),
    ).select();
    if (error) throw error;

    const { data: p } = await admin.from('patients').select('profile_id').eq('id', enc.patient_id).single();
    if (p?.profile_id) {
      await admin.from('notifications').insert({
        user_id: p.profile_id, title: 'Lab test ordered',
        body: 'A laboratory test has been requested for you. Go to the lab with your clinic card.',
        type: 'lab',
      });
    }
    res.status(201).json(data);
  } catch (e) {
    fail(res, e, e instanceof z.ZodError ? 422 : 400);
  }
});

clinicRouter.get('/lab/orders', roleRequired('laboratory', 'doctor', 'admin', 'super_admin'), async (req, res) => {
  try {
    let query = from(req, 'lab_orders')
      .select('*, lab_tests(name, code, specimen_type), lab_results(*), patients(unit_number, full_name), encounters(id)')
      .order('ordered_at', { ascending: false });
    const status = req.query.status as string | undefined;
    if (status) query = query.eq('status', status);
    else if (req.profile!.role === 'laboratory') query = query.in('status', ['ordered', 'sample_collected', 'result_entered']);
    if (req.query.limit) query = query.limit(Number(req.query.limit));
    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (e) {
    fail(res, e, 500);
  }
});

clinicRouter.post('/lab/orders/:id/sample', roleRequired('laboratory', 'admin', 'super_admin'), async (req, res) => {
  const { error } = await from(req, 'lab_orders').update({ status: 'sample_collected', sample_collected_at: new Date().toISOString() })
    .eq('id', req.params.id).eq('status', 'ordered');
  if (error) return fail(res, error);
  res.json({ ok: true });
});

clinicRouter.post('/lab/orders/:id/result', roleRequired('laboratory', 'admin', 'super_admin'), async (req, res) => {
  try {
    const body = z.object({
      result_text: z.string().min(2, 'Result is required'),
      remarks: z.string().optional(),
    }).parse(req.body);
    const { data: order } = await from(req, 'lab_orders').select('status').eq('id', req.params.id).single();
    if (!order) return res.status(404).json({ error: 'Lab order not found' });
    if (!['sample_collected', 'result_entered'].includes(order.status)) {
      return res.status(400).json({ error: 'Collect the sample before entering results' });
    }
    const { error } = await from(req, 'lab_results').upsert({
      order_id: req.params.id, result_text: body.result_text, remarks: body.remarks ?? null, entered_by: req.userId,
    }, { onConflict: 'order_id' });
    if (error) throw error;
    const { error: statusError } = await from(req, 'lab_orders').update({ status: 'result_entered' }).eq('id', req.params.id);
    if (statusError) throw statusError;
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, e instanceof z.ZodError ? 422 : 400);
  }
});

clinicRouter.post('/lab/orders/:id/verify', roleRequired('laboratory', 'admin', 'super_admin'), async (req, res) => {
  try {
    const { error } = await from(req, 'lab_orders').update({ status: 'verified' })
      .eq('id', req.params.id).eq('status', 'result_entered');
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    fail(res, e);
  }
});

clinicRouter.post('/lab/orders/:id/release', roleRequired('laboratory', 'doctor', 'admin', 'super_admin'), async (req, res) => {
  try {
    const { data: order, error } = await from(req, 'lab_orders')
      .update({ status: 'released', released_at: new Date().toISOString(), released_by: req.userId })
      .eq('id', req.params.id).in('status', ['verified', 'result_entered']).select('patient_id').single();
    if (error) throw error;
    if (order) {
      const { data: p } = await admin.from('patients').select('profile_id').eq('id', order.patient_id).single();
      if (p?.profile_id) {
        await admin.from('notifications').insert({
          user_id: p.profile_id, title: 'Test result ready',
          body: 'Your test result has been released. Open Campus Care to view it.',
          type: 'lab', link: '/portal/results',
        });
      }
    }
    res.json({ ok: true });
  } catch (e) {
    fail(res, e);
  }
});

clinicRouter.get('/lab/orders/mine', async (req, res) => {
  try {
    const { data: patient } = await from(req, 'patients').select('id').eq('profile_id', req.userId!).maybeSingle();
    if (!patient) return res.json([]);
    const { data, error } = await from(req, 'lab_orders')
      .select('*, lab_tests(name, code), lab_results(result_text, remarks, entered_at)')
      .eq('patient_id', patient.id).eq('status', 'released')
      .order('released_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (e) {
    fail(res, e, 500);
  }
});

// ============================================================ PATIENT PORTAL (own data, RLS-checked)

clinicRouter.get('/patients/:id/appointments', async (req, res) => {
  try {
    const { data: patient } = await from(req, 'patients').select('id, profile_id').eq('id', req.params.id).single();
    if (!patient || (req.profile!.role === 'student' && patient.profile_id !== req.userId)) {
      return res.status(403).json({ error: 'Not your clinic file' });
    }
    const today = new Date().toISOString().slice(0, 10);
    let query = from(req, 'appointments')
      .select('id, reference, appointment_date, start_time, end_time, service, status, doctor_id')
      .eq('patient_id', patient.id).order('appointment_date', { ascending: false });
    if (req.query.upcoming === 'true') {
      query = query.gte('appointment_date', today).eq('status', 'booked');
    }
    const { data, error } = await query;
    if (error) throw error;
    res.json(data ?? []);
  } catch (e) {
    fail(res, e, 500);
  }
});

clinicRouter.get('/patients/:id/visits', async (req, res) => {
  try {
    const { data: patient } = await from(req, 'patients').select('id, profile_id').eq('id', req.params.id).single();
    if (!patient || (req.profile!.role === 'student' && patient.profile_id !== req.userId)) {
      return res.status(403).json({ error: 'Not your clinic file' });
    }
    const [encounters, prescriptions, dispensings] = await Promise.all([
      from(req, 'encounters').select('*').eq('patient_id', patient.id).order('opened_at', { ascending: false }).limit(50),
      from(req, 'prescriptions').select('*, prescription_items(*)').eq('patient_id', patient.id).order('created_at', { ascending: false }).limit(50),
      from(req, 'dispensings').select('*, medicines(name), prescription_items(dosage, frequency)').eq('patient_id', patient.id).order('dispensed_at', { ascending: false }).limit(100),
    ]);
    res.json({
      encounters: encounters.data ?? [],
      prescriptions: prescriptions.data ?? [],
      dispensings: dispensings.data ?? [],
    });
  } catch (e) {
    fail(res, e, 500);
  }
});

clinicRouter.post('/appointments/:id/cancel-own', async (req, res) => {
  try {
    const { error } = await rpc(req, 'cancel_appointment', {
      p_appointment_id: req.params.id, p_reason: 'Cancelled by patient',
    });
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    fail(res, e);
  }
});

// ============================================================ ENCOUNTER WORKSPACE

clinicRouter.get('/encounters/:id', async (req, res) => {
  try {
    const { data: encounter, error } = await from(req, 'encounters').select('*').eq('id', req.params.id).single();
    if (error || !encounter) return res.status(404).json({ error: 'Encounter not found' });
    const { data: patient, error: patientError } = await from(req, 'patients')
      .select('id, unit_number, full_name, allergies, chronic_conditions, blood_group, date_of_birth, sex')
      .eq('id', encounter.patient_id).single();
    if (patientError) throw patientError;

    const [vitals, nursing, consultation, diagnoses, prescriptions, labOrders] = await Promise.all([
      from(req, 'vitals').select('*').eq('encounter_id', encounter.id).order('recorded_at', { ascending: false }),
      from(req, 'nursing_assessments').select('assessment, intervention, escalated_to_doctor, recorded_at')
        .eq('encounter_id', encounter.id).order('recorded_at', { ascending: false }),
      from(req, 'consultations').select('presentation, examination, treatment_plan, follow_up_date')
        .eq('encounter_id', encounter.id).maybeSingle(),
      from(req, 'diagnoses').select('id, name, code, diagnosed_at').eq('encounter_id', encounter.id).order('diagnosed_at', { ascending: false }),
      from(req, 'prescriptions').select('id, status, created_at, prescription_items(*)')
        .eq('encounter_id', encounter.id).order('created_at', { ascending: false }),
      from(req, 'lab_orders').select('id, status, ordered_at, lab_tests(name, code)')
        .eq('encounter_id', encounter.id).order('ordered_at', { ascending: false }),
    ]);
    res.json({
      encounter, patient,
      vitals: vitals.data ?? [], nursing: nursing.data ?? [],
      consultation: consultation.data ?? null,
      diagnoses: diagnoses.data ?? [],
      prescriptions: prescriptions.data ?? [],
      labOrders: labOrders.data ?? [],
    });
  } catch (e) {
    fail(res, e, 500);
  }
});
