/**
 * Backend for GitHub Pages TCAS portfolio entry system.
 * Deploy as Web App: Execute as Me, access according to your school's policy.
 * Teacher code is stored in Apps Script > Project Settings > Script Properties
 * Property name: TEACHER_CODE
 */
const DATA_SPREADSHEET_ID = '1seV4fk00kr62MiWd9i6IxjHqVZaTLQinZmb7MDXDzc4';
const STUDENT_SPREADSHEET_ID = '1gXl-v84hWWemlZ2ATEQhSPQSkxUhKmT7AlPpR0-QCIY';
const STUDENT_SHEET_NAME = 'Student List';
const ALLOWED_ORIGIN = 'https://theerawa21.github.io';
const TEACHER_SESSION_SECONDS = 21600; // 6 ชั่วโมง

const CONFIG = {
  activity:{sheet:'activities',headers:['citizen_id','title','first_name','last_name','program_title','exp_name','description','date','end_date','year','level','hours','fee']},
  prize:{sheet:'prizes',headers:['citizen_id','title','first_name','last_name','program_title','prize_name','description','date','end_date','year','level','hours','fee']},
  project:{sheet:'projects',headers:['citizen_id','title','first_name','last_name','project_title','project_type','description','date','end_date','year','level','hours','fee']},
  course:{sheet:'certs-courses',headers:['citizen_id','title','first_name','last_name','course_name','course_level','description','issue_date','expired_date','score','year','category','level','hours','fee','reflection']}
};
const LEVELS = ['','school','district','regional','national','international'];

function doGet(e){
  try{
    setupSheets_();
    const p=(e&&e.parameter)||{};
    const action=String(p.action||'').trim();
    let result;
    if(action==='lookup') result=lookupStudentResponse_(p.student_id);
    else if(action==='records') result=recordsResponse_(p.student_id);
    else result={ok:true,message:'TCAS API พร้อมใช้งาน'};
    return jsonp_(result,p.callback);
  }catch(err){
    return jsonp_({ok:false,message:safeError_(err)},e&&e.parameter&&e.parameter.callback);
  }
}

function doPost(e){
  let token='';
  try{
    setupSheets_();
    const p=(e&&e.parameter)||{};
    const action=String(p.action||'').trim();
    const payload=JSON.parse(p.payload||'{}');
    token=String(payload._token||'');
    let result;

    if(action==='save') result=saveRecord_(payload);
    else if(action==='update') result=updateRecord_(payload);
    else if(action==='delete') result=deleteRecord_(payload);
    else if(action==='teacherLogin') result=teacherLogin_(payload.teacher_code);
    else if(action==='teacherDashboard') result=teacherDashboardResponse_(payload.teacher_token);
    else if(action==='teacherStudent') result=teacherStudentResponse_(payload.teacher_token,payload.student_id);
    else if(action==='teacherLogout') result=teacherLogout_(payload.teacher_token);
    else throw new Error('คำสั่งไม่ถูกต้อง');

    return postMessageOutput_({ok:true,token:token,result:result});
  }catch(err){
    return postMessageOutput_({ok:false,token:token,message:safeError_(err)});
  }
}

function lookupStudentResponse_(studentId){
  const student=lookupStudent_(studentId);
  if(!student) return {ok:false,message:'ไม่พบรหัสประจำตัวนักเรียนนี้'};
  if(student.status && student.status!=='กำลังศึกษาอยู่') return {ok:false,message:'ข้อมูลนักเรียนรายนี้ไม่ได้อยู่ในสถานะกำลังศึกษา'};
  return {ok:true,student:publicStudent_(student)};
}

function recordsResponse_(studentId){
  const student=lookupStudent_(studentId);
  if(!student) return {ok:false,message:'ไม่พบข้อมูลนักเรียน'};
  return {ok:true,student:publicStudent_(student),records:getStudentRecords_(student)};
}

function lookupStudent_(studentId){
  const id=String(studentId||'').replace(/\D/g,'').trim();
  if(!id) return null;
  const sheet=SpreadsheetApp.openById(STUDENT_SPREADSHEET_ID).getSheetByName(STUDENT_SHEET_NAME);
  if(!sheet) throw new Error('ไม่พบชีตรายชื่อนักเรียน');
  const last=sheet.getLastRow();
  if(last<4) return null;
  const finder=sheet.getRange(4,3,last-3,1).createTextFinder(id).matchEntireCell(true).findNext();
  if(!finder) return null;
  const row=sheet.getRange(finder.getRow(),2,1,12).getDisplayValues()[0];
  return {
    citizen_id:String(row[0]||''),
    student_id:String(row[1]||''),
    class_room:String(row[2]||''),
    title:String(row[3]||''),
    first_name:String(row[4]||''),
    last_name:String(row[5]||''),
    status:String(row[10]||'')
  };
}

function publicStudent_(s){
  return {student_id:s.student_id,class_room:s.class_room,title:s.title,first_name:s.first_name,last_name:s.last_name,citizen_id:s.citizen_id};
}

function teacherPublicStudent_(s){
  return {student_id:s.student_id,class_room:s.class_room,title:s.title,first_name:s.first_name,last_name:s.last_name};
}

function getStudentRecords_(student){
  const ss=SpreadsheetApp.openById(DATA_SPREADSHEET_ID),out=[];
  Object.keys(CONFIG).forEach(type=>{
    const cfg=CONFIG[type],sheet=ss.getSheetByName(cfg.sheet),last=sheet.getLastRow();
    if(last<2) return;
    const values=sheet.getRange(2,1,last-1,cfg.headers.length).getDisplayValues();
    const notes=sheet.getRange(2,1,last-1,1).getNotes();
    values.forEach((row,i)=>{
      if(String(row[0]||'')!==student.citizen_id) return;
      const obj={type:type,entry_id:notes[i][0]||''};
      cfg.headers.forEach((h,j)=>obj[h]=row[j]||'');
      if(!obj.entry_id){
        obj.entry_id=Utilities.getUuid();
        sheet.getRange(i+2,1).setNote(obj.entry_id);
      }
      out.push(obj);
    });
  });
  return out;
}

function saveRecord_(p){
  const student=mustStudent_(p.student_id),type=mustType_(p.type),cfg=CONFIG[type];
  validate_(type,p);
  const lock=LockService.getScriptLock();
  lock.waitLock(30000);
  try{
    const sheet=SpreadsheetApp.openById(DATA_SPREADSHEET_ID).getSheetByName(cfg.sheet);
    const row=studentRow_(student,cfg,p),target=Math.max(sheet.getLastRow()+1,2),id=Utilities.getUuid();
    sheet.getRange(target,1,1,cfg.headers.length).setValues([row]).setVerticalAlignment('top').setWrap(true);
    sheet.getRange(target,1).setNumberFormat('@').setNote(id);
    return {entry_id:id};
  }finally{lock.releaseLock();}
}

function updateRecord_(p){
  const student=mustStudent_(p.student_id),type=mustType_(p.type),cfg=CONFIG[type];
  validate_(type,p);
  const id=String(p.entry_id||'');
  if(!id) throw new Error('ไม่พบรหัสรายการ');
  const lock=LockService.getScriptLock();
  lock.waitLock(30000);
  try{
    const sheet=SpreadsheetApp.openById(DATA_SPREADSHEET_ID).getSheetByName(cfg.sheet),row=findEntryRow_(sheet,id);
    if(!row) throw new Error('ไม่พบรายการที่ต้องการแก้ไข');
    if(String(sheet.getRange(row,1).getDisplayValue())!==student.citizen_id) throw new Error('ไม่มีสิทธิ์แก้ไขรายการนี้');
    sheet.getRange(row,1,1,cfg.headers.length).setValues([studentRow_(student,cfg,p)]).setVerticalAlignment('top').setWrap(true);
    sheet.getRange(row,1).setNumberFormat('@').setNote(id);
    return {entry_id:id};
  }finally{lock.releaseLock();}
}

function deleteRecord_(p){
  const student=mustStudent_(p.student_id),id=String(p.entry_id||'');
  if(!id) throw new Error('ไม่พบรหัสรายการ');
  const lock=LockService.getScriptLock();
  lock.waitLock(30000);
  try{
    const ss=SpreadsheetApp.openById(DATA_SPREADSHEET_ID);
    for(const type of Object.keys(CONFIG)){
      const sheet=ss.getSheetByName(CONFIG[type].sheet),row=findEntryRow_(sheet,id);
      if(!row) continue;
      if(String(sheet.getRange(row,1).getDisplayValue())!==student.citizen_id) throw new Error('ไม่มีสิทธิ์ลบรายการนี้');
      sheet.deleteRow(row);
      return {entry_id:id};
    }
    throw new Error('ไม่พบรายการที่ต้องการลบ');
  }finally{lock.releaseLock();}
}

/* ========================= TEACHER MODE ========================= */

function teacherLogin_(code){
  const value=String(code||'').trim();
  const expected=getTeacherCode_();
  if(!value || value!==expected) throw new Error('รหัสสำหรับครูไม่ถูกต้อง');

  const session=Utilities.getUuid().replace(/-/g,'');
  CacheService.getScriptCache().put('teacher:'+session,'1',TEACHER_SESSION_SECONDS);
  return {teacher_token:session,dashboard:teacherDashboardData_()};
}

function teacherDashboardResponse_(session){
  requireTeacherSession_(session);
  refreshTeacherSession_(session);
  return teacherDashboardData_();
}

function teacherStudentResponse_(session,studentId){
  requireTeacherSession_(session);
  refreshTeacherSession_(session);
  const student=mustStudent_(studentId);
  const records=getStudentRecords_(student).map(teacherRecord_);
  return {student:teacherPublicStudent_(student),records:records};
}

function teacherLogout_(session){
  const key='teacher:'+String(session||'');
  CacheService.getScriptCache().remove(key);
  return {success:true};
}

function getTeacherCode_(){
  const code=PropertiesService.getScriptProperties().getProperty('TEACHER_CODE');
  if(!code) throw new Error('ยังไม่ได้ตั้งค่า TEACHER_CODE ใน Script Properties');
  return String(code).trim();
}

function requireTeacherSession_(session){
  const token=String(session||'').trim();
  if(!token || CacheService.getScriptCache().get('teacher:'+token)!=='1'){
    throw new Error('สิทธิ์ครูหมดอายุ กรุณาเข้าสู่ระบบใหม่');
  }
}

function refreshTeacherSession_(session){
  CacheService.getScriptCache().put('teacher:'+String(session||''),'1',TEACHER_SESSION_SECONDS);
}

function getAllActiveStudents_(){
  const sheet=SpreadsheetApp.openById(STUDENT_SPREADSHEET_ID).getSheetByName(STUDENT_SHEET_NAME);
  if(!sheet) throw new Error('ไม่พบชีตรายชื่อนักเรียน');
  const last=sheet.getLastRow();
  if(last<4) return [];
  const rows=sheet.getRange(4,2,last-3,12).getDisplayValues();
  return rows.map(row=>({
    citizen_id:String(row[0]||'').trim(),
    student_id:String(row[1]||'').trim(),
    class_room:String(row[2]||'').trim(),
    title:String(row[3]||'').trim(),
    first_name:String(row[4]||'').trim(),
    last_name:String(row[5]||'').trim(),
    status:String(row[10]||'').trim()
  })).filter(s=>s.student_id && (!s.status || s.status==='กำลังศึกษาอยู่'));
}

function buildRecordCountMap_(){
  const ss=SpreadsheetApp.openById(DATA_SPREADSHEET_ID);
  const map={};
  Object.keys(CONFIG).forEach(type=>{
    const cfg=CONFIG[type],sheet=ss.getSheetByName(cfg.sheet);
    if(!sheet) return;
    const last=sheet.getLastRow();
    if(last<2) return;
    const ids=sheet.getRange(2,1,last-1,1).getDisplayValues();
    ids.forEach(row=>{
      const citizen=String(row[0]||'').trim();
      if(!citizen) return;
      if(!map[citizen]) map[citizen]={activity:0,prize:0,project:0,course:0,total:0};
      map[citizen][type]=(map[citizen][type]||0)+1;
      map[citizen].total++;
    });
  });
  return map;
}

function teacherDashboardData_(){
  const students=getAllActiveStudents_();
  const countMap=buildRecordCountMap_();
  const summaries=students.map(s=>{
    const c=countMap[s.citizen_id]||{activity:0,prize:0,project:0,course:0,total:0};
    return {
      student_id:s.student_id,
      class_room:s.class_room,
      title:s.title,
      first_name:s.first_name,
      last_name:s.last_name,
      submitted:c.total>0,
      total_records:c.total,
      counts:{activity:c.activity||0,prize:c.prize||0,project:c.project||0,course:c.course||0}
    };
  });

  summaries.sort((a,b)=>{
    const room=String(a.class_room).localeCompare(String(b.class_room),'th');
    if(room!==0) return room;
    return Number(a.student_id||0)-Number(b.student_id||0);
  });

  const roomMap={};
  summaries.forEach(s=>{
    const room=s.class_room||'ไม่ระบุห้อง';
    if(!roomMap[room]) roomMap[room]={class_room:room,total:0,submitted:0,not_submitted:0,records:0};
    roomMap[room].total++;
    roomMap[room].records+=Number(s.total_records||0);
    if(Number(s.total_records||0)>0) roomMap[room].submitted++;
    else roomMap[room].not_submitted++;
  });

  const rooms=Object.keys(roomMap).sort().map(k=>roomMap[k]);
  const totalRecords=summaries.reduce((sum,s)=>sum+Number(s.total_records||0),0);
  const submitted=summaries.filter(s=>Number(s.total_records||0)>0).length;

  return {
    generated_at:Utilities.formatDate(new Date(),'Asia/Bangkok','dd/MM/yyyy HH:mm:ss'),
    total_students:summaries.length,
    submitted_students:submitted,
    not_submitted_students:summaries.length-submitted,
    total_records:totalRecords,
    rooms:rooms,
    students:summaries
  };
}

function teacherRecord_(record){
  const out={};
  Object.keys(record).forEach(key=>{
    if(['citizen_id','title','first_name','last_name'].indexOf(key)!==-1) return;
    out[key]=record[key];
  });
  return out;
}

/* ========================= END TEACHER MODE ========================= */

function findEntryRow_(sheet,id){
  const last=sheet.getLastRow();
  if(last<2) return 0;
  const notes=sheet.getRange(2,1,last-1,1).getNotes();
  for(let i=0;i<notes.length;i++) if(notes[i][0]===id) return i+2;
  return 0;
}

function studentRow_(s,cfg,p){
  const src=Object.assign({},p,{citizen_id:s.citizen_id,title:s.title,first_name:s.first_name,last_name:s.last_name});
  return cfg.headers.map(h=>normalize_(src[h]));
}

function mustStudent_(id){
  const s=lookupStudent_(id);
  if(!s) throw new Error('ไม่พบข้อมูลนักเรียน');
  if(s.status&&s.status!=='กำลังศึกษาอยู่') throw new Error('สถานะนักเรียนไม่ถูกต้อง');
  return s;
}
function mustType_(t){
  const v=String(t||'');
  if(!CONFIG[v]) throw new Error('ประเภทข้อมูลไม่ถูกต้อง');
  return v;
}
function validate_(type,p){
  if(!String(p.year||'').trim()) throw new Error('กรุณาระบุปีการศึกษา');
  if(p.level&&!LEVELS.includes(String(p.level))) throw new Error('ระดับข้อมูลไม่ถูกต้อง');
  if(type==='activity'&&(!p.program_title||!p.exp_name||!p.date)) throw new Error('กรุณากรอกชื่อกิจกรรม บทบาท และวันที่เริ่ม');
  if(type==='prize'&&(!p.program_title||!p.prize_name||!p.date)) throw new Error('กรุณากรอกชื่อการแข่งขัน รางวัล และวันที่');
  if(type==='project'&&(!p.project_title||!p.project_type||!p.date)) throw new Error('กรุณากรอกชื่อโครงงาน ประเภท และวันที่เริ่ม');
  if(type==='course'&&(!p.course_name||!p.issue_date)) throw new Error('กรุณากรอกชื่อหลักสูตรและวันที่ออกใบรับรอง');
}
function normalize_(v){return v===null||v===undefined?'':String(v).trim();}

function setupSheets_(){
  const ss=SpreadsheetApp.openById(DATA_SPREADSHEET_ID);
  Object.keys(CONFIG).forEach(type=>{
    const cfg=CONFIG[type];
    let sheet=ss.getSheetByName(cfg.sheet);
    if(!sheet) sheet=ss.insertSheet(cfg.sheet);
    if(sheet.getMaxColumns()<cfg.headers.length) sheet.insertColumnsAfter(sheet.getMaxColumns(),cfg.headers.length-sheet.getMaxColumns());
    const head=sheet.getRange(1,1,1,cfg.headers.length),existing=head.getDisplayValues()[0];
    if(cfg.headers.some((h,i)=>existing[i]!==h)) head.setValues([cfg.headers]);
    head.setBackground('#17365D').setFontColor('#FFFFFF').setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
    sheet.setFrozenRows(1);
    sheet.getRange('A:A').setNumberFormat('@');
    const col=cfg.headers.indexOf('level')+1;
    if(col>0){
      const rule=SpreadsheetApp.newDataValidation().requireValueInList(['school','district','regional','national','international'],true).setAllowInvalid(false).build();
      sheet.getRange(2,col,Math.max(sheet.getMaxRows()-1,1),1).setDataValidation(rule);
    }
  });
}
function setupSheets(){setupSheets_();return 'พร้อมใช้งาน';}

function jsonp_(obj,callback){
  const cb=String(callback||'').replace(/[^a-zA-Z0-9_$.]/g,'');
  const json=JSON.stringify(obj);
  if(!cb) return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
  return ContentService.createTextOutput(cb+'('+json+');').setMimeType(ContentService.MimeType.JAVASCRIPT);
}
function postMessageOutput_(obj){
  const data=JSON.stringify(Object.assign({source:'tcas-apps-script'},obj)).replace(/</g,'\\u003c');
  const html='<!doctype html><meta charset="utf-8"><script>window.parent.postMessage('+data+','+JSON.stringify(ALLOWED_ORIGIN)+');<\/script>';
  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function safeError_(e){return e&&e.message?String(e.message):'เกิดข้อผิดพลาดของระบบ';}
