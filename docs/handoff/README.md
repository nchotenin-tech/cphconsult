# CPH Consult — PostgreSQL migration handoff

จัดทำ 19 กันยายน 2026 | สถานะ: แบบระบบและแผน implementation ไม่ใช่ระบบใหม่ที่พร้อม production

## เริ่มอ่านที่นี่

ผู้ใช้เลือก Linux + Node.js/Express + PostgreSQL ใช้งานผ่านอินเทอร์เน็ตบนเซิร์ฟเวอร์หน่วยงาน คง React เดิม และใช้ Socket.IO แทน Supabase Realtime ไม่ติดตั้ง Supabase ทั้งชุดเป็นค่าเริ่มต้น

เอกสารชุดนี้แทนแนวทาง MySQL ใน `deployment/mysql-migration-handoff/` สำหรับงานย้ายรอบนี้ ไม่ใช้คำว่า OLD/NEW จากเอกสารเก่าเพื่อเลือกฐานข้อมูล: แหล่งข้อมูลที่อนุญาตให้วางแผนย้ายคือ Supabase project `ysbmlqwmvddskkummoim` เท่านั้น การ export จริงต้องได้รับอนุมัติแยก

Baseline source: `56ba8b18ff58bfa5c58dc0b9ca555f993049298c`
Repository: `https://github.com/aiexpertdent2024-ctrl/cphdent-consult-network` (private)
Branch at baseline: `codex/track-shared-care-after-consult`
Existing production: `https://cphconsult.vercel.app`

1. อ่าน `ARCHITECTURE.md` — โครงสร้าง สิทธิ์ API และ realtime
2. อ่าน `MIGRATION.md` — inventory, mapping, Auth, storage, cutover/rollback
3. อ่าน `IMPLEMENTATION.md` — ลำดับงานและ acceptance tests
4. ใช้ `CODEX-START.md` เป็น prompt ที่เครื่องใหม่

## สิ่งที่ทำแล้วและยังไม่ได้ทำ

- ตรวจ source, service calls, workflow predicates และรายชื่อ migrations ใน repository
- ออกแบบระบบเป้าหมายและแผนย้ายข้อมูล ไม่ได้ตรวจ schema production สดครบทุกตาราง
- ยังไม่ได้สร้าง Express server, target SQL migrations หรือ migration runner
- ยังไม่ได้ export/import ข้อมูล ทดสอบ restore ติดตั้ง server หรือ deploy
- โฟลเดอร์ backup ที่เคยเตรียมไว้ไม่ใช่หลักฐานว่ามี backup สำเร็จ ก่อน migrate ต้องสร้างและทดสอบใหม่

## คำถามที่ต้องได้คำตอบก่อนติดตั้งจริง

- Linux distribution/version, RAM/CPU/disk, สิทธิ์ Docker หรือ systemd, ผู้ดูแลและแพตช์
- โดเมนใหม่ DNS/TLS ใครดูแล; firewall และ outbound SMTP/Push/LINE
- ผู้ใช้พร้อมกัน ปริมาณไฟล์/ฐานข้อมูล วงเงินพื้นที่สำรอง และ maintenance window
- เก็บไฟล์ที่ local encrypted volume หรือ private S3-compatible storage ของหน่วยงาน
- SMTP ที่ส่งได้จริง; วิธีส่ง activation ให้บัญชีที่ใช้อีเมลสมมติ เช่น admin
- อนุมัติ RPO/RTO, อายุ backup, retention ข้อมูลผู้ป่วย และผู้ถือกุญแจเข้ารหัส
- มีระบบโทรในแอปที่ต้องคงไว้หรือไม่: ตรวจ implementation เดิมและ STUN/TURN ก่อนตัด scope

ไม่ต้องตอบครบเพื่อเริ่มเขียนและทดสอบด้วย synthetic data แต่ต้องตอบครบก่อน production go-live

## ขอบเขตความปลอดภัย

ห้ามใช้ credentials/source data จริงใน prompt, Git, screenshot, CI artifacts หรือ ZIP ส่งต่อ ห้ามอ่าน `.env*`, backups หรือข้อมูลผู้ป่วยเพื่อทำ inventory source โค้ดเท่านั้น
ห้าม deploy บน Vercel เดิม เปลี่ยน DNS รีเซ็ต password หรือเรียก source mutation โดยอนุมานจากคำสั่งให้พัฒนาระบบใหม่

## แหล่งอ้างอิงตรวจวันที่จัดทำ

- PostgreSQL support/version policy: https://www.postgresql.org/support/versioning/
- Node.js LTS: https://nodejs.org/en/about/previous-releases
- Socket.IO delivery guarantees: https://socket.io/docs/v4/delivery-guarantees/
- Socket.IO recovery: https://socket.io/docs/v4/connection-state-recovery/
- Supabase backup exclusions: https://supabase.com/docs/guides/platform/backups

ตรวจ version/patch ที่ยัง supported ใหม่เมื่อ implement; ห้ามตีความแบบนี้ว่า libraries ได้รับการติดตั้งหรือทดสอบร่วมกันแล้ว
