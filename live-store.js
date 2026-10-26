/* Per-court broadcast scores. Draft points never change official match results. */
const Tournament=require('./public/tournament');
function createLiveStore(db){
  // No FK cascade: official full-state saves replace match rows in one transaction.
  db.exec(`CREATE TABLE IF NOT EXISTS live_scores (
    court INTEGER PRIMARY KEY CHECK(court BETWEEN 1 AND 7),
    match_id TEXT NOT NULL, team1_id TEXT NOT NULL, team2_id TEXT NOT NULL,
    score_a INTEGER, score_b INTEGER, status TEXT NOT NULL,
    revision INTEGER NOT NULL, updated_by TEXT
  )`);
  db.prepare("INSERT OR IGNORE INTO app_meta (key,value) VALUES ('liveUpdatedAt','0')").run();
  function revision(){return Number(db.prepare("SELECT value FROM app_meta WHERE key='liveUpdatedAt'").get()?.value||0);}
  function advance(){const value=Math.max(Date.now(),revision()+1);db.prepare("INSERT INTO app_meta(key,value) VALUES ('liveUpdatedAt',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(String(value));return value;}
  function read(){return {liveUpdatedAt:revision(),liveScores:db.prepare('SELECT * FROM live_scores ORDER BY court').all().map(r=>({court:r.court,matchId:r.match_id,team1:r.team1_id,team2:r.team2_id,scoreA:r.score_a,scoreB:r.score_b,status:r.status,revision:r.revision}))};}
  const insert=db.prepare(`INSERT INTO live_scores(court,match_id,team1_id,team2_id,score_a,score_b,status,revision,updated_by)
    VALUES (@court,@matchId,@team1,@team2,@scoreA,@scoreB,@status,@revision,@actor)
    ON CONFLICT(court) DO UPDATE SET match_id=excluded.match_id,team1_id=excluded.team1_id,team2_id=excluded.team2_id,score_a=excluded.score_a,score_b=excluded.score_b,status=excluded.status,revision=excluded.revision,updated_by=excluded.updated_by`);
  function write(match,scoreA,scoreB,status,actor){insert.run({court:Number(match.court),matchId:match.id,team1:match.team1_id??match.team1,team2:match.team2_id??match.team2,scoreA,scoreB,status,revision:advance(),actor:actor||null});}
  function conflict(message){const error=new Error(message);error.status=409;error.code='LIVE_CONFLICT';throw error;}
  const publish=db.transaction((court,body,actor)=>{
    if(!Number.isInteger(court)||court<1||court>7)throw new Error('Sân không hợp lệ');
    if(!body||typeof body.matchId!=='string')throw new Error('Thiếu trận cần trực tiếp');
    const match=db.prepare('SELECT * FROM matches WHERE id=?').get(body.matchId);
    if(!match||match.is_empty||!match.team1_id||!match.team2_id||Number(match.court)!==court)throw new Error('Trận không thuộc sân này hoặc chưa đủ đội');
    if(db.prepare("SELECT value FROM app_meta WHERE key='tournamentStatus'").get()?.value!=='started')throw new Error('Giải chưa bắt đầu thi đấu');
    for(const key of ['scoreA','scoreB','baseScore1','baseScore2'])if(body[key]!==null&&(!Number.isInteger(body[key])||body[key]<0||body[key]>999))throw new Error('Tỷ số trực tiếp phải là số nguyên 0–999 hoặc để trống');
    if(body.team1!==match.team1_id||body.team2!==match.team2_id)conflict('Cặp đội của trận đã thay đổi. Bản nhập cũ không được phát cho cặp mới.');
    if(body.baseScore1!==match.score1||body.baseScore2!==match.score2)conflict('Kết quả trận đã thay đổi. Bản nhập trực tiếp cũ không được ghi đè kết quả mới.');
    const finished=match.score1!==null&&match.score2!==null&&body.scoreA===match.score1&&body.scoreB===match.score2;
    write(match,body.scoreA,body.scoreB,finished?'finished':'live',actor);
    return read();
  });
  const detach=db.transaction((court,expectedMatchId)=>{
    const existing=db.prepare('SELECT match_id FROM live_scores WHERE court=?').get(court);
    if(existing&&existing.match_id!==expectedMatchId)conflict('Sân đã chuyển sang trận khác. Vui lòng kiểm tra lại trước khi nhập tay.');
    if(existing){db.prepare('DELETE FROM live_scores WHERE court=?').run(court);advance();}
    return read();
  });
  function afterStateSave(previous,next){
    const rows=db.prepare('SELECT * FROM live_scores').all();let removed=false;
    for(const row of rows){
      const match=next.matches.find(m=>m.id===row.match_id&&!m.empty);
      if(next.tournamentStatus!=='started'||!match||Number(match.court)!==row.court||match.team1!==row.team1_id||match.team2!==row.team2_id){db.prepare('DELETE FROM live_scores WHERE court=?').run(row.court);removed=true;}
    }
    if(removed)advance();
    if(next.tournamentStatus!=='started')return;
    for(const match of next.matches){
      if(match.empty||!match.court)continue;
      const old=previous.matches.find(m=>m.id===match.id);
      if(!old||old.score1===match.score1&&old.score2===match.score2)continue;
      const active=db.prepare('SELECT match_id FROM live_scores WHERE court=?').get(Number(match.court));
      if(active&&active.match_id!==match.id)continue; // Historical corrections must not replace a different active match.
      if(match.score1!=null&&match.score2!=null)write(match,match.score1,match.score2,'finished',null);
      else if(active){db.prepare('DELETE FROM live_scores WHERE court=?').run(Number(match.court));advance();}
    }
  }
  return {read,publish,detach,afterStateSave};
}
module.exports={createLiveStore};
