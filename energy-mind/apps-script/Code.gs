const SPREADSHEET_ID = '1c2UYYRZkN9mFQng71nE89iNV5hL2PqTmDSWgbhUIHks';
const SHEET_NAME = 'ข้อมูล';
const DRIVE_FOLDER_ID = '1KgMMOOngsFuYMdAcDteuqXzlXUX3465W';
const TIMEZONE = 'Asia/Bangkok';

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'list';
  if (action !== 'list') return output_({ ok: false, message: 'Unsupported action' }, e);

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  if (!sheet) return output_({ ok: false, message: 'Sheet not found' }, e);

  const lastRow = sheet.getLastRow();
  const records = [];
  if (lastRow >= 2) {
    const values = sheet.getRange(2, 1, lastRow - 1, 8).getDisplayValues();
    values.forEach(row => {
      if (!row.join('').trim()) return;
      records.push({
        id: row[0],
        category: row[1],
        recorder: row[2],
        date: row[3],
        time: row[4],
        type: row[5],
        name: row[6],
        url: row[7]
      });
    });
  }
  return output_({ ok: true, records }, e);
}

function doPost(e) {
  try {
    const p = e.parameter || {};
    if ((p.action || '') !== 'add') return output_({ ok: false, message: 'Unsupported action' }, e);

    const category = String(p.category || '').trim();
    const recorder = String(p.recorder || '').trim();
    const type = String(p.type || '').trim();
    const name = String(p.name || '').trim();
    let url = String(p.url || '').trim();

    if (!category || !recorder || !type) throw new Error('ข้อมูลไม่ครบ');
    if (!['ไฟล์', 'ลิงก์'].includes(type)) throw new Error('ประเภทไม่ถูกต้อง');

    if (type === 'ไฟล์') {
      const fileData = String(p.fileData || '');
      const mimeType = String(p.mimeType || 'application/octet-stream');
      if (!fileData) throw new Error('ไม่พบข้อมูลไฟล์');
      const bytes = Utilities.base64Decode(fileData);
      const blob = Utilities.newBlob(bytes, mimeType, sanitizeFileName_(name || 'attachment'));
      const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
      const file = folder.createFile(blob);
      url = file.getUrl();
    } else {
      if (!url) throw new Error('ไม่พบลิงก์');
    }

    const now = new Date();
    const date = Utilities.formatDate(now, TIMEZONE, 'dd/MM/yyyy');
    const time = Utilities.formatDate(now, TIMEZONE, 'HH:mm:ss');
    const id = Utilities.formatDate(now, TIMEZONE, 'yyyyMMddHHmmss') + '-' + Utilities.getUuid().slice(0, 8);

    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error('ไม่พบชีตข้อมูล');
    sheet.appendRow([id, category, recorder, date, time, type, name || url, url]);

    return output_({ ok: true, id, date, time, url }, e);
  } catch (err) {
    return output_({ ok: false, message: err.message }, e);
  }
}

function output_(data, e) {
  const json = JSON.stringify(data);
  const callback = e && e.parameter && e.parameter.callback;
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function sanitizeFileName_(name) {
  return String(name).replace(/[\\/:*?\"<>|]/g, '_').slice(0, 180);
}

function setupSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  ss.setSpreadsheetTimeZone(TIMEZONE);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  const headers = ['ID','หมวด','ผู้บันทึก','วัน/เดือน/ปี','เวลา','ประเภท','ชื่อไฟล์/ลิงก์','URL'];
  sheet.getRange(1,1,1,headers.length).setValues([headers]).setFontWeight('bold');
  sheet.setFrozenRows(1);
}
