alter table public.orders add column if not exists shop_copy_status text;

comment on column public.order_email_log.kind is 'supplier_order for the supplier email, shop_order_copy for the separate shop PDF email';
