import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { asUser, admin } from './supabase.js';

export interface StaffProfile {
  id: string;
  full_name: string;
  role: string;
  email: string | null;
  staff_id: string | null;
  reg_no: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      token?: string;
      userId?: string;
      profile?: StaffProfile;
    }
  }
}

export function authRequired(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Sign in required' });
  }
  const token = header.slice('Bearer '.length);
  admin.auth
    .getUser(token)
    .then(async ({ data, error }) => {
      if (error || !data.user) return res.status(401).json({ error: 'Session invalid. Sign in again.' });
      req.token = token;
      req.userId = data.user.id;
      const { data: profile } = await admin
        .from('profiles')
        .select('id, full_name, role, email, staff_id, reg_no')
        .eq('id', data.user.id)
        .single();
      if (!profile) return res.status(403).json({ error: 'No clinic profile for this account' });
      req.profile = profile as StaffProfile;
      next();
    })
    .catch(() => res.status(401).json({ error: 'Session invalid. Sign in again.' }));
}

export function roleRequired(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.profile) return res.status(401).json({ error: 'Sign in required' });
    if (!roles.includes(req.profile.role)) {
      return res.status(403).json({ error: 'Your role does not permit this action' });
    }
    next();
  };
}

/** Run an RPC through the caller's own credentials so RLS applies. */
export function rpc(req: Request, fn: string, args: Record<string, unknown> = {}) {
  return asUser(req.token!).rpc(fn, args);
}

export function from(req: Request, table: string) {
  return asUser(req.token!).from(table);
}

export function fail(res: Response, e: unknown, status = 400) {
  if (e instanceof z.ZodError) {
    return res.status(status).json({ error: e.issues[0]?.message ?? 'Invalid input' });
  }
  // PostgrestError and similar plain objects: surface their message, not "[object Object]"
  if (e && typeof e === 'object') {
    const obj = e as { message?: string; details?: string; hint?: string; code?: string };
    const msg = [obj.message, obj.details].filter(Boolean).join(' — ') || 'The request could not be completed';
    return res.status(status).json({ error: msg });
  }
  const msg = e instanceof Error ? e.message : String(e);
  res.status(status).json({ error: msg || 'The request could not be completed' });
}
