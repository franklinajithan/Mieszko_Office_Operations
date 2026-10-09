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
