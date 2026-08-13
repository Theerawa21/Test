const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function createBackend(initialProperties = {}) {
  const properties = new Map(Object.entries(initialProperties));
  const cache = new Map();
  const context = {
    console,
    Date,
    JSON,
    Math,
    Object,
    String,
    Number,
    RegExp,
    Error,
    isFinite,
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: key => properties.get(key) || null,
        setProperties: values => Object.entries(values).forEach(([key, value]) => properties.set(key, value))
      })
    },
    CacheService: {
      getScriptCache: () => ({
        get: key => cache.get(key) || null,
        put: (key, value) => cache.set(key, value),
        remove: key => cache.delete(key)
      })
    },
    LockService: {
      getScriptLock: () => ({waitLock() {}, releaseLock() {}})
    },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      computeHmacSha256Signature: (value, secret) => [...crypto.createHmac('sha256', secret).update(value).digest()],
      base64EncodeWebSafe: bytes => Buffer.from(bytes).toString('base64url')
    }
  };
  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8');
  vm.runInContext(source, context, {filename:'Code.gs'});
  return {context, properties, cache};
}

test('setupConfig creates safe defaults but requires an explicit teacher code', () => {
  const backend = createBackend();
  assert.throws(() => backend.context.setupConfig(), /ยังไม่ได้ตั้งค่า TEACHER_CODE/);
  assert.equal(backend.properties.get('ALLOWED_ORIGIN'), 'https://theerawa21.github.io');
  assert.ok(backend.properties.get('SESSION_SECRET').length >= 32);
});

test('teacher login creates an expiring token and logout revokes it', () => {
  const backend = createBackend({
    TEACHER_CODE:'Teacher-Only-2569',
    SESSION_SECRET:'test-secret-that-is-at-least-32-characters-long',
    ALLOWED_ORIGIN:'https://theerawa21.github.io',
    TEACHER_SESSION_SECONDS:'300'
  });
  const login = backend.context.teacherLogin_('Teacher-Only-2569');
  assert.match(login.teacher_token, /^[a-f0-9]{64}\.[A-Za-z0-9_-]+$/);
  assert.equal(login.expires_in, 300);
  assert.ok(login.expires_at > Date.now());
  assert.equal(backend.context.requireTeacherSession_(login.teacher_token).role, 'teacher');
  assert.equal(backend.context.teacherLogout_(login.teacher_token).success, true);
  assert.throws(() => backend.context.requireTeacherSession_(login.teacher_token), /สิทธิ์ครูหมดอายุ/);
});

test('teacher sessions enforce their fixed expiry timestamp', () => {
  const backend = createBackend({
    TEACHER_CODE:'Teacher-Only-2569',
    SESSION_SECRET:'test-secret-that-is-at-least-32-characters-long',
    ALLOWED_ORIGIN:'https://theerawa21.github.io'
  });
  const login = backend.context.teacherLogin_('Teacher-Only-2569');
  const sessionKey = [...backend.cache.keys()].find(key => key.startsWith('session:teacher:'));
  const data = JSON.parse(backend.cache.get(sessionKey));
  data.expires_at = Date.now() - 1;
  backend.cache.set(sessionKey, JSON.stringify(data));
  assert.throws(() => backend.context.requireTeacherSession_(login.teacher_token), /สิทธิ์ครูหมดอายุ/);
});

test('teacher login locks temporarily after repeated failures', () => {
  const backend = createBackend({
    TEACHER_CODE:'Teacher-Only-2569',
    SESSION_SECRET:'test-secret-that-is-at-least-32-characters-long',
    ALLOWED_ORIGIN:'https://theerawa21.github.io',
    LOGIN_MAX_ATTEMPTS:'3',
    LOGIN_LOCK_SECONDS:'60'
  });
  assert.throws(() => backend.context.teacherLogin_('wrong-1'), /รหัสสำหรับครูไม่ถูกต้อง/);
  assert.throws(() => backend.context.teacherLogin_('wrong-2'), /รหัสสำหรับครูไม่ถูกต้อง/);
  assert.throws(() => backend.context.teacherLogin_('wrong-3'), /ระบบล็อกชั่วคราว/);
  assert.throws(() => backend.context.teacherLogin_('Teacher-Only-2569'), /กรุณารอ 1 นาที/);
});

test('backend accepts only the configured GitHub Pages origin', () => {
  const backend = createBackend({
    SESSION_SECRET:'test-secret-that-is-at-least-32-characters-long',
    ALLOWED_ORIGIN:'https://theerawa21.github.io'
  });
  assert.equal(backend.context.requireAllowedOrigin_('https://theerawa21.github.io'), 'https://theerawa21.github.io');
  assert.throws(() => backend.context.requireAllowedOrigin_('https://example.com'), /เว็บไซต์ต้นทางไม่ได้รับอนุญาต/);
});

test('every teacher endpoint rejects a missing or invalid token', () => {
  const backend = createBackend({
    SESSION_SECRET:'test-secret-that-is-at-least-32-characters-long',
    ALLOWED_ORIGIN:'https://theerawa21.github.io'
  });
  assert.throws(() => backend.context.teacherDashboardResponse_('', false), /สิทธิ์ครูหมดอายุ/);
  assert.throws(() => backend.context.teacherStudentResponse_('invalid', '1'), /สิทธิ์ครูหมดอายุ/);
  assert.throws(() => backend.context.teacherReviewResponse_('invalid', {}), /สิทธิ์ครูหมดอายุ/);
  assert.throws(() => backend.context.teacherLogout_('invalid'), /สิทธิ์ครูหมดอายุ/);
});

test('teacher decisions accept only pass or revision-required states', () => {
  const backend = createBackend();
  assert.equal(backend.context.normalizeTeacherDecision_('approved'), 'approved');
  assert.equal(backend.context.normalizeTeacherDecision_('needs_revision'), 'needs_revision');
  assert.equal(backend.context.normalizeTeacherDecision_(''), 'needs_revision');
  assert.throws(() => backend.context.normalizeTeacherDecision_('rejected'), /สถานะการตรวจไม่ถูกต้อง/);
});

test('email helpers validate addresses and escape notification content', () => {
  const backend = createBackend();
  assert.equal(backend.context.isValidEmail_('student@example.com'), true);
  assert.equal(backend.context.isValidEmail_('missing-at.example.com'), false);
  assert.equal(backend.context.normalizeStudentEmail_(' Student@Example.COM '), 'student@example.com');
  assert.throws(() => backend.context.normalizeStudentEmail_(''), /กรุณากรอกอีเมล/);
  assert.throws(() => backend.context.normalizeStudentEmail_('invalid-email'), /รูปแบบอีเมลไม่ถูกต้อง/);
  assert.equal(backend.context.publicStudent_({student_id:'1', email:'student@example.com'}).email, 'student@example.com');
  assert.equal(backend.context.formatThaiDateForEmail_('2026-08-31'), '31/08/2026');
  assert.equal(backend.context.htmlEscape_('<script>"x"</script>'), '&lt;script&gt;&quot;x&quot;&lt;/script&gt;');
});

test('authenticated student email update writes only the matching student row', () => {
  const backend = createBackend();
  let receivedToken = '';
  let savedEmail = '';
  const emailCell = {
    setNumberFormat(format) { assert.equal(format, '@'); return this; },
    setValue(value) { savedEmail = value; return this; }
  };
  const sheet = {
    getLastRow: () => 4,
    getRange: (row, column) => {
      if (row === 4 && column === 3) {
        return {createTextFinder: value => ({matchEntireCell: exact => ({findNext: () => {
          assert.equal(value, '14231');
          assert.equal(exact, true);
          return {getRow: () => 4};
        }})})};
      }
      if (row === 4 && column === 14) return emailCell;
      throw new Error(`Unexpected range ${row}:${column}`);
    }
  };
  backend.context.requireStudentSession_ = token => {
    receivedToken = token;
    return {student_id:'14231', email:''};
  };
  backend.context.SpreadsheetApp = {
    openById: id => {
      assert.equal(id, '1gXl-v84hWWemlZ2ATEQhSPQSkxUhKmT7AlPpR0-QCIY');
      return {getSheetByName: name => {
        assert.equal(name, 'Student List');
        return sheet;
      }};
    }
  };

  const result = backend.context.updateStudentEmail_('student-session', ' New.Student@Example.COM ');
  assert.equal(receivedToken, 'student-session');
  assert.equal(savedEmail, 'new.student@example.com');
  assert.equal(result.student.email, 'new.student@example.com');
});

test('course form and backend cover the complete certs-courses CSV schema', () => {
  const backend = createBackend();
  const expected = [
    'citizen_id','title','first_name','last_name','course_name','course_level','description','issue_date',
    'expired_date','score','year','category','level','hours','fee','reflection'
  ];
  const headers = Array.from(vm.runInContext('CONFIG.course.headers', backend.context));
  assert.deepEqual(headers, expected);

  const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  expected.slice(4).forEach(field => assert.match(appSource, new RegExp(`name=["']${field}["']`)));

  const row = backend.context.studentRow_(
    {citizen_id:'1234567890123', title:'นาย', first_name:'สมชาย', last_name:'ใจดี'},
    {sheet:'certs-courses', headers:expected},
    {course_name:'อบรม Unity', issue_date:'10/01/2568', year:'2568'}
  );
  assert.equal(row.length, 16);
  assert.equal(row[8], '0');
});

test('frontend accepts Apps Script top-frame responses by token and trusted payload marker', () => {
  const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const teacherSource = fs.readFileSync(path.join(__dirname, '..', 'teacher.js'), 'utf8');
  assert.doesNotMatch(appSource, /e\.source\s*!==\s*frame\.contentWindow/);
  assert.doesNotMatch(teacherSource, /e\.source\s*!==\s*frame\.contentWindow/);
  assert.match(appSource, /e\.data\.source!=='tcas-apps-script'/);
  assert.match(teacherSource, /e\.data\.source!=='tcas-apps-script'/);
  assert.match(appSource, /e\.data\.token!==token/);
  assert.match(teacherSource, /e\.data\.token!==token/);
});
