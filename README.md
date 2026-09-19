# CPH Consult — independent replacement

ระบบใหม่สำหรับติดตั้งบน server ของหน่วยงาน แยกจากระบบเดิมอย่างสมบูรณ์

## Status

Phase 0: repository setup and source inventory. No runnable replacement application yet.
Provisional stack from the handoff: React/Vite, Express/TypeScript, PostgreSQL, Socket.IO.
Frontend redesign and server specifications remain to be confirmed.

## Migration agreement

- Keep the existing system live throughout development and rehearsal.
- Transfer all historical business data and file contents with verified identity and reference mappings.
- Stop source writes for the final consistent transfer; open the replacement only after validation and acceptance.
- Retire the old service after cutover, retaining a restricted recovery copy for an agreed period.
- No two-way synchronization is planned. Post-cutover rollback must reconcile new writes.
- Patient data, credentials, exports and uploaded files must never enter this repository.

## Source reference

Legacy repository: aiexpertdent2024-ctrl/cphdent-consult-network.
Reference commit: `56ba8b18ff58bfa5c58dc0b9ca555f993049298c`.
This is a design/reference baseline, not proof of the currently deployed revision or live database schema.

## Source-only inventory

Run from this directory with Node.js and Git available:

```powershell
node tools/inventory-source.mjs ../cphdent-consult-network
```

The tool reads only named SQL source files from the fixed Git revision and writes schema object names, locations and hashes to `docs/source-inventory.json`. It never connects to a database or reads working-tree environment files. This is a discovery index, not an effective SQL catalog or migration executable.

See `docs/READINESS.md` for remaining work and `docs/handoff/` for the original design documents.
