# Local login screen and test account

The React/Vite screen is served by Express at `/` after `npm run build`. It uses same-origin login/me/logout, keeps the CSRF token only in component memory, and never stores credentials or session tokens in localStorage. The session cookie remains HttpOnly. Reload restores the account from `/auth/me`.

Create the explicitly synthetic account once, from PowerShell in the project:

```powershell
.\tools\create-test-user.ps1
```

First enter the local PostgreSQL **postgres** administrator password, then choose and repeat a new **application** test password (at least 12 characters). These are different passwords. Neither is written to a file or command-line argument; both exist in process memory/environment while the child process runs. The script restores prior environment values on exit.

The script is fixed to 127.0.0.1:5432/cphconsult_dev, checks the administrator and auth migration, creates tester@example.invalid and an Argon2id verifier in one transaction, and refuses to overwrite an existing account. It creates no dentist mapping, clinical role, admin rights or patient data. This is local synthetic provisioning only, not a production registration/activation flow.

After `test_account_created: tester@example.invalid`, restart the old API with Ctrl+C and `tools/start-local.ps1`. Enter the runtime DB password for the launcher. Open http://127.0.0.1:3100 and log in as tester@example.invalid with the new application password. Test reload and logout. There is no clinical dashboard yet.

The new synthetic user has must_change_password=false because its password was chosen directly for this test. Existing must-change accounts show a restriction notice; password-change UI and clinical access are not implemented.
