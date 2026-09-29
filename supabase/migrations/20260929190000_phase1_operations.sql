-- Additive Phase 1 migration for the existing Mieszko database.
-- It does not drop operational data and does not rewrite existing PIN hashes.

do $$
begin
  if to_regclass('public.stores') is null
     or to_regclass('public.suppliers') is null
     or to_regclass('public.products') is null
     or to_regclass('public.profiles') is null
     or to_regclass('public.orders') is null
     or to_regclass('public.order_items') is null then
    raise exception 'Expected the existing Mieszko tables. This migration extends them and does not create a replacement database.';
  end if;
end $$;

create extension if not exists pgcrypto;

alter table public.stores add column if not exists active boolean not null default true;
alter table public.stores add column if not exists updated_at timestamptz not null default now();

do $$
declare column_type text;
begin
  select data_type into column_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'stores' and column_name = 'code';
  if column_type in ('integer', 'bigint', 'smallint', 'numeric') then
    alter table public.stores alter column code type text using code::text;
  end if;
exception when others then
  raise notice 'Store code type was left unchanged: %', sqlerrm;
end $$;

alter table public.stores alter column code drop not null;

alter table public.suppliers add column if not exists active boolean not null default true;
alter table public.suppliers add column if not exists order_email text;
alter table public.suppliers add column if not exists email_enabled boolean not null default false;
alter table public.suppliers add column if not exists email_subject_template text;
alter table public.suppliers add column if not exists created_at timestamptz not null default now();
alter table public.suppliers add column if not exists updated_at timestamptz not null default now();

do $$
declare column_type text;
begin
  select data_type into column_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'suppliers' and column_name = 'cc_emails';
  if column_type is null then
    alter table public.suppliers add column cc_emails text[] not null default '{}';
  elsif column_type in ('text', 'character varying') then
    alter table public.suppliers
      alter column cc_emails type text[]
      using (
        case
          when cc_emails is null or btrim(cc_emails) = '' then '{}'::text[]
          else regexp_split_to_array(cc_emails, '\s*,\s*')
        end
      );
  end if;
end $$;

alter table public.products add column if not exists item_code text;
alter table public.products add column if not exists barcode text;
alter table public.products add column if not exists case_size integer not null default 1;
alter table public.products add column if not exists active boolean not null default true;
alter table public.products add column if not exists cost numeric(12, 2);
alter table public.products add column if not exists sort_order integer not null default 0;
alter table public.products add column if not exists category text;
alter table public.products add column if not exists notes text;
alter table public.products add column if not exists supplier_product_code text;
alter table public.products add column if not exists created_at timestamptz not null default now();
alter table public.products add column if not exists updated_at timestamptz not null default now();

alter table public.profiles add column if not exists pin_hash text;
alter table public.profiles add column if not exists pin_enabled boolean not null default true;
alter table public.profiles add column if not exists active boolean not null default true;
alter table public.profiles add column if not exists last_seen_at timestamptz;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
alter table public.profiles add column if not exists created_at timestamptz not null default now();

alter table public.orders add column if not exists updated_at timestamptz not null default now();
alter table public.orders add column if not exists cancelled_at timestamptz;
alter table public.orders add column if not exists cancelled_by uuid;

alter table public.order_items add column if not exists case_quantity integer;
alter table public.order_items add column if not exists case_size_snapshot integer;
alter table public.order_items add column if not exists total_units integer;
alter table public.order_items add column if not exists cost_snapshot numeric(12, 2);

update public.order_items
set case_quantity = cases
where case_quantity is null and cases is not null;

update public.order_items
set case_size_snapshot = case_size
where case_size_snapshot is null and case_size is not null;

update public.order_items
set total_units = coalesce(case_size, 0) * coalesce(cases, 0)
where total_units is null;

create table if not exists public.store_suppliers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  active boolean not null default true,
  order_deadline time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, supplier_id)
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_name text,
  actor_role text,
  store_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.pin_attempts (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

insert into public.app_settings (key, value)
values ('orders', '{"deadline":"","enforce":false,"note":""}'::jsonb)
on conflict (key) do nothing;

alter table public.order_email_log add column if not exists supplier_id uuid;
alter table public.order_email_log add column if not exists order_date date;
alter table public.order_email_log add column if not exists kind text default 'order';

do $$
begin
  if to_regclass('public.order_email_log') is not null then
    alter table public.order_email_log alter column order_id drop not null;
  end if;
exception when others then
  raise notice 'order_email_log.order_id nullability was left unchanged: %', sqlerrm;
end $$;

create or replace function public.sync_order_item_quantities()
returns trigger
language plpgsql
as $$
begin
  if new.cases is null and new.case_quantity is not null then
    new.cases := new.case_quantity;
  end if;
  if new.case_quantity is null and new.cases is not null then
    new.case_quantity := new.cases;
  end if;
  if new.case_size_snapshot is null then
    new.case_size_snapshot := new.case_size;
  end if;
  if new.case_size is null then
    new.case_size := new.case_size_snapshot;
  end if;
  new.total_units := coalesce(new.case_size, 0) * coalesce(new.cases, 0);
  return new;
end;
$$;

drop trigger if exists order_items_sync on public.order_items;
create trigger order_items_sync
before insert or update on public.order_items
for each row execute function public.sync_order_item_quantities();

create index if not exists orders_store_date_idx on public.orders (store_id, order_date desc);
create index if not exists orders_supplier_date_idx on public.orders (supplier_id, order_date desc, status);
create index if not exists order_items_order_idx on public.order_items (order_id);
create index if not exists pin_attempts_lookup_idx on public.pin_attempts (ip_hash, created_at desc);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);

do $$
begin
  create unique index if not exists staff_pin_sessions_token_hash_uidx on public.staff_pin_sessions (token_hash);
  create unique index if not exists order_items_order_product_uidx on public.order_items (order_id, product_id);
  create unique index if not exists stores_code_unique on public.stores (code) where code is not null and code <> '';
  create unique index if not exists orders_one_open_draft on public.orders (store_id, supplier_id, order_date) where status = 'draft';
exception when others then
  raise notice 'A unique index was skipped because existing rows conflict: %', sqlerrm;
end $$;

do $$
declare constraint_name text;
begin
  if not exists (
    select 1 from public.orders
    where status not in ('draft', 'submitted', 'cancelled', 'consolidated', 'sent_to_supplier', 'received', 'closed')
  ) then
    for constraint_name in
      select conname
      from pg_constraint
      where conrelid = 'public.orders'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%status%'
    loop
      execute format('alter table public.orders drop constraint %I', constraint_name);
    end loop;
    if not exists (
      select 1 from pg_constraint
      where conrelid = 'public.orders'::regclass and conname = 'orders_status_check'
    ) then
      alter table public.orders
        add constraint orders_status_check
        check (status in ('draft', 'submitted', 'cancelled', 'consolidated', 'sent_to_supplier', 'received', 'closed'));
    end if;
  end if;
end $$;

create or replace function public.app_submit_order(p_order_id uuid, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_profile public.profiles%rowtype;
  v_products integer;
  v_cases integer;
  v_units integer;
begin
  select * into v_profile from public.profiles where user_id = p_actor;
  if not found or v_profile.active is distinct from true or v_profile.pin_enabled is distinct from true then
    raise exception 'session_invalid';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_profile.role = 'store' and v_order.store_id is distinct from v_profile.store_id then
    raise exception 'forbidden';
  end if;
  if v_order.status = 'submitted' then
    raise exception 'already_submitted';
  end if;
  if v_order.status <> 'draft' then
    raise exception 'not_draft';
  end if;

  update public.order_items oi
  set case_size = p.case_size,
      case_size_snapshot = p.case_size,
      case_quantity = oi.cases,
      cost_snapshot = p.cost
  from public.products p
  where oi.order_id = p_order_id
    and oi.product_id = p.id
    and oi.cases > 0;

  select count(*)::integer, coalesce(sum(cases), 0)::integer, coalesce(sum(total_units), 0)::integer
    into v_products, v_cases, v_units
  from public.order_items
  where order_id = p_order_id and cases > 0;

  if v_products = 0 then
    raise exception 'empty_order';
  end if;

  update public.orders
  set status = 'submitted',
      submitted_at = now(),
      submitted_by = p_actor,
      updated_at = now()
  where id = p_order_id;

  insert into public.audit_log (actor_id, actor_name, actor_role, store_id, action, entity_type, entity_id, metadata)
  values (
    p_actor,
    v_profile.full_name,
    v_profile.role,
    v_order.store_id,
    'order_submitted',
    'order',
    p_order_id::text,
    jsonb_build_object('products', v_products, 'cases', v_cases, 'units', v_units, 'supplier_id', v_order.supplier_id)
  );

  return jsonb_build_object('products', v_products, 'cases', v_cases, 'units', v_units);
end;
$$;

create or replace function public.app_cancel_order(p_order_id uuid, p_actor uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_profile public.profiles%rowtype;
begin
  select * into v_profile from public.profiles where user_id = p_actor and active is true;
  if not found or v_profile.role not in ('office', 'admin') then
    raise exception 'forbidden';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_order.status = 'cancelled' then
    raise exception 'already_cancelled';
  end if;
  if v_order.status not in ('draft', 'submitted') then
    raise exception 'not_cancellable';
  end if;

  update public.orders
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = p_actor,
      updated_at = now()
  where id = p_order_id;

  insert into public.audit_log (actor_id, actor_name, actor_role, store_id, action, entity_type, entity_id, metadata)
  values (p_actor, v_profile.full_name, v_profile.role, v_order.store_id, 'order_cancelled', 'order', p_order_id::text, '{}'::jsonb);
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'set_staff_pin'
  ) then
    execute $fn$
      create function public.set_staff_pin(p_user_id uuid, p_pin text)
      returns void
      language plpgsql
      security definer
      set search_path = public
      as $body$
      begin
        if p_pin !~ '^\d{6}$' then
          raise exception 'invalid_pin';
        end if;
        update public.profiles
        set pin_hash = crypt(p_pin, gen_salt('bf')),
            pin_enabled = true,
            updated_at = now()
        where user_id = p_user_id;
        if not found then
          raise exception 'not_found';
        end if;
      end;
      $body$;
    $fn$;
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'verify_staff_pin'
  ) then
    execute $fn$
      create function public.verify_staff_pin(p_pin text)
      returns table (user_id uuid, role text, login_email text, full_name text, store_id uuid)
      language sql
      security definer
      set search_path = public
      as $body$
        select user_id, role, login_email, full_name, store_id
        from public.profiles
        where active is true
          and pin_enabled is true
          and pin_hash is not null
          and pin_hash = crypt(p_pin, pin_hash);
      $body$;
    $fn$;
  end if;
end $$;

do $$
declare signature regprocedure;
begin
  for signature in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('verify_staff_pin', 'set_staff_pin', 'submit_order', 'app_submit_order', 'app_cancel_order')
  loop
    execute format('revoke all on function %s from public', signature);
    execute format('revoke all on function %s from anon', signature);
    execute format('revoke all on function %s from authenticated', signature);
    execute format('grant execute on function %s to service_role', signature);
  end loop;
end $$;

insert into public.stores (name, code, active)
select seed.name, seed.code, true
from (
  values
    ('Hounslow', '0365'),
    ('Streatham', '0388'),
    ('Gravesend', '0566'),
    ('Watford', '0602'),
    ('Eastham', '0650'),
    ('Hayes', '0665'),
    ('Perivale', '0766')
) as seed(name, code)
where not exists (
  select 1 from public.stores existing
  where lower(existing.name) = lower(seed.name)
     or existing.code = seed.code
);

insert into public.stores (name, code, active)
select 'Sudbury Hill', null, true
where not exists (
  select 1 from public.stores
  where lower(name) in ('sudbury hill', 'sudbury')
);

insert into public.stores (name, code, active)
select 'Mitcham', null, true
where not exists (
  select 1 from public.stores where lower(name) = 'mitcham'
);

update public.stores set code = '0365', updated_at = now() where lower(name) = 'hounslow' and (code is null or code in ('365', '0365'));
update public.stores set code = '0388', updated_at = now() where lower(name) = 'streatham' and (code is null or code in ('388', '0388'));
update public.stores set code = '0566', updated_at = now() where lower(name) = 'gravesend' and (code is null or code in ('566', '0566'));
update public.stores set code = '0602', updated_at = now() where lower(name) = 'watford' and (code is null or code in ('602', '0602'));
update public.stores set code = '0650', updated_at = now() where lower(name) = 'eastham' and (code is null or code in ('650', '0650'));
update public.stores set code = '0665', updated_at = now() where lower(name) = 'hayes' and (code is null or code in ('665', '0665'));
update public.stores set code = '0766', updated_at = now() where lower(name) = 'perivale' and (code is null or code in ('766', '0766'));

insert into public.suppliers (name, active)
select seed.name, true
from (
  values
    ('Polish Village Bread'),
    ('Starmalyn'),
    ('Polish Bakery'),
    ('P.J. Martin')
) as seed(name)
where not exists (
  select 1 from public.suppliers existing where lower(existing.name) = lower(seed.name)
);

insert into public.store_suppliers (store_id, supplier_id, active)
select stores.id, suppliers.id, true
from public.stores
join public.suppliers on suppliers.active is true
where stores.active is true
on conflict (store_id, supplier_id) do nothing;

alter table public.store_suppliers enable row level security;
alter table public.audit_log enable row level security;
alter table public.pin_attempts enable row level security;
alter table public.app_settings enable row level security;

do $$
declare policy_row record;
declare table_row record;
begin
  for policy_row in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on public.%I', policy_row.policyname, policy_row.tablename);
  end loop;
  for table_row in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', table_row.tablename);
  end loop;
end $$;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
