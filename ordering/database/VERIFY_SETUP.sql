-- Read-only schema verification. Run after full setup.
DO $$
DECLARE missing TEXT;
BEGIN
 SELECT string_agg(expected.name, ', ') INTO missing
 FROM (VALUES
 ('products'),('product_barcodes'),('product_aliases'),('suppliers'),
 ('supplier_products'),('supplier_prices'),('supplier_terms'),
 ('price_uploads'),('price_approval_audit'),('supplier_price_reviews'),
 ('stores'),('staff_accounts'),('sales_daily'),('sales_weekly'),
 ('book_stock_latest'),('stock_snapshots'),('stock_movements'),
 ('incoming_deliveries'),('import_batches'),('import_rows'),
 ('reorder_rules'),('order_recommendations'),('order_drafts'),
 ('order_lines'),('order_audit'),('order_draft_suppliers'),('order_line_reviews')
 ) AS expected(name)
 WHERE to_regclass('office_ordering.' || expected.name) IS NULL;
 IF missing IS NOT NULL THEN RAISE EXCEPTION 'Missing ordering tables: %', missing; END IF;

 SELECT string_agg(expected.name, ', ') INTO missing
 FROM (VALUES ('v_approved_supplier_prices'),('v_genuine_wastage'),('v_pending_delivery_units')) AS expected(name)
 WHERE to_regclass('office_ordering.' || expected.name) IS NULL;
 IF missing IS NOT NULL THEN RAISE EXCEPTION 'Missing ordering views: %', missing; END IF;

 IF (SELECT count(*) FROM office_ordering.suppliers WHERE name IN ('Spizarnia','Mastermedia','Wabar')) <> 3 THEN
  RAISE EXCEPTION 'Supplier reference data incomplete';
 END IF;
 IF (SELECT count(*) FROM office_ordering.stores WHERE store_code IN ('0365','0766','0650','0665','0566','0602','0388')) <> 7 THEN
  RAISE EXCEPTION 'Store reference data incomplete';
 END IF;
 RAISE NOTICE 'Mieszko Ordering database: schema and reference data OK';
END $$;
SELECT current_database() AS database_name,
 (SELECT count(*) FROM information_schema.tables WHERE table_schema='office_ordering' AND table_type='BASE TABLE') AS ordering_tables,
 (SELECT count(*) FROM office_ordering.suppliers) AS suppliers,
 (SELECT count(*) FROM office_ordering.stores) AS stores;
