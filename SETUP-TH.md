# วิธีตั้งค่า Claude Code ให้เข้าใจงานนี้

## 1. ติดตั้ง

1. ใน VS Code กด `Ctrl+Shift+X` แล้วค้นหา **Claude Code** จากนั้นกด Install
   - ถ้าไม่ขึ้น ให้รีสตาร์ต VS Code
2. ล็อกอินด้วยบัญชี Claude แบบเสียเงิน (Pro, Max, Team หรือ Enterprise) หรือบัญชี Claude Console
3. ถ้าจะพิมพ์คำสั่ง `claude` ใน Terminal ด้วย ต้องติดตั้ง CLI แยกอีกตัว แต่ถ้าใช้แผงของ extension อย่างเดียวไม่ต้องติดตั้ง

## 2. จัดโฟลเดอร์

```text
prompt_engineer/
└─ Monthly-Sales-Forecast-Assistant/     ← git clone repo ของทีมมาไว้ตรงนี้
   ├─ CLAUDE.md  PROMPTS.md  SETUP-TH.md  .gitignore
   ├─ .claude/agents/*.md                ← sub-agent 7 ตัว
   ├─ prd.md  AGENTS.md  architecture.md  schema.md
   ├─ implementation-plan.md  progress.md
   ├─ reference/                          ← ไฟล์อ้างอิง (ไม่ขึ้น git)
   └─ private-data/                       ← ก๊อปไฟล์ CSV จริง 3 ไฟล์มาใส่เอง (ไม่ขึ้น git)
      ├─ cash-sales.csv      (ขายเงินสด)
      ├─ credit-sales.csv    (ขายเงินเชื่อ)
      └─ deposits.csv        (รับมัดจำ)
```

ขั้นตอน:

1. เปิด Terminal ในโฟลเดอร์ `prompt_engineer` แล้วรัน
   ```bash
   git clone https://github.com/KissTK322/Monthly-Sales-Forecast-Assistant.git
   ```
2. แตก zip ชุดนี้ แล้วก๊อปทุกอย่างในโฟลเดอร์ `Monthly-Sales-Forecast-Assistant` ไปวางทับในโฟลเดอร์ที่ clone มา
   - ต้องให้ `.claude` และ `.gitignore` ไปด้วย ถ้ามองไม่เห็น ให้เปิด View → Hidden items ใน File Explorer
3. ก๊อปไฟล์ CSV 3 ไฟล์ไปไว้ใน `private-data/` แล้วเปลี่ยนชื่อเป็นภาษาอังกฤษตามด้านบน เพื่อให้เครื่องมือทุกตัวอ่านชื่อไฟล์ได้ถูกต้อง
4. ใน VS Code ไปที่ **File → Open Folder** แล้วเลือก `Monthly-Sales-Forecast-Assistant`
   - ต้องเปิดโฟลเดอร์นี้ ไม่ใช่ `prompt_engineer` เพราะ Claude Code อ่าน `CLAUDE.md` จากโฟลเดอร์ที่เปิดอยู่
5. เช็กก่อน commit ครั้งแรกด้วย `git status` ต้อง**ไม่เห็น** `reference/`, `private-data/` หรือไฟล์ `.xlsx`

## 3. เริ่มใช้งาน

1. เปิดแผง Claude Code (ไอคอน Claude ด้านข้าง) แล้วพิมพ์ `/agents` ต้องเห็น 7 ตัวดังนี้

| sub-agent | โมเดล | หน้าที่ |
|---|---|---|
| architect-reviewer | opus | วางแผนแต่ละ phase และรีวิวงาน (อ่านอย่างเดียว) |
| data-import-engineer | opus | โครงข้อมูล, ที่เก็บข้อมูล, อ่าน Excel/CSV/JSON, ตรวจยอด |
| forecast-engineer | opus | สูตรคาดการณ์และสต็อก |
| ui-builder | sonnet | หน้าจอ, ภาษาไทย/อังกฤษ, theme, responsive |
| pwa-performance | sonnet | PWA, ออฟไลน์, ติดตั้ง, งบ eco |
| qa-tester | sonnet | เทสต์ทุกขนาดจอ/theme/ภาษา |
| docs-i18n | haiku | แปลข้อความ, README, progress.md |

   แก้โมเดลได้ที่บรรทัด `model:` ในแต่ละไฟล์

2. ส่ง prompt **Kickoff** จาก `PROMPTS.md` แล้วตอบคำถามที่ Claude ถามกลับ
3. ส่ง prompt **Phase 0** แล้วตรวจ diff ของเอกสาร
   - ถ้าโอเค ให้ commit เอกสาร และ copy เนื้อหาไปอัปเดตใน issue ด้วย เพราะอาจารย์ดูใน issue
4. แต่ละ phase ให้ส่ง prompt **Start a build phase** แล้วรอแผนมาก่อน
   - อ่านแผนแล้วตอบ `approve` จากนั้นรอรายงานท้าย phase
5. หลังรายงานท้าย phase มา ให้ทำตามนี้
   - เปิดแอปดู: รัน `npx serve -l 8000` แล้วเปิด `http://localhost:8000`
   - ส่ง prompt **Review before commit**
   - commit ด้วยบัญชีของเจ้าของ milestone ตามแผน (Titan/Tonkla สลับกัน)
   - แปะร่างบันทึกลง `progress.md`
   - ย้ายการ์ดบน Project board
6. ถ้าต้องการให้ Claude เสนอแผนก่อนลงมือแก้ไฟล์ ให้ใช้ Plan mode ในแผง Claude Code

## 4. ข้อควรระวัง

- **ไฟล์ข้อมูลจริง:** อยู่ใน `private-data/` เท่านั้น ห้ามขึ้น repo สาธารณะ ในไฟล์มีชื่อลูกค้าและเบอร์โทรศัพท์ในช่องหมายเหตุด้วย
- **Phase 3:** ใช้ prompt "check against the real file" ซึ่งกำหนดให้รายงานแค่จำนวนและผ่าน/ไม่ผ่าน
- **ก่อน commit:** อ่าน diff ทุกครั้ง ถ้าอธิบายไม่ได้ ให้ใช้ prompt **Explain for the viva**
- **Claude Code ใช้โควตาของบัญชี:** sub-agent ที่ใช้ opus ใช้โควตามากกว่า ถ้าโควตาใกล้หมด ให้เปลี่ยน `model:` เป็น sonnet ได้
