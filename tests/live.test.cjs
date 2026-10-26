const {test,before,beforeEach,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {fixture,boot,Tournament}=require('./helpers.cjs');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'bmt-live-test-'));process.env.TOURNAMENT_DB_PATH=path.join(temp,'live.db');
const app=require('../server'),store=require('../db');let server,base,token;
async function request(route,method='GET',body,auth=token){const response=await fetch(base+route,{method,headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+auth}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,data:await response.json()};}
const publish=(m,a,b)=>({matchId:m.id,team1:m.team1,team2:m.team2,scoreA:a,scoreB:b,baseScore1:m.score1,baseScore2:m.score2});
before(async()=>{await new Promise(resolve=>{server=app.listen(0,'127.0.0.1',resolve);});base='http://127.0.0.1:'+server.address().port;token=(await request('/api/login','POST',{username:'admin',password:'admin123'},null)).data.token;});
beforeEach(()=>{store.saveFullState(Tournament.emptyState());const state=fixture();state.tournamentStatus='started';store.saveFullState(state);});
after(async()=>{await new Promise(resolve=>server.close(resolve));store.db.close();fs.rmSync(temp,{recursive:true,force:true});});

test('Live drafts accept ongoing/tied scores without changing official scores or full-state version',async()=>{
 const state=store.getFullState(),match=state.matches.find(m=>Number(m.court)===1);
 assert.equal((await request('/api/live-scores/1','PUT',publish(match,3,3),null)).status,401);
 const viewer=(await request('/api/login','POST',{username:'user',password:'user123'},null)).data.token;
 assert.equal((await request('/api/live-scores/1','PUT',publish(match,3,3),viewer)).status,403);
 const result=await request('/api/live-scores/1','PUT',publish(match,3,3));assert.equal(result.status,200);assert.equal(result.data.liveScores[0].status,'live');
 const saved=store.getFullState();assert.equal(saved.updatedAt,state.updatedAt);assert.equal(saved.matches.find(m=>m.id===match.id).score1,null);assert.ok(saved.liveUpdatedAt>state.liveUpdatedAt);
 const court=Tournament.displayLiveCourts(saved)[0];assert.equal(court.matchId,match.id);assert.equal(court.scoreA,3);assert.equal(court.scoreB,3);assert.equal(court.teamA.players[0],saved.teams.find(t=>t.id===match.team1).p1.name);
 assert.equal((await request('/api/live-scores/2','PUT',publish(match,3,3))).status,400);
 assert.equal((await request('/api/live-scores/1','PUT',{...publish(match,3,3),team1:'outdated-team'})).status,409);
 assert.equal((await request('/api/live-scores/1','PUT',publish(match,-1,3))).status,400);
 assert.equal((await request('/api/live-scores/1','PUT',publish(match,1.5,3))).status,400);
});

test('Independent courts update together and do not invalidate an in-progress official save',async()=>{
 const state=store.getFullState(),a=state.matches.find(m=>Number(m.court)===1),b=state.matches.find(m=>Number(m.court)===2);
 const results=await Promise.all([request('/api/live-scores/1','PUT',publish(a,4,2)),request('/api/live-scores/2','PUT',publish(b,7,8))]);assert.ok(results.every(r=>r.status===200));assert.equal(store.getFullState().liveScores.length,2);
 const official=await request('/api/state','PUT',{...state,baseUpdatedAt:state.updatedAt});assert.equal(official.status,200);assert.equal(official.data.liveScores.length,2);assert.equal(official.data.liveScores.find(c=>c.court===2).scoreB,8);
});

test('Saving a final result finishes the live match; delayed old input cannot overwrite it',async()=>{
 const state=store.getFullState(),match=state.matches.find(m=>Number(m.court)===1);
 const oldDraft=publish(match,4,2);await request('/api/live-scores/1','PUT',oldDraft);
 match.score1=11;match.score2=9;match.status='done';
 const saved=await request('/api/state','PUT',{...state,baseUpdatedAt:state.updatedAt});assert.equal(saved.status,200);assert.equal(saved.data.liveScores[0].status,'finished');assert.equal(saved.data.liveScores[0].scoreA,11);
 const stale=await request('/api/live-scores/1','PUT',oldDraft);assert.equal(stale.status,409);assert.equal(store.getFullState().liveScores[0].status,'finished');assert.equal(store.getFullState().liveScores[0].scoreB,9);
 const correction=publish(match,12,10);assert.equal((await request('/api/live-scores/1','PUT',correction)).status,200);assert.equal(store.getFullState().liveScores[0].status,'live');assert.equal(store.getFullState().matches.find(m=>m.id===match.id).score1,11);
 const current=store.getFullState(),m=current.matches.find(m=>m.id===match.id);m.score1=null;m.score2=null;m.status='pending';
 assert.equal((await request('/api/state','PUT',{...current,baseUpdatedAt:current.updatedAt})).status,200);assert.equal(store.getFullState().liveScores.length,0);
});

test('Manual overrides can detach a court, but stale detach cannot erase a different active match',async()=>{
 const state=store.getFullState(),matches=state.matches.filter(m=>Number(m.court)===1),a=matches[0],b=matches[1];
 await request('/api/live-scores/1','PUT',publish(a,5,4));
 const current=store.getFullState();current.liveCourts[0].status='live';current.liveCourts[0].teamA.name='Manual test';current.liveCourts[0].scoreA=7;
 await request('/api/state','PUT',{...current,baseUpdatedAt:current.updatedAt});
 assert.equal(Tournament.displayLiveCourts(store.getFullState())[0].source,'match');
 assert.equal((await request('/api/live-scores/1','DELETE',{matchId:a.id})).status,200);assert.equal(Tournament.displayLiveCourts(store.getFullState())[0].teamA.name,'Manual test');
 await request('/api/live-scores/1','PUT',publish(b,1,0));assert.equal((await request('/api/live-scores/1','DELETE',{matchId:a.id})).status,409);assert.equal(store.getFullState().liveScores[0].matchId,b.id);
});

test('SSE pushes live scores to viewers; full reset clears broadcasts and preserves accounts',async()=>{
 const controller=new AbortController();const stream=await fetch(base+'/api/events',{signal:controller.signal});assert.match(stream.headers.get('content-type'),/text\/event-stream/);const reader=stream.body.getReader(),decoder=new TextDecoder();
 try{
  let text=decoder.decode((await reader.read()).value);assert.match(text,/event: live/);
  const state=store.getFullState(),match=state.matches.find(m=>Number(m.court)===1);await request('/api/live-scores/1','PUT',publish(match,8,6));
  while(!text.includes('"scoreA":8'))text+=decoder.decode((await reader.read()).value);assert.ok(text.includes(match.id));
  const users=store.db.prepare('SELECT id,password_hash FROM users ORDER BY id').all();
  const current=store.getFullState();const reset=await request('/api/state','PUT',{...Tournament.emptyState(),baseUpdatedAt:current.updatedAt});assert.equal(reset.status,200);assert.deepEqual(reset.data.liveScores,[]);assert.equal(reset.data.liveCourts.every(c=>c.status==='waiting'),true);assert.deepEqual(store.db.prepare('SELECT id,password_hash FROM users ORDER BY id').all(),users);
 }finally{await reader.cancel();controller.abort();}
});

test('Typing publishes the right court locally without counting unfinished points; final save and setup clear it',async()=>{
 const state=fixture();state.tournamentStatus='started';const client=await boot({state,admin:true});const {w}=client;
 try{
  w.switchTab('matches');const match=w.eval('STATE.matches.find(m=>Number(m.court)===1)');const a=w.document.getElementById('score1_'+match.id),b=w.document.getElementById('score2_'+match.id);
  a.value='4';a.dispatchEvent(new w.Event('input',{bubbles:true}));b.value='3';b.dispatchEvent(new w.Event('input',{bubbles:true}));
  assert.equal(match.score1,null);assert.equal(w.eval('computeTeamStats()')[match.team1].points,0);assert.equal(w.eval('STATE.liveScores[0].scoreA'),4);
  w.switchTab('live');const card=w.document.querySelector('.live-card[data-court="1"]');assert.match(card.textContent,/LIVE/);assert.match(card.textContent,new RegExp(state.teams.find(t=>t.id===match.team1).p1.name));
  w.applyLiveData({liveUpdatedAt:Number(w.eval('STATE.liveUpdatedAt'))+1,liveScores:JSON.parse(w.eval('JSON.stringify(STATE.liveScores)'))});assert.equal(w.document.getElementById('app').classList.contains('ux-stream-update'),true);
  w.openScoringMatch(match.id);w.document.getElementById('score1_'+match.id).value='11';w.document.getElementById('score2_'+match.id).value='9';w.saveMatchScore(match.id);assert.equal(w.eval('STATE.liveScores[0].status'),'finished');
  w.restoreTournamentSetup();assert.equal(w.eval('STATE.liveScores.length'),0);assert.deepEqual(client.errors,[]);
 }finally{client.close();}
});

test('A delayed broadcast cannot put old draft values back into freshly saved result inputs',async()=>{
 const state=fixture();state.tournamentStatus='started';const match=state.matches.find(m=>Number(m.court)===1);
 state.liveScores=[{court:1,matchId:match.id,team1:match.team1,team2:match.team2,scoreA:4,scoreB:3,status:'live',revision:1}];state.liveUpdatedAt=1;
 const client=await boot({state,admin:true});const {w}=client;
 try{
  w.eval('USE_API=true');w.switchTab('matches');assert.equal(w.document.getElementById('score1_'+match.id).value,'4');
  w.document.getElementById('score1_'+match.id).value='11';w.document.getElementById('score2_'+match.id).value='9';w.saveMatchScore(match.id);
  assert.equal(w.document.getElementById('score1_'+match.id).value,'11');
  w.applyLiveData({liveUpdatedAt:2,liveScores:[{court:1,matchId:match.id,team1:match.team1,team2:match.team2,scoreA:4,scoreB:3,status:'live',revision:2}]});w.render();
  assert.equal(w.document.getElementById('score1_'+match.id).value,'11');assert.equal(w.document.getElementById('score2_'+match.id).value,'9');assert.deepEqual(client.errors,[]);
 }finally{client.close();}
});
