# Install the Mieszko Ordering PostgreSQL database

The complete install script is [MIESZKO_ORDERING_FULL_SETUP.sql](./MIESZKO_ORDERING_FULL_SETUP.sql). It combines migrations 001–004 in order.

## One-time installation (Windows)

1. Install PostgreSQL 15 or later and remember your postgres administrator password.
2. Create a **new empty** database called `mieszko_ordering` using pgAdmin, or run:

   ```powershell
   createdb -U postgres mieszko_ordering
   ```

3. Open PowerShell in this folder and run:

   ```powershell
   psql -v ON_ERROR_STOP=1 -U postgres -d mieszko_ordering -f .\MIESZKO_ORDERING_FULL_SETUP.sql
   ```

   If `psql` is not on PATH, use the full PostgreSQL `bin\psql.exe` path.

4. Verify the database:

   ```sql
   SELECT COUNT(*) AS tables FROM information_schema.tables
   WHERE table_schema = 'office_ordering' AND table_type = 'BASE TABLE';
   SELECT store_code,name FROM office_ordering.stores ORDER BY store_code;
   SELECT name FROM office_ordering.suppliers ORDER BY name;
   ```

5. Configure the separate local ordering API with `ORDERING_DATABASE_URL`, `ORDERING_API_TOKEN`, and `ORDERING_APPROVAL_TOKEN`. Never commit their values.

## Important

- The SQL **creates the schema only**. It does not install PostgreSQL or connect the Vercel UI to the local API.
- The setup is intended for a new empty database. Do not use it as an automatic upgrade of an existing populated database without reviewing migration history and backing up first.
- Supplier prices, products and actual sales are **not seeded**; only supplier and store reference records are.
- The API and UI are still under development; run database migrations and end-to-end tests before real orders.
- PostgreSQL backups, staff role enforcement and secure office-to-web connectivity must be configured before production use.
