
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
  assert.equal(backend.context.formatThaiDateForEmail_('2026-08-31'), '31/08/2026');
  assert.equal(backend.context.htmlEscape_('<script>"x"</script>'), '&lt;script&gt;&quot;x&quot;&lt;/script&gt;');
});

