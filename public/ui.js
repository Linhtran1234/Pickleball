/* Presentation only: motion, navigation, accessibility and interaction feedback. */
(function(){
  'use strict';
  const paths={
    overview:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
    live:'M3 7h18v13H3zM8 3l4 4 4-4M10 11l5 3-5 3z',
    players:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
    teams:'m8 12 3 3 5-6M4 4h16v16H4z',
    board:'M8 3v5M16 3v5M8 8h8M4 16h4v5H4zM10 16h4v5h-4zM16 16h4v5h-4zM6 16v-4h12v4M12 8v8',
    matches:'m5 19 4-4M8 16l-2-2c-4-4 1-12 7-11 3 0 7 4 7 7 1 6-7 11-11 7l-1-1ZM3 21l2-2',
    ranking:'M8 21h8M12 17v4M7 3h10v7a5 5 0 0 1-10 0V3ZM7 5H3v3a4 4 0 0 0 4 4M17 5h4v3a4 4 0 0 1-4 4',
    rules:'M8 3h11v18H5V6l3-3ZM8 3v4H5M9 11h6M9 15h6',
    arrow:'M5 12h14m-6-6 6 6-6 6',check:'m5 12 4 4L19 6',plus:'M12 5v14M5 12h14',
    search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',close:'m6 6 12 12M6 18 18 6',
    download:'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4',upload:'M12 16V4m-5 5 5-5 5 5M4 17v4h16v-4',
    reset:'M3 10a9 9 0 1 1 2 8M3 4v6h6',lock:'M5 10h14v11H5zM8 10V7a4 4 0 0 1 8 0v3',
    settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2',
    info:'M12 11v6M12 7h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
    clock:'M12 6v6l4 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
    pin:'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
    bolt:'m13 2-9 12h7l-1 8 10-12h-7l1-8Z',shield:'M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6l-9-4Zm-4 9 3 3 5-5',
    logout:'M9 4H4v16h5M10 12h11m-4-4 4 4-4 4',eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
    spark:'m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z',
    filter:'M3 5h18M6 12h12M9 19h6',trash:'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15',
  };
  const tabs=[['overview','Tổng quan','Không khí ngày hội & tiến độ giải đấu'],['live','LIVE MATCHES','Theo dõi diễn biến trực tiếp tại 7 sân'],['players','Người đăng ký','Quản lý vận động viên và danh sách đăng ký'],['teams','Đội thi đấu','Kết nối đồng đội, sẵn sàng ra sân'],['board','Chia bảng','6 bảng đấu · 5 cấp độ · Một hành trình chinh phục'],['matches','Thi đấu & Tỷ số','Lịch thi đấu, kết quả và những khoảnh khắc bứt phá'],['ranking','Xếp hạng','Mỗi trận đấu, một bước tiến trên bảng xếp hạng'],['rules','Thể thức','Nắm rõ luật chơi, tự tin bước vào sân']];
  const reduced=()=>typeof matchMedia==='function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const icon=(name,extra='')=>`<svg class="ux-icon ${extra}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.spark}"/></svg>`;
  const searchText=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replaceAll('đ','d');
  let previousTab=null,previousFocus=null,revealObserver=null;
  const escape=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  function header(tab,state){
    const item=tabs.find(t=>t[0]===tab);if(!item||tab==='overview')return '';
    const counts={players:`${state.teams.length*2+state.waiting.length} VĐV`,teams:`${state.teams.length} cặp đấu`,board:`${state.teams.filter(t=>t.group).length}/30 ô đã xếp`,matches:`${state.matches.filter(m=>!m.empty&&m.team1&&m.team2).length} trận đấu`,ranking:'Bảng thành tích',live:'7 sân thi đấu',rules:'Fair Play'};
    return `<header class="ux-page-heading"><div><p class="ux-eyebrow">BMT MATERIALS <span> / </span> NGÀY HỘI THỂ THAO 2026</p><h2>${icon(tab)}${item[1]}</h2><p class="ux-page-description">${item[2]}</p></div><div class="ux-page-tag">${icon(tab==='live'?'live':'bolt')}<span>${counts[tab]}</span></div></header>`;
  }
  function syncNav(){
    const nav=document.getElementById('tabbar');if(!nav)return;
    let rail=nav.querySelector('.ux-nav-rail');if(!rail){rail=document.createElement('span');rail.className='ux-nav-rail';rail.setAttribute('aria-hidden','true');nav.appendChild(rail);}
    const active=nav.querySelector('.tab-btn.active');if(!active)return;
    if(typeof nav.scrollTo==='function' && (active.offsetLeft<nav.scrollLeft || active.offsetLeft+active.offsetWidth>nav.scrollLeft+nav.clientWidth))nav.scrollTo({left:Math.max(0,active.offsetLeft-nav.clientWidth/2+active.offsetWidth/2),behavior:reduced()?'auto':'smooth'});
    rail.style.width=active.offsetWidth+'px';rail.style.transform=`translateX(${active.offsetLeft}px)`;
    nav.querySelectorAll('.tab-btn').forEach(btn=>{if(!btn.querySelector('svg'))btn.insertAdjacentHTML('afterbegin',icon(btn.dataset.tab));btn.setAttribute('aria-selected',String(btn===active));btn.tabIndex=btn===active?0:-1;});
  }
  function decorate(root){
    root.querySelectorAll('.empty-state').forEach(el=>{
      el.classList.add('ux-empty');const mark=el.querySelector('.ic');if(mark)mark.innerHTML=icon('matches');
    });
    root.querySelectorAll('button:not([data-ux-decorated])').forEach(button=>{
      button.dataset.uxDecorated='true';
      if(button.classList.contains('modal-close')){button.setAttribute('aria-label','Đóng cửa sổ');return;}
      const text=button.textContent.trim();let name;
      if(/Xuất|Tải/.test(text))name='download';else if(/Nhập dữ liệu/.test(text))name='upload';else if(/Quản lý người/.test(text))name='settings';else if(/Đăng nhập/.test(text))name='lock';else if(/Khôi phục|Tạo lại giải/.test(text))name='reset';else if(/Thêm|Tạo tài khoản/.test(text))name='plus';else if(/Lưu/.test(text))name='check';else if(/ghép|Ghép|Hoán đổi/.test(text))name='teams';else if(/Bắt đầu/.test(text))name='bolt';
      if(name&&!button.querySelector('svg')&&!button.classList.contains('pill')){
        const first=button.firstChild;
        if(first&&first.nodeType===3)first.textContent=first.textContent.replace(/^[\s\p{Extended_Pictographic}\uFE0F\u200D↺⬇⬆+]+/u,'');
        button.insertAdjacentHTML('afterbegin',icon(name));
      }
    });
    root.querySelectorAll('.stat-card .stat-icon').forEach((el,i)=>{el.innerHTML=icon(['teams','players','clock','board'][i%4]);});
    root.querySelectorAll('.pill').forEach(button=>button.setAttribute('aria-pressed',String(button.classList.contains('active'))));
    root.querySelectorAll('.table-wrap').forEach(el=>{el.tabIndex=0;el.setAttribute('role','region');el.setAttribute('aria-label','Bảng dữ liệu, có thể cuộn để xem thêm');});
    root.querySelectorAll('.card,.stat-card,.board-col,.live-card,.ux-journey-step').forEach((el,index)=>{
      el.classList.add('ux-reveal');el.style.setProperty('--reveal-delay',Math.min(index,8)*45+'ms');
      if(!reduced()&&typeof IntersectionObserver!=='undefined'){
        if(!revealObserver)revealObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');revealObserver.unobserve(entry.target);}}),{threshold:.04});
        revealObserver.observe(el);
      }else el.classList.add('is-visible');
    });
  }
  function afterRender(tab,state){
    const app=document.getElementById('app');const fresh=tab!==previousTab;
    app.classList.toggle('is-overview',tab==='overview');app.classList.toggle('ux-tab-enter',fresh);app.classList.toggle('ux-stream-update',tab==='live'&&!fresh);document.body.dataset.activeTab=tab;
    app.setAttribute('role','tabpanel');app.setAttribute('aria-labelledby','tab-'+tab);app.tabIndex=-1;
    decorate(app);decorate(document.querySelector('.topbar'));syncNav();updateCountdown();
    const pill=document.getElementById('uxRoleLabel');if(pill)pill.textContent=typeof isAdmin==='function'&&isAdmin()?'BAN TỔ CHỨC':'CÙNG HÒA NHỊP NGÀY HỘI';
    if(fresh && typeof window.scrollTo==='function' && window.scrollY>350)window.scrollTo({top:document.getElementById('tabbar').offsetTop,behavior:reduced()?'auto':'smooth'});
    previousTab=tab;
  }
  function setConnection(online){
    const el=document.getElementById('connectionPill');if(!el)return;
    el.dataset.online=String(online);el.querySelector('span:last-child').textContent=online?'Đã kết nối':'Chưa kết nối';
  }
  function updateCountdown(){
    const el=document.getElementById('eventCountdown');if(!el)return;
    const remaining=new Date('2026-11-14T07:00:00+07:00').getTime()-Date.now();
    if(remaining<=0){el.innerHTML=`<span class="ux-countdown-complete">${icon('spark')} Tinh thần thể thao luôn tỏa sáng</span>`;return;}
    const total=Math.floor(remaining/1000),values=[Math.floor(total/86400),Math.floor(total/3600)%24,Math.floor(total/60)%60,total%60],labels=['NGÀY','GIỜ','PHÚT','GIÂY'];
    values.forEach((value,i)=>{const digit=el.querySelector(`[data-time="${i}"]`);if(digit){const text=String(value).padStart(2,'0');if(digit.textContent!==text)digit.textContent=text;}else if(i===0)el.innerHTML=values.map((n,j)=>`<div class="ux-time-unit"><strong data-time="${j}">${String(n).padStart(2,'0')}</strong><span>${labels[j]}</span></div>`).join('<span class="ux-time-separator" aria-hidden="true">:</span>');});
  }
  function modalOpened(scope){
    previousFocus=document.activeElement;document.body.classList.add('ux-modal-open');
    scope.setAttribute('role','dialog');scope.setAttribute('aria-modal','true');const heading=scope.querySelector('h3,h1');if(heading){heading.id='activeDialogTitle';scope.setAttribute('aria-labelledby',heading.id);}
    decorate(scope);const focus=scope.querySelector('input:not([type="hidden"]),textarea,select')||scope.querySelector('button');if(focus)focus.focus();
  }
  function modalClosed(){document.body.classList.remove('ux-modal-open');if(previousFocus&&previousFocus.isConnected)previousFocus.focus();previousFocus=null;}
  function openNavigator(){
    if(typeof openModal!=='function')return;
    openModal(`<div class="modal-head"><h3>${icon('search')} Đi đến nhanh</h3><button class="modal-close" onclick="closeModal()">✕</button></div><div class="modal-body ux-command-body"><input id="uxCommandSearch" class="input" autocomplete="off" placeholder="Tìm trang…" aria-label="Tìm trang trong ứng dụng"><div class="ux-command-results">${tabs.map(([id,name,description])=>`<button class="ux-command" data-command="${id}" onclick="closeModal();switchTab('${id}')">${icon(id)}<span><strong>${name}</strong><small>${description}</small></span>${icon('arrow')}</button>`).join('')}</div><p id="uxCommandEmpty" class="ux-command-empty" hidden>Không tìm thấy trang phù hợp. Thử từ khóa khác nhé.</p></div><div class="modal-foot ux-command-hint"><span>↑ ↓ để chọn · Enter để mở</span><span>Esc để đóng</span></div>`);
    const input=document.getElementById('uxCommandSearch');input.addEventListener('input',()=>{
      const query=searchText(input.value);let visible=0;
      document.querySelectorAll('.ux-command').forEach(button=>{button.hidden=!searchText(button.textContent).includes(query);if(!button.hidden)visible++;});
      document.getElementById('uxCommandEmpty').hidden=visible>0;
    });
  }
  document.addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openNavigator();return;}
    const auth=document.getElementById('authScreen'),overlay=document.getElementById('modalOverlay');const scope=auth&&auth.style.display==='flex'?auth:overlay&&overlay.classList.contains('open')?overlay:null;
    if(e.key==='Escape'&&scope){e.preventDefault();if(scope===auth)closeAuthScreen();else closeModal();return;}
    if(scope&&e.key==='Tab'){
      const list=[...scope.querySelectorAll('button:not([disabled]),input:not([type="hidden"]):not([disabled]),select:not([disabled]),a[href],[tabindex="0"]')].filter(el=>!el.hidden&&!el.closest('[hidden]'));
      if(!list.length)return;const first=list[0],last=list[list.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
    if(scope&&scope.querySelector('#uxCommandSearch')&&['ArrowDown','ArrowUp','Enter'].includes(e.key)){
      const list=[...scope.querySelectorAll('.ux-command:not([hidden])')];if(!list.length)return;const index=list.indexOf(document.activeElement);
      if(e.key==='Enter'&&index<0){e.preventDefault();list[0].click();}else if(e.key!=='Enter'){e.preventDefault();list[(index+(e.key==='ArrowDown'?1:-1)+list.length)%list.length].focus();}
    }
    if(document.activeElement?.classList.contains('tab-btn')&&['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){
      e.preventDefault();const list=[...document.querySelectorAll('.tab-btn')],index=list.indexOf(document.activeElement);const next=e.key==='Home'?0:e.key==='End'?list.length-1:(index+(e.key==='ArrowRight'?1:-1)+list.length)%list.length;list[next].focus();list[next].click();
    }
  });
  document.addEventListener('pointerdown',e=>{
    if(reduced())return;const button=e.target.closest('button:not([disabled])');if(!button)return;
    const rect=button.getBoundingClientRect(),ripple=document.createElement('span');ripple.className='ux-ripple';ripple.style.left=(e.clientX-rect.left)+'px';ripple.style.top=(e.clientY-rect.top)+'px';button.appendChild(ripple);setTimeout(()=>ripple.remove(),650);
  });
  window.addEventListener('resize',syncNav);setInterval(updateCountdown,1000);
  window.AppUX={icon,searchText,header,afterRender,setConnection,modalOpened,modalClosed,openNavigator,reducedMotion:reduced,updateCountdown};
})();
