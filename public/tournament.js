/* Shared tournament configuration and validation. No participant/sample data. */
(function(root){
  'use strict';
  const EVENT_NAME = 'BMT MATERIAL PICKLEBALL 2026 - KỶ NIỆM 15 NĂM THÀNH LẬP CÔNG TY';
  const LEVELS = ['A','B','C','D','E'];
  const GROUPS = ['A','B','C','D','E','F'];
  const STORAGE_PREFIX = 'bmt-materials-2026-new-v2';
  function liveCourt(court){
    return {court,status:'waiting',teamA:{name:'',logo:'',players:[]},teamB:{name:'',logo:'',players:[]},scoreA:null,scoreB:null,note:''};
  }
  function emptyState(){
    return {version:1,eventName:EVENT_NAME,teams:[],waiting:[],matches:[],liveScores:[],liveUpdatedAt:0,liveCourts:Array.from({length:7},(_,i)=>liveCourt(i+1)),tournamentStatus:'setup',updatedAt:Date.now()};
  }
  function scoreError(s1,s2){
    if(s1===null && s2===null) return null;
    if(!Number.isInteger(s1)||!Number.isInteger(s2)||s1<0||s2<0) return 'Tỷ số phải là hai số nguyên không âm';
    if(s1===s2) return 'Tỷ số không được hòa';
    const hi=Math.max(s1,s2),lo=Math.min(s1,s2);
    if(hi<11 || hi>15 || (lo<10 && hi!==11) || (lo>=10 && (hi===15 ? ![13,14].includes(lo) : hi-lo!==2))) return 'Tỷ số không đúng luật: chạm 11, cách biệt 2, trần 15';
    return null;
  }
  function safeImageUrl(value){
    return typeof value==='string' && (value==='' || /^(https?:\/\/|assets\/|\/(?!\/))/i.test(value));
  }
  function displayLiveCourts(state){
    const courts=(state.liveCourts||emptyState().liveCourts).map(c=>({...c}));
    if(state.tournamentStatus!=='started')return courts;
    for(const live of state.liveScores||[]){
      const match=state.matches.find(m=>m.id===live.matchId&&!m.empty);
      if(!match||Number(match.court)!==Number(live.court)||match.team1!==live.team1||match.team2!==live.team2)continue;
      const a=state.teams.find(t=>t.id===match.team1),b=state.teams.find(t=>t.id===match.team2);if(!a||!b)continue;
      const team=t=>({name:t.group?'Bảng '+t.group:t.id,logo:t.group?'assets/groups/'+t.group+'.svg':'',players:[t.p1.name,t.p2.name]});
      const index=courts.findIndex(c=>Number(c.court)===Number(live.court));if(index<0)continue;
      courts[index]={court:Number(live.court),status:live.status,teamA:team(a),teamB:team(b),scoreA:live.scoreA,scoreB:live.scoreB,note:[match.time,'Level '+match.level].filter(Boolean).join(' · '),matchId:match.id,source:'match'};
    }
    return courts;
  }
  function validateState(state){
    const fail=message=>{throw new Error(message);};
    if(!state || typeof state!=='object' || Array.isArray(state)) fail('Dữ liệu giải không hợp lệ');
    for(const field of ['teams','waiting','matches']) if(!Array.isArray(state[field])) fail(`Thiếu danh sách ${field}`);
    if(state.teams.length>1000 || state.waiting.length>2000 || state.matches.length>10000) fail('Dữ liệu vượt quá giới hạn hỗ trợ');
    if(state.eventName!==undefined && (typeof state.eventName!=='string'||!state.eventName.trim()||state.eventName.length>300)) fail('Tên giải không hợp lệ');
    if(state.tournamentStatus!==undefined && !['setup','started'].includes(state.tournamentStatus)) fail('Trạng thái giải không hợp lệ');
    const ids=new Set(),slots=new Set(),players=new Set(),matches=new Set();
    const id=(value,set,label)=>{
      if(typeof value!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(value)||['__proto__','constructor','prototype'].includes(value)||set.has(value)) fail(`${label}: mã trùng hoặc không hợp lệ`);
      set.add(value);
    };
    const person=(p,label)=>{
      if(!p || typeof p!=='object'||typeof p.name!=='string'||!p.name.trim()||p.name.length>200) fail(`${label}: thiếu họ tên`);
      for(const k of ['gender','phone','email','company','shirt']) if(p[k]!=null && (typeof p[k]!=='string'||p[k].length>500)) fail(`${label}: ${k} không hợp lệ`);
      if(p.level!=null && !LEVELS.includes(p.level)) fail(`${label}: level không hợp lệ`);
    };
    state.teams.forEach(t=>{
      if(!t || typeof t!=='object') fail('Đội không hợp lệ');
      id(t.id,ids,'Đội');
      if(!LEVELS.includes(t.level)|| (t.group!=null && !GROUPS.includes(t.group))) fail('Level/bảng của đội không hợp lệ');
      if(t.group){const slot=t.group+'@'+t.level;if(slots.has(slot)) fail('Mỗi bảng chỉ có một cặp ở mỗi level');slots.add(slot);}
      for(const [slot,p] of [[1,t.p1],[2,t.p2]]){person(p,'Vận động viên');id(p.id || `${t.id}_p${slot}`,players,'Vận động viên');}
      if(t.note!=null && (typeof t.note!=='string'||t.note.length>2000)) fail('Ghi chú đội quá dài');
    });
    if(state.tournamentStatus==='started' && slots.size!==GROUPS.length*LEVELS.length) fail('Phải xếp đủ 6 bảng × 5 level trước khi bắt đầu');
    state.waiting.forEach(p=>{person(p,'Người đăng ký');id(p.id,players,'Người đăng ký');});
    state.matches.forEach(m=>{
      if(!m || typeof m!=='object') fail('Trận không hợp lệ');id(m.id,matches,'Trận');
      if(m.empty!==undefined && typeof m.empty!=='boolean') fail('Cờ trận trống không hợp lệ');
      if(m.court!=null && !/^[1-7]$/.test(String(m.court))) fail('Sân thi đấu không hợp lệ');
      if(m.time!=null && (typeof m.time!=='string'||m.time.length>100)) fail('Lượt đấu không hợp lệ');
      if(m.empty) return;
      if(!ids.has(m.team1)||!ids.has(m.team2)||m.team1===m.team2) fail('Trận đấu tham chiếu đội không hợp lệ');
      if(!LEVELS.includes(m.level)||!GROUPS.includes(m.groupA)||!GROUPS.includes(m.groupB)) fail('Bảng/level trận không hợp lệ');
      const t1=state.teams.find(t=>t.id===m.team1),t2=state.teams.find(t=>t.id===m.team2);
      if(t1.group!==m.groupA||t2.group!==m.groupB||t1.level!==m.level||t2.level!==m.level) fail('Trận đấu không khớp bảng/level của đội');
      const error=scoreError(m.score1??null,m.score2??null);if(error) fail(error);
      if(m.status!==undefined && !['pending','done'].includes(m.status)) fail('Trạng thái trận không hợp lệ');
    });
    if(state.liveCourts!==undefined){
      if(!Array.isArray(state.liveCourts)||state.liveCourts.length!==7) fail('LIVE cần đúng 7 sân');
      const courts=new Set();state.liveCourts.forEach(c=>{
        if(!c||!Number.isInteger(c.court)||c.court<1||c.court>7||courts.has(c.court)) fail('Mã sân LIVE không hợp lệ');courts.add(c.court);
        if(!['waiting','live','finished'].includes(c.status)) fail('Trạng thái LIVE không hợp lệ');
        for(const side of ['teamA','teamB']){
          const t=c[side];if(!t||typeof t.name!=='string'||t.name.length>200||!safeImageUrl(t.logo)||!Array.isArray(t.players)||t.players.length>2||t.players.some(p=>typeof p!=='string'||p.length>200)) fail('Thông tin đội LIVE không hợp lệ');
        }
        for(const key of ['scoreA','scoreB']) if(c[key]!==null && (!Number.isInteger(c[key])||c[key]<0||c[key]>999)) fail('Tỷ số LIVE phải là số nguyên 0–999');
        if(typeof c.note!=='string'||c.note.length>2000) fail('Ghi chú LIVE không hợp lệ');
      });
    }
    return state;
  }
  const api={EVENT_NAME,LEVELS,GROUPS,STORAGE_PREFIX,liveCourt,emptyState,scoreError,safeImageUrl,displayLiveCourts,validateState};
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
  else root.Tournament=api;
})(typeof window!=='undefined'?window:globalThis);
