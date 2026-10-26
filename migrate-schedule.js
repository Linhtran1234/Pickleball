/* =========================================================================
   migrate-schedule.js — Đồng bộ lại bảng `matches` trong database theo đúng
   lịch đấu hiện hành (schedule.js).

   BỐI CẢNH BUG: database cũ được seed từ trước khi lịch đấu đổi từ "chia
   theo khung giờ cố định" (vd "08:00 - 08:20", 84 trận, có ô nghỉ) sang
   "chia theo Lượt đấu" (vd "Lượt 1"..."Lượt 11", 75 trận, không ô nghỉ).
   Vì vậy filter "Lượt N" trên UI so sánh với giá trị `time_slot` cũ trong DB
   không bao giờ khớp => luôn ra 0 kết quả.

   Script này build lại toàn bộ 75 dòng trong bảng `matches` theo đúng
   schedule.js + đội đang được xếp bảng/cấp độ hiện tại trong DB (giữ
   NGUYÊN bảng teams/players/users). Nếu 1 trận đã từng có tỷ số VÀ vẫn
   đúng cặp đội (team1/team2, không phân biệt thứ tự) so với lịch mới,
   script sẽ giữ lại tỷ số đó thay vì reset về null — an toàn để chạy lại
   nhiều lần (idempotent) và an toàn kể cả khi giải đã thi đấu 1 phần.

   Cách chạy:  node migrate-schedule.js
   ========================================================================= */

const { db, getFullState } = require('./db');
const { FIXED_SCHEDULE } = require('./public/schedule.js');

function main() {
  const state = getFullState();
  const teams = state.teams;

  function teamSlot(group, level) {
    return teams.find(t => t.group === group && t.level === level);
  }

  // Gom tỷ số cũ theo cặp đội (không phân biệt thứ tự team1/team2) để có
  // thể "bắt lại" tỷ số nếu trận đó vẫn tồn tại y hệt trong lịch mới, dù
  // key court+time đã đổi định dạng.
  const oldScoreByTeamPair = {};
  (state.matches || []).forEach(m => {
    if (m.empty || m.score1 === null || m.score2 === null) return;
    if (!m.team1 || !m.team2) return;
    const key = [m.team1, m.team2].sort().join('|');
    oldScoreByTeamPair[key] = { team1:m.team1, score1: m.score1, score2: m.score2, status: m.status };
  });

  const now = Date.now();
  const newMatches = FIXED_SCHEDULE.map((slot, idx) => {
    const teamA = teamSlot(slot.groupA, slot.level);
    const teamB = teamSlot(slot.groupB, slot.levelB || slot.level);
    const id = 'M' + String(idx + 1).padStart(3, '0');

    if (!teamA || !teamB) {
      return { id, court: slot.court, time_slot: slot.time, is_empty: 1 };
    }

    const pairKey = [teamA.id, teamB.id].sort().join('|');
    const preserved = oldScoreByTeamPair[pairKey];

    return {
      id,
      level: slot.level,
      group_a: slot.groupA,
      group_b: slot.groupB,
      team1_id: teamA.id,
      team2_id: teamB.id,
      score1: preserved ? (preserved.team1===teamA.id?preserved.score1:preserved.score2) : null,
      score2: preserved ? (preserved.team1===teamA.id?preserved.score2:preserved.score1) : null,
      status: preserved ? preserved.status : 'pending',
      court: String(slot.court),
      time_slot: slot.time,
      is_empty: 0,
    };
  });

  const preservedCount = newMatches.filter(m => m.score1 !== undefined && m.score1 !== null).length;

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM matches').run();
    const ins = db.prepare(`INSERT INTO matches
      (id, level, group_a, group_b, team1_id, team2_id, score1, score2, status, court, time_slot, is_empty, updated_at)
      VALUES (@id, @level, @group_a, @group_b, @team1_id, @team2_id, @score1, @score2, @status, @court, @time_slot, @is_empty, @now)`);
    newMatches.forEach(m => {
      ins.run({
        id: m.id,
        level: m.level || null,
        group_a: m.group_a || null,
        group_b: m.group_b || null,
        team1_id: m.team1_id || null,
        team2_id: m.team2_id || null,
        score1: m.score1 === undefined ? null : m.score1,
        score2: m.score2 === undefined ? null : m.score2,
        status: m.status || 'pending',
        court: m.court,
        time_slot: m.time_slot,
        is_empty: m.is_empty,
        now,
      });
    });
    db.prepare(`INSERT INTO app_meta (key, value) VALUES ('updatedAt', @now)
                ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run({ now: String(now) });
  });

  tx();

  console.log(`✅ Đã build lại ${newMatches.length} trận theo lịch hiện hành (schedule.js).`);
  console.log(`   Giữ nguyên bảng teams/players/users. Giữ lại ${preservedCount} tỷ số đã nhập trước đó (nếu có).`);
}

main();