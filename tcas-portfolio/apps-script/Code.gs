/**
 * TCAS Portfolio Backend
 * Student records + Teacher dashboard + Evidence images
 *
 * IMPORTANT:
 * Run setupSheets() manually once after installing/updating this code.
 * Normal web requests DO NOT run setupSheets_() to avoid timeout.
 */
const DATA_SPREADSHEET_ID = '1seV4fk00kr62MiWd9i6IxjHqVZaTLQinZmb7MDXDzc4';
const STUDENT_SPREADSHEET_ID = '1gXl-v84hWWemlZ2ATEQhSPQSkxUhKmT7AlPpR0-QCIY';
const STUDENT_SHEET_NAME = 'Student List';
const EVIDENCE_FOLDER_ID = '1BPExo71uPO1WPc1L1GP3mlK1TDDZx2Kb';
const ATTACHMENT_SHEET = 'attachments';
const ALLOWED_ORIGIN = 'https://theerawa21.github.io';
const TEACHER_SESSION_SECONDS = 21600; // 6 ชั่วโมง
const DASHBOARD_CACHE_SECONDS = 90;

const CONFIG = {
  activity: {sheet:'activities', headers:['citizen_id','title','first_name','last_name','program_title','exp_name','description','date','end_date','year','level','hours','fee']},
  prize: {sheet:'prizes', headers:['citizen_id','title','first_name','last_name','program_title','prize_name','description','date','end_date','year','level','hours','fee']},
  project: {sheet:'projects', headers:['citizen_id','title','first_name','last_name','project_title','project_type','description','date','end_date','year','level','hours','fee']},
  course: {sheet:'certs-courses', headers:['citizen_id','title','first_name','last_name','course_name','course_level','description','issue_date','expired_date','score','year','category','level','hours','fee','reflection']}
};

const LEVELS = ['', 'school', 'district', 'regional', 'national', 'international'];
const ATT_HEADERS = ['attachment_id','entry_id','citizen_id','student_id','class_room','type','file_id','file_name','mime_type','drive_url','created_at'];

/* ========================= WEB APP ========================= */
function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    const action = String(p.action || '').trim();
    let result;

    if (action === 'lookup') result = lookupStudentResponse_(p.student_id);
    else if (action === 'records') result = recordsResponse_(p.student_id);
    else if (action === 'health') result = {ok:true, message:'TCAS API พร้อมใช้งาน', time:new Date().toISOString()};
    else result = {ok:true, message:'TCAS API พร้อมใช้งาน'};

    return jsonp_(result, p.callback);
  } catch (err) {
    return jsonp_({ok:false, message:safeError_(err)}, e && e.parameter ? e.parameter.callback : '');
  }
}

function doPost(e) {
  let token = '';
  try {
    const p = (e && e.parameter) || {};
    const action = String(p.action || '').trim();
    const payload = JSON.parse(p.payload || '{}');
    token = String(payload._token || '');
    let result;

    if (action === 'save') result = saveRecord_(payload);
    else if (action === 'update') result = updateRecord_(payload);
    else if (action === 'delete') result = deleteRecord_(payload);
    else if (action === 'teacherLogin') result = teacherLogin_(payload.teacher_code);
    else if (action === 'teacherDashboard') result = teacherDashboardResponse_(payload.teacher_token, payload.force_refresh);
    else if (action === 'teacherStudent') result = teacherStudentResponse_(payload.teacher_token, payload.student_id);
    else if (action === 'teacherLogout') result = teacherLogout_(payload.teacher_token);
    else throw new Error('คำสั่งไม่ถูกต้อง');

    return postMessageOutput_({ok:true, token:token, result:result});
  } catch (err) {
    return postMessageOutput_({ok:false, token:token, message:safeError_(err)});
  }
}

/* ========================= STUDENTS ========================= */
function lookupStudentResponse_(id) {
  const s = lookupStudent_(id);
  if (!s) return {ok:false, message:'ไม่พบรหัสประจำตัวนักเรียนนี้'};
  if (s.status && s.status !== 'กำลังศึกษาอยู่') return {ok:false, message:'ข้อมูลนักเรียนรายนี้ไม่ได้อยู่ในสถานะกำลังศึกษา'};
  return {ok:true, student:publicStudent_(s)};
}

function recordsResponse_(id) {
  const s = mustStudent_(id);
  return {ok:true, student:publicStudent_(s), records:getStudentRecords_(s)};
}

function lookupStudent_(id) {
  id = String(id || '').replace(/\D/g, '').trim();
  if (!id) return null;

  const sh = SpreadsheetApp.openById(STUDENT_SPREADSHEET_ID).getSheetByName(STUDENT_SHEET_NAME);
  if (!sh) throw new Error('ไม่พบชีตรายชื่อนักเรียน');
  const last = sh.getLastRow();
  if (last < 4) return null;

  const found = sh.getRange(4, 3, last - 3, 1).createTextFinder(id).matchEntireCell(true).findNext();
  if (!found) return null;

  const r = sh.getRange(found.getRow(), 2, 1, 12).getDisplayValues()[0];
  return {
    citizen_id:String(r[0] || ''),
    student_id:String(r[1] || ''),
    class_room:String(r[2] || ''),
    title:String(r[3] || ''),
    first_name:String(r[4] || ''),
    last_name:String(r[5] || ''),
    status:String(r[10] || '')
  };
}

function publicStudent_(s) {
  return {student_id:s.student_id, class_room:s.class_room, title:s.title, first_name:s.first_name, last_name:s.last_name, citizen_id:s.citizen_id};
}

function teacherPublicStudent_(s) {
  return {student_id:s.student_id, class_room:s.class_room, title:s.title, first_name:s.first_name, last_name:s.last_name};
}

function mustStudent_(id) {
  const s = lookupStudent_(id);
  if (!s) throw new Error('ไม่พบข้อมูลนักเรียน');
  if (s.status && s.status !== 'กำลังศึกษาอยู่') throw new Error('สถานะนักเรียนไม่ถูกต้อง');
  return s;
}

/* ========================= RECORDS ========================= */
function getStudentRecords_(student) {
  const ss = SpreadsheetApp.openById(DATA_SPREADSHEET_ID);
  const out = [];

  Object.keys(CONFIG).forEach(type => {
    const cfg = CONFIG[type];
    const sh = ss.getSheetByName(cfg.sheet);
    if (!sh || sh.getLastRow() < 2) return;

    const rows = sh.getLastRow() - 1;
    const values = sh.getRange(2, 1, rows, cfg.headers.length).getDisplayValues();
    const notes = sh.getRange(2, 1, rows, 1).getNotes();

    values.forEach((r, i) => {
      if (String(r[0] || '') !== student.citizen_id) return;
      let entryId = notes[i][0] || '';
      if (!entryId) {
        entryId = Utilities.getUuid();
        sh.getRange(i + 2, 1).setNote(entryId);
      }
      const item = {type:type, entry_id:entryId};
      cfg.headers.forEach((h, j) => item[h] = r[j] || '');
      out.push(item);
    });
  });

  const attachmentMap = getAttachmentMap_(student.citizen_id);
  out.forEach(r => r.attachments = attachmentMap[r.entry_id] || []);
  return out;
}

function saveRecord_(p) {
  const student = mustStudent_(p.student_id);
  const type = mustType_(p.type);
  const cfg = CONFIG[type];
  validate_(type, p);

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = SpreadsheetApp.openById(DATA_SPREADSHEET_ID).getSheetByName(cfg.sheet);
    if (!sh) throw new Error('ไม่พบชีต ' + cfg.sheet + ' กรุณารัน setupSheets() ก่อน');

    const target = Math.max(sh.getLastRow() + 1, 2);
    const entryId = Utilities.getUuid();
    sh.getRange(target, 1, 1, cfg.headers.length).setValues([studentRow_(student, cfg, p)]).setVerticalAlignment('top').setWrap(true);
    sh.getRange(target, 1).setNumberFormat('@').setNote(entryId);

    const attachments = uploadEvidence_(student, type, entryId, String(p.year || ''), p.images || []);
    clearTeacherDashboardCache_();
    return {entry_id:entryId, attachments:attachments};
  } finally {
    lock.releaseLock();
  }
}

function updateRecord_(p) {
  const student = mustStudent_(p.student_id);
  const type = mustType_(p.type);
  const cfg = CONFIG[type];
  validate_(type, p);
  const entryId = String(p.entry_id || '');
  if (!entryId) throw new Error('ไม่พบรหัสรายการ');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = SpreadsheetApp.openById(DATA_SPREADSHEET_ID).getSheetByName(cfg.sheet);
    if (!sh) throw new Error('ไม่พบชีต ' + cfg.sheet);
    const row = findEntryRow_(sh, entryId);
    if (!row) throw new Error('ไม่พบรายการที่ต้องการแก้ไข');
    if (String(sh.getRange(row, 1).getDisplayValue()) !== student.citizen_id) throw new Error('ไม่มีสิทธิ์แก้ไขรายการนี้');

    sh.getRange(row, 1, 1, cfg.headers.length).setValues([studentRow_(student, cfg, p)]).setVerticalAlignment('top').setWrap(true);
    sh.getRange(row, 1).setNumberFormat('@').setNote(entryId);
    const attachments = uploadEvidence_(student, type, entryId, String(p.year || ''), p.images || []);
    clearTeacherDashboardCache_();
    return {entry_id:entryId, attachments:attachments};
  } finally {
    lock.releaseLock();
  }
}

function deleteRecord_(p) {
  const student = mustStudent_(p.student_id);
  const entryId = String(p.entry_id || '');
  if (!entryId) throw new Error('ไม่พบรหัสรายการ');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = SpreadsheetApp.openById(DATA_SPREADSHEET_ID);
    for (const type of Object.keys(CONFIG)) {
      const sh = ss.getSheetByName(CONFIG[type].sheet);
      if (!sh) continue;
      const row = findEntryRow_(sh, entryId);
      if (!row) continue;
      if (String(sh.getRange(row, 1).getDisplayValue()) !== student.citizen_id) throw new Error('ไม่มีสิทธิ์ลบรายการนี้');
      deleteAttachmentsForEntry_(entryId, student.citizen_id);
      sh.deleteRow(row);
      clearTeacherDashboardCache_();
      return {entry_id:entryId};
    }
    throw new Error('ไม่พบรายการที่ต้องการลบ');
  } finally {
    lock.releaseLock();
  }
}

function findEntryRow_(sh, entryId) {
  const last = sh.getLastRow();
  if (last < 2) return 0;
  const notes = sh.getRange(2, 1, last - 1, 1).getNotes();
  for (let i = 0; i < notes.length; i++) if (notes[i][0] === entryId) return i + 2;
  return 0;
}

function studentRow_(s, cfg, p) {
  const src = Object.assign({}, p, {citizen_id:s.citizen_id, title:s.title, first_name:s.first_name, last_name:s.last_name});
  return cfg.headers.map(h => normalize_(src[h]));
}

function mustType_(type) {
  const value = String(type || '');
  if (!CONFIG[value]) throw new Error('ประเภทข้อมูลไม่ถูกต้อง');
  return value;
}

function validate_(type, p) {
  if (!String(p.year || '').trim()) throw new Error('กรุณาระบุปีการศึกษา');
  if (p.level && !LEVELS.includes(String(p.level))) throw new Error('ระดับข้อมูลไม่ถูกต้อง');
  if (type === 'activity' && (!p.program_title || !p.exp_name || !p.date)) throw new Error('กรุณากรอกชื่อกิจกรรม บทบาท และวันที่เริ่ม');
  if (type === 'prize' && (!p.program_title || !p.prize_name || !p.date)) throw new Error('กรุณากรอกชื่อการแข่งขัน รางวัล และวันที่');
  if (type === 'project' && (!p.project_title || !p.project_type || !p.date)) throw new Error('กรุณากรอกชื่อโครงงาน ประเภท และวันที่เริ่ม');
  if (type === 'course' && (!p.course_name || !p.issue_date)) throw new Error('กรุณากรอกชื่อหลักสูตรและวันที่ออกใบรับรอง');
}

/* ========================= EVIDENCE IMAGES ========================= */
function uploadEvidence_(s, type, entryId, year, images) {
  if (!Array.isArray(images) || !images.length) return [];
  if (images.length > 4) throw new Error('แนบภาพได้ไม่เกิน 4 ภาพต่อครั้ง');

  const root = DriveApp.getFolderById(EVIDENCE_FOLDER_ID);
  const yearFolder = getOrCreateFolder_(root, safeFolder_(year || 'ไม่ระบุปี'));
  const roomFolder = getOrCreateFolder_(yearFolder, safeFolder_(s.class_room || 'ไม่ระบุห้อง'));
  const studentFolder = getOrCreateFolder_(roomFolder, safeFolder_(s.student_id + '_' + s.first_name + '_' + s.last_name));
  const typeFolder = getOrCreateFolder_(studentFolder, type);

  const ss = SpreadsheetApp.openById(DATA_SPREADSHEET_ID);
  const sh = ss.getSheetByName(ATTACHMENT_SHEET);
  if (!sh) throw new Error('ไม่พบชีต attachments กรุณารัน setupSheets() ก่อน');

  const rows = [];
  const out = [];
  images.forEach((img, i) => {
    const data = String(img.data || '');
    const match = data.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) throw new Error('รูปแบบไฟล์ภาพไม่ถูกต้อง');
    if (match[2].length > 3500000) throw new Error('ภาพมีขนาดใหญ่เกินไป กรุณาเลือกภาพใหม่');

    const mime = match[1];
    const bytes = Utilities.base64Decode(match[2]);
    const ext = mime.indexOf('png') > -1 ? 'png' : mime.indexOf('webp') > -1 ? 'webp' : 'jpg';
    const fileName = s.student_id + '_' + type + '_' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd_HHmmss') + '_' + (i + 1) + '.' + ext;
    const file = typeFolder.createFile(Utilities.newBlob(bytes, mime, fileName));
    const attachmentId = Utilities.getUuid();
    const created = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'dd/MM/yyyy HH:mm:ss');

    rows.push([attachmentId, entryId, s.citizen_id, s.student_id, s.class_room, type, file.getId(), fileName, mime, file.getUrl(), created]);
    out.push({attachment_id:attachmentId, file_name:fileName, mime_type:mime, drive_url:file.getUrl(), created_at:created});
  });

  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, ATT_HEADERS.length).setValues(rows);
  return out;
}

function getAttachmentMap_(citizenId) {
  const sh = SpreadsheetApp.openById(DATA_SPREADSHEET_ID).getSheetByName(ATTACHMENT_SHEET);
  const map = {};
  if (!sh || sh.getLastRow() < 2) return map;

  const vals = sh.getRange(2, 1, sh.getLastRow() - 1, ATT_HEADERS.length).getDisplayValues();
  vals.forEach(r => {
    if (String(r[2] || '') !== citizenId) return;
    const item = {attachment_id:r[0], file_name:r[7], mime_type:r[8], drive_url:r[9], created_at:r[10]};
    if (!map[r[1]]) map[r[1]] = [];
    map[r[1]].push(item);
  });
  return map;
}

function deleteAttachmentsForEntry_(entryId, citizenId) {
  const sh = SpreadsheetApp.openById(DATA_SPREADSHEET_ID).getSheetByName(ATTACHMENT_SHEET);
  if (!sh || sh.getLastRow() < 2) return;
  const vals = sh.getRange(2, 1, sh.getLastRow() - 1, ATT_HEADERS.length).getDisplayValues();

  for (let i = vals.length - 1; i >= 0; i--) {
    const r = vals[i];
    if (r[1] === entryId && r[2] === citizenId) {
      try { DriveApp.getFileById(r[6]).setTrashed(true); } catch (_) {}
      sh.deleteRow(i + 2);
    }
  }
}

function getOrCreateFolder_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function safeFolder_(v) {
  return String(v || '').replace(/[\\/:*?"<>|]/g, '-').trim() || 'ไม่ระบุ';
}

/* ========================= TEACHER MODE ========================= */
function teacherLogin_(code) {
  const value = String(code || '').trim();
  const expected = getTeacherCode_();
  if (!value || value !== expected) throw new Error('รหัสสำหรับครูไม่ถูกต้อง');

  const session = Utilities.getUuid().replace(/-/g, '');
  CacheService.getScriptCache().put('teacher:' + session, '1', TEACHER_SESSION_SECONDS);

  // Login should be quick. Dashboard is loaded by a separate request.
  return {teacher_token:session};
}

function teacherDashboardResponse_(session, forceRefresh) {
  requireTeacherSession_(session);
  refreshTeacherSession_(session);
  return teacherDashboardDataCached_(String(forceRefresh || '') === '1');
}

function teacherStudentResponse_(session, studentId) {
  requireTeacherSession_(session);
  refreshTeacherSession_(session);
  const s = mustStudent_(studentId);
  return {student:teacherPublicStudent_(s), records:getStudentRecords_(s).map(teacherRecord_)};
}

function teacherLogout_(session) {
  CacheService.getScriptCache().remove('teacher:' + String(session || ''));
  return {success:true};
}

function getTeacherCode_() {
  const code = PropertiesService.getScriptProperties().getProperty('TEACHER_CODE');
  if (!code) throw new Error('ยังไม่ได้ตั้งค่า TEACHER_CODE ใน Script Properties');
  return String(code).trim();
}

function requireTeacherSession_(session) {
  const token = String(session || '').trim();
  if (!token || CacheService.getScriptCache().get('teacher:' + token) !== '1') throw new Error('สิทธิ์ครูหมดอายุ กรุณาเข้าสู่ระบบใหม่');
}

function refreshTeacherSession_(session) {
  CacheService.getScriptCache().put('teacher:' + String(session || ''), '1', TEACHER_SESSION_SECONDS);
}

function teacherDashboardDataCached_(forceRefresh) {
  const cache = CacheService.getScriptCache();
  const key = 'teacher-dashboard-v3';
  if (!forceRefresh) {
    const cached = cache.get(key);
    if (cached) {
      try { return JSON.parse(cached); } catch (_) {}
    }
  }

  const data = teacherDashboardData_();
  try { cache.put(key, JSON.stringify(data), DASHBOARD_CACHE_SECONDS); } catch (_) {}
  return data;
}

function clearTeacherDashboardCache_() {
  try { CacheService.getScriptCache().remove('teacher-dashboard-v3'); } catch (_) {}
}

function getAllActiveStudents_() {
  const sh = SpreadsheetApp.openById(STUDENT_SPREADSHEET_ID).getSheetByName(STUDENT_SHEET_NAME);
  if (!sh) throw new Error('ไม่พบชีตรายชื่อนักเรียน');
  const last = sh.getLastRow();
  if (last < 4) return [];

  return sh.getRange(4, 2, last - 3, 12).getDisplayValues().map(r => ({
    citizen_id:String(r[0] || '').trim(),
    student_id:String(r[1] || '').trim(),
    class_room:String(r[2] || '').trim(),
    title:String(r[3] || '').trim(),
    first_name:String(r[4] || '').trim(),
    last_name:String(r[5] || '').trim(),
    status:String(r[10] || '').trim()
  })).filter(s => s.student_id && (!s.status || s.status === 'กำลังศึกษาอยู่'));
}

function buildRecordCountMap_() {
  const ss = SpreadsheetApp.openById(DATA_SPREADSHEET_ID);
  const map = {};

  Object.keys(CONFIG).forEach(type => {
    const sh = ss.getSheetByName(CONFIG[type].sheet);
    if (!sh || sh.getLastRow() < 2) return;

    sh.getRange(2, 1, sh.getLastRow() - 1, 1).getDisplayValues().forEach(r => {
      const citizen = String(r[0] || '').trim();
      if (!citizen) return;
      if (!map[citizen]) map[citizen] = {activity:0, prize:0, project:0, course:0, total:0};
      map[citizen][type] = (map[citizen][type] || 0) + 1;
      map[citizen].total++;
    });
  });
  return map;
}

function teacherDashboardData_() {
  const students = getAllActiveStudents_();
  const countMap = buildRecordCountMap_();

  const list = students.map(s => {
    const c = countMap[s.citizen_id] || {activity:0, prize:0, project:0, course:0, total:0};
    return {
      student_id:s.student_id,
      class_room:s.class_room,
      title:s.title,
      first_name:s.first_name,
      last_name:s.last_name,
      submitted:c.total > 0,
      total_records:c.total,
      counts:{activity:c.activity || 0, prize:c.prize || 0, project:c.project || 0, course:c.course || 0}
    };
  });

  list.sort((a, b) => String(a.class_room).localeCompare(String(b.class_room), 'th') || Number(a.student_id || 0) - Number(b.student_id || 0));

  const roomMap = {};
  list.forEach(s => {
    const room = s.class_room || 'ไม่ระบุห้อง';
    if (!roomMap[room]) roomMap[room] = {class_room:room, total:0, submitted:0, not_submitted:0, records:0};
    roomMap[room].total++;
    roomMap[room].records += Number(s.total_records || 0);
    if (Number(s.total_records || 0) > 0) roomMap[room].submitted++;
    else roomMap[room].not_submitted++;
  });

  const rooms = Object.keys(roomMap).sort((a, b) => a.localeCompare(b, 'th')).map(k => roomMap[k]);
  const submitted = list.filter(s => Number(s.total_records || 0) > 0).length;
  const totalRecords = list.reduce((sum, s) => sum + Number(s.total_records || 0), 0);

  return {
    generated_at:Utilities.formatDate(new Date(), 'Asia/Bangkok', 'dd/MM/yyyy HH:mm:ss'),
    total_students:list.length,
    submitted_students:submitted,
    not_submitted_students:list.length - submitted,
    total_records:totalRecords,
    rooms:rooms,
    students:list
  };
}

function teacherRecord_(record) {
  const out = {};
  Object.keys(record).forEach(key => {
    if (['citizen_id','title','first_name','last_name'].indexOf(key) !== -1) return;
    out[key] = record[key];
  });
  return out;
}

/* ========================= SETUP ========================= */
function setupSheets() {
  setupSheets_();
  return 'พร้อมใช้งาน';
}

function setupSheets_() {
  const ss = SpreadsheetApp.openById(DATA_SPREADSHEET_ID);

  Object.keys(CONFIG).forEach(type => {
    const cfg = CONFIG[type];
    let sh = ss.getSheetByName(cfg.sheet);
    if (!sh) sh = ss.insertSheet(cfg.sheet);
    if (sh.getMaxColumns() < cfg.headers.length) sh.insertColumnsAfter(sh.getMaxColumns(), cfg.headers.length - sh.getMaxColumns());

    const head = sh.getRange(1, 1, 1, cfg.headers.length);
    const current = head.getDisplayValues()[0];
    if (cfg.headers.some((h, i) => current[i] !== h)) head.setValues([cfg.headers]);

    head.setBackground('#17365D').setFontColor('#FFFFFF').setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
    sh.setFrozenRows(1);
    sh.getRange('A:A').setNumberFormat('@');

    const levelColumn = cfg.headers.indexOf('level') + 1;
    if (levelColumn > 0) {
      const rule = SpreadsheetApp.newDataValidation().requireValueInList(['school','district','regional','national','international'], true).setAllowInvalid(false).build();
      sh.getRange(2, levelColumn, Math.max(sh.getMaxRows() - 1, 1), 1).setDataValidation(rule);
    }
  });

  let att = ss.getSheetByName(ATTACHMENT_SHEET);
  if (!att) att = ss.insertSheet(ATTACHMENT_SHEET);
  if (att.getMaxColumns() < ATT_HEADERS.length) att.insertColumnsAfter(att.getMaxColumns(), ATT_HEADERS.length - att.getMaxColumns());

  const ah = att.getRange(1, 1, 1, ATT_HEADERS.length);
  const av = ah.getDisplayValues()[0];
  if (ATT_HEADERS.some((h, i) => av[i] !== h)) ah.setValues([ATT_HEADERS]);
  ah.setBackground('#6B4F9C').setFontColor('#FFFFFF').setFontWeight('bold').setWrap(true);
  att.setFrozenRows(1);
  att.getRange('C:C').setNumberFormat('@');
}

/* ========================= HELPERS ========================= */
function normalize_(v) {
  return v === null || v === undefined ? '' : String(v).trim();
}

function jsonp_(obj, callback) {
  const cb = String(callback || '').replace(/[^a-zA-Z0-9_$.]/g, '');
  const json = JSON.stringify(obj);
  return ContentService.createTextOutput(cb ? cb + '(' + json + ');' : json).setMimeType(cb ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}

function postMessageOutput_(obj) {
  const data = JSON.stringify(Object.assign({source:'tcas-apps-script'}, obj)).replace(/</g, '\\u003c');
  const html = '<!doctype html><meta charset="utf-8"><script>window.parent.postMessage(' + data + ',' + JSON.stringify(ALLOWED_ORIGIN) + ');<\/script>';
  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function safeError_(e) {
  return e && e.message ? String(e.message) : 'เกิดข้อผิดพลาดของระบบ';
}
