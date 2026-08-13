
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
const REVIEW_HEADERS = ['review_id','entry_id','citizen_id','student_id','type','feedback','due_date','status','created_at','updated_at','resubmitted_at','request_id'];

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
  if (!sh) throw new Error('ไม่พบชีต attachments กรุณารัน setupSheets(…4915 tokens truncated…EET_ID).getSheetByName(STUDENT_SHEET_NAME);
  if (!sh) throw new Error('ไม่พบชีตรายชื่อนักเรียน');
  const last = sh.getLastRow();
  if (last < 4) return [];

  return sh.getRange(4, 2, last - 3, 13).getDisplayValues().map(r => ({
    citizen_id:String(r[0] || '').trim(),
    student_id:String(r[1] || '').trim(),
    class_room:String(r[2] || '').trim(),
    title:String(r[3] || '').trim(),
    first_name:String(r[4] || '').trim(),
    last_name:String(r[5] || '').trim(),
    status:String(r[10] || '').trim(),
    email:String(r[12] || '').trim()
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

function buildReviewCountMap_() {
  const sh = SpreadsheetApp.openById(DATA_SPREADSHEET_ID).getSheetByName(REVIEW_SHEET);
  const map = {};
  if (!sh || sh.getLastRow() < 2) return map;
  sh.getRange(2, 1, sh.getLastRow() - 1, REVIEW_HEADERS.length).getDisplayValues().forEach(r => {
    const citizen = String(r[2] || '').trim();
    const type = String(r[4] || '').trim();
    const status = String(r[7] || '').trim();
    if (!citizen || !CONFIG[type]) return;
    if (!map[citizen]) map[citizen] = {};
    if (!map[citizen][type]) map[citizen][type] = {approved:0, needs_revision:0, resubmitted:0};
    if (status === 'approved' || status === 'needs_revision' || status === 'resubmitted') map[citizen][type][status]++;
  });
  return map;
}

function summarizeReviewCounts_(recordCounts, reviewByType, allowedTypes) {
  const summary = {pending:0, approved:0, needs_revision:0, resubmitted:0};
  Object.keys(CONFIG).forEach(type => {
    if (allowedTypes && allowedTypes.indexOf(type) === -1) return;
    const records = Number(recordCounts[type] || 0);
    const reviews = reviewByType[type] || {};
    summary.approved += Number(reviews.approved || 0);
    summary.needs_revision += Number(reviews.needs_revision || 0);
    summary.resubmitted += Number(reviews.resubmitted || 0);
    const finalized = Number(reviews.approved || 0) + Number(reviews.needs_revision || 0);
    summary.pending += Math.max(records - finalized, 0);
  });
  return summary;
}

function teacherDashboardData_() {
  const students = getAllActiveStudents_();
  const countMap = buildRecordCountMap_();
  const reviewMap = buildReviewCountMap_();

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
      counts:{activity:c.activity || 0, prize:c.prize || 0, project:c.project || 0, course:c.course || 0},
      review_by_type:reviewMap[s.citizen_id] || {},
      review_counts:summarizeReviewCounts_(c, reviewMap[s.citizen_id] || {})
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

function publicRecord_(record) {
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

  let reviews = ss.getSheetByName(REVIEW_SHEET);
  if (!reviews) reviews = ss.insertSheet(REVIEW_SHEET);
  if (reviews.getMaxColumns() < REVIEW_HEADERS.length) reviews.insertColumnsAfter(reviews.getMaxColumns(), REVIEW_HEADERS.length - reviews.getMaxColumns());
  const rh = reviews.getRange(1, 1, 1, REVIEW_HEADERS.length);
  const rv = rh.getDisplayValues()[0];
  if (REVIEW_HEADERS.some((h, i) => rv[i] !== h)) rh.setValues([REVIEW_HEADERS]);
  rh.setBackground('#A85D12').setFontColor('#FFFFFF').setFontWeight('bold').setWrap(true);
    reviews.setFrozenRows(1);
    reviews.getRange('B:D').setNumberFormat('@');
    reviews.getRange('G:G').setNumberFormat('@');
    reviews.getRange('L:L').setNumberFormat('@');
}

/**
 * เตรียมค่าความปลอดภัยที่สร้างได้โดยไม่ต้องฝัง secret ลงใน source code
 *
 * วิธีใช้ครั้งแรก:
 * 1) ตั้ง TEACHER_CODE ใน Project Settings > Script Properties ด้วยตนเอง
 * 2) รัน setupConfig() จาก Apps Script editor
 * 3) ตรวจ Execution log แล้ว Deploy เป็น New version
 *
 * ฟังก์ชันนี้จะสร้าง SESSION_SECRET แบบสุ่มเมื่อยังไม่มี และตั้ง origin ของ
 * GitHub Pages ปัจจุบันเมื่อยังไม่มี แต่จะไม่สร้างรหัสครูเริ่มต้นที่คาดเดาได้
 */
function setupConfig() {
  return setupConfig_();
}

function setupConfig_() {
  const props = PropertiesService.getScriptProperties();
  const updates = {};
  const teacherCode = String(props.getProperty('TEACHER_CODE') || '').trim();
  const currentSecret = String(props.getProperty('SESSION_SECRET') || '').trim();
  const currentOrigin = String(props.getProperty('ALLOWED_ORIGIN') || '').trim();

  if (!currentSecret) updates.SESSION_SECRET = Utilities.getUuid() + Utilities.getUuid();
  if (!currentOrigin) updates.ALLOWED_ORIGIN = DEFAULT_ALLOWED_ORIGIN;
  if (Object.keys(updates).length) props.setProperties(updates, false);

  const errors = [];
  if (!teacherCode) errors.push('ยังไม่ได้ตั้งค่า TEACHER_CODE ใน Script Properties');
  if (teacherCode && teacherCode.length < 8) errors.push('TEACHER_CODE ควรมีอย่างน้อย 8 ตัวอักษร');
  const secret = String(props.getProperty('SESSION_SECRET') || '').trim();
  if (secret.length < 32) errors.push('SESSION_SECRET ต้องมีอย่างน้อย 32 ตัวอักษร');
  const origin = String(props.getProperty('ALLOWED_ORIGIN') || '').trim();
  if (!validAllowedOrigin_(origin)) errors.push('ALLOWED_ORIGIN ต้องเป็น HTTPS origin เช่น ' + DEFAULT_ALLOWED_ORIGIN);

  const result = {
    ok:errors.length === 0,
    teacher_code_configured:!!teacherCode,
    session_secret_configured:secret.length >= 32,
    allowed_origin:origin,
    message:errors.length ? errors.join(' | ') : 'ตั้งค่าความปลอดภัยพร้อมใช้งานแล้ว'
  };
  console.log(JSON.stringify(result));
  if (errors.length) throw new Error(result.message);
  return result;
}

/* ========================= HELPERS ========================= */
function scriptProperty_(name) {
  return String(PropertiesService.getScriptProperties().getProperty(name) || '').trim();
}

function sessionSecret_() {
  const secret = scriptProperty_('SESSION_SECRET');
  if (secret.length < 32) throw new Error('ยังไม่ได้ตั้งค่า SESSION_SECRET อย่างน้อย 32 ตัวอักษรใน Script Properties');
  return secret;
}

function sessionSeconds_(propertyName) {
  const value = Number(scriptProperty_(propertyName) || DEFAULT_SESSION_SECONDS);
  return Math.max(300, Math.min(21600, isFinite(value) ? Math.floor(value) : DEFAULT_SESSION_SECONDS));
}

function loginMaxAttempts_() {
  const value = Number(scriptProperty_('LOGIN_MAX_ATTEMPTS') || DEFAULT_LOGIN_MAX_ATTEMPTS);
  return Math.max(3, Math.min(20, isFinite(value) ? Math.floor(value) : DEFAULT_LOGIN_MAX_ATTEMPTS));
}

function loginLockSeconds_() {
  const value = Number(scriptProperty_('LOGIN_LOCK_SECONDS') || DEFAULT_LOGIN_LOCK_SECONDS);
  return Math.max(60, Math.min(21600, isFinite(value) ? Math.floor(value) : DEFAULT_LOGIN_LOCK_SECONDS));
}

function normalizeDigits_(value) {
  return String(value || '').replace(/\D/g, '');
}

function hmac_(value) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(String(value), sessionSecret_())).replace(/=+$/g, '');
}

function secureKey_(value) {
  return hmac_('key:' + String(value)).slice(0, 32);
}

function secureEqual_(left, right) {
  left = String(left || '');
  right = String(right || '');
  let diff = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i++) diff |= (left.charCodeAt(i % Math.max(left.length, 1)) || 0) ^ (right.charCodeAt(i % Math.max(right.length, 1)) || 0);
  return diff === 0;
}

function createSessionToken_(kind, data, seconds) {
  const id = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  const token = id + '.' + hmac_(kind + ':' + id);
  const sessionData = Object.assign({}, data, {expires_at:Date.now() + seconds * 1000});
  storeSession_(kind, token, sessionData, seconds);
  return token;
}

function validSessionToken_(kind, token) {
  token = String(token || '').trim();
  const parts = token.split('.');
  if (parts.length !== 2 || !/^[a-f0-9]{64}$/i.test(parts[0])) return false;
  return secureEqual_(parts[1], hmac_(kind + ':' + parts[0]));
}

function sessionCacheKey_(kind, token) {
  return 'session:' + kind + ':' + secureKey_(String(token));
}

function requireSession_(kind, token, expiredMessage) {
  if (!validSessionToken_(kind, token)) throw new Error(expiredMessage);
  const cached = CacheService.getScriptCache().get(sessionCacheKey_(kind, token));
  if (!cached) throw new Error(expiredMessage);
  try {
    const data = JSON.parse(cached);
    if (!data.expires_at || Number(data.expires_at) <= Date.now()) {
      removeSession_(kind, token);
      throw new Error(expiredMessage);
    }
    return data;
  } catch (err) {
    if (err && err.message === expiredMessage) throw err;
    throw new Error(expiredMessage);
  }
}

function storeSession_(kind, token, data, seconds) {
  if (!validSessionToken_(kind, token)) return;
  CacheService.getScriptCache().put(sessionCacheKey_(kind, token), JSON.stringify(data), seconds);
}

function removeSession_(kind, token) {
  if (!validSessionToken_(kind, token)) return;
  CacheService.getScriptCache().remove(sessionCacheKey_(kind, token));
}

function loginRateCacheKey_(rateKey) {
  return 'login-rate:' + rateKey;
}

function readLoginRate_(rateKey) {
  const raw = CacheService.getScriptCache().get(loginRateCacheKey_(rateKey));
  if (!raw) return {attempts:0, locked_until:0};
  try { return JSON.parse(raw); } catch (_) { return {attempts:0, locked_until:0}; }
}

function requireLoginAllowed_(rateKey) {
  const state = readLoginRate_(rateKey);
  const remaining = Number(state.locked_until || 0) - Date.now();
  if (remaining > 0) throw new Error('มีการลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอ ' + Math.ceil(remaining / 60000) + ' นาทีแล้วลองใหม่');
}

function recordLoginFailure_(rateKey) {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const state = readLoginRate_(rateKey);
    state.attempts = Number(state.attempts || 0) + 1;
    if (state.attempts >= loginMaxAttempts_()) state.locked_until = Date.now() + loginLockSeconds_() * 1000;
    CacheService.getScriptCache().put(loginRateCacheKey_(rateKey), JSON.stringify(state), loginLockSeconds_());
    return state;
  } finally {
    lock.releaseLock();
  }
}

function throwLoginFailure_(state, invalidMessage) {
  const remaining = Number(state && state.locked_until || 0) - Date.now();
  if (remaining > 0) throw new Error('มีการลองเข้าสู่ระบบหลายครั้งเกินไป ระบบล็อกชั่วคราว ' + Math.ceil(remaining / 60000) + ' นาที');
  throw new Error(invalidMessage);
}

function clearLoginFailures_(rateKey) {
  CacheService.getScriptCache().remove(loginRateCacheKey_(rateKey));
}

function normalize_(v) {
  return v === null || v === undefined ? '' : String(v).trim();
}

function jsonp_(obj, callback) {
  const cb = String(callback || '').replace(/[^a-zA-Z0-9_$.]/g, '');
  const json = JSON.stringify(obj);
  return ContentService.createTextOutput(cb ? cb + '(' + json + ');' : json).setMimeType(cb ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}

function validAllowedOrigin_(origin) {
  return /^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(String(origin || '').trim());
}

function requireAllowedOrigin_(requestOrigin) {
  const allowedOrigin = scriptProperty_('ALLOWED_ORIGIN');
  if (!validAllowedOrigin_(allowedOrigin)) throw new Error('ยังไม่ได้ตั้งค่า ALLOWED_ORIGIN ที่ถูกต้องใน Script Properties');
  if (String(requestOrigin || '').trim() !== allowedOrigin) throw new Error('เว็บไซต์ต้นทางไม่ได้รับอนุญาต กรุณาตรวจ ALLOWED_ORIGIN');
  return allowedOrigin;
}

function postMessageOutput_(obj) {
  let allowedOrigin = scriptProperty_('ALLOWED_ORIGIN');
  let response = Object.assign({source:'tcas-apps-script'}, obj);
  if (!validAllowedOrigin_(allowedOrigin)) {
    // ส่งเฉพาะ configuration error ที่ไม่เปิดเผยข้อมูล เพื่อไม่ให้ frontend รอจน timeout
    allowedOrigin = '*';
    response = {source:'tcas-apps-script', ok:false, token:String(obj.token || ''), message:'ยังไม่ได้ตั้งค่า ALLOWED_ORIGIN ที่ถูกต้องใน Script Properties'};
  }
  const data = JSON.stringify(response).replace(/</g, '\\u003c');
  const html = '<!doctype html><meta charset="utf-8"><script>window.top.postMessage(' + data + ',' + JSON.stringify(allowedOrigin) + ');<\/script>';
  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function safeError_(e) {
  return e && e.message ? String(e.message) : 'เกิดข้อผิดพลาดของระบบ';
}

