/* =========================================================================
   RENDER: LIVE MATCHES — bảng theo dõi trực tiếp 7 sân, phong cách eSports.
   Đồng bộ điểm đang nhập từ lịch thi đấu; hỗ trợ cập nhật sân thủ công.
   Bảng bên phải hiển thị đội và kết quả chính thức đã lưu.
   ========================================================================= */

// Ghi nhớ tỷ số lần render trước của từng sân để phát hiệu ứng "bump" đúng
// 1 lần khi tỷ số vừa thay đổi (không bung hiệu ứng ở tất cả các lần vẽ lại).
let LIVE_PREV_SCORES = {};

function liveCourtLabel(c){
  // Dùng chung nhãn hiển thị sân với tab "Thi đấu & Tỷ số" (VIP 1, Sân 3...)
  // nếu hàm đó đã được nạp, để đặt tên sân nhất quán trong toàn bộ app.
  return (typeof courtLabel === 'function') ? courtLabel(c) : ('Sân ' + c);
}

function liveTeamLogoHtml(team){
  const name=team && team.name ? team.name.trim() : '';
  const initial=escapeHtml(name?name[0].toUpperCase():'?');
  if(team && team.logo && Tournament.safeImageUrl(team.logo)){
    return `<div class="live-team-logo"><img src="${escapeHtml(team.logo)}" alt="${escapeHtml(name)}" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span class="fallback" hidden>${initial}</span></div>`;
  }
  return `<div class="live-team-logo"><span class="fallback">${initial}</span></div>`;
}

function liveTeamPlayersHtml(team){
  const players = (team && Array.isArray(team.players)) ? team.players.filter(Boolean) : [];
  if(!players.length) return '';
  return `<div class="live-team-players">${players.map(escapeHtml).join(' &amp; ')}</div>`;
}

function liveCourtCardHtml(c){
  const status = c.status || 'waiting';
  const teamA = c.teamA || {name:'',logo:'',players:[]};
  const teamB = c.teamB || {name:'',logo:'',players:[]};
  const hasTeams = !!(teamA.name || teamB.name);

  const prev = LIVE_PREV_SCORES[c.court] || {a:null,b:null};
  const bumpA = status==='live' && prev.a!==null && c.scoreA!==null && c.scoreA!==prev.a;
  const bumpB = status==='live' && prev.b!==null && c.scoreB!==null && c.scoreB!==prev.b;
  LIVE_PREV_SCORES[c.court] = { a: c.scoreA, b: c.scoreB };

  const statusBadge = status==='live'
    ? `<span class="live-status-badge st-live"><span class="b-dot"></span> LIVE</span>`
    : status==='finished'
      ? `<span class="live-status-badge st-finished">🏁 FINISHED</span>`
      : `<span class="live-status-badge st-waiting">⏳ WAITING</span>`;

  let scoreArea;
  if(status==='waiting'){
    scoreArea = `<div class="live-state-text">${hasTeams ? '🔥 Đang khởi động' : '⏱️ Coming Soon'}</div>`;
  }else{
    const sa = c.scoreA===null || c.scoreA===undefined ? 0 : c.scoreA;
    const sb = c.scoreB===null || c.scoreB===undefined ? 0 : c.scoreB;
    scoreArea = `
      <div class="live-score ${bumpA?'bump-a':''} ${bumpB?'bump-b':''}">
        <span>${sa}</span><span class="live-score-sep">–</span><span>${sb}</span>
      </div>
      ${status==='finished' ? `<div class="live-state-text">Trận đã kết thúc</div>` : ''}
    `;
  }

  return `
  <div class="live-card ${status==='live'?'is-live':''} ${status==='finished'?'is-finished':''}" data-court="${c.court}">
    <div class="live-shine"></div>
    <div class="live-card-top">
      <div class="live-court-name"><span class="ic">🏟️</span> Court ${c.court}<span style="color:var(--live-muted);font-weight:600;font-size:11px;">${escapeHtml(liveCourtLabel(c.court))}</span></div>
      ${statusBadge}
    </div>
    ${c.source==='match' ? `<div class="live-source-tag">${AppUX.icon('bolt')} Đồng bộ từ lịch thi đấu</div>` : ''}
    <div class="live-matchup">
      <div class="live-team">
        ${liveTeamLogoHtml(teamA)}
        <div class="live-team-name">${escapeHtml(teamA.name || 'TBD')}</div>
        ${liveTeamPlayersHtml(teamA)}
      </div>
      <div class="live-vs">VS</div>
      <div class="live-team">
        ${liveTeamLogoHtml(teamB)}
        <div class="live-team-name">${escapeHtml(teamB.name || 'TBD')}</div>
        ${liveTeamPlayersHtml(teamB)}
      </div>
    </div>
    <div class="live-score-row">
      ${scoreArea}
      ${c.note ? `<div class="live-note">${escapeHtml(c.note)}</div>` : ''}
    </div>
    ${isAdmin() ? `<div class="live-card-foot">${c.matchId ? `<button class="live-score-btn" onclick="openScoringMatch('${c.matchId}')">${AppUX.icon('matches')} Nhập điểm</button>` : ''}<button class="live-edit-btn" onclick="openLiveCourtModal(${c.court})">${c.source==='match'?'Nhập tay':'✏️ Cập nhật'}</button></div>` : ''}
  </div>`;
}

function liveParticlesHtml(){
  let out = '';
  for(let i=0;i<14;i++){
    const left = (i*37)%100;
    const delay = (i*1.7)%12;
    const dur = 10 + (i%5)*2.4;
    out += `<span style="left:${left}%; animation-delay:${delay}s; animation-duration:${dur}s;"></span>`;
  }
  return out;
}

// Keep the spectator's selection when live updates re-render the page.
let LIVE_SIDEBAR_TAB = 'results';
function selectLiveSidebar(tab){
  LIVE_SIDEBAR_TAB = tab === 'teams' ? 'teams' : 'results';
  render();
  document.getElementById('live-sidebar-'+LIVE_SIDEBAR_TAB)?.focus({preventScroll:true});
}
function liveSidebarKey(event){
  if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
    event.preventDefault();
    selectLiveSidebar(event.key==='Home'?'results':event.key==='End'?'teams':LIVE_SIDEBAR_TAB==='results'?'teams':'results');
  }
}
function liveSidebarHtml(courts){
  const teams = STATE.teams || [];
  const completed = (STATE.matches || []).filter(m=>!m.empty && m.team1 && m.team2 && m.score1!=null && m.score2!=null && !Tournament.scoreError(m.score1,m.score2));
  const teamById = new Map(teams.map(t=>[t.id,t]));
  const name = t => t ? [t.p1?.name,t.p2?.name].filter(Boolean).join(' & ') || t.id : 'Đội chưa xác định';
  const resultTeam = (t,score,winner) => `<div class="live-result-team ${winner?'is-winner':''}"><span>${escapeHtml(name(t))}</span><strong>${score}</strong></div>`;
  const results = completed.slice().reverse().map(m=>`<article class="live-result-item"><div class="live-result-meta">${escapeHtml(liveCourtLabel(m.court))} · Level ${escapeHtml(m.level||'')}<span>Đã kết thúc</span></div>${resultTeam(teamById.get(m.team1),m.score1,m.score1>m.score2)}${resultTeam(teamById.get(m.team2),m.score2,m.score2>m.score1)}<small>${escapeHtml(m.time||'')}</small></article>`).join('');
  const teamRows = teams.map(t=>{
    const played = completed.filter(m=>m.team1===t.id || m.team2===t.id);
    const wins = played.filter(m=>m.team1===t.id ? m.score1>m.score2 : m.score2>m.score1).length;
    const active = courts.some(c=>c.status==='live' && c.matchId && (STATE.matches||[]).some(m=>m.id===c.matchId && (m.team1===t.id||m.team2===t.id)));
    return `<article class="live-directory-team"><div><strong>${escapeHtml(name(t))}</strong><small>Bảng ${escapeHtml(t.group||'—')} · Level ${escapeHtml(t.level||'—')}</small></div>${active?'<span class="live-directory-active">Đang đấu</span>':''}<p>${played.length} trận đã đấu <span>· ${wins} thắng · ${played.length-wins} thua</span></p></article>`;
  }).join('');
  return `<aside class="live-sidebar" aria-label="Đội thi đấu và kết quả"><div class="live-sidebar-heading"><span>KHU VỰC KHÁN GIẢ</span><h3>Toàn cảnh giải đấu</h3></div><div class="live-sidebar-tabs" role="tablist" aria-label="Tra cứu giải đấu">${[['results','Đã kết thúc',completed.length],['teams','Các đội',teams.length]].map(([id,label,count])=>`<button id="live-sidebar-${id}" role="tab" aria-selected="${LIVE_SIDEBAR_TAB===id}" aria-controls="live-sidebar-panel" tabindex="${LIVE_SIDEBAR_TAB===id?0:-1}" onclick="selectLiveSidebar('${id}')" onkeydown="liveSidebarKey(event)">${label}<span>${count}</span></button>`).join('')}</div><div class="live-sidebar-panel" id="live-sidebar-panel" role="tabpanel" aria-labelledby="live-sidebar-${LIVE_SIDEBAR_TAB}" tabindex="0">${LIVE_SIDEBAR_TAB==='results'?(results||'<div class="live-sidebar-empty">Chưa có trận kết thúc.<small>Kết quả xuất hiện khi BTC lưu tỷ số hợp lệ.</small></div>'):(teamRows||'<div class="live-sidebar-empty">Chưa có đội thi đấu.<small>Các đội sẽ xuất hiện sau khi được đăng ký.</small></div>')}</div><p class="live-sidebar-note">Kết quả chính thức theo lịch đấu · Tự động cập nhật</p></aside>`;
}

RENDERERS.live = function(){
  const courts = Tournament.displayLiveCourts(STATE).sort((a,b)=>a.court-b.court);
  return `
  <div class="live-wrap">
    <div class="live-particles">${liveParticlesHtml()}</div>
    <div class="live-hero">
      <h2><span class="dot"></span> LIVE MATCHES</h2>
      <p class="sub">7 sân · Tự động theo trận đang nhập điểm</p>
      <p class="live-sync-caption">Điểm trực tiếp cập nhật ngay khi BTC nhập. Kết quả xếp hạng chỉ tính sau khi lưu tỷ số hợp lệ.</p>
      <div class="live-topline">
        <span class="live-badge-big">🔴 LIVE</span>
        <span class="live-clock" id="liveClockDisplay">--:--<span class="blink">:</span>--</span>
      </div>
    </div>
    <div class="live-dashboard"><div class="live-grid">
      ${courts.map(liveCourtCardHtml).join('')}
    </div>${liveSidebarHtml(courts)}</div>
  </div>`;
};

function updateLiveClockDisplay(){
  const el = document.getElementById('liveClockDisplay');
  if(!el) return;
  const now = new Date();
  const hh = String(now.getHours()).padStart(2,'0');
  const mm = String(now.getMinutes()).padStart(2,'0');
  const ss = String(now.getSeconds()).padStart(2,'0');
  el.innerHTML = `${hh}<span class="blink">:</span>${mm}<span class="blink">:</span>${ss}`;
}
// 1 interval duy nhất cho toàn app — chỉ có tác dụng khi phần tử #liveClockDisplay
// đang tồn tại trên DOM (tức đang ở tab LIVE MATCHES), còn lại tự bỏ qua.
setInterval(updateLiveClockDisplay, 1000);

function after_live_render(){
  updateLiveClockDisplay();
}

/* ---------------------------------------------------------------------- */
/* MODAL — Admin nhập tay thông tin từng sân                              */
/* ---------------------------------------------------------------------- */
function getLiveCourt(courtNum){
  ensureLiveCourts(STATE);
  return Tournament.displayLiveCourts(STATE).find(x=>x.court===courtNum) || defaultLiveCourt(courtNum);
}

/* ---------------------------------------------------------------------- */
/* QUICK-FILL — lấy tên đội, logo, VĐV từ dữ liệu đội/lịch đấu có sẵn,     */
/* để Admin không phải gõ tay từng trường khi cập nhật LIVE MATCHES.       */
/* ---------------------------------------------------------------------- */

// Tên hiển thị "thuần" của đội (không kèm chữ cái bảng), dùng cho ô "Tên đội".
function liveGroupPlainName(g){
  return (typeof GROUP_INFO !== 'undefined' && GROUP_INFO[g]) ? GROUP_INFO[g].name : (g || '');
}

// Danh sách <option> các đội CÓ LỊCH THI ĐẤU tại đúng sân này (dựa theo
// STATE.matches, giống cách bộ lọc "Sân" ở tab Thi đấu đang lọc đội theo sân),
// gộp nhóm theo bảng A-F, dùng để đổ nhanh tên đội/logo/VĐV cho MỘT bên.
// Nếu vì lý do gì đó sân này chưa có lịch gán đội, sẽ fallback về TẤT CẢ đội.
function liveTeamSelectOptionsHtml(courtNum){
  const teams = STATE.teams || [];
  if(!teams.length) return '<option value="">-- Không có dữ liệu đội --</option>';

  const idsOnThisCourt = new Set();
  (STATE.matches || []).forEach(m=>{
    if(m.empty || String(m.court) !== String(courtNum)) return;
    if(m.team1) idsOnThisCourt.add(m.team1);
    if(m.team2) idsOnThisCourt.add(m.team2);
  });
  let pool = idsOnThisCourt.size ? teams.filter(t => idsOnThisCourt.has(t.id)) : teams;
  const usingAllFallback = !idsOnThisCourt.size;

  const byGroup = {};
  pool.forEach(t=>{ (byGroup[t.group] = byGroup[t.group] || []).push(t); });
  let out = usingAllFallback
    ? '<option value="">-- Chọn đội có sẵn (chưa rõ lịch sân này) --</option>'
    : '<option value="">-- Chọn đội có sẵn (đấu tại sân này) --</option>';
  (typeof GROUPS !== 'undefined' ? GROUPS : Object.keys(byGroup)).forEach(g=>{
    const list = (byGroup[g] || []).slice().sort((x,y)=>{
      const order = (typeof LEVELS !== 'undefined') ? LEVELS : ['A','B','C','D','E'];
      return order.indexOf(x.level) - order.indexOf(y.level);
    });
    if(!list.length) return;
    out += `<optgroup label="${escapeHtml(liveGroupPlainName(g))} (Bảng ${escapeHtml(g)})">`;
    list.forEach(t=>{
      const p1 = (t.p1 && t.p1.name) ? t.p1.name : '?';
      const p2 = (t.p2 && t.p2.name) ? t.p2.name : '?';
      out += `<option value="${escapeHtml(t.id)}">Level ${escapeHtml(t.level||'')}: ${escapeHtml(p1)} &amp; ${escapeHtml(p2)}</option>`;
    });
    out += '</optgroup>';
  });
  return out;
}

// Danh sách <option> các trận đã có LỊCH SẴN đúng sân này (STATE.matches),
// dùng để đổ nhanh CẢ HAI đội cùng lúc + ghi chú (lượt đấu) trong một cú click.
function liveMatchSelectOptionsHtml(courtNum){
  const list = (STATE.matches || []).filter(m => String(m.court) === String(courtNum) && !m.empty && m.team1 && m.team2);
  if(!list.length) return '';
  let out = '<option value="">-- Chọn trận theo lịch (' + liveCourtLabel(courtNum) + ') --</option>';
  list.forEach(m=>{
    const t1 = getTeam(m.team1), t2 = getTeam(m.team2);
    const n1 = t1 ? liveGroupPlainName(t1.group) : '?';
    const n2 = t2 ? liveGroupPlainName(t2.group) : '?';
    out += `<option value="${escapeHtml(m.id)}">${escapeHtml((m.time || '') + ' · Lv ' + (m.level||'') + ': ' + n1 + ' vs ' + n2)}</option>`;
  });
  return out;
}

// Đổ tên đội/logo/VĐV cho MỘT bên (side = 'a' hoặc 'b') từ id đội đã chọn.
function fillLiveTeamFromSelect(side, teamId){
  if(!teamId) return;
  const t = (STATE.teams || []).find(x => x.id === teamId);
  if(!t) return;
  const nameEl = document.getElementById('live_' + side + '_name');
  const logoEl = document.getElementById('live_' + side + '_logo');
  const p1El = document.getElementById('live_' + side + '_p1');
  const p2El = document.getElementById('live_' + side + '_p2');
  if(nameEl) nameEl.value = liveGroupPlainName(t.group);
  if(logoEl) logoEl.value = (typeof groupLogo === 'function') ? groupLogo(t.group) : '';
  if(p1El) p1El.value = (t.p1 && t.p1.name) ? t.p1.name : '';
  if(p2El) p2El.value = (t.p2 && t.p2.name) ? t.p2.name : '';
}

// Đổ CẢ HAI đội + ghi chú (lượt đấu) từ một trận có sẵn trong lịch của sân này.
function fillLiveMatchFromSelect(matchId){
  if(!matchId) return;
  const m = (STATE.matches || []).find(x => x.id === matchId);
  if(!m) return;
  fillLiveTeamFromSelect('a', m.team1);
  fillLiveTeamFromSelect('b', m.team2);
  const selA = document.getElementById('live_pick_team_a'); if(selA) selA.value = m.team1;
  const selB = document.getElementById('live_pick_team_b'); if(selB) selB.value = m.team2;
  const noteEl = document.getElementById('live_note');
  if(noteEl) noteEl.value = m.time || noteEl.value;
}

function openLiveCourtModal(courtNum){
  if(!isAdmin()) return;
  const c = getLiveCourt(courtNum);
  const teamA = c.teamA || {name:'',logo:'',players:[]};
  const teamB = c.teamB || {name:'',logo:'',players:[]};
  const st = c.status || 'waiting';

  openModal(`
    <div class="modal-head"><h3>🔴 Cập nhật Sân ${courtNum}</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <input type="hidden" id="live_linked_match" value="${escapeHtml(c.matchId||'')}">
      ${c.matchId ? `<p class="help-text">Sân đang tự đồng bộ từ lịch. Lưu form này sẽ chuyển sang nhập tay; lần nhập điểm tiếp theo sẽ bật lại đồng bộ.</p>` : ''}
      <div class="form-row"><label>Trạng thái</label>
        <div class="live-status-pick" id="liveStatusPick">
          <button type="button" data-st="waiting" class="${st==='waiting'?'active':''}">⏳ Waiting</button>
          <button type="button" data-st="live" class="${st==='live'?'active':''}">🔴 Live</button>
          <button type="button" data-st="finished" class="${st==='finished'?'active':''}">🏁 Finished</button>
        </div>
        <input type="hidden" id="live_status" value="${st}">
      </div>
      ${liveMatchSelectOptionsHtml(courtNum) ? `
      <div class="form-row">
        <label>⚡ Lấy nhanh từ lịch đấu (${liveCourtLabel(courtNum)})</label>
        <select class="input" id="live_pick_match" onchange="fillLiveMatchFromSelect(this.value)">
          ${liveMatchSelectOptionsHtml(courtNum)}
        </select>
      </div>` : ''}
      <div class="live-modal-teams">
        <fieldset><legend>Đội A</legend>
          <div class="form-row" style="display:flex;gap:8px;align-items:flex-end;">
            <div style="flex:1;">
              <label>Chọn đội có sẵn</label>
              <select class="input" id="live_pick_team_a" onchange="fillLiveTeamFromSelect('a', this.value)">
                ${liveTeamSelectOptionsHtml(courtNum)}
              </select>
            </div>
            <button type="button" class="btn btn-danger btn-sm" title="Xóa Đội A để nhập lại" onclick="clearLiveSide('a')">🗑️ Xóa</button>
          </div>
          <div class="form-row"><label>Tên đội</label><input class="input" id="live_a_name" value="${escapeHtml(teamA.name||'')}"></div>
          <div class="form-row"><label>Logo (URL ảnh)</label><input class="input" id="live_a_logo" value="${escapeHtml(teamA.logo||'')}" placeholder="https://..."></div>
          <div class="form-row"><label>VĐV 1</label><input class="input" id="live_a_p1" value="${escapeHtml((teamA.players||[])[0]||'')}"></div>
          <div class="form-row"><label>VĐV 2 (bỏ trống nếu đánh đơn)</label><input class="input" id="live_a_p2" value="${escapeHtml((teamA.players||[])[1]||'')}"></div>
        </fieldset>
        <fieldset><legend>Đội B</legend>
          <div class="form-row" style="display:flex;gap:8px;align-items:flex-end;">
            <div style="flex:1;">
              <label>Chọn đội có sẵn</label>
              <select class="input" id="live_pick_team_b" onchange="fillLiveTeamFromSelect('b', this.value)">
                ${liveTeamSelectOptionsHtml(courtNum)}
              </select>
            </div>
            <button type="button" class="btn btn-danger btn-sm" title="Xóa Đội B để nhập lại" onclick="clearLiveSide('b')">🗑️ Xóa</button>
          </div>
          <div class="form-row"><label>Tên đội</label><input class="input" id="live_b_name" value="${escapeHtml(teamB.name||'')}"></div>
          <div class="form-row"><label>Logo (URL ảnh)</label><input class="input" id="live_b_logo" value="${escapeHtml(teamB.logo||'')}" placeholder="https://..."></div>
          <div class="form-row"><label>VĐV 1</label><input class="input" id="live_b_p1" value="${escapeHtml((teamB.players||[])[0]||'')}"></div>
          <div class="form-row"><label>VĐV 2 (bỏ trống nếu đánh đơn)</label><input class="input" id="live_b_p2" value="${escapeHtml((teamB.players||[])[1]||'')}"></div>
        </fieldset>
      </div>
      <div class="form-grid-2">
        <div class="form-row"><label>Tỷ số Đội A</label><input class="input" type="number" min="0" id="live_score_a" value="${c.scoreA===null||c.scoreA===undefined?'':c.scoreA}"></div>
        <div class="form-row"><label>Tỷ số Đội B</label><input class="input" type="number" min="0" id="live_score_b" value="${c.scoreB===null||c.scoreB===undefined?'':c.scoreB}"></div>
      </div>
      <div class="form-row"><label>Ghi chú / khung giờ (tuỳ chọn)</label><input class="input" id="live_note" value="${escapeHtml(c.note||'')}" placeholder="VD: 8:00 - 8:20 · Bảng A"></div>
    </div>
    <div class="modal-foot" style="justify-content:space-between;flex-wrap:wrap;row-gap:8px;">
      <button class="btn btn-danger btn-sm" title="Xóa hết dữ liệu trận này để nhập lại từ đầu" onclick="clearLiveCourtForm(${courtNum})">🗑️ Xóa hết &amp; nhập lại</button>
      <div style="display:flex;gap:8px;">
        <button class="btn" onclick="closeModal()">Hủy</button>
        <button class="btn btn-primary" onclick="saveLiveCourt(${courtNum})">Lưu</button>
      </div>
    </div>
  `);

  document.querySelectorAll('#liveStatusPick button').forEach(b=>{
    b.addEventListener('click', ()=>{
      document.querySelectorAll('#liveStatusPick button').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      document.getElementById('live_status').value = b.dataset.st;
    });
  });
}

// Xóa trắng MỘT bên (side = 'a' hoặc 'b') để Admin nhập lại tay hoặc chọn đội khác.
function clearLiveSide(side){
  const nameEl = document.getElementById('live_' + side + '_name');
  const logoEl = document.getElementById('live_' + side + '_logo');
  const p1El = document.getElementById('live_' + side + '_p1');
  const p2El = document.getElementById('live_' + side + '_p2');
  const pickEl = document.getElementById('live_pick_team_' + side);
  if(nameEl) nameEl.value = '';
  if(logoEl) logoEl.value = '';
  if(p1El) p1El.value = '';
  if(p2El) p2El.value = '';
  if(pickEl) pickEl.value = '';
  if(nameEl) nameEl.focus();
}

// Xóa TOÀN BỘ dữ liệu đang nhập trong modal (2 đội, tỷ số, ghi chú, các ô
// chọn nhanh) và đưa trạng thái về "Waiting", để Admin nhập lại từ đầu mà
// không cần đóng/mở lại modal. Chưa lưu xuống STATE — chỉ bấm "Lưu" mới ghi.
function clearLiveCourtForm(courtNum){
  if(!confirm('Xóa hết thông tin đang nhập cho Sân ' + courtNum + ' để nhập lại từ đầu?')) return;
  clearLiveSide('a');
  clearLiveSide('b');
  const scoreA = document.getElementById('live_score_a'); if(scoreA) scoreA.value = '';
  const scoreB = document.getElementById('live_score_b'); if(scoreB) scoreB.value = '';
  const note = document.getElementById('live_note'); if(note) note.value = '';
  const matchPick = document.getElementById('live_pick_match'); if(matchPick) matchPick.value = '';
  document.querySelectorAll('#liveStatusPick button').forEach(b=>{
    b.classList.toggle('active', b.dataset.st === 'waiting');
  });
  const statusEl = document.getElementById('live_status'); if(statusEl) statusEl.value = 'waiting';
  showToast('Đã xóa dữ liệu form, sẵn sàng nhập lại', 'success');
}

async function saveLiveCourt(courtNum){
  if(!isAdmin()) return;
  ensureLiveCourts(STATE);
  let idx = STATE.liveCourts.findIndex(x=>x.court===courtNum);
  if(idx===-1){ STATE.liveCourts.push(defaultLiveCourt(courtNum)); idx = STATE.liveCourts.length-1; }

  const liveForm=document.getElementById('live_status');
  const originallyLinked=document.getElementById('live_linked_match')?.value||'';
  const status = liveForm.value;
  const aName = document.getElementById('live_a_name').value.trim();
  const aLogo = document.getElementById('live_a_logo').value.trim();
  const aP1 = document.getElementById('live_a_p1').value.trim();
  const aP2 = document.getElementById('live_a_p2').value.trim();
  const bName = document.getElementById('live_b_name').value.trim();
  const bLogo = document.getElementById('live_b_logo').value.trim();
  const bP1 = document.getElementById('live_b_p1').value.trim();
  const bP2 = document.getElementById('live_b_p2').value.trim();
  const sAraw = document.getElementById('live_score_a').value;
  const sBraw = document.getElementById('live_score_b').value;
  const note = document.getElementById('live_note').value.trim();

  if(!Tournament.safeImageUrl(aLogo)||!Tournament.safeImageUrl(bLogo)){showToast('Logo phải là URL http/https hoặc đường dẫn ảnh trong ứng dụng','error');return;}
  for(const score of [sAraw,sBraw]) if(score!=='' && (!Number.isInteger(Number(score))||Number(score)<0||Number(score)>999)){showToast('Tỷ số LIVE phải là số nguyên 0–999','error');return;}

  const queuedMatch=USE_API?await settleLiveCourt(courtNum):'';
  STATE.liveCourts[idx] = {
    court: courtNum,
    status: ['waiting','live','finished'].includes(status) ? status : 'waiting',
    teamA: { name: aName, logo: aLogo, players: [aP1,aP2].filter(Boolean) },
    teamB: { name: bName, logo: bLogo, players: [bP1,bP2].filter(Boolean) },
    scoreA: sAraw==='' ? null : Number(sAraw),
    scoreB: sBraw==='' ? null : Number(sBraw),
    note
  };
  saveState();
  if(USE_API){
    if(!await flushState())return;
    const linked=queuedMatch||originallyLinked;
    try{const res=await fetch(API_BASE+'/api/live-scores/'+courtNum,{method:'DELETE',headers:{'Content-Type':'application/json',...authHeaders()},body:JSON.stringify({matchId:linked})});const data=await res.json();applyLiveData(data);if(!res.ok)throw new Error(data.error||'Không chuyển được sang nhập tay');}catch(error){showToast(error.message,'error');return;}
  }else{applyLiveData({liveScores:(STATE.liveScores||[]).filter(row=>Number(row.court)!==Number(courtNum)),liveUpdatedAt:Date.now()});}
  if(document.getElementById('live_status')===liveForm)closeModal();
  render();
  showToast('Đã cập nhật Sân ' + courtNum, 'success');
}