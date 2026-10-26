const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom');
const Tournament=require('../public/tournament');
const {FIXED_SCHEDULE}=require('../public/schedule');
const root=path.resolve(__dirname,'..');
function fixture(){
  const state=Tournament.emptyState();
  for(const group of Tournament.GROUPS) Tournament.LEVELS.forEach((level,index)=>{
    const person=slot=>({name:`VĐV kiểm thử ${group}-${level}-${slot}`,level});
    state.teams.push({id:group+(index+1),group,level,p1:person(1),p2:person(2),note:''});
  });
  state.matches=FIXED_SCHEDULE.map((slot,index)=>({id:'M'+(index+1),...slot,team1:state.teams.find(t=>t.group===slot.groupA&&t.level===slot.level).id,team2:state.teams.find(t=>t.group===slot.groupB&&t.level===slot.level).id,score1:null,score2:null,status:'pending'}));
  return state;
}
async function boot(options={}){
  const errors=[];
  const vc=new VirtualConsole();vc.on('jsdomError',error=>errors.push(error.message));
  const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
  const dom=new JSDOM(html.replace(/<script src="[^"]+"><\/script>\s*/g,''),{runScripts:'dangerously',url:'http://localhost/',virtualConsole:vc});
  const w=dom.window;
  w.fetch=options.fetch||(()=>Promise.reject(new Error('No API in offline unit test')));
  w.requestAnimationFrame=cb=>w.setTimeout(()=>cb(w.performance.now()+2000),0);
  w.confirm=()=>true;
  if(options.storage) for(const [key,value] of Object.entries(options.storage)) w.localStorage.setItem(key,JSON.stringify(value));
  for(const [,file] of html.matchAll(/<script src="([^"]+)"><\/script>/g)){
    const script=w.document.createElement('script');script.textContent=fs.readFileSync(path.join(root,'public',file),'utf8');w.document.body.appendChild(script);
  }
  for(let i=0;i<100;i++){
    try{if(w.eval('STATE')!==null) break;}catch{}
    await new Promise(r=>setTimeout(r,5));
  }
  assert.ok(w.eval('STATE'),'Application initialized');
  if(options.state) w.eval(`STATE=${JSON.stringify(options.state)}`);
  if(options.admin) w.eval("CURRENT_USER={id:'test_admin',username:'test_admin',role:'admin',displayName:'Test Admin',local:true}");
  w.render();
  return {dom,w,errors,close:()=>w.close()};
}
module.exports={fixture,boot,root,Tournament};
