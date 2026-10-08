-- FUD Campus Care — 0004_analytics.sql
-- Aggregated, non-identifying views for surveillance and management analytics.
-- These feed charts and rule-based insights; no patient identifiers leave them.

-- Patient flow per day by entry route
create or replace view public.v_daily_flow as
select date_trunc('day', opened_at)::date as flow_date,
       encounter_type,
       count(*) as encounters
from public.encounters
group by 1, 2;

-- Waiting time per completed queue entry (minutes from check-in to being seen)
create or replace view public.v_queue_waiting as
select q.queue_date,
       q.encounter_id,
       extract(epoch from (coalesce(q.started_at, q.called_at, q.completed_at) - q.created_at)) / 60.0 as wait_minutes,
       extract(epoch from (q.completed_at - q.started_at)) / 60.0 as service_minutes,
       q.status
from public.queue_entries q
where q.completed_at is not null;

-- Disease surveillance: monthly diagnosis counts (aggregated, no identifiers)
create or replace view public.v_disease_trends as
select date_trunc('month', d.diagnosed_at)::date as month,
       d.name as disease,
       count(*) as cases
from public.diagnoses d
group by 1, 2;

-- Weekly disease counts for outbreak detection
create or replace view public.v_disease_weekly as
select date_trunc('week', d.diagnosed_at)::date as week,
       d.name as disease,
       count(*) as cases
from public.diagnoses d
where d.diagnosed_at > now() - interval '8 weeks'
group by 1, 2;

-- Medicine usage per month
create or replace view public.v_medicine_usage as
select date_trunc('month', d.dispensed_at)::date as month,
       m.id as medicine_id,
       m.name as medicine,
       sum(d.quantity) as units_dispensed
from public.dispensings d
join public.medicines m on m.id = d.medicine_id
group by 1, 2, 3;

-- Staff attendance summary per day
create or replace view public.v_attendance_summary as
select a.work_date,
       count(*) filter (where a.status = 'present') as present_count,
       count(*) filter (where a.status = 'late') as late_count,
       count(*) filter (where a.status = 'absent') as absent_count
from public.attendance a
group by 1;

-- Hourly arrival distribution for capacity insights
create or replace view public.v_hourly_arrivals as
select extract(hour from q.created_at)::int as hour_of_day,
       count(*) as arrivals
from public.queue_entries q
where q.created_at > now() - interval '28 days'
group by 1;
