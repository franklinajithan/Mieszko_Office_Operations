# Mieszko Office Ordering — local PostgreSQL foundation

Development branch: `feat/local-postgres-ordering`. This module is isolated under `ordering/`; it does not change existing production application routes.

## Local Windows PostgreSQL setup
1. Install PostgreSQL locally.
2. Create a database `mieszko_ordering` and a dedicated application login with a strong password.
3. Run `ordering/database/001_foundation.sql` against that database using psql or pgAdmin.
4. Keep database credentials in a local environment file (never commit them).
5. Back up PostgreSQL regularly to storage outside the project directory.

Example connection URL (placeholder only):
`postgresql://mieszko_app:REPLACE_ME@localhost:5432/mieszko_ordering`

## Data model
- One MSP item code maps to multiple barcodes.
- Supplier codes are unique **within** each supplier and can map to the same MSP product.
- Supplier product mappings may remain null until verified.
- Price uploads require approval; price history is retained.
- Sales are aggregated per store/product/day to avoid unnecessary transaction volume.
- Draft order lines lock their price for auditability.

## Next implementation steps
- Server-side database connection and migrations
- Authenticated Excel upload, validation and mapping review
- Cheapest eligible supplier allocation using equivalent unit cost, stock, minimum order, delivery dates and charges
- Order review, approval and supplier-specific export
- MSP import workflow with idempotency and source-file audit

Do not send purchase orders automatically until approval and validation are implemented.
