const SPREADSHEET_ID='1c2UYYRZkN9mFQng71nE89iNV5hL2PqTmDSWgbhUIHks';
const SHEET_NAME='ข้อมูล';
const DRIVE_FOLDER_ID='1KgMMOOngsFuYMdAcDteuqXzlXUX3465W';
const TIMEZONE='Asia/Bangkok';

function doGet(e){
  const action=(e&&e.parameter&&e.parameter.action)||'list';
  if(action!=='list') return out_({ok:false,message:'Unsupported action'},e);
  const sh=SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  if(!sh) return out_({ok:false,message:'ไม่พบชีตข้อมูล'},e);
  const records=[];
  if(sh.getLastRow()>=2){
    sh.getRange(2,1,sh.getLastRow()-1,8).getDisplayValues().forEach(r=>{
      if(!r.join('').trim()) return;
      records.push({id:r[0],category:r[1],recorder:r[2],date:r[3],time:r[4],type:r[5],name:r[6],url:r[7]});
    });
  }
  return out_({ok:true,records},e);
}

function doPost(e){
  try{
    const p=e.parameter||{};
    if((p.action||'')!=='add') throw new Error('Unsupported action');
    const category=String(p.category||'').trim();
    const recorder=String(p.recorder||'').trim();
    const type=String(p.type||'').trim();
    const name=String(p.name||'').trim();
    let url=String(p.url||'').trim();
    if(!category||!recorder||!type) throw new Error('ข้อมูลไม่ครบ');
    if(type==='ไฟล์'){
      const fileData=String(p.fileData||'');
      if(!fileData) throw new Error('ไม่พบข้อมูลไฟล์');
      const mime=String(p.mimeType||'application/octet-stream');
      const blob=Utilities.newBlob(Utilities.base64Decode(fileData),mime,safe_(name||'attachment'));
      const file=DriveApp.getFolderById(DRIVE_FOLDER_ID).createFile(blob);
      url=file.getUrl();
    }else if(type==='ลิงก์'){
      if(!url) throw new Error('ไม่พบลิงก์');
    }else throw new Error('ประเภทไม่ถูกต้อง');
    const now=new Date();
    const date=Utilities.formatDate(now,TIMEZONE,'dd/MM/yyyy');
    const time=Utilities.formatDate(now,TIMEZONE,'HH:mm:ss');
    const id=Utilities.formatDate(now,TIMEZONE,'yyyyMMddHHmmss')+'-'+Utilities.getUuid().slice(0,8);
    const sh=SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    if(!sh) throw new Error('ไม่พบชีตข้อมูล');
    sh.appendRow([id,category,recorder,date,time,type,name||url,url]);
    return out_({ok:true,id,date,time,url},e);
  }catch(err){
    return out_({ok:false,message:err.message},e);
  }
}

function setup(){
  const ss=SpreadsheetApp.openById(SPREADSHEET_ID);
  ss.setSpreadsheetTimeZone(TIMEZONE);
  let sh=ss.getSheetByName(SHEET_NAME);
  if(!sh) sh=ss.insertSheet(SHEET_NAME);
  const headers=['ID','หมวด','ผู้บันทึก','วัน/เดือน/ปี','เวลา','ประเภท','ชื่อไฟล์/ลิงก์','URL'];
  sh.getRange(1,1,1,headers.length).setValues([headers]).setFontWeight('bold');
  sh.setFrozenRows(1);
}

function out_(obj,e){
  const json=JSON.stringify(obj);
  const cb=e&&e.parameter&&e.parameter.callback;
  if(cb) return ContentService.createTextOutput(cb+'('+json+')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}
function safe_(name){return String(name).replace(/[\\/:*?"<>|]/g,'_').slice(0,180)}