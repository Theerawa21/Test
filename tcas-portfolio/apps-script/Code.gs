­r‡^Ñf¥–Ø¦{N¬yÊ'vÃ®¶›­
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
const DEFAULT_SESSION_SECONDS = 21600; // 6 à¸Šà¸±à¹ˆà¸§à¹‚à¸¡à¸‡
const DEFAULT_LOGIN_MAX_ATTEMPTS = 5;
const DEFAULT_LOGIN_LOCK_SECONDS = 900; // 15 à¸™à¸²à¸—à¸µ
const DEFAULT_ALLOWED_ORIGIN = 'https://theerawa21.github.io';
const PORTFOLIO_APP_URL = 'https://theerawa21.github.io/Test/tcas-portfolio/';
const SCHOOL_NAME = 'à¹‚à¸£à¸‡à¹€à¸£à¸µà¸¢à¸™à¹€à¸‹à¸™à¸•à¹Œà¹€à¸—à¹€à¸£à¸‹à¸²';

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

    if (action === 'lookup' || action === 'records') result = {ok:false, message:'à¸à¸£à¸¸à¸“à¸²à¹€à¸‚à¹‰à¸²à¸ªà¸¹à¹ˆà¸£à¸°à¸šà¸šà¸”à¹‰à¸§à¸¢à¸£à¸«à¸±à¸ªà¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¹à¸¥à¸°à¹€à¸¥à¸‚à¸—à¹‰à¸²à¸¢à¸šà¸±à¸•à¸£à¸›à¸£à¸°à¸Šà¸²à¸Šà¸™ 4 à¸«à¸¥à¸±à¸'};
    else if (action === 'health') result = {ok:true, message:'TCAS API à¸žà¸£à¹‰à¸­à¸¡à¹ƒà¸Šà¹‰à¸‡à¸²à¸™', time:new Date().toISOString()};
    else result = {ok:true, message:'TCAS API à¸žà¸£à¹‰à¸­à¸¡à¹ƒà¸Šà¹‰à¸‡à¸²à¸™'};

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
    else throw new Error('à¸„à¸³à¸ªà¸±à¹ˆà¸‡à¹„à¸¡à¹ˆà¸–à¸¹à¸à¸•à¹‰à¸­à¸‡');

    return postMessageOutput_({ok:true, token:token, result:result});
  } catch (err) {
    return postMessageOutput_({ok:false, token:token, message:safeError_(err)});
  }
}

/* ========================= STUDENTS ========================= */
function studentLogin_(id, citizenLast4) {
  id = normalizeDigits_(id);
  citizenLast4 = normalizeDigits_(citizenLast4);
  if (!id || citizenLast4.length !== 4) throw new Error('à¸à¸£à¸¸à¸“à¸²à¸à¸£à¸­à¸à¸£à¸«à¸±à¸ªà¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¹à¸¥à¸°à¹€à¸¥à¸‚à¸—à¹‰à¸²à¸¢à¸šà¸±à¸•à¸£à¸›à¸£à¸°à¸Šà¸²à¸Šà¸™ 4 à¸«à¸¥à¸±à¸');

  const rateKey = 'student:' + secureKey_(id);
  requireLoginAllowed_(rateKey);
  const s = lookupStudent_(id);
  const actualLast4 = s ? normalizeDigits_(s.citizen_id).slice(-4) : '';
  if (!s || (s.status && s.status !== 'à¸à¸³à¸¥à¸±à¸‡à¸¨à¸¶à¸à¸©à¸²à¸­à¸¢à¸¹à¹ˆ') || !secureEqual_(actualLast4, citizenLast4)) {
    const rate = recordLoginFailure_(rateKey);
    throwLoginFailure_(rate, 'à¸£à¸«à¸±à¸ªà¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¸«à¸£à¸·à¸­à¹€à¸¥à¸‚à¸—à¹‰à¸²à¸¢à¸šà¸±à¸•à¸£à¸›à¸£à¸°à¸Šà¸²à¸Šà¸™à¹„à¸¡à¹ˆà¸–à¸¹à¸à¸•à¹‰à¸­à¸‡');
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
  if (!sh) throw new Error('à¹„à¸¡à¹ˆà¸žà¸šà¸Šà¸µà¸•à¸£à¸²à¸¢à¸Šà¸·à¹ˆà¸­à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™');
  const last = sh.getLastRow();
  if (last < 4) throw new Error('à¹„à¸¡à¹ˆà¸žà¸šà¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™');

  const found = sh.getRange(4, 3, last - 3, 1).createTextFinder(student.student_id).matchEntireCell(true).findNext();
  if (!found) throw new Error('à¹„à¸¡à¹ˆà¸žà¸šà¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™');

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
  if (!value) throw new Error('à¸à¸£à¸¸à¸“à¸²à¸à¸£à¸­à¸à¸­à¸µà¹€à¸¡à¸¥à¸ªà¸³à¸«à¸£à¸±à¸šà¸£à¸±à¸šà¹à¸ˆà¹‰à¸‡à¸œà¸¥');
  if (value.length > 254 || !isValidEmail_(value)) throw new Error('à¸£à¸¹à¸›à¹à¸šà¸šà¸­à¸µà¹€à¸¡à¸¥à¹„à¸¡à¹ˆà¸–à¸¹à¸à¸•à¹‰à¸­à¸‡ à¸à¸£à¸¸à¸“à¸²à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¸­à¸µà¸à¸„à¸£à¸±à¹‰à¸‡');
  return value;
}

function lookupStudent_(id) {
  id = String(id || '').replace(/\D/g, '').trim();
  if (!id) return null;

  const sh = SpreadsheetApp.openById(STUDENT_SPREADSHEET_ID).getSheetByName(STUDENT_SHEET_NAME);
  if (!sh) throw new Error('à¹„à¸¡à¹ˆà¸žà¸šà¸Šà¸µà¸•à¸£à¸²à¸¢à¸Šà¸·à¹ˆà¸­à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™');
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
  if (!s) throw new Error('à¹„à¸¡à¹ˆà¸žà¸šà¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™');
  if (s.status && s.status !== 'à¸à¸³à¸¥à¸±à¸‡à¸¨à¸¶à¸à¸©à¸²à¸­à¸¢à¸¹à¹ˆ') throw new Error('à¸ªà¸–à¸²à¸™à¸°à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¹„à¸¡à¹ˆà¸–à¸¹à¸à¸•à¹‰à¸­à¸‡');
  return s;
}

function requireStudentSession_(token) {
  const data = requireSession_('student', token, 'à¹€à¸‹à¸ªà¸Šà¸±à¸™à¸™à¸±à¸à¹€à¸£à¸µà¸¢à¸™à¸«à¸¡à¸”à¸­à¸²à¸¢à¸¸ à¸à¸£à¸¸à¸“à¸²à¹€à¸‚à¹‰à¸²à¸ªà¸¹à¹ˆà¸£à¸°à¸šà¸šà¹ƒà¸«à¸¡à¹ˆ');
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
    if (!sh) throw new Error('à¹„à¸¡à¹ˆà¸žà¸šà¸Šà¸µà¸• ' + cfg.sheet + ' à¸à¸£à¸¸à¸“à¸²à¸£à¸±à¸™ setupSheets() à¸à¹ˆà¸­à¸™');

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
  if (!entryId) throw new Error('à¹„à¸¡à¹ˆà¸žà¸šà¸£à¸«à¸±à¸ªà¸£à¸²à¸¢à¸à¸²à¸£');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = SpreadsheetApp.openById(DATA_SPREADSHEET_ID).getSheetByName(cfg.sheet);
    if (!sh) throw new Error('à¹„à¸¡à¹ˆà¸žà¸šà¸Šà¸µà¸• ' + cfg.sheet);
    const row = findEntryRow_(sh, entryId);
    if (!row) throw new Error('à¹„à¸¡à¹ˆà¸žà¸šà¸£à¸²à¸¢à¸à¸²à¸£à¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¸à¸²à¸£à¹à¸à¹‰à¹„à¸‚');
    if (String(sh.getRange(row, 1).getDisplayValue()) !== student.citizen_id) throw new Error('à¹„à¸¡à¹ˆà¸¡à¸µà¸ªà¸´à¸—à¸˜à¸´à¹Œà¹à¸à¹‰à¹„à¸‚à¸£à¸²à¸¢à¸à¸²à¸£à¸™à¸µà¹‰');

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
  if (!entryId) throw new Error('à¹„à¸¡à¹ˆà¸žà¸šà¸£à¸«à¸±à¸ªà¸£à¸²à¸¢à¸à¸²à¸£');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = SpreadsheetApp.openById(DATA_SPREADSHEET_ID);
    for (const type of Object.keys(CONFIG)) {
      const sh = ss.getSheetByName(CONFIG[type].sheet);
      if (!sh) continue;
      const row = findEntryRow_(sh, entryId);
      if (!row) continue;
      if (String(sh.getRange(row, 1).getDisplayValue()) !== student.citizen_id) throw new Error('à¹„à¸¡à¹ˆà¸¡à¸µà¸ªà¸´à¸—à¸˜à¸´à¹Œà¸¥à¸šà¸£à¸²à¸¢à¸à¸²à¸£à¸™à¸µà¹‰');
      deleteAttachmentsForEntry_(entryId, student.citizen_id);
      deleteReviewForEntry_(entryId, student.citizen_id);
      sh.deleteRow(row);
      clearTeacherDashboardCache_();
      return {entry_id:entryId};
    }
    throw new Error('à¹„à¸¡à¹ˆà¸žà¸šà¸£à¸²à¸¢à¸à¸²à¸£à¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¸à¸²à¸£à¸¥à¸š');
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
  if (!CONFIG[value]) throw new Error('à¸›à¸£à¸°à¹€à¸ à¸—à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¹„à¸¡à¹ˆà¸–à¸¹à¸à¸•à¹‰à¸­à¸‡');
  return value;
}

function validate_(type, p) {
ïNõ¶‰žËkºwµçyÕµ‰•È¡É•Ù¥•ÝÌ¹¹••‘Í}É•Ù¥Í¥½¸ñð€À¤ì(€€€ÍÕµµ…Éä¹Á•¹‘¥¹œ€¬ô5…Ñ ¹µ…à¡É•½É‘Ì€´™¥¹…±¥é•°€À¤ì(€ô¤ì(€É•ÑÕÉ¸ÍÕµµ…Éäì)ô()™Õ¹Ñ¥½¸Ñ•…¡•É…Í¡‰½…É‘…Ñ…| ¤ì(€½¹ÍÐÍÑÕ‘•¹ÑÌ€ô•Ñ±±Ñ¥Ù•MÑÕ‘•¹ÑÍ| ¤ì(€½¹ÍÐ½Õ¹Ñ5…À€ô‰Õ¥±‘I•½É‘½Õ¹Ñ5…Á| ¤ì(€½¹ÍÐÉ•Ù¥•Ý5…À€ô‰Õ¥±‘I•Ù¥•Ý½Õ¹Ñ5…Á| ¤ì(4(€½¹ÍÐ±¥ÍÐ€ôÍÑÕ‘•¹ÑÌ¹µ…À¡Ì€ôøì4(€€€½¹ÍÐŒ€ô½Õ¹Ñ5…ÁmÌ¹¥Ñ¥é•¹}¥‘tñðí…Ñ¥Ù¥ÑäèÀ°ÁÉ¥é”èÀ°ÁÉ½©•ÐèÀ°½ÕÉÍ”èÀ°Ñ½Ñ…°èÁôì4(€€€É•ÑÕÉ¸ì4(€€€€€ÍÑÕ‘•¹Ñ}¥éÌ¹ÍÑÕ‘•¹Ñ}¥°4(€€€€€±…ÍÍ}É½½´éÌ¹±…ÍÍ}É½½´°4(€€€€€Ñ¥Ñ±”éÌ¹Ñ¥Ñ±”°4(€€€€€™¥ÉÍÑ}¹…µ”éÌ¹™¥ÉÍÑ}¹…µ”°4(€€€€€±…ÍÑ}¹…µ”éÌ¹±…ÍÑ}¹…µ”°4(€€€€€ÍÕ‰µ¥ÑÑ•éŒ¹Ñ½Ñ…°€ø€À°(€€€€€Ñ½Ñ…±}É•½É‘ÌéŒ¹Ñ½Ñ…°°(€€€€€½Õ¹ÑÌéí…Ñ¥Ù¥ÑäéŒ¹…Ñ¥Ù¥Ñäñð€À°ÁÉ¥é”éŒ¹ÁÉ¥é”ñð€À°ÁÉ½©•ÐéŒ¹ÁÉ½©•Ðñð€À°½ÕÉÍ”éŒ¹½ÕÉÍ”ñð€Áô°(€€€€€É•Ù¥•Ý}‰å}ÑåÁ”éÉ•Ù¥•Ý5…ÁmÌ¹¥Ñ¥é•¹}¥‘tñðíô°(€€€€€É•Ù¥•Ý}½Õ¹ÑÌéÍÕµµ…É¥é•I•Ù¥•Ý½Õ¹ÑÍ|¡Œ°É•Ù¥•Ý5…ÁmÌ¹¥Ñ¥é•¹}¥‘tñðíô¤(€€€ôì4(€ô¤ì4(4(€±¥ÍÐ¹Í½ÉÐ ¡„°ˆ¤€ôøMÑÉ¥¹œ¡„¹±…ÍÍ}É½½´¤¹±½…±•½µÁ…É”¡MÑÉ¥¹œ¡ˆ¹±…ÍÍ}É½½´¤°€Ñ œ¤ñð9Õµ‰•È¡„¹ÍÑÕ‘•¹Ñ}¥ñð€À¤€´9Õµ‰•È¡ˆ¹ÍÑÕ‘•¹Ñ}¥ñð€À¤¤ì4(4(€½¹ÍÐÉ½½µ5…À€ôíôì4(€±¥ÍÐ¹™½É… ¡Ì€ôøì4(€€€½¹ÍÐÉ½½´€ôÌ¹±…ÍÍ}É½½´ñð€Ÿ‚æ‚â‡‚æ#‚â‚âÃ‚âk‚âã‚â¯‚æ'‚â·‚âœì4(€€€¥˜€ …É½½µ5…ÁmÉ½½µt¤É½½µ5…ÁmÉ½½µt€ôí±…ÍÍ}É½½´éÉ½½´°Ñ½Ñ…°èÀ°ÍÕ‰µ¥ÑÑ•èÀ°¹½Ñ}ÍÕ‰µ¥ÑÑ•èÀ°É•½É‘ÌèÁôì4(€€€É½½µ5…ÁmÉ½½µt¹Ñ½Ñ…°¬¬ì4(€€€É½½µ5…ÁmÉ½½µt¹É•½É‘Ì€¬ô9Õµ‰•È¡Ì¹Ñ½Ñ…±}É•½É‘Ìñð€À¤ì4(€€€¥˜€¡9Õµ‰•È¡Ì¹Ñ½Ñ…±}É•½É‘Ìñð€À¤€ø€À¤É½½µ5…ÁmÉ½½µt¹ÍÕ‰µ¥ÑÑ•¬¬ì4(€€€•±Í”É½½µ5…ÁmÉ½½µt¹¹½Ñ}ÍÕ‰µ¥ÑÑ•¬¬ì4(€ô¤ì4(4(€½¹ÍÐÉ½½µÌ€ô=‰©•Ð¹­•åÌ¡É½½µ5…À¤¹Í½ÉÐ ¡„°ˆ¤€ôø„¹±½…±•½µÁ…É”¡ˆ°€Ñ œ¤¤¹µ…À¡¬€ôøÉ½½µ5…Ám­t¤ì4(€½¹ÍÐÍÕ‰µ¥ÑÑ•€ô±¥ÍÐ¹™¥±Ñ•È¡Ì€ôø9Õµ‰•È¡Ì¹Ñ½Ñ…±}É•½É‘Ìñð€À¤€ø€À¤¹±•¹Ñ ì4(€½¹ÍÐÑ½Ñ…±I•½É‘Ì€ô±¥ÍÐ¹É•‘Õ” ¡ÍÕ´°Ì¤€ôøÍÕ´€¬9Õµ‰•È¡Ì¹Ñ½Ñ…±}É•½É‘Ìñð€À¤°€À¤ì4(4(€É•ÑÕÉ¸ì4(€€€•¹•É…Ñ•‘}…ÐéUÑ¥±¥Ñ¥•Ì¹™½Éµ…Ñ…Ñ”¡¹•Ü…Ñ” ¤°€Í¥„½	…¹­½¬œ°€‘½54½åååä! éµ´éÍÌœ¤°4(€€€Ñ½Ñ…±}ÍÑÕ‘•¹ÑÌé±¥ÍÐ¹±•¹Ñ °4(€€€ÍÕ‰µ¥ÑÑ•‘}ÍÑÕ‘•¹ÑÌéÍÕ‰µ¥ÑÑ•°4(€€€¹½Ñ}ÍÕ‰µ¥ÑÑ•‘}ÍÑÕ‘•¹ÑÌé±¥ÍÐ¹±•¹Ñ €´ÍÕ‰µ¥ÑÑ•°4(€€€Ñ½Ñ…±}É•½É‘ÌéÑ½Ñ…±I•½É‘Ì°4(€€€É½½µÌéÉ½½µÌ°4(€€€ÍÑÕ‘•¹ÑÌé±¥ÍÐ4(€ôì4)ô4(4)™Õ¹Ñ¥½¸ÁÕ‰±¥I•½É‘|¡É•½É¤ì(€½¹ÍÐ½ÕÐ€ôíôì4(€=‰©•Ð¹­•åÌ¡É•½É¤¹™½É… ¡­•ä€ôøì4(€€€¥˜€¡l¥Ñ¥é•¹}¥œ°Ñ¥Ñ±”œ°™¥ÉÍÑ}¹…µ”œ°±…ÍÑ}¹…µ”t¹¥¹‘•á=˜¡­•ä¤€„ôô€´Ä¤É•ÑÕÉ¸ì4(€€€½ÕÑm­•åt€ôÉ•½É‘m­•åtì4(€ô¤ì4(€É•ÑÕÉ¸½ÕÐì4)ô4(4(¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôôMQU@€ôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼4)™Õ¹Ñ¥½¸Í•ÑÕÁM¡••ÑÌ ¤ì(€Í•ÑÕÁM¡••ÑÍ| ¤ì4(€É•ÑÕÉ¸€Ÿ‚â{‚â‚æ'‚â·‚â‡‚æ‚â+‚æ'‚â‚âË‚âdœì4)ô4(4)™Õ¹Ñ¥½¸Í•ÑÕÁM¡••ÑÍ| ¤ì4(€½¹ÍÐÍÌ€ôMÁÉ•…‘Í¡••ÑÁÀ¹½Á•¹	å%¡Q}MAIM!Q}%¤ì4(4(€=‰©•Ð¹­•åÌ¡=9%¤¹™½É… ¡ÑåÁ”€ôøì4(€€€½¹ÍÐ™œ€ô=9%mÑåÁ•tì4(€€€±•ÐÍ €ôÍÌ¹•ÑM¡••Ñ	å9…µ”¡™œ¹Í¡••Ð¤ì4(€€€¥˜€ …Í ¤Í €ôÍÌ¹¥¹Í•ÉÑM¡••Ð¡™œ¹Í¡••Ð¤ì4(€€€¥˜€¡Í ¹•Ñ5…á½±Õµ¹Ì ¤€ð™œ¹¡•…‘•ÉÌ¹±•¹Ñ ¤Í ¹¥¹Í•ÉÑ½±Õµ¹Í™Ñ•È¡Í ¹•Ñ5…á½±Õµ¹Ì ¤°™œ¹¡•…‘•ÉÌ¹±•¹Ñ €´Í ¹•Ñ5…á½±Õµ¹Ì ¤¤ì4(4(€€€½¹ÍÐ¡•…€ôÍ ¹•ÑI…¹” Ä°€Ä°€Ä°™œ¹¡•…‘•ÉÌ¹±•¹Ñ ¤ì4(€€€½¹ÍÐÕÉÉ•¹Ð€ô¡•…¹•Ñ¥ÍÁ±…åY…±Õ•Ì ¥lÁtì4(€€€¥˜€¡™œ¹¡•…‘•ÉÌ¹Í½µ” ¡ °¤¤€ôøÕÉÉ•¹Ñm¥t€„ôô ¤¤¡•…¹Í•ÑY…±Õ•Ì¡m™œ¹¡•…‘•ÉÍt¤ì4(4(€€€¡•…¹Í•Ñ	…­É½Õ¹ œŒÄÜÌØÕœ¤¹Í•Ñ½¹Ñ½±½È œœ¤¹Í•Ñ½¹Ñ]•¥¡Ð ‰½±œ¤¹Í•Ñ!½É¥é½¹Ñ…±±¥¹µ•¹Ð •¹Ñ•Èœ¤¹Í•ÑY•ÉÑ¥…±±¥¹µ•¹Ð µ¥‘‘±”œ¤¹Í•Ñ]É…À¡ÑÉÕ”¤ì4(€€€Í ¹Í•ÑÉ½é•¹I½ÝÌ Ä¤ì4(€€€Í ¹•ÑI…¹” éœ¤¹Í•Ñ9Õµ‰•É½Éµ…Ð  œ¤ì4(4(€€€½¹ÍÐ±•Ù•±½±Õµ¸€ô™œ¹¡•…‘•ÉÌ¹¥¹‘•á=˜ ±•Ù•°œ¤€¬€Äì4(€€€¥˜€¡±•Ù•±½±Õµ¸€ø€À¤ì4(€€€€€½¹ÍÐÉÕ±”€ôMÁÉ•…‘Í¡••ÑÁÀ¹¹•Ý…Ñ…Y…±¥‘…Ñ¥½¸ ¤¹É•ÅÕ¥É•Y…±Õ•%¹1¥ÍÐ¡lÍ¡½½°œ°‘¥ÍÑÉ¥Ðœ°É•¥½¹…°œ°¹…Ñ¥½¹…°œ°¥¹Ñ•É¹…Ñ¥½¹…°t°ÑÉÕ”¤¹Í•Ñ±±½Ý%¹Ù…±¥¡™…±Í”¤¹‰Õ¥± ¤ì4(€€€€€Í ¹•ÑI…¹” È°±•Ù•±½±Õµ¸°5…Ñ ¹µ…à¡Í ¹•Ñ5…áI½ÝÌ ¤€´€Ä°€Ä¤°€Ä¤¹Í•Ñ…Ñ…Y…±¥‘…Ñ¥½¸¡ÉÕ±”¤ì4(€€€ô4(€ô¤ì4(4(€±•Ð…ÑÐ€ôÍÌ¹•ÑM¡••Ñ	å9…µ”¡QQ!59Q}M!P¤ì4(€¥˜€ ……ÑÐ¤…ÑÐ€ôÍÌ¹¥¹Í•ÉÑM¡••Ð¡QQ!59Q}M!P¤ì4(€¥˜€¡…ÑÐ¹•Ñ5…á½±Õµ¹Ì ¤€ðQQ}!IL¹±•¹Ñ ¤…ÑÐ¹¥¹Í•ÉÑ½±Õµ¹Í™Ñ•È¡…ÑÐ¹•Ñ5…á½±Õµ¹Ì ¤°QQ}!IL¹±•¹Ñ €´…ÑÐ¹•Ñ5…á½±Õµ¹Ì ¤¤ì4(4(€½¹ÍÐ… €ô…ÑÐ¹•ÑI…¹” Ä°€Ä°€Ä°QQ}!IL¹±•¹Ñ ¤ì4(€½¹ÍÐ…Ø€ô… ¹•Ñ¥ÍÁ±…åY…±Õ•Ì ¥lÁtì4(€¥˜€¡QQ}!IL¹Í½µ” ¡ °¤¤€ôø…Ùm¥t€„ôô ¤¤… ¹Í•ÑY…±Õ•Ì¡mQQ}!IMt¤ì4(€… ¹Í•Ñ	…­É½Õ¹ œŒÙÑåœ¤¹Í•Ñ½¹Ñ½±½È œœ¤¹Í•Ñ½¹Ñ]•¥¡Ð ‰½±œ¤¹Í•Ñ]É…À¡ÑÉÕ”¤ì(€…ÑÐ¹Í•ÑÉ½é•¹I½ÝÌ Ä¤ì(€…ÑÐ¹•ÑI…¹” éœ¤¹Í•Ñ9Õµ‰•É½Éµ…Ð  œ¤ì((€±•ÐÉ•Ù¥•ÝÌ€ôÍÌ¹•ÑM¡••Ñ	å9…µ”¡IY%]}M!P¤ì(€¥˜€ …É•Ù¥•ÝÌ¤É•Ù¥•ÝÌ€ôÍÌ¹¥¹Í•ÉÑM¡••Ð¡IY%]}M!P¤ì(€¥˜€¡É•Ù¥•ÝÌ¹•Ñ5…á½±Õµ¹Ì ¤€ðIY%]}!IL¹±•¹Ñ ¤É•Ù¥•ÝÌ¹¥¹Í•ÉÑ½±Õµ¹Í™Ñ•È¡É•Ù¥•ÝÌ¹•Ñ5…á½±Õµ¹Ì ¤°IY%]}!IL¹±•¹Ñ €´É•Ù¥•ÝÌ¹•Ñ5…á½±Õµ¹Ì ¤¤ì(€½¹ÍÐÉ €ôÉ•Ù¥•ÝÌ¹•ÑI…¹” Ä°€Ä°€Ä°IY%]}!IL¹±•¹Ñ ¤ì(€½¹ÍÐÉØ€ôÉ ¹•Ñ¥ÍÁ±…åY…±Õ•Ì ¥lÁtì(€¥˜€¡IY%]}!IL¹Í½µ” ¡ °¤¤€ôøÉÙm¥t€„ôô ¤¤É ¹Í•ÑY…±Õ•Ì¡mIY%]}!IMt¤ì(€É ¹Í•Ñ	…­É½Õ¹ œàÕÄÈœ¤¹Í•Ñ½¹Ñ½±½È œœ¤¹Í•Ñ½¹Ñ]•¥¡Ð ‰½±œ¤¹Í•Ñ]É…À¡ÑÉÕ”¤ì(€€€É•Ù¥•ÝÌ¹Í•ÑÉ½é•¹I½ÝÌ Ä¤ì(€€€É•Ù¥•ÝÌ¹•ÑI…¹” éœ¤¹Í•Ñ9Õµ‰•É½Éµ…Ð  œ¤ì(€€€É•Ù¥•ÝÌ¹•ÑI…¹” éœ¤¹Í•Ñ9Õµ‰•É½Éµ…Ð  œ¤ì(€€€É•Ù¥•ÝÌ¹•ÑI…¹” 0é0œ¤¹Í•Ñ9Õµ‰•É½Éµ…Ð  œ¤ì)ô((¼¨¨(€¨ƒ‚æ‚âW‚â‚â×‚â‹‚â‡‚â‚æ#‚âË‚â‚âŸ‚âË‚â‡‚âo‚â—‚â·‚âS‚âƒ‚âÇ‚â‹‚â_‚â×‚æ#‚â«‚â‚æ'‚âË‚â‚æ‚âS‚æ'‚æ‚âS‚â‹‚æ‚â‡‚æ#‚âW‚æ'‚â·‚â‚âw‚âÇ‚âÍ•É•Ðƒ‚â—‚â‚æ‚âdÍ½ÕÉ”½‘”(€¨(€¨ƒ‚âŸ‚âÓ‚âc‚â×‚æ‚â+‚æ'‚â‚â‚âÇ‚æ'‚â‚æ‚â‚âè(€¨€Ä¤ƒ‚âW‚âÇ‚æ'‚âQ!I}=ƒ‚æ‚âdAÉ½©•ÐM•ÑÑ¥¹Ì€øMÉ¥ÁÐAÉ½Á•ÉÑ¥•Ìƒ‚âS‚æ'‚âŸ‚â‹‚âW‚âg‚æ‚â·‚â(€¨€È¤ƒ‚â‚âÇ‚âdÍ•ÑÕÁ½¹™¥œ ¤ƒ‚â#‚âË‚âÁÁÌMÉ¥ÁÐ•‘¥Ñ½È(€¨€Ì¤ƒ‚âW‚â‚âŸ‚â á•ÕÑ¥½¸±½œƒ‚æ‚â—‚æ'‚âœ•Á±½äƒ‚æ‚âo‚æ‚âd9•ÜÙ•ÉÍ¥½¸(€¨(€¨ƒ‚â‚âÇ‚â‚â‚æ3‚â+‚âÇ‚âg‚âg‚â×‚æ'‚â#‚âÃ‚â«‚â‚æ'‚âË‚âMMM%=9}MIPƒ‚æ‚âk‚âk‚â«‚âã‚æ#‚â‡‚æ‚â‡‚âß‚æ#‚â·‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‡‚âÔƒ‚æ‚â—‚âÃ‚âW‚âÇ‚æ'‚â½É¥¥¸ƒ‚â‚â·‚â(€¨¥Ñ!ÕˆA…•Ìƒ‚âo‚âÇ‚â#‚â#‚âã‚âk‚âÇ‚âg‚æ‚â‡‚âß‚æ#‚â·‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚â‡‚âÔƒ‚æ‚âW‚æ#‚â#‚âÃ‚æ‚â‡‚æ#‚â«‚â‚æ'‚âË‚â‚â‚â¯‚âÇ‚â«‚â‚â‚âç‚æ‚â‚âÓ‚æ#‚â‡‚âW‚æ'‚âg‚â_‚â×‚æ#‚â‚âË‚âS‚æ‚âS‚âË‚æ‚âS‚æ$(€¨¼)™Õ¹Ñ¥½¸Í•ÑÕÁ½¹™¥œ ¤ì(€É•ÑÕÉ¸Í•ÑÕÁ½¹™¥| ¤ì)ô()™Õ¹Ñ¥½¸Í•ÑÕÁ½¹™¥| ¤ì(€½¹ÍÐÁÉ½ÁÌ€ôAÉ½Á•ÉÑ¥•ÍM•ÉÙ¥”¹•ÑMÉ¥ÁÑAÉ½Á•ÉÑ¥•Ì ¤ì(€½¹ÍÐÕÁ‘…Ñ•Ì€ôíôì(€½¹ÍÐÑ•…¡•É½‘”€ôMÑÉ¥¹œ¡ÁÉ½ÁÌ¹•ÑAÉ½Á•ÉÑä Q!I}=œ¤ñð€œœ¤¹ÑÉ¥´ ¤ì(€½¹ÍÐÕÉÉ•¹ÑM•É•Ð€ôMÑÉ¥¹œ¡ÁÉ½ÁÌ¹•ÑAÉ½Á•ÉÑä MMM%=9}MIPœ¤ñð€œœ¤¹ÑÉ¥´ ¤ì(€½¹ÍÐÕÉÉ•¹Ñ=É¥¥¸€ôMÑÉ¥¹œ¡ÁÉ½ÁÌ¹•ÑAÉ½Á•ÉÑä 11=]}=I%%8œ¤ñð€œœ¤¹ÑÉ¥´ ¤ì((€¥˜€ …ÕÉÉ•¹ÑM•É•Ð¤ÕÁ‘…Ñ•Ì¹MMM%=9}MIP€ôUÑ¥±¥Ñ¥•Ì¹•ÑUÕ¥ ¤€¬UÑ¥±¥Ñ¥•Ì¹•ÑUÕ¥ ¤ì(€¥˜€ …ÕÉÉ•¹Ñ=É¥¥¸¤ÕÁ‘…Ñ•Ì¹11=]}=I%%8€ôU1Q}11=]}=I%%8ì(€¥˜€¡=‰©•Ð¹­•åÌ¡ÕÁ‘…Ñ•Ì¤¹±•¹Ñ ¤ÁÉ½ÁÌ¹Í•ÑAÉ½Á•ÉÑ¥•Ì¡ÕÁ‘…Ñ•Ì°™…±Í”¤ì((€½¹ÍÐ•ÉÉ½ÉÌ€ômtì(€¥˜€ …Ñ•…¡•É½‘”¤•ÉÉ½ÉÌ¹ÁÕÍ  Ÿ‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚æ‚âS‚æ'‚âW‚âÇ‚æ'‚â‚â‚æ#‚âÈQ!I}=ƒ‚æ‚âdMÉ¥ÁÐAÉ½Á•ÉÑ¥•Ìœ¤ì(€¥˜€¡Ñ•…¡•É½‘”€˜˜Ñ•…¡•É½‘”¹±•¹Ñ €ð€à¤•ÉÉ½ÉÌ¹ÁÕÍ  Q!I}=ƒ‚â‚âŸ‚â‚â‡‚â×‚â·‚â‹‚æ#‚âË‚â‚âg‚æ'‚â·‚âˆ€àƒ‚âW‚âÇ‚âŸ‚â·‚âÇ‚â‚â§‚âŒœ¤ì(€½¹ÍÐÍ•É•Ð€ôMÑÉ¥¹œ¡ÁÉ½ÁÌ¹•ÑAÉ½Á•ÉÑä MMM%=9}MIPœ¤ñð€œœ¤¹ÑÉ¥´ ¤ì(€¥˜€¡Í•É•Ð¹±•¹Ñ €ð€ÌÈ¤•ÉÉ½ÉÌ¹ÁÕÍ  MMM%=9}MIPƒ‚âW‚æ'‚â·‚â‚â‡‚â×‚â·‚â‹‚æ#‚âË‚â‚âg‚æ'‚â·‚âˆ€ÌÈƒ‚âW‚âÇ‚âŸ‚â·‚âÇ‚â‚â§‚âŒœ¤ì(€½¹ÍÐ½É¥¥¸€ôMÑÉ¥¹œ¡ÁÉ½ÁÌ¹•ÑAÉ½Á•ÉÑä 11=]}=I%%8œ¤ñð€œœ¤¹ÑÉ¥´ ¤ì(€¥˜€ …Ù…±¥‘±±½Ý•‘=É¥¥¹|¡½É¥¥¸¤¤•ÉÉ½ÉÌ¹ÁÕÍ  11=]}=I%%8ƒ‚âW‚æ'‚â·‚â‚æ‚âo‚æ‚âd!QQAL½É¥¥¸ƒ‚æ‚â+‚æ#‚âd€œ€¬U1Q}11=]}=I%%8¤ì((€½¹ÍÐÉ•ÍÕ±Ð€ôì(€€€½¬é•ÉÉ½ÉÌ¹±•¹Ñ €ôôô€À°(€€€Ñ•…¡•É}½‘•}½¹™¥ÕÉ•è„…Ñ•…¡•É½‘”°(€€€Í•ÍÍ¥½¹}Í•É•Ñ}½¹™¥ÕÉ•éÍ•É•Ð¹±•¹Ñ €øô€ÌÈ°(€€€…±±½Ý•‘}½É¥¥¸é½É¥¥¸°(€€€µ•ÍÍ…”é•ÉÉ½ÉÌ¹±•¹Ñ €ü•ÉÉ½ÉÌ¹©½¥¸ œð€œ¤€è€Ÿ‚âW‚âÇ‚æ'‚â‚â‚æ#‚âË‚â‚âŸ‚âË‚â‡‚âo‚â—‚â·‚âS‚âƒ‚âÇ‚â‹‚â{‚â‚æ'‚â·‚â‡‚æ‚â+‚æ'‚â‚âË‚âg‚æ‚â—‚æ'‚âœœ(€ôì(€½¹Í½±”¹±½œ¡)M=8¹ÍÑÉ¥¹¥™ä¡É•ÍÕ±Ð¤¤ì(€¥˜€¡•ÉÉ½ÉÌ¹±•¹Ñ ¤Ñ¡É½Ü¹•ÜÉÉ½È¡É•ÍÕ±Ð¹µ•ÍÍ…”¤ì(€É•ÑÕÉ¸É•ÍÕ±Ðì)ô((¼¨€ôôôôôôôôôôôôôôôôôôôôôôôôô!1AIL€ôôôôôôôôôôôôôôôôôôôôôôôôô€¨¼)™Õ¹Ñ¥½¸ÍÉ¥ÁÑAÉ½Á•ÉÑå|¡¹…µ”¤ì(€É•ÑÕÉ¸MÑÉ¥¹œ¡AÉ½Á•ÉÑ¥•ÍM•ÉÙ¥”¹•ÑMÉ¥ÁÑAÉ½Á•ÉÑ¥•Ì ¤¹•ÑAÉ½Á•ÉÑä¡¹…µ”¤ñð€œœ¤¹ÑÉ¥´ ¤ì)ô()™Õ¹Ñ¥½¸Í•ÍÍ¥½¹M•É•Ñ| ¤ì(€½¹ÍÐÍ•É•Ð€ôÍÉ¥ÁÑAÉ½Á•ÉÑå| MMM%=9}MIPœ¤ì(€¥˜€¡Í•É•Ð¹±•¹Ñ €ð€ÌÈ¤Ñ¡É½Ü¹•ÜÉÉ½È Ÿ‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚æ‚âS‚æ'‚âW‚âÇ‚æ'‚â‚â‚æ#‚âÈMMM%=9}MIPƒ‚â·‚â‹‚æ#‚âË‚â‚âg‚æ'‚â·‚âˆ€ÌÈƒ‚âW‚âÇ‚âŸ‚â·‚âÇ‚â‚â§‚â‚æ‚âdMÉ¥ÁÐAÉ½Á•ÉÑ¥•Ìœ¤ì(€É•ÑÕÉ¸Í•É•Ðì)ô()™Õ¹Ñ¥½¸Í•ÍÍ¥½¹M•½¹‘Í|¡ÁÉ½Á•ÉÑå9…µ”¤ì(€½¹ÍÐÙ…±Õ”€ô9Õµ‰•È¡ÍÉ¥ÁÑAÉ½Á•ÉÑå|¡ÁÉ½Á•ÉÑå9…µ”¤ñðU1Q}MMM%=9}M=9L¤ì(€É•ÑÕÉ¸5…Ñ ¹µ…à ÌÀÀ°5…Ñ ¹µ¥¸ ÈÄØÀÀ°¥Í¥¹¥Ñ”¡Ù…±Õ”¤€ü5…Ñ ¹™±½½È¡Ù…±Õ”¤€èU1Q}MMM%=9}M=9L¤¤ì)ô()™Õ¹Ñ¥½¸±½¥¹5…áÑÑ•µÁÑÍ| ¤ì(€½¹ÍÐÙ…±Õ”€ô9Õµ‰•È¡ÍÉ¥ÁÑAÉ½Á•ÉÑå| 1=%9}5a}QQ5AQLœ¤ñðU1Q}1=%9}5a}QQ5AQL¤ì(€É•ÑÕÉ¸5…Ñ ¹µ…à Ì°5…Ñ ¹µ¥¸ ÈÀ°¥Í¥¹¥Ñ”¡Ù…±Õ”¤€ü5…Ñ ¹™±½½È¡Ù…±Õ”¤€èU1Q}1=%9}5a}QQ5AQL¤¤ì)ô()™Õ¹Ñ¥½¸±½¥¹1½­M•½¹‘Í| ¤ì(€½¹ÍÐÙ…±Õ”€ô9Õµ‰•È¡ÍÉ¥ÁÑAÉ½Á•ÉÑå| 1=%9}1=-}M=9Lœ¤ñðU1Q}1=%9}1=-}M=9L¤ì(€É•ÑÕÉ¸5…Ñ ¹µ…à ØÀ°5…Ñ ¹µ¥¸ ÈÄØÀÀ°¥Í¥¹¥Ñ”¡Ù…±Õ”¤€ü5…Ñ ¹™±½½È¡Ù…±Õ”¤€èU1Q}1=%9}1=-}M=9L¤¤ì)ô()™Õ¹Ñ¥½¸¹½Éµ…±¥é•¥¥ÑÍ|¡Ù…±Õ”¤ì(€É•ÑÕÉ¸MÑÉ¥¹œ¡Ù…±Õ”ñð€œœ¤¹É•Á±…” ½q½œ°€œœ¤ì)ô()™Õ¹Ñ¥½¸¡µ…|¡Ù…±Õ”¤ì(€É•ÑÕÉ¸UÑ¥±¥Ñ¥•Ì¹‰…Í”ØÑ¹½‘•]•‰M…™”¡UÑ¥±¥Ñ¥•Ì¹½µÁÕÑ•!µ…M¡„ÈÔÙM¥¹…ÑÕÉ”¡MÑÉ¥¹œ¡Ù…±Õ”¤°Í•ÍÍ¥½¹M•É•Ñ| ¤¤¤¹É•Á±…” ¼ô¬½œ°€œœ¤ì)ô()™Õ¹Ñ¥½¸Í•ÕÉ•-•å|¡Ù…±Õ”¤ì(€É•ÑÕÉ¸¡µ…| ­•äèœ€¬MÑÉ¥¹œ¡Ù…±Õ”¤¤¹Í±¥” À°€ÌÈ¤ì)ô()™Õ¹Ñ¥½¸Í•ÕÉ•ÅÕ…±|¡±•™Ð°É¥¡Ð¤ì(€±•™Ð€ôMÑÉ¥¹œ¡±•™Ðñð€œœ¤ì(€É¥¡Ð€ôMÑÉ¥¹œ¡É¥¡Ðñð€œœ¤ì(€±•Ð‘¥™˜€ô±•™Ð¹±•¹Ñ xÉ¥¡Ð¹±•¹Ñ ì(€½¹ÍÐ±•¹Ñ €ô5…Ñ ¹µ…à¡±•™Ð¹±•¹Ñ °É¥¡Ð¹±•¹Ñ ¤ì(€™½È€¡±•Ð¤€ô€Àì¤€ð±•¹Ñ ì¤¬¬¤‘¥™˜ðô€¡±•™Ð¹¡…É½‘•Ð¡¤€”5…Ñ ¹µ…à¡±•™Ð¹±•¹Ñ °€Ä¤¤ñð€À¤x€¡É¥¡Ð¹¡…É½‘•Ð¡¤€”5…Ñ ¹µ…à¡É¥¡Ð¹±•¹Ñ °€Ä¤¤ñð€À¤ì(€É•ÑÕÉ¸‘¥™˜€ôôô€Àì)ô()™Õ¹Ñ¥½¸É•…Ñ•M•ÍÍ¥½¹Q½­•¹|¡­¥¹°‘…Ñ„°Í•½¹‘Ì¤ì(€½¹ÍÐ¥€ôUÑ¥±¥Ñ¥•Ì¹•ÑUÕ¥ ¤¹É•Á±…” ¼´½œ°€œœ¤€¬UÑ¥±¥Ñ¥•Ì¹•ÑUÕ¥ ¤¹É•Á±…” ¼´½œ°€œœ¤ì(€½¹ÍÐÑ½­•¸€ô¥€¬€œ¸œ€¬¡µ…|¡­¥¹€¬€œèœ€¬¥¤ì(€½¹ÍÐÍ•ÍÍ¥½¹…Ñ„€ô=‰©•Ð¹…ÍÍ¥¸¡íô°‘…Ñ„°í•áÁ¥É•Í}…Ðé…Ñ”¹¹½Ü ¤€¬Í•½¹‘Ì€¨€ÄÀÀÁô¤ì(€ÍÑ½É•M•ÍÍ¥½¹|¡­¥¹°Ñ½­•¸°Í•ÍÍ¥½¹…Ñ„°Í•½¹‘Ì¤ì(€É•ÑÕÉ¸Ñ½­•¸ì)ô()™Õ¹Ñ¥½¸Ù…±¥‘M•ÍÍ¥½¹Q½­•¹|¡­¥¹°Ñ½­•¸¤ì(€Ñ½­•¸€ôMÑÉ¥¹œ¡Ñ½­•¸ñð€œœ¤¹ÑÉ¥´ ¤ì(€½¹ÍÐÁ…ÉÑÌ€ôÑ½­•¸¹ÍÁ±¥Ð œ¸œ¤ì(€¥˜€¡Á…ÉÑÌ¹±•¹Ñ €„ôô€Èñð€„½ym„µ˜À´åuìØÑô½¤¹Ñ•ÍÐ¡Á…ÉÑÍlÁt¤¤É•ÑÕÉ¸™…±Í”ì(€É•ÑÕÉ¸Í•ÕÉ•ÅÕ…±|¡Á…ÉÑÍlÅt°¡µ…|¡­¥¹€¬€œèœ€¬Á…ÉÑÍlÁt¤¤ì)ô()™Õ¹Ñ¥½¸Í•ÍÍ¥½¹…¡•-•å|¡­¥¹°Ñ½­•¸¤ì(€É•ÑÕÉ¸€Í•ÍÍ¥½¸èœ€¬­¥¹€¬€œèœ€¬Í•ÕÉ•-•å|¡MÑÉ¥¹œ¡Ñ½­•¸¤¤ì)ô()™Õ¹Ñ¥½¸É•ÅÕ¥É•M•ÍÍ¥½¹|¡­¥¹°Ñ½­•¸°•áÁ¥É•‘5•ÍÍ…”¤ì(€¥˜€ …Ù…±¥‘M•ÍÍ¥½¹Q½­•¹|¡­¥¹°Ñ½­•¸¤¤Ñ¡É½Ü¹•ÜÉÉ½È¡•áÁ¥É•‘5•ÍÍ…”¤ì(€½¹ÍÐ…¡•€ô…¡•M•ÉÙ¥”¹•ÑMÉ¥ÁÑ…¡” ¤¹•Ð¡Í•ÍÍ¥½¹…¡•-•å|¡­¥¹°Ñ½­•¸¤¤ì(€¥˜€ ……¡•¤Ñ¡É½Ü¹•ÜÉÉ½È¡•áÁ¥É•‘5•ÍÍ…”¤ì(€ÑÉäì(€€€½¹ÍÐ‘…Ñ„€ô)M=8¹Á…ÉÍ”¡…¡•¤ì(€€€¥˜€ …‘…Ñ„¹•áÁ¥É•Í}…Ðñð9Õµ‰•È¡‘…Ñ„¹•áÁ¥É•Í}…Ð¤€ðô…Ñ”¹¹½Ü ¤¤ì(€€€€€É•µ½Ù•M•ÍÍ¥½¹|¡­¥¹°Ñ½­•¸¤ì(€€€€€Ñ¡É½Ü¹•ÜÉÉ½È¡•áÁ¥É•‘5•ÍÍ…”¤ì(€€€ô(€€€É•ÑÕÉ¸‘…Ñ„ì(€ô…Ñ €¡•ÉÈ¤ì(€€€¥˜€¡•ÉÈ€˜˜•ÉÈ¹µ•ÍÍ…”€ôôô•áÁ¥É•‘5•ÍÍ…”¤Ñ¡É½Ü•ÉÈì(€€€Ñ¡É½Ü¹•ÜÉÉ½È¡•áÁ¥É•‘5•ÍÍ…”¤ì(€ô)ô()™Õ¹Ñ¥½¸ÍÑ½É•M•ÍÍ¥½¹|¡­¥¹°Ñ½­•¸°‘…Ñ„°Í•½¹‘Ì¤ì(€¥˜€ …Ù…±¥‘M•ÍÍ¥½¹Q½­•¹|¡­¥¹°Ñ½­•¸¤¤É•ÑÕÉ¸ì(€…¡•M•ÉÙ¥”¹•ÑMÉ¥ÁÑ…¡” ¤¹ÁÕÐ¡Í•ÍÍ¥½¹…¡•-•å|¡­¥¹°Ñ½­•¸¤°)M=8¹ÍÑÉ¥¹¥™ä¡‘…Ñ„¤°Í•½¹‘Ì¤ì)ô()™Õ¹Ñ¥½¸É•µ½Ù•M•ÍÍ¥½¹|¡­¥¹°Ñ½­•¸¤ì(€¥˜€ …Ù…±¥‘M•ÍÍ¥½¹Q½­•¹|¡­¥¹°Ñ½­•¸¤¤É•ÑÕÉ¸ì(€…¡•M•ÉÙ¥”¹•ÑMÉ¥ÁÑ…¡” ¤¹É•µ½Ù”¡Í•ÍÍ¥½¹…¡•-•å|¡­¥¹°Ñ½­•¸¤¤ì)ô()™Õ¹Ñ¥½¸±½¥¹I…Ñ•…¡•-•å|¡É…Ñ•-•ä¤ì(€É•ÑÕÉ¸€±½¥¸µÉ…Ñ”èœ€¬É…Ñ•-•äì)ô()™Õ¹Ñ¥½¸É•…‘1½¥¹I…Ñ•|¡É…Ñ•-•ä¤ì(€½¹ÍÐÉ…Ü€ô…¡•M•ÉÙ¥”¹•ÑMÉ¥ÁÑ…¡” ¤¹•Ð¡±½¥¹I…Ñ•…¡•-•å|¡É…Ñ•-•ä¤¤ì(€¥˜€ …É…Ü¤É•ÑÕÉ¸í…ÑÑ•µÁÑÌèÀ°±½­•‘}Õ¹Ñ¥°èÁôì(€ÑÉäìÉ•ÑÕÉ¸)M=8¹Á…ÉÍ”¡É…Ü¤ìô…Ñ €¡|¤ìÉ•ÑÕÉ¸í…ÑÑ•µÁÑÌèÀ°±½­•‘}Õ¹Ñ¥°èÁôìô)ô()™Õ¹Ñ¥½¸É•ÅÕ¥É•1½¥¹±±½Ý•‘|¡É…Ñ•-•ä¤ì(€½¹ÍÐÍÑ…Ñ”€ôÉ•…‘1½¥¹I…Ñ•|¡É…Ñ•-•ä¤ì(€½¹ÍÐÉ•µ…¥¹¥¹œ€ô9Õµ‰•È¡ÍÑ…Ñ”¹±½­•‘}Õ¹Ñ¥°ñð€À¤€´…Ñ”¹¹½Ü ¤ì(€¥˜€¡É•µ…¥¹¥¹œ€ø€À¤Ñ¡É½Ü¹•ÜÉÉ½È Ÿ‚â‡‚â×‚â‚âË‚â‚â—‚â·‚â‚æ‚â‚æ'‚âË‚â«‚âç‚æ#‚â‚âÃ‚âk‚âk‚â¯‚â—‚âË‚â‹‚â‚â‚âÇ‚æ'‚â‚æ‚â‚âÓ‚âg‚æ‚âlƒ‚â‚â‚âã‚âO‚âË‚â‚â´€œ€¬5…Ñ ¹•¥°¡É•µ…¥¹¥¹œ€¼€ØÀÀÀÀ¤€¬€œƒ‚âg‚âË‚â_‚â×‚æ‚â—‚æ'‚âŸ‚â—‚â·‚â‚æ‚â¯‚â‡‚æ œ¤ì)ô()™Õ¹Ñ¥½¸É•½É‘1½¥¹…¥±ÕÉ•|¡É…Ñ•-•ä¤ì(€½¹ÍÐ±½¬€ô1½­M•ÉÙ¥”¹•ÑMÉ¥ÁÑ1½¬ ¤ì(€±½¬¹Ý…¥Ñ1½¬ ÔÀÀÀ¤ì(€ÑÉäì(€€€½¹ÍÐÍÑ…Ñ”€ôÉ•…‘1½¥¹I…Ñ•|¡É…Ñ•-•ä¤ì(€€€ÍÑ…Ñ”¹…ÑÑ•µÁÑÌ€ô9Õµ‰•È¡ÍÑ…Ñ”¹…ÑÑ•µÁÑÌñð€À¤€¬€Äì(€€€¥˜€¡ÍÑ…Ñ”¹…ÑÑ•µÁÑÌ€øô±½¥¹5…áÑÑ•µÁÑÍ| ¤¤ÍÑ…Ñ”¹±½­•‘}Õ¹Ñ¥°€ô…Ñ”¹¹½Ü ¤€¬±½¥¹1½­M•½¹‘Í| ¤€¨€ÄÀÀÀì(€€€…¡•M•ÉÙ¥”¹•ÑMÉ¥ÁÑ…¡” ¤¹ÁÕÐ¡±½¥¹I…Ñ•…¡•-•å|¡É…Ñ•-•ä¤°)M=8¹ÍÑÉ¥¹¥™ä¡ÍÑ…Ñ”¤°±½¥¹1½­M•½¹‘Í| ¤¤ì(€€€É•ÑÕÉ¸ÍÑ…Ñ”ì(€ô™¥¹…±±äì(€€€±½¬¹É•±•…Í•1½¬ ¤ì(€ô)ô()™Õ¹Ñ¥½¸Ñ¡É½Ý1½¥¹…¥±ÕÉ•|¡ÍÑ…Ñ”°¥¹Ù…±¥‘5•ÍÍ…”¤ì(€½¹ÍÐÉ•µ…¥¹¥¹œ€ô9Õµ‰•È¡ÍÑ…Ñ”€˜˜ÍÑ…Ñ”¹±½­•‘}Õ¹Ñ¥°ñð€À¤€´…Ñ”¹¹½Ü ¤ì(€¥˜€¡É•µ…¥¹¥¹œ€ø€À¤Ñ¡É½Ü¹•ÜÉÉ½È Ÿ‚â‡‚â×‚â‚âË‚â‚â—‚â·‚â‚æ‚â‚æ'‚âË‚â«‚âç‚æ#‚â‚âÃ‚âk‚âk‚â¯‚â—‚âË‚â‹‚â‚â‚âÇ‚æ'‚â‚æ‚â‚âÓ‚âg‚æ‚âlƒ‚â‚âÃ‚âk‚âk‚â—‚æ‚â·‚â‚â+‚âÇ‚æ#‚âŸ‚â‚â‚âË‚âœ€œ€¬5…Ñ ¹•¥°¡É•µ…¥¹¥¹œ€¼€ØÀÀÀÀ¤€¬€œƒ‚âg‚âË‚â_‚âÔœ¤ì(€Ñ¡É½Ü¹•ÜÉÉ½È¡¥¹Ù…±¥‘5•ÍÍ…”¤ì)ô()™Õ¹Ñ¥½¸±•…É1½¥¹…¥±ÕÉ•Í|¡É…Ñ•-•ä¤ì(€…¡•M•ÉÙ¥”¹•ÑMÉ¥ÁÑ…¡” ¤¹É•µ½Ù”¡±½¥¹I…Ñ•…¡•-•å|¡É…Ñ•-•ä¤¤ì)ô()™Õ¹Ñ¥½¸¹½Éµ…±¥é•|¡Ø¤ì(€É•ÑÕÉ¸Ø€ôôô¹Õ±°ñðØ€ôôôÕ¹‘•™¥¹•€ü€œœ€èMÑÉ¥¹œ¡Ø¤¹ÑÉ¥´ ¤ì4)ô4(4)™Õ¹Ñ¥½¸©Í½¹Á|¡½‰¨°…±±‰…¬¤ì4(€½¹ÍÐˆ€ôMÑÉ¥¹œ¡…±±‰…¬ñð€œœ¤¹É•Á±…” ½my„µéµhÀ´å|¹t½œ°€œœ¤ì4(€½¹ÍÐ©Í½¸€ô)M=8¹ÍÑÉ¥¹¥™ä¡½‰¨¤ì4(€É•ÑÕÉ¸½¹Ñ•¹ÑM•ÉÙ¥”¹É•…Ñ•Q•áÑ=ÕÑÁÕÐ¡ˆ€üˆ€¬€œ œ€¬©Í½¸€¬€œ¤ìœ€è©Í½¸¤¹Í•Ñ5¥µ•QåÁ”¡ˆ€ü½¹Ñ•¹ÑM•ÉÙ¥”¹5¥µ•QåÁ”¹)YMI%AP€è½¹Ñ•¹ÑM•ÉÙ¥”¹5¥µ•QåÁ”¹)M=8¤ì4)ô4(4)™Õ¹Ñ¥½¸Ù…±¥‘±±½Ý•‘=É¥¥¹|¡½É¥¥¸¤ì(€É•ÑÕÉ¸€½y¡ÑÑÁÌép½p½m„µèÀ´ä¸µt¬ üèéq¬¤ü½¤¹Ñ•ÍÐ¡MÑÉ¥¹œ¡½É¥¥¸ñð€œœ¤¹ÑÉ¥´ ¤¤ì)ô()™Õ¹Ñ¥½¸É•ÅÕ¥É•±±½Ý•‘=É¥¥¹|¡É•ÅÕ•ÍÑ=É¥¥¸¤ì(€½¹ÍÐ…±±½Ý•‘=É¥¥¸€ôÍÉ¥ÁÑAÉ½Á•ÉÑå| 11=]}=I%%8œ¤ì(€¥˜€ …Ù…±¥‘±±½Ý•‘=É¥¥¹|¡…±±½Ý•‘=É¥¥¸¤¤Ñ¡É½Ü¹•ÜÉÉ½È Ÿ‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚æ‚âS‚æ'‚âW‚âÇ‚æ'‚â‚â‚æ#‚âÈ11=]}=I%%8ƒ‚â_‚â×‚æ#‚â[‚âç‚â‚âW‚æ'‚â·‚â‚æ‚âdMÉ¥ÁÐAÉ½Á•ÉÑ¥•Ìœ¤ì(€¥˜€¡MÑÉ¥¹œ¡É•ÅÕ•ÍÑ=É¥¥¸ñð€œœ¤¹ÑÉ¥´ ¤€„ôô…±±½Ý•‘=É¥¥¸¤Ñ¡É½Ü¹•ÜÉÉ½È Ÿ‚æ‚âŸ‚æ‚âk‚æ‚â/‚âW‚æ3‚âW‚æ'‚âg‚â_‚âË‚â‚æ‚â‡‚æ#‚æ‚âS‚æ'‚â‚âÇ‚âk‚â·‚âg‚âã‚â7‚âË‚âTƒ‚â‚â‚âã‚âO‚âË‚âW‚â‚âŸ‚â 11=]}=I%%8œ¤ì(€É•ÑÕÉ¸…±±½Ý•‘=É¥¥¸ì)ô()™Õ¹Ñ¥½¸Á½ÍÑ5•ÍÍ…•=ÕÑÁÕÑ|¡½‰¨¤ì(€±•Ð…±±½Ý•‘=É¥¥¸€ôÍÉ¥ÁÑAÉ½Á•ÉÑå| 11=]}=I%%8œ¤ì(€±•ÐÉ•ÍÁ½¹Í”€ô=‰©•Ð¹…ÍÍ¥¸¡íÍ½ÕÉ”èÑ…Ìµ…ÁÁÌµÍÉ¥ÁÐô°½‰¨¤ì(€¥˜€ …Ù…±¥‘±±½Ý•‘=É¥¥¹|¡…±±½Ý•‘=É¥¥¸¤¤ì(€€€€¼¼ƒ‚â«‚æ#‚â‚æ‚â'‚â{‚âË‚âÀ½¹™¥ÕÉ…Ñ¥½¸•ÉÉ½Èƒ‚â_‚â×‚æ#‚æ‚â‡‚æ#‚æ‚âo‚âÓ‚âS‚æ‚âs‚â‹‚â‚æ'‚â·‚â‡‚âç‚â”ƒ‚æ‚â{‚âß‚æ#‚â·‚æ‚â‡‚æ#‚æ‚â¯‚æ$™É½¹Ñ•¹ƒ‚â‚â·‚â#‚âdÑ¥µ•½ÕÐ(€€€…±±½Ý•‘=É¥¥¸€ô€œ¨œì(€€€É•ÍÁ½¹Í”€ôíÍ½ÕÉ”èÑ…Ìµ…ÁÁÌµÍÉ¥ÁÐœ°½¬é™…±Í”°Ñ½­•¸éMÑÉ¥¹œ¡½‰¨¹Ñ½­•¸ñð€œœ¤°µ•ÍÍ…”èŸ‚â‹‚âÇ‚â‚æ‚â‡‚æ#‚æ‚âS‚æ'‚âW‚âÇ‚æ'‚â‚â‚æ#‚âÈ11=]}=I%%8ƒ‚â_‚â×‚æ#‚â[‚âç‚â‚âW‚æ'‚â·‚â‚æ‚âdMÉ¥ÁÐAÉ½Á•ÉÑ¥•Ìôì(€ô(€½¹ÍÐ‘…Ñ„€ô)M=8¹ÍÑÉ¥¹¥™ä¡É•ÍÁ½¹Í”¤¹É•Á±…” ¼ð½œ°€qqÔÀÀÍŒœ¤ì(€½¹ÍÐ¡Ñµ°€ô€œð…‘½ÑåÁ”¡Ñµ°øñµ•Ñ„¡…ÉÍ•Ðô‰ÕÑ˜´àˆøñÍÉ¥ÁÐùÝ¥¹‘½Ü¹Ñ½À¹Á½ÍÑ5•ÍÍ…” œ€¬‘…Ñ„€¬€œ°œ€¬)M=8¹ÍÑÉ¥¹¥™ä¡…±±½Ý•‘=É¥¥¸¤€¬€œ¤ìñp½ÍÉ¥ÁÐøœì(€É•ÑÕÉ¸!Ñµ±M•ÉÙ¥”¹É•…Ñ•!Ñµ±=ÕÑÁÕÐ¡¡Ñµ°¤¹Í•ÑaÉ…µ•=ÁÑ¥½¹Í5½‘”¡!Ñµ±M•ÉÙ¥”¹aÉ…µ•=ÁÑ¥½¹Í5½‘”¹11=]10¤ì)ô(4)™Õ¹Ñ¥½¸Í…™•ÉÉ½É|¡”¤ì4(€É•ÑÕÉ¸”€˜˜”¹µ•ÍÍ…”€üMÑÉ¥¹œ¡”¹µ•ÍÍ…”¤€è€Ÿ‚æ‚â‚âÓ‚âS‚â‚æ'‚â·‚âs‚âÓ‚âS‚â{‚â—‚âË‚âS‚â‚â·‚â‚â‚âÃ‚âk‚âhœì4)ô4(4(