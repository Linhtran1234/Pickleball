/* =========================================================================
   auth.js — Quản lý phiên đăng nhập (token) + middleware phân quyền.
   Token lưu trong bộ nhớ server (Map). Đơn giản, không cần thêm thư viện
   express-session/jwt — đủ dùng cho 1 tiến trình server nội bộ.
   Token mất khi restart server (mọi người phải đăng nhập lại) — chấp nhận
   được cho quy mô 1 giải đấu nội bộ công ty.
   ========================================================================= */
const crypto = require('crypto');
const { findUserById } = require('./db');

const SESSIONS = new Map(); // token -> { userId, username, role, displayName, createdAt }
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 giờ

function createSession(user) {
  const token = crypto.randomBytes(24).toString('hex');
  SESSIONS.set(token, {
    userId: user.id,
    username: user.username,
    role: user.role,
    displayName: user.display_name || user.username,
    createdAt: Date.now(),
  });
  return token;
}

function destroySession(token) {
  SESSIONS.delete(token);
}

function destroyUserSessions(userId,exceptToken){
  for(const [token,session] of SESSIONS) if(session.userId===userId && token!==exceptToken) SESSIONS.delete(token);
}

function getSession(token) {
  const s = SESSIONS.get(token);
  if (!s) return null;
  if (Date.now() - s.createdAt > SESSION_TTL_MS) {
    SESSIONS.delete(token);
    return null;
  }
  const user=findUserById(s.userId);
  if(!user){SESSIONS.delete(token);return null;}
  return {...s,role:user.role,displayName:user.display_name||user.username};
}

function tokenFromReq(req) {
  const header = req.headers['authorization'] || '';
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (m) return m[1].trim();
  return null;
}

/* Bắt buộc đã đăng nhập (Admin hoặc User đều qua được) */
function authRequired(req, res, next) {
  const token = tokenFromReq(req);
  const session = token ? getSession(token) : null;
  if (!session) {
    return res.status(401).json({ error: 'Chưa đăng nhập hoặc phiên đã hết hạn' });
  }
  req.user = session;
  req.token = token;
  next();
}

/* Bắt buộc là Admin — dùng cho mọi thao tác ghi/sửa/xóa dữ liệu */
function adminRequired(req, res, next) {
  authRequired(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Chỉ Admin mới có quyền thực hiện thao tác này' });
    }
    next();
  });
}

module.exports = { createSession, destroySession, destroyUserSessions, getSession, authRequired, adminRequired };
