# Local clinical demo

After installing migration 06, open pgAdmin Query Tool as `postgres` in `cphconsult_dev` and run the entire `ops/postgres/07-local-clinical-demo.sql` file. Success returns `clinical_demo_created`.

This explicitly adds synthetic hospitals, dentists, six cases and invitations, and maps the existing active `tester@example.invalid` account to the synthetic sender. The password is unchanged and no admin role is assigned. All clinical tables must be empty and the tester must have no existing dentist mapping. Repeated runs or collisions fail transactionally without overwriting data. After an error, execute ROLLBACK to leave the failed transaction. Do not delete existing data to bypass the guard.

Restart `tools/start-local.ps1` to build/serve the latest frontend. Sign in at http://127.0.0.1:3100 using the existing tester password. The list should show six fictional patients; open each case and return to the list. Refresh preserves the session. Logout clears the clinical screen. Accounts without a dentist mapping see an empty list.

The UI supports scoped list, cursor pagination, basic details, loading/error/empty states and expired-session handling. Attachments, chat, edits, invitation acceptance and full workflow details are not yet available. No production data has been imported.

The list now supports All / Pending / Active / Completed consultation filters. Filtering happens in PostgreSQL before pagination with the same RLS policies. Switching filters resets pagination; returning from details retains the filter. Completed consultation does not mean Refer or Shared Care is finished. The six fixtures yield 6 / 1 / 1 / 4 rows respectively. No new SQL migration is needed; restart the API and reload the browser after updating code.

Browser validation of the initial read UI: all six case details opened successfully, returning to the list worked, and the session survived a full reload. Status-filter browser validation must be performed against the restarted API.

Validation: `npm test` builds both server and UI and runs 28 tests. `tools/test-auth-postgres.ps1` also exercises the demo SQL on an isolated database with rollback, verifies all six cases and tester mapping, and checks that a second run is rejected. Browser interaction remains a separate manual check.
