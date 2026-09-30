# Runbook: Hermes Agent ↔ Gemini Antigravity สำหรับ APP01–APP09

**Owner:** เจ้าของโปรเจกต์ Smart Factory 9+1
**ใช้เมื่อ:** เริ่มหรือทำต่อหนึ่งงานพัฒนาใน APP01–APP09
**ปรับปรุงล่าสุด:** 2026-09-29
**สถานะตัวอย่างปัจจุบัน:** APP02MMO — copy chart file ข้ามโฟลเดอร์

## วัตถุประสงค์

ให้ Hermes รับงานและส่งงานไปยัง Gemini Antigravity โดยใช้เส้นทางที่ตั้งค่าไว้แล้วอย่างรวดเร็ว ไม่เริ่มตรวจยอดเครดิต โทเคนคงเหลือ หรือขอภาพหน้า Usage ก่อน/หลังงานทุกครั้ง และไม่เอาการตรวจดังกล่าวมาเป็น Gate ถ่วงงาน APP01–APP09

เอกสารนี้เป็น workflow สำหรับงาน DEV ไม่ใช่คำอนุญาตให้เปิด AI Credit Overages, ใช้ paid/API fallback, แก้ Production, เปลี่ยน schema/data, commit, push หรือ deploy โดยอัตโนมัติ หากโมเดลตอบว่าโควตาหมด ให้หยุดและแจ้ง Owner; **ห้ามสลับไปใช้เครดิตหรือผู้ให้บริการที่มีค่าใช้จ่ายเอง**

## เส้นทางมาตรฐานที่มีอยู่

| ขั้น | โปรไฟล์/ผู้รับผิดชอบ | งาน |
|---|---|---|
| Intake/route | `sf-manager` — GPT-6-sol high ผ่าน Codex OAuth | อ่าน requirement, กำหนด Task และ scope แบบ read-only |
| Implement | `sf-implementer` — Gemini 3.8 Flash high ผ่าน Antigravity bridge | เขียนเฉพาะไฟล์ DEV ที่อนุมัติ |
| Review | `sf-reviewer` — Gemini 3.1 Pro high ผ่าน Antigravity bridge | ตรวจ diff อิสระแบบ read-only และส่งข้อพบ |
| Final QA | Codex ใน Project | ตรวจ scope, test, lint/build ตามความเสี่ยง, และรายงานผล |

การทดสอบ Hermes แบบ isolated เคยผ่าน manager → implementer → reviewer → final QA แล้ว แต่ **ไม่ถือว่าทุก Kanban Task หรือทุกแอปผ่านอัตโนมัติ**. MoA/auxiliary และ paid fallback ถูกจัดเส้นทางไว้แล้วตามบันทึกโปรเจกต์; ไม่ต้องตรวจซ้ำทุกรอบถ้าไม่มีการเปลี่ยน config หรือข้อผิดพลาดจริง

## สิ่งที่ต้องมีเพียงครั้งเดียวต่อหนึ่งงาน

- [ ] ระบุ `APP_ID`, requirement และ acceptance criteria ชัดเจน
- [ ] มี Task ID และ DEV workspace ที่ตรงกัน; ไม่ใช้ Task เก่าหรือ workspace อื่นโดยอนุมาน
- [ ] มี Scope Gate ระบุไฟล์ที่แก้ได้; Cloud Copy Gate เฉพาะเมื่อจำเป็นต้องส่งไฟล์ขึ้น workspace ใหม่
- [ ] อ่านสถานะจริงของ Task, workspace และ `git status` ก่อนแก้ เพื่อไม่เขียนทับงานเดิม
- [ ] Production WebApp ใช้งานต่อได้ตลอด; DEV และ Production แยกกัน

**ห้ามเพิ่ม checklist ตรวจเครดิต/โทเคน:** ไม่เรียก `/usage`, `/quota`, `/credits`, ไม่ขอภาพ Models & Usage, ไม่อ่าน ledger หรือเปอร์เซ็นต์คงเหลือ และไม่ต้องยืนยัน `useG1Credits=false` ซ้ำทุก Task จากยอดก่อน/หลัง ให้ยึดการตั้งค่ากลางที่บันทึกไว้จนกว่าจะมีเหตุเปลี่ยน config หรือระบบแจ้งข้อผิดพลาดจริง

## ขั้นตอนปฏิบัติ

### 1. Intake และ scope

บันทึก APP ID, Task ID, workspace, ไฟล์ที่อนุมัติ, acceptance criteria และข้อห้ามใน Task เดียว ระบุความสัมพันธ์กับ Task เดิมหากเป็นงานต่อเนื่อง แต่ไม่สร้าง Task ใหม่หรือคัดลอกชุด DEV ซ้ำเมื่อ Task/workspace เดิมใช้ได้

**ผลที่คาดหวัง:** implementer เห็นขอบเขตสั้นและชัด มี path จริงที่ตรวจได้
**หากไม่ผ่าน:** ถามเฉพาะข้อมูล/การอนุมัติที่ขาดและมีผลต่อขอบเขตจริง ไม่ย้อนกลับไปตรวจเครดิต

### 2. ส่งงานเข้า Gemini implementer

ใช้ `sf-implementer` ใน DEV workspace ที่อนุมัติ และส่ง context เท่าที่จำเป็น: requirement, exact paths, snippets หรือช่วงบรรทัดที่เกี่ยวข้อง, acceptance criteria และข้อห้าม หลีกเลี่ยงการยัดประวัติ Kanban/ผล Task แม่/ไฟล์ทั้งก้อนลง prompt

**ผลที่คาดหวัง:** เปลี่ยนเฉพาะไฟล์ใน Scope Gate และสรุป diff
**หาก bridge แจ้ง `prompt exceeds safe command limit`:** หยุด retry prompt เดิม ย่อเป็น microtask ต่อไฟล์/ช่วงบรรทัดใน workspace เดิมตาม scope ที่อนุมัติ แล้วบันทึกว่าเป็นเส้นทาง compact direct session แทน Kanban worker; ไม่สร้าง Task/Cloud Copy ใหม่เอง หากการเปลี่ยนเส้นทางกระทบ Gate ที่ผูกกับ Task ID ให้ขอเฉพาะ Gate นั้น

### 3. Independent review

ส่ง diff และ acceptance criteria ให้ `sf-reviewer` อ่านอย่างเดียว แก้เฉพาะข้อพบที่มีหลักฐานโดยส่งกลับ implementer ใน scope เดิม ไม่ให้ reviewer เป็น code writer

**ผลที่คาดหวัง:** reviewer ระบุ PASS หรือรายการแก้ที่ชี้ไฟล์/บรรทัดได้
**หากไม่ผ่าน:** ส่งเฉพาะข้อพบนั้นกลับไป ไม่รัน intake/route/เครดิตซ้ำ

### 4. Codex Final QA และ handoff

ตรวจ `git diff`/ขอบเขต, รัน tests ที่เกี่ยวข้อง, lint/build ตามความเสี่ยง และตรวจ UI เฉพาะฟีเจอร์ที่ต้องโต้ตอบ บันทึกผลและข้อจำกัดใน `CHANGELOG_AI.md`/`PROJECT_CONTEXT.md` ตามธรรมเนียมแอปนั้น ส่งผลให้ Owner ดูก่อน action ที่ต้องมี Gate แยก เช่น local Source-of-Truth apply, commit, push, deploy, Production data/schema

**ผลที่คาดหวัง:** รายงานไฟล์ที่เปลี่ยน, test ผ่าน/ไม่ผ่าน, reviewer verdict, สิ่งที่ยังไม่ทำ
**หากไม่ผ่าน:** แก้เฉพาะ failure ที่ตรวจพบแล้วทดสอบจุดนั้นใหม่ ไม่วน preflight ทั้งระบบ

## Prompt สั้นสำหรับเริ่มงานใหม่ (คัดลอกแล้วเติมค่า)

```text
APP_ID: [APP01–APP09]
Requirement: [ผลลัพธ์ที่ผู้ใช้ต้องการ]
Hermes Task ID: [Task ID จริง]
DEV workspace: [absolute path จริง]
Approved edit paths: [รายชื่อไฟล์จริง]
Acceptance criteria: [เงื่อนไขสำเร็จที่วัดได้]
Existing evidence: [Scope/Copy Gate และผลทดสอบที่มีอยู่; ไม่ตรวจซ้ำโดยไร้เหตุ]

ใช้ workflow Hermes sf-manager → Gemini Antigravity sf-implementer →
Gemini Antigravity sf-reviewer → Codex Final QA. แก้เฉพาะ DEV scope;
Production WebApp ต้องใช้ได้ต่อเนื่อง. ห้ามตรวจเครดิต/โทเคนคงเหลือ,
ห้ามขอภาพ Usage, ห้ามเปิด AI Credits/paid fallback เอง. หากโควตาหมด
หรือ route ล้มเหลวจริง ให้หยุดและรายงาน. อย่าทำ commit/push/deploy,
Production data/schema หรือขยาย scope โดยไม่มี Gate เฉพาะ.
ใช้ context สั้น; ถ้า bridge เกิน safe command limit ให้แยก microtask
ใน workspace/scope เดิมและรายงานเส้นทางที่ใช้. เริ่ม implement ทันที
เมื่อ Gate งานนี้ครบ; อย่าวนตรวจสิ่งที่ยืนยันแล้ว.
```

## ตรวจผล/แก้ปัญหา

| อาการ | ทำทันที |
|---|---|
| bridge ไม่ healthy หรือ route ผิดจากที่บันทึก | หยุด model call; ตรวจเฉพาะ route/config ที่ผิด และขอ Central Config Gate หากต้องแก้ |
| prompt ใหญ่เกิน bridge limit | ย่อ context และแบ่ง microtask; ไม่ retry payload เดิม |
| Gemini แจ้ง quota/rate limit | หยุดและแจ้ง Owner; ไม่เปิดเครดิตหรือ paid fallback |
| Task ID/workspace ไม่ตรง Gate | หยุดเฉพาะ Task นั้นและขอ Gate สำหรับ ID/path ใหม่ |
| test/review ไม่ผ่าน | แก้เฉพาะจุดที่ล้มเหลว แล้วรัน check ที่เกี่ยวข้องซ้ำ |
| Production WebApp มีปัญหา | หยุด release/DEV action ที่เสี่ยง และใช้ rollback/release Gate ของแอปนั้น |

## Rollback และ escalation

ก่อนแก้ให้เก็บ diff/backup ที่เหมาะกับไฟล์เป้าหมาย งาน DEV ที่ล้มเหลวต้องรักษา workspace และ source เดิมไว้เพื่อ review; อย่าใช้ `git reset --hard` หรือคืนทั้ง Kanban DB เพื่อย้อน Task เดียว การ rollback การตั้งค่ากลาง/Production ต้องใช้ Gate และ backup เฉพาะที่อนุมัติ แจ้ง Owner เฉพาะเมื่อ scope, route, workspace, data หรือ release boundary เปลี่ยนจริง

## APP02MMO ณ 2026-09-29

- งาน: copy chart file ข้าม folder โดยต้นฉบับยังอยู่ และ same-folder copy ยังใช้ได้
- Task ใหม่ `t_fcac0037`, child implementer `t_16246443`; Task เก่า `t_88a2426b` ห้ามรัน
- DEV workspace: `/opt/data/workspace/hermes-production/app02mmo/copy-chart-dev-20260928-163104`
- ชุด DEV 11 ไฟล์เคยตรวจ SHA-256 ตรง 11/11 แล้ว; ไม่คัดลอกซ้ำ
- Kanban worker เคยติด bridge safe-command limit; compact direct implementer sessions แก้ store/UI/tests ใน workspace นี้ครบแล้ว reviewer ให้ PASS จาก unified diff แบบสั้น และ Codex นำ change เข้าสู่ local Source-of-Truth พร้อม `npm test` 207/207, build ผ่าน; ยังไม่ deploy หรือทดสอบ UI กับ chart จริง
- **ไม่ตรวจยอดเครดิตหรือโทเคนต่อ** และไม่เอาการตรวจดังกล่าวเป็นเหตุหยุด APP02 อีก

## ประวัติ

| วันที่ | ผู้บันทึก | หมายเหตุ |
|---|---|---|
| 2026-09-29 | Codex | สร้าง workflow กลางตามคำสั่ง Owner ให้ใช้ซ้ำ APP01–APP09 และตัดการตรวจยอดเครดิต/โทเคนออกจากทุก Task |
