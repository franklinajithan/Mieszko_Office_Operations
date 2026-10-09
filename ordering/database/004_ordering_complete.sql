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
