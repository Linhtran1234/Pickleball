/* Live drafts are independent from official results and global full-state revisions. */
const liveDraftQueue=new Map();
const locallyFinalizedMatches=new Set();
let liveEventSource=null;
function applyLiveData(data){
  if(!STATE||!data||!Array.isArray(data.liveScores))return;
  if(Number(data.liveUpdatedAt||0)<Number(STATE.liveUpdatedAt||0))return;
  if(Number(data.liveUpdatedAt||0)===Number(STATE.liveUpdatedAt||0)&&JSON.stringify(data.liveScores)===JSON.stringify(STATE.liveScores))return;
  STATE.liveScores=data.liveScores;STATE.liveUpdatedAt=Number(data.liveUpdatedAt||0);
  localStorage.setItem(STORAGE_KEY,JSON.stringify(STATE));
  if(CURRENT_TAB==='live')render(); // Never re-render score inputs while somebody is typing.
}
function startLiveSync(){
  if(!USE_API||typeof EventSource==='undefined'||liveEventSource)return;
  liveEventSource=new EventSource(API_BASE+'/api/events');
  liveEventSource.addEventListener('live',event=>{try{applyLiveData(JSON.parse(event.data));}catch(error){console.warn('LIVE update:',error.message);}});
  liveEventSource.addEventListener('state',()=>refreshStateQuietly());
  liveEventSource.addEventListener('open',()=>{AppUX.setConnection(true);refreshStateQuietly();});
  // EventSource reconnects automatically. Existing periodic polling remains the fallback.
}
function hasPendingLiveScore(){return [...liveDraftQueue.values()].some(entry=>entry.pending||entry.inFlight);}
function liveDraftForMatch(matchId){
  if(locallyFinalizedMatches.has(matchId))return null;
  for(const entry of liveDraftQueue.values()){
    const draft=entry.pending||entry.current;
    if(draft?.matchId===matchId&&!draft.cancelled)return draft;
  }
  return (STATE.liveScores||[]).find(row=>row.matchId===matchId&&row.status==='live')||null;
}
function queueLiveMatch(matchId){
  if(!isAdmin()||!isTournamentStarted())return;
  const match=STATE.matches.find(m=>m.id===matchId&&!m.empty);if(!match||!match.court)return;
  const a=document.getElementById('score1_'+matchId),b=document.getElementById('score2_'+matchId);if(!a||!b)return;
  const number=input=>input.value===''?null:Number(input.value);
  const scoreA=number(a),scoreB=number(b);
  if([scoreA,scoreB].some(value=>value!==null&&(!Number.isInteger(value)||value<0||value>999)))return;
  locallyFinalizedMatches.delete(matchId);
  const court=Number(match.court),payload={matchId,team1:match.team1,team2:match.team2,scoreA,scoreB,baseScore1:match.score1??null,baseScore2:match.score2??null};
  if(!USE_API){
    const scores=(STATE.liveScores||[]).filter(s=>Number(s.court)!==court);
    scores.push({court,matchId,team1:match.team1,team2:match.team2,scoreA,scoreB,status:scoreA===match.score1&&scoreB===match.score2&&scoreA!==null&&scoreB!==null?'finished':'live',revision:Date.now()});
    applyLiveData({liveScores:scores,liveUpdatedAt:Date.now()});return;
  }
  let entry=liveDraftQueue.get(court);if(!entry){entry={pending:null,inFlight:null,timer:null,errorAt:0};liveDraftQueue.set(court,entry);}
  entry.pending=payload;clearTimeout(entry.timer);entry.timer=setTimeout(()=>{entry.timer=null;flushLiveDraft(court);},220);
  setLiveScoreHint(matchId,'Đang đồng bộ LIVE…');
}
function setLiveScoreHint(matchId,text,failed=false){
  const el=document.querySelector(`.match-card[data-match-id="${matchId}"] .match-live-hint`);if(el){el.textContent=text;el.classList.toggle('is-error',failed);}
}
async function flushLiveDraft(court){
  const entry=liveDraftQueue.get(Number(court));if(!entry)return true;
  clearTimeout(entry.timer);entry.timer=null;
  if(entry.inFlight){await entry.inFlight;return entry.pending?flushLiveDraft(court):true;}
  if(!entry.pending)return true;
  const payload=entry.pending;entry.pending=null;
  entry.current=payload;
  entry.inFlight=(async()=>{
    try{
      if((saveInFlight||saveRevision>savedRevision)&&!await flushState())throw new Error('Hãy lưu thay đổi của giải trước khi phát LIVE.');
      if(payload.cancelled)return true;
      const response=await fetch(API_BASE+'/api/live-scores/'+court,{method:'PUT',headers:{'Content-Type':'application/json',...authHeaders()},body:JSON.stringify(payload)});
      const data=await response.json();applyLiveData(data);
      if(payload.cancelled)return true;
      if(!response.ok){
        if(response.status===409){setLiveScoreHint(payload.matchId,'Kết quả đã đổi; bản nhập cũ không được phát',true);return true;}
        throw new Error(data.error||'Chưa đồng bộ được LIVE');
      }
      setLiveScoreHint(payload.matchId,'Đang phát trên LIVE · '+courtLabel(court));return true;
    }catch(error){
      if(payload.cancelled)return true;
      setLiveScoreHint(payload.matchId,'Chưa phát được LIVE · nhập lại để thử',true);
      if(Date.now()-entry.errorAt>5000){showToast(error.message,'error');entry.errorAt=Date.now();}return false;
    }
  })();
  const ok=await entry.inFlight;entry.inFlight=null;entry.current=null;
  if(entry.pending)return flushLiveDraft(court);return ok;
}
function cancelLiveDraft(matchId){
  for(const entry of liveDraftQueue.values()){if(entry.current?.matchId===matchId)entry.current.cancelled=true;if(entry.pending?.matchId===matchId){entry.pending=null;clearTimeout(entry.timer);entry.timer=null;}}
}
async function settleLiveCourt(court){
  const entry=liveDraftQueue.get(Number(court));if(!entry)return '';
  const matchId=entry.current?.matchId||entry.pending?.matchId||'';
  if(entry.current)entry.current.cancelled=true;entry.pending=null;clearTimeout(entry.timer);entry.timer=null;
  if(entry.inFlight)await entry.inFlight;
  return matchId;
}
function clearLiveDrafts(){
  locallyFinalizedMatches.clear();
  for(const entry of liveDraftQueue.values()){if(entry.current)entry.current.cancelled=true;entry.pending=null;clearTimeout(entry.timer);entry.timer=null;}
  if(STATE)STATE.liveScores=[];
}
function publishOfficialLive(match){
  cancelLiveDraft(match.id);
  locallyFinalizedMatches.add(match.id);
  if(USE_API){
    const row=(STATE.liveScores||[]).find(row=>row.matchId===match.id);
    if(row){if(match.score1===null&&match.score2===null)STATE.liveScores=STATE.liveScores.filter(row=>row.matchId!==match.id);else{row.scoreA=match.score1;row.scoreB=match.score2;row.status='finished';}}
  }
  if(!USE_API){
    const scores=(STATE.liveScores||[]).filter(s=>s.matchId!==match.id&&Number(s.court)!==Number(match.court));
    if(match.score1!==null&&match.score2!==null)scores.push({court:Number(match.court),matchId:match.id,team1:match.team1,team2:match.team2,scoreA:match.score1,scoreB:match.score2,status:'finished',revision:Date.now()});
    applyLiveData({liveScores:scores,liveUpdatedAt:Date.now()});
  }
}
function openScoringMatch(matchId){
  const match=STATE.matches.find(m=>m.id===matchId&&!m.empty);if(!match)return;
  matchFilter={level:'all',group:'all',status:'all',court:String(match.court),time:match.time||'all',team:'all'};switchTab('matches');
  const input=document.getElementById('score1_'+matchId);if(input){input.focus();input.closest('.match-card')?.scrollIntoView?.({block:'center',behavior:AppUX.reducedMotion()?'auto':'smooth'});}
}
