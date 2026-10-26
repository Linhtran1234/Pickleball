/* =========================================================================
   RENDER: MATCHES (Thi đấu & Tỷ số)
   ========================================================================= */

let matchFilter = { level:'all', group:'all', status:'all', court:'all', time:'all', team:'all' };
const COURTS = [1,2,3,4,5,6,7];
// Tên hiển thị của từng sân (giá trị court trong dữ liệu vẫn giữ nguyên 1-7,
// chỉ đổi nhãn hiển thị ra màn hình).
const COURT_LABELS = {1:'VIP 1', 2:'VIP 1a', 3:'VIP 2', 4:'Sân 3', 5:'Sân 4', 6:'Sân 5', 7:'Sân 6'};
function courtLabel(c){ return COURT_LABELS[c] || ('Sân '+c); }
// "Lượt" = số thứ tự trận TĂNG DẦN trên chính sân đó (mỗi sân/cặp sân giờ
// phục vụ riêng 1 cấp độ — xem schedule.js). Sân có 2 cấp độ dùng chung 2 sân
// (Level 1, Level 2) có tối đa 8 Lượt/sân; sân chỉ 1 cấp độ (Level 3/4/5) có
// đủ 15 Lượt (15 trận vòng tròn tuần tự trên cùng 1 sân).
const TIME_SLOTS = Array.from({length:15}, (_,i)=>`Lượt ${i+1}`);
function roundNum(t){ const m = /(\d+)/.exec(String(t||'')); return m ? Number(m[1]) : 999; }
let LAST_SCORED_MATCH = null; // id trận vừa lưu tỷ số — dùng để phát hiệu ứng 1 lần

RENDERERS.matches = function(){
  if(!STATE.matches.length){
    return `
    <div class="card">
      <div class="empty-state">
        <div class="ic">🏓</div>
        <p>Chưa có lịch thi đấu. Hãy xếp các đội vào bảng trước, sau đó tạo lịch đấu.</p>
        ${isAdmin() ? `<button class="btn btn-primary" onclick="switchTab('board')">Xếp đội vào bảng</button>` : ''}
      </div>
    </div>`;
  }

  let matches = STATE.matches.slice();
  if(matchFilter.level!=='all'){
    matches = matches.filter(m=>m.level===matchFilter.level);
  }
  if(matchFilter.court!=='all'){
    matches = matches.filter(m=>String(m.court)===String(matchFilter.court));
  }
  if(matchFilter.group!=='all'){
    matches = matches.filter(m=>!m.empty && (m.groupA===matchFilter.group || m.groupB===matchFilter.group));
  }
  if(matchFilter.team!=='all'){
    matches = matches.filter(m=>!m.empty && (m.team1===matchFilter.team || m.team2===matchFilter.team));
  }
  if(matchFilter.time!=='all'){
    matches = matches.filter(m=>m.time===matchFilter.time);
  }
  if(matchFilter.status==='done'){
    matches = matches.filter(m=>!m.empty && m.score1!==null && m.score2!==null);
  }else if(matchFilter.status==='pending'){
    matches = matches.filter(m=>m.empty || m.score1===null || m.score2===null);
  }
  // Sắp theo lượt đấu trước rồi mới theo Sân — để danh sách luôn đọc theo
  // đúng trình tự thời gian thi đấu thực tế (đặc biệt khi lọc theo 1 đội,
  // các trận của đội đó sẽ hiện theo đúng thứ tự trước-sau, không bị xáo
  // trộn theo Sân).
  matches.sort((a,b)=> (roundNum(a.time)-roundNum(b.time)) || (Number(a.court)||0)-(Number(b.court)||0));

  // STT (số thứ tự trận) — đánh số 1..15 riêng cho từng Cấp độ, theo đúng
  // thứ tự Lượt → Sân, để khớp 100% với cột STT trong file Excel BTC gửi
  // (mỗi Level là 1 sheet riêng, đánh số 01→15 độc lập).
  const matchSttMap = {};
  LEVELS.forEach(lvl=>{
    STATE.matches.filter(m=>!m.empty && m.level===lvl)
      .sort((a,b)=> (roundNum(a.time)-roundNum(b.time)) || (Number(a.court)||0)-(Number(b.court)||0))
      .forEach((m,i)=>{ matchSttMap[m.id] = i+1; });
  });

  const realMatches = STATE.matches.filter(m=>!m.empty);
  const doneCount = realMatches.filter(m=>m.score1!==null && m.score2!==null).length;
  const activeFilterParts = [];
  if(matchFilter.level!=='all') activeFilterParts.push(levelDisplayName(matchFilter.level));
  if(matchFilter.court!=='all') activeFilterParts.push(courtLabel(matchFilter.court));
  if(matchFilter.group!=='all') activeFilterParts.push(groupFullName(matchFilter.group));
  if(matchFilter.team!=='all'){
    const ft = getTeam(matchFilter.team);
    activeFilterParts.push(`Đội ${matchFilter.team}${ft?' ('+teamDisplayName(ft)+')':''}`);
  }
  if(matchFilter.time!=='all') activeFilterParts.push(matchFilter.time);
  if(matchFilter.status==='pending') activeFilterParts.push('chưa đấu');
  if(matchFilter.status==='done') activeFilterParts.push('đã có tỷ số');
  const viewingFiltered = activeFilterParts.length>0;

  return `
  <div class="card" style="margin-bottom:16px;">
    <div class="section-title">
      <div><h2>Thi đấu &amp; cập nhật tỷ số trực tiếp</h2><p>Lịch cố định 7 sân, không chia theo giờ · ${doneCount}/${realMatches.length} trận đã có tỷ số</p></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${isAdmin() ? `<button class="btn btn-sm" onclick="if(confirm('Tạo lại lịch thi đấu theo bảng hiện tại? Tỷ số, Sân và lượt đấu của các cặp đấu trùng sẽ được giữ nguyên.')){regenerateMatches();render();showToast('Đã làm mới lịch thi đấu','success');}">↻ Làm mới lịch đấu</button>` : ''}
        ${isAdmin() ? `<button class="btn btn-primary btn-sm" onclick="exportMatchesToExcel()">📊 Xuất Excel</button>` : ''}
      </div>
    </div>
    ${(isAdmin() && !isTournamentStarted()) ? `<div class="help-text" style="margin:-6px 0 12px;color:var(--red);">🔒 Giải chưa bắt đầu thi đấu — vào tab "Chia bảng" để bấm "Bắt đầu thi đấu" trước khi nhập tỷ số.</div>` : ''}
    <div class="filter-panel">
      <div class="filter-row">
        <span class="filter-label">🏆 Cấp độ</span>
        <div class="filter-body">
          <div class="pill-group">
            <button class="pill ${matchFilter.level==='all'?'active':''}" data-mlevel="all">Tất cả</button>
            ${LEVELS.map(l=>`<button class="pill ${matchFilter.level===l?'active':''}" data-mlevel="${l}" style="${matchFilter.level===l?`background:${LEVEL_INFO[l].color};border-color:${LEVEL_INFO[l].color};color:#fff;`:''}">${levelDisplayName(l)}</button>`).join('')}
          </div>
        </div>
      </div>
      <div class="filter-row">
        <span class="filter-label">🔎 Đội</span>
        <div class="filter-body">
          <select id="matchTeamFilter" class="input" style="min-width:260px;max-width:100%;">
            <option value="all">Tất cả các đội</option>
            ${GROUPS.map(g=>{
              const teamsInGroup = STATE.teams.filter(t=>t.group===g).sort((a,b)=>LEVELS.indexOf(a.level)-LEVELS.indexOf(b.level));
              if(!teamsInGroup.length) return '';
              return `<optgroup label="${groupFullName(g)}">
                ${teamsInGroup.map(t=>`<option value="${t.id}" ${matchFilter.team===t.id?'selected':''}>${t.level}. ${escapeHtml(teamDisplayName(t))}</option>`).join('')}
              </optgroup>`;
            }).join('')}
          </select>
        </div>
      </div>
      <div class="filter-row">
        <span class="filter-label">🏟️ Sân</span>
        <div class="filter-body">
          <div class="pill-group">
            <button class="pill ${matchFilter.court==='all'?'active':''}" data-mcourt="all">Tất cả</button>
            ${COURTS.map(c=>`<button class="pill ${String(matchFilter.court)===String(c)?'active':''}" data-mcourt="${c}">${courtLabel(c)}</button>`).join('')}
          </div>
        </div>
      </div>
      <div class="filter-row">
        <span class="filter-label">🗂️ Bảng</span>
        <div class="filter-body">
          <div class="pill-group pill-group-teams">
            <button class="pill ${matchFilter.group==='all'?'active':''}" data-mgroup="all">Tất cả</button>
            ${GROUPS.map(g=>`<button class="pill pill-team ${matchFilter.group===g?'active':''}" data-mgroup="${g}">${groupLogoImg(g,36)} ${escapeHtml(groupName(g))}</button>`).join('')}
          </div>
        </div>
      </div>
      <div class="filter-row">
        <span class="filter-label">🔁 Lượt đấu</span>
        <div class="filter-body">
          <div class="pill-group">
            <button class="pill ${matchFilter.time==='all'?'active':''}" data-mtime="all">Tất cả</button>
            ${TIME_SLOTS.map(t=>`<button class="pill ${matchFilter.time===t?'active':''}" data-mtime="${t}">${t}</button>`).join('')}
          </div>
        </div>
      </div>
      <div class="filter-row">
        <span class="filter-label">✅ Trạng thái</span>
        <div class="filter-body">
          <div class="pill-group">
            <button class="pill ${matchFilter.status==='all'?'active':''}" data-mstatus="all">Tất cả</button>
            <button class="pill ${matchFilter.status==='pending'?'active':''}" data-mstatus="pending">Chưa đấu</button>
            <button class="pill ${matchFilter.status==='done'?'active':''}" data-mstatus="done">Đã có tỷ số</button>
          </div>
        </div>
      </div>
    </div>
    ${viewingFiltered ? `<p class="muted small" style="margin:-6px 0 14px;">📋 Đang xem các trận có ${activeFilterParts.join(' · ')} — ${matches.length} trận.</p>` : ''}

    <div class="match-list">
      ${matches.length ? matches.map(m=>matchCardHtml(m, matchSttMap[m.id])).join('') : `<div class="empty-state"><div class="ic">🔍</div>Không có trận đấu phù hợp bộ lọc</div>`}
    </div>
  </div>
  `;
};

function matchCardHtml(m, stt){
  if(m.empty){
    return `
    <div class="match-card" style="opacity:.6;">
      <div class="match-card-head">
        <span class="status-dot"></span>
        <span class="lvl-badge match-lvl" style="background:#adb5bd;">${courtLabel(m.court)}</span>
        <span class="match-round">${escapeHtml(m.time||'')}</span>
      </div>
      <div class="match-empty-msg">😴 Trận trống — VĐV nghỉ ngơi</div>
    </div>`;
  }
  const t1 = getTeam(m.team1), t2 = getTeam(m.team2);
  if(!t1 || !t2) return '';
  const done = m.score1!==null && m.score2!==null;
  const win1 = done && Number(m.score1) > Number(m.score2);
  const win2 = done && Number(m.score2) > Number(m.score1);
  const justScored = LAST_SCORED_MATCH === m.id;
  const canEdit = isAdmin() && isTournamentStarted();
  const draft=liveDraftForMatch(m.id);
  const inputScore1=draft?draft.scoreA:m.score1,inputScore2=draft?draft.scoreB:m.score2;
  const scoreHtml = canEdit ? `
    <input type="number" min="0" value="${inputScore1!=null?inputScore1:''}" id="score1_${m.id}" class="${justScored?'just-bumped':''}" placeholder="-">
    <span class="match-vs">:</span>
    <input type="number" min="0" value="${inputScore2!=null?inputScore2:''}" id="score2_${m.id}" class="${justScored?'just-bumped':''}" placeholder="-">
  ` : `
    <span class="score-readonly">${m.score1!==null?m.score1:'-'}</span>
    <span class="match-vs">:</span>
    <span class="score-readonly">${m.score2!==null?m.score2:'-'}</span>
  `;
  return `
  <div class="match-card ${justScored?'just-scored':''}" data-match-id="${m.id}">
    <div class="match-card-head">
      <span class="status-dot ${done?'done':''}"></span>
      ${stt ? `<span class="match-stt" title="STT trận (theo ${levelDisplayName(m.level)})">#${String(stt).padStart(2,'0')}</span>` : ''}
      <span class="lvl-badge match-lvl" style="background:color-mix(in srgb, ${LEVEL_INFO[m.level].color} 14%, #fff);color:${LEVEL_INFO[m.level].color};border:1.5px solid color-mix(in srgb, ${LEVEL_INFO[m.level].color} 30%, #fff);">${levelDisplayName(m.level)} · ${courtLabel(m.court)}</span>
      <span class="match-round">${escapeHtml(m.time||'')}</span>
    </div>
    ${canEdit ? `<div class="match-live-toolbar"><span class="match-live-hint">${draft?'Đang phát trên LIVE · '+courtLabel(m.court):'Nhập điểm để phát trực tiếp trên LIVE'}</span><button class="btn btn-sm" onclick="queueLiveMatch('${m.id}');flushLiveDraft(${Number(m.court)});switchTab('live')">${AppUX.icon('live')} Xem trên LIVE</button></div>` : ''}
    <div class="match-body">
      <div class="match-team match-team-1">
        ${groupLogoImg(m.groupA,36)}
        <div class="match-team-info">
          <div class="nm" style="${win1?'color:var(--green);':''}">${win1?'<span class="crown">👑</span> ':''}${escapeHtml(teamDisplayName(t1))}</div>
          <div class="sub">Level ${m.level} · ${escapeHtml(groupName(m.groupA))}</div>
        </div>
      </div>
      <div class="match-score">
        ${scoreHtml}
        ${canEdit ? `<button class="btn-save-score ${done?'is-saved':''}" title="Lưu tỷ số" onclick="saveMatchScore('${m.id}')">${done?'✓':'💾'}</button>` : ''}
      </div>
      <div class="match-team match-team-2">
        <div class="match-team-info">
          <div class="nm" style="${win2?'color:var(--green);':''}">${escapeHtml(teamDisplayName(t2))} ${win2?'<span class="crown">👑</span>':''}</div>
          <div class="sub">Level ${m.level} · ${escapeHtml(groupName(m.groupB))}</div>
        </div>
        ${groupLogoImg(m.groupB,36)}
      </div>
    </div>
  </div>
  `;
}

function after_matches_render(){
  const teamFilterEl = document.getElementById('matchTeamFilter');
  if(teamFilterEl){
    teamFilterEl.addEventListener('change', (e)=>{ matchFilter.team = e.target.value; render(); });
  }
  document.querySelectorAll('[data-mlevel]').forEach(b=>{
    b.addEventListener('click', ()=>{ matchFilter.level = b.dataset.mlevel; render(); });
  });
  document.querySelectorAll('[data-mcourt]').forEach(b=>{
    b.addEventListener('click', ()=>{ matchFilter.court = b.dataset.mcourt; render(); });
  });
  document.querySelectorAll('[data-mgroup]').forEach(b=>{
    b.addEventListener('click', ()=>{ matchFilter.group = b.dataset.mgroup; render(); });
  });
  document.querySelectorAll('[data-mtime]').forEach(b=>{
    b.addEventListener('click', ()=>{ matchFilter.time = b.dataset.mtime; render(); });
  });
  document.querySelectorAll('[data-mstatus]').forEach(b=>{
    b.addEventListener('click', ()=>{ matchFilter.status = b.dataset.mstatus; render(); });
  });
  // enter key to save
  document.querySelectorAll('.match-score input').forEach(inp=>{
    const liveMatchId=inp.id.replace(/^score[12]_/, '');
    inp.addEventListener('focus',()=>{const m=STATE.matches.find(m=>m.id===liveMatchId);if(m&&m.score1==null&&m.score2==null)queueLiveMatch(liveMatchId);});
    inp.addEventListener('input',()=>queueLiveMatch(liveMatchId));
    inp.addEventListener('keydown', (e)=>{
      if(e.key==='Enter'){
        // LƯU Ý (bug đã sửa 2026-07-24): id của trận có thể tự chứa dấu "_"
        // (VD sinh bởi uid('M') -> "M_43wpfbsy4p2"), nên KHÔNG được lấy
        // mid bằng inp.id.split('_')[1] (chỉ lấy phần trước dấu "_" ĐẦU
        // TIÊN của phần match id, cắt cụt id thật) — trước đây khiến
        // saveMatchScore(mid) nhận 1 id sai, tìm không ra trận
        // (STATE.matches.find trả về undefined) rồi "return" ngay, im lặng
        // KHÔNG lưu tỷ số và KHÔNG báo lỗi gì cho người dùng — trọng tài
        // gõ điểm xong bấm Enter tưởng đã lưu nhưng thực ra mất trắng.
        // Chỉ bỏ đúng tiền tố "score1_"/"score2_", giữ nguyên toàn bộ phần
        // còn lại (dù có chứa bao nhiêu dấu "_" cũng không sao).
        const mid = inp.id.replace(/^score[12]_/, '');
        saveMatchScore(mid);
      }
    });
  });
  // hiệu ứng confetti nhỏ cho trận vừa lưu tỷ số (chỉ chạy 1 lần)
  if(LAST_SCORED_MATCH){
    const card = document.querySelector(`.match-card[data-match-id="${LAST_SCORED_MATCH}"]`);
    if(card) spawnConfetti(card);
    LAST_SCORED_MATCH = null;
  }
}

function captureUnsavedScoreInputs(exceptMatchId){
  // render() vẽ lại toàn bộ danh sách trận từ STATE, nên các ô tỷ số đang gõ dở
  // (chưa bấm ✓) ở NHỮNG TRẬN KHÁC sẽ bị mất. Chụp lại trước khi render để khôi phục sau.
  const snapshot = {};
  document.querySelectorAll('.match-score input').forEach(inp=>{
    if(inp.id === 'score1_'+exceptMatchId || inp.id === 'score2_'+exceptMatchId) return;
    snapshot[inp.id] = inp.value;
  });
  return snapshot;
}

function restoreUnsavedScoreInputs(snapshot){
  Object.keys(snapshot).forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.value = snapshot[id];
  });
}

function saveMatchScore(matchId){
  if(!isAdmin()) return; // phòng vệ thêm — role User không có nút này nhưng chặn luôn cho chắc
  if(!isTournamentStarted()){ showToast('Giải chưa bắt đầu thi đấu — vào tab Chia bảng để bấm "Bắt đầu thi đấu".','error'); return; }
  const m = STATE.matches.find(x=>x.id===matchId);
  if(!m) return;
  const v1 = document.getElementById('score1_'+matchId).value;
  const v2 = document.getElementById('score2_'+matchId).value;
  const unsaved = captureUnsavedScoreInputs(matchId);

  if(v1==='' && v2===''){
    // Cả 2 ô đều rỗng -> người dùng chủ động xoá tỷ số, cho phép
    m.score1 = null; m.score2 = null; m.status = 'pending';
    publishOfficialLive(m);
    saveState();
    render();
    restoreUnsavedScoreInputs(unsaved);
    showToast('Đã xoá tỷ số','success');
    return;
  }

  if(v1==='' || v2===''){
    // Chỉ điền 1 bên -> KHÔNG được âm thầm xoá cả 2, báo lỗi và giữ nguyên dữ liệu cũ
    showToast('Vui lòng nhập tỷ số cho cả 2 đội','error');
    return;
  }

  const s1 = Number(v1), s2 = Number(v2);
  if(Number.isNaN(s1) || Number.isNaN(s2) || s1<0 || s2<0 || !Number.isInteger(s1) || !Number.isInteger(s2)){
    showToast('Tỷ số không hợp lệ — vui lòng nhập số nguyên không âm','error');
    return;
  }
  const error=Tournament.scoreError(s1,s2);
  if(error){showToast(error,'error');return;}

  m.score1 = s1; m.score2 = s2; m.status = 'done';
  publishOfficialLive(m);
  LAST_SCORED_MATCH = matchId;
  saveState();
  render();
  restoreUnsavedScoreInputs(unsaved);
  showToast('Đã lưu tỷ số 🏓','success');
}

/* =========================================================================
   RENDER: RANKING (Xếp hạng)
   ========================================================================= */

let rankingView = 'group'; // 'group' | 'team'
let PREV_GROUP_ORDER = null; // thứ tự Bảng ở lần xem "Xếp hạng" trước đó — để phát hiện đổi hạng
let PREV_TEAM_ORDER = null;  // thứ tự Đội ở lần xem trước đó

function rankDeltaVsPrev(prevOrder, id, idx){
  if(!prevOrder) return 0;
  const prevIdx = prevOrder.indexOf(id);
  if(prevIdx===-1) return 0;
  return prevIdx - idx; // dương = tăng hạng (số thứ tự nhỏ đi), âm = tụt hạng
}
function rankMoveBadge(delta){
  if(delta>0) return `<span class="rank-move up" title="Tăng ${delta} hạng">▲${delta}</span>`;
  if(delta<0) return `<span class="rank-move down" title="Tụt ${Math.abs(delta)} hạng">▼${Math.abs(delta)}</span>`;
  return '';
}

RENDERERS.ranking = function(){
  const groupRank = rankGroups();
  const teamStats = computeTeamStats();
  const top3 = groupRank.slice(0,3);

  const teamRanking = STATE.teams.slice().map(t=>({team:t, stats: teamStats[t.id]}))
    .sort((a,b)=>{
      if(b.stats.points !== a.stats.points) return b.stats.points - a.stats.points;
      if(b.stats.wins !== a.stats.wins) return b.stats.wins - a.stats.wins;
      return b.stats.diff - a.stats.diff;
    });

  const groupRowsHtml = groupRank.map((g,i)=>{
    const delta = rankDeltaVsPrev(PREV_GROUP_ORDER, g.group, i);
    return `
      <tr data-flip-key="g_${g.group}" class="${delta!==0?'rank-changed':''}">
        <td><span class="rank-num ${i===0?'top1':i===1?'top2':i===2?'top3':''}">${i+1}</span></td>
        <td>${groupChip(g.group, 52)} ${rankMoveBadge(delta)}</td>
        <td><b style="font-size:15px;">${g.totalPoints}</b></td>
        <td>${g.totalWins}</td>
        <td>${g.diff>0?'+':''}${g.diff}</td>
        <td>${g.pf}</td>
        <td>${g.played}</td>
        <td>${g.teamsFilled}/5</td>
      </tr>
    `;
  }).join('');

  const teamRowsHtml = teamRanking.map((r,i)=>{
    const delta = rankDeltaVsPrev(PREV_TEAM_ORDER, r.team.id, i);
    return `
      <tr data-flip-key="t_${r.team.id}" class="${delta!==0?'rank-changed':''}">
        <td><span class="rank-num ${i===0?'top1':i===1?'top2':i===2?'top3':''}">${i+1}</span></td>
        <td><b>${escapeHtml(teamDisplayName(r.team))}</b> ${rankMoveBadge(delta)}</td>
        <td><span class="lvl-badge" style="background:${LEVEL_INFO[r.team.level].color}">${r.team.level}</span></td>
        <td>${r.team.group?groupLogoImg(r.team.group,44):'<span class="muted">—</span>'}</td>
        <td>${r.stats.played}</td>
        <td>${r.stats.wins}-${r.stats.draws}-${r.stats.losses}</td>
        <td>${r.stats.diff>0?'+':''}${r.stats.diff}</td>
        <td><b>${r.stats.points}</b></td>
      </tr>
    `;
  }).join('');

  // Lưu lại thứ tự hiện tại để lần render "Xếp hạng" tiếp theo so sánh & phát hiệu ứng đổi hạng
  PREV_GROUP_ORDER = groupRank.map(g=>g.group);
  PREV_TEAM_ORDER = teamRanking.map(r=>r.team.id);

  return `
  <div class="card" style="margin-bottom:16px;">
    <div class="section-title">
      <div><h2>Xếp hạng chung toàn giải</h2><p>Cộng điểm của 5 đội trong mỗi bảng để xếp hạng bảng · Giải thưởng dành cho bảng có tổng điểm cao nhất</p></div>
      <div class="pill-group">
        <button class="pill ${rankingView==='group'?'active':''}" data-rview="group">Theo bảng</button>
        <button class="pill ${rankingView==='team'?'active':''}" data-rview="team">Theo đội</button>
      </div>
    </div>

    ${rankingView==='group' ? `
      ${top3.length ? `<div class="podium">
        ${top3[1] ? podiumItem(top3[1],2) : ''}
        ${top3[0] ? podiumItem(top3[0],1) : ''}
        ${top3[2] ? podiumItem(top3[2],3) : ''}
      </div>` : ''}
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Hạng</th><th>Bảng</th><th>Tổng điểm</th><th>Tổng thắng</th><th>Hiệu số</th><th>Điểm ghi được</th><th>Trận đã đấu</th><th>Đội đủ</th>
          </tr></thead>
          <tbody>
            ${groupRowsHtml || '<tr><td colspan="8"><div class="empty-state">Chưa có dữ liệu xếp hạng</div></td></tr>'}
          </tbody>
        </table>
      </div>
      <div class="help-text" style="margin-top:12px;">Tiêu chí xếp hạng khi bằng điểm: (1) Tổng số trận thắng &nbsp;→&nbsp; (2) Hiệu số điểm thắng-thua &nbsp;→&nbsp; (3) Tổng điểm ghi được &nbsp;→&nbsp; (4) Kết quả đối đầu &nbsp;→&nbsp; (5) Bốc thăm.</div>
    ` : `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Hạng</th><th>Đội</th><th>Level</th><th>Bảng</th><th>Trận</th><th>T-H-B</th><th>Hiệu số</th><th>Điểm</th></tr></thead>
          <tbody>
            ${teamRowsHtml || '<tr><td colspan="8"><div class="empty-state">Chưa có đội thi đấu</div></td></tr>'}
          </tbody>
        </table>
      </div>
    `}
  </div>
  `;
};

function after_ranking_render(){
  document.querySelectorAll('[data-rview]').forEach(b=>{
    b.addEventListener('click', ()=>{ rankingView = b.dataset.rview; render(); });
  });
}

/* =========================================================================
   RENDER: RULES (Thể thức)
   ========================================================================= */

RENDERERS.rules = function(){
  return `
  <div class="grid grid-3">
    <div class="card" style="grid-column:span 2;">
      <div class="section-title"><div><h2>Thể thức giải đấu</h2><p>Pickleball Đôi Hỗn Hợp — 30 cặp — Đăng ký cá nhân</p></div></div>

      <div class="rule-block">
        <div class="rule-num">1</div>
        <div><h4>Đăng ký</h4><p>Vận động viên tự ghép cặp theo đội (2 người), hoặc đăng ký lẻ một mình và được Ban tổ chức ghép cặp ngẫu nhiên.</p></div>
      </div>
      <div class="rule-block">
        <div class="rule-num">2</div>
        <div><h4>Ghép cặp theo level</h4><p>VĐV đăng ký lẻ được ghép với người cùng level theo thứ tự đăng ký. Người lẻ còn lại chờ Ban tổ chức ghép thủ công.</p></div>
      </div>
      <div class="rule-block">
        <div class="rule-num">3</div>
        <div><h4>Phân cấp trình độ</h4>
        <p>Mỗi đội được xếp vào 1 trong 5 cấp độ dựa trên trình độ trung bình của 2 thành viên:</p>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;">
          ${LEVELS.map(l=>`<span class="lvl-badge" style="background:${LEVEL_INFO[l].color}">${l} — ${LEVEL_INFO[l].label.split('·')[1].trim()}</span>`).join('')}
        </div>
        </div>
      </div>
      <div class="rule-block">
        <div class="rule-num">4</div>
        <div><h4>Chia bảng</h4><p>30 đội được chia vào 6 bảng (A→F), mỗi bảng gồm đủ 5 cấp độ (A, B, C, D, E) — mỗi bảng đại diện như một "đội tuyển" gồm 5 cặp đấu.</p></div>
      </div>
      <div class="rule-block">
        <div class="rule-num">5</div>
        <div><h4>Thi đấu</h4><p>Các đội thi đấu vòng tròn với đội cùng cấp độ ở 5 bảng còn lại (ví dụ: A1 gặp đủ B1, C1, D1, E1, F1). Mỗi trận thi đấu 1 set, chạm 11 điểm, thắng cách biệt tối thiểu 2 điểm (max 15 điểm).</p></div>
      </div>
      <div class="rule-block">
        <div class="rule-num">6</div>
        <div><h4>Tính điểm</h4><p>Thắng: 1 điểm · Thua: 0 điểm (không có hòa). Cộng điểm của cả 5 đội trong cùng một bảng để ra tổng điểm xếp hạng của bảng đó.</p></div>
      </div>
      <div class="rule-block">
        <div class="rule-num">7</div>
        <div><h4>Xếp hạng chung</h4><p>Sau khi kết thúc tất cả các trận đấu, cộng điểm của 6 bảng để xếp hạng chung toàn giải. Bằng điểm thì xét lần lượt: tổng số trận thắng → hiệu số điểm thắng-thua → tổng điểm ghi được → kết quả đối đầu → bốc thăm.</p></div>
      </div>
      <div class="rule-block">
        <div class="rule-num">8</div>
        <div><h4>Lịch thi đấu</h4><p>Mỗi cấp độ thi đấu trên (các) sân riêng: Level 1 (A) — Sân VIP 1 &amp; VIP 1A; Level 2 (B) — Sân VIP 2 &amp; Sân 6; Level 3 (C) — Sân 5; Level 4 (D) — Sân 4; Level 5 (E) — Sân 3. Mỗi cấp độ đấu vòng tròn đủ 15 trận (6 đội, mỗi đội 5 trận). Với Level 1 &amp; 2 (2 sân/cấp độ), các trận được chia luân phiên giữa 2 sân theo đúng thứ tự thi đấu. Không gắn giờ cụ thể — mỗi sân thi đấu tuần tự các trận theo tốc độ riêng. Xem chi tiết ở tab "Thi đấu &amp; Tỷ số" — lọc theo Sân hoặc theo Lượt đấu để xem đúng lịch.</p></div>
      </div>
    </div>

    <div class="card">
      <div class="section-title"><div><h2 style="font-size:15px;">Giải thưởng</h2></div></div>
      <p class="muted small">Giải thưởng dành cho bảng có tổng điểm cao nhất toàn giải.</p>
      <div class="podium" style="margin-top:16px;">
        <div class="podium-item p2"><div class="cup">🥈</div><div class="bar">Nhì</div></div>
        <div class="podium-item p1"><div class="cup">🥇</div><div class="bar">Nhất</div></div>
        <div class="podium-item p3"><div class="cup">🥉</div><div class="bar">Ba</div></div>
      </div>
      <hr style="border:none;border-top:1px solid var(--border);margin:18px 0;">
      <div class="section-title" style="margin-bottom:10px;"><div><h2 style="font-size:14px;">30 cặp × 6 bảng</h2></div></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Bảng</th><th>A</th><th>B</th><th>C</th><th>D</th><th>E</th></tr></thead>
          <tbody>
            ${GROUPS.map(g=>`<tr><td>${groupLogoImg(g,48)}</td>${LEVELS.map((l,idx)=>`<td>${g}${idx+1}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  `;
};