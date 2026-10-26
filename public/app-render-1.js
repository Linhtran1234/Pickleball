/* =========================================================================
   RENDER: OVERVIEW
   ========================================================================= */

RENDERERS.overview = function(){
  const teamStats = computeTeamStats();
  const groupRank = rankGroups();
  const totalTeams = STATE.teams.length;
  const totalAssigned = STATE.teams.filter(t=>t.group).length;
  const totalWaiting = STATE.waiting.length;
  const totalPeople = STATE.teams.length*2 + STATE.waiting.length;
  const realMatches=STATE.matches.filter(m=>!m.empty && m.team1 && m.team2);
  const totalMatches=realMatches.length;
  const playedMatches=realMatches.filter(m=>m.score1!=null && m.score2!=null).length;
  const progressPct = totalMatches ? Math.round(playedMatches/totalMatches*100) : 0;
  const slotsTotal = GROUPS.length*LEVELS.length;

  const levelCounts = {};
  LEVELS.forEach(l=> levelCounts[l] = STATE.teams.filter(t=>t.level===l).length);

  const top3 = groupRank.slice(0,3);
  const journey=[{tab:'players',label:'Đăng ký VĐV',detail:`${totalPeople} vận động viên`,done:totalPeople>=60},{tab:'teams',label:'Kết nối đồng đội',detail:`${totalTeams}/30 cặp đấu`,done:totalTeams>=30},{tab:'board',label:'Chia bảng đấu',detail:`${totalAssigned}/30 ô đã xếp`,done:totalAssigned>=30},{tab:'matches',label:'Ra sân · Tỏa sáng',detail:isTournamentStarted()?`${playedMatches}/${totalMatches} trận hoàn thành`:'Sẵn sàng cho giờ G',done:totalMatches>0&&playedMatches===totalMatches}];
  const currentStep=journey.findIndex(step=>!step.done);

  return `
  <section class="hero-banner event-hero" aria-label="BMT Materials Pickleball 2026">
    <div class="event-masthead">
      <div class="event-organizer">
        <img class="event-logo" src="assets/bmt-logo.svg" alt="BMT Materials">
        <span>MATERIALS<span class="organizer-caption">ĐƠN VỊ TỔ CHỨC</span></span>
      </div>
      <span class="event-edition">KẾT NỐI ĐAM MÊ · BỨT PHÁ GIỚI HẠN</span>
    </div>
    <div class="event-stage">
      <div class="event-copy">
        <p class="event-eyebrow"><span></span> CHÀO MỪNG BẠN ĐẾN VỚI GIẢI ĐẤU</p>
        <h1 class="event-title"><span class="event-brand">BMT MATERIALS</span><span class="event-sport">PICKLEBALL</span><span class="event-year">2026<span class="event-year-line"></span></span></h1>
        <p class="event-tagline">Cùng ra sân. Cùng tỏa sáng.</p>
        <p class="event-description">Một sân chơi, chung tinh thần đồng đội.<br>Dự kiến 30 cặp đấu · 6 bảng · 5 cấp độ · 7 sân thi đấu</p>
        <div class="event-cta">
          <button class="btn event-primary" onclick="switchTab('live')"><span class="event-live-dot"></span> THEO DÕI TRỰC TIẾP ${AppUX.icon('arrow')}</button>
          <button class="btn event-secondary" onclick="switchTab('matches')">Lịch thi đấu ${AppUX.icon('arrow')}</button>
        </div>
      </div>
      <div class="event-anniversary" aria-label="Kỷ niệm 15 năm thành lập công ty">
        <img class="anniversary-art" src="assets/anniversary-15.svg" alt="15 năm thành lập công ty" width="360" height="300">
      </div>
      <aside class="ux-countdown"><span class="ux-countdown-label"><span class="ux-pulse-dot"></span> ĐẾM NGƯỢC ĐẾN NGÀY HỘI</span><div id="eventCountdown" class="ux-countdown-digits" role="timer" aria-live="off" aria-label="Đếm ngược đến 07 giờ ngày 14 tháng 11 năm 2026"></div></aside>
    </div>
    <div class="event-info-bar">
      <div class="event-info-item"><span class="event-info-icon" aria-hidden="true">◷</span><div><span class="event-info-label">NGÀY HỘI THỂ THAO</span><strong>14.11.2026</strong><span class="event-info-detail">07:00 - 12:00</span></div></div>
      <a class="event-info-item event-venue" href="https://maps.app.goo.gl/vLXCMX2MCzQ4543X7" target="_blank" rel="noopener noreferrer"><span class="event-info-icon" aria-hidden="true">⌖</span><div><span class="event-info-label">ĐỊA ĐIỂM THI ĐẤU</span><strong>Pickleball Văn Thánh</strong><span class="event-info-detail">TP. Hồ Chí Minh <span aria-hidden="true">↗</span></span></div></a>
      <div class="event-info-item"><span class="event-info-icon" aria-hidden="true">♧</span><div><span class="event-info-label">TINH THẦN GIẢI ĐẤU</span><strong>Đoàn kết · Fair Play</strong><span class="event-info-detail">KỶ NIỆM 15 NĂM THÀNH LẬP CÔNG TY</span></div></div>
    </div>
  </section>
  <div class="ux-event-ticker" aria-hidden="true"><div class="ux-ticker-track">${[0,1].map(()=>`<span>BMT MATERIALS ${AppUX.icon('spark')} ĐOÀN KẾT ${AppUX.icon('spark')} FAIR PLAY ${AppUX.icon('spark')} BỨT PHÁ GIỚI HẠN ${AppUX.icon('spark')} 15 NĂM VỮNG BỀN ${AppUX.icon('spark')} PICKLEBALL 2026 ${AppUX.icon('spark')}</span>`).join('')}</div></div>
  <div class="overview-content">
    <section class="ux-journey" aria-label="Hành trình giải đấu">
      <div class="ux-journey-intro"><p class="ux-eyebrow" id="uxRoleLabel">NGÀY HỘI THỂ THAO</p><h2>Mỗi bước tiến.<br><em>Một kết nối mới.</em></h2><span class="ux-journey-note">${isAdmin()?'Cùng chuẩn bị một giải đấu thật đáng nhớ.':'Cùng theo dõi hành trình chinh phục sân đấu.'}</span></div>
      <div class="ux-journey-steps">${journey.map((step,index)=>`<button class="ux-journey-step ${step.done?'is-complete':index===currentStep?'is-current':''}" onclick="switchTab('${step.tab}')"><span class="ux-step-number">${step.done?AppUX.icon('check'):String(index+1).padStart(2,'0')}</span><span class="ux-step-body"><strong>${step.label}</strong><small>${step.detail}</small></span><span class="ux-step-arrow">${AppUX.icon('arrow')}</span></button>`).join('')}</div>
    </section>
    <div class="ux-overview-heading"><div><p class="ux-eyebrow">TOURNAMENT AT A GLANCE</p><h2>Nhịp đập giải đấu<span class="ux-heading-dot"></span></h2></div><span class="ux-soft-tag">${AppUX.icon('shield')} Kết nối · Tranh tài · Tỏa sáng</span></div>
  <div class="grid grid-4" style="margin-bottom:20px;">
    <div class="stat-card">
      <div class="stat-eyebrow">
        <div class="stat-icon" style="background:#eaf2ff;color:#4361ee;">🤝</div>
        <div class="stat-label">Đội đã ghép cặp (mục tiêu 30)</div>
      </div>
      <div class="stat-chip"><div class="stat-value" data-countup="${totalTeams}">0</div><span class="stat-of">/ 30</span></div>
      <div class="progress-bar" style="margin-top:10px;"><div style="width:${Math.min(100,totalTeams/30*100)}%"></div></div>
    </div>
    <div class="stat-card">
      <div class="stat-eyebrow">
        <div class="stat-icon" style="background:#fff3da;color:#e8ab00;">👤</div>
        <div class="stat-label">Tổng vận động viên đã đăng ký</div>
      </div>
      <div class="stat-chip"><div class="stat-value" data-countup="${totalPeople}">0</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-eyebrow">
        <div class="stat-icon" style="background:#fde9ea;color:#e63946;">⏳</div>
        <div class="stat-label">VĐV đăng ký lẻ — chờ ghép cặp</div>
      </div>
      <div class="stat-chip"><div class="stat-value" data-countup="${totalWaiting}">0</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-eyebrow">
        <div class="stat-icon" style="background:#e6f8f1;color:#1fa97a;">🗂️</div>
        <div class="stat-label">Ô đã xếp vào 6 bảng × 5 cấp độ</div>
      </div>
      <div class="stat-chip"><div class="stat-value" data-countup="${totalAssigned}">0</div><span class="stat-of">/ ${slotsTotal}</span></div>
      <div class="progress-bar" style="margin-top:10px;"><div style="width:${Math.min(100,totalAssigned/slotsTotal*100)}%"></div></div>
    </div>
  </div>

  <div class="grid grid-3" style="align-items:start;">
    <div class="card" style="grid-column:span 2;">
      <div class="section-title">
        <div><h2>Bảng xếp hạng chung (tạm thời)</h2><p>Cộng điểm 5 đội trong mỗi bảng · ${playedMatches}/${totalMatches} trận đã có tỷ số (${progressPct}%)</p></div>
        <button class="btn btn-sm" onclick="switchTab('ranking')">Xem đầy đủ →</button>
      </div>
      ${top3.length ? `
      <div class="podium">
        ${top3[1] ? podiumItem(top3[1],2) : ''}
        ${top3[0] ? podiumItem(top3[0],1) : ''}
        ${top3[2] ? podiumItem(top3[2],3) : ''}
      </div>` : `<div class="empty-state"><div class="ic">🏆</div>Chưa có dữ liệu xếp hạng</div>`}
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Bảng</th><th>Điểm</th><th>Thắng</th><th>Hiệu số</th><th>Đội đủ</th></tr></thead>
          <tbody>
            ${groupRank.map((g,i)=>`
              <tr>
                <td><span class="rank-num ${i===0?'top1':i===1?'top2':i===2?'top3':''}">${i+1}</span></td>
                <td>${groupChip(g.group, 56)}</td>
                <td><b>${g.totalPoints}</b></td>
                <td>${g.totalWins}</td>
                <td>${g.diff>0?'+':''}${g.diff}</td>
                <td>${g.teamsFilled}/5</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="section-title"><div><h2>Phân bổ theo cấp độ</h2><p>Số đội mỗi Level</p></div></div>
      ${LEVELS.map(l=>`
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
          <span class="lvl-badge" style="background:${LEVEL_INFO[l].color};min-width:26px;justify-content:center;">${l}</span>
          <div style="flex:1;">
            <div class="progress-bar"><div style="width:${Math.min(100,levelCounts[l]/6*100)}%;background:${LEVEL_INFO[l].color}"></div></div>
          </div>
          <b style="width:34px;text-align:right;font-size:13px;">${levelCounts[l]}/6</b>
        </div>
      `).join('')}
      <div class="help-text">Mỗi cấp độ tối đa 6 đội (1 đội / bảng × 6 bảng).</div>

      <hr style="border:none;border-top:1px solid var(--border);margin:16px 0;">
      ${isAdmin() ? `
      <div class="section-title" style="margin-bottom:10px;"><div><h2 style="font-size:14px;">Việc cần làm</h2></div></div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${totalPeople===0 ? `<button class="btn btn-primary btn-sm" onclick="switchTab('players');openAddPersonModal()">+ Đăng ký VĐV đầu tiên</button>` : ''}
        ${totalWaiting>0 ? `<button class="btn btn-sm" style="width:100%;justify-content:flex-start;" onclick="switchTab('teams')">🔗 Ghép cặp cho ${totalWaiting} VĐV lẻ</button>`:''}
        ${totalTeams>totalAssigned ? `<button class="btn btn-sm" style="width:100%;justify-content:flex-start;" onclick="switchTab('board')">🗂️ Xếp ${totalTeams-totalAssigned} đội còn lại vào bảng</button>`:''}
        <button class="btn btn-sm" style="width:100%;justify-content:flex-start;" onclick="switchTab('matches')">🏓 Cập nhật tỷ số trận đấu</button>
      </div>` : `
      <div class="section-title" style="margin-bottom:10px;"><div><h2 style="font-size:14px;">Chế độ xem</h2></div></div>
      <p class="help-text">👁️ Tài khoản của bạn chỉ có quyền xem. Liên hệ Admin nếu cần chỉnh sửa dữ liệu.</p>`}
    </div>
  </div>
  </div><!-- overview-content -->
  `;
};

function podiumItem(g, place){
  const cls = place===1?'p1':place===2?'p2':'p3';
  return `
    <div class="podium-item ${cls}" data-flip-key="p_${g.group}">
      <div class="medal">${place}</div>
      <div class="bar"><img src="${groupLogo(g.group)}" alt="${escapeHtml(groupName(g.group))}" class="grp-logo podium-logo"></div>
      <div class="name">${escapeHtml(groupName(g.group))}</div>
      <div class="pts">${g.totalPoints} điểm</div>
    </div>
  `;
}

function after_overview_render(){
  document.querySelectorAll('[data-money-countup]').forEach(el=>{
    const target = Number(el.dataset.moneyCountup);
    if(Number.isNaN(target)) return;
    const duration = 900;
    const start = performance.now();
    function step(now){
      const p = Math.min(1,(now-start)/duration);
      const eased = 1 - Math.pow(1-p,3);
      const val = Math.round(target*eased/1000)*1000;
      el.textContent = val.toLocaleString('vi-VN');
      if(p<1) requestAnimationFrame(step);
      else el.textContent = target.toLocaleString('vi-VN');
    }
    requestAnimationFrame(step);
  });
}

/* =========================================================================
   RENDER: PLAYERS (Người đăng ký) — flat list of all individuals
   ========================================================================= */

let playersFilter = { search:'', level:'all', pairStatus:'all' };

function getAllPeople(){
  const list = [];
  STATE.teams.forEach(t=>{
    list.push({ personKey:t.id+'#1', name:t.p1.name, gender:t.p1.gender, phone:t.p1.phone, email:t.p1.email, company:t.p1.company, shirt:t.p1.shirt, level:t.p1.level||t.level, pairStatus:'paired', teamId:t.id, slot:'p1', partnerName: t.p2 ? t.p2.name : null });
    list.push({ personKey:t.id+'#2', name:t.p2.name, gender:t.p2.gender, phone:t.p2.phone, email:t.p2.email, company:t.p2.company, shirt:t.p2.shirt, level:t.p2.level||t.level, pairStatus:'paired', teamId:t.id, slot:'p2', partnerName: t.p1 ? t.p1.name : null });
  });
  STATE.waiting.forEach(w=>{
    list.push({ personKey:w.id, name:w.name, gender:w.gender, phone:w.phone, email:w.email, company:w.company, shirt:w.shirt, level:w.level, pairStatus:'waiting', waitingId:w.id, partnerName:null });
  });
  return list;
}

RENDERERS.players = function(){
  let people = getAllPeople();
  const total = people.length;

  if(playersFilter.search.trim()){
    const q = AppUX.searchText(playersFilter.search.trim());
    people = people.filter(p =>
      AppUX.searchText(p.name).includes(q) ||
      AppUX.searchText(p.company).includes(q) ||
      AppUX.searchText(p.phone).includes(q) ||
      AppUX.searchText(p.email).includes(q)
    );
  }
  if(playersFilter.level!=='all'){
    people = people.filter(p=>p.level===playersFilter.level);
  }
  if(playersFilter.pairStatus!=='all'){
    people = people.filter(p=>p.pairStatus===playersFilter.pairStatus);
  }

  const canEdit = isAdmin();
  return `
  <div class="card">
    <div class="section-title">
      <div><h2>Danh sách người đăng ký</h2><p>${total} vận động viên · ${STATE.teams.length} đã ghép cặp · ${STATE.waiting.length} đang chờ ghép</p></div>
      ${canEdit ? `<button class="btn btn-yellow" onclick="openAddPersonModal()">+ Thêm người đăng ký</button>` : ''}
    </div>

    <div class="toolbar">
      <div class="search-box">
        <span class="ico">🔍</span>
        <input class="input" id="playerSearch" placeholder="Tìm theo tên, công ty, SĐT, email..." value="${escapeHtml(playersFilter.search)}">
      </div>
      <select class="input" id="playerLevelFilter">
        <option value="all">Tất cả cấp độ</option>
        ${LEVELS.map(l=>`<option value="${l}" ${playersFilter.level===l?'selected':''}>Level ${l}</option>`).join('')}
      </select>
      <div class="pill-group">
        <button class="pill ${playersFilter.pairStatus==='all'?'active':''}" data-status="all">Tất cả</button>
        <button class="pill ${playersFilter.pairStatus==='paired'?'active':''}" data-status="paired">Đã ghép cặp</button>
        <button class="pill ${playersFilter.pairStatus==='waiting'?'active':''}" data-status="waiting">Chờ ghép cặp</button>
      </div>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Họ tên</th><th>Giới tính</th><th>SĐT</th><th>Email</th><th>Công ty</th><th>Size áo</th><th>Level</th><th>Partner</th>${canEdit?'<th></th>':''}</tr>
        </thead>
        <tbody>
          ${people.length ? people.map(p=>`
            <tr>
              <td><b>${escapeHtml(p.name||'—')}</b></td>
              <td>${escapeHtml(p.gender||'—')}</td>
              <td class="nowrap">${escapeHtml(p.phone||'—')}</td>
              <td class="small">${escapeHtml(p.email||'—')}</td>
              <td class="small">${escapeHtml(p.company||'—')}</td>
              <td>${escapeHtml(p.shirt||'—')}</td>
              <td>${p.level ? `<span class="lvl-badge" style="background:${LEVEL_INFO[p.level].color}">${p.level}</span>` : '<span class="muted">—</span>'}</td>
              <td>${p.pairStatus==='paired' ? `<span class="tag">🤝 ${escapeHtml(p.partnerName||'')}</span>` : `<span class="tag" style="background:#fde9ea;color:#e63946;">⏳ Chờ ghép</span>`}</td>
              ${canEdit ? `
              <td class="nowrap">
                <button class="btn btn-icon btn-sm" title="Sửa" onclick="openEditPersonModal('${p.personKey}')">✏️</button>
                <button class="btn btn-icon btn-sm btn-danger" title="Xóa" onclick="deletePerson('${p.personKey}')">🗑️</button>
              </td>` : ''}
            </tr>
          `).join('') : `<tr><td colspan="${canEdit?9:8}"><div class="empty-state"><div class="ic">🔍</div>Không tìm thấy kết quả phù hợp</div></td></tr>`}
        </tbody>
      </table>
    </div>
  </div>
  `;
};

let playerSearchDebounce = null;
function after_players_render(){
  const s = document.getElementById('playerSearch');
  if(s){
    s.addEventListener('input', ()=>{
      const val = s.value;
      clearTimeout(playerSearchDebounce);
      playerSearchDebounce = setTimeout(()=>{
        playersFilter.search = val;
        render();
        const el = document.getElementById('playerSearch');
        if(el){ el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
      }, 300);
    });
  }
  const lv = document.getElementById('playerLevelFilter');
  if(lv){ lv.addEventListener('change', ()=>{ playersFilter.level = lv.value; render(); }); }
  document.querySelectorAll('.pill[data-status]').forEach(p=>{
    p.addEventListener('click', ()=>{ playersFilter.pairStatus = p.dataset.status; render(); });
  });
}

/* ---- Person CRUD modals ---- */

function personFormFields(p){
  p = p || {};
  return `
    <div class="form-grid-2">
      <div class="form-row"><label>Họ và tên *</label><input class="input" id="pf_name" value="${escapeHtml(p.name||'')}" required></div>
      <div class="form-row"><label>Giới tính</label>
        <select class="input" id="pf_gender">
          <option value="" ${!p.gender?'selected':''}>—</option>
          <option value="Nam" ${p.gender==='Nam'?'selected':''}>Nam</option>
          <option value="Nữ" ${p.gender==='Nữ'?'selected':''}>Nữ</option>
        </select>
      </div>
      <div class="form-row"><label>Số điện thoại</label><input class="input" id="pf_phone" value="${escapeHtml(p.phone||'')}"></div>
      <div class="form-row"><label>Email</label><input class="input" id="pf_email" value="${escapeHtml(p.email||'')}"></div>
      <div class="form-row"><label>Công ty / Đơn vị</label><input class="input" id="pf_company" value="${escapeHtml(p.company||'')}"></div>
      <div class="form-row"><label>Size áo</label><input class="input" id="pf_shirt" value="${escapeHtml(p.shirt||'')}"></div>
      <div class="form-row"><label>Trình độ tự đánh giá</label>
        <select class="input" id="pf_level">
          ${LEVELS.map(l=>`<option value="${l}" ${p.level===l?'selected':''}>Level ${l} — ${LEVEL_INFO[l].label.split('·')[1].trim()}</option>`).join('')}
        </select>
      </div>
    </div>
  `;
}

function openAddPersonModal(){
  openModal(`
    <div class="modal-head"><h3>Thêm người đăng ký</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      ${personFormFields({})}
      <div class="help-text">Người mới sẽ được thêm vào danh sách <b>chờ ghép cặp</b>. Bạn có thể ghép đội ở tab "Đội thi đấu".</div>
    </div>
    <div class="modal-foot">
      <button class="btn" onclick="closeModal()">Hủy</button>
      <button class="btn btn-primary" onclick="saveNewPerson()">Lưu</button>
    </div>
  `);
}

function readPersonForm(){
  const name = document.getElementById('pf_name').value.trim();
  if(!name){ showToast('Vui lòng nhập họ tên','error'); return null; }
  return {
    name,
    gender: document.getElementById('pf_gender').value || null,
    phone: document.getElementById('pf_phone').value.trim() || null,
    email: document.getElementById('pf_email').value.trim() || null,
    company: document.getElementById('pf_company').value.trim() || null,
    shirt: document.getElementById('pf_shirt').value.trim() || null,
    level: document.getElementById('pf_level').value,
  };
}

function saveNewPerson(){
  if(!isAdmin()) return;
  const data = readPersonForm();
  if(!data) return;
  STATE.waiting.push({ id: uid('S'), ...data });
  saveState();
  closeModal();
  render();
  showToast('Đã thêm người đăng ký mới','success');
}

function openEditPersonModal(personKey){
  const people = getAllPeople();
  const p = people.find(x=>x.personKey===personKey);
  if(!p) return;
  openModal(`
    <div class="modal-head"><h3>Sửa thông tin: ${escapeHtml(p.name)}</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-body">
      ${personFormFields(p)}
      ${p.pairStatus==='paired' ? `<div class="help-text">VĐV này đang ghép cặp với <b>${escapeHtml(p.partnerName||'')}</b> (Đội ${p.teamId}). Sửa Level ở đây chỉ cập nhật thông tin cá nhân của VĐV — Level thi đấu của <b>đội</b> chỉnh ở tab "Đội thi đấu".</div>` : ''}
    </div>
    <div class="modal-foot">
      <button class="btn" onclick="closeModal()">Hủy</button>
      <button class="btn btn-primary" onclick="saveEditPerson('${personKey}')">Lưu thay đổi</button>
    </div>
  `);
}

function saveEditPerson(personKey){
  if(!isAdmin()) return;
  const data = readPersonForm();
  if(!data) return;
  if(personKey.includes('#')){
    const [teamId, slot] = personKey.split('#');
    const t = getTeam(teamId);
    if(!t) return;
    const key = slot==='1' ? 'p1':'p2';
    t[key] = { ...t[key], ...data };
  }else{
    const w = STATE.waiting.find(x=>x.id===personKey);
    if(w) Object.assign(w, data);
  }
  saveState();
  closeModal();
  render();
  showToast('Đã lưu thay đổi','success');
}

function deletePerson(personKey){
  if(!isAdmin()) return;
  const people = getAllPeople();
  const p = people.find(x=>x.personKey===personKey);
  if(!p) return;
  if(p.pairStatus==='paired'){
    // Xoá 1 VĐV trong đội ĐÃ GHÉP CẶP = giải tán cả đội (đối tác bị đẩy về
    // chờ ghép + trận đấu của đội đó bị regenerateMatches() biến thành ô
    // trống, MẤT LUÔN tỷ số đã nhập nếu đội đã thi đấu). Đây là thao tác
    // tương đương "Xóa đội" ở tab Đội thi đấu, nên PHẢI bị khoá y hệt khi
    // giải đã bắt đầu — trước đây thiếu điều kiện này, khiến ai xoá nhầm 1
    // VĐV ở tab "Người đăng ký" trong lúc giải đang diễn ra sẽ âm thầm xoá
    // mất tỷ số thật đã nhập mà không có bất kỳ cảnh báo nào.
    if(blockIfStarted()) return;
    if(!confirm(`Xóa "${p.name}" sẽ giải tán đội "${p.teamId}" và chuyển đối tác "${p.partnerName}" về danh sách chờ ghép cặp. Tiếp tục?`)) return;
    const t = getTeam(p.teamId);
    const partner = p.slot==='p1' ? t.p2 : t.p1;
    STATE.waiting.push({ id: uid('S'), ...partner });
    STATE.teams = STATE.teams.filter(x=>x.id!==p.teamId);
    regenerateMatches(false);
  }else{
    if(!confirm(`Xóa "${p.name}" khỏi danh sách chờ ghép cặp?`)) return;
    STATE.waiting = STATE.waiting.filter(x=>x.id!==p.waitingId);
  }
  saveState();
  render();
  showToast('Đã xóa','success');
}