-- Sookhtresan multi-user schema for Supabase PostgreSQL.
-- Run once in Supabase Dashboard > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete restrict,
  full_name text not null,
  email text not null,
  role text not null check (role in ('owner_admin', 'operations_admin', 'driver')),
  driver_no smallint,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_driver_no_check check (
    (role = 'driver' and driver_no is not null and driver_no between 1 and 6) or
    (role in ('owner_admin', 'operations_admin') and driver_no is null)
  )
);

create unique index if not exists profiles_org_driver_no_unique
  on public.profiles(org_id, driver_no) where role = 'driver';
create unique index if not exists profiles_org_admin_role_unique
  on public.profiles(org_id, role) where role in ('owner_admin', 'operations_admin');

create table if not exists public.fueling_reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  driver_id uuid not null references public.profiles(id) on delete restrict,
  report_date date not null default current_date,
  vehicle_plate text not null,
  customer_name text not null,
  product_type text not null check (product_type in ('regular_gasoline', 'premium_gasoline', 'diesel', 'kerosene', 'other')),
  destination text not null,
  liters numeric(12,2) not null check (liters > 0 and liters <= 100000),
  unit_price numeric(14,2) check (unit_price is null or unit_price >= 0),
  total_amount numeric(16,2) check (total_amount is null or total_amount >= 0),
  amount_mode text not null default 'not_set' check (amount_mode in ('auto', 'manual', 'not_set')),
  odometer_km numeric(12,1) check (odometer_km is null or odometer_km >= 0),
  notes text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  manager_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fueling_amount_mode_check check (
    (amount_mode = 'not_set' and total_amount is null) or
    (amount_mode in ('auto', 'manual') and total_amount is not null)
  ),
  constraint fueling_auto_amount_check check (amount_mode <> 'auto' or unit_price is not null)
);

create index if not exists fueling_reports_org_date_idx
  on public.fueling_reports(org_id, report_date desc, created_at desc);
create index if not exists fueling_reports_driver_date_idx
  on public.fueling_reports(driver_id, report_date desc, created_at desc);
create index if not exists fueling_reports_org_status_idx
  on public.fueling_reports(org_id, status, created_at desc);

create table if not exists public.report_audit_logs (
  id bigserial primary key,
  org_id uuid not null references public.organizations(id) on delete restrict,
  report_id uuid not null references public.fueling_reports(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index if not exists report_audit_logs_org_created_idx
  on public.report_audit_logs(org_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists fueling_reports_set_updated_at on public.fueling_reports;
create trigger fueling_reports_set_updated_at before update on public.fueling_reports
for each row execute function public.set_updated_at();

-- Security-definer helpers prevent recursive RLS evaluation on profiles.
create or replace function public.current_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  select org_id from public.profiles where id = auth.uid() and active limit 1;
$$;

create or replace function public.is_org_admin(target_org_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and org_id = target_org_id and active
      and role in ('owner_admin', 'operations_admin')
  );
$$;

create or replace function public.log_fueling_report_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  row_org uuid;
  row_id uuid;
begin
  if tg_op = 'DELETE' then
    row_org := old.org_id;
    row_id := old.id;
    insert into public.report_audit_logs(org_id, report_id, actor_id, action, old_data)
    values (row_org, row_id, auth.uid(), tg_op, to_jsonb(old));
    return old;
  elsif tg_op = 'UPDATE' then
    row_org := new.org_id;
    row_id := new.id;
    insert into public.report_audit_logs(org_id, report_id, actor_id, action, old_data, new_data)
    values (row_org, row_id, auth.uid(), tg_op, to_jsonb(old), to_jsonb(new));
    return new;
  else
    row_org := new.org_id;
    row_id := new.id;
    insert into public.report_audit_logs(org_id, report_id, actor_id, action, new_data)
    values (row_org, row_id, auth.uid(), tg_op, to_jsonb(new));
    return new;
  end if;
end;
$$;

drop trigger if exists fueling_reports_audit on public.fueling_reports;
create trigger fueling_reports_audit after insert or update or delete on public.fueling_reports
for each row execute function public.log_fueling_report_change();

-- Admin-only workflow functions. Clients cannot directly change report approval fields.
create or replace function public.manager_review_report(
  p_report_id uuid,
  p_status text,
  p_note text default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid;
begin
  if p_status is null or p_status not in ('approved', 'rejected', 'pending') then
    raise exception 'وضعیت گزارش نامعتبر است';
  end if;
  v_org_id := public.current_org_id();
  if v_org_id is null or not public.is_org_admin(v_org_id) then
    raise exception 'دسترسی مدیر لازم است';
  end if;
  update public.fueling_reports
  set status = p_status,
      manager_note = nullif(trim(coalesce(p_note, '')), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_report_id and org_id = v_org_id;
  if not found then raise exception 'گزارش پیدا نشد'; end if;
end;
$$;

create or replace function public.set_driver_active(
  p_driver_id uuid,
  p_active boolean
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid;
begin
  v_org_id := public.current_org_id();
  if v_org_id is null or not public.is_org_admin(v_org_id) then
    raise exception 'دسترسی مدیر لازم است';
  end if;
  update public.profiles
  set active = p_active
  where id = p_driver_id and org_id = v_org_id and role = 'driver';
  if not found then raise exception 'راننده پیدا نشد'; end if;
end;
$$;

create or replace function public.get_manager_dashboard(
  p_from date,
  p_to date
)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_org_id uuid;
  v_result jsonb;
begin
  v_org_id := public.current_org_id();
  if v_org_id is null or not public.is_org_admin(v_org_id) then
    raise exception 'دسترسی مدیر لازم است';
  end if;
  if p_from is null or p_to is null or p_from > p_to or p_to - p_from > 366 then
    raise exception 'بازه گزارش نامعتبر است';
  end if;

  select jsonb_build_object(
    'summary', (
      select jsonb_build_object(
        'report_count', count(*) filter (where status <> 'rejected'),
        'total_liters', coalesce(sum(liters) filter (where status <> 'rejected'), 0),
        'total_amount', coalesce(sum(total_amount) filter (where status <> 'rejected'), 0),
        'pending_count', count(*) filter (where status = 'pending'),
        'approved_count', count(*) filter (where status = 'approved'),
        'rejected_count', count(*) filter (where status = 'rejected'),
        'active_drivers', (select count(*) from public.profiles where org_id = v_org_id and role = 'driver' and active)
      )
      from public.fueling_reports
      where org_id = v_org_id and report_date between p_from and p_to
    ),
    'drivers', (
      select coalesce(jsonb_agg(to_jsonb(d) order by d.driver_no), '[]'::jsonb)
      from (
        select p.id as driver_id, p.full_name, p.driver_no, p.active,
          count(r.id) filter (where r.status <> 'rejected') as report_count,
          coalesce(sum(r.liters) filter (where r.status <> 'rejected'), 0) as total_liters,
          coalesce(sum(r.total_amount) filter (where r.status <> 'rejected'), 0) as total_amount,
          count(r.id) filter (where r.status = 'pending') as pending_count
        from public.profiles p
        left join public.fueling_reports r
          on r.driver_id = p.id and r.report_date between p_from and p_to
        where p.org_id = v_org_id and p.role = 'driver'
        group by p.id
      ) d
    )
  ) into v_result;
  return v_result;
end;
$$;


-- Drivers may correct and resubmit only their own rejected reports.
create or replace function public.driver_resubmit_report(
  p_report_id uuid,
  p_vehicle_plate text,
  p_customer_name text,
  p_product_type text,
  p_destination text,
  p_liters numeric,
  p_unit_price numeric,
  p_total_amount numeric,
  p_amount_mode text,
  p_odometer_km numeric,
  p_notes text
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_profile public.profiles%rowtype;
begin
  select * into v_profile from public.profiles
  where id = auth.uid() and active and role = 'driver';
  if not found then raise exception 'دسترسی راننده فعال لازم است'; end if;
  if length(trim(coalesce(p_vehicle_plate, ''))) < 4
     or length(trim(coalesce(p_customer_name, ''))) < 2
     or length(trim(coalesce(p_destination, ''))) < 2 then
    raise exception 'پلاک، مشتری و مقصد را کامل وارد کنید';
  end if;
  if p_liters is null or p_liters <= 0 or p_liters > 100000 then
    raise exception 'حجم تحویل معتبر نیست';
  end if;
  if p_product_type is null or p_product_type not in ('regular_gasoline', 'premium_gasoline', 'diesel', 'kerosene', 'other') then
    raise exception 'نوع سوخت معتبر نیست';
  end if;
  if p_amount_mode is null or p_amount_mode not in ('auto', 'manual', 'not_set') then
    raise exception 'روش ثبت مبلغ معتبر نیست';
  end if;
  if (p_unit_price is not null and p_unit_price < 0)
     or (p_odometer_km is not null and p_odometer_km < 0)
     or (p_amount_mode = 'not_set' and p_total_amount is not null)
     or (p_amount_mode in ('auto', 'manual') and (p_total_amount is null or p_total_amount < 0))
     or (p_amount_mode = 'auto' and (p_unit_price is null or p_unit_price < 0)) then
    raise exception 'اطلاعات مبلغ با روش انتخاب‌شده سازگار نیست';
  end if;
  update public.fueling_reports
  set vehicle_plate = trim(p_vehicle_plate),
      customer_name = trim(p_customer_name),
      product_type = p_product_type,
      destination = trim(p_destination),
      liters = p_liters,
      unit_price = p_unit_price,
      total_amount = p_total_amount,
      amount_mode = p_amount_mode,
      odometer_km = p_odometer_km,
      notes = nullif(trim(coalesce(p_notes, '')), ''),
      status = 'pending',
      manager_note = null,
      reviewed_by = null,
      reviewed_at = null
  where id = p_report_id and driver_id = auth.uid()
    and org_id = v_profile.org_id and status = 'rejected';
  if not found then raise exception 'فقط گزارش ردشده خودتان قابل اصلاح است'; end if;
end;
$$;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.fueling_reports enable row level security;
alter table public.report_audit_logs enable row level security;

drop policy if exists "organization members read organization" on public.organizations;
create policy "organization members read organization" on public.organizations
for select to authenticated using (id = public.current_org_id());

drop policy if exists "users read own profile or admins read organization profiles" on public.profiles;
create policy "users read own profile or admins read organization profiles" on public.profiles
for select to authenticated using (
  id = auth.uid() or public.is_org_admin(org_id)
);

-- Drivers can submit only reports under their own identity and organization.
drop policy if exists "drivers submit own reports" on public.fueling_reports;
create policy "drivers submit own reports" on public.fueling_reports
for insert to authenticated with check (
  driver_id = auth.uid()
  and org_id = public.current_org_id()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'driver' and p.active and p.org_id = fueling_reports.org_id
  )
  and status = 'pending'
  and reviewed_by is null
  and reviewed_at is null
  and manager_note is null
);

drop policy if exists "drivers read own reports and admins read organization reports" on public.fueling_reports;
create policy "drivers read own reports and admins read organization reports" on public.fueling_reports
for select to authenticated using (
  (driver_id = auth.uid() and org_id = public.current_org_id()) or public.is_org_admin(org_id)
);

-- Reports are reviewed through manager_review_report(), not direct table updates.
drop policy if exists "admins update organization reports" on public.fueling_reports;
create policy "admins update organization reports" on public.fueling_reports
for update to authenticated using (public.is_org_admin(org_id))
with check (public.is_org_admin(org_id));

drop policy if exists "admins read organization audit logs" on public.report_audit_logs;
create policy "admins read organization audit logs" on public.report_audit_logs
for select to authenticated using (public.is_org_admin(org_id));

grant usage on schema public to authenticated;
grant select on public.organizations, public.profiles, public.fueling_reports, public.report_audit_logs to authenticated;
grant insert on public.fueling_reports to authenticated;
grant update on public.fueling_reports to authenticated;
grant execute on function public.current_org_id() to authenticated;
grant execute on function public.is_org_admin(uuid) to authenticated;
grant execute on function public.manager_review_report(uuid, text, text) to authenticated;
grant execute on function public.set_driver_active(uuid, boolean) to authenticated;
grant execute on function public.driver_resubmit_report(uuid, text, text, text, text, numeric, numeric, numeric, text, numeric, text) to authenticated;
revoke all on function public.current_org_id() from public, anon;
revoke all on function public.is_org_admin(uuid) from public, anon;
revoke all on function public.manager_review_report(uuid, text, text) from public, anon;
revoke all on function public.set_driver_active(uuid, boolean) from public, anon;
revoke all on function public.driver_resubmit_report(uuid, text, text, text, text, numeric, numeric, numeric, text, numeric, text) from public, anon;
revoke all on function public.get_manager_dashboard(date, date) from public, anon;
grant execute on function public.get_manager_dashboard(date, date) to authenticated;

-- Enable database change events for the live manager dashboard.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'fueling_reports'
  ) then
    alter publication supabase_realtime add table public.fueling_reports;
  end if;
exception when undefined_object then
  raise notice 'supabase_realtime publication is not available; enable Realtime for fueling_reports in Supabase Dashboard.';
end;
$$;
