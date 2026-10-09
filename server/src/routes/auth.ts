import { Router } from 'express';
import { z } from 'zod';
import { admin, anon } from '../supabase.js';
import { authRequired, fail, roleRequired, type StaffProfile } from '../middleware.js';

export const authRouter = Router();

const CLINIC_EMAIL_DOMAIN = 'clinic.local';

const idPasswordSchema = z.object({
  id: z.string().min(3, 'Enter your Reg No or Staff ID'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

/** ID-first login: students use Reg No, staff use Staff ID, plus password. */
authRouter.post('/login', async (req, res) => {
  try {
    const body = idPasswordSchema.parse(req.body);
    // IDs are case/space-insensitive: users type "FCP/CSC/24/1110", "fcp/csc/24/1110"
    // or "FCP /CSC/24/1110" interchangeably and must all match.
    const cleanId = body.id.trim().toUpperCase().replace(/\s+/g, '');
    // Quote the value: IDs like "STF/REC/007" contain "/" which is a PostgREST
    // or-filter delimiter and must not be treated as one.
    let { data: profile, error } = await admin
      .from('profiles')
      .select('id, email, full_name, role, reg_no, staff_id')
      .or(`reg_no.eq."${cleanId}",staff_id.eq."${cleanId}"`)
      .maybeSingle();
    if (error) throw error;
    // Users often type their email out of habit; accept a profile email too.
    if (!profile && cleanId.includes('@')) {
      const byEmail = await admin
        .from('profiles')
        .select('id, email, full_name, role, reg_no, staff_id')
        .eq('email', cleanId.toLowerCase())
        .maybeSingle();
      if (byEmail.error) throw byEmail.error;
      profile = byEmail.data;
    }
    if (!profile?.email) return res.status(401).json({ error: 'ID not recognized. Check with reception.' });

    const { data, error: signInError } = await anon.auth.signInWithPassword({
      email: profile.email,
      password: body.password,
    });
    if (signInError || !data.session) {
      return res.status(401).json({ error: 'Wrong ID or password' });
    }
    const safeProfile: Partial<StaffProfile> = profile;
    res.json({
      session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token },
      profile: safeProfile,
    });
  } catch (e) {
    fail(res, e, e instanceof z.ZodError ? 422 : 401);
  }
});

const selfSignupSchema = z.object({
  full_name: z.string().min(3, 'Full name is required'),
  reg_no: z.string().min(3, 'Your registration number is required'),
  email: z.string().email('A valid email is needed for password reset'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().optional(),
  department: z.string().optional(),
});

/** Student self-signup: creates auth account + student profile + clinic file. */
authRouter.post('/signup', async (req, res) => {
  try {
    const body = selfSignupSchema.parse(req.body);
    const regNo = body.reg_no.trim().toUpperCase().replace(/\s+/g, '');

    const { data: existing } = await admin
      .from('profiles')
      .select('id').eq('reg_no', regNo).maybeSingle();
    if (existing) return res.status(409).json({ error: 'This registration number already has an account' });

    // Use the student's real email as the auth identity so they can also sign in
    // with it (and receive password-reset mail). Staff accounts keep derived IDs.
    const email = body.email.toLowerCase();

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email, password: body.password, email_confirm: true,
      user_metadata: { full_name: body.full_name },
    });
    if (createError) throw createError;
    const uid = created.user!.id;

    const { error: profileError } = await admin.from('profiles').insert({
      id: uid, full_name: body.full_name, role: 'student', reg_no: regNo, email,
      phone: body.phone ?? null,
    });
    if (profileError) {
      await admin.auth.admin.deleteUser(uid);
      throw profileError;
    }

    // Clinic file with a real Unit Number (register_patient needs a staff session,
    // so the privileged server generates the number and inserts directly)
    const { data: unitNumber, error: unitError } = await admin.rpc('generate_unit_number');
    if (unitError || !unitNumber) throw unitError;
    const { data: patientRow, error: patientError } = await admin
      .from('patients')
      .insert({
        profile_id: uid, category: 'student', unit_number: unitNumber, full_name: body.full_name,
        phone: body.phone ?? null, university_id: regNo, department: body.department ?? null,
      })
      .select()
      .single();
    if (patientError) throw patientError;

    const { data: session } = await anon.auth.signInWithPassword({ email, password: body.password });
    res.status(201).json({
      session: session
        ? { access_token: session.session!.access_token, refresh_token: session.session!.refresh_token }
        : null,
      profile: { id: uid, full_name: body.full_name, role: 'student', reg_no: regNo },
      patient: patientRow,
    });
  } catch (e) {
    fail(res, e, e instanceof z.ZodError ? 422 : 400);
  }
});

authRouter.get('/me', authRequired, async (req, res) => {
  const { data: patient } = await admin
    .from('patients').select('*').eq('profile_id', req.userId!).maybeSingle();
  res.json({ profile: req.profile, patient });
});

// ---------------- Staff account management (admin only, server-privileged) ----------------

const staffSchema = z.object({
  full_name: z.string().min(3),
  role: z.enum(['receptionist', 'nurse', 'doctor', 'laboratory', 'pharmacist', 'admin', 'hospital_head']),
  staff_id: z.string().min(3),
  specialty: z.string().optional(),
  password: z.string().min(6).optional(),
});

authRouter.post('/staff', authRequired, roleRequired('admin', 'super_admin'), async (req, res) => {
  try {
    const body = staffSchema.parse(req.body);
    const staffId = body.staff_id.trim().toUpperCase().replace(/\s+/g, '');
    const { data: existing } = await admin.from('profiles').select('id').eq('staff_id', staffId).maybeSingle();
    if (existing) return res.status(409).json({ error: 'Staff ID already exists' });

    const email = `${staffId.toLowerCase().replace(/[^a-z0-9]+/g, '.')}@${CLINIC_EMAIL_DOMAIN}`;
    const password = body.password ?? 'Welcome@' + Math.random().toString(36).slice(-6);
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name: body.full_name },
    });
    if (createError) throw createError;
    const uid = created.user!.id;

    const { error } = await admin.from('profiles').insert({
      id: uid, full_name: body.full_name, role: body.role, staff_id: staffId, email,
    });
    if (error) {
      await admin.auth.admin.deleteUser(uid);
      throw error;
    }
    if (body.role === 'doctor') {
      await admin.from('doctors').upsert({ profile_id: uid, specialty: body.specialty ?? 'General practice' });
    }
    res.status(201).json({ id: uid, staff_id: staffId, email, temporary_password: body.password ? undefined : password });
  } catch (e) {
    fail(res, e, e instanceof z.ZodError ? 422 : 400);
  }
});

authRouter.patch('/users/:userId/role', authRequired, roleRequired('admin', 'super_admin'), async (req, res) => {
  try {
    const role = z.enum(['student', 'receptionist', 'nurse', 'doctor', 'laboratory', 'pharmacist', 'admin', 'super_admin', 'hospital_head'])
      .parse(req.body.role);
    if (req.userId === req.params.userId && role !== 'admin' && role !== 'super_admin') {
      return res.status(400).json({ error: 'You cannot demote your own account' });
    }
    const { error } = await admin.from('profiles').update({ role }).eq('id', req.params.userId);
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, e instanceof z.ZodError ? 422 : 400);
  }
});

authRouter.post('/users/:userId/reset-password', authRequired, roleRequired('admin', 'super_admin'), async (req, res) => {
  try {
    const password = z.string().min(6).parse(req.body?.password as unknown);
    const { error } = await admin.auth.admin.updateUserById(String(req.params.userId), { password });
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, e instanceof z.ZodError ? 422 : 400);
  }
});
