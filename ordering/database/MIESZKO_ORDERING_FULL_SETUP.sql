-- MIESZKO OFFICE ORDERING - ONE FILE DATABASE INSTALL
-- PostgreSQL 15+. Create an empty database first (example: mieszko_ordering).
-- Run with: psql -v ON_ERROR_STOP=1 -U postgres -d mieszko_ordering -f MIESZKO_ORDERING_FULL_SETUP.sql
-- This script creates tables, indexes, views and reference suppliers/stores.
-- It does NOT configure API secrets, users, backups or connect the Next.js UI.
-- All statements run in one transaction. Existing records are preserved by IF NOT EXISTS / ON CONFLICT where provided.
BEGIN;

-- ===== 001_foundation.sql =====
CREATE SCHEMA IF NOT EXISTS office_ordering;
CREATE TABLE IF NOT EXISTS office_ordering.products (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 msp_item_code TEXT NOT NULL UNIQUE,
 description TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS office_ordering.product_barcodes (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 product_id BIGINT NOT NULL REFERENCES office_ordering.products(id),
 barcode TEXT NOT NULL UNIQUE,
 UNIQUE(product_id,barcode)
);
CREATE TABLE IF NOT EXISTS office_ordering.suppliers (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 name TEXT NOT NULL UNIQUE,
 active BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO office_ordering.suppliers(name) VALUES ('Spizarnia'),('Mastermedia'),('Wabar') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS office_ordering.supplier_products (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 supplier_id BIGINT NOT NULL REFERENCES office_ordering.suppliers(id),
 supplier_code TEXT NOT NULL,
 product_id BIGINT REFERENCES office_ordering.products(id),
 units_per_case NUMERIC(14,3) NOT NULL DEFAULT 1 CHECK (units_per_case > 0),
 active BOOLEAN NOT NULL DEFAULT true,
 UNIQUE(supplier_id,supplier_code)
);
CREATE TABLE IF NOT EXISTS office_ordering.price_uploads (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 supplier_id BIGINT NOT NULL REFERENCES office_ordering.suppliers(id),
 filename TEXT NOT NULL,
 uploaded_by TEXT NOT NULL,
 uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected'))
);
CREATE TABLE IF NOT EXISTS office_ordering.supplier_prices (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 supplier_product_id BIGINT NOT NULL REFERENCES office_ordering.supplier_products(id),
 upload_id BIGINT NOT NULL REFERENCES office_ordering.price_uploads(id),
 net_case_price NUMERIC(14,4) NOT NULL CHECK (net_case_price >= 0),
 currency CHAR(3) NOT NULL DEFAULT 'GBP',
 effective_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS supplier_prices_lookup ON office_ordering.supplier_prices(supplier_product_id,effective_at DESC);
CREATE TABLE IF NOT EXISTS office_ordering.stores (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 store_code TEXT NOT NULL UNIQUE,
 name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS office_ordering.sales_daily (
 store_id BIGINT NOT NULL REFERENCES office_ordering.stores(id),
 product_id BIGINT NOT NULL REFERENCES office_ordering.products(id),
 sale_date DATE NOT NULL,
 quantity NUMERIC(16,3) NOT NULL,
 net_sales NUMERIC(16,4),
 PRIMARY KEY(store_id,product_id,sale_date)
);
CREATE INDEX IF NOT EXISTS sales_daily_date_idx ON office_ordering.sales_daily(sale_date);
CREATE TABLE IF NOT EXISTS office_ordering.order_drafts (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 store_id BIGINT NOT NULL REFERENCES office_ordering.stores(id),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','cancelled')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 approved_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS office_ordering.order_lines (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 order_id BIGINT NOT NULL REFERENCES office_ordering.order_drafts(id),
 supplier_product_id BIGINT NOT NULL REFERENCES office_ordering.supplier_products(id),
 cases NUMERIC(14,3) NOT NULL CHECK(cases > 0),
 locked_net_case_price NUMERIC(14,4) NOT NULL CHECK(locked_net_case_price >= 0)
);


-- ===== 002_inventory_imports.sql =====
-- Ordering import and stock foundation. Apply after 001_foundation.sql.
CREATE TABLE IF NOT EXISTS office_ordering.import_batches (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 store_id BIGINT REFERENCES office_ordering.stores(id),
 report_type TEXT NOT NULL CHECK(report_type IN ('sales_daily','sales_weekly','rtc','wastage','book_stock','delivery','supplier_price')),
 filename TEXT NOT NULL,
 sha256 CHAR(64) NOT NULL,
 period_start DATE,
 period_end DATE,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','validated','imported','failed','rejected')),
 row_count BIGINT NOT NULL DEFAULT 0,
 rejected_count BIGINT NOT NULL DEFAULT 0,
 uploaded_by TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 completed_at TIMESTAMPTZ,
 UNIQUE(store_id,report_type,sha256)
);
CREATE TABLE IF NOT EXISTS office_ordering.sales_weekly (
 store_id BIGINT NOT NULL REFERENCES office_ordering.stores(id),
 product_id BIGINT NOT NULL REFERENCES office_ordering.products(id),
 period_start DATE NOT NULL,
 period_end DATE NOT NULL,
 quantity NUMERIC(16,3) NOT NULL,
 net_sales NUMERIC(16,4),
 import_batch_id BIGINT NOT NULL REFERENCES office_ordering.import_batches(id),
 PRIMARY KEY(store_id,product_id,period_start,period_end),
 CHECK(period_end >= period_start)
);
CREATE INDEX IF NOT EXISTS sales_weekly_period_idx ON office_ordering.sales_weekly(period_start,period_end);
CREATE TABLE IF NOT EXISTS office_ordering.book_stock_latest (
 store_id BIGINT NOT NULL REFERENCES office_ordering.stores(id),
 product_id BIGINT NOT NULL REFERENCES office_ordering.products(id),
 quantity NUMERIC(16,3) NOT NULL,
 snapshot_at TIMESTAMPTZ NOT NULL,
 import_batch_id BIGINT NOT NULL REFERENCES office_ordering.import_batches(id),
 PRIMARY KEY(store_id,product_id)
);
CREATE TABLE IF NOT EXISTS office_ordering.stock_movements (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 store_id BIGINT NOT NULL REFERENCES office_ordering.stores(id),
 product_id BIGINT NOT NULL REFERENCES office_ordering.products(id),
 movement_date DATE NOT NULL,
 source TEXT NOT NULL CHECK(source IN ('rtc','wastage','stock_adjustment','store_use','stock_take','transfer','credit_note_review','unknown')),
 reason TEXT NOT NULL,
 quantity NUMERIC(16,3) NOT NULL,
 cost NUMERIC(16,4),
 import_batch_id BIGINT NOT NULL REFERENCES office_ordering.import_batches(id),
 source_row_key TEXT NOT NULL,
 UNIQUE(import_batch_id,source_row_key)
);
CREATE INDEX IF NOT EXISTS stock_movements_lookup ON office_ordering.stock_movements(store_id,product_id,movement_date);
CREATE TABLE IF NOT EXISTS office_ordering.incoming_deliveries (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 store_id BIGINT NOT NULL REFERENCES office_ordering.stores(id),
 product_id BIGINT NOT NULL REFERENCES office_ordering.products(id),
 supplier_id BIGINT REFERENCES office_ordering.suppliers(id),
 expected_quantity NUMERIC(16,3) NOT NULL CHECK(expected_quantity >= 0),
 received_quantity NUMERIC(16,3) NOT NULL DEFAULT 0 CHECK(received_quantity >= 0),
 status TEXT NOT NULL DEFAULT 'expected' CHECK(status IN ('expected','physically_received','posted_to_msp','cancelled')),
 expected_at TIMESTAMPTZ,
 received_at TIMESTAMPTZ,
 msp_posted_at TIMESTAMPTZ,
 reference TEXT,
 import_batch_id BIGINT REFERENCES office_ordering.import_batches(id)
);
CREATE INDEX IF NOT EXISTS incoming_deliveries_lookup ON office_ordering.incoming_deliveries(store_id,product_id,status);
CREATE TABLE IF NOT EXISTS office_ordering.order_audit (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 order_id BIGINT NOT NULL REFERENCES office_ordering.order_drafts(id),
 event TEXT NOT NULL,
 actor TEXT NOT NULL,
 details JSONB NOT NULL DEFAULT '{}'::jsonb,
 occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE office_ordering.sales_weekly IS 'Weekly totals stay aggregated by date range; do not mix with daily sales when calculating demand.';
COMMENT ON TABLE office_ordering.stock_movements IS 'Only source=wastage is genuine wastage; adjustments, store use and stock take must be excluded from wastage demand.';
COMMENT ON TABLE office_ordering.incoming_deliveries IS 'Physical receipt and MSP posting are distinct states to avoid double-counting.';


-- ===== 003_price_approvals.sql =====
-- Audit trail for approval/rejection of supplier price lists.
CREATE TABLE IF NOT EXISTS office_ordering.price_approval_audit (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 upload_id BIGINT NOT NULL REFERENCES office_ordering.price_uploads(id),
 old_status TEXT NOT NULL,
 new_status TEXT NOT NULL CHECK(new_status IN ('approved','rejected')),
 reviewed_by TEXT NOT NULL,
 reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 note TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS price_approval_audit_upload_idx ON office_ordering.price_approval_audit(upload_id,reviewed_at);


-- ===== 004_ordering_complete.sql =====
-- Mieszko Smart Ordering - additional production-oriented schema.
-- Run after migrations 001, 002 and 003. PostgreSQL 15+.
CREATE TABLE IF NOT EXISTS office_ordering.staff_accounts (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 external_staff_id TEXT NOT NULL UNIQUE,
 display_name TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('head_office','store_manager','store_staff','admin','price_reviewer')),
 store_id BIGINT REFERENCES office_ordering.stores(id),
 active BOOLEAN NOT NULL DEFAULT true,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK ((role IN ('store_manager','store_staff') AND store_id IS NOT NULL) OR role NOT IN ('store_manager','store_staff'))
);
CREATE TABLE IF NOT EXISTS office_ordering.supplier_terms (
 supplier_id BIGINT PRIMARY KEY REFERENCES office_ordering.suppliers(id),
 minimum_order_net NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK(minimum_order_net >= 0),
 delivery_fee_net NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK(delivery_fee_net >= 0),
 free_delivery_threshold_net NUMERIC(14,4) CHECK(free_delivery_threshold_net >= 0),
 lead_time_days INTEGER NOT NULL DEFAULT 1 CHECK(lead_time_days >= 0),
 order_cutoff TIME,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO office_ordering.supplier_terms(supplier_id)
SELECT id FROM office_ordering.suppliers ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS office_ordering.product_aliases (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 product_id BIGINT NOT NULL REFERENCES office_ordering.products(id),
 alias TEXT NOT NULL,
 language_code VARCHAR(8),
 UNIQUE(product_id,alias)
);
CREATE TABLE IF NOT EXISTS office_ordering.import_rows (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 batch_id BIGINT NOT NULL REFERENCES office_ordering.import_batches(id) ON DELETE RESTRICT,
 source_row_number INTEGER NOT NULL CHECK(source_row_number > 0),
 source_item_code TEXT,
 raw_data JSONB NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','matched','rejected','imported')),
 validation_error TEXT,
 product_id BIGINT REFERENCES office_ordering.products(id),
 UNIQUE(batch_id,source_row_number)
);
CREATE INDEX IF NOT EXISTS import_rows_status_idx ON office_ordering.import_rows(batch_id,status);
CREATE TABLE IF NOT EXISTS office_ordering.stock_snapshots (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 store_id BIGINT NOT NULL REFERENCES office_ordering.stores(id),
 product_id BIGINT NOT NULL REFERENCES office_ordering.products(id),
 snapshot_at TIMESTAMPTZ NOT NULL,
 quantity NUMERIC(16,3) NOT NULL,
 batch_id BIGINT NOT NULL REFERENCES office_ordering.import_batches(id),
 UNIQUE(store_id,product_id,snapshot_at)
);
CREATE INDEX IF NOT EXISTS stock_snapshots_latest_idx ON office_ordering.stock_snapshots(store_id,product_id,snapshot_at DESC);
CREATE TABLE IF NOT EXISTS office_ordering.reorder_rules (
 store_id BIGINT NOT NULL REFERENCES office_ordering.stores(id),
 product_id BIGINT NOT NULL REFERENCES office_ordering.products(id),
 target_cover_days NUMERIC(8,2) NOT NULL DEFAULT 7 CHECK(target_cover_days >= 0),
 safety_stock_units NUMERIC(16,3) NOT NULL DEFAULT 0 CHECK(safety_stock_units >= 0),
 minimum_display_units NUMERIC(16,3) NOT NULL DEFAULT 0 CHECK(minimum_display_units >= 0),
 maximum_stock_units NUMERIC(16,3) CHECK(maximum_stock_units >= 0),
 enabled BOOLEAN NOT NULL DEFAULT true,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(store_id,product_id)
);
CREATE TABLE IF NOT EXISTS office_ordering.supplier_price_reviews (
 upload_id BIGINT PRIMARY KEY REFERENCES office_ordering.price_uploads(id),
 reviewer_staff_id BIGINT REFERENCES office_ordering.staff_accounts(id),
 reviewed_at TIMESTAMPTZ,
 note TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS office_ordering.order_recommendations (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 store_id BIGINT NOT NULL REFERENCES office_ordering.stores(id),
 product_id BIGINT NOT NULL REFERENCES office_ordering.products(id),
 generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 suggested_units NUMERIC(16,3) NOT NULL CHECK(suggested_units >= 0),
 available_stock_units NUMERIC(16,3),
 daily_demand_units NUMERIC(16,3),
 explanation JSONB NOT NULL DEFAULT '{}'::jsonb,
 status TEXT NOT NULL DEFAULT 'suggested' CHECK(status IN ('suggested','accepted','ignored')),
 created_by TEXT NOT NULL DEFAULT 'planner'
);
CREATE INDEX IF NOT EXISTS recommendations_store_date_idx ON office_ordering.order_recommendations(store_id,generated_at DESC);
CREATE TABLE IF NOT EXISTS office_ordering.order_draft_suppliers (
 order_id BIGINT NOT NULL REFERENCES office_ordering.order_drafts(id),
 supplier_id BIGINT NOT NULL REFERENCES office_ordering.suppliers(id),
 estimated_delivery_fee NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK(estimated_delivery_fee >= 0),
 estimated_delivery_date DATE,
 PRIMARY KEY(order_id,supplier_id)
);
CREATE TABLE IF NOT EXISTS office_ordering.order_line_reviews (
 order_line_id BIGINT PRIMARY KEY REFERENCES office_ordering.order_lines(id),
 recommended_cases NUMERIC(14,3),
 approved_cases NUMERIC(14,3),
 note TEXT,
 reviewed_by BIGINT REFERENCES office_ordering.staff_accounts(id),
 reviewed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS price_uploads_supplier_date_idx ON office_ordering.price_uploads(supplier_id,uploaded_at DESC);
CREATE INDEX IF NOT EXISTS supplier_products_product_idx ON office_ordering.supplier_products(product_id,supplier_id);
CREATE INDEX IF NOT EXISTS sales_daily_product_idx ON office_ordering.sales_daily(store_id,product_id,sale_date DESC);
CREATE INDEX IF NOT EXISTS order_drafts_store_date_idx ON office_ordering.order_drafts(store_id,created_at DESC);
CREATE INDEX IF NOT EXISTS incoming_deliveries_ref_idx ON office_ordering.incoming_deliveries(store_id,reference);
CREATE OR REPLACE VIEW office_ordering.v_approved_supplier_prices AS
 SELECT DISTINCT ON (sp.id)
 sp.id AS supplier_product_id,s.id AS supplier_id,s.name AS supplier,
 sp.supplier_code,p.id AS product_id,p.msp_item_code,p.description,
 sp.units_per_case,pr.net_case_price,pr.currency,pr.effective_at,pu.id AS upload_id
 FROM office_ordering.supplier_products sp
 JOIN office_ordering.suppliers s ON s.id=sp.supplier_id AND s.active
 JOIN office_ordering.products p ON p.id=sp.product_id
 JOIN office_ordering.supplier_prices pr ON pr.supplier_product_id=sp.id
 JOIN office_ordering.price_uploads pu ON pu.id=pr.upload_id AND pu.status='approved'
 WHERE sp.active
 ORDER BY sp.id,pr.effective_at DESC,pr.id DESC;
CREATE OR REPLACE VIEW office_ordering.v_genuine_wastage AS
 SELECT store_id,product_id,movement_date,quantity,cost,reason,import_batch_id
 FROM office_ordering.stock_movements
 WHERE source='wastage'
 AND (lower(reason) LIKE '%damaged%' OR lower(reason) LIKE '%out of date%' OR lower(reason) LIKE '%expired%');
CREATE OR REPLACE VIEW office_ordering.v_pending_delivery_units AS
 SELECT store_id,product_id,SUM(received_quantity) AS physically_received_not_posted_units
 FROM office_ordering.incoming_deliveries
 WHERE status='physically_received'
 GROUP BY store_id,product_id;
-- Seed known stores; amend store names/codes to match MSP before production.
INSERT INTO office_ordering.stores(store_code,name) VALUES
 ('0365','Hounslow'),('0766','Perivale'),('0650','East Ham'),
 ('0665','Hayes'),('0566','Gravesend'),('0602','Watford'),('0388','Streatham')
ON CONFLICT(store_code) DO NOTHING;
COMMENT ON VIEW office_ordering.v_pending_delivery_units IS
 'Physical deliveries not yet posted in MSP. Only include when snapshot timing and posting reconciliation confirm they are absent from book stock.';
COMMENT ON VIEW office_ordering.v_approved_supplier_prices IS
 'Latest approved net case price for each verified supplier-product mapping.';

COMMIT;
