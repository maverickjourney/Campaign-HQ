create extension if not exists pgcrypto;

create or replace function public.ls_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.ls_collections (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text unique,
  collection_type text default 'collection',
  status text not null default 'planning',
  launch_date date,
  preorder_date date,
  event_date date,
  piece_target integer,
  description text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ls_vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  vendor_type text,
  contact_name text,
  email text,
  phone text,
  website text,
  lead_time_days integer,
  minimum_order text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ls_pieces (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid references public.ls_collections(id) on delete set null,
  name text not null,
  piece_code text unique,
  product_type text,
  stage text not null default 'idea',
  priority text not null default 'medium',
  blank_vendor_id uuid references public.ls_vendors(id) on delete set null,
  blank_sku text,
  blank_url text,
  base_cost numeric(12,2),
  decoration_cost numeric(12,2),
  landed_cost numeric(12,2),
  target_retail numeric(12,2),
  donation_amount numeric(12,2),
  sample_due date,
  production_due date,
  launch_ready boolean not null default false,
  description text,
  decoration_notes text,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ls_variants (
  id uuid primary key default gen_random_uuid(),
  piece_id uuid not null references public.ls_pieces(id) on delete cascade,
  color_name text not null,
  color_hex text,
  supplier_color_name text,
  status text not null default 'planning',
  embroidery_thread text,
  embroidery_thread_code text,
  decoration_method text,
  decoration_spec text,
  sample_status text,
  sample_received_at date,
  approved boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(piece_id, color_name)
);

create table if not exists public.ls_inventory (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.ls_variants(id) on delete cascade,
  size text not null,
  target_qty integer not null default 0,
  ordered_qty integer not null default 0,
  received_qty integer not null default 0,
  sample_qty integer not null default 0,
  reserved_qty integer not null default 0,
  event_qty integer not null default 0,
  sold_qty integer not null default 0,
  damaged_qty integer not null default 0,
  reorder_point integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(variant_id, size),
  check (target_qty >= 0 and ordered_qty >= 0 and received_qty >= 0 and sample_qty >= 0 and reserved_qty >= 0 and event_qty >= 0 and sold_qty >= 0 and damaged_qty >= 0 and reorder_point >= 0)
);

create table if not exists public.ls_purchase_orders (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid references public.ls_vendors(id) on delete set null,
  po_number text unique,
  status text not null default 'draft',
  ordered_at date,
  expected_at date,
  received_at date,
  tracking_number text,
  tracking_url text,
  subtotal numeric(12,2) default 0,
  shipping numeric(12,2) default 0,
  tax numeric(12,2) default 0,
  discount numeric(12,2) default 0,
  total numeric(12,2) default 0,
  paid_status text default 'unpaid',
  payment_method text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ls_purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.ls_purchase_orders(id) on delete cascade,
  variant_id uuid references public.ls_variants(id) on delete set null,
  size text,
  description text,
  quantity integer not null default 1,
  unit_cost numeric(12,2) default 0,
  line_total numeric(12,2) generated always as (quantity * unit_cost) stored,
  received_qty integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  check (quantity >= 0 and received_qty >= 0)
);

create table if not exists public.ls_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  status text not null default 'open',
  priority text not null default 'medium',
  due_date date,
  assigned_to text,
  entity_type text,
  entity_id uuid,
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ls_notes (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid,
  title text,
  body text not null,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ls_assets (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  file_size bigint,
  asset_type text default 'reference',
  caption text,
  created_at timestamptz not null default now()
);

create table if not exists public.ls_finance_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null default current_date,
  entry_type text not null,
  category text,
  amount numeric(12,2) not null default 0,
  vendor_id uuid references public.ls_vendors(id) on delete set null,
  piece_id uuid references public.ls_pieces(id) on delete set null,
  purchase_order_id uuid references public.ls_purchase_orders(id) on delete set null,
  description text,
  payment_status text,
  receipt_asset_id uuid references public.ls_assets(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ls_ideas (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  idea_type text,
  collection_id uuid references public.ls_collections(id) on delete set null,
  status text not null default 'idea',
  priority text not null default 'medium',
  description text,
  inspiration_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ls_inventory_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.ls_variants(id) on delete cascade,
  size text,
  movement_type text not null,
  quantity integer not null,
  movement_date date not null default current_date,
  reference_type text,
  reference_id uuid,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists ls_pieces_collection_idx on public.ls_pieces(collection_id);
create index if not exists ls_variants_piece_idx on public.ls_variants(piece_id);
create index if not exists ls_inventory_variant_idx on public.ls_inventory(variant_id);
create index if not exists ls_po_vendor_idx on public.ls_purchase_orders(vendor_id);
create index if not exists ls_tasks_due_idx on public.ls_tasks(due_date, status);
create index if not exists ls_assets_entity_idx on public.ls_assets(entity_type, entity_id);
create index if not exists ls_notes_entity_idx on public.ls_notes(entity_type, entity_id);

create or replace view public.ls_inventory_status as
select
  i.id,
  i.variant_id,
  v.piece_id,
  p.collection_id,
  p.name as piece_name,
  p.piece_code,
  v.color_name,
  i.size,
  i.target_qty,
  i.ordered_qty,
  i.received_qty,
  i.sample_qty,
  i.reserved_qty,
  i.event_qty,
  i.sold_qty,
  i.damaged_qty,
  greatest(i.received_qty - i.reserved_qty - i.event_qty - i.sold_qty - i.damaged_qty, 0) as available_qty,
  greatest(i.target_qty - i.ordered_qty, 0) as still_to_order,
  i.reorder_point
from public.ls_inventory i
join public.ls_variants v on v.id = i.variant_id
join public.ls_pieces p on p.id = v.piece_id;

create or replace view public.ls_dashboard_summary as
select
  (select count(*) from public.ls_collections) as collections,
  (select count(*) from public.ls_pieces) as pieces,
  (select count(*) from public.ls_variants) as colorways,
  (select coalesce(sum(still_to_order),0) from public.ls_inventory_status) as units_to_order,
  (select count(*) from public.ls_tasks where status <> 'done' and due_date is not null and due_date <= current_date + 7) as due_next_7_days,
  (select coalesce(sum(case when entry_type = 'expense' then amount else 0 end),0) from public.ls_finance_entries) as total_expenses,
  (select coalesce(sum(case when entry_type = 'revenue' then amount else 0 end),0) from public.ls_finance_entries) as total_revenue;

insert into public.ls_collections (name, code, collection_type, status, piece_target, description)
values
  ('Foundation Collection', 'FOUNDATION', 'collection', 'planning', 25, 'Core LOVESOONER Foundation Collection.'),
  ('Foundation Pieces — Prelaunch', 'FOUNDATION-10', 'drop', 'production', 10, 'The first 10 Foundation Pieces used for preview, event and core launch planning.'),
  ('HELD', 'HELD', 'capsule', 'planning', 2, 'Separate two-piece HELD concept; each piece planned in three colorways.')
on conflict (name) do nothing;

do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname='public' and tablename like 'ls_%' loop
    execute format('alter table public.%I enable row level security', r.tablename);
    begin
      execute format('create policy %I on public.%I for all to authenticated using (true) with check (true)', r.tablename || '_authenticated_all', r.tablename);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

drop trigger if exists ls_collections_touch on public.ls_collections;
create trigger ls_collections_touch before update on public.ls_collections for each row execute function public.ls_touch_updated_at();
drop trigger if exists ls_vendors_touch on public.ls_vendors;
create trigger ls_vendors_touch before update on public.ls_vendors for each row execute function public.ls_touch_updated_at();
drop trigger if exists ls_pieces_touch on public.ls_pieces;
create trigger ls_pieces_touch before update on public.ls_pieces for each row execute function public.ls_touch_updated_at();
drop trigger if exists ls_variants_touch on public.ls_variants;
create trigger ls_variants_touch before update on public.ls_variants for each row execute function public.ls_touch_updated_at();
drop trigger if exists ls_inventory_touch on public.ls_inventory;
create trigger ls_inventory_touch before update on public.ls_inventory for each row execute function public.ls_touch_updated_at();
drop trigger if exists ls_purchase_orders_touch on public.ls_purchase_orders;
create trigger ls_purchase_orders_touch before update on public.ls_purchase_orders for each row execute function public.ls_touch_updated_at();
drop trigger if exists ls_tasks_touch on public.ls_tasks;
create trigger ls_tasks_touch before update on public.ls_tasks for each row execute function public.ls_touch_updated_at();
drop trigger if exists ls_notes_touch on public.ls_notes;
create trigger ls_notes_touch before update on public.ls_notes for each row execute function public.ls_touch_updated_at();
drop trigger if exists ls_finance_entries_touch on public.ls_finance_entries;
create trigger ls_finance_entries_touch before update on public.ls_finance_entries for each row execute function public.ls_touch_updated_at();
drop trigger if exists ls_ideas_touch on public.ls_ideas;
create trigger ls_ideas_touch before update on public.ls_ideas for each row execute function public.ls_touch_updated_at();

insert into storage.buckets (id, name, public, file_size_limit)
values ('lovesooner-crm', 'lovesooner-crm', false, 52428800)
on conflict (id) do nothing;

drop policy if exists ls_storage_select on storage.objects;
create policy ls_storage_select on storage.objects for select to authenticated using (bucket_id = 'lovesooner-crm');
drop policy if exists ls_storage_insert on storage.objects;
create policy ls_storage_insert on storage.objects for insert to authenticated with check (bucket_id = 'lovesooner-crm');
drop policy if exists ls_storage_update on storage.objects;
create policy ls_storage_update on storage.objects for update to authenticated using (bucket_id = 'lovesooner-crm') with check (bucket_id = 'lovesooner-crm');
drop policy if exists ls_storage_delete on storage.objects;
create policy ls_storage_delete on storage.objects for delete to authenticated using (bucket_id = 'lovesooner-crm');;
