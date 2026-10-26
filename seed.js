/* Initialize metadata for a NEW, EMPTY tournament. Never add sample players. */
const {db,getFullState}=require('./db');
const state=getFullState();
console.log(`Giải đã được khởi tạo: ${state.teams.length} đội, ${state.waiting.length} người chờ, ${state.matches.length} trận. Không nạp dữ liệu mẫu.`);
db.close();
