const {test}=require('node:test');
const assert=require('node:assert/strict');
const {boot,Tournament}=require('./helpers.cjs');
const response=(status,data)=>({ok:status>=200&&status<300,status,json:async()=>data});

test('Writes serialize and send the last confirmed server version, including edits made in-flight',async()=>{
 const initial={...Tournament.emptyState(),updatedAt:100};let state=initial,release;const writes=[];
 const app=await boot({admin:true,fetch:async(url,options={})=>{
  if(options.method==='PUT'){
   const body=JSON.parse(options.body);writes.push(body);
   if(writes.length===1)await new Promise(resolve=>{release=resolve;});
   assert.equal(body.baseUpdatedAt,state.updatedAt);
   state={...body,updatedAt:state.updatedAt+1};delete state.baseUpdatedAt;
   return response(200,state);
  }
  return response(200,state);
 }});const {w}=app;
 try{
  w.eval("STATE.waiting.push({id:'P1',name:'Test 1',level:'A'});saveState()");const saving=w.flushState();
  assert.equal(w.isUserMidEdit(),true);w.eval("STATE.waiting.push({id:'P2',name:'Test 2',level:'A'});saveState()");
  release();assert.equal(await saving,true);assert.equal(writes.length,2);assert.equal(writes[0].baseUpdatedAt,100);assert.equal(writes[1].baseUpdatedAt,101);assert.equal(writes[1].waiting.length,2);assert.equal(w.eval('STATE.updatedAt'),102);assert.equal(w.isUserMidEdit(),false);assert.equal(w.document.getElementById('saveStatus').textContent,'Đã lưu');
 }finally{app.close();}
});

test('A 409 conflict keeps unsaved data, blocks polling and prevents a blind overwrite',async()=>{
 const initial={...Tournament.emptyState(),updatedAt:100};let writes=0,reads=0;
 const app=await boot({admin:true,fetch:async(url,options={})=>{if(options.method==='PUT'){writes++;return response(409,{error:'Conflict'});}reads++;return response(200,initial);}});const {w}=app;
 try{
  w.eval("STATE.waiting.push({id:'P1',name:'Unsaved test',level:'A'});saveState()");assert.equal(await w.flushState(),false);assert.equal(w.eval('STATE.waiting.length'),1);
  const before=reads;await w.refreshStateQuietly();assert.equal(reads,before);await w.flushState();assert.equal(writes,1);assert.match(w.document.getElementById('saveStatus').textContent,/Chưa lưu/);
  assert.equal(JSON.parse(w.localStorage.getItem(w.eval('STORAGE_KEY'))).waiting.length,1);
 }finally{app.close();}
});

test('A temporary server error displays failure and a manual retry saves the cached edits',async()=>{
 const initial={...Tournament.emptyState(),updatedAt:100};let fail=true;
 const app=await boot({admin:true,fetch:async(url,options={})=>options.method==='PUT'?(fail?response(500,{error:'Temporary test failure'}):response(200,{...JSON.parse(options.body),updatedAt:101})):response(200,initial)});const {w}=app;
 try{
  w.eval("STATE.waiting.push({id:'P1',name:'Retry test',level:'B'});saveState()");assert.equal(await w.flushState(),false);assert.equal(w.document.getElementById('btnSaveRetry').style.display,'');
  await w.doLogout();assert.ok(w.eval('CURRENT_USER'),'Failed save must prevent logout from dropping the draft');
  fail=false;assert.equal(await w.flushState(),true);assert.equal(w.document.getElementById('btnSaveRetry').style.display,'none');assert.equal(w.eval('STATE.waiting.length'),1);
 }finally{app.close();}
});
