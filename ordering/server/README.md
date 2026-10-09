# Local PostgreSQL API — development service

This service is intentionally **not deployed on Vercel**. It runs on the Windows machine hosting PostgreSQL and listens on 127.0.0.1 only.

1. Install PostgreSQL and create `mieszko_ordering`.
2. Apply `ordering/database/001_foundation.sql`, then `002_inventory_imports.sql`.
3. In this directory run `npm install`.
4. Set `ORDERING_DATABASE_URL` and a random `ORDERING_API_TOKEN` of at least 32 characters as Windows environment variables. Never commit credentials.
5. Run `npm start`.

Endpoints: authenticated GET `/health`, GET `/products`, GET `/supplier-offers`, POST `/product-mappings`, POST `/price-batches`.

All requests require `Authorization: Bearer <ORDERING_API_TOKEN>`. Price batches are stored as **pending** and do not affect approved price selection until a separately audited approval workflow is implemented. No order-sending endpoint exists.

This is a foundation, **not** a production-ready multi-user API. It has no office-user identity/role integration yet. Do not expose port 4317 to the public internet, embed its token in browser JavaScript, or connect Vercel directly to the private office host. A secured office API gateway, staff-level authorisation, migrations and backups are required before deployment.

## Price approval and draft workflow

Apply `ordering/database/003_price_approvals.sql` after migrations 001 and 002.

Use a separate random `ORDERING_APPROVAL_TOKEN` (32+ characters) for approving or rejecting uploaded prices. Approval requests require both the normal bearer token and `X-Approval-Token`. Keep both on the local server, never in browser code.

- `GET /price-batches`: recent uploaded batches and statuses.
- `GET /price-batches/:id`: review individual mapped price lines.
- `POST /price-batches/:id/approve` or `/reject`: body `{"reviewedBy":"office reviewer","note":"Checked against supplier list"}`. A batch can be reviewed only once. Audit events are recorded.
- `POST /order-drafts`: body `{"storeCode":"0365","lines":[{"supplier":"Spizarnia","supplierCode":"SP-1005","mspItemCode":"12345","cases":2}]}`. Requires approved offers; locks case prices in a transaction. **Does not send an order.**
- `GET /order-drafts`: recent saved drafts with store and net total.

**Security boundary:** The local API currently uses service tokens, not individual staff sessions. The `reviewedBy` value is a supplied label, not verified identity. Before real use, integrate staff role checks and verified audit identities. Do not forward tokens to the Vercel client. The Vercel UI is not connected to this localhost service yet.

## Windows quick start for the new database

After installing the full SQL schema in PostgreSQL 18, open PowerShell inside `ordering/server` and run:

```powershell
powershell -ExecutionPolicy Bypass -File .\\start-local-windows.ps1
```

Defaults: host `127.0.0.1`, port `5432`, database `mieszko_office`, user `postgres`. The launcher asks for the PostgreSQL password without saving it, installs Node dependencies, generates temporary service tokens and checks the authenticated API health endpoint. Keep the PowerShell window open while using the API. No credentials are written to the repository.

**Important:** This confirms the **local ordering API** can reach PostgreSQL. It does not configure or repair the existing Next.js login (which currently uses Supabase), and does not connect the browser UI to the API. The API is localhost-only; do not expose it to the internet.
