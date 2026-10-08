import { Router } from 'express';
import { z } from 'zod';
import { admin } from '../supabase.js';
import { authRequired, fail, from, roleRequired, rpc } from '../middleware.js';

export const adminRouter = Router();
adminRouter.use(authRequired, roleRequired('admin', 'super_admin', 'hospital_head'));

adminRouter.get('/users', roleRequired('admin', 'super_admin'), async (_req, res) => {
  const { data, error } = await admin.from('profiles')
    .select('id, full_name, role, staff_id, reg_no, email, created_at')
    .order('created_at', { ascending: false });
  if (error) return fail(res, error, 500);
  res.json(data);
});

adminRouter.get('/audit-logs', roleRequired('admin', 'super_admin', 'hospital_head'), async (req, res) => {
  let query = admin.from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(Number(req.query.limit ?? 200));
  const patientId = req.query.patientId as string | undefined;
  if (patientId) query = query.eq('patient_id', patientId);
  const actorId = req.query.actorId as string | undefined;
  if (actorId) query = query.eq('actor_id', actorId);
  const { data, error } = await query;
  if (error) return fail(res, error, 500);
  res.json(data);
});

adminRouter.get('/settings', async (req, res) => {
  const { data, error } = await from(req, 'clinic_settings').select('*').eq('id', 1).single();
  if (error) return fail(res, error, 500);
  res.json(data);
});

adminRouter.patch('/settings', roleRequired('admin', 'super_admin'), async (req, res) => {
  try {
    const body = z.object({
      clinic_name: z.string().min(2).optional(),
      emergency_phone: z.string().min(5).optional(),
      allow_open_signup: z.boolean().optional(),
      opening_time: z.string().optional(),
      closing_time: z.string().optional(),
    }).parse(req.body);
    const { data, error } = await from(req, 'clinic_settings').update(body).eq('id', 1).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) {
    fail(res, e, e instanceof z.ZodError ? 422 : 400);
  }
});

// Public clinic info (no auth needed) — used by the landing page
export const publicRouter = Router();
publicRouter.get('/clinic-info', async (_req, res) => {
  const { data } = await admin.from('clinic_settings').select('clinic_name, emergency_phone, opening_time, closing_time').eq('id', 1).single();
  res.json(data ?? { clinic_name: 'FUD Campus Care Clinic', emergency_phone: '', opening_time: '08:00', closing_time: '17:00' });
});
