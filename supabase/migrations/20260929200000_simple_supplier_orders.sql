-- Simple supplier ordering fields. Does not remove existing columns or data.

alter table public.stores add column if not exists email text;

alter table public.orders add column if not exists delivery_date date;
alter table public.orders add column if not exists email_status text;

alter table public.products add column if not exists ean text;
alter table public.products add column if not exists supplier_code text;

update public.products set ean = barcode where ean is null and barcode is not null;
update public.products set supplier_code = supplier_product_code where supplier_code is null and supplier_product_code is not null;

alter table public.order_items add column if not exists quantity integer;
alter table public.order_items add column if not exists item_code_snapshot text;
alter table public.order_items add column if not exists ean_snapshot text;
alter table public.order_items add column if not exists supplier_code_snapshot text;
alter table public.order_items add column if not exists product_name_snapshot text;

update public.order_items set quantity = cases where quantity is null and cases is not null;

create index if not exists orders_delivery_date_idx on public.orders (delivery_date);

do $$
begin
  drop index if exists public.orders_one_open_draft;
  create unique index if not exists orders_one_draft_per_delivery
    on public.orders (store_id, supplier_id, delivery_date)
    where status = 'draft' and delivery_date is not null;
exception when others then
  raise notice 'draft delivery index skipped: %', sqlerrm;
end $$;
