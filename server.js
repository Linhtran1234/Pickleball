/* =========================================================================
   server.js — Express server: phục vụ frontend tĩnh + REST API đọc/ghi
   toàn bộ dữ liệu giải đấu vào SQLite (thay cho localStorage).
   ========================================================================= */
const express = require('express');
const path = require('path');
const {
  db, DB_PATH, getFullState, saveFullState, liveStore,
  findUserByUsername, findUserById, listUsers,
  createUser, updateUserRole, updateUserDisplayName, resetUserPassword, deleteUser,
  verifyPasswordHash, SaveConflictError,
} = require('./db');
const { createSession, destroySession, destroyUserSessions, authRequired, adminRequired } = require('./auth');

const app = express();
const PORT = process.env.PORT || 4000;

app.disable('x-powered-by');
app.use('/api', (req,res,next)=>{res.set('Cache-Control','no-store');next();});
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

/* ---------------------------------------------------------------------- */
/* AUTH — đăng nhập / đăng xuất / phiên hiện tại                          */
/* ---------------------------------------------------------------------- */
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = findUserByUsername(username);
  if (!user || !verifyPasswordHash(password, user.password_hash)) {
    return res.status(401).json({ error: 'Sai tên đăng nhập hoặc mật khẩu' });
  }
  const token = createSession(user);
  res.json({
    token,
    user: { id: user.id, username: user.username, role: user.role, displayName: user.display_name || user.username },
  });
});

app.post('/api/logout', authRequired, (req, res) => {
  destroySession(req.token);
  res.json({ ok: true });
});

app.get('/api/me', authRequired, (req, res) => {
  res.json({ user: { id: req.user.userId, username: req.user.username, role: req.user.role, displayName: req.user.displayName } });
});

app.put('/api/me/password', authRequired, (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  const user = findUserById(req.user.userId);
  if (!user || !verifyPasswordHash(oldPassword, user.password_hash)) {
    return res.status(401).json({ error: 'Mật khẩu hiện tại không đúng' });
  }
  try {
    resetUserPassword(user.id, newPassword);
    destroyUserSessions(user.id,req.token);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) });
  }
});

/* ---------------------------------------------------------------------- */
/* QUẢN LÝ NGƯỜI DÙNG — chỉ Admin                                         */
/* ---------------------------------------------------------------------- */
app.get('/api/users', adminRequired, (req, res) => {
  res.json(listUsers());
});

app.post('/api/users', adminRequired, (req, res) => {
  try {
    const u = createUser(req.body || {});
    res.json({ id: u.id, username: u.username, role: u.role, displayName: u.display_name });
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) });
  }
});

app.put('/api/users/:id', adminRequired, (req, res) => {
  try {
    const { role, displayName } = req.body || {};
    let u = findUserById(req.params.id);
    if (!u) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    if (role) u = updateUserRole(req.params.id, role);
    if (displayName !== undefined) u = updateUserDisplayName(req.params.id, displayName);
    res.json({ id: u.id, username: u.username, role: u.role, displayName: u.display_name });
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) });
  }
});

app.post('/api/users/:id/reset-password', adminRequired, (req, res) => {
  try {
    resetUserPassword(req.params.id, (req.body || {}).newPassword);
    destroyUserSessions(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) });
  }
});

app.delete('/api/users/:id', adminRequired, (req, res) => {
  try {
    if (req.params.id === req.user.userId) {
      return res.status(400).json({ error: 'Không thể tự xóa tài khoản đang đăng nhập' });
    }
    deleteUser(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) });
  }
});

/* GET toàn bộ state (teams, waiting, matches) — công khai, KHÔNG cần đăng
   nhập. Mặc định ai vào web cũng xem được (quyền User). Chỉ khi cần
   sửa/xóa dữ liệu (PUT bên dưới) mới bắt buộc đăng nhập Admin. */
app.get('/api/state', (req, res) => {
  res.json(getFullState());
});

/* Public, one-way event stream; writing broadcast points still requires Admin. */
const liveClients=new Set();
function emitLive(){
  const message='event: live\ndata: '+JSON.stringify(liveStore.read())+'\n\n';
  for(const client of liveClients)client.write(message);
}
app.get('/api/events',(req,res)=>{
  res.set({'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});res.flushHeaders();
  res.write('retry: 1500\nevent: live\ndata: '+JSON.stringify(liveStore.read())+'\n\n');liveClients.add(res);
  const heartbeat=setInterval(()=>res.write(': heartbeat\n\n'),20000);heartbeat.unref();
  req.on('close',()=>{clearInterval(heartbeat);liveClients.delete(res);});
});
app.put('/api/live-scores/:court',adminRequired,(req,res)=>{
  try{const data=liveStore.publish(Number(req.params.court),req.body,req.user.userId);emitLive();res.json(data);}
  catch(error){res.status(error.status||400).json({error:error.message,code:error.code,...liveStore.read()});}
});
app.delete('/api/live-scores/:court',adminRequired,(req,res)=>{
  try{const court=Number(req.params.court);if(!Number.isInteger(court)||court<1||court>7)return res.status(400).json({error:'Sân không hợp lệ'});const data=liveStore.detach(court,req.body?.matchId);emitLive();res.json(data);}
  catch(error){res.status(error.status||400).json({error:error.message,code:error.code,...liveStore.read()});}
});

/* PUT: ghi đè toàn bộ state — chỉ Admin được phép chỉnh sửa dữ liệu.
   Body có thể kèm `baseUpdatedAt` (thời điểm client tải dữ liệu lần cuối)
   để server phát hiện xung đột nếu người khác đã lưu đè lên trước đó
   (xem giải thích chi tiết ở db.js -> saveFullState). */
app.put('/api/state', adminRequired, (req, res) => {
  try {
    const { baseUpdatedAt, ...state } = req.body || {};
    if(!Number.isSafeInteger(baseUpdatedAt)) return res.status(400).json({error:'Thiếu phiên bản dữ liệu. Vui lòng tải lại trang trước khi lưu.'});
    const saved = saveFullState(state, baseUpdatedAt);
    for(const client of liveClients)client.write('event: state\ndata: '+JSON.stringify({updatedAt:saved.updatedAt})+'\n\n');
    emitLive();
    res.json(saved);
  } catch (e) {
    if (e instanceof SaveConflictError) {
      console.warn('Xung đột lưu state (đã có người khác lưu trước):', req.user && req.user.username);
      return res.status(409).json({ error: e.message, code: 'SAVE_CONFLICT', serverUpdatedAt: e.serverUpdatedAt });
    }
    console.error('Lỗi lưu state:', e);
    res.status(400).json({ error: String(e.message || e) });
  }
});

/* Vài endpoint tra cứu trực tiếp trong DB — tiện cho việc query/báo cáo
   mà không cần load toàn bộ state ra frontend. Công khai, không cần đăng
   nhập (chỉ là xem dữ liệu, không sửa). */
app.get('/api/players', (req, res) => {
  const { level, status } = req.query; // status = 'waiting' | 'paired'
  let sql = 'SELECT * FROM players WHERE 1=1';
  const params = [];
  if (level) { sql += ' AND level = ?'; params.push(level); }
  if (status === 'waiting') sql += ' AND team_id IS NULL';
  if (status === 'paired') sql += ' AND team_id IS NOT NULL';
  res.json(db.prepare(sql).all(...params));
});

app.get('/api/teams', (req, res) => {
  const { group, level } = req.query;
  let sql = 'SELECT * FROM teams WHERE 1=1';
  const params = [];
  if (group) { sql += ' AND grp = ?'; params.push(group); }
  if (level) { sql += ' AND level = ?'; params.push(level); }
  res.json(db.prepare(sql).all(...params));
});

app.get('/api/health', (req, res) => res.json({ ok: true, time: Date.now() }));

if(require.main===module) app.listen(PORT, () => {
  console.log(`✅ BMT Materials Pickleball server đang chạy tại http://localhost:${PORT}`);
  console.log(`   Database: ${DB_PATH}`);
});

module.exports = app;
