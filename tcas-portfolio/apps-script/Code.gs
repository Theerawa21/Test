
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
const REVIEW_SHEET = 'reviews';
const DASHBOARD_CACHE_SECONDS = 90;
const DEFAULT_SESSION_SECONDS = 21600; // 6 ชั่วโมง
const DEFAULT_LOGIN_MAX_ATTEMPTS = 5;
const DEFAULT_LOGIN_LOCK_SECONDS = 900; // 15 นาที
const DEFAULT_ALLOWED_ORIGIN = 'https://theerawa21.github.io';
const PORTFOLIO_APP_URL = 'https://theerawa21.github.io/Test/tcas-portfolio/';
const SCHOOL_NAME = 'โรงเรียนเซนต์เทเรซา';

const CONFIG = {
  activity: {sheet:'activities', headers:['citizen_id','title','first_name','last_name','program_title','exp_name','description','date','end_date','year','level','hours','fee']},
  prize: {sheet:'prizes', headers:['citizen_id','title','first_name','last_name','program_title','prize_name','description','date','end_date','year','level','hours','fee']},
  project: {sheet:'projects', headers:['citizen_id','title','first_name','last_name','project_title','project_type','description','date','end_date','year','level','hours','fee']},
  course: {sheet:'certs-courses', headers:['citizen_id','title','first_name','last_name','course_name','course_level','description','issue_date','expired_date','score','year','category','level','hours','fee','reflection']}
};

const LEVELS = ['', 'school', 'district', 'regional', 'national', 'international'];
const ATT_HEADERS = ['attachment_id','entry_id','citizen_id','student_id','class_room','type','file_id','file_name','mime_type','drive_url','created_at'];
const REVIEW_HEADERS = ['review_id','entry_id','citizen_id','student_id','type','feedback','due_date','status','created_at','updated_at','resubmitted_at'];

/* ========================= WEB APP ========================= */
function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    const action = String(p.action || '').trim();
    let result;

    if (action === 'lookup' || action === 'records') result = {ok:false, message:'กรุณาเข้าสู่ระบบด้วยรหัสนักเรียนและเลขท้ายบัตรประชาชน 4 หลัก'};
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
    requireAllowedOrigin_(p.origin);
    let result;

    if (action === 'studentLogin') result = studentLogin_(payload.student_id, payload.citizen_last4);
    else if (action === 'studentEmail') result = updateStudentEmail_(payload.student_token, payload.email);
    else if (action === 'studentRecords') result = recordsResponse_(payload.student_token);
    else if (action === 'studentLogout') result = studentLogout_(payload.student_token);
    else if (action === 'save') result = saveRecord_(payload);
    else if (action === 'update') result = updateRecord_(payload);
    else if (action === 'delete') result = deleteRecord_(payload);
    else if (action === 'teacherLogin') result = teacherLogin_(payload.teacher_code);
    else if (action === 'teacherDashboard') result = teacherDashboardResponse_(payload.teacher_token, payload.force_refresh);
    else if (action === 'teacherStudent') result = teacherStudentResponse_(payload.teacher_token, payload.student_id);
    else if (action === 'teacherReview') result = teacherReviewResponse_(payload.teacher_token, payload);
    else if (action === 'teacherLogout') result = teacherLogout_(payload.teacher_token);
    else throw new Error('คำสั่งไม่ถูกต้อง');

    return postMessageOutput_({ok:true, token:token, result:result});
  } catch (err) {
    return postMessageOutput_({ok:false, token:token, message:safeError_(err)});
  }
}

/* ========================= STUDENTS ========================= */
function studentLogin_(id, citizenLast4) {
  id = normalizeDigits_(id);
  citizenLast4 = normalizeDigits_(citizenLast4);
  if (!id || citizenLast4.length !== 4) throw new Error('กรุณากรอกรหัสนักเรียนและเลขท้ายบัตรประชาชน 4 หลัก');

  const rateKey = 'student:' + secureKey_(id);
  requireLoginAllowed_(rateKey);
  const s = lookupStudent_(id);
  const actualLast4 = s ? normalizeDigits_(s.citizen_id).slice(-4) : '';
  if (!s || (s.status && s.status !== 'กำลังศึกษาอยู่') || !secureEqual_(actualLast4, citizenLast4)) {
    const rate = recordLoginFailure_(rateKey);
    throwLoginFailure_(rate, 'รหัสนักเรียนหรือเลขท้ายบัตรประชาชนไม่ถูกต้อง');
  }

  clearLoginFailures_(rateKey);
  const token = createSessionToken_('student', {student_id:s.student_id}, sessionSeconds_('STUDENT_SESSION_SECONDS'));
  return {student_token:token, student:publicStudent_(s), expires_in:sessionSeconds_('STUDENT_SESSION_SECONDS')};
}

function recordsResponse_(studentToken) {
  const s = requireStudentSession_(studentToken);
  return {ok:true, student:publicStudent_(s), records:getStudentRecords_(s).map(publicRecord_)};
}

function studentLogout_(studentToken) {
  removeSession_('student', studentToken);
  return {success:true};
}

function updateStudentEmail_(studentToken, email) {
  const student = requireStudentSession_(studentToken);
  email = normalizeStudentEmail_(email);

  const sh = SpreadsheetApp.openById(STUDENT_SPREADSHEET_ID).getSheetByName(STUDENT_SHEET_NAME);
  if (!sh) throw new Error('ไม่พบชีตรายชื่อนักเรียน');
  const last = sh.getLastRow();
  if (last < 4) throw new Error('ไม่พบข้อมูลนักเรียน');

  const found = sh.getRange(4, 3, last - 3, 1).createTextFinder(student.student_id).matchEntireCell(true).findNext();
  if (!found) throw new Error('ไม่พบข้อมูลนักเรียน');

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    sh.getRange(found.getRow(), 14).setNumberFormat('@').setValue(email);
  } finally {
    lock.releaseLock();
  }

  student.email = email;
  return {success:true, student:publicStudent_(student)};
}

function normalizeStudentEmail_(email) {
  const value = String(email || '').trim().toLowerCase();
  if (!value) throw new Error('กรุณากรอกอีเมลสำหรับรับแจ้งผล');
  if (value.length > 254 || !isValidEmail_(value)) throw new Error('รูปแบบอีเมลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
  return value;
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

  const r = sh.getRange(found.getRow(), 2, 1, 13).getDisplayValues()[0];
  return {
    citizen_id:String(r[0] || ''),
    student_id:String(r[1] || ''),
    class_room:String(r[2] || ''),
    title:String(r[3] || ''),
    first_name:String(r[4] || ''),
    last_name:String(r[5] || ''),
    status:String(r[10] || ''),
    email:String(r[12] || '').trim()
  };
}

function publicStudent_(s) {
  return {student_id:s.student_id, class_room:s.class_room, title:s.title, first_name:s.first_name, last_name:s.last_name, email:String(s.email || '').trim()};
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

function requireStudentSession_(token) {
  const data = requireSession_('student', token, 'เซสชันนักเรียนหมดอายุ กรุณาเข้าสู่ระบบใหม่');
  return mustStudent_(data.student_id);
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
  const reviewMap = getReviewMap_(student.citizen_id);
  out.forEach(r => {
    r.attachments = attachmentMap[r.entry_id] || [];
    r.review = reviewMap[r.entry_id] || null;
  });
  return out;
}

function saveRecord_(p) {
  const student = requireStudentSession_(p.student_token);
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
  const student = requireStudentSession_(p.student_token);
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
    markReviewResubmitted_(entryId, student.citizen_id);
    clearTeacherDashboardCache_();
    return {entry_id:entryId, attachments:attachments};
  } finally {
    lock.releaseLock();
  }
}

function deleteRecord_(p) {
  const student = requireStudentSession_(p.student_token);
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
      deleteReviewForEntry_(entryId, student.citizen_id);
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
  if (cfg.sheet === 'certs-courses' && !String(src.expired_date || '').trim()) src.expired_date = '0';
  return cfg.headers.map(h => normalize_(src[h]));
}

function mustType_(type) {
  const value = String(type || '');
  if (!CONFIG[value]) throw new Error('ประเภทข้อมูลไม่ถูกต้อง');
  return value;
}

function validate_(type, p) {
  if (!Str