/* =========================================================================
   BMT MATERIALS PICKLEBALL 2026 — Tournament Manager
   Vanilla JS single-file app. Data persisted to localStorage.
   ========================================================================= */

const STORAGE_KEY = Tournament.STORAGE_PREFIX + '-state';

const LEVELS = Tournament.LEVELS;
const GROUPS = Tournament.GROUPS;

// Neutral group marks until the organizer supplies approved artwork.
const GROUP_INFO = Object.fromEntries(GROUPS.map(g => [g, {
  name: `Bảng ${g}`, fullName: `Bảng ${g}`, logo: `assets/groups/${g}.svg`
}]));
function groupName(g){ return g && GROUP_INFO[g] ? GROUP_INFO[g].name : (g||''); }
function groupFullName(g){ return groupName(g); }
function groupLogo(g){ return g && GROUP_INFO[g] ? GROUP_INFO[g].logo : ''; }
function groupLogoImg(g, size=44){
  if(!g || !GROUP_INFO[g]) return `<span class="grp-badge">${escapeHtml(g||'?')}</span>`;
  return `<img src="${groupLogo(g)}" alt="${escapeHtml(groupName(g))}" title="${escapeHtml(groupFullName(g))}" class="grp-logo" style="width:${size}px;height:${size}px;">`;
}
function groupChip(g, size=48){
  if(!g || !GROUP_INFO[g]) return g ? `<span class="grp-badge">${escapeHtml(g)}</span>` : '';
  return `<span class="grp-chip">${groupLogoImg(g,size)}<span>${escapeHtml(groupName(g))}</span></span>`;
}

const LEVEL_INFO = {
  A: { label:'Level A · Cao nhất',      short:'A', color:'#e63946' },
  B: { label:'Level B · Khá',           short:'B', color:'#f4a261' },
  C: { label:'Level C · Trung bình',    short:'C', color:'#2a9d8f' },
  D: { label:'Level D · Khởi đầu',      short:'D', color:'#4361ee' },
  E: { label:'Level E · Mới chơi',      short:'E', color:'#7b2cbf' },
};
// Số thứ tự "Level 1..5" hiển thị cho người dùng (theo đúng cách đặt tên
// trong file Excel BTC gửi) — tương ứng với các mã Level nội bộ A-E.
const LEVEL_NUM = { A:1, B:2, C:3, D:4, E:5 };
function levelDisplayName(l){ return l && LEVEL_NUM[l] ? `Level ${l}` : (l||''); }

function uid(prefix){
  return prefix + '_' + Math.random().toString(36).slice(2,9) + Date.now().toString(36).slice(-4);
}

function escapeHtml(str){
  if(str===null || str===undefined) return '';
  return String(str)
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'",'&#39;');
}

function todayStr(){
  const d = new Date();
  return d.toLocaleString('vi-VN');
}

/* ---------------------------------------------------------------------- */
/* AUTH — đăng nhập / phân quyền Admin (toàn quyền) vs User (chỉ xem)      */
/* Có server: xác thực thật qua API + token. Không có server (mở file HTML */
/* trực tiếp, không chạy `npm start`): dùng danh sách tài khoản demo lưu   */
/* trong localStorage của trình duyệt để UI phân quyền vẫn hoạt động.      */
/* ---------------------------------------------------------------------- */
const AUTH_SESSION_KEY = Tournament.STORAGE_PREFIX + '-auth';
const AUTH_LOCAL_USERS_KEY = Tournament.STORAGE_PREFIX + '-local-users';
// Retire only the known legacy event caches; never clear unrelated site storage.
try{for(const key of ['duhung-pickleball-2026-v1','duhung-pickleball-2026-auth','duhung-pickleball-2026-local-users']) localStorage.removeItem(key);}catch(error){console.warn('Không truy cập được bộ nhớ trình duyệt');}
const DEFAULT_LOCAL_USERS = [
  { id:'local_admin', username:'admin', password:'admin123', role:'admin', displayName:'Quản trị viên' },
  { id:'local_user',  username:'user',  password:'user123',  role:'user',  displayName:'Người xem' },
];

let CURRENT_USER = null; // {token, id, username, role, displayName, local}

function isAdmin(){ return !!(CURRENT_USER && CURRENT_USER.role === 'admin'); }

function authHeaders(){
  return (CURRENT_USER && !CURRENT_USER.local) ? { 'Authorization': 'Bearer ' + CURRENT_USER.token } : {};
}

function getLocalUsers(){
  try{
    const raw = localStorage.getItem(AUTH_LOCAL_USERS_KEY);
    if(raw){ const list = JSON.parse(raw); if(Array.isArray(list) && list.length) return list; }
  }catch(e){/* ignore */}
  localStorage.setItem(AUTH_LOCAL_USERS_KEY, JSON.stringify(DEFAULT_LOCAL_USERS));
  return DEFAULT_LOCAL_USERS.slice();
}
function saveLocalUsers(list){ localStorage.setItem(AUTH_LOCAL_USERS_KEY, JSON.stringify(list)); }

function persistSession(session){
  CURRENT_USER = session;
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}
function clearSession(){
  CURRENT_USER = null;
  localStorage.removeItem(AUTH_SESSION_KEY);
}

// Thử đăng nhập: ưu tiên server thật (an toàn hơn), nếu không có server thì
// rơi về danh sách tài khoản demo lưu cục bộ trong trình duyệt.
async function attemptLogin(username, password){
  try{
    const res = await fetch(API_BASE + '/api/login', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ username, password })
    });
    if(res.ok){
      const data = await res.json();
      return { ok:true, session: { token:data.token, ...data.user, local:false } };
    }
    if(res.status===401){
      return { ok:false, reason:'Sai tên đăng nhập hoặc mật khẩu' };
    }
    throw new Error('HTTP '+res.status);
  }catch(e){
    if(location.protocol!=='file:') return {ok:false,reason:'Không kết nối được máy chủ đăng nhập. Vui lòng thử lại.'};
    const users = getLocalUsers();
    const found = users.find(u=>u.username===username.trim().toLowerCase() && u.password===password);
    if(found){
      return { ok:true, session: { token:'local_'+found.id, id:found.id, username:found.username, role:found.role, displayName:found.displayName, local:true } };
    }
    return { ok:false, reason:'Sai tên đăng nhập hoặc mật khẩu' };
  }
}

async function tryRestoreSession(){
  let raw;
  try{ raw = localStorage.getItem(AUTH_SESSION_KEY); }catch(e){ return false; }
  if(!raw) return false;
  let session;
  try{ session = JSON.parse(raw); }catch(e){ return false; }
  if(!session || !session.token) return false;
  if(session.local){
    if(location.protocol!=='file:'){ clearSession(); return false; }
    CURRENT_USER=session;return true;
  }
  // Phiên server thật — xác minh còn hiệu lực (token có thể hết hạn/server restart)
  try{
    const res = await fetch(API_BASE + '/api/me', { headers: { 'Authorization': 'Bearer ' + session.token } });
    if(res.ok){ const data=await res.json(); persistSession({...session,...data.user}); return true; }
    if(res.status===401){ localStorage.removeItem(AUTH_SESSION_KEY); return false; }
    // lỗi khác (mất mạng tạm thời) — tạm tin tưởng phiên cũ để không văng người dùng ra ngoài
    CURRENT_USER = session; return true;
  }catch(e){
    // Không gọi được server lúc này — vẫn tạm tin phiên cũ (tránh mất việc đang làm)
    CURRENT_USER = session; return true;
  }
}

function applyRoleUI(){
  const admin = isAdmin();
  const loggedIn = !!CURRENT_USER;
  document.getElementById('roleBadge').textContent = admin ? 'Admin' : 'User';
  document.getElementById('roleBadge').className = 'role-badge' + (admin ? '' : ' role-user');
  document.getElementById('roleBadge').style.display = loggedIn ? '' : 'none';
  document.getElementById('userNameLabel').textContent = loggedIn ? CURRENT_USER.displayName : '';
  document.getElementById('userNameLabel').style.display = loggedIn ? '' : 'none';
  document.getElementById('btnExport').style.display = admin ? '' : 'none';
  document.getElementById('btnImport').style.display = admin ? '' : 'none';
  document.getElementById('btnReset').style.display = admin ? '' : 'none';
  document.getElementById('btnManageUsers').style.display = admin ? '' : 'none';
  document.getElementById('btnLogout').style.display = loggedIn ? '' : 'none';
  document.getElementById('btnLoginOpen').style.display = loggedIn ? 'none' : '';
  document.body.classList.toggle('is-readonly', !admin);
}

/* Mở màn hình đăng nhập (dạng lớp phủ) — dùng khi khách muốn đăng nhập Admin
   để chỉnh sửa dữ liệu. Không còn bắt buộc phải đăng nhập mới xem được. */
function openAuthScreen(){
  document.getElementById('authScreen').style.display = 'flex';
  document.getElementById('loginUsername').value = '';
  document.getElementById('loginPassword').value = '';
  document.getElementById('authError').style.display = 'none';
  document.getElementById('loginPassword').type='password';
  const toggle=document.getElementById('passwordToggle');toggle.textContent='Hiện';toggle.setAttribute('aria-pressed','false');
  AppUX.modalOpened(document.querySelector('.auth-card'));
  document.getElementById('loginUsername').focus();
}
function closeAuthScreen(){
  document.getElementById('authScreen').style.display = 'none';
  AppUX.modalClosed();
}

async function doLogout(){
  if(USE_API && isAdmin() && saveRevision>savedRevision){
    if(!await flushState()){showToast('Chưa đăng xuất vì dữ liệu chưa lưu. Hãy xuất bản sao trước khi tải lại trang.','error');return;}
  }
  if(CURRENT_USER && !CURRENT_USER.local){
    try{ await fetch(API_BASE + '/api/logout', { method:'POST', headers: authHeaders() }); }catch(e){/* ignore */}
  }
  clearSession();
  applyRoleUI();
  render();
  showToast('Đã đăng xuất — đang ở chế độ chỉ xem (User)', 'success');
}

/* Khởi động ứng dụng — luôn hiển thị mainShell ngay (mọi người xem được),
   không cần đăng nhập. Đăng nhập chỉ cần khi muốn có quyền Admin. */
async function boot(){
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('mainShell').style.display = '';
  applyRoleUI();
  await loadState();
  render();
  AppUX.setConnection(USE_API);
  setTimeout(()=>{
    showToast(USE_API ? '✅ Đã kết nối database (server)' : '⚠️ Không có server — đang chạy tạm bằng localStorage trình duyệt', USE_API ? 'success' : 'error');
  }, 300);
  startAutoRefresh();
}

/* =========================================================================
   TỰ ĐỘNG LÀM MỚI DỮ LIỆU ĐỊNH KỲ (gần realtime)
   Trước đây app chỉ tải dữ liệu 1 LẦN lúc mở trang — người khác nhập điểm
   xong, thiết bị của mình vẫn đứng yên tới khi tự F5. Giờ cứ mỗi
   AUTO_REFRESH_INTERVAL_MS lại âm thầm hỏi server có bản mới hơn không
   (so sánh updatedAt), có thì mới thay STATE + render() lại.
   Có 2 lớp phòng vệ để KHÔNG đè mất thao tác đang dở của chính mình:
   - Bỏ qua nếu đang có 1 lần lưu (PUT) đang chờ gửi lên server
     (saveDebounceTimer khác null nghĩa là vừa gõ điểm/sửa gì đó).
   - Bỏ qua nếu người dùng đang gõ dở trong 1 ô input/textarea/select nào đó
     (ví dụ đang gõ điểm nhưng chưa blur ra), hoặc đang mở 1 popup/modal.
   ========================================================================= */
const AUTO_REFRESH_INTERVAL_MS = 8000;
let autoRefreshTimer = null;

function isUserMidEdit(){
  if(saveDebounceTimer || saveInFlight || saveRevision > savedRevision) return true; // có thay đổi chưa kịp lưu lên server
  const el = document.activeElement;
  if(el && ['INPUT','TEXTAREA','SELECT'].includes(el.tagName)) return true;
  const auth=document.getElementById('authScreen');
  if(auth && auth.style.display==='flex') return true;
  const modal = document.getElementById('modalOverlay');
  if(modal && modal.classList.contains('open')) return true;
  return false;
}

async function refreshStateQuietly(){
  if(!USE_API) return;
  if(isUserMidEdit()) return; // thử lại ở lượt sau, không phá dữ liệu đang gõ dở
  try{
    const res = await fetch(API_BASE + '/api/state', { cache:'no-store', headers: authHeaders() });
    if(!res.ok) return;
    AppUX.setConnection(true);
    const data = await res.json();
    if(!STATE || !data || data.updatedAt === lastServerUpdatedAt) return; // không có gì mới
    if(isUserMidEdit()) return; // double-check ngay trước khi ghi đè (kể cả sau await)
    STATE = data;
    lastServerUpdatedAt=data.updatedAt;
    if(!STATE.teams) STATE.teams = [];
    if(!STATE.waiting) STATE.waiting = [];
    if(!STATE.matches) STATE.matches = [];
    if(!STATE.tournamentStatus) STATE.tournamentStatus = 'setup';
    ensureLiveCourts(STATE);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE));
    render();
  }catch(e){
    AppUX.setConnection(false);
    console.warn('Tự động làm mới thất bại (bỏ qua, thử lại sau):', e.message);
  }
}

function startAutoRefresh(){
  if(autoRefreshTimer) return;
  autoRefreshTimer = setInterval(refreshStateQuietly, AUTO_REFRESH_INTERVAL_MS);
  // Khi quay lại tab (đổi tab trình duyệt rồi quay lại) thì làm mới ngay,
  // không cần đợi đủ 8 giây tiếp theo.
  document.addEventListener('visibilitychange', ()=>{
    if(document.visibilityState === 'visible') refreshStateQuietly();
  });
}

/* ---------------------------------------------------------------------- */
/* SEED DATA + STATE                                                      */
/* ---------------------------------------------------------------------- */

// A new tournament always starts empty. Test fixtures live outside public assets.
function getSeed(){ return {teams:[],waiting:[],matches:[]}; }
function defaultLiveCourt(court){ return Tournament.liveCourt(court); }
function defaultLiveCourts(){ return Array.from({length:7},(_,i)=>defaultLiveCourt(i+1)); }
function ensureLiveCourts(state){
  if(state && (!Array.isArray(state.liveCourts)||state.liveCourts.length!==7)) state.liveCourts=defaultLiveCourts();
}
function freshState(){ return Tournament.emptyState(); }

let STATE = null;

const API_BASE = '';
let USE_API = false;
let saveDebounceTimer = null;

function loadStateFromLocalStorage(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){
      const cached=JSON.parse(raw);
      Tournament.validateState(cached);
      STATE=cached;
      if(!STATE.waiting) STATE.waiting = [];
      if(!STATE.matches) STATE.matches = [];
      if(!STATE.tournamentStatus) STATE.tournamentStatus = 'setup';
      ensureLiveCourts(STATE);
      return true;
    }
  }catch(e){ console.warn('load localStorage failed', e); }
  return false;
}

async function loadState(){
  try{
    const res = await fetch(API_BASE + '/api/state', { cache:'no-store', headers: authHeaders() });
    if(res.ok){
      const data = await res.json();
      // Tin tưởng TUYỆT ĐỐI dữ liệu server bất cứ khi nào server phản hồi hợp lệ
      // (res.ok + JSON parse được) — kể cả khi teams/waiting rỗng (VD: mới xoá
      // hết đội để xếp lại, hoặc chỉ có lịch mà chưa gán đội). Trước đây điều
      // kiện "teams.length || waiting.length" từng khiến app âm thầm thay dữ
      // liệu đúng trên server bằng bản cũ/mặc định — rồi auto-save lần sau lại
      // ghi đè xoá sạch dữ liệu thật. CHỈ fallback về localStorage/seed mặc
      // định khi thật sự không gọi được server (mất mạng, server sập — rơi
      // vào catch bên dưới).
      STATE = data;
      lastServerUpdatedAt=data.updatedAt;
      saveRevision=savedRevision=0;saveBlocked=false;
      if(!STATE.teams) STATE.teams = [];
      if(!STATE.waiting) STATE.waiting = [];
      if(!STATE.matches) STATE.matches = [];
      if(!STATE.tournamentStatus) STATE.tournamentStatus = 'setup';
      ensureLiveCourts(STATE);
      USE_API = true;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE));
      return;
    }
  }catch(e){
    console.warn('Không kết nối được server database, dùng localStorage:', e.message);
  }
  if(!loadStateFromLocalStorage()){
    STATE = freshState();
  }
}

let lastServerUpdatedAt = null;
let saveRevision = 0, savedRevision = 0;
let saveInFlight = null, saveBlocked = false;
function setSaveStatus(message, failed=false){
  const el=document.getElementById('saveStatus');
  if(el){el.textContent=message;el.className=failed?'save-error':'';}
  const retry=document.getElementById('btnSaveRetry');
  if(retry) retry.style.display=failed && isAdmin() && !saveBlocked ? '' : 'none';
}
function saveState(){
  if(!isAdmin()) return;
  saveRevision++;
  localStorage.setItem(STORAGE_KEY,JSON.stringify(STATE));
  if(!USE_API){savedRevision=saveRevision;return;}
  setSaveStatus('Chưa lưu');
  clearTimeout(saveDebounceTimer);
  saveDebounceTimer=setTimeout(()=>{saveDebounceTimer=null;flushState();},500);
}
async function flushState(options={}){
  clearTimeout(saveDebounceTimer);saveDebounceTimer=null;
  if(saveInFlight){await saveInFlight;return saveRevision>savedRevision&&!saveBlocked?flushState(options):!saveBlocked;}
  if(!USE_API||!isAdmin()||saveRevision===savedRevision) return true;
  if(saveBlocked) return false;
  const revision=saveRevision;
  const body=JSON.stringify({...STATE,baseUpdatedAt:lastServerUpdatedAt});
  setSaveStatus('Đang lưu…');
  saveInFlight=(async()=>{
    try{
      const res=await fetch(API_BASE+'/api/state',{method:'PUT',headers:{'Content-Type':'application/json',...authHeaders()},body,keepalive:!!options.keepalive});
      const data=await res.json();
      if(!res.ok){
        if(res.status===409){saveBlocked=true;throw new Error('Dữ liệu đã được người khác thay đổi. Xuất bản sao dữ liệu trước khi tải lại trang.');}
        if(res.status===401||res.status===403){saveBlocked=true;throw new Error('Phiên đăng nhập hoặc quyền sửa đã thay đổi. Xuất bản sao trước khi đăng nhập lại.');}
        throw new Error(data.error||'Không lưu được dữ liệu');
      }
      lastServerUpdatedAt=data.updatedAt;STATE.updatedAt=data.updatedAt;savedRevision=revision;AppUX.setConnection(true);
      localStorage.setItem(STORAGE_KEY,JSON.stringify(STATE));
      setSaveStatus(savedRevision===saveRevision?'Đã lưu':'Chưa lưu');
      return true;
    }catch(error){AppUX.setConnection(false);setSaveStatus('Chưa lưu lên máy chủ',true);showToast(error.message,'error');return false;}
  })();
  const ok=await saveInFlight;saveInFlight=null;
  if(ok && saveRevision>savedRevision) return flushState(options);
  return ok;
}
window.addEventListener('beforeunload',e=>{
  if(!USE_API||!STATE||!isAdmin()||saveRevision===savedRevision) return;
  e.preventDefault();e.returnValue='';
  if(!saveBlocked) flushState({keepalive:true});
});

/* ---------------------------------------------------------------------- */
/* TEAM / MATCH HELPERS                                                   */
/* ---------------------------------------------------------------------- */

function getTeam(id){ return STATE.teams.find(t=>t.id===id); }

function teamDisplayName(t){
  if(!t) return '—';
  const n1 = t.p1 && t.p1.name ? t.p1.name : '?';
  const n2 = t.p2 && t.p2.name ? t.p2.name : '?';
  return `${n1} & ${n2}`;
}

function teamSlot(group, level){
  return STATE.teams.find(t=>t.group===group && t.level===level);
}

function occupantsOfGroup(group){
  return STATE.teams.filter(t=>t.group===group);
}

// Round robin pairing generator for N items -> list of [i,j] index pairs
function roundRobinPairs(n){
  const pairs = [];
  for(let i=0;i<n;i++){
    for(let j=i+1;j<n;j++){
      pairs.push([i,j]);
    }
  }
  return pairs;
}

// LỊCH THI ĐẤU CỐ ĐỊNH — được nạp từ file schedule.js (dùng chung với server,
// xem schedule.js — thẻ <script src="schedule.js"> phải nạp TRƯỚC app.js
// trong index.html). Không định nghĩa lại mảng này ở đây nữa để tránh dữ
// liệu client và database bị lệch nhau (đã từng gây lỗi lọc theo Lượt đấu
// không ra kết quả vì DB cũ vẫn dùng định dạng giờ cố định).
const FIXED_SCHEDULE = window.FIXED_SCHEDULE;
if (!FIXED_SCHEDULE) {
  console.error('schedule.js chưa được nạp trước app.js — kiểm tra lại index.html');
}

// Rebuild lịch đấu: gán lại đội (team1/team2) theo bảng/cấp độ hiện tại vào
// đúng từng ô Sân/giờ cố định ở trên. Sân/giờ/số trận KHÔNG BAO GIỜ thay đổi dù
// bạn xếp lại đội — chỉ tên đội hiển thị trong từng ô là được cập nhật theo
// đội nào đang ngồi ở bảng/cấp độ đó. Tỷ số đã nhập được giữ nguyên (khớp theo
// đúng ô Sân+giờ+Cấp độ).
// LƯU Ý QUAN TRỌNG (đã sửa lỗi nghiêm trọng 2026-07-17): 1 ô "Sân+Lượt" KHÔNG
// PHẢI là duy nhất — mỗi Sân/Lượt thường có 2-3 trận thuộc các Cấp độ (level)
// khác nhau diễn ra ở cùng ô đó (VD Sân 1/Lượt 1 có cả trận Level A, Level C,
// Level E). Khóa tra cứu cũ chỉ dùng "court+time" nên các trận khác Cấp độ
// nhưng cùng Sân+Lượt bị GHI ĐÈ lẫn nhau trong oldByCourtTime — khiến tất cả
// các trận đó nhận CHUNG 1 id (trùng lặp id trong STATE.matches) và có thể bị
// tráo/mất tỷ số đã nhập cho nhau. Hậu quả thực tế: gọi PUT /api/state với id
// trùng lặp vi phạm UNIQUE constraint của cột matches.id trong SQLite khiến
// toàn bộ thao tác lưu thất bại (lỗi 500) — tỷ số vừa nhập không được lưu vào
// database dù giao diện vẫn hiển thị tạm trong bộ nhớ/localStorage. Phải thêm
// "level" vào khóa (mỗi Sân+Lượt luôn có Cấp độ duy nhất, đã kiểm chứng) để
// tra đúng từng trận.
// LƯU Ý QUAN TRỌNG #2 (đã sửa lỗi nghiêm trọng 2026-07-20): khóa court+time+level
// chỉ xác định ĐÚNG VỊ TRÍ ô lịch, KHÔNG xác định đúng 2 đội đang thi đấu ở ô
// đó. Trước đây nếu Admin đổi Bảng/Level của 1 đội (Sửa đội / Chọn đội cho ô)
// SAU KHI ô đó đã có tỷ số, đội mới được xếp vào sẽ "thừa hưởng" NHẦM tỷ số
// của đội cũ từng ngồi ở ô đó — dù 2 đội chưa từng thi đấu với nhau. Lỗi này
// làm sai luôn thắng/thua/điểm của đội và tổng điểm của cả bảng, có thể làm
// lệch kết quả tìm đội vô địch. Phải kiểm tra ĐÚNG CẶP ĐỘI (2 chiều, vì thứ
// tự team1/team2 có thể đảo khi đổi bảng) trước khi giữ lại tỷ số cũ; nếu
// không khớp thì đây là 1 trận HOÀN TOÀN MỚI, tỷ số phải là null.
function regenerateMatches(preserveToast){
  if(!isAdmin()) return;
  const oldByCourtTime = {};
  (STATE.matches || []).forEach(m=>{
    if(m.empty) return;
    oldByCourtTime[m.court+'@'+m.time+'@'+m.level] = m;
  });

  const newMatches = FIXED_SCHEDULE.map(slot=>{
    if(slot.empty){
      return { id: uid('M'), court: slot.court, time: slot.time, empty: true };
    }
    const teamA = teamSlot(slot.groupA, slot.level);
    const teamB = teamSlot(slot.groupB, slot.levelB || slot.level);
    const key = slot.court+'@'+slot.time+'@'+slot.level;
    const existing = oldByCourtTime[key];
    if(!teamA || !teamB){
      // Bảng/cấp độ này chưa có đủ đội (đang xếp bảng dở) — để tạm là ô trống
      // thay vì lỗi, sẽ tự động có đội khi xếp bảng xong.
      return { id: existing ? existing.id : uid('M'), court: slot.court, time: slot.time, empty: true };
    }
    // Chỉ giữ tỷ số/trạng thái cũ nếu đúng 2 đội hiện tại (bất kể thứ tự) khớp
    // với 2 đội đã có tỷ số ở ô này trước đó — nếu không, coi như trận mới.
    const samePair = !!existing && (
      (existing.team1===teamA.id && existing.team2===teamB.id) ||
      (existing.team1===teamB.id && existing.team2===teamA.id)
    );
    const swapped = samePair && existing.team1===teamB.id;
    return {
      id: existing ? existing.id : uid('M'),
      level: slot.level,
      groupA: slot.groupA, groupB: slot.groupB,
      team1: teamA.id, team2: teamB.id,
      score1: samePair ? (swapped ? existing.score2 : existing.score1) : null,
      score2: samePair ? (swapped ? existing.score1 : existing.score2) : null,
      status: samePair ? existing.status : 'pending',
      court: slot.court,
      time: slot.time,
      empty: false
    };
  });

  STATE.matches = newMatches;
  if(preserveToast!==false) saveState();
}

/* =========================================================================
   TRẠNG THÁI GIẢI ĐẤU: 'setup' (đang xếp bảng, KHOÁ nhập tỷ số) <-> 'started'
   (đã bắt đầu thi đấu, KHOÁ sửa Bảng/Level/xoá đội). Mục đích: ngăn đúng gốc
   rễ lỗi "tráo tỷ số khi đổi đội" — nếu Bảng/Level không thể đổi được nữa
   sau khi đã bắt đầu thì tình huống oldByCourtTime khớp nhầm cặp đội (xem
   comment ở regenerateMatches phía trên) không còn đường xảy ra trong vận
   hành bình thường. Đây là lớp bảo vệ QUY TRÌNH, độc lập với bản vá kỹ
   thuật ở regenerateMatches (lớp bảo vệ DỮ LIỆU) — cả 2 cùng tồn tại.
   ========================================================================= */
function isTournamentStarted(){
  return !!(STATE && STATE.tournamentStatus === 'started');
}

// Gọi ở đầu các hàm sửa Bảng/Level/xoá đội — chặn và báo lỗi nếu giải đã bắt đầu.
function blockIfStarted(){
  if(!isAdmin()) return true;
  if(isTournamentStarted()){
    showToast('Giải đã bắt đầu thi đấu — bấm "Khôi phục" ở tab Chia bảng trước khi sửa Bảng/đội.', 'error');
    return true;
  }
  return false;
}

function startTournament(){
  if(!isAdmin()) return;
  const incomplete = [];
  GROUPS.forEach(g=>{
    LEVELS.forEach(l=>{
      if(!teamSlot(g,l)) incomplete.push(`${groupFullName(g)} · Level ${l}`);
    });
  });
  if(incomplete.length){
    showToast(`Chưa xếp đủ đội — còn thiếu ${incomplete.length} ô (VD: ${incomplete[0]}). Cần xếp đủ 6 bảng × 5 Level trước khi bắt đầu.`, 'error');
    return;
  }
  if(!confirm('Bắt đầu thi đấu?\n\nSau khi bắt đầu, KHÔNG THỂ sửa Bảng/Level hoặc xoá đội nữa cho đến khi bấm "Khôi phục" (và Khôi phục sẽ xoá hết tỷ số đã nhập). Bạn đã chia bảng xong và chắc chắn muốn bắt đầu?')) return;
  regenerateMatches(false); // đảm bảo lịch khớp đúng đội hiện tại ngay trước khi khoá
  STATE.tournamentStatus = 'started';
  saveState();
  render();
  showToast('🏁 Đã bắt đầu thi đấu! Có thể nhập tỷ số từ bây giờ.', 'success');
}

function restoreTournamentSetup(){
  if(!isAdmin()) return;
  if(!confirm('Khôi phục về giai đoạn xếp bảng?\n\nTOÀN BỘ tỷ số đã nhập sẽ bị XOÁ (danh sách đội/Bảng/Level được giữ nguyên). Bạn có chắc chắn?')) return;
  STATE.matches.forEach(m=>{
    if(m.empty) return;
    m.score1 = null; m.score2 = null; m.status = 'pending';
  });
  STATE.tournamentStatus = 'setup';
  saveState();
  render();
  showToast('↩️ Đã khôi phục — có thể sửa Bảng/đội trở lại. Toàn bộ tỷ số đã được xoá.', 'success');
}

function matchWinnerPoints(m){
  // returns {p1, p2} points per scoring rule: win 1, loss 0 (không có hòa —
  // luật thắng cách biệt tối thiểu 2 điểm nên về lý thuyết không xảy ra hòa;
  // nếu dữ liệu nhập bằng điểm tuyệt đối thì không cộng điểm cho ai).
  if(m.score1===null || m.score2===null || m.score1===undefined || m.score2===undefined) return null;
  const s1 = Number(m.score1), s2 = Number(m.score2);
  if(Number.isNaN(s1) || Number.isNaN(s2)) return null;
  if(s1>s2) return {p1:1,p2:0};
  if(s2>s1) return {p1:0,p2:1};
  return {p1:0,p2:0};
}

// Compute stats per team: matchesPlayed, wins, draws, losses, pf, pa, diff, points
function computeTeamStats(){
  const stats = {};
  STATE.teams.forEach(t=>{
    stats[t.id] = {teamId:t.id, played:0, wins:0, draws:0, losses:0, pf:0, pa:0, diff:0, points:0};
  });
  STATE.matches.forEach(m=>{
    const pts = matchWinnerPoints(m);
    if(!pts) return;
    const s1 = Number(m.score1), s2 = Number(m.score2);
    if(stats[m.team1]){
      const s = stats[m.team1];
      s.played++; s.pf += s1; s.pa += s2; s.points += pts.p1;
      if(s1>s2) s.wins++; else if(s1<s2) s.losses++; else s.draws++;
    }
    if(stats[m.team2]){
      const s = stats[m.team2];
      s.played++; s.pf += s2; s.pa += s1; s.points += pts.p2;
      if(s2>s1) s.wins++; else if(s2<s1) s.losses++; else s.draws++;
    }
  });
  Object.values(stats).forEach(s=> s.diff = s.pf - s.pa);
  return stats;
}

// Compute stats per group: sum team points, total wins, diff, pf, played
function computeGroupStats(){
  const teamStats = computeTeamStats();
  const groupStats = {};
  GROUPS.forEach(g=>{
    groupStats[g] = {group:g, totalPoints:0, totalWins:0, diff:0, pf:0, pa:0, played:0, teamsFilled:0};
  });
  STATE.teams.forEach(t=>{
    if(!t.group) return;
    const s = teamStats[t.id];
    const g = groupStats[t.group];
    g.teamsFilled++;
    if(s){
      g.totalPoints += s.points;
      g.totalWins += s.wins;
      g.diff += s.diff;
      g.pf += s.pf;
      g.pa += s.pa;
      g.played += s.played;
    }
  });
  return groupStats;
}

// Tổng số trận thắng-thua giữa 2 bảng khi các đội của bảng A gặp trực tiếp
// các đội của bảng B (dùng làm tiêu chí "kết quả đối đầu" khi xét bằng điểm).
function groupHeadToHead(gA, gB){
  let winsA = 0, winsB = 0;
  STATE.matches.forEach(m=>{
    if(m.empty || m.score1===null || m.score2===null || m.score1===undefined || m.score2===undefined) return;
    const t1 = getTeam(m.team1), t2 = getTeam(m.team2);
    if(!t1 || !t2) return;
    const s1 = Number(m.score1), s2 = Number(m.score2);
    if(Number.isNaN(s1) || Number.isNaN(s2) || s1===s2) return;
    if(t1.group===gA && t2.group===gB) (s1>s2 ? winsA++ : winsB++);
    else if(t1.group===gB && t2.group===gA) (s2>s1 ? winsA++ : winsB++);
  });
  return winsA - winsB; // dương = bảng A thắng nhiều hơn khi đối đầu trực tiếp
}

// Thứ tự tiêu chí PHẢI khớp với nội dung mô tả cho người dùng ở tab "Thể thức"
// và phần help-text tab "Xếp hạng": tổng điểm/thắng -> hiệu số -> điểm ghi được
// -> kết quả đối đầu -> bốc thăm (không thể tự động hoá bốc thăm, admin xử lý
// thủ công nếu vẫn còn bằng nhau tuyệt đối sau tiêu chí (4)).
function rankGroups(){
  const gs = computeGroupStats();
  const arr = Object.values(gs).filter(g=>g.teamsFilled>0);
  arr.sort((a,b)=>{
    if(b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if(b.totalWins !== a.totalWins) return b.totalWins - a.totalWins;
    if(b.diff !== a.diff) return b.diff - a.diff;
    if(b.pf !== a.pf) return b.pf - a.pf;
    const h2h = groupHeadToHead(a.group, b.group);
    if(h2h !== 0) return -h2h;
    // Vẫn bằng nhau tuyệt đối sau cả 4 tiêu chí -> cần bốc thăm thủ công.
    // Sắp theo tên bảng chỉ để thứ tự hiển thị ổn định, KHÔNG phải kết quả cuối cùng.
    return a.group.localeCompare(b.group);
  });
  return arr;
}

/* ---------------------------------------------------------------------- */
/* ANIMATION HELPERS: đếm số tăng dần, FLIP transition khi thứ hạng đổi,   */
/* confetti nhỏ khi ghi tỷ số thắng                                       */
/* ---------------------------------------------------------------------- */
function runCountUps(root,animate=true){
  (root||document).querySelectorAll('[data-countup]').forEach(el=>{
    const target = Number(el.dataset.countup);
    if(Number.isNaN(target)) return;
    if(!animate||AppUX.reducedMotion()){el.textContent=target;return;}
    const duration = 650;
    const start = performance.now();
    function step(now){
      const p = Math.min(1,(now-start)/duration);
      const eased = 1 - Math.pow(1-p,3);
      const val = Math.round(target*eased);
      el.textContent = val;
      if(p<1) requestAnimationFrame(step);
      else el.textContent = target;
    }
    requestAnimationFrame(step);
  });
}

function flipCapture(selector){
  const map = {};
  document.querySelectorAll(selector).forEach(el=>{
    const key = el.dataset.flipKey;
    if(key) map[key] = el.getBoundingClientRect();
  });
  return map;
}
function flipPlay(selector, prevRects){
  if(!prevRects) return;
  document.querySelectorAll(selector).forEach(el=>{
    const key = el.dataset.flipKey;
    if(!key || !prevRects[key]) return;
    const prev = prevRects[key];
    const now = el.getBoundingClientRect();
    const dy = prev.top - now.top;
    if(Math.abs(dy) < 1) return;
    el.style.transition = 'none';
    el.style.transform = `translateY(${dy}px)`;
    requestAnimationFrame(()=>{
      el.style.transition = 'transform .5s cubic-bezier(.2,.8,.2,1)';
      el.style.transform = '';
    });
  });
}

function spawnConfetti(container){
  if(!container) return;
  const layer = document.createElement('div');
  layer.className = 'confetti-layer';
  const cs = getComputedStyle(container);
  if(cs.position === 'static') container.style.position = 'relative';
  container.appendChild(layer);
  const colors = ['#ffc72c','#17a974','#4361ee','#e63946','#7b2cbf'];
  for(let i=0;i<20;i++){
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    p.style.left = (Math.random()*100)+'%';
    p.style.background = colors[i%colors.length];
    p.style.animationDelay = (Math.random()*0.25)+'s';
    p.style.animationDuration = (0.8+Math.random()*0.6)+'s';
    layer.appendChild(p);
  }
  setTimeout(()=> layer.remove(), 1700);
}

/* ---------------------------------------------------------------------- */
/* TOAST                                                                  */
/* ---------------------------------------------------------------------- */
let toastTimer=null;
function showToast(msg, type){
  const el = document.getElementById('toast');
  el.replaceChildren();
  const mark=document.createElement('span');mark.className='ux-toast-icon';mark.innerHTML=AppUX.icon(type==='error'?'info':'check');
  const text=document.createElement('span');text.className='ux-toast-text';
  let message=String(msg).trim();for(const prefix of ['✅','⚠️','⚠','❌','🔒'])if(message.startsWith(prefix))message=message.slice(prefix.length).trim();
  text.textContent=message;
  const dismiss=document.createElement('button');dismiss.className='ux-toast-close';dismiss.type='button';dismiss.setAttribute('aria-label','Đóng thông báo');dismiss.innerHTML=AppUX.icon('close');dismiss.onclick=()=>{clearTimeout(toastTimer);el.className='toast';};
  el.append(mark,text,dismiss);
  el.className = 'toast show' + (type ? ' '+type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> el.className='toast', 2400);
}

/* ---------------------------------------------------------------------- */
/* MODAL                                                                  */
/* ---------------------------------------------------------------------- */
function openModal(html){
  document.getElementById('modalBox').innerHTML = html;
  document.getElementById('modalOverlay').classList.add('open');
  AppUX.modalOpened(document.getElementById('modalBox'));
}
function closeModal(){
  document.getElementById('modalOverlay').classList.remove('open');
  document.getElementById('modalBox').innerHTML = '';
  AppUX.modalClosed();
}
document.getElementById('modalOverlay').addEventListener('click', (e)=>{
  if(e.target.id==='modalOverlay') closeModal();
});

/* ---------------------------------------------------------------------- */
/* TAB ROUTER                                                             */
/* ---------------------------------------------------------------------- */
let CURRENT_TAB = 'overview';

let LAST_RENDERED_TAB=null;
const RENDERERS = {}; // filled by other script sections: RENDERERS.overview = fn, etc.

function switchTab(tab){
  CURRENT_TAB = tab;
  document.querySelectorAll('.tab-btn').forEach(b=>{
    b.classList.toggle('active', b.dataset.tab===tab);
  });
  render();
}

function render(){
  applyRoleUI();
  const app = document.getElementById('app');
  const flipPrev = (CURRENT_TAB==='ranking') ? flipCapture('[data-flip-key]') : null;
  const fn = RENDERERS[CURRENT_TAB];
  app.innerHTML = fn ? AppUX.header(CURRENT_TAB,STATE)+fn() : '<div class="empty-state">Đang phát triển...</div>';
  if(window['after_'+CURRENT_TAB+'_render']) window['after_'+CURRENT_TAB+'_render']();
  AppUX.afterRender(CURRENT_TAB,STATE);
  runCountUps(app,LAST_RENDERED_TAB!==CURRENT_TAB);LAST_RENDERED_TAB=CURRENT_TAB;
  if(flipPrev) flipPlay('[data-flip-key]', flipPrev);
}

document.getElementById('tabbar').addEventListener('click', (e)=>{
  const btn = e.target.closest('.tab-btn');
  if(!btn) return;
  switchTab(btn.dataset.tab);
});

/* ---------------------------------------------------------------------- */
/* EXPORT / IMPORT / RESET                                                */
/* ---------------------------------------------------------------------- */
document.getElementById('btnExport').addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(STATE,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bmt-pickleball-data.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Đã xuất file dữ liệu JSON','success');
});

document.getElementById('btnImport').addEventListener('click', ()=>{
  document.getElementById('fileImport').click();
});
document.getElementById('fileImport').addEventListener('change', (e)=>{
  if(!isAdmin()) return;
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = (ev)=>{
    try{
      const data = JSON.parse(ev.target.result);
      Tournament.validateState(data);
      STATE = data;
      if(!STATE.waiting) STATE.waiting=[];
      if(!STATE.matches) STATE.matches=[];
      if(!STATE.tournamentStatus) STATE.tournamentStatus='setup';
      ensureLiveCourts(STATE);
      saveState();
      render();
      showToast('Đã nhập dữ liệu thành công','success');
    }catch(err){
      showToast(err.message||'File không hợp lệ','error');
    }
  };
  reader.readAsText(file);
  e.target.value='';
});

document.getElementById('btnReset').addEventListener('click', ()=>{
  if(!isAdmin()) return;
  if(!confirm('Tạo lại giải từ đầu? Toàn bộ VĐV, đội, lịch, tỷ số, ghi chú và dữ liệu LIVE sẽ bị xóa. Không thể hoàn tác từ ứng dụng.')) return;
  STATE = freshState();
  saveState();
  render();
  showToast('Đã tạo lại giải trống','success');
});

/* ---------------------------------------------------------------------- */
/* QUẢN LÝ NGƯỜI DÙNG (chỉ Admin) — hoạt động với server thật (API) hoặc  */
/* danh sách tài khoản demo lưu cục bộ khi không có server.               */
/* ---------------------------------------------------------------------- */
async function fetchUsersList(){
  if(CURRENT_USER && !CURRENT_USER.local){
    try{
      const res = await fetch(API_BASE + '/api/users', { headers: authHeaders() });
      if(res.ok) return await res.json();
    }catch(e){ console.warn('Không tải được danh sách người dùng từ server:', e.message); }
  }
  if(location.protocol!=='file:') throw new Error('Không tải được danh sách tài khoản từ máy chủ');
  return getLocalUsers().map(u=>({ id:u.id, username:u.username, display_name:u.displayName, role:u.role }));
}

function userRowHtml(u){
  const isMe = CURRENT_USER && (u.id===CURRENT_USER.id || u.username===CURRENT_USER.username);
  return `
    <tr data-user-id="${u.id}">
      <td><b>${escapeHtml(u.username)}</b>${isMe?' <span class="tag">Bạn</span>':''}</td>
      <td>${escapeHtml(u.display_name||u.username)}</td>
      <td>
        <select class="input um-role" data-id="${u.id}" ${isMe?'disabled':''} style="padding:5px 8px;font-size:12px;">
          <option value="user" ${u.role==='user'?'selected':''}>User (chỉ xem)</option>
          <option value="admin" ${u.role==='admin'?'selected':''}>Admin (toàn quyền)</option>
        </select>
      </td>
      <td class="nowrap">
        <button class="btn btn-sm um-reset" data-id="${u.id}" title="Đặt lại mật khẩu">🔑 Đổi mật khẩu</button>
        <button class="btn btn-icon btn-sm btn-danger um-delete" data-id="${u.id}" ${isMe?'disabled':''} title="Xóa">🗑️</button>
      </td>
    </tr>
  `;
}

async function openUserManageModal(){
  if(!isAdmin()) return;
  openModal(`
    <div class="modal-head"><h3>👤 Quản lý người dùng</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <p class="help-text" style="margin-top:-6px;">2 quyền: <b>Admin</b> — xem &amp; chỉnh sửa toàn bộ dữ liệu. <b>User</b> — chỉ xem, không thể sửa/xóa bất cứ gì.</p>
      <div id="umListWrap" class="table-wrap" style="margin-bottom:16px;"><div class="empty-state"><div class="ic">⏳</div>Đang tải...</div></div>
      <fieldset>
        <legend>+ Thêm tài khoản mới</legend>
        <div class="form-grid-2">
          <div class="form-row"><label>Tên đăng nhập *</label><input class="input" id="um_username" placeholder="vd: staff2"></div>
          <div class="form-row"><label>Tên hiển thị</label><input class="input" id="um_displayName" placeholder="vd: Nguyễn Văn A"></div>
        </div>
        <div class="form-grid-2">
          <div class="form-row"><label>Mật khẩu *</label><input class="input" id="um_password" type="password" placeholder="tối thiểu 4 ký tự"></div>
          <div class="form-row"><label>Quyền</label>
            <select class="input" id="um_role">
              <option value="user" selected>User (chỉ xem)</option>
              <option value="admin">Admin (toàn quyền)</option>
            </select>
          </div>
        </div>
        <button class="btn btn-primary" style="margin-bottom:12px;" onclick="createUserFromModal()">+ Tạo tài khoản</button>
      </fieldset>
    </div>
    <div class="modal-foot"><button class="btn" onclick="closeModal()">Đóng</button></div>
  `);
  await refreshUserManageList();
}

async function refreshUserManageList(){
  const wrap = document.getElementById('umListWrap');
  if(!wrap) return;
  let users;
  try{users=await fetchUsersList();}catch(error){wrap.textContent=error.message;showToast(error.message,'error');return;}
  wrap.innerHTML = `
    <table>
      <thead><tr><th>Tên đăng nhập</th><th>Tên hiển thị</th><th>Quyền</th><th></th></tr></thead>
      <tbody>${users.map(u=>userRowHtml(u)).join('')}</tbody>
    </table>
  `;
  wrap.querySelectorAll('.um-role').forEach(sel=>{
    sel.addEventListener('change', ()=> updateUserRoleAction(sel.dataset.id, sel.value));
  });
  wrap.querySelectorAll('.um-reset').forEach(btn=>{
    btn.addEventListener('click', ()=> resetUserPasswordAction(btn.dataset.id));
  });
  wrap.querySelectorAll('.um-delete').forEach(btn=>{
    btn.addEventListener('click', ()=> deleteUserAction(btn.dataset.id));
  });
}

async function createUserFromModal(){
  const username = document.getElementById('um_username').value.trim();
  const displayName = document.getElementById('um_displayName').value.trim();
  const password = document.getElementById('um_password').value;
  const role = document.getElementById('um_role').value;
  if(!username || !password){ showToast('Vui lòng nhập tên đăng nhập và mật khẩu','error'); return; }
  if(password.length<4){ showToast('Mật khẩu phải có ít nhất 4 ký tự','error'); return; }

  if(CURRENT_USER && !CURRENT_USER.local){
    try{
      const res = await fetch(API_BASE + '/api/users', {
        method:'POST', headers:{'Content-Type':'application/json', ...authHeaders()},
        body: JSON.stringify({ username, password, role, displayName })
      });
      const data = await res.json();
      if(!res.ok) throw new Error(data.error||'Lỗi tạo tài khoản');
      showToast('Đã tạo tài khoản '+username,'success');
    }catch(e){ showToast(e.message,'error'); return; }
  }else{
    const users = getLocalUsers();
    if(users.some(u=>u.username===username.toLowerCase())){ showToast('Tên đăng nhập đã tồn tại','error'); return; }
    users.push({ id:'local_'+uid('u'), username:username.toLowerCase(), password, role, displayName: displayName||username });
    saveLocalUsers(users);
    showToast('Đã tạo tài khoản '+username,'success');
  }
  document.getElementById('um_username').value='';
  document.getElementById('um_displayName').value='';
  document.getElementById('um_password').value='';
  await refreshUserManageList();
}

async function updateUserRoleAction(id, role){
  if(CURRENT_USER && !CURRENT_USER.local){
    try{
      const res = await fetch(API_BASE + '/api/users/'+id, {
        method:'PUT', headers:{'Content-Type':'application/json', ...authHeaders()},
        body: JSON.stringify({ role })
      });
      const data = await res.json();
      if(!res.ok) throw new Error(data.error||'Lỗi cập nhật quyền');
      showToast('Đã cập nhật quyền','success');
    }catch(e){ showToast(e.message,'error'); }
  }else{
    const users = getLocalUsers();
    const u = users.find(x=>x.id===id);
    if(u) u.role = role;
    saveLocalUsers(users);
    showToast('Đã cập nhật quyền','success');
  }
  await refreshUserManageList();
}

async function resetUserPasswordAction(id){
  const newPassword = prompt('Nhập mật khẩu mới (tối thiểu 4 ký tự):');
  if(!newPassword) return;
  if(newPassword.length<4){ showToast('Mật khẩu phải có ít nhất 4 ký tự','error'); return; }
  if(CURRENT_USER && !CURRENT_USER.local){
    try{
      const res = await fetch(API_BASE + '/api/users/'+id+'/reset-password', {
        method:'POST', headers:{'Content-Type':'application/json', ...authHeaders()},
        body: JSON.stringify({ newPassword })
      });
      const data = await res.json();
      if(!res.ok) throw new Error(data.error||'Lỗi đổi mật khẩu');
      showToast('Đã đổi mật khẩu','success');
    }catch(e){ showToast(e.message,'error'); }
  }else{
    const users = getLocalUsers();
    const u = users.find(x=>x.id===id);
    if(u) u.password = newPassword;
    saveLocalUsers(users);
    showToast('Đã đổi mật khẩu','success');
  }
}

async function deleteUserAction(id){
  if(!confirm('Xóa tài khoản này? Không thể hoàn tác.')) return;
  if(CURRENT_USER && !CURRENT_USER.local){
    try{
      const res = await fetch(API_BASE + '/api/users/'+id, { method:'DELETE', headers: authHeaders() });
      const data = await res.json();
      if(!res.ok) throw new Error(data.error||'Lỗi xóa tài khoản');
      showToast('Đã xóa tài khoản','success');
    }catch(e){ showToast(e.message,'error'); return; }
  }else{
    let users = getLocalUsers();
    const target = users.find(x=>x.id===id);
    if(target && target.role==='admin' && users.filter(u=>u.role==='admin').length<=1){
      showToast('Phải còn ít nhất 1 tài khoản Admin','error'); return;
    }
    users = users.filter(x=>x.id!==id);
    saveLocalUsers(users);
    showToast('Đã xóa tài khoản','success');
  }
  await refreshUserManageList();
}

document.getElementById('btnManageUsers').addEventListener('click', openUserManageModal);

/* ---------------------------------------------------------------------- */
/* INIT                                                                   */
/* ---------------------------------------------------------------------- */
document.getElementById('passwordToggle').addEventListener('click',()=>{const input=document.getElementById('loginPassword'),button=document.getElementById('passwordToggle');const visible=input.type==='password';input.type=visible?'text':'password';button.textContent=visible?'Ẩn':'Hiện';button.setAttribute('aria-label',visible?'Ẩn mật khẩu':'Hiện mật khẩu');button.setAttribute('aria-pressed',String(visible));});
document.getElementById('loginForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('authError');
  const btn = document.getElementById('loginSubmitBtn');
  errEl.style.display = 'none';
  btn.disabled = true; btn.textContent = 'Đang đăng nhập...';
  const result = await attemptLogin(username, password);
  btn.disabled = false; btn.textContent = 'Đăng nhập';
  if(!result.ok){
    errEl.textContent = '⚠️ ' + result.reason;
    errEl.style.display = '';
    return;
  }
  persistSession(result.session);
  closeAuthScreen();
  applyRoleUI();
  await loadState();
  render();
  showToast('✅ Đăng nhập thành công — ' + (isAdmin() ? 'quyền Admin (toàn quyền)' : 'quyền User (chỉ xem)'), 'success');
});

document.getElementById('btnLoginOpen').addEventListener('click', openAuthScreen);
document.getElementById('authClose').addEventListener('click', closeAuthScreen);

document.getElementById('btnLogout').addEventListener('click', ()=>{
  if(confirm('Đăng xuất khỏi tài khoản hiện tại?')) doLogout();
});

document.addEventListener('DOMContentLoaded', async ()=>{
  await tryRestoreSession(); // nếu trước đó đã đăng nhập Admin/User thì khôi phục, không thì vẫn xem được với quyền Khách (User)
  await boot();
});
