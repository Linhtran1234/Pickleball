/* =========================================================================
   RENDER: TEAMS (Đội thi đấu)
   ========================================================================= */

let teamsSearch = '';
let teamsLevelFilter = 'all';

RENDERERS.teams = function(){
  const canEdit = isAdmin();
  let teams = STATE.teams.slice().sort((a,b)=> (a.group||'zz'+a.level).localeCompare(b.group||'zz'+b.level) || a.level.localeCompare(b.level));
  if(teamsLevelFilter!=='all'){
    teams = teams.filter(t=>t.level===teamsLevelFilter);
  }
  if(teamsSearch.trim()){
    const q = AppUX.searchText(teamsSearch.trim());
    teams = teams.filter(t => AppUX.searchText(teamDisplayName(t)).includes(q) || AppUX.searchText(t.p1.company).includes(q) || AppUX.searchText(t.p2.company).includes(q) || AppUX.searchText(t.id).includes(q));
  }

  return `
  ${canEdit ? `
  <div class="card" style="margin-bottom:18px;">
    <div class="section-title">
      <div><h2>Ghép cặp từ danh sách chờ</h2><p>Bấm "Tự động ghép theo Level" để ghép các VĐV cùng Level thành đội · Còn ${STATE.waiting.length} người đang chờ</p></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-yellow" ${STATE.waiting.length<2?'disabled':''} onclick="autoPairByLevel()" title="Tự động ghép 2 người cùng Level (A-A, B-B, C-C...) trong danh sách chờ thành đội. Ai đã có đội rồi thì bỏ qua.">🎯 Tự động ghép theo Level</button>
      </div>
    </div>
    ${STATE.waiting.length ? `
    <div class="chip-list">
      ${STATE.waiting.map(w=>`
        <div class="wchip">
          <span class="lvl-badge" style="background:${LEVEL_INFO[w.level]?LEVEL_INFO[w.level].color:'#999'};min-width:18px;height:18px;padding:0;justify-content:center;">${w.level||'?'}</span>
          ${escapeHtml(w.name)} ${w.company?`<span class="muted small">· ${escapeHtml(w.company)}</span>`:''}
        </div>
      `).join('')}
    </div>` : `<div class="empty-state" style="padding:20px;"><div class="ic">🎉</div>Không còn ai chờ ghép cặp</div>`}
  </div>` : ''}

  <div class="card">
    <div class="section-title">
      <div><h2>Danh sách đội thi đấu</h2><p>${STATE.teams.length} đội · ${STATE.teams.filter(t=>t.group).length} đã xếp bảng</p></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <input class="input" placeholder="Tìm đội..." value="${escapeHtml(teamsSearch)}" id="teamSearchInput" style="width:180px;">
        ${canEdit ? `<button class="btn" onclick="openSwapTeamsModal()">🔀 Hoán đổi VĐV giữa 2 đội</button>` : ''}
        ${canEdit ? `<button class="btn btn-yellow" onclick="openAddTeamModal()">+ Thêm đội thủ công</button>` : ''}
      </div>
    </div>
    <div class="filter-row" style="margin-bottom:14px;">
      <span class="filter-label">🏆 Cấp độ</span>
      <div class="filter-body">
        <div class="pill-group">
          <button class="pill ${teamsLevelFilter==='all'?'active':''}" data-tlevel="all">Tất cả</button>
          ${LEVELS.map(l=>`<button class="pill ${teamsLevelFilter===l?'active':''}" data-tlevel="${l}" style="${teamsLevelFilter===l?`background:${LEVEL_INFO[l].color};border-color:${LEVEL_INFO[l].color};color:#fff;`:''}">${levelDisplayName(l)}</button>`).join('')}
        </div>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Mã đội</th><th>Vận động viên 1</th><th>Vận động viên 2</th><th>Level</th><th>Bảng</th><th>Thành tích</th>${canEdit?'<th></th>':''}</tr></thead>
        <tbody>
          ${teams.length ? teams.map(t=>{
            const stats = computeTeamStats()[t.id];
            return `
            <tr>
              <td class="small muted">${t.id}</td>
              <td><b>${escapeHtml(t.p1.name)}</b><div class="small muted">${escapeHtml(t.p1.company||'')}</div></td>
              <td><b>${escapeHtml(t.p2.name)}</b><div class="small muted">${escapeHtml(t.p2.company||'')}</div></td>
              <td><span class="lvl-badge" style="background:${LEVEL_INFO[t.level].color}">${t.level}</span></td>
              <td>${t.group ? groupChip(t.group, 44) : `<span class="tag" style="background:#fde9ea;color:#e63946;">Chưa xếp</span>`}</td>
              <td class="small">${stats && stats.played ? `${stats.wins}T-${stats.draws}H-${stats.losses}B · ${stats.points}đ` : '<span class="muted">Chưa đấu</span>'}</td>
              ${canEdit ? `
              <td class="nowrap">
                <button class="btn btn-icon btn-sm" title="Sửa" onclick="openEditTeamModal('${t.id}')">✏️</button>
                <button class="btn btn-icon btn-sm btn-danger" title="Xóa" onclick="deleteTeam('${t.id}')">🗑️</button>
              </td>` : ''}
            </tr>`;
          }).join('') : `<tr><td colspan="${canEdit?7:6}"><div class="empty-state"><div class="ic">🤝</div>Chưa có đội nào</div></td></tr>`}
        </tbody>
      </table>
    </div>
  </div>
  `;
};

let teamSearchDebounce = null;
function after_teams_render(){
  document.querySelectorAll('[data-tlevel]').forEach(b=>{
    b.addEventListener('click', ()=>{ teamsLevelFilter = b.dataset.tlevel; render(); });
  });
  const s = document.getElementById('teamSearchInput');
  if(s) s.addEventListener('input', ()=>{
    const val = s.value;
    clearTimeout(teamSearchDebounce);
    teamSearchDebounce = setTimeout(()=>{
      teamsSearch = val;
      render();
      const el = document.getElementById('teamSearchInput');
      if(el){ el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    }, 300);
  });
}

/* Tự động ghép cặp trong danh sách CHỜ (STATE.waiting) theo nguyên tắc:
   - Level A ghép với A, B với B, C với C, D với D, E với E.
   - Không đụng tới ai đã có đội (STATE.teams) — chỉ xử lý STATE.waiting.
   - Ghép theo đúng thứ tự đăng ký (người đăng ký trước ghép với nhau trước)
     để công bằng, không ưu tiên/xáo trộn.
   - Nếu 1 Level có số người lẻ, người dư sẽ vẫn ở lại danh sách chờ để
     ghép thủ công (thường ghép chéo Level cuối cùng, cần người quyết định). */
function autoPairByLevel(){
  if(!isAdmin()) return;
  const byLevel = {}; // level (hoặc 'unranked') -> mảng người chờ, giữ thứ tự
  STATE.waiting.forEach(w=>{
    const key = w.level && LEVELS.includes(w.level) ? w.level : 'unranked';
    (byLevel[key] = byLevel[key] || []).push(w);
  });

  const stillWaiting = [];
  let newTeams = 0;

  [...LEVELS, 'unranked'].forEach(lv=>{
    const arr = byLevel[lv] || [];
    let i = 0;
    for(; i + 1 < arr.length; i += 2){
      const w1 = arr[i], w2 = arr[i+1];
      STATE.teams.push({
        id: uid('T'),
        p1: {name:w1.name, gender:w1.gender, phone:w1.phone, email:w1.email, company:w1.company, shirt:w1.shirt, level:w1.level},
        p2: {name:w2.name, gender:w2.gender, phone:w2.phone, email:w2.email, company:w2.company, shirt:w2.shirt, level:w2.level},
        level: lv==='unranked' ? (w1.level || w2.level || 'E') : lv,
        group: null,
        note: 'Ghép tự động theo Level'
      });
      newTeams++;
    }
    if(i < arr.length) stillWaiting.push(arr[i]); // người lẻ, không đủ cặp cùng Level
  });

  STATE.waiting = stillWaiting;
  saveState();
  render();

  if(newTeams===0){
    showToast('Không ghép được đội nào — mỗi Level trong danh sách chờ chỉ có 0 hoặc 1 người.', 'error');
  }else if(stillWaiting.length===0){
    showToast(`Đã tự động ghép ${newTeams} đội theo Level. Không còn ai chờ ghép cặp! 🎉`, 'success');
  }else{
    showToast(`Đã tự động ghép ${newTeams} đội theo Level. Còn ${stillWaiting.length} người lẻ (không đủ cặp cùng Level) cần ghép thủ công.`, 'success');
  }
}

function openAddTeamModal(){
  openModal(`
    <div class="modal-head"><h3>Thêm đội thủ công</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <fieldset><legend>Vận động viên 1</legend>${personFormFields({}).replaceAll('pf_','pf1_')}</fieldset>
      <fieldset><legend>Vận động viên 2</legend>${personFormFields({}).replaceAll('pf_','pf2_')}</fieldset>
      <div class="form-row"><label>Level thi đấu của đội</label>
        <select class="input" id="team_level">${LEVELS.map(l=>`<option value="${l}">Level ${l}</option>`).join('')}</select>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn" onclick="closeModal()">Hủy</button>
      <button class="btn btn-primary" onclick="saveNewTeam()">Tạo đội</button>
    </div>
  `);
}

function readPersonFormPrefixed(prefix){
  const name = document.getElementById(prefix+'name').value.trim();
  if(!name) return null;
  return {
    name,
    gender: document.getElementById(prefix+'gender').value || null,
    phone: document.getElementById(prefix+'phone').value.trim() || null,
    email: document.getElementById(prefix+'email').value.trim() || null,
    company: document.getElementById(prefix+'company').value.trim() || null,
    shirt: document.getElementById(prefix+'shirt').value.trim() || null,
    level: document.getElementById(prefix+'level').value,
  };
}

function saveNewTeam(){
  if(!isAdmin()) return;
  const p1 = readPersonFormPrefixed('pf1_');
  const p2 = readPersonFormPrefixed('pf2_');
  if(!p1 || !p2){ showToast('Vui lòng nhập đủ họ tên 2 VĐV','error'); return; }
  const team = { id: uid('T'), p1, p2, level: document.getElementById('team_level').value, group:null, note:'' };
  STATE.teams.push(team);
  saveState();
  closeModal();
  render();
  showToast('Đã thêm đội mới','success');
}

function openEditTeamModal(teamId){
  const t = getTeam(teamId);
  if(!t) return;
  const locked = isTournamentStarted();
  openModal(`
    <div class="modal-head"><h3>Sửa đội: ${escapeHtml(teamDisplayName(t))}</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <fieldset><legend>Vận động viên 1</legend>${personFormFields(t.p1).replaceAll('pf_','pf1_')}</fieldset>
      <fieldset><legend>Vận động viên 2</legend>${personFormFields(t.p2).replaceAll('pf_','pf2_')}</fieldset>
      <div class="form-grid-2">
        <div class="form-row"><label>Level thi đấu của đội</label>
          <select class="input" id="team_level" ${locked?'disabled':''}>${LEVELS.map(l=>`<option value="${l}" ${t.level===l?'selected':''}>Level ${l}</option>`).join('')}</select>
        </div>
        <div class="form-row"><label>Bảng đấu</label>
          <select class="input" id="team_group" ${locked?'disabled':''}>
            <option value="">— Chưa xếp —</option>
            ${GROUPS.map(g=>`<option value="${g}" ${t.group===g?'selected':''}>${groupFullName(g)}</option>`).join('')}
          </select>
        </div>
      </div>
      ${locked ? `<div class="help-text" style="color:var(--red);">🔒 Giải đã bắt đầu — không thể đổi Level/Bảng. Bấm "Khôi phục" ở tab Chia bảng nếu cần sửa.</div>` : ''}
      <div class="help-text" id="teamGroupWarning"></div>
    </div>
    <div class="modal-foot">
      <button class="btn" onclick="closeModal()">Hủy</button>
      <button class="btn btn-primary" onclick="saveEditTeam('${teamId}')">Lưu thay đổi</button>
    </div>
  `);
}

function saveEditTeam(teamId){
  if(!isAdmin()) return;
  const t = getTeam(teamId);
  if(!t) return;
  const p1 = readPersonFormPrefixed('pf1_');
  const p2 = readPersonFormPrefixed('pf2_');
  if(!p1 || !p2){ showToast('Vui lòng nhập đủ họ tên 2 VĐV','error'); return; }
  const newLevel = document.getElementById('team_level').value;
  const newGroup = document.getElementById('team_group').value || null;

  if((newLevel!==t.level || newGroup!==t.group) && blockIfStarted()) return;

  if(newGroup){
    const occupant = teamSlot(newGroup, newLevel);
    if(occupant && occupant.id!==teamId){
      if(!confirm(`Ô ${groupFullName(newGroup)} / Level ${newLevel} hiện đang có đội "${teamDisplayName(occupant)}". Đội đó sẽ bị bỏ khỏi bảng. Tiếp tục?`)) return;
      occupant.group = null;
    }
  }
  t.p1 = p1; t.p2 = p2; t.level = newLevel; t.group = newGroup;
  regenerateMatches(false);
  saveState();
  closeModal();
  render();
  showToast('Đã lưu thay đổi đội','success');
}

function deleteTeam(teamId){
  if(blockIfStarted()) return;
  const t = getTeam(teamId);
  if(!t) return;
  if(!confirm(`Xóa đội "${teamDisplayName(t)}"? Cả 2 VĐV sẽ được chuyển về danh sách chờ ghép cặp.`)) return;
  STATE.waiting.push({id:uid('S'), ...t.p1});
  STATE.waiting.push({id:uid('S'), ...t.p2});
  STATE.teams = STATE.teams.filter(x=>x.id!==teamId);
  regenerateMatches(false);
  saveState();
  render();
  showToast('Đã xóa đội','success');
}

/* =========================================================================
   HOÁN ĐỔI VĐV GIỮA 2 ĐỘI — dùng khi có thay đổi về trình độ/ghép cặp
   (ví dụ: xếp lại theo file Excel mới của BTC) mà KHÔNG cần sửa file JSON
   thủ công. Level và Bảng của mỗi đội (ô trên "Chia bảng") được giữ
   nguyên — chỉ đổi 4 vận động viên của 2 đội cho nhau theo ý admin chọn.
   Lịch thi đấu (sân/giờ) tự động cập nhật lại tên đội sau khi lưu, vì
   regenerateMatches() luôn gán lại team theo group+level hiện tại. */
function openSwapTeamsModal(preselectA, preselectB){
  const teams = STATE.teams.slice().sort((a,b)=> (a.group||'zz'+a.level).localeCompare(b.group||'zz'+b.level) || a.level.localeCompare(b.level));
  const teamOptionsHtml = `<option value="">— Chọn đội —</option>` + teams.map(t=>
    `<option value="${t.id}">${escapeHtml(teamDisplayName(t))} · ${t.group?groupFullName(t.group):'Chưa xếp'} · Level ${t.level}</option>`
  ).join('');
  openModal(`
    <div class="modal-head"><h3>🔀 Hoán đổi VĐV giữa 2 đội</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      <div class="help-text" style="margin-bottom:10px;">Chọn 2 đội cần đổi người, sau đó chọn lại ai ngồi vào từng vị trí. Bảng/Level của 2 ô này giữ nguyên — chỉ vận động viên bên trong thay đổi. Lịch thi đấu sẽ tự cập nhật.</div>
      <div class="form-row"><label>Đội A</label><select class="input" id="swapTeamA" onchange="renderSwapPreview()">${teamOptionsHtml}</select></div>
      <div class="form-row"><label>Đội B</label><select class="input" id="swapTeamB" onchange="renderSwapPreview()">${teamOptionsHtml}</select></div>
      <div id="swapPreviewArea"></div>
    </div>
    <div class="modal-foot">
      <button class="btn" onclick="closeModal()">Hủy</button>
      <button class="btn btn-primary" id="swapSaveBtn" onclick="saveSwapTeams()" disabled>Lưu hoán đổi</button>
    </div>
  `);
  if(preselectA){ document.getElementById('swapTeamA').value = preselectA; }
  if(preselectB){ document.getElementById('swapTeamB').value = preselectB; }
  if(preselectA || preselectB){ renderSwapPreview(); }
}

function renderSwapPreview(){
  const aId = document.getElementById('swapTeamA').value;
  const bId = document.getElementById('swapTeamB').value;
  const area = document.getElementById('swapPreviewArea');
  const btn = document.getElementById('swapSaveBtn');
  if(!aId || !bId){ area.innerHTML=''; btn.disabled = true; return; }
  if(aId === bId){
    area.innerHTML = '<div class="help-text" style="color:#e63946;">Vui lòng chọn 2 đội khác nhau.</div>';
    btn.disabled = true;
    return;
  }
  const a = getTeam(aId), b = getTeam(bId);
  const slots = [
    {key:'aP1', label:`${groupFullName(a.group)||'Chưa xếp'} · Level ${a.level} — VĐV 1`},
    {key:'aP2', label:`${groupFullName(a.group)||'Chưa xếp'} · Level ${a.level} — VĐV 2`},
    {key:'bP1', label:`${groupFullName(b.group)||'Chưa xếp'} · Level ${b.level} — VĐV 1`},
    {key:'bP2', label:`${groupFullName(b.group)||'Chưa xếp'} · Level ${b.level} — VĐV 2`},
  ];
  const peopleMap = { aP1:a.p1, aP2:a.p2, bP1:b.p1, bP2:b.p2 };
  const optionsHtml = Object.keys(peopleMap).map(k=>{
    const p = peopleMap[k];
    return `<option value="${k}">${escapeHtml(p.name)}${p.company?' · '+escapeHtml(p.company):''}</option>`;
  }).join('');
  area.innerHTML = `
    <div class="help-text" style="margin:10px 0;">Chọn ai sẽ ngồi vào từng vị trí (mỗi người chỉ chọn được 1 lần):</div>
    ${slots.map(s=>`<div class="form-row"><label>${s.label}</label><select class="input" id="slot_${s.key}">${optionsHtml}</select></div>`).join('')}
  `;
  slots.forEach(s=>{ document.getElementById('slot_'+s.key).value = s.key; });
  btn.disabled = false;
}

function saveSwapTeams(){
  if(blockIfStarted()) return;
  const aId = document.getElementById('swapTeamA').value;
  const bId = document.getElementById('swapTeamB').value;
  const a = getTeam(aId), b = getTeam(bId);
  if(!a || !b) return;
  const chosen = ['slot_aP1','slot_aP2','slot_bP1','slot_bP2'].map(id=>{
    const el = document.getElementById(id);
    return el ? el.value : null;
  });
  if(chosen.some(v=>!v) || new Set(chosen).size !== 4){
    showToast('Mỗi vận động viên chỉ được chọn đúng 1 lần — vui lòng kiểm tra lại.', 'error');
    return;
  }
  const peopleMap = { aP1:a.p1, aP2:a.p2, bP1:b.p1, bP2:b.p2 };
  const newAP1 = {...peopleMap[chosen[0]], level:a.level};
  const newAP2 = {...peopleMap[chosen[1]], level:a.level};
  const newBP1 = {...peopleMap[chosen[2]], level:b.level};
  const newBP2 = {...peopleMap[chosen[3]], level:b.level};
  a.p1 = newAP1; a.p2 = newAP2;
  b.p1 = newBP1; b.p2 = newBP2;
  regenerateMatches(false);
  saveState();
  closeModal();
  render();
  showToast('Đã hoán đổi vận động viên giữa 2 đội — lịch thi đấu đã tự cập nhật','success');
}

/* =========================================================================
   RENDER: BOARD (Chia bảng) — 6 groups x 5 levels grid
   ========================================================================= */

RENDERERS.board = function(){
  const started = isTournamentStarted();
  const canEdit = isAdmin() && !started;
  const unassigned = STATE.teams.filter(t=>!t.group);
  return `
  ${isAdmin() ? `
  <div class="card" style="margin-bottom:18px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
    <div>
      <div style="font-weight:700;font-size:14px;">${started ? '🔒 Giải đã bắt đầu thi đấu' : '🔓 Đang xếp bảng'}</div>
      <div class="help-text" style="margin-top:2px;">${started ? 'Không thể sửa Bảng/Level/xoá đội. Bấm "Khôi phục" nếu cần sửa lại (sẽ xoá toàn bộ tỷ số đã nhập).' : 'Xếp xong đủ 6 bảng × 5 Level rồi bấm "Bắt đầu thi đấu" để mở khoá nhập tỷ số.'}</div>
    </div>
    ${started
      ? `<button class="btn btn-danger" onclick="restoreTournamentSetup()">↩️ Khôi phục</button>`
      : `<button class="btn btn-primary" onclick="startTournament()">🏁 Bắt đầu thi đấu</button>`}
  </div>` : ''}
  <div class="card" style="margin-bottom:18px;">
    <div class="section-title">
      <div><h2>Chia 6 bảng đấu — mỗi bảng đủ 5 cấp độ</h2><p>${canEdit ? 'Mỗi ô là 1 đội. Bấm vào ô để chọn/đổi đội cho ô đó.' : 'Mỗi ô là 1 đội thi đấu.'}</p></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <span class="tag">⏳ ${unassigned.length} đội chưa xếp</span>
        ${isAdmin() ? `<button class="btn btn-primary" onclick="exportBoardToExcel()">📊 Xuất Excel</button>` : ''}
      </div>
    </div>
    <div class="board-grid">
      ${GROUPS.map(g=>`
        <div class="board-col">
          <div class="board-col-head"><div class="board-group-brand">${groupChip(g, 44)}<span class="board-group-caption">${occupantsOfGroup(g).length} / 5 đội đã xếp</span></div>${isAdmin()?`<button class="board-logo-edit" onclick="openGroupLogoModal('${g}')" aria-label="Đổi logo bảng ${g}">${AppUX.icon('teams')} Đổi logo</button>`:''}</div><div class="board-group-progress" aria-hidden="true"><span style="width:${occupantsOfGroup(g).length*20}%"></span></div>
          ${LEVELS.map(l=>{
            const t = teamSlot(g,l);
            const clickAttr = canEdit ? ` role="button" tabindex="0" aria-label="Chọn đội bảng ${g}, level ${l}" onclick="openSlotPicker('${g}','${l}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}"` : '';
            return `
            <div class="board-slot ${t?'':'empty'}"${clickAttr} style="${canEdit?'cursor:pointer;':'cursor:default;'}">
              <span class="lvl-badge" style="background:${LEVEL_INFO[l].color};min-width:20px;height:20px;padding:0;justify-content:center;flex-shrink:0;">${l}</span>
              ${t ? `
                <div style="flex:1;min-width:0;">
                  <div class="team-players">
                    <div class="player-line">
                      <span class="player-name">${escapeHtml(t.p1.name||'?')}</span>
                      ${t.p1.company ? `<span class="team-sub">· ${escapeHtml(t.p1.company)}</span>` : ''}
                    </div>
                    <div class="player-line">
                      <span class="amp">&amp;</span>
                      <span class="player-name">${escapeHtml(t.p2.name||'?')}</span>
                      ${t.p2.company ? `<span class="team-sub">· ${escapeHtml(t.p2.company)}</span>` : ''}
                    </div>
                  </div>
                </div>
              ` : `<span>${canEdit ? 'Chọn đội thi đấu' : 'Chưa xếp đội'}</span>`}
            </div>`;
          }).join('')}
        </div>
      `).join('')}
    </div>
  </div>

  ${(unassigned.length && canEdit) ? `
  <div class="card">
    <div class="section-title"><div><h2>Đội chưa xếp bảng</h2><p>Kéo/chọn để xếp vào ô trống phù hợp cấp độ ở trên</p></div></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Đội</th><th>Level</th><th>Xếp vào bảng</th></tr></thead>
        <tbody>
          ${unassigned.map(t=>`
            <tr>
              <td><b>${escapeHtml(teamDisplayName(t))}</b></td>
              <td><span class="lvl-badge" style="background:${LEVEL_INFO[t.level].color}">${t.level}</span></td>
              <td>
                <select class="input" onchange="assignTeamToGroup('${t.id}', this.value)">
                  <option value="">Chọn bảng...</option>
                  ${GROUPS.filter(g=>!teamSlot(g,t.level)).map(g=>`<option value="${g}">${groupFullName(g)}</option>`).join('')}
                </select>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>` : ''}
  `;
};

function assignTeamToGroup(teamId, group){
  if(!group) return;
  if(blockIfStarted()) return;
  const t = getTeam(teamId);
  if(!t) return;
  const occupant = teamSlot(group, t.level);
  if(occupant && occupant.id!==teamId){
    showToast(`${groupFullName(group)} đã có đội Level ${t.level}`,'error');
    render();
    return;
  }
  t.group = group;
  regenerateMatches(false);
  saveState();
  render();
  showToast(`Đã xếp "${teamDisplayName(t)}" vào ${groupFullName(group)}`,'success');
}

function openSlotPicker(group, level){
  const current = teamSlot(group, level);
  const candidates = STATE.teams.filter(t => t.level===level && (!t.group || t.group===group));
  openModal(`
    <div class="modal-head"><h3 style="display:flex;align-items:center;gap:8px;">${groupChip(group, 48)} · Level ${level}</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      ${current ? `
      <div class="help-text" style="margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
        <span>Đang có: <b>${escapeHtml(teamDisplayName(current))}</b></span>
        <span style="display:flex;gap:6px;flex-wrap:wrap;">
          <button class="btn btn-sm" onclick="openEditTeamModal('${current.id}')">✏️ Sửa đội này</button>
          <button class="btn btn-sm" onclick="openSwapTeamsModal('${current.id}')">🔀 Đổi VĐV với đội khác</button>
        </span>
      </div>` : ''}
      <div class="form-row">
        <label>Chọn đội cho ô này (chỉ hiện đội Level ${level} chưa xếp bảng, hoặc đang ở ${groupFullName(group)})</label>
        <select class="input" id="slotPickerSelect">
          <option value="">— Để trống —</option>
          ${candidates.map(t=>`<option value="${t.id}" ${current&&current.id===t.id?'selected':''}>${escapeHtml(teamDisplayName(t))}</option>`).join('')}
        </select>
      </div>
      ${candidates.length===0 ? `<div class="help-text">Không có đội Level ${level} nào khả dụng. Hãy tạo/ghép thêm đội ở tab "Đội thi đấu".</div>` : ''}
    </div>
    <div class="modal-foot">
      <button class="btn" onclick="closeModal()">Hủy</button>
      <button class="btn btn-primary" onclick="saveSlotPicker('${group}','${level}')">Lưu</button>
    </div>
  `);
}

function saveSlotPicker(group, level){
  if(blockIfStarted()){ closeModal(); return; }
  const val = document.getElementById('slotPickerSelect').value;
  const current = teamSlot(group, level);
  if(current) current.group = null;
  if(val){
    const t = getTeam(val);
    if(t) t.group = group;
  }
  regenerateMatches(false);
  saveState();
  closeModal();
  render();
  showToast('Đã cập nhật bảng đấu','success');
}
function openGroupLogoModal(group){
  if(!isAdmin()||!GROUPS.includes(group))return;
  openModal(`<div class="modal-head"><h3>Logo bảng ${group}</h3><button class="modal-close" onclick="closeModal()">✕</button></div><div class="modal-body"><div class="group-logo-preview">${groupLogoImg(group,88)}</div><div class="form-row"><label for="groupLogoUrl">Đường dẫn ảnh logo</label><input class="input" id="groupLogoUrl" maxlength="2000" placeholder="https://…/logo.png" value="${escapeHtml(STATE.groupLogos?.[group]||'')}" oninput="previewGroupLogo('${group}')"><p class="help-text">Dán URL ảnh công khai (HTTPS) hoặc đường dẫn assets/. Để trống để dùng logo chữ cái mặc định. Logo áp dụng cho cả bảng và các đội trong bảng.</p></div></div><div class="modal-foot"><button class="btn" onclick="closeModal()">Hủy</button><button class="btn btn-primary" onclick="saveGroupLogo('${group}')">Lưu logo</button></div>`);
}
function previewGroupLogo(group){
  const value=document.getElementById('groupLogoUrl').value.trim();
  const img=document.querySelector('.group-logo-preview img');
  if(img)img.src=Tournament.safeImageUrl(value)&&value?value:GROUP_INFO[group].logo;
}
function saveGroupLogo(group){
  if(!isAdmin()||!GROUPS.includes(group))return;
  const value=document.getElementById('groupLogoUrl').value.trim();
  if(value.length>2000||!Tournament.safeImageUrl(value)){showToast('Hãy dùng URL ảnh HTTP(S) hoặc đường dẫn assets/.','error');return;}
  STATE.groupLogos={...(STATE.groupLogos||{})};
  if(value)STATE.groupLogos[group]=value;else delete STATE.groupLogos[group];
  saveState();closeModal();render();showToast('Đã lưu logo bảng '+group,'success');
}
