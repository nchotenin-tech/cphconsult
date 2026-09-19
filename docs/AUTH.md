# Authentication API — first implementation

Implemented: POST `/api/v1/auth/login`, GET `/api/v1/auth/me`, POST `/api/v1/auth/logout`.
Clinical readiness remains false. There is no login UI, registration, password-change or recovery endpoint yet. No real account has been imported or provisioned.

## Local installation

In pgAdmin, connect as postgres to cphconsult_dev and run all of `ops/postgres/05-auth-functions.sql`. Expected result: `auth_functions_created`. This creates narrowly scoped auth functions and their owner policies; it does not insert users or passwords. Existing runtime table restrictions remain.

Stop the old API with Ctrl+C and restart `tools/start-local.ps1` after applying the migration. The normal local origin is http://127.0.0.1:3100. A browser client must use the same configured APP_ORIGIN; localhost and 127.0.0.1 are different origins. Passwords belong only in local prompts or the eventual authenticated UI, never in chat or Git.

## Contract

- Login: JSON `{ "login": "user@example.invalid", "password": "..." }`, with matching Origin. Returns user `{id, login, mustChangePassword}` and csrfToken. Incorrect/unknown/inactive account returns the same 401 response.
- Session: opaque random 256-bit token in HttpOnly, SameSite=Lax, Path=/ cookie; Secure for HTTPS. Only SHA-256 token/CSRF digests enter PostgreSQL. Production config requires HTTPS; plain HTTP is accepted only for localhost development.
- Me: session cookie required; returns the same public user fields and derived CSRF token. Inactive, expired or revoked session returns 401. Successful resolution extends idle expiry up to the absolute limit.
- Logout: matching Origin, cookie and X-CSRF-Token required; returns 204 and clears/revokes the session. Missing or invalid CSRF returns 403; no valid session returns 401.
- Lifetime: 8-hour absolute, 30-minute sliding idle. Re-login with the previous same-user cookie revokes the old token and issues a new one.
- Local rate guard: 10 login requests/IP/minute and at most 2 concurrent password verifications per process. Requires shared rate limiting and deployment-level controls before multi-instance production.

## Database trust boundary

Auth functions are SECURITY DEFINER with fixed search_path and explicit execute grants to runtime only. FORCE RLS stays enabled. Owner-only policies permit credential/account reads and session maintenance. Owner UPDATE-policy visibility is required by SELECT FOR SHARE; WITH CHECK false forbids actual account/credential updates through that policy. Ordinary runtime direct credential access remains denied.

The runtime credential is a trusted server secret: auth_lookup returns a verifier to the backend for Argon2id checking, and session creation trusts that backend verification. This does not defend against a compromised runtime credential. The credential must never reach a browser. mustChangePassword is returned but no clinical routes are enabled; enforcing password change before clinical access is a future gate.

## Verification

- Build and 16 HTTP/configuration/transaction tests passed with synthetic data.
- A disposable PostgreSQL 18 cluster on loopback port 55439 ran migrations 01, 03 and 05, then real HTTP login/me/logout/idle expiry/disabled-account tests using an actual runtime login. Result: `auth_postgres_http_checks_passed`. Direct password-table read remained denied.
- The first database run caught missing RLS row-lock visibility; the corrected migration passed the same test. The temporary cluster was stopped after both runs. Synthetic files stay under ignored `.local-tests/`.
- The user's own port-5432 database has not yet received migration 05. Real account activation, change/recovery flow, cleanup jobs, security/load review, frontend integration and clinical APIs remain unfinished.

Run unit/HTTP tests: `npm test`. Run Windows isolated PostgreSQL integration after build: `tools/test-auth-postgres.ps1` (requires PostgreSQL 18 binaries at the documented local path and free port 55439). This test uses a new empty cluster with local trust authentication only on loopback and stops it in finally; it never connects to port 5432.
