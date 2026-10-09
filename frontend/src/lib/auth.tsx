import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api, clearSession, getToken, setSession } from './api';

export type Role =
  | 'student' | 'receptionist' | 'nurse' | 'doctor' | 'laboratory'
  | 'pharmacist' | 'admin' | 'super_admin' | 'hospital_head';

export interface Profile {
  id: string;
  full_name: string;
  role: Role;
  email: string | null;
  staff_id: string | null;
  reg_no: string | null;
}

export interface PatientFile {
  id: string;
  unit_number: string;
  full_name: string;
  category: string;
  university_id: string | null;
  [key: string]: unknown;
}

interface AuthState {
  profile: Profile | null;
  patient: PatientFile | null;
  loading: boolean;
  login: (id: string, password: string) => Promise<Profile>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export const homeForRole: Record<Role, string> = {
  student: '/portal',
  receptionist: '/reception',
  nurse: '/queue',
  doctor: '/queue',
  laboratory: '/lab',
  pharmacist: '/pharmacy',
  hospital_head: '/management',
  admin: '/admin',
  super_admin: '/admin',
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [patient, setPatient] = useState<PatientFile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setProfile(null);
      setPatient(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api<{ profile: Profile; patient: PatientFile | null }>('/auth/me');
      setProfile(me.profile);
      setPatient(me.patient);
    } catch {
      clearSession();
      setProfile(null);
      setPatient(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const login = useCallback(async (id: string, password: string) => {
    const res = await api<{ session: { access_token: string; refresh_token: string }; profile: Profile }>(
      '/auth/login',
      { method: 'POST', body: { id, password } },
    );
    setSession(res.session.access_token, res.session.refresh_token);
    await refresh();
    return res.profile;
  }, [refresh]);

  const logout = useCallback(() => {
    clearSession();
    setProfile(null);
    setPatient(null);
    window.location.href = '/';
  }, []);

  const value = useMemo(
    () => ({ profile, patient, loading, login, logout, refresh }),
    [profile, patient, loading, login, logout, refresh],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
