const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {fixture,Tournament,root}=require('./helpers.cjs');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'bmt-api-test-'));
process.env.TOURNAMENT_DB_PATH=path.join(temp,'tournament.db');
const app=require('../server');const store=require('../db');
let server,base,token;
async function request(route,method='GET',body,auth=token){
 const res=await fetch(base+route,{method,headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+auth}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 return {status:res.status,data:await res.json()};
}
async function login(username='admin',password='admin123'){const r=await request('/api/login','POST',{username,password},null);assert.equal(r.status,200);return r.data;}
before(async()=>{await new Promise(resolve=>{server=app.listen(0,'127.0.0.1',resolve);});base='http://127.0.0.1:'+server.address().port;token=(await login()).token;});
after(async()=>{await new Promise(resolve=>server.close(resolve));store.db.close();fs.rmSync(temp,{recursive:true,force:true});});

test('Brand-new DB and seed contain no event data; initial revision is stable',async()=>{
 const first=await request('/api/state'),second=await request('/api/state');assert.equal(first.status,200);assert.equal(first.data.updatedAt,second.data.updatedAt);
 for(const key of ['teams','waiting','matches'])assert.deepEqual(first.data[key],[]);
 assert.equal(first.data.tournamentStatus,'setup');assert.equal(first.data.liveCourts.length,7);assert.equal(store.listUsers().length,2);
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'seed-data.json'))),{teams:[],waiting:[],matches:[]});
 execFileSync(process.execPath,[path.join(root,'seed.js')],{env:process.env});assert.equal((await request('/api/state')).data.teams.length,0);
});

test('Unauthorized and viewer writes are rejected; admin can round-trip a new roster and scores',async()=>{
 const state=fixture(),current=(await request('/api/state')).data;const payload={...state,baseUpdatedAt:current.updatedAt};
 assert.equal((await request('/api/state','PUT',payload,null)).status,401);
 const viewer=(await login('user','user123')).token;assert.equal((await request('/api/state','PUT',payload,viewer)).status,403);
 assert.equal((await request('/api/state','PUT',state)).status,400,'Version is required');
 const match=state.matches[0];match.score1=11;match.score2=9;match.status='done';state.liveCourts[0].status='live';state.liveCourts[0].scoreA=8;
 const saved=await request('/api/state','PUT',{...state,baseUpdatedAt:current.updatedAt});assert.equal(saved.status,200);assert.equal(saved.data.teams.length,30);assert.equal(saved.data.matches.length,75);assert.equal(saved.data.matches.find(m=>m.id===match.id).score1,11);assert.equal(saved.data.liveCourts[0].scoreA,8);
 assert.ok(saved.data.updatedAt>current.updatedAt);
 const reread=(await request('/api/state')).data;assert.equal(reread.updatedAt,saved.data.updatedAt);assert.equal(reread.matches.find(m=>m.id===match.id).score2,9);
});

test('Stale saves and invalid JSON state are refused without erasing the valid roster',async()=>{
 let current=(await request('/api/state')).data;
 const saved=await request('/api/state','PUT',{...current,baseUpdatedAt:current.updatedAt});assert.equal(saved.status,200);
 assert.equal((await request('/api/state','PUT',{...current,baseUpdatedAt:current.updatedAt})).status,409);
 current=saved.data;
 for(const mutate of [s=>delete s.teams,s=>s.teams.push(s.teams[0]),s=>s.teams[0].id="X' onclick='alert(1)",s=>s.matches[0].score1=999,s=>s.matches[0].court='<img>',s=>{s.tournamentStatus='started';s.teams[0].group=null;},s=>s.liveCourts[0].teamA.logo='javascript:alert(1)',s=>s.teams[0].p1.name='']){
  const bad=structuredClone(current);mutate(bad);assert.equal((await request('/api/state','PUT',{...bad,baseUpdatedAt:current.updatedAt})).status,400);assert.equal((await request('/api/state')).data.updatedAt,current.updatedAt);
 }
 assert.equal((await request('/api/state')).data.teams.length,30);
});

test('Role changes and user removal take effect immediately on existing sessions',async()=>{
 const created=await request('/api/users','POST',{username:'test_staff',password:'testpass',role:'admin',displayName:'Test staff'});assert.equal(created.status,200);
 const staff=(await login('test_staff','testpass')).token;assert.equal((await request('/api/users','GET',undefined,staff)).status,200);
 assert.equal((await request('/api/users/'+created.data.id,'PUT',{role:'user'})).status,200);assert.equal((await request('/api/users','GET',undefined,staff)).status,403);
 assert.equal((await request('/api/users/'+created.data.id,'DELETE')).status,200);assert.equal((await request('/api/me','GET',undefined,staff)).status,401);
 const admin=store.findUserByUsername('admin');assert.equal((await request('/api/users/'+admin.id,'PUT',{role:'user'})).status,400);assert.equal((await request('/api/users/'+admin.id,'DELETE')).status,400);
});

test('Changing a password revokes other sessions; reset endpoints reject missing users',async()=>{
 const a=await request('/api/users','POST',{username:'test_password',password:'testpass',role:'user'});assert.equal(a.status,200);
 const s1=(await login('test_password','testpass')).token,s2=(await login('test_password','testpass')).token;
 assert.equal((await request('/api/me/password','PUT',{oldPassword:'testpass',newPassword:'newpass'},s1)).status,200);assert.equal((await request('/api/me','GET',undefined,s1)).status,200);assert.equal((await request('/api/me','GET',undefined,s2)).status,401);
 assert.equal((await request('/api/users/notfound/reset-password','POST',{newPassword:'newpass'})).status,400);
 assert.equal((await request('/api/users/'+a.data.id+'/reset-password','POST',{newPassword:'admin_reset'})).status,200);assert.equal((await request('/api/me','GET',undefined,s1)).status,401);
});

test('Reset CLI removes event data, preserves accounts and passwords, and never restores demo participants',async()=>{
 const refused=require('node:child_process').spawnSync(process.execPath,[path.join(root,'reset-tournament.js')],{env:process.env});assert.equal(refused.status,1);
 const accountsBefore=store.db.prepare('SELECT id,username,role,password_hash FROM users ORDER BY id').all();
 execFileSync(process.execPath,[path.join(root,'reset-tournament.js'),'--confirm'],{env:process.env});
 assert.deepEqual(store.db.prepare('SELECT id,username,role,password_hash FROM users ORDER BY id').all(),accountsBefore);
 const state=(await request('/api/state')).data;for(const key of ['teams','waiting','matches'])assert.deepEqual(state[key],[]);
 assert.equal(state.liveCourts.every(c=>c.status==='waiting'&&!c.teamA.name&&c.scoreA===null),true);assert.equal(state.tournamentStatus,'setup');assert.equal(store.listUsers().length,accountsBefore.length);assert.equal((await request('/api/me')).status,200);
 execFileSync(process.execPath,[path.join(root,'seed.js')],{env:process.env});assert.equal((await request('/api/state')).data.matches.length,0);
});


test('Local admin recovery repairs access without changing event records or other accounts',async()=>{
 const before=(await request('/api/state')).data;
 const viewer=store.findUserByUsername('user');
 execFileSync(process.execPath,[path.join(root,'recover-admin.js')],{env:{...process.env,BMT_ADMIN_USERNAME:'recovered_admin',BMT_ADMIN_PASSWORD:'synthetic-test-pass'}});
 const session=await login('recovered_admin','synthetic-test-pass');
 assert.equal((await request('/api/users','GET',undefined,session.token)).status,200);
 assert.equal((await request('/api/state')).data.updatedAt,before.updatedAt);
 assert.equal(store.findUserByUsername('user').password_hash,viewer.password_hash);
 const count=store.listUsers().length;
 execFileSync(process.execPath,[path.join(root,'recover-admin.js')],{env:{...process.env,BMT_ADMIN_USERNAME:'recovered_admin',BMT_ADMIN_PASSWORD:'another-test-pass'}});
 assert.equal(store.listUsers().length,count);assert.equal((await login('recovered_admin','another-test-pass')).user.role,'admin');
});
