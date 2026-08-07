# Energy Mind Evidence Center

ระบบเว็บ 3 แท็บสำหรับจัดเก็บเอกสารเพิ่มเติม Energy Mind Award

## โครงสร้าง
- GitHub Pages: หน้าเว็บ
- Google Apps Script: API กลาง
- Google Sheets: ฐานข้อมูล
- Google Drive: เก็บไฟล์แนบ

## Google resources ที่ตั้งค่าไว้
- Spreadsheet ID: `1c2UYYRZkN9mFQng71nE89iNV5hL2PqTmDSWgbhUIHks`
- Sheet: `ข้อมูล`
- Drive Folder ID: `1KgMMOOngsFuYMdAcDteuqXzlXUX3465W`
- Time zone: `Asia/Bangkok`

## ขั้นตอนเชื่อมระบบ
1. เปิด https://script.google.com แล้วสร้าง New project
2. คัดลอกโค้ดจาก `apps-script/Code.gs` ไปวางในไฟล์ `Code.gs`
3. กด Save
4. เลือก Deploy > New deployment > Web app
5. Execute as: Me
6. Who has access: Anyone (หรือค่าที่เหมาะสมกับนโยบายโรงเรียน)
7. กด Deploy และอนุญาตสิทธิ์ Google Sheets/Drive
8. คัดลอก Web app URL ที่ลงท้ายด้วย `/exec`
9. เปิด `energy-mind/index.html` แล้วแทนค่า
   `PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE`
   ด้วย Web app URL
10. Commit การแก้ไข
11. เปิด GitHub Pages สำหรับ branch/โฟลเดอร์ที่ต้องการใช้ หรือย้ายไฟล์ `energy-mind/index.html` ไปยัง repo สำหรับเผยแพร่จริง

## คอลัมน์ฐานข้อมูล
`ID | หมวด | ผู้บันทึก | วัน/เดือน/ปี | เวลา | ประเภท | ชื่อไฟล์/ลิงก์ | URL`

## หมวดในระบบ
1. หมวด 1 นโยบายและระบบบริหารจัดการ
2. หมวด 2.1 ไฟฟ้า
3. หมวด 2.2 น้ำมันเชื้อเพลิง
4. หมวด 2.3 น้ำใช้และน้ำทิ้ง
5. หมวด 2.4 การจัดซื้อและการจัดการขยะ
6. หมวด 3 การบูรณาการความรู้ฯ
7. หมวด 4 การส่งเสริมการมีส่วนร่วมฯ
8. หมวด 5 Green Skills ของนักเรียน
9. หมวด 6 ความยั่งยืนฯ

## หมายเหตุสำคัญ
การแนบไฟล์จากหน้าเว็บจะส่งไฟล์เป็น Base64 ไปยัง Google Apps Script และเก็บไฟล์จริงใน Drive Folder ที่กำหนด จากนั้นบันทึก URL ลง Google Sheets
