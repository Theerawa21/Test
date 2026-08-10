# TCAS Portfolio Entry – Saint Theresa School

เว็บ GitHub Pages สำหรับให้นักเรียนกรอกรหัสประจำตัวนักเรียน ตรวจสอบชื่อ–นามสกุล/เลขประชาชน และบันทึกข้อมูล 4 ประเภทลง Google Sheets:

- `activities`
- `prizes`
- `projects`
- `certs-courses`

## การทำงาน
1. นักเรียนกรอกรหัสประจำตัวนักเรียน
2. Backend Apps Script อ่านรายชื่อจากฐานนักเรียนและคืนข้อมูลเฉพาะนักเรียนคนนั้น
3. นักเรียนยืนยันชื่อ–นามสกุล ชั้น/ห้อง และเลขประชาชน
4. เลือกกรอกกิจกรรม รางวัล โครงงาน หรือหลักสูตร/Certificate
5. Backend เป็นผู้เติม `citizen_id`, `title`, `first_name`, `last_name` จากฐานนักเรียนก่อนเขียนลงชีต นักเรียนไม่สามารถแก้ข้อมูลระบุตัวตนเองได้

## ติดตั้ง Backend Google Apps Script
1. เปิด Apps Script project ที่จะใช้เป็น API
2. วางไฟล์ `apps-script/Code.gs`
3. Run `setupSheets()` 1 ครั้งและอนุญาตสิทธิ์
4. Deploy > New deployment > Web app
5. เลือก Execute as: Me และกำหนดสิทธิ์เข้าถึงตามนโยบายโรงเรียน
6. คัดลอก URL ที่ลงท้ายด้วย `/exec`

## เชื่อม GitHub Pages กับ Backend
เปิดเว็บครั้งแรก แล้ววาง `/exec` URL ในหน้าตั้งค่า หรือเปิดลิงก์แบบ:

`https://theerawa21.github.io/Test/tcas-portfolio/?backend=YOUR_APPS_SCRIPT_EXEC_URL`

เว็บจะบันทึก URL ไว้ใน Local Storage ของเบราว์เซอร์ และลบ parameter ออกจาก address bar หลังตั้งค่า

> หมายเหตุด้านข้อมูลส่วนบุคคล: ระบบตามโจทย์ใช้รหัสประจำตัวนักเรียนเป็นตัวค้นหาและแสดงเลขประชาชน จึงควรกำหนดสิทธิ์ Web App ให้แคบที่สุดเท่าที่บริบทโรงเรียนอนุญาต และไม่ควรใส่รายชื่อนักเรียนหรือเลขประชาชนไว้ใน GitHub repository
