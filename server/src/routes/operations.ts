import { Router } from 'express';
import { z } from 'zod';
import { admin } from '../supabase.js';
import { authRequired, fail, from, roleRequired, rpc } from '../middleware.js';

export const operationsRouter = Router();
operationsRouter.use(authRequired);

const MGMT = roleRequired('hospital_head', 'admin', 'super_admin');
const STAFF_ROLES = roleRequired('receptionist', 'nurse', 'doctor', 'laboratory', 'pharmacist', 'admin', 'super_admin', 'hospital_head');

// ============================================================ SHIFTS / ROSTERS

operationsRouter.get('/shifts', async (req, res) => {
  try {
    const fromDate = String(req.query.from ?? new Date().toISOString().slice(0, 10));
    const toDate = String(req.query.to ?? fromDate);
    const { data, error } = await from(req, 'shifts')
      .select('*, profiles(full_name, role, staff_id)')
      .gte('shift_date', fromDate).lte('shift_date', toDate)
      .order('starts_at');
    if (error) throw error;
    res.json(data);
  } catch (e) {
    fail(res, e, 500);
  }
});

operationsRouter.post('/shifts', MGMT, async (req, res) => {
  try {
    const body = z.object({
      staff_id: z.string().uuid(),
      shift_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      shift_type: z.enum(['morning', 'afternoon', 'night']),
      starts_at: z.string(),
      ends_at: z.string(),
      department: z.string().default('clinic'),
      is_emergency_responsible: z.boolean().default(false),
      notes: z.string().optional(),
    }).parse(req.body);
    const { data, error } = await from(req, 'shifts').insert(body).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (e) {
    fail(res, e, e instanceof z.ZodError ? 422 : 400);
  }
});

/** Who is on duty right now + who is responsible for emergency response. */
operationsRouter.get('/on-duty', STAFF_ROLES, async (req, res) => {
  try {
    const { data, error } = await from(req, 'shifts')
      .select('*, profiles(full_name, role, staff_id)')
      .lte('starts_at', new Date().toISOString())
      .gte('ends_at', new Date().toISOString());
    if (error) throw error;
    res.json({
      onDuty: data,
      emergencyResponsible: data?.find((s: { is_emergency_responsible: boolean }) => s.is_emergency_responsible) ?? null,
    });
  } catch (e) {
    fail(res, e, 500);
  }
});

// ============================================================ ATTENDANCE

operationsRouter.post('/attendance/check-in', STAFF_ROLES, async (req, res) => {
  const { error } = await rpc(req, 'staff_check_in', { p_shift_id: req.body?.shift_id ?? null });
  if (error) return fail(res, error);
  res.json({ ok: true });
});

operationsRouter.post('/attendance/check-out', STAFF_ROLES, async (req, res) => {
  const { error } = await rpc(req, 'staff_check_out');
  if (error) return fail(res, error);
  res.json({ ok: true });
});

operationsRouter.get('/attendance', MGMT, async (req, res) => {
  const date = String(req.query.date ?? new Date().toISOString().slice(0, 10));
  const { data, error } = await from(req, 'attendance')
    .select('*, profiles(full_name, role, staff_id)')
    .eq('work_date', date)
    .order('check_in_at', { ascending: false });
  if (error) return fail(res, error, 500);
  res.json(data);
});

// ============================================================ HANDOVER

operationsRouter.get('/handovers', STAFF_ROLES, async (req, res) => {
  const { data, error } = await from(req, 'handovers')
    .select('*, profiles(full_name)')
    .order('created_at', { ascending: false }).limit(50);
  if (error) return fail(res, error, 500);
  res.json(data);
});

operationsRouter.post('/handovers', STAFF_ROLES, async (req, res) => {
  try {
    const body = z.object({
      summary: z.string().min(5, 'Handover summary is required'),
      open_cases_note: z.string().min(3, 'Note the open cases for the next team'),
      to_staff_id: z.string().uuid().optional(),
    }).parse(req.body);
    const { error } = await rpc(req, 'create_handover', {
      p_summary: body.summary, p_open_cases_note: body.open_cases_note,
      p_to_staff_id: body.to_staff_id ?? null,
    });
    if (error) throw error;
    res.status(201).json({ ok: true });
  } catch (e) {
    fail(res, e, e instanceof z.ZodError ? 422 : 400);
  }
});

// ============================================================ EMERGENCY

operationsRouter.post('/emergency', async (req, res) => {
  try {
    const body = z.object({
      caller_name: z.string().min(2, 'Caller name is required'),
      caller_phone: z.string().min(5, 'Phone number is required'),
      location: z.string().min(2, 'Location is required'),
      description: z.string().min(5, 'Describe the emergency'),
      priority: z.enum(['critical', 'serious', 'minor']).default('serious'),
      patient_id: z.string().uuid().optional(),
    }).parse(req.body);
    const { data, error } = await rpc(req, 'create_emergency_case', {
      p_caller_name: body.caller_name, p_caller_phone: body.caller_phone,
      p_location: body.location, p_description: body.description,
      p_priority: body.priority, p_patient_id: body.patient_id ?? null,
    });
    if (error) throw error;
    await notifyEmergencyDesk(data);
    res.status(201).json(data);
  } catch (e) {
    fail(res, e, e instanceof z.ZodError ? 422 : 400);
  }
});

async function notifyEmergencyDesk(c: { priority: string; case_number: string }) {
  const { data: staff } = await admin.from('profiles')
    .select('id').in('role', ['nurse', 'doctor', 'admin']);
  if (staff?.length) {
    await admin.from('notifications').insert(staff.map((s: { id: string }) => ({
      user_id: s.id,
      title: `Emergency ${c.priority.toUpperCase()} — ${c.case_number}`,
      body: 'A new emergency case was filed. Open the emergency board.',
      type: 'emergency', link: '/emergency',
    })));
  }
}

operationsRouter.get('/emergency', STAFF_ROLES, async (req, res) => {
  const status = req.query.status as string | undefined;
  let query = from(req, 'emergency_cases')
    .select('*, patients(unit_number, full_name), profiles!emergency_cases_assigned_to_fkey(full_name), profiles!emergency_cases_handed_over_to_fkey(full_name)')
    .order('created_at', { ascending: false }).limit(100);
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) return fail(res, error, 500);
  res.json(data);
});

operationsRouter.get('/emergency/mine', async (req, res) => {
  const { data, error } = await from(req, 'emergency_cases')
    .select('case_number, status, priority, location, description, created_at')
    .eq('created_by', req.userId!).order('created_at', { ascending: false }).limit(20);
  if (error) return fail(res, error, 500);
  res.json(data);
});

operationsRouter.post('/emergency/:id/:action', STAFF_ROLES, async (req, res) => {
  try {
    const action = z.enum(['respond', 'handover', 'close']).parse(req.params.action);
    const body = z.object({
      staff_id: z.string().uuid().optional(),
      triage_notes: z.string().optional(),
    }).parse(req.body ?? {});
    const { error } = await rpc(req, 'update_emergency_case', {
      p_case_id: req.params.id, p_action: action,
      p_staff_id: body.staff_id ?? null, p_triage_notes: body.triage_notes ?? null,
    });
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, e instanceof z.ZodError ? 422 : 400);
  }
});

// Staff directory for roster management (management roles)
operationsRouter.get('/staff-directory', MGMT, async (_req, res) => {
  const { data, error } = await admin.from('profiles')
    .select('id, full_name, role, staff_id')
    .neq('role', 'student')
    .order('full_name');
  if (error) return fail(res, error, 500);
  res.json(data);
});
