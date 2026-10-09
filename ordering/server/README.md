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
