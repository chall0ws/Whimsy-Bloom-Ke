-- Whimsy & Bloom: the shop's data.
-- Paste this whole file into Supabase → SQL Editor → New query, then click Run. Safe to run twice.
--
-- Each order, customer, chat, fee, payout, material and so on is one row in `records`
-- (its details are in the `data` column). Settings and counters live in `app_meta`.
-- Only the app's server functions (using the service-role key) can read or write these
-- tables. Browsers can't reach them directly, even with the public anon key.

create table if not exists public.records (
  kind text not null,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (kind, id)
);

create table if not exists public.app_meta (
  id int primary key default 1 check (id = 1),
  version bigint not null default 0,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.app_meta (id) values (1) on conflict (id) do nothing;

-- Row level security on, with no policies: nobody but the server gets in.
alter table public.records enable row level security;
alter table public.app_meta enable row level security;
revoke all on public.records from anon, authenticated;
revoke all on public.app_meta from anon, authenticated;

-- Saves a batch of changes in one go, but only if nobody else saved since `expected_version`.
-- Returns the new version, or -1 if someone else got there first (the server then retries).
create or replace function public.apply_changes(expected_version bigint, upserts jsonb, deletes jsonb, meta jsonb)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_version bigint;
begin
  update app_meta
     set version = version + 1,
         data = coalesce(meta, data),
         updated_at = now()
   where id = 1 and version = expected_version
  returning version into new_version;

  if new_version is null then
    return -1;
  end if;

  insert into records (kind, id, data, updated_at)
  select r->>'kind', r->>'id', r->'data', now()
    from jsonb_array_elements(coalesce(upserts, '[]'::jsonb)) as r
  on conflict (kind, id) do update set data = excluded.data, updated_at = now();

  delete from records
   using jsonb_array_elements(coalesce(deletes, '[]'::jsonb)) as d
   where records.kind = d->>'kind' and records.id = d->>'id';

  return new_version;
end;
$$;

revoke execute on function public.apply_changes(bigint, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.apply_changes(bigint, jsonb, jsonb, jsonb) to service_role;

-- Easy-to-read views for the Supabase Table Editor (also server-only).
create or replace view public.orders_overview with (security_invoker = true) as
select
  data->>'number' as order_number,
  data->>'status' as status,
  data->'payment'->>'status' as payment,
  data->'payment'->>'reference' as payment_reference,
  data->>'channel' as source,
  data->'fulfilment'->>'method' as delivery,
  data->'fulfilment'->>'address' as address,
  (data->>'createdAt')::timestamptz as created_at,
  data->>'customerId' as customer_id,
  id
from public.records
where kind = 'order'
order by created_at desc;

create or replace view public.customers_overview with (security_invoker = true) as
select
  data->>'name' as name,
  data->>'phone' as phone,
  data->>'email' as email,
  (data->>'createdAt')::timestamptz as created_at,
  id
from public.records
where kind = 'customer'
order by created_at desc;

create or replace view public.service_fees_overview with (security_invoker = true) as
select
  data->>'orderNumber' as order_number,
  (data->>'amount')::int as amount_kes,
  (data->>'at')::timestamptz as charged_at
from public.records
where kind = 'fee'
order by charged_at desc;

revoke all on public.orders_overview, public.customers_overview, public.service_fees_overview from anon, authenticated;
