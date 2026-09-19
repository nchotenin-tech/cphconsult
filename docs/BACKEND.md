# Backend platform slice

## Run locally

Use Node.js with npm. The production runtime proposal remains Node 24; the current workstation uses Node 20.19.5, so local checks are not production-runtime certification.

```powershell
npm ci
npm test
npm run dev
```

Defaults: `127.0.0.1:3100`. No environment file is loaded automatically. Set `PORT`, `HOST` and optional `DATABASE_URL` through the process environment. Do not put credentials on command lines, in Git, or in frontend variables. Without DATABASE_URL the process serves liveness but performs no database connection, including no fallback to ambient PG environment variables.

Build/start: `npm run build`, then `npm start`. SIGINT/SIGTERM stop accepting requests and close the database pool, with a ten-second shutdown deadline.

## Implemented endpoints

| Endpoint | Contract |
|---|---|
| GET /health/live | 200: process is serving requests |
| GET /health/database | 200: basic connection/role checks pass; 503: unconfigured, inaccessible, excessively privileged or query fails |
| GET /health/ready | Always 503 until application schema, authentication and policies are implemented |

Database diagnostics never expose credentials, SQL, hostnames or patient information. A successful dependency check does not certify RLS policies, role grants, schema correctness or production readiness. Initial role checks reject membership in privileged roles and ownership of public/app tables. Full role/grant/policy verification remains required on real PostgreSQL.

There are no clinical routes, public registration, sessions, imported data, external notifications or file storage in this slice. Unknown routes return JSON 404. No proxy trust or cross-origin access is configured. Keep the process local during development.

## Validation boundaries

The HTTP tests start a real local server with a controlled database probe. They cover status semantics, secret redaction and absent clinical endpoints. Configuration and missing-database behavior are also tested. These are not PostgreSQL integration tests; no production connection is used. Docker's Linux engine was unavailable at the last check.

Next: dedicated synthetic PostgreSQL environment, migrations/role separation, runtime RLS integration tests, identity/session schema and authentication API contracts. Clinical mutation porting waits for effective permission and column mapping review.

Implementation references: [Express installation](https://expressjs.com/en/starter/installing/) and [node-postgres transactions](https://node-postgres.com/features/transactions). Future transactions must use one checked-out client for BEGIN, work, COMMIT/ROLLBACK and release.
