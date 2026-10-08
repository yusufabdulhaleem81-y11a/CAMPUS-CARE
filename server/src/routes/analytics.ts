import { Router } from 'express';
import { admin } from '../supabase.js';
import { authRequired, fail, roleRequired } from '../middleware.js';

export const analyticsRouter = Router();
analyticsRouter.use(authRequired, roleRequired('hospital_head', 'admin', 'super_admin'));

// Aggregates below use the privileged client: management analytics are
// role-gated at the API and read pre-aggregated, non-identifying views.

interface Kpi { label: string; value: number; compare?: number; unit?: string }

analyticsRouter.get('/overview', async (req, res) => {
  try {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
    const monthStart = today.slice(0, 8) + '01';

    const [flow, waiting, openEmergencies, alerts, attendance, onDuty] = await Promise.all([
      admin.from('v_daily_flow').select('*').gte('flow_date', monthStart),
      admin.from('v_queue_waiting').select('*').gte('queue_date', weekAgo),
      admin.from('emergency_cases').select('id').in('status', ['open', 'responding', 'handed_over']),
      admin.from('stock_alerts').select('id, alert_level, medicines(name)').in('status', ['open', 'acknowledged']),
      admin.from('v_attendance_summary').select('*').gte('work_date', weekAgo),
      admin.from('shifts').select('id, profiles(full_name, role)').lte('starts_at', now.toISOString()).gte('ends_at', now.toISOString()),
    ]);

    const flows = flow.data ?? [];
    const todayEncounters = flows.filter((f: { flow_date: string }) => f.flow_date === today);
    const weekEncounters = flows.filter((f: { flow_date: string }) => f.flow_date >= weekAgo);
    const waits = waiting.data ?? [];
    const avgWait = waits.length ? waits.reduce((s: number, w: { wait_minutes: number }) => s + w.wait_minutes, 0) / waits.length : 0;
    const avgService = waits.filter((w: { service_minutes: number | null }) => w.service_minutes != null)
      .reduce((s: number, w: { service_minutes: number }, _i: number, arr: unknown[]) => s + w.service_minutes / arr.length, 0);

    const kpis: Kpi[] = [
      { label: 'Patients today', value: todayEncounters.reduce((s: number, f: { encounters: number }) => s + f.encounters, 0) },
      { label: 'Patients this week', value: weekEncounters.reduce((s: number, f: { encounters: number }) => s + f.encounters, 0) },
      { label: 'Avg waiting time (min)', value: Math.round(avgWait * 10) / 10 },
      { label: 'Avg service time (min)', value: Math.round(avgService * 10) / 10 },
      { label: 'Open emergencies', value: (openEmergencies.data ?? []).length },
      { label: 'Active stock alerts', value: (alerts.data ?? []).length },
    ];

    res.json({
      kpis,
      flowByDay: aggregateByDay(flows),
      staffOnDuty: onDuty.data ?? [],
      attendance: attendance.data ?? [],
      stockAlerts: alerts.data ?? [],
    });
  } catch (e) {
    fail(res, e, 500);
  }
});

function aggregateByDay(flows: { flow_date: string; encounters: number }[]) {
  const byDay = new Map<string, number>();
  for (const f of flows) byDay.set(f.flow_date, (byDay.get(f.flow_date) ?? 0) + f.encounters);
  return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, encounters]) => ({ date, encounters }));
}

// ============================================================ DISEASE SURVEILLANCE

analyticsRouter.get('/surveillance', async (req, res) => {
  try {
    const [monthly, weekly, top] = await Promise.all([
      admin.from('v_disease_trends').select('*').gte('month', new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10)),
      admin.from('v_disease_weekly').select('*'),
      admin.from('v_disease_trends').select('disease, cases').gte('month', new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)),
    ]);

    const topDiseases = Object.values(
      (top.data ?? []).reduce<Record<string, number>>((acc, t: { disease: string; cases: number }) => {
        acc[t.disease] = (acc[t.disease] ?? 0) + t.cases;
        return acc;
      }, {}),
    ).sort((a, b) => (b as number) - (a as number));

    // Outbreak detection: current week > 2x mean of previous weeks for a disease
    const weeklyRows = weekly.data ?? [];
    const byDisease = new Map<string, { week: string; cases: number }[]>();
    for (const r of weeklyRows as { week: string; disease: string; cases: number }[]) {
      if (!byDisease.has(r.disease)) byDisease.set(r.disease, []);
      byDisease.get(r.disease)!.push({ week: r.week, cases: r.cases });
    }
    const outbreaks: { disease: string; current: number; expected: number }[] = [];
    for (const [disease, weeks] of byDisease) {
      weeks.sort((a, b) => a.week.localeCompare(b.week));
      if (weeks.length >= 3) {
        const current = weeks[weeks.length - 1].cases;
        const prior = weeks.slice(0, -1);
        const mean = prior.reduce((s, w) => s + w.cases, 0) / prior.length;
        if (mean > 0 && current > mean * 2 && current >= 3) outbreaks.push({ disease, current, expected: Math.round(mean) });
      }
    }

    res.json({ monthly: monthly.data ?? [], weekly: weeklyRows, topDiseases, outbreaks });
  } catch (e) {
    fail(res, e, 500);
  }
});

// ============================================================ RULE-BASED MANAGEMENT INSIGHTS
// Raw data -> calculated metric -> insight -> recommendation. Deliberately
// transparent so the same engine can later be swapped for a model.

analyticsRouter.get('/insights', async (req, res) => {
  try {
    const [arrivals, alerts, attendance, monthly, flows] = await Promise.all([
      admin.from('v_hourly_arrivals').select('*'),
      admin.from('stock_alerts').select('alert_level, days_remaining, medicines(name)').in('status', ['open', 'acknowledged']),
      admin.from('v_attendance_summary').select('*').gte('work_date', new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10)),
      admin.from('v_disease_trends').select('*').gte('month', new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10)),
      admin.from('v_daily_flow').select('*').gte('flow_date', new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10)),
    ]);

    const insights: { severity: 'info' | 'warning' | 'critical'; area: string; metric: string; insight: string; recommendation: string }[] = [];

    // 1. Peak-hour staffing
    const hours = (arrivals.data ?? []) as { hour_of_day: number; arrivals: number }[];
    if (hours.length) {
      const peak = hours.reduce((a, b) => (b.arrivals > a.arrivals ? b : a));
      const total = hours.reduce((s, h) => s + h.arrivals, 0);
      if (total > 0 && peak.arrivals / total > 0.2) {
        const fmt = (h: number) => `${String(h).padStart(2, '0')}:00`;
        insights.push({
          severity: 'info', area: 'Patient flow',
          metric: `${Math.round((peak.arrivals / total) * 100)}% of arrivals between ${fmt(peak.hour_of_day)} and ${fmt(peak.hour_of_day + 1)}`,
          insight: `Patient volume is consistently highest around ${fmt(peak.hour_of_day)}.`,
          recommendation: 'Consider increasing reception and nursing coverage during this period.',
        });
      }
    }

    // 2. Stock-out risk
    for (const a of (alerts.data ?? []) as unknown as { alert_level: string; days_remaining: number | null; medicines: { name: string }[] }[]) {
      const medName = Array.isArray(a.medicines) ? a.medicines[0]?.name : (a.medicines as unknown as { name: string } | undefined)?.name;
      if (!medName) continue;
      if (a.alert_level === 'critical' || a.alert_level === 'out_of_stock' || (a.days_remaining != null && a.days_remaining < 5)) {
        insights.push({
          severity: a.alert_level === 'out_of_stock' ? 'critical' : 'warning', area: 'Pharmacy',
          metric: `${medName}: ${a.alert_level.replace('_', ' ')}${a.days_remaining != null ? `, ~${a.days_remaining} day(s) of stock left` : ''}`,
          insight: `${medName} is at ${a.alert_level.replace('_', ' ')} based on recent usage.`,
          recommendation: 'Review current usage and initiate procurement if not already requested.',
        });
      }
    }

    // 3. Attendance pattern
    const att = (attendance.data ?? []) as { present_count: number; late_count: number; absent_count: number }[];
    if (att.length) {
      const late = att.reduce((s, a) => s + a.late_count, 0);
      const absent = att.reduce((s, a) => s + a.absent_count, 0);
      const present = att.reduce((s, a) => s + a.present_count, 0);
      if (present + late + absent > 0 && (late + absent) / (present + late + absent) > 0.15) {
        insights.push({
          severity: 'warning', area: 'Staffing',
          metric: `${Math.round(((late + absent) / (present + late + absent)) * 100)}% late/absent over 14 days`,
          insight: 'Attendance data indicates increased staff absence or lateness on selected shifts.',
          recommendation: 'Review shift allocation and attendance patterns.',
        });
      }
    }

    // 4. Rising disease
    const byDisease = new Map<string, Map<string, number>>();
    for (const m of (monthly.data ?? []) as { month: string; disease: string; cases: number }[]) {
      if (!byDisease.has(m.disease)) byDisease.set(m.disease, new Map());
      byDisease.get(m.disease)!.set(m.month, m.cases);
    }
    for (const [disease, months] of byDisease) {
      if (months.size >= 2) {
        const vals = [...months.values()];
        const prev = vals[vals.length - 2], cur = vals[vals.length - 1];
        if (prev > 0 && cur > prev * 1.5 && cur >= 5) {
          insights.push({
            severity: 'warning', area: 'Public health',
            metric: `${disease}: ${prev} → ${cur} cases month-over-month`,
            insight: `${disease} cases are rising compared with the previous month.`,
            recommendation: 'Brief clinical staff, review supplies for this condition, and monitor weekly trend.',
          });
        }
      }
    }

    // 5. Volume trend
    const dayCounts = new Map<string, number>();
    for (const f of (flows.data ?? []) as { flow_date: string; encounters: number }[]) {
      dayCounts.set(f.flow_date, (dayCounts.get(f.flow_date) ?? 0) + f.encounters);
    }
    const days = [...dayCounts.entries()].sort(([a], [b]) => a.localeCompare(b));
    if (days.length >= 14) {
      const half = Math.floor(days.length / 2);
      const firstAvg = days.slice(0, half).reduce((s, [, c]) => s + c, 0) / half;
      const secondAvg = days.slice(half).reduce((s, [, c]) => s + c, 0) / (days.length - half);
      if (firstAvg > 0 && Math.abs(secondAvg - firstAvg) / firstAvg > 0.2) {
        insights.push({
          severity: 'info', area: 'Patient flow',
          metric: `Daily volume ${secondAvg > firstAvg ? 'up' : 'down'} ${Math.round((Math.abs(secondAvg - firstAvg) / firstAvg) * 100)}% vs previous period`,
          insight: `Clinic attendance is trending ${secondAvg > firstAvg ? 'upward' : 'downward'}.`,
          recommendation: secondAvg > firstAvg
            ? 'Plan clinic capacity and drug stock for higher demand.'
            : 'Review whether appointment reminders or service changes affected attendance.',
        });
      }
    }

    res.json({ generatedAt: new Date().toISOString(), count: insights.length, insights });
  } catch (e) {
    fail(res, e, 500);
  }
});
