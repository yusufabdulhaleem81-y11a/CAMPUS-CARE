import { Router } from 'express';
import { z } from 'zod';
import { authRequired, fail, from, roleRequired, rpc } from '../middleware.js';

export const pharmacyRouter = Router();
pharmacyRouter.use(authRequired);

const PHARM = roleRequired('pharmacist', 'admin', 'super_admin');
const MGMT = roleRequired('hospital_head', 'admin', 'super_admin');

pharmacyRouter.get('/medicines', async (req, res) => {
  const { data, error } = await from(req, 'medicines').select('*').order('name');
  if (error) return fail(res, error, 500);
  res.json(data);
});

pharmacyRouter.post('/medicines', PHARM, async (req, res) => {
  try {
    const body = z.object({
      name: z.string().min(2), category: z.string().optional(),
      unit: z.string().default('tablet'), reorder_level: z.number().int().min(0).default(20),
      critical_level: z.number().int().min(0).default(5),
    }).parse(req.body);
    const { data, error } = await from(req, 'medicines').insert(body).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (e) {
    fail(res, e, e instanceof z.ZodError ? 422 : 400);
  }
});

pharmacyRouter.get('/movements', async (req, res) => {
  const { data, error } = await from(req, 'stock_movements')
    .select('*, medicines(name), profiles(full_name)')
    .order('created_at', { ascending: false }).limit(200);
  if (error) return fail(res, error, 500);
  res.json(data);
});

pharmacyRouter.post('/dispense', PHARM, async (req, res) => {
  try {
    const body = z.object({
      prescription_id: z.string().uuid(),
      item_id: z.string().uuid(),
      quantity: z.number().int().min(1),
    }).parse(req.body);
    const { error } = await rpc(req, 'dispense_prescription_item', {
      p_prescription_id: body.prescription_id, p_item_id: body.item_id, p_quantity: body.quantity,
    });
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, e instanceof z.ZodError ? 422 : 400);
  }
});

pharmacyRouter.post('/stock/receive', PHARM, async (req, res) => {
  try {
    const body = z.object({
      medicine_id: z.string().uuid(),
      quantity: z.number().int().min(1),
      batch_no: z.string().optional(),
      expiry_date: z.string().optional(),
    }).parse(req.body);
    const { error } = await rpc(req, 'receive_stock', {
      p_medicine_id: body.medicine_id, p_quantity: body.quantity,
      p_batch_no: body.batch_no || null, p_expiry_date: body.expiry_date || null,
    });
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, e instanceof z.ZodError ? 422 : 400);
  }
});

pharmacyRouter.post('/stock/correct', PHARM, async (req, res) => {
  try {
    const body = z.object({
      medicine_id: z.string().uuid(),
      new_qty: z.number().int().min(0),
      reason: z.string().min(5, 'A reason of at least 5 characters is required'),
    }).parse(req.body);
    const { error } = await rpc(req, 'correct_stock', {
      p_medicine_id: body.medicine_id, p_new_qty: body.new_qty, p_reason: body.reason,
    });
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, e instanceof z.ZodError ? 422 : 400);
  }
});

pharmacyRouter.get('/alerts', async (req, res) => {
  const { data, error } = await from(req, 'stock_alerts')
    .select('*, medicines(name, unit, reorder_level, critical_level)')
    .in('status', ['open', 'acknowledged']).order('created_at', { ascending: false });
  if (error) return fail(res, error, 500);
  res.json(data);
});

pharmacyRouter.post('/alerts/:id/acknowledge', PHARM, async (req, res) => {
  const { error } = await rpc(req, 'acknowledge_alert', { p_alert_id: req.params.id });
  if (error) return fail(res, error);
  res.json({ ok: true });
});

// ---------------- Purchase requests ----------------

pharmacyRouter.get('/purchase-requests', async (req, res) => {
  const { data, error } = await from(req, 'purchase_requests')
    .select('*, purchase_request_items(*, medicines(name, unit), suppliers(name)), profiles(full_name)')
    .order('created_at', { ascending: false });
  if (error) return fail(res, error, 500);
  res.json(data);
});

pharmacyRouter.post('/purchase-requests', PHARM, async (req, res) => {
  try {
    const body = z.object({
      notes: z.string().optional(),
      items: z.array(z.object({
        medicine_id: z.string().uuid(),
        quantity: z.number().int().min(1),
        supplier_id: z.string().uuid().optional(),
      })).min(1, 'Add at least one medicine'),
    }).parse(req.body);
    const { data, error } = await rpc(req, 'create_purchase_request', {
      p_notes: body.notes ?? null,
      p_items: body.items.map((i) => ({ medicine_id: i.medicine_id, quantity: i.quantity, supplier_id: i.supplier_id ?? '' })),
    });
    if (error) throw error;
    res.status(201).json(data);
  } catch (e) {
    fail(res, e, e instanceof z.ZodError ? 422 : 400);
  }
});

pharmacyRouter.post('/purchase-requests/:id/decide', MGMT, async (req, res) => {
  try {
    const body = z.object({ approve: z.boolean(), reason: z.string().optional() }).parse(req.body);
    const { error } = await rpc(req, 'decide_purchase_request', {
      p_request_id: req.params.id, p_approve: body.approve, p_reason: body.reason ?? null,
    });
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, e instanceof z.ZodError ? 422 : 400);
  }
});

pharmacyRouter.post('/purchase-requests/:id/receive', PHARM, async (req, res) => {
  const { error } = await rpc(req, 'mark_purchase_received', { p_request_id: req.params.id });
  if (error) return fail(res, error);
  res.json({ ok: true });
});

pharmacyRouter.get('/suppliers', async (req, res) => {
  const { data, error } = await from(req, 'suppliers').select('*').order('name');
  if (error) return fail(res, error, 500);
  res.json(data);
});

pharmacyRouter.post('/suppliers', PHARM, async (req, res) => {
  try {
    const body = z.object({
      name: z.string().min(2), contact_person: z.string().optional(),
      phone: z.string().optional(), email: z.string().email().optional(),
      address: z.string().optional(),
    }).parse(req.body);
    const { data, error } = await from(req, 'suppliers').insert(body).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (e) {
    fail(res, e, e instanceof z.ZodError ? 422 : 400);
  }
});

// Prescriptions ready for dispensing
pharmacyRouter.get('/prescriptions/pending', async (req, res) => {
  const { data, error } = await from(req, 'prescriptions')
    .select('*, prescription_items(*), patients(unit_number, full_name), encounters(id), profiles(full_name)')
    .in('status', ['pending', 'partially_dispensed'])
    .order('created_at', { ascending: true });
  if (error) return fail(res, error, 500);
  res.json(data);
});

pharmacyRouter.get('/dispensing-history', async (req, res) => {
  const { data, error } = await from(req, 'dispensings')
    .select('*, medicines(name), patients(unit_number, full_name), profiles(full_name), prescription_items(dosage, frequency)')
    .order('dispensed_at', { ascending: false }).limit(200);
  if (error) return fail(res, error, 500);
  res.json(data);
});
