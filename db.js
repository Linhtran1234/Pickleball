/* =========================================================================
   db.js — SQLite database layer (better-sqlite3)
   Thay thế localStorage bằng 1 database thật, có thể query/backup/đồng bộ
   nhiều máy cùng lúc (qua server, không phải qua trình duyệt riêng lẻ nữa).
   ========================================================================= */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const Tournament = require('./public/tournament');

const DB_PATH = process.env.TOURNAMENT_DB_PATH ? path.resolve(process.env.TOURNAMENT_DB_PATH) : path.join(__dirname,'data','tournament.db');
const DATA_DIR = path.dirname(DB_PATH);
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

/* ---------------------------------------------------------------------- */
/* SCHEMA                                                                  */
/* ---------------------------------------------------------------------- */

db.exec(`
CREATE TABLE IF NOT EXISTS players (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  gender      TEXT,
  phone       TEXT,
  email       TEXT,
  company     TEXT,
  shirt       TEXT,
  level       TEXT,               -- A / B / C / D / E / NULL
  team_id     TEXT REFERENCES teams(id) ON DELETE SET NULL,
  slot        INTEGER,            -- 1 = p1, 2 = p2 trong đội (NULL nếu đang chờ ghép)
  created_at  INTEGER,
  updated_at  INTEGER
);

CREATE TABLE IF NOT EXISTS teams (
  id          TEXT PRIMARY KEY,
  level       TEXT,
  grp         TEXT,               -- Bảng A-F, NULL nếu chưa xếp
  note        TEXT,
  created_at  INTEGER,
  updated_at  INTEGER
);

CREATE TABLE IF NOT EXISTS matches (
  id          TEXT PRIMARY KEY,
  level       TEXT,
  group_a     TEXT,
  group_b     TEXT,
  team1_id    TEXT REFERENCES teams(id) ON DELETE CASCADE,
  team2_id    TEXT REFERENCES teams(id) ON DELETE CASCADE,
  score1      INTEGER,
  score2      INTEGER,
  status      TEXT,
  court       TEXT,               -- Sân 1-7 (lịch thi đấu cố định theo sân)
  time_slot   TEXT,                -- vd "08:00 - 08:20"
  is_empty    INTEGER DEFAULT 0,   -- 1 = ô trống trong lịch (VĐV nghỉ), không có team1/team2
  updated_at  INTEGER
);

CREATE TABLE IF NOT EXISTS app_meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  display_name  TEXT,
  password_hash TEXT NOT NULL,   -- format "salt:hash" (scrypt, hex)
  role          TEXT NOT NULL DEFAULT 'user', -- 'admin' | 'user'
  created_at    INTEGER,
  updated_at    INTEGER
);

CREATE INDEX IF NOT EXISTS idx_players_team ON players(team_id);
CREATE INDEX IF NOT EXISTS idx_players_level ON players(level);
CREATE INDEX IF NOT EXISTS idx_matches_teams ON matches(team1_id, team2_id);
`);

/* Migration: thêm cột court/time_slot/is_empty nếu DB cũ chưa có (tránh lỗi
   khi nâng cấp từ bản trước không có lịch theo sân cố định). */
(function migrateMatchesColumns(){
  const cols = db.prepare(`PRAGMA table_info(matches)`).all().map(c => c.name);
  if (!cols.includes('court')) db.exec(`ALTER TABLE matches ADD COLUMN court TEXT`);
  if (!cols.includes('time_slot')) db.exec(`ALTER TABLE matches ADD COLUMN time_slot TEXT`);
  if (!cols.includes('is_empty')) db.exec(`ALTER TABLE matches ADD COLUMN is_empty INTEGER DEFAULT 0`);
})();

const liveStore=require('./live-store').createLiveStore(db);

/* ---------------------------------------------------------------------- */
/* READ: DB rows -> STATE JSON (đúng shape mà frontend đang dùng)          */
/* ---------------------------------------------------------------------- */

function personFromRow(r) {
  return {
    name: r.name, gender: r.gender, phone: r.phone, email: r.email,
    company: r.company, shirt: r.shirt, level: r.level,
  };
}

function getFullState() {
  const teamsRows = db.prepare('SELECT * FROM teams ORDER BY created_at ASC').all();
  const playersRows = db.prepare('SELECT * FROM players ORDER BY created_at ASC').all();

  const playersByTeam = Object.create(null);
  const waiting = [];
  playersRows.forEach(p => {
    if (p.team_id) {
      (playersByTeam[p.team_id] = playersByTeam[p.team_id] || {})[p.slot] = p;
    } else {
      waiting.push({ id: p.id, ...personFromRow(p) });
    }
  });

  const teams = teamsRows.map(t => {
    const slots = playersByTeam[t.id] || {};
    return {
      id: t.id,
      p1: slots[1] ? personFromRow(slots[1]) : { name: '?', level: null },
      p2: slots[2] ? personFromRow(slots[2]) : { name: '?', level: null },
      level: t.level,
      group: t.grp,
      note: t.note || '',
    };
  });

  const matchesRows = db.prepare('SELECT * FROM matches ORDER BY court ASC, time_slot ASC, updated_at ASC').all();
  const matches = matchesRows.map(m => ({
    id: m.id, level: m.level, groupA: m.group_a, groupB: m.group_b,
    team1: m.team1_id, team2: m.team2_id,
    score1: m.score1, score2: m.score2, status: m.status,
    court: m.court, time: m.time_slot, empty: !!m.is_empty,
  }));

  const metaRows = db.prepare('SELECT key, value FROM app_meta').all();
  const meta = {};
  metaRows.forEach(r => { meta[r.key] = r.value; });

  let liveCourts = null;
  try { liveCourts = meta.liveCourts ? JSON.parse(meta.liveCourts) : null; } catch (e) { liveCourts = null; }
  if (!Array.isArray(liveCourts)) liveCourts = Tournament.emptyState().liveCourts;

  return {
    version: 1,
    ...liveStore.read(),
    eventName: (meta.eventName || Tournament.EVENT_NAME).replace(/^BMT MATERIALS PICKLEBALL/, 'BMT MATERIAL PICKLEBALL'),
    teams,
    waiting,
    matches,
    liveCourts, // 7 cấu hình nhập tay; liveScores là luồng tự động độc lập
    tournamentStatus: meta.tournamentStatus || 'setup',
    updatedAt: Number(meta.updatedAt || Date.now()),
  };
}

/* ---------------------------------------------------------------------- */
/* WRITE: STATE JSON -> DB (full replace trong 1 transaction)              */
/* Dữ liệu giải chỉ vài chục đội/VĐV nên replace toàn bộ mỗi lần lưu       */
/* là đơn giản, an toàn và đủ nhanh — tránh phải viết logic diff phức tạp. */
/* ---------------------------------------------------------------------- */

const saveTx = db.transaction((state) => {
  const now = Math.max(Date.now(),(getMetaUpdatedAt()||0)+1);

  db.prepare('DELETE FROM players').run();
  db.prepare('DELETE FROM matches').run();
  db.prepare('DELETE FROM teams').run();

  const insTeam = db.prepare(`INSERT INTO teams (id, level, grp, note, created_at, updated_at)
    VALUES (@id, @level, @grp, @note, @now, @now)`);
  const insPlayer = db.prepare(`INSERT INTO players
    (id, name, gender, phone, email, company, shirt, level, team_id, slot, created_at, updated_at)
    VALUES (@id, @name, @gender, @phone, @email, @company, @shirt, @level, @team_id, @slot, @now, @now)`);
  const insMatch = db.prepare(`INSERT INTO matches
    (id, level, group_a, group_b, team1_id, team2_id, score1, score2, status, court, time_slot, is_empty, updated_at)
    VALUES (@id, @level, @group_a, @group_b, @team1_id, @team2_id, @score1, @score2, @status, @court, @time_slot, @is_empty, @now)`);
  const upsMeta = db.prepare(`INSERT INTO app_meta (key, value) VALUES (@key, @value)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value`);

  (state.teams || []).forEach(t => {
    insTeam.run({ id: t.id, level: t.level || null, grp: t.group || null, note: t.note || '', now });
    if (t.p1) insPlayer.run({ id: t.p1.id || (t.id + '_p1'), ...playerParams(t.p1), team_id: t.id, slot: 1, now });
    if (t.p2) insPlayer.run({ id: t.p2.id || (t.id + '_p2'), ...playerParams(t.p2), team_id: t.id, slot: 2, now });
  });

  (state.waiting || []).forEach(w => {
    insPlayer.run({ id: w.id, ...playerParams(w), team_id: null, slot: null, now });
  });

  (state.matches || []).forEach(m => {
    insMatch.run({
      id: m.id, level: m.level || null, group_a: m.groupA || null, group_b: m.groupB || null,
      team1_id: m.team1 || null, team2_id: m.team2 || null,
      score1: m.score1 === undefined ? null : m.score1,
      score2: m.score2 === undefined ? null : m.score2,
      status: m.status || 'pending',
      court: (m.court !== null && m.court !== undefined) ? String(m.court) : null,
      time_slot: m.time || null, is_empty: m.empty ? 1 : 0,
      now,
    });
  });

  upsMeta.run({ key: 'eventName', value: (state.eventName || Tournament.EVENT_NAME).replace(/^BMT MATERIALS PICKLEBALL/, 'BMT MATERIAL PICKLEBALL') });
  upsMeta.run({ key: 'tournamentStatus', value: state.tournamentStatus || 'setup' });
  upsMeta.run({key:'liveCourts',value:JSON.stringify(state.liveCourts || Tournament.emptyState().liveCourts)});
  upsMeta.run({ key: 'updatedAt', value: String(now) });
});

function playerParams(p) {
  return {
    name: p.name || '?', gender: p.gender || null, phone: p.phone || null,
    email: p.email || null, company: p.company || null, shirt: p.shirt || null,
    level: p.level || null,
  };
}

/* ---------------------------------------------------------------------- */
/* KHOÁ LẠC QUAN (optimistic concurrency) — phòng trường hợp 2 Admin cùng   */
/* sửa dữ liệu gần như đồng thời trên 2 máy khác nhau. Trước đây PUT       */
/* /api/state ghi đè toàn bộ DB vô điều kiện, nên người lưu SAU sẽ xoá mất */
/* thay đổi của người lưu TRƯỚC mà không có cảnh báo gì. Cách sửa: client  */
/* phải gửi kèm `baseUpdatedAt` = thời điểm `updatedAt` mà nó đã tải về    */
/* trước đó. Nếu thời điểm đó KHÁC với `updatedAt` hiện đang lưu trong DB, */
/* nghĩa là đã có người khác lưu đè lên rồi -> từ chối ghi, trả lỗi 409 để */
/* client báo Admin tải lại trang trước khi lưu tiếp, tránh mất dữ liệu    */
/* trong im lặng. Không có khoá thật sự (chỉ 1-2 Admin dùng nội bộ), nhưng */
/* đủ để tránh mất dữ liệu do 2 người ghi đè nhau mà không biết.           */
class SaveConflictError extends Error {
  constructor(serverUpdatedAt) {
    super('Dữ liệu trên server đã bị người khác cập nhật sau khi bạn tải trang. Vui lòng tải lại trang để lấy dữ liệu mới nhất trước khi lưu tiếp.');
    this.name = 'SaveConflictError';
    this.serverUpdatedAt = serverUpdatedAt;
  }
}

function getMetaUpdatedAt() {
  const row = db.prepare(`SELECT value FROM app_meta WHERE key = 'updatedAt'`).get();
  return row ? Number(row.value) : null;
}

const checkedSave = db.transaction((state,baseUpdatedAt)=>{
  if(baseUpdatedAt!==undefined && baseUpdatedAt!==null){
    const current=getMetaUpdatedAt();
    if(current!==null && Number(baseUpdatedAt)!==current) throw new SaveConflictError(current);
  }
  const previous=getFullState();
  saveTx(state);
  liveStore.afterStateSave(previous,state);
  return getFullState();
});
function saveFullState(state,baseUpdatedAt){
  Tournament.validateState(state);
  return checkedSave(state,baseUpdatedAt);
}

function isEmpty() {
  const row = db.prepare('SELECT COUNT(*) AS c FROM teams').get();
  const row2 = db.prepare('SELECT COUNT(*) AS c FROM players').get();
  return row.c === 0 && row2.c === 0;
}

/* ---------------------------------------------------------------------- */
/* USERS / PHÂN QUYỀN — 2 role: 'admin' (toàn quyền) và 'user' (chỉ xem)   */
/* Mật khẩu băm bằng scrypt (module crypto built-in của Node, không cần    */
/* thêm dependency ngoài).                                                */
/* ---------------------------------------------------------------------- */
const crypto = require('crypto');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPasswordHash(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const check = crypto.scryptSync(String(password), salt, 64).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(check, 'hex'));
  } catch (e) {
    return false;
  }
}

function findUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(String(username || '').trim().toLowerCase());
}

function findUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function listUsers() {
  return db.prepare('SELECT id, username, display_name, role, created_at, updated_at FROM users ORDER BY created_at ASC').all();
}

function countAdmins(excludeId) {
  const rows = db.prepare("SELECT id FROM users WHERE role = 'admin'").all();
  return rows.filter(r => r.id !== excludeId).length;
}

function createUser({ username, password, role, displayName }) {
  username = String(username || '').trim().toLowerCase();
  if (!username) throw new Error('Thiếu tên đăng nhập');
  if (!password || String(password).length < 4) throw new Error('Mật khẩu phải có ít nhất 4 ký tự');
  if(!/^[a-z0-9_.-]{1,64}$/.test(username)) throw new Error('Tên đăng nhập chỉ gồm chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang');
  if (findUserByUsername(username)) throw new Error('Tên đăng nhập đã tồn tại');
  const now = Date.now();
  const id = 'usr_' + crypto.randomBytes(6).toString('hex');
  db.prepare(`INSERT INTO users (id, username, display_name, password_hash, role, created_at, updated_at)
              VALUES (@id, @username, @displayName, @passwordHash, @role, @now, @now)`).run({
    id, username, displayName: displayName || username,
    passwordHash: hashPassword(password),
    role: role === 'admin' ? 'admin' : 'user', now,
  });
  return findUserById(id);
}

function updateUserRole(id, role) {
  const u = findUserById(id);
  if (!u) throw new Error('Không tìm thấy người dùng');
  if (u.role === 'admin' && role !== 'admin' && countAdmins(id) === 0) {
    throw new Error('Phải còn ít nhất 1 tài khoản Admin');
  }
  db.prepare('UPDATE users SET role = ?, updated_at = ? WHERE id = ?').run(role === 'admin' ? 'admin' : 'user', Date.now(), id);
  return findUserById(id);
}

function updateUserDisplayName(id, displayName) {
  db.prepare('UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?').run(displayName, Date.now(), id);
  return findUserById(id);
}

function resetUserPassword(id, newPassword) {
  if (!newPassword || String(newPassword).length < 4) throw new Error('Mật khẩu phải có ít nhất 4 ký tự');
  if(!findUserById(id)) throw new Error('Không tìm thấy người dùng');
  db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(hashPassword(newPassword), Date.now(), id);
}

function deleteUser(id) {
  const u = findUserById(id);
  if (!u) return;
  if (u.role === 'admin' && countAdmins(id) === 0) {
    throw new Error('Không thể xóa Admin duy nhất còn lại');
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
}

function seedDefaultUsersIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (count > 0) return;
  createUser({ username: 'admin', password: 'admin123', role: 'admin', displayName: 'Quản trị viên' });
  createUser({ username: 'user', password: 'user123', role: 'user', displayName: 'Người xem' });
  console.log('👤 Đã tạo 2 tài khoản mặc định: admin/admin123 (Admin) và user/user123 (User) — hãy đổi mật khẩu sau khi đăng nhập lần đầu.');
}
seedDefaultUsersIfEmpty();
// Persist a stable version even before the first participant is created.
const initMeta=db.prepare('INSERT OR IGNORE INTO app_meta (key,value) VALUES (?,?)');
initMeta.run('eventName',Tournament.EVENT_NAME);
initMeta.run('tournamentStatus','setup');
initMeta.run('updatedAt',String(Date.now()));
initMeta.run('liveCourts',JSON.stringify(Tournament.emptyState().liveCourts));

module.exports = {
  db, getFullState, saveFullState, isEmpty, getMetaUpdatedAt, SaveConflictError, liveStore,
  hashPassword, verifyPasswordHash, seedDefaultUsersIfEmpty, DB_PATH,
  findUserByUsername, findUserById, listUsers,
  createUser, updateUserRole, updateUserDisplayName, resetUserPassword, deleteUser,
};
