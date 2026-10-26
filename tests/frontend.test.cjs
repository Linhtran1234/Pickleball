const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {boot,fixture,root,Tournament}=require('./helpers.cjs');

test('New tournament starts empty, ignores old browser cache, and renders 8 tabs × 2 roles',async()=>{
 const old=fixture();old.teams[0].p1.name='OLD_TOURNAMENT_SENTINEL';
 const app=await boot({storage:{'duhung-pickleball-2026-v1':old,'duhung-pickleball-2026-auth':{token:'old',role:'admin',local:true}}});const {w}=app;
 try{
  const initial=w.eval('JSON.stringify(STATE)');
  for(const key of ['teams','waiting','matches']) assert.equal(w.eval(`STATE.${key}.length`),0);
  assert.equal(w.eval('STATE.tournamentStatus'),'setup');assert.equal(w.eval('rankGroups().length'),0);assert.equal(w.eval('CURRENT_USER'),null);assert.equal(w.localStorage.getItem('duhung-pickleball-2026-v1'),null);
  assert.match(w.document.title,/BMT MATERIAL.*15 NĂM/);assert.equal(w.document.querySelector('.brand img').getAttribute('src'),'assets/bmt-logo.svg');
  for(const role of ['user','admin']){
   w.eval(`CURRENT_USER={role:'${role}',displayName:'Test',local:true}`);
   for(const tab of ['overview','live','players','teams','board','matches','ranking','rules']){
    w.switchTab(tab);assert.ok(w.document.getElementById('app').textContent.trim());assert.doesNotMatch(w.document.body.textContent,/OLD_TOURNAMENT_SENTINEL/);
    if(tab==='overview'){assert.match(w.document.querySelector('.event-info-bar').textContent,/14\.11\.2026/);assert.equal(w.document.querySelectorAll('.podium-item').length,0);}
    if(tab==='board'){assert.equal(w.document.querySelectorAll('.board-slot').length,30);assert.equal(w.document.querySelectorAll('.board-slot.empty').length,30);}
    if(tab==='live'){assert.equal(w.document.querySelectorAll('.live-card').length,7);assert.equal(w.document.querySelectorAll('.live-edit-btn').length,role==='admin'?7:0);}
    if(tab==='matches'&&role==='user') assert.equal(w.document.querySelectorAll('#app button').length,0);
    for(const img of w.document.querySelectorAll('img[src]')) if(!/^https?:/.test(img.getAttribute('src'))) assert.ok(fs.existsSync(path.join(root,'public',img.getAttribute('src'))));
   }
  }
  assert.equal(w.eval('JSON.stringify(STATE)'),initial);assert.deepEqual(app.errors,[]);
 }finally{app.close();}
});

test('Create people, auto-pair by level, assign and start a full tournament, score and lock edits',async()=>{
 const app=await boot({admin:true});const {w}=app;
 try{
  const waiting=[];for(let i=0;i<2;i++)waiting.push({id:'W'+i,name:'Test registrant '+i,level:'A'});
  w.eval(`STATE.waiting=${JSON.stringify(waiting)}`);w.autoPairByLevel();assert.equal(w.eval('STATE.teams.length'),1);assert.equal(w.eval('STATE.waiting.length'),0);
  w.assignTeamToGroup(w.eval('STATE.teams[0].id'),'A');assert.equal(w.eval('STATE.teams[0].group'),'A');
  w.startTournament();assert.equal(w.eval('STATE.tournamentStatus'),'setup','Cannot start an incomplete board');
  w.eval(`STATE=${JSON.stringify(fixture())}`);w.startTournament();assert.equal(w.eval('STATE.tournamentStatus'),'started');assert.equal(w.eval('STATE.matches.filter(m=>!m.empty).length'),75);
  w.switchTab('matches');const match=w.eval('STATE.matches[0]');
  const cases=[[9,9,false],[9,7,false],[11,10,false],[11,9,true],[12,10,true],[15,14,true],[16,14,false],[15,12,false],[-1,11,false],[11.5,9,false]];
  for(const [a,b,expected] of cases){
   match.score1=null;match.score2=null;match.status='pending';w.render();w.document.getElementById('score1_'+match.id).value=String(a);w.document.getElementById('score2_'+match.id).value=String(b);w.saveMatchScore(match.id);assert.equal(match.score1!==null,expected,`${a}-${b}`);
  }
  w.render();w.document.getElementById('score1_'+match.id).value='11';w.document.getElementById('score2_'+match.id).value='7';w.saveMatchScore(match.id);
  assert.equal(w.eval('computeTeamStats()')[match.team1].points,1);assert.equal(w.eval('computeGroupStats()')[match.groupA].totalPoints,1);
  const firstId=w.eval('STATE.teams[0].id');const count=w.eval('STATE.teams.length');w.deleteTeam(firstId);assert.equal(w.eval('STATE.teams.length'),count);
  w.restoreTournamentSetup();assert.equal(w.eval('STATE.tournamentStatus'),'setup');assert.equal(w.eval('STATE.matches.filter(m=>m.score1!==null).length'),0);
  assert.deepEqual(app.errors,[]);
 }finally{app.close();}
});

test('Reassigning a team cannot inherit another pair’s score; score input drafts survive re-render',async()=>{
 const app=await boot({admin:true,state:fixture()});const {w}=app;
 try{
  w.eval("STATE.matches.find(m=>m.team1==='A1'&&m.team2==='F1').score1=11;STATE.matches.find(m=>m.team1==='A1'&&m.team2==='F1').score2=2;STATE.teams.find(t=>t.id==='B1').group=null;STATE.teams.find(t=>t.id==='A1').group='B';regenerateMatches(false)");
  assert.equal(w.eval("STATE.matches.filter(m=>m.team1==='A1'||m.team2==='A1').every(m=>m.score1===null&&m.score2===null)"),true);
  w.eval(`STATE=${JSON.stringify(fixture())};STATE.tournamentStatus='started'`);w.switchTab('matches');const [m1,m2]=w.eval('STATE.matches');
  m2.score1=11;m2.score2=9;m2.status='done';w.render();w.document.getElementById('score1_'+m2.id).value='';w.document.getElementById('score2_'+m2.id).value='10';w.document.getElementById('score1_'+m1.id).value='11';w.document.getElementById('score2_'+m1.id).value='9';w.saveMatchScore(m1.id);assert.equal(w.document.getElementById('score1_'+m2.id).value,'');assert.equal(w.document.getElementById('score2_'+m2.id).value,'10');
 }finally{app.close();}
});

test('LIVE quick-fill handles SQLite string courts, validates input and resets all event data',async()=>{
 const state=fixture();state.matches.forEach(m=>m.court=String(m.court));const app=await boot({admin:true,state});const {w}=app;
 try{
  w.switchTab('live');w.openLiveCourtModal(1);assert.ok(w.document.getElementById('live_pick_match'));
  w.fillLiveMatchFromSelect(state.matches.find(m=>m.court==='1').id);assert.ok(w.document.getElementById('live_a_name').value);
  w.document.getElementById('live_status').value='live';w.document.getElementById('live_score_a').value='1.5';w.saveLiveCourt(1);assert.equal(w.eval('STATE.liveCourts[0].scoreA'),null);
  w.document.getElementById('live_score_a').value='11';w.document.getElementById('live_score_b').value='7';w.saveLiveCourt(1);assert.equal(w.eval('STATE.liveCourts[0].scoreA'),11);
  const html=w.liveTeamLogoHtml({name:"'\"<img>",logo:'assets/missing.png'});assert.doesNotMatch(html,/innerHTML/);
  w.document.getElementById('btnReset').click();for(const key of ['teams','waiting','matches'])assert.equal(w.eval(`STATE.${key}.length`),0);
  assert.equal(w.eval("STATE.liveCourts.every(c=>c.status==='waiting'&&!c.teamA.name&&c.scoreA===null)"),true);
  assert.equal(w.eval('STATE.tournamentStatus'),'setup');assert.deepEqual(app.errors,[]);
 }finally{app.close();}
});

test('Server login errors never grant local demo admin access over HTTP',async()=>{
 const app=await boot();try{const result=await app.w.attemptLogin('admin','admin123');assert.equal(result.ok,false);assert.equal(app.w.eval('CURRENT_USER'),null);}finally{app.close();}
});

test('LIVE sidebar keeps official history across court changes and preserves the selected directory',async()=>{
 const state=fixture();state.tournamentStatus='started';
 const first=state.matches.find(m=>!m.empty);first.score1=11;first.score2=9;first.status='done';
 const next=state.matches.find(m=>!m.empty&&m.id!==first.id);next.score1=11;next.score2=10;
 const app=await boot({state});const {w}=app;
 try{
  w.switchTab('live');
  assert.equal(w.document.querySelectorAll('.live-result-item').length,1,'Only valid saved scores belong in official history');
  assert.match(w.document.querySelector('.live-result-item').textContent,/11/);
  w.selectLiveSidebar('teams');
  assert.equal(w.document.querySelectorAll('.live-directory-team').length,state.teams.length);
  assert.match(w.document.querySelector('.live-sidebar-panel').textContent,/1 trận đã đấu/);
  w.render();assert.equal(w.document.querySelector('.live-sidebar [role=tab][aria-selected=true]').id,'live-sidebar-teams');
  w.eval(`STATE.liveScores=[{court:${first.court},matchId:${JSON.stringify(next.id)},team1:${JSON.stringify(next.team1)},team2:${JSON.stringify(next.team2)},scoreA:2,scoreB:1,status:'live'}]`);
  w.selectLiveSidebar('results');assert.equal(w.document.querySelectorAll('.live-result-item').length,1,'A new live draft never replaces completed history');
  w.liveSidebarKey({key:'ArrowRight',preventDefault(){}});assert.equal(w.document.activeElement.id,'live-sidebar-teams');
  assert.deepEqual(app.errors,[]);
 }finally{app.close();}
});
