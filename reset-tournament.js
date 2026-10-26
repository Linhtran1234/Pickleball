/* Explicit competition reset. Authentication accounts are NEVER deleted. */
if(!process.argv.includes('--confirm')){
  console.error('Lệnh này xóa VĐV, đội, lịch, tỷ số và LIVE; GIỮ NGUYÊN toàn bộ tài khoản/mật khẩu. Chạy npm run reset -- --confirm nếu muốn tạo lại giải.');
  process.exit(1);
}
const {db,saveFullState}=require('./db');
const Tournament=require('./public/tournament');
db.transaction(()=>{
  db.prepare('DELETE FROM players').run();db.prepare('DELETE FROM matches').run();db.prepare('DELETE FROM teams').run();
  // Preserve user records and keep the revision monotonic to reject stale clients.
  saveFullState(Tournament.emptyState());
})();
db.pragma('wal_checkpoint(TRUNCATE)');db.exec('VACUUM');db.close();
console.log('Đã tạo lại giải trống. Tất cả tài khoản Admin/User và mật khẩu được giữ nguyên.');
