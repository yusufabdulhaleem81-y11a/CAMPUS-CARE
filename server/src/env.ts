import 'dotenv/config';

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable: ${name}`);
  return v;
}

export const env = {
  port: Number(process.env.PORT ?? 8787),
  supabaseUrl: requireEnv('SUPABASE_URL'),
  supabaseAnonKey: requireEnv('SUPABASE_ANON_KEY'),
  supabaseServiceKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
};
