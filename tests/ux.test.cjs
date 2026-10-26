const {test}=require('node:test');
const assert=require('node:assert/strict');
const {boot}=require('./helpers.cjs');

test('Navigation has accessible tabs, route headings, and a keyboard-searchable command palette',async()=>{
 const app=await boot();const {w}=app;
 try{
  assert.ok(w.document.getElementById('app').classList.contains('is-overview'));
  assert.equal(w.document.querySelector('.tab-btn.active').getAttribute('aria-selected'),'true');
  assert.equal(w.document.querySelectorAll('.ux-journey-step').length,4);
  assert.ok(w.document.getElementById('eventCountdown').textContent.trim());
  w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true}));
  assert.equal(w.document.getElementById('modalBox').getAttribute('role'),'dialog');
  const search=w.document.getElementById('uxCommandSearch');assert.equal(w.document.activeElement,search);
  search.value='doi thi dau';search.dispatchEvent(new w.Event('input',{bubbles:true}));assert.equal(w.document.querySelector('.ux-command:not([hidden])').dataset.command,'teams');
  search.value='khongtimthay';search.dispatchEvent(new w.Event('input',{bubbles:true}));assert.equal(w.document.getElementById('uxCommandEmpty').hidden,false);
  search.value='xep hang';search.dispatchEvent(new w.Event('input',{bubbles:true}));
  assert.equal(w.document.querySelectorAll('.ux-command:not([hidden])').length,1);
  w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  assert.equal(w.eval('CURRENT_TAB'),'ranking');assert.ok(w.document.querySelector('.ux-page-heading'));
  assert.equal(w.document.querySelector('[data-tab="ranking"]').getAttribute('aria-selected'),'true');
  assert.equal(w.document.getElementById('app').getAttribute('aria-labelledby'),'tab-ranking');
  assert.ok(!w.document.getElementById('modalOverlay').classList.contains('open'));
  assert.deepEqual(app.errors,[]);
 }finally{app.close();}
});

test('Login supports show/hide password, escape, and restoring keyboard focus',async()=>{
 const app=await boot();const {w}=app;
 try{
  const trigger=w.document.getElementById('btnLoginOpen');trigger.focus();trigger.click();
  assert.equal(w.document.activeElement,w.document.getElementById('loginUsername'));
  assert.equal(w.document.querySelector('.auth-card').getAttribute('aria-modal'),'true');
  const toggle=w.document.getElementById('passwordToggle');toggle.click();assert.equal(w.document.getElementById('loginPassword').type,'text');assert.equal(toggle.getAttribute('aria-pressed'),'true');
  toggle.click();assert.equal(w.document.getElementById('loginPassword').type,'password');
  w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(w.document.getElementById('authScreen').style.display,'none');assert.equal(w.document.activeElement,trigger);
  assert.deepEqual(app.errors,[]);
 }finally{app.close();}
});

test('Toast feedback is dismissible and is built as text rather than injected user HTML',async()=>{
 const app=await boot();const {w}=app;
 try{
  w.showToast('<img src=x onerror=alert(1)>','error');const toast=w.document.getElementById('toast');assert.equal(toast.querySelectorAll('img').length,0);assert.match(toast.textContent,/<img/);assert.equal(toast.getAttribute('role'),'status');
  toast.querySelector('button').click();assert.equal(toast.className,'toast');assert.deepEqual(app.errors,[]);
 }finally{app.close();}
});
