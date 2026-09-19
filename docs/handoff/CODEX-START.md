# ส่งต่องานไป Codex อีกเครื่อง

## สิ่งที่ผู้ใช้ต้องเตรียม

1. ให้เครื่องใหม่เข้าถึง private GitHub repository ด้วยบัญชีของตนเอง ไม่ส่ง token ผ่านแชท
2. Clone repository และตรวจว่ามี baseline commit `56ba8b18ff58bfa5c58dc0b9ca555f993049298c`
3. แตก ZIP เอกสารชุดนี้ แล้ววางใน `deployment/postgres-migration-handoff/` ของ checkout ใหม่ (ZIP มีเฉพาะเอกสาร ไม่มี source ทั้งแอป)
4. เปิด repository ใน Codex และวาง prompt ด้านล่าง

อย่าคัดลอก `.env`, browser profile, database backup หรือข้อมูลผู้ป่วยไปพร้อมเอกสาร การย้าย secrets/ข้อมูลจริงต้องผ่านช่องทางที่หน่วยงานอนุมัติภายหลัง

## Prompt พร้อมใช้

```text
พัฒนาระบบ CPH Consult รุ่นติดตั้งบน Linux ของหน่วยงาน โดยใช้ React เดิม + Node.js/Express + PostgreSQL + Socket.IO ตามเอกสาร deployment/postgres-migration-handoff/

อ่าน README.md, ARCHITECTURE.md, MIGRATION.md และ IMPLEMENTATION.md ทั้งหมดก่อนเริ่ม เอกสารนี้เป็นแบบออกแบบ ไม่ใช่โค้ด backend ที่ทำแล้ว และแทนคำแนะนำ MySQL จากเอกสาร handoff เก่าเฉพาะงานนี้

Source baseline คือ 56ba8b18ff58bfa5c58dc0b9ca555f993049298c ใน private repo aiexpertdent2024-ctrl/cphdent-consult-network ตรวจ git status และ commit ก่อนทำงาน ถ้า checkout ใหม่กว่า baseline ให้รายงานส่วนต่างและรักษางานผู้ใช้ ห้าม reset/hard checkout ทับงาน

ทำงานใน isolated checkout/branch codex/self-hosted-postgres ตามความเหมาะสม ห้ามแก้ production ปัจจุบัน ห้าม push/deploy/export ข้อมูลจริง/เปลี่ยน DNS/รีเซ็ตรหัส/เรียก Supabase mutation จนกว่าจะได้รับอนุมัติเฉพาะขั้น ไม่อ่านหรือแสดง secrets และ PHI ใน prompt/log/source/CI artifacts

เริ่ม Phase 0: ตรวจ schema/migration histories และ tests ใน repository สร้าง inventory effective SQL functions/RLS และ permission matrix จัดทำ OpenAPI กับ mapping schema โดยรักษา IDs, UTC timestamps, JSONB และสถานะเดิมใน phase แรก แล้วลงมือ Phase 1 ด้วย synthetic fixtures เท่านั้น รายงานข้อจำกัด server/domain/SMTP/Auth migration ที่ต้องถาม แต่ไม่หยุดงาน local ที่ไม่ต้องรอคำตอบ

รักษาพฤติกรรมล่าสุด: active Refer แชทต่อได้, การเปิด consult ใหม่ตามสิทธิ์ผู้รับหลัก, Shared Care ไม่มี global admin clinical override, invite ที่ยังไม่ตอบรับไม่เปิดรายละเอียดได้เพียงเพราะได้รับเชิญ, surgery summary แก้ได้ระหว่าง Refer ตามสิทธิ์เดิม, tracking click ส่ง status filter ที่ถูกต้อง และ reopen ไม่สร้างเคสซ้ำ

สร้าง regression tests ก่อน port mutation ตรวจ runtime PostgreSQL role จริงพร้อม RLS context ผ่าน transaction ห้ามใช้ superuser เพื่อให้ tests ผ่าน ใช้ durable outbox+idempotency+catch-up ไม่กล่าวอ้าง Socket.IO รับประกันข้อความเอง ทดสอบไฟล์ส่วนตัวและสิทธิ์ทั้ง HTTP/socket/replay

ผลลัพธ์แต่ละ phase ต้องมีโค้ด tests คำสั่งรัน รายงานสิ่งที่ผ่าน/ยังไม่ผ่าน และรายการงานถัดไป ชุด migration ต้องมี dry-run, manifest, resume/idempotency, verification และ rollback หลัง target รับ writes แล้ว ห้ามสรุปว่า migrate พร้อมใช้จนผ่าน rehearsal/restore และผู้ใช้อนุมัติ cutover
```

## Handoff contents verification

ZIP ต้องมี README.md, ARCHITECTURE.md, MIGRATION.md, IMPLEMENTATION.md, CODEX-START.md เท่านั้น ตรวจ SHA-256 ของ ZIP ตามที่เครื่องต้นทางส่งให้ เทียบด้วย `Get-FileHash` บน Windows หรือ `sha256sum` บน Linux
