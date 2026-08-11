
(()=>{'use strict';
const $=id=>document.getElementById(id);
const TYPES={activity:{label:'กิจกรรม',icon:'🏃'},prize:{label:'รางวัล',icon:'🏆'},project:{label:'โครงงาน',icon:'💡'},course:{label:'หลักสูตร / Certificate',icon:'📜'}};
const LABELS={program_title:'ชื่อกิจกรรม / การแข่งขัน',exp_name:'บทบาท / ผลที่ได้รับ',prize_name:'รางวัลที่ได้รับ',project_title:'ชื่อโครงงาน',project_type:'ประเภทโครงงาน',course_name:'ชื่อหลักสูตร / การอบรม',course_level:'ระดับหลักสูตร',category:'ประเภทหลักสูตร',description:'รายละเอียด',date:'วันที่เริ่ม / วันที่ได้รับ',end_date:'วันที่สิ้นสุด',issue_date:'วันที่ออกใบรับรอง',expired_date:'วันหมดอายุ',score:'ผลการอบรม / คะแนน',year:'ปีการศึกษา',level:'ระดับ',hours:'จำนวนชั่วโมง',fee:'ค่าใช้จ่าย',reflection:'Reflection / สิ่งที่ได้รับ'};
const HIDE_IDS=['setupView','loginView','confirmView','dashboardView','formView','teacherLoginView','teacherDashboardView','teacherDetailView'];
let teacherToken='',data=null,selectedRoom='all',statusFilter='all',typeFilter='all',searchText='',activeStudentDetail=null;
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt',"'":'&#39;','"':'&quot;'}[c]));
const name=s=>`${s.title||''}${s.first_name||''} ${s.last_name||''}`.trim();
const recordTitle=r=>r.program_title||r.project_title||r.course_name||'-';
function hideAll(){HIDE_IDS.forEach(id=>{const el=$(id);if(el)el.classList.add('hidden')});if($('logoutBtn'))$('logoutBtn').classList.add('hidden')}
function showTeacher(id){hideAll();$(id).classList.remove('hidden');$('teacherEntryBtn').classList.toggle('hidden',id!=='loginView');window.scrollTo({top:0,behavior:'smooth'})}
function showStudentLogin(){hideAll();$('loginView').classList.remove('hidden');$('teacherEntryBtn').classList.remove('hidden');window.scrollTo({top:0,behavior:'smooth'})}
function loading(on){$('loader')?.classList.toggle('show',!!on)}
function toast(msg){const e=$('toast');if(!e)return;e.textContent=msg;e.classList.add('show');clearTimeout(e._teacherT);e._teacherT=setTimeout(()=>e.classList.remove('show'),3200)}

// Teacher dashboard can read several Sheets. Allow up to 90 seconds on slow first load.
function postTeacher(action,payload={}){return new Promise((resolve,reject)=>{const api=(window.TCAS_CONFIG&&window.TCAS_CONFIG.apiUrl)||localStorage.getItem('tcas_api_url')||'';if(!api){reject(new Error('ไม่พบการเชื่อมต่อฐานข้อมูล'));return}const token='t_'+Date.now()+'_'+Math.random().toString(36).slice(2);const form=$('postForm'),frame=$('postFrame');if(!form||!frame){reject(new Error('ไม่พบฟอร์มเชื่อมต่อ'));return}let timer;const handler=e=>{if(!e.data||e.data.source!=='tcas-apps-script'||e.data.token!==token)return;window.removeEventListener('message',handler);clearTimeout(timer);e.data.ok?resolve(e.data.result):reject(new Error(e.data.message||'เกิดข้อผิดพลาด'))};window.addEventListener('message',handler);form.action=api;form.elements.action.value=action;form.elements.payload.value=JSON.stringify({...payload,_token:token});form.elements.origin.value=location.origin;timer=setTimeout(()=>{window.removeEventListener('message',handler);reject(new Error('ระบบใช้เวลาโหลดข้อมูลนานเกินไป กรุณาลองใหม่อีกครั้ง'))},90000);form.submit()})}
function handleTeacherSessionError(error){const message=error&&error.message?error.message:'เกิดข้อผิดพลาด';if(!/สิทธิ์ครูหมดอายุ/.test(message))return false;teacherToken='';data=null;$('teacherCode').value='';$('teacherLoginError').textContent='เซสชันครูหมดอายุแล้ว กรุณาเข้าสู่ระบบใหม่';$('teacherLoginError').classList.remove('hidden');showTeacher('teacherLoginView');return true}
function countsOf(list){const c={total:list.length,submitted:0,notSubmitted:0,records:0};list.forEach(s=>{const n=Number(s.total_records||0);c.records+=n;n>0?c.submitted++:c.notSubmitted++});return c}
function filteredStudents(){if(!data)return[];return data.students.filter(s=>{if(selectedRoom!=='all'&&s.class_room!==selectedRoom)return false;const submitted=Number(s.total_records||0)>0;if(statusFilter==='sent'&&!submitted)return false;if(statusFilter==='none'&&submitted)return false;if(typeFilter!=='all'&&Number((s.counts||{})[typeFilter]||0)<1)return false;const q=searchText.trim().toLowerCase();if(q){const hay=`${s.student_id} ${s.title||''}${s.first_name||''} ${s.last_name||''}`.toLowerCase();if(!hay.includes(q))return false}return true})}
function roomStudents(){if(!data)return[];return selectedRoom==='all'?data.students:data.students.filter(s=>s.class_room===selectedRoom)}
function renderStats(){const c=countsOf(roomStudents());$('teacherTotal').textContent=c.total;$('teacherSent').textContent=c.submitted;$('teacherNotSent').textContent=c.notSubmitted;$('teacherRecords').textContent=c.records;$('teacherScopeLabel').textContent=selectedRoom==='all'?'ทุกห้อง':selectedRoom}
function renderRooms(){const wrap=$('teacherRoomGrid');if(!wrap||!data)return;const all=countsOf(data.students);let html=`<button class="room-card ${selectedRoom==='all'?'active':''}" data-room="all"><div class="room-name">ทุกห้อง</div><div class="room-meta">${all.submitted}/${all.total} คนส่งแล้ว · ${all.records} รายการ</div></button>`;html+=data.rooms.map(r=>`<button class="room-card ${selectedRoom===r.class_room?'active':''}" data-room="${esc(r.class_room)}"><div class="room-name">${esc(r.class_room)}</div><div class="room-meta">${r.submitted}/${r.total} คนส่งแล้ว · ยังไม่ส่ง ${r.not_submitted} คน<br>${r.records} รายการ</div></button>`).join('');wrap.innerHTML=html;wrap.querySelectorAll('[data-room]').forEach(b=>b.onclick=()=>{selectedRoom=b.dataset.room;renderAll()})}
function renderStudents(){const list=filteredStudents(),tbody=$('teacherStudentRows');$('teacherResultCount').textContent=`${list.length} คน`;if(!list.length){tbody.innerHTML='<tr><td colspan="5"><div class="teacher-empty">ไม่พบนักเรียนตามเงื่อนไขที่เลือก</div></td></tr>';return}tbody.innerHTML=list.map(s=>{const c=s.counts||{},sent=Number(s.total_records||0)>0;return `<tr><td><div class="student-main"><strong>${esc(name(s))}</strong><span>รหัส ${esc(s.student_id)} · ${esc(s.class_room||'-')}</span></div></td><td><span class="status-pill ${sent?'status-sent':'status-none'}">${sent?'✓ ส่งแล้ว':'ยังไม่ส่ง'}</span></td><td><strong>${Number(s.total_records||0)}</strong> รายการ</td><td><div class="record-badges"><span class="record-badge">🏃 ${Number(c.activity||0)}</span><span class="record-badge">🏆 ${Number(c.prize||0)}</span><span class="record-badge">💡 ${Number(c.project||0)}</span><span class="record-badge">📜 ${Number(c.course||0)}</span></div></td><td><button class="btn btn-secondary teacher-detail-btn" data-student="${esc(s.student_id)}" ${sent?'':'disabled'}>ดูรายละเอียด</button></td></tr>`}).join('');tbody.querySelectorAll('.teacher-detail-btn:not([disabled])').forEach(b=>b.onclick=()=>openStudentDetail(b.dataset.student))}
function renderAll(){renderStats();renderRooms();renderStudents()}
async function openStudentDetail(studentId){loading(1);try{const res=await postTeacher('teacherStudent',{teacher_token:teacherToken,student_id:studentId});renderDetail(res);showTeacher('teacherDetailView')}catch(e){if(!handleTeacherSessionError(e))toast(e.message)}finally{loading(0)}}
function attachmentHtml(r){const a=Array.isArray(r.attachments)?r.attachments:[];if(!a.length)return'<div style="margin-top:12px;color:#7a8895;font-size:12px">📷 ยังไม่ได้แนบภาพหลักฐาน</div>';return `<div style="margin-top:14px;padding-top:13px;border-top:1px solid #e2e8ef"><strong>📷 ภาพหลักฐาน ${a.length} ภาพ</strong><div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:9px">${a.map((x,i)=>`<a href="${esc(x.drive_url)}" target="_blank" rel="noopener" class="btn btn-secondary" style="padding:8px 11px;font-size:12px">เปิดภาพ ${i+1}</a>`).join('')}</div></div>`}
function reviewStatus(review){if(!review)return'';return review.status==='resubmitted'?'✓ นักเรียนส่งแก้ไขแล้ว':'รอนักเรียนส่งแก้ไข'}
function reviewHtml(r){const v=r.review||{};return `<div class="teacher-review ${v.status==='resubmitted'?'is-resubmitted':''}"><div class="teacher-review-head"><strong>ข้อเสนอแนะถึงนักเรียน</strong>${v.status?`<span class="review-status">${esc(reviewStatus(v))}</span>`:''}</div><label>รายละเอียดที่ต้องเพิ่มเติมหรือแก้ไข<textarea class="teacher-review-text" data-review-text="${esc(r.entry_id)}" maxlength="2000" placeholder="เช่น เพิ่มรายละเอียดบทบาทของตนเอง ผลลัพธ์ที่เกิดขึ้น และแนบภาพหลักฐานที่ชัดเจน">${esc(v.feedback||'')}</textarea></label><div class="teacher-review-actions"><label>กำหนดส่งแก้ไข<input type="date" class="teacher-review-due" data-review-due="${esc(r.entry_id)}" value="${esc(v.due_date||'')}"></label><button class="btn btn-primary teacher-review-save" data-review-save="${esc(r.entry_id)}">${v.review_id?'อัปเดตข้อเสนอแนะ':'ส่งข้อเสนอแนะ'}</button></div>${v.resubmitted_at?`<div class="teacher-review-time">ส่งแก้ไขล่าสุด ${esc(v.resubmitted_at)}</div>`:''}</div>`}
function renderDetail(res){activeStudentDetail=res;const s=res.student||{},records=res.records||[];$('teacherDetailName').textContent=name(s);$('teacherDetailMeta').textContent=`รหัส ${s.student_id||'-'} · ${s.class_room||'-'} · ${records.length} รายการ`;const wrap=$('teacherRecordList');if(!records.length){wrap.innerHTML='<div class="teacher-empty">นักเรียนคนนี้ยังไม่มีข้อมูลที่บันทึก</div>';return}wrap.innerHTML=records.map(r=>{const type=TYPES[r.type]||{label:r.type||'รายการ',icon:'📄'};const fields=Object.keys(LABELS).filter(k=>r[k]!==undefined&&String(r[k]).trim()!=='').map(k=>`<div class="teacher-record-field"><div class="k">${esc(LABELS[k])}</div><div class="v">${esc(r[k])}</div></div>`).join('');return `<div class="teacher-record"><div class="teacher-record-top"><div><div class="teacher-record-title">${type.icon} ${esc(recordTitle(r))}</div></div><span class="teacher-record-kind">${esc(type.label)}</span></div><div class="teacher-record-grid">${fields}</div>${attachmentHtml(r)}${reviewHtml(r)}</div>`}).join('');wrap.querySelectorAll('[data-review-save]').forEach(b=>b.onclick=()=>saveReview(b.dataset.reviewSave,b))}
async function saveReview(entryId,button){if(!activeStudentDetail)return;const feedback=document.querySelector(`[data-review-text="${CSS.escape(entryId)}"]`)?.value.trim()||'';const dueDate=document.querySelector(`[data-review-due="${CSS.escape(entryId)}"]`)?.value||'';if(!feedback){toast('กรุณาระบุรายละเอียดที่ต้องการให้นักเรียนแก้ไข');return}if(!dueDate){toast('กรุณากำหนดวันส่งแก้ไข');return}button.disabled=true;loading(1);try{const result=await postTeacher('teacherReview',{teacher_token:teacherToken,student_id:activeStudentDetail.student.student_id,entry_id:entryId,feedback:feedback,due_date:dueDate});const record=activeStudentDetail.records.find(r=>r.entry_id===entryId);if(record)record.review=result.review;renderDetail(activeStudentDetail);toast('ส่งข้อเสนอแนะให้นักเรียนแล้ว')}catch(e){if(!handleTeacherSessionError(e))toast(e.message)}finally{button.disabled=false;loading(0)}}

$('teacherEntryBtn')?.addEventListener('click',()=>{teacherToken='';$('teacherCode').value='';$('teacherLoginError').classList.add('hidden');showTeacher('teacherLoginView')});
$('teacherBackStudentBtn')?.addEventListener('click',showStudentLogin);

$('teacherLoginForm')?.addEventListener('submit',async e=>{
  e.preventDefault();
  const code=$('teacherCode').value.trim();
  $('teacherLoginError').classList.add('hidden');
  if(!code)return;
  loading(1);
  try{
    // New backend validates the code first, then dashboard loads separately.
    const login=await postTeacher('teacherLogin',{teacher_code:code});
    teacherToken=login.teacher_token;
    toast('เข้าสู่ระบบแล้ว กำลังโหลดข้อมูลนักเรียน...');
    data=login.dashboard||await postTeacher('teacherDashboard',{teacher_token:teacherToken});
    selectedRoom='all';statusFilter='all';typeFilter='all';searchText='';
    $('teacherSearch').value='';$('teacherStatus').value='all';$('teacherType').value='all';
    renderAll();showTeacher('teacherDashboardView');
  }catch(err){
    teacherToken='';
    $('teacherLoginError').textContent=err.message;
    $('teacherLoginError').classList.remove('hidden');
  }finally{loading(0)}
});

$('teacherRefreshBtn')?.addEventListener('click',async()=>{if(!teacherToken)return;loading(1);try{data=await postTeacher('teacherDashboard',{teacher_token:teacherToken,force_refresh:'1'});renderAll();toast('อัปเดตข้อมูลแล้ว')}catch(e){if(!handleTeacherSessionError(e))toast(e.message)}finally{loading(0)}});
$('teacherLogoutBtn')?.addEventListener('click',async()=>{try{if(teacherToken)await postTeacher('teacherLogout',{teacher_token:teacherToken})}catch(_){ }teacherToken='';data=null;showStudentLogin()});
$('teacherSearch')?.addEventListener('input',e=>{searchText=e.target.value;renderStudents()});
$('teacherStatus')?.addEventListener('change',e=>{statusFilter=e.target.value;renderStudents()});
$('teacherType')?.addEventListener('change',e=>{typeFilter=e.target.value;renderStudents()});
$('teacherDetailBackBtn')?.addEventListener('click',()=>showTeacher('teacherDashboardView'));

if(!document.querySelector('script[data-evidence]')){const s=document.createElement('script');s.src='attachments.js?v=20260810-2008';s.dataset.evidence='1';document.body.appendChild(s)}
})();

