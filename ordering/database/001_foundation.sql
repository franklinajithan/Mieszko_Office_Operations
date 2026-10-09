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
