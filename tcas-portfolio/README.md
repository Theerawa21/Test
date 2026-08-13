# TCAS Portfolio Entry — Saint Theresa School

เว็บ GitHub Pages สำหรับให้นักเรียนบันทึกกิจกรรม รางวัล โครงงาน และหลักสูตร/Certificate ลง Google Sheets พร้อมแนบภาพหลักฐานใน Google Drive และมี Dashboard สำหรับครู

## ความปลอดภัยของระบบ

- นักเรียนเข้าสู่ระบบด้วย `รหัสประจำตัวนักเรียน + เลขท้ายบัตรประชาชน 4 หลัก`
- Backend ไม่ส่งเลขบัตรประชาชน 13 หลักกลับ browser
- หลังยืนยันตัวตน Backend สร้าง student session token ที่ลงลายเซ็นและมีอายุจำกัด
- `studentRecords`, `save`, `update` และ `delete` ต้องมี student token ที่ยังไม่หมดอายุ
- Backend หาเจ้าของจาก session และตรวจ `citizen_id` ของรายการก่อนแก้ไขหรือลบ โดยไม่เชื่อ `student_id` จาก browser
- Student login และ teacher login จำกัดจำนวนครั้งที่กรอกผิดและล็อกชั่วคราวเพื่อป้องกัน brute force
- รหัสครู, secret สำหรับลงลายเซ็น session และ origin ที่อนุญาตเก็บใน Apps Script Script Properties เท่านั้น
- token อยู่ในหน่วยความจำของหน้าเว็บ ไม่บันทึกลง `localStorage`
- teacher session มีวันหมดอายุแบบตายตัวและไม่ถูกต่ออายุทุกครั้งที่เปิด Dashboard/API
- ทุก teacher API (`teacherDashboard`, `teacherStudent`, `teacherReview`, `teacherLogout`) รับ token ผ่าน POST และตรวจสิทธิ์ฝั่ง Backend

## Script Properties ที่ต้องตั้งค่า

เปิด Apps Script project > **Project Settings** > **Script Properties** แล้วเพิ่ม:

| Property | จำเป็น | ค่าแนะนำ / ความหมาย |
| --- | --- | --- |
| `TEACHER_CODE` | จำเป็น | รหัสสำหรับครูที่คาดเดายาก ไม่ควรใช้รหัสซ้ำกับระบบอื่น |
| `SESSION_SECRET` | จำเป็น | สุ่มอย่างน้อย 32 ตัวอักษร ห้ามใส่ใน frontend หรือ GitHub |
| `ALLOWED_ORIGIN` | จำเป็น | `https://theerawa21.github.io` (ไม่ใส่ `/` ท้าย) |
| `STUDENT_SESSION_SECONDS` | ไม่บังคับ | อายุ session นักเรียน ค่าเริ่มต้น `21600` (6 ชั่วโมง) |
| `TEACHER_SESSION_SECONDS` | ไม่บังคับ | อายุ session ครู ค่าเริ่มต้น `21600` (6 ชั่วโมง) |
| `LOGIN_MAX_ATTEMPTS` | ไม่บังคับ | จำนวนครั้งที่กรอกผิดก่อนล็อก ค่าเริ่มต้น `5` |
| `LOGIN_LOCK_SECONDS` | ไม่บังคับ | ระยะเวลาล็อก ค่าเริ่มต้น `900` (15 นาที) |

### ตั้งค่าครั้งแรกแบบแนะนำ

1. ตั้ง `TEACHER_CODE` ที่คาดเดายากใน Script Properties ด้วยตนเอง (แนะนำอย่างน้อย 8 ตัวอักษร)
2. นำ `Code.gs` เวอร์ชันล่าสุดไปวาง แล้วรันฟังก์ชัน `setupConfig()` หนึ่งครั้ง
3. `setupConfig()` จะสร้าง `SESSION_SECRET` แบบสุ่มและตั้ง `ALLOWED_ORIGIN` เป็น `https://theerawa21.github.io` ให้เฉพาะค่าที่ยังว่าง โดยไม่เขียนหรือแสดง secret ใน frontend/log
4. ตรวจ Execution log ว่าขึ้น `ตั้งค่าความปลอดภัยพร้อมใช้งานแล้ว`

`setupConfig()` จงใจไม่สร้าง fallback รหัสครู เช่น `123456` เพราะรหัสเริ่มต้นที่เผยแพร่ร่วมกันไม่ปลอดภัย หาก `TEACHER_CODE` ยังว่าง ระบบจะแจ้งเป็นภาษาไทยอย่างชัดเจน

## โครงสร้างข้อมูลนักเรียนที่ใช้ยืนยันตัวตน

Backend อ่านชีต `Student List` ตั้งแต่แถว 4 โดยใช้:

- คอลัมน์ B: เลขประจำตัวประชาชน
- คอลัมน์ C: รหัสประจำตัวนักเรียน
- คอลัมน์ D: ชั้น/ห้อง
- คอลัมน์ E–G: คำนำหน้า ชื่อ นามสกุล
- คอลัมน์ L: สถานะ (`กำลังศึกษาอยู่`)

เลขประจำตัวประชาชนในคอลัมน์ B ควรเก็บเป็นข้อความและมีตัวเลขครบ 13 หลัก เพื่อให้เลขท้าย 4 หลักรวมเลขศูนย์นำหน้าได้ถูกต้อง

## ติดตั้งหรืออัปเดต Backend

1. เปิด Apps Script project ที่ใช้เป็น API
2. นำ `apps-script/Code.gs` ไปแทน `Code.gs` เดิมทั้งหมด
3. ตั้ง `TEACHER_CODE` แล้วรัน `setupConfig()` เพื่อตรวจ/เติม Script Properties ที่เหลือ
4. รัน `setupSheets()` หนึ่งครั้ง และอนุญาตสิทธิ์ที่ Apps Script ขอ
5. ไปที่ **Deploy > Manage deployments**
6. แก้ไข deployment เดิม เลือก **New version** แล้วกด **Deploy**
7. ถ้าแก้ deployment เดิม ใช้ Web App URL `/exec` เดิมได้ จึงไม่ต้องเปลี่ยน URL ในหน้าเว็บ หากสร้าง deployment ใหม่ ให้อัปเดต `apiUrl` ทั้งใน `config.js` และ inline `window.TCAS_CONFIG` ใน `index.html` ให้เป็น URL เดียวกัน

ตั้งค่า deployment เป็น **Execute as: Me** และกำหนดผู้เข้าถึงให้เหมาะกับ GitHub Pages (โดยทั่วไปคือ **Anyone**) การตรวจสิทธิ์ครูจริงทำที่ token ฝั่ง Backend และ `ALLOWED_ORIGIN` ต้องตรงกับ origin เท่านั้น: `https://theerawa21.github.io` ไม่รวม path `/Test/tcas-portfolio/`

> การแก้ไฟล์บน GitHub Pages อย่างเดียวไม่อัปเดต Apps Script Backend ผู้ดูแลต้องคัดลอก `Code.gs`, ตั้ง Properties และ deploy เวอร์ชันใหม่ก่อนเปิดใช้งานจริง

## ตรวจสอบหลัง Deploy

1. เปิดหน้าต่างไม่ระบุตัวตนและทดสอบ login นักเรียนด้วยข้อมูลถูกและผิด
2. ยืนยันว่าหน้ายืนยันแสดงเฉพาะชื่อ รหัสนักเรียน และห้อง โดยไม่มีเลขบัตรประชาชนเต็ม
3. ทดสอบดูรายการ เพิ่ม แก้ไข ลบ และแนบภาพ
4. ทดสอบออกจากระบบ แล้วตรวจว่า token เดิมเรียก API ไม่ได้
5. ลด session เป็น `300` ชั่วคราวเพื่อทดสอบข้อความ session หมดอายุ แล้วตั้งค่ากลับ
6. กรอกรหัสผิดครบจำนวนที่กำหนดเพื่อทดสอบ temporary lock ทั้งนักเรียนและครู
7. ทดสอบครูเข้าสู่ระบบ เปิด Dashboard กรองห้อง และดูรายละเอียดนักเรียน
8. ตรวจว่า `config.js` และ `index.html` ชี้ไป Web App URL เดียวกัน (ปัจจุบันคือ `https://script.google.com/macros/s/AKfycbyvEgrNa4g3puQ5AasQdpqCN295_Gcr1f1j3gcVrEkx_VH_q0r1pr7LTqYdQiHfYqR2/exec`)

หน้าเว็บ: `https://theerawa21.github.io/Test/tcas-portfolio/`

## ทดสอบโค้ดก่อน Deploy

หากเครื่องมี Node.js ให้รันจาก root ของ repo:

```text
node --check tcas-portfolio/app.js
node --check tcas-portfolio/teacher.js
node --test tcas-portfolio/tests/backend-security.test.js
```
