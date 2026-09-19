# Target architecture and contracts

## 1. Decisions

- Frontend: React/Vite เดิม; เพิ่ม API adapter ไม่ rewrite UX พร้อมย้ายฐานข้อมูล
- Backend: Node.js 24 LTS + Express 5 + TypeScript; PostgreSQL driver `pg`, versioned SQL migrations (เลือก migration tooling ที่รองรับ SQL functions/RLS และ pin lockfile)
- Database: PostgreSQL 17 latest supported minor เป็น baseline proposal; ต้องยืนยัน source version/extensions ก่อนเลือก target ห้าม target เก่ากว่า source โดยไม่มี compatibility test
- Realtime: Socket.IO 4, durable database outbox; ไม่พึ่ง memory recovery เพื่อรับประกันข้อความ
- Single origin ผ่าน Nginx TLS: `/` frontend, `/api/v1` Express, `/socket.io` Socket.IO
- Worker แยก process จาก API สำหรับ outbox, Push, LINE และ retry
- File store: private filesystem นอก web root บน encrypted volume สำหรับ single-server pilot; storage adapter เปลี่ยนเป็น private S3 ได้ภายหลัง
- Redis ไม่จำเป็นใน single API instance; หาก scale หลาย instance ต้องออกแบบ adapter, distributed rate limit/presence และ load balancer/sticky session ก่อน

```text
Browser / PWA
      | HTTPS (443)
    Nginx
      +-- React static build
      +-- Express API + Socket.IO -- PostgreSQL (private network only)
                 |                       |
            Private files           Durable outbox
                                         |
                                      Worker --> Push / LINE / SMTP
```

DB, file store, Redis (ถ้าใช้), metrics ห้ามเปิด public ports. Single-host pilot มี single point of failure ต้องมี off-host backup และ restore drill ไม่กล่าวอ้าง high availability

## 2. Proposed repository layout (create in isolated branch)

```text
src/                         existing UI + API adapters
server/src/auth/             sessions, credentials, recovery
server/src/policies/         case-scoped authorization
server/src/modules/          consults, messages, refer, shared-care,
                             invitations, reports, directory, support, files
server/src/realtime/         room authorization + replay
server/src/worker/           outbox + notification jobs
server/db/migrations/        reviewed standalone PostgreSQL DDL
server/test/                 DB integration + negative permission tests
tools/migration/             inventory/export/import/verify (implement later)
ops/                        Linux deployment, TLS, restore and monitoring
```

## 3. Data design: compatibility first

Phase 1 คง public business columns, IDs, arrays, JSONB, timestamptz และ workflow vocabulary เดิม เพื่อหลีกเลี่ยงเปลี่ยนรูปแบบข้อมูลพร้อมเปลี่ยน backend. ผู้ใช้ไม่ได้ห้าม JSONB หลังเลือก PostgreSQL. ห้าม normalize Refer/Shared Care ใหม่ในรอบ migration แรกโดยไม่อนุมัติ

IDs มีทั้ง text legacy และ UUID: ห้าม cast case/dentist IDs ทั้งหมดเป็น UUID. Timestamp เก็บ UTC แสดง Asia/Bangkok/พ.ศ. เฉพาะ UI. เก็บเลขเคสเดิมและตั้ง sequence/counter ให้ไม่ชน

ตารางใหม่ที่ต้อง implement ด้วย SQL migrations:

| Table | Contract |
|---|---|
| app_users | UUID account ID, unique dentist_id FK (ชนิดตรงต้นทาง), normalized unique login, password hash, status, must_change_password; no plaintext password |
| auth_identities | provider + source subject mapping to app_user; preserve legacy Auth UUID separately |
| sessions | hashed opaque session token, user FK, expiry, revoked_at; index expiry/user |
| account_recovery_tokens | hashed single-use token, purpose, expiry, used_at; rate-limited issuance |
| outbox_events | UUID event_id, aggregate type/id, version, event type, timestamp, minimal payload, lease/retry/delivery metadata |
| event_recipients | event/user linkage for authorized replay, per-user monotonic delivery sequence assigned after serialization; replay must not skip late commits |
| command_receipts | unique(actor_id, command_id), request hash, committed result; reject reuse with different payload |
| file_objects | UUID file ID, legacy bucket/key mapping, generated storage key, sha256, bytes, detected MIME, owner/case/step reference, state |
| migration_runs/items | manifest/run checksum, entity/source ID, validation state; unique source ID per target entity |

เพิ่ม version column ให้ aggregate ที่เปลี่ยนพร้อมกัน. FK/uniqueness/index ต้อง derive จาก source inventory จริง ห้ามใช้ตารางข้างต้นแทน schema ที่ตรวจแล้ว

## 4. Auth and authorization

ใช้ opaque session cookie `Secure`, `HttpOnly`, `SameSite=Lax`, TTL/idle expiry และ rotate หลัง login/privilege change. Session เก็บ hash ฝั่ง DB. CSRF token + Origin validation สำหรับ mutation; strict same-origin CORS. Socket handshake ต้องตรวจ session/Origin; reconnect ตรวจสิทธิ์ใหม่

App verifies authorization on every read, mutation, export, room join/replay and file fetch. อย่าเชื่อ dentist_id/hospital_id/role จาก request. ปฏิเสธ invitee ที่ยังไม่ accepted เว้นแต่มีสิทธิ์อื่นอยู่แล้ว. Notification link ไม่ bypass policy

RLS defense-in-depth: runtime role ไม่ใช่ owner/superuser และไม่มี BYPASSRLS. ใช้ pooled connection transaction + `SET LOCAL` identity ที่ server resolve จาก session เท่านั้น; rollback/release ทุกทางออก. Redesign `auth.uid()`, JWT claims, `authenticated`/`anon`, storage policies เป็น identity adapter ของระบบใหม่ ทดสอบ role จริงและ connection reuse. ห้าม disable RLS เพื่อให้ import/runtime ผ่าน

DDL owner/migration role แยกจาก runtime. Data importer เข้าถึง target staging เฉพาะ. `SECURITY DEFINER` functions ต้องตรวจ actor, fix search_path, revoke PUBLIC execute และ grant เฉพาะที่ต้องใช้. Worker privilege ต้องจำกัดและมี audit ไม่ใช้ superuser เป็นงานประจำ

Permission rules ต้องรวบรวมจาก JS + latest effective SQL definitions + regression tests ไม่ใช้ไฟล์ helper ใดไฟล์เดียวแทน policy ทั้งหมด:

- ต้นทาง/ปลายทาง/สาขา/ผู้รับหลัก/invitee/admin มีขอบเขตไม่เหมือนกัน
- `canManagePostConsult` มี admin override แต่ Shared Care clinical step ใช้ `isSharedCareDestination` ไม่มี global admin override
- Reopen consult: คงข้อจำกัดผู้รับหลักตาม effective trigger ไม่เพิ่ม admin/ต้นทางอัตโนมัติ
- Surgery summary: ตรวจ author/team permissions และการแก้ระหว่าง active Refer
- `canViewReferWorkflow` ต้องใช้ร่วมกับสิทธิ์มองเห็นเคส ไม่ใช่เพียงดู referStatus แล้วเปิดให้ทุกคน

## 5. API design to turn into OpenAPI before coding UI

All `/api/v1`, JSON request/response ไม่ได้หมายถึง DB ต้องเก็บ JSON. Validate server-side, bounded pagination, parameterized SQL. Errors: 401 unauthenticated, 403 unauthorized (or 404 conceal case), 409 stale version/invalid transition, 422 validation, 429 rate limit; generic 500 no PHI/SQL secrets

| Route family | Operations / boundary |
|---|---|
| /auth | login/logout/me/change-password/recovery; no public role selection |
| /hospitals, /dentists, /specialties | authorized directory, self profile, admin mutations; private identifiers separately restricted |
| /consults | cursor lists, scoped detail/create/update/delete using existing authority; no unrestricted status patch |
| /consults/:id/messages | paged history, send/edit/delete, read receipt; require command ID on sends |
| /consults/:id/commands | typed complete/reopen actions with expectedVersion; transaction + history + audit + outbox |
| /consults/:id/refer | plan, confirm appointment, cancel, finalize; explicit action DTOs |
| /consults/:id/shared-care | agree, add/cancel/submit/review/complete steps and finish according to existing state rules |
| /invitations/:id/respond | recipient only; invitation acceptance cannot mutate unrelated workflow |
| /files | authorized upload + finalize + download/delete; no arbitrary server path or remote URL fetch |
| /notifications | user-owned page, read/read-all, badge counts; durable state |
| /reports/network | hospital/specialty/province scope from server permissions, not client-supplied scope alone |
| /announcements, /support, /workflow-layout | retain current permissions and independent layout positions |
| /push/subscriptions | per authenticated user/device subscription lifecycle |
| /events | authorized catch-up by cursor; reset-required on expired retention |

Define complete request/response schemas and examples using synthetic data in implementation Phase 0. Consult detail must not embed every message/image inline. Keep existing case summary print, appointment print, image preview and Thai date formatting contracts

## 6. Realtime durability

Send workflow: client creates command UUID -> API validates actor/state -> transaction locks aggregate, checks expectedVersion, inserts message + notification + outbox + command receipt -> COMMIT -> acknowledges persisted result -> worker emits to authorized rooms. Same command UUID retry returns same message, not duplicate

Events: `message.created/updated/deleted`, `consult.updated`, `invitation.updated`, `notification.updated`, `dashboard.invalidated`; envelope eventId, aggregateId, version, occurredAt. Emit minimum necessary data. Room membership assigned by server and refreshed/revoked when permission changes; verify recipients at delivery and replay

Outbox retries with bounded backoff/lease expiry; process crash after send can duplicate delivery, so client dedupes event IDs and ignores old aggregate versions. Do not claim exactly-once network delivery. Avoid global auto-increment event ID as unsafe high-watermark across uncommitted concurrent transactions; serialize per-user published stream or replay from durable receipt state with overlap and dedupe

On reconnect/tab foreground: refresh session/authorization, catch up events, refetch current lists/unread counts; history remains canonical in DB. Recovery expiry returns snapshot/resync, never silent loss. Read receipts are explicit authenticated actions, not receipt of socket event. Existing messages retain original createdAt; server UTC clock for new writes

Closed/background PWA needs Web Push, not socket. New origin usually requires reinstall/re-subscribe permission; queue must not resend historical notifications during import. Push/LINE payload should avoid PHI and link to authenticated case. Notification transport delivery is not proof of read. Reuse subscription only where origin/key/browser compatibility is verified

Uploads go over authenticated HTTP with size/type/signature checks, quota, generated keys and malware policy; private Nginx internal redirect or authorized stream. No public static directory for patient files. Reauthorize every download; legacy URLs mapped to file IDs, not trusted as executable/fetchable destinations

## 7. Operations

Nginx must support WebSocket upgrade and timeouts. Runtime unprivileged, secrets via protected files/secret manager (never VITE env), bounded DB pool, graceful shutdown, liveness/readiness, process restart via systemd or approved containers. API/worker version deployed together with backward-compatible migrations

Metrics: message persistence latency, outbox age/failures, reconnect/resync errors, DB locks/pool saturation, disk usage, backup last success, file checksum failures. Log correlation IDs, not message content/passwords/patient details. Access audit encrypted/restricted

Proposed objectives requiring IT approval: DB RPO <= 15 min with WAL archiving, matching file snapshot/version backup, RTO <= 4h after a measured restore drill. If pilot only daily backup, clearly declare potential loss up to 24h, not 15 min. Encrypted off-host backups, independent key custody, scheduled restore testing required
