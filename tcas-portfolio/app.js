(()=>{'use strict';
const CFG=window.TCAS_CONFIG||{},T={activity:{icon:'🏃',label:'กิจกรรม',file:'activities.csv'},prize:{icon:'🏆',label:'รางวัล',file:'prizes.csv'},project:{icon:'💡',label:'โครงงาน',file:'projects.csv'},course:{icon:'📜',label:'หลักสูตร / Certificate',file:'certs-courses.csv'}},L=[['','ไม่ระบุ'],['school','ระดับโรงเรียน'],['district','ระดับเขต / จังหวัด'],['regional','ระดับภูมิภาค'],['national','ระดับประเทศ'],['international','ระดับนานาชาติ']];
let api='',pending=null,pendingToken='',student=null,studentToken='',records=[],type=null,editing=null,postTimer=null;const $=i=>document.getElementById(i),esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])),name=s=>`${s.title||''}${s.first_name||''} ${s.last_name||''}`.trim(),loading=x=>$('loader').classList.toggle('show',!!x),toast=m=>{let e=$('toast');e.textContent=m;e.classList.add('show');clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove('show'),2600)},show=id=>{['setupView','loginView','confirmView','dashboardView','formView'].forEach(x=>$(x).classList.toggle('hidden',x!==id));$('logoutBtn').classList.toggle('hidden',!student||['setupView','loginView','confirmView'].includes(id));scrollTo({top:0,behavior:'smooth'})},lvl=v=>(L.find(x=>x[0]===v)||['',v||'ไม่ระบุ'])[1],opts=v=>L.map(([a,b])=>`<option value="${a}" ${a===v?'selected':''}>${b}</option>`).join(''),title=r=>r.program_title||r.project_title||r.course_name||'-',rdate=r=>r.date||r.issue_date||'-',toThai=v=>{if(!v)return'';let[y,m,d]=v.split('-');return`${d}/${m}/${+y+543}`},toIso=v=>{if(!v||v==='0')return'';let m=String(v).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(!m)return'';let y=+m[3];if(y>2400)y-=543;return`${String(y).padStart(4,'0')}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`};
function valid(v){try{let u=new URL(v);return u.protocol==='https:'&&/script\.google\.com$/.test(u.hostname)&&/\/macros\/s\/.+\/exec$/.test(u.pathname)}catch(_){return false}}
function init(){let q=new URLSearchParams(location.search),b=q.get('backend');if(b&&valid(b)){localStorage.setItem('tcas_api_url',b);q.delete('backend');history.replaceState({},'',location.pathname+(q.toString()?`?${q}`:'')+location.hash)}api=CFG.apiUrl||localStorage.getItem('tcas_api_url')||'';if(!valid(api)){show('setupView');return}$('postForm').action=api;show('loginView')}
function jsonp(action,p={}){return new Promise((ok,bad)=>{let cb='__tcas_'+Date.now()+'_'+Math.random().toString(36).slice(2),s=document.createElement('script'),tm=setTimeout(()=>done(new Error('หมดเวลาการเชื่อมต่อ กรุณาลองใหม่')),20000);function done(e,d){clearTimeout(tm);delete window[cb];s.remove();e?bad(e):ok(d)}window[cb]=d=>done(null,d);let u=new URL(api);u.searchParams.set('action',action);u.searchParams.set('callback',cb);Object.entries(p).forEach(([k,v])=>u.searchParams.set(k,String(v??'')));s.onerror=()=>done(new Error('เชื่อมต่อฐานข้อมูลไม่สำเร็จ'));s.src=u;s.async=true;document.head.appendChild(s)})}
function post(action,p){return new Promise((ok,bad)=>{let token='p_'+Date.now()+'_'+Math.random().toString(36).slice(2),h=e=>{if(!e.data||e.data.source!=='tcas-apps-script'||e.data.token!==token)return;removeEventListener('message',h);clearTimeout(postTimer);e.data.ok?ok(e.data.result):bad(new Error(e.data.message||'บันทึกข้อมูลไม่สำเร็จ'))};addEventListener('message',h);$('postForm').elements.action.value=action;$('postForm').elements.payload.value=JSON.stringify({...p,_token:token});$('postForm').elements.origin.value=location.origin;postTimer=setTimeout(()=>{removeEventListener('message',h);bad(new Error('หมดเวลาการบันทึก กรุณาลองใหม่'))},25000);$('postForm').submit()})}
function handleStudentError(error){const message=error&&error.message?error.message:'เกิดข้อผิดพลาด';if(/เซสชันนักเรียนหมดอายุ/.test(message)){pending=null;pendingToken='';student=null;studentToken='';records=[];editing=type=null;$('studentCode').value='';$('citizenLast4').value='';show('loginView');$('loginError').textContent='เซสชันหมดอายุแล้ว กรุณาเข้าสู่ระบบใหม่';$('loginError').classList.remove('hidden');return true}return false}
$('brandTitle').textContent=CFG.appName||'ระบบบันทึกข้อมูลผลงานนักเรียน';$('brandSchool').textContent=CFG.schoolName||'';
$('saveBackendBtn').onclick=()=>{let v=$('backendInput').value.trim();$('setupError').classList.add('hidden');if(!valid(v)){$('setupError').textContent='กรุณาวาง URL Google Apps Script ที่ลงท้ายด้วย /exec';$('setupError').classList.remove('hidden');return}localStorage.setItem('tcas_api_url',v);api=v;$('postForm').action=api;show('loginView');toast('เชื่อมต่อระบบแล้ว')};
$('studentCode').oninput=e=>{e.target.value=e.target.value.replace(/\D/g,'');$('loginError').classList.add('hidden')};
$('citizenLast4').oninput=e=>{e.target.value=e.target.value.replace(/\D/g,'').slice(0,4);$('loginError').classList.add('hidden')};
$('loginForm').onsubmit=async e=>{e.preventDefault();let id=$('studentCode').value.trim(),last4=$('citizenLast4').value.trim();if(!id||last4.length!==4)return;loading(1);$('loginError').classList.add('hidden');try{let r=await post('studentLogin',{student_id:id,citizen_last4:last4});pending=r.student;pendingToken=r.student_token;$('confirmName').textContent=name(r.student);$('confirmStudentId').textContent=r.student.student_id||'-';$('confirmClass').textContent=r.student.class_room||'-';show('confirmView')}catch(x){$('loginError').textContent=x.message;$('loginError').classList.remove('hidden')}finally{loading(0)}};
$('wrongBtn').onclick=()=>{if(pendingToken)post('studentLogout',{student_token:pendingToken}).catch(()=>{});pending=null;pendingToken='';$('studentCode').value='';$('citizenLast4').value='';show('loginView');$('studentCode').focus()};$('confirmBtn').onclick=async()=>{if(!pending||!pendingToken)return;student=pending;studentToken=pendingToken;pending=null;pendingToken='';await refresh(1);if(student)show('dashboardView')};$('logoutBtn').onclick=()=>{if(studentToken)post('studentLogout',{student_token:studentToken}).catch(()=>{});pending=student=null;pendingToken=studentToken='';records=[];editing=type=null;$('studentCode').value='';$('citizenLast4').value='';show('loginView')};$('refreshBtn').onclick=()=>refresh(0);
async function refresh(silent){if(!student||!studentToken)return;if(!silent)loading(1);try{let r=await post('studentRecords',{student_token:studentToken});student=r.student||student;records=r.records||[];render();if(!silent)toast('อัปเดตข้อมูลแล้ว')}catch(x){if(!handleStudentError(x)&&!silent)toast(x.message)}finally{if(!silent)loading(0)}}
function render(){$('dashName').textContent=name(student);$('dashMeta').textContent=`รหัส ${student.student_id} · ${student.class_room||'ไม่ระบุห้อง'}`;let c={activity:0,prize:0,project:0,course:0};records.forEach(r=>c[r.type]!==undefined&&c[r.type]++);$('countActivity').textContent=`${c.activity} รายการ`;$('countPrize').textContent=`${c.prize} รายการ`;$('countProject').textContent=`${c.project} รายการ`;$('countCourse').textContent=`${c.course} รายการ`;let b=$('recordsList');if(!records.length){b.innerHTML='<div class="empty"><div class="big">📂</div><div>ยังไม่มีข้อมูลที่บันทึก</div><div class="hint">เลือกประเภทด้านบนเพื่อเพิ่มรายการแรก</div></div>';return}b.innerHTML=[...records].reverse().map(r=>`<div class="record"><div class="record-icon">${T[r.type].icon}</div><div><div class="record-title">${esc(title(r))}</div><div class="record-meta">${esc(T[r.type].label)} · ปี ${esc(r.year||'-')} · ${esc(lvl(r.level))} · ${esc(rdate(r))}${r.prize_name?` · ${esc(r.prize_name)}`:''}</div></div><div class="record-actions"><button class="mini" data-e="${esc(r.entry_id)}">แก้ไข</button><button class="mini" data-d="${esc(r.entry_id)}">ลบ</button></div></div>`).join('');b.querySelectorAll('[data-e]').forEach(x=>x.onclick=()=>{let r=records.find(z=>z.entry_id===x.dataset.e);r&&openForm(r.type,r)});b.querySelectorAll('[data-d]').forEach(x=>x.onclick=()=>remove(x.dataset.d))}
document.querySelectorAll('[data-type]').forEach(x=>x.onclick=()=>openForm(x.dataset.type));$('backBtn').onclick=$('cancelBtn').onclick=()=>{editing=type=null;show('dashboardView')};
function common(r={}){return`<div class="form-section"><h3>ข้อมูลประกอบ</h3><div class="grid3"><div class="field"><label>ปีการศึกษา <span class="required">*</span></label><input name="year" required inputmode="numeric" value="${esc(r.year||CFG.academicYear||'2569')}"></div><div class="field"><label>ระดับ</label><select name="level">${opts(r.level||'')}</select></div><div class="field"><label>จำนวนชั่วโมง</label><input name="hours" type="number" min="0" step="0.5" value="${esc(r.hours||'')}"></div><div class="field"><label>ค่าใช้จ่าย (บาท)</label><input name="fee" type="number" min="0" step="0.01" value="${esc(r.fee||'')}"></div></div></div>`}
function openForm(t,r=null){type=t;editing=r;$('formHeading').textContent=(r?'แก้ไข':'บันทึก')+T[t].label;$('formSubheading').textContent=`จัดเก็บตามโครงสร้าง ${T[t].file}`;$('formStudentName').textContent=name(student);$('formStudentMeta').textContent=`รหัส ${student.student_id} · ${student.class_room||'-'}`;$('dynamicFields').innerHTML=form(t,r||{});show('formView')}
function form(t,r){if(t==='activity')return`<div class="form-section"><h3>รายละเอียดกิจกรรม</h3><div class="grid2"><div class="field full"><label>ชื่อกิจกรรม / โครงการ <span class="required">*</span></label><input name="program_title" required value="${esc(r.program_title||'')}"></div><div class="field full"><label>บทบาท / ผลที่ได้รับ <span class="required">*</span></label><input name="exp_name" required value="${esc(r.exp_name||'')}"></div><div class="field full"><label>รายละเอียด</label><textarea name="description">${esc(r.description||'')}</textarea></div><div class="field"><label>วันที่เริ่ม <span class="required">*</span></label><input name="date" type="date" required value="${toIso(r.date||'')}"></div><div class="field"><label>วันที่สิ้นสุด</label><input name="end_date" type="date" value="${toIso(r.end_date||'')}"></div></div></div>${common(r)}`;if(t==='prize')return`<div class="form-section"><h3>รายละเอียดรางวัล</h3><div class="grid2"><div class="field full"><label>ชื่อการแข่งขัน / รายการ <span class="required">*</span></label><input name="program_title" required value="${esc(r.program_title||'')}"></div><div class="field full"><label>รางวัลที่ได้รับ <span class="required">*</span></label><input name="prize_name" required value="${esc(r.prize_name||'')}"></div><div class="field full"><label>รายละเอียด</label><textarea name="description">${esc(r.description||'')}</textarea></div><div class="field"><label>วันที่เริ่ม / วันที่ได้รับ <span class="required">*</span></label><input name="date" type="date" required value="${toIso(r.date||'')}"></div><div class="field"><label>วันที่สิ้นสุด</label><input name="end_date" type="date" value="${toIso(r.end_date||'')}"></div></div></div>${common(r)}`;if(t==='project')return`<div class="form-section"><h3>รายละเอียดโครงงาน</h3><div class="grid2"><div class="field full"><label>ชื่อโครงงาน <span class="required">*</span></label><input name="project_title" required value="${esc(r.project_title||'')}"></div><div class="field"><label>ประเภทโครงงาน <span class="required">*</span></label><select name="project_type" required><option value="">เลือกประเภท</option>${['วิทยาศาสตร์','คอมพิวเตอร์','เทคโนโลยี','สิ่งแวดล้อม','สังคมศาสตร์','นวัตกรรม','อื่น ๆ'].map(x=>`<option value="${x}" ${r.project_type===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field full"><label>รายละเอียดโครงงาน</label><textarea name="description">${esc(r.description||'')}</textarea></div><div class="field"><label>วันที่เริ่ม <span class="required">*</span></label><input name="date" type="date" required value="${toIso(r.date||'')}"></div><div class="field"><label>วันที่สิ้นสุด</label><input name="end_date" type="date" value="${toIso(r.end_date||'')}"></div></div></div>${common(r)}`;return`<div class="form-section"><h3>รายละเอียดหลักสูตร / Certificate</h3><div class="grid2"><div class="field full"><label>ชื่อหลักสูตร / การอบรม <span class="required">*</span></label><input name="course_name" required value="${esc(r.course_name||'')}"></div><div class="field"><label>ระดับหลักสูตร</label><input name="course_level" value="${esc(r.course_level||'')}"></div><div class="field"><label>ประเภทหลักสูตร</label><input name="category" value="${esc(r.category||'')}"></div><div class="field full"><label>รายละเอียด</label><textarea name="description">${esc(r.description||'')}</textarea></div><div class="field"><label>วันที่ออกใบรับรอง <span class="required">*</span></label><input name="issue_date" type="date" required value="${toIso(r.issue_date||'')}"></div><div class="field"><label>วันหมดอายุ</label><input name="expired_date" type="date" value="${toIso(r.expired_date…4618 tokens truncated…link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="styles.css?v=20260810-2015">
  <link rel="stylesheet" href="teacher.css?v=20260810-2015">
</head>
<body>
<header class="topbar">
  <div class="topbar-inner">
    <div class="brand">
      <div class="brand-mark">ST</div>
      <div><h1 id="brandTitle">ระบบบันทึกข้อมูลผลงานนักเรียน</h1><p id="brandSchool">โรงเรียนเซนต์เทเรซา</p></div>
    </div>
    <div style="display:flex;gap:8px;align-items:center">
      <button id="teacherEntryBtn" class="teacher-entry" type="button">👩‍🏫 สำหรับครู</button>
      <button id="logoutBtn" class="ghost-top hidden" type="button">ออกจากระบบ</button>
    </div>
  </div>
</header>

<main class="shell">
<section id="setupView" class="view center-view hidden"><div class="auth-card"><div class="hero-icon">⚙️</div><h2>ตั้งค่าการเชื่อมต่อครั้งแรก</h2><p class="lead">เว็บ GitHub Pages พร้อมแล้ว แต่ต้องเชื่อมกับ Google Apps Script Web App ก่อน จึงจะค้นหานักเรียนและบันทึกลง Google Sheet ได้</p><div class="field"><label>Apps Script Web App URL</label><input id="backendInput" type="url" placeholder="https://script.google.com/macros/s/.../exec"></div><div id="setupError" class="error hidden"></div><button id="saveBackendBtn" class="btn btn-primary btn-block" type="button">บันทึกการเชื่อมต่อ</button><div class="config-box hint">สำหรับผู้ดูแลระบบเท่านั้น หลังตั้งค่าแล้ว URL จะถูกเก็บในเบราว์เซอร์เครื่องนี้</div></div></section>

<section id="loginView" class="view center-view hidden"><div class="auth-card"><div class="hero-icon">🎓</div><h2>เข้าสู่ระบบนักเรียน</h2><p class="lead">กรอกรหัสประจำตัวนักเรียนและเลขท้ายบัตรประชาชน 4 หลัก เพื่อยืนยันตัวตนก่อนบันทึกผลงาน</p><form id="loginForm"><div class="field"><label>รหัสประจำตัวนักเรียน <span class="required">*</span></label><input id="studentCode" class="student-code" inputmode="numeric" autocomplete="username" maxlength="10" required placeholder="เช่น 13999"><div class="hint">กรอกเฉพาะตัวเลขรหัสประจำตัวนักเรียน</div></div><div class="field"><label>เลขท้ายบัตรประชาชน 4 หลัก <span class="required">*</span></label><input id="citizenLast4" class="student-code" type="password" inputmode="numeric" autocomplete="current-password" minlength="4" maxlength="4" pattern="[0-9]{4}" required placeholder="••••"><div class="hint">ใช้เฉพาะ 4 หลักสุดท้าย ระบบจะไม่แสดงเลขบัตรประชาชนเต็ม</div></div><div id="loginError" class="error hidden"></div><button class="btn btn-primary btn-block" type="submit">ตรวจสอบข้อมูล</button></form></div></section>

<section id="confirmView" class="view center-view hidden"><div class="identity-card"><div class="identity-head"><div class="avatar">👤</div><div><div id="confirmName" class="identity-name">-</div><div class="identity-sub">กรุณาตรวจสอบว่าข้อมูลนี้เป็นของคุณ</div></div></div><div class="identity-grid"><div class="info-box"><div class="info-label">รหัสประจำตัวนักเรียน</div><div id="confirmStudentId" class="info-value">-</div></div><div class="info-box"><div class="info-label">ชั้น / ห้อง</div><div id="confirmClass" class="info-value">-</div></div></div><div class="notice">ระบบยืนยันตัวตนแล้วและจะไม่ส่งเลขบัตรประชาชน 13 หลักกลับมายังเบราว์เซอร์</div><div class="action-row"><button id="wrongBtn" class="btn btn-secondary" type="button">ไม่ใช่ข้อมูลของฉัน</button><button id="confirmBtn" class="btn btn-primary" type="button">ข้อมูลถูกต้อง · ดำเนินการต่อ</button></div></div></section>

<section id="dashboardView" class="view hidden"><div class="dashboard-head"><div><h2>บันทึกข้อมูลผลงาน</h2><p>เลือกประเภทข้อมูลที่ตรงกับผลงานของคุณ ระบบจะจัดเก็บตามโครงสร้างไฟล์ TCASVerified แต่ละประเภทโดยอัตโนมัติ</p></div><div class="student-pill"><strong id="dashName">-</strong><span id="dashMeta">-</span></div></div><h3 class="section-title">เลือกประเภทข้อมูล</h3><div class="type-grid"><button class="type-card" data-type="activity"><div class="type-icon">🏃</div><h3>กิจกรรม</h3><p>ใช้บันทึกการเข้าร่วมกิจกรรมที่ไม่ได้เน้นรางวัล เช่น ค่าย จิตอาสา กีฬา ชุมนุม สภานักเรียน กิจกรรมพัฒนาทักษะ หรือการเข้าร่วมการแข่งขันโดยไม่ได้รับรางวัล</p><span id="countActivity" class="count">0 รายการ</span></button><button class="type-card" data-type="prize"><div class="type-icon">🏆</div><h3>รางวัล</h3><p>ใช้เมื่อได้รับรางวัลจากการแข่งขันหรือการประกวด เช่น ชนะเลิศ รองชนะเลิศ เหรียญทอง–เงิน–ทองแดง รางวัลชมเชย หรือรางวัลพิเศษ</p><span id="countPrize" class="count">0 รายการ</span></button><button class="type-card" data-type="project"><div class="type-icon">💡</div><h3>โครงงาน</h3><p>ใช้บันทึกผลงานที่นักเรียนศึกษาค้นคว้า ออกแบบ วิจัย หรือพัฒนาขึ้น เช่น โครงงานวิทยาศาสตร์ แอปพลิเคชัน สิ่งประดิษฐ์ นวัตกรรม หรือผลงานวิจัย</p><span id="countProject" class="count">0 รายการ</span></button><button class="type-card" data-type="course"><div class="type-icon">📜</div><h3>หลักสูตร / Certificate</h3><p>ใช้บันทึกการเรียนรู้หรือการอบรมที่มีหลักสูตรชัดเจน เช่น Workshop, MOOC, คอร์สออนไลน์ การอบรมเชิงปฏิบัติการ และหลักสูตรที่มีใบประกาศหรือผลการเรียนรู้</p><span id="countCourse" class="count">0 รายการ</span></button></div><h3 class="section-title">ข้อมูลที่ฉันบันทึก</h3><div class="panel"><div class="toolbar"><h3>รายการทั้งหมด</h3><button id="refreshBtn" class="btn btn-secondary" type="button">↻ อัปเดต</button></div><div id="recordsList" class="records"></div></div><div class="footer-note">ข้อมูลจะถูกบันทึกลง Google Sheet ของโรงเรียน และจัดเก็บแยกเป็น activities / prizes / projects / certs-courses</div></section>

<section id="formView" class="view hidden"><div class="form-shell"><div class="form-top"><button id="backBtn" class="back" type="button">←</button><div class="form-title"><h2 id="formHeading">บันทึกข้อมูล</h2><p id="formSubheading">-</p></div></div><div class="student-strip"><strong id="formStudentName">-</strong><span id="formStudentMeta">-</span></div><form id="entryForm" class="form-card"><div id="dynamicFields"></div><div class="form-actions"><button id="cancelBtn" class="btn btn-secondary" type="button">ยกเลิก</button><button class="btn btn-primary" type="submit">💾 บันทึกข้อมูล</button></div></form></div></section>

<!-- TEACHER LOGIN -->
<section id="teacherLoginView" class="view center-view hidden">
  <div class="auth-card teacher-login-card">
    <div class="hero-icon">👩‍🏫</div>
    <h2>ระบบตรวจสอบสำหรับครู</h2>
    <p class="lead">สำหรับครูตรวจสอบการส่งข้อมูลของนักเรียนแยกเป็นรายห้อง และดูรายละเอียดผลงานรายบุคคล</p>
    <form id="teacherLoginForm">
      <div class="field"><label>รหัสสำหรับครู <span class="required">*</span></label><input id="teacherCode" class="student-code" type="password" inputmode="numeric" autocomplete="off" maxlength="6" required placeholder="••••••"><div class="hint">กรอกรหัสสำหรับครู 6 หลัก</div></div>
      <div id="teacherLoginError" class="error hidden"></div>
      <button class="btn btn-primary btn-block" type="submit">เข้าสู่หน้าตรวจสอบ</button>
      <button id="teacherBackStudentBtn" class="btn btn-secondary btn-block" type="button">← กลับหน้าสำหรับนักเรียน</button>
    </form>
  </div>
</section>

<!-- TEACHER DASHBOARD -->
<section id="teacherDashboardView" class="view hidden">
  <div class="teacher-dashboard">
    <div class="teacher-head">
      <div><h2>Dashboard ตรวจสอบการส่งข้อมูล</h2><p>เลือกห้องเพื่อดูว่านักเรียนส่งแล้วกี่คน ยังไม่ส่งกี่คน และตรวจสอบรายละเอียดรายบุคคล</p></div>
      <div class="teacher-actions"><button id="teacherRefreshBtn" class="btn btn-secondary" type="button">↻ อัปเดตข้อมูล</button><button id="teacherLogoutBtn" class="btn btn-secondary" type="button">ออกจากโหมดครู</button></div>
    </div>

    <div class="teacher-stats">
      <div class="teacher-stat"><div id="teacherTotal" class="value">0</div><div class="label">นักเรียนทั้งหมด · <span id="teacherScopeLabel">ทุกห้อง</span></div></div>
      <div class="teacher-stat"><div id="teacherSent" class="value">0</div><div class="label">ส่งข้อมูลแล้ว</div></div>
      <div class="teacher-stat"><div id="teacherNotSent" class="value">0</div><div class="label">ยังไม่ส่งข้อมูล</div></div>
      <div class="teacher-stat"><div id="teacherRecords" class="value">0</div><div class="label">รายการผลงานทั้งหมด</div></div>
    </div>

    <div class="panel">
      <div class="toolbar"><h3>เลือกห้องเรียน</h3><span class="hint">กดที่ห้องเพื่อกรองรายชื่อ</span></div>
      <div id="teacherRoomGrid" class="room-grid"></div>
    </div>

    <h3 class="section-title">รายชื่อนักเรียน <span id="teacherResultCount" class="count">0 คน</span></h3>
    <div class="teacher-filterbar">
      <input id="teacherSearch" type="search" placeholder="ค้นหารหัสนักเรียน ชื่อ หรือนามสกุล">
      <select id="teacherStatus"><option value="all">ทุกสถานะ</option><option value="sent">ส่งแล้ว</option><option value="none">ยังไม่ส่ง</option></select>
      <select id="teacherType"><option value="all">ทุกประเภท</option><option value="activity">มีกิจกรรม</option><option value="prize">มีรางวัล</option><option value="project">มีโครงงาน</option><option value="course">มีหลักสูตร / Certificate</option></select>
    </div>

    <div class="teacher-table-wrap">
      <table class="teacher-table">
        <thead><tr><th>นักเรียน</th><th>สถานะ</th><th>จำนวน</th><th>แยกตามประเภท</th><th>รายละเอียด</th></tr></thead>
        <tbody id="teacherStudentRows"></tbody>
      </table>
    </div>
  </div>
</section>

<!-- TEACHER STUDENT DETAIL -->
<section id="teacherDetailView" class="view hidden">
  <div class="teacher-detail-shell">
    <div class="teacher-detail-head"><button id="teacherDetailBackBtn" class="back" type="button">←</button><div><h2>รายละเอียดข้อมูลนักเรียน</h2><div class="hint">ตรวจสอบข้อมูลที่นักเรียนบันทึกไว้ทั้ง 4 ประเภท</div></div></div>
    <div class="teacher-detail-student"><strong id="teacherDetailName">-</strong><div id="teacherDetailMeta">-</div></div>
    <div id="teacherRecordList" class="teacher-record-list"></div>
  </div>
</section>
</main>

<div id="loader" class="loader"><div class="spinner"></div></div>
<div id="toast" class="toast"></div>
<iframe id="postFrame" name="postFrame" class="hidden" title="data-submit"></iframe>
<form id="postForm" class="hidden" method="post" target="postFrame"><input name="action"><input name="payload"><input name="origin"></form>

<script>
window.TCAS_CONFIG = {
  apiUrl: 'https://script.google.com/macros/s/AKfycbyvEgrNa4g3puQ5AasQdpqCN295_Gcr1f1j3gcVrEkx_VH_q0r1pr7LTqYdQiHfYqR2/exec',
  appName: 'ระบบบันทึกข้อมูลผลงานนักเรียน',
  schoolName: 'โรงเรียนเซนต์เทเรซา',
  academicYear: '2569'
};
</script>
<script src="app.js?v=20260811-postmessage"></script>
<script src="teacher.js?v=20260811-postmessage"></script>
</body>
</html>
